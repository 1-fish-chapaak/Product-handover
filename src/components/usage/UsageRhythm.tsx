/**
 * Platform Usage — when the work happens.
 *
 * This replaced a 24 × 7 hour heatmap, and the arithmetic is the argument: 168
 * cells over a few hundred events is about three events per cell. Most cells
 * were 0 or 1. There was no pattern in there to find, because there was not
 * enough data to make one — the grid was reporting sampling noise as if it were
 * a rhythm, and the only sentence anyone could read off it ("busiest Tuesday
 * mornings") was already printed above it in words.
 *
 * The two things a manager can actually act on are the marginals: which DAYS
 * the team works, and which HOURS. Both have enough events per bar to be real
 * (7 bars and 24 bars, not 168 cells), and both are readable at a glance. So
 * that is what this draws. Nothing that was knowable from the grid is lost —
 * only the joint day×hour cells, which were never above the noise floor.
 *
 * Both are real charts now, not hand-rolled flex columns with numbers floating
 * over them. That buys three things the divs could not: an axis (so a bar's
 * height means something absolute, not just "taller than its neighbour"), a
 * hover layer on every column, and one shared mark spec — 22px cap, 4px rounded
 * data-end — with the rest of the page's charts.
 */

import { useMemo } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, LabelList,
} from 'recharts';
import { USAGE_DAY_LABELS as DAY_LABELS, type UsageHeatmapData } from '../../data/platform-usage';
import { Eyebrow, TooltipCard } from './usageChrome';
import {
  SERIES, MUTED, GRID, HOVER_FILL, BAR_RADIUS, xAxisProps, yAxisProps, fmt,
} from './usageTokens';

/** Business-first order: Monday to Sunday. */
const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0];
const FULL_DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const hourLabel = (h: number) => `${String(h).padStart(2, '0')}:00`;

/** Office hours. Everything outside them is drawn in the recessive step — the
 *  same hue, one shade lighter, which reads as "less of this thing" and not as
 *  "a different thing". */
const OFFICE_START = 8;
const OFFICE_END = 18;

interface Col {
  key: string;
  label: string;
  /** The x-axis tick. */
  tick: string;
  value: number;
  muted: boolean;
}

/** The value on the cap of the peak column, and nowhere else. A number on every
 *  one of twenty-four columns is a row of digits the eye reads instead of the
 *  shape it came for. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const peakLabel = (max: number) => ({ x, y, width, value }: any) => {
  if (value !== max || max === 0) return <g />;
  return (
    <text
      x={x + width / 2}
      y={y - 6}
      textAnchor="middle"
      className="fill-ink-500"
      style={{ fontSize: 10, fontWeight: 600 }}
    >
      {fmt(value)}
    </text>
  );
};

function ColumnChart({ data, height, unit, interval, labelPeak }: {
  data: Col[];
  height: number;
  unit: string;
  /** X-tick interval. 0 = every column (seven days), 2 = every third (hours). */
  interval: number;
  labelPeak: boolean;
}) {
  const max = Math.max(0, ...data.map(d => d.value));
  const byTick = useMemo(() => new Map(data.map(d => [d.tick, d])), [data]);

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 18, right: 4, left: 0, bottom: 0 }} barCategoryGap="26%">
          <defs>
            <linearGradient id="rhythm-on" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7B2BDB" />
              <stop offset="100%" stopColor={SERIES.primary} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="tick" {...xAxisProps} interval={interval} minTickGap={0} tickMargin={8} />
          <YAxis {...yAxisProps} allowDecimals={false} width={36} />
          <Tooltip
            cursor={{ fill: HOVER_FILL }}
            isAnimationActive={false}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            content={({ active, label }: any) => {
              const d = byTick.get(String(label));
              if (!active || !d) return null;
              return (
                <TooltipCard
                  title={d.label}
                  rows={[{ color: d.muted ? MUTED.primary : SERIES.primary, name: unit, value: d.value }]}
                />
              );
            }}
          />
          <Bar dataKey="value" radius={BAR_RADIUS} maxBarSize={34} isAnimationActive animationDuration={600}>
            {data.map(d => (
              <Cell key={d.key} fill={d.muted ? MUTED.primary : 'url(#rhythm-on)'} />
            ))}
            {labelPeak && <LabelList dataKey="value" content={peakLabel(max)} />}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function UsageRhythm({ data }: { data: UsageHeatmapData }) {
  const { matrix } = data;

  const byDay = useMemo(
    () => DOW_ORDER.map(dow => ({
      dow,
      total: matrix[dow].reduce((s, v) => s + v, 0),
    })),
    [matrix],
  );

  const byHour = useMemo(
    () => Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      total: matrix.reduce((s, row) => s + row[h], 0),
    })),
    [matrix],
  );

  const grand = byDay.reduce((s, d) => s + d.total, 0);

  const busiestDay = byDay.reduce((a, b) => (b.total > a.total ? b : a), byDay[0]);
  const busiestHour = byHour.reduce((a, b) => (b.total > a.total ? b : a), byHour[0]);

  // Working hours = 08:00–18:00. The share outside it is the only thing on this
  // card that could change a decision (out-of-hours access, on-call, licensing).
  const inHours = byHour
    .filter(h => h.hour >= OFFICE_START && h.hour < OFFICE_END)
    .reduce((s, h) => s + h.total, 0);
  const inHoursPct = grand > 0 ? Math.round((inHours / grand) * 100) : 0;

  const weekend = byDay.filter(d => d.dow === 0 || d.dow === 6).reduce((s, d) => s + d.total, 0);
  const weekendPct = grand > 0 ? Math.round((weekend / grand) * 100) : 0;

  const dayCols = useMemo<Col[]>(
    () => byDay.map(d => ({
      key: String(d.dow),
      label: FULL_DOW[d.dow],
      tick: DAY_LABELS[d.dow],
      value: d.total,
      // The weekend is context, not the story — it stays recessive.
      muted: d.dow === 0 || d.dow === 6,
    })),
    [byDay],
  );

  const hourCols = useMemo<Col[]>(
    () => byHour.map(h => ({
      key: String(h.hour),
      label: hourLabel(h.hour),
      tick: hourLabel(h.hour),
      value: h.total,
      muted: h.hour < OFFICE_START || h.hour >= OFFICE_END,
    })),
    [byHour],
  );

  if (grand === 0) {
    return <p className="text-[0.8125rem] text-ink-400">No activity in this period, so there is no pattern to show.</p>;
  }

  return (
    <div>
      {/* The reading of the two charts, before the two charts. */}
      <p className="text-[0.8125rem] text-ink-700 leading-relaxed">
        The team works <span className="font-semibold text-ink-900">{FULL_DOW[busiestDay.dow]}s</span> hardest and is
        busiest around <span className="font-semibold text-ink-900 tabular-nums">{hourLabel(busiestHour.hour)}</span>.{' '}
        <span className="font-semibold text-ink-900">{inHoursPct}%</span> of the work happens in office hours, and{' '}
        <span className="font-semibold text-ink-900">{weekendPct}%</span> at the weekend.
      </p>

      <div className="mt-6 grid grid-cols-1 xl:grid-cols-12 gap-6 xl:gap-8">
        <div className="xl:col-span-4">
          <Eyebrow className="mb-3">By day of the week</Eyebrow>
          <ColumnChart data={dayCols} height={148} unit="actions" interval={0} labelPeak />
          <p className="mt-3 text-[0.6875rem] text-ink-400">Weekend columns are drawn in the lighter step.</p>
        </div>

        <div className="xl:col-span-8 xl:border-l xl:border-canvas-border xl:pl-8">
          <Eyebrow className="mb-3">By hour of the day</Eyebrow>
          {/* Every third hour on the axis, and written as a time. A bare "09"
              under a bar chart reads as a value as easily as an hour. */}
          <ColumnChart data={hourCols} height={148} unit="actions" interval={2} labelPeak />
          <p className="mt-3 text-[0.6875rem] text-ink-400">
            Office hours ({hourLabel(OFFICE_START)} to {hourLabel(OFFICE_END)}) in full colour, nights in the lighter
            step. Hover a column for its count.
          </p>
        </div>
      </div>
    </div>
  );
}
