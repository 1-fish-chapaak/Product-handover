/**
 * Platform Usage — activity rhythm heatmap (weekday × hour).
 *
 * A punch card of when work happens. Magnitude is an ordered quantity, so it
 * gets a single-hue sequential ramp (light → dark) — never a rainbow, which has
 * no intuitive order, and never a red-amber-green heat strip (DESIGN.md's
 * No-RAG rule). Every cell carries its exact count on hover and on focus.
 *
 * The grid sums exactly to the window's action total (largest-remainder
 * distribution in usageHourlyMatrix).
 */

import { useState } from 'react';
import { USAGE_DAY_LABELS as DAY_LABELS, type UsageHeatmapData } from '../../data/platform-usage';

/** Business-first row order: Monday to Sunday. */
const ROW_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** The ramp, as alphas of the brand hue. Empty is ink, not a pale brand tint —
 *  "nothing happened" is not a small amount of the thing. */
const EMPTY = 'rgba(15, 7, 32, 0.035)';
const STEPS = [0.1, 0.22, 0.38, 0.56, 0.74, 0.9];

const fmtHour = (h: number) => `${String(h).padStart(2, '0')}:00`;

/** Six bins, so adjacent classes stay distinguishable. */
function cellColor(v: number, max: number) {
  if (v === 0) return EMPTY;
  const bin = Math.min(STEPS.length - 1, Math.floor((v / max) * STEPS.length));
  return `rgba(106, 18, 205, ${STEPS[bin]})`;
}

export default function UsageHeatmap({ data }: { data: UsageHeatmapData }) {
  const { matrix, max, total } = data;
  // The cell being read, as {dow, h}. Drives one styled tooltip anchored over
  // that cell — the browser's native `title` shows up late, styled by the OS,
  // and never on keyboard focus, so it read as "no hover state" at all.
  const [hover, setHover] = useState<{ dow: number; h: number } | null>(null);

  return (
    <div className="flex h-full flex-col">
      {/* A heat SURFACE, not a row of tiles.
          The cells are ~37px wide (a 24-column grid across the card) and were
          28px tall with 4px gutters all round, which is a chequerboard: the eye
          reads seven rows of separate lozenges rather than one continuous field,
          and a heatmap only works if the field is continuous enough for a dark
          patch to emerge from it. 2px gutters keep the field continuous.

          The rows GROW to fill the card. This card is stretched to the height of
          its taller row-mate (the pace chart), so a fixed-height grid left a void
          under it. Instead every row takes an equal share of the height and the
          cells get taller, never below the 20px hover floor (`min-h`). */}
      <div className="flex min-h-0 flex-1 flex-col gap-[2px]">
        {ROW_ORDER.map(dow => (
          <div key={dow} className="flex flex-1 items-stretch gap-1" style={{ minHeight: '1.5rem' }}>
            <span className="flex w-8 shrink-0 items-center justify-end pr-1.5 text-[0.625rem] font-medium text-ink-400">
              {DAY_LABELS[dow]}
            </span>
            {/* Relative, so the row can carry the tooltip for whichever of its
                cells is hovered, anchored over that column. */}
            <div className="relative grid flex-1 grid-rows-1 gap-[2px]" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
              {matrix[dow].map((v, h) => {
                const isHovered = hover?.dow === dow && hover.h === h;
                return (
                  <div
                    key={h}
                    tabIndex={0}
                    role="img"
                    aria-label={`${DAY_LABELS[dow]} ${fmtHour(h)}: ${v.toLocaleString('en-US')} action${v !== 1 ? 's' : ''}`}
                    onMouseEnter={() => setHover({ dow, h })}
                    onMouseLeave={() => setHover(c => (c?.dow === dow && c.h === h ? null : c))}
                    onFocus={() => setHover({ dow, h })}
                    onBlur={() => setHover(c => (c?.dow === dow && c.h === h ? null : c))}
                    className={`h-full min-h-[1.25rem] rounded-[3px] transition-transform duration-150 hover:scale-[1.12] focus-visible:scale-[1.12] ${
                      isHovered ? 'relative z-10 scale-[1.12] ring-1 ring-brand-500/40 ring-offset-1 ring-offset-canvas-elevated' : ''
                    }`}
                    style={{ backgroundColor: cellColor(v, max) }}
                  />
                );
              })}

              {/* One tooltip per row, shown only for the hovered cell. Anchored to
                  the column centre and pulled in at the ends so an edge cell's
                  card is not clipped. pointer-events-none so it never eats the
                  hover that summoned it. */}
              {hover?.dow === dow && (() => {
                const v = matrix[dow][hover.h];
                const frac = (hover.h + 0.5) / 24;
                const tx = frac < 0.12 ? '0%' : frac > 0.88 ? '-100%' : '-50%';
                // The cell's share of everything placed on the grid — the
                // calculation the shade stands for, said as a number.
                const share = total > 0 ? Math.round((v / total) * 100) : 0;
                return (
                  <div
                    className="absolute bottom-full z-40 mb-1.5 pointer-events-none"
                    style={{ left: `${frac * 100}%`, transform: `translateX(${tx})` }}
                  >
                    <div className="rounded-md border border-canvas-border bg-canvas-elevated px-2 py-1 shadow-[0_6px_18px_-6px_rgba(15,7,32,0.16)] whitespace-nowrap text-center">
                      <div className="text-[0.625rem] text-ink-400 leading-tight">
                        {DAY_LABELS[dow]} · {fmtHour(hover.h)} to {fmtHour((hover.h + 1) % 24)}
                      </div>
                      <div className="text-[0.75rem] font-semibold text-ink-900 tabular-nums leading-tight">
                        {v <= 0 ? 'No activity' : `${v.toLocaleString('en-US')} action${v !== 1 ? 's' : ''}`}
                      </div>
                      {v > 0 && (
                        <div className="text-[0.625rem] text-ink-400 tabular-nums leading-tight">
                          {share > 0 ? `${share}% of the week's work` : 'under 1% of the week'}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        ))}
        </div>

        {/* Hour axis — every fourth hour, so the labels never collide. */}
        <div className="flex items-center gap-1 pt-1.5">
          <span className="w-8 shrink-0" />
          <div className="flex-1 grid" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} className="text-[0.625rem] text-ink-400 tabular-nums">
                {h % 4 === 0 ? fmtHour(h) : ''}
              </span>
            ))}
          </div>
        </div>

      <div className="mt-4 flex items-center gap-1.5 text-[0.625rem] text-ink-400">
        <span>Quiet</span>
        <span className="w-3.5 h-3.5 rounded-xs" style={{ backgroundColor: EMPTY }} />
        {STEPS.map(a => (
          <span key={a} className="w-3.5 h-3.5 rounded-xs" style={{ backgroundColor: `rgba(106,18,205,${a})` }} />
        ))}
        <span>Busy</span>
        <span className="ml-auto tabular-nums">peak {max.toLocaleString('en-US')} actions in an hour</span>
      </div>
    </div>
  );
}
