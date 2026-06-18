import { Fragment, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { motion } from 'motion/react';
import {
  TableProperties, X, Search, FileSpreadsheet, FileJson, FileText,
  Upload, Sparkles, FileStack, Check, ArrowRight,
  History, Trash2, ChevronDown, ChevronRight,
} from 'lucide-react';
import { ConciergeFlow } from '../ConciergeKit';
import type { PickedFile, HistoryJob, JobState } from '../types';
import ListPlaceholder from '../../../shared/ListPlaceholder';
import { Button } from '../../../shared/Button';
import { Pill, type Tone } from '../../../shared/StatusBadge';
import { DateFilterPicker, dateInFilter, DEFAULT_DATE_FILTER, type DateFilter } from '../../../shared/DateFilterPicker';
import ConfirmationModal from '../../../shared/ConfirmationModal';

// ─── Result type ─────────────────────────────────────────────────────────────

type RacmEntry = Record<string, string>;
type Result = { entries: RacmEntry[]; fileName: string; summary: string[]; sourceFiles: string[] };

// ─── Mock fixture ────────────────────────────────────────────────────────────
// A realistic Procure-to-Pay / Record-to-Report RACM. The uploaded file carries
// no real bytes in the prototype, so the generated matrix is a fixed, believable
// sample (12 risk/control pairs covering the full schema).

const RACM_ENTRIES: RacmEntry[] = [
  {
    riskId: 'R-001', controlId: 'C-001', processArea: 'Procure to Pay', subProcess: 'Vendor Master Management',
    riskCategory: 'Master Data Integrity',
    riskDescription: 'Fictitious or duplicate vendors are created in the vendor master, enabling fraudulent or duplicate payments.',
    riskRating: 'High', riskLikelihood: 'Possible', riskImpact: 'Major',
    controlObjective: 'Ensure only legitimate, approved vendors are added to the vendor master.',
    controlActivity: 'New vendor requests are independently verified against supporting documentation and approved by the Vendor Master team before activation.',
    controlType: 'Preventive', controlNature: 'Manual', controlFrequency: 'Per transaction', controlOwner: 'Vendor Master Lead',
    controlEvidence: 'Approved vendor onboarding form; verification checklist',
    assertionsCoveredCEAVOP: 'E, O', financialStatementLineItem: 'Accounts Payable', regulatoryReference: 'SOX 404',
    keyReport: 'Vendor Master Change Log', ipeIceDetails: 'Vendor master extract from ERP (IPE)',
    segregationOfDuties: 'Vendor setup is segregated from invoice entry and payment release.',
    managementReviewControl: 'Quarterly review of new and modified vendors by the AP Manager.',
    extractionConfidence: 'EXTRACTED', sopSectionReference: '§3.1',
  },
  {
    riskId: 'R-002', controlId: 'C-002', processArea: 'Procure to Pay', subProcess: 'Invoice Processing',
    riskCategory: 'Financial Loss',
    riskDescription: 'Duplicate invoices are paid because the three-way match is not consistently enforced.',
    riskRating: 'Critical', riskLikelihood: 'Likely', riskImpact: 'Severe',
    controlObjective: 'Prevent duplicate or unauthorised invoice payments.',
    controlActivity: 'The ERP enforces a three-way match (PO, goods receipt, invoice) and blocks duplicate invoice numbers per vendor.',
    controlType: 'Preventive', controlNature: 'Automated', controlFrequency: 'Per transaction', controlOwner: 'AP Automation Owner',
    controlEvidence: 'ERP match-exception report; system configuration screenshot',
    assertionsCoveredCEAVOP: 'A, V, O', financialStatementLineItem: 'Accounts Payable', regulatoryReference: 'SOX 404',
    keyReport: 'Three-Way Match Exception Report', ipeIceDetails: 'Match exception report (ICE)',
    segregationOfDuties: 'Invoice entry is segregated from payment approval.',
    managementReviewControl: 'Monthly review of match exceptions by the AP Manager.',
    extractionConfidence: 'EXTRACTED', sopSectionReference: '§4.2',
  },
  {
    riskId: 'R-003', controlId: 'C-003', processArea: 'Procure to Pay', subProcess: 'Purchase Requisition',
    riskCategory: 'Authorization',
    riskDescription: 'Purchase orders are raised without appropriate budget authority or approval.',
    riskRating: 'High', riskLikelihood: 'Possible', riskImpact: 'Major',
    controlObjective: 'Ensure purchases are authorised within delegated authority limits.',
    controlActivity: 'Purchase orders above threshold require approval per the delegation-of-authority matrix before release.',
    controlType: 'Preventive', controlNature: 'Automated', controlFrequency: 'Per transaction', controlOwner: 'Procurement Manager',
    controlEvidence: 'DOA matrix; PO approval workflow log',
    assertionsCoveredCEAVOP: 'O, A', financialStatementLineItem: 'Expenses', regulatoryReference: 'Companies Act',
    keyReport: 'PO Approval Log', ipeIceDetails: 'PO approval extract (IPE)',
    segregationOfDuties: 'Requisition raised by requestor; approved by an independent budget holder.',
    managementReviewControl: 'Quarterly delegation-of-authority matrix review.',
    extractionConfidence: 'INFERRED', sopSectionReference: '§2.4',
  },
  {
    riskId: 'R-004', controlId: 'C-004', processArea: 'Procure to Pay', subProcess: 'Goods Receipt',
    riskCategory: 'Completeness',
    riskDescription: 'Goods or services received are not recorded on a timely basis, leading to unrecorded liabilities.',
    riskRating: 'Medium', riskLikelihood: 'Possible', riskImpact: 'Moderate',
    controlObjective: 'Ensure all goods and services received are recorded in the correct period.',
    controlActivity: 'Goods receipts are matched to open POs daily and aged un-invoiced receipts are reviewed.',
    controlType: 'Detective', controlNature: 'Manual', controlFrequency: 'Daily', controlOwner: 'Warehouse Supervisor',
    controlEvidence: 'GR/IR aging report',
    assertionsCoveredCEAVOP: 'C, CO', financialStatementLineItem: 'Accrued Liabilities', regulatoryReference: 'IFRS 15',
    keyReport: 'GR/IR Aging Report', ipeIceDetails: 'GR/IR aging (IPE)',
    segregationOfDuties: 'Receiving function is segregated from purchasing.',
    managementReviewControl: 'Monthly GR/IR clearing review by Finance.',
    extractionConfidence: 'EXTRACTED', sopSectionReference: '§5.1',
  },
  {
    riskId: 'R-005', controlId: 'C-005', processArea: 'Procure to Pay', subProcess: 'Invoice Processing',
    riskCategory: 'Accuracy',
    riskDescription: 'Invoice prices differ from agreed contract or PO pricing.',
    riskRating: 'Medium', riskLikelihood: 'Possible', riskImpact: 'Moderate',
    controlObjective: 'Ensure invoices are paid at agreed prices.',
    controlActivity: 'Price variances beyond tolerance are flagged for buyer review and resolution before payment.',
    controlType: 'Detective', controlNature: 'Automated', controlFrequency: 'Per transaction', controlOwner: 'AP Analyst',
    controlEvidence: 'Price variance report',
    assertionsCoveredCEAVOP: 'A, V', financialStatementLineItem: 'Cost of Goods Sold', regulatoryReference: '',
    keyReport: 'Price Variance Report', ipeIceDetails: 'Tolerance configuration (ICE)',
    segregationOfDuties: 'Buyer review is independent of AP invoice entry.',
    managementReviewControl: 'Weekly variance clearing review.',
    extractionConfidence: 'INFERRED', sopSectionReference: '§4.3',
  },
  {
    riskId: 'R-006', controlId: 'C-006', processArea: 'Procure to Pay', subProcess: 'Payment Processing',
    riskCategory: 'Fraud',
    riskDescription: 'A single user can both create and release payments, enabling fraudulent disbursement.',
    riskRating: 'Critical', riskLikelihood: 'Unlikely', riskImpact: 'Severe',
    controlObjective: 'Enforce segregation of duties over payment creation and release.',
    controlActivity: 'Payment proposals are prepared by AP and released by a separate authorised signatory; dual control applies to all payment runs.',
    controlType: 'Preventive', controlNature: 'Manual', controlFrequency: 'Per payment run', controlOwner: 'Treasury Manager',
    controlEvidence: 'Bank dual-authorisation log; SoD matrix',
    assertionsCoveredCEAVOP: 'O, E', financialStatementLineItem: 'Cash', regulatoryReference: 'SOX 404',
    keyReport: 'Payment Run Authorisation Log', ipeIceDetails: 'Payment run report (IPE)',
    segregationOfDuties: 'Payment preparation is segregated from release; dual control enforced.',
    managementReviewControl: 'Monthly segregation-of-duties conflict review.',
    extractionConfidence: 'EXTRACTED', sopSectionReference: '§6.2',
  },
  {
    riskId: 'R-007', controlId: 'C-007', processArea: 'Procure to Pay', subProcess: 'Vendor Master Management',
    riskCategory: 'Fraud',
    riskDescription: 'Vendor bank account details are changed fraudulently, diverting payments to a third party.',
    riskRating: 'High', riskLikelihood: 'Possible', riskImpact: 'Major',
    controlObjective: 'Ensure vendor bank-detail changes are validated and authorised.',
    controlActivity: 'Bank-detail changes require call-back verification to a known contact and dual approval before activation.',
    controlType: 'Preventive', controlNature: 'Manual', controlFrequency: 'Per change', controlOwner: 'Vendor Master Lead',
    controlEvidence: 'Call-back verification record; change approval',
    assertionsCoveredCEAVOP: 'O, E', financialStatementLineItem: 'Accounts Payable', regulatoryReference: '',
    keyReport: 'Bank Detail Change Log', ipeIceDetails: 'Change log (IPE)',
    segregationOfDuties: 'Requestor of the change is separate from the approver.',
    managementReviewControl: 'Quarterly review of all bank-detail changes.',
    extractionConfidence: 'RECOMMENDED', sopSectionReference: '§3.4',
  },
  {
    riskId: 'R-008', controlId: 'C-008', processArea: 'Record to Report', subProcess: 'Period-End Accruals',
    riskCategory: 'Completeness',
    riskDescription: 'Liabilities for received-not-invoiced goods are not accrued at period end.',
    riskRating: 'Medium', riskLikelihood: 'Possible', riskImpact: 'Moderate',
    controlObjective: 'Ensure complete accruals at period end.',
    controlActivity: 'GR/IR balances are reviewed and accrued at month-end by Finance with a supporting schedule.',
    controlType: 'Detective', controlNature: 'Manual', controlFrequency: 'Monthly', controlOwner: 'Financial Controller',
    controlEvidence: 'Accrual journal; GR/IR schedule',
    assertionsCoveredCEAVOP: 'C, CO', financialStatementLineItem: 'Accrued Liabilities', regulatoryReference: 'IFRS',
    keyReport: 'Month-End Accrual Schedule', ipeIceDetails: 'GR/IR balance (IPE)',
    segregationOfDuties: 'Accrual preparer is independent of the approver.',
    managementReviewControl: 'Controller review and sign-off of accruals.',
    extractionConfidence: 'INFERRED', sopSectionReference: '§7.1',
  },
  {
    riskId: 'R-009', controlId: 'C-009', processArea: 'Procure to Pay', subProcess: 'Payment Processing',
    riskCategory: 'Cut-off',
    riskDescription: 'Payments are recorded in the incorrect accounting period.',
    riskRating: 'Low', riskLikelihood: 'Unlikely', riskImpact: 'Minor',
    controlObjective: 'Ensure payments are recorded in the correct period.',
    controlActivity: 'Period-end payment cut-off procedures are applied and bank reconciliations are performed.',
    controlType: 'Detective', controlNature: 'Manual', controlFrequency: 'Monthly', controlOwner: 'AP Manager',
    controlEvidence: 'Bank reconciliation',
    assertionsCoveredCEAVOP: 'CO', financialStatementLineItem: 'Cash', regulatoryReference: '',
    keyReport: 'Bank Reconciliation', ipeIceDetails: 'Bank statement (IPE)',
    segregationOfDuties: 'Reconciliation preparer is independent of payment processing.',
    managementReviewControl: 'Monthly reconciliation review.',
    extractionConfidence: 'EXTRACTED', sopSectionReference: '§6.5',
  },
  {
    riskId: 'R-010', controlId: 'C-010', processArea: 'Procure to Pay', subProcess: 'Contract Management',
    riskCategory: 'Compliance',
    riskDescription: 'Purchases are made outside of approved contracts or against lapsed contracts.',
    riskRating: 'Medium', riskLikelihood: 'Possible', riskImpact: 'Moderate',
    controlObjective: 'Ensure spend is channelled through valid contracts.',
    controlActivity: 'Off-contract spend is reported monthly and reviewed by Procurement; expiring contracts are tracked.',
    controlType: 'Detective', controlNature: 'Manual', controlFrequency: 'Monthly', controlOwner: 'Procurement Manager',
    controlEvidence: 'Off-contract spend report; contract register',
    assertionsCoveredCEAVOP: 'O', financialStatementLineItem: 'Expenses', regulatoryReference: '',
    keyReport: 'Off-Contract Spend Report', ipeIceDetails: 'Contract register (IPE)',
    segregationOfDuties: 'Contract owner is independent of the buyer.',
    managementReviewControl: 'Monthly off-contract spend review.',
    extractionConfidence: 'RECOMMENDED', sopSectionReference: '§2.7',
  },
  {
    riskId: 'R-011', controlId: 'C-011', processArea: 'Procure to Pay', subProcess: 'Vendor Master Management',
    riskCategory: 'Data Quality',
    riskDescription: 'Duplicate vendor records cause reporting inaccuracies and reconciliation effort.',
    riskRating: 'Low', riskLikelihood: 'Possible', riskImpact: 'Minor',
    controlObjective: 'Maintain a clean, de-duplicated vendor master.',
    controlActivity: 'A periodic de-duplication review of the vendor master is performed and exceptions are merged.',
    controlType: 'Detective', controlNature: 'Manual', controlFrequency: 'Quarterly', controlOwner: 'Master Data Analyst',
    controlEvidence: 'De-duplication report',
    assertionsCoveredCEAVOP: '', financialStatementLineItem: 'Accounts Payable', regulatoryReference: '',
    keyReport: 'Vendor De-duplication Report', ipeIceDetails: 'Vendor extract (IPE)',
    segregationOfDuties: 'Review is independent of vendor creation.',
    managementReviewControl: 'Quarterly data-quality review.',
    extractionConfidence: 'INFERRED', sopSectionReference: '§3.6',
  },
  {
    riskId: 'R-012', controlId: 'C-012', processArea: 'Record to Report', subProcess: 'Manual Journals',
    riskCategory: 'Financial Integrity',
    riskDescription: 'Unauthorised or unsupported manual journals are posted to AP and accrual accounts.',
    riskRating: 'High', riskLikelihood: 'Unlikely', riskImpact: 'Major',
    controlObjective: 'Ensure manual journals are authorised and supported.',
    controlActivity: 'Manual journals above threshold require supporting documentation and independent review and approval before posting.',
    controlType: 'Preventive', controlNature: 'Manual', controlFrequency: 'Per transaction', controlOwner: 'Financial Controller',
    controlEvidence: 'Journal approval log; supporting documentation',
    assertionsCoveredCEAVOP: 'A, E, CO', financialStatementLineItem: 'Multiple', regulatoryReference: 'SOX 404',
    keyReport: 'Manual Journal Log', ipeIceDetails: 'Journal entry report (IPE)',
    segregationOfDuties: 'Journal preparer is segregated from the approver.',
    managementReviewControl: 'Monthly manual-journal review by the Controller.',
    extractionConfidence: 'EXTRACTED', sopSectionReference: '§7.4',
  },
];

const SOP_SUMMARY: string[] = [
  'Document parsed into 6 process areas across the procure-to-pay and record-to-report cycles.',
  '12 risks identified and mapped to 12 controls — 2 rated Critical and 4 High.',
  'All Critical risks are covered by preventive controls with enforced segregation of duties.',
  '3 controls are AI-recommended (not explicitly stated in the SOP) — review before adoption.',
  '2 areas rely on manual review only: vendor bank-detail changes and off-contract spend.',
];

// ─── Build / export ──────────────────────────────────────────────────────────

function buildResult(files: PickedFile[], options: Record<string, unknown>): Result {
  const fileName = files[0]?.name ?? 'sop-procure-to-pay.pdf';
  const sourceFiles = files.map((f) => f.name);
  const focus = ((options.customPrompt as string) ?? '').trim();
  const summary = focus
    ? [`Custom instructions applied: "${focus}".`, ...SOP_SUMMARY]
    : SOP_SUMMARY;
  return { entries: RACM_ENTRIES, fileName, summary, sourceFiles };
}

// ─── Create-RACM chooser — multi-file staging ────────────────────────────────
// Reuses the shared ListPlaceholder. The two tiles ADD files to a staged list
// (import a matrix and/or SOPs to extract); the user keeps adding, types optional
// Custom Instructions, then clicks Continue to generate. A 2+ file run is
// consolidated into one RACM with each row tagged by its source file.

const MAX_MB = 25;

// Pick a file glyph from the extension — spreadsheets read as matrices, the rest
// as documents. Keeps the source rows legible at a glance.
function fileGlyph(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') return FileSpreadsheet;
  if (ext === 'json') return FileJson;
  return FileText;
}

function formatBytes(n: number) {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// Source provenance — an imported matrix vs. a doc IRA extracts from. Editorial,
// one tone each, paired with the row's icon chip (evidence = RACM, brand = SOP).
function SourcePill({ source }: { source: 'racm' | 'sop' }) {
  const racm = source === 'racm';
  return (
    <span className={`shrink-0 inline-flex items-center rounded-md px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide ${racm ? 'text-evidence-700 bg-evidence-50' : 'text-brand-700 bg-brand-50'}`}>
      {racm ? 'RACM' : 'SOP'}
    </span>
  );
}

// ─── History helpers ─────────────────────────────────────────────────────────
// The history model stores no source-type or absolute time, but the live job id
// encodes the creation epoch (`job-<ms>-<seq>`) and the file extension implies the
// source. We derive both so each row can read like an audit record.

function inferSource(name: string): 'racm' | 'sop' {
  const ext = name.split('.').pop()?.toLowerCase();
  return ext === 'xlsx' || ext === 'xls' || ext === 'csv' ? 'racm' : 'sop';
}

function entrySource(files: string[]): 'racm' | 'sop' | 'mixed' {
  if (files.length === 0) return 'sop';
  const set = new Set(files.map(inferSource));
  return set.size === 1 ? ([...set][0] as 'racm' | 'sop') : 'mixed';
}

function jobEpoch(id: string): number | null {
  const m = id.match(/^job-(\d+)-/);
  return m ? Number(m[1]) : null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function formatDateTime(ms: number): string {
  const d = new Date(ms);
  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${h}:${mm} ${ampm}`;
}

function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
const STATUS_PILL: Record<string, { label: string; tone: Tone }> = {
  COMPLETED: { label: 'Completed', tone: 'compliant' },
  IN_PROGRESS: { label: 'In progress', tone: 'evidence' },
  FAILED: { label: 'Failed', tone: 'risk' },
  CANCELLED: { label: 'Cancelled', tone: 'draft' },
};

// Source tag — reuses the Sources-list pill for a single type; a neutral pill for
// a consolidated run that mixed a matrix import with SOP extraction.
function EntrySourceTag({ source }: { source: 'racm' | 'sop' | 'mixed' }) {
  if (source === 'mixed') {
    return (
      <span className="shrink-0 inline-flex items-center rounded-md px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-ink-500 bg-paper-100">
        Mixed
      </span>
    );
  }
  return <SourcePill source={source} />;
}

// ─── "What you'll get" preview ───────────────────────────────────────────────
// Disabled per request — the attached-file list fills this space instead. Kept
// here (commented) so it can be re-enabled by restoring <RacmPreview /> above.

/*
const RACM_FIELD_GROUPS = ['Identification', 'Risk Assessment', 'Control Design', 'Financial Reporting', 'Reporting & Evidence', 'Governance'];

function RacmPreview() {
  const controls = RACM_ENTRIES.length;
  const processAreas = new Set(RACM_ENTRIES.map((e) => e.processArea)).size;
  const critical = RACM_ENTRIES.filter((e) => e.riskRating === 'Critical').length;
  const high = RACM_ENTRIES.filter((e) => e.riskRating === 'High').length;
  return (
    <div>
      <h2 className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-ink-400 mb-3">What you'll get</h2>
      <div className="rounded-xl border border-canvas-border bg-canvas-elevated p-5">
        <p className="font-display text-[1.0625rem] text-ink-900 leading-snug">A full Risk &amp; Control Matrix</p>
        <p className="mt-1 text-[0.8125rem] text-ink-500 leading-relaxed">25 fields per control — risks, controls, CEAVOP assertions, and governance, ready for your working papers.</p>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[0.8125rem] text-ink-600">
          <span><span className="font-mono tabular-nums font-semibold text-ink-900">{controls}</span> controls</span>
          <span className="text-canvas-border" aria-hidden>·</span>
          <span><span className="font-mono tabular-nums font-semibold text-ink-900">{processAreas}</span> process areas</span>
          <span className="text-canvas-border" aria-hidden>·</span>
          <span><span className="font-mono tabular-nums font-semibold text-ink-900">{critical}</span> Critical</span>
          <span className="text-canvas-border" aria-hidden>·</span>
          <span><span className="font-mono tabular-nums font-semibold text-ink-900">{high}</span> High</span>
        </div>

        <div className="mt-4 pt-4 border-t border-canvas-border">
          <p className="text-[0.625rem] font-semibold uppercase tracking-wide text-ink-400 mb-2">Matrix structure</p>
          <div className="flex flex-wrap gap-1.5">
            {RACM_FIELD_GROUPS.map((g) => (
              <span key={g} className="inline-flex items-center rounded-md bg-paper-100 px-2 py-1 text-[0.6875rem] font-medium text-ink-600">{g}</span>
            ))}
          </div>
        </div>

        <p className="mt-4 flex items-start gap-2 text-[0.75rem] text-ink-500 leading-relaxed">
          <Sparkles size={13} className="text-brand-600 mt-0.5 shrink-0" />
          AI-recommended controls are flagged so you can review before adopting.
        </p>
      </div>
    </div>
  );
}
*/

// One orchestrated entrance — sections rise and settle on exponential ease-out.
const REVEAL_CONTAINER = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.02 } } };
const REVEAL_ITEM = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
};

// "How it works" steps shown below the upload cards on the empty RACM Generator home.
const HOW_IT_WORKS_STEPS = [
  { title: 'Upload SOP', sub: 'PDF or Word doc' },
  { title: 'Document Parsing', sub: 'AI reads your document' },
  { title: 'Risk Identification', sub: 'Extracts risks & gaps' },
  { title: 'Control Mapping', sub: 'Maps controls to risks' },
  { title: 'Generate RACM', sub: 'Structured matrix output' },
];

function RacmCreateChooser({
  options, setOption, submit,
}: {
  options: Record<string, unknown>;
  setOption: (patch: Record<string, unknown>) => void;
  submit: (files: PickedFile[], extra?: Record<string, unknown>) => void;
}) {
  const racmInputRef = useRef<HTMLInputElement>(null);
  const sopInputRef = useRef<HTMLInputElement>(null);
  const prompt = (options.customPrompt as string) ?? '';
  const [staged, setStaged] = useState<{ file: PickedFile; source: 'racm' | 'sop' }[]>([]);
  // Names of files dropped from the most recent pick because they exceed MAX_MB —
  // surfaced inline (size only; duplicate-name skips stay silent). Replaced each pick.
  const [rejected, setRejected] = useState<string[]>([]);
  const hasFile = staged.length > 0;

  const addFiles = (e: ChangeEvent<HTMLInputElement>, source: 'racm' | 'sop') => {
    const all = Array.from(e.target.files ?? []);
    const accepted = all.filter((f) => f.size <= MAX_MB * 1024 * 1024);
    const tooLarge = all.filter((f) => f.size > MAX_MB * 1024 * 1024);
    e.target.value = '';
    setRejected(tooLarge.length ? tooLarge.map((f) => f.name) : []);
    const picked = accepted.map((f) => ({ file: { name: f.name, size: f.size, type: f.type } as PickedFile, source }));
    setStaged((prev) => {
      const names = new Set(prev.map((s) => s.file.name));
      return [...prev, ...picked.filter((p) => !names.has(p.file.name))];
    });
  };

  const removeFile = (name: string) => setStaged((prev) => prev.filter((s) => s.file.name !== name));

  const onContinue = () => {
    if (staged.length === 0) return;
    submit(staged.map((s) => s.file), { customPrompt: prompt, sources: staged.map((s) => s.source) });
  };

  const fileInputs = (
    <>
      <input ref={racmInputRef} type="file" accept=".xlsx,.csv" multiple className="hidden" onChange={(e) => addFiles(e, 'racm')} />
      <input ref={sopInputRef} type="file" accept=".pdf,.doc,.docx" multiple className="hidden" onChange={(e) => addFiles(e, 'sop')} />
    </>
  );

  // Inline notice for files skipped because they exceed MAX_MB — shared by both
  // states. Renders nothing when the last pick had no oversized files.
  const rejectedNotice = rejected.length > 0 ? (
    <p className="mt-2 text-[0.75rem] text-risk-700">
      {rejected.length === 1
        ? `“${rejected[0]}” is larger than ${MAX_MB} MB and wasn’t added.`
        : `${rejected.length} files are larger than ${MAX_MB} MB and weren’t added.`}
    </p>
  ) : null;

  // Custom-instructions field — shared by both states. Teaches what it steers.
  const instructions = (
    <div className="text-left">
      <label htmlFor="racm-instructions" className="block text-[0.8125rem] font-semibold text-ink-700">
        Custom Instructions <span className="text-ink-400 font-normal">(Optional)</span>
      </label>
      <textarea
        id="racm-instructions"
        value={prompt}
        onChange={(e) => setOption({ customPrompt: e.target.value })}
        rows={3}
        placeholder="E.g., Focus on procurement risks, include IT general controls…"
        className="mt-2 w-full rounded-xl border border-canvas-border bg-canvas-elevated text-[0.84375rem] text-ink-700 px-3.5 py-2.5 outline-none transition-colors focus:border-brand-300 resize-y placeholder:text-ink-300"
      />
    </div>
  );

  // Generate bar — states what Continue produces (mono count).
  const footer = (
    <div className="flex items-center justify-between gap-4">
      <p className="text-[0.8125rem] leading-relaxed">
        <span className="text-ink-500">
          Generates a Risk &amp; Control Matrix from{' '}
          <span className="font-mono tabular-nums text-ink-700">{staged.length}</span>{' '}
          source{staged.length === 1 ? '' : 's'}.
        </span>
      </p>
      <Button variant="primary" size="md" onClick={onContinue} rightIcon={<ArrowRight size={15} />}>
        Continue
      </Button>
    </div>
  );

  // ── Working state — centered editorial composition ─────────────────────────
  // Once a source is staged we drop the placeholder and set the step as a workspace:
  // upload actions at the top (right-aligned), then a labeled Sources block, the
  // instructions field, and a generate bar.
  if (hasFile) {
    return (
      <motion.div variants={REVEAL_CONTAINER} initial="hidden" animate="show" className="flex flex-col h-full">
        <motion.div variants={REVEAL_ITEM} className="shrink-0 flex flex-wrap items-center justify-end gap-2.5">
          <Button variant="outline" size="md" onClick={() => racmInputRef.current?.click()} leftIcon={<Upload size={15} />}>
            Add a RACM
          </Button>
          <Button variant="outline" size="md" onClick={() => sopInputRef.current?.click()} leftIcon={<Sparkles size={15} />}>
            Add an SOP <span className="ml-1 text-ink-400 font-normal">→ extract</span>
          </Button>
        </motion.div>

        {rejectedNotice && (
          <motion.div variants={REVEAL_ITEM} className="shrink-0 text-right">{rejectedNotice}</motion.div>
        )}

        <motion.div variants={REVEAL_ITEM} className="shrink-0 mt-8 mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-ink-400">Sources</h2>
          <span className="text-[0.75rem] text-ink-400">
            <span className="font-mono tabular-nums text-ink-600">{staged.length}</span> {staged.length === 1 ? 'file' : 'files'}
          </span>
        </motion.div>

        {/* Sources list — the only scrollable region. Hugs its content when there
            are a few files; shrinks and scrolls internally when there are many, so
            the page itself never scrolls. */}
        <motion.div variants={REVEAL_ITEM} className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-canvas-border bg-canvas-elevated divide-y divide-canvas-border mb-4">
          {staged.map((s) => {
            const Glyph = fileGlyph(s.file.name);
            const size = formatBytes(s.file.size);
            return (
              <div key={s.file.name} className="group flex items-center gap-3 px-3.5 py-3">
                <span className={`w-8 h-8 rounded-lg inline-flex items-center justify-center shrink-0 ${s.source === 'racm' ? 'bg-evidence-50' : 'bg-brand-50'}`}>
                  <Glyph size={15} className={s.source === 'racm' ? 'text-evidence-700' : 'text-brand-600'} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[0.84375rem] text-ink-800 truncate">{s.file.name}</p>
                    <SourcePill source={s.source} />
                  </div>
                  {size && <p className="text-[0.6875rem] text-ink-400 font-mono tabular-nums">{size}</p>}
                </div>
                <button
                  onClick={() => removeFile(s.file.name)}
                  aria-label={`Remove ${s.file.name}`}
                  className="shrink-0 p-1 rounded-md text-ink-300 hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                >
                  <X size={15} />
                </button>
              </div>
            );
          })}
        </motion.div>

        {/* "What you'll get" preview disabled per request — the Sources list fills this space instead. Re-enable with <RacmPreview />. */}

        <motion.div variants={REVEAL_ITEM} className="shrink-0 mt-8">{instructions}</motion.div>

        <motion.div variants={REVEAL_ITEM} className="shrink-0 mt-6">{footer}</motion.div>

        {fileInputs}
      </motion.div>
    );
  }

  // ── Empty state — placeholder + cards, then a "how it works" explainer ──────
  return (
    <div>
      <ListPlaceholder
        className="!pt-8 !pb-5"
        icon={FileStack}
        title="Start your RACM library"
        body="Upload an existing matrix or SOPs to extract — Ira consolidates them into one RACM."
        action={
          <div className="w-full max-w-2xl mx-auto space-y-5">
            <div className="grid grid-cols-2 gap-3 text-left">
              <button onClick={() => racmInputRef.current?.click()} className="group text-left rounded-xl border border-border-light bg-canvas-elevated hover:border-primary/40 hover:bg-primary-xlight/30 p-5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2">
                <div className="p-2 rounded-lg bg-evidence-50 inline-flex mb-3"><Upload size={16} className="text-evidence-700" /></div>
                <div className="text-[0.84375rem] font-semibold text-text mb-1">Upload a RACM</div>
                <div className="text-[0.71875rem] text-text-muted leading-relaxed">Import an existing matrix (.xlsx / .csv).</div>
              </button>
              <button onClick={() => sopInputRef.current?.click()} className="group text-left rounded-xl border border-border-light bg-canvas-elevated hover:border-primary/40 hover:bg-primary-xlight/30 p-5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2">
                <div className="p-2 rounded-lg bg-brand-50 inline-flex mb-3"><Sparkles size={16} className="text-brand-600" /></div>
                <div className="text-[0.84375rem] font-semibold text-text mb-1 flex items-center gap-1.5">Upload an SOP <span className="text-text-muted">→</span> extract</div>
                <div className="text-[0.71875rem] text-text-muted leading-relaxed">Upload a procedure doc (.pdf/.docx). Ira reads and drafts it.</div>
              </button>
            </div>

            {fileInputs}
            {rejectedNotice}
          </div>
        }
      />

      {/* How it works — onboarding explainer (empty state only); width matches the header subtitle */}
      <div className="max-w-4xl mx-auto pb-6">
        <div className="pt-6 border-t border-canvas-border">
          <p className="text-center text-[0.9375rem] text-ink-500 leading-relaxed">
            Transform your Standard Operating Procedures into structured Risk Assessment and Control Matrices — AI identifies risks, maps controls, and highlights compliance gaps automatically.
          </p>
          <p className="mt-4 text-center text-[0.6875rem] font-bold uppercase tracking-[0.18em] text-ink-400">How it works</p>
          <ol className="mt-5 flex items-start justify-center gap-1.5 flex-wrap">
            {HOW_IT_WORKS_STEPS.map((s, i) => (
              <Fragment key={s.title}>
                <li className="flex flex-col items-center text-center w-[8rem] shrink-0">
                  <span className="w-9 h-9 rounded-full bg-canvas-elevated border border-canvas-border text-brand-700 font-mono font-bold text-sm flex items-center justify-center">{i + 1}</span>
                  <span className="mt-2.5 text-[0.8125rem] font-semibold text-ink-800">{s.title}</span>
                  <span className="mt-0.5 text-[0.75rem] text-ink-400 leading-snug">{s.sub}</span>
                </li>
                {i < HOW_IT_WORKS_STEPS.length - 1 && <ChevronRight size={16} className="hidden md:block text-ink-300 mt-2.5 shrink-0" />}
              </Fragment>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

// ─── RACM loader — richer processing screen (Image #4 reference) ─────────────
// Numbered step rail + connectors, sub-status, progress + elapsed, a "close
// page" note + Cancel, a timestamped Activity Log, and "What we're checking" /
// "Did you know?" cards with carousel dots. RACM-only (passed via renderProgress).

function RacmLoader({ state, stages, fileName, checking, tips, onCancel }: {
  state: JobState<Result>;
  stages: { id: string; label: string }[];
  fileName: string;
  checking: string[];
  tips: string[];
  onCancel: () => void;
}) {
  const [confirmStop, setConfirmStop] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!state.startedAt) return;
    const id = window.setInterval(() => setElapsed(Date.now() - (state.startedAt ?? Date.now())), 500);
    return () => window.clearInterval(id);
  }, [state.startedAt]);
  const mm = String(Math.floor(elapsed / 60000)).padStart(2, '0');
  const ss = String(Math.floor((elapsed % 60000) / 1000)).padStart(2, '0');

  // Rough estimate of time remaining — progress advances linearly, so we can
  // extrapolate from how long the current progress took.
  const remainingS = state.progress > 0 && state.progress < 100
    ? Math.max(1, Math.round((elapsed / state.progress) * (100 - state.progress) / 1000))
    : null;

  // The files being processed (fileName arrives as a ", "-joined list).
  const sources = fileName ? fileName.split(', ').filter(Boolean) : [];

  // Plain-language activity log — append a line whenever the status changes.
  const [log, setLog] = useState<{ time: string; msg: string }[]>([]);
  const lastMsg = useRef('');
  useEffect(() => {
    const msg = state.message;
    if (!msg || msg === lastMsg.current) return;
    lastMsg.current = msg;
    const d = new Date();
    const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    setLog((prev) => [...prev, { time, msg }]);
  }, [state.message]);

  // Tips carousel.
  const [tipIdx, setTipIdx] = useState(0);
  useEffect(() => {
    if (tips.length <= 1) return;
    const id = window.setInterval(() => setTipIdx((i) => (i + 1) % tips.length), 5000);
    return () => window.clearInterval(id);
  }, [tips.length]);

  const subStatus = state.message || (state.status === 'UPLOADING' ? 'Uploading…' : 'Starting…');

  return (
    <>
    <div className="h-full max-w-6xl flex flex-col min-h-0">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 flex-1 min-h-0 lg:items-stretch">
      <div className="lg:col-span-3 flex flex-col min-h-0 rounded-xl border border-canvas-border bg-canvas-elevated p-5">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={16} className="text-brand-600 animate-pulse shrink-0" />
          <span className="text-[0.875rem] font-semibold text-ink-800">
            Processing <span className="font-mono tabular-nums">{sources.length}</span> source{sources.length === 1 ? '' : 's'}
          </span>
        </div>
        {sources.length > 0 && (
          <p className="text-[0.75rem] text-ink-400 mb-5 leading-relaxed">{sources.join('  ·  ')}</p>
        )}

        <div className="flex items-start mb-5">
          {stages.map((s, i) => {
            const done = i < state.stageIndex;
            const active = i === state.stageIndex;
            return (
              <div key={s.id} className="flex items-start flex-1 last:flex-none">
                <div className="flex flex-col items-center shrink-0">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[0.6875rem] font-semibold ${done ? 'bg-brand-600 text-white' : active ? 'bg-brand-100 text-brand-700 ring-2 ring-brand-300' : 'bg-paper-100 text-ink-400'}`}>
                    {done ? <Check size={13} /> : i + 1}
                  </div>
                  <span className={`mt-1.5 text-xs text-center whitespace-nowrap ${active ? 'text-brand-700 font-semibold' : 'text-ink-400'}`}>{s.label}</span>
                </div>
                {i < stages.length - 1 && <div className={`flex-1 h-px mt-3.5 mx-1 ${done ? 'bg-brand-300' : 'bg-canvas-border'}`} />}
              </div>
            );
          })}
        </div>

        <p className="text-[0.8125rem] text-ink-700 mb-2" role="status" aria-live="polite">{subStatus}</p>

        <div
          className="h-2 rounded-full bg-paper-100 overflow-hidden mb-1.5"
          role="progressbar"
          aria-valuenow={state.progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="RACM generation progress"
        >
          <motion.div className="h-full rounded-full bg-brand-600" animate={{ width: `${state.progress}%` }} transition={{ ease: 'easeOut', duration: 0.3 }} />
        </div>
        <div className="flex items-center justify-between text-[0.6875rem] text-ink-400 tabular-nums">
          <span>{state.progress}%</span>
          <span>{mm}:{ss} elapsed{remainingS != null ? `  ·  ~${remainingS}s remaining` : ''}</span>
        </div>

        <div className="flex items-center justify-between gap-3 mt-4">
          <p className="text-[0.6875rem] text-ink-400">Leave this page anytime — your RACM keeps generating and saves automatically.</p>
          <button onClick={() => setConfirmStop(true)} title="Stop generating" className="shrink-0 inline-flex items-center px-3 py-1.5 rounded-lg border border-canvas-border text-[0.8125rem] font-medium text-ink-600 hover:text-risk-700 hover:border-risk-200 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">Stop generating</button>
        </div>

        <div className="mt-4 flex-1 min-h-0 flex flex-col rounded-lg bg-paper-50/70 border border-canvas-border p-3">
          <div className="text-[0.6875rem] font-semibold text-ink-400 uppercase tracking-wide mb-1.5">Activity log</div>
          <div className="flex-1 min-h-0 overflow-y-auto space-y-0.5">
            {log.length === 0 ? (
              <p className="text-[0.6875rem] text-ink-400">Starting…</p>
            ) : log.map((l, i) => (
              <p key={i} className="text-[0.6875rem] text-ink-500 leading-relaxed">
                <span className="text-ink-400 tabular-nums mr-2">{l.time}</span>{l.msg}
              </p>
            ))}
          </div>
        </div>
      </div>

      <div className="lg:col-span-2 flex flex-col gap-4 min-h-0">
        <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-5 flex flex-col">
          <div className="text-[0.6875rem] font-semibold text-brand-700 uppercase tracking-wide mb-3">Did you know?</div>
          <div className="flex-1 flex flex-col justify-center">
            <p className="text-[0.8125rem] text-ink-600 leading-relaxed">{tips[tipIdx]}</p>
            {tips.length > 1 && (
              <div className="flex items-center gap-1.5 mt-3">
                {tips.map((_, i) => (
                  <span key={i} className={`h-1.5 rounded-full transition-all ${i === tipIdx ? 'w-4 bg-brand-600' : 'w-1.5 bg-brand-200'}`} />
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex-1 min-h-0 rounded-xl border border-canvas-border bg-canvas-elevated p-5">
          <div className="text-[0.6875rem] font-semibold text-ink-400 uppercase tracking-wide mb-3">What we're checking</div>
          <div className="space-y-2.5">
            {checking.map((c) => (
              <div key={c} className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-md inline-flex items-center justify-center shrink-0 mt-px bg-paper-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-ink-300" />
                </span>
                <span className="text-[0.75rem] leading-relaxed text-ink-600">{c}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      </div>
    </div>
    <ConfirmationModal
      open={confirmStop}
      title="Stop generating?"
      description={<>This discards the RACM in progress and can't be undone.</>}
      confirmLabel="Stop & discard"
      cancelLabel="Keep going"
      tone="destructive"
      onConfirm={() => { setConfirmStop(false); onCancel(); }}
      onClose={() => setConfirmStop(false)}
    />
    </>
  );
}

// ─── History seed ────────────────────────────────────────────────────────────
// Ids use the live `job-<ms>-<seq>` shape so the same timestamp parsing works for
// seed and real runs alike. Times are anchored to load so the buckets stay sensible.

const SEED_NOW = Date.now();
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const HISTORY_SEED: HistoryJob[] = [
  // Today
  { id: `job-${SEED_NOW - 12 * 60_000}-11`, files: ['q3-payroll-controls.xlsx'], status: 'IN_PROGRESS', createdAt: '12m ago' },
  { id: `job-${SEED_NOW - 2 * HOUR}-10`, files: ['order-to-cash-sop.pdf'], status: 'COMPLETED', createdAt: '2h ago', meta: '18 controls' },
  { id: `job-${SEED_NOW - 5 * HOUR}-9`, files: ['revenue-recognition-policy.pdf', 'existing-rcm.xlsx'], status: 'COMPLETED', createdAt: '5h ago', meta: '31 controls' },
  // Yesterday
  { id: `job-${SEED_NOW - 26 * HOUR}-8`, files: ['period-close-process.docx'], status: 'COMPLETED', createdAt: 'Yesterday', meta: '12 controls' },
  { id: `job-${SEED_NOW - 30 * HOUR}-7`, files: ['legacy-controls.csv'], status: 'FAILED', createdAt: 'Yesterday' },
  { id: `job-${SEED_NOW - 34 * HOUR}-6`, files: ['inventory-policy.pdf'], status: 'COMPLETED', createdAt: 'Yesterday', meta: '9 controls' },
  // Earlier
  { id: `job-${SEED_NOW - 3 * DAY}-5`, files: ['procurement-sop.pdf'], status: 'COMPLETED', createdAt: '3d ago', meta: '22 controls' },
  { id: `job-${SEED_NOW - 4 * DAY}-4`, files: ['p2p-control-matrix.xlsx', 'vendor-master-controls.xlsx'], status: 'COMPLETED', createdAt: '4d ago', meta: '24 controls' },
  { id: `job-${SEED_NOW - 6 * DAY}-3`, files: ['treasury-sop.pdf', 'fx-policy.docx', 'bank-rcm.xlsx'], status: 'COMPLETED', createdAt: '6d ago', meta: '40 controls' },
  { id: `job-${SEED_NOW - 12 * DAY}-2`, files: ['fixed-assets-sop.pdf'], status: 'COMPLETED', createdAt: '12d ago', meta: '15 controls' },
];

// ─── Generation history — RACM-only stacked list (mirrors the Sources rows) ───
// Replaces the shared JobHistory table for RACM's side sheet (via renderHistory).
// Grouped by day, file glyph + source tag + status pill, exact timestamp, mono
// controls count, whole row opens the result, delete on the right.

function RacmHistoryList({ jobs, onOpen, onDelete }: {
  jobs: HistoryJob[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>(DEFAULT_DATE_FILTER);
  const [dateOpen, setDateOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (jobs.length === 0) {
    return (
      <ListPlaceholder
        icon={History}
        title="No generations yet"
        body="Your generated RACMs will appear here — open one to pick up where you left off."
      />
    );
  }

  const nowDate = new Date();
  const today0 = startOfDay(nowDate.getTime());
  const q = search.trim().toLowerCase();

  // Newest first, then filter by the date range and the search term (which matches
  // file names, status, source type, or the controls note).
  const visible = [...jobs]
    .sort((a, b) => (jobEpoch(b.id) ?? 0) - (jobEpoch(a.id) ?? 0))
    .filter((j) => {
      const ep = jobEpoch(j.id);
      const iso = (ep == null ? nowDate : new Date(ep)).toISOString();
      if (!dateInFilter(iso, dateFilter, nowDate)) return false;
      if (!q) return true;
      const hay = [...j.files, j.meta ?? '', STATUS_PILL[j.status]?.label ?? '', entrySource(j.files)].join(' ').toLowerCase();
      return hay.includes(q);
    });

  // Two buckets only: anything created today vs. everything older.
  const groups: { key: 'Today' | 'Earlier'; jobs: HistoryJob[] }[] = [
    { key: 'Today', jobs: [] }, { key: 'Earlier', jobs: [] },
  ];
  for (const j of visible) {
    const ep = jobEpoch(j.id);
    const isToday = ep != null && startOfDay(ep) === today0;
    groups.find((g) => g.key === (isToday ? 'Today' : 'Earlier'))!.jobs.push(j);
  }

  const deletingJob = jobs.find((j) => j.id === confirmDeleteId);
  const deletingName = deletingJob
    ? (deletingJob.files.length > 1 ? `${deletingJob.files.length} files` : (deletingJob.files[0] ?? 'this RACM'))
    : '';

  return (
    <>
    <div>
      <div className="flex items-center gap-2 mb-5">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            type="text"
            placeholder="Search by file, status…"
            aria-label="Search generations"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 h-9 rounded-md border border-canvas-border bg-canvas-elevated text-[0.8125rem] text-ink-900 placeholder:text-ink-400 focus:outline-none focus:border-brand-600 transition-colors"
          />
        </div>
        <DateFilterPicker
          filter={dateFilter}
          open={dateOpen}
          onToggle={() => setDateOpen((p) => !p)}
          onClose={() => setDateOpen(false)}
          onApply={(next) => { setDateFilter(next); setDateOpen(false); }}
          today={nowDate}
          rangeStacked
        />
      </div>

      {visible.length === 0 ? (
        <ListPlaceholder
          icon={Search}
          title="No matches"
          body="No generations match your search or date range."
        />
      ) : (
        <div className="space-y-6">
          {groups.filter((g) => g.jobs.length > 0).map((group) => {
            const isCollapsed = !!collapsed[group.key];
            return (
              <div key={group.key}>
                <button
                  type="button"
                  onClick={() => setCollapsed((c) => ({ ...c, [group.key]: !c[group.key] }))}
                  aria-expanded={!isCollapsed}
                  className="group/sec w-full flex items-center justify-between gap-3 mb-2.5 cursor-pointer rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                >
                  <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-ink-400">
                    {group.key}<span className="ml-1.5 font-mono tabular-nums text-ink-300">{group.jobs.length}</span>
                  </h3>
                  <ChevronDown size={15} className={`shrink-0 text-ink-400 transition-transform group-hover/sec:text-ink-600 ${isCollapsed ? '-rotate-90' : ''}`} />
                </button>
                {!isCollapsed && (
                  <div className="space-y-2">
                    {group.jobs.map((j) => {
                      const src = entrySource(j.files);
                      const Glyph = j.files.length > 1 ? FileStack : fileGlyph(j.files[0] ?? '');
                      const chipBg = src === 'racm' ? 'bg-evidence-50' : src === 'sop' ? 'bg-brand-50' : 'bg-paper-100';
                      const chipFg = src === 'racm' ? 'text-evidence-700' : src === 'sop' ? 'text-brand-600' : 'text-ink-500';
                      const ep = jobEpoch(j.id);
                      const when = ep == null ? j.createdAt : formatDateTime(ep);
                      const completed = j.status === 'COMPLETED';
                      const status = STATUS_PILL[j.status] ?? STATUS_PILL.COMPLETED;
                      const name = j.files.length > 1 ? `${j.files.length} files` : (j.files[0] ?? '—');
                      const controls = j.meta?.match(/^(\d+)\s+controls?$/i) ?? null;
                      return (
                        <div
                          key={j.id}
                          onClick={completed ? () => onOpen(j.id) : undefined}
                          role={completed ? 'button' : undefined}
                          tabIndex={completed ? 0 : undefined}
                          onKeyDown={completed ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(j.id); } } : undefined}
                          className={`group flex items-center gap-3 rounded-xl border border-canvas-border bg-canvas-elevated px-3.5 py-3 transition-colors ${completed ? 'cursor-pointer hover:border-brand-200 hover:bg-brand-50/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30' : ''}`}
                        >
                          <span className={`w-8 h-8 rounded-lg inline-flex items-center justify-center shrink-0 ${chipBg}`}>
                            <Glyph size={15} className={chipFg} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-[0.84375rem] text-ink-800 truncate">{name}</p>
                              <EntrySourceTag source={src} />
                            </div>
                            <p className="text-[0.6875rem] text-ink-400 mt-0.5">
                              <span className="font-mono tabular-nums">{when}</span>
                              {j.meta && (controls
                                ? <span> · <span className="font-mono tabular-nums">{controls[1]}</span> controls</span>
                                : <span> · {j.meta}</span>)}
                            </p>
                          </div>
                          <Pill tone={status.tone}>{status.label}</Pill>
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(j.id); }}
                            aria-label={`Delete ${name}`}
                            title="Delete RACM"
                            className="shrink-0 p-1 rounded-md text-ink-300 hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
    <ConfirmationModal
      open={confirmDeleteId !== null}
      title="Delete this RACM?"
      description={<>This permanently removes <span className="font-semibold text-ink-700">{deletingName}</span> from your generation history. This can't be undone.</>}
      confirmLabel="Delete"
      tone="destructive"
      onConfirm={() => { if (confirmDeleteId) onDelete(confirmDeleteId); setConfirmDeleteId(null); }}
      onClose={() => setConfirmDeleteId(null)}
    />
    </>
  );
}

// ─── Main view ───────────────────────────────────────────────────────────────

export default function RACMGeneratorView({ onBack, onOpenEditor }: { onBack: () => void; onOpenEditor: (name: string, sourceFiles: string[]) => void }) {
  return (
    <ConciergeFlow<Result>
      title="RACM Generator"
      subtitle="Upload an SOP or import an existing matrix to generate a full Risk & Control Matrix — risks, controls, assertions, and governance — ready for your working papers."
      icon={TableProperties}
      onBack={onBack}
      accept=".pdf,.csv,.xlsx,.doc,.docx"
      multiple
      maxSizeMb={25}
      uploadCtaLabel="Generate RACM"
      stages={[
        { id: 'extract', label: 'Extract' },
        { id: 'chunk', label: 'Segment' },
        { id: 'analyze', label: 'Analyze' },
        { id: 'consolidate', label: 'Consolidate' },
        { id: 'gap', label: 'Gap analysis' },
        { id: 'finalize', label: 'Finalize' },
      ]}
      messages={[
        'Extracting text and tables from the document…',
        'Segmenting the document into logical process sections…',
        'Analyzing each section for risks and controls…',
        'Consolidating and de-duplicating the control set…',
        'Running gap analysis against the control framework…',
        'Finalizing the Risk & Control Matrix…',
      ]}
      totalMs={8000}
      checking={[
        'Process areas and sub-processes in the document',
        'Risks, ratings, and CEAVOP assertions',
        'Control activity, type, nature, and frequency',
        'Segregation of duties and review controls',
      ]}
      tips={[
        'Each row maps a risk to its control — click a row to see the full detail.',
        'Risk ratings run Critical and High first, then Medium and Low.',
        "AI-recommended controls aren't in the source SOP — review before adopting.",
        'Export to Excel, CSV, or JSON for your working papers.',
      ]}
      renderUpload={(api) => <RacmCreateChooser {...api} />}
      renderProgress={(api) => <RacmLoader {...api} />}
      buildResult={buildResult}
      renderResult={() => null}
      onComplete={(r) => onOpenEditor(
        r.sourceFiles.length > 1
          ? `Consolidated RACM · ${r.sourceFiles.length} sources`
          : `RACM · ${r.sourceFiles[0] ?? r.fileName}`,
        r.sourceFiles,
      )}
      historyMeta={(result) => `${result.entries.length} controls`}
      historyAsDrawer
      historySeed={HISTORY_SEED}
      renderHistory={(api) => <RacmHistoryList {...api} />}
    />
  );
}
