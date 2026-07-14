/**
 * Platform Usage — how concentrated the work is.
 *
 * A Lorenz curve over the members: rank everyone by how much they did, then plot
 * the cumulative share of all activity as you add them one by one. The straight
 * diagonal is what perfect spread would look like — every member doing an equal
 * share. The GAP between the curve and that diagonal is the concentration, and
 * it is the only thing on this chart worth looking at.
 *
 * WHY THIS CHART EXISTS. "The top 3 people do 42% of everything" is the single
 * finding on this page that an admin cannot get from any other screen, and the
 * PRD says so out loud: a healthy-looking total is exactly what conceals it. You
 * can have 525 actions and a rising trend and still be one resignation away from
 * the platform going quiet, and no total, no ranking and no table will tell you —
 * a total hides it by construction, and a table makes you do the arithmetic
 * across seventeen rows.
 *
 * Until now that finding was a number in a small card. It is the page's most
 * important sentence and it had no picture. This is the picture.
 *
 * Reading it:
 *   · Curve hugging the diagonal → the work is spread. Losing anyone costs a
 *     proportional amount.
 *   · Curve bowed hard to the top-left → a handful of people ARE the platform.
 *     That is a key-person risk, and it is also what "we rolled it out" looks
 *     like when in truth three people adopted it and nobody else did.
 */

import { useMemo } from 'react';
import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceDot,
} from 'recharts';
import type { UserUsageRow } from '../../data/platform-usage';
import { TooltipCard } from './usageChrome';
import { GRID, SERIES, CROSSHAIR, xAxisProps, yAxisProps, fmt } from './usageTokens';

/** The share at which the page calls concentration a finding (PRD REQ-3.4). */
const CONCENTRATED_AT = 60;

interface Point {
  /** How many members deep we are: 0, 1, 2 … */
  rank: number;
  /** Cumulative share of all activity, 0–100. */
  cum: number;
  /** Perfect spread, for the same rank — the diagonal. */
  equal: number;
  /** Who was added at this rank. */
  name: string;
  actions: number;
}

export default function UsageConcentration({ rows, topShare }: {
  rows: UserUsageRow[];
  /** The top-3 share the rest of the page prints. Passed in so the chart and the
   *  finding can never disagree — they are the same number, drawn and said. */
  topShare: number | null;
}) {
  const { points, total, active, topThree } = useMemo(() => {
    // Only people who did something. A member with zero actions adds a flat step
    // to the tail of the curve and says nothing about how the WORK is spread —
    // "nobody has a seat that does nothing" is a different finding, and the seat
    // funnel above already owns it.
    const doers = rows.filter(r => r.actions > 0).sort((a, b) => b.actions - a.actions);
    const sum = doers.reduce((s, r) => s + r.actions, 0);
    const n = doers.length;

    const pts: Point[] = [{ rank: 0, cum: 0, equal: 0, name: '', actions: 0 }];
    let run = 0;
    doers.forEach((r, i) => {
      run += r.actions;
      pts.push({
        rank: i + 1,
        cum: sum > 0 ? (run / sum) * 100 : 0,
        equal: n > 0 ? ((i + 1) / n) * 100 : 0,
        name: r.user.name,
        actions: r.actions,
      });
    });

    return {
      points: pts,
      total: sum,
      active: n,
      topThree: pts[Math.min(3, pts.length - 1)] ?? null,
    };
  }, [rows]);

  if (active < 2) {
    return (
      <p className="text-[0.8125rem] text-ink-400">
        Too few active members in this period to say anything about how the work is spread.
      </p>
    );
  }

  const concentrated = typeof topShare === 'number' && topShare >= CONCENTRATED_AT;

  return (
    <div className="flex flex-1 flex-col">
      {/* The reading, before the chart. */}
      <p className="text-[0.8125rem] text-ink-700 leading-relaxed">
        {topThree && (
          <>
            The busiest <span className="font-semibold text-ink-900">3</span> of{' '}
            <span className="font-semibold text-ink-900">{active}</span> active members do{' '}
            <span className={`font-semibold ${concentrated ? 'text-mitigated-700' : 'text-ink-900'}`}>
              {Math.round(topThree.cum)}%
            </span>{' '}
            of all the work.{' '}
            {concentrated
              ? 'The team is leaning on a handful of people. The totals look healthy because those few are carrying them.'
              : 'The work is reasonably spread across the team.'}
          </>
        )}
      </p>

      {/* The plot GROWS into the card rather than sitting at a fixed 240px inside
          it. This card shares a row with the taller AI panel, so the row stretches
          it, and a fixed-height chart left the extra as a hand-sized hole between
          the caption and the card's foot. Slack at the bottom of a card reads as
          padding; slack in the middle reads as something that failed to load. */}
      <div className="mt-5 flex-1 min-h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 8, right: 12, left: 0, bottom: 16 }}>
            <defs>
              <linearGradient id="concentration-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIES.primary} stopOpacity={0.16} />
                <stop offset="100%" stopColor={SERIES.primary} stopOpacity={0.01} />
              </linearGradient>
            </defs>

            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis
              dataKey="rank"
              type="number"
              domain={[0, active]}
              allowDecimals={false}
              {...xAxisProps}
              label={{
                value: 'Members, busiest first  →',
                position: 'insideBottom',
                offset: -12,
                style: { fontSize: 10, fill: '#9A8FAE', textAnchor: 'middle' },
              }}
            />
            <YAxis
              domain={[0, 100]}
              {...yAxisProps}
              width={44}
              tickFormatter={(v: number) => `${v}%`}
            />

            <Tooltip
              isAnimationActive={false}
              cursor={CROSSHAIR}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              content={({ active: on, payload }: any) => {
                if (!on || !payload?.length) return null;
                const p = payload[0].payload as Point;
                if (p.rank === 0) return null;
                return (
                  <TooltipCard
                    title={`The busiest ${p.rank} ${p.rank === 1 ? 'member' : 'members'}`}
                    rows={[
                      { color: SERIES.primary, name: 'Share of all work', value: Math.round(p.cum) },
                      { color: SERIES.compare, name: 'If it were spread evenly', value: Math.round(p.equal) },
                    ]}
                    footer={<>Newest in: <span className="font-semibold text-ink-700">{p.name}</span> · {fmt(p.actions)} of {fmt(total)} actions</>}
                  />
                );
              }}
            />

            {/* Perfect spread. Dashed and achromatic, because it is not a series —
                it is the benchmark the curve is read against, and this page draws
                thresholds dashed and everything else solid. */}
            <Line
              type="linear"
              dataKey="equal"
              name="If it were spread evenly"
              stroke={SERIES.compare}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              isAnimationActive={false}
            />

            {/* The truth. The area under it is filled, so the GAP to the diagonal
                — which is the entire finding — reads as a shape rather than as
                two lines a reader has to mentally subtract. */}
            <Area
              type="monotone"
              dataKey="cum"
              name="What actually happens"
              stroke={SERIES.primary}
              strokeWidth={2.5}
              fill="url(#concentration-fill)"
              isAnimationActive={false}
            />

            {/* Where the top 3 land. This is the number the rest of the page
                quotes, so it gets a mark rather than being left for the reader to
                find by counting along the axis. */}
            {topThree && topThree.rank === 3 && (
              <ReferenceDot
                x={3}
                y={topThree.cum}
                r={5}
                fill="#FFFFFF"
                stroke={concentrated ? SERIES.attention : SERIES.primary}
                strokeWidth={2.5}
                label={{
                  value: `Top 3 · ${Math.round(topThree.cum)}%`,
                  position: 'right',
                  offset: 10,
                  style: {
                    fontSize: 10.5,
                    fontWeight: 600,
                    fill: concentrated ? SERIES.attention : '#5C5170',
                  },
                }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-2 text-[0.6875rem] text-ink-400 leading-relaxed">
        The dashed line is what an even split would look like, with every active member doing the same amount. The
        gap between it and the curve is how much the team leans on its busiest people.
      </p>
    </div>
  );
}
