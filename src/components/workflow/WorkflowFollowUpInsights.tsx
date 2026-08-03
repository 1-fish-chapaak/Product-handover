// ─── Workflow Executor — follow-up memory insights ────────────────────────
//
// Two memory-derived cards rendered in the executor's follow-up region, once a
// run completes. They extend the single "AI insight · this run" card outward in
// two directions the run itself can't see:
//
//   1. Compare with previous output — how THIS run moved vs the previous run of
//      the same workflow: the verdict (better/worse/same), how the KPIs moved
//      (with an inline before/after bar), what's new, what got fixed, what's
//      still open, and one next action.
//   2. Cross-workflow correlation — the same entity surfacing in OTHER
//      workflows: who it's about, where else it's shown up, how strong the
//      pattern is, the money involved, whether it's already on a watchlist.
//      Rendered through the shared LayeredInsightCard so it reads identically
//      to the engagement / risk / control AI-insight surfaces; the sampled
//      exception rows survive as the evidence drill-down.
//
// Presentational + light derivation only. Data comes from the shared Insight
// Memory Engine layer (RUN_OUTPUT_COMPARE / STAGE3_* / ENTITY_MEMORY), so the
// numbers always tie back to the run. Every recommendation / "what to do next"
// can seed the follow-up composer via `onAction`, threading insights into chat.

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  GitCompareArrows, TrendingUp, TrendingDown, Minus,
  Plus, Check, Sparkles, Brain, Layers,
  ChevronDown, ChevronLeft, ChevronRight, ScrollText,
} from 'lucide-react';
import {
  RUN_OUTPUT_COMPARE, STAGE3_CURRENT, ENTITY_MEMORY, ENTERPRISE_CONTEXT,
  PROCESS_INSIGHTS, correlatedRecords, /* compareForWorkflow — parked with the output-compare card below */
  type OutputCompare, type RunSnapshot, type KpiDef, type KpiFormat,
  type Stage3Record, type Stage3EvidenceRow,
} from '../../data/insightMemory';
import type { LayeredInsight, VerdictTone, CheckMoreOption } from '../../data/layeredInsights';
import LayeredInsightCard from '../shared/LayeredInsightCard';
import InsightFeedback from '../shared/InsightFeedback';
import RunSelector from '../shared/RunSelector';
import {
  RecommendedActions, EvidenceDisclosure,
  type RecItem, type EvidenceRow,
} from '../shared/InsightActions';

// ─── shared helpers ───────────────────────────────────────────────────────

const usd0 = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const usd2 = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const int0 = (n: number) => Math.round(n).toLocaleString('en-US');

const FMT: Record<KpiFormat, (n: number) => string> = { int: int0, usd2 };

// The compare card's default KPI set. A workflow can expose more (or different)
// metrics via OutputCompare.kpiDefs; the card renders whatever it's given and
// the trend row scrolls once the set overflows three-up. One source of truth so
// the sparklines, delta chips, headline copy and verdict read the same numbers.
const DEFAULT_KPI_DEFS: KpiDef[] = [
  { key: 'exceptions', label: 'Exceptions', headline: true, format: 'int', polarity: 'lowerBetter' },
  { key: 'rowsProcessed', label: 'Rows processed', format: 'int', polarity: 'neutral' },
  { key: 'underRecovered', label: '$ under-recovered (sampled)', format: 'usd2', polarity: 'lowerBetter' },
];

// Tone of a single KPI move — 'lowerBetter' metrics warn when they rise; a
// 'neutral' volume metric (rows processed) never colours good/bad.
function kpiTone(polarity: KpiDef['polarity'], dir: 'up' | 'down' | 'flat'): 'bad' | 'good' | 'neutral' {
  if (polarity === 'neutral' || dir === 'flat') return 'neutral';
  return dir === 'up' ? 'bad' : 'good';
}
const TONE_TEXT = { bad: 'text-risk-400', good: 'text-compliant-500', neutral: 'text-brand-400' } as const;
const CHIP_CLS = { bad: 'text-risk bg-risk-50', good: 'text-compliant-700 bg-compliant-50', neutral: 'text-ink-500 bg-canvas' } as const;
const BAR_CLS = { bad: 'bg-risk-400', good: 'bg-compliant-500', neutral: 'bg-brand-300' } as const;

function moveOf(def: KpiDef, cur: number, prev: number) {
  const pct = prev ? Math.round(((cur - prev) / prev) * 100) : 0;
  const dir = cur > prev ? 'up' : cur < prev ? 'down' : 'flat';
  return { pct, dir, tone: kpiTone(def.polarity, dir as 'up' | 'down' | 'flat') };
}

// ─── 1. Compare with previous output ──────────────────────────────────────

const VERDICT = {
  worse: { label: 'Worse', cls: 'bg-risk-50 text-risk border-risk/25', dot: 'bg-risk', Icon: TrendingUp },
  better: { label: 'Better', cls: 'bg-compliant-50 text-compliant-700 border-compliant/25', dot: 'bg-compliant', Icon: TrendingDown },
  same: { label: 'About the same', cls: 'bg-canvas text-ink-500 border-canvas-border', dot: 'bg-ink-300', Icon: Minus },
} as const;

type Verdict = keyof typeof VERDICT;

// Inline sparkline — a run series as a normalized polyline + soft area fill with
// the latest point dotted. No axes; the tile's hero value + series row carry the
// numbers. Stroke stays crisp when the SVG stretches to fill the tile.
function Sparkline({ values, tone }: { values: number[]; tone: 'bad' | 'good' | 'neutral' }) {
  const w = 140, h = 34, pad = 3;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const stepX = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
  const pts = values.map((val, i) => {
    const x = pad + i * stepX;
    const y = pad + (1 - (val - min) / span) * (h - pad * 2);
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const [lx, ly] = pts[pts.length - 1];
  const area = `${line} L${lx.toFixed(1)},${h} L${pts[0][0].toFixed(1)},${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" className={TONE_TEXT[tone]} aria-hidden>
      <path d={area} fill="currentColor" opacity={0.1} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={lx} cy={ly} r={2.6} fill="currentColor" />
    </svg>
  );
}

// Delta tile (single comparison run) — current value hero, a coloured % chip,
// "from X", and a magnitude bar scaled to the biggest mover across the three
// KPIs (`maxAbsPct`) so the largest change reads longest, not pinned at 100%.
function KpiDeltaTile({ def, prev, cur, maxAbsPct }: {
  def: KpiDef; prev: number; cur: number; maxAbsPct: number;
}) {
  const { pct, dir, tone } = moveOf(def, cur, prev);
  const fmt = FMT[def.format];
  const Arrow = dir === 'up' ? TrendingUp : dir === 'down' ? TrendingDown : Minus;
  const barW = maxAbsPct ? Math.max(6, (Math.abs(pct) / maxAbsPct) * 100) : 0;
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-canvas-border bg-canvas-elevated p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wide text-ink-400 leading-tight">{def.label}</span>
        {dir !== 'flat' && (
          <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10.5px] font-bold shrink-0 ${CHIP_CLS[tone]}`}>
            <Arrow size={10} />{pct > 0 ? '+' : ''}{pct}%
          </span>
        )}
      </div>
      <span className="text-[22px] font-bold font-mono text-ink-900 leading-none tracking-tight">{fmt(cur)}</span>
      <div className="text-[11px] font-mono text-ink-400">from {fmt(prev)}</div>
      <div className="mt-0.5 h-1.5 rounded-full bg-canvas overflow-hidden" title={`${Math.abs(pct)}% change`}>
        <div className={`h-full rounded-full ${BAR_CLS[tone]}`} style={{ width: `${barW}%` }} />
      </div>
    </div>
  );
}

// Trend tile (2+ comparison runs) — same hero value + last-move chip, but the
// magnitude bar becomes a sparkline over the whole selected window, with the
// run-by-run series underneath and the latest point emphasized. The headline
// KPI (exceptions) gets a subtle accent so the eye lands there first.
function KpiTrendTile({ def, series }: { def: KpiDef; series: number[] }) {
  const cur = series[series.length - 1];
  const prev = series[series.length - 2] ?? cur;
  const { pct, dir, tone } = moveOf(def, cur, prev);
  const fmt = FMT[def.format];
  const Arrow = dir === 'up' ? TrendingUp : dir === 'down' ? TrendingDown : Minus;
  return (
    <div className={`flex h-full flex-col gap-2 rounded-xl border p-3 snap-start ${def.headline ? 'border-brand-200 bg-brand-50/25' : 'border-canvas-border bg-canvas-elevated'}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wide text-ink-400 leading-tight">{def.label}</span>
        {dir !== 'flat' && (
          <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10.5px] font-bold shrink-0 ${CHIP_CLS[tone]}`}>
            <Arrow size={10} />{pct > 0 ? '+' : ''}{pct}%
          </span>
        )}
      </div>
      <span className="text-[22px] font-bold font-mono text-ink-900 leading-none tracking-tight">{fmt(cur)}</span>
      <Sparkline values={series} tone={tone} />
      <div className="text-[10.5px] font-mono leading-tight text-ink-400">
        {series.map((val, i) => (
          <span key={i}>
            {i > 0 && <span className="text-ink-300"> · </span>}
            <span className={i === series.length - 1 ? `font-bold ${TONE_TEXT[tone]}` : ''}>{fmt(val)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// Horizontal KPI carousel. Tiles flex to fill and read 3-up when they fit — no
// chrome at all in that case. Once the set overflows (more KPIs than fit, or a
// narrowed column), edge-fade masks + floating ‹ › buttons appear only on the
// side that has more to reveal, while native trackpad / touch / drag and
// scroll-snap keep working. The affordance is the point: a hidden macOS
// scrollbar leaves off-screen KPIs undiscoverable.
function TrendKpiRow({ tiles }: { tiles: { def: KpiDef; series: number[] }[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const left = el.scrollLeft > 1;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setEdges(prev => (prev.left === left && prev.right === right ? prev : { left, right }));
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', measure); ro.disconnect(); };
  }, [measure]);

  // Page by most of the viewport, keeping one tile of context; snap settles it.
  const page = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.85, behavior: 'smooth' });

  const arrowBase = 'absolute top-1/2 z-20 grid size-7 -translate-y-1/2 place-items-center rounded-full border border-canvas-border bg-canvas-elevated text-ink-600 shadow-sm transition-all duration-200 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 cursor-pointer';

  return (
    <div className="relative">
      {/* Left edge fade + control */}
      <div className={`pointer-events-none absolute inset-y-0 left-0 z-10 w-14 bg-gradient-to-r from-canvas-elevated to-transparent transition-opacity duration-200 ${edges.left ? 'opacity-100' : 'opacity-0'}`} />
      <button
        type="button" onClick={() => page(-1)} aria-label="Show previous KPIs"
        className={`${arrowBase} left-1 ${edges.left ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      >
        <ChevronLeft size={15} />
      </button>

      {/* Right edge fade + control */}
      <div className={`pointer-events-none absolute inset-y-0 right-0 z-10 w-14 bg-gradient-to-l from-canvas-elevated to-transparent transition-opacity duration-200 ${edges.right ? 'opacity-100' : 'opacity-0'}`} />
      <button
        type="button" onClick={() => page(1)} aria-label="Show more KPIs"
        className={`${arrowBase} right-1 ${edges.right ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      >
        <ChevronRight size={15} />
      </button>

      <div
        ref={ref}
        className="flex gap-2.5 overflow-x-auto snap-x snap-mandatory pb-1 -mb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tiles.map(({ def, series }) => (
          <div key={def.key} className="min-w-[168px] flex-1 snap-start">
            <KpiTrendTile def={def} series={series} />
          </div>
        ))}
      </div>
    </div>
  );
}

// One small "what changed" column — new / fixed / still-open.
function DiffColumn({
  Icon, label, count, tone, children,
}: {
  Icon: typeof Plus; label: string; count: number;
  tone: 'new' | 'fixed' | 'open'; children?: React.ReactNode;
}) {
  const tint =
    tone === 'new' ? 'border-mitigated-200 bg-mitigated-50/40'
    : tone === 'fixed' ? 'border-compliant/25 bg-compliant-50/25'
    : 'border-canvas-border bg-canvas/50';
  const head =
    tone === 'new' ? 'text-mitigated-700'
    : tone === 'fixed' ? 'text-compliant-700'
    : 'text-ink-500';
  return (
    <div className={`rounded-xl border p-2.5 ${tint}`}>
      <div className={`flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider ${head}`}>
        <Icon size={12} /> {label}
        <span className="ml-auto text-[13px] font-bold tabular-nums leading-none">{count}</span>
      </div>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

export function OutputComparePanel({
  compare = RUN_OUTPUT_COMPARE,
  entityLabel,
  onAction,
}: {
  compare?: OutputCompare;
  entityLabel?: string;
  onAction?: (query: string) => void;
}) {
  const entity = entityLabel
    ?? (STAGE3_CURRENT.insight.evidence[0]?.['Vendor Name']?.split(' ')[0]) // "MCKESSON"
    ?? 'this run';

  const history = compare.history ?? [];
  const priors = history.filter(r => !r.current);
  const current = history.find(r => r.current) ?? history[history.length - 1];
  const mostRecentPriorId = priors[priors.length - 1]?.id;

  // Default to the view the history honestly supports: with 2+ priors the card
  // opens in trend mode ("Across last 3 runs"); with one prior it falls back to
  // the 1-vs-1 delta. The analyst can still narrow to last-run in the selector.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(priors.slice(-2).map(r => r.id)),
  );

  const toggle = (id: string) => setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    if (next.size === 0 && mostRecentPriorId) next.add(mostRecentPriorId);
    return next;
  });
  const quick = (ids: string[]) => setSelectedIds(new Set(ids.length ? ids : (mostRecentPriorId ? [mostRecentPriorId] : [])));

  // Selected priors in chronological order + the current run = the series every
  // derivation reads (sparklines, headline copy, verdict, streak).
  const selectedPriors = priors.filter(p => selectedIds.has(p.id));
  const runs: RunSnapshot[] = current ? [...selectedPriors, current] : selectedPriors;
  const trend = selectedPriors.length >= 2;
  const kpiDefs = compare.kpiDefs ?? DEFAULT_KPI_DEFS;
  const seriesOf = (key: string) => runs.map(r => r.kpis[key] ?? 0);

  const workflowName = compare.previousRunLabel.split('—')[0].trim();
  const year = current?.date.match(/\d{4}/)?.[0] ?? '';

  // Descriptor — reflects the selection AND doubles as the dropdown trigger.
  const contiguousLastN = selectedPriors.length > 0 &&
    selectedPriors.every((p, i) => p.id === priors[priors.length - selectedPriors.length + i]?.id);
  const descriptor = !trend
    ? (selectedPriors[0]?.id === mostRecentPriorId ? 'Compared to last run' : `Compared to ${selectedPriors[0]?.month ?? 'a run'}`)
    : contiguousLastN ? `Across last ${runs.length} runs` : `Comparing ${runs.length} runs`;

  // Exceptions is the metric the verdict + headline hang on.
  const exc = seriesOf('exceptions');
  const excCur = exc[exc.length - 1] ?? 0;
  const excPrev = exc[exc.length - 2] ?? excCur;
  const excBase = exc[0] ?? excCur;
  const lastPct = excPrev ? Math.round(((excCur - excPrev) / excPrev) * 100) : 0;
  const windowPct = excBase ? Math.round(((excCur - excBase) / excBase) * 100) : 0;
  const dirWord = lastPct > 0 ? 'up' : lastPct < 0 ? 'down' : 'flat';

  // Consecutive runs the exceptions count rose / fell, latest-run backward.
  const streakLen = (cmp: (a: number, b: number) => boolean) => {
    let n = 0;
    for (let i = exc.length - 1; i > 0; i--) { if (cmp(exc[i], exc[i - 1])) n++; else break; }
    return n;
  };
  const risingRuns = streakLen((a, b) => a > b);
  const fallingRuns = streakLen((a, b) => a < b);

  // Verdict — weigh how the "lower is better" KPIs made their latest move.
  const moves = kpiDefs.filter(d => d.polarity !== 'neutral').map(d => {
    const s = seriesOf(d.key); return moveOf(d, s[s.length - 1], s[s.length - 2] ?? s[s.length - 1]).tone;
  });
  const verdict: Verdict = moves.filter(m => m === 'bad').length > moves.filter(m => m === 'good').length
    ? 'worse'
    : moves.filter(m => m === 'good').length > moves.filter(m => m === 'bad').length ? 'better' : 'same';
  const v = VERDICT[verdict];
  const streak =
    trend && verdict === 'worse' && risingRuns >= 2 ? ` · ${risingRuns} runs rising`
    : trend && verdict === 'better' && fallingRuns >= 2 ? ` · ${fallingRuns} runs falling`
    : '';

  const newCount = compare.newFindings.length;
  const takeaway = !trend
    ? (newCount > 0
        ? `A new ${entity} cluster appeared, and exceptions are ${dirWord} ${Math.abs(lastPct)}% since your last run.`
        : `No new clusters this run — exceptions are ${dirWord} ${Math.abs(lastPct)}% since your last run.`)
    : (risingRuns >= 2
        ? `Exceptions have climbed ${risingRuns} runs straight — ${int0(excCur)} now, up ${Math.abs(lastPct)}% on last run and ${Math.abs(windowPct)}% across the window.`
        : `Exceptions are ${dirWord} ${Math.abs(lastPct)}% on last run and ${windowPct >= 0 ? 'up' : 'down'} ${Math.abs(windowPct)}% across ${runs.length} runs.`);

  const showChronic = trend && runs.length >= 3 && (compare.chronicOpen ?? 0) > 0;

  // Recommended actions — derived from what actually moved this run, urgent
  // first, and rendered through the shared RecommendedActions surface so they
  // read identically to the other AI-insight cards.
  const resolvedCount = compare.resolvedFindings.length;
  const recs: RecItem[] = [
    ...(newCount > 0 ? [{
      id: 'cmp-new',
      title: `Triage the ${newCount === 1 ? 'new' : `${newCount} new`} ${entity} finding${newCount === 1 ? '' : 's'} before settlement — ${compare.newFindings[0].ref} ${compare.newFindings[0].detail.split('—')[0].trim()}.`,
    }] : []),
    ...(trend && risingRuns >= 2 ? [{
      id: 'cmp-rise',
      title: `Investigate the ${risingRuns}-run rise in exceptions — ${int0(excBase)} → ${int0(excCur)} across ${runs[0]?.month}–${current?.month}.`,
    }] : []),
    ...(showChronic ? [{
      id: 'cmp-chronic',
      title: `Clear the ${compare.chronicOpen} chronic items open across 3+ runs — they aren't resolving on their own.`,
    }] : []),
    ...(resolvedCount > 0 ? [{
      id: 'cmp-fixed',
      title: `Confirm the ${resolvedCount} fixed item${resolvedCount === 1 ? '' : 's'} stay closed on the next run.`,
    }] : []),
    ...(!showChronic ? [{
      id: 'cmp-open',
      title: `Spot-check the ${compare.carriedOver} still-open items carried over from before.`,
    }] : []),
  ];

  // Evidence — the runs in view (newest first), the raw material behind the
  // comparison, in the shared Source/Item/Detail table (collapsed by default).
  const evidence: EvidenceRow[] = [...runs].reverse().map(r => ({
    ref: r.date,
    label: `${r.label}${r.current ? ' · this run' : ''} — ${int0(r.kpis.exceptions)} exceptions`,
    detail: `${usd2(r.kpis.underRecovered)} under-recovered`,
  }));

  const checkMore: CheckMoreOption[] = trend
    ? [
        { kind: 'compare', label: 'Compare run-over-run' },
        { kind: 'ask', label: risingRuns >= 2 ? 'Ask why exceptions keep rising' : 'Ask what changed across these runs' },
      ]
    : [
        { kind: 'compare', label: 'Compare line by line vs last run' },
        { kind: 'ask', label: 'Ask what drove the change' },
      ];
  const onCheckMore = onAction
    ? (opt: CheckMoreOption) => onAction(opt.detail ? `${opt.label} — ${opt.detail}` : opt.label)
    : undefined;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-2xl border border-canvas-border bg-canvas-elevated overflow-hidden"
    >
      <div className="p-4">
        {/* Header — run selector (doubles as the descriptor) + AI chip + verdict */}
        <div className="flex items-center gap-2">
          {history.length > 0 ? (
            <RunSelector
              priors={priors.map(r => ({ id: r.id, label: r.label, date: r.date, meta: int0(r.kpis.exceptions) }))}
              current={current ? { id: current.id, label: current.label, date: current.date, meta: int0(current.kpis.exceptions) } : undefined}
              selectedIds={selectedIds}
              descriptor={descriptor} onToggle={toggle} onQuick={quick} />
          ) : (
            <>
              <span className="size-6 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
                <GitCompareArrows size={13} />
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-700">Compared to last run</span>
            </>
          )}
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 text-brand-700 px-2 py-0.5 text-[10px] font-bold border border-brand-100">
            <Sparkles size={10} /> AI Insight
          </span>
          <span className={`ml-auto inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${v.cls}`}>
            <v.Icon size={11} /> {v.label}{streak}
          </span>
        </div>

        {/* Takeaway */}
        <h4 className="text-[15px] font-bold text-ink-900 leading-snug mt-2.5">{takeaway}</h4>
        <p className="text-[11.5px] text-ink-400 mt-1">
          {!trend
            ? <>vs <span className="font-medium text-ink-600">{selectedPriors[0]?.label ?? compare.previousRunLabel}</span> · {selectedPriors[0]?.date ?? compare.previousRunDate}</>
            : <>trend of <span className="font-medium text-ink-600">{workflowName}</span> · {runs[0]?.month}–{current?.month} {year}</>}
        </p>

        {/* How the KPIs moved / are trending — morphs between delta tiles and
            a scroll-snap row of sparkline tiles (3-up when the column is wide,
            scrolls when the workspace panel narrows it / on mobile). */}
        <div className="mt-3 rounded-xl border border-canvas-border bg-canvas/40 p-3">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">{trend ? 'How the KPIs are trending' : 'How the KPIs moved'}</span>
            <span className="text-[10px] text-ink-300">{trend ? `line = last ${runs.length} runs` : 'bar = size of change'}</span>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={trend ? 'trend' : 'delta'}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              {trend ? (
                <TrendKpiRow tiles={kpiDefs.map(def => ({ def, series: seriesOf(def.key) }))} />
              ) : (
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {(() => {
                    const prevRun = selectedPriors[0] ?? current;
                    const maxAbsPct = Math.max(1, ...kpiDefs.map(def => {
                      const p = prevRun?.kpis[def.key] ?? 0, c = current?.kpis[def.key] ?? 0;
                      return p ? Math.abs(Math.round(((c - p) / p) * 100)) : 0;
                    }));
                    return kpiDefs.map(def => (
                      <KpiDeltaTile key={def.key} def={def} prev={prevRun?.kpis[def.key] ?? 0} cur={current?.kpis[def.key] ?? 0} maxAbsPct={maxAbsPct} />
                    ));
                  })()}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* What's new / fixed / still open */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
          <DiffColumn Icon={Plus} label="New" count={newCount} tone="new">
            {newCount > 0 ? (
              <ul className="space-y-1.5">
                {compare.newFindings.map((f) => (
                  <li key={f.ref} className="text-[11.5px] text-ink-700 leading-snug">
                    <span className="font-mono text-[10px] text-mitigated-700">{f.ref}</span>
                    <span className="block text-ink-600">{f.detail}</span>
                    {trend && (
                      <span className="mt-1 inline-flex items-center rounded bg-mitigated-100 text-mitigated-700 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide">1st run seen</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : <p className="text-[11.5px] text-ink-400">Nothing new.</p>}
          </DiffColumn>

          <DiffColumn Icon={Check} label="Fixed" count={compare.resolvedFindings.length} tone="fixed">
            {compare.resolvedFindings.length > 0 ? (
              <ul className="space-y-1">
                {compare.resolvedFindings.map((f) => (
                  <li key={f.ref} className="text-[11.5px] text-ink-600 leading-snug">
                    <span className="font-mono text-[10px] text-compliant-700">{f.ref}</span>
                    <span className="block line-through decoration-ink-300">{f.detail}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-[11.5px] text-ink-400">None cleared.</p>}
          </DiffColumn>

          <DiffColumn Icon={Layers} label="Still open" count={compare.carriedOver} tone="open">
            <p className="text-[11.5px] text-ink-500 leading-snug">
              {trend
                ? 'carried over from before, still unresolved.'
                : <>known item{compare.carriedOver === 1 ? '' : 's'} carried over from before, still unresolved.</>}
            </p>
            {showChronic && (
              <span className="mt-1.5 inline-flex items-center gap-1 rounded bg-risk-50 text-risk px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide">
                {compare.chronicOpen} chronic · 3+ runs
              </span>
            )}
          </DiffColumn>
        </div>

        {/* Evidence (collapsed by default) then the recommended actions —
            the same two shared surfaces the other AI-insight cards use. */}
        <EvidenceDisclosure
          className="mt-3"
          evidence={evidence}
          label="Evidence · runs in view"
          checkMore={checkMore}
          onCheckMore={onCheckMore}
        />
        <RecommendedActions
          className="mt-2.5"
          recs={recs}
          onOpen={(title) => onAction?.(title)}
        />

        {/* Signal back — same row, same place, same language as every other
            insight card. Keyed on the runs actually in view: change the
            selection and the comparison is a different claim, so the previous
            rating no longer applies to what's on screen. */}
        <InsightFeedback insightId={`output-compare:${runs.map(r => r.id).join('+')}`} />
      </div>
    </motion.section>
  );
}

// ─── 2. Cross-workflow correlation ────────────────────────────────────────

const STAGE3_SEV: Record<Stage3Record['insight']['severity'], LayeredInsight['severity']> = {
  high: 'high', medium: 'med', low: 'low',
};
const STAGE3_TONE: Record<Stage3Record['insight']['severity'], VerdictTone> = {
  high: 'negative', medium: 'caution', low: 'positive',
};

// A one-line "why it flagged" from a record's own evidence — dominant remark +
// where it hit. No bespoke summary field needed.
function detailFor(rec: Stage3Record): string {
  const rows = rec.insight.evidence;
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r['Exception Remark'], (counts.get(r['Exception Remark']) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'flagged';
  const contracts = [...new Set(rows.map((r) => r['Contract Ref Id']))];
  const where = contracts.length === 1 ? ` · ${contracts[0]}` : contracts.length > 1 ? ` · ${contracts.length} contracts` : '';
  return `${top}${where}`;
}

const sumPaid = (rec: Stage3Record) =>
  rec.insight.evidence.reduce((s, r: Stage3EvidenceRow) => s + (r['Chargeback Paid'] ?? 0), 0);

const fmtMoney = (n: number | null): string => (n == null ? '—' : `$${n.toFixed(2)}`);

// Collapsible sampled-rows table — the exception rows behind the correlation
// (Product · Contract · Exception · Paid · WAC · Contract $ · Revised · Diff),
// with a leading Source column so the same entity's rows read across the
// different checks that flagged it. Nests inside the LayeredInsightCard's
// evidence drill-down, one level deeper than the per-run evidence rows.
function CorrelationEvidenceTable({
  rows,
  checks,
}: {
  rows: { row: Stage3EvidenceRow; workflow: string }[];
  checks: number;
}) {
  const [open, setOpen] = useState(false);
  if (rows.length === 0) return null;
  return (
    <div className="mt-3 rounded-lg border border-canvas-border bg-canvas/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-3 py-2 text-left cursor-pointer hover:bg-canvas transition-colors"
      >
        <ScrollText size={13} className="text-ink-400" />
        <span className="text-[11px] font-semibold text-ink-800">Sampled rows</span>
        <span className="text-[10px] text-ink-400">{rows.length} rows across {checks} checks</span>
        <ChevronDown size={13} className={`ml-auto text-ink-400 transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 border-t border-canvas-border/60">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-[10.5px] border-collapse">
                  <thead>
                    <tr className="text-ink-400">
                      <th className="text-left font-semibold uppercase tracking-wider py-1 pr-2">Source</th>
                      <th className="text-left font-semibold uppercase tracking-wider py-1 pr-2">Product</th>
                      <th className="text-left font-semibold uppercase tracking-wider py-1 pr-2">Contract</th>
                      <th className="text-left font-semibold uppercase tracking-wider py-1 pr-2">Exception</th>
                      <th className="text-right font-semibold uppercase tracking-wider py-1 pr-2">Paid</th>
                      <th className="text-right font-semibold uppercase tracking-wider py-1 pr-2">WAC</th>
                      <th className="text-right font-semibold uppercase tracking-wider py-1 pr-2">Contract $</th>
                      <th className="text-right font-semibold uppercase tracking-wider py-1 pr-2">Revised</th>
                      <th className="text-right font-semibold uppercase tracking-wider py-1">Diff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ row: r, workflow }, i) => {
                      const diff = r['Chargeback Difference'];
                      return (
                        <tr key={i} className="border-t border-canvas-border/60 align-top">
                          <td className="py-1.5 pr-2">
                            <span className="inline-flex items-center rounded-md bg-brand-50 text-brand-700 px-1.5 py-0.5 text-[9.5px] font-semibold whitespace-nowrap">
                              {workflow}
                            </span>
                          </td>
                          <td className="py-1.5 pr-2 text-ink-800 font-medium max-w-[180px]">
                            {r['Product Name']}
                            <span className="block font-mono text-ink-400 text-[9.5px]">{r['Product Ref Id']}</span>
                          </td>
                          <td className="py-1.5 pr-2 font-mono text-ink-500 whitespace-nowrap">{r['Contract Ref Id']}</td>
                          <td className="py-1.5 pr-2 text-ink-600">{r['Exception Remark']}</td>
                          <td className="py-1.5 pr-2 text-right tabular-nums text-ink-700">{fmtMoney(r['Chargeback Paid'])}</td>
                          <td className="py-1.5 pr-2 text-right tabular-nums text-ink-700">{fmtMoney(r['WAC Price Per Master'])}</td>
                          <td className="py-1.5 pr-2 text-right tabular-nums text-ink-700">{fmtMoney(r['Contract Price Per Master'])}</td>
                          <td className="py-1.5 pr-2 text-right tabular-nums text-ink-700">{fmtMoney(r['Revised Chargeback Amount'])}</td>
                          <td className={`py-1.5 text-right tabular-nums font-semibold ${diff != null && diff < 0 ? 'text-risk' : 'text-ink-500'}`}>
                            {diff != null ? diff.toFixed(2) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="text-[10px] text-ink-400 mt-1.5">Sampled exception rows · dollar amounts</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function CrossWorkflowCorrelationPanel({
  current = STAGE3_CURRENT,
  correlated = correlatedRecords(STAGE3_CURRENT),
  onAction,
}: {
  current?: Stage3Record;
  correlated?: Stage3Record[];
  onAction?: (query: string) => void;
}) {
  const displayName = current.insight.evidence[0]?.['Vendor Name'] ?? current.insight.entity_key.toUpperCase();
  const shortName = displayName.split(' ')[0];
  const watch = ENTITY_MEMORY[displayName];
  const watchEntry = ENTERPRISE_CONTEXT.find((e) => e.fact.toUpperCase().includes(shortName.toUpperCase()));

  // What flagged it in THIS run — prefer the authored lead-insight KPI, else a
  // derived remark line.
  const lead = PROCESS_INSIGHTS.find((i) => i.scope === current.workflow);
  const currentRunFlag = lead?.evidence.kpiValues?.[0]?.value
    ? `${lead.evidence.kpiValues[0].value} exceptions in this run`
    : detailFor(current);

  const allRecords = [current, ...correlated];
  const checks = new Set(allRecords.map((r) => r.workflow)).size;
  const totalPaid = allRecords.reduce((s, r) => s + sumPaid(r), 0);
  // Sampled exception rows across every check that flagged the entity — the
  // evidence behind the correlation, tagged with the workflow they came from.
  const evidenceRows = allRecords.flatMap((rec) =>
    rec.insight.evidence.map((row) => ({ row, workflow: rec.workflow })),
  );
  const entityType = current.insight.entity_type;

  const insight: LayeredInsight = {
    id: `xwf-${current.insight.entity_key.replace(/\s+/g, '-')}`,
    layer: 'control',
    subjectId: current.insight.entity_key,
    subjectLabel: displayName,
    takeaway: watch?.onWatch
      ? `${shortName} shows up in ${checks} different checks — and it's already on a watchlist.`
      : `${shortName} shows up in ${checks} different checks, not just this one.`,
    verdict:
      checks >= 3 ? { label: 'Strong pattern', tone: 'negative' }
      : checks === 2 ? { label: 'Moderate pattern', tone: 'caution' }
      : { label: 'Emerging pattern', tone: 'caution' },
    severity: STAGE3_SEV[current.insight.severity],
    likelyCause: watch?.onWatch
      ? {
          label: `${displayName} is already on a standing watch${watchEntry ? ` — since ${watchEntry.approvedOn}` : ''}.`,
          detail: `${watch.watchNote ? `${watch.watchNote} ` : ''}The same ${entityType} failing ${checks} unrelated checks points at one upstream driver, not ${checks} coincidences.`,
        }
      : {
          label: 'One upstream driver, not check-specific noise.',
          detail: `The same ${entityType} failing ${checks} unrelated checks points at a shared upstream cause. Confirm against the ${entityType} master before concluding.`,
        },
    reasoning: `The ${checks} checks flag one ${entityType}, not ${checks} separate problems. This run's ${shortName} exceptions overlap the ${correlated.length} earlier run${correlated.length === 1 ? '' : 's'}, so memory counts the pattern once — it is not new noise.`,
    atStake: `${usd0(totalPaid)} flagged across sampled rows in ${checks} checks — sampled rows only, the full population is larger. This run: ${currentRunFlag}.`,
    factors: { frequency: 0.72, sourceDiversity: 0.9, recency: 0.96, businessImpact: 0.7 },
    confidenceOverride: current.insight.confidence,
    evidence: [
      {
        ref: current.runDate,
        label: `${current.workflow} — this run · ${currentRunFlag}`,
        detail: `${Math.round(current.insight.confidence * 100)}%`,
        tone: STAGE3_TONE[current.insight.severity],
      },
      ...correlated.map((rec) => ({
        ref: rec.runDate,
        label: `${rec.workflow} — ${detailFor(rec)}`,
        detail: `${Math.round(rec.insight.confidence * 100)}%`,
        tone: STAGE3_TONE[rec.insight.severity],
      })),
    ],
    evidenceNote: `${evidenceRows.length} sampled rows across ${checks} checks · entity correlation, not yet a confirmed shared root cause.`,
    runsAnalysed: allRecords.length,
    detectedOn: current.runDate,
    detectedBy: 'traceable',
    rollupOf: { label: 'checks', count: checks },
    checkMore: [
      { kind: 'trace', label: `Open a cross-workflow review of ${shortName}` },
      { kind: 'compare', label: 'Compare how each check scored it' },
      { kind: 'ask', label: watch?.onWatch ? 'Ask what changed since it went on watch' : 'Ask whether these share a root cause' },
    ],
    recommendedActions: [],
    recommendations: [
      {
        id: 'xwf-rec-review', category: 'monitoring', priority: 'do-now',
        title: `Open a cross-workflow review of ${displayName}.`,
        rationale: `${checks} checks flagging one ${entityType} is a concentration — review them together before grading each finding alone.`,
      },
      {
        id: 'xwf-rec-aggregate', category: 'deficiency', priority: 'this-period',
        title: `Aggregate the ${checks} findings by assertion before grading severity.`,
        rationale: 'Findings that share an entity can aggregate to a higher severity than any single check suggests.',
        guardrail: 'Severity stays a human call.',
      },
      {
        id: 'xwf-rec-cause', category: 'root-cause', priority: 'this-period',
        title: `Confirm whether all ${checks} checks trace to the same ${entityType} master data.`,
        rationale: 'If one feed drives them all, one fix clears them together — and grading them separately overstates the population.',
      },
      ...(watch?.onWatch && correlated.length > 0
        ? [{
            id: 'xwf-rec-watch', category: 'monitoring' as const, priority: 'advisory' as const,
            title: `Extend the standing watch to cover the other ${correlated.length} check${correlated.length === 1 ? '' : 's'} that flagged it.`,
            rationale: 'The watch predates this run; the correlation shows the exposure is wider than the check it was raised on.',
          }]
        : []),
    ],
  };

  return (
    <LayeredInsightCard
      insight={insight}
      headerLabel="across workflows"
      evidenceLabel="Evidence · runs across checks"
      evidenceExtra={<CorrelationEvidenceTable rows={evidenceRows} checks={checks} />}
      onCheckMore={onAction ? (opt) => onAction(opt.detail ? `${opt.label} — ${opt.detail}` : opt.label) : undefined}
      onRec={onAction}
    />
  );
}

// ─── Composed band ────────────────────────────────────────────────────────
// The two cards together, under one "memory looked beyond this run" heading —
// dropped into the executor's follow-up region above the composer.

export default function WorkflowFollowUpInsights({
  onAction,
}: {
  onAction?: (query: string) => void;
  /** Drives which KPI set the (currently parked) output-compare card trends —
   *  kept in the signature so call sites stay stable while the card is parked. */
  workflowId?: string;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.3 }}
      className="mt-5 flex flex-col gap-3"
    >
      <div className="flex items-center gap-2">
        <span className="size-6 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center">
          <Brain size={13} />
        </span>
        <h3 className="text-[13px] font-bold text-ink-800">Ira looked beyond this run</h3>
      </div>

      <div className="flex flex-col gap-3">
        {/* Output-compare card — PARKED, not retired: the run-output insight's
            trajectory band now covers this surface's job here, but the panel
            may move to another surface. To bring it back, destructure
            `workflowId` above and render:

        <OutputComparePanel compare={compareForWorkflow(workflowId)} onAction={onAction} />
        */}
        <CrossWorkflowCorrelationPanel onAction={onAction} />
      </div>
    </motion.section>
  );
}
