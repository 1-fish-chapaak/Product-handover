/**
 * Platform Usage — when the work happens (PRD REQ-4.8).
 *
 * A weekday × hour grid. Every cell is one hour of one weekday, shaded by how
 * much work landed in it.
 *
 * WHY A GRID AND NOT TWO BAR CHARTS. This card was, for a while, two marginals: a
 * 7-bar "by day" chart beside a 24-bar "by hour" chart. The argument was density
 * — 168 cells over a few hundred events is ~3 events a cell, so most cells are 0
 * or 1, and a grid of mostly-empty cells looks like it is reporting noise.
 *
 * The argument is real but it proves the wrong thing. Two marginals cannot answer
 * the question the card's title asks. "Tuesday is the busiest day" and "09:00 is
 * the busiest hour" do NOT imply "Tuesday at 09:00 is busy" — that inference is
 * only valid if the two are independent, and the whole reason to look at a work
 * rhythm is that they are not. A team that does stand-ups Monday morning and
 * closes the books Thursday night produces exactly those two marginals and has no
 * Tuesday-morning peak at all. Only the joint cell can tell you, and the joint
 * cell is the one thing the marginals throw away.
 *
 * The sparseness is not noise either — it IS the finding. Work clusters into a
 * weekday business-hours block and nothing happens at 03:00 on a Sunday. A grid
 * that is empty in the corners and dense in the middle is a picture of a healthy
 * office rhythm, and an admin can read out-of-hours access off it at a glance,
 * which is the one thing on this card that could change a decision.
 *
 * What we do NOT do is fill the empty cells in. Reports and chats save a date but
 * no clock time (§8.3); those records are counted to one side, in words, under
 * the grid — never smeared across hours we would be guessing at. The grid's total
 * plus that count equals the window's action total, exactly.
 */

import { useMemo } from 'react';
import { type UsageHeatmapData } from '../../data/platform-usage';
import UsageHeatmap from './UsageHeatmap';
import { fmt } from './usageTokens';

const FULL_DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** The daytime band this chart uses to split day work from night work. It is the
 *  chart's own reference for the "in the daytime" share, NOT a claim about any
 *  organisation's set hours — different teams work different hours, and nothing
 *  here knows theirs. Stated out loud next to the number so no one mistakes it
 *  for a policy. */
const DAY_START = 8;
const DAY_END = 18;

export default function UsageRhythm({ data }: { data: UsageHeatmapData }) {
  const { matrix, total, untimed } = data;

  const reading = useMemo(() => {
    let peak = { dow: 1, hour: 9, value: 0 };
    let daytime = 0;
    let weekend = 0;

    matrix.forEach((row, dow) => {
      row.forEach((v, hour) => {
        if (v > peak.value) peak = { dow, hour, value: v };
        if (hour >= DAY_START && hour < DAY_END) daytime += v;
        if (dow === 0 || dow === 6) weekend += v;
      });
    });

    const byDay = matrix.map((row, dow) => ({ dow, total: row.reduce((s, v) => s + v, 0) }));
    const busiestDay = byDay.reduce((a, b) => (b.total > a.total ? b : a), byDay[0]);

    return {
      peak,
      busiestDay,
      daytimePct: total > 0 ? Math.round((daytime / total) * 100) : 0,
      weekendPct: total > 0 ? Math.round((weekend / total) * 100) : 0,
    };
  }, [matrix, total]);

  if (total === 0) {
    return <p className="text-[0.875rem] text-ink-400">No timed activity in this period, so there is no pattern to show.</p>;
  }

  return (
    // Fill the card: the reading and the untimed note keep their natural height,
    // and the heatmap in between takes whatever is left, so the grid grows to the
    // card's height instead of floating above a void. `flex-1` so this whole block
    // grows inside the card body (a flex column); `min-h-0` so the grid can shrink
    // on a short card rather than overflow.
    <div className="flex min-h-0 flex-1 flex-col">
      {/* The reading of the grid, before the grid. A heatmap makes a reader find
          the dark cell themselves; naming it costs one line and means the card
          works even for someone who only reads the first sentence. */}
      <p className="text-[0.875rem] text-ink-700 leading-relaxed">
        The team is most active on <span className="font-semibold text-ink-900">{FULL_DOW[reading.busiestDay.dow]}s</span>,
        and the busiest hour is{' '}
        <span className="font-semibold text-ink-900">
          {FULL_DOW[reading.peak.dow]} at {reading.peak.hour % 12 || 12}{reading.peak.hour < 12 ? 'am' : 'pm'}
        </span>{' '}
        (<span className="font-semibold text-ink-900 tabular-nums">{fmt(reading.peak.value)}</span> actions).{' '}
        <span className="font-semibold text-ink-900">{reading.daytimePct}%</span> of the work happens between 8am and 6pm,
        and just <span className="font-semibold text-ink-900">{reading.weekendPct}%</span> at the weekend.
      </p>

      <div className="mt-6 flex min-h-0 flex-1 flex-col">
        <UsageHeatmap data={data} />
      </div>

      {/* §8.3, said out loud. The grid is honestly smaller than the action total,
          and the page has to own that rather than let a reader add the cells up
          and find them short. */}
      {untimed > 0 && (
        <p className="mt-4 pt-3 border-t border-canvas-border text-[0.6875rem] text-ink-400 leading-relaxed">
          <span className="font-medium text-ink-500">{fmt(total)}</span> actions are placed on the grid.{' '}
          <span className="font-medium text-ink-500">{fmt(untimed)}</span> more (reports and saved chats) were saved
          with a date but no clock time, so there is no hour to put them in. They are counted everywhere else on this
          page. We leave them off here rather than spread them across hours we would be guessing at.
        </p>
      )}
    </div>
  );
}
