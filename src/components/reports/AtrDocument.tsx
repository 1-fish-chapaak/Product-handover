import { Calendar, PenLine, Eye, Lightbulb } from 'lucide-react';
import type {
  AtrMeta, AtrObservation, AtrActionPlan, AtrInsight,
  AtrClassification, AtrObservationStatus, AtrActionStatus,
} from './atrTypes';
import { computeExecSummary } from './atrTemplate';
import FloatingLines from '../shared/FloatingLines';
import { ReportMetaPanel } from './ReportDocumentChrome';

// ─── Token maps (theme defines base / -50 / -700 only for semantic colors) ───
const OBS_STATUS_PILL: Record<AtrObservationStatus, { cls: string; dot: string }> = {
  Closed:        { cls: 'bg-compliant-50 text-compliant-700', dot: 'bg-compliant' },
  'In Progress': { cls: 'bg-mitigated-50 text-mitigated-700', dot: 'bg-mitigated' },
  Open:          { cls: 'bg-high-50 text-high-700',           dot: 'bg-high' },
  Overdue:       { cls: 'bg-risk-50 text-risk-700',           dot: 'bg-risk' },
};
const ACTION_STATUS: Record<AtrActionStatus, { pill: string; border: string; dot: string }> = {
  Implemented:             { pill: 'bg-compliant-50 text-compliant-700', border: 'border-t-compliant', dot: 'bg-compliant' },
  'Partially Implemented': { pill: 'bg-mitigated-50 text-mitigated-700', border: 'border-t-mitigated', dot: 'bg-mitigated' },
  Pending:                 { pill: 'bg-risk-50 text-risk-700',           border: 'border-t-risk',      dot: 'bg-risk' },
  Overdue:                 { pill: 'bg-risk-50 text-risk-700',           border: 'border-t-risk',      dot: 'bg-risk' },
  'Not Due':               { pill: 'bg-[#EEEEF1] text-ink-600',          border: 'border-t-ink-300',   dot: 'bg-ink-400' },
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
        <h2 className="text-[1.1875rem] font-semibold text-ink-900 tracking-tight leading-tight">{title}</h2>
        <p className="text-[0.75rem] text-ink-500">{subtitle}</p>
      </div>
    </div>
  );
}

function FieldRow({ label, children, italic }: { label: string; children: React.ReactNode; italic?: boolean }) {
  if (children == null || children === '') return null;
  return (
    <>
      <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-ink-500 pt-2">{label}</div>
      <p className={`pt-2 text-[0.875rem] text-ink-800 leading-relaxed ${italic ? 'italic text-ink-600' : ''}`}>{children}</p>
    </>
  );
}


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

  // Executive Summary — exactly six KPIs. Overdue observations fold into Open.
  const totalExceptions = meta.totalExceptions ?? ex.totalExceptions;
  const openCount = ex.obsStatus.Open + ex.obsStatus.Overdue;
  const kpis: { label: string; value: number; tone: Tone }[] = [
    { label: 'Total Observations', value: ex.totalObservations, tone: 'brand' },
    { label: 'Total Exceptions', value: totalExceptions, tone: 'ink' },
    { label: 'Total Management Action Plan', value: ex.totalActionPlans, tone: 'brand' },
    { label: 'Open', value: openCount, tone: 'high' },
    { label: 'Closed', value: ex.obsStatus.Closed, tone: 'compliant' },
    { label: 'In Progress', value: ex.obsStatus['In Progress'], tone: 'mitigated' },
  ];

  // The Observation Wise Summary buckets each observation's status into the same
  // three the Executive Summary uses (Overdue counts as Open).
  const displayStatus = (s?: AtrObservationStatus): 'Open' | 'In Progress' | 'Closed' =>
    s === 'Closed' ? 'Closed' : s === 'In Progress' ? 'In Progress' : 'Open';

  return (
    <article className={`report-printable ${maxWidthClass} mx-auto bg-canvas-elevated border border-canvas-border rounded-[12px] shadow-sm overflow-hidden`}>
      {/* Purple gradient letterhead — IRAME.AI lockup + title over the
          floating-line art, matching the report covers. */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#3b0b72] to-[#6a12cd] px-9 pt-8 pb-7">
        <div
          className="absolute inset-0 z-0 print:hidden"
          style={{ maskImage: 'linear-gradient(to right, transparent 35%, white 70%)', WebkitMaskImage: 'linear-gradient(to right, transparent 35%, white 70%)' }}
          aria-hidden="true"
        >
          <FloatingLines
            enabledWaves={['top', 'middle']}
            lineCount={6}
            lineDistance={6}
            bendRadius={4}
            bendStrength={-0.3}
            interactive
            parallax={false}
            color="#e879f9"
            opacity={0.3}
          />
        </div>
        <div className="relative z-10 flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-[2rem] font-semibold tracking-tight leading-tight text-white">Action Taken Report</h1>
            {(meta.auditEntity || meta.auditPeriod) && (
              <p className="text-[0.8125rem] text-white/70 mt-1.5">
                {[meta.auditEntity, meta.auditPeriod].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
          <div className="shrink-0 flex flex-col items-end gap-3">
            {headerActions && <div className="flex items-center gap-2 print:hidden">{headerActions}</div>}
            {/* Key facts — glanceable headline numbers on the banner right. */}
            {ex.totalObservations > 0 && (
              <div className="flex items-stretch rounded-[12px] border border-white/20 bg-white/10 overflow-hidden">
                {[
                  { value: ex.totalObservations, label: 'Observations' },
                  { value: totalExceptions, label: 'Exceptions' },
                  { value: ex.totalActionPlans, label: 'Action Plans' },
                ].map((s, i) => (
                  <div key={s.label} className={`px-5 py-3 text-center ${i > 0 ? 'border-l border-white/15' : ''}`}>
                    <div className="text-[1.5rem] font-bold text-white tabular-nums leading-none">{s.value}</div>
                    <div className="text-[0.625rem] font-semibold uppercase tracking-wider text-white/65 mt-1.5 whitespace-nowrap">{s.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Metadata — structured report-facts panel. Audit Entity + Period live in
          the banner subtitle, so the panel carries only the unique facts. */}
      <div className="px-9 py-6 border-b border-canvas-border">
        <ReportMetaPanel
          columns={4}
          items={[
            { label: 'Report ID', value: meta.reportId },
            { label: 'Audit Title', value: meta.auditTitle },
            { label: 'Prepared By', value: meta.preparedBy },
            { label: 'Generated On', value: meta.generatedOn },
          ]}
        />
      </div>

      {/* Section 1 — Executive Summary */}
      <section className="px-9 pt-7 pb-6">
        <NumberedHeading n={1} title="Executive Summary" subtitle="Overall observation and management action plan rollup" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {kpis.map(k => (
            <div key={k.label} className={`rounded-[10px] border border-canvas-border border-l-[3px] ${KPI_BORDER[k.tone]} bg-canvas-elevated p-4`}>
              <div className={`text-[1.625rem] font-bold tabular-nums leading-none mb-1 ${KPI_TONE[k.tone]}`}>{k.value}</div>
              <div className="text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-600 leading-tight">{k.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 2 — Observation Wise Summary */}
      <section className="px-9 pt-2 pb-6 border-t border-canvas-border">
        <div className="pt-6">
          <NumberedHeading n={2} title="Observation Wise Summary" subtitle="Exceptions, management action plans and status — per observation" />
        </div>
        <div className="overflow-hidden rounded-[10px] border border-canvas-border">
          <table className="w-full text-[0.75rem]">
            <thead>
              <tr className="bg-brand-50/60 text-ink-700 text-left">
                <th className="px-4 py-2.5 font-semibold">Observation</th>
                <th className="px-3 py-2.5 font-semibold text-center">Exceptions</th>
                <th className="px-3 py-2.5 font-semibold text-center">Management Action Plans</th>
                <th className="px-3 py-2.5 font-semibold text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {observations.map((o, i) => {
                const st = displayStatus(o.status);
                const stCls = st === 'Closed' ? 'bg-compliant-50 text-compliant-700' : st === 'In Progress' ? 'bg-mitigated-50 text-mitigated-700' : 'bg-high-50 text-high-700';
                return (
                  <tr key={i} className="border-t border-canvas-border">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-ink-900 leading-snug">{o.title}</div>
                      {o.process && <div className="text-[0.6875rem] text-ink-500">{o.process}</div>}
                    </td>
                    <td className="px-3 py-3 text-center tabular-nums font-semibold text-ink-800">{o.exceptions ?? 1}</td>
                    <td className="px-3 py-3 text-center tabular-nums text-ink-800">{o.actionPlans.length}</td>
                    <td className="px-3 py-3 text-center">
                      <span className={`inline-flex items-center h-6 px-2.5 rounded-full text-[0.6875rem] font-semibold ${stCls}`}>{st}</span>
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t border-canvas-border bg-[#FAFAFB] font-semibold">
                <td className="px-4 py-3 text-brand-700">TOTAL · {ex.totalObservations} observation{ex.totalObservations === 1 ? '' : 's'}</td>
                <td className="px-3 py-3 text-center tabular-nums">{totalExceptions}</td>
                <td className="px-3 py-3 text-center tabular-nums">{ex.totalActionPlans}</td>
                <td className="px-3 py-3 text-center text-[0.6875rem]">
                  <span className="text-high-700">{openCount} Open</span> · <span className="text-mitigated-700">{ex.obsStatus['In Progress']} In&nbsp;Progress</span> · <span className="text-compliant-700">{ex.obsStatus.Closed} Closed</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

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
              <div key={i} className="flex gap-3.5 bg-canvas-elevated border border-canvas-border rounded-[10px] p-4 hover:border-brand-200 transition-colors">
                <span className="shrink-0 mt-0.5 w-6 h-6 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center"><Lightbulb size={13} /></span>
                <div className="min-w-0">
                  <div className="text-[0.9375rem] font-semibold text-ink-900 mb-1 leading-snug">{ins.title}</div>
                  <p className="text-[0.875rem] text-ink-700 leading-relaxed">{ins.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Section 5 — Approvals & Sign-Off */}
      <section className="px-9 pt-2 pb-9 border-t border-canvas-border">
        <div className="pt-6">
          <NumberedHeading n={insights.length > 0 ? 5 : 4} title="Approvals & Sign-Off" subtitle="Digital authorisation of this Action Taken Report" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[
            { Icon: PenLine, role: 'Prepared by', name: meta.preparedBy },
            { Icon: Eye, role: 'Reviewed by', name: '' },
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
            <h3 className="text-[1.0625rem] font-semibold text-ink-900 leading-tight">{obs.title}</h3>
            {obs.process && <div className="text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-ink-500 mt-0.5">{obs.process}</div>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Observation-level status only: Open / Closed / In Progress (Overdue shows as Open). */}
          {obs.status && (() => {
            const s: AtrObservationStatus = obs.status === 'Overdue' ? 'Open' : obs.status;
            return (
              <span className={`inline-flex items-center gap-1.5 h-6 px-2.5 text-[0.625rem] font-bold uppercase tracking-wider rounded-full ${OBS_STATUS_PILL[s].cls}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${OBS_STATUS_PILL[s].dot}`} />{s}
              </span>
            );
          })()}
        </div>
      </div>

      <div className="px-5 py-4">
        {/* Issue description */}
        {obs.description && (
          <div className="grid grid-cols-[150px_1fr] gap-x-5 gap-y-2 items-start mb-4">
            <FieldRow label="Issue Description">{obs.description}</FieldRow>
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
    <div className={`border border-canvas-border rounded-[12px] overflow-hidden bg-canvas-elevated ${tone ? `border-t-2 ${tone.border}` : ''}`}>
      <div className="p-4">
        {/* Row 1 — plan badge + title, inline */}
        <div className="flex items-center gap-2.5 flex-wrap mb-2.5">
          <span className="inline-flex items-center h-6 px-2.5 text-[0.625rem] font-bold uppercase tracking-wider rounded bg-brand-50 text-brand-700 shrink-0">Management Action Plan {index}</span>
          {plan.title && <h4 className="text-[0.875rem] font-bold text-ink-900 leading-snug">{plan.title}</h4>}
        </div>

        {/* Row 2 — due date on the LEFT · classification + status on the RIGHT */}
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          {plan.dueDate ? (
            <span className="inline-flex items-center gap-1.5 h-7 px-3 text-[0.75rem] font-semibold rounded-full bg-brand-50 text-brand-700">
              <Calendar size={12} /> Due {fmt(plan.dueDate)}
            </span>
          ) : <span />}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {classification && (
              <span className={`inline-flex items-center h-7 px-3 text-[0.625rem] font-bold uppercase tracking-wider rounded-full ${CLASSIFICATION_PILL[classification]}`}>
                {classification}
              </span>
            )}
            {plan.status && tone && (
              <span className={`inline-flex items-center gap-1.5 h-7 px-3 text-[0.6875rem] font-bold uppercase tracking-wider rounded-full ${tone.pill}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} />{plan.status === 'Pending' ? 'In-Progress' : plan.status}
              </span>
            )}
          </div>
        </div>

        {/* MAP Details · Action Taken · Evidence · Auditor Verification — one sober, aligned grid */}
        {(plan.text || plan.actionTaken || plan.evidence || plan.verification) && (
          <div className="grid grid-cols-[150px_1fr] gap-x-5 gap-y-3 items-start border-t border-canvas-border pt-3.5">
            {plan.text && (
              <>
                <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-ink-500 pt-0.5">MAP Details</div>
                <p className="text-[0.75rem] text-ink-800 leading-relaxed">{plan.text}</p>
              </>
            )}
            {plan.actionTaken && (
              <>
                <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-ink-500 pt-0.5">Action Taken</div>
                <p className="text-[0.75rem] text-ink-800 leading-relaxed">{plan.actionTaken}</p>
              </>
            )}
            {plan.evidence && (
              <>
                <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-ink-500 pt-0.5">Evidence</div>
                <p className="text-[0.75rem] text-ink-700 leading-relaxed">{plan.evidence}</p>
              </>
            )}
            {plan.verification && (
              <>
                <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-ink-500 pt-0.5">Auditor Verification</div>
                <p className="text-[0.75rem] text-ink-800 leading-relaxed">{plan.verification}</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
