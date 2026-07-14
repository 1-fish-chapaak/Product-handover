/**
 * Platform Usage — the activity chart.
 *
 * One bar per day, the weekends shaded, and a 7-day rolling average laid over
 * the top. The reasoning is in `usageActivity.ts`; the short version is that the
 * two previous attempts each fixed one problem by causing another:
 *
 *   · A raw daily LINE charted the weekend, not the usage — it crashed every
 *     Saturday, so the loudest feature of the chart was the calendar.
 *   · WEEKLY COLUMNS cancelled the weekend but left four bars in a 1,000px plot
 *     — a gap-to-bar ratio of about 470%, where the readable band is 20–40%. It
 *     didn't look sparse, it looked broken. And it threw away the day-level
 *     truth an auditor will ask for ("what happened on the 14th?").
 *
 * Bars keep the days. The rolling line carries the trend. The shading explains
 * the dips. Nothing is smoothed away and nothing is invented.
 */

import { useMemo } from 'react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceArea,
} from 'recharts';
import { TooltipCard } from './usageChrome';
import { GRID, SERIES, xAxisProps, yAxisProps, fmt } from './usageTokens';
import { weekendSpans, type ActivityPoint } from './usageActivity';

/** The rolling line is ink, not brand. Brand is already the bars; a dark neutral
 *  reads unambiguously as "drawn on top of" rather than "another series". */
const ROLLING_STROKE = '#2C1B48';

export default function UsageActivityChart({
  points, compareOn, height = 280,
}: {
  points: ActivityPoint[];
  compareOn: boolean;
  height?: number;
}) {
  const weekends = useMemo(() => weekendSpans(points), [points]);
  const byLabel = useMemo(() => new Map(points.map(p => [p.label, p])), [points]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tip = ({ active, label }: any) => {
    const p = byLabel.get(String(label));
    if (!active || !p) return null;
    const rows: { color: string; name: string; value: number }[] = [
      { color: SERIES.secondary, name: 'AI was involved', value: p.ai },
      { color: SERIES.primary, name: 'Everything else', value: p.rest },
    ];
    if (p.rolling !== null) {
      rows.push({ color: ROLLING_STROKE, name: '7-day average', value: Math.round(p.rolling) });
    }
    if (compareOn && typeof p.prior === 'number') {
      rows.push({ color: SERIES.compare, name: 'Same day, last period', value: p.prior });
    }
    const share = p.total > 0 ? Math.round((p.ai / p.total) * 100) : 0;
    return (
      <TooltipCard
        title={`${p.label}${p.weekend ? ' · weekend' : ''}`}
        rows={rows}
        footer={
          p.total === 0
            ? <>Nothing happened{p.weekend ? ' — it was the weekend' : ''}</>
            : <><span className="font-semibold text-ink-700">{fmt(p.total)}</span> in total · AI in {share}% of it</>
        }
      />
    );
  };

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={points}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          // 30 slots across ~1,000px is ~33px each; a 28px cap leaves a ~5px gap,
          // which sits inside the 20–40% gap-to-bar band that reads as a chart.
          // The weekly version was at ~470% — that is why it looked broken.
          barCategoryGap="22%"
        >
          {/* Weekends first, so the bars paint over them. This is the honest way
              to say "the dip is Saturday" — it explains the trough instead of
              smoothing it out of existence. */}
          {weekends.map(([x1, x2]) => (
            <ReferenceArea
              key={x1}
              x1={x1}
              x2={x2}
              // 3.5% ink is the textbook figure, but against this canvas it was
              // invisible — a band nobody can see explains nothing. 5.5% still
              // sits well under the bars and is actually legible.
              fill="rgba(15,7,32,0.055)"
              strokeOpacity={0}
              ifOverflow="extendDomain"
            />
          ))}

          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="label" {...xAxisProps} interval="preserveStartEnd" minTickGap={40} />
          <YAxis {...yAxisProps} allowDecimals={false} />
          <Tooltip cursor={{ fill: 'rgba(15,7,32,0.05)' }} content={tip} isAnimationActive={false} />

          {/* Two segments only, so both have a fixed baseline and both are
              readable. AI sits at the bottom: a segment floating on a moving
              baseline cannot be compared bar to bar. */}
          <Bar dataKey="ai" name="AI was involved" stackId="a" fill={SERIES.secondary} maxBarSize={28} />
          <Bar
            dataKey="rest"
            name="Everything else"
            stackId="a"
            fill={SERIES.primary}
            radius={[2, 2, 0, 0]}
            maxBarSize={28}
          />

          {compareOn && (
            <Line
              type="monotone"
              dataKey="prior"
              name="Same day, last period"
              stroke={SERIES.compare}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              isAnimationActive={false}
            />
          )}

          {/* The trend. Seven days is exactly one weekly cycle, so this cancels
              the weekday/weekend seasonality without hiding a single real day. */}
          <Line
            type="monotone"
            dataKey="rolling"
            name="7-day average"
            stroke={ROLLING_STROKE}
            strokeWidth={2}
            strokeLinecap="round"
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
