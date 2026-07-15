/**
 * Platform Usage — which areas earn their keep (PRD REQ-5.5–5.8).
 *
 * Every area of the product carries two facts that matter for a licence: how many
 * people use it (reach, as a share of paid seats) and how hard they use it (depth,
 * events per person who touched it). The finding is not "Dashboards is last" — a
 * ranking gives you that — it is WHICH KIND of unused it is:
 *
 *   · Broad and shallow (Set up once) — everyone touches it once. Working as
 *     intended. Nothing to fix.
 *   · Narrow and deep (Specialist) — a few people live in it. A healthy
 *     specialist tool, not a failure.
 *   · Narrow and shallow (Barely used) — few people, and lightly. THIS is the one
 *     you improve or drop.
 *
 * WHY THIS IS NO LONGER A SCATTER. It was an Amplitude-style engagement matrix —
 * reach on x, depth on y, four quadrants, median crosshairs, de-collided labels.
 * It is the correct chart for a product analyst and the wrong one for the reader
 * this page actually has: a non-technical audit lead, who was told out loud that
 * it was a "confusing chart type". A scatter asks them to decode two axes and a
 * quadrant convention before they learn anything.
 *
 * The two dimensions are kept — they are the whole point — but the reader no
 * longer decodes a position to recover them. Each area is a row with a reach bar,
 * a depth bar, and a plain verdict naming its quadrant. "Barely used" areas rise
 * to attention in the mitigated hue. The classification is still the median-split
 * `quadrant` from `engagementMatrix`, unchanged — only its presentation is.
 */

import { useMemo } from 'react';
import type { AdminUser } from '../../context/AdminDataContext';
import {
  engagementMatrix, QUADRANT_NAME,
  type UsageDay, type MatrixQuadrant, type UsageModule,
} from '../../data/platform-usage';

/** Each verdict is a colour a reader learns once from the legend and then reads
 *  straight off the bars. Barely-used carries the attention hue; the two healthy
 *  "used" states are brand steps; set-up-once is a quiet neutral. */
const VERDICT_COLOR: Record<MatrixQuadrant, string> = {
  core: '#6A12CD',       // Everyday — full brand
  power: '#A366F0',      // Specialist — light brand
  onboarding: '#9A8FAE', // Set up once — neutral ink
  shelfware: '#B45309',  // Barely used — attention
};
const VERDICT_PILL: Record<MatrixQuadrant, string> = {
  core: 'bg-brand-50 text-brand-700',
  power: 'bg-brand-50 text-brand-700',
  onboarding: 'bg-ink-900/[0.05] text-ink-600',
  shelfware: 'bg-mitigated-700/[0.1] text-mitigated-700',
};

export default function UsageMatrix({ days, users, onSelect }: {
  days: UsageDay[];
  users: AdminUser[];
  /** Open an area's detail. Given, each bar becomes the map into the cards below. */
  onSelect?: (module: UsageModule) => void;
}) {
  const { points } = useMemo(() => engagementMatrix(days, users), [days, users]);

  // Sort by reach, busiest first — the order an audit lead scans in.
  const rows = useMemo(
    () => [...points].sort((a, b) => b.breadth - a.breadth || b.frequency - a.frequency),
    [points],
  );
  // Present in the data, in reading order, for the legend — no empty keys.
  const legendOrder: MatrixQuadrant[] = ['core', 'power', 'onboarding', 'shelfware'];
  const legend = legendOrder.filter(q => points.some(p => p.quadrant === q));

  if (points.length === 0) {
    return <p className="text-[0.8125rem] text-ink-400">No area was used in this period.</p>;
  }

  return (
    <div>
      {/* The key: one swatch per verdict the reader will meet on the bars. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-4">
        {legend.map(q => (
          <span key={q} className="inline-flex items-center gap-1.5 text-[0.6875rem] text-ink-600">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: VERDICT_COLOR[q] }} />
            {QUADRANT_NAME[q]}
          </span>
        ))}
      </div>

      {/* One bar per area. Length is reach (share of people); colour is the
          verdict; the actions-each figure rides at the end. Two facts the retired
          scatter needed two axes for, now read straight off a coloured bar. */}
      <div className="space-y-1">
        {rows.map(p => {
          const color = VERDICT_COLOR[p.quadrant];
          const shelf = p.quadrant === 'shelfware';
          const Row = onSelect ? 'button' : 'div';
          return (
            <Row
              key={p.module}
              {...(onSelect
                ? {
                    type: 'button' as const,
                    onClick: () => onSelect(p.module),
                    // NOT the "open details" suffix the tile QA selectors key on.
                    'aria-label': `${p.module}, ${QUADRANT_NAME[p.quadrant]}, ${p.breadth}% of people, open this area`,
                  }
                : {})}
              className={`group w-full flex items-center gap-3 py-2 px-2 -mx-2 rounded-lg text-left transition-colors ${
                onSelect ? 'cursor-pointer hover:bg-brand-50/50' : ''
              }`}
            >
              <span className={`w-28 shrink-0 text-[0.8125rem] font-medium truncate ${shelf ? 'text-mitigated-700' : 'text-ink-800'}`}>
                {p.module}
              </span>

              <div className="flex-1 min-w-0 flex items-center gap-2.5">
                <div className="flex-1 h-2.5 rounded-full bg-ink-900/[0.05] overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.max(3, p.breadth)}%`, background: color }}
                  />
                </div>
                <span className="shrink-0 w-9 text-right text-[0.8125rem] font-semibold tabular-nums text-ink-800">
                  {p.breadth}%
                </span>
              </div>

              <span className="shrink-0 w-24 text-right text-[0.6875rem] text-ink-400 tabular-nums hidden sm:inline">
                {p.frequency} each
              </span>

              <span className={`shrink-0 inline-flex items-center h-5 px-2 rounded-full text-[0.625rem] font-medium whitespace-nowrap ${VERDICT_PILL[p.quadrant]}`}>
                {QUADRANT_NAME[p.quadrant]}
              </span>
            </Row>
          );
        })}
      </div>

      {/* No "barely used" sentence here: the Areas lede above this card already
          states it in exactly these words, and the shelfware rows carry it
          visually in the attention hue. A third printing on one tab was the
          redundancy, not the finding. */}
    </div>
  );
}
