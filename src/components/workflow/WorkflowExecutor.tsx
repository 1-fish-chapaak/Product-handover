import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, ArrowRight, Play, UploadCloud, File as FileIcon,
  Square, Download, LayoutDashboard, AlertTriangle,
  CheckCircle2, Clock, Loader2,
  ChevronDown, ChevronUp, X, Database, Search, Check,
  TrendingUp, Users, Percent, CalendarDays, Pencil, AlertCircle,
  Link2, RefreshCw, Info, Wand2,
} from 'lucide-react';
import PlanPanel, { type ExecutorParameters } from '../concierge-workflow-builder/PlanPanel';
import { seedAlignments } from '../concierge-workflow-builder/mockApi';
import type {
  WorkflowDraft,
  JourneyFiles,
  JourneyAlignments,
  ColumnAlignment,
  UploadedFile,
} from '../concierge-workflow-builder/types';
import { DATA_SOURCES } from '../../data/mockData';

interface WorkflowExecutorProps {
  workflowId: string;
  onBack: () => void;
  /** Fires when the simulated run reaches the 'complete' phase. App.tsx
   *  wires this to push a platform notification. */
  onRunComplete?: (workflowId: string) => void;
}

type ExecutionPhase = 'idle' | 'running' | 'complete';

interface ExecutionStep {
  label: string;
  duration: number;
}

interface ResultRow {
  invoiceNo: string;
  vendor: string;
  amount: string;
  duplicateGroup: string;
  confidence: number;
}

// ─── Mock workflow (matches Image #3) ────────────────────
const EXECUTOR_WORKFLOW: WorkflowDraft = {
  id: 'wf-001',
  name: 'Invoice Duplicate Detection',
  description:
    'Scans incoming invoices against historical data to flag potential duplicates before payment processing',
  category: 'Accounts Payable',
  tags: ['duplicates', 'AP', 'fuzzy match'],
  logicPrompt:
    'Scan invoices for near-duplicates on vendor + amount + date and reconcile against the GL trial balance. Flag any invoice that lacks an approved vendor or whose GL posting is missing.',
  inputs: [
    {
      id: 'ap_invoice_register',
      name: 'AP Invoice Register',
      type: 'csv',
      description:
        'Period export of posted invoices — invoice number, vendor, amount, date, GL account, entered-by user.',
      required: true,
      multiple: true,
      columns: ['Invoice No', 'Vendor ID', 'Amount', 'GL Account', 'Invoice Date', 'Entered By'],
    },
    {
      id: 'vendor_master',
      name: 'Vendor Master',
      type: 'csv',
      description:
        'Active vendor master snapshot used to validate every invoice vendor against the approved list.',
      required: true,
      columns: ['Vendor ID', 'Name', 'Bank Account', 'Status', 'Created On'],
    },
    {
      id: 'gl_trial_balance',
      name: 'GL Trial Balance',
      type: 'csv',
      description:
        'Period-end trial balance export — ties AP postings back to the general ledger for reconciliation.',
      required: true,
      columns: ['Account', 'Description', 'Debit', 'Credit', 'Balance'],
    },
  ],
  steps: [
    {
      id: 's1',
      name: 'Detect near-duplicate invoices',
      description: 'Fuzzy match on vendor, amount, and invoice date.',
      type: 'analyze',
      dataFiles: ['ap_invoice_register'],
    },
    {
      id: 's2',
      name: 'Validate vendors',
      description: 'Every invoice vendor must exist and be active in the master.',
      type: 'validate',
      dataFiles: ['ap_invoice_register', 'vendor_master'],
    },
    {
      id: 's3',
      name: 'Reconcile to GL',
      description: 'Tie AP postings back to the GL trial balance within tolerance.',
      type: 'compare',
      dataFiles: ['ap_invoice_register', 'gl_trial_balance'],
    },
    {
      id: 's4',
      name: 'Flag duplicates',
      description: 'Emit one flag per duplicate group with severity and amount at risk.',
      type: 'flag',
      dataFiles: ['ap_invoice_register', 'vendor_master', 'gl_trial_balance'],
    },
  ],
  output: {
    type: 'flags',
    title: 'Duplicate Invoice Findings',
    description: 'Groups of near-duplicate invoices flagged for review.',
  },
};

const EXECUTION_STEPS: ExecutionStep[] = [
  { label: 'Loading data sources...', duration: 800 },
  { label: 'Matching records against vendor master...', duration: 900 },
  { label: 'Running fuzzy duplicate analysis...', duration: 800 },
  { label: 'Scoring & generating report...', duration: 500 },
];

const CLARIFICATION_QUESTION = 'How should we handle vendor name variations (e.g., "Acme Corp" vs "Acme Corporation")?';
const CLARIFICATION_OPTIONS = [
  'Always treat as the same vendor',
  'Fuzzy match above 85% similarity',
  'Only exact matches',
  'Not sure — recommend for me',
];

type FileMapping = {
  inputId: string;
  sourceName: string | null;
  sourceType: 'uploaded' | 'datasource';
  status: 'mapped' | 'unmapped' | 'mismatch';
};

const AUTO_FILE_MAPPINGS: FileMapping[] = [
  { inputId: 'ap_invoice_register', sourceName: 'SAP ERP: AP Module', sourceType: 'datasource', status: 'mapped' },
  { inputId: 'vendor_master', sourceName: 'Invoice Archive 2026', sourceType: 'datasource', status: 'mapped' },
  { inputId: 'gl_trial_balance', sourceName: 'Vendor Master Data', sourceType: 'datasource', status: 'mismatch' },
];

const RESULTS_DATA: ResultRow[] = [
  { invoiceNo: 'INV-2026-4871', vendor: 'Apex Industrial Supplies', amount: '$14,250.00', duplicateGroup: 'DG-001', confidence: 97 },
  { invoiceNo: 'INV-2026-4872', vendor: 'Apex Industrial Supplies', amount: '$14,250.00', duplicateGroup: 'DG-001', confidence: 97 },
  { invoiceNo: 'INV-2026-5033', vendor: 'TechCore Solutions Ltd', amount: '$8,920.50', duplicateGroup: 'DG-002', confidence: 91 },
  { invoiceNo: 'INV-2026-5034', vendor: 'Tech Core Solutions', amount: '$8,920.50', duplicateGroup: 'DG-002', confidence: 88 },
  { invoiceNo: 'INV-2026-5201', vendor: 'Global Logistics Inc.', amount: '$23,100.00', duplicateGroup: 'DG-003', confidence: 94 },
  { invoiceNo: 'INV-2026-5202', vendor: 'Global Logistics Inc', amount: '$23,100.00', duplicateGroup: 'DG-003', confidence: 94 },
  { invoiceNo: 'INV-2026-5510', vendor: 'Meridian Office Supplies', amount: '$3,475.25', duplicateGroup: 'DG-004', confidence: 82 },
  { invoiceNo: 'INV-2026-5515', vendor: 'Meridian Office Supply Co', amount: '$3,475.25', duplicateGroup: 'DG-004', confidence: 79 },
];

// ─── Helpers ─────────────────────────────────────────────

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ConfidenceChip({ value }: { value: number }) {
  const color =
    value >= 90
      ? 'bg-risk-50 text-risk'
      : value >= 80
        ? 'bg-mitigated-50 text-mitigated-700'
        : 'bg-canvas text-ink-500';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[12px] font-bold font-mono ${color}`}>
      {value}%
    </span>
  );
}

// ─── Main Component ──────────────────────────────────────

export default function WorkflowExecutor({ workflowId, onBack, onRunComplete }: WorkflowExecutorProps) {
  const workflow = EXECUTOR_WORKFLOW;

  // When the executor is opened from the Audit Logs new-tab flow, the URL
  // carries ?state=completed — boot directly into the "complete" output view
  // with synthetic file entries so the upload section reads as 3/3 satisfied.
  const isPreCompleted = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('state') === 'completed';
  }, []);
  const [phase, setPhase] = useState<ExecutionPhase>(isPreCompleted ? 'complete' : 'idle');
  const [currentStep, setCurrentStep] = useState(isPreCompleted ? EXECUTOR_WORKFLOW.steps.length - 1 : 0);
  const [progress, setProgress] = useState(isPreCompleted ? 100 : 0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clarification question (pauses execution until answered)
  const PAUSE_AT_STEP = 1; // pause when entering step 2
  const [clarificationPending, setClarificationPending] = useState(false);
  const [clarificationChoice, setClarificationChoice] = useState<number | null>(null);
  const [clarificationOther, setClarificationOther] = useState('');
  const clarificationAnsweredRef = useRef(false);
  const stepRef = useRef(0);
  const elapsedRef = useRef(0);

  // File-mapping pause (runs right after clarification is resolved)
  const [fileMapPending, setFileMapPending] = useState(false);
  const [fileMappings, setFileMappings] = useState<FileMapping[]>([]);

  // Column-mapping pause (runs after file mapping is confirmed)
  const [columnMapPending, setColumnMapPending] = useState(false);
  const [alignments] = useState<JourneyAlignments>(() => seedAlignments(workflow));

  const [files, setFiles] = useState<JourneyFiles>(() => {
    if (!isPreCompleted) return {};
    const seeded: JourneyFiles = {};
    for (const input of EXECUTOR_WORKFLOW.inputs) {
      seeded[input.id] = [
        { name: `${input.id}.csv`, size: 1_024_000 + Math.floor(Math.random() * 4_096_000), linkedSource: false },
      ];
    }
    return seeded;
  });
  const [requiredOpen, setRequiredOpen] = useState(false);
  const [search, setSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Upload-section collapse: user-controlled only
  const [uploadOpen, setUploadOpen] = useState(true);

  // Parameters (synced with PlanPanel's Input Config tab)
  const [parameters, setParameters] = useState<ExecutorParameters>({
    threshold: '75',
    dateFrom: '2026-01-01',
    dateTo: '2026-03-31',
  });

  // Right panel
  const [rightOpen, setRightOpen] = useState(true);

  const hasRequired = useMemo(
    () =>
      workflow.inputs
        .filter((i) => i.required)
        .every((i) => (files[i.id] ?? []).length > 0),
    [workflow.inputs, files],
  );

  const totalFiles = Object.values(files).reduce((n, arr) => n + arr.length, 0);

  const allAdded = useMemo(
    () =>
      workflow.inputs.flatMap((input) =>
        (files[input.id] ?? []).map((file, index) => ({
          file,
          inputId: input.id,
          index,
          inputName: input.name,
        })),
      ),
    [workflow.inputs, files],
  );

  const linkedSourceNames = useMemo(
    () =>
      new Set(
        Object.values(files)
          .flat()
          .filter((f) => f.linkedSource)
          .map((f) => f.name),
      ),
    [files],
  );

  const filteredSources = DATA_SOURCES.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()),
  );

  // Backend-mapping simulation: assign the next incoming file to the first
  // required input that doesn't yet have a file. Fall back to the first input.
  const pickTargetInputId = useCallback(
    (current: JourneyFiles): string => {
      const reqInputs = workflow.inputs.filter((i) => i.required);
      for (const inp of reqInputs) {
        if ((current[inp.id] ?? []).length === 0) return inp.id;
      }
      return workflow.inputs[0].id;
    },
    [workflow.inputs],
  );

  const handlePick = useCallback(
    (picked: FileList | null) => {
      if (!picked || picked.length === 0) return;
      const filesArr = Array.from(picked);
      setFiles((prev) => {
        const next = { ...prev };
        for (const f of filesArr) {
          const target = pickTargetInputId(next);
          const added: UploadedFile = { name: f.name, size: f.size };
          next[target] = [...(next[target] ?? []), added];
        }
        return next;
      });
    },
    [pickTargetInputId],
  );

  const handleRemove = useCallback(
    (inputId: string, index: number) => {
      const existing = files[inputId] ?? [];
      const next = existing.filter((_, i) => i !== index);
      setFiles({ ...files, [inputId]: next });
    },
    [files],
  );

  const toggleSource = useCallback(
    (name: string) => {
      if (linkedSourceNames.has(name)) {
        const next: JourneyFiles = {};
        for (const [inputId, arr] of Object.entries(files)) {
          next[inputId] = arr.filter((f) => !(f.linkedSource && f.name === name));
        }
        setFiles(next);
        return;
      }
      setFiles((prev) => {
        const target = pickTargetInputId(prev);
        return {
          ...prev,
          [target]: [...(prev[target] ?? []), { name, size: 0, linkedSource: true }],
        };
      });
    },
    [files, linkedSourceNames, pickTargetInputId],
  );

  const advance = useCallback(() => {
    const totalDuration = EXECUTION_STEPS.reduce((a, s) => a + s.duration, 0);
    const stepIdx = stepRef.current;

    if (stepIdx >= EXECUTION_STEPS.length) {
      setPhase('complete');
      setProgress(100);
      onRunComplete?.(workflowId);
      return;
    }

    // Pause at PAUSE_AT_STEP for clarification (show step as current/spinning)
    if (stepIdx === PAUSE_AT_STEP && !clarificationAnsweredRef.current) {
      setCurrentStep(stepIdx);
      setClarificationPending(true);
      return;
    }

    setCurrentStep(stepIdx);
    elapsedRef.current += EXECUTION_STEPS[stepIdx].duration;
    setProgress(Math.round((elapsedRef.current / totalDuration) * 100));
    stepRef.current = stepIdx + 1;
    timerRef.current = setTimeout(advance, EXECUTION_STEPS[stepIdx].duration);
  }, []);

  const startExecution = useCallback(() => {
    if (!hasRequired) return;
    setPhase('running');
    setCurrentStep(0);
    setProgress(0);
    stepRef.current = 0;
    elapsedRef.current = 0;
    clarificationAnsweredRef.current = false;
    setClarificationPending(false);
    setClarificationChoice(null);
    setClarificationOther('');
    setFileMapPending(false);
    setFileMappings([]);
    setColumnMapPending(false);
    advance();
  }, [hasRequired, advance]);

  const stopExecution = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPhase('idle');
    setCurrentStep(0);
    setProgress(0);
    setClarificationPending(false);
    setFileMapPending(false);
    setColumnMapPending(false);
  }, []);

  const resolveClarification = useCallback(() => {
    clarificationAnsweredRef.current = true;
    setClarificationPending(false);
    setFileMappings(AUTO_FILE_MAPPINGS.map(m => ({ ...m })));
    setFileMapPending(true);
  }, []);

  const resolveFileMap = useCallback(() => {
    setFileMapPending(false);
    setColumnMapPending(true);
  }, []);

  const resolveColumnMap = useCallback(() => {
    setColumnMapPending(false);
    advance();
  }, [advance]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleParametersChange = useCallback((next: ExecutorParameters) => {
    setParameters(next);
  }, []);

  return (
    <div className="flex flex-col h-full bg-canvas overflow-hidden">
      <header className="h-12 shrink-0 border-b border-canvas-border bg-canvas-elevated flex items-center px-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-600 hover:text-brand-700 transition-colors cursor-pointer"
        >
          <ArrowLeft size={14} />
          Workflows
        </button>
      </header>

      <div
        className="flex-1 min-h-0 grid transition-[grid-template-columns] duration-300"
        style={{
          gridTemplateColumns: rightOpen ? '1fr 340px' : '1fr 48px',
        }}
      >
        <main className="min-h-0 overflow-y-auto bg-canvas">
          <div className="max-w-[900px] mx-auto px-6 py-6">
            {/* Workflow header */}
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="rounded-2xl border border-canvas-border bg-canvas-elevated p-6 mb-6 relative overflow-hidden"
            >
              <div className="absolute -top-20 -right-20 w-60 h-60 bg-gradient-to-br from-brand-50 to-transparent rounded-full pointer-events-none" />
              <div className="flex items-start justify-between relative">
                <div>
                  <div className="flex items-center gap-2 text-[11.5px] mb-2">
                    <span className="flex items-center gap-1.5 text-compliant-700 font-bold uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-compliant animate-pulse" />
                      Active
                    </span>
                    <span className="text-ink-400 font-mono">{workflowId.toUpperCase()}</span>
                  </div>
                  <h1 className="text-[22px] font-bold text-ink-800 mb-2 tracking-tight">
                    {workflow.name}
                  </h1>
                  <div className="flex items-center gap-2">
                    <span className="text-[11.5px] font-semibold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full">
                      {workflow.category}
                    </span>
                    <span className="text-[11.5px] font-semibold text-ink-500 bg-canvas border border-canvas-border px-2 py-0.5 rounded-full font-mono">
                      v3.2
                    </span>
                  </div>
                </div>

                <AnimatePresence>
                  {phase === 'running' && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="flex items-center gap-2 bg-mitigated-50 text-mitigated-700 px-3 py-1.5 rounded-lg"
                    >
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                        <Loader2 size={13} />
                      </motion.div>
                      <span className="text-[12px] font-semibold">Executing...</span>
                    </motion.div>
                  )}
                  {phase === 'complete' && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="flex items-center gap-2 bg-compliant-50 text-compliant-700 px-3 py-1.5 rounded-lg"
                    >
                      <CheckCircle2 size={13} />
                      <span className="text-[12px] font-semibold">Complete</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.section>

            {phase === 'idle' && (
              <>
                {/* Required Files (collapsible) */}
                <section className="rounded-xl border border-canvas-border bg-canvas-elevated mb-4">
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileIcon size={14} className="text-brand-600" />
                      <span className="text-[13px] font-semibold text-ink-800">Required Files</span>
                      <span className="text-[12px] text-ink-400">
                        {workflow.inputs.filter((i) => i.required).length} required ·{' '}
                        {workflow.inputs.length} total
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRequiredOpen((v) => !v)}
                      className="text-[12px] text-ink-500 inline-flex items-center gap-1 cursor-pointer hover:text-ink-700"
                    >
                      {requiredOpen ? 'Click to collapse' : 'Click to Expand'}
                      {requiredOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>

                  {!requiredOpen && (
                    <div className="px-4 pb-4 flex flex-wrap gap-2">
                      {workflow.inputs.map((input) => (
                        <div
                          key={input.id}
                          className="inline-flex items-center gap-2 rounded-lg border border-canvas-border bg-canvas-elevated px-3 py-1.5 text-[12.5px] font-semibold text-ink-800"
                        >
                          {input.name}
                          <span className="text-[11px] font-semibold uppercase rounded-md bg-canvas border border-canvas-border text-ink-500 px-1.5 py-0.5">
                            {input.type}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {requiredOpen && (
                    <div className="px-4 pb-4 border-t border-canvas-border pt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                      {workflow.inputs.map((input) => {
                        const uploaded = (files[input.id] ?? []).length;
                        return (
                          <div
                            key={input.id}
                            className="rounded-xl border border-canvas-border bg-canvas-elevated px-3.5 py-3"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[13px] font-semibold text-ink-800">
                                {input.name}
                              </span>
                              <span className="text-[11px] font-semibold uppercase rounded-md bg-canvas border border-canvas-border text-ink-500 px-1.5 py-0.5">
                                {input.type}
                              </span>
                              {input.required && (
                                <span className="text-[10px] font-bold uppercase tracking-wider text-risk">
                                  Required
                                </span>
                              )}
                              {uploaded > 0 && (
                                <span className="ml-auto text-[11px] rounded-full bg-compliant-50 text-compliant-700 px-2 py-0.5 font-semibold">
                                  {uploaded}
                                </span>
                              )}
                            </div>
                            <p className="text-[12px] text-ink-500 leading-relaxed">
                              {input.description}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* Upload data files */}
                <section className="rounded-xl border border-canvas-border bg-canvas-elevated mb-4">
                  <button
                    type="button"
                    onClick={() => setUploadOpen((v) => !v)}
                    className="w-full flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-canvas/50 transition-colors"
                  >
                    <div className="text-left">
                      <h2 className="text-[16px] font-bold text-ink-800 leading-tight">
                        Upload data files
                      </h2>
                      <p className="text-[12px] text-ink-500 mt-0.5">
                        {totalFiles > 0
                          ? `${totalFiles} file${totalFiles === 1 ? '' : 's'} added · ${workflow.inputs.filter((i) => (files[i.id] ?? []).length > 0).length}/${workflow.inputs.filter((i) => i.required).length} required inputs`
                          : 'Upload the files required for this workflow, then hit Execute.'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-[12px] text-ink-500">
                      {uploadOpen ? 'Click to collapse' : 'Click to expand'}
                      {uploadOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </div>
                  </button>

                  {uploadOpen && (
                  <div className="px-5 pb-5 border-t border-canvas-border pt-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-xl border border-dashed border-brand-300 bg-brand-50/40 hover:bg-brand-50 transition-colors py-10 px-4 flex flex-col items-center justify-center gap-2 cursor-pointer min-h-[220px]"
                    >
                      <div className="w-11 h-11 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center">
                        <UploadCloud size={20} />
                      </div>
                      <div className="text-[13px] font-semibold text-ink-800">
                        Drop files here or click to upload
                      </div>
                      <div className="text-[11.5px] text-ink-500 text-center">
                        CSV, PDF, images — any data files for this workflow
                      </div>
                      <div className="mt-1 text-[11px] text-ink-400">
                        Auto-mapped to required inputs
                      </div>
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      hidden
                      multiple
                      onChange={(e) => {
                        handlePick(e.target.files);
                        e.target.value = '';
                      }}
                    />

                    <div className="rounded-xl border border-canvas-border bg-canvas p-3">
                      <div className="text-center text-[10.5px] font-bold uppercase tracking-wider text-ink-400 mb-2.5">
                        Or link from existing data source
                      </div>
                      <div className="relative mb-2.5">
                        <Search
                          size={12}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
                        />
                        <input
                          type="text"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder="Search data sources…"
                          className="w-full rounded-lg border border-canvas-border bg-canvas-elevated px-8 py-1.5 text-[12px] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-600/20 focus:border-brand-600/30 transition-all"
                        />
                      </div>
                      <ul className="grid grid-cols-1 gap-1.5 max-h-[160px] overflow-y-auto pr-1">
                        {filteredSources.map((s) => {
                          const selected = linkedSourceNames.has(s.name);
                          return (
                            <li key={s.id}>
                              <button
                                type="button"
                                onClick={() => toggleSource(s.name)}
                                className={[
                                  'w-full text-left relative rounded-lg border px-2.5 py-1.5 transition-colors cursor-pointer',
                                  selected
                                    ? 'border-brand-400 bg-brand-50/50 ring-1 ring-brand-200/60'
                                    : 'border-canvas-border bg-canvas-elevated hover:bg-brand-50/40 hover:border-brand-300',
                                ].join(' ')}
                              >
                                <div className="flex items-start gap-2">
                                  <div className="w-5 h-5 rounded-md bg-brand-50 flex items-center justify-center shrink-0 mt-0.5">
                                    <Database size={10} className="text-brand-600" />
                                  </div>
                                  <div className="flex-1 min-w-0 pr-6">
                                    <div className="text-[12px] font-semibold text-ink-800 truncate">
                                      {s.name}
                                    </div>
                                    <div className="text-[11px] text-ink-400 truncate">
                                      {s.records} records · last sync {s.lastSync}
                                    </div>
                                  </div>
                                </div>
                                <span
                                  className={[
                                    'absolute top-1.5 right-1.5 w-4 h-4 rounded-md flex items-center justify-center transition-all',
                                    selected
                                      ? 'bg-brand-600 text-white'
                                      : 'bg-canvas border border-canvas-border text-transparent',
                                  ].join(' ')}
                                  aria-hidden="true"
                                >
                                  <Check size={10} strokeWidth={3} />
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>

                  {allAdded.length > 0 && (
                    <div className="mt-5">
                      <div className="flex items-center gap-2 mb-2.5">
                        <span className="text-[13px] font-semibold text-ink-800">Your Files</span>
                        <span className="text-[11.5px] text-ink-400 rounded-full bg-canvas px-2 py-0.5 border border-canvas-border">
                          {totalFiles}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {allAdded.map(({ file, inputId, index, inputName }) => (
                          <div
                            key={`${inputId}-${file.name}-${index}`}
                            className="flex items-center gap-2.5 bg-canvas rounded-lg border border-canvas-border px-3 py-2"
                          >
                            <div className="w-7 h-7 rounded-md bg-brand-50 flex items-center justify-center shrink-0">
                              <FileIcon size={13} className="text-brand-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[12.5px] font-semibold text-ink-800 truncate">
                                {file.name}
                              </div>
                              <div className="text-[11.5px] text-ink-400 truncate">
                                {file.linkedSource
                                  ? 'Linked from data source'
                                  : humanSize(file.size)}
                              </div>
                            </div>
                            <span className="text-[11px] font-semibold uppercase tracking-wide rounded-md bg-canvas-elevated border border-canvas-border text-ink-500 px-1.5 py-0.5 shrink-0 max-w-[130px] truncate">
                              {inputName}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemove(inputId, index)}
                              className="text-ink-400 hover:text-risk transition-colors cursor-pointer shrink-0"
                              aria-label={`Remove ${file.name}`}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  </div>
                  )}

                  {/* Parameters row (merged into the same card) */}
                  <div className="px-5 py-4 border-t border-canvas-border">
                    <div className="flex items-start gap-5">
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-ink-400 mb-3">
                          Parameters
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[12px] font-semibold text-ink-600 flex items-center gap-1.5 mb-1.5">
                              <Percent size={12} className="text-brand-600" />
                              Match Threshold
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={parameters.threshold}
                                onChange={(e) =>
                                  handleParametersChange({ ...parameters, threshold: e.target.value })
                                }
                                className="w-full rounded-lg border border-canvas-border bg-canvas-elevated pl-3 pr-8 py-2 text-[13px] font-mono text-ink-800 focus:outline-none focus:ring-2 focus:ring-brand-600/20 focus:border-brand-600/30 transition-all"
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-ink-400">
                                %
                              </span>
                            </div>
                          </div>
                          <div>
                            <label className="text-[12px] font-semibold text-ink-600 flex items-center gap-1.5 mb-1.5">
                              <CalendarDays size={12} className="text-brand-600" />
                              Date Range
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="date"
                                value={parameters.dateFrom}
                                onChange={(e) =>
                                  handleParametersChange({ ...parameters, dateFrom: e.target.value })
                                }
                                className="rounded-lg border border-canvas-border bg-canvas-elevated px-2.5 py-2 text-[12.5px] font-mono text-ink-800 focus:outline-none focus:ring-2 focus:ring-brand-600/20 focus:border-brand-600/30 transition-all"
                              />
                              <input
                                type="date"
                                value={parameters.dateTo}
                                onChange={(e) =>
                                  handleParametersChange({ ...parameters, dateTo: e.target.value })
                                }
                                className="rounded-lg border border-canvas-border bg-canvas-elevated px-2.5 py-2 text-[12.5px] font-mono text-ink-800 focus:outline-none focus:ring-2 focus:ring-brand-600/20 focus:border-brand-600/30 transition-all"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 self-end">
                        <button
                          type="button"
                          onClick={startExecution}
                          disabled={!hasRequired}
                          className={[
                            'inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold transition-colors',
                            hasRequired
                              ? 'bg-brand-600 hover:bg-brand-500 text-white cursor-pointer'
                              : 'bg-canvas border border-canvas-border text-ink-400 cursor-not-allowed',
                          ].join(' ')}
                        >
                          <Play size={14} />
                          Execute Workflow
                        </button>
                      </div>
                    </div>
                    {!hasRequired && (
                      <div className="mt-3 text-[11.5px] text-ink-400">
                        Add files for all required inputs to enable Execute
                      </div>
                    )}
                  </div>
                </section>
              </>
            )}

            {/* Collapsed upload summary shown during/after execution */}
            {phase !== 'idle' && (
              <section className="rounded-xl border border-canvas-border bg-canvas-elevated px-5 py-3.5 mb-4">
                <div className="flex items-center gap-3">
                  <UploadCloud size={14} className="text-brand-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-ink-800">Upload data files</div>
                    <div className="text-[12px] text-ink-500">
                      {totalFiles} file{totalFiles === 1 ? '' : 's'} added ·{' '}
                      {workflow.inputs.filter((i) => (files[i.id] ?? []).length > 0).length}/
                      {workflow.inputs.filter((i) => i.required).length} required inputs
                    </div>
                  </div>
                  <CheckCircle2 size={14} className="text-compliant shrink-0" />
                </div>
              </section>
            )}

            <AnimatePresence>
              {phase === 'running' && (
                <motion.section
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="rounded-2xl border border-brand-200 p-6 bg-brand-50/30 mb-4"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[13px] font-bold text-ink-800 flex items-center gap-2">
                      {(clarificationPending || fileMapPending || columnMapPending) ? (
                        <AlertCircle size={15} className="text-mitigated-700" />
                      ) : (
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}>
                          <Loader2 size={15} className="text-brand-600" />
                        </motion.div>
                      )}
                      {(clarificationPending || fileMapPending || columnMapPending) ? 'Paused — waiting for input' : 'Running Workflow'}
                    </h3>
                    <div className="flex items-center gap-3">
                      <span className="text-[12px] font-mono font-bold text-brand-700">{progress}%</span>
                      <button
                        onClick={stopExecution}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-risk-50 hover:bg-risk-50/80 text-risk text-[11.5px] font-semibold transition-colors cursor-pointer"
                      >
                        <Square size={12} />
                        Stop
                      </button>
                    </div>
                  </div>

                  <div className="w-full h-2 rounded-full bg-brand-100 mb-4 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-400"
                      initial={{ width: '0%' }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.4, ease: 'easeOut' }}
                    />
                  </div>

                  {/* Dummy insufficient-data warning — calls out the affected required input */}
                  <div className="flex items-start gap-2.5 rounded-lg border border-mitigated-200 bg-mitigated-50 px-3 py-2.5 mb-4">
                    <AlertCircle size={14} className="text-mitigated-700 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[12px] font-semibold text-mitigated-700">
                          Insufficient data detected
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold rounded-md bg-canvas-elevated border border-mitigated-200 text-mitigated-700 px-1.5 py-0.5">
                          <FileIcon size={10} />
                          GL Trial Balance
                          <span className="text-[9.5px] font-bold uppercase tracking-wider text-risk">
                            Required
                          </span>
                        </span>
                      </div>
                      <div className="text-[11.5px] text-ink-600 mt-1 leading-relaxed">
                        The file mapped to this required input has only <span className="font-mono font-semibold">2,340</span> rows
                        (expected ~<span className="font-mono font-semibold">5,000</span> for this period).
                        Execution will continue but results may be incomplete.
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {EXECUTION_STEPS.map((step, i) => {
                      const isDone = i < currentStep;
                      const isCurrent = i === currentStep;
                      return (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className={`flex items-center gap-3 py-2 px-3 rounded-lg transition-colors ${
                            isCurrent ? 'bg-canvas-elevated/70' : ''
                          }`}
                        >
                          <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0">
                            {isDone ? (
                              <CheckCircle2 size={16} className="text-compliant" />
                            ) : isCurrent ? (
                              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                                <Loader2 size={16} className="text-brand-600" />
                              </motion.div>
                            ) : (
                              <div className="w-4 h-4 rounded-full border-2 border-canvas-border" />
                            )}
                          </div>
                          <span
                            className={`text-[12px] ${
                              isDone
                                ? 'text-ink-400 line-through'
                                : isCurrent
                                  ? 'text-ink-800 font-semibold'
                                  : 'text-ink-400'
                            }`}
                          >
                            Step {i + 1}/{EXECUTION_STEPS.length}: {step.label}
                          </span>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.section>
              )}
            </AnimatePresence>

            {/* Clarification question (pauses execution) */}
            <AnimatePresence>
              {phase === 'running' && clarificationPending && (
                <motion.section
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                  className="rounded-2xl border border-canvas-border bg-canvas-elevated p-5 mb-6"
                >
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <h3 className="text-[14px] font-bold text-ink-800 leading-snug">
                      {CLARIFICATION_QUESTION}
                    </h3>
                    <div className="flex items-center gap-1.5 shrink-0 text-ink-400">
                      <span className="text-[12px]">1 of 1</span>
                      <button
                        type="button"
                        onClick={resolveClarification}
                        aria-label="Dismiss clarification"
                        className="w-7 h-7 rounded-md hover:bg-canvas hover:text-ink-600 flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    {CLARIFICATION_OPTIONS.map((opt, i) => {
                      const selected = clarificationChoice === i;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setClarificationChoice(i)}
                          className={[
                            'w-full flex items-center gap-3 px-3 py-3 rounded-xl border text-left transition-colors cursor-pointer',
                            selected
                              ? 'border-brand-400 bg-brand-50 ring-2 ring-brand-200/60'
                              : 'border-canvas-border bg-canvas hover:border-brand-300 hover:bg-brand-50/30',
                          ].join(' ')}
                        >
                          <span
                            className={[
                              'w-7 h-7 rounded-lg flex items-center justify-center text-[12px] font-bold shrink-0 transition-colors',
                              selected
                                ? 'bg-brand-600 text-white'
                                : 'bg-canvas-elevated border border-canvas-border text-ink-400',
                            ].join(' ')}
                          >
                            {selected ? <Check size={14} strokeWidth={3} /> : i + 1}
                          </span>
                          <span
                            className={`flex-1 text-[13px] ${
                              selected ? 'text-brand-700 font-semibold' : 'text-ink-700'
                            }`}
                          >
                            {opt}
                          </span>
                          {selected && <ArrowRight size={14} className="text-brand-600 shrink-0" />}
                        </button>
                      );
                    })}

                    <div
                      className={[
                        'flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors',
                        clarificationOther.trim()
                          ? 'border-brand-300 bg-brand-50/30'
                          : 'border-canvas-border bg-canvas',
                      ].join(' ')}
                    >
                      <span className="w-7 h-7 rounded-lg bg-canvas-elevated border border-canvas-border flex items-center justify-center shrink-0 text-ink-400">
                        <Pencil size={13} />
                      </span>
                      <input
                        type="text"
                        value={clarificationOther}
                        onChange={(e) => setClarificationOther(e.target.value)}
                        placeholder="Something else"
                        className="flex-1 bg-transparent text-[13px] text-ink-800 placeholder:text-ink-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={resolveClarification}
                      disabled={clarificationChoice === null && !clarificationOther.trim()}
                      className={[
                        'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold transition-colors',
                        clarificationChoice !== null || clarificationOther.trim()
                          ? 'bg-brand-600 hover:bg-brand-500 text-white cursor-pointer'
                          : 'bg-canvas border border-canvas-border text-ink-400 cursor-not-allowed',
                      ].join(' ')}
                    >
                      Submit answer
                      <ArrowRight size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={resolveClarification}
                      className="text-[12.5px] font-semibold text-ink-500 hover:text-brand-700 transition-colors cursor-pointer"
                    >
                      Skip
                    </button>
                  </div>
                </motion.section>
              )}
            </AnimatePresence>

            {/* Step 1: File mapping (pauses execution after clarification) */}
            <AnimatePresence>
              {phase === 'running' && fileMapPending && (
                <motion.section
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                  className="rounded-2xl border border-canvas-border bg-canvas-elevated p-5 mb-6"
                >
                  <div className="flex items-start justify-between gap-4 mb-1">
                    <div>
                      <h3 className="text-[14px] font-bold text-ink-800 leading-snug">
                        Confirm file mapping
                      </h3>
                      <p className="text-[11.5px] text-ink-500 mt-0.5">
                        Review auto-detected file mappings. Re-assign any files that don&apos;t match before proceeding to column mapping.
                      </p>
                    </div>
                    <span className="text-[12px] text-ink-400 shrink-0">Step 1 of 2</span>
                  </div>

                  <div className="flex flex-col gap-2.5 mt-4">
                    {workflow.inputs.map((input) => {
                      const mapping = fileMappings.find(m => m.inputId === input.id);
                      const isMapped = mapping?.status === 'mapped';
                      const isMismatch = mapping?.status === 'mismatch';
                      const isUnmapped = !mapping || mapping.status === 'unmapped';
                      return (
                        <div
                          key={input.id}
                          className={[
                            'rounded-xl border p-4 transition-colors',
                            isMapped
                              ? 'border-compliant/30 bg-compliant-50/20'
                              : isMismatch
                                ? 'border-mitigated-200 bg-mitigated-50/30'
                                : 'border-risk/30 bg-risk-50/20',
                          ].join(' ')}
                        >
                          <div className="flex items-center justify-between gap-3 mb-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={[
                                'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
                                isMapped ? 'bg-compliant-50 text-compliant' : isMismatch ? 'bg-mitigated-50 text-mitigated-700' : 'bg-risk-50 text-risk',
                              ].join(' ')}>
                                {isMapped ? <CheckCircle2 size={14} /> : isMismatch ? <AlertTriangle size={14} /> : <AlertCircle size={14} />}
                              </div>
                              <div className="min-w-0">
                                <div className="text-[13px] font-semibold text-ink-800">{input.name}</div>
                                <div className="text-[11px] text-ink-400">
                                  {input.columns?.length ?? 0} columns · {input.type.toUpperCase()} · {input.required ? 'Required' : 'Optional'}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {isMapped && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-compliant-50 text-compliant-700 text-[10.5px] font-semibold border border-compliant/25">
                                  <Check size={10} strokeWidth={3} /> Mapped
                                </span>
                              )}
                              {isMismatch && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-mitigated-50 text-mitigated-700 text-[10.5px] font-semibold border border-mitigated-200">
                                  <AlertTriangle size={10} /> Needs review
                                </span>
                              )}
                              {isUnmapped && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-risk-50 text-risk text-[10.5px] font-semibold border border-risk/25">
                                  <AlertCircle size={10} /> Unmapped
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5 mt-2.5">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 rounded-lg border border-canvas-border bg-canvas-elevated px-3 py-2">
                                <Link2 size={12} className="text-ink-400 shrink-0" />
                                <ArrowLeft size={11} className="text-ink-300 shrink-0" />
                                {mapping?.sourceName ? (
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <Database size={12} className="text-brand-600 shrink-0" />
                                    <span className="text-[12.5px] font-medium text-ink-700 truncate">{mapping.sourceName}</span>
                                    {mapping.sourceType === 'datasource' && (
                                      <span className="text-[10px] font-semibold uppercase rounded bg-brand-50 text-brand-600 px-1.5 py-0.5 shrink-0">Source</span>
                                    )}
                                    {mapping.sourceType === 'uploaded' && (
                                      <span className="text-[10px] font-semibold uppercase rounded bg-canvas text-ink-500 px-1.5 py-0.5 shrink-0 border border-canvas-border">File</span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-[12px] text-ink-400 italic">No source mapped</span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {isMismatch && (
                                <FileMapDropdown
                                  inputId={input.id}
                                  onSelect={(sourceName, sourceType) => {
                                    setFileMappings(prev =>
                                      prev.map(m =>
                                        m.inputId === input.id
                                          ? { ...m, sourceName, sourceType, status: 'mapped' }
                                          : m
                                      )
                                    );
                                  }}
                                />
                              )}
                              {isUnmapped && (
                                <FileMapDropdown
                                  inputId={input.id}
                                  onSelect={(sourceName, sourceType) => {
                                    setFileMappings(prev => [
                                      ...prev.filter(m => m.inputId !== input.id),
                                      { inputId: input.id, sourceName, sourceType, status: 'mapped' },
                                    ]);
                                  }}
                                />
                              )}
                            </div>
                          </div>

                          {isMismatch && (
                            <div className="flex items-start gap-2 mt-2.5 px-1">
                              <AlertTriangle size={11} className="text-mitigated-700 shrink-0 mt-0.5" />
                              <span className="text-[11px] text-mitigated-700 leading-relaxed">
                                Schema mismatch — the mapped source may not contain the expected columns. Choose a different file or data source.
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between mt-5">
                    <button
                      type="button"
                      onClick={resolveFileMap}
                      disabled={fileMappings.some(m => m.status === 'unmapped') || fileMappings.length < workflow.inputs.filter(i => i.required).length}
                      className={[
                        'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold transition-colors',
                        fileMappings.every(m => m.status !== 'unmapped') && fileMappings.length >= workflow.inputs.filter(i => i.required).length
                          ? 'bg-brand-600 hover:bg-brand-500 text-white cursor-pointer'
                          : 'bg-canvas border border-canvas-border text-ink-400 cursor-not-allowed',
                      ].join(' ')}
                    >
                      Confirm file mapping & continue
                      <ArrowRight size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={resolveFileMap}
                      className="text-[12.5px] font-semibold text-ink-500 hover:text-brand-700 transition-colors cursor-pointer"
                    >
                      Skip
                    </button>
                  </div>
                </motion.section>
              )}
            </AnimatePresence>

            {/* Step 2: Column alignment (after file mapping is confirmed) */}
            <AnimatePresence>
              {phase === 'running' && columnMapPending && (
                <motion.section
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                  className="rounded-2xl border border-canvas-border bg-canvas-elevated p-5 mb-6"
                >
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <h3 className="text-[14px] font-bold text-ink-800 leading-snug">
                        Confirm column mapping
                      </h3>
                      <p className="text-[11.5px] text-ink-500 mt-0.5">
                        Review auto-mapped columns and resolve any that need attention before execution continues.
                      </p>
                    </div>
                    <span className="text-[12px] text-ink-400 shrink-0">Step 2 of 2</span>
                  </div>

                  <ColumnAlignmentView
                    workflow={workflow}
                    alignments={alignments}
                    fileMappings={fileMappings}
                  />

                  <div className="flex items-center justify-between mt-5">
                    <button
                      type="button"
                      onClick={resolveColumnMap}
                      className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold bg-brand-600 hover:bg-brand-500 text-white transition-colors cursor-pointer"
                    >
                      Confirm mapping & continue
                      <ArrowRight size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={resolveColumnMap}
                      className="text-[12.5px] font-semibold text-ink-500 hover:text-brand-700 transition-colors cursor-pointer"
                    >
                      Skip
                    </button>
                  </div>
                </motion.section>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {phase === 'complete' && (
                <motion.section
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="mb-6"
                >
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    {[
                      { label: 'Records Processed', value: '4,521', icon: Users, note: 'Invoice register + vendor master' },
                      { label: 'Flags Raised', value: '8', icon: AlertTriangle, note: '4 duplicate groups detected' },
                      { label: 'Execution Duration', value: '3.0s', icon: Clock, note: '12% faster than avg' },
                    ].map((card) => (
                      <div
                        key={card.label}
                        className="bg-canvas-elevated border border-canvas-border rounded-xl p-4 hover:border-brand-200 transition-colors"
                      >
                        <div className="w-7 h-7 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center mb-2.5">
                          <card.icon size={14} />
                        </div>
                        <div className="text-[11px] text-ink-400 uppercase tracking-wider mb-1">{card.label}</div>
                        <div className="text-[22px] font-bold font-mono text-ink-800 leading-none mb-1">{card.value}</div>
                        <div className="text-[11.5px] text-ink-500">{card.note}</div>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-2xl border border-canvas-border bg-canvas-elevated overflow-hidden mb-4">
                    <div className="flex items-center justify-between px-5 py-3.5 border-b border-canvas-border">
                      <h3 className="text-[13px] font-bold text-ink-800 flex items-center gap-2">
                        <TrendingUp size={14} className="text-brand-600" />
                        Duplicate Invoice Matches
                      </h3>
                      <span className="text-[12px] text-ink-400 font-mono">{RESULTS_DATA.length} records</span>
                    </div>
                    <div className="overflow-x-auto">
                      <div className="grid grid-cols-[140px_1fr_120px_110px_90px] gap-3 px-5 py-2.5 bg-canvas border-b border-canvas-border min-w-[640px]">
                        {['Invoice #', 'Vendor', 'Amount', 'Dup. Group', 'Confidence'].map((h) => (
                          <span key={h} className="text-[11px] font-bold text-ink-400 uppercase tracking-wider">
                            {h}
                          </span>
                        ))}
                      </div>
                      {RESULTS_DATA.map((row, i) => (
                        <motion.div
                          key={row.invoiceNo}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.2 + i * 0.03 }}
                          className="grid grid-cols-[140px_1fr_120px_110px_90px] gap-3 px-5 py-3 border-b border-canvas-border last:border-0 hover:bg-brand-50/30 transition-colors items-center min-w-[640px]"
                        >
                          <span className="text-[12px] font-mono text-brand-700 font-medium">{row.invoiceNo}</span>
                          <span className="text-[12px] text-ink-800 truncate">{row.vendor}</span>
                          <span className="text-[12px] font-mono text-ink-800 font-medium">{row.amount}</span>
                          <span className="text-[12px] font-mono text-ink-500 bg-canvas px-2 py-0.5 rounded w-fit">{row.duplicateGroup}</span>
                          <ConfidenceChip value={row.confidence} />
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <button className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-[12.5px] font-semibold transition-colors cursor-pointer">
                      <Download size={13} />
                      Download CSV
                    </button>
                    <button className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-canvas-border rounded-lg text-[12.5px] font-semibold text-ink-600 hover:bg-canvas hover:border-brand-300 transition-colors cursor-pointer">
                      <LayoutDashboard size={13} />
                      Add to Dashboard
                    </button>
                    <button className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-canvas-border rounded-lg text-[12.5px] font-semibold text-ink-600 hover:bg-canvas hover:border-brand-300 transition-colors cursor-pointer">
                      <AlertTriangle size={13} />
                      Create Exceptions
                    </button>
                    <button
                      onClick={() => setPhase('idle')}
                      className="ml-auto inline-flex items-center gap-1.5 px-3.5 py-2 border border-canvas-border rounded-lg text-[12.5px] font-semibold text-ink-600 hover:bg-canvas hover:border-brand-300 transition-colors cursor-pointer"
                    >
                      Run again
                    </button>
                  </div>
                </motion.section>
              )}
            </AnimatePresence>

          </div>
        </main>

        <PlanPanel
          workflow={workflow}
          step={2}
          open={rightOpen}
          onToggleOpen={() => setRightOpen((v) => !v)}
          visibleTabs={['plan']}
        />
      </div>
    </div>
  );
}

function ColumnAlignmentRow({ col }: { col: ColumnAlignment }) {
  return (
    <div className="grid grid-cols-[1fr_1fr] gap-4 items-center py-2.5 border-b border-canvas-border/30 last:border-b-0">
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-0.5 h-6 rounded-full bg-brand-400 shrink-0" />
        <span className="text-[12.5px] font-medium text-ink-800 truncate">{col.source.name}</span>
        <span className="text-[9.5px] font-bold uppercase tracking-wide rounded bg-canvas border border-canvas-border text-ink-500 px-1.5 py-0.5 shrink-0">
          {col.source.dtype}
        </span>
      </div>
      <div className="flex items-center gap-2 min-w-0">
        <ArrowRight size={12} className="text-ink-300 shrink-0" />
        {col.target ? (
          <div className="flex items-center gap-1.5 rounded-lg border border-canvas-border bg-canvas px-2.5 py-1 min-w-0 flex-1">
            <span className="text-[12.5px] font-medium text-brand-700 truncate">{col.target.name}</span>
            <span className="text-[9.5px] font-bold uppercase tracking-wide rounded bg-brand-50 border border-brand-100 text-brand-600 px-1.5 py-0.5 shrink-0">
              {col.target.dtype}
            </span>
            <ChevronDown size={11} className="text-ink-400 shrink-0 ml-auto" />
          </div>
        ) : (
          <div className="flex items-center gap-1.5 rounded-lg border border-dashed border-risk/40 bg-risk-50/30 px-2.5 py-1 min-w-0 flex-1">
            <span className="text-[12px] text-risk italic">Unmapped</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ColumnAlignmentView({
  workflow,
  alignments,
  fileMappings,
}: {
  workflow: WorkflowDraft;
  alignments: JourneyAlignments;
  fileMappings: FileMapping[];
}) {
  const [expanded, setExpanded] = useState<string | null>(workflow.inputs[0]?.id ?? null);
  const [autoExpanded, setAutoExpanded] = useState<Record<string, boolean>>({});

  return (
    <div className="flex flex-col gap-3">
      {workflow.inputs.map((input) => {
        const cols: ColumnAlignment[] = alignments[input.id] ?? [];
        const needsAttention = (c: ColumnAlignment) => c.reason !== null || c.target === null || c.confidence < 75;
        const goodCols = cols.filter(c => !needsAttention(c));
        const attentionCols = cols.filter(c => needsAttention(c));
        const mappedCount = cols.filter(c => c.target !== null).length;
        const totalCount = cols.length;
        const isOpen = expanded === input.id;
        const mapping = fileMappings.find(m => m.inputId === input.id);
        const sourceName = mapping?.sourceName ?? 'No source';
        const isAutoExpanded = autoExpanded[input.id] ?? false;

        return (
          <div
            key={input.id}
            className="rounded-2xl border border-canvas-border bg-canvas-elevated overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : input.id)}
              className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-canvas/40 transition-colors cursor-pointer"
            >
              <span className="text-[14px] font-bold text-ink-900">{input.name}</span>
              <div className="flex items-center gap-3">
                <span className="text-[22px] font-bold text-ink-800 tabular-nums">{mappedCount}/{totalCount}</span>
                <span className="text-[11px] text-ink-400 text-left leading-tight">column<br />mapped</span>
                {isOpen ? <ChevronUp size={16} className="text-ink-400" /> : <ChevronDown size={16} className="text-ink-400" />}
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-canvas-border">
                {/* Mapped sources */}
                <div className="px-5 py-4 border-b border-canvas-border/60">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-400">
                      Mapped Sources
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-compliant-50 text-compliant-700 text-[11px] font-bold border border-compliant/20">
                      Linked
                      <CheckCircle2 size={11} />
                    </span>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-lg border border-canvas-border bg-canvas px-3 py-1.5">
                    <FileIcon size={12} className="text-ink-400" />
                    <span className="text-[12.5px] text-ink-700 font-medium">{sourceName}</span>
                    <button type="button" className="text-ink-400 hover:text-ink-600 transition-colors cursor-pointer">
                      <X size={12} />
                    </button>
                  </div>
                </div>

                {/* Column Alignment */}
                <div className="px-5 pt-4 pb-2">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-400">
                      Column Alignment
                    </span>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-brand-700 hover:text-brand-800 transition-colors cursor-pointer"
                    >
                      <Wand2 size={11} />
                      Map by description
                    </button>
                  </div>

                  <div className="grid grid-cols-[1fr_1fr] gap-4 pb-2 border-b border-canvas-border/60">
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-400">Source Column</span>
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-400">Target Schema</span>
                  </div>
                </div>

                {/* Auto-mapped — collapsed by default */}
                {goodCols.length > 0 && (
                  <div className="px-5 pb-3">
                    <button
                      type="button"
                      onClick={() => setAutoExpanded(prev => ({ ...prev, [input.id]: !prev[input.id] }))}
                      className="w-full flex items-center justify-between py-2.5 cursor-pointer group"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-compliant" />
                        <span className="text-[12px] font-semibold text-compliant-700">
                          {goodCols.length} fields auto-mapped
                        </span>
                      </div>
                      <span className="text-[11.5px] font-semibold text-ink-500 group-hover:text-brand-700 transition-colors">
                        {isAutoExpanded ? 'Collapse ↑' : 'Expand ↓'}
                      </span>
                    </button>

                    {isAutoExpanded && (
                      <div className="flex flex-col">
                        {goodCols.map((col) => (
                          <ColumnAlignmentRow key={col.id} col={col} />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Needs attention — always visible, yellow background */}
                {attentionCols.length > 0 && (
                  <div className="mx-5 mb-4 rounded-xl border border-amber-300/60 bg-amber-50/60 overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-amber-200/60">
                      <AlertTriangle size={13} className="text-amber-600" />
                      <span className="text-[11.5px] font-semibold text-amber-700">
                        {attentionCols.length} {attentionCols.length === 1 ? 'field needs' : 'fields need'} attention
                      </span>
                      <span className="text-[11px] text-amber-600/70">
                        — low confidence, type mismatch, or unmapped
                      </span>
                    </div>
                    <div className="px-4 py-1">
                      {attentionCols.map((col) => (
                        <ColumnAlignmentRow key={col.id} col={col} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FileMapDropdown({
  inputId,
  onSelect,
}: {
  inputId: string;
  onSelect: (sourceName: string, sourceType: 'uploaded' | 'datasource') => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filtered = DATA_SOURCES.filter(
    s => s.status === 'connected' && s.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-brand-300 bg-brand-50 hover:bg-brand-100 text-brand-700 text-[11.5px] font-semibold px-2.5 py-1.5 transition-colors cursor-pointer"
      >
        <RefreshCw size={11} />
        Re-map
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-1.5 w-[280px] rounded-xl border border-canvas-border bg-canvas-elevated shadow-xl z-50 overflow-hidden"
          >
            <div className="px-3 pt-3 pb-2">
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search data sources…"
                  autoFocus
                  className="w-full rounded-lg border border-canvas-border bg-canvas pl-7 pr-3 py-1.5 text-[12px] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-600/20 focus:border-brand-600/30 transition-all"
                />
              </div>
            </div>

            <div className="max-h-[180px] overflow-y-auto px-1.5 pb-1.5">
              {filtered.length === 0 ? (
                <div className="text-[11.5px] text-ink-400 text-center py-4">No matching sources</div>
              ) : (
                filtered.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      onSelect(s.name, 'datasource');
                      setOpen(false);
                    }}
                    className="w-full text-left flex items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-brand-50 transition-colors cursor-pointer"
                  >
                    <Database size={12} className="text-brand-600 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-semibold text-ink-800 truncate">{s.name}</div>
                      <div className="text-[10.5px] text-ink-400">{s.records} records · {s.type.toUpperCase()}</div>
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="border-t border-canvas-border px-3 py-2">
              <button
                type="button"
                onClick={() => {
                  onSelect(`${inputId}_upload.csv`, 'uploaded');
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] font-semibold text-ink-600 hover:bg-canvas hover:text-brand-700 transition-colors cursor-pointer"
              >
                <UploadCloud size={12} />
                Upload a new file
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
