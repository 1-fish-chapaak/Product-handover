// ─── Targeted actions + reflections — the B+C surfacing components ─────────
//
// Three pieces that make anchored insights actionable on every row:
//
//   1. InsightReflection — the one-line strip a SPANNED row renders when a
//      higher-anchored insight includes it: its slice of the finding + a link
//      up to the anchor. Never a copy — the anchor stays the single record.
//   2. TargetedActionList — compact chips for the actions that explicitly
//      target this row (from any generated insight). The head-of-product SOP
//      chip pattern, generalized: verb icon · title · priority · provenance.
//   3. ActionDrawer — click a chip and act in place: the parent insight's
//      context on top, the action's rationale below, Apply / Ask IRA / Dismiss
//      in the footer. Apply and Dismiss write the session action registry.
//
// All three read the session insight cache only — no generation happens here,
// so the PRD's trigger-gated cost model is untouched.

import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles, X, RefreshCw, PenLine, Plus, Merge, Activity, Check, ArrowRight, ArrowUpRight, Bell, ShieldCheck, Zap, Play,
} from 'lucide-react';
import {
  LAYER_META, REC_INTENT_META, REC_PRIORITY_META, REC_PRIORITY_RANK,
  type EntityKind, type LayeredInsight, type RecIntent, type RecPriority,
} from '../../data/layeredInsights';
import { openInChat } from './insightChat';
import LayeredInsightCard from './LayeredInsightCard';
import { useToast } from './Toast';
import {
  getActionStatus, setActionStatus, actionKey,
  type TargetedAction, type SpanReflection,
} from './insightCache';

// ─── Small lookups ──────────────────────────────────────────────────────────

const LAYER_WORD: Record<string, string> = {
  control: 'control-level', risk: 'risk-level', sop: 'SOP-level', engagement: 'engagement-level',
};

const SEV_LABEL: Record<string, string> = { high: 'High', med: 'Medium', low: 'Low' };

const PRIORITY_PILL: Record<RecPriority, string> = {
  'do-now':      'bg-risk-50 text-risk border-risk/20',
  'this-period': 'bg-mitigated-50 text-mitigated-700 border-mitigated-200',
  advisory:      'bg-compliant-50 text-compliant-700 border-compliant-200',
};

// Actions lead with their VERB — Sparkles is reserved for insight identity, so
// analysis and work never share a mark. The fallback (intent-less rec) is a
// plain arrow, deliberately not a sparkle.
const INTENT_ICON: Record<RecIntent, typeof RefreshCw> = {
  retest: RefreshCw, edit: PenLine, create: Plus, aggregate: Merge, monitor: Activity,
};
const INTENT_ICON_CLS: Record<RecIntent, string> = {
  retest:    'bg-evidence-50 text-evidence-700',
  edit:      'bg-mitigated-50 text-mitigated-700',
  create:    'bg-compliant-50 text-compliant-700',
  aggregate: 'bg-brand-50 text-brand-700',
  monitor:   'bg-paper-100 text-ink-600',
};
const intentIconCls = (intent?: RecIntent) => (intent ? INTENT_ICON_CLS[intent] : 'bg-paper-100 text-ink-600');

/** The insight identity mark — a filled brand chip. Only insights carry it. */
function InsightMark({ className = '' }: { className?: string }) {
  return (
    <span className={`size-6 shrink-0 rounded-lg bg-brand-600 text-white flex items-center justify-center ${className}`}>
      <Sparkles size={12} aria-hidden="true" />
    </span>
  );
}

const TARGET_CHIP: Record<EntityKind, string> = {
  control:    'bg-evidence-50 text-evidence-700',
  risk:       'bg-high-50 text-high-700',
  sop:        'bg-brand-50 text-brand-700',
  engagement: 'bg-paper-100 text-ink-600',
  workflow:   'bg-evidence-50 text-evidence-700',
};

function IntentIcon({ intent, size = 11 }: { intent?: RecIntent; size?: number }) {
  const Icon = intent ? INTENT_ICON[intent] : ArrowRight;
  return <Icon size={size} aria-hidden="true" />;
}

// ─── 1. Reflection strip — a spanned row's slice of a higher anchor ─────────

export function InsightReflection({
  reflection, onViewAnchor,
}: {
  reflection: SpanReflection;
  /** Navigate to the surface that shows the anchor card (the AI Insights tab). */
  onViewAnchor?: () => void;
}) {
  const { span, source } = reflection;
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-dashed border-brand-300/70 bg-brand-50/30 px-3.5 py-3">
      <InsightMark className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="text-[9.5px] font-bold uppercase tracking-wider text-brand-600">
          Part of a {LAYER_WORD[source.layer] ?? source.layer} insight · anchored at {source.subjectLabel}
        </p>
        <p className="mt-1 text-[12.5px] font-semibold text-ink-900 leading-snug">{source.takeaway}</p>
        {span.note && (
          <p className="mt-0.5 text-[11.5px] text-ink-600 leading-snug">
            <span className="font-semibold text-ink-700">This {span.kind}&rsquo;s share:</span> {span.note}
          </p>
        )}
      </div>
      {onViewAnchor && (
        <button
          type="button" onClick={onViewAnchor}
          className="shrink-0 inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand-700 hover:text-brand-600 cursor-pointer mt-0.5"
        >
          View full insight <ArrowUpRight size={12} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

// ─── 2. Targeted action chips — the work that landed on this row ────────────

export function TargetedActionList({
  actions, onOpen, heading, bare = false, provenance = true,
}: {
  actions: TargetedAction[];
  onOpen: (a: TargetedAction) => void;
  /** e.g. "AI actions for this control". Defaults to a neutral heading. */
  heading?: string;
  /** Render the rows alone, no wrapper box/heading — for a row body where the
   *  reflection strip above already frames them (the mock's treatment). */
  bare?: boolean;
  /** Show the "from insight" provenance mark. Turn off when the chips sit
   *  directly under their own insight's summary (provenance is self-evident). */
  provenance?: boolean;
}) {
  const live = actions.filter(a => getActionStatus(a) !== 'dismissed');
  if (live.length === 0) return null;
  // Two tiles per row (the LayeredInsightCard RecommendedActions grid), so a
  // 3–4 action set reads in two rows instead of a tall wall of full-width bars.
  const rows = (
    <ul className="grid gap-1.5 sm:grid-cols-2 items-start">
        {live.map(a => {
          const applied = getActionStatus(a) === 'applied';
          const pm = REC_PRIORITY_META[a.rec.priority];
          return (
            <li key={actionKey(a)} className="min-w-0">
              <button
                type="button" onClick={() => onOpen(a)}
                title="Review this action — apply it, work it in Ask IRA, or dismiss it"
                className={`group flex w-full items-start gap-2.5 rounded-lg border py-2 pl-2.5 pr-2.5 text-left transition-colors cursor-pointer ${
                  applied
                    ? 'border-compliant-200 bg-compliant-50/40'
                    : 'border-canvas-border bg-canvas-elevated hover:border-brand-300 hover:bg-brand-50/40'
                }`}
              >
                <span className={`size-5 shrink-0 rounded-md flex items-center justify-center ${applied ? 'bg-compliant-50 text-compliant-700' : intentIconCls(a.rec.intent)}`}>
                  {applied ? <Check size={11} aria-hidden="true" /> : <IntentIcon intent={a.rec.intent} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-[12px] font-semibold leading-snug line-clamp-2 ${applied ? 'text-ink-500' : 'text-ink-900 group-hover:text-brand-700'} transition-colors`}>
                    {a.rec.title}
                  </span>
                  {provenance && (
                    <span className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-brand-600/80">
                      <Sparkles size={9} aria-hidden="true" /> from insight
                    </span>
                  )}
                </span>
                {applied ? (
                  <span className="mt-0.5 shrink-0 rounded-full border border-compliant-200 bg-compliant-50 px-2 py-0.5 text-[9.5px] font-bold text-compliant-700">Applied</span>
                ) : (
                  <span className={`mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-[9.5px] font-bold ${PRIORITY_PILL[a.rec.priority]}`}>{pm.label}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
  );
  if (bare) return rows;
  return (
    <div className="rounded-xl bg-canvas border border-canvas-border p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-500 mb-2">
        <Sparkles size={12} className="text-brand-600" aria-hidden="true" />
        {heading ?? 'AI actions'}
        <span className="text-ink-400">· {live.length}</span>
      </div>
      {rows}
    </div>
  );
}

// ─── 2b. Insight summary strip — the ANCHOR row's compact presentation ──────
// Control rows never render the full card inline (the AI Insights hub is the
// reading surface). A row that anchors its own insight gets this strip — the
// takeaway + severity/verdict at a glance, a link to the full card, and its
// recommended actions as the same chip rows the rest of the system uses.

const SEV_STRIP_PILL: Record<LayeredInsight['severity'], string> = {
  high: 'bg-risk-50 text-risk',
  med: 'bg-mitigated-50 text-mitigated-700',
  low: 'bg-paper-100 text-ink-600',
};

export function InsightSummaryStrip({
  insight, onViewFull, onOpenAction, onRegenerate, anchorLabel,
}: {
  insight: LayeredInsight;
  /** Navigate to the AI Insights hub, where the full card lives. */
  onViewFull?: () => void;
  onOpenAction: (a: TargetedAction) => void;
  onRegenerate?: () => void;
  /** Override the anchor noun, e.g. "this workflow" for metric-derived
   *  workflow insights whose layer doesn't name their surface. */
  anchorLabel?: string;
}) {
  const recs = [...(insight.recommendations ?? [])].sort(
    (a, b) => REC_PRIORITY_RANK[a.priority] - REC_PRIORITY_RANK[b.priority],
  );
  const shown = recs.slice(0, 4).map(rec => ({ rec, source: insight }));
  const positive = insight.verdict.tone === 'positive';
  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-brand-200/70 bg-brand-50/30 px-3.5 py-3">
        <div className="flex items-start gap-2.5">
          <InsightMark className="mt-0.5" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[9.5px] font-bold uppercase tracking-wider text-brand-600">
                AI insight · anchored at {anchorLabel ?? (insight.layer === 'sop' ? 'this SOP' : `this ${insight.layer}`)}
              </p>
              <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold ${SEV_STRIP_PILL[insight.severity]}`}>
                {SEV_LABEL[insight.severity]}
              </span>
              {positive && (
                <span className="inline-flex items-center gap-1 rounded-full border border-compliant-200 bg-compliant-50 px-2 py-0.5 text-[9.5px] font-bold text-compliant-700">
                  <ShieldCheck size={9} aria-hidden="true" /> Signed pass
                </span>
              )}
            </div>
            <p className="mt-1 text-[12.5px] font-semibold text-ink-900 leading-snug">{insight.takeaway}</p>
            <div className="mt-1.5 flex items-center gap-3">
              {onViewFull && (
                <button
                  type="button" onClick={onViewFull}
                  className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand-700 hover:text-brand-600 cursor-pointer"
                >
                  View full insight <ArrowUpRight size={12} aria-hidden="true" />
                </button>
              )}
              <span className="text-[10px] text-ink-400">Generated · cached for this session</span>
              {onRegenerate && (
                <button
                  type="button" onClick={onRegenerate}
                  className="ml-auto inline-flex items-center gap-1 text-[10.5px] font-semibold text-ink-500 hover:text-brand-700 cursor-pointer"
                >
                  <RefreshCw size={10} aria-hidden="true" /> Regenerate
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      {shown.length > 0 && (
        <div className="space-y-1.5">
          {/* A quiet kicker separates the work from the analysis above it. */}
          <p className="px-1 pt-0.5 text-[9.5px] font-bold uppercase tracking-wider text-ink-400">
            Recommended actions <span className="text-ink-300">· {recs.length}</span>
          </p>
          <TargetedActionList actions={shown} onOpen={onOpenAction} bare provenance={false} />
        </div>
      )}
      {recs.length > 4 && (
        <p className="px-1 text-[10px] text-ink-400">+{recs.length - 4} more in the full insight.</p>
      )}
    </div>
  );
}

// ─── 2c. Insight drawer — the full card, one slide-over away ────────────────
// "View full insight" on a row strip or reflection opens this: the complete
// PRD card anatomy in a right-side panel, so the row surfaces stay compact and
// the reader never loses their place in the list.

export function InsightDrawer({
  insight, onClose, onCreateControl, controlCtaVariant = 'create', onRunWorkflow, onCreateWorkflow, onSetAlert, cardHeaderLabel, cardEvidenceLabel,
}: {
  insight: LayeredInsight | null;
  onClose: () => void;
  /** Follow through on a WORKFLOW insight: open the executor for its workflow.
   *  When present it is the primary CTA (the insight reasons over runs, so the
   *  natural next step is another run — creating comes second). */
  onRunWorkflow?: () => void;
  /** Follow through on the insight: the primary control CTA. With the default
   *  'create' variant this opens the host's Add-control flow; hosts whose
   *  insight anchors at an EXISTING control pass variant 'edit' and route to
   *  that control instead (an anchored insight never needs a new control). */
  onCreateControl?: () => void;
  controlCtaVariant?: 'create' | 'edit';
  /** Follow through on the insight: open the workflow builder. */
  onCreateWorkflow?: () => void;
  /** Follow through on the insight: set a threshold alert on the widget that
   *  would have caught it earlier (the dashboard's native durable action). */
  onSetAlert?: () => void;
  /** Card header-scope override, e.g. "this dashboard" (default: layer label). */
  cardHeaderLabel?: string;
  /** Card evidence-toggle override when the per-layer wording doesn't fit. */
  cardEvidenceLabel?: string;
}) {
  return (
    <AnimatePresence>
      {insight && (
        <div className="fixed inset-0 z-[100]">
          <motion.div
            className="absolute inset-0 bg-ink-900/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: '105%' }} animate={{ x: 0 }} exit={{ x: '105%' }}
            transition={{ duration: 0.24, ease: [0.2, 0, 0, 1] }}
            className="absolute right-0 top-0 h-full w-full sm:w-1/2 bg-canvas border-l border-canvas-border shadow-2xl flex flex-col"
            role="dialog" aria-label="Full insight detail"
          >
            <div className="shrink-0 flex items-center gap-2 px-5 py-3.5 border-b border-canvas-border bg-canvas-elevated">
              <Sparkles size={14} aria-hidden="true" className="text-brand-600" />
              <span className="text-[13px] font-bold text-ink-900">Insight detail</span>
              <span className="text-[11.5px] text-ink-400 truncate">· {insight.subjectLabel}</span>
              <button
                type="button" onClick={onClose} aria-label="Close"
                className="ml-auto p-1.5 rounded-lg text-ink-500 hover:text-ink-800 hover:bg-canvas transition-colors cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <LayeredInsightCard insight={insight} headerLabel={cardHeaderLabel} evidenceLabel={cardEvidenceLabel} />
            </div>
            {(onRunWorkflow || onCreateControl || onCreateWorkflow || onSetAlert) && (
              <div className="shrink-0 flex items-center gap-2 px-5 py-3.5 border-t border-canvas-border bg-canvas-elevated">
                {onRunWorkflow && (
                  <button
                    type="button"
                    onClick={() => { onClose(); onRunWorkflow(); }}
                    className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 text-white px-3.5 h-9 text-[12.5px] font-semibold hover:bg-brand-500 transition-colors cursor-pointer"
                  >
                    <Play size={13} aria-hidden="true" /> Run workflow
                  </button>
                )}
                {onCreateControl && (
                  <button
                    type="button"
                    onClick={() => { onClose(); onCreateControl(); }}
                    className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 text-white px-3.5 h-9 text-[12.5px] font-semibold hover:bg-brand-500 transition-colors cursor-pointer"
                  >
                    {controlCtaVariant === 'edit'
                      ? <><PenLine size={13} aria-hidden="true" /> Edit control</>
                      : <><Plus size={13} aria-hidden="true" /> Create control</>}
                  </button>
                )}
                {onSetAlert && (
                  <button
                    type="button"
                    onClick={() => { onClose(); onSetAlert(); }}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3.5 h-9 font-semibold transition-colors cursor-pointer ${
                      onCreateControl
                        ? 'border border-canvas-border bg-canvas-elevated text-[0.75rem] text-ink-700 hover:border-brand-300 hover:text-brand-700'
                        : 'bg-brand-600 text-white text-[0.78125rem] hover:bg-brand-500'
                    }`}
                  >
                    <Bell size={13} aria-hidden="true" /> Set threshold alert
                  </button>
                )}
                {onCreateWorkflow && (
                  <button
                    type="button"
                    onClick={() => { onClose(); onCreateWorkflow(); }}
                    className="inline-flex items-center gap-1.5 rounded-md border border-canvas-border bg-canvas-elevated px-3 h-9 text-[12px] font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-700 transition-colors cursor-pointer"
                  >
                    <Zap size={13} aria-hidden="true" /> Create workflow
                  </button>
                )}
              </div>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

// ─── 3. Action drawer — act in place ────────────────────────────────────────

export function ActionDrawer({
  action, onClose, onViewAnchor,
}: {
  action: TargetedAction | null;
  onClose: () => void;
  /** Navigate to the anchor card's surface; the drawer closes first. */
  onViewAnchor?: () => void;
}) {
  const { addToast } = useToast();

  const apply = (a: TargetedAction) => {
    setActionStatus(a, 'applied');
    const label = a.rec.intent ? REC_INTENT_META[a.rec.intent].applyLabel : 'Applied';
    addToast({ type: 'success', message: `${label} — recorded for this period.` });
  };
  const dismiss = (a: TargetedAction) => {
    setActionStatus(a, 'dismissed');
    addToast({ type: 'info', message: 'Action dismissed for this session.' });
    onClose();
  };

  return (
    <AnimatePresence>
      {action && (
        <div className="fixed inset-0 z-[100]">
          <motion.div
            className="absolute inset-0 bg-ink-900/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: '105%' }} animate={{ x: 0 }} exit={{ x: '105%' }}
            transition={{ duration: 0.24, ease: [0.2, 0, 0, 1] }}
            className="absolute right-0 top-0 h-full w-full max-w-[420px] bg-canvas-elevated border-l border-canvas-border shadow-2xl flex flex-col"
            role="dialog" aria-label="AI action detail"
          >
            {/* Header */}
            <div className="shrink-0 px-5 pt-4 pb-3.5 border-b border-canvas-border">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${PRIORITY_PILL[action.rec.priority]}`}>
                  {REC_PRIORITY_META[action.rec.priority].label}
                </span>
                {action.rec.target && (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${TARGET_CHIP[action.rec.target.kind]}`}>
                    {action.rec.intent === 'create' ? '＋' : '→'} {action.rec.target.label}
                  </span>
                )}
                <button
                  type="button" onClick={onClose} aria-label="Close"
                  className="ml-auto p-1.5 rounded-lg text-ink-500 hover:text-ink-800 hover:bg-canvas transition-colors cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>
              <h3 className="mt-2 text-[14px] font-bold text-ink-900 leading-snug">{action.rec.title}</h3>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* Parent insight — the analytical frame the action came from. */}
              <div className="rounded-xl border border-brand-200/70 bg-brand-50/30 px-3.5 py-3">
                <p className="text-[9px] font-bold uppercase tracking-wider text-brand-600">
                  From insight · anchored at {action.source.subjectLabel}
                </p>
                <p className="mt-1 text-[12.5px] font-semibold text-ink-900 leading-snug">{action.source.takeaway}</p>
                <div className="mt-1.5 flex items-center gap-2 flex-wrap text-[10.5px] text-ink-600">
                  <span>Severity {SEV_LABEL[action.source.severity]}</span>
                  <span aria-hidden="true">·</span>
                  <span>{action.source.evidence.length} evidence row{action.source.evidence.length === 1 ? '' : 's'}</span>
                  {onViewAnchor && (
                    <button
                      type="button" onClick={() => { onClose(); onViewAnchor(); }}
                      className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:text-brand-600 cursor-pointer"
                    >
                      View full insight <ArrowUpRight size={11} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-1">Why this action</p>
                <p className="text-[12.5px] text-ink-700 leading-relaxed">{action.rec.rationale}</p>
              </div>

              {action.rec.basis && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-1">Methodology basis</p>
                  <span className="inline-flex items-center rounded-md border border-canvas-border bg-canvas px-2 py-1 text-[11px] font-semibold text-ink-700">{action.rec.basis}</span>
                </div>
              )}

              {action.rec.guardrail && (
                <div className="flex items-start gap-2 rounded-lg border border-canvas-border bg-canvas px-3 py-2.5">
                  <ShieldCheck size={13} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-500" />
                  <p className="text-[11.5px] text-ink-600 leading-snug"><span className="font-semibold text-ink-800">Your call:</span> {action.rec.guardrail}</p>
                </div>
              )}
            </div>

            {/* Footer — act here; Ask IRA is the escape hatch, not the default. */}
            <div className="shrink-0 px-5 py-3.5 border-t border-canvas-border flex items-center gap-2">
              {getActionStatus(action) === 'applied' ? (
                <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-compliant-700">
                  <Check size={13} aria-hidden="true" /> Applied — recorded for this period.
                </span>
              ) : (
                <button
                  type="button" onClick={() => apply(action)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 text-white px-3.5 h-9 text-[12.5px] font-semibold hover:bg-brand-500 transition-colors cursor-pointer"
                >
                  <IntentIcon intent={action.rec.intent} size={13} />
                  {action.rec.intent ? REC_INTENT_META[action.rec.intent].applyLabel : 'Apply'}
                </button>
              )}
              <button
                type="button" onClick={() => openInChat(action.rec.title, action.source.subjectLabel)}
                className="inline-flex items-center gap-1.5 rounded-md border border-canvas-border bg-canvas-elevated px-3 h-9 text-[12px] font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-700 transition-colors cursor-pointer"
              >
                Open in Ask IRA
              </button>
              {getActionStatus(action) !== 'applied' && (
                <button
                  type="button" onClick={() => dismiss(action)}
                  className="ml-auto text-[12px] font-medium text-ink-500 hover:text-ink-800 cursor-pointer"
                >
                  Dismiss
                </button>
              )}
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
