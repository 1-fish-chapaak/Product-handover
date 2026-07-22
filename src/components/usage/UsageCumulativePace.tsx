/**
 * Platform Usage — Overview's pace chart: this period's running total against
 * last period's, so the reader can see whether the work is running ahead or
 * behind the pace it kept last time.
 *
 * Why this is not the hero Activity chart's Compare toggle. That overlay draws
 * last period's DAILY line against this period's daily bars. Day-by-day, a
 * licence-sized team's counts jump around too much to read a trend off — one
 * quiet Monday and the two lines cross. Cumulative is the honest way to answer
 * "are we ahead": each line only ever climbs, so the gap between them is the
 * whole story and it never flickers. The four-trend band shows THIS period's
 * running total on its own; the one thing it cannot show is the comparison, and
 * that is the only thing this chart adds.
 *
 * No invented baseline. When there is no earlier period in the data, the ghost
 * line and the verdict are withheld and the card says so. A made-up "last
 * period" is worse than a missing one, because the reader would act on the gap.
 */

import { useMemo } from 'react';
import { AreaChart, Area, Line, XAxis, YAxis, Tooltip } from 'recharts';
import ChartAutoSizer from './ChartAutoSizer';
import type { ActivityPoint } from './usageActivity';
import { TooltipCard } from './usageChrome';
import { SERIES, HOVER_FILL, GRID, fmt } from './usageTokens';

interface PacePoint {
  x: number;
  label: string;
  current: number;
  prior: number | null;
  /** The lower of the two running totals — the transparent floor the shaded gap
   *  band stacks on top of, so the band fills exactly between the two lines. */
  base: number;
  /** |current − prior| — the shaded band's height at this day. The band IS the
   *  lead (or the deficit), drawn, so "ahead/behind" is seen, not read. */
  gap: number;
}

/** The two windows being compared, named with real dates so "this period" and
 *  "last period" are never a mystery. `lastFrom`/`lastTo` are null when the data
 *  has no earlier window to compare against. */
export interface PaceWindows {
  thisFrom: string;
  thisTo: string;
  lastFrom: string | null;
  lastTo: string | null;
}

export default function UsageCumulativePace({ activity, rangeDays, windows }: {
  activity: ActivityPoint[];
  /** Length of each window in days — so the verdict can say "the last 30 days". */
  rangeDays: number;
  /** The real dates behind "this period" / "last period". */
  windows: PaceWindows;
}) {
  const { points, currentTotal, priorTotal, hasPrior } = useMemo(() => {
    const pts: PacePoint[] = [];
    let runCur = 0;
    let runPrior = 0;
    let anyPrior = false;
    for (let i = 0; i < activity.length; i++) {
      const p = activity[i];
      runCur += p.total;
      if (p.prior !== null) { runPrior += p.prior; anyPrior = true; }
      const prior = p.prior !== null ? runPrior : null;
      pts.push({
        x: i,
        label: p.label,
        current: runCur,
        prior,
        base: prior === null ? runCur : Math.min(runCur, prior),
        gap: prior === null ? 0 : Math.abs(runCur - prior),
      });
    }
    return { points: pts, currentTotal: runCur, priorTotal: runPrior, hasPrior: anyPrior };
  }, [activity]);

  if (points.length === 0) {
    return <p className="text-[0.8125rem] text-ink-400">No activity in this period to plot.</p>;
  }

  const delta = currentTotal - priorTotal;
  const ahead = delta >= 0;
  const deltaColor = ahead ? SERIES.primary : SERIES.attention;
  const pct = priorTotal > 0 ? Math.round((delta / priorTotal) * 100) : null;

  return (
    <div className="flex h-full flex-col">
      {/* One line, not a paragraph: the total, the direction as a chip, and the
          one number it is measured against. Everything else — what counts, which
          windows, how they line up — lives in the card's ⓘ, so the graph leads. */}
      <div className="mb-4 flex items-baseline gap-x-3 gap-y-1 flex-wrap">
        <span className="text-[2rem] font-semibold leading-none tracking-[-0.03em] text-ink-900 tabular-nums">
          {fmt(currentTotal)}
        </span>
        {hasPrior && pct !== null ? (
          <>
            <span
              className="inline-flex items-center gap-0.5 h-[1.375rem] px-2 rounded-full text-[0.8125rem] font-semibold tabular-nums"
              style={{ color: deltaColor, backgroundColor: ahead ? 'rgba(106,18,205,0.08)' : 'rgba(180,83,9,0.10)' }}
            >
              {ahead ? '↑' : '↓'} {Math.abs(pct)}%
            </span>
            <span className="text-[0.8125rem] text-ink-400">
              vs <span className="tabular-nums text-ink-500">{fmt(priorTotal)}</span> the {rangeDays} days before
            </span>
          </>
        ) : (
          <span className="text-[0.8125rem] text-ink-400">actions — no earlier {rangeDays} days to compare yet</span>
        )}
      </div>

      <div className="min-h-[188px] flex-1 -mx-1">
        <ChartAutoSizer>
          {({ width, height }) => (
          <AreaChart width={width} height={height} data={points} margin={{ top: 8, right: 46, bottom: 2, left: 4 }}>
            <defs>
              <linearGradient id="pace-gap" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={deltaColor} stopOpacity={0.26} />
                <stop offset="100%" stopColor={deltaColor} stopOpacity={0.08} />
              </linearGradient>
            </defs>
            <YAxis domain={[0, 'dataMax']} hide />
            <XAxis dataKey="x" hide />
            <Tooltip
              isAnimationActive={false}
              cursor={{ stroke: HOVER_FILL, strokeWidth: 1 }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              content={({ active, payload }: any) => {
                if (!active || !payload?.length) return null;
                const p = (payload.find((x: any) => x.dataKey === 'current')?.payload ?? payload[0].payload) as PacePoint;
                const rows: { color: string; name: string; value: number }[] = [{ color: SERIES.primary, name: 'This period', value: p.current }];
                if (p.prior !== null) rows.push({ color: SERIES.compare, name: 'The 30 days before', value: p.prior });
                return <TooltipCard title={p.label} rows={rows} />;
              }}
            />
            {/* The shaded band IS the story: stack a transparent floor (the lower
                line) and a coloured band of height |current − prior|, so the fill
                sits exactly between the two curves. Brand when ahead, amber when
                behind — the colour of the gap is the answer. */}
            {hasPrior && <Area type="monotone" dataKey="base" stackId="gap" stroke="none" fill="transparent" isAnimationActive={false} />}
            {hasPrior && <Area type="monotone" dataKey="gap" stackId="gap" stroke="none" fill="url(#pace-gap)" isAnimationActive={false} />}
            {/* Last period: the dashed ghost. */}
            {hasPrior && (
              <Line type="monotone" dataKey="prior" stroke={SERIES.compare} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} connectNulls />
            )}
            {/* This period: the solid line, with the running total pinned at the tip. */}
            <Line
              type="monotone"
              dataKey="current"
              stroke={SERIES.primary}
              strokeWidth={2.5}
              isAnimationActive={false}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              dot={({ cx, cy, payload }: any) =>
                payload.x === points.length - 1 ? (
                  <g key="now">
                    <circle cx={cx} cy={cy} r={4.5} fill={SERIES.primary} stroke="#fff" strokeWidth={2} />
                    <text x={cx + 9} y={cy} dy={4} fontSize={11.5} fontWeight={700} fill={SERIES.primary}>
                      {fmt(currentTotal)}
                    </text>
                  </g>
                ) : (
                  <circle key={payload.x} cx={cx} cy={cy} r={0} fill="none" />
                )
              }
              activeDot={{ r: 3.5, fill: SERIES.primary, stroke: '#fff', strokeWidth: 2 }}
            />
          </AreaChart>
          )}
        </ChartAutoSizer>
      </div>

      {/* Dates on the axis only — the horizontal is time, start to end. */}
      <div
        className="mt-2 flex items-center justify-between text-[0.6875rem] tabular-nums text-ink-400"
        style={{ borderTop: `1px solid ${GRID}`, paddingTop: '0.5rem' }}
      >
        <span>{windows.thisFrom}</span>
        <span>{windows.thisTo}</span>
      </div>
    </div>
  );
}
