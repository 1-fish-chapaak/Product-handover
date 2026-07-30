// ─── Insight Generator — the manual, cost-aware trigger ────────────────────
//
// Insights are NOT generated when a tab opens — that would bill the engine on
// every navigation. This wrapper gates generation behind an explicit action:
//
//   idle  →  (user clicks Generate)  →  generating (honest pipeline)  →  one of:
//     generated — insight card(s), cached for the session
//     empty     — the scan finished clean. A real result (assurance), styled
//                 compliant-toned so it can never be mistaken for a failure.
//     error     — the engine stopped mid-pass. NOT a result: the pipeline
//                 freezes at the failed step and the copy says "unanalyzed",
//                 so a failed run can never be read as "no findings".
//
// Once generated for a given subject, the result is cached for the session, so
// navigating away and back does not re-run the engine. A "Regenerate" affordance
// re-runs it deliberately. Renders LayeredInsightCard when ready. A clean scan
// is cached too (it's a result); a failure is not — returning offers idle again.
//
// Two shapes:
//   • single subject  → one LayeredInsightCard (the default).
//   • `subjects` set  → one Generate produces N insights, rendered as an
//     InsightStack accordion (the engagement / roll-up altitude, where the
//     engine legitimately surfaces many findings at once).
//
// Demo hooks: append ?insightDemo=empty | error | error-once to any URL to
// force the outcome on every surface ("error-once" fails the first attempt and
// succeeds on retry — the live-demo arc). Or wire `simulateOutcome` per usage.
// An empty `subjects` array reaches the empty state organically.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Loader2, Check, RefreshCw, Brain, Zap, ShieldCheck, AlertTriangle, X } from 'lucide-react';
import {
  buildLayeredInsight, LAYER_META,
  type InsightLayer, type LayeredInsight, type CheckMoreOption, type BuildInsightInput,
} from '../../data/layeredInsights';
import LayeredInsightCard from './LayeredInsightCard';
import InsightStack from './InsightStack';
// Session cache + generation registry — module-level so a generated insight
// survives unmount (cleared on hard reload); lives in its own file so row-level
// surfaces can subscribe to "insights exist now" without importing this component.
import { CACHE, MULTI_CACHE, EMPTY_CACHE, cacheKey, notifyCacheChanged } from './insightCache';

// ─── Generation outcome ─────────────────────────────────────────────────────
// The mock engine always succeeds, so the empty/error outcomes are forced —
// via the `simulateOutcome` prop or a page-wide ?insightDemo= query param.

type Outcome = 'insight' | 'empty' | 'error';

export function demoOutcome(): 'empty' | 'error' | 'error-once' | null {
  if (typeof window === 'undefined') return null;
  const v = new URLSearchParams(window.location.search).get('insightDemo');
  return v === 'empty' || v === 'error' || v === 'error-once' ? v : null;
}

// ─── The generating pipeline (honest "AI thinking") ────────────────────────

const PIPELINE: Record<InsightLayer, string[]> = {
  control: ['Reading this control’s runs', 'Correlating flagged rows across runs', 'Pricing the consequence', 'Writing the explanation'],
  risk: ['Reading this risk’s mapped controls', 'Finding the shared root cause', 'Locating the coverage gap', 'Writing the explanation'],
  sop: ['Reading this SOP’s risks and controls', 'Finding the shared root cause', 'Locating the coverage gap', 'Writing the explanation'],
  engagement: ['Reading every risk and control', 'Collapsing findings that share a driver', 'Weighing the total against readiness', 'Writing the escalation'],
};

export const stackSteps = (n: number | null): string[] => [
  'Reading every risk and control in scope',
  'Correlating findings across the scope',
  'Collapsing findings that share a driver',
  n == null ? 'Writing the insights' : `Writing ${n} insight${n === 1 ? '' : 's'}`,
];

export const STEP_MS = 520;

/** The honest step list — done / active-or-failed / pending rows. Shared by
 *  the generating and error phases here and by any surface that renders the
 *  pipeline outside this component (the engagement insights drawer). */
export function PipelineChecklist({ steps, current, failedAt }: {
  steps: string[];
  /** Index of the step currently running (ignored when `failedAt` is set). */
  current: number;
  /** Freeze the pipeline at this step and mark it failed. */
  failedAt?: number;
}) {
  return (
    <div className="space-y-1.5">
      {steps.map((s, i) => {
        const done = failedAt != null ? i < failedAt : i < current;
        const failed = failedAt != null && i === failedAt;
        const active = failedAt == null && i === current;
        return (
          <div key={s} className={`flex items-center gap-2 text-[0.75rem] transition-colors ${done ? 'text-ink-700' : failed ? 'text-risk font-medium' : active ? 'text-brand-700 font-medium' : 'text-ink-300'}`}>
            <span className="size-4 shrink-0 flex items-center justify-center">
              {done ? <Check size={13} className="text-compliant" /> : failed ? <X size={13} /> : active ? <Loader2 size={12} className="animate-spin" /> : <span className="size-1.5 rounded-full bg-ink-300" />}
            </span>
            {s}{failed && ' — stopped here'}
          </div>
        );
      })}
    </div>
  );
}

interface Props {
  layer: InsightLayer;
  subjectId: string;
  subjectLabel: string;
  /** Control / engagement status hint. */
  status?: string;
  /** Risk priority hint. */
  priority?: string;
  /** Whether the control is a key control (drives coverage/scoping recs). */
  isKey?: boolean;
  /** Force the flagship pricing story (subject known to carry the thread). */
  flagship?: boolean;
  /** Tighter idle panel for dense row contexts. */
  compact?: boolean;
  /** Override the "for {label}" phrase in the idle/generating headers — e.g. a
   *  register-level box that anchors on one subject ("this risk register"). */
  labelOverride?: string;
  /** Override the idle-body scan clause (defaults to the layer's scan line). */
  scanOverride?: string;
  /** Override the generating-pipeline steps (defaults to the layer's steps). */
  stepsOverride?: string[];
  onCheckMore?: (opt: CheckMoreOption) => void;
  /** Multi-insight mode: one Generate builds every subject and renders an
   *  InsightStack accordion instead of a single card. */
  subjects?: BuildInsightInput[];
  /** Trailing phrase for the stack header, e.g. "across this engagement". */
  stackScopeLabel?: string;
  /** How many top rows of the stack open on first render (default 1). */
  initialOpen?: number;
  /** Preview mode: show only the top N stack cards + a "See all" CTA. */
  previewCount?: number;
  /** Where "See all" goes — the surface that renders the full stack. */
  onSeeAll?: () => void;
  /** Fold the stack's below-the-fold rows into a ledger (default true). */
  stackFoldLedger?: boolean;
  /** Read the stack as a directory grouped by anchor level (the B+C hub). */
  stackGroupByAnchor?: boolean;
  /** Replace the generated single-card rendering with a caller-supplied view
   *  (e.g. a row's compact summary strip). Idle / generating / empty / error
   *  phases and the cache mechanics are untouched; the callback receives the
   *  built insight and a regenerate trigger. Single-subject mode only. */
  generatedView?: (insight: LayeredInsight, regenerate: () => void) => ReactNode;
  /** Replace the default buildLayeredInsight call with a caller-supplied
   *  builder — for surfaces whose insight derives from their own output (the
   *  executor's run card). Gate, pipeline and cache mechanics are untouched.
   *  Single-subject mode only. */
  buildInsight?: () => LayeredInsight;
  /** Multi-insight counterpart of `buildInsight`: one Generate produces the
   *  returned set (implies multi mode, no `subjects` needed) — for surfaces
   *  whose insights are authored rather than status-derived (the dashboard).
   *  Return [] and the gate still runs; pair with simulateOutcome="empty" to
   *  reach the clean-scan state organically. */
  buildStack?: () => LayeredInsight[];
  /** Replace the generated InsightStack rendering with a caller-supplied view
   *  (e.g. the dashboard band's one-line strips). Multi mode counterpart of
   *  `generatedView`; cache and pipeline mechanics are untouched. */
  generatedStackView?: (insights: LayeredInsight[], regenerate: () => void) => ReactNode;
  /** External trigger: increment to start generation from outside the panel
   *  (a header-level CTA). Ignored mid-generation; 0/undefined never fires. */
  runSignal?: number;
  /** Force the generation outcome — for demos and for states the mock engine
   *  can't reach organically. The ?insightDemo= URL param overrides this. */
  simulateOutcome?: Outcome;
}

export default function InsightGenerator({
  layer, subjectId, subjectLabel, status, priority, isKey, flagship, compact = false,
  labelOverride, scanOverride, stepsOverride, onCheckMore,
  subjects, stackScopeLabel, initialOpen = 1,
  previewCount, onSeeAll, stackFoldLedger, stackGroupByAnchor, generatedView, buildInsight, buildStack, generatedStackView, runSignal, simulateOutcome,
}: Props) {
  const multi = (subjects?.length ?? 0) > 0 || !!buildStack;
  const key = multi ? `${cacheKey(layer, subjectId)}:stack:${subjects?.length ?? 'custom'}` : cacheKey(layer, subjectId);
  const cachedSingle = !multi ? (CACHE.get(key) ?? null) : null;
  const cachedMulti = multi ? (MULTI_CACHE.get(key) ?? null) : null;

  const [insight, setInsight] = useState<LayeredInsight | null>(cachedSingle);
  const [stack, setStack] = useState<LayeredInsight[] | null>(cachedMulti);
  const [phase, setPhase] = useState<'idle' | 'generating' | 'generated' | 'empty' | 'error'>(
    cachedSingle || cachedMulti ? 'generated' : EMPTY_CACHE.has(key) ? 'empty' : 'idle',
  );
  const [step, setStep] = useState(0);
  const [outcome, setOutcome] = useState<Outcome>('insight');
  const [failedStep, setFailedStep] = useState(0);
  const attempts = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const meta = LAYER_META[layer];
  const label = labelOverride ?? meta.label;
  const scan = scanOverride ?? meta.scan;
  const steps = stepsOverride ?? (multi ? stackSteps(subjects?.length ?? null) : PIPELINE[layer]);

  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  // External trigger (a header-level Generate CTA). Fires only from idle, so a
  // remount that restores a cached result never silently regenerates.
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const runRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (runSignal && phaseRef.current === 'idle') runRef.current();
  }, [runSignal]);

  const run = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    attempts.current += 1;

    // Decide the outcome up front (the mock engine can't fail on its own).
    const demo = demoOutcome();
    let next: Outcome;
    if (demo === 'error-once') next = attempts.current === 1 ? 'error' : 'insight';
    else if (demo === 'empty' || demo === 'error') next = demo;
    else if (simulateOutcome) next = simulateOutcome;
    else if (subjects != null && subjects.length === 0) next = 'empty';
    else if (buildStack && buildStack().length === 0) next = 'empty';
    else next = 'insight';

    setOutcome(next);
    setPhase('generating');
    setStep(0);

    if (next === 'error') {
      // Honest failure: finish the early passes, stall on one, then surface it.
      const failAt = Math.min(2, steps.length - 1);
      setFailedStep(failAt);
      for (let i = 0; i < failAt; i++) {
        timers.current.push(setTimeout(() => setStep(i + 1), STEP_MS * (i + 1)));
      }
      timers.current.push(setTimeout(() => setPhase('error'), STEP_MS * (failAt + 1) + 780));
      return;
    }

    steps.forEach((_, i) => {
      timers.current.push(setTimeout(() => setStep(i + 1), STEP_MS * (i + 1)));
    });
    timers.current.push(setTimeout(() => {
      if (next === 'empty') {
        EMPTY_CACHE.add(key);
        setInsight(null);
        setStack(null);
        setPhase('empty');
        return;
      }
      EMPTY_CACHE.delete(key);
      const stamp = Date.now(); // drives the card header's "N min ago"
      if (multi) {
        const built = (buildStack ? buildStack() : subjects!.map(s => buildLayeredInsight(s))).map(b => ({ ...b, generatedAt: stamp }));
        MULTI_CACHE.set(key, built);
        // Seed each subject's single-card cache too, so row-level surfaces
        // (control rows, workflow rows) reveal their insight without a second
        // Generate — one engagement-level run fills every altitude below it.
        built.forEach(b => CACHE.set(cacheKey(b.layer, b.subjectId), b));
        setStack(built);
      } else {
        const built = {
          ...(buildInsight ? buildInsight() : buildLayeredInsight({ layer, subjectId, subjectLabel, status, priority, isKey, flagship })),
          generatedAt: stamp,
        };
        CACHE.set(key, built);
        setInsight(built);
      }
      notifyCacheChanged();
      setPhase('generated');
    }, STEP_MS * (steps.length + 1)));
  };

  runRef.current = run;

  // ── Generated ──
  if (phase === 'generated' && (insight || stack)) {
    if (!multi && insight && generatedView) {
      return <>{generatedView(insight, run)}</>;
    }
    if (multi && stack && generatedStackView) {
      return <>{generatedStackView(stack, run)}</>;
    }
    return (
      <div className="space-y-2">
        {multi && stack
          ? <InsightStack insights={stack} scopeLabel={stackScopeLabel ?? ''} onCheckMore={onCheckMore} initialOpen={initialOpen} previewCount={previewCount} onSeeAll={onSeeAll} foldLedger={stackFoldLedger} groupByAnchor={stackGroupByAnchor} />
          : insight && <LayeredInsightCard insight={insight} onCheckMore={onCheckMore} />}
        <div className="flex items-center gap-2 px-1">
          <span className="text-[10.5px] text-ink-400 flex items-center gap-1"><Check size={11} className="text-compliant" /> Generated just now · cached for this session</span>
          <button type="button" onClick={run} className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-brand-700 hover:text-brand-600 cursor-pointer">
            <RefreshCw size={11} /> Regenerate
          </button>
        </div>
      </div>
    );
  }

  // ── Empty — the scan finished clean. Assurance, not absence: compliant-toned
  // receipt of the work done, so it can never read as a failure (that's red). ──
  if (phase === 'empty') {
    return (
      <div className="rounded-2xl border border-compliant-200 bg-gradient-to-b from-compliant-50/40 to-canvas-elevated p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-2.5">
          <span className="size-6 rounded-lg bg-compliant-50 text-compliant-700 flex items-center justify-center">
            <ShieldCheck size={13} aria-hidden="true" />
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-compliant-700">Scan complete · nothing to raise</span>
          <span className="ml-auto text-[10.5px] text-ink-400 tabular-nums">{steps.length} checks · just now</span>
        </div>
        <p className="text-[13px] font-bold text-ink-900 leading-snug">
          No insights for {label} right now — and that is the finding.
        </p>
        <p className="text-[12px] text-ink-600 leading-relaxed mt-1">
          I ran the full scan and every correlation pass completed: no shared driver, no repeating exception, no consequence worth pricing. A clean scan is a point-in-time result — new runs, findings, or scope changes can surface insights later.
        </p>
        <div className="flex items-center gap-2 mt-3">
          <span className="text-[10.5px] text-ink-400 flex items-center gap-1">
            <Check size={11} className="text-compliant" /> Cached for this session
          </span>
          <button type="button" onClick={run} className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-brand-700 hover:text-brand-600 cursor-pointer">
            <RefreshCw size={11} /> Check again
          </button>
        </div>
      </div>
    );
  }

  // ── Error — the engine stopped mid-pass. NOT a result: the pipeline freezes
  // at the failed step and the copy insists the scope is unanalyzed, so a
  // failure can never be mistaken for "no findings". Retry is constructive. ──
  if (phase === 'error') {
    return (
      <div className="rounded-2xl border border-risk/25 bg-gradient-to-b from-risk-50/50 to-canvas-elevated p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="size-6 rounded-lg bg-risk-50 text-risk flex items-center justify-center">
            <AlertTriangle size={13} aria-hidden="true" />
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-risk-700">Generation failed · {label}</span>
        </div>
        <div className="mb-3">
          <PipelineChecklist steps={steps} current={failedStep} failedAt={failedStep} />
        </div>
        <p className="text-[12px] text-ink-700 leading-relaxed">
          The engine stopped before reaching a conclusion, so this is not a clean result — treat {label} as unanalyzed, not insight-free. This attempt wasn’t billed.
        </p>
        <div className="flex items-center gap-3 mt-3">
          <button type="button" onClick={run} className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 text-white px-3 h-8 text-[12px] font-semibold hover:bg-brand-500 transition-colors cursor-pointer">
            <RefreshCw size={12} /> Retry generation
          </button>
          <span className="text-[10.5px] text-ink-400">Retrying is safe — your scope data is unchanged.</span>
        </div>
      </div>
    );
  }

  // ── Generating ──
  if (phase === 'generating') {
    // A clean-bound run can't honestly end on "Writing N insights".
    const shownSteps = outcome === 'empty' ? [...steps.slice(0, -1), 'Deciding what needs to be raised'] : steps;
    return (
      <div className="rounded-2xl border border-brand-200/70 bg-gradient-to-b from-brand-50/45 to-canvas-elevated p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="size-6 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center">
            <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.4, ease: 'linear' }} className="inline-flex"><Loader2 size={13} /></motion.span>
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-700">Generating insight{multi ? 's' : ''} · {label}</span>
          <span className="ml-auto flex items-center gap-1">
            {[0, 1, 2].map(i => (
              <motion.span key={i} className="size-1.5 rounded-full bg-brand-400"
                animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.18 }} />
            ))}
          </span>
        </div>
        <PipelineChecklist steps={shownSteps} current={step} />
      </div>
    );
  }

  // ── Idle — the cost gate ──
  return (
    <div className={`rounded-2xl border border-dashed border-brand-200 bg-brand-50/30 ${compact ? 'p-3.5' : 'p-4 sm:p-5'}`}>
      <div className="flex items-start gap-3">
        <span className={`${compact ? 'size-8' : 'size-9'} rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center shrink-0`}>
          <Brain size={compact ? 15 : 17} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h4 className={`${compact ? 'text-[13px]' : 'text-[14px]'} font-bold text-ink-900 leading-tight`}>
            Generate AI insights for {label}
          </h4>
          <p className="text-[11.5px] text-ink-500 leading-relaxed mt-0.5">
            {scan}, correlates the findings, and prices the consequence — with a recommended action. Won’t run automatically; you trigger it so it only bills when you need it.
          </p>
          <button
            type="button" onClick={run}
            className={`mt-2.5 inline-flex items-center gap-1.5 rounded-md bg-brand-600 text-white ${compact ? 'px-3 h-8 text-[12px]' : 'px-3.5 h-9 text-[12.5px]'} font-semibold hover:bg-brand-500 transition-colors cursor-pointer`}
          >
            <Sparkles size={13} /> Generate insights
          </button>
          <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-ink-400"><Zap size={10} /> Heuristic-first · human-gated</span>
        </div>
      </div>
    </div>
  );
}

/** Cheap row-level badge signalling actionable recommendations are available —
 *  no engine call. Colour tracks the top priority; click bubbles up to expand
 *  the subject, where Generate lives. */
export function AIRecommendsBadge({
  onClick, className = '', priority, count, label = 'AI recommends',
}: {
  onClick?: () => void; className?: string;
  priority?: 'do-now' | 'this-period'; count?: number;
  /** Chip wording — e.g. "AI insight" on control rows (the mock's copy). */
  label?: string;
}) {
  const Tag = onClick ? 'button' : 'span';
  const doNow = priority === 'do-now';
  const tone = doNow
    ? `bg-risk-50 text-risk border-risk/20 ${onClick ? 'hover:bg-risk-50' : ''}`
    : `bg-brand-50 text-brand-700 border-brand-100 ${onClick ? 'hover:bg-brand-100' : ''}`;
  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={`inline-flex items-center gap-1 rounded-full px-2 h-5 text-[0.625rem] font-bold border ${tone} ${onClick ? 'cursor-pointer' : ''} ${className}`}
      title={`AI has ${count != null ? `${count} ` : ''}recommendation${count === 1 ? '' : 's'} for this item${onClick ? ' — click to view' : ''}`}
    >
      <Sparkles size={9} aria-hidden="true" /> {label}{doNow ? ' · Do now' : ''}
    </Tag>
  );
}
