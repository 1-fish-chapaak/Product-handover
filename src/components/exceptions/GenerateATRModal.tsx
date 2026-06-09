import { useState } from 'react';
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
  Sparkles,
  Users,
  Calendar,
  Clock,
  ArrowRight,
  Quote,
  PenLine,
  LayoutGrid,
  ClipboardCheck,
  Check,
  Eye,
  ShieldCheck,
} from 'lucide-react';
import { ACTION_HUB_SUMMARY } from '../../data/mockData';
import { ManageExceptionsLaunchButton } from '../reports/ManageExceptionsLaunchButton';

/** Pre-fillable metadata so the same preview can be reused from the Upload Report flow. */
export interface AtrInitialMeta {
  auditTitle?: string;
  auditEntity?: string;
  auditPeriod?: string;
  preparedBy?: string;
  reportId?: string;
  generatedOn?: string;
}

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

const RISK_DOT: Record<QueryContext['risk'], string> = {
  'High Risk':   'bg-risk',
  'Medium Risk': 'bg-mitigated',
  'Low Risk':    'bg-compliant',
};

const STATUS_PILL: Record<QueryContext['status'], { bg: string; dot: string; text: string }> = {
  'Closed':      { bg: 'bg-compliant-50', dot: 'bg-compliant',  text: 'text-compliant-700' },
  'In Progress': { bg: 'bg-mitigated-50', dot: 'bg-mitigated',  text: 'text-mitigated-700' },
  'Open':        { bg: 'bg-risk-50',      dot: 'bg-risk',       text: 'text-risk-700' },
};

// ─── Action plans (from the ATR format). Plan 1 is editable; 2 & 3 are static. ───
type PlanTone = 'implemented' | 'partial';
const PLAN_TONE: Record<PlanTone, { border: string; pill: string; label: string; Icon: typeof CheckCircle2 }> = {
  implemented: { border: 'border-t-2 border-t-compliant', pill: 'bg-compliant-50 text-compliant-700', label: 'Implemented',           Icon: CheckCircle2 },
  partial:     { border: 'border-t-2 border-t-mitigated', pill: 'bg-mitigated-50 text-mitigated-700', label: 'Partially Implemented', Icon: Clock },
};

// ─── Status-summary card tones. Only base / -50 / -700 shades exist in theme. ───
type CardTone = 'risk' | 'mitigated' | 'compliant' | 'brand';
const CARD_TONE: Record<CardTone, { border: string; num: string; iconBg: string }> = {
  risk:      { border: 'border-t-2 border-t-risk',       num: 'text-risk-700',      iconBg: 'bg-risk-50 text-risk-700' },
  mitigated: { border: 'border-t-2 border-t-mitigated',  num: 'text-mitigated-700', iconBg: 'bg-mitigated-50 text-mitigated-700' },
  compliant: { border: 'border-t-2 border-t-compliant',  num: 'text-compliant-700', iconBg: 'bg-compliant-50 text-compliant-700' },
  brand:     { border: 'border-t-2 border-t-brand-500',  num: 'text-brand-700',     iconBg: 'bg-brand-50 text-brand-700' },
};

function MetaLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-ink-500 mb-1.5">
      {children}
    </div>
  );
}

// Metadata cell — left brand accent bar matching the ATR format. Editable cells
// reveal a pencil affordance; static cells (Report ID, Generated On) are locked.
function MetaCell({
  label, value, onChange, editable, ariaLabel,
}: { label: string; value: string; onChange?: (v: string) => void; editable?: boolean; ariaLabel?: string }) {
  return (
    <div>
      <MetaLabel>{label}</MetaLabel>
      <div className="border-l-[3px] border-brand-500 pl-3 relative group">
        {editable ? (
          <>
            <input
              value={value}
              onChange={(e) => onChange?.(e.target.value)}
              aria-label={ariaLabel ?? label}
              className="w-full bg-transparent text-[0.8125rem] font-bold text-ink-900 focus:outline-none pr-5"
            />
            <Pencil size={11} className="absolute right-1 top-1/2 -translate-y-1/2 text-ink-300 group-focus-within:text-brand-600 pointer-events-none" />
          </>
        ) : (
          <div className="text-[0.8125rem] font-bold text-ink-900 truncate">{value}</div>
        )}
      </div>
    </div>
  );
}

function RowLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-ink-500 pt-2">{children}</div>
  );
}

function EditableTextBox({
  value, onChange, rows = 2, ariaLabel,
}: { value: string; onChange: (v: string) => void; rows?: number; ariaLabel: string }) {
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

// Numbered section heading — circular brand badge + title + subtitle (ATR format).
function NumberedHeading({ n, title, subtitle }: { n: number; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <span className="shrink-0 w-7 h-7 rounded-full bg-brand-50 text-brand-700 text-[0.8125rem] font-bold flex items-center justify-center mt-0.5">{n}</span>
      <div>
        <h2 className="text-[1.0625rem] font-bold text-ink-900 tracking-tight leading-tight">{title}</h2>
        <p className="text-[0.75rem] text-ink-500">{subtitle}</p>
      </div>
    </div>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-ink-500 whitespace-nowrap">{children}</span>
      <span className="h-px flex-1 bg-canvas-border" />
    </div>
  );
}

// One status-summary stat card — colored top border, big number, corner icon.
function StatCard({ n, label, tone, Icon }: { n: number; label: string; tone: CardTone; Icon: typeof CheckCircle2 }) {
  const t = CARD_TONE[tone];
  return (
    <div className={`rounded-[10px] border border-canvas-border bg-canvas-elevated p-4 ${t.border}`}>
      <div className="flex items-start justify-between">
        <div className={`text-[1.75rem] font-bold tabular-nums leading-none ${t.num}`}>{n}</div>
        <span className={`w-7 h-7 rounded-full flex items-center justify-center ${t.iconBg}`}><Icon size={14} /></span>
      </div>
      <div className="text-[0.75rem] font-semibold text-ink-800 mt-2">{label}</div>
    </div>
  );
}

export default function GenerateATRModal({
  onClose,
  query = DEFAULT_QUERY,
  fileUrl = PDF_URL,
  fileName = PDF_FILENAME,
  initial,
  manageExceptionsQueryId,
}: {
  onClose: () => void;
  query?: QueryContext;
  fileUrl?: string;
  fileName?: string;
  /** Seed the editable header fields (e.g. from an uploaded report). */
  initial?: AtrInitialMeta;
  /** When set, the footer shows a "Manage Exceptions" CTA wired to this query id. */
  manageExceptionsQueryId?: string;
}) {
  const auditorName   = ACTION_HUB_SUMMARY.auditor.name;
  const reportId      = initial?.reportId ?? 'ATR-2025-Q3-001';
  const generatedOn   = initial?.generatedOn ?? '14 May 2026';

  // Editable header fields
  const [auditTitle,  setAuditTitle]  = useState(initial?.auditTitle  ?? 'Procurement, Inventory & Dispatch Process A');
  const [auditEntity, setAuditEntity] = useState(initial?.auditEntity ?? 'ABC Manufacturing Cements Ltd');
  const [auditPeriod, setAuditPeriod] = useState(initial?.auditPeriod ?? 'Q3 FY 2024-25');
  const [preparedBy,  setPreparedBy]  = useState(initial?.preparedBy  ?? 'Internal Audit Team (HT Consulting Ltd)');

  // Editable Action Plan 1 + its Auditor Verification
  const [actionPlan, setActionPlan] = useState(
    "Configure mandatory dual-factor authentication (2FA) via RSA tokens for all users with SAP 'Vendor Master' creation or modification rights."
  );
  const [auditorVerification, setAuditorVerification] = useState('Verified in SAP on 25 Apr 2026.');

  // Editable Auditor Comments
  const [auditorComments, setAuditorComments] = useState(
    'The management has shown good commitment toward implementing controls, especially in system-based improvements (SAP workflow and scrap sale module). Pending issues are mostly procedural and expected to close by next quarter. Follow-up review recommended in Q4 FY 2024-25.'
  );

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

  // Action plans 2 & 3 (static) — plan 1 uses the editable state above.
  const staticPlans: { n: number; due: string; priority: 'High' | 'Medium'; tone: PlanTone; text: string; evidence: string; verification: string }[] = [
    {
      n: 2, due: 'Due 20 June 2026', priority: 'Medium', tone: 'implemented',
      text: "Redesign the vendor onboarding workflow in SAP to enforce a strict 'Maker-Checker' protocol. No vendor profile can be activated without second-level validation.",
      evidence: 'UAT (User Acceptance Testing) report, workflow diagram in SAP, and sample of 3 newly activated vendors.',
      verification: 'Verified flow in SAP Production environment. Workflow functioning as expected.',
    },
    {
      n: 3, due: 'Due 30 July 2026', priority: 'High', tone: 'partial',
      text: 'Establish a centralized Vendor Onboarding Portal to capture all statutory documents digitally with automated validation.',
      evidence: 'Portal login credentials for testing, system user manual, and API integration evidence.',
      verification: 'Verified end-to-end portal workflow. Integration successfully validates credentials.',
    },
  ];

  const insights = [
    { Icon: CheckCircle2, tint: 'text-compliant-700 bg-compliant-50', border: 'border-l-compliant', title: 'Strong Management Commitment', body: 'The management has shown good commitment toward implementing controls, especially in system-based improvements (SAP workflow and scrap sale module). Two out of five queries have been fully closed.' },
    { Icon: Lightbulb,    tint: 'text-mitigated-700 bg-mitigated-50', border: 'border-l-mitigated', title: 'Automation Gap in Payment Approvals', body: 'Query 5 highlights that while a weekly dashboard to CFO has been prepared, the process remains manual. Automating approval tracking within the ERP would reduce compliance risk and improve turnaround time.' },
    { Icon: AlertCircle,  tint: 'text-risk-700 bg-risk-50',           border: 'border-l-risk',      title: 'Freight Rate Validation Needs Tightening', body: 'Query 3 remains partially open due to 2 dispatches in September lacking prior rate approval. A pre-dispatch checklist integrated into the logistics workflow is recommended to prevent recurrence.' },
    { Icon: ArrowRight,   tint: 'text-brand-700 bg-brand-50',         border: 'border-l-brand-500', title: 'Recommended Follow-Up', body: 'A follow-up review is recommended in Q4 FY 2024-25 to verify completion of in-progress items and confirm sustainability of implemented controls. Particular attention should be given to the stock variance reporting process and freight rate approval mechanism.' },
  ];

  const renderActionPlan = (
    plan: { n: number; due: string; priority: 'High' | 'Medium'; tone: PlanTone; evidence: string },
    body: React.ReactNode,
    verification: React.ReactNode,
  ) => {
    const t = PLAN_TONE[plan.tone];
    return (
      <div key={plan.n} className={`border border-canvas-border rounded-[10px] overflow-hidden ${t.border}`}>
        <div className="p-5">
          {/* Plan header */}
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="inline-flex items-center h-6 px-2.5 text-[0.625rem] font-bold uppercase tracking-wider rounded bg-brand-50 text-brand-700">Action Plan {plan.n}</span>
              <span className="inline-flex items-center gap-1.5 h-6 px-2.5 text-[0.6875rem] font-medium rounded-full bg-[#FAFAFB] border border-canvas-border text-ink-700">
                <Calendar size={11} className="text-ink-500" /> {plan.due}
              </span>
              <span className="inline-flex items-center gap-1.5 text-[0.6875rem] font-semibold text-ink-800">
                <span className={`w-1.5 h-1.5 rounded-full ${plan.priority === 'High' ? 'bg-risk' : 'bg-mitigated'}`} />
                {plan.priority} Priority
              </span>
            </div>
            <span className={`inline-flex items-center gap-1.5 h-6 px-2.5 text-[0.625rem] font-bold uppercase tracking-wider rounded-full ${t.pill}`}>
              <t.Icon size={12} /> {t.label}
            </span>
          </div>

          {/* Plan body */}
          <div className="mb-4">{body}</div>

          {/* Evidence + verification */}
          <div className="grid grid-cols-[150px_1fr] gap-x-5 gap-y-3 items-start border-t border-dashed border-canvas-border pt-3">
            <div className="flex items-center gap-1.5 pt-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-ink-500">
              <FileText size={12} /> Evidence
            </div>
            <p className="pt-1 text-[0.75rem] italic text-ink-600 leading-relaxed">{plan.evidence}</p>

            <div className="flex items-center gap-1.5 pt-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-ink-500">
              <ShieldCheck size={12} /> Auditor Verification
            </div>
            <div className="pt-0.5">{verification}</div>
          </div>
        </div>
      </div>
    );
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
            <div className="relative px-9 py-7 bg-gradient-to-br from-brand-700 to-brand-600 text-white overflow-hidden">
              <div className="absolute -right-6 -top-10 w-48 h-48 rounded-full bg-white/5" aria-hidden="true" />
              <div className="absolute right-16 top-8 w-28 h-28 rounded-full bg-white/5" aria-hidden="true" />
              <div className="relative">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-8 h-8 rounded-[8px] bg-white/15 flex items-center justify-center"><Sparkles size={15} /></div>
                  <div className="leading-none">
                    <div className="text-[0.8125rem] font-bold tracking-wide">IRAME.AI</div>
                    <div className="text-[0.5rem] font-semibold tracking-[0.22em] text-white/70 mt-0.5">AUDIT INTELLIGENCE</div>
                  </div>
                </div>
                <h1 className="text-[1.75rem] font-bold tracking-tight leading-tight">Action Taken Report</h1>
                <p className="text-[0.8125rem] text-white/80 mt-1">{auditEntity} · {auditPeriod}</p>
              </div>
            </div>

            {/* Metadata grid */}
            <div className="px-9 py-6 grid grid-cols-3 gap-x-8 gap-y-5 border-b border-canvas-border">
              <MetaCell label="Report ID" value={reportId} />
              <MetaCell label="Audit Title" value={auditTitle} onChange={setAuditTitle} editable />
              <MetaCell label="Audit Period" value={auditPeriod} onChange={setAuditPeriod} editable />
              <MetaCell label="Prepared By" value={preparedBy} onChange={setPreparedBy} editable />
              <MetaCell label="Generated On" value={generatedOn} />
              <MetaCell label="Audit Entity" value={auditEntity} onChange={setAuditEntity} editable />
            </div>

            {/* ── Section 1 · Query Overview ── */}
            <section className="px-9 pt-7 pb-7">
              <NumberedHeading n={1} title="Query Overview" subtitle="Audit observations and corresponding management action plans" />

              {/* Query card */}
              <div className="border border-canvas-border rounded-[10px] p-5 mb-4">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="w-7 h-7 rounded-[8px] bg-brand-50 text-brand-700 flex items-center justify-center shrink-0"><Users size={14} /></span>
                    <h3 className="text-[0.875rem] font-bold text-ink-900">Query {query.index} — {query.title}</h3>
                    <span className={`inline-flex items-center gap-1.5 h-5 px-2 text-[0.625rem] font-bold uppercase tracking-wider rounded-full ${RISK_PILL[query.risk]}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${RISK_DOT[query.risk]}`} />
                      {query.risk}
                    </span>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 h-6 px-2.5 text-[0.75rem] font-medium rounded-full ${status.bg} ${status.text} shrink-0`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                    {query.status}
                  </span>
                </div>

                <div className="grid grid-cols-[150px_1fr] gap-x-5 gap-y-3 items-start">
                  <RowLabel>Query Summary</RowLabel>
                  <p className="pt-2 text-[0.75rem] italic text-ink-700 leading-relaxed">{query.summary}</p>

                  <RowLabel>Risk Details</RowLabel>
                  <p className="pt-2 text-[0.75rem] text-ink-800 leading-relaxed">{query.riskDetails}</p>
                </div>
              </div>

              {/* Action plans */}
              <div className="space-y-4">
                {renderActionPlan(
                  { n: 1, due: 'Due 15 May 2026', priority: 'High', tone: 'implemented', evidence: 'Security audit logs, configuration screenshots of SAP 2FA module, and signed monthly user access review report (April 2026).' },
                  <div className="rounded-[8px] bg-brand-50/60 px-3 py-2.5">
                    <EditableTextBox value={actionPlan} onChange={setActionPlan} rows={2} ariaLabel="Action Plan 1" />
                  </div>,
                  <EditableTextBox value={auditorVerification} onChange={setAuditorVerification} rows={2} ariaLabel="Auditor Verification" />,
                )}
                {staticPlans.map(plan =>
                  renderActionPlan(
                    plan,
                    <div className="rounded-[8px] bg-brand-50/60 px-3.5 py-3 text-[0.75rem] text-ink-800 leading-relaxed">{plan.text}</div>,
                    <div className="border-l-2 border-compliant pl-3 py-1 text-[0.75rem] text-ink-800 leading-relaxed">{plan.verification}</div>,
                  )
                )}
              </div>
            </section>

            {/* ── Section 2 · Status Summary ── */}
            <section className="px-9 pt-2 pb-7 border-t border-canvas-border">
              <div className="pt-7">
                <NumberedHeading n={2} title="Status Summary" subtitle="Exceptions, classification and action-plan review breakdown" />
              </div>

              <GroupLabel>Exceptions Status</GroupLabel>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <StatCard n={1} label="Open"        tone="risk"      Icon={AlertCircle} />
                <StatCard n={2} label="In Progress" tone="mitigated" Icon={Clock} />
                <StatCard n={2} label="Closed"      tone="compliant" Icon={CheckCircle2} />
              </div>

              <GroupLabel>Classification Status</GroupLabel>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <StatCard n={3} label="Design Deficiency"          tone="brand" Icon={PenLine} />
                <StatCard n={3} label="System Deficiency"          tone="brand" Icon={LayoutGrid} />
                <StatCard n={3} label="Procedural Non-Compliance"  tone="brand" Icon={ClipboardCheck} />
              </div>

              <GroupLabel>Action Plan Review Status</GroupLabel>
              <div className="grid grid-cols-3 gap-4">
                <StatCard n={2} label="Approved (Implemented)"            tone="compliant" Icon={Check} />
                <StatCard n={1} label="Approved (Partially Implemented)"  tone="mitigated" Icon={Check} />
                <StatCard n={1} label="Rejected (Discrepancy)"            tone="risk"      Icon={X} />
              </div>
            </section>

            {/* Overall progress banner */}
            <div className="mx-9 mb-2 rounded-[12px] bg-gradient-to-br from-brand-800 to-brand-600 text-white px-6 py-5">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[0.8125rem] font-semibold">Overall Implementation Progress</span>
                <span className="text-[1.25rem] font-bold leading-none">40% <span className="text-[0.75rem] font-medium text-white/70">Implemented</span></span>
              </div>
              <div className="h-2 rounded-full bg-white/20 overflow-hidden">
                <div className="h-full rounded-full bg-white" style={{ width: '40%' }} />
              </div>
            </div>

            {/* ── Section 3 · Key Insights & Recommendations ── */}
            <section className="px-9 pt-6 pb-6">
              <NumberedHeading n={3} title="Key Insights & Recommendations" subtitle="Auditor observations and forward-looking guidance" />
              <div className="space-y-3">
                {insights.map(ins => (
                  <div key={ins.title} className={`bg-canvas-elevated border border-canvas-border border-l-[3px] ${ins.border} rounded-[10px] p-4 flex gap-3`}>
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${ins.tint}`}><ins.Icon size={15} /></span>
                    <div>
                      <div className="text-[0.8125rem] font-semibold text-ink-900 mb-0.5">{ins.title}</div>
                      <p className="text-[0.75rem] text-ink-700 leading-relaxed">{ins.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Auditor Comments */}
            <section className="px-9 pb-6">
              <div className="bg-brand-50/60 border border-brand-100 rounded-[12px] p-5 relative">
                <Quote size={28} className="absolute right-4 top-4 text-brand-200" aria-hidden="true" />
                <div className="flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-brand-700 mb-2.5">
                  <Quote size={12} /> Auditor Comments
                </div>
                <EditableTextBox value={auditorComments} onChange={setAuditorComments} rows={4} ariaLabel="Auditor Comments" />
              </div>
            </section>

            {/* ── Section 4 · Approvals & Sign-Off ── */}
            <section className="px-9 pt-2 pb-9">
              <NumberedHeading n={4} title="Approvals & Sign-Off" subtitle="Digital authorization of this Action Taken Report" />
              <div className="grid grid-cols-3 gap-4">
                {[
                  { Icon: PenLine,   role: 'Prepared by', name: preparedBy,    sub: 'Risk Owner' },
                  { Icon: Eye,       role: 'Reviewed by', name: auditorName,   sub: 'Auditor' },
                  { Icon: CheckCircle2, role: 'Approved by', name: '',         sub: 'Audit Committee' },
                ].map(card => (
                  <div key={card.role} className="rounded-[10px] border border-canvas-border p-5">
                    <div className="flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-ink-500 mb-3">
                      <card.Icon size={12} /> {card.role}
                    </div>
                    {card.name ? (
                      <>
                        <div className="text-[0.8125rem] font-bold text-ink-900 leading-tight mb-0.5">{card.name}</div>
                        <div className="text-[0.6875rem] text-ink-600 mb-5">{card.sub}</div>
                      </>
                    ) : (
                      <div className="text-[0.6875rem] text-ink-500 mb-5">{card.sub}</div>
                    )}
                    <div className="border-t border-dashed border-canvas-border pt-2.5">
                      <div className="text-[0.6875rem] italic text-ink-500 text-center">Signature / Digital Approval</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-center text-[0.75rem] text-ink-500 mt-5">Date of Sign-Off: <span className="font-semibold text-ink-700">{generatedOn}</span></div>
            </section>
          </article>
        </div>

        {/* Modal footer */}
        <footer className="shrink-0 px-6 py-3.5 border-t border-canvas-border flex items-center justify-end gap-2">
          {manageExceptionsQueryId && (
            <div className="mr-auto">
              <ManageExceptionsLaunchButton queryId={manageExceptionsQueryId} />
            </div>
          )}
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
