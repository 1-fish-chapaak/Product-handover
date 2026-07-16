/**
 * Platform Usage — Overview's "what this period was made of": the window's
 * actions split into the areas they happened in, as a donut.
 *
 * WHY A DONUT AND NOT THE OLD PACE LINES. This card used to plot this period's
 * running total against last period's. A pie was asked for, and a pie is only
 * honest as a PART-TO-WHOLE: two period totals (528 vs 470) are two separate
 * numbers, not slices of one thing, so a two-slice pie of them would read as if
 * they summed to a whole they never form. The one genuine whole on this card is
 * the period's own total — 528 actions — and the honest slices of it are the
 * areas that produced them. That is what this draws.
 *
 * The hover is the point of the interaction: land on a slice (or its legend row)
 * and the centre stops showing the grand total and shows THAT area's count and
 * share instead, while the other slices step back — so a reader reads one area
 * at a time without a tooltip to chase.
 */

import { useState } from 'react';
import { PieChart, Pie, Cell } from 'recharts';
import ChartAutoSizer from './ChartAutoSizer';
import { DONUT_SHADES, fmt } from './usageTokens';

export interface AreaMixItem {
  name: string;
  value: number;
}

export default function UsageAreaMix({
  items, total, note, footer, size = 168, maxSlices = 6, className = '',
}: {
  /** Every area with activity, name + count. Ranked and rolled up here. */
  items: AreaMixItem[];
  /** The whole the slices are a part of — the period's action total. */
  total: number;
  /** One short line above the donut (e.g. the vs-last-period delta). Optional. */
  note?: React.ReactNode;
  /** Pinned to the foot of the card, below the donut (e.g. the AI split). The
   *  donut section grows to fill the space between note and footer, so a tall
   *  card is filled top to bottom instead of leaving a hole under the ring. */
  footer?: React.ReactNode;
  size?: number;
  /** Areas beyond this fold into one "N more areas" slice, so the ring never
   *  shatters into a dozen unreadable slivers. */
  maxSlices?: number;
  className?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);

  // Rank, then fold the tail into one honest "N more areas" slice.
  const sorted = [...items].filter(i => i.value > 0).sort((a, b) => b.value - a.value);
  const head = sorted.slice(0, maxSlices);
  const tail = sorted.slice(maxSlices);
  const slices = tail.length
    ? [...head, { name: `${tail.length} more area${tail.length === 1 ? '' : 's'}`, value: tail.reduce((s, i) => s + i.value, 0) }]
    : head;
  const shaded = slices.map((s, i) => ({ ...s, color: DONUT_SHADES[i % DONUT_SHADES.length] }));

  if (shaded.length === 0) {
    return <p className="text-[0.8125rem] text-ink-400">No activity in this period to break down.</p>;
  }

  const ring = Math.round(size * 0.15);
  const active = hover !== null ? shaded[hover] : null;
  const centerValue = active ? active.value : total;
  const centerLabel = active ? active.name : 'Actions';
  const centerShare = active && total > 0 ? Math.round((active.value / total) * 100) : null;

  return (
    <div className={`flex h-full flex-col ${className}`}>
      {note && <div className="mb-4 text-[0.8125rem]">{note}</div>}

      {/* The donut section grows and centres in whatever height the card has, so
          the ring never sits with a hand-sized hole under it. */}
      <div className="flex flex-1 items-center gap-6">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <ChartAutoSizer>
            {({ width, height }) => (
            <PieChart width={width} height={height}>
              <Pie
                data={shaded}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={size / 2 - ring}
                outerRadius={size / 2 - 2}
                paddingAngle={2}
                cornerRadius={4}
                strokeWidth={0}
                isAnimationActive={false}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onMouseEnter={(_: any, i: number) => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                {shaded.map((s, i) => (
                  <Cell
                    key={s.name}
                    fill={s.color}
                    // The hovered slice keeps full colour; the rest step back, so
                    // the eye lands on the one being read. Nothing disappears.
                    fillOpacity={hover === null || hover === i ? 1 : 0.32}
                    style={{ transition: 'fill-opacity 150ms ease', cursor: 'pointer' }}
                  />
                ))}
              </Pie>
            </PieChart>
            )}
          </ChartAutoSizer>
          {/* The centre reads out the hovered slice, or the grand total at rest. */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-2 text-center">
            <span className="text-[1.375rem] font-semibold tracking-[-0.03em] text-ink-900 leading-none tabular-nums">
              {fmt(centerValue)}
            </span>
            <span className="mt-1 max-w-full truncate text-[0.625rem] font-medium text-ink-400">
              {centerShare !== null ? `${centerLabel} · ${centerShare}%` : centerLabel}
            </span>
          </div>
        </div>

        {/* The legend carries the numbers and doubles as the hover target, so a
            slice and its row highlight together whichever one the cursor is on. */}
        <div className="min-w-0 flex-1 space-y-1">
          {shaded.map((s, i) => {
            const on = hover === i;
            const dim = hover !== null && !on;
            return (
              <div
                key={s.name}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                className={`flex items-center gap-2 rounded-md px-1.5 py-1 text-[0.6875rem] cursor-pointer transition-colors ${on ? 'bg-ink-900/[0.04]' : ''}`}
                style={{ opacity: dim ? 0.5 : 1 }}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: s.color }} />
                <span className="truncate text-ink-600">{s.name}</span>
                <span className="ml-auto shrink-0 tabular-nums">
                  <span className="font-semibold text-ink-900">{fmt(s.value)}</span>
                  <span className="ml-1.5 text-ink-400">{total > 0 ? Math.round((s.value / total) * 100) : 0}%</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {footer && <div className="mt-5 pt-4 border-t border-canvas-border">{footer}</div>}
    </div>
  );
}
