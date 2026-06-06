import { useState } from 'react';
import DatePicker from '../shared/DatePicker';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Calendar,
  SlidersHorizontal, Database, Bell,
  ExternalLink, MessageSquare, Clock, History, User, AlertTriangle, RotateCcw, Loader2,
  DollarSign, Type, Plus, Minus, ChevronDown, ChevronRight, Sparkles,
  Package, Coins, CircleDot, Sigma, Pencil, Search, X as XIcon, Check, Tag
} from 'lucide-react';
import { WORKFLOWS } from '../../data/mockData';
import { LIBRARY_WORKFLOWS } from './WorkflowLibraryView';
import { useToast } from '../shared/Toast';

type StepType = 'INGESTION' | 'TRANSFORM' | 'COMPARISON' | 'VALIDATION' | 'SCORING' | 'ACTION';

type DatasetColumn = { name: string; type: string };
type StepDataset = { name: string; columns: DatasetColumn[] };
type StepMeta = { type: StepType; desc: string; datasets: StepDataset[] };

const TYPE_BADGE: Record<StepType, string> = {
  INGESTION: 'bg-primary-xlight text-primary',
  TRANSFORM: 'bg-indigo-50 text-indigo-700',
  COMPARISON: 'bg-compliant-50 text-compliant-700',
  VALIDATION: 'bg-blue-50 text-blue-700',
  SCORING: 'bg-amber-50 text-amber-700',
  ACTION: 'bg-mitigated-50 text-mitigated-700',
};

const DATASET_LIBRARY: Record<string, StepDataset> = {
  invoices: { name: 'Invoices', columns: [
    { name: 'invoice_id', type: 'string' },
    { name: 'vendor_id', type: 'string' },
    { name: 'amount', type: 'currency' },
    { name: 'invoice_date', type: 'date' },
    { name: 'po_reference', type: 'string' },
  ] },
  vendors: { name: 'Vendor Master', columns: [
    { name: 'vendor_id', type: 'string' },
    { name: 'name', type: 'string' },
    { name: 'tax_id', type: 'string' },
    { name: 'bank_account', type: 'string' },
    { name: 'risk_class', type: 'enum' },
  ] },
  contracts: { name: 'Contracts Register', columns: [
    { name: 'contract_id', type: 'string' },
    { name: 'vendor_id', type: 'string' },
    { name: 'cap_amount', type: 'currency' },
    { name: 'scope', type: 'string' },
    { name: 'end_date', type: 'date' },
  ] },
  pos: { name: 'Purchase Orders', columns: [
    { name: 'po_number', type: 'string' },
    { name: 'vendor_id', type: 'string' },
    { name: 'line_amount', type: 'currency' },
    { name: 'gl_account', type: 'string' },
    { name: 'po_date', type: 'date' },
  ] },
  grn: { name: 'Goods Receipts', columns: [
    { name: 'grn_id', type: 'string' },
    { name: 'po_number', type: 'string' },
    { name: 'received_qty', type: 'number' },
    { name: 'received_date', type: 'date' },
  ] },
  payments: { name: 'Payment Queue', columns: [
    { name: 'payment_id', type: 'string' },
    { name: 'amount', type: 'currency' },
    { name: 'vendor_id', type: 'string' },
    { name: 'status', type: 'enum' },
  ] },
  journals: { name: 'Journal Entries', columns: [
    { name: 'entry_id', type: 'string' },
    { name: 'gl_account', type: 'string' },
    { name: 'amount', type: 'currency' },
    { name: 'posted_by', type: 'string' },
    { name: 'posted_at', type: 'datetime' },
  ] },
  audit: { name: 'Audit Log', columns: [
    { name: 'event_id', type: 'string' },
    { name: 'entity_type', type: 'string' },
    { name: 'changed_by', type: 'string' },
    { name: 'changed_at', type: 'datetime' },
    { name: 'change_kind', type: 'enum' },
  ] },
  roles: { name: 'Role Matrix', columns: [
    { name: 'role_id', type: 'string' },
    { name: 'user_id', type: 'string' },
    { name: 'permission_set', type: 'array' },
    { name: 'sod_class', type: 'enum' },
  ] },
  revenue: { name: 'Revenue Entries', columns: [
    { name: 'recognition_id', type: 'string' },
    { name: 'contract_id', type: 'string' },
    { name: 'amount', type: 'currency' },
    { name: 'recognition_date', type: 'date' },
    { name: 'asc606_criteria', type: 'enum' },
  ] },
  authorization: { name: 'Authorization Policies', columns: [
    { name: 'policy_id', type: 'string' },
    { name: 'entity_type', type: 'string' },
    { name: 'required_role', type: 'string' },
    { name: 'threshold_amount', type: 'currency' },
  ] },
};

function deriveStepMeta(step: string): StepMeta {
  const s = step.toLowerCase();
  const datasets: StepDataset[] = [];
  const seen = new Set<string>();
  const add = (key: keyof typeof DATASET_LIBRARY) => {
    const d = DATASET_LIBRARY[key];
    if (!seen.has(d.name)) { datasets.push(d); seen.add(d.name); }
  };
  if (/(invoice|ap )/.test(s)) add('invoices');
  if (/vendor/.test(s)) add('vendors');
  if (/contract/.test(s)) add('contracts');
  if (/(\bpo\b|purchase|po reference)/.test(s)) add('pos');
  if (/(grn|goods receipt|3-way|three.way)/.test(s)) add('grn');
  if (/payment/.test(s)) add('payments');
  if (/(journal|gl entry|entries)/.test(s)) add('journals');
  if (/(audit|change event|change type|log )/.test(s)) add('audit');
  if (/(role|permission|sod)/.test(s)) add('roles');
  if (/(revenue|asc 606|recognition)/.test(s)) add('revenue');
  if (/(authoriz|approve|approval)/.test(s)) add('authorization');
  if (datasets.length === 0) add('audit');

  let type: StepType = 'TRANSFORM';
  if (/(ingest|collect|fetch|scan|listen|monitor|extract|load|parse)/.test(s)) type = 'INGESTION';
  else if (/(match|reconcile|join|fuzzy|three.way|3-way)/.test(s)) type = 'COMPARISON';
  else if (/(validate|check|verify|calculate|apply.*(rule|threshold|criteria))/.test(s)) type = 'VALIDATION';
  else if (/(score|anomaly|model|assess)/.test(s)) type = 'SCORING';
  else if (/(flag|alert|notify|route|release|hold|generate.*(report|alert)|escalate|approve|emit|log)/.test(s)) type = 'ACTION';
  else if (/(normalize|classify|map|feature|enrich|transform)/.test(s)) type = 'TRANSFORM';

  const dsList = datasets.map(d => d.name).join(', ');
  let desc = '';
  switch (type) {
    case 'INGESTION': desc = `Reads source records from ${dsList} into the run.`; break;
    case 'TRANSFORM': desc = `Normalizes ${dsList} for downstream processing.`; break;
    case 'COMPARISON': desc = `Joins ${dsList} to identify matches and discrepancies.`; break;
    case 'VALIDATION': desc = `Validates rows from ${dsList} against configured rules.`; break;
    case 'SCORING': desc = `Scores records from ${dsList} using the configured model.`; break;
    case 'ACTION': desc = `Emits flags or notifications based on findings from ${dsList}.`; break;
  }
  return { type, desc, datasets };
}

interface Props {
  workflowId: string;
  onBack: () => void;
  onOpenExecutor?: () => void;
  onEditInChat?: () => void;
  onViewVersionHistory?: () => void;
  /** Which tab to land on. Defaults to 'overview'. */
  initialTab?: TabId;
}

const RUN_HISTORY = [
  { id: '#12', date: 'Mar 20, 2026', trigger: 'Scheduled', duration: '1.8s', flags: 3, score: 95, status: 'ok' },
  { id: '#11', date: 'Mar 19, 2026', trigger: 'Scheduled', duration: '2.1s', flags: 1, score: 92, status: 'ok' },
  { id: '#10', date: 'Mar 18, 2026', trigger: 'Manual', duration: '1.6s', flags: 5, score: 88, status: 'ok' },
  { id: '#9', date: 'Mar 17, 2026', trigger: 'Scheduled', duration: '2.4s', flags: 0, score: 90, status: 'ok' },
  { id: '#8', date: 'Mar 16, 2026', trigger: 'Scheduled', duration: '3.2s', flags: 8, score: 72, status: 'warn' },
  { id: '#7', date: 'Mar 15, 2026', trigger: 'Manual', duration: '1.9s', flags: 2, score: 85, status: 'ok' },
  { id: '#6', date: 'Mar 14, 2026', trigger: 'Scheduled', duration: '2.0s', flags: 4, score: 80, status: 'ok' },
];

const DEFAULT_STEPS = [
  'Listen to change events',
  'Classify change type',
  'Check authorization',
  'Generate alert',
  'Log audit trail',
];

type SourceColumn = { name: string; desc: string };
type ConnectedSource = {
  name: string;
  type: 'SQL' | 'CSV' | 'PDF';
  records: string;
  desc: string;
  columns: SourceColumn[];
};

const CONNECTED_SOURCES: ConnectedSource[] = [
  {
    name: 'SAP ERP — AP Module',
    type: 'SQL',
    records: '1.2M',
    desc: 'Accounts payable transactions from the SAP backend.',
    columns: [
      { name: 'Doc No', desc: 'SAP document number for AP postings' },
      { name: 'Vendor ID', desc: 'Internal SAP vendor reference' },
      { name: 'Posting Date', desc: 'Date the entry was posted to GL' },
      { name: 'Amount', desc: 'Posted invoice amount in document currency' },
      { name: 'GL Account', desc: 'General ledger account code' },
      { name: 'Status', desc: 'Document status — open, cleared, blocked' },
    ],
  },
  {
    name: 'Vendor Master Data',
    type: 'CSV',
    records: '892',
    desc: 'Master record of approved vendors and bank details.',
    columns: [
      { name: 'Vendor ID', desc: 'Unique vendor identifier' },
      { name: 'Vendor Name', desc: 'Legal entity name on file' },
      { name: 'Tax ID', desc: 'Government-issued tax registration number' },
      { name: 'Bank Account', desc: 'Payment routing details' },
      { name: 'Risk Class', desc: 'Vendor risk classification tier' },
    ],
  },
  {
    name: 'Invoice Archive 2026',
    type: 'PDF',
    records: '4,521',
    desc: 'Scanned invoice documents for the audit period.',
    columns: [
      { name: 'Invoice No', desc: 'Vendor-issued invoice number' },
      { name: 'Vendor', desc: 'Vendor name as printed on the document' },
      { name: 'PO Ref', desc: 'Referenced purchase order number' },
      { name: 'Amount', desc: 'Invoice total amount' },
      { name: 'Line Item', desc: 'Item-level description on the document' },
      { name: 'Invoice Date', desc: 'Date printed on the invoice' },
    ],
  },
];

const SOURCE_TYPE_BADGE: Record<ConnectedSource['type'], string> = {
  SQL: 'bg-primary-xlight text-primary',
  CSV: 'bg-compliant-50 text-compliant-700',
  PDF: 'bg-mitigated-50 text-mitigated-700',
};

/* ──────────────── Tolerance — column registry & rule types ──────────────── */

type TolType = 'numeric' | 'date' | 'text' | 'exact';
type TolFile = 'invoice' | 'po' | 'gl';

interface ColumnRef { file: TolFile; column: string; }
interface ColumnGroup { file: TolFile; columns: string[]; }

const TOL_FILE_LABEL: Record<TolFile, string> = {
  invoice: 'AP Invoice Register',
  po: 'Purchase Orders',
  gl: 'GL Trial Balance',
};

const TOL_FILE_DOT: Record<TolFile, string> = {
  invoice: 'bg-primary',
  po: 'bg-blue-500',
  gl: 'bg-emerald-500',
};

const TOL_COLUMNS_BY_TYPE: Record<TolType, { source: ColumnGroup[]; target: ColumnGroup[] }> = {
  numeric: {
    source: [
      { file: 'invoice', columns: ['Invoice Amount', 'Tax Amount', 'Net Amount'] },
      { file: 'po', columns: ['PO Amount', 'Line Total'] },
    ],
    target: [
      { file: 'gl', columns: ['GL Amount', 'Debit', 'Credit'] },
    ],
  },
  date: {
    source: [
      { file: 'invoice', columns: ['Invoice Date', 'Due Date', 'Created At'] },
      { file: 'po', columns: ['PO Date', 'Delivery Date'] },
    ],
    target: [
      { file: 'gl', columns: ['Posting Date', 'Period End'] },
    ],
  },
  text: {
    source: [
      { file: 'invoice', columns: ['Vendor Name', 'Description', 'Invoice Number'] },
      { file: 'po', columns: ['Supplier Name', 'PO Number'] },
    ],
    target: [
      { file: 'gl', columns: ['GL Description', 'Account Name'] },
    ],
  },
  exact: {
    source: [
      { file: 'invoice', columns: ['Currency Code', 'Cost Center', 'Vendor ID'] },
      { file: 'po', columns: ['PO Currency', 'Department'] },
    ],
    target: [
      { file: 'gl', columns: ['GL Currency', 'GL Cost Center'] },
    ],
  },
};

type IconKey = 'amount' | 'date' | 'text' | 'qty' | 'currency' | 'rounding' | 'aggregate' | 'custom';

const TOL_ICON: Record<IconKey, { icon: React.ComponentType<{ size?: number }>; bg: string }> = {
  amount: { icon: DollarSign, bg: 'bg-compliant-50 text-compliant-700' },
  date: { icon: Calendar, bg: 'bg-primary-xlight text-primary' },
  text: { icon: Type, bg: 'bg-indigo-50 text-indigo-700' },
  qty: { icon: Package, bg: 'bg-amber-50 text-amber-700' },
  currency: { icon: Coins, bg: 'bg-mitigated-50 text-mitigated-700' },
  rounding: { icon: CircleDot, bg: 'bg-blue-50 text-blue-700' },
  aggregate: { icon: Sigma, bg: 'bg-rose-50 text-rose-700' },
  custom: { icon: Pencil, bg: 'bg-surface-3 text-text' },
};

interface ToleranceRule {
  id: string;
  iconKey: IconKey;
  label: string;
  type: TolType;
  thresholdValue: number;
  thresholdUnit: string;
  severity: 'Strict' | 'Moderate' | 'Loose';
  active: boolean;
  source: ColumnRef;
  target: ColumnRef;
  mode?: 'Calendar' | 'Business';
}

const DEFAULT_TOLERANCES: ToleranceRule[] = [
  {
    id: 'amount', iconKey: 'amount', label: 'Amount', type: 'numeric',
    thresholdValue: 5, thresholdUnit: '%', severity: 'Moderate', active: true,
    source: { file: 'invoice', column: 'Invoice Amount' },
    target: { file: 'gl', column: 'GL Amount' },
  },
  {
    id: 'date', iconKey: 'date', label: 'Date', type: 'date',
    thresholdValue: 3, thresholdUnit: 'days', severity: 'Moderate', active: true,
    source: { file: 'invoice', column: 'Invoice Date' },
    target: { file: 'gl', column: 'Posting Date' },
    mode: 'Calendar',
  },
  {
    id: 'text', iconKey: 'text', label: 'Text similarity', type: 'text',
    thresholdValue: 80, thresholdUnit: '%', severity: 'Moderate', active: false,
    source: { file: 'invoice', column: 'Vendor Name' },
    target: { file: 'gl', column: 'GL Description' },
  },
];

interface PreconfiguredRule {
  id: string;
  iconKey: IconKey;
  label: string;
  desc: string;
  type: TolType;
  thresholdValue: number;
  thresholdUnit: string;
  severity: 'Strict' | 'Moderate' | 'Loose';
}

const PRECONFIGURED_RULES: PreconfiguredRule[] = [
  { id: 'qty', iconKey: 'qty', label: 'Quantity', desc: 'Unit count variance between source and target', type: 'numeric', thresholdValue: 2, thresholdUnit: 'units', severity: 'Moderate' },
  { id: 'currency', iconKey: 'currency', label: 'Currency / FX', desc: 'Foreign exchange rate variance', type: 'numeric', thresholdValue: 0.5, thresholdUnit: '%', severity: 'Strict' },
  { id: 'rounding', iconKey: 'rounding', label: 'Rounding', desc: 'Decimal rounding allowance', type: 'numeric', thresholdValue: 1, thresholdUnit: '$', severity: 'Loose' },
  { id: 'aggregate', iconKey: 'aggregate', label: 'Aggregate cap', desc: 'Cumulative value threshold per period', type: 'numeric', thresholdValue: 50, thresholdUnit: 'K $', severity: 'Strict' },
];

function defaultColumnsFor(type: TolType): { source: ColumnRef; target: ColumnRef } {
  const cfg = TOL_COLUMNS_BY_TYPE[type];
  return {
    source: { file: cfg.source[0].file, column: cfg.source[0].columns[0] },
    target: { file: cfg.target[0].file, column: cfg.target[0].columns[0] },
  };
}

function ScoreChip({ score }: { score: number }) {
  const bg = score >= 85 ? 'bg-primary-xlight text-primary' : score >= 70 ? 'bg-mitigated-50 text-mitigated-700' : 'bg-risk-50 text-risk-700';
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[12px] font-bold font-mono ${bg}`}>{score}</span>;
}

function SeverityBadge({ severity }: { severity: 'Strict' | 'Moderate' | 'Loose' }) {
  const styles = {
    Strict: 'bg-risk-50 text-risk-700',
    Moderate: 'bg-mitigated-50 text-mitigated-700',
    Loose: 'bg-compliant-50 text-compliant-700',
  } as const;
  return (
    <span className={`text-[10px] font-bold uppercase tracking-tight px-1.5 py-0.5 rounded ${styles[severity]}`}>
      {severity}
    </span>
  );
}

function FieldPill({ children, dot = 'bg-primary' }: { children: React.ReactNode; dot?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white border border-border-light text-[12px] font-medium text-text">
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {children}
    </span>
  );
}

function FieldPicker({ value, options, onChange }: {
  value: ColumnRef;
  options: ColumnGroup[];
  onChange: (next: ColumnRef) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-flex">
      <button
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-white border border-border-light text-[12px] font-medium text-text hover:border-primary/40 transition-colors cursor-pointer"
      >
        <span className={`w-1.5 h-1.5 rounded-full ${TOL_FILE_DOT[value.file]}`} />
        {value.column}
        <ChevronDown size={12} className="text-text-muted" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-50 w-64 max-h-72 overflow-y-auto rounded-lg border border-border bg-white shadow-lg p-1">
            {options.map(group => (
              <div key={group.file} className="mb-1 last:mb-0">
                <div className="flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-mono uppercase tracking-tight text-ink-500">
                  <span className={`w-1.5 h-1.5 rounded-full ${TOL_FILE_DOT[group.file]}`} />
                  {TOL_FILE_LABEL[group.file]}
                </div>
                {group.columns.map(col => {
                  const selected = value.file === group.file && value.column === col;
                  return (
                    <button
                      key={col}
                      onClick={() => { onChange({ file: group.file, column: col }); setOpen(false); }}
                      className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-[12px] text-left transition-colors cursor-pointer ${
                        selected ? 'bg-primary-xlight text-primary font-medium' : 'text-text hover:bg-surface-2'
                      }`}
                    >
                      <span className="truncate">{col}</span>
                      {selected && <Check size={12} />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function AddToleranceMenu({ onAddPreconfigured, onOpenBuilder }: {
  onAddPreconfigured: (preset: PreconfiguredRule) => void;
  onOpenBuilder: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const filtered = PRECONFIGURED_RULES.filter(p =>
    p.label.toLowerCase().includes(query.toLowerCase()) ||
    p.desc.toLowerCase().includes(query.toLowerCase())
  );
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full mt-3 py-3 rounded-xl border border-dashed text-[12px] font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
          open
            ? 'border-primary/40 text-primary bg-primary-xlight/30'
            : 'border-border text-text-muted hover:text-primary hover:border-primary/40 hover:bg-primary-xlight/30'
        }`}
      >
        <Plus size={13} className={`transition-transform ${open ? 'rotate-45' : ''}`} />
        Add tolerance parameter
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 mt-2 z-50 rounded-xl border border-border bg-white shadow-xl p-2">
            <div className="flex items-center gap-2 px-2 py-1.5 mb-1 border-b border-border-light">
              <Search size={13} className="text-text-muted" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search parameters..."
                className="flex-1 outline-none text-[12px] text-text placeholder:text-text-muted bg-transparent"
                autoFocus
              />
            </div>
            <div className="text-[10px] font-mono uppercase tracking-tight text-ink-500 px-2 py-1.5">Preconfigured</div>
            <div className="space-y-0.5">
              {filtered.map(p => {
                const Icon = TOL_ICON[p.iconKey].icon;
                return (
                  <div key={p.id} className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-surface-2 transition-colors">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${TOL_ICON[p.iconKey].bg}`}>
                      <Icon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-text">{p.label}</div>
                      <div className="text-[11px] text-text-muted truncate">{p.desc}</div>
                    </div>
                    <span className="text-[11px] font-mono text-text-muted shrink-0">±{p.thresholdValue}{p.thresholdUnit === '$' ? '' : p.thresholdUnit === 'K $' ? 'K' : p.thresholdUnit}</span>
                    <button
                      onClick={() => { onAddPreconfigured(p); setOpen(false); }}
                      className="px-3 h-7 rounded-md bg-primary hover:bg-primary-hover text-white text-[11px] font-semibold transition-colors cursor-pointer shrink-0"
                    >
                      Add
                    </button>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="text-[12px] text-text-muted px-2 py-3 text-center">No matches.</div>
              )}
            </div>
            <div className="text-[10px] font-mono uppercase tracking-tight text-ink-500 px-2 py-1.5 mt-2 border-t border-border-light pt-3">Custom rule</div>
            <button
              onClick={() => { onOpenBuilder(); setOpen(false); }}
              className="w-full flex items-center gap-3 px-2 py-2 rounded-md hover:bg-surface-2 transition-colors cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-surface-3 text-text shrink-0">
                <Pencil size={14} />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="text-[13px] font-semibold text-text">Build custom rule</div>
                <div className="text-[11px] text-text-muted">Pick type, columns, and threshold</div>
              </div>
              <ChevronRight size={14} className="text-text-muted shrink-0" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function CustomRuleBuilder({ open, onClose, onSave }: {
  open: boolean;
  onClose: () => void;
  onSave: (rule: ToleranceRule) => void;
}) {
  const [step, setStep] = useState(0);
  const [type, setType] = useState<TolType | null>(null);
  const [source, setSource] = useState<ColumnRef | null>(null);
  const [target, setTarget] = useState<ColumnRef | null>(null);
  const [threshold, setThreshold] = useState<number>(5);
  const [unit, setUnit] = useState<string>('%');
  const [severity, setSeverity] = useState<'Strict' | 'Moderate' | 'Loose'>('Moderate');
  const [name, setName] = useState('');

  function reset() {
    setStep(0); setType(null); setSource(null); setTarget(null);
    setThreshold(5); setUnit('%'); setSeverity('Moderate'); setName('');
  }

  function handleClose() { reset(); onClose(); }

  if (!open) return null;

  const TYPE_OPTIONS: { id: TolType; label: string; desc: string; icon: React.ComponentType<{ size?: number }> }[] = [
    { id: 'numeric', label: 'Numeric', desc: 'Amounts, quantities, percentages', icon: DollarSign },
    { id: 'date', label: 'Date', desc: 'Calendar or business day variance', icon: Calendar },
    { id: 'text', label: 'Text', desc: 'Fuzzy similarity matching', icon: Type },
    { id: 'exact', label: 'Exact match', desc: 'Currency codes, IDs, categories', icon: Check },
  ];

  function nextStep() { setStep(s => Math.min(3, s + 1)); }
  function prevStep() { setStep(s => Math.max(0, s - 1)); }

  function canProceed() {
    if (step === 0) return type !== null;
    if (step === 1) return source !== null && target !== null;
    if (step === 2) return threshold > 0;
    if (step === 3) return name.trim().length > 0;
    return false;
  }

  function handleSave() {
    if (!type || !source || !target) return;
    onSave({
      id: `custom-${Date.now()}`,
      iconKey: 'custom',
      label: name.trim(),
      type,
      thresholdValue: threshold,
      thresholdUnit: unit,
      severity,
      active: true,
      source,
      target,
    });
    reset();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-[560px] max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border-light">
          <div>
            <div className="text-[15px] font-semibold text-text">Build custom tolerance rule</div>
            <div className="text-[12px] text-text-muted mt-0.5">Step {step + 1} of 4</div>
          </div>
          <button onClick={handleClose} className="w-8 h-8 rounded-md hover:bg-surface-2 flex items-center justify-center text-text-muted cursor-pointer">
            <XIcon size={16} />
          </button>
        </div>

        {/* Progress dots */}
        <div className="flex items-center gap-1.5 px-5 pt-4">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className={`h-1 rounded-full flex-1 transition-colors ${i <= step ? 'bg-primary' : 'bg-surface-3'}`} />
          ))}
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          {step === 0 && (
            <div>
              <div className="text-[13px] font-semibold text-text mb-1">What type of comparison?</div>
              <div className="text-[12px] text-text-muted mb-4">This determines which columns and threshold formats are available.</div>
              <div className="grid grid-cols-2 gap-2">
                {TYPE_OPTIONS.map(t => {
                  const Icon = t.icon;
                  const selected = type === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => { setType(t.id); const d = defaultColumnsFor(t.id); setSource(d.source); setTarget(d.target); if (t.id === 'date') setUnit('days'); else if (t.id === 'text') setUnit('%'); else setUnit('%'); }}
                      className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                        selected ? 'border-primary bg-primary-xlight/40' : 'border-border-light hover:border-primary/40'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${selected ? 'bg-primary text-white' : 'bg-surface-2 text-text-muted'}`}>
                        <Icon size={14} />
                      </div>
                      <div>
                        <div className="text-[13px] font-semibold text-text">{t.label}</div>
                        <div className="text-[11px] text-text-muted">{t.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 1 && type && source && target && (
            <div>
              <div className="text-[13px] font-semibold text-text mb-1">Which columns to compare?</div>
              <div className="text-[12px] text-text-muted mb-4">AI suggested defaults based on your data sources — adjust as needed.</div>
              <div className="space-y-3">
                <div>
                  <div className="text-[11px] font-mono uppercase tracking-tight text-ink-500 mb-1.5">Source</div>
                  <FieldPicker value={source} options={TOL_COLUMNS_BY_TYPE[type].source} onChange={setSource} />
                </div>
                <div>
                  <div className="text-[11px] font-mono uppercase tracking-tight text-ink-500 mb-1.5">Target</div>
                  <FieldPicker value={target} options={TOL_COLUMNS_BY_TYPE[type].target} onChange={setTarget} />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="text-[13px] font-semibold text-text mb-1">Set the threshold</div>
              <div className="text-[12px] text-text-muted mb-4">How much variance is acceptable before a record is flagged?</div>
              <div className="flex items-center gap-3 mb-4">
                <Stepper value={threshold} onDec={() => setThreshold(v => Math.max(0, v - 1))} onInc={() => setThreshold(v => v + 1)} unit={unit} />
                <select
                  value={unit}
                  onChange={e => setUnit(e.target.value)}
                  className="px-3 h-8 rounded-md border border-border-light bg-white text-[12px] text-text cursor-pointer"
                >
                  {type === 'date' ? (
                    <><option>days</option><option>hours</option></>
                  ) : type === 'text' ? (
                    <><option>%</option></>
                  ) : (
                    <><option>%</option><option>$</option><option>units</option></>
                  )}
                </select>
              </div>
              <div className="text-[12px] font-semibold text-text mb-1.5">Severity</div>
              <div className="flex gap-1.5">
                {(['Strict', 'Moderate', 'Loose'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setSeverity(s)}
                    className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors cursor-pointer ${
                      severity === s ? 'bg-primary text-white' : 'bg-surface-2 text-text-muted hover:text-text'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="text-[13px] font-semibold text-text mb-1">Name this rule</div>
              <div className="text-[12px] text-text-muted mb-4">A short label that describes what this checks.</div>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Vendor name fuzzy match"
                className="w-full px-3 py-2 rounded-md border border-border-light text-[13px] text-text outline-none focus:border-primary"
                autoFocus
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-5 border-t border-border-light">
          <button
            onClick={step === 0 ? handleClose : prevStep}
            className="px-4 h-9 rounded-md text-[12px] font-semibold text-text-muted hover:text-text cursor-pointer"
          >
            {step === 0 ? 'Cancel' : 'Back'}
          </button>
          {step < 3 ? (
            <button
              onClick={nextStep}
              disabled={!canProceed()}
              className={`px-4 h-9 rounded-md text-[12px] font-semibold transition-colors ${
                canProceed() ? 'bg-primary hover:bg-primary-hover text-white cursor-pointer' : 'bg-surface-3 text-text-muted cursor-not-allowed'
              }`}
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={!canProceed()}
              className={`px-4 h-9 rounded-md text-[12px] font-semibold transition-colors ${
                canProceed() ? 'bg-primary hover:bg-primary-hover text-white cursor-pointer' : 'bg-surface-3 text-text-muted cursor-not-allowed'
              }`}
            >
              Save rule
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Stepper({ value, onDec, onInc, unit }: { value: number | string; onDec: () => void; onInc: () => void; unit: string }) {
  return (
    <div className="inline-flex items-center gap-2">
      <button onClick={onDec} className="w-8 h-8 rounded-md bg-white border border-border-light flex items-center justify-center text-text-muted hover:text-primary hover:border-primary/40 transition-colors cursor-pointer">
        <Minus size={14} />
      </button>
      <span className="font-display text-[20px] font-[420] text-primary min-w-[24px] text-center">{value}</span>
      <button onClick={onInc} className="w-8 h-8 rounded-md bg-white border border-border-light flex items-center justify-center text-text-muted hover:text-primary hover:border-primary/40 transition-colors cursor-pointer">
        <Plus size={14} />
      </button>
      <span className="text-[12px] text-text-muted ml-1">{unit}</span>
    </div>
  );
}

function ToleranceRuleCard({
  icon, iconBg, label, value, severity, active, expanded,
  onToggle, onToggleExpand, summary, children,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
  severity: 'Strict' | 'Moderate' | 'Loose';
  active: boolean;
  expanded: boolean;
  onToggle: () => void;
  onToggleExpand: () => void;
  summary?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const dim = !active;
  return (
    <div className={`rounded-xl border transition-colors ${active ? 'border-border-light bg-surface-2/30' : 'border-border-light bg-surface-2/20'}`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconBg} ${dim ? 'opacity-50' : ''}`}>
            {icon}
          </div>
          <div className={`flex-1 min-w-0 ${dim ? 'opacity-50' : ''}`}>
            <div className="text-[15px] font-semibold text-text leading-tight">{label}</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[12px] text-text-muted">{value}</span>
              <SeverityBadge severity={severity} />
            </div>
            {summary}
          </div>
          <button
            onClick={onToggleExpand}
            disabled={!active}
            className={`w-7 h-7 rounded flex items-center justify-center text-text-muted hover:text-text transition-colors ${active ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'}`}
          >
            <ChevronDown size={16} className={`transition-transform ${expanded ? '' : '-rotate-90'}`} />
          </button>
          <button
            onClick={onToggle}
            className={`w-9 h-5 rounded-full transition-colors shrink-0 ${active ? 'bg-primary' : 'bg-surface-3'} cursor-pointer`}
          >
            <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${active ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
          </button>
        </div>
        <AnimatePresence initial={false}>
          {active && expanded && children && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18, ease: [0.22, 0.68, 0, 1] }}
              className="overflow-hidden"
            >
              <div className="pl-12 pt-4">
                {children}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

type TabId = 'overview' | 'runs' | 'config';

type ResolvedWorkflow = {
  id: string;
  code: string;
  name: string;
  desc: string;
  steps: string[];
  runs: number;
  owner: string;
  lastRun: string | null;          // formatted date/time; null = never run
  lastRunStatus: string | null;    // 'Success' | 'Error'; null = never run
  lastRunError: string | null;     // failure reason, shown when lastRunStatus === 'Error'
  lastRunErrorKind: string | null; // 'technical' (in-place retry) | 'data' (open executor)
  linkedControls: { id: string; name: string }[]; // controls this workflow supports
};

// Run-status dot + text colour.
const RUN_STATUS_DOT: Record<string, string> = { Success: 'bg-compliant', Error: 'bg-risk' };
const RUN_STATUS_TEXT: Record<string, string> = { Success: 'text-compliant-700', Error: 'text-risk-700' };

// Process Hub workflow data for resolution — kept in sync with the Process Hub
// Workflows tab cards (SEED_BP_WF in BusinessProcesses.tsx).
const BP_WORKFLOWS: Record<string, { name: string; desc: string; owner: string; lastRun: string | null; lastRunStatus: string | null; lastRunError: string | null; lastRunErrorKind: string | null; linkedControls: { id: string; name: string }[] }> = {
  'wf-c1': { name: 'Three-Way PO Match', desc: 'Automated matching of PO, GRN, and Invoice before payment release.', owner: 'Karan Mehta', lastRun: 'May 18, 2026 · 6:00 PM', lastRunStatus: 'Success', lastRunError: null, lastRunErrorKind: null, linkedControls: [{ id: 'C-001', name: 'Three-Way PO/GRN/Invoice Matching' }, { id: 'C-004', name: 'High-Value Payment Review' }] },
  'wf-c2': { name: 'Vendor Change Monitor', desc: 'Monitors vendor master data changes and validates approval chain.', owner: 'Tushar Goel', lastRun: 'May 18, 2026 · 6:00 PM', lastRunStatus: 'Error', lastRunError: 'Vendor master feed unavailable — connection timed out after 30s.', lastRunErrorKind: 'technical', linkedControls: [{ id: 'C-002', name: 'Vendor Master Change Approval' }] },
  'wf-c3': { name: 'Duplicate Invoice Detector', desc: 'Scans invoices against historical data to flag duplicates.', owner: 'Deepak Bansal', lastRun: 'May 17, 2026 · 2:00 AM', lastRunStatus: 'Error', lastRunError: "Source file 'invoice_register_apr.csv' could not be parsed — column 'Invoice Date' is missing.", lastRunErrorKind: 'data', linkedControls: [{ id: 'C-003', name: 'Duplicate Invoice Detection' }] },
  'wf-c4': { name: 'Payment Approval Review', desc: 'Manual review of high-value payment approvals.', owner: 'Neha Joshi', lastRun: 'May 16, 2026 · 11:30 AM', lastRunStatus: 'Success', lastRunError: null, lastRunErrorKind: null, linkedControls: [{ id: 'C-004', name: 'High-Value Payment Review' }] },
  'wf-c5': { name: 'PO Dual Sign-Off Check', desc: 'Validates dual authorization for purchase orders above threshold.', owner: 'Tushar Goel', lastRun: null, lastRunStatus: null, lastRunError: null, lastRunErrorKind: null, linkedControls: [] },
};

function resolveWorkflow(workflowId: string): ResolvedWorkflow | null {
  const wf = WORKFLOWS.find(w => w.id === workflowId);
  if (wf) {
    return {
      id: wf.id,
      code: wf.id.toUpperCase(),
      name: wf.name,
      desc: wf.desc,
      steps: wf.steps,
      runs: wf.runs,
      owner: 'Karan Mehta',
      lastRun: `${wf.lastRun} · 6:00 PM`,
      lastRunStatus: 'Success',
      lastRunError: null,
      lastRunErrorKind: null,
      linkedControls: [],
    };
  }
  const lib = LIBRARY_WORKFLOWS.find(w => w.id === workflowId);
  if (lib) {
    const idx = LIBRARY_WORKFLOWS.indexOf(lib) + 1;
    return {
      id: lib.id,
      code: `WF-${String(idx).padStart(3, '0')}`,
      name: lib.name,
      desc: lib.description,
      steps: DEFAULT_STEPS,
      runs: 8,
      owner: 'Karan Mehta',
      lastRun: 'May 12, 2026 · 9:00 AM',
      lastRunStatus: 'Success',
      lastRunError: null,
      lastRunErrorKind: null,
      linkedControls: [],
    };
  }
  // Process Hub workflows
  const bpWf = BP_WORKFLOWS[workflowId];
  if (bpWf) {
    return {
      id: workflowId,
      code: workflowId.toUpperCase(),
      name: bpWf.name,
      desc: bpWf.desc,
      steps: DEFAULT_STEPS,
      runs: 5,
      owner: bpWf.owner,
      lastRun: bpWf.lastRun,
      lastRunStatus: bpWf.lastRunStatus,
      lastRunError: bpWf.lastRunError,
      lastRunErrorKind: bpWf.lastRunErrorKind,
      linkedControls: bpWf.linkedControls,
    };
  }
  return null;
}

/** Editable chip list supporting add (input + Enter / button), inline rename (pencil), and delete (×). */
function EditableChipList({
  items, onChange, placeholder, onAdded,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  onAdded?: (value: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editVal, setEditVal] = useState('');

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (items.some(i => i.toLowerCase() === v.toLowerCase())) { setDraft(''); return; }
    onChange([...items, v]);
    onAdded?.(v);
    setDraft('');
  };
  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx));
  const commitEdit = (idx: number) => {
    const v = editVal.trim();
    setEditingIdx(null);
    if (!v) { remove(idx); return; }
    onChange(items.map((it, i) => (i === idx ? v : it)));
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((it, idx) =>
        editingIdx === idx ? (
          <input
            key={idx}
            autoFocus
            value={editVal}
            onChange={e => setEditVal(e.target.value)}
            onBlur={() => commitEdit(idx)}
            onKeyDown={e => {
              if (e.key === 'Enter') commitEdit(idx);
              if (e.key === 'Escape') setEditingIdx(null);
            }}
            className="px-2.5 py-1 rounded-full text-[12px] border border-primary/50 outline-none ring-2 ring-primary/15 bg-white text-text w-36"
          />
        ) : (
          <span
            key={idx}
            className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full bg-surface-2 border border-border-light text-[12px] font-medium text-text"
          >
            {it}
            <button
              onClick={() => { setEditingIdx(idx); setEditVal(it); }}
              className="text-text-muted hover:text-primary cursor-pointer"
              title="Rename"
              aria-label={`Rename ${it}`}
            >
              <Pencil size={11} />
            </button>
            <button
              onClick={() => remove(idx)}
              className="text-text-muted hover:text-risk-700 cursor-pointer"
              title="Remove"
              aria-label={`Remove ${it}`}
            >
              <XIcon size={12} />
            </button>
          </span>
        )
      )}
      <div className="inline-flex items-center gap-1">
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="px-3 py-1.5 rounded-full text-[12px] border border-border-light bg-white text-text placeholder:text-text-muted outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 w-40"
        />
        <button
          onClick={add}
          disabled={!draft.trim()}
          className="w-7 h-7 flex items-center justify-center rounded-full bg-primary hover:bg-primary-hover disabled:bg-text-muted/30 disabled:cursor-not-allowed text-white cursor-pointer transition-colors"
          title="Add"
          aria-label="Add"
        >
          <Plus size={13} />
        </button>
      </div>
    </div>
  );
}

export default function WorkflowDetail({ workflowId, onBack, onOpenExecutor, onEditInChat, onViewVersionHistory, initialTab = 'overview' }: Props) {
  const wf = resolveWorkflow(workflowId);
  const [tab, setTab] = useState<TabId>(initialTab);
  const [expandedDataset, setExpandedDataset] = useState<{ stepIdx: number; dsName: string } | null>(null);
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const [frequency, setFrequency] = useState<'Hourly' | 'Daily' | 'Weekly' | 'Monthly'>('Daily');
  const [runTime, setRunTime] = useState('06:00');
  const [dayOfWeek, setDayOfWeek] = useState<'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'>('Mon');
  const [monthlyDate, setMonthlyDate] = useState('');
  const [triggerOn, setTriggerOn] = useState<'Schedule' | 'Data Change' | 'Manual'>('Schedule');
  const [retry, setRetry] = useState<'Off' | '1x' | '3x' | '5x'>('3x');
  const [tolerances, setTolerances] = useState<ToleranceRule[]>(DEFAULT_TOLERANCES);
  const [expandedTolId, setExpandedTolId] = useState<string | null>('date');
  const [builderOpen, setBuilderOpen] = useState(false);
  const [labels, setLabels] = useState<string[]>(['Reconciliation']);
  const [subProcesses, setSubProcesses] = useState<string[]>(['Invoice Processing']);
  // In-place re-run after a technical error (overrides the resolved run result).
  const [retryingRun, setRetryingRun] = useState(false);
  const [runOverride, setRunOverride] = useState<{ status: string | null; lastRun: string | null; error: string | null } | null>(null);
  const { addToast } = useToast();
  if (!wf) return null;

  // Effective last-run values (local override wins once an in-place retry succeeds).
  const effStatus = runOverride ? runOverride.status : wf.lastRunStatus;
  const effLastRun = runOverride ? runOverride.lastRun : wf.lastRun;
  const effError = runOverride ? runOverride.error : wf.lastRunError;
  // Technical/server error re-runs in place; a data/file error opens the executor.
  const handleRetryRun = () => {
    if (wf.lastRunErrorKind === 'data') { onOpenExecutor ? onOpenExecutor() : addToast({ message: 'Opening executor…', type: 'info' }); return; }
    if (retryingRun) return;
    setRetryingRun(true);
    addToast({ message: 'Re-running workflow…', type: 'info' });
    setTimeout(() => {
      setRunOverride({ status: 'Success', lastRun: 'Just now', error: null });
      setRetryingRun(false);
      addToast({ message: 'Workflow re-ran successfully.', type: 'success' });
    }, 1600);
  };

  const updateRule = (id: string, patch: Partial<ToleranceRule>) =>
    setTolerances(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  const addRule = (rule: ToleranceRule) => setTolerances(prev => [...prev, rule]);

  const pillCls = (active: boolean) =>
    `px-4 py-1.5 rounded-full text-[12px] font-medium border transition-all cursor-pointer ${
      active
        ? 'bg-primary border-primary text-white'
        : 'bg-white border-border-light text-text-muted hover:border-primary/40 hover:text-text'
    }`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.22, 0.68, 0, 1] }}
      className="h-full w-full bg-white flex flex-col overflow-y-auto px-[180px]"
    >
      {/* Breadcrumb back */}
      <div className="pt-8 pb-4 shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[13px] text-ink-500 hover:text-primary transition-colors cursor-pointer"
        >
          <ArrowLeft size={14} />
          Workflows
        </button>
      </div>

      {/* Hero — constant across all tabs */}
      <div className="rounded-2xl border border-border-light bg-gradient-to-br from-primary-xlight/40 to-white p-7 mb-6 relative overflow-hidden shrink-0">
        {/* Top row: status badge (left) + utility actions (right) */}
        <div className="flex items-center justify-between gap-6 mb-5">
          <div className="flex items-center gap-3 shrink-0">
            <span className="font-mono text-[11px] text-ink-500 tracking-tight">{wf.code}</span>
            <span className="w-1 h-1 rounded-full bg-ink-300" />
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-500">
              <User size={12} className="text-ink-400" />
              {wf.owner}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onViewVersionHistory ? onViewVersionHistory() : addToast({ message: 'Opening version history...', type: 'info' })}
              className="flex items-center gap-1.5 px-2.5 h-9 rounded-md text-[12px] font-semibold text-text-muted hover:text-text hover:bg-surface-2 transition-colors cursor-pointer"
            >
              <History size={13} />
              Version history
            </button>
            <button
              onClick={() => onEditInChat ? onEditInChat() : addToast({ message: 'Opening workflow in chat...', type: 'info' })}
              className="flex items-center gap-1.5 px-3 h-9 rounded-md bg-white border border-border text-[12px] font-semibold text-text hover:bg-surface-2 transition-colors cursor-pointer ml-1"
            >
              <MessageSquare size={13} />
              Edit in Chat
            </button>
          </div>
        </div>

        {/* Title */}
        <h1 className="font-display text-[28px] font-[420] tracking-tight text-ink-900 leading-[1.15]">
          {wf.name}
        </h1>

        {/* Bottom row: schedule meta (left) + primary CTA (right) */}
        <div className="flex items-center justify-between gap-6 mt-3">
          <div className="flex items-center gap-3 text-[12px] text-text-muted min-w-0">
            <span className="inline-flex items-center gap-1.5 min-w-0">
              <History size={13} className="shrink-0" />
              <span className="truncate">{effLastRun ? `Last run ${effLastRun}` : 'Not run yet'}</span>
            </span>
            {retryingRun ? (
              <span className="inline-flex items-center gap-1 font-medium shrink-0 text-ink-500">
                <Loader2 size={12} className="animate-spin" />
                Running…
              </span>
            ) : effStatus && (
              <span className={`inline-flex items-center gap-1 font-medium shrink-0 ${RUN_STATUS_TEXT[effStatus]}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${RUN_STATUS_DOT[effStatus]}`} />
                {effStatus}
              </span>
            )}
            <span className="w-1 h-1 rounded-full bg-ink-300 shrink-0" />
            <span className="inline-flex items-center gap-1.5 min-w-0">
              <Clock size={13} className="shrink-0" />
              <span className="truncate">Next run May 19, 6:00 PM</span>
            </span>
          </div>
          <button
            onClick={() => onOpenExecutor ? onOpenExecutor() : addToast({ message: 'Opening executor...', type: 'info' })}
            className="flex items-center gap-1.5 px-4 h-9 rounded-md bg-primary hover:bg-primary-hover text-white text-[12px] font-semibold transition-colors cursor-pointer shrink-0"
          >
            <ExternalLink size={13} />
            Open Executor
          </button>
        </div>

        {/* Last-run error — only when the most recent run failed */}
        {effStatus === 'Error' && effError && (
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-risk-100 bg-risk-50 px-3.5 py-2.5 text-[12px] text-risk-700">
            <AlertTriangle size={14} className="shrink-0" />
            <span className="leading-snug flex-1 min-w-0"><span className="font-semibold">Last run failed:</span> {effError}</span>
            <button
              type="button"
              disabled={retryingRun}
              onClick={handleRetryRun}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 h-8 rounded-md border border-risk-200 bg-white text-[12px] font-semibold text-risk-700 hover:bg-risk-50 disabled:opacity-60 disabled:cursor-default cursor-pointer transition-colors"
            >
              <RotateCcw size={13} className={retryingRun ? 'animate-spin' : ''} />
              {retryingRun ? 'Retrying…' : 'Retry'}
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-border mb-6 shrink-0">
        {([
          { id: 'overview' as TabId, label: 'Overview' },
          { id: 'runs' as TabId, label: 'Runs', count: RUN_HISTORY.length },
          { id: 'config' as TabId, label: 'Configuration' },
        ]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors cursor-pointer ${
              tab === t.id ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-secondary'
            }`}
          >
            <span className="flex items-center gap-2">
              {t.label}
              {t.count != null && (
                <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${tab === t.id ? 'bg-primary/10 text-primary' : 'bg-surface-2 text-ink-500'}`}>{t.count}</span>
              )}
            </span>
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div className="space-y-5 pb-8">
          {/* Linked controls — the controls this workflow supports (moved here from
              the Process Hub workflow card). */}
          {wf.linkedControls.length > 0 && (
            <div>
              <h4 className="text-[14px] font-semibold text-ink-900 mb-3">
                Linked controls <span className="text-text-muted font-normal">({wf.linkedControls.length})</span>
              </h4>
              <div className="space-y-2">
                {wf.linkedControls.map(c => (
                  <div key={c.id} className="rounded-xl border border-border-light bg-white px-4 py-3 flex items-center gap-3">
                    <span className="font-mono text-[12px] font-semibold text-brand-700 shrink-0">{c.id}</span>
                    <span className="text-[13px] text-text min-w-0 truncate">{c.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Steps */}
          <div>
            <h4 className="text-[14px] font-semibold text-ink-900 mb-3">Steps</h4>
            <div className="space-y-2.5">
              {wf.steps.map((step, i) => {
                const meta = deriveStepMeta(step);
                const activeDs = expandedDataset?.stepIdx === i ? expandedDataset.dsName : null;
                const activeColumns = activeDs ? meta.datasets.find(d => d.name === activeDs)?.columns : undefined;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="rounded-xl border border-border-light bg-white p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full bg-ink-900 text-white text-[12px] font-semibold flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h5 className="text-[14px] font-semibold text-ink-900">{step}</h5>
                          <span className={`text-[10px] font-bold uppercase tracking-tight px-1.5 py-0.5 rounded ${TYPE_BADGE[meta.type]}`}>
                            {meta.type}
                          </span>
                        </div>
                        <p className="text-[13px] text-text-secondary mb-3">{meta.desc}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {meta.datasets.map(ds => {
                            const isActive = activeDs === ds.name;
                            return (
                              <button
                                key={ds.name}
                                onClick={() => setExpandedDataset(isActive ? null : { stepIdx: i, dsName: ds.name })}
                                className={`inline-flex items-center gap-1.5 pl-2 pr-2.5 py-1 rounded-full border text-[12px] cursor-pointer transition-colors ${
                                  isActive
                                    ? 'bg-primary-xlight border-primary/30 text-primary'
                                    : 'bg-surface-2 border-border-light text-text hover:bg-surface-3'
                                }`}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                                {ds.name}
                              </button>
                            );
                          })}
                        </div>

                        <AnimatePresence initial={false}>
                          {activeDs && activeColumns && (
                            <motion.div
                              key={activeDs}
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.18, ease: [0.22, 0.68, 0, 1] }}
                              className="overflow-hidden"
                            >
                              <div className="mt-3 rounded-lg bg-surface-2/60 border border-border-light p-3">
                                <div className="text-[11px] font-mono uppercase tracking-tight text-ink-500 mb-2 flex items-center gap-1.5">
                                  <Database size={11} className="text-primary" />
                                  {activeDs} · columns used
                                </div>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                                  {activeColumns.map(col => (
                                    <div key={col.name} className="flex items-center justify-between text-[12px]">
                                      <span className="font-mono text-text">{col.name}</span>
                                      <span className="font-mono text-text-muted">{col.type}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Run History Tab */}
      {tab === 'runs' && (
        <div className="bg-white rounded-xl border border-border-light overflow-hidden mb-8">
          <div className="grid grid-cols-[80px_1fr_80px_100px_80px_80px_70px] gap-3 px-5 py-3 bg-surface-2 border-b border-border-light">
            {['Run', 'Date', 'Trigger', 'Duration', 'Flags', 'Score', 'Status'].map(h => (
              <span key={h} className="text-[11px] font-semibold uppercase tracking-tight text-ink-500">{h}</span>
            ))}
          </div>
          {RUN_HISTORY.map((run, i) => (
            <motion.div
              key={run.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.04 }}
              className="grid grid-cols-[80px_1fr_80px_100px_80px_80px_70px] gap-3 px-5 py-4 border-b border-border-light last:border-0 hover:bg-surface-2/50 transition-colors items-center cursor-pointer"
            >
              <span className="text-[12px] font-mono text-primary font-medium">{run.id}</span>
              <span className="text-[12px] font-mono text-text-secondary">{run.date}</span>
              <span className="text-[12px] text-text-muted">{run.trigger}</span>
              <span className="text-[12px] font-mono text-text font-medium">{run.duration}</span>
              <span className="text-[12px] font-mono text-text font-medium">{run.flags}</span>
              <ScoreChip score={run.score} />
              <span className="text-[12px] font-bold text-success bg-compliant-50 px-2 py-0.5 rounded text-center">
                {run.status === 'ok' ? 'PASS' : 'WARN'}
              </span>
            </motion.div>
          ))}
        </div>
      )}

      {/* Configuration Tab */}
      {tab === 'config' && (
        <div className="space-y-5 pb-8">
          <div className="rounded-2xl border border-border-light bg-white p-5">
            <h4 className="text-[11px] font-mono uppercase tracking-tight text-ink-500 mb-4 flex items-center gap-2">
              <Tag size={13} className="text-primary" />
              Labels & Sub-process
            </h4>
            <div className="space-y-5">
              <div>
                <label className="text-[13px] font-semibold text-text block mb-1">Labels</label>
                <p className="text-[12px] text-text-muted mb-2.5">Tag this workflow for grouping and search — e.g. Reconciliation.</p>
                <EditableChipList
                  items={labels}
                  onChange={setLabels}
                  placeholder="Add label…"
                  onAdded={(v) => addToast({ message: `Label “${v}” added`, type: 'success' })}
                />
              </div>
              <div className="pt-4 border-t border-border-light">
                <label className="text-[13px] font-semibold text-text block mb-1">Sub-process</label>
                <p className="text-[12px] text-text-muted mb-2.5">Add, rename, or remove the sub-processes this workflow belongs to.</p>
                <EditableChipList
                  items={subProcesses}
                  onChange={setSubProcesses}
                  placeholder="Add sub-process…"
                  onAdded={(v) => addToast({ message: `Sub-process “${v}” added`, type: 'success' })}
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border-light bg-white p-5">
            <h4 className="text-[11px] font-mono uppercase tracking-tight text-ink-500 mb-4 flex items-center gap-2">
              <Calendar size={13} className="text-primary" />
              Audit run frequency
            </h4>
            <div className="grid grid-cols-2 gap-x-6 gap-y-5">
              <div>
                <label className="text-[13px] font-semibold text-text block mb-2">Frequency</label>
                <div className="flex flex-wrap gap-2">
                  {(['Hourly', 'Daily', 'Weekly', 'Monthly'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setFrequency(f)}
                      className={pillCls(frequency === f)}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[13px] font-semibold text-text block mb-2">Run Time</label>
                <div className="relative">
                  <input
                    type="time"
                    value={runTime}
                    onChange={e => setRunTime(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-border-light text-[14px] bg-white text-text focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition-all"
                  />
                </div>
              </div>

              {frequency === 'Weekly' && (
                <div className="col-span-2">
                  <label className="text-[13px] font-semibold text-text block mb-2">Select day of the week</label>
                  <div className="flex flex-wrap gap-2">
                    {(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const).map(d => (
                      <button
                        key={d}
                        onClick={() => setDayOfWeek(d)}
                        className={pillCls(dayOfWeek === d)}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {frequency === 'Monthly' && (
                <div>
                  <label className="text-[13px] font-semibold text-text block mb-2">Select date</label>
                  <DatePicker
                                        value={monthlyDate}
                    onChange={e => setMonthlyDate(e.target.value)}
                    placeholder="dd/mm/yyyy"
                    className="w-full h-11 px-3.5 rounded-xl border border-primary/40 text-[14px] bg-white text-text focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all"
                  />
                </div>
              )}

              <div>
                <label className="text-[13px] font-semibold text-text block mb-2">Trigger On</label>
                <div className="flex flex-wrap gap-2">
                  {(['Schedule', 'Data Change', 'Manual'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setTriggerOn(t)}
                      className={pillCls(triggerOn === t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[13px] font-semibold text-text block mb-2">Retry on Failure</label>
                <div className="flex flex-wrap gap-2">
                  {(['Off', '1x', '3x', '5x'] as const).map(r => (
                    <button
                      key={r}
                      onClick={() => setRetry(r)}
                      className={pillCls(retry === r)}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border-light bg-white p-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-[14px] font-semibold text-ink-900 flex items-center gap-2">
                <SlidersHorizontal size={14} className="text-primary" />
                Tolerance rules
              </h4>
              <span className="text-[12px] text-text-muted">
                {tolerances.filter(r => r.active).length} active
              </span>
            </div>

            <div className="space-y-3">
              {tolerances.map(rule => {
                const Icon = TOL_ICON[rule.iconKey].icon;
                const cols = TOL_COLUMNS_BY_TYPE[rule.type];
                const isExpanded = expandedTolId === rule.id;
                const valueLabel =
                  rule.type === 'date'
                    ? `±${rule.thresholdValue} ${(rule.mode || 'Calendar').toLowerCase()} ${rule.thresholdUnit}`
                    : rule.type === 'text'
                      ? `≥${rule.thresholdValue}% fuzzy match`
                      : rule.thresholdUnit === '$'
                        ? `±$${rule.thresholdValue}`
                        : rule.thresholdUnit === 'K $'
                          ? `±$${rule.thresholdValue}K`
                          : `±${rule.thresholdValue}${rule.thresholdUnit === '%' ? '%' : ' ' + rule.thresholdUnit}`;
                return (
                  <ToleranceRuleCard
                    key={rule.id}
                    icon={<Icon size={16} />}
                    iconBg={TOL_ICON[rule.iconKey].bg}
                    label={rule.label}
                    value={valueLabel}
                    severity={rule.severity}
                    active={rule.active}
                    expanded={isExpanded}
                    onToggle={() => updateRule(rule.id, { active: !rule.active })}
                    onToggleExpand={() => setExpandedTolId(prev => prev === rule.id ? null : rule.id)}
                    summary={
                      rule.active && !isExpanded ? (
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <FieldPill dot={TOL_FILE_DOT[rule.source.file]}>{rule.source.column}</FieldPill>
                          <span className="text-[11px] text-text-muted font-mono">vs</span>
                          <FieldPill dot={TOL_FILE_DOT[rule.target.file]}>{rule.target.column}</FieldPill>
                        </div>
                      ) : null
                    }
                  >
                    <div className="space-y-3">
                      <div>
                        <div className="text-[11px] font-mono uppercase tracking-tight text-ink-500 mb-1.5 flex items-center gap-1.5">
                          Applied to
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary-xlight text-primary text-[10px] font-bold">
                            <Sparkles size={9} /> AI
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <FieldPicker
                            value={rule.source}
                            options={cols.source}
                            onChange={(next) => updateRule(rule.id, { source: next })}
                          />
                          <span className="text-[11px] text-text-muted font-mono">vs</span>
                          <FieldPicker
                            value={rule.target}
                            options={cols.target}
                            onChange={(next) => updateRule(rule.id, { target: next })}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <Stepper
                          value={rule.thresholdValue}
                          onDec={() => updateRule(rule.id, { thresholdValue: Math.max(0, rule.thresholdValue - 1) })}
                          onInc={() => updateRule(rule.id, { thresholdValue: rule.thresholdValue + 1 })}
                          unit={rule.thresholdUnit}
                        />
                        <SeverityBadge severity={rule.severity} />
                      </div>
                      {rule.type === 'date' && (
                        <div className="inline-flex items-center bg-surface-2 rounded-lg p-0.5">
                          {(['Calendar', 'Business'] as const).map(m => (
                            <button
                              key={m}
                              onClick={() => updateRule(rule.id, { mode: m })}
                              className={`px-4 py-1.5 rounded-md text-[12px] font-semibold transition-colors cursor-pointer ${
                                rule.mode === m ? 'bg-primary text-white' : 'text-text-muted hover:text-text'
                              }`}
                            >
                              {m}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </ToleranceRuleCard>
                );
              })}
            </div>

            <AddToleranceMenu
              onAddPreconfigured={(p) => {
                if (tolerances.some(t => t.id === p.id)) {
                  addToast({ message: `${p.label} is already added`, type: 'info' });
                  return;
                }
                const cols = defaultColumnsFor(p.type);
                addRule({
                  id: p.id,
                  iconKey: p.iconKey,
                  label: p.label,
                  type: p.type,
                  thresholdValue: p.thresholdValue,
                  thresholdUnit: p.thresholdUnit,
                  severity: p.severity,
                  active: true,
                  source: cols.source,
                  target: cols.target,
                });
                setExpandedTolId(p.id);
                addToast({ message: `${p.label} added`, type: 'success' });
              }}
              onOpenBuilder={() => setBuilderOpen(true)}
            />

            {/* Impact preview */}
            <div className="mt-5 pt-5 border-t border-border-light">
              <div className="text-[11px] font-mono uppercase tracking-tight text-ink-500 mb-3">
                Impact preview — sample matches
              </div>
              <div className="space-y-2">
                {[
                  { left: '$12,450', right: '$12,200', delta: '2.0%', kind: 'AMT', pass: true },
                  { left: 'Mar 15', right: 'Mar 19', delta: '4 days', kind: 'DATE', pass: false },
                  { left: '$8,920', right: '$9,500', delta: '6.1%', kind: 'AMT', pass: false },
                ].map((s, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 text-[12px]">
                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-text">{s.left}</span>
                      <span className="text-text-muted">vs</span>
                      <span className="text-text">{s.right}</span>
                      <span className="text-text-muted">{s.delta}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        s.kind === 'AMT' ? 'bg-compliant-50 text-compliant-700' : 'bg-primary-xlight text-primary'
                      }`}>{s.kind}</span>
                      <span className={`text-[12px] font-bold ${s.pass ? 'text-success' : 'text-risk-700'}`}>
                        {s.pass ? 'Pass' : 'Flag'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border-light bg-white p-5">
            <h4 className="text-[11px] font-mono uppercase tracking-tight text-ink-500 mb-3 flex items-center gap-2">
              <Database size={13} className="text-primary" />
              Connected Sources
            </h4>
            <div className="grid grid-cols-2 gap-2.5 items-start">
              {CONNECTED_SOURCES.map(src => {
                const isExpanded = expandedSources.has(src.name);
                const toggle = () => {
                  setExpandedSources(prev => {
                    const next = new Set(prev);
                    if (next.has(src.name)) next.delete(src.name);
                    else next.add(src.name);
                    return next;
                  });
                };
                return (
                  <div key={src.name} className="rounded-xl bg-surface-2/50 border border-border-light/50 p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary-xlight flex items-center justify-center shrink-0">
                        <Database size={16} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-[14px] font-semibold text-ink-900 leading-tight">{src.name}</div>
                            <div className="text-[12px] text-text-muted truncate mt-0.5">{src.desc}</div>
                          </div>
                          <div className="flex flex-col items-end gap-0.5 shrink-0">
                            <span className={`text-[10px] font-mono font-bold uppercase tracking-tight px-2 py-0.5 rounded ${SOURCE_TYPE_BADGE[src.type]}`}>
                              {src.type}
                            </span>
                            <span className="text-[10px] font-mono text-text-muted">{src.records} records</span>
                          </div>
                        </div>

                        {!isExpanded && (
                          <div className="flex flex-wrap gap-1.5 mt-3">
                            {src.columns.map(col => (
                              <span key={col.name} className="font-mono text-[11px] px-2 py-1 rounded border border-border-light bg-white text-text">
                                {col.name}
                              </span>
                            ))}
                          </div>
                        )}

                        <AnimatePresence initial={false}>
                          {isExpanded && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.18, ease: [0.22, 0.68, 0, 1] }}
                              className="overflow-hidden"
                            >
                              <div className="mt-3 space-y-1.5">
                                {src.columns.map(col => (
                                  <div key={col.name} className="rounded-lg border border-border-light bg-white px-3 py-2">
                                    <div className="font-mono text-[12px] font-semibold text-ink-900">{col.name}</div>
                                    <div className="text-[12px] text-text-muted mt-0.5">{col.desc}</div>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <button
                          onClick={toggle}
                          className="flex items-center gap-1 mt-3 text-[12px] font-medium text-primary hover:text-primary-hover transition-colors cursor-pointer"
                        >
                          {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                          {isExpanded ? 'Hide column details' : 'Show column details'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-border-light bg-white p-5">
            <h4 className="text-[11px] font-mono uppercase tracking-tight text-ink-500 mb-3 flex items-center gap-2">
              <Bell size={13} className="text-primary" />
              Notifications
            </h4>
            <div className="space-y-2.5">
              {[
                { label: 'Email on completion', enabled: true },
                { label: 'Slack alert on critical flags', enabled: true },
                { label: 'Dashboard auto-refresh', enabled: false },
                { label: 'Weekly summary digest', enabled: true },
              ].map(n => (
                <div key={n.label} className="flex items-center justify-between py-2">
                  <span className="text-[12px] text-text">{n.label}</span>
                  <div className={`w-9 h-5 rounded-full cursor-pointer transition-colors ${n.enabled ? 'bg-primary' : 'bg-surface-3'}`}>
                    <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform mt-0.5 ${n.enabled ? 'translate-x-4.5 ml-0.5' : 'translate-x-0.5'}`} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <CustomRuleBuilder
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        onSave={(rule) => {
          addRule(rule);
          setExpandedTolId(rule.id);
          setBuilderOpen(false);
          addToast({ message: `${rule.label} added`, type: 'success' });
        }}
      />
    </motion.div>
  );
}
