// ─── Insight Generator — the manual, cost-aware trigger ────────────────────
//
// Insights are NOT generated when a tab opens — that would bill the engine on
// every navigation. This wrapper gates generation behind an explicit action:
//
//   idle  →  (user clicks Generate)  →  generating (honest pipeline)  →  card
//
// Once generated for a given subject, the result is cached for the session, so
// navigating away and back does not re-run the engine. A "Regenerate" affordance
// re-runs it deliberately. Renders LayeredInsightCard when ready.
//
// Two shapes:
//   • single subject  → one LayeredInsightCard (the default).
//   • `subjects` set  → one Generate produces N insights, rendered as an
//     InsightStack accordion (the engagement / roll-up altitude, where the
//     engine legitimately surfaces many findings at once).

import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Loader2, Check, RefreshCw, Brain, Zap } from 'lucide-react';
import {
  buildLayeredInsight, LAYER_META,
  type InsightLayer, type LayeredInsight, type CheckMoreOption, type BuildInsightInput,
} from '../../data/layeredInsights';
import LayeredInsightCard from './LayeredInsightCard';
import InsightStack from './InsightStack';

// ─── Session cache — keeps a generated insight alive across navigation ──────
// Module-level so it survives unmount. Cleared only on a hard reload.

const CACHE = new Map<string, LayeredInsight>();
const MULTI_CACHE = new Map<string, LayeredInsight[]>();
const cacheKey = (layer: InsightLayer, subjectId: string) => `${layer}:${subjectId}`;

// ─── The generating pipeline (honest "AI thinking") ────────────────────────

const PIPELINE: Record<InsightLayer, string[]> = {
  control: ['Reading this control’s runs', 'Correlating flagged rows across runs', 'Pricing the consequence', 'Writing the explanation'],
  risk: ['Reading this risk’s mapped controls', 'Finding the shared root cause', 'Locating the coverage gap', 'Writing the explanation'],
  engagement: ['Reading every risk and control', 'Collapsing findings that share a driver', 'Weighing the total against readiness', 'Writing the escalation'],
};

const stackSteps = (n: number): string[] => [
  'Reading every risk and control in scope',
  'Correlating findings across the scope',
  'Collapsing findings that share a driver',
  `Writing ${n} insight${n === 1 ? '' : 's'}`,
];

const STEP_MS = 520;

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
}

export default function InsightGenerator({
  layer, subjectId, subjectLabel, status, priority, isKey, flagship, compact = false,
  labelOverride, scanOverride, stepsOverride, onCheckMore,
  subjects, stackScopeLabel, initialOpen = 1,
  previewCount, onSeeAll, stackFoldLedger,
}: Props) {
  const multi = (subjects?.length ?? 0) > 0;
  const key = multi ? `${cacheKey(layer, subjectId)}:stack:${subjects!.length}` : cacheKey(layer, subjectId);
  const cachedSingle = !multi ? (CACHE.get(key) ?? null) : null;
  const cachedMulti = multi ? (MULTI_CACHE.get(key) ?? null) : null;

  const [insight, setInsight] = useState<LayeredInsight | null>(cachedSingle);
  const [stack, setStack] = useState<LayeredInsight[] | null>(cachedMulti);
  const [phase, setPhase] = useState<'idle' | 'generating' | 'generated'>(cachedSingle || cachedMulti ? 'generated' : 'idle');
  const [step, setStep] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const meta = LAYER_META[layer];
  const label = labelOverride ?? meta.label;
  const scan = scanOverride ?? meta.scan;
  const steps = stepsOverride ?? (multi ? stackSteps(subjects!.length) : PIPELINE[layer]);

  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  const run = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPhase('generating');
    setStep(0);
    steps.forEach((_, i) => {
      timers.current.push(setTimeout(() => setStep(i + 1), STEP_MS * (i + 1)));
    });
    timers.current.push(setTimeout(() => {
      if (multi) {
        const built = subjects!.map(buildLayeredInsight);
        MULTI_CACHE.set(key, built);
        setStack(built);
      } else {
        const built = buildLayeredInsight({ layer, subjectId, subjectLabel, status, priority, isKey, flagship });
        CACHE.set(key, built);
        setInsight(built);
      }
      setPhase('generated');
    }, STEP_MS * (steps.length + 1)));
  };

  // ── Generated ──
  if (phase === 'generated' && (insight || stack)) {
    return (
      <div className="space-y-2">
        {multi && stack
          ? <InsightStack insights={stack} scopeLabel={stackScopeLabel ?? ''} onCheckMore={onCheckMore} initialOpen={initialOpen} previewCount={previewCount} onSeeAll={onSeeAll} foldLedger={stackFoldLedger} />
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

  // ── Generating ──
  if (phase === 'generating') {
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
        <div className="space-y-1.5">
          {steps.map((s, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <div key={s} className={`flex items-center gap-2 text-[12px] transition-colors ${done ? 'text-ink-700' : active ? 'text-brand-700 font-medium' : 'text-ink-300'}`}>
                <span className="size-4 shrink-0 flex items-center justify-center">
                  {done ? <Check size={13} className="text-compliant" /> : active ? <Loader2 size={12} className="animate-spin" /> : <span className="size-1.5 rounded-full bg-ink-300" />}
                </span>
                {s}
              </div>
            );
          })}
        </div>
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
  onClick, className = '', priority, count,
}: {
  onClick?: () => void; className?: string;
  priority?: 'do-now' | 'this-period'; count?: number;
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
      title={`AI has ${count ?? ''} recommendation${count === 1 ? '' : 's'} for this item`}
    >
      <Sparkles size={9} aria-hidden="true" /> AI recommends{doNow ? ' · Do now' : ''}
    </Tag>
  );
}
