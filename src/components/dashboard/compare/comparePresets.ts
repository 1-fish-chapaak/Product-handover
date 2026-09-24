import type { ComparePresetId, CompareSide, Grain, PeriodSeries } from './compareTypes';

export type { Grain };

// Date-range helpers for Compare. All ranges are inclusive ISO yyyy-mm-dd
// strings; arithmetic is done in UTC so a range never drifts across a
// timezone boundary. The mock data year is 2026.

export interface DateRange { from: string; to: string }

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

export const isoOf = (d: Date): string => d.toISOString().slice(0, 10);
const utc = (y: number, m0: number, d: number) => new Date(Date.UTC(y, m0, d));
const parse = (iso: string): Date => new Date(`${iso}T00:00:00Z`);

export function monthRange(year: number, month1to12: number): DateRange {
  const m0 = month1to12 - 1;
  return { from: isoOf(utc(year, m0, 1)), to: isoOf(utc(year, m0 + 1, 0)) };
}
export function quarterRange(year: number, q: 1 | 2 | 3 | 4): DateRange {
  const m0 = (q - 1) * 3;
  return { from: isoOf(utc(year, m0, 1)), to: isoOf(utc(year, m0 + 3, 0)) };
}
/** Inclusive day count. */
export function daysIn(r: DateRange): number {
  return Math.round((parse(r.to).getTime() - parse(r.from).getTime()) / 86_400_000) + 1;
}
/** The same-length range immediately before `of`. */
export function previousPeriod(of: DateRange): DateRange {
  const n = daysIn(of);
  const end = parse(of.from); end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end); start.setUTCDate(start.getUTCDate() - (n - 1));
  return { from: isoOf(start), to: isoOf(end) };
}
/** A whole calendar month? → { year, month1to12 }. */
export function asWholeMonth(r: DateRange): { year: number; month: number } | null {
  const f = parse(r.from);
  const mr = monthRange(f.getUTCFullYear(), f.getUTCMonth() + 1);
  return mr.from === r.from && mr.to === r.to ? { year: f.getUTCFullYear(), month: f.getUTCMonth() + 1 } : null;
}
export function asWholeQuarter(r: DateRange): { year: number; q: 1 | 2 | 3 | 4 } | null {
  const f = parse(r.from);
  for (const q of [1, 2, 3, 4] as const) {
    const qr = quarterRange(f.getUTCFullYear(), q);
    if (qr.from === r.from && qr.to === r.to) return { year: f.getUTCFullYear(), q };
  }
  return null;
}
export function asWholeYear(r: DateRange): number | null {
  const y = parse(r.from).getUTCFullYear();
  return r.from === `${y}-01-01` && r.to === `${y}-12-31` ? y : null;
}

const dayMon = (iso: string) => { const d = parse(iso); return `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}`; };

/** '15 Aug 2026' for one day, 'May 2026' for an exact month, 'Q3 2026' for a
 *  quarter, '2026' for a whole year, else '1 May – 15 Aug 2026'. */
export function rangeLabel(r: DateRange): string {
  if (r.from === r.to) return `${dayMon(r.from)} ${parse(r.from).getUTCFullYear()}`;
  const m = asWholeMonth(r);
  if (m) return `${MONTHS_SHORT[m.month - 1]} ${m.year}`;
  const q = asWholeQuarter(r);
  if (q) return `Q${q.q} ${q.year}`;
  const y = asWholeYear(r);
  if (y) return String(y);
  const f = parse(r.from), t = parse(r.to);
  if (f.getUTCFullYear() === t.getUTCFullYear()) return `${dayMon(r.from)} – ${dayMon(r.to)} ${t.getUTCFullYear()}`;
  return `${dayMon(r.from)} ${f.getUTCFullYear()} – ${dayMon(r.to)} ${t.getUTCFullYear()}`;
}

export const PRESET_OPTIONS: { id: ComparePresetId; label: string; forSide: 'a' | 'b' | 'both' }[] = [
  { id: 'this-month', label: 'This month', forSide: 'both' },
  { id: 'last-month', label: 'Last month', forSide: 'both' },
  { id: 'this-quarter', label: 'This quarter', forSide: 'both' },
  { id: 'last-quarter', label: 'Last quarter', forSide: 'both' },
  // A is the baseline (earlier), B the current side — so the relative presets live on A.
  { id: 'same-month-last-year', label: 'Same month last year', forSide: 'a' },
  { id: 'previous-period', label: 'Previous period', forSide: 'a' },
];

/** Resolve a preset. `opposite` is the other side's range (needed for
 *  previous-period / same-month-last-year). `anchor` defaults to today. */
export function presetRange(id: ComparePresetId, anchor: Date = new Date(), opposite?: DateRange): DateRange {
  const y = anchor.getUTCFullYear(), m = anchor.getUTCMonth() + 1;
  const q = (Math.floor((m - 1) / 3) + 1) as 1 | 2 | 3 | 4;
  switch (id) {
    case 'this-month': return monthRange(y, m);
    case 'last-month': return m === 1 ? monthRange(y - 1, 12) : monthRange(y, m - 1);
    case 'this-quarter': return quarterRange(y, q);
    case 'last-quarter': return q === 1 ? quarterRange(y - 1, 4) : quarterRange(y, (q - 1) as 1 | 2 | 3 | 4);
    case 'previous-period': return previousPeriod(opposite ?? monthRange(y, m));
    case 'same-month-last-year': {
      const base = opposite ?? monthRange(y, m);
      const f = parse(base.from), t = parse(base.to);
      const wm = asWholeMonth(base);
      if (wm) return monthRange(wm.year - 1, wm.month);
      return { from: isoOf(utc(f.getUTCFullYear() - 1, f.getUTCMonth(), f.getUTCDate())), to: isoOf(utc(t.getUTCFullYear() - 1, t.getUTCMonth(), t.getUTCDate())) };
    }
  }
}

/** 'may' | 'august' | 'aug' | 'q3' | 'h1' → a range in `year` (data year 2026 by default). */
export function parsePeriodToken(token: string, year = 2026): DateRange | null {
  const t = token.trim().toLowerCase();
  const q = t.match(/^q([1-4])(?:\s+(\d{4}))?$/);
  if (q) return quarterRange(q[2] ? Number(q[2]) : year, Number(q[1]) as 1 | 2 | 3 | 4);
  const h = t.match(/^h([12])(?:\s+(\d{4}))?$/);
  if (h) { const yy = h[2] ? Number(h[2]) : year; return h[1] === '1' ? { from: `${yy}-01-01`, to: `${yy}-06-30` } : { from: `${yy}-07-01`, to: `${yy}-12-31` }; }
  const m = t.match(/^([a-z]+)(?:\s+(\d{4}))?$/);
  if (m) {
    const idx = MONTHS_LONG.findIndex(name => name === m[1] || name.slice(0, 3) === m[1] || (m[1] === 'sept' && name === 'september'));
    if (idx >= 0) return monthRange(m[2] ? Number(m[2]) : year, idx + 1);
  }
  return null;
}

// ─── Grain: one date + a view ───
// The popover's simple path. The user picks a single date and the view they
// want it read in; B becomes the period containing that date and A the one
// immediately before, so "Aug vs Jul" needs one click, not four fields.

export const GRAIN_OPTIONS: { id: Grain; label: string; noun: string; plural: string }[] = [
  { id: 'day', label: 'Daily', noun: 'day', plural: 'days' },
  { id: 'week', label: 'Weekly', noun: 'week', plural: 'weeks' },
  { id: 'month', label: 'Monthly', noun: 'month', plural: 'months' },
  { id: 'quarter', label: 'Quarterly', noun: 'quarter', plural: 'quarters' },
  { id: 'year', label: 'Yearly', noun: 'year', plural: 'years' },
];
export const grainMeta = (g: Grain) => GRAIN_OPTIONS.find(o => o.id === g)!;

/** The whole day / week (Mon–Sun) / month / quarter / year containing `iso`. */
export function periodOf(grain: Grain, iso: string): DateRange {
  const d = parse(iso);
  const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1;
  switch (grain) {
    case 'day': return { from: iso, to: iso };
    case 'week': {
      const mondayOffset = (d.getUTCDay() + 6) % 7;
      const start = new Date(d); start.setUTCDate(start.getUTCDate() - mondayOffset);
      const end = new Date(start); end.setUTCDate(end.getUTCDate() + 6);
      return { from: isoOf(start), to: isoOf(end) };
    }
    case 'month': return monthRange(y, m);
    case 'quarter': return quarterRange(y, (Math.floor((m - 1) / 3) + 1) as 1 | 2 | 3 | 4);
    case 'year': return { from: `${y}-01-01`, to: `${y}-12-31` };
  }
}

/** The same period `by` steps away, counted in calendar units — so the month
 *  before March is February, not "31 days earlier". */
export function shiftPeriod(grain: Grain, r: DateRange, by: number): DateRange {
  const f = parse(r.from);
  const y = f.getUTCFullYear(), m0 = f.getUTCMonth();
  switch (grain) {
    case 'day': case 'week': {
      const step = grain === 'day' ? by : by * 7;
      const s = new Date(f); s.setUTCDate(s.getUTCDate() + step);
      const e = parse(r.to); e.setUTCDate(e.getUTCDate() + step);
      return { from: isoOf(s), to: isoOf(e) };
    }
    case 'month': return monthRange(y + Math.floor((m0 + by) / 12), ((((m0 + by) % 12) + 12) % 12) + 1);
    case 'quarter': {
      const q0 = Math.floor(m0 / 3) + by;
      return quarterRange(y + Math.floor(q0 / 4), ((((q0 % 4) + 4) % 4) + 1) as 1 | 2 | 3 | 4);
    }
    case 'year': return { from: `${y + by}-01-01`, to: `${y + by}-12-31` };
  }
}

/** Which view a saved A/B pair reads as — null when it is a free custom range. */
export function detectGrain(a: DateRange, b: DateRange): Grain | null {
  for (const { id } of GRAIN_OPTIONS) {
    const whole = periodOf(id, b.from);
    if (whole.from !== b.from || whole.to !== b.to) continue;
    const prev = shiftPeriod(id, whole, -1);
    if (prev.from === a.from && prev.to === a.to) return id;
  }
  return null;
}

/** More than this many periods stops being a comparison and starts being a
 *  table nobody reads — the popover asks for a coarser view instead. */
export const MAX_PERIODS = 60;

/** Every whole period of `grain` that overlaps `span`, in order. The edges are
 *  snapped outwards, so 15 Jan → 3 Mar read monthly is Jan, Feb, Mar. */
export function periodsIn(span: DateRange, grain: Grain, cap = MAX_PERIODS): DateRange[] {
  const out: DateRange[] = [];
  const last = periodOf(grain, span.to < span.from ? span.from : span.to);
  let cur = periodOf(grain, span.from);
  while (cur.from <= last.from && out.length <= cap) { out.push(cur); cur = shiftPeriod(grain, cur, 1); }
  return out;
}
/** How many periods a span would produce — counted without building them all. */
export function countPeriods(span: DateRange, grain: Grain): number {
  const f = parse(span.from), t = parse(span.to < span.from ? span.from : span.to);
  switch (grain) {
    case 'day': return daysIn({ from: span.from, to: span.to < span.from ? span.from : span.to });
    case 'week': return Math.floor((parse(periodOf('week', isoOf(t)).from).getTime() - parse(periodOf('week', isoOf(f)).from).getTime()) / (7 * 86_400_000)) + 1;
    case 'month': return (t.getUTCFullYear() - f.getUTCFullYear()) * 12 + (t.getUTCMonth() - f.getUTCMonth()) + 1;
    case 'quarter': return (t.getUTCFullYear() - f.getUTCFullYear()) * 4 + (Math.floor(t.getUTCMonth() / 3) - Math.floor(f.getUTCMonth() / 3)) + 1;
    case 'year': return t.getUTCFullYear() - f.getUTCFullYear() + 1;
  }
}
/** The span a series covers, edge to edge. */
export function seriesSpan(p: PeriodSeries): DateRange {
  const list = periodsIn({ from: p.from, to: p.to }, p.grain);
  return list.length ? { from: list[0].from, to: list[list.length - 1].to } : { from: p.from, to: p.to };
}

export const periodSide = (r: DateRange, label = rangeLabel(r)): CompareSide => ({ kind: 'period', from: r.from, to: r.to, label });
/** The sides a period series resolves to. */
export const periodSidesOf = (p: PeriodSeries): CompareSide[] => periodsIn({ from: p.from, to: p.to }, p.grain).map(r => periodSide(r));
export const sideRange = (s: CompareSide): DateRange | null => (s.kind === 'period' ? { from: s.from, to: s.to } : null);
