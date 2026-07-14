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
 */

import { useMemo } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { USAGE_DAY_LABELS as DAY_LABELS, type UsageHeatmapData } from '../../data/platform-usage';
import { Eyebrow } from './usageChrome';
import { SERIES, fmt } from './usageTokens';

/** Business-first order: Monday to Sunday. */
const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0];
const FULL_DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const hourLabel = (h: number) => `${String(h).padStart(2, '0')}:00`;

/** One row of the bar chart. The bar IS the hit target, and it carries its count. */
function Bars({ data, max, ariaUnit }: {
  data: { key: string; label: string; value: number; muted?: boolean; title: string }[];
  max: number;
  ariaUnit: string;
}) {
  const prefersReduced = useReducedMotion();
  return (
    <div className="flex items-end gap-1 h-[104px]">
      {data.map((d, i) => (
        <div key={d.key} className="flex-1 min-w-0 flex flex-col items-center justify-end gap-1.5 h-full group">
          <span className="text-[0.625rem] tabular-nums font-semibold text-ink-400 group-hover:text-ink-900 transition-colors">
            {d.value > 0 ? fmt(d.value) : ''}
          </span>
          <motion.div
            role="img"
            aria-label={`${d.label}: ${fmt(d.value)} ${ariaUnit}`}
            title={d.title}
            initial={prefersReduced ? false : { height: 0 }}
            animate={{ height: `${max > 0 ? Math.max(1.5, (d.value / max) * 100) : 1.5}%` }}
            transition={prefersReduced ? { duration: 0 } : { duration: 0.45, delay: i * 0.02, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-[36px] rounded-t-xs cursor-default transition-opacity hover:opacity-80"
            style={{ background: d.muted ? '#DCC9F5' : SERIES.primary, minHeight: 2 }}
          />
        </div>
      ))}
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

  const dayMax = Math.max(1, ...byDay.map(d => d.total));
  const hourMax = Math.max(1, ...byHour.map(h => h.total));
  const grand = byDay.reduce((s, d) => s + d.total, 0);

  const busiestDay = byDay.reduce((a, b) => (b.total > a.total ? b : a), byDay[0]);
  const busiestHour = byHour.reduce((a, b) => (b.total > a.total ? b : a), byHour[0]);

  // Working hours = 08:00–18:00. The share outside it is the only thing on this
  // card that could change a decision (out-of-hours access, on-call, licensing).
  const inHours = byHour.filter(h => h.hour >= 8 && h.hour < 18).reduce((s, h) => s + h.total, 0);
  const inHoursPct = grand > 0 ? Math.round((inHours / grand) * 100) : 0;

  const weekend = byDay.filter(d => d.dow === 0 || d.dow === 6).reduce((s, d) => s + d.total, 0);
  const weekendPct = grand > 0 ? Math.round((weekend / grand) * 100) : 0;

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

      <div className="mt-6">
        <Eyebrow className="mb-3">By day of the week</Eyebrow>
        <Bars
          max={dayMax}
          ariaUnit="actions"
          data={byDay.map(d => ({
            key: String(d.dow),
            label: FULL_DOW[d.dow],
            value: d.total,
            // The weekend is context, not the story — it stays recessive.
            muted: d.dow === 0 || d.dow === 6,
            title: `${FULL_DOW[d.dow]}: ${fmt(d.total)} action${d.total === 1 ? '' : 's'}`,
          }))}
        />
        <div className="mt-2 flex gap-1">
          {DOW_ORDER.map(dow => (
            <span key={dow} className="flex-1 text-center text-[0.625rem] font-medium text-ink-400">
              {DAY_LABELS[dow]}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-7 pt-6 border-t border-canvas-border">
        <Eyebrow className="mb-3">By hour of the day</Eyebrow>
        <Bars
          max={hourMax}
          ariaUnit="actions"
          data={byHour.map(h => ({
            key: String(h.hour),
            label: hourLabel(h.hour),
            value: h.total,
            muted: h.hour < 8 || h.hour >= 18,
            title: `${hourLabel(h.hour)}: ${fmt(h.total)} action${h.total === 1 ? '' : 's'}`,
          }))}
        />
        <div className="mt-2 grid" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
          {byHour.map(h => (
            <span key={h.hour} className="text-center text-[0.5625rem] text-ink-400 tabular-nums">
              {h.hour % 3 === 0 ? String(h.hour).padStart(2, '0') : ''}
            </span>
          ))}
        </div>
        <p className="mt-3 text-[0.625rem] text-ink-400">
          Office hours (08:00–18:00) in full colour; nights and weekends muted.
        </p>
      </div>
    </div>
  );
}
