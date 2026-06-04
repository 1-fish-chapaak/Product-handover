import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  X,
  FileText,
  Pencil,
  Download,
  CheckCircle2,
  Lightbulb,
  AlertCircle,
  ChevronDown,
} from 'lucide-react';
import { ACTION_HUB_SUMMARY, GRC_EXCEPTIONS, GRC_CASE_DETAILS } from '../../data/mockData';

const PDF_URL = '/action-taken-report.pdf';
const PDF_FILENAME = 'Action Taken Report.pdf';

interface QueryContext {
  id: string;
  index: number;        // 1-based for "Query N: ..."
  title: string;
  risk: 'High Risk' | 'Medium Risk' | 'Low Risk';
  status: 'Closed' | 'In Progress' | 'Open';
  summary: string;
  riskDetails: string;
  evidence: string;
}

const DEFAULT_QUERY: QueryContext = {
  id: 'Q01',
  index: 1,
  title: 'Vendor Master Management',
  risk: 'High Risk',
  status: 'Closed',
  summary: 'Review of vendor creation and approval workflows in SAP.',
  riskDetails:
    'Unauthorized vendor creation could lead to fraud or duplicate payments. Multiple exceptions noted where vendors were created without proper documentation.',
  evidence: 'Screenshot of SAP vendor approval screen shared.',
};

const RISK_PILL: Record<QueryContext['risk'], string> = {
  'High Risk':   'bg-risk-50 text-risk-700',
  'Medium Risk': 'bg-mitigated-50 text-mitigated-700',
  'Low Risk':    'bg-compliant-50 text-compliant-700',
};

const STATUS_PILL: Record<QueryContext['status'], { bg: string; dot: string; text: string }> = {
  'Closed':      { bg: 'bg-compliant-50', dot: 'bg-compliant',  text: 'text-compliant-700' },
  'In Progress': { bg: 'bg-mitigated-50', dot: 'bg-mitigated',  text: 'text-mitigated-700' },
  'Open':        { bg: 'bg-risk-50',      dot: 'bg-risk',       text: 'text-risk-700' },
};

function MetaLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-ink-500 mb-1.5">
      {children}
    </div>
  );
}

function MetaValueStatic({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[0.8125rem] font-semibold text-ink-900 pb-1.5 border-b border-canvas-border">
      {children}
    </div>
  );
}

function MetaValueEditable({
  value, onChange, ariaLabel, editing,
}: { value: string; onChange: (v: string) => void; ariaLabel: string; editing: boolean }) {
  if (!editing) {
    return <MetaValueStatic>{value}</MetaValueStatic>;
  }
  return (
    <div className="relative group">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        className="w-full bg-transparent text-[0.8125rem] font-semibold text-ink-900 border-b border-dashed border-canvas-border focus:border-brand-600 focus:outline-none pb-1.5 pr-6 transition-colors"
      />
      <Pencil size={11} className="absolute right-1 bottom-2 text-ink-300 group-focus-within:text-brand-600 pointer-events-none" />
    </div>
  );
}

function RowLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[0.75rem] font-semibold text-ink-700 pt-2">{children}</div>
  );
}

function EditableTextBox({
  value, onChange, rows = 2, ariaLabel, editing,
}: { value: string; onChange: (v: string) => void; rows?: number; ariaLabel: string; editing: boolean }) {
  if (!editing) {
    return (
      <div className="px-3 py-2.5 bg-[#FAFAFB] border border-canvas-border rounded-[6px] text-[0.75rem] text-ink-800 leading-relaxed">
        {value}
      </div>
    );
  }
  return (
    <div className="relative group">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        aria-label={ariaLabel}
        className="w-full resize-none px-3 py-2.5 pr-9 bg-canvas-elevated border border-canvas-border rounded-[6px] text-[0.75rem] text-ink-800 leading-relaxed focus:outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/15 transition-colors"
      />
      <Pencil size={11} className="absolute top-2 right-2 text-ink-300 group-focus-within:text-brand-600 pointer-events-none" />
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <span className="block w-1 h-5 bg-brand-700 rounded-sm" aria-hidden="true" />
      <h2 className="text-[1rem] font-bold text-ink-900 tracking-tight">{children}</h2>
    </div>
  );
}

export default function GenerateATRModal({
  onClose,
  query = DEFAULT_QUERY,
  fileUrl = PDF_URL,
  fileName = PDF_FILENAME,
}: {
  onClose: () => void;
  query?: QueryContext;
  fileUrl?: string;
  fileName?: string;
}) {
  const riskOwnerName = ACTION_HUB_SUMMARY.riskOwner.name;
  const auditorName   = ACTION_HUB_SUMMARY.auditor.name;
  const reportId      = 'ATR-2026-Q1-001';
  const generatedOn   = '27 April 2026';

  // Editable header fields
  const [auditTitle,  setAuditTitle]  = useState('Procurement, Inventory & Dispatch Process A');
  const [auditEntity, setAuditEntity] = useState('ABC Manufacturing Cements Ltd');
  const [auditPeriod, setAuditPeriod] = useState('Q1 FY 2025-26');
  const [preparedBy,  setPreparedBy]  = useState(riskOwnerName);

  // Editable Action Plan + Auditor Verification
  const [actionPlan, setActionPlan] = useState('Implement maker-checker workflow for vendor creation in SAP.');
  const [auditorVerification, setAuditorVerification] = useState('Verified in SAP on 25 Apr 2026.');

  // Editable Auditor Comments
  const [auditorComments, setAuditorComments] = useState(
    'The management has shown good commitment toward implementing controls, especially in system-based improvements (SAP workflow and scrap sale module). Pending issues are mostly procedural and expected to close by next quarter.'
  );

  // Action review status counts — derived from live mock data.
  const reviewCounts = useMemo(() => {
    const acc = { implemented: 0, partial: 0, discrepancy: 0 };
    const noPlan = new Set(['Business as Usual', 'False Positive']);
    GRC_EXCEPTIONS.forEach(ex => {
      if (noPlan.has(ex.classification) || ex.classification === 'Unclassified') return;
      const norm = ex.actionReview === 'Implemented' ? 'Approved' : ex.actionReview;
      const actionStatus = GRC_CASE_DETAILS[ex.id]?.actionStatus ?? 'Pending';
      if (norm === 'Rejected' || actionStatus === 'Discrepancy') acc.discrepancy += 1;
      else if (norm === 'Approved') {
        if (actionStatus === 'Partially Implemented') acc.partial += 1;
        else acc.implemented += 1;
      }
    });
    return acc;
  }, []);

  // Classification counts (only the three actionable classifications).
  const classificationCounts = useMemo(() => {
    const acc = { 'Design Deficiency': 0, 'System Deficiency': 0, 'Procedural Non-Compliance': 0 };
    GRC_EXCEPTIONS.forEach(ex => {
      if (ex.classification in acc) acc[ex.classification as keyof typeof acc] += 1;
    });
    return acc;
  }, []);

  const status = STATUS_PILL[query.status];

  const [showFormatDropdown, setShowFormatDropdown] = useState(false);

  const DOWNLOAD_FORMATS = [
    { label: 'PDF', ext: 'pdf' },
    { label: 'PPTX', ext: 'pptx' },
    { label: 'Word', ext: 'docx' },
    { label: 'Excel', ext: 'xlsx' },
  ];

  const handleDownload = (ext: string) => {
    const a = document.createElement('a');
    a.href = fileUrl;
    const base = fileName.replace(/\.[^.]+$/, '');
    a.download = `${base}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setShowFormatDropdown(false);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 bg-ink-900/50 backdrop-blur-[2px] z-50"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 8 }}
        transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[960px] max-w-[94vw] h-[90vh] bg-canvas-elevated rounded-[16px] shadow-xl border border-canvas-border z-[60] flex flex-col"
        role="dialog"
        aria-label="Action Taken Report"
      >
        {/* Modal title bar */}
        <header className="shrink-0 px-6 py-3 flex items-center justify-between gap-4 border-b border-canvas-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[10px] bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
              <FileText size={16} />
            </div>
            <div>
              <h2 className="text-[0.9375rem] font-semibold text-ink-900 leading-tight">Action Taken Report</h2>
              <p className="text-[0.75rem] text-ink-500 leading-snug">Editable preview · <span className="font-mono">{fileName}</span></p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </header>

        {/* Document body */}
        <div className="flex-1 min-h-0 overflow-y-auto bg-[#F4F2F7]">
          <article className="max-w-[840px] mx-auto my-6 bg-canvas-elevated border border-canvas-border rounded-[12px] shadow-sm overflow-hidden">

            {/* Brand banner */}
            <div className="px-9 py-7 bg-gradient-to-br from-brand-700 to-brand-600 text-white">
              <h1 className="text-[1.625rem] font-bold tracking-tight leading-tight mb-1">Action Taken Report (ATR)</h1>
              <p className="text-[0.75rem] text-white/80">{auditEntity}</p>
            </div>

            {/* Metadata grid — Report ID, Audit Title, Audit Period | Prepared by, Generated on, Audit Entity */}
            <div className="px-9 py-6 grid grid-cols-3 gap-x-8 gap-y-5 border-b border-canvas-border">
              <div>
                <MetaLabel>Report ID</MetaLabel>
                <MetaValueStatic>{reportId}</MetaValueStatic>
              </div>
              <div>
                <MetaLabel>Audit Title</MetaLabel>
                <MetaValueEditable value={auditTitle} onChange={setAuditTitle} editing ariaLabel="Audit Title" />
              </div>
              <div>
                <MetaLabel>Audit Period</MetaLabel>
                <MetaValueEditable value={auditPeriod} onChange={setAuditPeriod} editing ariaLabel="Audit Period" />
              </div>
              <div>
                <MetaLabel>Prepared by</MetaLabel>
                <MetaValueEditable value={preparedBy} onChange={setPreparedBy} editing ariaLabel="Prepared by" />
              </div>
              <div>
                <MetaLabel>Generated on</MetaLabel>
                <MetaValueStatic>{generatedOn}</MetaValueStatic>
              </div>
              <div>
                <MetaLabel>Audit Entity</MetaLabel>
                <MetaValueEditable value={auditEntity} onChange={setAuditEntity} editing ariaLabel="Audit Entity" />
              </div>
            </div>

            {/* Query Summary section */}
            <section className="px-9 pt-7 pb-2">
              <SectionHeading>Query Summary</SectionHeading>
            </section>

            {/* Single query card (only the query the user opened) */}
            <div className="px-9 pb-7">
              <div className="border border-canvas-border rounded-[10px] p-5">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="text-[0.75rem] font-bold text-ink-900">
                      Query {query.index}: {query.title}
                    </h3>
                    <span className={`inline-flex items-center h-5 px-2 text-[0.625rem] font-bold uppercase tracking-wider rounded ${RISK_PILL[query.risk]}`}>
                      {query.risk}
                    </span>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 h-6 px-2.5 text-[0.75rem] font-medium rounded-full ${status.bg} ${status.text} shrink-0`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                    {query.status}
                  </span>
                </div>

                <div className="grid grid-cols-[180px_1fr] gap-x-6 gap-y-3 items-start">
                  <RowLabel>Query Summary:</RowLabel>
                  <p className="pt-2 text-[0.75rem] italic text-ink-700 leading-relaxed">{query.summary}</p>

                  <RowLabel>Risk Details:</RowLabel>
                  <p className="pt-2 text-[0.75rem] text-ink-800 leading-relaxed">{query.riskDetails}</p>

                  <RowLabel>Action Plan:</RowLabel>
                  <div className="pt-1">
                    <EditableTextBox value={actionPlan} onChange={setActionPlan} rows={2} editing ariaLabel="Action Plan" />
                  </div>

                  <RowLabel>Evidence:</RowLabel>
                  <p className="pt-2 text-[0.75rem] text-ink-800 leading-relaxed">{query.evidence}</p>

                  <RowLabel>Auditor Verification:</RowLabel>
                  <div className="pt-1">
                    <EditableTextBox value={auditorVerification} onChange={setAuditorVerification} rows={2} editing ariaLabel="Auditor Verification" />
                  </div>
                </div>
              </div>
            </div>

            {/* Summary of Closure Status */}
            <section className="px-9 pt-2 pb-4">
              <SectionHeading>Summary of Closure Status</SectionHeading>
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-[10px] border border-canvas-border bg-canvas-elevated p-5 flex flex-col items-center text-center">
                  <div className="text-[1.75rem] font-bold text-ink-900 tabular-nums leading-none mb-1">2</div>
                  <div className="text-[0.8125rem] font-semibold text-ink-800">Closed</div>
                </div>
                <div className="rounded-[10px] border border-canvas-border bg-canvas-elevated p-5 flex flex-col items-center text-center">
                  <div className="text-[1.75rem] font-bold text-ink-900 tabular-nums leading-none mb-1">2</div>
                  <div className="text-[0.8125rem] font-semibold text-ink-800">In Progress</div>
                </div>
                <div className="rounded-[10px] border border-canvas-border bg-canvas-elevated p-5 flex flex-col items-center text-center">
                  <div className="text-[1.75rem] font-bold text-ink-900 tabular-nums leading-none mb-1">1</div>
                  <div className="text-[0.8125rem] font-semibold text-ink-800">Open</div>
                </div>
              </div>
            </section>

            {/* Action Review Status Summary */}
            <section className="px-9 pt-7 pb-4">
              <SectionHeading>Action Review Status</SectionHeading>
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-[10px] border border-canvas-border bg-compliant-50/40 p-5 flex flex-col items-center text-center">
                  <div className="text-[1.75rem] font-bold text-compliant-700 tabular-nums leading-none mb-1">{reviewCounts.implemented}</div>
                  <div className="text-[0.75rem] font-semibold text-ink-800">Approved (Implemented)</div>
                </div>
                <div className="rounded-[10px] border border-canvas-border bg-mitigated-50/40 p-5 flex flex-col items-center text-center">
                  <div className="text-[1.75rem] font-bold text-mitigated-700 tabular-nums leading-none mb-1">{reviewCounts.partial}</div>
                  <div className="text-[0.75rem] font-semibold text-ink-800">Approved (Partially Implemented)</div>
                </div>
                <div className="rounded-[10px] border border-canvas-border bg-risk-50/40 p-5 flex flex-col items-center text-center">
                  <div className="text-[1.75rem] font-bold text-risk-700 tabular-nums leading-none mb-1">{reviewCounts.discrepancy}</div>
                  <div className="text-[0.75rem] font-semibold text-ink-800">Rejected (Discrepancy)</div>
                </div>
              </div>
            </section>

            {/* Classification Summary */}
            <section className="px-9 pt-3 pb-4">
              <SectionHeading>Classification Summary</SectionHeading>
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-[10px] border border-canvas-border bg-high-50/40 p-5 flex flex-col items-center text-center">
                  <div className="text-[1.75rem] font-bold text-high-700 tabular-nums leading-none mb-1">{classificationCounts['Design Deficiency']}</div>
                  <div className="text-[0.75rem] font-semibold text-ink-800">Design Deficiency</div>
                </div>
                <div className="rounded-[10px] border border-canvas-border bg-risk-50/40 p-5 flex flex-col items-center text-center">
                  <div className="text-[1.75rem] font-bold text-risk-700 tabular-nums leading-none mb-1">{classificationCounts['System Deficiency']}</div>
                  <div className="text-[0.75rem] font-semibold text-ink-800">System Deficiency</div>
                </div>
                <div className="rounded-[10px] border border-canvas-border bg-brand-50/60 p-5 flex flex-col items-center text-center">
                  <div className="text-[1.75rem] font-bold text-brand-700 tabular-nums leading-none mb-1">{classificationCounts['Procedural Non-Compliance']}</div>
                  <div className="text-[0.75rem] font-semibold text-ink-800">Procedural Non-Compliance</div>
                </div>
              </div>
            </section>

            {/* Overall Progress — sits right above Key Insights */}
            <section className="px-9 pt-5 pb-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[0.8125rem] font-semibold text-ink-800">Overall Progress</span>
                <span className="text-[0.75rem] font-semibold text-brand-700">40% Implemented</span>
              </div>
              <div className="h-1.5 rounded-full bg-[#EEEEF1] overflow-hidden">
                <div className="h-full rounded-full bg-brand-600" style={{ width: '40%' }} />
              </div>
            </section>

            {/* Key Insights & Recommendations */}
            <section className="px-9 pt-5 pb-4">
              <SectionHeading>Key Insights & Recommendations</SectionHeading>
              <ul className="space-y-4">
                <li className="flex gap-3">
                  <CheckCircle2 size={15} className="text-compliant-700 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-[0.8125rem] font-semibold text-ink-900 mb-0.5">Strong Management Commitment</div>
                    <p className="text-[0.75rem] text-ink-700 leading-relaxed">
                      The management has shown good commitment toward implementing controls, especially in system-based improvements (SAP workflow and scrap sale module). Two out of five queries have been fully closed.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <Lightbulb size={15} className="text-mitigated-700 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-[0.8125rem] font-semibold text-ink-900 mb-0.5">Automation Gap in Payment Approvals</div>
                    <p className="text-[0.75rem] text-ink-700 leading-relaxed">
                      Query 5 highlights that while a weekly dashboard to CFO has been prepared, the process remains manual. Automating approval tracking within the ERP would reduce compliance risk and improve turnaround time.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <AlertCircle size={15} className="text-risk-700 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-[0.8125rem] font-semibold text-ink-900 mb-0.5">Freight Rate Validation Needs Tightening</div>
                    <p className="text-[0.75rem] text-ink-700 leading-relaxed">
                      Query 3 remains partially open due to 2 dispatches in September lacking prior rate approval. A pre-dispatch checklist integrated into the logistics workflow is recommended to prevent recurrence.
                    </p>
                  </div>
                </li>
              </ul>
            </section>

            {/* Auditor Comments */}
            <section className="px-9 pt-2 pb-4">
              <div className="bg-[#FAFAFB] border border-canvas-border rounded-[10px] p-5">
                <div className="text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-ink-500 mb-2">
                  Auditor Comments
                </div>
                <EditableTextBox value={auditorComments} onChange={setAuditorComments} rows={4} editing ariaLabel="Auditor Comments" />
              </div>
            </section>

            {/* Approvals & Sign-Off */}
            <section className="px-9 pt-5 pb-9">
              <SectionHeading>Approvals & Sign-Off</SectionHeading>
              <div className="grid grid-cols-2 gap-5">
                <div className="rounded-[10px] border border-canvas-border p-5">
                  <div className="text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-ink-500 mb-2.5">Prepared by</div>
                  <div className="text-[0.875rem] font-bold text-ink-900 leading-tight mb-0.5">{riskOwnerName}</div>
                  <div className="text-[0.75rem] text-ink-600 mb-4">Risk Owner</div>
                  <div className="border-t border-dashed border-canvas-border pt-2.5">
                    <div className="text-[0.75rem] italic text-ink-500 text-center">Signature / Digital Approval</div>
                  </div>
                </div>
                <div className="rounded-[10px] border border-canvas-border p-5">
                  <div className="text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-ink-500 mb-2.5">Reviewed by</div>
                  <div className="text-[0.875rem] font-bold text-ink-900 leading-tight mb-0.5">{auditorName}</div>
                  <div className="text-[0.75rem] text-ink-600 mb-4">Auditor</div>
                  <div className="border-t border-dashed border-canvas-border pt-2.5">
                    <div className="text-[0.75rem] italic text-ink-500 text-center">Signature / Digital Approval</div>
                  </div>
                </div>
              </div>
              <div className="text-center text-[0.75rem] text-ink-500 mt-5">Date of Sign-Off: {generatedOn}</div>
            </section>
          </article>
        </div>

        {/* Modal footer */}
        <footer className="shrink-0 px-6 py-3.5 border-t border-canvas-border flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="h-10 px-5 text-[0.8125rem] font-medium text-ink-700 bg-canvas-elevated border border-canvas-border rounded-[8px] hover:border-brand-200 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <div className="relative">
            <button
              onClick={() => setShowFormatDropdown(p => !p)}
              className="h-10 px-5 inline-flex items-center gap-2 text-[0.8125rem] font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-[8px] cursor-pointer transition-colors"
            >
              <Download size={14} />
              Download
              <ChevronDown size={13} className={`transition-transform ${showFormatDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showFormatDropdown && (
              <>
                <div className="fixed inset-0 z-[65]" onClick={() => setShowFormatDropdown(false)} />
                <div className="absolute right-0 bottom-full mb-1.5 z-[70] bg-white border border-canvas-border shadow-xl py-1 w-44 rounded-[8px] overflow-hidden">
                  {DOWNLOAD_FORMATS.map(f => (
                    <button
                      key={f.ext}
                      onClick={() => handleDownload(f.ext)}
                      className="w-full text-left px-3 py-2 text-[0.75rem] text-ink-700 hover:bg-brand-50 hover:text-brand-700 transition-colors cursor-pointer"
                    >
                      Download as {f.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </footer>
      </motion.div>
    </>
  );
}
