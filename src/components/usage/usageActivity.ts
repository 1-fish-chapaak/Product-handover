/**
 * Platform Usage — the activity chart's derivation (pure functions only).
 *
 * Kept apart from the chart component so Fast Refresh stays happy: a module may
 * export components OR constants and functions, not both.
 *
 * The history here is worth knowing, because both previous attempts were wrong
 * in instructive ways.
 *
 *   1. A raw daily LINE. A GRC team works weekdays, so the line was mostly a
 *      picture of the weekend — it crashed every Saturday and spiked every
 *      Tuesday. The loudest feature of the chart was the calendar.
 *   2. So it became WEEKLY COLUMNS, to cancel that cycle. Right diagnosis,
 *      wrong cure: 30 days is four columns, and four columns in a 1,000px plot
 *      means the gap between bars is ~470% of the bar width. It didn't read as
 *      sparse, it read as broken. Worse, it threw away the day-level truth —
 *      and an auditor absolutely will ask "what happened on the 14th".
 *
 * The actual answer is the one Amplitude ships: keep the real days as bars, and
 * lay a 7-day rolling average over the top. The bars keep the truth, the line
 * carries the trend, and the weekend gets SHADED rather than smoothed away — so
 * the reader can see that the dip is Saturday instead of inferring a collapse.
 */

import type { AuditLog } from '../../context/AdminDataContext';
import { usageAnchor, usageDayLabel, oddDayTest, type UsageDay } from '../../data/platform-usage';
import { fmt } from './usageTokens';

const DAY_MS = 86400000;

/** The rolling window. Seven, because that is exactly one weekly cycle — any
 *  other width leaves day-of-week artefacts in the line. */
const ROLLING = 7;

export interface ActivityPoint {
  label: string;
  /** Everything the AI was involved in (Ask IRA questions + Concierge tool runs). */
  ai: number;
  /** Everything else. `ai + rest` is the day's total actions, exactly. */
  rest: number;
  total: number;
  /** The 7-day trailing average of `total`. Null until there are 7 days behind it. */
  rolling: number | null;
  /** Saturday or Sunday. Drives the shading, so a dip reads as "the weekend". */
  weekend: boolean;
  /** The previous window's total at the same position, for the compare overlay. */
  prior: number | null;
  /**
   * An "odd day" (PRD §7.1): above mean + 2 standard deviations for days OF ITS
   * OWN KIND — weekdays judged against weekdays, weekends against weekends.
   *
   * Marked ON the plot, because a spike the reader has to find themselves is a
   * spike the chart failed to report. It runs the same `oddDayTest` that
   * `usageSpikes()` runs, so the rings and the sentence under the chart cannot
   * disagree about which day was strange.
   */
  spike: boolean;
}

/**
 * One point per day, oldest first.
 *
 * `aiEvents` is a strict subset of `actions` (both are audit-log rows), so the
 * stack is honest: the two segments sum to the total and nothing is counted
 * twice. `aiConversations` is deliberately NOT in here — saved chats are not
 * audit actions, and adding them would make the segments overflow the bar.
 */
export function activityPoints(days: UsageDay[], priorDays: UsageDay[], logs: AuditLog[]): ActivityPoint[] {
  const totals = days.map(d => d.actions);
  // The weekday is walked back from the anchor, the same anchor the axis labels
  // are built from — so the shading always lines up with the dates it shades.
  const anchor = usageAnchor(logs);

  /* The odd-day test, from the ONE function that defines it. This module used to
     carry its own copy of the arithmetic, and the copy was wrong in exactly the
     way the original was — it judged a Sunday against a Tuesday. Sharing the test
     means the rings on the chart and the sentence underneath cannot disagree about
     which day was strange. See `oddDayTest` for why this is day-type aware. */
  const odd = oddDayTest(days, logs);

  return days.map((d, i) => {
    const total = d.actions;
    const ai = Math.min(total, d.aiEvents);

    // Trailing average — never centred. A centred window would let a future day
    // move today's line, which on a live page is a small lie.
    const from = i - (ROLLING - 1);
    const rolling = from < 0
      ? null
      : totals.slice(from, i + 1).reduce((a, b) => a + b, 0) / ROLLING;

    const dow = new Date(anchor - d.dayOffset * DAY_MS).getDay();

    return {
      label: usageDayLabel(d.dayOffset, logs),
      ai,
      rest: total - ai,
      total,
      rolling: rolling === null ? null : Math.round(rolling * 10) / 10,
      weekend: dow === 0 || dow === 6,
      prior: priorDays[i]?.actions ?? null,
      // Judged against days of its own kind. `oddDayTest` marks nothing when a
      // window has fewer than three days of that kind, which is honest: the
      // biggest of three days is not an anomaly, it is just the biggest.
      spike: odd.isOdd(d),
    };
  });
}

/** The AI strip's own peak — printed on the strip, because a chart with its own
 *  scale has to say what that scale tops out at or the height means nothing. */
export function aiPeak(points: ActivityPoint[]): { value: number; label: string } | null {
  const top = points.reduce<ActivityPoint | null>(
    (best, p) => (p.ai > 0 && (!best || p.ai > best.ai) ? p : best),
    null,
  );
  return top ? { value: top.ai, label: top.label } : null;
}

/** Contiguous weekend runs, as [startLabel, endLabel] pairs, for the shading. */
export function weekendSpans(points: ActivityPoint[]): [string, string][] {
  const spans: [string, string][] = [];
  let start: string | null = null;
  points.forEach((p, i) => {
    if (p.weekend && start === null) start = p.label;
    const ends = p.weekend && (i === points.length - 1 || !points[i + 1].weekend);
    if (ends && start !== null) {
      spans.push([start, p.label]);
      start = null;
    }
  });
  return spans;
}

/**
 * The one-sentence reading of the chart, for the summary strip.
 *
 * The trend is read off the ROLLING line, not the raw days — the raw days are
 * exactly the noise the rolling line exists to cancel, and a verdict computed
 * from them would flip on a single quiet Friday.
 */
export function activityTakeaway(points: ActivityPoint[]): string {
  if (!points.length || points.every(p => p.total === 0)) return 'Nothing happened in this period';

  const perDay = Math.round(points.reduce((s, p) => s + p.total, 0) / points.length);

  const line = points.map(p => p.rolling).filter((v): v is number => v !== null);
  if (line.length < 2) {
    return `About ${fmt(perDay)} ${perDay === 1 ? 'action' : 'actions'} a day`;
  }

  const head = line[0];
  const tail = line[line.length - 1];
  const change = head === 0 ? 0 : Math.round(((tail - head) / head) * 100);

  // Plain words a person would actually say — no "the period", no chart terms.
  // Just: did it stay about the same, or go up/down, and by how much.
  const shape =
    Math.abs(change) < 15 ? 'and it stayed about the same'
      : change > 0 ? `and it rose ${change}% by the end`
        : `and it fell ${Math.abs(change)}% by the end`;

  return `About ${fmt(perDay)} ${perDay === 1 ? 'action' : 'actions'} a day, ${shape}`;
}
