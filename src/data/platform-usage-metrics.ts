/**
 * Platform Usage. The figures.
 *
 * The records live next door in `platform-usage.ts`. This module turns them
 * into the numbers one reader, the audit lead, reads over two windows, and it
 * holds the rules that stop those numbers being wrong in the ways the guide
 * warns about.
 *
 * ## The rules that live here rather than in a component
 *
 * **Coverage counts a population once.** A monthly check over a rolling window
 * re-tests the same rows every month; adding them up would inflate coverage
 * roughly elevenfold and the first person to notice would stop believing the
 * page. So coverage counts the population, and the repeats are counted
 * separately and called checks performed.
 *
 * **Failed runs are excluded from every hours figure.** They are reported on
 * their own as wasted machine time. Most honest, least flattering.
 *
 * **Nothing is presented as fact that is not recorded.** A measured number
 * states its source and its sample. An assumed one carries the word estimated
 * and its label, on the same screen as the figure it produces.
 *
 * **Nothing on this page is money we worked out.** The one rupee figure is the
 * charge the contract makes for recorded volume. Every saving, and the rate for
 * an auditor hour that produced it, is gone: nothing in a customer tenant
 * records what anybody is paid, so that figure was ours rather than theirs.
 *
 * **Scope narrows and never widens.** How far a reader may look comes from the
 * role, the filter only ever offers what they are already entitled to, and it
 * never reaches sideways into somebody else's team.
 *
 * **Nothing ranks people.** There is one per-person table, it is alphabetical,
 * and nothing re-sorts it, by click or by URL.
 *
 * One `snapshot()` assembles everything the page and both exports read, so a
 * figure on screen and the same figure in the PDF can never diverge.
 */

import {
  ACTION_PLANS, ACTORS, AI_INSIGHTS, ANCHOR, CCM_ROWS, CHAT_QUESTIONS, CONCIERGE_JOBS,
  CONTRACT_PRICES, CONTROL_CREATIONS, CONTROLS,
  DAY_MS, DEDUPLICATION_SHIPPED_AT, ENGAGEMENT_ROWS, EXAMPLE_QUARTER, HISTORY_START, HOUR_MS,
  LOOKUP_CALLS, MANUAL_CONTROL_TESTS, MANUAL_REVIEWS, PAID_LOOKUPS, POPULATIONS, PRODUCT_EVENTS, SOP_JOBS,
  QUEUE_ITEMS, REPORT_TRAIL, RISK_ROWS, RUNS, SAMPLE_VALIDATIONS, TRACED_EXCEPTIONS,
  formatDate, formatDayMonth, formatShortMonth, populationOf, priceAt,
  type Actor, type AiInsight, type ContractPrice, type EngagementRow, type Population, type QueueItem, type RiskRow,
  type Run, type SampleOutcome, type SampleValidation, type Severity, type TracedException,
} from './platform-usage';

export type { AiInsight, EngagementRow, QueueItem, Run, TracedException, SampleValidation };
import { pack as coveragePack, type CoveragePack } from './audit-coverage';
import { pendingMemories, liveMemories } from './memorySession';
import { RECALLS_THIS_WEEK } from './memoryStore';
import type { PlatformMemory } from './memoryStore';

/* ──────────────────────────────────────────────────────────────────────────
 * Formatting
 * ────────────────────────────────────────────────────────────────────────── */

const INT = new Intl.NumberFormat('en-GB');
const ONE_DP = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const INDIAN = new Intl.NumberFormat('en-IN');

export const fmtInt = (n: number): string => INT.format(Math.round(n));
export const fmtOneDp = (n: number): string => ONE_DP.format(n);
export const fmtPct = (n: number): string => `${Math.round(n)}%`;

/**
 * A count and its noun, agreeing.
 *
 * "1 critical risks have no control" is the sentence that tells a reader a page
 * was generated rather than written, so counts and nouns agree here once and
 * every card inherits it.
 */
export const plural = (n: number, one: string, many: string): string =>
  `${fmtInt(n)} ${n === 1 ? one : many}`;

/**
 * The label on a drill, with its noun agreeing with its count.
 *
 * "Open the 1 risks with no control" is the kind of line that tells a reader
 * nobody wrote this page, so the plural is built here rather than in each block.
 */
export const openLabel = (n: number, one: string, many: string): string =>
  `Open the ${fmtInt(n)} ${n === 1 ? one : many}`;

/** A scope subject at the head of a sentence: "the company" starts a sentence. */
export const opening = (subject: string): string => subject.charAt(0).toUpperCase() + subject.slice(1);

/**
 * Hours, rounded down.
 *
 * An hours figure is always rounded towards zero. Rounding a benefit up, even by half
 * an hour, is the kind of small dishonesty that costs a page its reader.
 */
export const fmtHours = (h: number): string => (h < 10 ? fmtOneDp(h) : fmtInt(Math.floor(h)));

/** People, as a headcount. Under ten a decimal still means something. */
export const fmtPeople = (n: number): string => (n < 10 ? fmtOneDp(n) : fmtInt(n));

/**
 * A span of machine time, in whatever unit stops it reading as zero.
 *
 * Eight and a half hours of processing across a company is an hour or two per
 * team and a couple of minutes per person. Printing all three as "0.0 hours"
 * makes the fastest thing on the page look like the thing that never ran.
 */
export function fmtDuration(hours: number): string {
  if (hours >= 1) return `${fmtOneDp(hours)} hours`;
  const minutes = hours * 60;
  if (minutes >= 1) return `${fmtInt(minutes)} ${Math.round(minutes) === 1 ? 'minute' : 'minutes'}`;
  const seconds = Math.max(1, Math.round(minutes * 60));
  return `${fmtInt(seconds)} ${seconds === 1 ? 'second' : 'seconds'}`;
}

/** Money to the rupee, for a cost line somebody will reconcile against a bill. */
export const fmtMoneyExact = (rupees: number): string => `₹${INDIAN.format(Math.round(rupees))}`;

const PAISE = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * A unit price, which is usually a few paise.
 *
 * Rounding ₹1.75 a lookup to ₹2 overstates the contract by fourteen per cent
 * and makes the multiplication on the same row stop working, so a price keeps
 * its paise while a total does not need them.
 */
export const fmtPrice = (rupees: number): string =>
  (Number.isInteger(rupees) ? `₹${INDIAN.format(rupees)}` : `₹${PAISE.format(rupees)}`);

/* ──────────────────────────────────────────────────────────────────────────
 * How far the reader is looking
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * There is one reader, the audit lead, and there is no switch that pretends
 * otherwise. What survives is how far they are looking: the whole company, one
 * team, or their own work. It narrows, it never widens, and it never reaches
 * sideways into somebody else's team.
 */
export type ScopeLevel = 'company' | 'team' | 'person';

export const SCOPE_LABEL: Record<ScopeLevel, string> = {
  company: 'Whole company',
  team: 'Your team only',
  person: 'Your own work only',
};

export interface Scope {
  level: ScopeLevel;
  /** Said inside a sentence: "the company", "SOX Audit", "you". */
  subject: string;
  team?: string;
  userEmail?: string;
  userName?: string;
}

/**
 * The widest the reader may look.
 *
 * `ad_usage` is the whole company; `ad_usage_people` without it is that
 * person's own team; everybody else gets themselves. A team lead with no team
 * on their record falls back to their own work rather than being shown an
 * empty team.
 *
 * There is no null case. Every signed-in person can read their own work with no
 * request and no approval, which was decided early on: this page is self-serve.
 * The permissions decide how far out somebody can see, not whether they may
 * open the page at all.
 */
export function scopeCeiling(
  holds: { usage: boolean; people: boolean; self: boolean },
  team: string | null,
): ScopeLevel {
  if (holds.usage) return 'company';
  if (holds.people && team) return 'team';
  return 'person';
}

/**
 * What the scope filter may offer.
 *
 * It never shows anybody data they could not otherwise see, and it only ever
 * narrows: somebody who may read the whole company can look at one team or at
 * their own work, and nobody can look sideways into somebody else's team. A
 * scope the reader is not entitled to is not offered at all, so the filter
 * cannot be used to ask for one.
 */
export function scopeOptions(ceiling: ScopeLevel, team: string | null): ScopeLevel[] {
  if (ceiling === 'company') return team ? ['company', 'team', 'person'] : ['company', 'person'];
  if (ceiling === 'team') return ['team', 'person'];
  return ['person'];
}

/* ──────────────────────────────────────────────────────────────────────────
 * The window
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Two windows, read side by side.
 *
 * A committee reads the quarter against the year to date, so those are the two
 * the page holds and there is no third. The five named periods that were here
 * before included one, `this-year`, that resolved to 1 January and therefore
 * printed the same figures as the quarter on an anchor of 31 March.
 */
export type WindowId = 'quarter' | 'fy-ytd';

export interface Period {
  id: WindowId;
  /** How it reads on a control: "This quarter". */
  label: string;
  /** How it reads inside a sentence: "this quarter". */
  phrase: string;
  from: number;
  to: number;
  /** Fractional months, so a people-equivalent is right on a part month. */
  months: number;
  days: number;
}

const startOfQuarter = (ms: number) => {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), Math.floor(d.getUTCMonth() / 3) * 3, 1);
};
/**
 * 1 April, the start of the Indian financial year the moment falls in.
 *
 * The anchor is 31 March 2026, which is the last day of that year, so the year
 * to date runs the full twelve months from 1 April 2025.
 */
const startOfFinancialYear = (ms: number) => {
  const d = new Date(ms);
  const year = d.getUTCMonth() >= 3 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  return Date.UTC(year, 3, 1);
};

/**
 * How many person-months a window is worth.
 *
 * The guide is specific: 480 hours for a quarter, 160 for a month, about 110
 * for three weeks. So a month the window covers end to end counts as a whole
 * one, and a part month counts as its share of that month's own days. That is
 * why this walks the calendar rather than dividing by an average month. A
 * quarter then comes to exactly 3.0, and the people line divides by 480.
 */
function monthsCovered(from: number, to: number): number {
  const start = new Date(from);
  const end = new Date(to);
  let months = 0;
  for (let y = start.getUTCFullYear(), m = start.getUTCMonth(); ; ) {
    const monthStart = Date.UTC(y, m, 1);
    const monthEnd = Date.UTC(y, m + 1, 1) - 1;
    if (monthStart > to) break;
    const daysInMonth = new Date(monthEnd).getUTCDate();
    // Whole days, so the last day of a window counts as a day worked.
    const firstDay = Math.max(1, monthStart >= from ? 1 : new Date(from).getUTCDate());
    const lastDay = monthEnd <= to ? daysInMonth : new Date(to).getUTCDate();
    months += Math.max(0, lastDay - firstDay + 1) / daysInMonth;
    m += 1;
    if (m > 11) { m = 0; y += 1; }
    if (Date.UTC(y, m, 1) > to && monthEnd >= to) break;
  }
  void end;
  return months;
}

function make(id: WindowId, label: string, phrase: string, from: number, to: number): Period {
  const days = Math.max(1, Math.round((to - from) / DAY_MS));
  return { id, label, phrase, from, to, months: monthsCovered(from, to), days };
}

/** Both windows, built together, because the page reads them together. */
export function windows(): { quarter: Period; ytd: Period } {
  return {
    quarter: make('quarter', 'This quarter', 'this quarter', startOfQuarter(ANCHOR), ANCHOR),
    ytd: make('fy-ytd', 'Year to date', 'the year to date', startOfFinancialYear(ANCHOR), ANCHOR),
  };
}

/** One of the two, by name. */
export function windowOf(id: WindowId): Period {
  const both = windows();
  return id === 'fy-ytd' ? both.ytd : both.quarter;
}

export const windowOptions: { id: WindowId; label: string }[] = [
  { id: 'quarter', label: 'This quarter' },
  { id: 'fy-ytd', label: 'Year to date' },
];

/** The page opens on the quarter, because that is what the committee asks about. */
export const DEFAULT_WINDOW: WindowId = 'quarter';

/**
 * How a window is headed in the pack: "Q4 FY26", "FY26 to date".
 *
 * The Indian financial year starts on 1 April, so the quarter that ends on the
 * anchor is Q4 and the year it sits in is FY26. Worked out from the dates
 * rather than written down, so the label can never drift from the window.
 */
export function windowShort(p: Period): string {
  const d = new Date(p.from);
  const fy = new Date(p.to);
  const year = (fy.getUTCMonth() >= 3 ? fy.getUTCFullYear() + 1 : fy.getUTCFullYear()) % 100;
  if (p.id === 'fy-ytd') return `FY${year} to date`;
  const q = Math.floor((((d.getUTCMonth() - 3) + 12) % 12) / 3) + 1;
  return `Q${q} FY${year}`;
}

/* ──────────────────────────────────────────────────────────────────────────
 * The four assumptions, and how two of them fix themselves
 * ────────────────────────────────────────────────────────────────────────── */

export type SettingSource = 'starting-value' | 'measured' | 'default';

/**
 * Said the way a person would say it.
 *
 * "default" and "starting value" are our words for our own machinery and they
 * tell a reader nothing about whether they can trust the number. These three
 * say where it came from instead.
 */
export const SOURCE_LABEL: Record<SettingSource, string> = {
  measured: 'from your records',
  'starting-value': 'our number, until yours is on record',
  default: 'our number, nothing measures it',
};

export type NumericSetting = 'manualReviewRate' | 'manualControlTestHours' | 'hoursPerPersonPerMonth';

/**
 * The three assumptions left, in the order they are read in: the two that
 * measure themselves first, then the one that never can. The page, the CSV and
 * the PDF all walk this one list, so none of them can quietly show a different
 * three.
 *
 * The cost of an auditor hour used to be a fourth. Nothing in a customer tenant
 * records what anybody is paid, so it was ours rather than theirs, and every
 * rupee on the page rested on it. It is gone, and so is every figure it made.
 */
export const ASSUMPTIONS: NumericSetting[] = [
  'manualReviewRate', 'manualControlTestHours', 'hoursPerPersonPerMonth',
];

export const SETTING_LABEL: Record<NumericSetting, string> = {
  manualReviewRate: 'rows a person checks by hand in an hour',
  manualControlTestHours: 'hours one manual control test takes',
  hoursPerPersonPerMonth: 'working hours per person per month',
};

export const SETTING_SHORT: Record<NumericSetting, string> = {
  manualReviewRate: 'Rows checked by hand per hour',
  manualControlTestHours: 'Hours per manual control test',
  hoursPerPersonPerMonth: 'Working hours per person per month',
};

export interface SettingChange {
  setting: NumericSetting;
  from: number | null;
  to: number;
  at: number;
  by: string;
  note: string;
}

export interface UsageSettings {
  manualReviewRate: number;
  manualControlTestHours: number;
  hoursPerPersonPerMonth: number;
  source: Record<NumericSetting, SettingSource>;
  /** Why the value is what it is: the sample behind it, or the guard it failed. */
  note: Record<NumericSetting, string>;
  /** Whether a self-measuring setting can ever become measured. */
  measurable: Record<NumericSetting, boolean>;
  /**
   * What the customer's own records say so far, where the guard has not passed
   * yet. Null when nothing is on record, or when the value is already measured.
   */
  observed: Partial<Record<NumericSetting, number | null>>;
  changes: SettingChange[];
}

/**
 * Where the by-hand rate comes from, in the open.
 *
 * "200 records an hour" on its own is a number somebody made up, and the first
 * person to ask "who said 200?" is right to stop believing the page. So it is
 * not a number: it is a short sum anybody can argue with, made of three things
 * a working auditor can check against their own day.
 *
 * A nine hour shift is not nine hours of checking. Take out the standup, the
 * review calls, lunch and the walking about, and roughly six hours of it is
 * somebody actually working through a list. Eighteen seconds a record is the
 * pace of reading one line, comparing it against the rule and moving on, for
 * the kind of records these checks run over.
 *
 * Six hours at eighteen seconds is 1,200 records in a day, which is 200 an
 * hour. Change any of the three and the page changes with it, which is the
 * point: it is an estimate that argues rather than a figure that asserts.
 */
export const RATE_BASIS = {
  shiftHours: 9,
  checkingHours: 6,
  secondsPerRecord: 18,
};

/** 200 an hour, worked out rather than picked. */
export const RATE_PER_HOUR = Math.round(3600 / RATE_BASIS.secondsPerRecord);
export const RATE_PER_DAY = RATE_PER_HOUR * RATE_BASIS.checkingHours;

/** The sum said in one line, wherever the rate appears. */
export const RATE_BASIS_LINE =
  `a ${RATE_BASIS.shiftHours} hour shift, of which about ${RATE_BASIS.checkingHours} hours is actual `
  + `checking, at about ${RATE_BASIS.secondsPerRecord} seconds a record: ${RATE_PER_HOUR} an hour, `
  + `or ${RATE_PER_DAY} in a day`;

/** The shipped starting point. Nothing here was ever typed by a customer. */
const BASE: Omit<UsageSettings, 'changes'> = {
  manualReviewRate: RATE_PER_HOUR,
  manualControlTestHours: 4,
  hoursPerPersonPerMonth: 160,
  source: {
    manualReviewRate: 'starting-value',
    manualControlTestHours: 'starting-value',
    hoursPerPersonPerMonth: 'default',
  },
  note: {
    manualReviewRate:
      `Worked out rather than picked: ${RATE_BASIS_LINE}. Nobody measured it and it is not an `
      + "industry benchmark, so argue with any of the three and the page moves with you. Your "
      + "team's own pace replaces it once there is enough recorded history.",
    manualControlTestHours:
      'A starting number we picked. It replaces itself once manual tests carry start and finish times.',
    hoursPerPersonPerMonth: '8 hours a day across 20 working days. An HR convention, not a measurement.',
  },
  measurable: {
    manualReviewRate: true,
    manualControlTestHours: true,
    hoursPerPersonPerMonth: false,
  },
  observed: {},
};

/** Both guards. Ninety days of history, and enough of it to mean something. */
const MIN_HISTORY_DAYS = 90;
const MIN_REVIEW_SAMPLE = 60;
const MIN_TEST_SAMPLE = 24;

/** Trim the obvious nonsense: an exception left open over a weekend is not 60 hours of review. */
function trimmed<T>(rows: T[], value: (row: T) => number): T[] {
  if (rows.length < 4) return rows;
  const sorted = [...rows].sort((a, b) => value(a) - value(b));
  const median = value(sorted[Math.floor(sorted.length / 2)]);
  return rows.filter(r => value(r) >= median / 3 && value(r) <= median * 3);
}

/**
 * The weekly job, run as the page is read.
 *
 * Once both guards pass, a measured value replaces a starting one by itself,
 * with no confirmation and no click, because at ten thousand people nobody
 * clicks. When a guard fails the page says which one and how far off it is,
 * rather than carrying on with a number that looks measured.
 */
export function calibrate(): UsageSettings {
  const changes: SettingChange[] = [];
  const next: UsageSettings = {
    ...BASE,
    source: { ...BASE.source },
    note: { ...BASE.note },
    measurable: { ...BASE.measurable },
    observed: { ...BASE.observed },
    changes,
  };

  /* Rows checked by hand in an hour, measured from recorded exception review. */
  const reviews = MANUAL_REVIEWS.filter(r => r.resolvedAt <= ANCHOR);
  const reviewSpanDays = reviews.length
    ? (Math.max(...reviews.map(r => r.resolvedAt)) - Math.min(...reviews.map(r => r.assignedAt))) / DAY_MS
    : 0;
  const usableReviews = trimmed(reviews, r => r.rowsCovered / ((r.resolvedAt - r.assignedAt) / HOUR_MS));

  if (reviewSpanDays >= MIN_HISTORY_DAYS && usableReviews.length >= MIN_REVIEW_SAMPLE) {
    const rate = Math.round(
      usableReviews.reduce((s, r) => s + r.rowsCovered / ((r.resolvedAt - r.assignedAt) / HOUR_MS), 0) / usableReviews.length,
    );
    next.manualReviewRate = rate;
    next.source.manualReviewRate = 'measured';
    next.note.manualReviewRate = `Measured across ${fmtInt(usableReviews.length)} of your own timed reviews in the last ${fmtInt(reviewSpanDays)} days.`;
    changes.push({
      setting: 'manualReviewRate', from: BASE.manualReviewRate, to: rate, at: ANCHOR,
      by: 'measured automatically', note: "Replaced the starting value with your team's own pace.",
    });
  } else {
    /*
     * The guard has not passed, but the customer's own reviews already say
     * something. Printing that number next to ours is the difference between
     * "a figure we picked" and "a figure we picked, and here is what your own
     * records show against it".
     */
    const observed = usableReviews.length
      ? Math.round(
        usableReviews.reduce((s, r) => s + r.rowsCovered / ((r.resolvedAt - r.assignedAt) / HOUR_MS), 0) / usableReviews.length,
      )
      : null;

    next.note.manualReviewRate = observed === null
      ? `${fmtInt(BASE.manualReviewRate)} an hour is ${RATE_BASIS_LINE}. Nothing is on record yet to replace it with.`
      : `${fmtInt(BASE.manualReviewRate)} an hour is ${RATE_BASIS_LINE}. Your own ${fmtInt(usableReviews.length)} timed `
        + `reviews so far work out at about ${fmtInt(observed)} records an hour over ${fmtInt(reviewSpanDays)} days, and `
        + `the page switches to your number once there are ${MIN_REVIEW_SAMPLE} of them over ${MIN_HISTORY_DAYS} days.`;
    next.observed.manualReviewRate = observed;
  }

  /* Hours one manual control test takes, measured from start and finish times. */
  const tests = MANUAL_CONTROL_TESTS.filter(t => t.finishedAt <= ANCHOR);
  const testSpanDays = tests.length
    ? (Math.max(...tests.map(t => t.finishedAt)) - Math.min(...tests.map(t => t.startedAt))) / DAY_MS
    : 0;
  const usableTests = trimmed(tests, t => (t.finishedAt - t.startedAt) / HOUR_MS);

  if (testSpanDays >= MIN_HISTORY_DAYS && usableTests.length >= MIN_TEST_SAMPLE) {
    const hours = Math.round(
      (usableTests.reduce((s, t) => s + (t.finishedAt - t.startedAt) / HOUR_MS, 0) / usableTests.length) * 10,
    ) / 10;
    next.manualControlTestHours = hours;
    next.source.manualControlTestHours = 'measured';
    next.note.manualControlTestHours = `Measured across ${fmtInt(usableTests.length)} of your own timed manual tests over ${fmtInt(testSpanDays)} days.`;
    changes.push({
      setting: 'manualControlTestHours', from: BASE.manualControlTestHours, to: hours, at: ANCHOR,
      by: 'measured automatically', note: "Replaced the starting value with your team's own recorded tests.",
    });
  }

  return next;
}

/** Said once, under the assumptions, because it is a limit and not a caveat. */
export const REVIEW_PROXY_NOTE =
  'Reviewing an exception is close to checking rows by hand, though it is not the same work. '
  + 'We use it because it is recorded, and a guess would not be.';

/* ──────────────────────────────────────────────────────────────────────────
 * Scoping a record to the reader
 * ────────────────────────────────────────────────────────────────────────── */

const inWindow = (ms: number, p: Period) => ms >= p.from && ms <= p.to;

function mine(scope: Scope, actor: Actor | null, team: string | null): boolean {
  if (scope.level === 'company') return true;
  if (scope.level === 'team') return team === scope.team;
  return actor?.email === scope.userEmail;
}

const scopedRuns = (scope: Scope) => RUNS.filter(r => mine(scope, r.actor, r.team));

/* ──────────────────────────────────────────────────────────────────────────
 * Value: hours and people, never rupees
 * ────────────────────────────────────────────────────────────────────────── */

export interface ValueFigures {
  /** Successful runs in the window. */
  runs: number;
  /** Distinct populations, counted once however often they were re-tested. */
  coveredRows: number;
  populations: number;
  /** Every row check performed, repeats included. Where repeats belong. */
  checksPerformed: number;
  /** Runs that tested a control but produced no rows. Priced differently. */
  zeroRowRuns: number;
  machineHours: number;
  manualHours: number;
  hoursSaved: number;
  /** The saving as a headcount, on the same saved hours. */
  people: number;
  /**
   * The lists behind the record count, biggest first. "1,428,000 records" means
   * nothing on its own; "486,000 journal entries and 312,000 purchase invoices"
   * is a thing an auditor recognises as their own work.
   */
  lists: { name: string; size: number }[];
}

function valueOf(runs: Run[], p: Period, settings: UsageSettings): ValueFigures {
  const passed = runs.filter(r => r.status === 'passed' && inWindow(r.completedAt, p));
  const populationIds = new Set(passed.filter(r => r.rowsProcessed > 0).map(r => r.populationId));
  const coveredRows = [...populationIds].reduce((s, id) => s + (populationOf(id)?.size ?? 0), 0);
  const checksPerformed = passed.reduce((s, r) => s + r.rowsProcessed, 0);
  const zeroRowRuns = passed.filter(r => r.rowsProcessed === 0).length;
  const machineHours = passed.reduce((s, r) => s + (r.completedAt - r.startedAt), 0) / HOUR_MS;

  // Rows go through the assumed pace. A run that tested a control without
  // producing rows takes the other branch: one manual test, less machine time.
  const manualHours = coveredRows / settings.manualReviewRate + zeroRowRuns * settings.manualControlTestHours;
  const hoursSaved = Math.max(0, manualHours - machineHours);

  return {
    runs: passed.length,
    coveredRows,
    populations: populationIds.size,
    lists: [...populationIds]
      .map(id => populationOf(id))
      .filter((pop): pop is Population => Boolean(pop))
      .map(pop => ({ name: pop.name, size: pop.size }))
      .sort((a, b) => b.size - a.size),
    checksPerformed,
    zeroRowRuns,
    machineHours,
    manualHours,
    hoursSaved,
    people: hoursSaved / (settings.hoursPerPersonPerMonth * Math.max(p.months, 0.03)),
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * Cost: the contract, never a form
 * ────────────────────────────────────────────────────────────────────────── */

export interface CostLine {
  lookupId: string;
  name: string;
  vendor: string | null;
  calls: number;
  /** Batches, which is what a per-run price charges for. */
  batches: number;
  billingUnit: 'row' | 'run' | null;
  pricePaise: number | null;
  /** More than one where a price changed inside the window. */
  prices: ContractPrice[];
  paise: number;
  priced: boolean;
  personalData: boolean;
}

export interface CostFigures {
  lines: CostLine[];
  totalPaise: number;
  /**
   * Lookups that went out and came back with nothing.
   *
   * The contract charges for answers, so these are charged nothing. They are
   * named here because the activity tab counts every attempt, and two call
   * counts on one page with no line between them is the kind of gap a reader
   * has to guess at.
   */
  failedCalls: number;
  /** Lookups the contract does not price yet. Counted, named, charged nothing. */
  unpriced: CostLine[];
  /** What the Concierge recorded for itself, in its own currency, added to nothing. */
  conciergePaise: number;
  conciergeJobsPriced: number;
  conciergeJobsUnpriceable: number;
  /** Chat, estimated by text length. Never money. */
  chatUnits: number;
  chatQuestions: number;
  sopJobs: number;
  sopCacheHits: number;
  anyContract: boolean;
  /**
   * The contract prices this window, so a total may be shown.
   *
   * PU-04 is complete or absent, never partial. Complete means the price list
   * is seeded and the total equals what the contract charges for this window to
   * the paisa. A lookup our operations team has not priced yet is not part of
   * the contract, so it does not make the total partial: it is named on its own
   * row, its calls are counted and it is charged nothing. With no price list at
   * all there is no total, and the tile is absent rather than nought.
   */
  complete: boolean;
}

function costOf(p: Period, scope: Scope): CostFigures {
  const attempts = LOOKUP_CALLS.filter(c => inWindow(c.at, p) && mine(scope, c.actor, c.actor.team));
  const calls = attempts.filter(c => c.ok);
  const failedCalls = attempts.length - calls.length;

  const lines: CostLine[] = PAID_LOOKUPS.map(lookup => {
    const own = calls.filter(c => c.lookupId === lookup.id);
    const batches = new Set(own.map(c => c.batchId));
    const prices = [...new Set(own.map(c => priceAt(c.lookupId, c.at)).filter(Boolean) as ContractPrice[])];

    let paise = 0;
    const chargedBatches = new Set<string>();
    own.forEach(call => {
      const price = priceAt(call.lookupId, call.at);
      if (!price) return;
      if (price.billingUnit === 'run') {
        if (chargedBatches.has(call.batchId)) return;
        chargedBatches.add(call.batchId);
      }
      paise += price.pricePaise;
    });

    return {
      lookupId: lookup.id,
      name: lookup.name,
      vendor: prices[0]?.vendor ?? null,
      calls: own.length,
      batches: batches.size,
      billingUnit: prices[0]?.billingUnit ?? null,
      pricePaise: prices.length === 1 ? prices[0].pricePaise : null,
      prices,
      paise,
      priced: prices.length > 0,
      personalData: lookup.personalData,
    };
  }).filter(line => line.calls > 0);

  const concierge = CONCIERGE_JOBS.filter(j => inWindow(j.at, p) && mine(scope, j.actor, j.actor.team));
  const chat = CHAT_QUESTIONS.filter(q => inWindow(q.at, p) && mine(scope, q.actor, q.actor.team));

  return {
    lines: lines.filter(l => l.priced),
    totalPaise: lines.reduce((s, l) => s + l.paise, 0),
    failedCalls,
    unpriced: lines.filter(l => !l.priced),
    conciergePaise: concierge.reduce((s, j) => s + (j.costPaise ?? 0), 0),
    conciergeJobsPriced: concierge.filter(j => j.costPaise !== null).length,
    conciergeJobsUnpriceable: concierge.filter(j => j.costPaise === null).length,
    // Four characters to a unit. Built as a guard against runaway conversations,
    // not for billing, so it is a count and never a price.
    chatUnits: Math.round(chat.reduce((s, q) => s + q.characters, 0) / 4),
    chatQuestions: chat.length,
    sopJobs: 0,
    sopCacheHits: 0,
    anyContract: CONTRACT_PRICES.length > 0,
    complete: lines.some(l => l.priced),
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * Coverage, risk, what was caught
 * ────────────────────────────────────────────────────────────────────────── */

export interface CoverageFigures {
  controlsInLibrary: number;
  tested: { id: string; name: string; runs: number; lastTested: number }[];
  /** Not exercised inside the window. A period fact, and labelled as one. */
  neverTested: { id: string; name: string; process: string; owner: string; addedAt: number }[];
  /**
   * Never exercised at all, in the whole history.
   *
   * PU-07 deliberately ignores the period selector: changing the window must
   * change nothing here. "Never" needs no setting behind it, which is what
   * makes it the one coverage figure nobody can argue with.
   */
  neverExercised: { id: string; name: string; process: string; owner: string; addedAt: number }[];
  /** Workflows that have never run once, on the same never-ever basis. */
  workflowsNeverRun: { id: string; name: string }[];
  pctTested: number;
  populations: { id: string; name: string; size: number; runs: number; workflowName: string }[];
}

/**
 * Which controls are this reader's to worry about.
 *
 * A team's controls are the ones its people own, plus the ones its scheduled
 * checks test. Scoping to the tested ones alone would be circular: a team whose
 * control list is defined by what it tested can never have an untested control,
 * and the block the guide puts on a team lead's page would be permanently
 * empty and permanently reassuring.
 */
function controlsInScope(scope: Scope) {
  if (scope.level === 'company') return CONTROLS;
  const owners = new Set(ACTORS
    .filter(a => (scope.level === 'team' ? a.team === scope.team : a.email === scope.userEmail))
    .map(a => a.name));
  return CONTROLS.filter(c =>
    owners.has(c.owner)
    || POPULATIONS.some(pop => pop.controlId === c.id
      && (scope.level === 'team' ? pop.team === scope.team : true)));
}

function coverageOf(runs: Run[], samples: SampleValidation[], p: Period, scope: Scope): CoverageFigures {
  const inScopeControls = controlsInScope(scope);

  const windowRuns = runs.filter(r => r.status === 'passed' && inWindow(r.completedAt, p));
  const windowSamples = samples.filter(s => inWindow(s.at, p) && (s.outcome === 'passed' || s.outcome === 'failed'));

  const touched = new Map<string, { runs: number; last: number }>();
  windowRuns.forEach(r => {
    const row = touched.get(r.controlId) ?? { runs: 0, last: 0 };
    touched.set(r.controlId, { runs: row.runs + 1, last: Math.max(row.last, r.completedAt) });
  });
  windowSamples.forEach(s => {
    const row = touched.get(s.controlId) ?? { runs: 0, last: 0 };
    touched.set(s.controlId, { runs: row.runs + 1, last: Math.max(row.last, s.at) });
  });

  const tested = inScopeControls
    .filter(c => touched.has(c.id))
    .map(c => ({ id: c.id, name: c.name, runs: touched.get(c.id)!.runs, lastTested: touched.get(c.id)!.last }))
    .sort((a, b) => b.lastTested - a.lastTested);

  // The day the control was written down, so a list of controls nobody has
  // exercised can be read in the order they were promised rather than by name.
  const addedAt = (id: string) => CONTROL_CREATIONS.find(c => c.id === id)?.at ?? HISTORY_START;

  const neverTested = inScopeControls
    .filter(c => !touched.has(c.id))
    .map(c => ({ id: c.id, name: c.name, process: c.process, owner: c.owner, addedAt: addedAt(c.id) }));

  // Never means never, over the whole history, with the window taken off. A
  // control that has never once been exercised is a different and much harder
  // fact than one that was quiet for three months.
  const everTouched = new Set<string>();
  runs.filter(r => r.status === 'passed').forEach(r => everTouched.add(r.controlId));
  samples.filter(s => s.outcome === 'passed' || s.outcome === 'failed').forEach(s => everTouched.add(s.controlId));

  const neverExercised = inScopeControls
    .filter(c => !everTouched.has(c.id))
    .map(c => ({ id: c.id, name: c.name, process: c.process, owner: c.owner, addedAt: addedAt(c.id) }));

  const ranWorkflows = new Set(runs.map(r => r.workflowId));
  const workflowsNeverRun = [...new Map(POPULATIONS
    .filter(pop => scope.level !== 'team' || pop.team === scope.team)
    .filter(pop => !ranWorkflows.has(pop.workflowId))
    .map(pop => [pop.workflowId, { id: pop.workflowId, name: pop.workflowName }]))
    .values()]
    .sort((a, b) => a.name.localeCompare(b.name));

  const populations = POPULATIONS
    .filter(pop => scope.level !== 'team' || pop.team === scope.team)
    .map(pop => ({
      id: pop.id,
      name: pop.name,
      size: pop.size,
      workflowName: pop.workflowName,
      runs: windowRuns.filter(r => r.populationId === pop.id).length,
    }))
    .filter(pop => pop.runs > 0)
    .sort((a, b) => b.size - a.size);

  return {
    controlsInLibrary: inScopeControls.length,
    tested,
    neverTested,
    neverExercised,
    workflowsNeverRun,
    pctTested: inScopeControls.length ? (tested.length / inScopeControls.length) * 100 : 0,
    populations,
  };
}

export interface RiskFigures {
  total: number;
  unmapped: RiskRow[];
  criticalUnmapped: RiskRow[];
  byPriority: { label: string; value: number }[];
  raisedByAi: number;
}

function risksOf(scope: Scope): RiskFigures {
  const rows = RISK_ROWS.filter(r => scope.level !== 'team' || r.team === scope.team);
  const unmapped = rows.filter(r => !r.mapped);
  const order: RiskRow['priority'][] = ['Critical', 'High', 'Medium', 'Low'];
  return {
    total: rows.length,
    unmapped,
    criticalUnmapped: unmapped.filter(r => r.priority === 'Critical'),
    byPriority: order.map(label => ({ label, value: rows.filter(r => r.priority === label).length })),
    raisedByAi: rows.filter(r => r.raisedByAi).length,
  };
}

export interface ExceptionFigures {
  total: number;
  open: number;
  resolved: number;
  bySeverity: { label: Severity; value: number }[];
  rows: TracedException[];
  /** How long between a thing happening and the platform catching it. */
  medianLagScheduledDays: number | null;
  medianLagManualDays: number | null;
  /** Findings raised before de-duplication shipped, counted apart. */
  beforeDeduplication: number;
}

const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

function exceptionsOf(p: Period, scope: Scope): ExceptionFigures {
  const rows = TRACED_EXCEPTIONS.filter(ex => inWindow(ex.detectedAt, p) && mine(scope, ex.assignee, ex.team));
  const order: Severity[] = ['Critical', 'High', 'Medium', 'Low'];
  const lag = (ex: TracedException) => (ex.detectedAt - ex.occurredAt) / DAY_MS;
  const scheduledRuns = new Set(RUNS.filter(r => r.scheduled).map(r => r.id));

  return {
    total: rows.length,
    open: rows.filter(ex => ex.status !== 'Resolved').length,
    resolved: rows.filter(ex => ex.status === 'Resolved').length,
    bySeverity: order.map(label => ({ label, value: rows.filter(ex => ex.severity === label).length })),
    rows: [...rows].sort((a, b) => b.detectedAt - a.detectedAt),
    medianLagScheduledDays: median(rows.filter(ex => ex.runId && scheduledRuns.has(ex.runId)).map(lag)),
    medianLagManualDays: median(rows.filter(ex => !ex.runId || !scheduledRuns.has(ex.runId)).map(lag)),
    beforeDeduplication: rows.filter(ex => ex.beforeDeduplication).length,
  };
}

/** The three limits that go with de-duplication, said where the number is. */
export const DEDUPLICATION_LIMITS = [
  `Findings raised before ${formatDate(DEDUPLICATION_SHIPPED_AT)} are not de-duplicated, so they are counted apart.`,
  'De-duplication applies where a run is tied to a specific control attribute.',
  'A finding never closes itself, so open means nobody has dealt with it yet rather than that the '
  + 'problem is still there.',
];

/* ──────────────────────────────────────────────────────────────────────────
 * What is stuck, and what keeps failing
 * ────────────────────────────────────────────────────────────────────────── */

export interface StuckRun {
  run: Run;
  /** Other runs of the same check that failed the same way in this window. */
  repeats: number;
}

/**
 * Stuck means failed or blocked with nothing successful after it.
 *
 * A check that failed at 02:00 and was re-run at 02:25 is not stuck; it is a
 * fact for the reliability block. Only the ones nobody has fixed belong at the
 * top of a team lead's page.
 */
function stuckOf(runs: Run[], p: Period): StuckRun[] {
  const bad = runs.filter(r => r.status !== 'passed' && inWindow(r.completedAt, p));
  const lastGood = new Map<string, number>();
  runs.filter(r => r.status === 'passed').forEach(r => {
    lastGood.set(r.populationId, Math.max(lastGood.get(r.populationId) ?? 0, r.completedAt));
  });

  return bad
    .filter(r => (lastGood.get(r.populationId) ?? 0) < r.completedAt)
    .sort((a, b) => b.completedAt - a.completedAt)
    .map(run => ({
      run,
      repeats: bad.filter(r => r.populationId === run.populationId && r.errorText === run.errorText).length,
    }));
}

export interface ReliabilityRow {
  workflowId: string;
  workflowName: string;
  failures: number;
  runs: number;
  failureRatePct: number;
  wastedHours: number;
  /** The error that came back most often, in its own words. */
  commonError: string | null;
}

function reliabilityOf(runs: Run[], p: Period): { rows: ReliabilityRow[]; wastedHours: number } {
  const windowRuns = runs.filter(r => inWindow(r.completedAt, p));
  const byWorkflow = new Map<string, Run[]>();
  windowRuns.forEach(r => {
    byWorkflow.set(r.workflowId, [...(byWorkflow.get(r.workflowId) ?? []), r]);
  });

  const rows: ReliabilityRow[] = [...byWorkflow.entries()].map(([workflowId, list]) => {
    const failures = list.filter(r => r.status !== 'passed');
    const counts = new Map<string, number>();
    failures.forEach(r => counts.set(r.errorText ?? '', (counts.get(r.errorText ?? '') ?? 0) + 1));
    const common = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    return {
      workflowId,
      workflowName: list[0].workflowName,
      failures: failures.length,
      runs: list.length,
      failureRatePct: (failures.length / list.length) * 100,
      wastedHours: failures.reduce((s, r) => s + (r.completedAt - r.startedAt), 0) / HOUR_MS,
      commonError: common ? common[0] : null,
    };
  })
    .filter(row => row.failures > 0)
    .sort((a, b) => b.failures - a.failures);

  return { rows, wastedHours: rows.reduce((s, r) => s + r.wastedHours, 0) };
}

/* ──────────────────────────────────────────────────────────────────────────
 * Sampling and continuous monitoring
 * ────────────────────────────────────────────────────────────────────────── */

export interface SamplingFigures {
  counts: { outcome: SampleOutcome; value: number }[];
  total: number;
  passRatePct: number | null;
  rows: SampleValidation[];
}

function samplingOf(p: Period, scope: Scope): SamplingFigures {
  const rows = SAMPLE_VALIDATIONS.filter(s => inWindow(s.at, p)
    && (scope.level === 'company' || (scope.level === 'team' ? s.team === scope.team : s.actor.email === scope.userEmail)));
  const order: SampleOutcome[] = ['passed', 'failed', 'errored', 'running', 'queued'];
  const settled = rows.filter(s => s.outcome === 'passed' || s.outcome === 'failed').length;
  return {
    counts: order.map(outcome => ({ outcome, value: rows.filter(s => s.outcome === outcome).length })),
    total: rows.length,
    passRatePct: settled ? (rows.filter(s => s.outcome === 'passed').length / settled) * 100 : null,
    rows: [...rows].sort((a, b) => b.at - a.at),
  };
}

export interface CcmFigures {
  rows: { engagementId: string; engagementName: string; thresholdPct: number; actualPct: number | null; approvalLevels: number; alertsOn: boolean }[];
  engagementsOnSchedule: number;
  engagementsTotal: number;
  below: number;
  /** What re-running actually buys: how fast a thing is caught. */
  medianLagDays: number | null;
}

function ccmOf(p: Period, scope: Scope, sampling: SamplingFigures, exceptions: ExceptionFigures): CcmFigures {
  const rows = CCM_ROWS
    .filter(r => scope.level !== 'team' || r.team === scope.team)
    .map(r => {
      const own = sampling.rows.filter(s => s.engagementId === r.engagementId
        && (s.outcome === 'passed' || s.outcome === 'failed'));
      return {
        engagementId: r.engagementId,
        engagementName: r.engagementName,
        thresholdPct: r.thresholdPct,
        actualPct: own.length ? (own.filter(s => s.outcome === 'passed').length / own.length) * 100 : null,
        approvalLevels: r.approvalLevels,
        alertsOn: r.alertsOn,
      };
    });

  const engagements = ENGAGEMENT_ROWS.filter(e => scope.level !== 'team' || e.team === scope.team);

  return {
    rows,
    engagementsOnSchedule: rows.length,
    engagementsTotal: engagements.length,
    below: rows.filter(r => r.actualPct !== null && r.actualPct < r.thresholdPct).length,
    medianLagDays: exceptions.medianLagScheduledDays,
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * Volume, what was created, product surfaces
 * ────────────────────────────────────────────────────────────────────────── */

export interface VolumeFigures {
  runs: number;
  passed: number;
  failed: number;
  blocked: number;
  checksPerformed: number;
  chat: number;
  chatVerified: number;
  concierge: number;
  conciergeFailed: number;
  conciergeTimedOut: number;
  sopJobs: number;
  sopCacheHits: number;
  lookupCalls: number;
  /** Attempts that came back with nothing. Never charged, always counted. */
  lookupCallsFailed: number;
}

export interface CreatedFigures {
  engagements: { name: string; by: string | null; at: number; note?: string }[];
  controls: { name: string; by: string | null; at: number; note?: string }[];
  dashboards: { name: string; by: string | null; at: number; note?: string }[];
  reports: { name: string; by: string | null; at: number; note?: string }[];
  risks: { name: string; by: string | null; at: number; note?: string }[];
}

export interface ProductFigures {
  dashboardsBuilt: { name: string; by: string | null; at: number; note?: string }[];
  dashboardEdits: number;
  widgetsAdded: number;
  alertsConfigured: { name: string; by: string | null; at: number }[];
  alertsFired: number;
  alertsFiredList: { name: string; by: string | null; at: number; note?: string }[];
}

export interface ReportFigures {
  made: { name: string; by: string | null; at: number; note?: string }[];
  shared: { name: string; by: string | null; at: number; note?: string }[];
  finalised: number;
  downloads: number;
}

const asMade = (name: string, by: string | null, at: number, note?: string) => ({ name, by, at, note });

/* ──────────────────────────────────────────────────────────────────────────
 * People: the one per-person table, and it never ranks
 * ────────────────────────────────────────────────────────────────────────── */

export interface PersonRow {
  name: string;
  runs: number;
  exceptionsFound: number;
  exceptionsResolved: number;
  /** Never a share, never a rank, never a comparison. */
  lastActive: number | null;
}

/**
 * The team's work by outcome.
 *
 * Alphabetical, and the sort order is not a prop, a state or a URL parameter, so
 * there is no way to reorder it. Section 12 of the guide makes this a build rule
 * rather than a style choice. A table that sorts by output works as a league
 * table however it is labelled.
 */
function peopleOf(p: Period, scope: Scope): PersonRow[] {
  // It follows the scope filter rather than one level of it. The table used to
  // exist on the head of team view alone, so it returned nothing at every other
  // scope, and a reader entitled to the whole company saw an empty table rather
  // than the company.
  const names = [...new Set(RUNS.filter(r => mine(scope, r.actor, r.team)).map(r => r.actor.name))];
  return names
    .map(name => {
      const runs = RUNS.filter(r => r.actor.name === name && inWindow(r.completedAt, p));
      const found = TRACED_EXCEPTIONS.filter(ex => ex.assignee.name === name && inWindow(ex.detectedAt, p));
      const resolved = found.filter(ex => ex.status === 'Resolved');
      const last = runs.length ? Math.max(...runs.map(r => r.completedAt)) : null;
      return {
        name,
        runs: runs.length,
        exceptionsFound: found.length,
        exceptionsResolved: resolved.length,
        lastActive: last,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/* ──────────────────────────────────────────────────────────────────────────
 * Smart Learn
 * ────────────────────────────────────────────────────────────────────────── */

export interface LearnFigures {
  /** In use right now. */
  active: PlatformMemory[];
  /** Proposed by three or more people and waiting for a human to approve it. */
  pending: PlatformMemory[];
  /** Live memories whose review date has come round. */
  dueReview: number;
  /**
   * Recalls in the trailing seven days.
   *
   * Recorded for the whole company only, so a narrower view gets null and says
   * so rather than showing a number that means something else.
   */
  recallsThisWeek: number | null;
  /** Recalls over the life of the live set, which every scope can count. */
  recallsAllTime: number;
}

/**
 * The four numbers the Smart Learn screen already computes, scoped to the reader.
 *
 * They are read from the same store that screen reads, so for the same scope
 * the two surfaces cannot disagree. An auditor sees the memories that are
 * theirs; a team lead sees the team tier including what is waiting on their
 * approval; the whole-company view sees the lot.
 */
function learnOf(scope: Scope): LearnFigures {
  const live = liveMemories();
  const pending = pendingMemories();
  const forMe = (m: PlatformMemory) => scope.level !== 'person' || m.scope === 'personal';
  const mineLive = live.filter(forMe);

  return {
    active: mineLive.filter(m => m.status === 'active'),
    pending: pending.filter(forMe),
    dueReview: mineLive.filter(m => m.renewDue).length,
    recallsThisWeek: scope.level === 'company' ? RECALLS_THIS_WEEK : null,
    recallsAllTime: mineLive.reduce((s, m) => s + (m.recallCount ?? 0), 0),
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * AI usage, by surface, never blended
 * ────────────────────────────────────────────────────────────────────────── */

export interface AiUsageRow {
  surface: string;
  count: number;
  countLabel: string;
  /**
   * Why this count is not the count the cost block shows, said on the same
   * screen as both figures. A reader who finds two numbers for one thing and
   * no reason stops believing whichever one is inconvenient.
   */
  note?: string;
  /** What the page can honestly say about money for this surface. */
  money: string;
  measured: boolean;
}

/* ──────────────────────────────────────────────────────────────────────────
 * What the assistant noticed
 * ────────────────────────────────────────────────────────────────────────── */

export interface InsightFigures {
  perRun: number;
  consolidated: number;
  bySeverity: { label: Severity; value: number }[];
  byCategory: { label: string; value: number }[];
  rows: AiInsight[];
}

/**
 * Insights, split by kind and never added up.
 *
 * A consolidated insight is the assistant reading a whole engagement and saying
 * one thing about all of its runs. Adding it to the per-run insights it
 * summarises counts the same observation twice, so the split is the block and
 * there is no total anywhere on it.
 */
function insightsOf(p: Period, scope: Scope): InsightFigures {
  const rows = AI_INSIGHTS.filter(i => inWindow(i.at, p) && mine(scope, i.actor, i.team));
  const order: Severity[] = ['Critical', 'High', 'Medium', 'Low'];
  const categories = [...new Set(rows.map(i => i.category))].sort();

  return {
    perRun: rows.filter(i => i.kind === 'per-run').length,
    consolidated: rows.filter(i => i.kind === 'consolidated').length,
    bySeverity: order.map(label => ({ label, value: rows.filter(i => i.severity === label).length })),
    byCategory: categories.map(label => ({ label, value: rows.filter(i => i.category === label).length })),
    rows: [...rows].sort((a, b) => b.at - a.at),
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * How long findings have been sitting there
 * ────────────────────────────────────────────────────────────────────────── */

export interface AgeingBucket {
  label: string;
  value: number;
  rows: TracedException[];
}

export interface AgeingFigures {
  buckets: AgeingBucket[];
  open: number;
  overThirty: number;
  /** Legacy rows left out because nothing guarantees they are distinct. */
  excludedLegacy: number;
  oldest: TracedException[];
}

/**
 * Ageing on open findings, measured from the day one was first raised.
 *
 * A repeat occurrence never created a second row, so this really is how long a
 * thing has been sitting there rather than how recently the check ran again.
 * Findings raised before de-duplication shipped are left out and counted apart:
 * nothing guarantees they are distinct, and an ageing bar built on possible
 * duplicates is a bar nobody can act on. The window is deliberately not applied
 * to what counts as open, because a finding raised last year and still open is
 * the point of the block.
 */
function ageingOf(scope: Scope): AgeingFigures {
  const all = TRACED_EXCEPTIONS.filter(ex => ex.status !== 'Resolved' && mine(scope, ex.assignee, ex.team));
  const rows = all.filter(ex => !ex.beforeDeduplication);
  const age = (ex: TracedException) => (ANCHOR - ex.detectedAt) / DAY_MS;
  const bucket = (from: number, to: number) => rows.filter(ex => age(ex) >= from && age(ex) <= to);
  const over = rows.filter(ex => age(ex) > 30);

  return {
    buckets: [
      { label: '0 to 7 days', value: bucket(0, 7).length, rows: bucket(0, 7) },
      { label: '8 to 30 days', value: bucket(8, 30).length, rows: bucket(8, 30) },
      { label: 'More than 30 days', value: over.length, rows: over },
    ],
    open: rows.length,
    overThirty: over.length,
    excludedLegacy: all.length - rows.length,
    oldest: [...over].sort((a, b) => a.detectedAt - b.detectedAt),
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * Whether the findings were real
 * ────────────────────────────────────────────────────────────────────────── */

export interface QualityFigures {
  classified: number;
  truePositives: number;
  falsePositives: number;
  unclassified: number;
  /** Null until somebody has classified something. Never a comforting zero. */
  falsePositiveRatePct: number | null;
  byRootCause: { label: string; value: number }[];
  byFalsePositiveReason: { label: string; value: number }[];
}

/**
 * The false-positive rate, over classified findings only.
 *
 * The denominator is what a risk owner has actually looked at. Dividing by
 * every finding would let a page with a large untouched backlog report a
 * flattering rate, and a rate of nought would read as perfection when it really
 * means nobody has checked. So the unclassified findings are shown as their own
 * bar and never quietly join the denominator.
 *
 * A rising rate means a control's rule wants tuning. It does not mean the team
 * is failing, and the block says so where the number is.
 */
function qualityOf(p: Period, scope: Scope): QualityFigures {
  const rows = TRACED_EXCEPTIONS.filter(ex => inWindow(ex.detectedAt, p) && mine(scope, ex.assignee, ex.team));
  const truePositives = rows.filter(ex => ex.classification === 'true-positive');
  const falsePositives = rows.filter(ex => ex.classification === 'false-positive');
  const classified = truePositives.length + falsePositives.length;

  const tally = (list: (string | null)[]) => {
    const counts = new Map<string, number>();
    list.forEach(value => {
      if (!value) return;
      counts.set(value, (counts.get(value) ?? 0) + 1);
    });
    return [...counts.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  };

  return {
    classified,
    truePositives: truePositives.length,
    falsePositives: falsePositives.length,
    unclassified: rows.length - classified,
    falsePositiveRatePct: classified ? (falsePositives.length / classified) * 100 : null,
    byRootCause: tally(truePositives.map(ex => ex.rootCause)),
    byFalsePositiveReason: tally(falsePositives.map(ex => ex.falsePositiveReason)),
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * The engagement portfolio, and where each one has got to
 * ────────────────────────────────────────────────────────────────────────── */

export interface ProcessStripRow {
  id: string;
  code: string;
  name: string;
  owner: string;
  reviewer: string;
  controlsTested: number;
  controlsTotal: number;
  exceptionsOpen: number;
  actionPlansOpen: number;
  reportState: 'none' | 'draft' | 'final';
  auditPeriodEnd: number;
  plannedEnd: number;
  /** Planned close is after the period it audits ended by more than a month. */
  slipping: boolean;
}

export interface PortfolioFigures {
  rows: EngagementRow[];
  byStatus: { label: string; value: number }[];
  open: number;
  closedLate: number;
  slipping: number;
  /** History entries whose timestamp falls in the window. Changes, not rows touched. */
  changesInPeriod: number;
  strip: ProcessStripRow[];
}

/**
 * The portfolio, plus one row per active engagement showing where it has got to.
 *
 * The strip is sorted by the date the audit period ends, soonest first. Sorting
 * it by anything about a person would make it a league table, and the strip is
 * about work rather than about who is doing it.
 */
function portfolioOf(
  p: Period,
  scope: Scope,
  runs: Run[],
  sampling: SamplingFigures,
): PortfolioFigures {
  const rows = ENGAGEMENT_ROWS.filter(e => scope.level !== 'team' || e.team === scope.team);
  const statuses = [...new Set(rows.map(e => e.status))].sort();
  const open = rows.filter(e => e.actualEnd === null);

  const exceptions = TRACED_EXCEPTIONS.filter(ex => ex.status !== 'Resolved' && mine(scope, ex.assignee, ex.team));
  const plans = ACTION_PLANS.filter(ap => ap.closedAt === null && mine(scope, ap.owner, ap.team));

  const strip: ProcessStripRow[] = open.map(e => {
    const tested = new Set<string>();
    runs.filter(r => r.engagementId === e.id && r.status === 'passed').forEach(r => tested.add(r.controlId));
    sampling.rows
      .filter(s => s.engagementId === e.id && (s.outcome === 'passed' || s.outcome === 'failed'))
      .forEach(s => tested.add(s.controlId));

    return {
      id: e.id,
      code: e.code,
      name: e.name,
      owner: e.owner,
      reviewer: e.reviewer,
      controlsTested: Math.min(tested.size, e.controlsInSnapshot),
      controlsTotal: e.controlsInSnapshot,
      exceptionsOpen: exceptions.filter(ex => ex.engagementId === e.id).length,
      actionPlansOpen: plans.filter(ap => ap.engagementId === e.id).length,
      reportState: e.reportState,
      auditPeriodEnd: e.auditPeriodEnd,
      plannedEnd: e.plannedEnd,
      slipping: e.plannedEnd - e.auditPeriodEnd > 45 * DAY_MS,
    };
  }).sort((a, b) => a.auditPeriodEnd - b.auditPeriodEnd);

  // Changes are history entries stamped inside the window, not rows touched. An
  // engagement edited fifty times is one engagement and fifty changes.
  const share = Math.max(0, Math.min(1, (p.to - p.from) / Math.max(1, ANCHOR - HISTORY_START)));

  return {
    rows,
    byStatus: statuses.map(label => ({ label, value: rows.filter(e => e.status === label).length })),
    open: open.length,
    closedLate: rows.filter(e => e.actualEnd !== null && e.actualEnd > e.plannedEnd).length,
    slipping: strip.filter(s => s.slipping).length,
    changesInPeriod: rows
      .filter(e => e.createdAt <= p.to)
      .reduce((sum, e) => sum + Math.round(e.changes * share), 0),
    strip,
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * The attention strip
 * ────────────────────────────────────────────────────────────────────────── */

export type AttentionTarget = 'stuck' | 'risks' | 'controls' | 'sampling' | 'queue' | 'memory';

export interface AttentionCard {
  id: string;
  text: string;
  actionLabel: string;
  target: AttentionTarget;
  focusId?: string;
}

/* ──────────────────────────────────────────────────────────────────────────
 * The queue
 * ────────────────────────────────────────────────────────────────────────── */

export interface QueueFigures {
  items: (QueueItem & { overdue: boolean })[];
  overdue: number;
}

function queueOf(scope: Scope): QueueFigures {
  const items = QUEUE_ITEMS
    .filter(item => scope.level === 'company'
      || (scope.level === 'team' ? item.assignee.team === scope.team : item.assignee.email === scope.userEmail))
    .map(item => ({ ...item, overdue: item.dueAt < ANCHOR }))
    // Overdue first, then by how soon. One click from the thing that needs doing.
    .sort((a, b) => (a.overdue === b.overdue ? a.dueAt - b.dueAt : a.overdue ? -1 : 1));
  return { items, overdue: items.filter(i => i.overdue).length };
}

/* ──────────────────────────────────────────────────────────────────────────
 * Over time
 * ────────────────────────────────────────────────────────────────────────── */

export interface Bucket {
  label: string;
  from: number;
  to: number;
  runs: number;
  /** Rows this bucket covered that no earlier bucket in the window had. */
  newRows: number;
  /** Hours of hand-checking those new rows avoided, less the machine time spent. */
  hours: number;
  /** Row checks performed in the bucket, repeats included. */
  checks: number;
  /** Machine time the bucket spent, repeats included. */
  machineHours: number;
}

/**
 * The window split into readable pieces.
 *
 * A month reads by day, a quarter by week, anything longer by month.
 *
 * The coverage figure here is first touch: a population is credited to the
 * bucket that first tested it in this window, and never again. Crediting it to
 * every bucket that re-tested it would put the same 1,428,000 rows on thirteen
 * bars and make the chart claim thirteen times the coverage the headline does.
 * That is the exact inflation the guide is written to prevent, arriving through
 * the time axis instead of the total. So the buckets add up to the headline, and
 * what varies week to week is effort rather than coverage.
 */
function overTime(runs: Run[], p: Period, settings: UsageSettings): Bucket[] {
  const span = p.to - p.from;
  const step = span <= 40 * DAY_MS ? DAY_MS : span <= 130 * DAY_MS ? 7 * DAY_MS : 30 * DAY_MS;
  const out: Bucket[] = [];
  const alreadyCovered = new Set<string>();

  for (let from = p.from; from < p.to; from += step) {
    const to = Math.min(p.to, from + step - 1);
    const slice = runs.filter(r => r.status === 'passed' && r.completedAt >= from && r.completedAt <= to);

    let newRows = 0;
    slice.filter(r => r.rowsProcessed > 0).forEach(r => {
      if (alreadyCovered.has(r.populationId)) return;
      alreadyCovered.add(r.populationId);
      newRows += populationOf(r.populationId)?.size ?? 0;
    });

    // Counted the same way the total is: hand-checking avoided, less the
    // machine time it took, so the column adds up to the figure above it rather
    // than to a slightly larger one.
    const machineHours = slice.reduce((sum, r) => sum + (r.completedAt - r.startedAt), 0) / HOUR_MS;
    const hours = Math.max(0, newRows / settings.manualReviewRate - machineHours);
    out.push({
      label: step === 30 * DAY_MS ? formatShortMonth(from) : formatDayMonth(from),
      from,
      to,
      runs: slice.length,
      newRows,
      hours,
      checks: slice.reduce((sum, r) => sum + r.rowsProcessed, 0),
      machineHours,
    });
  }

  return out;
}

/* ──────────────────────────────────────────────────────────────────────────
 * One snapshot, read by the page and by both exports
 * ────────────────────────────────────────────────────────────────────────── */

export interface UsageSnapshot {
  scope: Scope;
  period: Period;
  /**
   * The six lines the pack reads, on this window and this scope.
   *
   * They live next door in `audit-coverage.ts` because they are the committee's
   * own questions rather than the platform's, but they come out of here so the
   * page and both exports still read one object and cannot diverge.
   */
  committee: CoveragePack;
  settings: UsageSettings;
  value: ValueFigures;
  cost: CostFigures;
  coverage: CoverageFigures;
  risks: RiskFigures;
  exceptions: ExceptionFigures;
  stuck: StuckRun[];
  reliability: { rows: ReliabilityRow[]; wastedHours: number };
  sampling: SamplingFigures;
  ccm: CcmFigures;
  volume: VolumeFigures;
  created: CreatedFigures;
  product: ProductFigures;
  reports: ReportFigures;
  people: PersonRow[];
  learn: LearnFigures;
  aiUsage: AiUsageRow[];
  queue: QueueFigures;
  buckets: Bucket[];
  engagements: EngagementRow[];
  portfolio: PortfolioFigures;
  insights: InsightFigures;
  ageing: AgeingFigures;
  quality: QualityFigures;
  attention: AttentionCard[];
}

export function snapshot(scope: Scope, p: Period, settings: UsageSettings): UsageSnapshot {
  const runs = scopedRuns(scope);
  const value = valueOf(runs, p, settings);
  const cost = costOf(p, scope);
  const sampling = samplingOf(p, scope);
  const exceptions = exceptionsOf(p, scope);
  const coverage = coverageOf(runs, SAMPLE_VALIDATIONS.filter(s =>
    scope.level === 'company' || (scope.level === 'team' ? s.team === scope.team : s.actor.email === scope.userEmail)), p, scope);
  const risks = risksOf(scope);
  const ccm = ccmOf(p, scope, sampling, exceptions);
  const stuck = stuckOf(runs, p);
  const reliability = reliabilityOf(runs, p);
  const queue = queueOf(scope);
  const learn = learnOf(scope);
  const portfolio = portfolioOf(p, scope, runs, sampling);
  const insights = insightsOf(p, scope);
  const ageing = ageingOf(scope);
  const quality = qualityOf(p, scope);

  const windowRuns = runs.filter(r => inWindow(r.completedAt, p));
  const chat = CHAT_QUESTIONS.filter(q => inWindow(q.at, p) && mine(scope, q.actor, q.actor.team));
  const concierge = CONCIERGE_JOBS.filter(j => inWindow(j.at, p) && mine(scope, j.actor, j.actor.team));
  const sop = sopJobsIn(p, scope);
  const lookups = LOOKUP_CALLS.filter(c => inWindow(c.at, p) && mine(scope, c.actor, c.actor.team));

  const volume: VolumeFigures = {
    runs: windowRuns.length,
    passed: windowRuns.filter(r => r.status === 'passed').length,
    failed: windowRuns.filter(r => r.status === 'failed').length,
    blocked: windowRuns.filter(r => r.status === 'blocked').length,
    checksPerformed: value.checksPerformed,
    chat: chat.length,
    chatVerified: chat.filter(q => q.verified).length,
    concierge: concierge.length,
    conciergeFailed: concierge.filter(j => j.status === 'failed').length,
    conciergeTimedOut: concierge.filter(j => j.timedOut).length,
    sopJobs: sop.length,
    sopCacheHits: sop.filter(j => j.servedFromCache).length,
    lookupCalls: lookups.length,
    lookupCallsFailed: lookups.filter(c => !c.ok).length,
  };

  cost.sopJobs = volume.sopJobs;
  cost.sopCacheHits = volume.sopCacheHits;

  const events = PRODUCT_EVENTS.filter(e => inWindow(e.at, p)
    && (scope.level === 'company' || (scope.level === 'team' ? e.team === scope.team : e.actor?.email === scope.userEmail)));

  const product: ProductFigures = {
    dashboardsBuilt: events.filter(e => e.kind === 'dashboard-created').map(e => asMade(e.name, e.actor?.name ?? null, e.at)),
    dashboardEdits: events.filter(e => e.kind === 'dashboard-edited').length,
    widgetsAdded: events.filter(e => e.kind === 'widget-added').length,
    alertsConfigured: events.filter(e => e.kind === 'alert-configured').map(e => asMade(e.name, e.actor?.name ?? null, e.at)),
    alertsFired: events.filter(e => e.kind === 'alert-fired').length,
    alertsFiredList: events.filter(e => e.kind === 'alert-fired').map(e => asMade(e.name, e.actor?.name ?? null, e.at)),
  };

  const trail = REPORT_TRAIL.filter(e => inWindow(e.at, p)
    && (scope.level === 'company' || (scope.level === 'team' ? e.team === scope.team : e.actor.email === scope.userEmail)));

  const reports: ReportFigures = {
    made: trail.filter(e => e.action === 'created').map(e => asMade(e.reportName, e.actor.name, e.at)),
    shared: trail.filter(e => e.action === 'shared').map(e => asMade(e.reportName, e.actor.name, e.at, e.sharedWith ? `to ${e.sharedWith}` : undefined)),
    finalised: trail.filter(e => e.action === 'moved-to-final').length,
    downloads: trail.filter(e => e.action === 'downloaded').length,
  };

  const engagements = ENGAGEMENT_ROWS.filter(e => scope.level !== 'team' || e.team === scope.team);

  const created: CreatedFigures = {
    engagements: engagements.filter(e => inWindow(e.createdAt, p)).map(e => asMade(e.name, e.owner, e.createdAt, e.code)),
    controls: CONTROL_CREATIONS
      .filter(c => inWindow(c.at, p) && (scope.level !== 'team' || c.team === scope.team))
      .map(c => asMade(c.name, c.raisedByAi ? null : c.owner, c.at, c.raisedByAi ? 'proposed from an SOP' : undefined)),
    dashboards: product.dashboardsBuilt,
    reports: reports.made,
    risks: RISK_ROWS.filter(r => inWindow(r.createdAt, p) && (scope.level !== 'team' || r.team === scope.team))
      .map(r => asMade(r.name, r.raisedByAi ? null : r.owner, r.createdAt, r.raisedByAi ? 'proposed by the assistant' : undefined)),
  };

  /*
   * Each surface says exactly what its own data supports.
   *
   * `money` is a whole sentence rather than a figure with a prefix bolted on.
   * The four surfaces are in four different states. The contract prices one of
   * them. The second prices some of its own work and cannot price the rest. The
   * third is estimated and was never built for billing, and the fourth records
   * nothing at all. One shared label over all four would be wrong about three.
   */
  /*
   * This surface counts every call attempted and the cost block counts the ones
   * the contract charges for, so the two differ by exactly two things: calls on
   * a lookup our operations team has not priced yet, and calls that never came
   * back. Both are named with their number, because two counts of one thing and
   * no reason between them costs the page its reader.
   */
  const lookupCallsPriced = cost.lines.reduce((sum, line) => sum + line.calls, 0);
  const lookupCallsUnpriced = cost.unpriced.reduce((sum, line) => sum + line.calls, 0);
  const lookupCallsNote = (() => {
    // Nothing to reconcile when nothing was called, and a sentence about a
    // count of nought reads as machinery talking to itself.
    if (volume.lookupCalls === 0) return undefined;
    const rest: string[] = [];
    if (lookupCallsUnpriced > 0) {
      rest.push(`${fmtInt(lookupCallsUnpriced)} ran on a lookup nobody has priced yet`);
    }
    if (cost.failedCalls > 0) rest.push(`${fmtInt(cost.failedCalls)} never came back`);
    if (rest.length === 0) {
      return 'Every one of them is on a contract price, so this is also the count behind the cost.';
    }
    const tail = rest.length > 1 ? 'so neither is charged' : 'so it is counted and charged nothing';
    return `${fmtInt(lookupCallsPriced)} of them are on a contract price. `
      + `Another ${rest.join(', and ')}, ${tail}.`;
  })();

  const aiUsage: AiUsageRow[] = [
    {
      surface: 'Paid verification lookups',
      count: volume.lookupCalls,
      countLabel: 'calls',
      note: lookupCallsNote,
      money: cost.totalPaise > 0
        ? `Priced at ${fmtMoneyExact(cost.totalPaise / 100)}, as per your contract.`
        : 'Counted, but the contract does not price these yet.',
      measured: true,
    },
    {
      surface: 'Concierge jobs',
      count: volume.concierge,
      countLabel: 'jobs',
      money: cost.conciergeJobsUnpriceable > 0
        ? `Partly priced. The tools that price themselves recorded ${fmtMoneyExact(cost.conciergePaise / 100)}. `
          + `Another ${fmtInt(cost.conciergeJobsUnpriceable)} jobs have no cost code at all, so we can count them but never price them.`
        : `${fmtMoneyExact(cost.conciergePaise / 100)} recorded by the tools themselves.`,
      measured: false,
    },
    {
      surface: 'Chat (Ask IRA)',
      count: volume.chat,
      countLabel: 'questions',
      money: 'Not priced. Usage is estimated from text length, four characters to a unit. It was built to '
        + 'stop conversations running away, not to bill anybody.',
      measured: false,
    },
    {
      surface: 'SOP to RACM',
      count: volume.sopJobs,
      countLabel: 'jobs',
      money: `Not priced: nothing about what it consumes is recorded. ${fmtInt(volume.sopCacheHits)} of these `
        + 'were served from the cache and used no AI at all, so the job count is not the spend.',
      measured: false,
    },
  ];

  const attention = attentionCards(scope, { stuck, risks, coverage, queue, learn, sampling });

  return {
    scope,
    period: p,
    committee: coveragePack(p, scope),
    settings,
    value,
    cost,
    coverage,
    risks,
    exceptions,
    stuck,
    reliability,
    sampling,
    ccm,
    volume,
    created,
    product,
    reports,
    people: peopleOf(p, scope),
    learn,
    aiUsage,
    queue,
    buckets: overTime(runs, p, settings),
    engagements,
    portfolio,
    insights,
    ageing,
    quality,
    attention,
  };
}

function sopJobsIn(p: Period, scope: Scope) {
  return SOP_JOBS.filter(j => inWindow(j.at, p) && mine(scope, j.actor, j.actor.team));
}

/**
 * At most three cards, each a plain sentence with one thing to do.
 *
 * It is not a notifier: nothing is sent anywhere and there is no threshold to
 * configure. It is the page answering before it is asked, and when there is
 * nothing to say it says so once and gets out of the way.
 */
function attentionCards(
  scope: Scope,
  data: {
    stuck: StuckRun[];
    risks: RiskFigures;
    coverage: CoverageFigures;
    queue: QueueFigures;
    learn: LearnFigures;
    sampling: SamplingFigures;
  },
): AttentionCard[] {
  const cards: AttentionCard[] = [];

  /*
   * An auditor sees only what is theirs.
   *
   * A company-wide "3 critical risks have no control" is true, and it is also
   * somebody else's job. Putting it at the top of one person's page is the
   * quiet start of a page that tells everybody about everybody, which is the
   * thing this view exists not to do.
   */
  if (scope.level === 'person') {
    if (data.queue.items.length > 0) {
      cards.push({
        id: 'queue',
        text: data.queue.overdue > 0
          ? `${plural(data.queue.items.length, 'item is', 'items are')} waiting on you`
            + `${data.queue.items.length === 1 ? ', and it is overdue.' : `, ${fmtInt(data.queue.overdue)} of them overdue.`}`
          : `${plural(data.queue.items.length, 'item is', 'items are')} waiting on you. None are overdue yet.`,
        actionLabel: 'See the queue',
        target: 'queue',
      });
    }

    const ownStuck = data.stuck[0];
    if (ownStuck) {
      cards.push({
        id: 'stuck',
        text: `${ownStuck.run.workflowName}, which you started, is stuck: ${ownStuck.run.errorText}`,
        actionLabel: 'Open it',
        target: 'stuck',
        focusId: ownStuck.run.workflowId,
      });
    }

    if (data.learn.pending.length > 0) {
      cards.push({
        id: 'memory',
        text: `${plural(data.learn.pending.length, 'thing the assistant has learned about you is', 'things the assistant has learned about you are')} `
          + 'waiting on your approval.',
        actionLabel: 'Review them',
        target: 'memory',
      });
    }

    return cards.slice(0, 3);
  }

  const worst = data.stuck[0];
  if (worst) {
    cards.push({
      id: 'stuck',
      text: worst.repeats > 1
        ? `${worst.run.workflowName} failed ${fmtInt(worst.repeats)} times with the same error.`
        : `${worst.run.workflowName} is stuck: ${worst.run.errorText}`,
      actionLabel: 'Open it',
      target: 'stuck',
      focusId: worst.run.workflowId,
    });
  }

  if (data.risks.criticalUnmapped.length > 0) {
    cards.push({
      id: 'risks',
      text: `${plural(data.risks.criticalUnmapped.length, 'critical risk has', 'critical risks have')} no control covering `
        + `${data.risks.criticalUnmapped.length === 1 ? 'it' : 'them'}.`,
      actionLabel: 'See them',
      target: 'risks',
    });
  }

  // The never-exercised figure, not the in-window one: this card lands on the
  // block that leads with never-ever, and a card that disagrees with the block
  // it opens costs the page more than a missing card would.
  if (cards.length < 3 && data.coverage.neverExercised.length > 0) {
    cards.push({
      id: 'controls',
      text: `${plural(data.coverage.neverExercised.length, 'control has', 'controls have')} never been exercised.`,
      actionLabel: 'See which',
      target: 'controls',
    });
  }

  if (cards.length < 3 && data.learn.pending.length > 0) {
    cards.push({
      id: 'memory',
      text: `${plural(data.learn.pending.length, 'thing the assistant has learned is', 'things the assistant has learned are')} `
        + 'waiting on your approval.',
      actionLabel: 'Review them',
      target: 'memory',
    });
  }

  if (cards.length < 3 && data.queue.overdue > 0) {
    cards.push({
      id: 'queue',
      text: `${plural(data.queue.overdue, 'item', 'items')} across ${scope.subject} `
        + `${data.queue.overdue === 1 ? 'is past its' : 'are past their'} due date.`,
      actionLabel: 'See the queue',
      target: 'queue',
    });
  }

  return cards.slice(0, 3);
}

/** Used by the exports and the acceptance tests, so the file name is one string. */
export function usageFileName(scope: Scope, p: Period, extension: string): string {
  const who = SCOPE_LABEL[scope.level].toLowerCase().replace(/\s+/g, '-');
  return `platform-usage-${who}-${p.label.toLowerCase().replace(/\s+/g, '-')}.${extension}`;
}

export { EXAMPLE_QUARTER };
