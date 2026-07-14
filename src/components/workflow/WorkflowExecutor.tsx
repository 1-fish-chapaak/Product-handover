import { useState, useRef, useEffect, useCallback, useMemo, type MouseEvent as ReactMouseEvent } from 'react';
import DatePicker from '../shared/DatePicker';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, ArrowRight, Play, UploadCloud, File as FileIcon,
  FileText, Square, Download, LayoutDashboard, AlertTriangle,
  CheckCircle2, Clock, Loader2,
  ChevronDown, ChevronUp, X, Database, Search, Check,
  TrendingUp, Users, Percent, CalendarDays, Pencil, AlertCircle,
  Link2, RefreshCw, Info, Wand2, Upload, Folder, ScanLine,
  MessageSquare, ArrowUp, Layers, Plus, PanelRightClose,
  Table2, Type as TypeIcon, Hash,
} from 'lucide-react';
import type { WorkflowRunSeed } from './workflowRunSeed';
import { PlanSection, type ExecutorParameters } from '../concierge-workflow-builder/PlanPanel';
import ExecutorColumnMapping from './ExecutorColumnMapping';
import SlotFunctionTag from './SlotFunctionTag';
import ArtifactPanel from '../artifacts/ArtifactPanel';
import WorkflowMemoryPanel, { RowMemoryMarker, GoldenRecordPlanCard, SourceDriftBanner } from './WorkflowMemoryPanel';
import type { ArtifactTab } from '../../hooks/useAppState';
import { seedAlignments } from '../concierge-workflow-builder/mockApi';
import type {
  WorkflowDraft,
  InputSpec,
  JourneyFiles,
  JourneyAlignments,
  ColumnAlignment,
  ColumnSpec,
  ColumnDataType,
  UploadedFile,
} from '../concierge-workflow-builder/types';
import { DATA_SOURCES } from '../../data/mockData';
import { useCan } from '../../context/CurrentUserContext';
import { useToast } from '../shared/Toast';
import WorkflowOutputInsight, { type OutputInsight } from './WorkflowOutputInsight';
import DataPickerModal, { type AttachmentSelection } from '../chat/DataPickerModal';

interface WorkflowExecutorProps {
  workflowId: string;
  onBack: () => void;
  /** Fires when the simulated run reaches the 'complete' phase. App.tsx
   *  wires this to push a platform notification. */
  onRunComplete?: (workflowId: string) => void;
  /** Fires when the user asks a follow-up question about a completed run.
   *  App.tsx routes this into chat, seeding the run as conversation history
   *  (via `seed`) and auto-submitting `query`. */
  onFollowUp?: (query: string, seed: WorkflowRunSeed) => void;
  /** Right-workspace actions — mirror the QnA workspace. App.tsx wires these
   *  to the same destinations chat uses (Share modal, Knowledge Hub, chat). */
  onShareResults?: () => void;
  onOpenInKnowledgeHub?: (sourceName: string) => void;
  onComposeInChat?: (draft: string) => void;
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

// Sandbox workflow whose inputs are all PDFs. Selected by id from the
// Workflow Library so we can exercise the unstructured-document mapping
// surfaces end-to-end without bolting onto a real workflow.
// Sandbox workflow whose single required input is one *consolidated* workbook
// — multiple datasets (AP register, vendor master, GL) packed into one file as
// separate sheets/sections. Selected by id from the Workflow Library so we can
// build out a dedicated "consolidated file" execution journey (split → identify
// → map → reconcile) independent of the multi-input default executor. This
// workflow is single-run only and never appears in Bulk Run.
const CONSOLIDATED_FILE_WORKFLOW: WorkflowDraft = {
  id: 'lw-consolidated-file',
  name: 'Consolidated file testing- consolidate 1 file',
  description:
    'Sandbox workflow that takes a single consolidated workbook (multiple datasets in one file) and runs the dedicated consolidated-file execution journey end-to-end.',
  category: 'Sandbox',
  tags: ['consolidated', 'sandbox'],
  logicPrompt:
    'The auditor uploads ONE consolidated file that bundles several datasets (AP invoice register, vendor master, GL trial balance) as separate sheets or sections. Split the consolidated file into its constituent datasets, identify and map each one to the expected schema, then reconcile across them. Built as a dedicated single-run journey — bulk execution is intentionally not supported.',
  inputs: [
    {
      id: 'consolidated_workbook',
      name: 'Consolidated Workbook',
      type: 'csv',
      description:
        'A single file bundling the AP invoice register, vendor master, and GL trial balance as separate sheets/sections. The executor splits this into its datasets before mapping. Accepts multiple same-schema files — they are unioned.',
      required: true,
      multiple: true,
      columnSpecs: [
        { name: 'Invoice No', dataType: 'text', sample: 'INV-2026-4871' },
        { name: 'Vendor ID', dataType: 'text', sample: 'V-1234' },
        { name: 'Amount', dataType: 'number', sample: '14,250.00' },
        { name: 'GL Account', dataType: 'text', sample: '5230-001' },
        { name: 'Invoice Date', dataType: 'date', sample: '2026-09-30' },
        { name: 'Entered By', dataType: 'text', sample: 'j.martinez' },
        { name: 'Vendor Name', dataType: 'text', sample: 'Apex Industrial Supplies' },
        { name: 'Bank Account', dataType: 'text', sample: 'XXXX-9012' },
        { name: 'Status', dataType: 'text', sample: 'Active' },
        { name: 'Account', dataType: 'text', sample: '5230-001' },
        { name: 'Debit', dataType: 'number', sample: '14,250.00' },
        { name: 'Credit', dataType: 'number', sample: '0.00' },
        { name: 'Balance', dataType: 'number', sample: '14,250.00' },
      ],
    },
  ],
  steps: [
    {
      id: 's1',
      name: 'Split consolidated file',
      description: 'Detect and separate the bundled datasets (sheets/sections) within the single uploaded file.',
      type: 'extract',
      dataFiles: ['consolidated_workbook'],
    },
    {
      id: 's2',
      name: 'Identify & map each dataset',
      description: 'Match every split-out dataset to its expected schema (AP register, vendor master, GL).',
      type: 'validate',
      dataFiles: ['consolidated_workbook'],
    },
    {
      id: 's3',
      name: 'Reconcile across datasets',
      description: 'Cross-check the split datasets against one another within tolerance.',
      type: 'compare',
      dataFiles: ['consolidated_workbook'],
    },
    {
      id: 's4',
      name: 'Flag exceptions',
      description: 'Emit a flag for each record that fails identification, mapping, or reconciliation.',
      type: 'flag',
      dataFiles: ['consolidated_workbook'],
    },
  ],
  output: {
    type: 'flags',
    title: 'Consolidated File Findings',
    description: 'Records flagged after splitting and reconciling the consolidated workbook.',
  },
};

// Clone of the consolidated-file workflow tuned for the "multiple files" case —
// the auditor uploads several same-schema workbooks that are unioned before the
// split → identify → map → reconcile journey runs. Identical shape to the
// single-file variant (the input already accepts multiple files); only the
// identity and framing differ.
const CONSOLIDATED_FILE_MULTI_WORKFLOW: WorkflowDraft = {
  ...CONSOLIDATED_FILE_WORKFLOW,
  id: 'lw-consolidated-file-multi',
  name: 'Consolidated file testing- multiple files',
  description:
    'Sandbox workflow with one multi-file input (the consolidated workbook, unioned across files) plus two single-file reference inputs. Runs the dedicated consolidated-file execution journey end-to-end.',
  logicPrompt:
    'The auditor uploads SEVERAL consolidated workbooks for the primary input (same schema — unioned before processing) along with one Vendor Master and one GL Trial Balance file. Union the consolidated workbooks, split them into their constituent datasets, identify and map each to the expected schema, then reconcile across them and against the vendor master and GL. Built as a dedicated single-run journey — bulk execution is intentionally not supported.',
  // One multi-file input (inherits multiple: true from the base workflow) plus
  // two single-file reference inputs. Only the consolidated workbook carries the
  // "Multiple files" affordance; the reference files take exactly one file each.
  inputs: [
    ...CONSOLIDATED_FILE_WORKFLOW.inputs,
    {
      id: 'vendor_master',
      name: 'Vendor Master',
      type: 'csv',
      description:
        'Vendor master export used to validate vendor IDs, names, and bank details. One file expected.',
      required: true,
      columnSpecs: [
        { name: 'Vendor ID', dataType: 'text', sample: 'V-1234' },
        { name: 'Name', dataType: 'text', sample: 'Apex Industrial Supplies' },
        { name: 'Bank Account', dataType: 'text', sample: 'XXXX-9012' },
        { name: 'Status', dataType: 'text', sample: 'Active' },
        { name: 'Created On', dataType: 'date', sample: '2024-02-11' },
      ],
    },
    {
      id: 'gl_trial_balance',
      name: 'GL Trial Balance',
      type: 'csv',
      description:
        'Period-end trial balance used to reconcile AP postings against the GL. One file expected.',
      required: true,
      columnSpecs: [
        { name: 'Account', dataType: 'text', sample: '5230-001' },
        { name: 'Description', dataType: 'text', sample: 'AP Liability' },
        { name: 'Debit', dataType: 'number', sample: '14,250.00' },
        { name: 'Credit', dataType: 'number', sample: '0.00' },
        { name: 'Balance', dataType: 'number', sample: '14,250.00' },
      ],
    },
  ],
};

// Clone of the multi-file workflow with the primary slot reframed as a
// REFERENCE role — one master source, joined/looked-up against the other inputs
// rather than unioned. The two reference inputs are unchanged.
const CONSOLIDATED_FILE_REFERENCE_WORKFLOW: WorkflowDraft = {
  ...CONSOLIDATED_FILE_MULTI_WORKFLOW,
  id: 'lw-consolidated-file-reference',
  name: 'Consolidated file testing- reference',
  description:
    'Sandbox workflow whose primary input is a reference/master table — a single source joined against the transaction inputs rather than unioned. Plus two single-file reference inputs.',
  logicPrompt:
    'The primary input is a reference/master table (one source). Validate and look up the transaction inputs (Vendor Master, GL Trial Balance) against it by key — never union the master into the transactions. Built as a dedicated single-run journey — bulk execution is intentionally not supported.',
  inputs: CONSOLIDATED_FILE_MULTI_WORKFLOW.inputs.map((inp) =>
    inp.id === 'consolidated_workbook'
      ? { ...inp, func: 'reference' as const, multiple: false }
      : inp,
  ),
};

// Clone of the multi-file workflow with the primary slot reframed as a COMPARE
// role — two or more same-schema sources kept distinct and aligned for diff
// (e.g. Q1 vs Q2, budget vs actuals), never concatenated.
const CONSOLIDATED_FILE_COMPARE_WORKFLOW: WorkflowDraft = {
  ...CONSOLIDATED_FILE_MULTI_WORKFLOW,
  id: 'lw-consolidated-file-compare',
  name: 'Consolidated file testing- compare',
  description:
    'Sandbox workflow with two compare slots (same schema, e.g. prior vs current period) kept distinct and aligned for diff — never unioned — plus two single-file reference inputs. A comparison needs at least two sources.',
  logicPrompt:
    'Two same-schema sources occupy distinct compare slots and must be kept apart and aligned for comparison (e.g. Q1 vs Q2, budget vs actuals) — never concatenated. Diff the two aligned sources, then reconcile against the Vendor Master and GL Trial Balance. Built as a dedicated single-run journey — bulk execution is intentionally not supported.',
  // Compare needs ≥2 sources, so it's modelled as TWO distinct single-file
  // compare slots (not one multi-file slot) — each takes exactly one file and
  // the two are diffed, never merged.
  inputs: [
    {
      ...CONSOLIDATED_FILE_MULTI_WORKFLOW.inputs[0], // consolidated_workbook
      func: 'compare' as const,
      multiple: false,
    },
    {
      id: 'comparison_workbook',
      name: 'Comparison Workbook',
      type: 'csv',
      description:
        'Second same-schema workbook compared against the Consolidated Workbook — kept distinct and aligned for diff (e.g. prior period vs current). Comparison needs at least two sources.',
      required: true,
      func: 'compare' as const,
      columnSpecs: CONSOLIDATED_FILE_WORKFLOW.inputs[0].columnSpecs,
    },
    ...CONSOLIDATED_FILE_MULTI_WORKFLOW.inputs.filter((i) => i.id !== 'consolidated_workbook'),
  ],
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

// A workflow input can be satisfied by MORE THAN ONE source. When several
// files/sources share the same schema we union them (row-wise concatenation)
// into one logical table and column-map once against the shared schema. This
// is what lets a "1 required file" input accept e.g. a register that arrives
// split across twelve monthly exports.
type MappedSource = {
  name: string;
  type: 'uploaded' | 'datasource';
  rows: number; // approx row count — drives the union total + per-source provenance
  // false => this source's columns diverge from the others in the union, so the
  // union isn't safe until it's removed or re-mapped. undefined/true => consistent.
  schemaOk?: boolean;
};

type FileMapping = {
  inputId: string;
  // 0..N sources unioned into this input. Empty => nothing mapped yet.
  sources: MappedSource[];
  status: 'mapped' | 'unmapped' | 'mismatch';
};

// Derive a mapping's status from its sources: nothing => unmapped; any
// schema-divergent source => mismatch (needs review); otherwise mapped.
function mappingStatus(sources: MappedSource[]): FileMapping['status'] {
  if (sources.length === 0) return 'unmapped';
  if (sources.some(s => s.schemaOk === false)) return 'mismatch';
  return 'mapped';
}

// Deterministic pseudo row-count from a name so union totals stay stable across
// renders (this codebase avoids Math.random/Date.now in render paths).
function seededRows(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return 800 + (h % 4200); // 800–5,000
}

const fmtRows = (n: number) => n.toLocaleString('en-US');

// ─── File-mapping match confidence ───────────────────────────────────────
// Per-input file→input match score for the file-mapping step. Mirrors the
// column-mapping confidence model: ≥90 auto-mapped (green, no review), 70–89
// auto-mapped but flagged (amber), <70 not auto-mapped → manual (red badge,
// still inside the yellow review section). Seeded by input id so the demo
// surfaces all three tiers deterministically.
const FILE_MATCH_SEED: Record<string, number> = {
  ap_invoice_register: 96,
  vendor_master: 82,
  gl_trial_balance: 64,
  consolidated_workbook: 93,
  comparison_workbook: 88,
};

type FileMatchBreakdown = {
  nameSimilarity: number;
  typeCompatibility: number;
  statisticalProfile: number;
  semanticSimilarity: number;
};

type FileMatch = { confidence: number; breakdown: FileMatchBreakdown; verdict: string };

function seedFileMatch(inputId: string): FileMatch {
  let confidence = FILE_MATCH_SEED[inputId];
  if (confidence == null) {
    let h = 0;
    for (let i = 0; i < inputId.length; i++) h = (h * 31 + inputId.charCodeAt(i)) >>> 0;
    confidence = 62 + (h % 36); // 62–97
  }
  const clamp = (n: number) => Math.max(20, Math.min(100, Math.round(n)));
  const breakdown: FileMatchBreakdown = {
    nameSimilarity: clamp(confidence + 4),
    typeCompatibility: clamp(confidence + 7),
    statisticalProfile: clamp(confidence - 6),
    semanticSimilarity: clamp(confidence - 9),
  };
  const verdict =
    confidence >= 90
      ? 'Strong match — file name, schema and value profiles align with this input. Auto-mapped, no review needed.'
      : confidence >= 70
        ? 'Good match — auto-mapped, but a few signals diverge. A quick confirmation is recommended.'
        : 'Weak match — name and value patterns diverge from this input. Map this file manually before continuing.';
  return { confidence, breakdown, verdict };
}

// Tier styling for a file-match score. Both sub-90 tiers keep the yellow
// (mitigated) card border — only the score pill turns red below 70.
function fileMatchTier(confidence: number) {
  if (confidence >= 90) {
    return {
      pillText: 'text-compliant-700',
      pillBg: 'bg-compliant-50',
      pillBorder: 'border-compliant/30',
      cardBorder: 'border-compliant/30',
      cardBg: 'bg-compliant-50/20',
      iconBg: 'bg-compliant-50 text-compliant',
    };
  }
  if (confidence >= 70) {
    return {
      pillText: 'text-mitigated-700',
      pillBg: 'bg-mitigated-50',
      pillBorder: 'border-mitigated-200',
      cardBorder: 'border-mitigated-200',
      cardBg: 'bg-mitigated-50/30',
      iconBg: 'bg-mitigated-50 text-mitigated-700',
    };
  }
  return {
    pillText: 'text-risk-700',
    pillBg: 'bg-risk-50',
    pillBorder: 'border-risk/30',
    cardBorder: 'border-mitigated-200',
    cardBg: 'bg-mitigated-50/30',
    iconBg: 'bg-risk-50 text-risk',
  };
}

const FILE_MATCH_METRICS: { key: keyof FileMatchBreakdown; label: string; weight: number; description: string }[] = [
  { key: 'nameSimilarity', label: 'Name Similarity', weight: 35, description: 'Filename & header token comparison' },
  { key: 'typeCompatibility', label: 'Type Compatibility', weight: 25, description: 'Column type inference & format alignment' },
  { key: 'statisticalProfile', label: 'Statistical Profile', weight: 20, description: 'Row volume, cardinality & null ratio' },
  { key: 'semanticSimilarity', label: 'Semantic Similarity', weight: 20, description: 'Embedding-based meaning comparison' },
];

function matchBarColor(value: number): string {
  if (value >= 90) return 'bg-compliant';
  if (value >= 70) return 'bg-mitigated';
  return 'bg-risk';
}

// Separate type for PDFs/unstructured docs — they can't be auto-mapped to an
// input slot from filename alone, and once mapped have no columns to align
// (we extract fields instead). Keeping this distinct from FileMapping keeps
// the auto-mapping path simple and forces the manual-mapping UI to be
// explicit about its different state model.
type UnstructuredMapping = {
  fileName: string;
  size: number;
  // null until the user explicitly picks an input — even if the file was
  // pre-assigned during upload, we hold it as pending so the user must
  // confirm before the run continues.
  inputId: string | null;
  status: 'pending' | 'mapped' | 'skipped';
};

// Static auto-detect seed for the demo AP flow — used as a fallback when an
// input has no actually-attached files. The AP register seeds TWO sources to
// demonstrate the union; the GL seeds a schema-divergent source so the
// mismatch path stays demoable.
const AUTO_FILE_MAPPINGS: FileMapping[] = [
  {
    inputId: 'ap_invoice_register',
    sources: [
      { name: 'SAP ERP: AP Module', type: 'datasource', rows: 3120 },
      { name: 'ap_invoice_register_jun2026.csv', type: 'uploaded', rows: 1880 },
    ],
    status: 'mapped',
  },
  {
    inputId: 'vendor_master',
    sources: [{ name: 'Invoice Archive 2026', type: 'datasource', rows: 4521 }],
    status: 'mapped',
  },
  {
    inputId: 'gl_trial_balance',
    sources: [{ name: 'Vendor Master Data', type: 'datasource', rows: 2340, schemaOk: false }],
    status: 'mismatch',
  },
];

// Build the file→source mappings shown in the confirm step. Prefer the files
// the user actually attached to each input (so the union reflects reality);
// fall back to the static auto-detect seed for inputs with no attachments.
function buildFileMappings(workflow: WorkflowDraft, files: JourneyFiles): FileMapping[] {
  return workflow.inputs
    .filter(i => i.type !== 'pdf')
    .map(input => {
      const attached = (files[input.id] ?? []).filter(f => !isPdfName(f.name));
      if (attached.length > 0) {
        const sources: MappedSource[] = attached.map(f => ({
          name: f.name,
          type: f.linkedSource ? 'datasource' : 'uploaded',
          rows: f.size ? Math.max(1, Math.round(f.size / 2400)) : seededRows(f.name),
        }));
        return { inputId: input.id, sources, status: mappingStatus(sources) };
      }
      const seed = AUTO_FILE_MAPPINGS.find(m => m.inputId === input.id);
      if (seed) return { inputId: input.id, sources: seed.sources.map(s => ({ ...s })), status: seed.status };
      return { inputId: input.id, sources: [], status: 'unmapped' as const };
    });
}

// Catalog of additional sources the "Add file or source" picker can union in
// (workspace files + connected data sources), surfaced in the file-mapping and
// column-mapping steps. Defined near the data layer so both surfaces share it.
const ADDABLE_FILES: { name: string; size: number }[] = [
  { name: 'ap_invoice_register_jul2026.csv', size: 9_400_000 },
  { name: 'ap_invoice_register_aug2026.csv', size: 8_700_000 },
  { name: 'vendor_master_delta.csv', size: 1_200_000 },
  { name: 'gl_trial_balance_q4_2026.csv', size: 7_900_000 },
];

type ExtractedField = {
  target: string;
  sampleValue: string | null;
  confidence: number; // 0 = not extracted
  reason?: string;
};

// Mocked field-extraction results for the PDF flow. Each entry maps a
// workflow input's expected schema columns to a value the OCR/LLM
// extractor would have returned. Low-confidence and null entries drive
// the "needs manual review" UI in PDFFieldExtractionView.
const PDF_EXTRACTED_FIELDS: Record<string, ExtractedField[]> = {
  ap_invoice_register: [
    { target: 'Invoice No', sampleValue: 'INV-2026-4871', confidence: 97 },
    { target: 'Vendor ID', sampleValue: 'V-1234', confidence: 88 },
    { target: 'Amount', sampleValue: '$14,250.00', confidence: 94 },
    { target: 'GL Account', sampleValue: '5230-001', confidence: 91 },
    { target: 'Invoice Date', sampleValue: '30/09/26', confidence: 62, reason: 'Ambiguous date format (DD/MM/YY vs MM/DD/YY)' },
    { target: 'Entered By', sampleValue: null, confidence: 0, reason: 'No matching field found on the document' },
  ],
  vendor_master: [
    { target: 'Vendor ID', sampleValue: 'V-1234', confidence: 95 },
    { target: 'Name', sampleValue: 'Apex Industrial Supplies', confidence: 92 },
    { target: 'Bank Account', sampleValue: 'XXXX-9012', confidence: 88 },
    { target: 'Status', sampleValue: 'Active', confidence: 67, reason: 'Inferred from context — not labelled in the document' },
    { target: 'Created On', sampleValue: null, confidence: 0, reason: 'No creation date present on the document' },
  ],
  gl_trial_balance: [
    { target: 'Account', sampleValue: '5230-001', confidence: 96 },
    { target: 'Description', sampleValue: 'AP Liability', confidence: 89 },
    { target: 'Debit', sampleValue: '14,250.00', confidence: 91 },
    { target: 'Credit', sampleValue: '0.00', confidence: 70, reason: 'Multiple credit columns detected — picked the first' },
    { target: 'Balance', sampleValue: null, confidence: 0, reason: 'Balance column not detected' },
  ],
};

function isPdfName(name: string): boolean {
  return name.toLowerCase().endsWith('.pdf');
}

// Workspace files available in the "Files" tab of the data picker.
const FILES_LIBRARY: { name: string; size: number }[] = [
  { name: 'ap_invoice_register_sep2026.csv', size: 12_400_000 },
  { name: 'vendor_master_v3.xlsx', size: 2_800_000 },
  { name: 'gl_trial_balance_q3_2026.csv', size: 8_200_000 },
  { name: 'invoice_batch_sep2026.pdf', size: 48_100_000 },
  { name: 'ap_invoice_register_jun2026.csv', size: 9_100_000 },
  { name: 'trial_balance_q2_2026.xlsx', size: 1_600_000 },
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

// Suggested follow-up questions shown beneath the output CTAs. These read as
// an auditor's natural next questions about duplicate-invoice findings — a mix
// of analysis, drill-down, action, and prevention so the user sees the full
// range of what they can do without leaving the result.
const FOLLOW_UP_SUGGESTIONS: string[] = [
  'Which vendor has the most duplicate flags?',
  'Show only matches above 90% confidence',
  "What's the total dollar amount at risk?",
  'Draft a note to the AP team about these duplicates',
  'How do I prevent these duplicates going forward?',
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

// Infer a column's data type from its name when an input only carries plain
// column-name strings (no explicit columnSpecs).
function inferColumnType(name: string): ColumnDataType {
  const n = name.toLowerCase();
  if (/(date|_on|_at|timestamp)\b/.test(n) || n.endsWith('date')) return 'date';
  if (/(amount|balance|debit|credit|qty|quantity|total|rate|price|count|no\.?$|number|#)/.test(n)) return 'number';
  return 'text';
}

// Resolve an input's columns into a uniform ColumnSpec[] — prefers the rich
// columnSpecs, falling back to plain `columns` names with an inferred type.
function resolveColumnSpecs(input: InputSpec): ColumnSpec[] {
  if (input.columnSpecs?.length) return input.columnSpecs;
  return (input.columns ?? []).map((name) => ({ name, dataType: inferColumnType(name) }));
}

function ColumnTypeIcon({ dataType }: { dataType: ColumnDataType }) {
  if (dataType === 'number') return <Hash size={13} className="text-brand-600 shrink-0" />;
  if (dataType === 'date') return <CalendarDays size={13} className="text-brand-600 shrink-0" />;
  return <TypeIcon size={13} className="text-ink-400 shrink-0" />;
}

// Popover listing an input's expected columns (name · type · sample value),
// opened from the "View N columns" button on a Required Files card.
function ExpectedColumnsPopover({
  input,
  cols,
  onClose,
}: {
  input: InputSpec;
  cols: ColumnSpec[];
  onClose: () => void;
}) {
  return (
    <div className="absolute z-30 mt-2 w-[320px] rounded-xl border border-canvas-border bg-canvas-elevated shadow-lg overflow-hidden">
      <div className="flex items-start justify-between gap-2 px-3.5 py-2.5 border-b border-canvas-border">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-bold text-ink-800">Expected columns</span>
            <span className="text-[12px] font-semibold text-ink-400">{cols.length}</span>
          </div>
          <p className="text-[11.5px] text-ink-400 truncate">{input.name}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-ink-400 hover:text-ink-700 cursor-pointer shrink-0"
          aria-label="Close columns list"
        >
          <X size={15} />
        </button>
      </div>
      <div className="max-h-[280px] overflow-y-auto py-1">
        {cols.map((col) => (
          <div key={col.name} className="flex items-start gap-2.5 px-3.5 py-2 hover:bg-canvas">
            <span className="mt-0.5"><ColumnTypeIcon dataType={col.dataType} /></span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[12.5px] font-semibold text-ink-800">{col.name}</span>
                <span className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">
                  {col.dataType}
                </span>
              </div>
              {col.sample != null && (
                <p className="text-[11.5px] font-mono text-ink-400 truncate">{col.sample}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// "X% MATCH" pill + info button shown on each structured file-mapping card.
// Clicking the info button toggles the AI-justification popover.
function FileMatchBadge({
  match,
  open,
  onToggle,
}: {
  match: FileMatch;
  open: boolean;
  onToggle: () => void;
}) {
  const tier = fileMatchTier(match.confidence);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.08em] ${tier.pillText} ${tier.pillBg}`}
      >
        {match.confidence}% match
      </span>
      <button
        type="button"
        onClick={onToggle}
        title="Why this score? — AI justification"
        className={`rounded-full p-0.5 transition-colors cursor-pointer ${open ? 'text-brand-600' : 'text-ink-400 hover:text-ink-600'}`}
      >
        <Info size={13} />
      </button>
    </span>
  );
}

// AI-justification popover for a file-match score — mirrors the column-mapping
// justification (weighted metric breakdown + overall + verdict).
function FileMatchPopover({
  match,
  label,
  onClose,
}: {
  match: FileMatch;
  label: string;
  onClose: () => void;
}) {
  const tier = fileMatchTier(match.confidence);
  return (
    <div className="absolute right-0 z-40 mt-2 w-[340px] rounded-2xl border border-canvas-border bg-canvas-elevated shadow-xl overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-canvas-border">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-brand-50 px-2 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-brand-700">
          <Wand2 size={12} /> AI Justification
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-ink-400 hover:text-ink-700 cursor-pointer"
          aria-label="Close justification"
        >
          <X size={15} />
        </button>
      </div>
      <div className="px-4 py-3 flex flex-col gap-3">
        {FILE_MATCH_METRICS.map((m) => {
          const value = match.breakdown[m.key];
          return (
            <div key={m.key}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12.5px] font-bold text-ink-800">
                  {m.label} <span className="text-ink-400 font-semibold">×{m.weight}%</span>
                </span>
                <span className="text-[13px] font-bold tabular-nums text-ink-800">{value}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-canvas mt-1 overflow-hidden">
                <div className={`h-full rounded-full ${matchBarColor(value)}`} style={{ width: `${value}%` }} />
              </div>
              <p className="text-[11px] text-ink-400 mt-1">{m.description}</p>
            </div>
          );
        })}
        <p className="text-[12px] text-ink-500 leading-relaxed">{match.verdict}</p>
      </div>
      <div className="flex items-center gap-2 px-4 py-2.5 border-t border-canvas-border">
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${tier.pillText} ${tier.pillBg} ${tier.pillBorder}`}>
          Overall: {match.confidence}%
        </span>
        <span className="text-[11.5px] text-ink-400 truncate">{label}</span>
      </div>
    </div>
  );
}

// One structured-file card in the "Confirm file mapping" step. Tier-driven by
// its file-match confidence: ≥90 green/auto, 70–89 amber/auto-with-review,
// <70 manual (red badge, yellow card). Carries the AI-justification popover.
function StructuredFileCard({
  input,
  sources,
  match,
  isMismatch,
  uploadedFiles,
  popoverOpen,
  onAddSource,
  onRemoveSource,
  onTogglePopover,
  onClosePopover,
  flat = false,
}: {
  input: InputSpec;
  sources: MappedSource[];
  match: FileMatch | null;
  isMismatch: boolean;
  uploadedFiles: UploadedFile[];
  popoverOpen: boolean;
  onAddSource: (name: string, type: MappedSource['type'], rows: number) => void;
  onRemoveSource: (name: string) => void;
  onTogglePopover: () => void;
  onClosePopover: () => void;
  /** Flat variant — no card border/tint, for use inside a grouped container. */
  flat?: boolean;
}) {
  const hasSources = sources.length > 0;
  const conf = match?.confidence ?? null;
  const tier = match ? fileMatchTier(match.confidence) : null;

  const isGreen = conf != null && conf >= 90;
  const isAmber = conf != null && conf >= 70 && conf < 90;
  const isLow = conf != null && conf < 70;

  // Below 70% the auto-detected source is too uncertain to surface as a
  // mapping — we show the match score + a manual-mapping prompt, but hide the
  // candidate so the file reads as unmapped until the user confirms it.
  const shownSources = isLow ? [] : sources;
  const unionRows = shownSources.reduce((n, s) => n + s.rows, 0);
  const selectedNames = new Set(shownSources.map((s) => s.name));

  return (
    <div
      className={
        flat
          ? 'py-4'
          : [
              'rounded-xl border p-4 transition-colors',
              !hasSources ? 'border-risk/30 bg-risk-50/20' : `${tier!.cardBorder} ${tier!.cardBg}`,
            ].join(' ')
      }
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={[
            'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
            !hasSources ? 'bg-risk-50 text-risk' : tier!.iconBg,
          ].join(' ')}>
            {isGreen ? <CheckCircle2 size={14} /> : isAmber ? <AlertCircle size={14} /> : isLow ? <AlertTriangle size={14} /> : <AlertCircle size={14} />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-ink-800">{input.name}</span>
              <SlotFunctionTag input={input} />
            </div>
            <div className="text-[11px] text-ink-400">
              {resolveColumnSpecs(input).length} columns · {input.type.toUpperCase()} · {input.required ? 'Required' : 'Optional'}
            </div>
          </div>
        </div>
        <div className="relative flex items-center gap-2 shrink-0">
          {match && <FileMatchBadge match={match} open={popoverOpen} onToggle={onTogglePopover} />}
          {isGreen && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-compliant-50 text-compliant-700 text-[10.5px] font-semibold border border-compliant/25">
              <Check size={10} strokeWidth={3} /> Auto-mapped
            </span>
          )}
          {isAmber && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-mitigated-50 text-mitigated-700 text-[10.5px] font-semibold border border-mitigated-200">
              <Check size={10} strokeWidth={3} /> Auto-mapped · review
            </span>
          )}
          {isLow && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-risk-50 text-risk text-[10.5px] font-semibold border border-risk/25">
              <AlertTriangle size={10} /> Manual mapping required
            </span>
          )}
          {!hasSources && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-risk-50 text-risk text-[10.5px] font-semibold border border-risk/25">
              <AlertCircle size={10} /> Unmapped
            </span>
          )}
          {match && popoverOpen && (
            <FileMatchPopover match={match} label={`${input.name} · file match`} onClose={onClosePopover} />
          )}
        </div>
      </div>

      {shownSources.length > 1 && (
        <div className="flex items-center gap-1.5 mt-1.5 mb-2 text-[11px] text-ink-500">
          <Layers size={11} className="text-brand-600 shrink-0" />
          <span>
            <span className="font-semibold text-ink-700">Unioned</span> · {shownSources.length} sources · ~{fmtRows(unionRows)} combined rows
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mt-2.5">
        {shownSources.length === 0 ? (
          <span className="inline-flex items-center gap-2 rounded-lg border border-dashed border-canvas-border px-3 py-2 text-[12px] text-ink-400 italic">
            <Link2 size={12} className="text-ink-300" />
            No source mapped
          </span>
        ) : (
          shownSources.map((s) => (
            <span
              key={s.name}
              className={[
                'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px]',
                s.schemaOk === false
                  ? 'border-mitigated-200 bg-mitigated-50/60 text-mitigated-700'
                  : 'border-canvas-border bg-canvas text-ink-700',
              ].join(' ')}
              title={s.schemaOk === false ? 'Schema diverges from the other sources' : undefined}
            >
              {s.type === 'datasource' ? (
                <Database size={12} className="text-brand-600 shrink-0" />
              ) : (
                <FileIcon size={12} className="text-ink-400 shrink-0" />
              )}
              <span className="font-medium truncate max-w-[200px]">{s.name}</span>
              <span className="text-[10px] text-ink-400 tabular-nums">~{fmtRows(s.rows)}</span>
              {s.schemaOk === false && <AlertTriangle size={11} className="text-mitigated-700 shrink-0" />}
              <button
                type="button"
                onClick={() => onRemoveSource(s.name)}
                className="text-ink-400 hover:text-risk transition-colors cursor-pointer shrink-0"
                aria-label={`Remove ${s.name}`}
              >
                <X size={12} />
              </button>
            </span>
          ))
        )}

        <AddSourceDropdown
          uploadedFiles={uploadedFiles}
          selectedNames={selectedNames}
          onAdd={(name, type, rows) => onAddSource(name, type, rows)}
          onRemove={(name) => onRemoveSource(name)}
        />
      </div>

      {isLow && (
        <div className="flex items-start gap-2 mt-2.5 px-1">
          <AlertTriangle size={11} className="text-risk shrink-0 mt-0.5" />
          <span className="text-[11px] text-risk-700 leading-relaxed">
            Low match confidence — we couldn&apos;t auto-map a file to this input with certainty. Map a source from your files manually before continuing.
          </span>
        </div>
      )}

      {isMismatch && (
        <div className="flex items-start gap-2 mt-2.5 px-1">
          <AlertTriangle size={11} className="text-mitigated-700 shrink-0 mt-0.5" />
          <span className="text-[11px] text-mitigated-700 leading-relaxed">
            One source&apos;s schema diverges from the others — its columns won&apos;t line up in the union. Remove it or re-map it before continuing.
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────

export default function WorkflowExecutor({ workflowId, onBack, onRunComplete, onFollowUp, onShareResults, onOpenInKnowledgeHub, onComposeInChat }: WorkflowExecutorProps) {
  const { can } = useCan();
  const { addToast } = useToast();
  // Most workflow IDs resolve to the AP duplicate-detection mock. The
  // consolidated-file tester is a dedicated single-run journey driven by one
  // bundled workbook — its own flow is built out separately from the
  // multi-input default executor.
  const workflow =
    workflowId === 'lw-consolidated-file'
      ? CONSOLIDATED_FILE_WORKFLOW
      : workflowId === 'lw-consolidated-file-multi'
        ? CONSOLIDATED_FILE_MULTI_WORKFLOW
        : workflowId === 'lw-consolidated-file-reference'
          ? CONSOLIDATED_FILE_REFERENCE_WORKFLOW
          : workflowId === 'lw-consolidated-file-compare'
            ? CONSOLIDATED_FILE_COMPARE_WORKFLOW
            : EXECUTOR_WORKFLOW;

  // Single "what this run means" insight, derived from the run's own output so
  // the numbers always match the results table. Aggregates the flagged rows by
  // duplicate group: total double-pay exposure, the biggest single group, and
  // the most clear-cut (highest-confidence) match.
  const outputInsight = useMemo<OutputInsight>(() => {
    const money = (s: string) => Number(s.replace(/[$,]/g, ''));
    const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

    const byGroup = new Map<string, typeof RESULTS_DATA>();
    for (const r of RESULTS_DATA) {
      const g = byGroup.get(r.duplicateGroup) ?? [];
      g.push(r);
      byGroup.set(r.duplicateGroup, g);
    }
    const groups = [...byGroup.entries()].map(([id, rows]) => ({
      id,
      vendor: rows[0].vendor,
      amount: money(rows[0].amount),
      amountLabel: rows[0].amount,
      count: rows.length,
      match: Math.max(...rows.map((r) => r.confidence)),
    }));

    const exposure = groups.reduce((sum, g) => sum + g.amount, 0);
    const biggest = [...groups].sort((a, b) => b.amount - a.amount)[0];
    const clearest = [...groups].sort((a, b) => b.match - a.match)[0];

    return {
      severity: 'High',
      takeaway: `${groups.length} duplicate invoice pairs put ${usd(exposure)} at risk of double payment.`,
      shape: `${RESULTS_DATA.length} flags out of 4,521 invoices checked (${((RESULTS_DATA.length / 4521) * 100).toFixed(1)}%), forming ${groups.length} pairs. Each pair bills the same amount under a slightly different spelling of the same vendor — a duplicate-entry pattern, not random noise.`,
      standout: `${biggest.vendor} is the single largest exposure at ${biggest.amountLabel}, and both invoices match at ${biggest.match}%.`,
      atStake: `${usd(exposure)} could be paid twice if these clear settlement. The ${clearest.vendor} pair (${clearest.amountLabel}) is the most clear-cut at ${clearest.match}% — same vendor, same amount.`,
      evidence: [...groups]
        .sort((a, b) => b.amount - a.amount)
        .map((g) => ({
          label: `${g.id} · ${g.vendor}`,
          detail: `${g.amountLabel} billed ${g.count}×`,
          match: `${g.match}% match`,
        })),
    };
  }, []);

  // When the executor is opened from the Audit Logs new-tab flow, the URL
  // carries ?state=completed — boot directly into the "complete" output view
  // with synthetic file entries so the upload section reads as 3/3 satisfied.
  const isPreCompleted = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('state') === 'completed';
  }, []);
  const [phase, setPhase] = useState<ExecutionPhase>(isPreCompleted ? 'complete' : 'idle');
  const [currentStep, setCurrentStep] = useState(isPreCompleted ? workflow.steps.length - 1 : 0);
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
  // Manual-mapping list for any attached PDFs. Sourced from `files` at the
  // moment file-mapping begins so the user reviews exactly what they uploaded.
  const [unstructuredMappings, setUnstructuredMappings] = useState<UnstructuredMapping[]>([]);

  // Column-mapping pause (runs after file mapping is confirmed)
  const [columnMapPending, setColumnMapPending] = useState(false);
  const [alignments, setAlignments] = useState<JourneyAlignments>(() => seedAlignments(workflow));

  // Insufficient-data gate — a required input has too little data, so the whole
  // flow (clarification → mapping) is held back until the user uploads a
  // complete file. Seeded per run in startExecution.
  const [insufficientData, setInsufficientData] = useState(false);

  // Which Required Files card has its "Expected columns" popover open (input id).
  const [columnsViewFor, setColumnsViewFor] = useState<string | null>(null);

  // Which file-mapping card has its AI-justification popover open (input id).
  const [fileMatchFor, setFileMatchFor] = useState<string | null>(null);

  const [files, setFiles] = useState<JourneyFiles>(() => {
    if (!isPreCompleted) return {};
    const seeded: JourneyFiles = {};
    for (const input of workflow.inputs) {
      const ext = input.type === 'pdf' ? 'pdf' : 'csv';
      seeded[input.id] = [
        { name: `${input.id}.${ext}`, size: 1_024_000 + Math.floor(Math.random() * 4_096_000), linkedSource: false },
      ];
    }
    return seeded;
  });
  // PDF executor expands by default — the upload cards live inside this
  // section, so collapsed would hide the only way to upload.
  const [requiredOpen, setRequiredOpen] = useState(() =>
    workflow.inputs.length > 0 && workflow.inputs.every(i => i.type === 'pdf'),
  );
  const [search, setSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Chat-modal-style picker: 3 tabs share one search + one persistent Attached tray.
  const [pickerTab, setPickerTab] = useState<'upload' | 'files' | 'sources'>('upload');

  // "Add Files" opens the same data picker used in chat — one shared surface for
  // uploads, workspace files, and data sources — instead of an inline tab strip.
  const [dataPickerOpen, setDataPickerOpen] = useState(false);

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
  // Right workspace (QnA-style: Plan / Code / Sources). Plan shows this
  // workflow's plan; Code & Sources reuse the chat ArtifactPanel content.
  const [wsTab, setWsTab] = useState<ArtifactTab>('plan');
  // Draggable workspace width, remembered across visits (matches the chat panel).
  const [wsPx, setWsPx] = useState<number>(() => {
    try {
      const raw = localStorage.getItem('wf-executor-workspace-px');
      const n = raw ? parseFloat(raw) : 420;
      return Number.isFinite(n) && n >= 320 ? n : 420;
    } catch { return 420; }
  });
  useEffect(() => {
    try { localStorage.setItem('wf-executor-workspace-px', String(wsPx)); } catch { /* ignore */ }
  }, [wsPx]);
  const startWsDrag = useCallback((e: ReactMouseEvent) => {
    e.preventDefault();
    // Width of the split row = the resize handle's parent (no ref needed).
    const containerW = (e.currentTarget.parentElement as HTMLElement | null)?.offsetWidth ?? window.innerWidth;
    const startX = e.clientX;
    const startWidth = wsPx;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    const onMove = (ev: globalThis.MouseEvent) => {
      const delta = ev.clientX - startX;
      const maxPx = Math.max(320, containerW - 480); // keep the main column ≥ 480px
      setWsPx(Math.max(320, Math.min(maxPx, startWidth - delta)));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [wsPx]);

  // Follow-up composer (output screen) — free-form question about the run.
  const [followUpInput, setFollowUpInput] = useState('');

  // Snapshot the completed run as a seed for the chat handoff. Mirrors the
  // KPI cards and results table rendered in the 'complete' view so the chat
  // recap matches exactly what the user just saw.
  const buildRunSeed = useCallback((): WorkflowRunSeed => ({
    workflowId,
    workflowName: workflow.name,
    category: workflow.category,
    kpis: [
      { label: 'Records Processed', value: '4,521', note: 'Invoice register + vendor master' },
      { label: 'Flags Raised', value: '8', note: '4 duplicate groups detected' },
      { label: 'Execution Duration', value: '3.0s', note: '12% faster than avg' },
    ],
    resultTitle: 'Duplicate Invoice Matches',
    columns: ['Invoice #', 'Vendor', 'Amount', 'Dup. Group', 'Confidence'],
    rows: RESULTS_DATA.map((r) => [
      r.invoiceNo, r.vendor, r.amount, r.duplicateGroup, `${r.confidence}%`,
    ]),
  }), [workflowId, workflow.name, workflow.category]);

  const submitFollowUp = useCallback((query: string) => {
    const q = query.trim();
    if (!q) return;
    onFollowUp?.(q, buildRunSeed());
    setFollowUpInput('');
  }, [onFollowUp, buildRunSeed]);

  const hasRequired = useMemo(
    () =>
      workflow.inputs
        .filter((i) => i.required)
        .every((i) => (files[i.id] ?? []).length > 0),
    [workflow.inputs, files],
  );

  // PDF executor swaps the shared upload tray for per-required-file upload
  // cards. Triggered when every input is PDF-typed, not by workflow id, so
  // future all-PDF workflows pick this surface up automatically.
  const isPdfExecutor = useMemo(
    () => workflow.inputs.length > 0 && workflow.inputs.every(i => i.type === 'pdf'),
    [workflow.inputs],
  );

  const totalFiles = Object.values(files).reduce((n, arr) => n + arr.length, 0);
  // On the completed view the standalone "Upload data files" card is folded
  // into the results header, so we surface the same summary (which inputs got
  // files, and how many required) alongside the output instead.
  const satisfiedInputs = workflow.inputs.filter((i) => (files[i.id] ?? []).length > 0);
  const requiredInputCount = workflow.inputs.filter((i) => i.required).length;

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

  // Backend-mapping simulation: give every required input one file first, then
  // route any extras to the multi-file input (the slot tagged "Multiple files")
  // so single-file inputs stay at one file while the consolidated workbook
  // accumulates the rest. Falls back to the first input when no slot is
  // multi-file.
  const pickTargetInputId = useCallback(
    (current: JourneyFiles): string => {
      const reqInputs = workflow.inputs.filter((i) => i.required);
      for (const inp of reqInputs) {
        if ((current[inp.id] ?? []).length === 0) return inp.id;
      }
      const multiInput = workflow.inputs.find((i) => i.multiple);
      return (multiInput ?? workflow.inputs[0]).id;
    },
    [workflow.inputs],
  );

  const handlePick = useCallback(
    (picked: FileList | null) => {
      if (!can('ds_upload')) return; // uploading files requires the upload permission
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
    [pickTargetInputId, can],
  );

  // PDF executor uses per-slot uploads — one PDF per required input, picked
  // straight into that slot (no auto-routing through pickTargetInputId).
  // Replaces whatever is already in the slot since each input only accepts
  // one document in this flow.
  const handlePickForInput = useCallback(
    (inputId: string, picked: FileList | null) => {
      if (!can('ds_upload')) return; // uploading files requires the upload permission
      if (!picked || picked.length === 0) return;
      const f = picked[0];
      setFiles((prev) => ({
        ...prev,
        [inputId]: [{ name: f.name, size: f.size }],
      }));
    },
    [can],
  );

  const handleRemove = useCallback(
    (inputId: string, index: number) => {
      const existing = files[inputId] ?? [];
      const next = existing.filter((_, i) => i !== index);
      setFiles({ ...files, [inputId]: next });
    },
    [files],
  );

  // True if a library file is currently attached (matched by name, not linkedSource).
  const isLibraryAttached = useCallback(
    (name: string): boolean =>
      Object.values(files)
        .flat()
        .some((f) => !f.linkedSource && f.name === name),
    [files],
  );

  // Toggle a library file: attach via the same auto-mapping as uploads, or detach by name.
  const toggleLibraryFile = useCallback(
    (lib: { name: string; size: number }) => {
      setFiles((prev) => {
        const attached = Object.values(prev)
          .flat()
          .some((f) => !f.linkedSource && f.name === lib.name);
        if (attached) {
          const next: JourneyFiles = {};
          for (const [inputId, arr] of Object.entries(prev)) {
            next[inputId] = arr.filter((f) => f.linkedSource || f.name !== lib.name);
          }
          return next;
        }
        const target = pickTargetInputId(prev);
        return {
          ...prev,
          [target]: [...(prev[target] ?? []), { name: lib.name, size: lib.size }],
        };
      });
    },
    [pickTargetInputId],
  );

  const handleFileDrop = useCallback(
    (e: React.DragEvent<HTMLElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const dropped = e.dataTransfer.files;
      if (dropped && dropped.length > 0) handlePick(dropped);
    },
    [handlePick],
  );

  const toggleSource = useCallback(
    (name: string) => {
      if (!can('ds_live')) return; // linking a live data source requires data-source access
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
    [files, linkedSourceNames, pickTargetInputId, can],
  );

  // Map the chat data-picker's selections onto the executor's input slots. Each
  // selection (an uploaded file or a linked data source) becomes an attachment,
  // auto-routed to the first unsatisfied required input (then piling into the
  // first input — which is how a single-input workflow accumulates its union).
  // Deduped by name against whatever is already attached.
  const handleAddFilesConfirm = useCallback((selections: AttachmentSelection[]) => {
    setDataPickerOpen(false);
    if (selections.length === 0) return;
    // Compute the de-duped additions up front (NOT inside the setFiles updater),
    // so the post-add effects — the toast and clearing the insufficient-data
    // gate — fire reliably instead of racing React's async state updater.
    const seen = new Set(Object.values(files).flat().map((f) => f.name));
    const toAdd: UploadedFile[] = [];
    for (const sel of selections) {
      let file: UploadedFile | null = null;
      if (sel.kind === 'source') file = { name: sel.name, size: 0, linkedSource: true };
      else if (sel.kind === 'upload') file = { name: sel.name, size: sel.sizeBytes };
      // 'connect-db' isn't reachable in chat mode — the Connect tab is kh-add only.
      if (!file || seen.has(file.name)) continue;
      seen.add(file.name);
      toAdd.push(file);
    }
    if (toAdd.length === 0) return;
    setFiles((prev) => {
      const next = { ...prev };
      for (const file of toAdd) {
        const target = pickTargetInputId(next);
        next[target] = [...(next[target] ?? []), file];
      }
      return next;
    });
    addToast({ type: 'success', message: `Added ${toAdd.length} ${toAdd.length === 1 ? 'item' : 'items'} to this workflow.` });
    // A fresh upload resolves the insufficient-data gate, unblocking the flow.
    setInsufficientData(false);
  }, [files, pickTargetInputId, addToast]);

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
    setUnstructuredMappings([]);
    setColumnMapPending(false);
    // Structured executors demo the insufficient-data gate; PDF flows don't.
    setInsufficientData(!isPdfExecutor);
    advance();
  }, [hasRequired, advance, isPdfExecutor]);

  const stopExecution = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPhase('idle');
    setCurrentStep(0);
    setProgress(0);
    setClarificationPending(false);
    setFileMapPending(false);
    setUnstructuredMappings([]);
    setColumnMapPending(false);
    setInsufficientData(false);
  }, []);

  const resolveClarification = useCallback(() => {
    clarificationAnsweredRef.current = true;
    setClarificationPending(false);
    // Workflows whose inputs are all PDFs have no structured auto-mappings
    // to apply — everything routes through the manual journey instead.
    const isAllUnstructured = workflow.inputs.every(i => i.type === 'pdf');
    setFileMappings(isAllUnstructured ? [] : buildFileMappings(workflow, files));
    // Sweep attached files for PDFs. Status depends on the executor:
    //   - PDF executor: each PDF was already placed in a specific slot via
    //     the per-required-file upload card, so we treat the mapping as
    //     already confirmed ('mapped') and skip the file-mapping step.
    //   - Mixed executor: PDFs landed via auto-routing so we hold them in
    //     'pending' and force the user through the file-mapping confirm UI.
    const pdfs: UnstructuredMapping[] = [];
    for (const [inputId, arr] of Object.entries(files)) {
      for (const f of arr) {
        if (isPdfName(f.name)) {
          pdfs.push({
            fileName: f.name,
            size: f.size,
            inputId,
            status: isAllUnstructured ? 'mapped' : 'pending',
          });
        }
      }
    }
    setUnstructuredMappings(pdfs);
    // PDF executor has no manual-review pauses after clarification: the
    // per-slot upload already established file-to-input mapping, and field
    // extraction runs silently as part of execution. The mixed executor
    // still walks through file-mapping → column-mapping confirms.
    if (isAllUnstructured) {
      advance();
    } else {
      setFileMapPending(true);
    }
  }, [files, workflow, advance]);

  const resolveFileMap = useCallback(() => {
    setFileMapPending(false);
    setColumnMapPending(true);
  }, []);

  const resolveColumnMap = useCallback(() => {
    setColumnMapPending(false);
    advance();
  }, [advance]);

  // Step back from column mapping to file mapping. The file mappings are kept,
  // so the user lands on the previous step with their sources intact and can
  // add/remove there before returning.
  const backToFileMap = useCallback(() => {
    setColumnMapPending(false);
    setFileMapPending(true);
  }, []);

  // Append a source to an input's union (or no-op if already present), then
  // recompute the mapping's status. Creates the mapping row if it didn't exist.
  const addSource = useCallback((inputId: string, src: MappedSource) => {
    setFileMappings(prev => {
      const existing = prev.find(m => m.inputId === inputId);
      if (existing) {
        if (existing.sources.some(s => s.name === src.name)) return prev;
        const sources = [...existing.sources, src];
        return prev.map(m => (m.inputId === inputId ? { ...m, sources, status: mappingStatus(sources) } : m));
      }
      return [...prev, { inputId, sources: [src], status: mappingStatus([src]) }];
    });
  }, []);

  // Remove a single source from an input's union and recompute status. Used by
  // both the file-mapping chips and the column-mapping "Mapped sources" chips.
  const removeSource = useCallback((inputId: string, name: string) => {
    setFileMappings(prev =>
      prev.map(m => {
        if (m.inputId !== inputId) return m;
        const sources = m.sources.filter(s => s.name !== name);
        return { ...m, sources, status: mappingStatus(sources) };
      }),
    );
  }, []);

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

      <div className="flex-1 min-h-0 flex overflow-hidden">
        <main className="flex-1 min-w-0 overflow-y-auto bg-canvas">
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
                      {workflow.inputs.map((input) => {
                        const uploaded = (files[input.id] ?? []).length;
                        return (
                          <div
                            key={input.id}
                            className="inline-flex items-center gap-2 rounded-lg border border-canvas-border bg-canvas-elevated px-3 py-1.5 text-[12.5px] font-semibold text-ink-800"
                          >
                            {input.name}
                            <span className="text-[11px] font-semibold uppercase rounded-md bg-canvas border border-canvas-border text-ink-500 px-1.5 py-0.5">
                              {input.type}
                            </span>
                            <SlotFunctionTag input={input} />
                            {isPdfExecutor && uploaded > 0 && (
                              <CheckCircle2 size={12} className="text-compliant" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {requiredOpen && !isPdfExecutor && (
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
                              <SlotFunctionTag input={input} />
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
                            {(() => {
                              const cols = resolveColumnSpecs(input);
                              if (cols.length === 0) return null;
                              const open = columnsViewFor === input.id;
                              return (
                                <div className="relative mt-2.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setColumnsViewFor((v) => (v === input.id ? null : input.id))
                                    }
                                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[12px] font-semibold cursor-pointer transition-colors ${
                                      open
                                        ? 'border-brand-200 bg-brand-50 text-brand-700'
                                        : 'border-canvas-border bg-canvas-elevated text-ink-600 hover:bg-canvas'
                                    }`}
                                  >
                                    <Table2 size={13} />
                                    View {cols.length} columns
                                  </button>
                                  {open && (
                                    <ExpectedColumnsPopover
                                      input={input}
                                      cols={cols}
                                      onClose={() => setColumnsViewFor(null)}
                                    />
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* PDF executor: each required file is its own upload slot.
                      No shared upload tray, no Files/Data Sources tabs — the
                      mental model is "drop one PDF per slot" because that
                      matches how unstructured docs are extracted (one doc =
                      one logical input). */}
                  {requiredOpen && isPdfExecutor && (
                    <div className="px-4 pb-4 border-t border-canvas-border pt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                      {workflow.inputs.map((input) => {
                        const file = (files[input.id] ?? [])[0];
                        return (
                          <RequiredPdfUploadCard
                            key={input.id}
                            input={input}
                            file={file}
                            onPick={(fl) => handlePickForInput(input.id, fl)}
                            onRemove={() => handleRemove(input.id, 0)}
                          />
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* Upload data files — hidden for PDF executor since the
                    Required Files cards above already provide per-slot
                    upload. */}
                {!isPdfExecutor && (
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
                  <div className="border-t border-canvas-border">
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
                    <input
                      ref={folderInputRef}
                      type="file"
                      hidden
                      multiple
                      onChange={(e) => {
                        handlePick(e.target.files);
                        e.target.value = '';
                      }}
                      {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
                    />

                    {/* Add Files CTA — opens the shared chat data picker
                        (uploads · workspace files · data sources) in a modal,
                        instead of an inline tab strip. */}
                    <div className="px-5 pt-4 pb-4">
                      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-canvas-border bg-canvas px-4 py-8 text-center">
                        <div className="w-12 h-12 rounded-full bg-canvas-elevated border border-canvas-border flex items-center justify-center">
                          <UploadCloud size={22} className="text-ink-500" />
                        </div>
                        <div>
                          <div className="text-[14px] font-semibold text-ink-800">Add data to this workflow</div>
                          <div className="text-[12px] text-ink-500 mt-0.5">
                            Upload files, pick from your workspace, or link a data source.
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setDataPickerOpen(true)}
                          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-brand-600 text-white text-[13px] font-semibold hover:bg-brand-500 transition-colors cursor-pointer"
                        >
                          <Plus size={14} />
                          Add Files
                        </button>
                      </div>
                    </div>

                    {/* Persistent Attached tray — shows everything picked via the
                        Add Files modal. Hidden until something is attached (the
                        CTA above already explains the empty state). */}
                    {allAdded.length > 0 && (
                      <div className="border-t border-canvas-border bg-canvas/60">
                        <div className="px-5 py-2.5 flex items-center gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-ink-500">
                            Attached
                          </span>
                          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-ink-800 text-white text-[10.5px] font-semibold">
                            {totalFiles}
                          </span>
                          <span className="ml-auto text-[11px] text-ink-400">
                            {workflow.inputs.filter((i) => (files[i.id] ?? []).length > 0).length}/
                            {workflow.inputs.filter((i) => i.required).length} required inputs satisfied
                          </span>
                        </div>
                        <div className="px-5 pb-3 flex flex-wrap gap-1.5">
                          {allAdded.map(({ file, inputId, index, inputName }) => {
                            const isLinked = !!file.linkedSource;
                            return (
                              <span
                                key={`${inputId}-${file.name}-${index}`}
                                className="inline-flex items-center gap-1.5 h-7 pl-2 pr-1 rounded-md border border-canvas-border bg-canvas-elevated text-[11.5px] text-ink-800 max-w-full"
                                title={`${file.name}${isLinked ? '' : ` · ${humanSize(file.size)}`} · ${inputName}`}
                              >
                                {isLinked ? (
                                  <Database size={11} className="text-ink-500 shrink-0" />
                                ) : (
                                  <FileIcon size={11} className="text-ink-500 shrink-0" />
                                )}
                                <span className="truncate max-w-[200px] font-medium">{file.name}</span>
                                <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider px-1 rounded bg-brand-50 text-brand-700 max-w-[120px] truncate">
                                  {inputName}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRemove(inputId, index)}
                                  aria-label={`Remove ${file.name}`}
                                  className="ml-0.5 w-5 h-5 inline-flex items-center justify-center rounded hover:bg-canvas cursor-pointer text-ink-400 hover:text-ink-800"
                                >
                                  <X size={11} />
                                </button>
                              </span>
                            );
                          })}
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
                              <DatePicker
                                                                value={parameters.dateFrom}
                                onChange={(e) =>
                                  handleParametersChange({ ...parameters, dateFrom: e.target.value })
                                }
                                className="rounded-lg border border-canvas-border bg-canvas-elevated px-2.5 py-2 text-[12.5px] font-mono text-ink-800 focus:outline-none focus:ring-2 focus:ring-brand-600/20 focus:border-brand-600/30 transition-all"
                              />
                              <DatePicker
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
                )}

                {/* PDF executor: dedicated Parameters + Execute card since
                    the Upload data files card (which normally wraps these)
                    is hidden. Keeping the same fields preserves consistency
                    with PlanPanel's Input Config tab. */}
                {isPdfExecutor && (
                  <section className="rounded-xl border border-canvas-border bg-canvas-elevated mb-4">
                    <div className="px-5 py-4">
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
                                <DatePicker
                                                                    value={parameters.dateFrom}
                                  onChange={(e) =>
                                    handleParametersChange({ ...parameters, dateFrom: e.target.value })
                                  }
                                  className="rounded-lg border border-canvas-border bg-canvas-elevated px-2.5 py-2 text-[12.5px] font-mono text-ink-800 focus:outline-none focus:ring-2 focus:ring-brand-600/20 focus:border-brand-600/30 transition-all"
                                />
                                <DatePicker
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
                          Upload a PDF into every required slot above to enable Execute
                        </div>
                      )}
                    </div>
                  </section>
                )}
              </>
            )}

            {/* Collapsed upload summary shown during the run and its paused
                steps — omitted on the column-mapping step to keep that card
                focused on the mapping itself. On the completed view it's folded
                into the results header instead. */}
            {phase === 'running' && !columnMapPending && (
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

                  {/* Insufficient-data gate — blocks the flow (clarification &
                      mapping) until the user uploads a complete file for the
                      affected required input. */}
                  {insufficientData && (
                    <div className="flex items-start gap-2.5 rounded-lg border border-mitigated-200 bg-mitigated-50 px-3 py-2.5 mb-4">
                      <AlertCircle size={14} className="text-mitigated-700 shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
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
                          Upload a complete file to continue — the run stays paused until the data is sufficient.
                        </div>
                        <button
                          type="button"
                          onClick={() => setDataPickerOpen(true)}
                          className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-[12px] font-semibold px-3 py-1.5 transition-colors cursor-pointer"
                        >
                          <UploadCloud size={13} />
                          Upload file
                        </button>
                      </div>
                    </div>
                  )}

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

            {/* Clarification question (pauses execution) — held back until the
                insufficient-data gate is cleared; data comes first. */}
            <AnimatePresence>
              {phase === 'running' && clarificationPending && !insufficientData && (
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

            {/* Step 1: File mapping (pauses execution after clarification) —
                also held back until the insufficient-data gate is cleared. */}
            <AnimatePresence>
              {phase === 'running' && fileMapPending && !insufficientData && (
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

                  {/* Your Files — the inventory of everything added to this run,
                      shown up front so the user can see what they brought before
                      reviewing how each was mapped. */}
                  {(() => {
                    const all: UploadedFile[] = [];
                    const seen = new Set<string>();
                    Object.values(files).flat().forEach((f) => {
                      if (seen.has(f.name)) return;
                      seen.add(f.name);
                      all.push(f);
                    });
                    if (all.length === 0) return null;
                    const ext = (name: string) => {
                      const m = name.match(/\.([a-z0-9]+)$/i);
                      return m ? m[1].toUpperCase() : 'FILE';
                    };
                    const removeEverywhere = (name: string) => {
                      setFiles((prev) => {
                        const next: JourneyFiles = {};
                        Object.entries(prev).forEach(([inputId, list]) => {
                          next[inputId] = list.filter((x) => x.name !== name);
                        });
                        return next;
                      });
                      setFileMappings((prev) =>
                        prev.map((m) => {
                          const srcs = m.sources.filter((s) => s.name !== name);
                          return { ...m, sources: srcs, status: mappingStatus(srcs) };
                        }),
                      );
                    };
                    return (
                      <div className="mt-4 mb-1">
                        <div className="flex items-center gap-2 mb-2.5">
                          <span className="text-[13px] font-bold text-ink-800">Your Files</span>
                          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-canvas border border-canvas-border text-[11px] font-semibold text-ink-500">
                            {all.length}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          {all.map((f) => (
                            <div
                              key={f.name}
                              className="flex items-center gap-2.5 rounded-xl border border-canvas-border bg-canvas-elevated px-3 py-2.5"
                            >
                              <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                                <FileIcon size={15} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-[13px] font-semibold text-ink-800 truncate">{f.name}</div>
                                <div className="text-[11px] text-ink-400">
                                  {f.linkedSource ? 'Linked from data source' : `Uploaded · ${humanSize(f.size)}`}
                                </div>
                              </div>
                              <span className="text-[10px] font-semibold uppercase tracking-wide rounded-md bg-canvas border border-canvas-border text-ink-500 px-1.5 py-0.5 shrink-0">
                                {ext(f.name)}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeEverywhere(f.name)}
                                className="text-ink-400 hover:text-risk transition-colors cursor-pointer shrink-0"
                                aria-label={`Remove ${f.name}`}
                              >
                                <X size={15} />
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="border-t border-canvas-border mt-4" />
                      </div>
                    );
                  })()}

                  {(() => {
                    // Build each structured input's mapping + file-match score,
                    // then split into the ≥90 (green, auto) and <90 (yellow,
                    // review) confidence sections.
                    const items = workflow.inputs
                      .filter((i) => i.type !== 'pdf')
                      .map((input) => {
                        const mapping = fileMappings.find((m) => m.inputId === input.id);
                        const sources = mapping?.sources ?? [];
                        const match = sources.length > 0 ? seedFileMatch(input.id) : null;
                        return {
                          input,
                          sources,
                          match,
                          isMismatch: mapping?.status === 'mismatch',
                        };
                      });
                    const green = items.filter((x) => x.match && x.match.confidence >= 90);
                    const yellow = items.filter((x) => !x.match || x.match.confidence < 90);

                    const renderCard = (x: (typeof items)[number], flat = false) => (
                      <StructuredFileCard
                        key={x.input.id}
                        input={x.input}
                        sources={x.sources}
                        match={x.match}
                        isMismatch={x.isMismatch}
                        uploadedFiles={files[x.input.id] ?? []}
                        popoverOpen={fileMatchFor === x.input.id}
                        onAddSource={(name, type, rows) => addSource(x.input.id, { name, type, rows })}
                        onRemoveSource={(name) => removeSource(x.input.id, name)}
                        onTogglePopover={() => setFileMatchFor((v) => (v === x.input.id ? null : x.input.id))}
                        onClosePopover={() => setFileMatchFor(null)}
                        flat={flat}
                      />
                    );

                    return (
                      <>
                        {/* No section labels — the card colour (green = auto-mapped,
                            amber = needs review) carries the tier on its own. */}
                        {green.length > 0 && (
                          <div className="flex flex-col gap-2.5 mt-4">{green.map((x) => renderCard(x))}</div>
                        )}

                        {yellow.length > 0 && (
                          <div className="rounded-xl border border-mitigated-200 bg-mitigated-50/15 px-4 flex flex-col divide-y divide-mitigated-200/70 mt-3">
                            {yellow.map((x) => renderCard(x, true))}
                          </div>
                        )}
                      </>
                    );
                  })()}

                  {/* Unstructured documents (PDFs) — manual mapping required.
                      Auto-detection can't guess what's in a PDF from filename,
                      so each one is held in 'pending' until the user confirms
                      or re-maps it. Skipped PDFs drop out of the run. */}
                  {unstructuredMappings.length > 0 && (
                    <>
                      <div className="flex items-center gap-2 mt-5 mb-2">
                        <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-500">
                          Unstructured documents
                        </span>
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-mitigated-50 text-mitigated-700 text-[10px] font-semibold border border-mitigated-200">
                          Manual mapping required
                        </span>
                        <div className="flex-1 h-px bg-canvas-border" />
                      </div>
                      <div className="flex items-start gap-2 mb-3 px-0.5">
                        <Info size={12} className="text-ink-400 shrink-0 mt-0.5" />
                        <p className="text-[11.5px] text-ink-500 leading-relaxed">
                          PDFs can&apos;t be auto-mapped. Confirm which workflow input each document satisfies — we&apos;ll then extract fields one-by-one with manual review in the next step.
                        </p>
                      </div>

                      <div className="flex flex-col gap-2.5">
                        {unstructuredMappings.map((pdf) => {
                          const isPending = pdf.status === 'pending';
                          const isMapped = pdf.status === 'mapped';
                          const isSkipped = pdf.status === 'skipped';
                          const mappedInput = pdf.inputId
                            ? workflow.inputs.find(i => i.id === pdf.inputId)
                            : null;
                          return (
                            <div
                              key={pdf.fileName}
                              className={[
                                'rounded-xl border p-4 transition-colors',
                                isMapped
                                  ? 'border-compliant/30 bg-compliant-50/20'
                                  : isSkipped
                                    ? 'border-canvas-border bg-canvas/60 opacity-70'
                                    : 'border-mitigated-200 bg-mitigated-50/30',
                              ].join(' ')}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className={[
                                    'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                                    isMapped
                                      ? 'bg-compliant-50 text-compliant'
                                      : isSkipped
                                        ? 'bg-canvas border border-canvas-border text-ink-400'
                                        : 'bg-mitigated-50 text-mitigated-700',
                                  ].join(' ')}>
                                    <FileText size={16} />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-[13px] font-semibold text-ink-800 truncate">
                                      {pdf.fileName}
                                    </div>
                                    <div className="text-[11px] text-ink-400 flex items-center gap-1.5">
                                      <span>{humanSize(pdf.size)}</span>
                                      <span>·</span>
                                      <span className="font-semibold uppercase">PDF</span>
                                      <span>·</span>
                                      <span>
                                        {isSkipped
                                          ? 'Excluded from this run'
                                          : isMapped
                                            ? `Will populate ${mappedInput?.name ?? 'input'}`
                                            : 'Manual mapping required'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {isMapped && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-compliant-50 text-compliant-700 text-[10.5px] font-semibold border border-compliant/25">
                                      <Check size={10} strokeWidth={3} /> Mapped
                                    </span>
                                  )}
                                  {isPending && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-mitigated-50 text-mitigated-700 text-[10.5px] font-semibold border border-mitigated-200">
                                      <AlertTriangle size={10} /> Needs review
                                    </span>
                                  )}
                                  {isSkipped && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-canvas text-ink-500 text-[10.5px] font-semibold border border-canvas-border">
                                      Skipped
                                    </span>
                                  )}
                                </div>
                              </div>

                              {!isSkipped && (
                                <div className="flex items-center gap-2.5 mt-3 flex-wrap">
                                  <span className="text-[11.5px] font-semibold text-ink-600">
                                    Map to input:
                                  </span>
                                  <InputSlotDropdown
                                    workflow={workflow}
                                    value={pdf.inputId}
                                    onSelect={(id) =>
                                      setUnstructuredMappings(prev =>
                                        prev.map(p =>
                                          p.fileName === pdf.fileName
                                            ? { ...p, inputId: id, status: 'mapped' }
                                            : p,
                                        ),
                                      )
                                    }
                                  />
                                  {isPending && pdf.inputId && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setUnstructuredMappings(prev =>
                                          prev.map(p =>
                                            p.fileName === pdf.fileName
                                              ? { ...p, status: 'mapped' }
                                              : p,
                                          ),
                                        )
                                      }
                                      className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-[11.5px] font-semibold px-2.5 py-1.5 transition-colors cursor-pointer"
                                    >
                                      <Check size={11} strokeWidth={3} />
                                      Confirm
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setUnstructuredMappings(prev =>
                                        prev.map(p =>
                                          p.fileName === pdf.fileName
                                            ? { ...p, status: 'skipped' }
                                            : p,
                                        ),
                                      )
                                    }
                                    className="ml-auto text-[11.5px] font-semibold text-ink-500 hover:text-risk transition-colors cursor-pointer"
                                  >
                                    Skip this file
                                  </button>
                                </div>
                              )}

                              {isSkipped && (
                                <div className="flex items-center gap-2.5 mt-3">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setUnstructuredMappings(prev =>
                                        prev.map(p =>
                                          p.fileName === pdf.fileName
                                            ? { ...p, status: 'pending' }
                                            : p,
                                        ),
                                      )
                                    }
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-canvas-border bg-canvas-elevated hover:bg-canvas text-ink-700 text-[11.5px] font-semibold px-2.5 py-1.5 transition-colors cursor-pointer"
                                  >
                                    <RefreshCw size={11} />
                                    Restore
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}

                  <div className="flex items-center justify-between mt-5">
                    {(() => {
                      // Confirm is gated on three things together:
                      // 1. every required input has SOMETHING mapped to it
                      //    (structured row or PDF)
                      // 2. no structured rows are still 'unmapped'
                      // 3. no PDFs are still 'pending' user review
                      const requiredInputs = workflow.inputs.filter(i => i.required);
                      const requiredSatisfied = requiredInputs.every(input => {
                        const hasStructured = fileMappings.some(
                          m => m.inputId === input.id && m.status !== 'unmapped',
                        );
                        const hasPdf = unstructuredMappings.some(
                          p => p.inputId === input.id && p.status === 'mapped',
                        );
                        return hasStructured || hasPdf;
                      });
                      const noUnmappedStructured = fileMappings.every(m => m.status !== 'unmapped');
                      const noPendingPdfs = unstructuredMappings.every(p => p.status !== 'pending');
                      const canConfirm = requiredSatisfied && noUnmappedStructured && noPendingPdfs;
                      return (
                        <button
                          type="button"
                          onClick={resolveFileMap}
                          disabled={!canConfirm}
                          className={[
                            'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold transition-colors',
                            canConfirm
                              ? 'bg-brand-600 hover:bg-brand-500 text-white cursor-pointer'
                              : 'bg-canvas border border-canvas-border text-ink-400 cursor-not-allowed',
                          ].join(' ')}
                        >
                          Confirm file mapping & continue
                          <ArrowRight size={14} />
                        </button>
                      );
                    })()}
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

            {/* Step 2: Column alignment (after file mapping is confirmed) —
                held back while data is insufficient; the user must upload a
                complete file (via the gate above) before mapping appears. */}
            <AnimatePresence>
              {phase === 'running' && columnMapPending && !insufficientData && (
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
                        {isPdfExecutor ? 'Review extracted fields' : 'Confirm column mapping'}
                      </h3>
                      <p className="text-[11.5px] text-ink-500 mt-0.5">
                        {isPdfExecutor
                          ? 'Each PDF was already assigned to its input during upload. Review the fields we extracted from each document and resolve any low-confidence values.'
                          : 'Review auto-mapped columns and resolve any that need attention before execution continues.'}
                      </p>
                    </div>
                    <span className="text-[12px] text-ink-400 shrink-0">
                      {isPdfExecutor ? 'Step 1 of 1' : 'Step 2 of 2'}
                    </span>
                  </div>

                  {/* Source-drift warning — a pre-run gate on the confirm
                      screen. It owns its own amber alert chrome and collapses to
                      a one-line confirmed strip once the auditor decides. */}
                  {!isPdfExecutor && <SourceDriftBanner />}

                  <ExecutorColumnMapping
                    workflow={workflow}
                    files={files}
                    setFiles={setFiles}
                    alignments={alignments}
                    setAlignments={setAlignments}
                  />

                  <div className="flex items-center justify-between mt-5">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={backToFileMap}
                        className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-[13px] font-semibold text-ink-600 border border-canvas-border bg-canvas-elevated hover:bg-canvas transition-colors cursor-pointer"
                      >
                        <ArrowLeft size={14} />
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={resolveColumnMap}
                        className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold bg-brand-600 hover:bg-brand-500 text-white transition-colors cursor-pointer"
                      >
                        Confirm mapping & continue
                        <ArrowRight size={14} />
                      </button>
                    </div>
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

                  <div className="rounded-2xl border border-canvas-border bg-canvas-elevated overflow-hidden mb-5">
                    <div className="flex items-start justify-between gap-3 px-5 py-3.5 border-b border-canvas-border">
                      <div className="min-w-0">
                        <h3 className="text-[13px] font-bold text-ink-800 flex items-center gap-2">
                          <TrendingUp size={14} className="text-brand-600" />
                          Duplicate Invoice Matches
                        </h3>
                        {/* Upload summary folded in from the (now removed)
                            standalone card: how many files fed the run and
                            which inputs they satisfied — provenance beside the
                            output. */}
                        <div className="flex items-center gap-1.5 mt-1 pl-[22px] text-[11.5px] text-ink-400 min-w-0">
                          <UploadCloud size={11} className="text-ink-300 shrink-0" />
                          <span className="truncate">
                            {totalFiles} file{totalFiles === 1 ? '' : 's'} added · {satisfiedInputs.length}/{requiredInputCount} inputs
                            {satisfiedInputs.length > 0 && (
                              <>
                                {' · '}
                                {satisfiedInputs.slice(0, 2).map((i) => i.name).join(' · ')}
                                {satisfiedInputs.length > 2 ? ` · +${satisfiedInputs.length - 2}` : ''}
                              </>
                            )}
                          </span>
                        </div>
                      </div>
                      <span className="text-[12px] text-ink-400 font-mono shrink-0 mt-0.5">{RESULTS_DATA.length} records</span>
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
                          <span className="flex items-center gap-1.5 min-w-0">
                            <span className="text-[12px] text-ink-800 truncate">{row.vendor}</span>
                            <RowMemoryMarker vendor={row.vendor} />
                          </span>
                          <span className="text-[12px] font-mono text-ink-800 font-medium">{row.amount}</span>
                          <span className="text-[12px] font-mono text-ink-500 bg-canvas px-2 py-0.5 rounded w-fit">{row.duplicateGroup}</span>
                          <ConfidenceChip value={row.confidence} />
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* What this run means — one focused output insight, sitting
                      between the results and the run's actions. */}
                  <WorkflowOutputInsight insight={outputInsight} />

                  <div className="flex items-center gap-2.5 mt-5 mb-5">
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

                  {/* What memory knows — cross-workflow correlation + output
                      compare, shown beneath the output and its actions as
                      supporting context. The source-drift conflict is resolved
                      earlier on the confirm-mapping screen (before approve &
                      run), so it's suppressed here rather than gating the output. */}
                  <div className="mb-5">
                    <WorkflowMemoryPanel showSourceDrift={false} />
                  </div>

                  {/* Follow-up — the primary next step off the results, sitting
                      directly under the run's action buttons. */}
                  {onFollowUp && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.35, duration: 0.3 }}
                      className="mt-5 rounded-2xl border border-canvas-border bg-gradient-to-br from-brand-50/50 to-canvas-elevated p-5"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-6 h-6 rounded-lg bg-brand-100 text-brand-600 flex items-center justify-center">
                          <MessageSquare size={13} />
                        </span>
                        <h3 className="text-[13px] font-bold text-ink-800">Ask a follow-up</h3>
                      </div>
                      <p className="text-[12px] text-ink-500 mb-3.5 pl-8">
                        Keep digging into these results with Ira — it opens a chat with this run already in context.
                      </p>

                      <div className="flex flex-wrap gap-2 mb-3.5">
                        {FOLLOW_UP_SUGGESTIONS.map((q) => (
                          <button
                            key={q}
                            type="button"
                            onClick={() => submitFollowUp(q)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-canvas-border bg-canvas-elevated text-[12px] font-medium text-ink-700 hover:bg-brand-50 hover:text-brand-700 hover:border-brand-200 transition-colors cursor-pointer"
                          >
                            {q}
                            <ArrowRight size={12} className="text-ink-300" />
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-2 rounded-xl border border-canvas-border bg-canvas-elevated pl-3.5 pr-1.5 py-1.5 focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-600/15 transition-all">
                        <input
                          value={followUpInput}
                          onChange={(e) => setFollowUpInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              submitFollowUp(followUpInput);
                            }
                          }}
                          placeholder="Ask anything about these results…"
                          className="flex-1 bg-transparent text-[13px] text-ink-800 placeholder:text-ink-400 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => submitFollowUp(followUpInput)}
                          disabled={!followUpInput.trim()}
                          aria-label="Send follow-up"
                          className={[
                            'shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
                            followUpInput.trim()
                              ? 'bg-brand-600 hover:bg-brand-500 text-white cursor-pointer'
                              : 'bg-canvas border border-canvas-border text-ink-300 cursor-not-allowed',
                          ].join(' ')}
                        >
                          <ArrowUp size={15} />
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* (Compare-vs-last-run + cross-workflow correlation now render
                      via WorkflowMemoryPanel above — the redesigned canonical
                      memory surface — so the older follow-up cards are retired
                      here to avoid showing the same two insights twice.) */}
                </motion.section>
              )}
            </AnimatePresence>

          </div>
        </main>

        {/* Right workspace — same panel as the QnA chat (Plan / Code / Sources),
            with this workflow's plan injected into the Plan tab. Open by
            default, drag-to-resize, collapsible to a thin strip. */}
        {rightOpen ? (
          <>
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize workspace"
              onMouseDown={startWsDrag}
              className="group relative w-px shrink-0 cursor-col-resize bg-canvas-border z-10"
            >
              <span className="absolute inset-y-0 -left-1.5 -right-1.5" />
              <span aria-hidden="true" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-10 rounded-full bg-canvas-border group-hover:bg-brand-300 transition-colors" />
            </div>
            <div className="h-full min-w-0 border-l border-canvas-border" style={{ width: `${wsPx}px`, flex: '0 0 auto' }}>
              <ArtifactPanel
                activeTab={wsTab}
                setActiveTab={setWsTab}
                onClose={() => setRightOpen(false)}
                planSlot={
                  <div className="pt-4 space-y-3">
                    {/* Golden-record reuse + cost summary — only meaningful once
                        the run has executed, so it rides above the plan post-run. */}
                    {phase === 'complete' && <GoldenRecordPlanCard />}
                    <PlanSection workflow={workflow} />
                  </div>
                }
                showHistory
                onShareResults={onShareResults}
                onOpenInKnowledgeHub={onOpenInKnowledgeHub}
                onComposeInChat={onComposeInChat}
              />
            </div>
          </>
        ) : (
          <button
            type="button"
            title="Open workspace"
            aria-label="Open workspace"
            onClick={() => setRightOpen(true)}
            className="w-12 shrink-0 h-full border-l border-canvas-border bg-canvas-elevated flex items-start justify-center pt-3 text-ink-400 hover:text-ink-700 hover:bg-canvas transition-colors cursor-pointer"
          >
            <PanelRightClose size={15} className="rotate-180" />
          </button>
        )}
      </div>

      {/* Shared chat data picker — opened by the "Add Files" CTA. */}
      <DataPickerModal
        open={dataPickerOpen}
        onClose={() => setDataPickerOpen(false)}
        onConfirm={handleAddFilesConfirm}
        title="Add data to this workflow"
        confirmLabel="Add"
        attachHint={<>Pick files or link a data source to add to this workflow.</>}
      />
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
  unstructuredMappings,
}: {
  workflow: WorkflowDraft;
  alignments: JourneyAlignments;
  fileMappings: FileMapping[];
  unstructuredMappings: UnstructuredMapping[];
}) {
  const [expanded, setExpanded] = useState<string | null>(workflow.inputs[0]?.id ?? null);
  const [autoExpanded, setAutoExpanded] = useState<Record<string, boolean>>({});

  return (
    <div className="flex flex-col gap-3">
      {workflow.inputs.map((input) => {
        // Inputs satisfied by a PDF take a different surface entirely —
        // field extraction with manual review, not column alignment. Skipped
        // PDFs fall through to the regular column-alignment card (the
        // structured source still feeds the input).
        const pdf = unstructuredMappings.find(
          p => p.inputId === input.id && p.status === 'mapped',
        );
        if (pdf) {
          return (
            <PDFFieldExtractionView
              key={input.id}
              input={input}
              pdfFileName={pdf.fileName}
            />
          );
        }

        const cols: ColumnAlignment[] = alignments[input.id] ?? [];
        const needsAttention = (c: ColumnAlignment) => c.reason !== null || c.target === null || c.confidence < 75;
        const goodCols = cols.filter(c => !needsAttention(c));
        const attentionCols = cols.filter(c => needsAttention(c));
        const mappedCount = cols.filter(c => c.target !== null).length;
        const totalCount = cols.length;
        const isOpen = expanded === input.id;
        const mapping = fileMappings.find(m => m.inputId === input.id);
        // Read-only here: the column step just shows the union confirmed in the
        // file-mapping step. Changing which sources are included happens there
        // (use the Back button), not on this screen.
        const sources = mapping?.sources ?? [];
        const unionRows = sources.reduce((n, s) => n + s.rows, 0);
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
                {/* Mapped sources — the union feeding this input. When >1
                    source is attached we label it explicitly as a union and
                    explain that the columns below are the shared schema while
                    rows are concatenated across every source. */}
                <div className="px-5 py-4 border-b border-canvas-border/60">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-400">
                        Mapped Sources
                      </span>
                      {sources.length > 1 && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-700 text-[10px] font-bold border border-brand-200">
                          <Layers size={10} />
                          Union of {sources.length}
                        </span>
                      )}
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-compliant-50 text-compliant-700 text-[11px] font-bold border border-compliant/20">
                      Linked
                      <CheckCircle2 size={11} />
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {sources.length === 0 ? (
                      <span className="inline-flex items-center gap-2 rounded-lg border border-dashed border-canvas-border px-3 py-1.5 text-[12px] text-ink-400 italic">
                        No source mapped
                      </span>
                    ) : (
                      sources.map((s) => (
                        // Read-only chip — no toggle, add, or remove on this step.
                        <span
                          key={s.name}
                          className={[
                            'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px]',
                            s.schemaOk === false
                              ? 'border-mitigated-200 bg-mitigated-50/60 text-mitigated-700'
                              : 'border-canvas-border bg-canvas text-ink-700',
                          ].join(' ')}
                          title={s.schemaOk === false ? 'Schema diverges from the other sources' : undefined}
                        >
                          {s.type === 'datasource' ? (
                            <Database size={12} className="text-brand-600 shrink-0" />
                          ) : (
                            <FileIcon size={12} className="text-ink-400 shrink-0" />
                          )}
                          <span className="font-medium truncate max-w-[220px]">{s.name}</span>
                          <span className="text-[10px] text-ink-400 tabular-nums">~{fmtRows(s.rows)}</span>
                          {s.schemaOk === false && <AlertTriangle size={11} className="text-mitigated-700 shrink-0" />}
                        </span>
                      ))
                    )}
                  </div>
                  {sources.length > 1 && (
                    <p className="text-[11px] text-ink-500 leading-relaxed mt-2.5">
                      Columns below are the shared schema across all {sources.length} sources · ~{fmtRows(unionRows)} combined rows. Rows are concatenated; the mapping is applied once to every source.
                    </p>
                  )}
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

// Multi-select picker for unioning additional sources into one input. Unlike a
// plain re-map, this APPENDS — the user can toggle several files/data sources on
// and the dropdown stays open so building a union is one continuous gesture.
// Already-selected sources show a check and toggle off (unselect).
function AddSourceDropdown({
  uploadedFiles,
  selectedNames,
  onAdd,
  onRemove,
}: {
  uploadedFiles: UploadedFile[];
  selectedNames: Set<string>;
  onAdd: (name: string, type: 'uploaded' | 'datasource', rows: number) => void;
  onRemove: (name: string) => void;
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

  const q = search.toLowerCase();

  // Workspace files = the files attached to this input + the shared catalog,
  // deduped by name. These union row-wise so they're the primary group.
  const fileItems = useMemo(() => {
    const seen = new Set<string>();
    const out: { name: string; rows: number }[] = [];
    for (const f of uploadedFiles) {
      if (seen.has(f.name)) continue;
      seen.add(f.name);
      out.push({ name: f.name, rows: f.size ? Math.max(1, Math.round(f.size / 2400)) : seededRows(f.name) });
    }
    for (const f of ADDABLE_FILES) {
      if (seen.has(f.name)) continue;
      seen.add(f.name);
      out.push({ name: f.name, rows: Math.max(1, Math.round(f.size / 2400)) });
    }
    return out.filter(f => f.name.toLowerCase().includes(q));
  }, [uploadedFiles, q]);

  const sourceItems = useMemo(
    () => DATA_SOURCES.filter(s => s.status === 'connected' && s.name.toLowerCase().includes(q)),
    [q],
  );

  const toggle = (name: string, type: 'uploaded' | 'datasource', rows: number) => {
    if (selectedNames.has(name)) onRemove(name);
    else onAdd(name, type, rows);
  };

  const Row = ({
    name, sub, icon, selected, onClick,
  }: { name: string; sub: string; icon: React.ReactNode; selected: boolean; onClick: () => void }) => (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left flex items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-brand-50 transition-colors cursor-pointer"
    >
      {icon}
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-semibold text-ink-800 truncate">{name}</div>
        <div className="text-[10.5px] text-ink-400">{sub}</div>
      </div>
      <span
        className={[
          'w-4 h-4 rounded border flex items-center justify-center shrink-0',
          selected ? 'bg-brand-600 border-brand-600' : 'bg-canvas-elevated border-canvas-border',
        ].join(' ')}
      >
        {selected && <Check size={11} strokeWidth={3} className="text-white" />}
      </span>
    </button>
  );

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-brand-300 bg-brand-50/50 hover:bg-brand-100 text-brand-700 text-[11.5px] font-semibold px-2.5 py-1.5 transition-colors cursor-pointer"
      >
        <Plus size={12} />
        Add file or source
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full mt-1.5 w-[300px] rounded-xl border border-canvas-border bg-canvas-elevated shadow-xl z-50 overflow-hidden"
          >
            <div className="px-3 pt-3 pb-2">
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search files & data sources…"
                  autoFocus
                  className="w-full rounded-lg border border-canvas-border bg-canvas pl-7 pr-3 py-1.5 text-[12px] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-600/20 focus:border-brand-600/30 transition-all"
                />
              </div>
              <p className="text-[10.5px] text-ink-400 mt-2 px-0.5 leading-snug">
                Pick one or more — same-schema sources are unioned into this input.
              </p>
            </div>

            <div className="max-h-[240px] overflow-y-auto px-1.5 pb-1.5">
              {fileItems.length === 0 && sourceItems.length === 0 ? (
                <div className="text-[11.5px] text-ink-400 text-center py-4">No matches</div>
              ) : (
                <>
                  {fileItems.length > 0 && (
                    <div className="px-2 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-400">Files</div>
                  )}
                  {fileItems.map(f => (
                    <Row
                      key={f.name}
                      name={f.name}
                      sub={`~${fmtRows(f.rows)} rows · FILE`}
                      icon={<FileIcon size={12} className="text-ink-400 shrink-0" />}
                      selected={selectedNames.has(f.name)}
                      onClick={() => toggle(f.name, 'uploaded', f.rows)}
                    />
                  ))}
                  {sourceItems.length > 0 && (
                    <div className="px-2 pt-2 pb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-400">Data sources</div>
                  )}
                  {sourceItems.map(s => (
                    <Row
                      key={s.id}
                      name={s.name}
                      sub={`${s.records} records · ${s.type.toUpperCase()}`}
                      icon={<Database size={12} className="text-brand-600 shrink-0" />}
                      selected={selectedNames.has(s.name)}
                      onClick={() => toggle(s.name, 'datasource', seededRows(s.name))}
                    />
                  ))}
                </>
              )}
            </div>

            <div className="border-t border-canvas-border px-3 py-2 flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-[12px] font-semibold text-brand-700 hover:text-brand-800 transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function InputSlotDropdown({
  workflow,
  value,
  onSelect,
}: {
  workflow: WorkflowDraft;
  value: string | null;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selected = workflow.inputs.find(i => i.id === value) ?? null;

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-canvas-border bg-canvas-elevated hover:bg-canvas text-ink-800 text-[12px] font-semibold px-2.5 py-1.5 transition-colors cursor-pointer min-w-[200px]"
      >
        {selected ? (
          <>
            <FileIcon size={11} className="text-brand-600 shrink-0" />
            <span className="truncate">{selected.name}</span>
          </>
        ) : (
          <span className="text-ink-500 italic">Select an input…</span>
        )}
        <ChevronDown size={11} className="text-ink-400 ml-auto shrink-0" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full mt-1.5 w-[260px] rounded-xl border border-canvas-border bg-canvas-elevated shadow-xl z-50 overflow-hidden p-1.5"
          >
            {workflow.inputs.map(i => {
              const isSelected = value === i.id;
              return (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => { onSelect(i.id); setOpen(false); }}
                  className={`w-full text-left flex items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-brand-50 transition-colors cursor-pointer ${isSelected ? 'bg-brand-50/60' : ''}`}
                >
                  <FileIcon size={12} className="text-brand-600 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-semibold text-ink-800 truncate">{i.name}</div>
                    <div className="text-[10.5px] text-ink-400 truncate">
                      {i.columns?.length ?? 0} fields expected · {i.required ? 'Required' : 'Optional'}
                    </div>
                  </div>
                  {isSelected && <Check size={12} className="text-brand-600 shrink-0" strokeWidth={3} />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Column-mapping equivalent for PDF-satisfied inputs. PDFs don't have
// columns to align to a target schema — they have extracted entities with
// extraction confidence. The surface mirrors ColumnAlignmentView in shape
// (high-confidence collapsed, needs-attention expanded) so the two views
// feel like siblings when a workflow mixes structured and unstructured
// inputs, but the actions are different: Confirm / Re-extract / Add
// manually / Skip, not column re-mapping.
function PDFFieldExtractionView({
  input,
  pdfFileName,
}: {
  input: InputSpec;
  pdfFileName: string;
}) {
  const fields = PDF_EXTRACTED_FIELDS[input.id] ?? [];
  const [isOpen, setIsOpen] = useState(true);
  const [autoExpanded, setAutoExpanded] = useState(false);

  const highConf = fields.filter(f => f.confidence >= 80);
  const needsAttention = fields.filter(f => f.confidence < 80);
  const extractedCount = fields.filter(f => f.sampleValue !== null).length;
  const totalCount = fields.length;

  return (
    <div className="rounded-2xl border border-canvas-border bg-canvas-elevated overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-canvas/40 transition-colors cursor-pointer text-left"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-[14px] font-bold text-ink-900">{input.name}</span>
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase rounded bg-mitigated-50 text-mitigated-700 px-1.5 py-0.5 border border-mitigated-200">
            <ScanLine size={9} /> PDF · Manual
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[22px] font-bold text-ink-800 tabular-nums">{extractedCount}/{totalCount}</span>
          <span className="text-[11px] text-ink-400 text-left leading-tight">fields<br />extracted</span>
          {isOpen ? <ChevronUp size={16} className="text-ink-400" /> : <ChevronDown size={16} className="text-ink-400" />}
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-canvas-border">
          {/* Source document */}
          <div className="px-5 py-4 border-b border-canvas-border/60">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-400">
                Source document
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-mitigated-50 text-mitigated-700 text-[11px] font-bold border border-mitigated-200">
                Unstructured
                <FileText size={11} />
              </span>
            </div>
            <div className="inline-flex items-center gap-2 rounded-lg border border-canvas-border bg-canvas px-3 py-1.5">
              <FileText size={12} className="text-mitigated-700" />
              <span className="text-[12.5px] text-ink-700 font-medium">{pdfFileName}</span>
              <button type="button" className="text-ink-400 hover:text-ink-600 transition-colors cursor-pointer">
                <X size={12} />
              </button>
            </div>
          </div>

          {/* Field Extraction header */}
          <div className="px-5 pt-4 pb-2">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-400">
                Field Extraction
              </span>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-brand-700 hover:text-brand-800 transition-colors cursor-pointer"
              >
                <Wand2 size={11} />
                Re-run extraction
              </button>
            </div>

            <div className="grid grid-cols-[1fr_88px_1fr] gap-3 pb-2 border-b border-canvas-border/60">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-400">Extracted value</span>
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-400">Confidence</span>
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-400">Target field</span>
            </div>
          </div>

          {/* Auto-extracted high confidence — collapsed by default */}
          {highConf.length > 0 && (
            <div className="px-5 pb-3">
              <button
                type="button"
                onClick={() => setAutoExpanded(v => !v)}
                className="w-full flex items-center justify-between py-2.5 cursor-pointer group"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-compliant" />
                  <span className="text-[12px] font-semibold text-compliant-700">
                    {highConf.length} fields extracted with high confidence
                  </span>
                </div>
                <span className="text-[11.5px] font-semibold text-ink-500 group-hover:text-brand-700 transition-colors">
                  {autoExpanded ? 'Collapse ↑' : 'Expand ↓'}
                </span>
              </button>

              {autoExpanded && (
                <div className="flex flex-col">
                  {highConf.map(f => (
                    <div
                      key={f.target}
                      className="grid grid-cols-[1fr_88px_1fr] gap-3 items-center py-2.5 border-b border-canvas-border/30 last:border-b-0"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-0.5 h-6 rounded-full bg-brand-400 shrink-0" />
                        <span className="text-[12.5px] font-mono text-ink-800 truncate">{f.sampleValue}</span>
                      </div>
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-[11px] font-bold font-mono bg-compliant-50 text-compliant-700 w-fit">
                        {f.confidence}%
                      </span>
                      <div className="flex items-center gap-1.5 rounded-lg border border-canvas-border bg-canvas px-2.5 py-1 min-w-0">
                        <ArrowRight size={11} className="text-ink-400 shrink-0" />
                        <span className="text-[12.5px] font-medium text-brand-700 truncate">{f.target}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Needs attention — always visible */}
          {needsAttention.length > 0 && (
            <div className="mx-5 mb-4 rounded-xl border border-amber-300/60 bg-amber-50/60 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-amber-200/60">
                <AlertTriangle size={13} className="text-amber-600" />
                <span className="text-[11.5px] font-semibold text-amber-700">
                  {needsAttention.length} {needsAttention.length === 1 ? 'field needs' : 'fields need'} manual review
                </span>
                <span className="text-[11px] text-amber-600/70">
                  — low confidence, ambiguous, or not found
                </span>
              </div>
              <div className="px-4 py-1">
                {needsAttention.map(f => {
                  const found = f.sampleValue !== null;
                  return (
                    <div key={f.target} className="py-3 border-b border-amber-200/40 last:border-b-0">
                      <div className="flex items-center justify-between gap-3 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[12.5px] font-semibold text-amber-900">{f.target}</span>
                          <span className="text-[10.5px] font-bold uppercase rounded bg-amber-100 text-amber-800 px-1.5 py-0.5">
                            Target
                          </span>
                        </div>
                        {found ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold font-mono bg-amber-100 text-amber-800 shrink-0">
                            {f.confidence}%
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-semibold bg-amber-100 text-amber-800 shrink-0">
                            Not extracted
                          </span>
                        )}
                      </div>
                      <div className="mb-2 pl-0.5">
                        {found ? (
                          <div className="text-[11.5px] text-ink-600">
                            Extracted: <span className="font-mono text-ink-800 font-medium">&ldquo;{f.sampleValue}&rdquo;</span>
                          </div>
                        ) : (
                          <div className="text-[11.5px] text-ink-500 italic">
                            No matching value found in the document.
                          </div>
                        )}
                        {f.reason && (
                          <div className="text-[11px] text-amber-700 mt-0.5 flex items-start gap-1">
                            <Info size={10} className="shrink-0 mt-0.5" />
                            <span>{f.reason}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {found ? (
                          <>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-[11.5px] font-semibold px-2.5 py-1 transition-colors cursor-pointer"
                            >
                              <Check size={11} strokeWidth={3} />
                              Confirm value
                            </button>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-canvas-border bg-canvas-elevated hover:bg-canvas text-ink-700 text-[11.5px] font-semibold px-2.5 py-1 transition-colors cursor-pointer"
                            >
                              <RefreshCw size={11} />
                              Re-extract
                            </button>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-canvas-border bg-canvas-elevated hover:bg-canvas text-ink-700 text-[11.5px] font-semibold px-2.5 py-1 transition-colors cursor-pointer"
                            >
                              <Pencil size={11} />
                              Edit
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-[11.5px] font-semibold px-2.5 py-1 transition-colors cursor-pointer"
                            >
                              <Pencil size={11} />
                              Add manually
                            </button>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-canvas-border bg-canvas-elevated hover:bg-canvas text-ink-500 text-[11.5px] font-semibold px-2.5 py-1 transition-colors cursor-pointer"
                            >
                              Skip field
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Per-input upload card used only by the PDF executor. The Required Files
// section IS the upload surface here — one PDF per slot, no shared tray.
// Empty: drop-target + Choose PDF button. Filled: file chip with remove.
function RequiredPdfUploadCard({
  input,
  file,
  onPick,
  onRemove,
}: {
  input: InputSpec;
  file: UploadedFile | undefined;
  onPick: (files: FileList | null) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const hasFile = !!file;

  return (
    <div
      className={[
        'rounded-xl border p-3.5 transition-colors',
        hasFile
          ? 'border-compliant/30 bg-compliant-50/15'
          : 'border-canvas-border bg-canvas-elevated',
      ].join(' ')}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        hidden
        onChange={(e) => {
          onPick(e.target.files);
          e.target.value = '';
        }}
      />

      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
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
          </div>
          <p className="text-[12px] text-ink-500 leading-relaxed mt-1">
            {input.description}
          </p>
        </div>
        {hasFile && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-compliant-50 text-compliant-700 text-[10.5px] font-semibold border border-compliant/25 shrink-0">
            <CheckCircle2 size={10} /> Uploaded
          </span>
        )}
      </div>

      {!hasFile ? (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            onPick(e.dataTransfer.files);
          }}
          className={[
            'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed cursor-pointer transition-colors py-6 px-3 mt-1',
            dragging
              ? 'border-brand-500 bg-brand-50/60'
              : 'border-canvas-border bg-canvas hover:border-brand-300 hover:bg-brand-50/30',
          ].join(' ')}
        >
          <div className="w-9 h-9 rounded-full bg-canvas-elevated border border-canvas-border flex items-center justify-center">
            <UploadCloud size={16} className="text-ink-500" />
          </div>
          <div className="text-center">
            <div className="text-[12.5px] font-semibold text-ink-800">
              Drop a PDF here
            </div>
            <div className="text-[11px] text-ink-500 mt-0.5">
              or click to pick from your computer
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
            className="mt-1 inline-flex items-center gap-1.5 h-7 px-3 rounded-lg bg-brand-600 text-white text-[11.5px] font-semibold hover:bg-brand-500 transition-colors cursor-pointer"
          >
            <Upload size={11} />
            Choose PDF
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2.5 rounded-lg border border-canvas-border bg-canvas-elevated px-3 py-2 mt-1">
          <div className="w-8 h-8 rounded-md bg-mitigated-50 text-mitigated-700 flex items-center justify-center shrink-0">
            <FileText size={14} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] font-semibold text-ink-800 truncate">
              {file.name}
            </div>
            <div className="text-[11px] text-ink-400">{humanSize(file.size)}</div>
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="text-[11.5px] font-semibold text-ink-500 hover:text-brand-700 transition-colors cursor-pointer px-2"
            title="Replace file"
          >
            Replace
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${file.name}`}
            className="w-6 h-6 inline-flex items-center justify-center rounded hover:bg-canvas cursor-pointer text-ink-400 hover:text-risk"
          >
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
