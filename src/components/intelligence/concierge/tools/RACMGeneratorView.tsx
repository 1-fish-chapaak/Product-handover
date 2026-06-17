import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  TableProperties, Download, ChevronDown, X, Search,
  ShieldAlert, ListChecks, Layers, FileSpreadsheet, FileJson, FileText,
  Upload, Sparkles, FileStack, Check, ArrowRight,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import * as XLSX from 'xlsx';
import { ConciergeFlow } from '../ConciergeKit';
import type { PickedFile, HistoryJob, JobState } from '../types';
import ListPlaceholder from '../../../shared/ListPlaceholder';
import { Button } from '../../../shared/Button';

// ─── Field model ─────────────────────────────────────────────────────────────
// Ported verbatim from irame-mvp's racm-field-definitions.js — the full 25-field
// RACM schema. The result matrix renders every field (wide + scrollable) per the
// prototype's RACM convention; blanks show "—".

type RacmField = { key: string; label: string; group: string; width: number };

const RACM_FIELDS: RacmField[] = [
  { key: 'riskId', label: 'Risk ID', group: 'IDENTIFICATION', width: 80 },
  { key: 'controlId', label: 'Control ID', group: 'IDENTIFICATION', width: 90 },
  { key: 'processArea', label: 'Process Area', group: 'IDENTIFICATION', width: 160 },
  { key: 'subProcess', label: 'Sub-Process', group: 'IDENTIFICATION', width: 160 },
  { key: 'riskCategory', label: 'Risk Category', group: 'RISK', width: 140 },
  { key: 'riskDescription', label: 'Risk Description', group: 'RISK', width: 280 },
  { key: 'riskRating', label: 'Risk Rating', group: 'RISK', width: 110 },
  { key: 'riskLikelihood', label: 'Likelihood', group: 'RISK', width: 100 },
  { key: 'riskImpact', label: 'Impact', group: 'RISK', width: 90 },
  { key: 'controlObjective', label: 'Control Objective', group: 'CONTROL', width: 240 },
  { key: 'controlActivity', label: 'Control Activity', group: 'CONTROL', width: 280 },
  { key: 'controlType', label: 'Control Type', group: 'CONTROL', width: 120 },
  { key: 'controlNature', label: 'Control Nature', group: 'CONTROL', width: 130 },
  { key: 'controlFrequency', label: 'Frequency', group: 'CONTROL', width: 120 },
  { key: 'controlOwner', label: 'Control Owner', group: 'CONTROL', width: 160 },
  { key: 'controlEvidence', label: 'Control Evidence', group: 'CONTROL', width: 200 },
  { key: 'assertionsCoveredCEAVOP', label: 'Assertions (CEAVOP)', group: 'FINANCIAL', width: 160 },
  { key: 'financialStatementLineItem', label: 'FS Line Item', group: 'FINANCIAL', width: 180 },
  { key: 'regulatoryReference', label: 'Regulatory Ref', group: 'FINANCIAL', width: 150 },
  { key: 'keyReport', label: 'Key Report', group: 'REPORTING', width: 180 },
  { key: 'ipeIceDetails', label: 'IPE/ICE Details', group: 'REPORTING', width: 180 },
  { key: 'segregationOfDuties', label: 'Segregation of Duties', group: 'GOVERNANCE', width: 220 },
  { key: 'managementReviewControl', label: 'Mgmt Review Control', group: 'GOVERNANCE', width: 220 },
  { key: 'extractionConfidence', label: 'Confidence', group: 'GOVERNANCE', width: 120 },
  { key: 'sopSectionReference', label: 'SOP Section', group: 'GOVERNANCE', width: 120 },
];

const FIELD_GROUPS: { key: string; label: string; fields: string[] }[] = [
  { key: 'IDENTIFICATION', label: 'Identification', fields: ['riskId', 'controlId', 'processArea', 'subProcess'] },
  { key: 'RISK', label: 'Risk Assessment', fields: ['riskCategory', 'riskDescription', 'riskRating', 'riskLikelihood', 'riskImpact'] },
  { key: 'CONTROL', label: 'Control Design', fields: ['controlObjective', 'controlActivity', 'controlType', 'controlNature', 'controlFrequency', 'controlOwner', 'controlEvidence'] },
  { key: 'FINANCIAL', label: 'Financial Reporting', fields: ['assertionsCoveredCEAVOP', 'financialStatementLineItem', 'regulatoryReference'] },
  { key: 'REPORTING', label: 'Reporting & Evidence', fields: ['keyReport', 'ipeIceDetails'] },
  { key: 'GOVERNANCE', label: 'Governance', fields: ['segregationOfDuties', 'managementReviewControl', 'extractionConfidence', 'sopSectionReference'] },
];

const WIDE_FIELDS = new Set([
  'riskDescription', 'controlObjective', 'controlActivity',
  'controlEvidence', 'segregationOfDuties', 'managementReviewControl',
]);

// ─── Colour maps (mirror irame-mvp's racm.constants) ─────────────────────────

const RATING_PILL: Record<string, string> = {
  Critical: 'text-red-700 bg-red-50 border-red-200',
  High: 'text-orange-700 bg-orange-50 border-orange-200',
  Medium: 'text-amber-700 bg-amber-50 border-amber-200',
  Low: 'text-green-700 bg-green-50 border-green-200',
};
const CONFIDENCE_PILL: Record<string, string> = {
  EXTRACTED: 'text-green-700 bg-green-50 border-green-200',
  INFERRED: 'text-amber-700 bg-amber-50 border-amber-200',
  RECOMMENDED: 'text-brand-700 bg-brand-50 border-brand-200',
};
const RATING_HEX: Record<string, string> = {
  Critical: '#dc2626', High: '#ea580c', Medium: '#ca8a04', Low: '#16a34a',
};

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

const LABELS = RACM_FIELDS.map((f) => f.label);
const rowsForExport = (r: Result) => r.entries.map((e) => RACM_FIELDS.map((f) => e[f.key] ?? ''));

function downloadBlob(name: string, blob: Blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
const csvCell = (v: string) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
function exportCsv(r: Result) {
  const header = LABELS.map(csvCell).join(',');
  const body = rowsForExport(r).map((row) => row.map(csvCell).join(',')).join('\n');
  downloadBlob(`racm-${Date.now()}.csv`, new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8' }));
}
function exportJson(r: Result) {
  downloadBlob(`racm-${Date.now()}.json`, new Blob([JSON.stringify(r.entries, null, 2)], { type: 'application/json' }));
}
function exportXlsx(r: Result) {
  const ws = XLSX.utils.aoa_to_sheet([LABELS, ...rowsForExport(r)]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'RACM');
  XLSX.writeFile(wb, `racm-${Date.now()}.xlsx`);
}

// ─── Export menu (result header action) ──────────────────────────────────────

function ExportMenu({ result }: { result: Result }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  const items = [
    { label: 'Excel (.xlsx)', icon: FileSpreadsheet, action: () => exportXlsx(result) },
    { label: 'CSV', icon: FileText, action: () => exportCsv(result) },
    { label: 'JSON', icon: FileJson, action: () => exportJson(result) },
  ];
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.8125rem] font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-700 px-3.5 py-2 transition-colors cursor-pointer"
      >
        <Download size={14} /> Export <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-44 rounded-lg border border-canvas-border bg-canvas-elevated shadow-[0_12px_32px_rgba(15,8,30,0.16)] z-20 py-1">
          {items.map((it) => {
            const Icon = it.icon;
            return (
              <button
                key={it.label}
                onClick={() => { it.action(); setOpen(false); }}
                className="w-full text-left inline-flex items-center gap-2 px-3 py-2 text-[0.8125rem] text-ink-600 hover:bg-paper-50/70 hover:text-brand-700 cursor-pointer"
              >
                <Icon size={14} /> {it.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Detail modal ────────────────────────────────────────────────────────────

function FieldValue({ fieldKey, value }: { fieldKey: string; value: string }) {
  if (fieldKey === 'riskRating' && value) {
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[0.75rem] font-semibold border ${RATING_PILL[value] ?? 'text-ink-600 bg-paper-100 border-canvas-border'}`}>{value}</span>;
  }
  if (fieldKey === 'extractionConfidence' && value) {
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[0.75rem] font-semibold border ${CONFIDENCE_PILL[value] ?? 'text-ink-600 bg-paper-100 border-canvas-border'}`}>{value}</span>;
  }
  return <span className="text-[0.8125rem] text-ink-800 whitespace-pre-wrap">{value || '—'}</span>;
}

function DetailModal({ entry, onClose }: { entry: RacmEntry | null; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <AnimatePresence>
      {entry && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-[2px]" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl border border-canvas-border bg-canvas-elevated shadow-[0_24px_64px_rgba(15,8,30,0.24)]"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-3.5 border-b border-canvas-border bg-canvas-elevated">
              <h3 className="text-[0.9375rem] font-semibold text-ink-900 truncate">
                {entry.riskId} / {entry.controlId} — {entry.processArea}
              </h3>
              <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-md text-ink-400 hover:text-ink-800 hover:bg-paper-100 cursor-pointer shrink-0">
                <X size={16} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-6">
              {FIELD_GROUPS.map((group) => (
                <div key={group.key}>
                  <h4 className="text-[0.8125rem] font-semibold text-brand-700 border-b border-brand-100 pb-1 mb-3">{group.label}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                    {group.fields.map((fieldKey) => {
                      const def = RACM_FIELDS.find((f) => f.key === fieldKey);
                      const wide = WIDE_FIELDS.has(fieldKey);
                      return (
                        <div key={fieldKey} className={`space-y-1 ${wide ? 'sm:col-span-2' : ''}`}>
                          <p className="text-[0.6875rem] font-medium text-ink-400">{def?.label ?? fieldKey}</p>
                          <div className={wide ? 'rounded-md bg-paper-50/70 px-3 py-2' : ''}>
                            <FieldValue fieldKey={fieldKey} value={entry[fieldKey]} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Summary dashboard ───────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, tone }: { icon: typeof ShieldAlert; label: string; value: number; tone: string }) {
  return (
    <div className="rounded-[12px] border border-canvas-border bg-canvas-elevated px-4 py-3.5 flex items-center gap-3">
      <span className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
        <Icon size={17} className="text-brand-700" strokeWidth={1.75} />
      </span>
      <div className="min-w-0">
        <p className={`text-[1.5rem] font-semibold leading-none tabular-nums ${tone}`}>{value}</p>
        <p className="text-[0.6875rem] text-ink-500 mt-1">{label}</p>
      </div>
    </div>
  );
}

function Summary({ entries }: { entries: RacmEntry[] }) {
  const stats = useMemo(() => {
    const totalRisks = entries.length;
    const uniqueControls = new Set(entries.map((e) => (e.controlActivity || '').toLowerCase().trim())).size;
    const areaCounts = new Map<string, number>();
    entries.forEach((e) => { const a = e.processArea || 'Unspecified'; areaCounts.set(a, (areaCounts.get(a) ?? 0) + 1); });
    const ratingData = ['Critical', 'High', 'Medium', 'Low'].map((name) => ({
      name, count: entries.filter((e) => e.riskRating === name).length, color: RATING_HEX[name],
    }));
    const areaData = [...areaCounts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
    return { totalRisks, uniqueControls, processAreas: areaCounts.size, ratingData, areaData };
  }, [entries]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={ShieldAlert} label="Total risks" value={stats.totalRisks} tone="text-brand-700" />
        <StatCard icon={ListChecks} label="Unique controls" value={stats.uniqueControls} tone="text-sky-600" />
        <StatCard icon={Layers} label="Process areas" value={stats.processAreas} tone="text-compliant-700" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-[12px] border border-canvas-border bg-canvas-elevated p-4">
          <p className="text-[0.75rem] font-semibold text-ink-700 mb-2">Risk rating distribution</p>
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={stats.ratingData} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ece8f3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#8b8595' }} />
              <YAxis type="category" dataKey="name" width={64} tick={{ fontSize: 11, fill: '#5b5566' }} />
              <Tooltip cursor={{ fill: 'rgba(106,18,205,0.05)' }} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #ece8f3' }} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={18}>
                {stats.ratingData.map((d) => <Cell key={d.name} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-[12px] border border-canvas-border bg-canvas-elevated p-4">
          <p className="text-[0.75rem] font-semibold text-ink-700 mb-2">Process area breakdown</p>
          <div className="max-h-[170px] overflow-y-auto">
            <table className="w-full text-left">
              <tbody>
                {stats.areaData.map((a) => (
                  <tr key={a.name} className="border-t border-canvas-border first:border-t-0">
                    <td className="py-1.5 text-[0.8125rem] text-ink-700">{a.name}</td>
                    <td className="py-1.5 text-right text-[0.8125rem] font-semibold text-ink-600 tabular-nums">{a.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Matrix cell + table ─────────────────────────────────────────────────────

function MatrixCell({ field, value }: { field: RacmField; value: string }) {
  if (!value) return <span className="text-ink-300">—</span>;
  if (field.key === 'riskRating') {
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[0.6875rem] font-semibold border ${RATING_PILL[value] ?? 'text-ink-600 bg-paper-100 border-canvas-border'}`}>{value}</span>;
  }
  if (field.key === 'extractionConfidence') {
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[0.6875rem] font-semibold border ${CONFIDENCE_PILL[value] ?? 'text-ink-600 bg-paper-100 border-canvas-border'}`}>{value}</span>;
  }
  return <div className="truncate" style={{ maxWidth: field.width }} title={value}>{value}</div>;
}

function ResultView({ result }: { result: Result }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<RacmEntry | null>(null);
  const [showSummary, setShowSummary] = useState(true);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return result.entries;
    return result.entries.filter((e) => Object.values(e).some((v) => String(v).toLowerCase().includes(q)));
  }, [query, result.entries]);

  return (
    <div className="space-y-5">
      {/* Header row — count + summary toggle */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[0.875rem] text-ink-600">
          <span className="font-semibold text-ink-900 tabular-nums">{result.entries.length}</span> control{result.entries.length === 1 ? '' : 's'} generated from{' '}
          <span className="text-ink-800">{result.fileName}</span>
        </p>
        <button
          onClick={() => setShowSummary((s) => !s)}
          className="text-[0.8125rem] font-semibold text-brand-700 hover:text-brand-800 cursor-pointer"
        >
          {showSummary ? 'Hide summary' : 'Show summary'}
        </button>
      </div>

      {showSummary && (
        <>
          <Summary entries={result.entries} />
          <div className="rounded-[12px] border border-canvas-border bg-canvas-elevated p-4">
            <p className="text-[0.75rem] font-semibold text-ink-700 mb-2">SOP analysis summary</p>
            <ul className="space-y-1.5">
              {result.summary.map((line, i) => (
                <li key={i} className="flex items-start gap-2 text-[0.8125rem] text-ink-600 leading-relaxed">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-brand-400 shrink-0" />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {/* Wide matrix — full schema, scrollable */}
      <div className="rounded-[12px] border border-canvas-border overflow-hidden">
        <div className="px-4 py-2.5 border-b border-canvas-border bg-paper-50/70 flex items-center justify-between gap-3 flex-wrap">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search entries…"
              className="w-56 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.8125rem] text-ink-700 pl-8 pr-3 py-1.5 outline-none focus:border-brand-300"
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[0.6875rem] text-ink-400 hidden sm:inline">Scroll right for more columns →</span>
            <span className="text-[0.75rem] text-ink-400 tabular-nums">{filtered.length} entries</span>
          </div>
        </div>
        <div className="overflow-x-auto max-h-[30rem] overflow-y-auto">
          <table className="min-w-max text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-paper-50">
              <tr className="text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-400">
                <th className="px-3 py-2.5 whitespace-nowrap">#</th>
                {RACM_FIELDS.map((f) => (
                  <th key={f.key} className="px-3 py-2.5 whitespace-nowrap" style={{ minWidth: f.width }}>{f.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((e, i) => (
                <tr
                  key={`${e.riskId}-${i}`}
                  onClick={() => setSelected(e)}
                  className="border-t border-canvas-border hover:bg-paper-50/50 cursor-pointer transition-colors"
                >
                  <td className="px-3 py-2 text-[0.75rem] text-ink-400 tabular-nums whitespace-nowrap">{i + 1}</td>
                  {RACM_FIELDS.map((f) => (
                    <td key={f.key} className="px-3 py-2 text-[0.8125rem] text-ink-800 align-top">
                      <MatrixCell field={f} value={e[f.key]} />
                    </td>
                  ))}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={RACM_FIELDS.length + 1} className="px-3 py-10 text-center text-[0.8125rem] text-ink-400">
                    No entries match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[0.6875rem] text-ink-400">Click any row to see the full risk &amp; control detail.</p>

      <DetailModal entry={selected} onClose={() => setSelected(null)} />
    </div>
  );
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

// One orchestrated entrance — sections rise and settle on exponential ease-out.
const REVEAL_CONTAINER = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.02 } } };
const REVEAL_ITEM = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
};

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
  const hasFile = staged.length > 0;
  const hasPrompt = prompt.trim().length > 0;
  // The button appears once there's a file OR typed instructions. When it's only
  // there because of instructions (no file yet), it stays disabled and explains why.
  const showContinue = hasFile || hasPrompt;
  const showError = hasPrompt && !hasFile;

  const addFiles = (e: ChangeEvent<HTMLInputElement>, source: 'racm' | 'sop') => {
    const picked = Array.from(e.target.files ?? [])
      .filter((f) => f.size <= MAX_MB * 1024 * 1024)
      .map((f) => ({ file: { name: f.name, size: f.size, type: f.type } as PickedFile, source }));
    e.target.value = '';
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

  // Generate bar — states what Continue produces (mono count), or why it's blocked.
  const footer = showContinue ? (
    <div className="flex items-center justify-between gap-4">
      <p className="text-[0.8125rem] leading-relaxed">
        {showError ? (
          <span className="text-risk-700">Cannot continue without uploading the file.</span>
        ) : (
          <span className="text-ink-500">
            Generates a Risk &amp; Control Matrix from{' '}
            <span className="font-mono tabular-nums text-ink-700">{staged.length}</span>{' '}
            source{staged.length === 1 ? '' : 's'}.
          </span>
        )}
      </p>
      <Button variant="primary" size="md" disabled={!hasFile} onClick={onContinue} rightIcon={<ArrowRight size={15} />}>
        Continue
      </Button>
    </div>
  ) : null;

  // ── Working state — centered editorial composition ─────────────────────────
  // Once a source is staged we drop the placeholder and set the step as a workspace:
  // upload actions at the top (right-aligned), then a labeled Sources block, the
  // instructions field, and a generate bar.
  if (hasFile) {
    return (
      <motion.div variants={REVEAL_CONTAINER} initial="hidden" animate="show" className="flex flex-col h-full">
        <motion.div variants={REVEAL_ITEM} className="shrink-0 flex flex-wrap items-center justify-end gap-2.5">
          <Button variant="primary" size="md" onClick={() => racmInputRef.current?.click()} leftIcon={<Upload size={15} />}>
            Add a RACM
          </Button>
          <Button variant="outline" size="md" onClick={() => sopInputRef.current?.click()} leftIcon={<Sparkles size={15} />}>
            Add an SOP <span className="ml-1 text-ink-400 font-normal">→ extract</span>
          </Button>
        </motion.div>

        <motion.div variants={REVEAL_ITEM} className="shrink-0 mt-8 mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-ink-400">Sources</h2>
          <span className="text-[0.75rem] text-ink-400">
            <span className="font-mono tabular-nums text-ink-600">{staged.length}</span> {staged.length === 1 ? 'file' : 'files'} ready
          </span>
        </motion.div>

        {/* Sources list — the only scrollable region. Hugs its content when there
            are a few files; shrinks and scrolls internally when there are many, so
            the page itself never scrolls. */}
        <motion.div variants={REVEAL_ITEM} className="min-h-0 overflow-y-auto rounded-xl border border-canvas-border bg-canvas-elevated divide-y divide-canvas-border mb-4">
          {staged.map((s) => {
            const Glyph = fileGlyph(s.file.name);
            const size = formatBytes(s.file.size);
            return (
              <div key={s.file.name} className="group flex items-center gap-3 px-3.5 py-3">
                <span className={`w-8 h-8 rounded-lg inline-flex items-center justify-center shrink-0 ${s.source === 'racm' ? 'bg-evidence-50' : 'bg-brand-50'}`}>
                  <Glyph size={15} className={s.source === 'racm' ? 'text-evidence-700' : 'text-brand-600'} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.84375rem] text-ink-800 truncate">{s.file.name}</p>
                  {size && <p className="text-[0.6875rem] text-ink-400 font-mono tabular-nums">{size}</p>}
                </div>
                <SourcePill source={s.source} />
                <button
                  onClick={() => removeFile(s.file.name)}
                  aria-label={`Remove ${s.file.name}`}
                  className="shrink-0 p-1 rounded-md text-ink-300 hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>
            );
          })}
        </motion.div>

        <motion.div variants={REVEAL_ITEM} className="shrink-0 mt-auto">{instructions}</motion.div>

        <motion.div variants={REVEAL_ITEM} className="shrink-0 mt-6">{footer}</motion.div>

        {fileInputs}
      </motion.div>
    );
  }

  // ── Empty state — inviting, centered placeholder ───────────────────────────
  return (
    <ListPlaceholder
      icon={FileStack}
      title="Start your RACM library"
      body="Upload one or more files — an existing matrix or SOPs to extract from. IRA consolidates them into a single RACM."
      action={
        <div className="w-full max-w-2xl mx-auto space-y-5">
          <div className="grid grid-cols-2 gap-3 text-left">
            <button onClick={() => racmInputRef.current?.click()} className="group text-left rounded-xl border border-border-light hover:border-primary/40 hover:bg-primary-xlight/30 p-5 transition-colors cursor-pointer">
              <div className="p-2 rounded-lg bg-evidence-50 inline-flex mb-3"><Upload size={16} className="text-evidence-700" /></div>
              <div className="text-[0.84375rem] font-semibold text-text mb-1">Upload a RACM</div>
              <div className="text-[0.71875rem] text-text-muted leading-relaxed">Import an existing matrix (.xlsx / .csv).</div>
            </button>
            <button onClick={() => sopInputRef.current?.click()} className="group text-left rounded-xl border border-border-light hover:border-primary/40 hover:bg-primary-xlight/30 p-5 transition-colors cursor-pointer">
              <div className="p-2 rounded-lg bg-brand-50 inline-flex mb-3"><Sparkles size={16} className="text-brand-600" /></div>
              <div className="text-[0.84375rem] font-semibold text-text mb-1 flex items-center gap-1.5">Upload an SOP <span className="text-text-muted">→</span> extract</div>
              <div className="text-[0.71875rem] text-text-muted leading-relaxed">Upload a procedure doc (.pdf/.docx). IRA reads and drafts it.</div>
            </button>
          </div>

          {instructions}

          {footer}

          {fileInputs}
        </div>
      }
    />
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
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!state.startedAt) return;
    const id = window.setInterval(() => setElapsed(Date.now() - (state.startedAt ?? Date.now())), 500);
    return () => window.clearInterval(id);
  }, [state.startedAt]);
  const mm = String(Math.floor(elapsed / 60000)).padStart(2, '0');
  const ss = String(Math.floor((elapsed % 60000) / 1000)).padStart(2, '0');

  // Timestamped activity log — append a line whenever the status message changes.
  const [log, setLog] = useState<{ time: string; tag: string; msg: string }[]>([]);
  const lastMsg = useRef('');
  useEffect(() => {
    const msg = state.message;
    if (!msg || msg === lastMsg.current) return;
    lastMsg.current = msg;
    const d = new Date();
    const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    const tag = (stages[state.stageIndex]?.label ?? 'Info').toUpperCase().split(' ')[0];
    setLog((prev) => [...prev, { time, tag, msg }]);
  }, [state.message, state.stageIndex, stages]);

  // Tips carousel.
  const [tipIdx, setTipIdx] = useState(0);
  useEffect(() => {
    if (tips.length <= 1) return;
    const id = window.setInterval(() => setTipIdx((i) => (i + 1) % tips.length), 5000);
    return () => window.clearInterval(id);
  }, [tips.length]);

  const subStatus = state.message || (state.status === 'UPLOADING' ? 'Uploading…' : 'Starting…');

  return (
    <div className="max-w-3xl mx-auto">
      <div className="rounded-[14px] border-2 border-brand-200 bg-canvas-elevated p-5 shadow-[0_12px_32px_rgba(106,18,205,0.06)]">
        <div className="flex items-center gap-2 mb-5 min-w-0">
          <Sparkles size={16} className="text-brand-600 animate-pulse shrink-0" />
          <span className="text-[0.8125rem] text-ink-500 shrink-0">Processing:</span>
          <span className="text-[0.8125rem] font-semibold text-ink-800 truncate">{fileName}</span>
        </div>

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
                  <span className={`mt-1.5 text-[0.625rem] text-center ${active ? 'text-brand-700 font-semibold' : 'text-ink-400'}`}>{s.label}</span>
                </div>
                {i < stages.length - 1 && <div className={`flex-1 h-px mt-3.5 mx-1 ${done ? 'bg-brand-300' : 'bg-canvas-border'}`} />}
              </div>
            );
          })}
        </div>

        <p className="text-[0.8125rem] text-ink-700 mb-2">{subStatus}</p>

        <div className="h-2 rounded-full bg-paper-100 overflow-hidden mb-1.5">
          <motion.div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600" animate={{ width: `${state.progress}%` }} transition={{ ease: 'easeOut', duration: 0.3 }} />
        </div>
        <div className="flex items-center justify-between text-[0.6875rem] text-ink-400 tabular-nums">
          <span>{state.progress}%</span>
          <span>Time elapsed: {mm}:{ss}</span>
        </div>

        <div className="flex items-center justify-between gap-3 mt-4">
          <p className="text-[0.6875rem] text-ink-400">You can close this page and come back later. Your report will be saved automatically.</p>
          <button onClick={onCancel} className="shrink-0 inline-flex items-center px-3 py-1.5 rounded-lg border border-canvas-border text-[0.8125rem] font-medium text-ink-600 hover:text-risk-700 hover:border-risk-200 cursor-pointer transition-colors">Cancel</button>
        </div>

        <div className="mt-4 rounded-lg bg-paper-50/70 border border-canvas-border p-3">
          <div className="text-[0.6875rem] font-semibold text-ink-400 uppercase tracking-wide mb-1.5">Activity Log</div>
          <div className="max-h-28 overflow-y-auto space-y-0.5">
            {log.length === 0 ? (
              <p className="text-[0.6875rem] text-ink-400">Starting…</p>
            ) : log.map((l, i) => (
              <p key={i} className="text-[0.6875rem] text-ink-500 leading-relaxed">
                <span className="text-ink-400 tabular-nums">{l.time}</span> <span className="text-brand-600 font-semibold">[{l.tag}]</span> {l.msg}
              </p>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
        <div className="rounded-[14px] border border-canvas-border bg-canvas-elevated p-4">
          <div className="text-[0.6875rem] font-semibold text-ink-400 uppercase tracking-wide mb-3">What we're checking</div>
          <div className="space-y-2.5">
            {checking.map((c) => (
              <div key={c} className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-md bg-brand-50 inline-flex items-center justify-center shrink-0 mt-px"><Check size={12} className="text-brand-600" /></span>
                <span className="text-[0.75rem] text-ink-600 leading-relaxed">{c}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[14px] border border-brand-100 bg-brand-50/40 p-4 flex flex-col">
          <div className="text-[0.6875rem] font-semibold text-brand-700 uppercase tracking-wide mb-3">Did you know?</div>
          <p className="text-[0.8125rem] text-ink-600 leading-relaxed flex-1">{tips[tipIdx]}</p>
          {tips.length > 1 && (
            <div className="flex items-center gap-1.5 mt-3">
              {tips.map((_, i) => (
                <span key={i} className={`h-1.5 rounded-full transition-all ${i === tipIdx ? 'w-4 bg-brand-600' : 'w-1.5 bg-brand-200'}`} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── History seed ────────────────────────────────────────────────────────────

const HISTORY_SEED: HistoryJob[] = [
  { id: 'racm-seed-1', files: ['order-to-cash-sop.pdf'], status: 'COMPLETED', createdAt: '3h ago', meta: '18 controls' },
  { id: 'racm-seed-2', files: ['inventory-policy.pdf'], status: 'COMPLETED', createdAt: 'Yesterday', meta: '9 controls' },
];

// ─── Main view ───────────────────────────────────────────────────────────────

export default function RACMGeneratorView({ onBack, onOpenEditor }: { onBack: () => void; onOpenEditor: (name: string, sourceFiles: string[]) => void }) {
  return (
    <ConciergeFlow<Result>
      title="RACM Generator"
      subtitle="Upload an SOP, policy, or process document and generate a full Risk & Control Matrix — risks, controls, assertions, and governance — ready for your working papers."
      icon={TableProperties}
      onBack={onBack}
      accept=".pdf,.csv,.xlsx,.doc,.docx"
      multiple
      maxSizeMb={25}
      uploadCtaLabel="Generate RACM"
      stages={[
        { id: 'extract', label: 'Extract' },
        { id: 'chunk', label: 'Chunk' },
        { id: 'analyze', label: 'Analyze' },
        { id: 'consolidate', label: 'Consolidate' },
        { id: 'gap', label: 'Gap analysis' },
        { id: 'finalize', label: 'Finalize' },
      ]}
      messages={[
        'Extracting text and tables from the document…',
        'Chunking the SOP into logical process sections…',
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
    />
  );
}
