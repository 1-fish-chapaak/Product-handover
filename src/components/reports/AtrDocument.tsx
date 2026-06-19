import { useRef } from 'react';
import { Sparkles, Calendar } from 'lucide-react';
import type {
  AtrMeta, AtrObservation, AtrActionPlan, AtrInsight,
  AtrClassification, AtrObservationStatus, AtrActionStatus,
} from './atrTypes';
import { computeExecSummary } from './atrTemplate';
import { ATR_SECTION_ORDER, type AtrSectionKey } from './atrSections';

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

/** Inline click-to-edit text. Read-only unless `editable`; commits on blur so no
 *  per-keystroke re-render disturbs the caret. */
function EditableText({ value, onCommit, editable, className = '', placeholder, multiline }: {
  value: string;
  onCommit?: (next: string) => void;
  editable?: boolean;
  className?: string;
  placeholder?: string;
  multiline?: boolean;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  if (!editable) return <>{value}</>;
  return (
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      data-ph={placeholder}
      onBlur={e => { const t = (e.currentTarget.textContent ?? '').trim(); if (t !== value) onCommit?.(t); }}
      onKeyDown={e => { if (!multiline && e.key === 'Enter') { e.preventDefault(); (e.currentTarget as HTMLSpanElement).blur(); } }}
      className={`atr-ed inline-block min-w-[32px] outline-none rounded-[3px] px-0.5 -mx-0.5 cursor-text hover:bg-brand-50/40 focus:bg-brand-50/60 focus:ring-2 focus:ring-brand-600/30 ${className}`}
    >
      {value}
    </span>
  );
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

function MetaCell({ label, value, editable, onCommit }: { label: string; value?: string; editable?: boolean; onCommit?: (v: string) => void }) {
  if (!value && !editable) return null;
  return (
    <div>
      <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-ink-500 mb-1.5">{label}</div>
      <div className="border-l-[3px] border-brand-500 pl-3">
        <div className="text-[0.8125rem] font-bold text-ink-900"><EditableText value={value ?? ''} editable={editable} onCommit={onCommit} placeholder={`Add ${label.toLowerCase()}`} /></div>
      </div>
    </div>
  );
}

export default function AtrDocument({
  meta, observations, insights = [], headerActions, maxWidthClass = 'max-w-[840px]',
  editable, onMetaChange, onObservationsChange, onInsightsChange,
  sectionOrder = ATR_SECTION_ORDER, hiddenSections = [],
  renderObservationActions,
}: {
  meta: AtrMeta;
  observations: AtrObservation[];
  insights?: AtrInsight[];
  /** Optional CTAs rendered in the banner top-right (e.g. on the saved report). */
  headerActions?: React.ReactNode;
  /** Width of the document surface. */
  maxWidthClass?: string;
  /** Opt-in inline editing (default off → existing read-only usages unchanged). */
  editable?: boolean;
  onMetaChange?: (meta: AtrMeta) => void;
  onObservationsChange?: (observations: AtrObservation[]) => void;
  onInsightsChange?: (insights: AtrInsight[]) => void;
  /** Section order + visibility (default = canonical order, nothing hidden). */
  sectionOrder?: AtrSectionKey[];
  hiddenSections?: AtrSectionKey[];
  /** Optional per-observation action slot (e.g. a "Manage Exceptions" CTA),
   *  rendered in each observation card header. Receives the 0-based index so the
   *  caller can map it back to the source observation. Print-hidden by caller. */
  renderObservationActions?: (index: number) => React.ReactNode;
}) {
  const ex = computeExecSummary(observations);

  const setMeta = (key: keyof AtrMeta, v: string) => onMetaChange?.({ ...meta, [key]: v || undefined });
  const setObs = (i: number, next: AtrObservation) => onObservationsChange?.(observations.map((o, idx) => (idx === i ? next : o)));
  const setInsight = (i: number, next: AtrInsight) => onInsightsChange?.(insights.map((ins, idx) => (idx === i ? next : ins)));

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

  const displayStatus = (s?: AtrObservationStatus): 'Open' | 'In Progress' | 'Closed' =>
    s === 'Closed' ? 'Closed' : s === 'In Progress' ? 'In Progress' : 'Open';

  // ── Section renderers (keyed so the order/visibility props can drive them) ──
  const bodies: Record<AtrSectionKey, (n: number) => React.ReactNode> = {
    summary: n => (
      <>
        <NumberedHeading n={n} title="Executive Summary" subtitle="Overall observation and management action plan rollup" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {kpis.map(k => (
            <div key={k.label} className={`rounded-[10px] border border-canvas-border border-l-[3px] ${KPI_BORDER[k.tone]} bg-canvas-elevated p-4`}>
              <div className={`text-[1.625rem] font-bold tabular-nums leading-none mb-1 ${KPI_TONE[k.tone]}`}>{k.value}</div>
              <div className="text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-600 leading-tight">{k.label}</div>
            </div>
          ))}
        </div>
      </>
    ),
    process: n => (
      <>
        <NumberedHeading n={n} title="Observation Wise Summary" subtitle="Exceptions, management action plans and status — per observation" />
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
      </>
    ),
    details: n => (
      <>
        <NumberedHeading n={n} title="Observation Details" subtitle="Issue, risk, management action plan, evidence and verification" />
        <div className="space-y-5">
          {observations.map((o, i) => (
            <ObservationCard key={i} index={i + 1} obs={o} editable={editable} onChange={next => setObs(i, next)} actions={renderObservationActions?.(i)} />
          ))}
        </div>
      </>
    ),
    insights: n => (
      <>
        <NumberedHeading n={n} title="Key Insights & Recommendations" subtitle="Auditor observations and forward-looking guidance" />
        <div className="space-y-3">
          {insights.map((ins, i) => (
            <div key={i} className="bg-brand-50/40 border border-canvas-border border-l-[3px] border-l-brand-500 rounded-[10px] p-4">
              <div className="text-[0.8125rem] font-semibold text-ink-900 mb-0.5"><EditableText value={ins.title} editable={editable} onCommit={v => setInsight(i, { ...ins, title: v })} /></div>
              <p className="text-[0.75rem] text-ink-700 leading-relaxed"><EditableText value={ins.body} editable={editable} multiline onCommit={v => setInsight(i, { ...ins, body: v })} /></p>
            </div>
          ))}
        </div>
      </>
    ),
  };

  // Insights auto-skip when empty (preserves the original conditional behaviour).
  const visible = sectionOrder.filter(k => !hiddenSections.includes(k) && !(k === 'insights' && insights.length === 0));

  return (
    <article className={`report-printable ${maxWidthClass} mx-auto bg-canvas-elevated border border-canvas-border rounded-[12px] shadow-sm overflow-hidden`}>
      {editable && <style>{`.atr-ed:empty:before{content:attr(data-ph);color:#C2B9CB;}`}</style>}

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
              <p className="text-[0.8125rem] text-white/80 mt-1">{[meta.auditEntity, meta.auditPeriod].filter(Boolean).join(' · ')}</p>
            )}
          </div>
          {headerActions && <div className="shrink-0 flex items-center gap-2 print:hidden">{headerActions}</div>}
        </div>
      </div>

      {/* Metadata grid */}
      <div className="px-9 py-6 grid grid-cols-3 gap-x-8 gap-y-5 border-b border-canvas-border">
        <MetaCell label="Report ID" value={meta.reportId} editable={editable} onCommit={v => setMeta('reportId', v)} />
        <MetaCell label="Audit Title" value={meta.auditTitle} editable={editable} onCommit={v => setMeta('auditTitle', v)} />
        <MetaCell label="Audit Entity" value={meta.auditEntity} editable={editable} onCommit={v => setMeta('auditEntity', v)} />
        <MetaCell label="Audit Period" value={meta.auditPeriod} editable={editable} onCommit={v => setMeta('auditPeriod', v)} />
        <MetaCell label="Prepared By" value={meta.preparedBy} editable={editable} onCommit={v => setMeta('preparedBy', v)} />
        <MetaCell label="Generated On" value={meta.generatedOn} editable={editable} onCommit={v => setMeta('generatedOn', v)} />
      </div>

      {/* Ordered, hideable sections */}
      {visible.map((key, i) => {
        const first = i === 0;
        const last = i === visible.length - 1;
        const heading = bodies[key](i + 1);
        return (
          <section key={key} className={`px-9 ${last ? 'pb-9' : 'pb-6'} ${first ? 'pt-7' : 'pt-2 border-t border-canvas-border'}`}>
            {first ? heading : <div className="pt-6">{heading}</div>}
          </section>
        );
      })}
    </article>
  );
}

function ObservationCard({ index, obs, editable, onChange, actions }: { index: number; obs: AtrObservation; editable?: boolean; onChange?: (next: AtrObservation) => void; actions?: React.ReactNode }) {
  const setPlan = (i: number, next: AtrActionPlan) => onChange?.({ ...obs, actionPlans: obs.actionPlans.map((p, idx) => (idx === i ? next : p)) });
  return (
    <div className="border border-canvas-border rounded-[10px] overflow-hidden">
      {/* Header */}
      <div className="bg-brand-50/40 px-5 py-4 flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2.5 flex-wrap min-w-0">
          <span className="shrink-0 w-7 h-7 rounded-[8px] bg-brand-600 text-white text-[0.8125rem] font-bold flex items-center justify-center">{index}</span>
          <div className="min-w-0">
            <h3 className="text-[0.9375rem] font-bold text-ink-900 leading-tight"><EditableText value={obs.title} editable={editable} onCommit={v => onChange?.({ ...obs, title: v })} /></h3>
            {obs.process && <div className="text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-ink-500 mt-0.5">{obs.process}</div>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {obs.status && (() => {
            const s: AtrObservationStatus = obs.status === 'Overdue' ? 'Open' : obs.status;
            return (
              <span className={`inline-flex items-center gap-1.5 h-6 px-2.5 text-[0.625rem] font-bold uppercase tracking-wider rounded-full ${OBS_STATUS_PILL[s].cls}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${OBS_STATUS_PILL[s].dot}`} />{s}
              </span>
            );
          })()}
          {actions && <span className="print:hidden">{actions}</span>}
        </div>
      </div>

      <div className="px-5 py-4">
        {(obs.description || editable) && (
          <div className="grid grid-cols-[150px_1fr] gap-x-5 gap-y-2 items-start mb-4">
            <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-ink-500 pt-2">Issue Description</div>
            <p className="pt-2 text-[0.75rem] text-ink-800 leading-relaxed"><EditableText value={obs.description ?? ''} editable={editable} multiline placeholder="Add issue description" onCommit={v => onChange?.({ ...obs, description: v })} /></p>
          </div>
        )}
        <div className="space-y-3">
          {obs.actionPlans.map((ap, i) => (
            <ActionPlanCard key={i} index={i + 1} plan={ap} classification={obs.classification} editable={editable} onChange={next => setPlan(i, next)} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ActionPlanCard({ index, plan, classification, editable, onChange }: { index: number; plan: AtrActionPlan; classification?: AtrClassification; editable?: boolean; onChange?: (next: AtrActionPlan) => void }) {
  const tone = plan.status ? ACTION_STATUS[plan.status] : null;
  const field = (label: string, value: string | undefined, prop: keyof AtrActionPlan, italic?: boolean) => {
    if (!value && !editable) return null;
    return (
      <>
        <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-ink-500 pt-0.5">{label}</div>
        <p className={`text-[0.75rem] leading-relaxed ${italic ? 'text-ink-700' : 'text-ink-800'}`}><EditableText value={value ?? ''} editable={editable} multiline placeholder={`Add ${label.toLowerCase()}`} onCommit={v => onChange?.({ ...plan, [prop]: v })} /></p>
      </>
    );
  };
  return (
    <div className={`border border-canvas-border rounded-[12px] overflow-hidden bg-canvas-elevated ${tone ? `border-t-2 ${tone.border}` : ''}`}>
      <div className="p-4">
        <div className="flex items-center gap-2.5 flex-wrap mb-2.5">
          <span className="inline-flex items-center h-6 px-2.5 text-[0.625rem] font-bold uppercase tracking-wider rounded bg-brand-50 text-brand-700 shrink-0">Management Action Plan {index}</span>
          {(plan.title || editable) && <h4 className="text-[0.875rem] font-bold text-ink-900 leading-snug"><EditableText value={plan.title ?? ''} editable={editable} placeholder="Add a title" onCommit={v => onChange?.({ ...plan, title: v })} /></h4>}
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          {plan.dueDate ? (
            <span className="inline-flex items-center gap-1.5 h-7 px-3 text-[0.75rem] font-semibold rounded-full bg-brand-50 text-brand-700"><Calendar size={12} /> Due {fmt(plan.dueDate)}</span>
          ) : <span />}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {classification && (
              <span className={`inline-flex items-center h-7 px-3 text-[0.625rem] font-bold uppercase tracking-wider rounded-full ${CLASSIFICATION_PILL[classification]}`}>{classification}</span>
            )}
            {plan.status && tone && (
              <span className={`inline-flex items-center gap-1.5 h-7 px-3 text-[0.6875rem] font-bold uppercase tracking-wider rounded-full ${tone.pill}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} />{plan.status === 'Pending' ? 'In-Progress' : plan.status}
              </span>
            )}
          </div>
        </div>

        {(plan.text || plan.actionTaken || plan.evidence || plan.verification || editable) && (
          <div className="grid grid-cols-[150px_1fr] gap-x-5 gap-y-3 items-start border-t border-canvas-border pt-3.5">
            {field('MAP Details', plan.text, 'text')}
            {field('Action Taken', plan.actionTaken, 'actionTaken')}
            {field('Evidence', plan.evidence, 'evidence', true)}
            {field('Auditor Verification', plan.verification, 'verification')}
          </div>
        )}
      </div>
    </div>
  );
}
