import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import {
  Search,
  FolderClosed,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Plus,
  FileSpreadsheet,
  FileText,
  Database,
  CheckCircle2,
  File as FileIcon,
  X,
  FileOutput,
  Lock,
  Zap,
  Download,
  Loader2,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  GripVertical,
  Eye,
  EyeOff,
  Sparkles,
  Workflow as WorkflowIcon,
  Code2,
  Copy,
  ListChecks,
  MessageSquare,
  ExternalLink,
} from 'lucide-react';
import { DATA_SOURCES } from '../../data/mockData';
import type { JourneyFiles, RunResult, StepSpec, WorkflowDraft } from './types';

interface Props {
  workflow: WorkflowDraft;
  files: JourneyFiles;
  setFiles: (f: JourneyFiles) => void;
  result?: RunResult | null;
  running?: boolean;
  /** Current journey step — drives auto tab selection on transitions. */
  step?: number;
  /**
   * Whether the user has explicitly opened the preview from chat. When false,
   * a fresh result lands the user in Configure → Output (review schema first);
   * when true the panel auto-jumps to the Preview tab.
   */
  previewRevealed?: boolean;
}

interface Folder {
  id: string;
  name: string;
  fileCount: number;
  files: { name: string; type: string; rows?: number }[];
}

const DEMO_FOLDERS: Folder[] = [
  { id: 'f-1', name: 'Test folder', fileCount: 0, files: [] },
  {
    id: 'f-2',
    name: 'invoice',
    fileCount: 1,
    files: [{ name: 'invoice_mar_2026.pdf', type: 'pdf' }],
  },
];

const INPUT_FILE_FOLDERS: Folder[] = [
  {
    id: 'inp-f-1',
    name: 'Vendor Contracts',
    fileCount: 4,
    files: [
      { name: 'acme_master_contract_2025.pdf', type: 'pdf' },
      { name: 'global_supplies_msa.pdf', type: 'pdf' },
      { name: 'techvendor_sow_2026.pdf', type: 'pdf' },
      { name: 'pinnacle_addendum.pdf', type: 'pdf' },
    ],
  },
  {
    id: 'inp-f-2',
    name: 'Signed Statements',
    fileCount: 2,
    files: [
      { name: 'signed_statement_q4_2025.pdf', type: 'pdf' },
      { name: 'signed_statement_q1_2026.pdf', type: 'pdf' },
    ],
  },
  {
    id: 'inp-f-3',
    name: 'Policy Documents',
    fileCount: 3,
    files: [
      { name: 'spend_policy_v3.pdf', type: 'pdf' },
      { name: 'gl_account_mapping.pdf', type: 'pdf' },
      { name: 'approval_matrix.pdf', type: 'pdf' },
    ],
  },
];

function typeIcon(type: string) {
  if (type === 'csv' || type === 'excel') return FileSpreadsheet;
  if (type === 'pdf') return FileText;
  if (type === 'sql') return Database;
  return FileIcon;
}

function typeColor(type: string): string {
  if (type === 'csv') return 'text-compliant-700 bg-compliant-50';
  if (type === 'excel') return 'text-compliant-700 bg-compliant-50';
  if (type === 'pdf') return 'text-high-700 bg-high-50';
  if (type === 'sql') return 'text-evidence-700 bg-evidence-50';
  return 'text-ink-500 bg-canvas';
}

const COLUMN_DESCRIPTIONS: Record<string, string> = {
  'Invoice No': 'Unique invoice identifier',
  'Invoice Date': 'Date the invoice was issued',
  Vendor: 'Vendor name or short code',
  'Vendor ID': 'Unique vendor identifier from master',
  'PO Ref': 'Reference to the linked purchase order',
  'PO No': 'Purchase order number',
  'Contract Ref': 'Reference to the master contract',
  Amount: 'Monetary value on the line',
  'Line Item': 'Item-level description on the document',
  Status: 'Current state of the record',
  Scope: 'Coverage defined by the contract',
  Cap: 'Maximum allowed amount under the contract',
  'End Date': 'Contract or period end date',
  Account: 'GL account code',
  'GL Account': 'General ledger account code',
  Description: 'Human-readable description',
  Debit: 'Debit amount posted',
  Credit: 'Credit amount posted',
  Balance: 'Account balance at time of posting',
  'Posting Date': 'Date the entry was posted to the ledger',
  'Doc No': 'Source document number',
  Reference: 'External reference number',
  Date: 'Transaction date',
  'Running Balance': 'Cumulative balance after this entry',
  'Entered By': 'User who entered the record',
  Name: 'Vendor display name',
  'Bank Account': 'Bank account on file',
  'Created On': 'Record creation timestamp',
  Category: 'Vendor or spend category',
  Threshold: 'Approval or tolerance threshold',
  Approver: 'Designated approver',
};

function describeColumn(name: string): string {
  return COLUMN_DESCRIPTIONS[name] ?? 'Source field';
}

type PanelTab = 'input' | 'plan' | 'preview';

const STEP_BADGE: Record<
  StepSpec['type'],
  { label: string; bg: string; text: string }
> = {
  extract: { label: 'INGESTION', bg: 'bg-brand-50', text: 'text-brand-700' },
  analyze: { label: 'ANALYSIS', bg: 'bg-brand-600', text: 'text-white' },
  compare: { label: 'COMPARISON', bg: 'bg-compliant-50', text: 'text-compliant-700' },
  flag: { label: 'FLAGGING', bg: 'bg-mitigated-50', text: 'text-mitigated-700' },
  validate: { label: 'VALIDATION', bg: 'bg-evidence-50', text: 'text-evidence-700' },
  summarize: { label: 'SUMMARY', bg: 'bg-compliant-50', text: 'text-compliant-700' },
  calculate: { label: 'CALCULATION', bg: 'bg-mitigated-50', text: 'text-mitigated-700' },
};

function inputMeta(input: { type: string; multiple?: boolean }): string {
  if (input.type === 'csv') return '12,450 rows · CSV';
  if (input.type === 'pdf') return input.multiple ? '234 PDFs · linked' : '1 PDF · linked';
  if (input.type === 'sql') return '892 records · frozen';
  return input.type.toUpperCase();
}

const SAMPLE_CODE_LINES: string[] = [
  "import pandas as pd",
  "import ira",
  "",
  "df = pd.read_csv('/app/temp/9a426768.csv')",
  "df['INVOICE_DATE'] = ira.convert_date_column(",
  "    df['INVOICE_DATE']",
  ")",
  "df = ira.clean_strings_batch(df, [",
  "    'VENDOR_CODE', 'INVOICE_NO'",
  "])",
  "df = ira.clean_numeric_batch(df, ['INVOICE_VALUE'])",
  "",
  "valid_mask = (",
  "    df['VENDOR_CODE'].notna()",
  "    & df['INVOICE_DATE'].notna()",
  "    & df['INVOICE_VALUE'].notna()",
  ")",
  "df_valid = df.loc[valid_mask]",
  "",
  "group_cols = [",
  "    'VENDOR_CODE', 'INVOICE_DATE', 'INVOICE_VALUE'",
  "]",
  "dup_counts = (",
  "    df_valid.groupby(group_cols)",
  "    .size()",
  "    .reset_index(name='dup_count')",
  ")",
  "duplicates = dup_counts.loc[dup_counts['dup_count'] > 1]",
  "ira.write_output('duplicate_invoices', duplicates)",
];

interface OutputColumn {
  id: string;
  name: string;
  type: 'TXT' | 'NUM' | '%' | 'BADGE' | 'DATE';
  required?: boolean;
  visible: boolean;
  /** Source columns this output is derived from. Resolved against the workflow's inputs. */
  sources?: string[];
  /** Optional formula or rule explaining the derivation (e.g. "COUNT", "AI rule"). */
  formula?: string;
}

const DEFAULT_OUTPUT_COLUMNS: OutputColumn[] = [
  {
    id: 'invoice-number',
    name: 'Invoice Number',
    type: 'TXT',
    visible: true,
    sources: ['Invoice No', 'Invoice Number'],
  },
  {
    id: 'vendor',
    name: 'Vendor',
    type: 'TXT',
    visible: true,
    sources: ['Vendor', 'Vendor Name'],
  },
  {
    id: 'amount',
    name: 'Amount',
    type: 'NUM',
    visible: true,
    sources: ['Amount', 'Total', 'Invoice Amount'],
  },
  {
    id: 'original-invoice',
    name: 'Original Invoice',
    type: 'TXT',
    visible: true,
    sources: ['Invoice No', 'Invoice Number'],
    formula: 'Match prior invoice with same vendor + amount',
  },
  {
    id: 'match-score',
    name: 'Match Score',
    type: '%',
    required: true,
    visible: true,
    sources: ['Vendor', 'Amount', 'Invoice Date', 'Invoice No', 'Invoice Number'],
    formula: 'Field-similarity score across key columns',
  },
  {
    id: 'status',
    name: 'Status',
    type: 'BADGE',
    required: true,
    visible: true,
    formula: 'Set when Match Score ≥ tolerance threshold',
  },
  {
    id: 'recommended-action',
    name: 'Recommended Action',
    type: 'TXT',
    visible: false,
    formula: 'AI-derived action based on flag severity',
  },
];

function resolveSources(
  sources: string[] | undefined,
  workflow: WorkflowDraft,
): { inputName: string; column: string }[] {
  if (!sources?.length) return [];
  const out: { inputName: string; column: string }[] = [];
  const seenInputs = new Set<string>();
  for (const s of sources) {
    for (const inp of workflow.inputs) {
      if (seenInputs.has(inp.id)) continue;
      const match = (inp.columns ?? []).find(
        (c) => c.toLowerCase() === s.toLowerCase(),
      );
      if (match) {
        out.push({ inputName: inp.name, column: match });
        seenInputs.add(inp.id);
        break;
      }
    }
  }
  return out;
}

const AI_OUTPUT_SUGGESTIONS: { id: string; label: string }[] = [
  { id: 'trend', label: 'Add "Trend vs Previous Run" column to track changes between executions' },
  { id: 'variance', label: 'Enable variance highlighting when amount difference exceeds tolerance' },
  { id: 'time-to-resolution', label: 'Include "Time to Resolution" metric for flagged items' },
  { id: 'auto-group', label: 'Auto-group results by vendor for easier review' },
];

function typeBadgeClasses(type: OutputColumn['type']): string {
  switch (type) {
    case 'TXT':
      return 'bg-sky-50 text-sky-700 border-sky-200/70';
    case 'NUM':
      return 'bg-violet-50 text-violet-700 border-violet-200/70';
    case '%':
      return 'bg-amber-50 text-amber-700 border-amber-200/70';
    case 'BADGE':
      return 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200/70';
    case 'DATE':
      return 'bg-teal-50 text-teal-700 border-teal-200/70';
    default:
      return 'bg-canvas text-ink-600 border-canvas-border';
  }
}

export default function DataSourcePanel({
  workflow,
  files,
  setFiles,
  result = null,
  running = false,
  step,
  previewRevealed = false,
}: Props) {
  const [tab, setTab] = useState<PanelTab>('input');
  const [search, setSearch] = useState('');
  const [openFolderIds, setOpenFolderIds] = useState<Set<string>>(new Set());
  const [expandedSourceKeys, setExpandedSourceKeys] = useState<Set<string>>(new Set());
  const [expandedInputCardIds, setExpandedInputCardIds] = useState<Set<string>>(new Set());
  const [expandedInputFolderIds, setExpandedInputFolderIds] = useState<Set<string>>(new Set());
  const [referencesOpen, setReferencesOpen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [outputColumns, setOutputColumns] = useState<OutputColumn[]>(DEFAULT_OUTPUT_COLUMNS);
  const [acceptedSuggestions, setAcceptedSuggestions] = useState<Set<string>>(
    () => new Set(['variance']),
  );

  const visibleColumnCount = outputColumns.filter((c) => c.visible).length;

  const toggleColumnVisibility = (columnId: string) => {
    setOutputColumns((prev) =>
      prev.map((c) => (c.id === columnId ? { ...c, visible: !c.visible } : c)),
    );
  };

  const toggleSuggestion = (id: string) => {
    setAcceptedSuggestions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Auto-jump to Preview tab once the user explicitly reveals the preview.
  const previewJumpedRef = useRef(false);
  useEffect(() => {
    if (previewRevealed && !previewJumpedRef.current) {
      previewJumpedRef.current = true;
      setTab('preview');
    }
    if (!previewRevealed) previewJumpedRef.current = false;
  }, [previewRevealed]);

  // When a result first lands (and the user hasn't opened the preview yet),
  // swing the panel to Output Config so they can review the output schema
  // before peeking at the preview rows.
  const resultLandedRef = useRef(false);
  useEffect(() => {
    if (result && !resultLandedRef.current) {
      resultLandedRef.current = true;
      if (!previewRevealed) {
        setTab('preview');
      }
    }
    if (!result) resultLandedRef.current = false;
  }, [result, previewRevealed]);

  // Auto-select the right-side tab based on the journey step. Each step
  // transition fires once — the user can still switch tabs manually after.
  const stepTabAppliedRef = useRef<number | null>(null);
  useEffect(() => {
    if (step == null) return;
    if (stepTabAppliedRef.current === step) return;
    stepTabAppliedRef.current = step;
    if (step === 3) {
      setTab('input');
    } else if (step === 4 && !result) {
      setTab('plan');
    }
  }, [step, result]);

  const toggleFolder = (id: string) => {
    setOpenFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSourceExpansion = (key: string) => {
    setExpandedSourceKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleInputCardExpansion = (id: string) => {
    setExpandedInputCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleInputFolderExpansion = (id: string) => {
    setExpandedInputFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const removeLinkedSource = (sourceName: string) => {
    const next: JourneyFiles = {};
    for (const [inputId, arr] of Object.entries(files)) {
      next[inputId] = arr.filter(
        (f) => !(f.linkedSource && f.name === sourceName),
      );
    }
    setFiles(next);
  };

  const formatBadgeClass = (type: string): string => {
    if (type === 'sql') return 'bg-evidence-50 text-evidence-700 border border-evidence-200/50';
    if (type === 'csv') return 'bg-compliant-50 text-compliant-700 border border-compliant/20';
    if (type === 'pdf') return 'bg-high-50 text-high-700 border border-high/20';
    return 'bg-canvas text-ink-500 border border-canvas-border';
  };

  const addedSources = useMemo(() => {
    type Added = {
      key: string;
      inputId: string;
      name: string;
      type: string;
      meta: string;
      linked: boolean;
    };
    const rows: Added[] = [];
    const seen = new Set<string>();
    for (const [inputId, arr] of Object.entries(files)) {
      for (let i = 0; i < arr.length; i++) {
        const f = arr[i];
        if (seen.has(f.name)) continue;
        seen.add(f.name);
        if (f.linkedSource) {
          const lib = DATA_SOURCES.find((d) => d.name === f.name);
          rows.push({
            key: `${inputId}-${i}-${f.name}`,
            inputId,
            name: f.name,
            type: lib?.type ?? 'sql',
            meta: lib ? `${lib.records} · ${lib.type.toUpperCase()}` : 'Linked source',
            linked: true,
          });
        } else {
          const ext = (f.name.split('.').pop() ?? '').toLowerCase();
          const type = ext === 'csv' ? 'csv' : ext === 'pdf' ? 'pdf' : ext === 'xlsx' || ext === 'xls' ? 'excel' : 'csv';
          const sizeStr =
            f.size > 1024 * 1024
              ? `${(f.size / (1024 * 1024)).toFixed(1)} MB`
              : f.size > 1024
                ? `${(f.size / 1024).toFixed(1)} KB`
                : f.size > 0
                  ? `${f.size} B`
                  : 'Uploaded';
          rows.push({
            key: `${inputId}-${i}-${f.name}`,
            inputId,
            name: f.name,
            type,
            meta: `${sizeStr}${ext ? ` · ${ext.toUpperCase()}` : ''}`,
            linked: false,
          });
        }
      }
    }
    return rows.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()));
  }, [files, search]);

  const requiredInputs = workflow.inputs.filter((i) => i.required);
  const filledRequired = requiredInputs.filter(
    (i) => (files[i.id] ?? []).length > 0,
  ).length;
  const planBadge = String(workflow.steps.length);
  const planTone: 'ok' | 'warn' | 'idle' =
    workflow.steps.length > 0 ? 'ok' : 'idle';
  const inputBadge =
    requiredInputs.length > 0 ? `${filledRequired}/${requiredInputs.length}` : '';
  const inputTone: 'ok' | 'warn' | 'idle' =
    requiredInputs.length === 0
      ? 'idle'
      : filledRequired === requiredInputs.length
        ? 'ok'
        : filledRequired > 0
          ? 'warn'
          : 'idle';
  const outputBadge = String(visibleColumnCount);
  const outputTone: 'ok' | 'warn' | 'idle' =
    visibleColumnCount > 0 ? 'ok' : 'idle';
  const previewTone: 'ok' | 'warn' | 'idle' = result ? 'ok' : 'idle';

  const TABS: {
    id: PanelTab;
    label: string;
    badge?: string;
    tone: 'ok' | 'warn' | 'idle';
    icon: typeof Database;
  }[] = [
    { id: 'input', label: 'Input Config', badge: inputBadge, tone: inputTone, icon: Database },
    { id: 'plan', label: 'Plan', badge: planBadge, tone: planTone, icon: Sparkles },
    { id: 'preview', label: 'Preview', tone: previewTone, icon: Eye },
  ];

  const totalColumnsInUse = workflow.inputs.reduce(
    (n, i) => n + (i.columns?.length ?? 0),
    0,
  );

  return (
    <aside className="flex flex-col h-full w-full bg-canvas-elevated min-h-0">
      {/* Tab strip — matches the query ArtifactPanel: icon + label + count
          chip, with an animated gradient underline on the active tab. Same
          h-12 chrome height + bottom hairline border so the two side
          panels read as variants of the same surface. */}
      <div className="@container h-12 shrink-0 px-2 sm:px-4 border-b border-canvas-border flex items-end gap-2 bg-canvas-elevated">
        <div
          role="tablist"
          aria-label="Workflow workspace"
          className="relative flex items-end gap-0.5 min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {TABS.map((t) => {
            const active = tab === t.id;
            const Icon = t.icon;
            return (
              <motion.button
                key={t.id}
                type="button"
                role="tab"
                onClick={() => setTab(t.id)}
                aria-selected={active}
                whileHover={!active ? { y: -1 } : undefined}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                title={t.label}
                className={`group relative flex items-center gap-1.5 h-9 px-2.5 @[480px]:px-3 rounded-t-lg text-[13px] shrink-0 transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                  active
                    ? 'text-brand-700 font-semibold'
                    : 'text-ink-500 font-medium hover:text-brand-700 hover:bg-brand-50'
                }`}
              >
                <motion.span
                  animate={{ scale: active ? 1.06 : 1 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 22 }}
                  className="inline-flex"
                >
                  <Icon
                    size={14}
                    strokeWidth={active ? 2.25 : 2}
                    className={active ? 'text-brand-600' : 'text-ink-400 group-hover:text-brand-600 transition-colors'}
                  />
                </motion.span>
                <span className={`leading-none tracking-tight ${active ? 'inline' : 'hidden @[360px]:inline'}`}>
                  {t.label}
                </span>
                {t.badge && (
                  <span
                    className={`hidden @[440px]:inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10.5px] font-mono tabular-nums leading-none transition-colors ${
                      active
                        ? 'bg-brand-100 text-brand-700'
                        : 'bg-paper-100 text-ink-500 group-hover:bg-brand-100 group-hover:text-brand-700'
                    }`}
                  >
                    {t.badge}
                  </span>
                )}
                {active && (
                  <motion.span
                    layoutId="workflow-tab-underline"
                    aria-hidden="true"
                    className="absolute left-2 right-2 -bottom-px h-[2px] rounded-full bg-gradient-to-r from-brand-500 via-brand-600 to-brand-500"
                    transition={{ type: 'spring', stiffness: 480, damping: 36, mass: 0.55 }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Scroll body */}
      <div className="flex-1 overflow-y-auto min-h-0 px-3 py-3">
        {tab === 'input' && (
          <div>
            {/* Folders section */}
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className="w-7 h-7 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                <FolderClosed size={14} />
              </div>
              <span className="text-[13px] font-semibold text-ink-800 flex-1 min-w-0 truncate">
                Folders
              </span>
              <span className="text-[12px] font-semibold text-brand-700 rounded-full bg-brand-50 px-2 py-0.5 shrink-0">
                {INPUT_FILE_FOLDERS.length} folder{INPUT_FILE_FOLDERS.length === 1 ? '' : 's'}
              </span>
            </div>

            {/* Folder rows — same shape as the Files section: primary row
                + footer with file-count + Open / Chat actions. */}
            <div
              className="grid gap-3 mb-4"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))' }}
            >
              {INPUT_FILE_FOLDERS.map((folder) => {
                const expanded = expandedInputFolderIds.has(folder.id);
                return (
                  <div
                    key={folder.id}
                    className="group w-full rounded-lg bg-canvas-elevated border border-canvas-border hover:border-brand-200 transition-colors"
                  >
                    {/* Primary row */}
                    <button
                      type="button"
                      onClick={() => toggleInputFolderExpansion(folder.id)}
                      aria-expanded={expanded}
                      className="w-full flex items-center gap-3 px-4 h-16 rounded-t-lg hover:bg-brand-50/30 transition-colors cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30"
                      aria-label={expanded ? `Collapse ${folder.name}` : `Expand ${folder.name}`}
                    >
                      <div className="w-9 h-9 rounded-md flex items-center justify-center shrink-0 bg-brand-50 text-brand-600">
                        {expanded ? <FolderOpen size={16} /> : <FolderClosed size={16} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-ink-900 truncate">{folder.name}</div>
                        <div className="text-[11px] text-ink-500 mt-0.5 tabular-nums truncate">
                          PDF · <span className="text-ink-400">{folder.fileCount} file{folder.fileCount === 1 ? '' : 's'}</span>
                        </div>
                      </div>
                      <span
                        className={[
                          'text-[11px] font-bold uppercase tracking-wider rounded-md px-1.5 py-0.5 shrink-0',
                          formatBadgeClass('pdf'),
                        ].join(' ')}
                      >
                        PDF
                      </span>
                    </button>

                    {/* Footer row */}
                    <div className="border-t border-canvas-border/70 px-4 py-2 flex items-center gap-2 min-w-0">
                      <span className="text-[11px] text-ink-500 shrink-0">
                        <span className="font-mono tabular-nums text-ink-700">{folder.fileCount}</span> file{folder.fileCount === 1 ? '' : 's'}:
                      </span>
                      <span className="text-[11px] font-mono text-ink-700 truncate flex-1" title={folder.files.map(f => f.name).join(', ')}>
                        {folder.files.map(f => f.name).join(', ') || '(empty)'}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleInputFolderExpansion(folder.id)}
                          aria-label={expanded ? `Hide files in ${folder.name}` : `Show files in ${folder.name}`}
                          title={expanded ? 'Hide files' : 'Show files'}
                          className="inline-flex items-center gap-1 h-7 px-2.5 text-[11.5px] font-medium text-ink-700 bg-canvas-elevated border border-canvas-border hover:text-brand-700 hover:bg-brand-50 hover:border-brand-200 rounded-md transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                        >
                          {expanded ? <ChevronDown size={11} strokeWidth={2.25} /> : <ChevronRight size={11} strokeWidth={2.25} />}
                          {expanded ? 'Hide' : 'Show'}
                        </button>
                        <button
                          type="button"
                          aria-label={`Discuss ${folder.name} in chat`}
                          title="Describe in chat"
                          className="inline-flex items-center gap-1 h-7 px-2.5 text-[11.5px] font-medium text-ink-700 bg-canvas-elevated border border-canvas-border hover:text-brand-700 hover:bg-brand-50 hover:border-brand-200 rounded-md transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                        >
                          <MessageSquare size={11} strokeWidth={2.25} />
                          Chat
                        </button>
                      </div>
                    </div>

                    {/* Expanded file list */}
                    {expanded && (
                      folder.files.length > 0 ? (
                        <ul className="flex flex-col gap-1.5 border-t border-canvas-border/70 px-4 py-3">
                          {folder.files.map((f) => {
                            const Icon = typeIcon(f.type);
                            return (
                              <li
                                key={f.name}
                                className="flex items-center gap-2 rounded-md bg-canvas border border-canvas-border px-2 py-1.5 min-w-0"
                              >
                                <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${typeColor(f.type)}`}>
                                  <Icon size={10} />
                                </div>
                                <span className="text-[12px] font-medium text-ink-800 truncate flex-1">
                                  {f.name}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <div className="border-t border-canvas-border/70 px-4 py-3">
                          <div className="rounded-md bg-canvas border border-dashed border-canvas-border px-2 py-2 text-center text-[12px] text-ink-400">
                            Empty folder
                          </div>
                        </div>
                      )
                    )}
                  </div>
                );
              })}
            </div>

            {/* Files section */}
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className="w-7 h-7 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                <Database size={14} />
              </div>
              <span className="text-[13px] font-semibold text-ink-800 flex-1 min-w-0 truncate">
                Files
              </span>
              <span className="text-[12px] font-semibold text-brand-700 rounded-full bg-brand-50 px-2 py-0.5 shrink-0">
                {workflow.inputs.length} source{workflow.inputs.length === 1 ? '' : 's'}
              </span>
            </div>

            {/* Input source rows — match the query SourcesTab card shape:
                primary row (icon + name + meta + format badge) on top, a
                footer with "Using N of M: cols…" + Pick + Chat actions. */}
            <div
              className="grid gap-3 mb-4"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))' }}
            >
              {workflow.inputs.map((input) => {
                const cols = input.columns ?? [];
                return (
                  <div
                    key={input.id}
                    className="group w-full rounded-lg bg-canvas-elevated border border-canvas-border hover:border-brand-200 transition-colors"
                  >
                    {/* Primary row */}
                    <button
                      type="button"
                      onClick={() => toggleInputCardExpansion(input.id)}
                      className="w-full flex items-center gap-3 px-4 h-16 rounded-t-lg hover:bg-brand-50/30 transition-colors cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30"
                      aria-label={`Open ${input.name}`}
                    >
                      <div className="w-9 h-9 rounded-md flex items-center justify-center shrink-0 bg-brand-50 text-brand-600">
                        <Database size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-ink-900 truncate">{input.name}</div>
                        <div className="text-[11px] text-ink-500 mt-0.5 tabular-nums truncate">
                          {input.type.toUpperCase()} · <span className="text-ink-400">{input.description || 'Data source'}</span>
                        </div>
                      </div>
                      <span
                        className={[
                          'text-[11px] font-bold uppercase tracking-wider rounded-md px-1.5 py-0.5 shrink-0',
                          formatBadgeClass(input.type),
                        ].join(' ')}
                      >
                        {input.type}
                      </span>
                    </button>

                    {/* Columns footer */}
                    {cols.length > 0 && (
                      <div className="border-t border-canvas-border/70 px-4 py-2 flex items-center gap-2 min-w-0">
                        <span className="text-[11px] text-ink-500 shrink-0">
                          Using <span className="font-mono tabular-nums text-ink-700">{cols.length}</span> of{' '}
                          <span className="font-mono tabular-nums text-ink-700">{cols.length}</span>:
                        </span>
                        <span className="text-[11px] font-mono text-ink-700 truncate flex-1" title={cols.join(', ')}>
                          {cols.join(', ')}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => toggleInputCardExpansion(input.id)}
                            aria-label={`Pick columns from ${input.name}`}
                            title="Pick columns"
                            className="inline-flex items-center gap-1 h-7 px-2.5 text-[11.5px] font-medium text-ink-700 bg-canvas-elevated border border-canvas-border hover:text-brand-700 hover:bg-brand-50 hover:border-brand-200 rounded-md transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                          >
                            <ListChecks size={11} strokeWidth={2.25} />
                            Pick
                          </button>
                          <button
                            type="button"
                            aria-label={`Describe column change for ${input.name} in chat`}
                            title="Describe in chat"
                            className="inline-flex items-center gap-1 h-7 px-2.5 text-[11.5px] font-medium text-ink-700 bg-canvas-elevated border border-canvas-border hover:text-brand-700 hover:bg-brand-50 hover:border-brand-200 rounded-md transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                          >
                            <MessageSquare size={11} strokeWidth={2.25} />
                            Chat
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Expanded column details (kept from original) */}
                    {expandedInputCardIds.has(input.id) && cols.length > 0 && (
                      <ul className="flex flex-col gap-1.5 border-t border-canvas-border/70 px-4 py-3">
                        {cols.map((col) => (
                          <li
                            key={col}
                            className="rounded-md bg-canvas border border-canvas-border px-2 py-1.5 min-w-0"
                          >
                            <div className="text-[12px] font-mono font-semibold text-ink-800 truncate">
                              {col}
                            </div>
                            <div className="text-[12px] text-ink-500 leading-snug mt-0.5">
                              {describeColumn(col)}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'preview' && (
          <div>
            {running && !result ? (
              <div className="flex flex-col items-center justify-center text-center py-12 px-4">
                <Loader2 size={20} className="animate-spin text-brand-600 mb-2" />
                <div className="text-[13px] font-semibold text-ink-800">
                  Running {workflow.name}…
                </div>
              </div>
            ) : !result ? (
              <div className="flex flex-col items-center justify-center text-center py-12 px-4">
                <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center mb-3">
                  <FileOutput size={18} />
                </div>
                <div className="text-[13px] font-semibold text-ink-800 mb-1">
                  No output yet
                </div>
                <div className="text-[12px] text-ink-500 max-w-[220px] leading-snug">
                  Run the workflow to see KPIs and the audit report here.
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {/* Run header */}
                <div className="flex items-start gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
                    <Zap size={16} className="text-brand-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-semibold text-ink-900 leading-tight truncate">
                      {workflow.name}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mt-1">
                      <span className="inline-flex items-center gap-1 text-[12px] font-bold text-compliant-700 bg-compliant-50 rounded-full px-2 py-0.5">
                        <CheckCircle2 size={10} />
                        RUN SUCCESSFUL
                      </span>
                      <span className="text-[12px] text-ink-400">
                        RUN ID: RWF-4407-B
                      </span>
                    </div>
                    <div className="text-[12px] text-ink-400 mt-0.5">
                      {(28_345_840).toLocaleString()} records
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Download"
                    className="w-8 h-8 rounded-lg border border-canvas-border text-ink-600 hover:bg-canvas-elevated flex items-center justify-center cursor-pointer transition-colors shrink-0"
                  >
                    <Download size={13} />
                  </button>
                </div>

                {/* KPI cards */}
                <div className="grid grid-cols-2 gap-2">
                  <OutputKPICard
                    label="TOTAL INVOICES"
                    value="1,129"
                    delta="+13%"
                    deltaTone="ok"
                  />
                  <OutputKPICard
                    label="CRITICAL FLAGS"
                    value="3"
                    valueTone="risk"
                    delta="+2"
                    deltaTone="risk"
                  />
                  <OutputKPICard
                    label="AUDIT ACCURACY"
                    value="99.4%"
                    valueTone="ok"
                    delta="+8.2%"
                    deltaTone="ok"
                  />
                  <OutputKPICard
                    label="POTENTIAL SAVINGS"
                    value="$42.5k"
                    delta="New"
                    deltaTone="neutral"
                  />
                </div>

                {/* Audit Report */}
                <div className="mt-1">
                  <h2 className="text-[13px] font-semibold text-ink-900 mb-2 px-1">
                    Audit Report
                  </h2>

                  <div className="rounded-xl border border-canvas-border bg-canvas-elevated overflow-hidden">
                    <div className="flex items-baseline justify-between gap-2 px-3 pt-2.5 pb-1.5">
                      <div className="text-[13px] font-semibold text-ink-800 truncate">
                        {result.title}
                      </div>
                      <span className="text-[12px] text-ink-400 font-bold uppercase tracking-wider shrink-0">
                        {result.outputType}
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[12px]">
                        <thead className="bg-canvas text-ink-500 border-y border-canvas-border">
                          <tr>
                            <th className="w-6"></th>
                            {result.columns.map((c) => (
                              <th
                                key={c}
                                className="text-left font-semibold px-2 py-1.5 whitespace-nowrap"
                              >
                                {c}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {result.rows.map((r, i) => {
                            const Icon =
                              r.status === 'flagged'
                                ? AlertOctagon
                                : r.status === 'warning'
                                  ? AlertTriangle
                                  : CheckCircle2;
                            const tone =
                              r.status === 'flagged'
                                ? 'bg-risk-50 border-l-2 border-risk'
                                : r.status === 'warning'
                                  ? 'bg-mitigated-50 border-l-2 border-mitigated'
                                  : 'bg-compliant-50 border-l-2 border-compliant';
                            const iconTone =
                              r.status === 'flagged'
                                ? 'text-risk'
                                : r.status === 'warning'
                                  ? 'text-mitigated'
                                  : 'text-compliant';
                            return (
                              <tr
                                key={i}
                                className={`${tone} ${i === 0 ? '' : 'border-t border-canvas-border'}`}
                              >
                                <td className="px-1.5 py-1.5 align-middle">
                                  <Icon size={12} className={iconTone} />
                                </td>
                                {r.cells.map((cell, j) => (
                                  <td
                                    key={j}
                                    className="px-2 py-1.5 text-ink-800 whitespace-nowrap"
                                  >
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Flag Distribution */}
                <FlagDistributionCard />

                {/* Monthly Invoice Volume */}
                <MonthlyInvoiceVolumeCard />
              </div>
            )}
          </div>
        )}

        {tab === 'plan' && (
          <div className="flex flex-col gap-3">
            {/* Workflow / Code toggle */}
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setCodeOpen(false)}
                aria-pressed={!codeOpen}
                className={[
                  'inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-[13px] font-semibold transition-colors cursor-pointer',
                  !codeOpen
                    ? 'border border-canvas-border bg-canvas-elevated text-ink-800'
                    : 'border border-transparent text-ink-500 hover:text-ink-800 hover:bg-canvas-elevated',
                ].join(' ')}
              >
                <WorkflowIcon size={12} />
                Workflow
              </button>
              <button
                type="button"
                onClick={() => setCodeOpen(true)}
                aria-pressed={codeOpen}
                className={[
                  'inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-mono font-semibold rounded-md transition-colors cursor-pointer',
                  codeOpen
                    ? 'text-brand-700 bg-brand-50 border border-brand-200/70'
                    : 'text-ink-500 hover:text-brand-700 hover:bg-canvas-elevated border border-transparent',
                ].join(' ')}
              >
                <Code2 size={12} />
                Code
              </button>
            </div>

            {/* References */}
            <section className="rounded-xl border border-canvas-border bg-canvas-elevated overflow-hidden">
              <button
                type="button"
                onClick={() => setReferencesOpen((v) => !v)}
                aria-expanded={referencesOpen}
                className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-canvas/40 transition-colors cursor-pointer"
              >
                <FileText size={12} className="text-ink-500 shrink-0" />
                <span className="text-[12px] font-bold tracking-[0.14em] text-ink-700 uppercase">
                  References
                </span>
                <span className="text-[12px] text-ink-500 truncate">
                  · {workflow.inputs.length} source{workflow.inputs.length === 1 ? '' : 's'} · {totalColumnsInUse} column{totalColumnsInUse === 1 ? '' : 's'} in use
                </span>
                <span className="ml-auto text-ink-400 shrink-0">
                  {referencesOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </span>
              </button>
              {referencesOpen && (
                <div className="px-3 pb-3 pt-0 flex flex-col gap-2.5 border-t border-canvas-border">
                  {workflow.inputs.map((input) => {
                    const Icon = typeIcon(input.type);
                    return (
                      <div key={input.id} className="min-w-0 pt-2.5">
                        <div className="flex items-center gap-2 mb-1">
                          <div
                            className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${typeColor(input.type)}`}
                          >
                            <Icon size={10} />
                          </div>
                          <span className="text-[13px] font-semibold text-ink-800 truncate">
                            {input.name}
                          </span>
                          <span className="text-[12px] text-ink-400 truncate">
                            {inputMeta(input)}
                          </span>
                        </div>
                        {(input.columns?.length ?? 0) > 0 && (
                          <div className="flex flex-wrap gap-1 ml-[26px]">
                            {input.columns!.map((col) => (
                              <span
                                key={col}
                                className="inline-flex items-center rounded-md bg-brand-50 border border-brand-100 px-1.5 py-0.5 text-[12px] text-brand-700 font-mono"
                              >
                                {col}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {codeOpen ? (
              /* Generated code view */
              <section className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2 px-1">
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-ink-900 leading-tight">
                      Generated code
                    </div>
                    <div className="text-[12px] text-ink-500 mt-0.5">
                      Python · pandas · ira utils
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-md border border-canvas-border bg-canvas-elevated hover:border-brand-300 hover:bg-brand-50/40 px-2 py-1 text-[12px] font-semibold text-ink-700 transition-colors cursor-pointer"
                    >
                      <Copy size={11} />
                      Copy
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-md border border-canvas-border bg-canvas-elevated hover:border-brand-300 hover:bg-brand-50/40 px-2 py-1 text-[12px] font-semibold text-ink-700 transition-colors cursor-pointer"
                    >
                      <ExternalLink size={11} />
                      Open
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-canvas-border overflow-hidden bg-[#0f1115]">
                  <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/5">
                    <span className="text-[12px] font-mono text-white/70">
                      workflow.py
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[12px] font-mono text-emerald-400/90">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      synced
                    </span>
                  </div>
                  <pre className="text-[12px] leading-[1.55] font-mono text-white/90 px-3 py-3 overflow-x-auto">
                    <code>
                      {SAMPLE_CODE_LINES.map((line, i) => (
                        <div key={i} className="flex">
                          <span className="select-none text-white/30 pr-3 tabular-nums w-6 text-right shrink-0">
                            {i + 1}
                          </span>
                          <span className="whitespace-pre">
                            {highlightPython(line)}
                          </span>
                        </div>
                      ))}
                    </code>
                  </pre>
                </div>
              </section>
            ) : (
              /* Steps list */
              <section>
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-[13px] font-semibold text-ink-800">Steps</span>
                  <button
                    type="button"
                    className="text-[13px] font-semibold text-brand-700 hover:text-brand-800 cursor-pointer transition-colors"
                  >
                    Reorder
                  </button>
                </div>
                <ul className="flex flex-col gap-2">
                  {workflow.steps.map((step, idx) => {
                    const badge = STEP_BADGE[step.type];
                    const relevant = workflow.inputs.filter((i) =>
                      step.dataFiles.includes(i.id),
                    );
                    return (
                      <li
                        key={step.id}
                        className="rounded-xl border border-canvas-border bg-canvas-elevated px-3 py-3 hover:border-brand-200 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <span className="w-6 h-6 rounded-full bg-ink-900 text-white flex items-center justify-center text-[12px] font-bold shrink-0 mt-0.5 tabular-nums">
                            {idx + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-[13px] font-semibold text-ink-800">
                                {step.name}
                              </h3>
                              <span
                                className={`text-[12px] font-bold tracking-wider rounded px-1.5 py-0.5 ${badge.bg} ${badge.text}`}
                              >
                                {badge.label}
                              </span>
                            </div>
                            <p className="text-[12px] text-ink-500 leading-relaxed mt-0.5">
                              {step.description}
                            </p>
                            {relevant.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {relevant.map((input) => (
                                  <span
                                    key={input.id}
                                    className="inline-flex items-center gap-1.5 rounded-md bg-canvas border border-canvas-border px-2 py-0.5 text-[12px] text-ink-700"
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-brand-600 shrink-0" />
                                    {input.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

const PY_KEYWORDS = new Set([
  'import',
  'from',
  'as',
  'def',
  'return',
  'if',
  'elif',
  'else',
  'for',
  'in',
  'and',
  'or',
  'not',
  'True',
  'False',
  'None',
]);

function highlightPython(line: string): ReactNode {
  if (line.length === 0) return ' ';
  const tokens: { text: string; cls: string }[] = [];
  const re = /('[^']*'|"[^"]*"|\b\d+(?:\.\d+)?\b|\b[A-Za-z_][A-Za-z0-9_]*\b|[\s]+|[^\s\w'"]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    const t = m[0];
    if (/^['"]/.test(t)) tokens.push({ text: t, cls: 'text-emerald-300' });
    else if (/^\d/.test(t)) tokens.push({ text: t, cls: 'text-amber-300' });
    else if (/^[A-Za-z_]/.test(t)) {
      if (PY_KEYWORDS.has(t)) tokens.push({ text: t, cls: 'text-fuchsia-300' });
      else if (t === 'pd' || t === 'ira' || t === 'pandas')
        tokens.push({ text: t, cls: 'text-sky-300' });
      else tokens.push({ text: t, cls: 'text-white/90' });
    } else tokens.push({ text: t, cls: 'text-white/60' });
  }
  return tokens.map((tk, i) => (
    <span key={i} className={tk.cls}>
      {tk.text}
    </span>
  ));
}

function OutputKPICard({
  label,
  value,
  valueTone,
  delta,
  deltaTone,
}: {
  label: string;
  value: string;
  valueTone?: 'risk' | 'ok' | 'default';
  delta?: string;
  deltaTone?: 'risk' | 'ok' | 'neutral';
}) {
  const valueColor =
    valueTone === 'risk'
      ? 'text-risk'
      : valueTone === 'ok'
        ? 'text-compliant'
        : 'text-ink-900';
  const deltaColor =
    deltaTone === 'risk'
      ? 'text-risk bg-risk-50'
      : deltaTone === 'ok'
        ? 'text-compliant-700 bg-compliant-50'
        : 'text-ink-500 bg-canvas';
  return (
    <div className="rounded-xl border border-canvas-border bg-canvas-elevated p-2.5">
      <div className="text-[12px] font-bold text-ink-400 tracking-wider">{label}</div>
      <div className="flex items-baseline gap-1.5 mt-0.5">
        <div className={`text-[18px] font-bold ${valueColor} leading-none tabular-nums`}>
          {value}
        </div>
        {delta && (
          <span
            className={`text-[12px] font-bold rounded-md px-1.5 py-0.5 ${deltaColor}`}
          >
            {delta}
          </span>
        )}
      </div>
    </div>
  );
}

const FLAG_DISTRIBUTION: { label: string; value: number; color: string }[] = [
  { label: 'MTOW Mismatch', value: 45, color: '#E24C5D' },
  { label: 'Excess Charge', value: 30, color: '#6A12CD' },
  { label: 'Invalid ID', value: 25, color: '#F0A93B' },
];

function FlagDistributionCard() {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const total = FLAG_DISTRIBUTION.reduce((n, s) => n + s.value, 0);
  let offsetAccum = 0;
  return (
    <div className="rounded-xl border border-canvas-border bg-canvas-elevated p-3">
      <div className="text-[12px] font-bold text-ink-400 tracking-wider mb-2">
        FLAG DISTRIBUTION
      </div>
      <div className="flex items-center gap-3">
        <svg
          viewBox="0 0 80 80"
          width="78"
          height="78"
          className="shrink-0 -rotate-90"
          aria-hidden="true"
        >
          {FLAG_DISTRIBUTION.map((seg) => {
            const dash = (seg.value / total) * circumference;
            const gap = circumference - dash;
            const el = (
              <circle
                key={seg.label}
                cx={40}
                cy={40}
                r={radius}
                fill="transparent"
                stroke={seg.color}
                strokeWidth={10}
                strokeDasharray={`${dash} ${gap}`}
                strokeDashoffset={-offsetAccum}
                strokeLinecap="butt"
              />
            );
            offsetAccum += dash;
            return el;
          })}
        </svg>
        <ul className="flex flex-col gap-1.5 min-w-0 flex-1">
          {FLAG_DISTRIBUTION.map((seg) => (
            <li key={seg.label} className="flex items-center gap-2 text-[12px]">
              <span
                className="w-3 h-3 rounded-sm shrink-0"
                style={{ background: seg.color }}
              />
              <span className="flex-1 truncate text-ink-700">{seg.label}</span>
              <span className="font-bold text-ink-900 tabular-nums">{seg.value}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const MONTHLY_VOLUME: { month: string; value: number; label: string }[] = [
  { month: 'Oct', value: 1800, label: '1.8K' },
  { month: 'Nov', value: 2100, label: '2.1K' },
  { month: 'Dec', value: 1900, label: '1.9K' },
  { month: 'Jan', value: 2400, label: '2.4K' },
  { month: 'Feb', value: 2100, label: '2.1K' },
  { month: 'Mar', value: 2100, label: '2.1K' },
];

function MonthlyInvoiceVolumeCard() {
  const max = Math.max(...MONTHLY_VOLUME.map((m) => m.value));
  const chartHeight = 56;
  return (
    <div className="rounded-xl border border-canvas-border bg-canvas-elevated p-3">
      <div className="text-[13px] font-semibold text-ink-900 mb-3">
        Monthly Invoice Volume
      </div>
      <div className="grid grid-cols-6 gap-2 items-end" style={{ height: chartHeight + 32 }}>
        {MONTHLY_VOLUME.map((m) => {
          const h = Math.max(4, (m.value / max) * chartHeight);
          return (
            <div key={m.month} className="flex flex-col items-center gap-1 min-w-0">
              <div className="text-[12px] font-semibold text-ink-500 tabular-nums">
                {m.label}
              </div>
              <div
                className="w-full rounded-t-sm bg-gradient-to-t from-[#334b6e] to-[#4b6890]"
                style={{ height: `${h}px` }}
                aria-label={`${m.month}: ${m.label}`}
              />
              <div className="text-[12px] text-ink-400">{m.month}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
