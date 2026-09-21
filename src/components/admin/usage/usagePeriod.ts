/**
 * The date filter, on this page's clock.
 *
 * Both usage tabs narrow by a pair of ISO dates, and the platform's date
 * control (`shared/DateFilterPicker`, the "All time" button on the Knowledge
 * Hub) speaks in presets plus a custom range. These two functions translate,
 * in both directions, so the picker can be dropped in unchanged.
 *
 * The clock matters here. Usage runs on a fixed seed that ends on 31 March
 * 2026, so "Last 30 days" measured from the real wall clock would hand back an
 * empty window. Every preset is resolved from that anchor instead, which is
 * also why both tabs pass `showPresetDates`: the picker then prints the days a
 * preset really covers rather than a promise it cannot keep.
 */

import { DATE_PRESETS, type DateFilter } from '../../shared/DateFilterPicker';
import { ANCHOR, DAY_MS } from '../../../data/usage/seed';
import { USAGE_TURNS } from '../../../data/usage/metering';

/** The newest day the history holds: this page's "today". */
export const PERIOD_TODAY = new Date(ANCHOR);

/** The oldest day it holds. Only "All time" needs it, to name its own start. */
export const PERIOD_EARLIEST = new Date(
  USAGE_TURNS.reduce((min, t) => Math.min(min, Date.parse(t.created_at)), Number.POSITIVE_INFINITY),
);

const utcDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** The days a picker answer actually means. Windows include both ends. */
export function periodRange(filter: DateFilter): { date_from?: string; date_to?: string } {
  if (filter.kind === 'custom') return { date_from: filter.from, date_to: filter.to };
  if (filter.id === 'all') return {};
  const to = utcDay(PERIOD_TODAY);
  const days = DATE_PRESETS.find(p => p.id === filter.id)?.days ?? null;
  if (!days) return { date_from: iso(to), date_to: iso(to) };
  return { date_from: iso(to - (days - 1) * DAY_MS), date_to: iso(to) };
}

/** What the picker should read, given the days the page is already using. A
 *  preset that resolves to exactly this window comes back as that preset, so
 *  "Last 30 days" still says "Last 30 days" after a round trip. */
export function periodFilter(date_from?: string, date_to?: string): DateFilter {
  if (!date_from && !date_to) return { kind: 'preset', id: 'all' };
  for (const p of DATE_PRESETS) {
    const r = periodRange({ kind: 'preset', id: p.id });
    if (r.date_from === date_from && r.date_to === date_to) return { kind: 'preset', id: p.id };
  }
  return { kind: 'custom', from: date_from ?? '', to: date_to ?? '' };
}
