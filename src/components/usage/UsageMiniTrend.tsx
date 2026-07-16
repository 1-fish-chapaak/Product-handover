/**
 * Platform Usage — a card's own day-by-day strip.
 *
 * The generalisation of the AI strip: a small bar chart on its OWN scale, sharing
 * the page's dates, printing what its scale tops out at.
 *
 * WHY OUTPUT NEEDED THIS. Output was the only tab on the page with no time axis
 * anywhere on it. Every card led with a total and a change chip — "84 downloads,
 * up 22%" — and a change chip is a two-point comparison: it can tell you this
 * period beat the last one, and it cannot tell you the difference between steady
 * production and one enormous Tuesday followed by three silent weeks. Those are
 * the same number and completely different facts, and only a shape separates
 * them.
 *
 * The strip is deliberately small. The total is the headline and stays the
 * headline; this is the shape behind it. And it carries its own scale rather than
 * borrowing the neighbouring card's, because 84 downloads and 24 creations on one
 * axis would flatten the smaller series into a line of stubs — the same mistake
 * that made AI unreadable when it was stacked into the activity chart.
 */

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import ChartAutoSizer from './ChartAutoSizer';
import { TooltipCard } from './usageChrome';
import {
  SERIES, HOVER_FILL, BAR_RADIUS, BAR_SIZE, yAxisProps, fmt,
} from './usageTokens';

export interface MiniPoint {
  label: string;
  value: number;
}

export default function UsageMiniTrend({
  points, name, color = SERIES.primary, height = 56,
}: {
  points: MiniPoint[];
  /** What one bar counts — "reports created", "files downloaded". */
  name: string;
  color?: string;
  height?: number;
}) {
  const peak = useMemo(
    () => points.reduce<MiniPoint | null>((best, p) => (p.value > 0 && (!best || p.value > best.value) ? p : best), null),
    [points],
  );
  const total = useMemo(() => points.reduce((s, p) => s + p.value, 0), [points]);
  const byLabel = useMemo(() => new Map(points.map(p => [p.label, p])), [points]);

  if (points.length < 2 || total === 0) return null;

  const gid = `mini-${name.replace(/\W+/g, '')}`;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <span className="text-[0.625rem] font-semibold text-ink-400 uppercase tracking-wide">
          Day by day
        </span>
        {/* The scale, said out loud. Without it the tallest bar is merely "tall",
            and a reader will measure it against the card next door — which is a
            different scale, and they would be wrong by an order of magnitude. */}
        <span className="text-[0.625rem] text-ink-400 tabular-nums">
          Own scale · peak {fmt(peak?.value ?? 0)} on {peak?.label}
        </span>
      </div>
      <div style={{ height }}>
        <ChartAutoSizer>
          {({ width, height: h }) => (
          <BarChart width={width} height={h} data={points} margin={{ top: 2, right: 4, left: 0, bottom: 0 }} barCategoryGap="22%">
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.85} />
                <stop offset="100%" stopColor={color} stopOpacity={1} />
              </linearGradient>
            </defs>
            {/* The dates are the page's, printed on the chart at the top of the
                tab. Repeating them under a 56px strip would cost more ink than the
                data. */}
            <XAxis dataKey="label" hide />
            <YAxis {...yAxisProps} allowDecimals={false} tickCount={3} width={30} />
            <Tooltip
              cursor={{ fill: HOVER_FILL }}
              isAnimationActive={false}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              content={({ active, label }: any) => {
                const p = byLabel.get(String(label));
                if (!active || !p) return null;
                return (
                  <TooltipCard
                    title={p.label}
                    rows={[{ color, name, value: p.value }]}
                    footer={p.value === 0 ? <>Nothing that day</> : undefined}
                  />
                );
              }}
            />
            <Bar dataKey="value" name={name} fill={`url(#${gid})`} radius={BAR_RADIUS} maxBarSize={BAR_SIZE} />
          </BarChart>
          )}
        </ChartAutoSizer>
      </div>
    </div>
  );
}
