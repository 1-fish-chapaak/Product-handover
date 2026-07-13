import { useRef } from 'react';
import { motion } from 'motion/react';
import {
  Calendar, Lightbulb, PenLine, Eye,
  ClipboardList, AlertTriangle, ListChecks, CircleDot, CheckCircle2, Clock,
} from 'lucide-react';
import type {
  AtrMeta, AtrObservation, AtrActionPlan, AtrInsight,
  AtrClassification, AtrObservationStatus, AtrActionStatus,
} from './atrTypes';
import { computeExecSummary } from './atrTemplate';
import { ReportNumberedHeading, ReportBrandBanner, ReportKpiTiles } from './ReportDocumentChrome';
import { ATR_SECTION_ORDER, type AtrSectionKey } from './atrSections';

// ─── Token maps (theme defines base / -50 / -700 only for semantic colors) ───
const OBS_STATUS_PILL: Record<AtrObservationStatus, { cls: string; dot: string }> = {
  Closed:        { cls: 'bg-compliant-50 text-compliant-700', dot: 'bg-compliant' },
  'In Progress': { cls: 'bg-mitigated-50 text-mitigated-700', dot: 'bg-mitigated' },
  Open:          { cls: 'bg-high-50 text-high-700',           dot: 'bg-high' },
  Overdue:       { cls: 'bg-risk-50 text-risk-700',           dot: 'bg-risk' },
};
const ACTION_STATUS: Record<AtrActionStatus, { pill: string; dot: string }> = {
  Implemented:             { pill: 'bg-compliant-50 text-compliant-700', dot: 'bg-compliant' },
  'Partially Implemented': { pill: 'bg-mitigated-50 text-mitigated-700', dot: 'bg-mitigated' },
  Pending:                 { pill: 'bg-risk-50 text-risk-700',           dot: 'bg-risk' },
  Overdue:                 { pill: 'bg-risk-50 text-risk-700',           dot: 'bg-risk' },
  'Not Due':               { pill: 'bg-paper-100 text-ink-600',          dot: 'bg-ink-400' },
};
const CLASSIFICATION_PILL: Record<AtrClassification, string> = {
  'Design Deficiency': 'bg-high-50 text-high-700',
  'System Deficiency': 'bg-risk-50 text-risk-700',
  'Procedural Non-Compliance': 'bg-brand-50 text-brand-700',
};

type Tone = 'brand' | 'risk' | 'mitigated' | 'compliant' | 'high' | 'ink';

// Section anchors (kept for in-page scroll navigation from the report reader).
const SECTION_ID: Record<AtrSectionKey, string> = {
  summary: 'section-atr-exec',
  process: 'section-atr-obs-summary',
  details: 'section-atr-obs-details',
  insights: 'section-atr-insights',
  signoff: 'section-atr-signoff',
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
      className={`atr-ed inline-block min-w-[32px] outline-none rounded-xs px-0.5 -mx-0.5 cursor-text hover:bg-brand-50/40 focus:bg-brand-50/60 focus:ring-2 focus:ring-brand-600/30 ${className}`}
    >
      {value}
    </span>
  );
}

/** Editable metadata cell (edit mode only) — mirrors ReportMetaPanel's read-only look. */
function MetaCell({ label, value, onCommit }: { label: string; value?: string; onCommit?: (v: string) => void }) {
  return (
    <div>
      <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-ink-500 mb-1.5">{label}</div>
      <div>
        <div className="text-[0.8125rem] font-bold text-ink-900"><EditableText value={value ?? ''} editable onCommit={onCommit} placeholder={`Add ${label.toLowerCase()}`} /></div>
      </div>
    </div>
  );
}

/** Label + value row inside a 150px/1fr grid. Renders an editable field in edit mode. */
function FieldRow({ label, value, editable, onCommit, italic, multiline = true }: {
  label: string; value?: string; editable?: boolean; onCommit?: (v: string) => void; italic?: boolean; multiline?: boolean;
}) {
  if ((value == null || value === '') && !editable) return null;
  return (
    <>
      <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-ink-500 pt-2">{label}</div>
      <p className={`pt-2 text-[1rem] text-ink-800 leading-relaxed ${italic ? 'italic text-ink-600' : ''}`}>
        <EditableText value={value ?? ''} editable={editable} multiline={multiline} placeholder={`Add ${label.toLowerCase()}`} onCommit={onCommit} />
      </p>
    </>
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
   *  rendered in each observation card header. Receives the 0-based index. */
  renderObservationActions?: (index: number) => React.ReactNode;
}) {
  const ex = computeExecSummary(observations);

  const setMeta = (key: keyof AtrMeta, v: string) => onMetaChange?.({ ...meta, [key]: v || undefined });
  const setObs = (i: number, next: AtrObservation) => onObservationsChange?.(observations.map((o, idx) => (idx === i ? next : o)));
  const setInsight = (i: number, next: AtrInsight) => onInsightsChange?.(insights.map((ins, idx) => (idx === i ? next : ins)));

  // Executive Summary — exactly six KPIs. Overdue observations fold into Open.
  const totalExceptions = meta.totalExceptions ?? ex.totalExceptions;
  const openCount = ex.obsStatus.Open + ex.obsStatus.Overdue;
  const kpis: { label: string; value: number; tone: Tone; icon: React.ElementType }[] = [
    { label: 'Observations', value: ex.totalObservations, tone: 'brand', icon: ClipboardList },
    { label: 'Exceptions', value: totalExceptions, tone: 'ink', icon: AlertTriangle },
    { label: 'Action Plans', value: ex.totalActionPlans, tone: 'brand', icon: ListChecks },
    { label: 'Open', value: openCount, tone: 'high', icon: CircleDot },
    { label: 'Closed', value: ex.obsStatus.Closed, tone: 'compliant', icon: CheckCircle2 },
    { label: 'In Progress', value: ex.obsStatus['In Progress'], tone: 'mitigated', icon: Clock },
  ];

  const displayStatus = (s?: AtrObservationStatus): 'Open' | 'In Progress' | 'Closed' =>
    s === 'Closed' ? 'Closed' : s === 'In Progress' ? 'In Progress' : 'Open';

  // ── Section bodies (keyed so order/visibility props drive them) ──
  const bodies: Record<AtrSectionKey, (n: number) => React.ReactNode> = {
    summary: n => (
      <>
        <ReportNumberedHeading n={n} title="Executive Summary" subtitle="Overall observation and management action plan rollup" />
        {/* KPI tiles — the single shared ReportKpiTiles, so the ATR exec summary
            stays identical to every other report type by construction. */}
        <ReportKpiTiles
          stats={kpis.map(k => ({ label: k.label, value: String(k.value), icon: k.icon, color: `text-${k.tone}-700` }))}
        />
      </>
    ),
    process: n => (
      <>
        <ReportNumberedHeading n={n} title="Observation Wise Summary" subtitle="Exceptions, management action plans and status — per observation" />
        <div className="overflow-hidden rounded-lg border border-canvas-border">
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
                  <motion.tr
                    key={i}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.28, delay: Math.min(i, 12) * 0.03, ease: [0.22, 1, 0.36, 1] }}
                    className="border-t border-canvas-border"
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-ink-900 leading-snug">{o.title}</div>
                      {o.process && <div className="text-[0.6875rem] text-ink-500">{o.process}</div>}
                    </td>
                    <td className="px-3 py-3 text-center tabular-nums font-semibold text-ink-800">{o.exceptions ?? 1}</td>
                    <td className="px-3 py-3 text-center tabular-nums text-ink-800">{o.actionPlans.length}</td>
                    <td className="px-3 py-3 text-center">
                      <span className={`inline-flex items-center h-6 px-2.5 rounded-full text-[0.6875rem] font-semibold ${stCls}`}>{st}</span>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </>
    ),
    details: n => (
      <>
        <ReportNumberedHeading n={n} title="Observation Details" subtitle="Issue, risk, management action plan, evidence and verification" />
        <div className="space-y-5">
          {observations.map((o, i) => (
            <ObservationCard key={i} index={i + 1} obs={o} editable={editable} onChange={next => setObs(i, next)} actions={renderObservationActions?.(i)} />
          ))}
        </div>
      </>
    ),
    insights: n => (
      <>
        <ReportNumberedHeading n={n} title="Key Insights & Recommendations" subtitle="Auditor observations and forward-looking guidance" />
        <div className="space-y-3">
          {insights.map((ins, i) => (
            <div key={i} className="flex gap-3.5 bg-canvas-elevated border border-canvas-border rounded-lg p-4 hover:border-brand-200 transition-colors">
              <span className="shrink-0 mt-0.5 w-6 h-6 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center"><Lightbulb size={13} /></span>
              <div className="min-w-0">
                <div className="text-[0.9375rem] font-semibold text-ink-900 mb-1 leading-snug"><EditableText value={ins.title} editable={editable} onCommit={v => setInsight(i, { ...ins, title: v })} /></div>
                <p className="text-[1rem] text-ink-700 leading-relaxed"><EditableText value={ins.body} editable={editable} multiline onCommit={v => setInsight(i, { ...ins, body: v })} /></p>
              </div>
            </div>
          ))}
        </div>
      </>
    ),
    signoff: n => (
      <>
        <ReportNumberedHeading n={n} title="Approvals & Sign-Off" subtitle="Digital authorisation of this Action Taken Report" />
        <div className="grid grid-cols-2 gap-4">
          {[
            { Icon: PenLine, role: 'Prepared by', name: meta.preparedBy },
            { Icon: Eye, role: 'Reviewed by', name: meta.reviewedBy ?? '' },
          ].map(c => (
            <div key={c.role} className="rounded-lg border border-canvas-border p-5">
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
      </>
    ),
  };

  // Insights auto-skip when empty (preserves the original conditional behaviour).
  const visible = sectionOrder.filter(k => !hiddenSections.includes(k) && !(k === 'insights' && insights.length === 0));

  return (
    <article className={`report-printable ${maxWidthClass} mx-auto bg-canvas-elevated border border-canvas-border rounded-lg overflow-hidden`}>
      {editable && <style>{`.atr-ed:empty:before{content:attr(data-ph);color:#C2B9CB;}`}</style>}

      {/* Purple letterhead — the shared ReportBrandBanner so the ATR matches
          every other report exactly: eyebrow ID · title · description · a
          who/when/scope byline, over the same subtle woven line art. */}
      <ReportBrandBanner
        title="Action Taken Report"
        eyebrow={meta.reportId && (
          <span className="font-mono text-[0.6875rem] tracking-[0.04em] text-white/65">{meta.reportId.toUpperCase()}</span>
        )}
        actions={headerActions}
        footer={(() => {
          const parts = [
            meta.preparedBy,
            meta.generatedOn,
            `${ex.totalObservations} ${ex.totalObservations === 1 ? 'observation' : 'observations'}`,
          ].filter(Boolean);
          if (parts.length === 0) return null;
          return (
            <div className="flex items-center gap-2.5 text-[0.8125rem] flex-wrap">
              {parts.map((p, i) => (
                <span key={i} className="inline-flex items-center gap-2.5">
                  {i > 0 && <span className="text-white/30" aria-hidden="true">|</span>}
                  <span className={i === 0 ? 'font-semibold text-white' : 'text-white/70'}>{p}</span>
                </span>
              ))}
            </div>
          );
        })()}
      >
        {(meta.auditEntity || meta.auditPeriod) && (
          <p className="text-[0.8125rem] text-white/70">
            {[meta.auditEntity, meta.auditPeriod].filter(Boolean).join(' · ')}
          </p>
        )}
      </ReportBrandBanner>

      {/* Metadata — editable grid in edit mode only. The read-only report carries
          the key facts in the banner (eyebrow ID + who/when byline), so no panel. */}
      {editable && (
        <div className="px-9 py-6 border-b border-canvas-border">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-5">
            <MetaCell label="Report ID" value={meta.reportId} onCommit={v => setMeta('reportId', v)} />
            <MetaCell label="Audit Title" value={meta.auditTitle} onCommit={v => setMeta('auditTitle', v)} />
            <MetaCell label="Audit Entity" value={meta.auditEntity} onCommit={v => setMeta('auditEntity', v)} />
            <MetaCell label="Audit Period" value={meta.auditPeriod} onCommit={v => setMeta('auditPeriod', v)} />
            <MetaCell label="Prepared By" value={meta.preparedBy} onCommit={v => setMeta('preparedBy', v)} />
            <MetaCell label="Generated On" value={meta.generatedOn} onCommit={v => setMeta('generatedOn', v)} />
          </div>
        </div>
      )}

      {/* Ordered, hideable sections */}
      {visible.map((key, i) => {
        const first = i === 0;
        const last = i === visible.length - 1;
        const heading = bodies[key](i + 1);
        return (
          <section key={key} id={SECTION_ID[key]} className={`px-9 ${last ? 'pb-9' : 'pb-6'} ${first ? 'pt-7' : 'pt-6'} scroll-mt-20`}>
            {heading}
          </section>
        );
      })}
    </article>
  );
}

function ObservationCard({ index, obs, editable, onChange, actions }: { index: number; obs: AtrObservation; editable?: boolean; onChange?: (next: AtrObservation) => void; actions?: React.ReactNode }) {
  const setPlan = (i: number, next: AtrActionPlan) => onChange?.({ ...obs, actionPlans: obs.actionPlans.map((p, idx) => (idx === i ? next : p)) });
  return (
    <div className="border border-canvas-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-brand-50/40 px-5 py-4 flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2.5 flex-wrap min-w-0">
          <span className="shrink-0 w-7 h-7 rounded-md bg-brand-600 text-white text-[0.8125rem] font-bold flex items-center justify-center">{index}</span>
          <div className="min-w-0">
            <h3 className="text-[1.0625rem] font-semibold text-ink-900 leading-tight"><EditableText value={obs.title} editable={editable} onCommit={v => onChange?.({ ...obs, title: v })} /></h3>
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
            <FieldRow label="Issue Description" value={obs.description} editable={editable} onCommit={v => onChange?.({ ...obs, description: v })} />
          </div>
        )}
        <div className="space-y-5">
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
  // Flat block — the MAP pill delimits the action plan; no left rail.
  return (
    <div>
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
          <FieldRow label="MAP Details" value={plan.text} editable={editable} onCommit={v => onChange?.({ ...plan, text: v })} />
          <FieldRow label="Action Taken" value={plan.actionTaken} editable={editable} onCommit={v => onChange?.({ ...plan, actionTaken: v })} />
          <FieldRow label="Evidence" value={plan.evidence} editable={editable} italic onCommit={v => onChange?.({ ...plan, evidence: v })} />
          <FieldRow label="Auditor Verification" value={plan.verification} editable={editable} onCommit={v => onChange?.({ ...plan, verification: v })} />
        </div>
      )}
    </div>
  );
}
