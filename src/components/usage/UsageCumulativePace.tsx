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
import { ResponsiveContainer, AreaChart, Area, Line, XAxis, YAxis, Tooltip } from 'recharts';
import type { ActivityPoint } from './usageActivity';
import { TooltipCard } from './usageChrome';
import { SERIES, HOVER_FILL, GRID, fmt } from './usageTokens';

interface PacePoint {
  x: number;
  label: string;
  current: number;
  prior: number | null;
}

export default function UsageCumulativePace({ activity }: { activity: ActivityPoint[] }) {
  const { points, currentTotal, priorTotal, hasPrior } = useMemo(() => {
    const pts: PacePoint[] = [];
    let runCur = 0;
    let runPrior = 0;
    let anyPrior = false;
    for (let i = 0; i < activity.length; i++) {
      const p = activity[i];
      runCur += p.total;
      if (p.prior !== null) { runPrior += p.prior; anyPrior = true; }
      pts.push({
        x: i,
        label: p.label,
        current: runCur,
        prior: p.prior !== null ? runPrior : null,
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

  return (
    <div className="flex flex-col">
      {/* The reading, before the chart. When there is an earlier period the gap is
          the finding; when there is not, the honest line is that there is nothing
          to compare against yet. */}
      {hasPrior ? (
        <p className="text-[0.8125rem] text-ink-600 leading-relaxed mb-4">
          <span className="font-semibold text-ink-900 tabular-nums">{fmt(currentTotal)}</span> actions so far this period,{' '}
          <span className="font-semibold tabular-nums" style={{ color: deltaColor }}>
            {fmt(Math.abs(delta))} {ahead ? 'ahead of' : 'behind'}
          </span>{' '}
          the same point last period ({fmt(priorTotal)}).
        </p>
      ) : (
        <p className="text-[0.8125rem] text-ink-500 leading-relaxed mb-4">
          <span className="font-semibold text-ink-900 tabular-nums">{fmt(currentTotal)}</span> actions so far this period.
          There is no earlier period in the data to compare the pace against yet.
        </p>
      )}

      <div className="h-[220px] -mx-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 8, right: 48, bottom: 2, left: 4 }}>
            <defs>
              <linearGradient id="pace-current" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIES.primary} stopOpacity={0.22} />
                <stop offset="100%" stopColor={SERIES.primary} stopOpacity={0.02} />
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
                const p = payload[0].payload as PacePoint;
                const rows = [{ color: SERIES.primary, name: 'This period', value: p.current }];
                if (p.prior !== null) rows.push({ color: SERIES.compare, name: 'Last period', value: p.prior });
                return <TooltipCard title={p.label} rows={rows} />;
              }}
            />
            {/* Last period first, so this period's filled area sits over the ghost. */}
            {hasPrior && (
              <Line
                type="monotone"
                dataKey="prior"
                stroke={SERIES.compare}
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
            )}
            <Area
              type="monotone"
              dataKey="current"
              stroke={SERIES.primary}
              strokeWidth={2.5}
              fill="url(#pace-current)"
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
        </ResponsiveContainer>
      </div>

      {/* Key. The ghost is dashed and achromatic, so it needs saying which line is
          which — the same two marks the tooltip uses. */}
      {hasPrior && (
        <div className="mt-3 flex items-center gap-5 text-[0.6875rem] text-ink-500" style={{ borderTop: `1px solid ${GRID}`, paddingTop: '0.75rem' }}>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-[3px] w-4 rounded-full" style={{ background: SERIES.primary }} />
            This period
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: SERIES.compare }} />
            Last period
          </span>
        </div>
      )}
    </div>
  );
}
