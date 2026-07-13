/**
 * Platform Usage — activity rhythm heatmap (weekday x hour).
 *
 * Brand-tint punch card of when work happens in the selected range. Cell
 * opacity scales with volume (single brand hue, never a red-amber-green
 * ramp) and every cell carries an exact count in its hover title. The grid
 * sums exactly to the window's action total (largest-remainder distribution
 * in usageHourlyMatrix).
 */

import { USAGE_DAY_LABELS as DAY_LABELS, type UsageHeatmapData } from '../../data/platform-usage';

/** Business-first row order: Monday to Sunday. */
const ROW_ORDER = [1, 2, 3, 4, 5, 6, 0];

const fmtHour = (h: number) => `${String(h).padStart(2, '0')}:00`;

export default function UsageHeatmap({ data }: { data: UsageHeatmapData }) {
  const { matrix, max } = data;

  return (
    <div>
      <div className="space-y-1">
        {ROW_ORDER.map(dow => (
          <div key={dow} className="flex items-center gap-1">
            <span className="w-8 shrink-0 text-[0.625rem] font-medium text-ink-400 text-right pr-1">{DAY_LABELS[dow]}</span>
            <div className="flex-1 grid gap-1" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
              {matrix[dow].map((v, h) => (
                <div
                  key={h}
                  title={`${DAY_LABELS[dow]} ${fmtHour(h)} · ${v.toLocaleString('en-US')} action${v !== 1 ? 's' : ''}`}
                  className="h-4 rounded-xs"
                  style={{ backgroundColor: v === 0 ? 'rgba(106,18,205,0.04)' : `rgba(106,18,205,${0.08 + 0.72 * (v / max)})` }}
                />
              ))}
            </div>
          </div>
        ))}
        {/* Hour axis */}
        <div className="flex items-center gap-1">
          <span className="w-8 shrink-0" />
          <div className="flex-1 grid" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} className="text-[0.5625rem] text-ink-400 tabular-nums">
                {h % 4 === 0 ? fmtHour(h) : ''}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-[0.625rem] text-ink-400">
        Less
        {[0.08, 0.26, 0.44, 0.62, 0.8].map(a => (
          <span key={a} className="w-3 h-3 rounded-xs" style={{ backgroundColor: `rgba(106,18,205,${a})` }} />
        ))}
        More
      </div>
    </div>
  );
}
