import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  Search, Sparkles, Check, ArrowRight, X, Calendar, Loader2, FileText,
  UploadCloud, Database, ChevronDown, ChevronUp, AlertTriangle, Upload,
  Minus, ChevronLeft, ChevronRight, Clock, Trash2, ExternalLink,
} from 'lucide-react';
import { DATA_SOURCES } from '../../data/mockData';
import { useToast } from '../shared/Toast';
import { useBulkRunProgress } from '../shared/BulkRunProgress';
import type { LibraryWorkflow } from './WorkflowLibraryView';

const FREQUENCIES = ['Hourly', 'Daily', 'Weekly', 'Monthly'] as const;
type Frequency = typeof FREQUENCIES[number];

const TRIGGERS = ['Schedule', 'Data Change', 'Manual'] as const;
type Trigger = typeof TRIGGERS[number];

const RETRIES = ['Off', '1x', '3x', '5x'] as const;
type Retry = typeof RETRIES[number];

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
type Weekday = typeof WEEKDAYS[number];

// Mock "backend" response — required files for the bulk run
const REQUIRED_FILES = [
  {
    name: 'AP Invoice Register',
    format: 'CSV',
    required: true,
    description: 'Period export of posted invoices — invoice number, vendor, amount, date, GL account, entered-by user.',
  },
  {
    name: 'Vendor Master',
    format: 'CSV',
    required: true,
    description: 'Active vendor master snapshot used to validate every invoice vendor against the approved list.',
  },
  {
    name: 'GL Trial Balance',
    format: 'CSV',
    required: true,
    description: 'Period-end trial balance export — ties AP postings back to the general ledger for reconciliation.',
  },
];

// Columns present in each uploaded source file (dummy — what the CSV "contains")
const AVAILABLE_COLUMNS = [
  'invoice_no', 'inv_date', 'amount_before_tax', 'amount_after_tax',
  'vendor_id', 'vendor_name', 'pan', 'gstin_no', 'hsn_code',
  'pmt_block', 'acct_no', 'ifsc', 'currency',
];

type ColumnMatchConfidence = 'exact' | 'fuzzy' | 'missing';

type ColumnMapping = {
  required: string;
  matched: string | null;
  confidence: ColumnMatchConfidence;
};

type ReviewWorkflowStatus = 'mapped' | 'column' | 'file' | 'notmapped' | 'sql' | 'dropped';

type SqlConfigField = {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date';
  defaultValue: string;
  required?: boolean;
};

type ReviewWorkflow = {
  id: string;
  code: string;
  name: string;
  status: ReviewWorkflowStatus;
  prevStatus?: Exclude<ReviewWorkflowStatus, 'dropped'>;
  runtime: number;
  mappedFiles?: string[];
  fileError?: string;
  missingFiles?: string[];
  columns?: ColumnMapping[];
  hasOverrides?: boolean;
  // SQL-specific (only when status === 'sql')
  sqlFields?: SqlConfigField[];
  sqlUseDefaults?: boolean;
  sqlCustomValues?: Record<string, string>;
};

const DEMO_REVIEW_WORKFLOWS: ReviewWorkflow[] = [
  {
    id: 'rw-1',
    code: 'P2P-001',
    name: '3-Way Match (PO · GRN · Invoice)',
    status: 'mapped',
    runtime: 4.2,
    mappedFiles: ['po_dump_q3.sql', 'grn_records.json', 'invoice_batch_sep2026.pdf'],
  },
  {
    id: 'rw-2',
    code: 'P2P-002',
    name: 'Invoice Duplicate Detection',
    status: 'column',
    runtime: 2.8,
    mappedFiles: ['invoice_batch_sep2026.pdf', 'vendor_master_v3.xlsx'],
    columns: [
      { required: 'Invoice_Number', matched: 'invoice_no', confidence: 'exact' },
      { required: 'Vendor_GSTIN', matched: null, confidence: 'missing' },
      { required: 'Invoice_Date', matched: 'inv_date', confidence: 'exact' },
      { required: 'Taxable_Amount', matched: 'amount_before_tax', confidence: 'fuzzy' },
      { required: 'Vendor_Code', matched: 'vendor_id', confidence: 'fuzzy' },
    ],
  },
  {
    id: 'rw-3',
    code: 'VDR-014',
    name: 'Vendor Risk Score',
    status: 'file',
    runtime: 3.5,
    fileError: 'Expected: vendor_risk_signals dataset. Got: GRN_Records.json (schema mismatch)',
  },
  {
    id: 'rw-4',
    code: 'GL-009',
    name: 'GL Anomaly Detection',
    status: 'mapped',
    runtime: 5.1,
    mappedFiles: ['gl_q3_2026.csv'],
  },
  {
    id: 'rw-5',
    code: 'P2P-007',
    name: 'PO-GRN Quantity Reconciliation',
    status: 'mapped',
    runtime: 3.0,
    mappedFiles: ['po_dump_q3.sql', 'grn_records.json'],
  },
  {
    id: 'rw-6',
    code: 'TAX-003',
    name: 'TDS Compliance (194Q · 194C)',
    status: 'notmapped',
    runtime: 2.4,
    missingFiles: ['TDS Deduction Register'],
  },
  {
    id: 'rw-7',
    code: 'P2P-012',
    name: 'Payment Block Review',
    status: 'column',
    runtime: 2.2,
    mappedFiles: ['vendor_master_v3.xlsx', 'invoice_batch_sep2026.pdf'],
    columns: [
      { required: 'Vendor_Bank_Account', matched: 'acct_no', confidence: 'fuzzy' },
      { required: 'Block_Indicator', matched: 'pmt_block', confidence: 'fuzzy' },
      { required: 'IFSC_Code', matched: 'ifsc', confidence: 'exact' },
    ],
  },
  {
    id: 'rw-8',
    code: 'GL-018',
    name: 'Period-End Accrual Check',
    status: 'notmapped',
    runtime: 1.8,
    missingFiles: ['Accrual Schedule'],
  },
  {
    id: 'rw-9',
    code: 'O2C-021',
    name: 'Customer Tier Revenue Concentration',
    status: 'sql',
    runtime: 1.6,
    sqlUseDefaults: true,
    sqlFields: [
      { key: 'membership', label: 'Filter by Customer Membership (Gold, Silver, Bronze)', type: 'text', defaultValue: 'Gold', required: true },
      { key: 'periodStart', label: 'Start of the analysis period', type: 'date', defaultValue: '', required: true },
      { key: 'periodEnd', label: 'End of the analysis period', type: 'date', defaultValue: '', required: true },
      { key: 'minRevenue', label: 'Minimum total revenue threshold for the category', type: 'number', defaultValue: '100', required: true },
    ],
  },
  {
    id: 'rw-10',
    code: 'GL-022',
    name: 'Journal Entry Threshold Alert',
    status: 'sql',
    runtime: 1.2,
    sqlUseDefaults: true,
    sqlFields: [
      { key: 'minAmount', label: 'Minimum journal entry amount to flag', type: 'number', defaultValue: '50000', required: true },
      { key: 'fiscalYear', label: 'Fiscal year', type: 'text', defaultValue: 'FY2026', required: true },
    ],
  },
];

type UploadedFile = {
  id: string;
  name: string;
  size: number;
  error?: string;
};

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function makeUploaded(files: File[]): UploadedFile[] {
  const stamp = Date.now();
  return files.map((file, idx) => ({
    id: `${file.name}-${file.size}-${stamp}-${idx}`,
    name: file.name,
    size: file.size,
    error: /\.(dmg|exe)$/i.test(file.name) ? 'Request failed with status code 500' : undefined,
  }));
}

const SEED_UPLOADED_FILES: UploadedFile[] = [
  { id: 'seed-gl', name: 'gl_q3_2026.csv', size: Math.round(12.4 * 1024 * 1024) },
  { id: 'seed-invoice', name: 'invoice_batch_sep2026.pdf', size: Math.round(48.1 * 1024 * 1024) },
  { id: 'seed-vendor', name: 'vendor_master_v3.xlsx', size: Math.round(2.8 * 1024 * 1024) },
  { id: 'seed-po', name: 'po_dump_q3.sql', size: Math.round(8.2 * 1024 * 1024) },
  { id: 'seed-grn', name: 'grn_records.json', size: Math.round(4.7 * 1024 * 1024) },
];

export function Checkbox({
  checked,
  indeterminate,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  ariaLabel: string;
}) {
  const showMark = checked || indeterminate;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      aria-label={ariaLabel}
      onClick={e => { e.stopPropagation(); onChange(); }}
      className={`w-4 h-4 rounded border flex items-center justify-center transition-colors cursor-pointer ${
        showMark ? 'bg-primary border-primary' : 'bg-white border-border hover:border-primary/60'
      }`}
    >
      {checked && !indeterminate && <Check size={12} className="text-white" strokeWidth={3} />}
      {indeterminate && <div className="w-2 h-[2px] bg-white rounded-sm" />}
    </button>
  );
}

function Pill({
  active,
  onClick,
  children,
  disabled = false,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-3.5 h-8 rounded-lg text-[12.5px] font-semibold transition-colors ${
        disabled
          ? 'bg-surface-2 text-text-muted/50 border border-border-light cursor-not-allowed'
          : active
            ? 'bg-primary text-white hover:bg-primary-hover cursor-pointer'
            : 'bg-white text-text-muted border border-border-light hover:border-primary/30 hover:text-text cursor-pointer'
      }`}
    >
      {children}
    </button>
  );
}

// ─── Bulk Execute Modal (Step 1 — Select Workflows) ───
export function BulkExecuteModal({
  selectedWorkflows,
  onClose,
  onContinue,
}: {
  selectedWorkflows: LibraryWorkflow[];
  onClose: () => void;
  onContinue: (data: {
    auditName: string;
    auditDescription: string;
    frequency: Frequency;
    triggerOn: Trigger;
    runTime: string;
    retry: Retry;
  }) => void;
}) {
  const { addToast } = useToast();
  const { startBulkRun } = useBulkRunProgress();
  const [modalDeselected, setModalDeselected] = useState<Set<string>>(new Set());
  const [auditName, setAuditName] = useState('Q3-P2P');
  const [auditDescription, setAuditDescription] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('Daily');
  const [triggerOn, setTriggerOn] = useState<Trigger>('Schedule');
  const [runTime, setRunTime] = useState('06:00');
  const [retry, setRetry] = useState<Retry>('3x');
  const [weekday, setWeekday] = useState<Weekday>('Mon');
  const [monthlyDate, setMonthlyDate] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  // Step 2 state
  const [requiredFilesOpen, setRequiredFilesOpen] = useState(false);
  const [selectedListOpen, setSelectedListOpen] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(true);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>(SEED_UPLOADED_FILES);
  const [selectedUploadIds, setSelectedUploadIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dsSearch, setDsSearch] = useState('');
  const [linkedSourceIds, setLinkedSourceIds] = useState<Set<string>>(new Set());
  // Step 2 — sub-view: first upload, then review
  const [step2View, setStep2View] = useState<'upload' | 'review'>('upload');
  const [uploadModeTab, setUploadModeTab] = useState<'upload' | 'existing'>('upload');
  // Step 2 — Review state
  const [reviewFilter, setReviewFilter] = useState<'all' | ReviewWorkflowStatus>('all');
  const [reviewWorkflows, setReviewWorkflows] = useState<ReviewWorkflow[]>(DEMO_REVIEW_WORKFLOWS);
  const [expandedReviewId, setExpandedReviewId] = useState<string | null>(null);
  // SQL config modal
  const [configModalWorkflowId, setConfigModalWorkflowId] = useState<string | null>(null);
  const [configDraft, setConfigDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isFetching) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isFetching]);

  const activeWorkflows = selectedWorkflows.filter(w => !modalDeselected.has(w.id));
  const uniqueBps = Array.from(new Set(activeWorkflows.map(w => w.businessProcess)));
  const isSingleBp = uniqueBps.length === 1;
  const isMultipleBps = uniqueBps.length > 1;
  const hasAuditName = auditName.trim().length > 0;
  const hasWorkflows = activeWorkflows.length > 0;
  const needsMonthlyDate = triggerOn === 'Schedule' && frequency === 'Monthly';
  const monthlyDateOk = !needsMonthlyDate || monthlyDate.trim().length > 0;
  const canContinue = hasWorkflows && hasAuditName && isSingleBp && monthlyDateOk;

  const toggleWorkflow = (id: string) => {
    setModalDeselected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = () => {
    if (isMultipleBps) {
      addToast({
        type: 'error',
        message: 'Bulk run is possible only when all workflows belong to a single business process.',
      });
      return;
    }
    if (!hasWorkflows || !hasAuditName) return;
    setIsFetching(true);
    window.setTimeout(() => {
      setIsFetching(false);
      setStep2View('upload');
      setStep(2);
    }, 2200);
  };

  const handleStep2Continue = () => {
    if (uploadedFiles.length === 0 && linkedSourceIds.size === 0) {
      addToast({
        type: 'error',
        message: 'Upload files or link an existing data source before continuing.',
      });
      return;
    }
    const failedFiles = uploadedFiles.filter(u => u.error).length;
    if (failedFiles > 0) {
      addToast({
        type: 'error',
        message: `${failedFiles} of ${uploadedFiles.length} file${uploadedFiles.length === 1 ? '' : 's'} failed to upload. Delete or resolve them before continuing.`,
      });
      return;
    }
    const active = reviewWorkflows.filter(rw => rw.status === 'mapped' || rw.status === 'column').length;
    if (active === 0) {
      addToast({
        type: 'error',
        message: 'No workflows are ready to run. Resolve mappings or restore at least one workflow.',
      });
      return;
    }
    setStep(3);
  };

  const handleStep3Execute = () => {
    const activeRunWorkflows = reviewWorkflows
      .filter(rw =>
        rw.status === 'mapped' ||
        rw.status === 'column' ||
        (rw.status === 'sql' && (rw.sqlUseDefaults || rw.sqlCustomValues))
      )
      .map(rw => ({ id: rw.id, name: rw.name }));
    startBulkRun({
      name: auditName.trim() || 'Bulk Run',
      workflows: activeRunWorkflows,
    });
    onContinue({
      auditName: auditName.trim(),
      auditDescription: auditDescription.trim(),
      frequency,
      triggerOn,
      runTime,
      retry,
    });
  };

  const handleFileDrop = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      setUploadedFiles(prev => [...prev, ...makeUploaded(files)]);
      setLinkedSourceIds(new Set());
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) {
      setUploadedFiles(prev => [...prev, ...makeUploaded(files)]);
      setLinkedSourceIds(new Set());
    }
    e.target.value = '';
  };

  const removeUpload = (id: string) => {
    setUploadedFiles(prev => prev.filter(u => u.id !== id));
    setSelectedUploadIds(prev => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const toggleUploadSelection = (id: string) => {
    setSelectedUploadIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allUploadsSelected = uploadedFiles.length > 0 && selectedUploadIds.size === uploadedFiles.length;

  const toggleSelectAllUploads = () => {
    if (allUploadsSelected) {
      setSelectedUploadIds(new Set());
    } else {
      setSelectedUploadIds(new Set(uploadedFiles.map(u => u.id)));
    }
  };

  const switchToChooseExisting = () => {
    setUploadedFiles([]);
    setSelectedUploadIds(new Set());
    setUploadModeTab('existing');
  };

  const triggerUpload = () => fileInputRef.current?.click();

  const toggleDataSource = (id: string) => {
    setLinkedSourceIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    if (uploadedFiles.length > 0) {
      setUploadedFiles([]);
      setSelectedUploadIds(new Set());
    }
  };

  const filteredDataSources = DATA_SOURCES.filter(ds =>
    ds.name.toLowerCase().includes(dsSearch.trim().toLowerCase())
  );

  const hasUpload = uploadedFiles.length > 0 || linkedSourceIds.size > 0;

  const reviewCounts = useMemo(() => {
    const base = {
      all: reviewWorkflows.length,
      mapped: 0,
      column: 0,
      file: 0,
      notmapped: 0,
      sql: 0,
      dropped: 0,
      active: 0,
    };
    for (const rw of reviewWorkflows) {
      base[rw.status] += 1;
      if (rw.status === 'mapped' || rw.status === 'column') base.active += 1;
      if (rw.status === 'sql' && (rw.sqlUseDefaults || rw.sqlCustomValues)) base.active += 1;
    }
    return base;
  }, [reviewWorkflows]);

  const filteredReviewWorkflows = useMemo(() => {
    if (reviewFilter === 'all') return reviewWorkflows;
    return reviewWorkflows.filter(rw => rw.status === reviewFilter);
  }, [reviewFilter, reviewWorkflows]);

  const dropReviewWorkflow = (id: string) => {
    setReviewWorkflows(prev =>
      prev.map(rw =>
        rw.id === id && rw.status !== 'dropped'
          ? { ...rw, status: 'dropped', prevStatus: rw.status }
          : rw
      )
    );
    setExpandedReviewId(prev => (prev === id ? null : prev));
  };

  const restoreReviewWorkflow = (id: string) => {
    setReviewWorkflows(prev =>
      prev.map(rw =>
        rw.id === id && rw.status === 'dropped'
          ? { ...rw, status: rw.prevStatus ?? 'mapped', prevStatus: undefined }
          : rw
      )
    );
  };

  const toggleSqlUseDefaults = (id: string) => {
    setReviewWorkflows(prev =>
      prev.map(rw =>
        rw.id === id && rw.status === 'sql'
          ? { ...rw, sqlUseDefaults: !rw.sqlUseDefaults }
          : rw
      )
    );
  };

  const openConfigModal = (id: string) => {
    const wf = reviewWorkflows.find(rw => rw.id === id);
    if (!wf || !wf.sqlFields) return;
    const initial: Record<string, string> = {};
    wf.sqlFields.forEach(f => {
      initial[f.key] = wf.sqlCustomValues?.[f.key] ?? f.defaultValue;
    });
    setConfigDraft(initial);
    setConfigModalWorkflowId(id);
  };

  const saveConfigModal = () => {
    if (!configModalWorkflowId) return;
    setReviewWorkflows(prev =>
      prev.map(rw =>
        rw.id === configModalWorkflowId
          ? { ...rw, sqlCustomValues: configDraft, sqlUseDefaults: false }
          : rw
      )
    );
    setConfigModalWorkflowId(null);
    setConfigDraft({});
  };

  const closeConfigModal = () => {
    setConfigModalWorkflowId(null);
    setConfigDraft({});
  };

  const updateReviewColumn = (wfId: string, idx: number, value: string) => {
    setReviewWorkflows(prev =>
      prev.map(rw => {
        if (rw.id !== wfId || !rw.columns) return rw;
        const next = rw.columns.map((c, i) => {
          if (i !== idx) return c;
          if (!value) return { ...c, matched: null, confidence: 'missing' as ColumnMatchConfidence };
          return {
            ...c,
            matched: value,
            confidence: c.confidence === 'missing' ? ('fuzzy' as ColumnMatchConfidence) : c.confidence,
          };
        });
        return { ...rw, columns: next };
      })
    );
  };

  const confirmReviewColumns = (wfId: string) => {
    setReviewWorkflows(prev =>
      prev.map(rw => {
        if (rw.id !== wfId || !rw.columns) return rw;
        const allResolved = rw.columns.every(c => c.confidence !== 'missing');
        if (!allResolved) return rw;
        return { ...rw, status: 'mapped', hasOverrides: true };
      })
    );
    setExpandedReviewId(null);
  };

  const toggleReviewExpand = (id: string) => {
    setExpandedReviewId(prev => (prev === id ? null : id));
  };

  const step2CanContinue = hasUpload && reviewCounts.active > 0;

  const stepState = (n: 1 | 2 | 3): 'active' | 'done' | 'pending' => {
    if (n < step) return 'done';
    if (n === step) return 'active';
    return 'pending';
  };
  const STEPS = [
    { n: 1, label: 'Select Workflows', state: stepState(1) },
    { n: 2, label: 'Configure Data Source', state: stepState(2) },
    { n: 3, label: 'Bulk Execute', state: stepState(3) },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ duration: 0.18 }}
        role="dialog"
        aria-modal="true"
        aria-label="Bulk Execute"
        className="relative bg-white rounded-2xl shadow-2xl w-[800px] h-[700px] max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border-light flex items-center justify-between shrink-0">
          <h3 className="text-[16px] font-semibold text-text">Bulk Execute</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-surface-2 rounded-md transition-colors cursor-pointer" aria-label="Close">
            <X size={16} className="text-text-muted" />
          </button>
        </div>

        {/* Stepper — hidden while the loader is shown */}
        {!isFetching && (
        <div className="px-6 py-4 border-b border-border-light shrink-0 flex items-center w-full">
          {STEPS.map((s, idx) => (
            <Fragment key={s.n}>
              <div className="flex items-center gap-2.5 shrink-0">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-semibold ${
                  s.state === 'active'
                    ? 'bg-primary text-white'
                    : s.state === 'done'
                      ? 'bg-primary/15 text-primary'
                      : 'bg-surface-2 text-text-muted'
                }`}>
                  {s.state === 'done' ? <Check size={13} strokeWidth={3} /> : s.n}
                </div>
                <span className={`text-[13px] ${
                  s.state === 'active' ? 'text-text font-semibold' : s.state === 'done' ? 'text-text' : 'text-text-muted'
                }`}>
                  {s.label}
                </span>
              </div>
              {idx < STEPS.length - 1 && <div className="flex-1 h-px bg-border-light mx-4" />}
            </Fragment>
          ))}
        </div>
        )}

        {isFetching ? (
          <FetchingFilesLoader workflowCount={activeWorkflows.length} />
        ) : step === 1 ? (
        <>
        {/* Body — Step 1 */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Business Process */}
          <div>
            <label className="block text-[12px] font-semibold text-text mb-1.5">Business Process</label>
            {isSingleBp && (
              <div className="px-3 py-2.5 rounded-md border border-border-light bg-surface-2 text-[13px] text-text">
                {uniqueBps[0]}
              </div>
            )}
            {isMultipleBps && (
              <div className="px-3 py-2.5 rounded-md border border-risk/40 bg-risk/5 text-[12.5px] text-risk-700 leading-relaxed">
                Multiple business processes in selection ({uniqueBps.join(', ')}). Bulk run requires all workflows to belong to a single business process.
              </div>
            )}
            {!hasWorkflows && (
              <div className="px-3 py-2.5 rounded-md border border-border-light bg-surface-2 text-[13px] text-text-muted">
                No workflows selected
              </div>
            )}
          </div>

          {/* Selected Workflows */}
          <div>
            <button
              type="button"
              onClick={() => setSelectedListOpen(p => !p)}
              className="w-full flex items-center gap-2 mb-1.5 cursor-pointer"
              aria-expanded={selectedListOpen}
            >
              <label className="text-[12px] font-semibold text-text cursor-pointer">Selected Workflows</label>
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-white text-[11px] font-semibold">
                {activeWorkflows.length}
              </span>
              {selectedWorkflows.length > activeWorkflows.length && (
                <span className="text-[11px] text-text-muted">
                  ({selectedWorkflows.length - activeWorkflows.length} deselected)
                </span>
              )}
              <span className="ml-auto text-text-muted">
                {selectedListOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </span>
            </button>
            {selectedListOpen && (
            <div className="border border-border-light rounded-md divide-y divide-border-light overflow-hidden max-h-[240px] overflow-y-auto">
              {selectedWorkflows.map(w => {
                const checked = !modalDeselected.has(w.id);
                return (
                  <label
                    key={w.id}
                    className="flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-surface-2/60 transition-colors"
                  >
                    <span className="pt-0.5">
                      <Checkbox
                        checked={checked}
                        onChange={() => toggleWorkflow(w.id)}
                        ariaLabel={`Toggle ${w.name}`}
                      />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className={`text-[13px] font-medium ${checked ? 'text-text' : 'text-text-muted line-through'}`}>
                        {w.name}
                      </div>
                      <div className="text-[11px] text-text-muted mt-0.5">
                        {w.businessProcess} · {w.controlId}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
            )}
          </div>

          {/* Audit Details */}
          <div>
            <div className="text-[12px] font-semibold text-text mb-2">Audit Details</div>
            <div className="space-y-3">
              <div>
                <label className="block text-[12px] font-medium text-text-secondary mb-1">
                  Audit Name <span className="text-risk">*</span>
                </label>
                <input
                  value={auditName}
                  onChange={e => setAuditName(e.target.value)}
                  placeholder="Enter audit name"
                  className="w-full px-3 py-2.5 rounded-md border border-border-light text-[13px] text-text placeholder:text-text-muted/60 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-text-secondary mb-1">Audit Description</label>
                <textarea
                  value={auditDescription}
                  onChange={e => setAuditDescription(e.target.value)}
                  placeholder="Describe the purpose or scope of this audit"
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-md border border-border-light text-[13px] text-text placeholder:text-text-muted/60 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all resize-none"
                />
              </div>
            </div>
          </div>

          {/* Audit run frequency */}
          <div className="rounded-lg border border-border-light bg-surface-2/40 p-4">
            <div className="flex items-center gap-2 mb-4">
              <Calendar size={14} className="text-primary" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                Audit run frequency
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              {/* Frequency — only meaningful for Schedule trigger */}
              <div>
                <label className="block text-[12px] font-semibold text-text mb-2">Frequency</label>
                <div className="flex flex-wrap gap-2">
                  {FREQUENCIES.map(f => (
                    <Pill
                      key={f}
                      active={frequency === f}
                      disabled={triggerOn !== 'Schedule'}
                      onClick={() => setFrequency(f)}
                    >
                      {f}
                    </Pill>
                  ))}
                </div>
              </div>
              {/* Run Time — only meaningful for Schedule trigger */}
              <div>
                <label className="block text-[12px] font-semibold text-text mb-2">Run Time</label>
                <input
                  type="time"
                  value={runTime}
                  onChange={e => setRunTime(e.target.value)}
                  disabled={triggerOn !== 'Schedule'}
                  className="w-full px-3 py-2 rounded-md border border-border-light text-[13px] text-text bg-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-surface-2"
                />
              </div>
              {/* Day of week — only for Weekly + Schedule */}
              {frequency === 'Weekly' && triggerOn === 'Schedule' && (
                <div className="col-span-2">
                  <label className="block text-[12px] font-semibold text-text mb-2">Select day of the week</label>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAYS.map(d => (
                      <Pill
                        key={d}
                        active={weekday === d}
                        onClick={() => setWeekday(d)}
                      >
                        {d}
                      </Pill>
                    ))}
                  </div>
                </div>
              )}
              {/* Date picker — only for Monthly + Schedule */}
              {frequency === 'Monthly' && triggerOn === 'Schedule' && (
                <div className="col-span-2 grid grid-cols-2 gap-x-6">
                  <div>
                    <label className="block text-[12px] font-semibold text-text mb-2">Select date</label>
                    <CustomDatePicker value={monthlyDate} onChange={setMonthlyDate} />
                  </div>
                </div>
              )}
              {/* Trigger On */}
              <div>
                <label className="block text-[12px] font-semibold text-text mb-2">Trigger On</label>
                <div className="flex flex-wrap gap-2">
                  {TRIGGERS.map(t => (
                    <Pill
                      key={t}
                      active={triggerOn === t}
                      onClick={() => setTriggerOn(t)}
                    >
                      {t}
                    </Pill>
                  ))}
                </div>
              </div>
              {/* Retry on Failure */}
              <div>
                <label className="block text-[12px] font-semibold text-text mb-2">Retry on Failure</label>
                <div className="flex flex-wrap gap-2">
                  {RETRIES.map(r => (
                    <Pill
                      key={r}
                      active={retry === r}
                      onClick={() => setRetry(r)}
                    >
                      {r}
                    </Pill>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border-light flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="px-4 h-9 rounded-md bg-white text-text border border-border text-[13px] font-semibold hover:bg-surface-2 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            aria-disabled={!canContinue && !isMultipleBps}
            className={`flex items-center gap-2 px-4 h-9 rounded-md text-white text-[13px] font-semibold transition-colors ${
              canContinue
                ? 'bg-primary hover:bg-primary-hover cursor-pointer'
                : 'bg-primary/40 cursor-not-allowed'
            }`}
          >
            Continue
            <ArrowRight size={14} />
          </button>
        </div>
        </>
        ) : step === 2 ? (
        <>
        {/* Body — Step 2 */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {step2View === 'upload' && (
          <>
          {/* Required Files */}
          <div className="rounded-lg border border-border-light bg-white">
            <button
              type="button"
              onClick={() => setRequiredFilesOpen(p => !p)}
              className="w-full flex items-center justify-between px-4 py-3 cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-primary" />
                <span className="text-[13px] font-semibold text-text">Required Files</span>
                <span className="text-[12px] text-text-muted">
                  {REQUIRED_FILES.filter(f => f.required).length} required · {REQUIRED_FILES.length} total
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[12px] text-text-muted">
                Click to {requiredFilesOpen ? 'collapse' : 'expand'}
                {requiredFilesOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
            </button>
            {requiredFilesOpen && (
              <div className="px-4 pb-4 grid grid-cols-2 gap-3 border-t border-border-light pt-3">
                {REQUIRED_FILES.map(file => (
                  <div
                    key={file.name}
                    className="p-3 rounded-md border border-border-light bg-surface-2/30"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[13px] font-semibold text-text">{file.name}</span>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-border-light bg-white text-[10px] font-mono font-semibold text-ink-700">
                        {file.format}
                      </span>
                      {file.required && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-risk">
                          Required
                        </span>
                      )}
                    </div>
                    <div className="text-[12px] text-text-secondary leading-relaxed">{file.description}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upload data files */}
          <div className="rounded-lg border border-border-light bg-white">
            <button
              type="button"
              onClick={() => setUploadOpen(p => !p)}
              className="w-full flex items-start justify-between px-4 py-3 cursor-pointer"
            >
              <div className="text-left">
                <div className="text-[13px] font-semibold text-text">Upload data files</div>
                <div className="text-[12px] text-text-muted">
                  Upload the files required for this workflow, then hit Continue.
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[12px] text-text-muted shrink-0 pt-0.5">
                Click to {uploadOpen ? 'collapse' : 'expand'}
                {uploadOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
            </button>
            {uploadOpen && (
              <div className="px-4 pb-4 border-t border-border-light pt-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  accept=".csv,.pdf,.png,.jpg,.jpeg,.xlsx"
                />

                {uploadedFiles.length === 0 ? (
                  <div>
                    {/* Mode tabs + (existing-only) search */}
                    <div className="flex items-center gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => setUploadModeTab('upload')}
                        className={`inline-flex items-center gap-1.5 h-9 px-4 rounded-md border text-[12.5px] font-semibold transition-colors cursor-pointer ${
                          uploadModeTab === 'upload'
                            ? 'bg-primary border-primary text-white'
                            : 'bg-white border-primary/30 text-primary hover:bg-primary/5'
                        }`}
                      >
                        <Upload size={13} />
                        Upload
                      </button>
                      <button
                        type="button"
                        onClick={() => setUploadModeTab('existing')}
                        className={`inline-flex items-center gap-1.5 h-9 px-4 rounded-md border text-[12.5px] font-semibold transition-colors cursor-pointer ${
                          uploadModeTab === 'existing'
                            ? 'bg-primary border-primary text-white'
                            : 'bg-white border-primary/30 text-primary hover:bg-primary/5'
                        }`}
                      >
                        <Database size={13} />
                        Choose Existing
                      </button>
                      {uploadModeTab === 'existing' && (
                        <div className="relative ml-auto w-[260px]">
                          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                          <input
                            value={dsSearch}
                            onChange={e => setDsSearch(e.target.value)}
                            placeholder="Search data sources..."
                            className="w-full pl-8 pr-3 h-9 rounded-md border border-border-light text-[12px] text-text bg-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
                          />
                        </div>
                      )}
                    </div>

                    {uploadModeTab === 'upload' ? (
                      <div
                        onClick={triggerUpload}
                        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleFileDrop}
                        className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed cursor-pointer transition-colors min-h-[220px] px-4 py-8 ${
                          isDragging
                            ? 'border-primary bg-primary/5'
                            : 'border-primary/30 bg-primary-xlight/40 hover:border-primary/50 hover:bg-primary/5'
                        }`}
                      >
                        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                          <UploadCloud size={22} className="text-primary" />
                        </div>
                        <div className="text-center">
                          <div className="text-[13px] font-semibold text-text">Drop files here or click to upload</div>
                          <div className="text-[12px] text-text-muted mt-1">
                            CSV, PDF, images — any data files for this workflow
                          </div>
                          <div className="text-[11px] text-text-muted/80 mt-2">Auto-mapped to required inputs</div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col min-h-[220px]">
                        <div className="flex-1 overflow-y-auto pr-1">
                          {filteredDataSources.length === 0 ? (
                            <div className="text-[12px] text-text-muted text-center py-4">No data sources match.</div>
                          ) : (
                            <div className="grid grid-cols-2 gap-2">
                              {filteredDataSources.map(ds => {
                                const isLinked = linkedSourceIds.has(ds.id);
                                return (
                                  <button
                                    key={ds.id}
                                    type="button"
                                    role="checkbox"
                                    aria-checked={isLinked}
                                    onClick={() => toggleDataSource(ds.id)}
                                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md border transition-colors cursor-pointer text-left ${
                                      isLinked
                                        ? 'border-primary bg-primary/5'
                                        : 'border-border-light hover:border-primary/30 hover:bg-surface-2'
                                    }`}
                                  >
                                    <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                                      <Database size={13} className="text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="text-[12.5px] font-semibold text-text truncate">{ds.name}</div>
                                      <div className="text-[11px] text-text-muted truncate">
                                        {ds.records} records · last sync {ds.lastSync}
                                      </div>
                                    </div>
                                    <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                      isLinked ? 'border-primary bg-primary text-white' : 'border-border bg-white text-transparent'
                                    }`}>
                                      <Check size={11} strokeWidth={3} />
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <UploadedFilesPanel
                    files={uploadedFiles}
                    selectedIds={selectedUploadIds}
                    allSelected={allUploadsSelected}
                    onToggleAll={toggleSelectAllUploads}
                    onToggleOne={toggleUploadSelection}
                    onRemove={removeUpload}
                    onUploadMore={triggerUpload}
                    onChooseExisting={switchToChooseExisting}
                  />
                )}
              </div>
            )}
          </div>

          </>
          )}

          {/* Workflow Mapping — Step 2b, appears after user hits Continue on upload view */}
          {step2View === 'review' && (
            <div /* commented out outer box: className="rounded-lg border border-border-light bg-white" */>
              <div className="px-4 pt-4 pb-3">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-text">Workflow Mapping</div>
                    <div className="text-[11.5px] text-text-muted mt-0.5">
                      Auto-mapped {reviewCounts.mapped} of {reviewCounts.all} workflows. Review issues below, fix column mappings, or drop workflows from this run.
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] shrink-0 pt-0.5">
                    <Sparkles size={12} className="text-primary" />
                    <span className="text-primary font-medium">Auto-mapping complete</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 pb-3 border-b border-border-light">
                  {([
                    { key: 'all',       label: 'All',           dot: null,             count: reviewCounts.all },
                    { key: 'mapped',    label: 'Mapped',        dot: 'bg-[#047A48]',   count: reviewCounts.mapped },
                    { key: 'column',    label: 'Column Issues', dot: 'bg-mitigated',   count: reviewCounts.column },
                    { key: 'file',      label: 'File Issues',   dot: 'bg-risk',        count: reviewCounts.file },
                    { key: 'notmapped', label: 'Not Mapped',    dot: 'bg-text-muted',  count: reviewCounts.notmapped },
                    ...(reviewCounts.sql > 0
                      ? [{ key: 'sql' as const, label: 'SQL', dot: 'bg-[#047A48]', count: reviewCounts.sql }]
                      : []),
                    ...(reviewCounts.dropped > 0
                      ? [{ key: 'dropped' as const, label: 'Dropped', dot: 'bg-text', count: reviewCounts.dropped }]
                      : []),
                  ] as const).map(chip => {
                    const active = reviewFilter === chip.key;
                    return (
                      <button
                        key={chip.key}
                        type="button"
                        onClick={() => setReviewFilter(chip.key)}
                        className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full border text-[11.5px] font-medium transition-colors cursor-pointer ${
                          active
                            ? 'border-text bg-text text-white'
                            : 'border-border-light bg-white text-text-muted hover:border-border hover:text-text'
                        }`}
                      >
                        {chip.dot && <span className={`w-1.5 h-1.5 rounded-full ${chip.dot}`} />}
                        {chip.label}
                        <span className={`font-mono text-[10.5px] ${active ? 'opacity-70' : 'opacity-60'}`}>
                          {chip.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="px-4 pb-4 space-y-2">
                {filteredReviewWorkflows.length === 0 ? (
                  <div className="text-[12px] text-text-muted text-center py-12">
                    No workflows match this filter.
                  </div>
                ) : (
                  filteredReviewWorkflows.map(rw => {
                    const isExpanded = expandedReviewId === rw.id;
                    const isDropped = rw.status === 'dropped';
                    const hasMissing = rw.columns?.some(c => c.confidence === 'missing') ?? false;
                    return (
                      <div
                        key={rw.id}
                        className={`rounded-xl border overflow-hidden transition-colors ${
                          isDropped
                            ? 'border-border-light bg-surface-2/60 opacity-60'
                            : 'border-border-light bg-white hover:border-border'
                        }`}
                      >
                        <div className="flex items-center gap-3 px-4 py-3">
                          <div className="font-mono text-[11px] text-text-muted/70 w-16 shrink-0">{rw.code}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className={`text-[12.5px] font-medium truncate ${isDropped ? 'text-text-muted line-through' : 'text-text'}`}>
                                {rw.name}
                              </span>
                              <ReviewStatusChip status={rw.status} />
                            </div>
                            <div className="text-[11px] text-text-muted truncate">
                              {(rw.status === 'mapped' || rw.status === 'column') && rw.mappedFiles && rw.mappedFiles.length > 0 ? (
                                <span className="font-mono">{rw.mappedFiles.join(' · ')}</span>
                              ) : rw.status === 'file' ? (
                                <span className="text-risk">{rw.fileError}</span>
                              ) : rw.status === 'notmapped' ? (
                                <span>Missing: {(rw.missingFiles ?? []).join(', ')}</span>
                              ) : isDropped ? (
                                <span className="italic">Excluded from this run</span>
                              ) : null}
                            </div>
                            {rw.status === 'sql' && (
                              <label className="inline-flex items-center gap-1.5 text-[11.5px] text-text-muted cursor-pointer select-none mt-1.5">
                                <input
                                  type="checkbox"
                                  checked={!!rw.sqlUseDefaults}
                                  onChange={() => toggleSqlUseDefaults(rw.id)}
                                  style={{ accentColor: '#6a12cd' }}
                                  className="w-3.5 h-3.5 rounded cursor-pointer"
                                />
                                Use default configuration
                              </label>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {isDropped ? (
                              <ReviewActionButton variant="primary" onClick={() => restoreReviewWorkflow(rw.id)}>
                                Restore
                              </ReviewActionButton>
                            ) : rw.status === 'mapped' ? (
                              <ReviewIconButton onClick={() => dropReviewWorkflow(rw.id)} label="Drop" />
                            ) : rw.status === 'column' ? (
                              <>
                                <ReviewActionButton variant="primary" onClick={() => toggleReviewExpand(rw.id)}>
                                  {isExpanded ? 'Collapse' : hasMissing ? 'Fix Columns' : 'Review Columns'}
                                </ReviewActionButton>
                                <ReviewIconButton onClick={() => dropReviewWorkflow(rw.id)} label="Drop" />
                              </>
                            ) : rw.status === 'file' ? (
                              <>
                                <ReviewActionButton variant="primary" onClick={() => setStep2View('upload')}>
                                  Re-upload
                                </ReviewActionButton>
                                <ReviewIconButton onClick={() => dropReviewWorkflow(rw.id)} label="Drop" />
                              </>
                            ) : rw.status === 'notmapped' ? (
                              <>
                                <ReviewActionButton variant="primary" onClick={() => setStep2View('upload')}>
                                  Upload
                                </ReviewActionButton>
                                <ReviewIconButton onClick={() => dropReviewWorkflow(rw.id)} label="Drop" />
                              </>
                            ) : rw.status === 'sql' ? (
                              <>
                                <ReviewActionButton variant="primary" onClick={() => openConfigModal(rw.id)}>
                                  Edit Configuration
                                </ReviewActionButton>
                                <ReviewIconButton onClick={() => dropReviewWorkflow(rw.id)} label="Drop" />
                              </>
                            ) : null}
                          </div>
                        </div>

                        {isExpanded && rw.status === 'column' && rw.columns && (
                          <ReviewColumnMapper
                            columns={rw.columns}
                            onUpdate={(idx, value) => updateReviewColumn(rw.id, idx, value)}
                            onConfirm={() => confirmReviewColumns(rw.id)}
                          />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* NEW Workflow Mapping — commented out (user reverted to old design). Restore by uncommenting and gating old block off.
          {step2View_NEW === 'review' && (
            <div>
              <div className="px-4 pt-4 pb-3">
                <div className="flex items-center justify-between gap-3 mb-1">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="text-[13px] font-semibold text-text">Workflow Mapping</div>
                    <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-primary bg-primary/8 px-1.5 py-0.5 rounded-full">
                      <Sparkles size={10} />
                      Auto-mapping complete
                    </span>
                  </div>
                </div>
                <div className="text-[11.5px] text-text-muted mb-3">
                  Auto-mapped {reviewCounts.mapped} of {reviewCounts.all} · Review issues, fix mappings, or drop workflows.
                </div>

                <div className="flex flex-wrap gap-1.5 pb-3 border-b border-border-light">
                  {([
                    { key: 'all',       label: 'All',           dot: null,             count: reviewCounts.all },
                    { key: 'mapped',    label: 'Mapped',        dot: 'bg-compliant',   count: reviewCounts.mapped },
                    { key: 'column',    label: 'Column Issues', dot: 'bg-mitigated',   count: reviewCounts.column },
                    { key: 'file',      label: 'File Issues',   dot: 'bg-risk',        count: reviewCounts.file },
                    { key: 'notmapped', label: 'Not Mapped',    dot: 'bg-text-muted',  count: reviewCounts.notmapped },
                    ...(reviewCounts.sql > 0
                      ? [{ key: 'sql' as const, label: 'SQL', dot: 'bg-compliant', count: reviewCounts.sql }]
                      : []),
                    ...(reviewCounts.dropped > 0
                      ? [{ key: 'dropped' as const, label: 'Dropped', dot: 'bg-text', count: reviewCounts.dropped }]
                      : []),
                  ] as const).map(chip => {
                    const active = reviewFilter === chip.key;
                    return (
                      <button
                        key={chip.key}
                        type="button"
                        onClick={() => setReviewFilter(chip.key)}
                        className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full border text-[11px] font-medium transition-colors cursor-pointer ${
                          active
                            ? 'border-text bg-text text-white'
                            : 'border-border-light bg-white text-text-muted hover:border-border hover:text-text'
                        }`}
                      >
                        {chip.dot && <span className={`w-1.5 h-1.5 rounded-full ${chip.dot}`} />}
                        {chip.label}
                        <span className={`font-mono text-[10px] ${active ? 'opacity-70' : 'opacity-60'}`}>
                          {chip.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="px-4 pb-4">
                {filteredReviewWorkflows.length === 0 ? (
                  <div className="text-[12px] text-text-muted text-center py-12 rounded-xl border border-border-light bg-white">
                    No workflows match this filter.
                  </div>
                ) : (
                  <div className="rounded-xl border border-border-light bg-white overflow-hidden divide-y divide-border-light">
                    {filteredReviewWorkflows.map(rw => {
                      const isExpanded = expandedReviewId === rw.id;
                      const isDropped = rw.status === 'dropped';
                      const hasMissing = rw.columns?.some(c => c.confidence === 'missing') ?? false;
                      return (
                        <div
                          key={rw.id}
                          className={`transition-colors ${
                            isDropped ? 'bg-surface-2/60 opacity-60' : 'bg-white hover:bg-surface-2/40'
                          }`}
                        >
                          <div className="flex items-center gap-3 px-3.5 py-2.5">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                <span className="font-mono text-[10.5px] text-text-muted/70 shrink-0">{rw.code}</span>
                                <span className={`text-[12.5px] font-medium truncate ${isDropped ? 'text-text-muted line-through' : 'text-text'}`}>
                                  {rw.name}
                                </span>
                                <ReviewStatusChip status={rw.status} />
                              </div>
                              <div className="text-[11px] text-text-muted truncate">
                                {(rw.status === 'mapped' || rw.status === 'column') && rw.mappedFiles && rw.mappedFiles.length > 0 ? (
                                  <span className="font-mono">{rw.mappedFiles.join(' · ')}</span>
                                ) : rw.status === 'file' ? (
                                  <span className="text-risk">{rw.fileError}</span>
                                ) : rw.status === 'notmapped' ? (
                                  <span>Missing: {(rw.missingFiles ?? []).join(', ')}</span>
                                ) : isDropped ? (
                                  <span className="italic">Excluded from this run</span>
                                ) : rw.status === 'sql' ? (
                                  <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      checked={!!rw.sqlUseDefaults}
                                      onChange={() => toggleSqlUseDefaults(rw.id)}
                                      style={{ accentColor: '#6a12cd' }}
                                      className="w-3.5 h-3.5 rounded cursor-pointer"
                                    />
                                    Use default configuration
                                  </label>
                                ) : null}
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {isDropped ? (
                                <ReviewActionButton variant="primary" onClick={() => restoreReviewWorkflow(rw.id)}>
                                  Restore
                                </ReviewActionButton>
                              ) : rw.status === 'mapped' ? (
                                <ReviewIconButton onClick={() => dropReviewWorkflow(rw.id)} label="Drop" />
                              ) : rw.status === 'column' ? (
                                <>
                                  <ReviewActionButton variant="primary" onClick={() => toggleReviewExpand(rw.id)}>
                                    {isExpanded ? 'Collapse' : hasMissing ? 'Fix Columns' : 'Review Columns'}
                                  </ReviewActionButton>
                                  <ReviewIconButton onClick={() => dropReviewWorkflow(rw.id)} label="Drop" />
                                </>
                              ) : rw.status === 'file' ? (
                                <>
                                  <ReviewActionButton variant="primary" onClick={() => setStep2View('upload')}>
                                    Re-upload
                                  </ReviewActionButton>
                                  <ReviewIconButton onClick={() => dropReviewWorkflow(rw.id)} label="Drop" />
                                </>
                              ) : rw.status === 'notmapped' ? (
                                <>
                                  <ReviewActionButton variant="primary" onClick={() => setStep2View('upload')}>
                                    Upload
                                  </ReviewActionButton>
                                  <ReviewIconButton onClick={() => dropReviewWorkflow(rw.id)} label="Drop" />
                                </>
                              ) : rw.status === 'sql' ? (
                                <>
                                  <ReviewActionButton variant="primary" onClick={() => openConfigModal(rw.id)}>
                                    Edit Configuration
                                  </ReviewActionButton>
                                  <ReviewIconButton onClick={() => dropReviewWorkflow(rw.id)} label="Drop" />
                                </>
                              ) : null}
                            </div>
                          </div>

                          {isExpanded && rw.status === 'column' && rw.columns && (
                            <ReviewColumnMapper
                              columns={rw.columns}
                              onUpdate={(idx, value) => updateReviewColumn(rw.id, idx, value)}
                              onConfirm={() => confirmReviewColumns(rw.id)}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
          end of NEW Workflow Mapping commented-out block */}
        </div>

        {/* Footer — Step 2 */}
        <div className="px-6 py-4 border-t border-border-light flex items-center justify-between shrink-0">
          <button
            onClick={() => {
              if (step2View === 'review') setStep2View('upload');
              else setStep(1);
            }}
            className="px-4 h-9 rounded-md bg-white text-text border border-border text-[13px] font-semibold hover:bg-surface-2 transition-colors cursor-pointer"
          >
            Back
          </button>
          {step2View === 'upload' ? (
            <button
              onClick={() => {
                if (!hasUpload) {
                  addToast({
                    type: 'error',
                    message: 'Upload files or link an existing data source before continuing.',
                  });
                  return;
                }
                setStep2View('review');
              }}
              aria-disabled={!hasUpload}
              className={`flex items-center gap-2 px-4 h-9 rounded-md text-white text-[13px] font-semibold transition-colors ${
                hasUpload
                  ? 'bg-primary hover:bg-primary-hover cursor-pointer'
                  : 'bg-primary/40 cursor-not-allowed'
              }`}
            >
              Continue
              <ArrowRight size={14} />
            </button>
          ) : (
            <button
              onClick={handleStep2Continue}
              aria-disabled={!step2CanContinue}
              className={`flex items-center gap-2 px-4 h-9 rounded-md text-white text-[13px] font-semibold transition-colors ${
                step2CanContinue
                  ? 'bg-primary hover:bg-primary-hover cursor-pointer'
                  : 'bg-primary/40 cursor-not-allowed'
              }`}
            >
              Continue
              <ArrowRight size={14} />
            </button>
          )}
        </div>
        </>
        ) : (
        <Step3ReviewExecute
          auditName={auditName}
          reviewWorkflows={reviewWorkflows}
          uploadedCount={uploadedFiles.length}
          onBack={() => { setStep(2); setStep2View('review'); }}
          onExecute={handleStep3Execute}
        />
        )}
      </motion.div>

      {/* SQL Configuration Details modal — layered above the bulk execute modal */}
      {configModalWorkflowId && (() => {
        const wf = reviewWorkflows.find(rw => rw.id === configModalWorkflowId);
        if (!wf || !wf.sqlFields) return null;
        return (
          <SqlConfigModal
            workflow={wf}
            draft={configDraft}
            onChange={(key, value) => setConfigDraft(prev => ({ ...prev, [key]: value }))}
            onCancel={closeConfigModal}
            onSave={saveConfigModal}
          />
        );
      })()}
    </motion.div>
  );
}

// ─── Loader while "backend" fetches common required files ───
function FetchingFilesLoader({ workflowCount }: { workflowCount: number }) {
  const steps = [
    'Scanning selected workflows',
    'Identifying common required files',
    'Preparing configuration',
  ];
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setStepIdx(prev => Math.min(prev + 1, steps.length - 1));
    }, 650);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 py-16">
      <div className="relative w-14 h-14 mb-5">
        <span className="absolute inset-0 rounded-full bg-primary/10" />
        <span className="absolute inset-0 flex items-center justify-center">
          <Loader2 size={28} className="text-primary animate-spin" />
        </span>
      </div>
      <div className="text-[15px] font-semibold text-text mb-1.5">Fetching required files</div>
      <div className="text-[13px] text-text-secondary mb-6 text-center max-w-[380px]">
        Identifying the data sources and files common to your {workflowCount} selected workflow{workflowCount === 1 ? '' : 's'}.
      </div>
      <div className="w-full max-w-[360px] space-y-2">
        {steps.map((s, i) => {
          const done = i < stepIdx;
          const active = i === stepIdx;
          return (
            <div key={s} className="flex items-center gap-2.5 text-[12.5px]">
              <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                done ? 'bg-primary text-white' : active ? 'bg-primary/15 text-primary' : 'bg-surface-2 text-text-muted'
              }`}>
                {done ? <Check size={10} strokeWidth={3} /> : active ? <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" /> : null}
              </div>
              <span className={done ? 'text-text' : active ? 'text-text font-medium' : 'text-text-muted'}>
                {s}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function UploadedFilesPanel({
  files,
  selectedIds,
  allSelected,
  onToggleAll,
  onToggleOne,
  onRemove,
  onUploadMore,
  onChooseExisting,
}: {
  files: UploadedFile[];
  selectedIds: Set<string>;
  allSelected: boolean;
  onToggleAll: () => void;
  onToggleOne: (id: string) => void;
  onRemove: (id: string) => void;
  onUploadMore: () => void;
  onChooseExisting: () => void;
}) {
  const failed = files.filter(u => u.error).length;
  const someSelected = selectedIds.size > 0 && !allSelected;
  return (
    <div className="rounded-lg border border-border-light bg-white">
      <div className="flex items-center gap-3 px-3 py-2.5 border-b border-border-light">
        <button
          type="button"
          onClick={onToggleAll}
          aria-label={allSelected ? 'Deselect all files' : 'Select all files'}
          className="flex items-center gap-0.5 rounded-md border border-border-light px-1.5 py-1 hover:border-primary/40 hover:bg-surface-2 transition-colors cursor-pointer"
        >
          <span className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
            allSelected
              ? 'border-primary bg-primary text-white'
              : someSelected
                ? 'border-primary bg-primary/20 text-primary'
                : 'border-border bg-white text-transparent'
          }`}>
            {allSelected
              ? <Check size={11} strokeWidth={3} />
              : someSelected
                ? <span className="w-1.5 h-0.5 rounded-sm bg-primary" />
                : <Check size={11} strokeWidth={3} />}
          </span>
          <ChevronDown size={12} className="text-text-muted" />
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-[13px] font-semibold text-text">Files Uploaded</span>
          {failed > 0 && (
            <div className="flex items-center gap-1 text-[11.5px] text-risk min-w-0">
              <AlertTriangle size={12} className="shrink-0" />
              <span className="truncate">
                {failed} of {files.length} file{files.length === 1 ? '' : 's'} failed - delete or resolve to continue
              </span>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onUploadMore}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary text-white text-[12px] font-semibold hover:bg-primary/90 transition-colors cursor-pointer"
        >
          <Upload size={13} />
          Upload
        </button>
        <button
          type="button"
          onClick={onChooseExisting}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-primary/40 text-primary bg-white text-[12px] font-semibold hover:bg-primary/5 transition-colors cursor-pointer"
        >
          <Database size={13} />
          Choose Existing
        </button>
      </div>
      <div className="divide-y divide-border-light">
        {files.map(u => {
          const isSelected = selectedIds.has(u.id);
          return (
            <div key={u.id} className="flex items-center gap-3 px-3 py-2.5">
              <button
                type="button"
                role="checkbox"
                aria-checked={isSelected}
                onClick={() => onToggleOne(u.id)}
                aria-label={isSelected ? `Deselect ${u.name}` : `Select ${u.name}`}
                className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                  isSelected ? 'border-primary bg-primary text-white' : 'border-border bg-white text-transparent hover:border-primary/40'
                }`}
              >
                <Check size={11} strokeWidth={3} />
              </button>
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-semibold text-text truncate">{u.name}</div>
                <div className="text-[11px] text-text-muted">{humanSize(u.size)}</div>
              </div>
              {u.error && (
                <div className="flex items-center gap-1.5 text-[11.5px] text-risk shrink-0">
                  <AlertTriangle size={12} />
                  <span>{u.error}</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => onRemove(u.id)}
                aria-label={`Remove ${u.name}`}
                className="p-1 text-text-muted hover:text-risk transition-colors cursor-pointer shrink-0"
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReviewStatusChip({ status }: { status: ReviewWorkflowStatus }) {
  const base = 'inline-flex items-center gap-1 px-2 h-5 rounded-full text-[10.5px] font-medium tracking-wide shrink-0 border';
  switch (status) {
    case 'mapped':
      return (
        <span className={`${base} border-transparent`} style={{ backgroundColor: '#ECFEF3', color: '#047A48' }}>
          <Check size={10} strokeWidth={3} />
          Mapped
        </span>
      );
    case 'column':
      return (
        <span className={`${base} bg-mitigated-50 text-mitigated-700 border-mitigated/30`}>
          <AlertTriangle size={10} strokeWidth={2.5} />
          Column Mismatch
        </span>
      );
    case 'file':
      return (
        <span className={`${base} bg-risk/10 text-risk border-risk/30`}>
          <X size={10} strokeWidth={2.5} />
          File Mismatch
        </span>
      );
    case 'notmapped':
      return (
        <span className={`${base} bg-surface-2 text-text-muted border-border-light`}>
          <Minus size={10} strokeWidth={2.5} />
          Not Mapped
        </span>
      );
    case 'sql':
      return (
        <span className={`${base} border-transparent`} style={{ backgroundColor: '#ECFEF3', color: '#047A48' }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#047A48' }} />
          SQL
        </span>
      );
    case 'dropped':
      return (
        <span className={`${base} bg-text text-white border-text`}>
          Dropped from run
        </span>
      );
  }
}

function ReviewActionButton({
  variant,
  onClick,
  children,
}: {
  variant: 'primary' | 'danger';
  onClick: () => void;
  children: React.ReactNode;
}) {
  const cls =
    variant === 'primary'
      ? 'border-primary/25 text-primary bg-white hover:bg-primary/5'
      : 'border-border-light text-text-muted bg-white hover:text-risk hover:border-risk/30 hover:bg-risk/5';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center px-2.5 h-7 rounded-md border text-[11.5px] font-medium transition-colors cursor-pointer ${cls}`}
    >
      {children}
    </button>
  );
}

function ReviewIconButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-border-light text-text-muted bg-white hover:text-risk hover:border-risk/30 hover:bg-risk/5 transition-colors cursor-pointer"
    >
      <Trash2 size={13} />
    </button>
  );
}

function ReviewColumnMapper({
  columns,
  onUpdate,
  onConfirm,
}: {
  columns: ColumnMapping[];
  onUpdate: (idx: number, value: string) => void;
  onConfirm: () => void;
}) {
  const resolved = columns.filter(c => c.confidence !== 'missing').length;
  const missingCount = columns.length - resolved;
  const allResolved = missingCount === 0;
  return (
    <div className="border-t border-dashed border-border-light bg-surface-2/40 px-4 py-3.5">
      <div className="flex items-start justify-between mb-3 gap-3">
        <div className="min-w-0">
          <div className="text-[11.5px] font-semibold text-text">Column Mapping</div>
          <div className="text-[10.5px] text-text-muted mt-0.5">
            Map required schema columns to columns found in uploaded file. Fuzzy matches are auto-applied — verify or override.
          </div>
        </div>
        <div className="text-[10.5px] font-mono text-text-muted shrink-0">
          {resolved}/{columns.length} resolved
        </div>
      </div>

      <div className="rounded-lg border border-border-light bg-white p-3">
        <div className="grid grid-cols-[1fr_18px_1fr_60px] gap-3 text-[9.5px] uppercase tracking-wider text-text-muted/80 font-semibold pb-1.5 border-b border-border-light">
          <div>Required Column</div>
          <div></div>
          <div>Source Column</div>
          <div className="text-right">Match</div>
        </div>
        {columns.map((c, idx) => (
          <div
            key={`${c.required}-${idx}`}
            className="grid grid-cols-[1fr_18px_1fr_60px] gap-3 items-center py-2 border-b border-border-light/60 last:border-b-0"
          >
            <div className="text-[12px] font-mono text-text truncate">{c.required}</div>
            <ArrowRight size={12} className="text-text-muted/50" />
            <select
              value={c.matched ?? ''}
              onChange={e => onUpdate(idx, e.target.value)}
              className={`min-w-0 px-2 h-7 rounded-md border text-[11.5px] font-mono outline-none transition-colors cursor-pointer ${
                c.confidence === 'missing'
                  ? 'border-risk/40 bg-risk/5 text-risk'
                  : 'border-border-light bg-white text-text focus:border-primary/40 focus:ring-2 focus:ring-primary/10'
              }`}
            >
              {c.confidence === 'missing' && <option value="">— Select column —</option>}
              {AVAILABLE_COLUMNS.map(ac => (
                <option key={ac} value={ac}>{ac}</option>
              ))}
            </select>
            <div className="flex justify-end">
              {c.confidence === 'exact' && (
                <span className="inline-flex items-center px-1.5 h-5 rounded text-[9.5px] font-medium bg-compliant-50 text-compliant-700 border border-compliant/25">
                  exact
                </span>
              )}
              {c.confidence === 'fuzzy' && (
                <span className="inline-flex items-center px-1.5 h-5 rounded text-[9.5px] font-medium bg-mitigated-50 text-mitigated-700 border border-mitigated/30">
                  fuzzy
                </span>
              )}
              {c.confidence === 'missing' && (
                <span className="inline-flex items-center px-1.5 h-5 rounded text-[9.5px] font-medium bg-risk/10 text-risk border border-risk/30">
                  missing
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mt-3 gap-3">
        <div className="text-[10.5px] flex items-center gap-1.5 min-w-0">
          {allResolved ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-compliant" />
              <span className="text-text-muted">All required columns mapped — workflow will run with overrides</span>
            </>
          ) : (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-risk" />
              <span className="text-text-muted">
                {missingCount} column{missingCount === 1 ? '' : 's'} still need mapping to proceed
              </span>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!allResolved}
          className={`inline-flex items-center px-2.5 h-7 rounded-md border text-[11.5px] font-medium transition-colors shrink-0 ${
            allResolved
              ? 'border-primary/25 text-primary bg-white hover:bg-primary/5 cursor-pointer'
              : 'border-border-light text-text-muted/50 bg-white cursor-not-allowed'
          }`}
        >
          {allResolved ? 'Confirm Mapping' : 'Apply & Close'}
        </button>
      </div>
    </div>
  );
}

function Step3ReviewExecute({
  auditName,
  reviewWorkflows,
  uploadedCount,
  onBack,
  onExecute,
}: {
  auditName: string;
  reviewWorkflows: ReviewWorkflow[];
  uploadedCount: number;
  onBack: () => void;
  onExecute: () => void;
}) {
  const active = reviewWorkflows.filter(rw =>
    rw.status === 'mapped' ||
    rw.status === 'column' ||
    (rw.status === 'sql' && (rw.sqlUseDefaults || rw.sqlCustomValues))
  );
  const skipped = reviewWorkflows.filter(rw =>
    rw.status === 'dropped' ||
    rw.status === 'file' ||
    rw.status === 'notmapped' ||
    (rw.status === 'sql' && !rw.sqlUseDefaults && !rw.sqlCustomValues)
  );
  const totalRuntime = active.reduce((s, w) => s + w.runtime, 0);
  const maxRuntime = active.reduce((m, w) => Math.max(m, w.runtime), 0);
  const estRuntime = active.length > 0 ? maxRuntime + totalRuntime / 3 : 0;
  const overrides = reviewWorkflows.filter(rw => rw.hasOverrides && rw.status !== 'dropped');
  const today = new Date().toISOString().slice(0, 10);
  const reportName = `${auditName.trim() || 'BulkRun'}_${today}_BulkReport`;

  const skipReason = (rw: ReviewWorkflow) => {
    if (rw.status === 'dropped') return 'Dropped by user';
    if (rw.status === 'file') return 'File schema mismatch';
    if (rw.status === 'notmapped') return 'No file mapped';
    if (rw.status === 'sql') return 'Configuration required';
    return '';
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="mb-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[10.5px] font-semibold uppercase tracking-wider text-primary mb-1">Final Review</div>
              <h3 className="text-[16px] font-semibold text-text">
                Ready to execute <span className="text-primary font-mono">{auditName.trim() || 'BulkRun'}</span>
              </h3>
            </div>
            <div className="text-[11.5px] text-text-muted shrink-0 pt-1 whitespace-nowrap">
              Ready · {active.length} workflow{active.length === 1 ? '' : 's'} · ~{estRuntime.toFixed(1)} min
            </div>
          </div>
          <p className="text-[12px] text-text-muted mt-1">
            Review the run summary below. Once executed, audit trail will be locked and results will be available in your engagement dashboard.
          </p>
        </div>

        <div className="grid grid-cols-4 gap-3 mb-4">
          <Step3StatCard label="Workflows Running" value={String(active.length)} />
          <Step3StatCard label="Source Files" value={String(uploadedCount)} />
          <Step3StatCard label="Est. Runtime" value={`~${estRuntime.toFixed(1)}`} suffix="min" />
          <Step3StatCard label="Skipped / Dropped" value={String(skipped.length)} muted={skipped.length > 0} />
        </div>

        <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 mb-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary text-white flex items-center justify-center shrink-0">
            <FileText size={15} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-medium text-text-muted">Final Report</div>
            <div className="font-mono text-[13px] text-primary font-semibold truncate">{reportName}.xlsx</div>
            <div className="text-[11px] text-text-muted mt-0.5 truncate">
              Consolidated report with per-workflow sheets · exceptions flagged · linked back to RACM controls
            </div>
          </div>
          <button
            type="button"
            className="inline-flex items-center px-2.5 h-7 rounded-md border border-border-light bg-white text-[11.5px] font-medium text-text hover:bg-surface-2 transition-colors cursor-pointer shrink-0"
          >
            Rename
          </button>
        </div>

        {overrides.length > 0 && (
          <details className="mb-4 rounded-xl overflow-hidden border border-mitigated/30 bg-mitigated-50">
            <summary className="cursor-pointer p-3 flex items-center gap-2 text-[12px] font-medium text-mitigated-700">
              <AlertTriangle size={13} />
              <span className="flex-1">
                {overrides.length} workflow{overrides.length > 1 ? 's have' : ' has'} column overrides applied
              </span>
              <ChevronDown size={13} />
            </summary>
            <div className="px-3 pb-3 space-y-2 bg-white">
              {overrides.map(w => (
                <div key={w.id} className="pt-2.5 border-t border-border-light first:border-t-0">
                  <div className="text-[12.5px] font-medium text-text mb-1.5">
                    {w.name}
                    <span className="font-mono text-[10.5px] text-text-muted ml-1.5">{w.code}</span>
                  </div>
                  <div className="space-y-0.5">
                    {(w.columns ?? []).filter(c => c.confidence !== 'missing').map((c, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-[11px] font-mono">
                        <span className="text-text w-40 truncate">{c.required}</span>
                        <ArrowRight size={10} className="text-text-muted/60 shrink-0" />
                        <span className="text-primary truncate">{c.matched}</span>
                        <span className={`ml-auto inline-flex items-center px-1.5 h-4 rounded text-[9.5px] font-medium border ${
                          c.confidence === 'fuzzy'
                            ? 'bg-mitigated-50 text-mitigated-700 border-mitigated/30'
                            : 'bg-compliant-50 text-compliant-700 border-compliant/25'
                        }`}>
                          {c.confidence}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}

        <div className="mb-4">
          <div className="text-[10.5px] font-semibold uppercase tracking-wider text-text-muted mb-2">
            Running ({active.length})
          </div>
          <div className="rounded-xl border border-border-light bg-white divide-y divide-border-light overflow-hidden">
            {active.map(w => (
              <div key={w.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-compliant shrink-0" />
                <div className="font-mono text-[11px] text-text-muted/70 w-16 shrink-0">{w.code}</div>
                <div className="flex-1 text-[12.5px] text-text truncate">{w.name}</div>
                {w.hasOverrides && (
                  <span className="inline-flex items-center px-1.5 h-5 rounded text-[9.5px] font-medium bg-mitigated-50 text-mitigated-700 border border-mitigated/30 shrink-0">
                    overrides
                  </span>
                )}
                <div className="text-[11px] text-text-muted font-mono w-16 text-right shrink-0">~{w.runtime.toFixed(1)} min</div>
              </div>
            ))}
          </div>
        </div>

        {skipped.length > 0 && (
          <div>
            <div className="text-[10.5px] font-semibold uppercase tracking-wider text-text-muted mb-2">
              Skipped ({skipped.length})
            </div>
            <div className="rounded-xl border border-border-light bg-surface-2/40 divide-y divide-border-light/60 overflow-hidden">
              {skipped.map(w => (
                <div key={w.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-text-muted/60 shrink-0" />
                  <div className="font-mono text-[11px] text-text-muted/70 w-16 shrink-0">{w.code}</div>
                  <div className="flex-1 text-[12.5px] text-text-muted line-through truncate">{w.name}</div>
                  <div className="text-[11px] text-text-muted italic shrink-0">{skipReason(w)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="px-6 py-4 border-t border-border-light flex items-center justify-between shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="px-4 h-9 rounded-md bg-white text-text border border-border text-[13px] font-semibold hover:bg-surface-2 transition-colors cursor-pointer"
        >
          Back
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onExecute}
            disabled={active.length === 0}
            className={`flex items-center gap-2 px-4 h-9 rounded-md text-white text-[13px] font-semibold transition-colors ${
              active.length > 0 ? 'bg-primary hover:bg-primary-hover cursor-pointer' : 'bg-primary/40 cursor-not-allowed'
            }`}
          >
            Execute Bulk Run
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </>
  );
}

function Step3StatCard({
  label,
  value,
  suffix,
  muted,
}: {
  label: string;
  value: string;
  suffix?: string;
  muted?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border-light bg-white p-4">
      <div className={`font-mono text-[26px] font-medium leading-none tracking-tight ${muted ? 'text-text-muted' : 'text-text'}`}>
        {value}
        {suffix && <span className="text-[13px] text-text-muted ml-1 font-medium">{suffix}</span>}
      </div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mt-2">{label}</div>
    </div>
  );
}

function SqlConfigModal({
  workflow,
  draft,
  onChange,
  onCancel,
  onSave,
}: {
  workflow: ReviewWorkflow;
  draft: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const fields = workflow.sqlFields ?? [];
  // Pair consecutive date fields into a 2-column row
  const rows: { fields: SqlConfigField[] }[] = [];
  let i = 0;
  while (i < fields.length) {
    const f = fields[i];
    const next = fields[i + 1];
    if (f.type === 'date' && next?.type === 'date') {
      rows.push({ fields: [f, next] });
      i += 2;
    } else {
      rows.push({ fields: [f] });
      i += 1;
    }
  }

  const allRequiredFilled = fields
    .filter(f => f.required)
    .every(f => (draft[f.key] ?? '').trim() !== '');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center"
      onClick={onCancel}
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ duration: 0.18 }}
        role="dialog"
        aria-modal="true"
        aria-label="Configuration Details"
        className="relative bg-white rounded-2xl shadow-2xl w-[640px] max-h-[85vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border-light flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Clock size={15} className="text-primary" />
            </div>
            <h3 className="text-[16px] font-semibold text-text">Configuration Details</h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 hover:bg-surface-2 rounded-md transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={16} className="text-text-muted" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <div className="text-[11.5px] text-text-muted">
            <span className="font-mono">{workflow.code}</span> · {workflow.name}
          </div>
          {rows.map((row, rIdx) => (
            <div
              key={rIdx}
              className={row.fields.length === 2 ? 'grid grid-cols-2 gap-4' : ''}
            >
              {row.fields.map(f => (
                <SqlConfigInput
                  key={f.key}
                  field={f}
                  value={draft[f.key] ?? ''}
                  onChange={value => onChange(f.key, value)}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border-light bg-surface-2/40 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 h-9 rounded-md bg-white text-text border border-border text-[13px] font-semibold hover:bg-surface-2 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!allRequiredFilled}
            className={`px-4 h-9 rounded-md text-white text-[13px] font-semibold transition-colors ${
              allRequiredFilled
                ? 'bg-primary hover:bg-primary-hover cursor-pointer'
                : 'bg-primary/40 cursor-not-allowed'
            }`}
          >
            Save Changes
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function SqlConfigInput({
  field,
  value,
  onChange,
}: {
  field: SqlConfigField;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="block text-[12px] font-semibold text-text mb-1.5">
        {field.label}
        {field.required && <span className="text-risk ml-0.5">*</span>}
      </label>
      {field.type === 'date' ? (
        <CustomDatePicker value={value} onChange={onChange} />
      ) : (
        <input
          type={field.type === 'number' ? 'number' : 'text'}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full px-3 py-2.5 rounded-md border border-border-light text-[13px] text-text bg-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
        />
      )}
    </div>
  );
}

// Custom date picker that matches the app's design tokens.
// `value` and `onChange` use ISO format (YYYY-MM-DD) so it stays compatible with native input behavior.
function CustomDatePicker({
  value,
  onChange,
  placeholder = 'dd/mm/yyyy',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const today = new Date();
  const parsed = value ? new Date(value + 'T00:00:00') : null;
  const [viewYear, setViewYear] = useState(parsed ? parsed.getFullYear() : today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed ? parsed.getMonth() : today.getMonth());

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const formatDisplay = (d: Date) => {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };
  const toISO = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const monthName = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Build 6-week grid starting Sunday
  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const startWeekday = firstOfMonth.getDay(); // 0=Sun
  const gridStart = new Date(viewYear, viewMonth, 1 - startWeekday);
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push(d);
  }

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else setViewMonth(m => m - 1);
  };
  const goNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else setViewMonth(m => m + 1);
  };
  const selectDate = (d: Date) => {
    onChange(toISO(d));
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setOpen(false);
  };
  const goToday = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    selectDate(today);
  };
  const clearDate = () => {
    onChange('');
    setOpen(false);
  };

  const isSameDay = (a: Date, b: Date | null) =>
    !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-md border border-border-light bg-white text-[13px] text-text hover:border-primary/30 focus:border-primary/40 focus:ring-2 focus:ring-primary/10 outline-none transition-all cursor-pointer"
      >
        <span className={parsed ? 'text-text' : 'text-text-muted/70'}>
          {parsed ? formatDisplay(parsed) : placeholder}
        </span>
        <Calendar size={14} className="text-text-muted shrink-0" />
      </button>

      {open && (
        <div className="absolute left-0 bottom-full mb-1.5 z-30 w-[300px] rounded-lg border border-border-light bg-white shadow-lg p-3">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="text-[13px] font-semibold text-text">{monthName}</div>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={goPrevMonth}
                className="w-7 h-7 rounded-md hover:bg-surface-2 flex items-center justify-center text-text-muted hover:text-text cursor-pointer transition-colors"
                aria-label="Previous month"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                onClick={goNextMonth}
                className="w-7 h-7 rounded-md hover:bg-surface-2 flex items-center justify-center text-text-muted hover:text-text cursor-pointer transition-colors"
                aria-label="Next month"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {/* Weekday header */}
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <div key={i} className="h-7 flex items-center justify-center text-[11px] font-semibold text-text-muted">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((d, i) => {
              const inMonth = d.getMonth() === viewMonth;
              const isToday = isSameDay(d, today);
              const isSelected = isSameDay(d, parsed);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => selectDate(d)}
                  className={`h-8 rounded-md text-[12px] font-medium transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-primary text-white hover:bg-primary-hover'
                      : isToday
                        ? 'border border-primary text-primary hover:bg-primary/5'
                        : inMonth
                          ? 'text-text hover:bg-surface-2'
                          : 'text-text-muted/40 hover:bg-surface-2'
                  }`}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border-light">
            <button
              type="button"
              onClick={clearDate}
              className="text-[12px] font-semibold text-primary hover:text-primary-hover cursor-pointer"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={goToday}
              className="text-[12px] font-semibold text-primary hover:text-primary-hover cursor-pointer"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
