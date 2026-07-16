/**
 * Platform Usage — the activity chart, and the AI strip under it.
 *
 * One bar per day, the weekends shaded, a 7-day rolling average laid over the
 * top, and the odd days marked. The reasoning is in `usageActivity.ts`; the
 * short version is that the two previous attempts each fixed one problem by
 * causing another:
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
 *
 * WHY AI IS NOT IN THE BARS (PRD REQ-4.2). It used to be a stacked segment at
 * the foot of every column, which put it on the same axis as total actions — and
 * AI is roughly a tenth of the work, so its segment was a few pixels of blue
 * that never moved. A series pinned flat against the baseline of someone else's
 * scale cannot be read: you could not tell an AI-heavy day from an AI-free one,
 * which is the only question the series exists to answer. The PRD predicted this
 * exactly ("on the same scale it would be a flat line at the bottom").
 *
 * So AI gets its own strip, on its own scale, sharing the main chart's dates.
 * The two plots are read together — same x, different y — and the strip prints
 * its peak, because a chart with an independent scale has to say what its
 * height is worth or the reader will borrow the scale above it and be wrong.
 *
 * The marks follow the house dataviz spec: columns capped at 22px so the band's
 * leftover is air, and a 4px rounded cap at the data end.
 */

import { useMemo } from 'react';
import {
  ComposedChart, BarChart, Bar, Cell, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceDot,
} from 'recharts';
import ChartAutoSizer from './ChartAutoSizer';
import { TooltipCard } from './usageChrome';
import {
  GRID, SERIES, HOVER_FILL, BAR_RADIUS, xAxisProps, yAxisProps, fmt,
} from './usageTokens';
import { aiPeak, type ActivityPoint } from './usageActivity';

/** The rolling line is ink, not brand. Brand is already the bars; a neutral reads
 *  unambiguously as "drawn on top of" rather than "another series".
 *
 *  Mid ink, not near-black. At #2C1B48 the average was the heaviest mark on the
 *  chart, which inverts the hierarchy: it is a smoothing of the bars, so it must
 *  not out-shout the bars it smooths. It still has to stay clearly apart from the
 *  compare series (grey, and dashed), so it keeps the darker end of the ink ramp
 *  and stays solid. */
const ROLLING_STROKE = '#5C5170';

export default function UsageActivityChart({
  points, compareOn, height = 260,
}: {
  points: ActivityPoint[];
  compareOn: boolean;
  height?: number;
}) {
  const byLabel = useMemo(() => new Map(points.map(p => [p.label, p])), [points]);
  const spikes = useMemo(() => points.filter(p => p.spike), [points]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tip = ({ active, label }: any) => {
    const p = byLabel.get(String(label));
    if (!active || !p) return null;
    const rows: { color: string; name: string; value: number; dashed?: boolean }[] = [
      { color: SERIES.primary, name: 'Actions', value: p.total },
      { color: SERIES.secondary, name: 'AI was involved in', value: p.ai },
    ];
    if (p.rolling !== null) {
      rows.push({ color: ROLLING_STROKE, name: '7-day average', value: Math.round(p.rolling) });
    }
    if (compareOn && typeof p.prior === 'number') {
      rows.push({ color: SERIES.compare, name: 'Same day, last period', value: p.prior, dashed: true });
    }
    const share = p.total > 0 ? Math.round((p.ai / p.total) * 100) : 0;
    return (
      <TooltipCard
        title={`${p.label}${p.weekend ? ' · weekend' : ''}${p.spike ? ' · unusually busy' : ''}`}
        rows={rows}
        footer={
          p.total === 0
            ? <>Nothing happened{p.weekend ? '. It was the weekend' : ''}</>
            : <>AI was involved in {share}% of the day's work</>
        }
      />
    );
  };

  return (
    <div style={{ height }}>
      <ChartAutoSizer>
        {({ width, height: h }) => (
        <ComposedChart
          width={width}
          height={h}
          data={points}
          margin={{ top: 14, right: 8, left: 0, bottom: 0 }}
          // Slim columns with real air between them. At a 22px cap over 30 slots
          // the bars nearly touched, and a plot with no gaps reads as a solid
          // block of ink rather than as a series of days.
          barCategoryGap="34%"
        >
          <defs>
            {/* A gradient down the column, not a flat slab. Two steps of one hue:
                it reads as one mark with a light source, never as two values. */}
            <linearGradient id="usage-bar-primary" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7B2BDB" />
              <stop offset="100%" stopColor="#6A12CD" />
            </linearGradient>
            {/* The weekend, as the muted step of the same hue — but the old flat
                #DCC9F5 sat at barely 1.2:1 on white, so a quiet Saturday's short
                bar all but vanished and the chart looked like it was missing days.
                A mid-lilac gradient keeps the "same measure, quieter day" reading
                while actually being visible. */}
            <linearGradient id="usage-bar-weekend" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#C6A8EC" />
              <stop offset="100%" stopColor="#B790E4" />
            </linearGradient>
          </defs>

          {/* NO WEEKEND SHADING. It used to be a grey ReferenceArea behind every
              Saturday and Sunday, and across a 30-day window that is eight or nine
              grey slabs: the loudest thing on the chart was its own background,
              and the bars had to be read through a set of stripes.

              The weekend is a property of the BAR, so it is drawn on the bar. A
              weekend column is the muted step of the same hue, which says "this is
              the same measure, on a quiet day" without putting a single pixel of
              chrome behind the data. */}
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="label" {...xAxisProps} interval="preserveStartEnd" minTickGap={40} />
          <YAxis {...yAxisProps} allowDecimals={false} />
          {/* The hover wash is brand-tinted and slot-wide, so it reads as "this
              day" rather than as a grey box behind the bar. */}
          <Tooltip cursor={{ fill: HOVER_FILL }} content={tip} isAnimationActive={false} />

          {/* One series, one scale. Total actions per day — what the axis says. */}
          <Bar
            dataKey="total"
            name="Actions"
            radius={BAR_RADIUS}
            maxBarSize={18}
            isAnimationActive={false}
          >
            {points.map(p => (
              <Cell
                key={p.label}
                fill={p.weekend ? 'url(#usage-bar-weekend)' : 'url(#usage-bar-primary)'}
              />
            ))}
          </Bar>

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
            strokeLinejoin="round"
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />

          {/* The odd days (REQ-4.4). A hollow ring floating above the column, not
              a fill on the column itself: the bar's height is already carrying the
              value, and recolouring it would make "unusual" look like a different
              KIND of action. The ring sits in the attention hue — the one colour
              on this page that means "look here". */}
          {spikes.map(p => (
            <ReferenceDot
              key={p.label}
              x={p.label}
              y={p.total}
              r={4}
              fill="#FFFFFF"
              stroke={SERIES.attention}
              strokeWidth={2}
              ifOverflow="extendDomain"
            />
          ))}
        </ComposedChart>
        )}
      </ChartAutoSizer>
    </div>
  );
}

/**
 * The AI strip (REQ-4.2). Same dates as the chart above, its own scale, and its
 * peak printed on it.
 *
 * It is deliberately small — a sixth of the main plot's height. That is the
 * honest hierarchy: AI is a tenth of the work, and a strip the same size as the
 * chart above would say the two are equally important. What the strip buys is
 * SHAPE: on its own scale you can finally see which days leaned on AI, which is
 * invisible when the series is a flat blue crust at the foot of someone else's
 * bars.
 */
export function UsageAiStrip({ points, height = 68 }: { points: ActivityPoint[]; height?: number }) {
  const peak = useMemo(() => aiPeak(points), [points]);
  const byLabel = useMemo(() => new Map(points.map(p => [p.label, p])), [points]);
  const total = useMemo(() => points.reduce((s, p) => s + p.ai, 0), [points]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tip = ({ active, label }: any) => {
    const p = byLabel.get(String(label));
    if (!active || !p) return null;
    const share = p.total > 0 ? Math.round((p.ai / p.total) * 100) : 0;
    return (
      <TooltipCard
        title={p.label}
        rows={[{ color: SERIES.secondary, name: 'AI actions', value: p.ai }]}
        footer={
          p.ai === 0
            ? <>No AI that day</>
            : <>{share}% of the {fmt(p.total)} actions that day</>
        }
      />
    );
  };

  if (total === 0) {
    return (
      <p className="text-[0.75rem] text-ink-400">No AI activity in this period.</p>
    );
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4 mb-1.5">
        <span className="text-[0.6875rem] font-semibold text-ink-500 uppercase tracking-wide">
          AI actions per day
        </span>
        {/* The scale, said out loud. Without this the strip's tallest bar is just
            "tall", and the reader will read it against the axis above — which is
            a different scale and would overstate AI by an order of magnitude. */}
        <span className="text-[0.625rem] text-ink-400 tabular-nums">
          Own scale · peak {fmt(peak?.value ?? 0)} on {peak?.label}
        </span>
      </div>
      <div style={{ height }}>
        <ChartAutoSizer>
          {({ width, height: h }) => (
          /* The same column geometry as the chart above, so the two plots line up
             day for day. A strip whose bars sit at a different width and pitch
             from the chart it belongs to reads as a second, unrelated chart. */
          <BarChart width={width} height={h} data={points} margin={{ top: 2, right: 8, left: 0, bottom: 0 }} barCategoryGap="34%">
            <defs>
              <linearGradient id="usage-bar-ai" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0EA5E9" />
                <stop offset="100%" stopColor="#0284C7" />
              </linearGradient>
            </defs>
            {/* No x-axis of its own: the dates are the chart's above, and printing
                them twice would say the two plots are independent. They are not —
                they are one reading, split across two scales. */}
            <XAxis dataKey="label" hide />
            {/* The y-axis keeps its width so the strip's baseline aligns exactly
                with the plot area above it. A strip that starts 44px to the left
                of the chart it belongs to is a different chart. */}
            <YAxis {...yAxisProps} allowDecimals={false} tickCount={3} />
            <Tooltip cursor={{ fill: HOVER_FILL }} content={tip} isAnimationActive={false} />
            <Bar
              dataKey="ai"
              name="AI actions"
              fill="url(#usage-bar-ai)"
              radius={BAR_RADIUS}
              maxBarSize={14}
              isAnimationActive={false}
            />
          </BarChart>
          )}
        </ChartAutoSizer>
      </div>
    </div>
  );
}
