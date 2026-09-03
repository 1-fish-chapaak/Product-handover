/**
 * Platform Usage. The figures.
 *
 * The records live next door in `platform-usage.ts`. This module turns them
 * into the numbers each of the guide's three views reads, and it holds the
 * rules that stop those numbers being wrong in the ways the guide warns about.
 *
 * ## The rules that live here rather than in a component
 *
 * **Coverage counts a population once.** A monthly check over a rolling window
 * re-tests the same rows every month; adding them up would inflate coverage
 * roughly elevenfold and the first person to notice would stop believing the
 * page. So coverage counts the population, and the repeats are counted
 * separately and called checks performed.
 *
 * **Failed runs are excluded from every saving.** They are reported on their
 * own as wasted machine time. Most honest, least flattering.
 *
 * **Nothing is presented as fact that is not recorded.** A measured number
 * states its source and its sample. An assumed one carries the word estimated
 * and its label, on the same screen as the figure it produces.
 *
 * **The view comes from the role.** The server decides; the reader does not
 * pick. Asking for a view above your rights returns a refusal, never a blank
 * page, because a blank page hides a permission bug.
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
import { pendingMemories, liveMemories } from './memorySession';
import { RECALLS_THIS_WEEK } from './memoryStore';
import type { PlatformMemory } from './memoryStore';

/* ──────────────────────────────────────────────────────────────────────────
 * Formatting
 * ────────────────────────────────────────────────────────────────────────── */

const INT = new Intl.NumberFormat('en-GB');
const ONE_DP = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const TWO_DP = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
 * A saving is always rounded towards zero. Rounding a benefit up, even by half
 * an hour, is the kind of small dishonesty that costs a page its reader.
 */
export const fmtHours = (h: number): string => (h < 10 ? fmtOneDp(h) : fmtInt(Math.floor(h)));

/**
 * People, as a headcount, always to one decimal.
 *
 * A saving of 15.4 people printed as "15" hides four tenths of a person, which
 * is a fortnight of somebody's work every quarter. It also made the page unable
 * to show the one thing that moved when the rate was corrected, because 14.9
 * and 15.4 both printed as 15.
 */
/**
 * Auditors, as whole people.
 *
 * "14.9 auditors" reads as a measurement, and there is no such thing as nine
 * tenths of an auditor. The figure is an estimate resting on an estimated rate,
 * so a decimal place claims a precision the number does not have. It rounds to
 * the nearest whole person and the sentence says "about".
 */
export const fmtPeople = (n: number): string => fmtInt(Math.round(n));

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

/** Money the way an Indian CFO reads it: lakh and crore, not millions. */
export function fmtMoney(rupees: number): string {
  const n = Math.abs(rupees);
  if (n >= 10_000_000) return `₹${fmtOneDp(rupees / 10_000_000)} cr`;
  if (n >= 100_000) return `₹${fmtOneDp(rupees / 100_000)} lakh`;
  return `₹${INDIAN.format(Math.round(rupees))}`;
}

/**
 * The same money, with enough precision that a crore does not swallow two lakh.
 *
 * `fmtMoney` gives one decimal at every scale, which is right for a headline
 * and wrong for a table of four figures four times apart: ₹1.78 crore printed
 * as ₹1.8 crore drops ₹2 lakh, and the row below it is only ₹67 lakh. So the
 * scenario table keeps two decimals once it is into crore, and one below.
 */
export function fmtMoneyFine(rupees: number): string {
  const n = Math.abs(rupees);
  if (n >= 10_000_000) return `₹${TWO_DP.format(rupees / 10_000_000)} cr`;
  if (n >= 100_000) return `₹${fmtOneDp(rupees / 100_000)} lakh`;
  return `₹${INDIAN.format(Math.round(rupees))}`;
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
 * Who is reading
 * ────────────────────────────────────────────────────────────────────────── */

export type Persona = 'cfo' | 'head_of_team' | 'auditor';

export const PERSONA_TITLE: Record<Persona, string> = {
  cfo: 'CFO',
  head_of_team: 'Head of Team',
  auditor: 'Internal Auditor',
};

/** The question the view exists to answer, said in the reader's own words. */
export const PERSONA_QUESTION: Record<Persona, string> = {
  cfo: 'Is this paying for itself?',
  head_of_team: 'Is anything stuck?',
  auditor: 'What is waiting on me?',
};

export const PERSONA_SCOPE_LABEL: Record<Persona, string> = {
  cfo: 'Whole company',
  head_of_team: 'Your team only',
  auditor: 'Your own work only',
};

export interface Scope {
  persona: Persona;
  /** Said inside a sentence: "the company", "SOX Audit", "you". */
  subject: string;
  team?: string;
  userEmail?: string;
  userName?: string;
}

/**
 * The highest view a role may read.
 *
 * `ad_usage` is the whole company and the only view that carries money;
 * `ad_usage_people` without it is that person's own team; everybody else gets
 * themselves. A team lead with no team on their record falls back to their own
 * view rather than being shown an empty team.
 *
 * There is no null case. Every signed-in person can read their own work with no
 * request and no approval, which was decided early on: this page is self-serve.
 * The permissions decide how far up somebody can see, not whether they may open
 * the page at all.
 */
export function personaFor(
  holds: { usage: boolean; people: boolean; self: boolean },
  team: string | null,
): Persona {
  if (holds.usage) return 'cfo';
  if (holds.people && team) return 'head_of_team';
  return 'auditor';
}

/**
 * Which views the switch may offer.
 *
 * A lens, not a key. It never shows anybody data they could not otherwise see,
 * and it only ever narrows down the reader's own line: a CFO can look at one
 * team or at one person's queue shape, a team lead can look at their own work,
 * and nobody can ever look sideways into somebody else's team. A view the
 * reader is not entitled to is not offered at all, so the switch cannot be used
 * to ask for one.
 */
export function entitledViews(ceiling: Persona, team: string | null): Persona[] {
  if (ceiling === 'cfo') return team ? ['cfo', 'head_of_team', 'auditor'] : ['cfo', 'auditor'];
  if (ceiling === 'head_of_team') return ['head_of_team', 'auditor'];
  return ['auditor'];
}

/**
 * What somebody asking for a view above their entitlement is told.
 *
 * The switch never offers one, so this is reached by a stale link rather than
 * by a click. It is a refusal and never an empty page: an empty page reads as
 * "no data" and would hide a permissions bug.
 */
export const REFUSAL =
  'That view is above what your role may read. Every signed-in person can read their own work here; '
  + 'ask an administrator if you need the team or company view.';

/* ──────────────────────────────────────────────────────────────────────────
 * The window
 * ────────────────────────────────────────────────────────────────────────── */

export type PeriodId = 'this-month' | 'this-quarter' | 'fy-to-date' | 'this-year' | 'since-start' | 'custom';

export interface CustomRange { from: number; to: number }

export interface Period {
  id: PeriodId;
  /** How it reads on a control: "This quarter". */
  label: string;
  /** How it reads inside a sentence: "this quarter". */
  phrase: string;
  from: number;
  to: number;
  /** The window of the same length immediately before this one. */
  priorFrom: number;
  priorTo: number;
  /** Fractional months, so a people-equivalent is right on a part month. */
  months: number;
  days: number;
}

const startOfMonth = (ms: number) => {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
};
const startOfQuarter = (ms: number) => {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), Math.floor(d.getUTCMonth() / 3) * 3, 1);
};
const startOfYear = (ms: number) => Date.UTC(new Date(ms).getUTCFullYear(), 0, 1);
/**
 * The Indian financial year starts on 1 April.
 *
 * A calendar year to date resolves to 1 January, which on the anchor is the
 * same window as the quarter and prints the same figures under a different
 * name. The window a committee reads is this one, so it is offered as well as
 * the calendar year rather than instead of it.
 */
const startOfFinancialYear = (ms: number) => {
  const d = new Date(ms);
  const year = d.getUTCMonth() < 3 ? d.getUTCFullYear() - 1 : d.getUTCFullYear();
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

function make(id: PeriodId, label: string, phrase: string, from: number, to: number): Period {
  const span = to - from;
  const days = Math.max(1, Math.round(span / DAY_MS));
  return {
    id, label, phrase, from, to,
    priorFrom: from - span - 1,
    priorTo: from - 1,
    months: monthsCovered(from, to),
    days,
  };
}

export function period(id: PeriodId, custom?: CustomRange | null): Period {
  switch (id) {
    case 'this-month':
      return make('this-month', 'This month', 'this month', startOfMonth(ANCHOR), ANCHOR);
    case 'fy-to-date':
      return make('fy-to-date', 'Financial year to date', 'this financial year so far', startOfFinancialYear(ANCHOR), ANCHOR);
    case 'this-year':
      return make('this-year', 'This year', 'this year', startOfYear(ANCHOR), ANCHOR);
    case 'since-start':
      return make('since-start', 'Since you started', 'since you started', HISTORY_START, ANCHOR);
    case 'custom':
      return custom
        ? make('custom', 'Custom range', `${formatDate(custom.from)} to ${formatDate(custom.to)}`, custom.from, custom.to)
        : period('this-quarter');
    default:
      return make('this-quarter', 'This quarter', 'this quarter', startOfQuarter(ANCHOR), ANCHOR);
  }
}

export const periodOptions: { id: PeriodId; label: string }[] = [
  { id: 'this-month', label: 'This month' },
  { id: 'this-quarter', label: 'This quarter' },
  { id: 'fy-to-date', label: 'Financial year to date' },
  { id: 'this-year', label: 'This year' },
  { id: 'since-start', label: 'Since you started' },
  { id: 'custom', label: 'Custom' },
];

/** The default window per view: a CFO reads a quarter, everyone else a month. */
export const DEFAULT_PERIOD: Record<Persona, PeriodId> = {
  cfo: 'this-quarter',
  head_of_team: 'this-month',
  auditor: 'this-month',
};

/** What the comparison is against, said by its real length rather than "last period". */
export function priorLabel(p: Period): string {
  if (p.id === 'this-month') return 'the month before';
  if (p.id === 'this-quarter') return 'the quarter before';
  if (p.id === 'fy-to-date') return 'the same stretch of the financial year before';
  if (p.id === 'this-year') return 'the year before';
  return `the ${p.days} days before`;
}

const change = (now: number, before: number): number | null => {
  if (before <= 0) return null;
  return ((now - before) / before) * 100;
};

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

export type NumericSetting = 'manualReviewRate' | 'manualControlTestHours' | 'hourlyRate' | 'hoursPerPersonPerMonth';

/**
 * The four assumptions, in the order they are read in: the two that measure
 * themselves first, then the two that never can. The page, the CSV and the PDF
 * all walk this one list, so none of them can quietly show a different four.
 */
export const ASSUMPTIONS: NumericSetting[] = [
  'manualReviewRate', 'manualControlTestHours', 'hourlyRate', 'hoursPerPersonPerMonth',
];

export const SETTING_LABEL: Record<NumericSetting, string> = {
  manualReviewRate: 'rows a person checks against a rule by hand in an hour',
  manualControlTestHours: 'hours one manual control test takes',
  hourlyRate: 'the cost of an hour of an auditor you employ',
  hoursPerPersonPerMonth: 'working hours per person per month',
};

export const SETTING_SHORT: Record<NumericSetting, string> = {
  manualReviewRate: 'Rows checked against a rule by hand per hour',
  manualControlTestHours: 'Hours per manual control test',
  hourlyRate: 'Cost of an hour of an auditor you employ',
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
  hourlyRate: number;
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

/**
 * What an auditor costs. Three round numbers, and they are an estimate.
 *
 * They are round on purpose. A figure like ₹529.60 invites a reader to think
 * somebody measured it, and nobody did. Nothing in this product records what
 * anybody is paid, and no software can see salaries, so this is the one number
 * on the page we assume rather than read. Saying it in round hundreds is the
 * honest way to say "this is roughly right and it is not meant to be exact".
 *
 * The month leads because that is how an auditor is actually paid. Big 4 firms
 * in India and in-house audit teams both pay a monthly salary; they may bill a
 * client by the hour, but nobody employed is paid by the hour. Published pay
 * data for an internal auditor in India runs about ₹6.5 to ₹8 lakh a year, so
 * ₹80,000 a month is the round figure we work with.
 *
 * The salary is paid for the whole month, weekends and holidays included. What
 * you get back is about twenty working days. So an hour of actual audit work
 * costs ₹500, and the weekends are not free: their cost is already carried
 * inside that ₹500.
 */
export const AUDITOR_COST = {
  /** ₹80,000. The salary, paid for the whole month, weekends included. */
  month: 80_000,
  /** Working days in a month. Weekends and holidays are paid but not worked. */
  workingDays: 20,
  /** Hours in a working day. */
  hoursInDay: 8,
  /** What published pay data says, for context only. Never printed as proof. */
  publishedFrom: 650_000,
  publishedTo: 800_000,
} as const;

/** ₹4,000 a day. */
export const AUDITOR_DAY = AUDITOR_COST.month / AUDITOR_COST.workingDays;

/** ₹500 an hour of actual audit work. */
export const AUDITOR_HOUR = AUDITOR_DAY / AUDITOR_COST.hoursInDay;

/** 160 hours. What one person gives you in a month. */
export const HOURS_PER_MONTH = AUDITOR_COST.workingDays * AUDITOR_COST.hoursInDay;

/** 480 hours. What one person gives you in a quarter, which is how this reads. */
export const HOURS_PER_QUARTER = HOURS_PER_MONTH * 3;

/**
 * The whole sum in one paragraph, so it can travel with the figure it produces.
 *
 * The page shows it laid out as five steps and the exports carry this line, and
 * both are built from the same constants, so neither can drift from the other.
 */
export const RATE_DERIVATION_LINE =
  `This is an estimate, and the numbers are round because it is not meant to be exact. An auditor's `
  + `salary is about ${fmtMoneyExact(AUDITOR_COST.month)} a month, paid for the whole month with `
  + `weekends included. A month holds about ${AUDITOR_COST.workingDays} working days, so a day is `
  + `${fmtMoneyExact(AUDITOR_DAY)}, and a working day is ${AUDITOR_COST.hoursInDay} hours, so an hour `
  + `of audit work is ${fmtMoneyExact(AUDITOR_HOUR)}. The weekends are not free, their cost is already `
  + `inside that ${fmtMoneyExact(AUDITOR_HOUR)}. Published pay data for an internal auditor in India `
  + `runs about ${fmtMoneyExact(AUDITOR_COST.publishedFrom)} to ${fmtMoneyExact(AUDITOR_COST.publishedTo)} `
  + 'a year, which is what we looked at, not what we are claiming. Nothing in this product records what '
  + 'anybody is paid, so this is the one figure here your finance team can replace with a better one.';

/** The ladder, three rows, said the way an auditor is actually paid. */
export const RATE_DERIVATION_STEPS: { step: string; value: string; from: string }[] = [
  {
    step: 'One month',
    value: fmtMoneyExact(AUDITOR_COST.month),
    from: 'an auditor\'s salary, paid for the whole month, weekends included',
  },
  {
    step: 'One day',
    value: fmtMoneyExact(AUDITOR_DAY),
    from: `a month holds about ${AUDITOR_COST.workingDays} working days`,
  },
  {
    step: 'One hour of audit work',
    value: fmtMoneyExact(AUDITOR_HOUR),
    from: `a working day is ${AUDITOR_COST.hoursInDay} hours. The weekends are paid but not worked, so their cost is already inside this figure`,
  },
];

/**
 * The pace, said for what it is.
 *
 * The profession documents 4 to 9 transactions an hour for full substantive
 * testing with documentation, and a reader who knows that figure will think 200
 * is twenty times wrong until the page says these are two different pieces of
 * work. They are. This one is a person reading a row, checking it against a
 * rule and moving on.
 */
export const RATE_KIND_LINE =
  'This is a person reading a row in a spreadsheet, checking it against a rule and moving on. It is '
  + 'not full substantive testing with documentation, which the profession puts at 4 to 9 transactions '
  + 'an hour and which is a different piece of work. Note also that a faster pace makes the saving '
  + 'smaller, so 200 is the careful choice rather than the flattering one.';

/** The shipped starting point. Nothing here was ever typed by a customer. */
const BASE: Omit<UsageSettings, 'changes'> = {
  manualReviewRate: RATE_PER_HOUR,
  manualControlTestHours: 4,
  hourlyRate: AUDITOR_HOUR,
  hoursPerPersonPerMonth: HOURS_PER_MONTH,
  source: {
    manualReviewRate: 'starting-value',
    manualControlTestHours: 'starting-value',
    hourlyRate: 'default',
    hoursPerPersonPerMonth: 'default',
  },
  note: {
    manualReviewRate:
      `Worked out rather than picked: ${RATE_BASIS_LINE}. ${RATE_KIND_LINE} Nobody measured it and `
      + "it is not an industry benchmark, so argue with any of it and the page moves with you. Your "
      + "team's own pace replaces it once there is enough recorded history.",
    manualControlTestHours:
      'A starting number we picked. It replaces itself once manual tests carry start and finish times.',
    hourlyRate: RATE_DERIVATION_LINE,
    hoursPerPersonPerMonth:
      `${AUDITOR_COST.workingDays} working days at ${AUDITOR_COST.hoursInDay} hours is `
      + `${fmtInt(HOURS_PER_MONTH)} hours, which is what one person gives you in a month. Over a `
      + `quarter that is ${fmtInt(HOURS_PER_QUARTER)} hours. Round numbers, and an estimate.`,
  },
  measurable: {
    manualReviewRate: true,
    manualControlTestHours: true,
    hourlyRate: false,
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
      ? `${fmtInt(BASE.manualReviewRate)} an hour is ${RATE_BASIS_LINE}. ${RATE_KIND_LINE} Nothing is on record yet to replace it with.`
      : `${fmtInt(BASE.manualReviewRate)} an hour is ${RATE_BASIS_LINE}. ${RATE_KIND_LINE} Your own ${fmtInt(usableReviews.length)} timed `
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

/**
 * What the same saved hours are worth, four ways, and why the four differ.
 *
 * This block used to print the figure at three different by-hand paces and say
 * it swung eight times, which read as us admitting we did not know. The swing
 * was real and the reason given for it was wrong. It is not our uncertainty. It
 * is a fact about how a company gets its audit hours: an hour bought from a
 * firm costs four or five times an hour worked by somebody on the payroll, and
 * the page never said so.
 *
 * So the rows are the four ways an audit hour is costed, the saved hours are
 * the same 7,131 in every one, and only the price of the hour moves.
 */
export interface Sensitivity {
  /** How the company gets the hour, said in words. */
  basis: string;
  rate: number;
  hours: number;
  rupees: number;
  /** Where the rate comes from, on the row. */
  from: string;
  /** True on the row this page's own figure is nearest to. */
  ours: boolean;
}

/** Said once, under the table, because it is the whole point of the table. */
export const SENSITIVITY_CAUSE =
  'The spread is not doubt about the figure. It is the difference between employing auditors and '
  + 'buying their hours from a firm, which is a fact about your own operating model rather than '
  + 'anything this page is unsure of. The hours saved are the same in every row. Only the price of '
  + 'an hour moves.';

export function sensitivity(hoursSaved: number): Sensitivity[] {
  /*
   * The saved hours are priced, not the by-hand hours, so every row ties to the
   * saving printed at the top of the view. The first row is the rate the page
   * itself carries, and it is the lowest of the four on purpose: the page leads
   * with the least flattering way of costing an audit hour.
   *
   * Every rate here is round and every one is an estimate. The spread is not
   * doubt about the figure, it is the difference between employing auditors and
   * buying their hours.
   */
  const rows: { basis: string; rate: number; from: string; ours: boolean }[] = [
    {
      basis: 'Auditors you employ',
      rate: AUDITOR_HOUR,
      from: `${fmtMoneyExact(AUDITOR_COST.month)} a month over ${fmtInt(HOURS_PER_MONTH)} working hours`,
      ours: true,
    },
    {
      basis: 'Auditors you employ, if only six hours of the day reach audit work',
      rate: 650,
      from: `the same ${fmtMoneyExact(AUDITOR_COST.month)} a month over 120 hours instead of ${fmtInt(HOURS_PER_MONTH)}`,
      ours: false,
    },
    {
      basis: 'Hours bought from a firm, at the lower end',
      rate: 1_000,
      from: 'roughly what a smaller firm quotes for an internal audit hour. Our estimate, not a published rate',
      ours: false,
    },
    {
      basis: 'Hours bought from a firm, at the upper end',
      rate: 2_500,
      from: 'roughly what a large firm quotes for an internal audit hour. Our estimate, not a published rate',
      ours: false,
    },
  ];

  return rows.map(row => ({ ...row, hours: hoursSaved, rupees: hoursSaved * row.rate }));
}

/* ──────────────────────────────────────────────────────────────────────────
 * Scoping a record to the reader
 * ────────────────────────────────────────────────────────────────────────── */

const inWindow = (ms: number, p: Period) => ms >= p.from && ms <= p.to;

function mine(scope: Scope, actor: Actor | null, team: string | null): boolean {
  if (scope.persona === 'cfo') return true;
  if (scope.persona === 'head_of_team') return team === scope.team;
  return actor?.email === scope.userEmail;
}

const scopedRuns = (scope: Scope) => RUNS.filter(r => mine(scope, r.actor, r.team));

/* ──────────────────────────────────────────────────────────────────────────
 * Value: hours, rupees, people
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
  /**
   * What the time saved is worth at the assumed rate.
   *
   * Priced on the saving rather than on the hours by hand, so the money can
   * never say more than the hours printed above it. Pricing the full manual
   * figure would quietly hand back the machine time the hours line had just
   * given up, and a page that rounds its hours down and its rupees up is a page
   * nobody should believe.
   */
  rupees: number;
  /** The saving as a headcount, on the same saved hours the money uses. */
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
    rupees: hoursSaved * settings.hourlyRate,
    people: hoursSaved / (settings.hoursPerPersonPerMonth * Math.max(p.months, 0.03)),
  };
}

/** The same calculation over the window immediately before this one. */
function priorValueOf(runs: Run[], p: Period, settings: UsageSettings): ValueFigures {
  const shifted: Period = { ...p, from: p.priorFrom, to: p.priorTo };
  return valueOf(runs, shifted, settings);
}

export interface ValueChange {
  hours: number | null;
  rupees: number | null;
  people: number | null;
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
  neverTested: { id: string; name: string; process: string; owner: string }[];
  /**
   * Never exercised at all, in the whole history.
   *
   * PU-07 deliberately ignores the period selector: changing the window must
   * change nothing here. "Never" needs no setting behind it, which is what
   * makes it the one coverage figure nobody can argue with.
   */
  neverExercised: { id: string; name: string; process: string; owner: string }[];
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
  if (scope.persona === 'cfo') return CONTROLS;
  const owners = new Set(ACTORS
    .filter(a => (scope.persona === 'head_of_team' ? a.team === scope.team : a.email === scope.userEmail))
    .map(a => a.name));
  return CONTROLS.filter(c =>
    owners.has(c.owner)
    || POPULATIONS.some(pop => pop.controlId === c.id
      && (scope.persona === 'head_of_team' ? pop.team === scope.team : true)));
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

  const neverTested = inScopeControls
    .filter(c => !touched.has(c.id))
    .map(c => ({ id: c.id, name: c.name, process: c.process, owner: c.owner }));

  // Never means never, over the whole history, with the window taken off. A
  // control that has never once been exercised is a different and much harder
  // fact than one that was quiet for three months.
  const everTouched = new Set<string>();
  runs.filter(r => r.status === 'passed').forEach(r => everTouched.add(r.controlId));
  samples.filter(s => s.outcome === 'passed' || s.outcome === 'failed').forEach(s => everTouched.add(s.controlId));

  const neverExercised = inScopeControls
    .filter(c => !everTouched.has(c.id))
    .map(c => ({ id: c.id, name: c.name, process: c.process, owner: c.owner }));

  const ranWorkflows = new Set(runs.map(r => r.workflowId));
  const workflowsNeverRun = [...new Map(POPULATIONS
    .filter(pop => scope.persona !== 'head_of_team' || pop.team === scope.team)
    .filter(pop => !ranWorkflows.has(pop.workflowId))
    .map(pop => [pop.workflowId, { id: pop.workflowId, name: pop.workflowName }]))
    .values()]
    .sort((a, b) => a.name.localeCompare(b.name));

  const populations = POPULATIONS
    .filter(pop => scope.persona !== 'head_of_team' || pop.team === scope.team)
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
  const rows = RISK_ROWS.filter(r => scope.persona !== 'head_of_team' || r.team === scope.team);
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
    && (scope.persona === 'cfo' || (scope.persona === 'head_of_team' ? s.team === scope.team : s.actor.email === scope.userEmail)));
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
    .filter(r => scope.persona !== 'head_of_team' || r.team === scope.team)
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

  const engagements = ENGAGEMENT_ROWS.filter(e => scope.persona !== 'head_of_team' || e.team === scope.team);

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
  /** Which team the person works in, said rather than compared. */
  team: string;
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
  // The whole company view answers "is the team actually using what we bought",
  // so it lists everybody. A team lead sees their own team and nobody else's.
  // Somebody reading their own work sees no table of people at all.
  if (scope.persona === 'auditor') return [];
  if (scope.persona === 'head_of_team' && !scope.team) return [];
  const inScope = RUNS.filter(r => scope.persona === 'cfo' || r.team === scope.team);
  const names = [...new Set(inScope.map(r => r.actor.name))];
  return names
    .map(name => {
      const runs = RUNS.filter(r => r.actor.name === name && inWindow(r.completedAt, p));
      const found = TRACED_EXCEPTIONS.filter(ex => ex.assignee.name === name && inWindow(ex.detectedAt, p));
      const resolved = found.filter(ex => ex.status === 'Resolved');
      const last = runs.length ? Math.max(...runs.map(r => r.completedAt)) : null;
      return {
        name,
        team: RUNS.find(r => r.actor.name === name)?.team ?? '',
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
  const forMe = (m: PlatformMemory) => scope.persona !== 'auditor' || m.scope === 'personal';
  const mineLive = live.filter(forMe);

  return {
    active: mineLive.filter(m => m.status === 'active'),
    pending: pending.filter(forMe),
    dueReview: mineLive.filter(m => m.renewDue).length,
    recallsThisWeek: scope.persona === 'cfo' ? RECALLS_THIS_WEEK : null,
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
  const rows = ENGAGEMENT_ROWS.filter(e => scope.persona !== 'head_of_team' || e.team === scope.team);
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
    .filter(item => scope.persona === 'cfo'
      || (scope.persona === 'head_of_team' ? item.assignee.team === scope.team : item.assignee.email === scope.userEmail))
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
  rupees: number;
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

    // Priced the same way the headline is: hand-checking avoided, less the
    // machine time it took, so the column adds up to the figure on the hero
    // rather than to a slightly larger one.
    const machineHours = slice.reduce((sum, r) => sum + (r.completedAt - r.startedAt), 0) / HOUR_MS;
    const hours = Math.max(0, newRows / settings.manualReviewRate - machineHours);
    out.push({
      label: step === 30 * DAY_MS ? formatShortMonth(from) : formatDayMonth(from),
      from,
      to,
      runs: slice.length,
      newRows,
      hours,
      rupees: hours * settings.hourlyRate,
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
  settings: UsageSettings;
  value: ValueFigures;
  prior: ValueFigures;
  change: ValueChange;
  cost: CostFigures;
  /** What the work was worth less what the contract charged. */
  netRupees: number;
  sensitivity: Sensitivity[];
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
  const prior = priorValueOf(runs, p, settings);
  const cost = costOf(p, scope);
  const sampling = samplingOf(p, scope);
  const exceptions = exceptionsOf(p, scope);
  const coverage = coverageOf(runs, SAMPLE_VALIDATIONS.filter(s =>
    scope.persona === 'cfo' || (scope.persona === 'head_of_team' ? s.team === scope.team : s.actor.email === scope.userEmail)), p, scope);
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
    && (scope.persona === 'cfo' || (scope.persona === 'head_of_team' ? e.team === scope.team : e.actor?.email === scope.userEmail)));

  const product: ProductFigures = {
    dashboardsBuilt: events.filter(e => e.kind === 'dashboard-created').map(e => asMade(e.name, e.actor?.name ?? null, e.at)),
    dashboardEdits: events.filter(e => e.kind === 'dashboard-edited').length,
    widgetsAdded: events.filter(e => e.kind === 'widget-added').length,
    alertsConfigured: events.filter(e => e.kind === 'alert-configured').map(e => asMade(e.name, e.actor?.name ?? null, e.at)),
    alertsFired: events.filter(e => e.kind === 'alert-fired').length,
    alertsFiredList: events.filter(e => e.kind === 'alert-fired').map(e => asMade(e.name, e.actor?.name ?? null, e.at)),
  };

  const trail = REPORT_TRAIL.filter(e => inWindow(e.at, p)
    && (scope.persona === 'cfo' || (scope.persona === 'head_of_team' ? e.team === scope.team : e.actor.email === scope.userEmail)));

  const reports: ReportFigures = {
    made: trail.filter(e => e.action === 'created').map(e => asMade(e.reportName, e.actor.name, e.at)),
    shared: trail.filter(e => e.action === 'shared').map(e => asMade(e.reportName, e.actor.name, e.at, e.sharedWith ? `to ${e.sharedWith}` : undefined)),
    finalised: trail.filter(e => e.action === 'moved-to-final').length,
    downloads: trail.filter(e => e.action === 'downloaded').length,
  };

  const engagements = ENGAGEMENT_ROWS.filter(e => scope.persona !== 'head_of_team' || e.team === scope.team);

  const created: CreatedFigures = {
    engagements: engagements.filter(e => inWindow(e.createdAt, p)).map(e => asMade(e.name, e.owner, e.createdAt, e.code)),
    controls: CONTROL_CREATIONS
      .filter(c => inWindow(c.at, p) && (scope.persona !== 'head_of_team' || c.team === scope.team))
      .map(c => asMade(c.name, c.raisedByAi ? null : c.owner, c.at, c.raisedByAi ? 'proposed from an SOP' : undefined)),
    dashboards: product.dashboardsBuilt,
    reports: reports.made,
    risks: RISK_ROWS.filter(r => inWindow(r.createdAt, p) && (scope.persona !== 'head_of_team' || r.team === scope.team))
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
    settings,
    value,
    prior,
    change: {
      hours: change(value.hoursSaved, prior.hoursSaved),
      rupees: change(value.rupees, prior.rupees),
      people: change(value.people, prior.people),
    },
    cost,
    netRupees: value.rupees - cost.totalPaise / 100,
    sensitivity: sensitivity(value.hoursSaved),
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
  if (scope.persona === 'auditor') {
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
  const who = PERSONA_TITLE[scope.persona].toLowerCase().replace(/\s+/g, '-');
  return `platform-usage-${who}-${p.label.toLowerCase().replace(/\s+/g, '-')}.${extension}`;
}

export { EXAMPLE_QUARTER };
