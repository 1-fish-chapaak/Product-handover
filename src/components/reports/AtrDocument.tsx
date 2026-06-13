import { Sparkles, Calendar, FileText, ShieldCheck, PenLine, Eye, CheckCircle2, Wrench } from 'lucide-react';
import type {
  AtrMeta, AtrObservation, AtrActionPlan, AtrInsight,
  AtrRisk, AtrClassification, AtrObservationStatus, AtrActionStatus,
} from './atrTypes';
import { computeExecSummary } from './atrTemplate';

// ─── Token maps (theme defines base / -50 / -700 only for semantic colors) ───
const RISK_PILL: Record<AtrRisk, string> = {
  High: 'bg-risk-50 text-risk-700', Medium: 'bg-mitigated-50 text-mitigated-700', Low: 'bg-compliant-50 text-compliant-700',
};
const RISK_DOT: Record<AtrRisk, string> = { High: 'bg-risk', Medium: 'bg-mitigated', Low: 'bg-compliant' };
const OBS_STATUS_PILL: Record<AtrObservationStatus, { cls: string; dot: string }> = {
  Closed:        { cls: 'bg-compliant-50 text-compliant-700', dot: 'bg-compliant' },
  'In Progress': { cls: 'bg-mitigated-50 text-mitigated-700', dot: 'bg-mitigated' },
  Open:          { cls: 'bg-high-50 text-high-700',           dot: 'bg-high' },
  Overdue:       { cls: 'bg-risk-50 text-risk-700',           dot: 'bg-risk' },
};
const ACTION_STATUS: Record<AtrActionStatus, { pill: string; border: string }> = {
  Implemented:             { pill: 'bg-compliant-50 text-compliant-700', border: 'border-t-compliant' },
  'Partially Implemented': { pill: 'bg-mitigated-50 text-mitigated-700', border: 'border-t-mitigated' },
  Pending:                 { pill: 'bg-risk-50 text-risk-700',           border: 'border-t-risk' },
  Overdue:                 { pill: 'bg-risk-50 text-risk-700',           border: 'border-t-risk' },
  'Not Due':               { pill: 'bg-[#EEEEF1] text-ink-600',          border: 'border-t-ink-300' },
};
const CLASSIFICATION_PILL: Record<AtrClassification, string> = {
  'Design Deficiency': 'bg-high-50 text-high-700',
  'System Deficiency': 'bg-risk-50 text-risk-700',
  'Procedural Non-Compliance': 'bg-brand-50 text-brand-700',
};

type Tone = 'brand' | 'risk' | 'mitigated' | 'compliant' | 'high' | 'ink';
const KPI_TONE: Record<Tone, string> = {
  brand: 'text-brand-700', risk: 'text-risk-700', mitigated: 'text-mitigated-700',
  compliant: 'text-compliant-700', high: 'text-high-700', ink: 'text-ink-700',
};
const KPI_BORDER: Record<Tone, string> = {
  brand: 'border-l-brand-500', risk: 'border-l-risk', mitigated: 'border-l-mitigated',
  compliant: 'border-l-compliant', high: 'border-l-high', ink: 'border-l-ink-300',
};

function fmt(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

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

function MetaCell({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-ink-500 mb-1.5">{label}</div>
      <div className="border-l-[3px] border-brand-500 pl-3">
        <div className="text-[0.8125rem] font-bold text-ink-900">{value}</div>
      </div>
    </div>
  );
}

function FieldRow({ label, children, italic }: { label: string; children: React.ReactNode; italic?: boolean }) {
  if (children == null || children === '') return null;
  return (
    <>
      <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-ink-500 pt-2">{label}</div>
      <p className={`pt-2 text-[0.75rem] text-ink-800 leading-relaxed ${italic ? 'italic text-ink-700' : ''}`}>{children}</p>
    </>
  );
}

const PROCESS_DESC: Record<string, string> = {
  'Procurement (P2P)': 'Vendor master, PO, GRN',
  'Inventory Management': 'Stock variance, scrap sale',
  'Dispatch & Logistics': 'Freight, gate exit, weighbridge',
};

export default function AtrDocument({
  meta, observations, insights = [], headerActions, maxWidthClass = 'max-w-[840px]',
}: {
  meta: AtrMeta;
  observations: AtrObservation[];
  insights?: AtrInsight[];
  /** Optional CTAs rendered in the banner top-right (e.g. on the saved report). */
  headerActions?: React.ReactNode;
  /** Width of the document surface. */
  maxWidthClass?: string;
}) {
  const ex = computeExecSummary(observations);

  // Build the KPI list — only metrics that have data.
  const kpis: { label: string; value: number; tone: Tone }[] = [];
  kpis.push({ label: 'Total Observations', value: ex.totalObservations, tone: 'brand' });
  if (ex.totalActionPlans) kpis.push({ label: 'Total Management Action Plans', value: ex.totalActionPlans, tone: 'brand' });
  (['Closed', 'In Progress', 'Open', 'Overdue'] as const).forEach(s => {
    if (ex.obsStatus[s]) kpis.push({ label: s, value: ex.obsStatus[s], tone: s === 'Closed' ? 'compliant' : s === 'In Progress' ? 'mitigated' : s === 'Open' ? 'high' : 'risk' });
  });
  (['High', 'Medium', 'Low'] as const).forEach(r => {
    if (ex.risk[r]) kpis.push({ label: `${r} Risk`, value: ex.risk[r], tone: r === 'High' ? 'risk' : r === 'Medium' ? 'mitigated' : 'compliant' });
  });
  const classTone: Record<AtrClassification, Tone> = { 'Design Deficiency': 'high', 'System Deficiency': 'risk', 'Procedural Non-Compliance': 'brand' };
  (Object.keys(ex.classification) as AtrClassification[]).forEach(c => {
    if (ex.classification[c]) kpis.push({ label: c, value: ex.classification[c], tone: classTone[c] });
  });

  // Process-wise rollup (only when at least one observation carries a process).
  const processRows = ex.hasProcess
    ? Object.entries(observations.reduce((acc, o) => {
        const p = o.process ?? 'Unassigned';
        acc[p] = acc[p] ?? { total: 0, Closed: 0, 'In Progress': 0, Open: 0, Overdue: 0 };
        acc[p].total += 1;
        if (o.status) acc[p][o.status] += 1;
        return acc;
      }, {} as Record<string, { total: number } & Record<AtrObservationStatus, number>>))
    : [];

  return (
    <article className={`report-printable ${maxWidthClass} mx-auto bg-canvas-elevated border border-canvas-border rounded-[12px] shadow-sm overflow-hidden`}>
      {/* Brand banner */}
      <div className="relative px-9 py-7 bg-gradient-to-br from-brand-700 to-brand-600 text-white overflow-hidden">
        <div className="absolute -right-6 -top-10 w-48 h-48 rounded-full bg-white/5" aria-hidden="true" />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-[8px] bg-white/15 flex items-center justify-center"><Sparkles size={15} /></div>
              <div className="leading-none">
                <div className="text-[0.8125rem] font-bold tracking-wide">IRAME.AI</div>
                <div className="text-[0.5rem] font-semibold tracking-[0.22em] text-white/70 mt-0.5">AUDIT INTELLIGENCE</div>
              </div>
            </div>
            <h1 className="text-[1.75rem] font-bold tracking-tight leading-tight">Action Taken Report</h1>
            {(meta.auditEntity || meta.auditPeriod) && (
              <p className="text-[0.8125rem] text-white/80 mt-1">
                {[meta.auditEntity, meta.auditPeriod].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
          {headerActions && <div className="shrink-0 flex items-center gap-2 print:hidden">{headerActions}</div>}
        </div>
      </div>

      {/* Metadata grid */}
      <div className="px-9 py-6 grid grid-cols-3 gap-x-8 gap-y-5 border-b border-canvas-border">
        <MetaCell label="Report ID" value={meta.reportId} />
        <MetaCell label="Audit Title" value={meta.auditTitle} />
        <MetaCell label="Audit Period" value={meta.auditPeriod} />
        <MetaCell label="Prepared By" value={meta.preparedBy} />
        <MetaCell label="Generated On" value={meta.generatedOn} />
        <MetaCell label="Audit Entity" value={meta.auditEntity} />
      </div>

      {/* Section 1 — Executive Summary */}
      <section className="px-9 pt-7 pb-6">
        <NumberedHeading n={1} title="Executive Summary" subtitle="Overall observation and management action plan rollup" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {kpis.map(k => (
            <div key={k.label} className={`rounded-[10px] border border-canvas-border border-l-[3px] ${KPI_BORDER[k.tone]} bg-canvas-elevated p-4`}>
              <div className={`text-[1.625rem] font-bold tabular-nums leading-none mb-1 ${KPI_TONE[k.tone]}`}>{k.value}</div>
              <div className="text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-600 leading-tight">{k.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 2 — Process-Wise Observation Summary */}
      {processRows.length > 0 && (
        <section className="px-9 pt-2 pb-6 border-t border-canvas-border">
          <div className="pt-6">
            <NumberedHeading n={2} title="Process-Wise Observation Summary" subtitle="Status rollup grouped by audited process" />
          </div>
          <div className="overflow-hidden rounded-[10px] border border-canvas-border">
            <table className="w-full text-[0.75rem]">
              <thead>
                <tr className="bg-brand-50/60 text-ink-700 text-left">
                  <th className="px-4 py-2.5 font-semibold">Process</th>
                  <th className="px-3 py-2.5 font-semibold text-center">Total</th>
                  <th className="px-3 py-2.5 font-semibold text-center">Closed</th>
                  <th className="px-3 py-2.5 font-semibold text-center">In Progress</th>
                  <th className="px-3 py-2.5 font-semibold text-center">Open</th>
                  <th className="px-3 py-2.5 font-semibold text-center">Overdue</th>
                </tr>
              </thead>
              <tbody>
                {processRows.map(([proc, r]) => (
                  <tr key={proc} className="border-t border-canvas-border">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-ink-900">{proc}</div>
                      {PROCESS_DESC[proc] && <div className="text-[0.6875rem] text-ink-500">{PROCESS_DESC[proc]}</div>}
                    </td>
                    <td className="px-3 py-3 text-center tabular-nums font-semibold text-ink-800">{r.total}</td>
                    <td className="px-3 py-3 text-center tabular-nums text-compliant-700">{r.Closed || 0}</td>
                    <td className="px-3 py-3 text-center tabular-nums text-mitigated-700">{r['In Progress'] || 0}</td>
                    <td className="px-3 py-3 text-center tabular-nums text-high-700">{r.Open || 0}</td>
                    <td className="px-3 py-3 text-center tabular-nums text-risk-700">{r.Overdue || 0}</td>
                  </tr>
                ))}
                <tr className="border-t border-canvas-border bg-[#FAFAFB] font-semibold">
                  <td className="px-4 py-3 text-brand-700">TOTAL</td>
                  <td className="px-3 py-3 text-center tabular-nums">{ex.totalObservations}</td>
                  <td className="px-3 py-3 text-center tabular-nums text-compliant-700">{ex.obsStatus.Closed}</td>
                  <td className="px-3 py-3 text-center tabular-nums text-mitigated-700">{ex.obsStatus['In Progress']}</td>
                  <td className="px-3 py-3 text-center tabular-nums text-high-700">{ex.obsStatus.Open}</td>
                  <td className="px-3 py-3 text-center tabular-nums text-risk-700">{ex.obsStatus.Overdue}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Section 3 — Observation Details */}
      <section className="px-9 pt-2 pb-6 border-t border-canvas-border">
        <div className="pt-6">
          <NumberedHeading n={3} title="Observation Details" subtitle="Issue, risk, management action plan, evidence and verification" />
        </div>
        <div className="space-y-5">
          {observations.map((o, i) => (
            <ObservationCard key={i} index={i + 1} obs={o} />
          ))}
        </div>
      </section>

      {/* Section 4 — Key Insights (only when provided) */}
      {insights.length > 0 && (
        <section className="px-9 pt-2 pb-6 border-t border-canvas-border">
          <div className="pt-6">
            <NumberedHeading n={4} title="Key Insights & Recommendations" subtitle="Auditor observations and forward-looking guidance" />
          </div>
          <div className="space-y-3">
            {insights.map((ins, i) => (
              <div key={i} className="bg-brand-50/40 border border-canvas-border border-l-[3px] border-l-brand-500 rounded-[10px] p-4">
                <div className="text-[0.8125rem] font-semibold text-ink-900 mb-0.5">{ins.title}</div>
                <p className="text-[0.75rem] text-ink-700 leading-relaxed">{ins.body}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Overall progress (only when action-plan statuses exist) */}
      {ex.progressPct !== null && ex.totalActionPlans > 0 && (
        <div className="mx-9 mb-6 rounded-[12px] bg-gradient-to-br from-brand-800 to-brand-600 text-white px-6 py-5">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[0.8125rem] font-semibold">Overall Implementation Progress</span>
            <span className="text-[1.25rem] font-bold leading-none">{ex.progressPct}%</span>
          </div>
          <div className="h-2 rounded-full bg-white/20 overflow-hidden">
            <div className="h-full rounded-full bg-white" style={{ width: `${ex.progressPct}%` }} />
          </div>
          <p className="text-[0.6875rem] text-white/70 mt-2">
            Of {ex.totalActionPlans} management action plan{ex.totalActionPlans === 1 ? '' : 's'}, {ex.actionStatus.Implemented} fully implemented
            {ex.actionStatus['Partially Implemented'] ? ` and ${ex.actionStatus['Partially Implemented']} partially implemented` : ''}.
          </p>
        </div>
      )}

      {/* Section 5 — Approvals & Sign-Off */}
      <section className="px-9 pt-2 pb-9 border-t border-canvas-border">
        <div className="pt-6">
          <NumberedHeading n={insights.length > 0 ? 5 : 4} title="Approvals & Sign-Off" subtitle="Digital authorisation of this Action Taken Report" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { Icon: PenLine, role: 'Prepared by', name: meta.preparedBy },
            { Icon: Eye, role: 'Reviewed by', name: '' },
            { Icon: CheckCircle2, role: 'Approved by', name: '' },
          ].map(c => (
            <div key={c.role} className="rounded-[10px] border border-canvas-border p-5">
              <div className="flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-ink-500 mb-3">
                <c.Icon size={12} /> {c.role}
              </div>
              {c.name ? (
                <div className="text-[0.8125rem] font-bold text-ink-900 leading-tight mb-5">{c.name}</div>
              ) : (
                <div className="h-5 mb-5" />
              )}
              <div className="border-t border-dashed border-canvas-border pt-2.5">
                <div className="text-[0.6875rem] italic text-ink-500 text-center">Signature / Digital Approval</div>
              </div>
            </div>
          ))}
        </div>
        {meta.generatedOn && (
          <div className="text-center text-[0.75rem] text-ink-500 mt-5">Date of Sign-Off: <span className="font-semibold text-ink-700">{meta.generatedOn}</span></div>
        )}
      </section>
    </article>
  );
}

function ObservationCard({ index, obs }: { index: number; obs: AtrObservation }) {
  return (
    <div className="border border-canvas-border rounded-[10px] overflow-hidden">
      {/* Header */}
      <div className="bg-brand-50/40 px-5 py-4 flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2.5 flex-wrap min-w-0">
          <span className="shrink-0 w-7 h-7 rounded-[8px] bg-brand-600 text-white text-[0.8125rem] font-bold flex items-center justify-center">{index}</span>
          <div className="min-w-0">
            <h3 className="text-[0.9375rem] font-bold text-ink-900 leading-tight">{obs.title}</h3>
            {obs.process && <div className="text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-ink-500 mt-0.5">{obs.process}</div>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {obs.risk && (
            <span className={`inline-flex items-center gap-1.5 h-6 px-2.5 text-[0.625rem] font-bold uppercase tracking-wider rounded-full ${RISK_PILL[obs.risk]}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${RISK_DOT[obs.risk]}`} />{obs.risk} Risk
            </span>
          )}
          {obs.status && (
            <span className={`inline-flex items-center gap-1.5 h-6 px-2.5 text-[0.625rem] font-bold uppercase tracking-wider rounded-full ${OBS_STATUS_PILL[obs.status].cls}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${OBS_STATUS_PILL[obs.status].dot}`} />{obs.status}
            </span>
          )}
        </div>
      </div>

      <div className="px-5 py-4">
        {/* Issue / risk rows */}
        {(obs.description || obs.querySummary || obs.riskSummary) && (
          <div className="grid grid-cols-[150px_1fr] gap-x-5 gap-y-2 items-start mb-4">
            <FieldRow label="Issue Description">{obs.description}</FieldRow>
            <FieldRow label="Query Summary" italic>{obs.querySummary}</FieldRow>
            <FieldRow label="Risk Summary">{obs.riskSummary}</FieldRow>
          </div>
        )}

        {/* Action plans */}
        <div className="space-y-3">
          {obs.actionPlans.map((ap, i) => (
            <ActionPlanCard key={i} index={i + 1} plan={ap} classification={obs.classification} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ActionPlanCard({ index, plan, classification }: { index: number; plan: AtrActionPlan; classification?: AtrClassification }) {
  const tone = plan.status ? ACTION_STATUS[plan.status] : null;
  return (
    <div className={`border border-canvas-border rounded-[10px] p-4 ${tone ? `border-t-2 ${tone.border}` : ''}`}>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="inline-flex items-center h-6 px-2.5 text-[0.625rem] font-bold uppercase tracking-wider rounded bg-brand-50 text-brand-700">Management Action Plan {index}</span>
          {classification && (
            <span className={`inline-flex items-center h-6 px-2.5 text-[0.625rem] font-bold uppercase tracking-wider rounded-full ${CLASSIFICATION_PILL[classification]}`}>
              {classification}
            </span>
          )}
          {plan.dueDate && (
            <span className="inline-flex items-center gap-1.5 h-6 px-2.5 text-[0.6875rem] font-medium rounded-full bg-[#FAFAFB] border border-canvas-border text-ink-700">
              <Calendar size={11} className="text-ink-500" /> Due {fmt(plan.dueDate)}
            </span>
          )}
        </div>
        {plan.status && tone && (
          <span className={`inline-flex items-center h-6 px-2.5 text-[0.625rem] font-bold uppercase tracking-wider rounded-full ${tone.pill}`}>{plan.status}</span>
        )}
      </div>

      <p className="text-[0.75rem] text-ink-800 leading-relaxed mb-3">{plan.text}</p>

      {(plan.actionTaken || plan.evidence || plan.verification) && (
        <div className="grid grid-cols-[150px_1fr] gap-x-5 gap-y-3 items-start border-t border-dashed border-canvas-border pt-3">
          {plan.actionTaken && (
            <>
              <div className="flex items-center gap-1.5 pt-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-ink-500">
                <Wrench size={12} /> Action Taken
              </div>
              <p className="pt-1 text-[0.75rem] text-ink-800 leading-relaxed">{plan.actionTaken}</p>
            </>
          )}
          {plan.evidence && (
            <>
              <div className="flex items-center gap-1.5 pt-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-ink-500">
                <FileText size={12} /> Evidence / Comments
              </div>
              <p className="pt-1 text-[0.75rem] italic text-ink-600 leading-relaxed">{plan.evidence}</p>
            </>
          )}
          {plan.verification && (
            <>
              <div className="flex items-center gap-1.5 pt-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-ink-500">
                <ShieldCheck size={12} /> Checker / Auditor Verification
              </div>
              <div className="pt-0.5">
                <div className="border-l-2 border-compliant pl-3 py-1 text-[0.75rem] text-ink-800 leading-relaxed">{plan.verification}</div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
