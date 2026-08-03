// ─── Run Trajectory Band — the cross-run trend inside a single-output card ──
//
// Renders the honesty ladder from the AI-Insights PRD (§9 "no fake sparklines"):
//
//   1 point   → a quiet first-run note — the card claims nothing cross-run.
//   2 points  → a DELTA: previous → current, never drawn as a line.
//   3+ points → the full band: real-run sparkline, last-move + window delta
//               chips, a streak badge in run language ("3 runs rising"), and
//               the entity-recurrence dot strip (PRD §3.1).
//
// Every point is a stored run — no interpolation, no smoothing — so presence
// of the band is itself information. One anchor metric only: multi-KPI
// trending stays in the output-compare card, which is the analyst workbench.
//
// Presentational only. The caller supplies insight.trajectory (built from run
// history); readTrajectory keeps the band, the takeaway copy and any derived
// recommendation quoting the same numbers.

import { useState, type ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { readTrajectory, type RunTrajectory } from '../../data/layeredInsights';
import type { KpiFormat } from '../../data/insightMemory';
import RunSelector from './RunSelector';

const int0 = (n: number) => Math.round(n).toLocaleString('en-US');
const usd2 = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const FMT: Record<KpiFormat, (n: number) => string> = { int: int0, usd2 };

// Same tone → colour mapping the output-compare card uses, so a rising
// exceptions line reads identically on both surfaces.
const TONE_TEXT = { bad: 'text-risk-400', good: 'text-compliant-500', neutral: 'text-brand-400' } as const;
const CHIP_CLS = { bad: 'text-risk bg-risk-50', good: 'text-compliant-700 bg-compliant-50', neutral: 'text-ink-500 bg-canvas' } as const;

type Tone = keyof typeof TONE_TEXT;
type Dir = 'up' | 'down' | 'flat';

const DirIcon = ({ dir, size }: { dir: Dir; size: number }) =>
  dir === 'up' ? <TrendingUp size={size} aria-hidden="true" />
  : dir === 'down' ? <TrendingDown size={size} aria-hidden="true" />
  : <Minus size={size} aria-hidden="true" />;

// ─── The chart — line as stretched SVG, dots/labels as HTML overlays ────────
// The path stretches with the container (non-scaling stroke keeps it crisp);
// dots, value labels, months and the tooltip are HTML positioned in % so they
// never distort and stay hoverable without SVG hit-testing.

const CHART_H = 96;
const PAD_T = 20;
const PAD_B = 10;

function TrajectoryChart({ trajectory, tone }: { trajectory: RunTrajectory; tone: Tone }) {
  const [hover, setHover] = useState<number | null>(null);
  const pts = trajectory.points;
  const vals = pts.map(p => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const fmt = FMT[trajectory.format];

  const xPct = (i: number) => (pts.length === 1 ? 50 : (i / (pts.length - 1)) * 100);
  const yPx = (v: number) => PAD_T + (1 - (v - min) / span) * (CHART_H - PAD_T - PAD_B);
  const clampX = (i: number) => `min(max(${xPct(i)}%, 16px), calc(100% - 16px))`;

  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${xPct(i).toFixed(2)},${yPx(p.value).toFixed(1)}`).join(' ');
  const area = `${line} L100,${CHART_H - PAD_B} L0,${CHART_H - PAD_B} Z`;
  const hovered = hover != null ? pts[hover] : null;
  const hoveredPrev = hover != null && hover > 0 ? pts[hover - 1] : null;

  return (
    <div className="min-w-0">
      <div className="relative mx-1" style={{ height: CHART_H }}>
        <svg
          viewBox={`0 0 100 ${CHART_H}`}
          preserveAspectRatio="none"
          className={`absolute inset-0 h-full w-full ${TONE_TEXT[tone]}`}
          aria-hidden="true"
        >
          {/* faint bounds at the window's min and max */}
          <line x1={0} x2={100} y1={yPx(max)} y2={yPx(max)} stroke="currentColor" strokeWidth={1} strokeDasharray="2 4" opacity={0.18} vectorEffect="non-scaling-stroke" />
          <line x1={0} x2={100} y1={yPx(min)} y2={yPx(min)} stroke="currentColor" strokeWidth={1} strokeDasharray="2 4" opacity={0.18} vectorEffect="non-scaling-stroke" />
          <path d={area} fill="currentColor" opacity={0.08} />
          <path d={line} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>

        {/* run dots — real points only, current emphasized with a soft halo */}
        {pts.map((p, i) => (
          <span key={p.runId} className="contents">
            {p.current && (
              <span
                aria-hidden="true"
                className={`absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current opacity-20 ${TONE_TEXT[tone]}`}
                style={{ left: `${xPct(i)}%`, top: yPx(p.value) }}
              />
            )}
            <button
              type="button"
              aria-label={`${p.label}${p.current ? ' (this run)' : ''} — ${fmt(p.value)} ${trajectory.metricLabel.toLowerCase()}`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full cursor-default ${TONE_TEXT[tone]} ${
                p.current ? 'size-3 bg-current' : 'size-[9px] border-2 border-current bg-canvas-elevated'
              }`}
              style={{ left: `${xPct(i)}%`, top: yPx(p.value) }}
            />
          </span>
        ))}

        {/* endpoint value labels — the chart reads without hovering */}
        <span
          className="absolute -translate-x-1/2 whitespace-nowrap font-mono text-[0.625rem] text-ink-400"
          style={{ left: clampX(0), top: yPx(pts[0].value) - 22 }}
        >
          {fmt(pts[0].value)}
        </span>
        <span
          className="absolute -translate-x-1/2 whitespace-nowrap font-mono text-[0.6875rem] font-bold text-ink-900"
          style={{ left: clampX(pts.length - 1), top: yPx(pts[pts.length - 1].value) - 24 }}
        >
          {fmt(pts[pts.length - 1].value)}
        </span>

        {/* tooltip — names the run, its value, and the move that produced it */}
        {hovered && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-ink-900 px-2.5 py-1.5 text-[0.65625rem] leading-snug text-canvas-elevated shadow-lg"
            style={{ left: clampX(hover!), top: yPx(hovered.value) - 10 }}
          >
            <span className="font-mono font-bold">{fmt(hovered.value)}</span> {trajectory.metricLabel.toLowerCase()} · {hovered.label}
            {hovered.current ? ' · this run' : ''}
            <span className="block text-canvas-elevated/70">
              {hoveredPrev
                ? `${hovered.value >= hoveredPrev.value ? '+' : ''}${hoveredPrev.value ? Math.round(((hovered.value - hoveredPrev.value) / hoveredPrev.value) * 100) : 0}% vs ${hoveredPrev.month} · ${hovered.date}`
                : hovered.date}
            </span>
          </div>
        )}
      </div>

      {/* month axis — bold marks the run being viewed */}
      <div className="relative mx-1 mt-1 h-4">
        {pts.map((p, i) => (
          <span
            key={p.runId}
            className={`absolute font-mono text-[0.625rem] ${p.current ? 'font-bold text-ink-600' : 'text-ink-400'} ${
              i === 0 ? '' : i === pts.length - 1 ? '-translate-x-full' : '-translate-x-1/2'
            }`}
            style={{ left: `${xPct(i)}%` }}
          >
            {p.month}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Rung 3 — the full trend band (3+ runs in view) ─────────────────────────

function TrendBand({ trajectory, selector, className }: { trajectory: RunTrajectory; selector?: ReactNode; className?: string }) {
  const r = readTrajectory(trajectory);
  const pts = trajectory.points;
  const fmt = FMT[trajectory.format];
  const year = pts[pts.length - 1].date.match(/\d{4}/)?.[0] ?? '';
  const flaggedCount = trajectory.flaggedRuns?.filter(Boolean).length ?? 0;
  const windowDir: Dir = r.windowPct > 0 ? 'up' : r.windowPct < 0 ? 'down' : 'flat';

  return (
    <div className={`rounded-xl border border-canvas-border bg-canvas/40 p-3.5 ${className ?? ''}`}>
      {/* header — run selector (doubles as the descriptor) · pattern chip · honest scope */}
      <div className="flex flex-wrap items-center gap-2">
        {selector ?? <span className="text-[0.625rem] font-bold uppercase tracking-wider text-ink-400">Across runs</span>}
        {r.streak >= 2 && (
          <span className="inline-flex items-center rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[0.625rem] font-bold text-brand-700">
            KPI trend drift
          </span>
        )}
        <span className="ml-auto text-[0.65625rem] text-ink-400 tabular-nums">
          {pts[0].month} – {pts[pts.length - 1].month} {year}
        </span>
      </div>

      <div className="mt-2.5 grid items-center gap-x-6 gap-y-3 lg:grid-cols-[minmax(0,1fr)_218px]">
        <TrajectoryChart trajectory={trajectory} tone={r.tone} />

        {/* the reading — hero value, both deltas, the streak */}
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[1.625rem] font-bold leading-none tracking-tight text-ink-900 tabular-nums">{fmt(r.current)}</span>
            <span className="text-[0.6875rem] font-semibold text-ink-500">{trajectory.unitLabel}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {r.direction !== 'flat' && (
              <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.65625rem] font-bold ${CHIP_CLS[r.tone]}`}>
                <DirIcon dir={r.direction} size={10} />{r.lastPct > 0 ? '+' : ''}{r.lastPct}%
                <span className="font-medium opacity-80">vs last run</span>
              </span>
            )}
            {windowDir !== 'flat' && (
              <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.65625rem] font-bold ${CHIP_CLS[r.tone]}`}>
                <DirIcon dir={windowDir} size={10} />{r.windowPct > 0 ? '+' : ''}{r.windowPct}%
                <span className="font-medium opacity-80">since {pts[0].month}</span>
              </span>
            )}
          </div>
          {r.streak >= 2 && (
            <span className={`inline-flex items-center gap-1 text-[0.6875rem] font-bold ${r.tone === 'bad' ? 'text-risk' : r.tone === 'good' ? 'text-compliant-700' : 'text-ink-500'}`}>
              <DirIcon dir={r.direction} size={11} /> {r.streak} runs {r.direction === 'up' ? 'rising' : 'falling'}
            </span>
          )}
        </div>
      </div>

      {/* entity recurrence — the §3.1 story, independent of the KPI line */}
      {trajectory.entityLabel && trajectory.flaggedRuns && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-dashed border-canvas-border pt-2.5">
          <span className="text-[0.71875rem] text-ink-600">
            <span className="font-semibold text-ink-900">{trajectory.entityLabel}</span> flagged in{' '}
            <span className="font-semibold text-ink-900 tabular-nums">{flaggedCount} of {pts.length}</span> runs
          </span>
          <span className="inline-flex gap-1" aria-hidden="true">
            {trajectory.flaggedRuns.map((f, i) => (
              <span
                key={pts[i]?.runId ?? i}
                title={`${pts[i]?.label ?? ''} — ${f ? 'flagged' : 'not flagged'}`}
                className={`size-2 rounded-full ${f ? 'bg-risk-400' : 'border border-ink-300 bg-transparent'}`}
              />
            ))}
          </span>
          {flaggedCount >= 3 && (
            <span className="text-[0.59375rem] font-bold uppercase tracking-wider text-ink-400">Recurring output anomaly</span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Rung 2 — two runs make a delta, never a trend ──────────────────────────

function DeltaBand({ trajectory, selector, honestyNote, className }: {
  trajectory: RunTrajectory; selector?: ReactNode; honestyNote?: string; className?: string;
}) {
  const r = readTrajectory(trajectory);
  const [prev, cur] = trajectory.points;
  const fmt = FMT[trajectory.format];
  const year = cur.date.match(/\d{4}/)?.[0] ?? '';
  const toCls = r.tone === 'bad' ? 'to-risk-400' : r.tone === 'good' ? 'to-compliant-500' : 'to-brand-300';

  return (
    <div className={`rounded-xl border border-canvas-border bg-canvas/40 p-3.5 ${className ?? ''}`}>
      <div className="flex flex-wrap items-center gap-2">
        {selector ?? <span className="text-[0.625rem] font-bold uppercase tracking-wider text-ink-400">Vs last run</span>}
        <span className="ml-auto text-[0.65625rem] text-ink-400 tabular-nums">{prev.month} – {cur.month} {year}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-5">
        <div className="text-center">
          <div className="font-mono text-[1.375rem] font-semibold leading-none text-ink-500 tabular-nums">{fmt(prev.value)}</div>
          <div className="mt-1 text-[0.65625rem] text-ink-400">{prev.label} · {prev.date}</div>
        </div>
        <div className="flex min-w-[96px] flex-1 flex-col items-center gap-1.5">
          {r.direction !== 'flat' ? (
            <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.65625rem] font-bold ${CHIP_CLS[r.tone]}`}>
              <DirIcon dir={r.direction} size={10} />
              {r.lastDelta > 0 ? '+' : ''}{fmt(r.lastDelta)} · {r.lastPct > 0 ? '+' : ''}{r.lastPct}%
            </span>
          ) : (
            <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.65625rem] font-bold ${CHIP_CLS.neutral}`}>
              <Minus size={10} aria-hidden="true" /> unchanged
            </span>
          )}
          <div className={`relative h-0.5 w-full rounded-full bg-gradient-to-r from-ink-300 ${toCls}`}>
            <span className={`absolute -right-px top-1/2 size-[7px] -translate-y-1/2 rounded-full ${r.tone === 'bad' ? 'bg-risk-400' : r.tone === 'good' ? 'bg-compliant-500' : 'bg-brand-300'}`} />
          </div>
        </div>
        <div className="text-center">
          <div className="font-mono text-[1.5rem] font-bold leading-none text-ink-900 tabular-nums">{fmt(cur.value)}</div>
          <div className="mt-1 text-[0.65625rem] text-ink-400">{cur.label} · this run</div>
        </div>
      </div>
      <p className="mt-2.5 text-[0.65625rem] text-ink-400">
        {honestyNote ?? 'Two runs make a delta, not a trend — the line and streak unlock on the 3rd run.'}
      </p>
    </div>
  );
}

// ─── Rung 1 — first run: say so quietly, claim nothing ──────────────────────

function FirstRunNote({ className }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-baseline gap-2.5 rounded-xl border border-dashed border-canvas-border px-3.5 py-3 ${className ?? ''}`}>
      <span className="shrink-0 text-[0.625rem] font-bold uppercase tracking-wider text-ink-400">Across runs</span>
      <p className="min-w-0 text-[0.75rem] leading-snug text-ink-500">
        First run analysed — nothing to compare yet. This card claims only what this run shows;
        trend analysis appears automatically once two prior runs exist.
      </p>
    </div>
  );
}

// ─── Public surface ──────────────────────────────────────────────────────────
// Owns the run-window selection: the current run is the fixed anchor; the user
// picks which prior runs to compare it with (all priors by default — the full
// stored window the card's claim rests on). The selection decides the rung:
// one prior in view → delta, two or more → trend. At least one prior stays
// selected; the honesty ladder still caps what the visual may claim.

export default function RunTrajectoryBand({ trajectory, className }: { trajectory: RunTrajectory; className?: string }) {
  const all = trajectory.points;
  const current = all.find(p => p.current) ?? all[all.length - 1];
  const priors = all.filter(p => p !== current);
  const mostRecentPriorId = priors[priors.length - 1]?.runId;
  const fmt = FMT[trajectory.format];

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(priors.map(p => p.runId)));

  if (all.length === 0) return null;
  if (all.length === 1) return <FirstRunNote className={className} />;

  const toggle = (id: string) => setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    if (next.size === 0 && mostRecentPriorId) next.add(mostRecentPriorId);
    return next;
  });
  const quick = (ids: string[]) => setSelectedIds(new Set(ids.length ? ids : (mostRecentPriorId ? [mostRecentPriorId] : [])));

  // Runs in view = selected priors (chronological) + the fixed current anchor.
  // flaggedRuns is parallel to points, so it filters with the same mask.
  const mask = all.map(p => p === current || selectedIds.has(p.runId));
  const inView: RunTrajectory = {
    ...trajectory,
    points: all.filter((_, i) => mask[i]),
    flaggedRuns: trajectory.flaggedRuns?.filter((_, i) => mask[i]),
  };
  const selectedPriors = inView.points.filter(p => p !== current);

  // Descriptor — names the selection AND doubles as the dropdown trigger.
  const contiguousLastN = selectedPriors.length > 0 &&
    selectedPriors.every((p, i) => p.runId === priors[priors.length - selectedPriors.length + i]?.runId);
  const descriptor = selectedPriors.length === 1
    ? (selectedPriors[0].runId === mostRecentPriorId ? 'Vs last run' : `Vs ${selectedPriors[0].month} run`)
    : contiguousLastN ? `Across last ${inView.points.length} runs` : `Comparing ${inView.points.length} runs`;

  const selector = (
    <RunSelector
      priors={priors.map(p => ({ id: p.runId, label: p.label, date: p.date, meta: fmt(p.value) }))}
      current={{ id: current.runId, label: current.label, date: current.date, meta: fmt(current.value) }}
      selectedIds={selectedIds}
      descriptor={descriptor}
      onToggle={toggle}
      onQuick={quick}
    />
  );

  if (selectedPriors.length >= 2) return <TrendBand trajectory={inView} selector={selector} className={className} />;
  return (
    <DeltaBand
      trajectory={inView}
      selector={selector}
      honestyNote={priors.length >= 2
        ? 'Two runs in view give a delta, not a trend — add another prior run to draw the line.'
        : 'Two runs make a delta, not a trend — the line and streak unlock on the 3rd stored run.'}
      className={className}
    />
  );
}
