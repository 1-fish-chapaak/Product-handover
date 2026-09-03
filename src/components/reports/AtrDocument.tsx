import { useRef, useState } from 'react';
import { motion } from 'motion/react';
import ConfirmationModal from '../shared/ConfirmationModal';
import {
  Calendar, Trash2,
  ClipboardList, ListChecks, CircleDot, CheckCircle2, Clock,
} from 'lucide-react';
import type {
  AtrMeta, AtrObservation, AtrActionPlan, AtrInsight,
  AtrClassification, AtrObservationStatus, AtrActionStatus, AtrRisk,
} from './atrTypes';
import { computeExecSummary } from './atrTemplate';
import { ReportNumberedHeading, ReportBrandBanner, ReportKpiTiles } from './ReportDocumentChrome';
import { ATR_SECTION_ORDER, ATR_SECTION_LABEL, type AtrSectionKey } from './atrSections';

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
// Observation severity (risk significance) pill.
const SEVERITY_PILL: Record<AtrRisk, string> = {
  Critical: 'bg-risk-50 text-risk-700',
  High:     'bg-high-50 text-high-700',
  Medium:   'bg-mitigated-50 text-mitigated-700',
  Low:      'bg-compliant-50 text-compliant-700',
};

type Tone = 'brand' | 'risk' | 'mitigated' | 'compliant' | 'high' | 'ink';

// Section anchors (kept for in-page scroll navigation from the report reader).
const SECTION_ID: Record<AtrSectionKey, string> = {
  summary: 'section-atr-exec',
  process: 'section-atr-obs-summary',
  details: 'section-atr-obs-details',
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

/** Read-only key-fact: uppercase label over a bold value, left-aligned (no accent
 *  bar), wrapping long values instead of truncating. */
function MetaFact({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-ink-500 mb-1.5">{label}</div>
      <div className="text-[0.8125rem] font-bold text-ink-900 break-words">{value}</div>
    </div>
  );
}

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
  meta, observations, headerActions, maxWidthClass = 'max-w-[840px]',
  editable, onMetaChange, onObservationsChange,
  sectionOrder = ATR_SECTION_ORDER, hiddenSections = [],
  renderObservationActions, onDeleteSection,
}: {
  meta: AtrMeta;
  observations: AtrObservation[];
  insights?: AtrInsight[];
  /** Current version number of the saved ATR — shown in the banner byline. */
  version?: number;
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
  /** Edit-mode: remove a section from the report. Enables the per-section
   *  delete control on each section heading. */
  onDeleteSection?: (key: AtrSectionKey) => void;
}) {
  const ex = computeExecSummary(observations);

  const setMeta = (key: keyof AtrMeta, v: string) => onMetaChange?.({ ...meta, [key]: v || undefined });
  const setObs = (i: number, next: AtrObservation) => onObservationsChange?.(observations.map((o, idx) => (idx === i ? next : o)));
  const removeObs = (i: number) => onObservationsChange?.(observations.filter((_, idx) => idx !== i));

  // Every delete goes through a confirm dialog. `pendingDelete.run` fires on confirm.
  const [pendingDelete, setPendingDelete] = useState<{ title: string; description: string; run: () => void } | null>(null);
  const confirmDelete = (title: string, description: string, run: () => void) => setPendingDelete({ title, description, run });

  // Executive Summary — five KPIs (observation breakdown + action plans).
  // Overdue observations fold into Open; "Partially Closed" = In Progress.
  const openCount = ex.obsStatus.Open + ex.obsStatus.Overdue;
  const kpis: { label: string; value: number; tone: Tone; icon: React.ElementType }[] = [
    { label: 'Observations', value: ex.totalObservations, tone: 'brand', icon: ClipboardList },
    { label: 'Observations Open', value: openCount, tone: 'high', icon: CircleDot },
    { label: 'Observations Partially Closed', value: ex.obsStatus['In Progress'], tone: 'mitigated', icon: Clock },
    { label: 'Observations Closed', value: ex.obsStatus.Closed, tone: 'compliant', icon: CheckCircle2 },
    { label: 'Action Plans', value: ex.totalActionPlans, tone: 'brand', icon: ListChecks },
  ];

  const displayStatus = (s?: AtrObservationStatus): 'Open' | 'Partially Closed' | 'Closed' =>
    s === 'Closed' ? 'Closed' : s === 'In Progress' ? 'Partially Closed' : 'Open';

  // ── Section bodies (keyed so order/visibility props drive them) ──
  const bodies: Record<AtrSectionKey, (n: number) => React.ReactNode> = {
    summary: n => (
      <>
        <ReportNumberedHeading n={n} title="Executive Summary" subtitle="Overall observation and action plan rollup" />
        {/* KPI tiles — the single shared ReportKpiTiles, so the ATR exec summary
            stays identical to every other report type by construction. */}
        <ReportKpiTiles
          showTick={false}
          stats={kpis.map(k => ({ label: k.label, value: String(k.value), icon: k.icon, color: `text-${k.tone}-700` }))}
        />
      </>
    ),
    process: n => (
      <>
        <ReportNumberedHeading n={n} title="Observation Wise Summary" subtitle="Severity, action plans and status — per observation" />
        <div className="overflow-hidden rounded-lg border border-canvas-border">
          <table className="w-full text-[0.75rem]">
            <thead>
              <tr className="bg-brand-50/60 text-ink-700 text-left">
                <th className="px-4 py-2.5 font-semibold">Observation &amp; Action Plans</th>
                <th className="px-3 py-2.5 font-semibold text-center w-[110px]">Severity</th>
                <th className="px-3 py-2.5 font-semibold text-center w-[120px]">Status</th>
              </tr>
            </thead>
            <tbody>
              {observations.map((o, i) => {
                const st = displayStatus(o.status);
                const stCls = st === 'Closed' ? 'bg-compliant-50 text-compliant-700' : st === 'Partially Closed' ? 'bg-mitigated-50 text-mitigated-700' : 'bg-high-50 text-high-700';
                return (
                  <motion.tr
                    key={i}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.28, delay: Math.min(i, 12) * 0.03, ease: [0.22, 1, 0.36, 1] }}
                    className="border-t border-canvas-border align-top"
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-ink-900 leading-snug">{o.title}</div>
                      {o.process && <div className="text-[0.6875rem] text-ink-500">{o.process}</div>}
                      {o.actionPlans.length > 0 && (
                        <ul className="mt-2 space-y-1.5">
                          {o.actionPlans.map((p, j) => {
                            const ap = p.status ? ACTION_STATUS[p.status] : null;
                            return (
                              <li key={j} className="flex items-center gap-2 flex-wrap">
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${ap?.dot ?? 'bg-ink-300'}`} aria-hidden="true" />
                                <span className="text-[0.6875rem] text-ink-700">{p.title || p.text || `Action plan ${j + 1}`}</span>
                                {p.status && <span className={`inline-flex items-center h-5 px-2 rounded-full text-[0.625rem] font-semibold ${ap?.pill ?? ''}`}>{p.status}</span>}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {o.risk && <span className={`inline-flex items-center h-6 px-2.5 rounded-full text-[0.6875rem] font-semibold ${SEVERITY_PILL[o.risk]}`}>{o.risk}</span>}
                    </td>
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
        <ReportNumberedHeading n={n} title="Observation Details" subtitle="Issue, risk, action plan and verification" />
        <div className="space-y-5">
          {observations.map((o, i) => (
            <ObservationCard key={i} index={i + 1} obs={o} editable={editable} onChange={next => setObs(i, next)} onDelete={() => confirmDelete('Delete observation?', `This removes “${o.title || `Observation ${i + 1}`}” and its action plans from the report. You can undo by cancelling before you save.`, () => removeObs(i))} actions={renderObservationActions?.(i)} />
          ))}
        </div>
      </>
    ),
  };

  const visible = sectionOrder.filter(k => !hiddenSections.includes(k));

  return (
    <>
    <article className={`report-printable ${maxWidthClass} mx-auto bg-canvas-elevated border border-canvas-border rounded-[12px] overflow-hidden`}>
      {editable && <style>{`.atr-ed:empty:before{content:attr(data-ph);color:#C2B9CB;}`}</style>}

      {/* Purple letterhead — just the report title. Every fact (report ID,
          entity, period, prepared-by, generated-on) lives in the segregated
          key-facts grid below, so the banner is a clean title-only hero with
          compact padding. */}
      <ReportBrandBanner
        title="Action Taken Report"
        actions={headerActions}
        className="!py-7"
      />

      {/* Metadata — segregated key-facts grid below the title. Edit mode keeps the
          inline-editable cells; the read-only report shows the same six facts as
          labelled fields with a brand accent bar (matches every other report). */}
      {editable ? (
        <div className="px-9 py-6 border-b border-canvas-border">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-5">
            <MetaCell label="Report Name" value={meta.reportName} onCommit={v => setMeta('reportName', v)} />
            <MetaCell label="Audit Entity" value={meta.auditEntity} onCommit={v => setMeta('auditEntity', v)} />
            <MetaCell label="Audit Title" value={meta.auditTitle} onCommit={v => setMeta('auditTitle', v)} />
            <MetaCell label="Audit Period" value={meta.auditPeriod} onCommit={v => setMeta('auditPeriod', v)} />
            <MetaCell label="Financial Year" value={meta.financialYear} onCommit={v => setMeta('financialYear', v)} />
            <MetaCell label="Prepared By" value={meta.preparedBy} onCommit={v => setMeta('preparedBy', v)} />
          </div>
        </div>
      ) : (meta.reportName || meta.reportId || meta.auditTitle || meta.auditPeriod || meta.preparedBy || meta.generatedOn || meta.auditEntity) && (
        <div className="px-9 py-6 border-b border-canvas-border">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-5">
            <MetaFact label="Report Name" value={meta.reportName ?? meta.reportId} />
            <MetaFact label="Audit Entity" value={meta.auditEntity} />
            <MetaFact label="Audit Title" value={meta.auditTitle} />
            <MetaFact label="Audit Period" value={meta.auditPeriod} />
            <MetaFact label="Financial Year" value={meta.financialYear} />
            <MetaFact label="Prepared By" value={meta.preparedBy} />
          </div>
        </div>
      )}

      {/* Ordered, hideable sections */}
      {visible.map((key, i) => {
        const first = i === 0;
        const last = i === visible.length - 1;
        const heading = bodies[key](i + 1);
        return (
          <section key={key} id={SECTION_ID[key]} className={`relative group/sec px-9 ${last ? 'pb-9' : 'pb-6'} ${first ? 'pt-7' : 'pt-6'} scroll-mt-20`}>
            {editable && onDeleteSection && (
              <button
                type="button"
                onClick={() => confirmDelete(`Delete ${ATR_SECTION_LABEL[key]}?`, `This removes the “${ATR_SECTION_LABEL[key]}” section from this report. You can undo by cancelling before you save.`, () => onDeleteSection(key))}
                title={`Delete ${ATR_SECTION_LABEL[key]}`}
                aria-label={`Delete ${ATR_SECTION_LABEL[key]} section`}
                className="absolute right-9 top-6 z-10 inline-flex items-center gap-1.5 h-7 pl-2 pr-2.5 rounded-[7px] border border-risk-200 bg-white text-risk-700 text-[0.6875rem] font-semibold hover:bg-risk-50 hover:border-risk-300 transition-colors cursor-pointer print:hidden shadow-sm"
              >
                <Trash2 size={13} /> Delete
              </button>
            )}
            {heading}
          </section>
        );
      })}
    </article>
    <ConfirmationModal
      open={pendingDelete !== null}
      title={pendingDelete?.title ?? ''}
      description={pendingDelete?.description}
      confirmLabel="Delete"
      cancelLabel="Cancel"
      tone="destructive"
      onConfirm={() => { pendingDelete?.run(); setPendingDelete(null); }}
      onClose={() => setPendingDelete(null)}
    />
    </>
  );
}

function ObservationCard({ index, obs, editable, onChange, onDelete, actions }: { index: number; obs: AtrObservation; editable?: boolean; onChange?: (next: AtrObservation) => void; onDelete?: () => void; actions?: React.ReactNode }) {
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
            const label = s === 'In Progress' ? 'Partially Closed' : s;
            return (
              <span className={`inline-flex items-center gap-1.5 h-6 px-2.5 text-[0.625rem] font-bold uppercase tracking-wider rounded-full ${OBS_STATUS_PILL[s].cls}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${OBS_STATUS_PILL[s].dot}`} />{label}
              </span>
            );
          })()}
          {actions && <span className="print:hidden">{actions}</span>}
          {editable && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              title="Delete observation"
              aria-label="Delete observation"
              className="shrink-0 inline-flex items-center gap-1.5 h-7 pl-2 pr-2.5 rounded-[7px] border border-risk-200 bg-white text-risk-700 text-[0.6875rem] font-semibold hover:bg-risk-50 hover:border-risk-300 transition-colors cursor-pointer print:hidden"
            >
              <Trash2 size={13} /> Delete
            </button>
          )}
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
        <span className="inline-flex items-center h-6 px-2.5 text-[0.625rem] font-bold uppercase tracking-wider rounded bg-brand-50 text-brand-700 shrink-0">Action Plan {index}</span>
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

      {(plan.text || plan.actionTaken || plan.verification || editable) && (
        <div className="grid grid-cols-[150px_1fr] gap-x-5 gap-y-3 items-start border-t border-canvas-border pt-3.5">
          <FieldRow label="Action Plan Details" value={plan.text} editable={editable} onCommit={v => onChange?.({ ...plan, text: v })} />
          <FieldRow label="Action Taken" value={plan.actionTaken} editable={editable} onCommit={v => onChange?.({ ...plan, actionTaken: v })} />
          <FieldRow label="Auditor Verification" value={plan.verification} editable={editable} onCommit={v => onChange?.({ ...plan, verification: v })} />
        </div>
      )}
    </div>
  );
}
