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
  const { matrix, max } = data;

  return (
    <div>
      {/* A heat SURFACE, not a row of tiles.
          The cells are ~37px wide (a 24-column grid across the card) and were
          28px tall with 4px gutters all round, which is a chequerboard: the eye
          reads seven rows of separate lozenges rather than one continuous field,
          and a heatmap only works if the field is continuous enough for a dark
          patch to emerge from it. 24px tall on a 2px gutter keeps every cell over
          the 20px hover minimum and lets Tuesday morning read as a block. */}
      <div className="space-y-[2px]">
        {ROW_ORDER.map(dow => (
          <div key={dow} className="flex items-center gap-1">
            <span className="w-8 shrink-0 pr-1.5 text-right text-[0.625rem] font-medium text-ink-400">
              {DAY_LABELS[dow]}
            </span>
            <div className="flex-1 grid gap-[2px]" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
              {matrix[dow].map((v, h) => (
                <div
                  key={h}
                  tabIndex={0}
                  role="img"
                  aria-label={`${DAY_LABELS[dow]} ${fmtHour(h)}: ${v.toLocaleString('en-US')} action${v !== 1 ? 's' : ''}`}
                  title={`${DAY_LABELS[dow]} ${fmtHour(h)} · ${v.toLocaleString('en-US')} action${v !== 1 ? 's' : ''}`}
                  className="h-6 rounded-[3px] transition-transform duration-150 hover:scale-[1.12] focus-visible:scale-[1.12]"
                  style={{ backgroundColor: cellColor(v, max) }}
                />
              ))}
            </div>
          </div>
        ))}

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
