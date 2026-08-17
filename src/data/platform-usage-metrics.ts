/**
 * Platform Usage — the twenty-eight metrics, and the four numbers behind them.
 *
 * `platform-usage.ts` holds what the platform wrote down. This module turns it
 * into the figures the page shows: PU-01 to PU-28 from the build spec, one
 * function each, every one independently readable and testable.
 *
 * ## The four settings, and why they self-calibrate
 *
 * Four numbers are needed that automation alone cannot supply: how many rows a
 * person checks by hand in an hour, how long a manual control test takes, what
 * an auditor hour costs, and how many hours a month a person works. Two of them
 * are measurable from the customer's own recorded pace, and the weekly
 * calibration job measures them: once the guards pass (90 days of history and
 * enough records) the live value switches to the measured rate on its own, the
 * source label changes to say so, and an audit row is written. Nobody clicks
 * anything, and no screen on this page offers an input field.
 *
 * The two money numbers can never be measured. They run on their labelled
 * defaults, and if a tenant genuinely needs a different value an administrator
 * pins one in Administration — rare by design, and audited like everything else.
 *
 * ## The two rules every metric here holds
 *
 * A figure that rests on a setting is returned with that setting, so the block
 * can print it on the same screen. And a figure the product does not record is
 * returned as null rather than zero, so "nothing happened" and "we don't measure
 * this" can never be rendered the same way.
 */

import {
  ACTION_PLANS, ANCHOR, AUDIT_EVENTS, AUTOMATION_CONFIGS, BULK_RUNS, CHAT_QUESTIONS,
  CONCIERGE_JOBS, CREATED_RECORDS, DAY_MS, ENGAGEMENT_ROWS, HISTORY_START, HOUR_MS,
  INSIGHTS, LOOKUP_CALLS, NEVER_RUN_WORKFLOWS, PAID_LOOKUPS, REPORT_ACTIVITY,
  REPORT_RECORDS, REPORT_SHARES, REVIEW_RECORDS, RISK_ROWS, RUNS, SAMPLE_RUNS,
  SOP_RACM_JOBS, TRACED_EXCEPTIONS, formatDayMonth, formatMonth, formatShortMonth,
  loadContractPrices, loadUsageChanges, monthsInWindow, priceInForce, recordUsageChange,
  startOfMonthUtc, teamOfName, type AuditEventRow, type ContractPrice, type CreatedKind,
  type CreatedRecord, type LookupCall, type RunStatus, type TracedException, type WorkflowRun,
} from './platform-usage';
import { CONTROL_LIBRARY } from './controlLibrary';
import { WORKFLOWS } from './mockData';
import { liveMemories, pendingMemories, renewalsDue } from './memorySession';
import { RECALLS_THIS_WEEK } from './memoryStore';
import type { PlatformMemory } from './memoryStore';
import { SEED_USERS } from '../context/AdminDataContext';

/* ──────────────────────────────────────────────────────────────────────────
 * How numbers are written
 * ────────────────────────────────────────────────────────────────────────── */

const INT_FMT = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const ONE_DP = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const fmtInt = (n: number): string => INT_FMT.format(Math.round(n));
export const fmtOneDp = (n: number): string => ONE_DP.format(n);

/** Hours, to the resolution a reader can act on. */
export const fmtHours = (h: number): string => (Math.abs(h) < 100 ? `${fmtOneDp(h)} hrs` : `${fmtInt(h)} hrs`);

/**
 * A span of machine time.
 *
 * Under an hour it is said in minutes, because "0.0 hrs" is a figure that looks
 * like nothing happened when what happened was four minutes of wasted work.
 */
export const fmtSpan = (hours: number): string => {
  const minutes = hours * 60;
  if (minutes < 1) return `${fmtInt(minutes * 60)} seconds`;
  if (hours < 1) return `${fmtInt(minutes)} minutes`;
  return fmtHours(hours);
};

/**
 * Rupees, the way an Indian audit committee reads them: lakh and crore above a
 * lakh, plain grouped digits below it. A cost of ₹68,400 is not "₹0.7 lakh".
 */
export function fmtMoney(rupees: number): string {
  const abs = Math.abs(rupees);
  if (abs >= 10_000_000) return `₹${ONE_DP.format(rupees / 10_000_000)} crore`;
  if (abs >= 100_000) return `₹${ONE_DP.format(rupees / 100_000)} lakh`;
  return `₹${fmtInt(rupees)}`;
}

/** Rupees to the last digit, for a ledger where the paisa matter. */
export const fmtMoneyExact = (rupees: number): string => `₹${INT_FMT.format(Math.round(rupees))}`;

export const fmtPaise = (paise: number): string => fmtMoneyExact(paise / 100);

/**
 * A unit price, to the paisa.
 *
 * A contract rate of one rupee seventy five printed as "₹2" is a different
 * contract, so a price keeps its paise. A whole rupee still prints whole, because
 * "₹12.00" reads as a machine talking.
 */
export const fmtRate = (paise: number): string =>
  paise % 100 === 0 ? fmtMoneyExact(paise / 100) : `₹${(paise / 100).toFixed(2)}`;

export const fmtPct = (pct: number): string => `${ONE_DP.format(pct)}%`;

/** Dollars, because the one cost the product records by itself is in dollars. */
export const fmtUsd = (usd: number): string =>
  `$${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/* ──────────────────────────────────────────────────────────────────────────
 * The settings (PU-18)
 * ────────────────────────────────────────────────────────────────────────── */

/** Where a setting's current value came from. Said next to the value, always. */
export type SettingSource = 'default' | 'measured' | 'manual';

export type NumericSetting = 'manualReviewRate' | 'manualControlTestHours' | 'hourlyRate' | 'hoursPerPersonPerMonth';

export interface UsageSettings {
  manualReviewRate: number;
  manualReviewRateSource: SettingSource;
  manualControlTestHours: number;
  manualControlTestSource: SettingSource;
  hourlyRate: number;
  hourlyRateSource: SettingSource;
  hoursPerPersonPerMonth: number;
  hoursPerPersonSource: SettingSource;
  currency: 'INR';
  /** The latest measurement, kept whether or not it is the live value. */
  measuredReviewRate: number | null;
  measuredControlTestHours: number | null;
  measuredAt: number | null;
  /** How many records each rate was measured from. Two rates, two samples. */
  measuredReviewSampleN: number | null;
  measuredControlTestSampleN: number | null;
  measuredFrom: number | null;
  updatedBy: string | null;
  updatedAt: number | null;
}

export const SETTING_DEFAULTS: UsageSettings = {
  manualReviewRate: 200,
  manualReviewRateSource: 'default',
  manualControlTestHours: 4,
  manualControlTestSource: 'default',
  hourlyRate: 1_200,
  hourlyRateSource: 'default',
  hoursPerPersonPerMonth: 160,
  hoursPerPersonSource: 'default',
  currency: 'INR',
  measuredReviewRate: null,
  measuredControlTestHours: null,
  measuredAt: null,
  measuredReviewSampleN: null,
  measuredControlTestSampleN: null,
  measuredFrom: null,
  updatedBy: null,
  updatedAt: null,
};

export const SETTING_LABEL: Record<NumericSetting, string> = {
  manualReviewRate: 'rows a person checks by hand in an hour',
  manualControlTestHours: 'hours for one manual control test',
  hourlyRate: 'for one auditor hour',
  hoursPerPersonPerMonth: 'hours a person works in a month',
};

/** The short name, for a ledger column where the sentence would not fit. */
export const SETTING_SHORT: Record<NumericSetting, string> = {
  manualReviewRate: 'Review rate',
  manualControlTestHours: 'Manual control test',
  hourlyRate: 'Auditor hour',
  hoursPerPersonPerMonth: 'Hours per person per month',
};

export const SOURCE_LABEL: Record<SettingSource, string> = {
  default: 'starting value',
  measured: "based on your team's measured pace",
  manual: 'pinned by an administrator',
};

/** Which source field belongs to which number. */
export const SOURCE_FIELD: Record<NumericSetting, keyof UsageSettings> = {
  manualReviewRate: 'manualReviewRateSource',
  manualControlTestHours: 'manualControlTestSource',
  hourlyRate: 'hourlyRateSource',
  hoursPerPersonPerMonth: 'hoursPerPersonSource',
};

/** The two numbers the platform can measure from its own records. */
export const MEASURABLE: NumericSetting[] = ['manualReviewRate', 'manualControlTestHours'];

const SETTINGS_KEY = 'irame.platformUsage.settings.v3';

export function loadSettings(): UsageSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...SETTING_DEFAULTS };
    return { ...SETTING_DEFAULTS, ...(JSON.parse(raw) as Partial<UsageSettings>) };
  } catch {
    return { ...SETTING_DEFAULTS };
  }
}

function persistSettings(next: UsageSettings): UsageSettings {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch { /* private mode */ }
  return next;
}

/** How a setting's value is written when it appears in a change row. */
const settingValue = (key: NumericSetting, value: number): string =>
  key === 'hourlyRate' ? fmtMoneyExact(value) : key === 'manualControlTestHours' ? `${fmtOneDp(value)} hrs` : fmtInt(value);

/**
 * A value set by hand, outside the product.
 *
 * The two measurable numbers look after themselves and the two money ones run on
 * their labelled defaults, so nothing in the UI writes any of them: there is no
 * pin field and no settings form anywhere. If a tenant genuinely needs a
 * different value, it is set in configuration by support or engineering, arrives
 * as a stored `manual` source, and is labelled as such on every figure it feeds.
 * The audit row is written by whatever sets it.
 */

/* ── The calibration job ─────────────────────────────────────────────────── */

export interface Measurement {
  value: number;
  sampleN: number;
  from: number;
  to: number;
}

export interface Calibration {
  reviewRate: Measurement | null;
  controlTestHours: Measurement | null;
  /** Why nothing was measured, when nothing was. */
  blockedBy: string | null;
  daysOfHistory: number;
}

const MIN_DAYS = 90;
const MIN_SAMPLE = 20;

/**
 * What the weekly job would find today.
 *
 * Review rate is rows worked through divided by the hours the person had the
 * record open. Control-test hours is the average of start to complete on a
 * manual test. Both trim outliers: a record left open over a weekend is not
 * sixty hours of review, and treating it as if it were would understate the
 * team's pace and overstate the saving.
 */
export function calibrate(): Calibration {
  const daysOfHistory = Math.round((ANCHOR - HISTORY_START) / DAY_MS);
  if (daysOfHistory < MIN_DAYS) {
    return { reviewRate: null, controlTestHours: null, blockedBy: `only ${daysOfHistory} days of history`, daysOfHistory };
  }

  const reviews = REVIEW_RECORDS.filter(r => r.kind === 'review' && r.rows !== null);
  const testRuns = REVIEW_RECORDS.filter(r => r.kind === 'control_test');

  /** Drop the slowest tenth: a stale record is not a measurement of a person. */
  const trimTop = <T,>(rows: T[], value: (row: T) => number): T[] => {
    const sorted = rows.slice().sort((a, b) => value(a) - value(b));
    return sorted.slice(0, Math.max(1, Math.floor(sorted.length * 0.9)));
  };

  let reviewRate: Measurement | null = null;
  if (reviews.length >= MIN_SAMPLE) {
    const kept = trimTop(reviews, r => (r.finishedAt - r.startedAt) / (r.rows ?? 1));
    const rows = kept.reduce((s, r) => s + (r.rows ?? 0), 0);
    const hours = kept.reduce((s, r) => s + (r.finishedAt - r.startedAt) / HOUR_MS, 0);
    reviewRate = {
      value: Math.round(rows / hours),
      sampleN: kept.length,
      from: Math.min(...kept.map(r => r.startedAt)),
      to: Math.max(...kept.map(r => r.finishedAt)),
    };
  }

  let controlTestHours: Measurement | null = null;
  if (testRuns.length >= MIN_SAMPLE) {
    const kept = trimTop(testRuns, r => r.finishedAt - r.startedAt);
    const hours = kept.reduce((s, r) => s + (r.finishedAt - r.startedAt) / HOUR_MS, 0);
    controlTestHours = {
      value: Math.round((hours / kept.length) * 10) / 10,
      sampleN: kept.length,
      from: Math.min(...kept.map(r => r.startedAt)),
      to: Math.max(...kept.map(r => r.finishedAt)),
    };
  }

  const blockedBy = reviewRate === null && controlTestHours === null
    ? `not enough recorded hand work yet (${reviews.length + testRuns.length} records, ${MIN_SAMPLE} needed)`
    : null;

  return { reviewRate, controlTestHours, blockedBy, daysOfHistory };
}

/**
 * Apply what the job measured.
 *
 * There is no confirmation step. At the scale this product runs at nobody
 * clicks, so a measurement that passes the guards becomes the live value, the
 * label changes to say the number came from the customer's own pace, and the
 * change is written to the audit trail. A pinned number is left alone.
 */
export function applyCalibration(settings: UsageSettings): UsageSettings {
  const found = calibrate();
  let next = { ...settings };
  let changed = false;

  const apply = (
    key: NumericSetting,
    measurement: Measurement | null,
    store: 'measuredReviewRate' | 'measuredControlTestHours',
    sampleStore: 'measuredReviewSampleN' | 'measuredControlTestSampleN',
  ) => {
    if (!measurement) return;
    next[store] = measurement.value;
    next.measuredAt = ANCHOR;
    next[sampleStore] = measurement.sampleN;
    next.measuredFrom = Math.min(next.measuredFrom ?? measurement.from, measurement.from);
    const sourceField = SOURCE_FIELD[key];
    // A pinned value is a deliberate decision by a person. The job never
    // overrides it; it keeps measuring underneath so unpinning has somewhere
    // to land.
    if (next[sourceField] === 'manual') return;
    if (next[key] === measurement.value && next[sourceField] === 'measured') return;
    const from = settingValue(key, next[key]);
    next = { ...next, [key]: measurement.value, [sourceField]: 'measured' } as UsageSettings;
    recordUsageChange({
      entity: 'usage_setting',
      field: SETTING_SHORT[key],
      from,
      to: settingValue(key, measurement.value),
      source: `${SOURCE_LABEL.measured}, from ${fmtInt(measurement.sampleN)} records`,
      by: 'the platform, on its own',
      at: ANCHOR,
    });
    changed = true;
  };

  apply('manualReviewRate', found.reviewRate, 'measuredReviewRate', 'measuredReviewSampleN');
  apply('manualControlTestHours', found.controlTestHours, 'measuredControlTestHours', 'measuredControlTestSampleN');

  return changed || next.measuredAt !== settings.measuredAt ? persistSettings(next) : settings;
}

/* ──────────────────────────────────────────────────────────────────────────
 * The window
 * ────────────────────────────────────────────────────────────────────────── */

export type PeriodId = 'this-month' | 'this-quarter' | 'this-year' | 'since-start' | 'custom';

export interface CustomRange { from: number; to: number }

export interface Period {
  id: PeriodId;
  /** The window's own name, for a heading or a scope line. */
  label: string;
  /**
   * The same window said inside a sentence, preposition included: "in April
   * 2026 so far", "since you started". Kept separate from the label for two
   * reasons: lowercasing a label turns April into april, and "in since you
   * started" is not English, so the phrase owns its own preposition.
   */
  phrase: string;
  from: number;
  to: number;
  days: number;
  /** Fractional months, so "people equivalent" is right on a part month. */
  months: number;
}

const AVG_MONTH_DAYS = 30.4375;

function makePeriod(id: PeriodId, label: string, from: number, to: number, phrase = label): Period {
  const days = Math.max(1, Math.round((to - from) / DAY_MS));
  return { id, label, phrase, from, to, days, months: days / AVG_MONTH_DAYS };
}

/**
 * The windows the page offers.
 *
 * The financial year starts in April, so "this quarter" is the April to June
 * quarter and "this year" starts on 1 April. "This month" is suppressed when it
 * is the same window as this quarter: a control that changes nothing reads as a
 * broken page.
 */
export function periodOptions(): { id: PeriodId; label: string }[] {
  const wanted: { id: PeriodId; label: string }[] = [
    { id: 'this-month', label: 'This month' },
    { id: 'this-quarter', label: 'This quarter' },
    { id: 'this-year', label: 'This year' },
    { id: 'since-start', label: 'Since you started' },
    { id: 'custom', label: 'Custom range' },
  ];

  // Three weeks into a financial year, this month, this quarter and this year
  // are the same twenty-one days. Offering all three would be three controls
  // that change nothing, and a control that changes nothing reads as a broken
  // page — so a window already on the list is not offered again under a second
  // name. The narrowest true name wins: calling 21 days "this year" invites a
  // reader to think twelve months are in the figure.
  const seen = new Set<string>();
  return wanted.filter(option => {
    if (option.id === 'custom') return true;
    const p = period(option.id);
    const key = `${p.from}-${p.to}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function period(id: PeriodId, custom: CustomRange | null = null): Period {
  const anchor = new Date(ANCHOR);
  const y = anchor.getUTCFullYear();
  const m = anchor.getUTCMonth();

  if (id === 'this-month') {
    const label = `${formatMonth(Date.UTC(y, m, 1))} so far`;
    return makePeriod('this-month', label, Date.UTC(y, m, 1), ANCHOR, `in ${label}`);
  }
  if (id === 'this-quarter') {
    // April, July, October, January — the financial-year quarters.
    const startMonth = m - ((m + 9) % 3);
    const from = Date.UTC(y, startMonth, 1);
    const label = `${formatShortMonth(from)} to ${formatShortMonth(Date.UTC(y, startMonth + 2, 1))} ${y}`;
    return makePeriod('this-quarter', `This quarter, ${label}`, from, ANCHOR, 'in this quarter so far');
  }
  if (id === 'this-year') {
    const fyStartYear = m >= 3 ? y : y - 1;
    const fy = `FY${String(fyStartYear + 1).slice(2)}`;
    return makePeriod('this-year', `${fy}, from 1 Apr ${fyStartYear}`, Date.UTC(fyStartYear, 3, 1), ANCHOR, `in ${fy} so far`);
  }
  if (id === 'custom' && custom) {
    return makePeriod('custom', 'Custom range', custom.from, custom.to, 'in this window');
  }
  return makePeriod('since-start', 'Since you started', HISTORY_START, ANCHOR, 'since you started');
}

/**
 * The window immediately before this one, the same length.
 *
 * A quarter compares with the previous quarter; a 21-day quarter-to-date
 * compares with the 21 days before it. The comparison is labelled by its real
 * length rather than by the name of the current window, because "vs last
 * quarter" against 21 days would be a lie in three words.
 */
export function priorPeriod(p: Period): Period | null {
  const span = p.to - p.from;
  const from = p.from - span;
  if (from < HISTORY_START - DAY_MS) return null;
  return makePeriod(p.id, `the ${p.days} days before`, from, p.from);
}

/** How the change against the prior window is said. */
export const priorLabel = (p: Period): string => `the previous ${p.days} days`;

/* ──────────────────────────────────────────────────────────────────────────
 * Who is reading
 * ────────────────────────────────────────────────────────────────────────── */

export type Persona = 'cfo' | 'head_of_team' | 'auditor';

export interface Scope {
  persona: Persona;
  /** What the scope line says: "the whole company", "SOX Audit", "your own work". */
  label: string;
  team?: string;
  userEmail?: string;
  userName?: string;
}

export const PERSONA_TITLE: Record<Persona, string> = {
  cfo: 'CFO',
  head_of_team: 'Head of Team',
  auditor: 'Internal Auditor',
};

/** The question each view opens on, said in the reader's own words. */
export const PERSONA_QUESTION: Record<Persona, string> = {
  cfo: 'Is this paying for itself?',
  head_of_team: 'Is anything stuck?',
  auditor: "What's waiting on me?",
};

const inWindow = (at: number | null, p: Period): boolean => at !== null && at >= p.from && at <= p.to;

/** Does this run belong to the reader? */
function runInScope(run: WorkflowRun, scope: Scope): boolean {
  if (scope.persona === 'cfo') return true;
  if (scope.persona === 'head_of_team') return run.actor.team === scope.team;
  return run.actor.email === scope.userEmail;
}

/** Does a record made by this named person belong to the reader? */
function personInScope(name: string | null, scope: Scope): boolean {
  if (scope.persona === 'cfo') return true;
  if (!name) return false;
  if (scope.persona === 'head_of_team') return teamOfName(name) === scope.team;
  return name === scope.userName;
}

/* ──────────────────────────────────────────────────────────────────────────
 * PU-01 · PU-02 · PU-03 — hours, money, people
 * ────────────────────────────────────────────────────────────────────────── */

/** Every run in the window that belongs to the reader, by completion. */
export function runsIn(p: Period, scope: Scope): WorkflowRun[] {
  return RUNS.filter(run => runInScope(run, scope) && inWindow(run.completedAt, p));
}

/** Every run started in the window — what reliability is measured on. */
export function runsStartedIn(p: Period, scope: Scope): WorkflowRun[] {
  return RUNS.filter(run => runInScope(run, scope) && run.startedAt >= p.from && run.startedAt <= p.to);
}

export interface ValueFigures {
  hours: number;
  money: number;
  people: number;
  rows: number;
  machineHours: number;
  /** Runs that produced rows and finished. */
  rowRuns: number;
  /** Runs that stood in for a manual control test. */
  testRuns: number;
}

/**
 * What the work was worth (PU-01 to PU-03).
 *
 * A run that processed rows saved the hours a person would have spent checking
 * them, less the time the engine took. A run against a control with no row
 * output replaced one manual control test. A failed run saved nothing at all and
 * is reported as wasted effort instead (decision 3), and a run that produced no
 * rows is skipped entirely, because there is no work there to value.
 */
export function valueOf(runs: WorkflowRun[], settings: UsageSettings, p: Period): ValueFigures {
  let hours = 0;
  let rows = 0;
  let machineSecs = 0;
  let rowRuns = 0;
  let testRuns = 0;

  for (const run of runs) {
    if (run.status !== 'complete') continue;
    if (run.rowCount !== null) {
      if (run.rowCount <= 0) continue;
      hours += run.rowCount / settings.manualReviewRate - run.durationSecs / 3600;
      rows += run.rowCount;
      machineSecs += run.durationSecs;
      rowRuns += 1;
    } else if (run.controlId !== null) {
      hours += settings.manualControlTestHours - run.durationSecs / 3600;
      machineSecs += run.durationSecs;
      testRuns += 1;
    }
  }

  return {
    hours,
    money: hours * settings.hourlyRate,
    people: hours / (settings.hoursPerPersonPerMonth * Math.max(p.months, 0.03)),
    rows,
    machineHours: machineSecs / 3600,
    rowRuns,
    testRuns,
  };
}

/** The change against the window before, as a percentage, or null when there is none. */
export function deltaPct(now: number, before: number | null): number | null {
  if (before === null || before === 0) return null;
  return ((now - before) / Math.abs(before)) * 100;
}

/* ──────────────────────────────────────────────────────────────────────────
 * PU-04 · PU-05 — what it costs, and the net
 * ────────────────────────────────────────────────────────────────────────── */

export interface CostToRun {
  /** What the contract charges for the calls in this window, in rupees. */
  lookupRupees: number | null;
  /** Successful calls the platform recorded, priced or not. */
  lookupCalls: number;
  /** Calls made against an API the contract does not price, and when. */
  unpriced: { name: string; calls: number }[];
  /** The contract rows the figure was computed from. */
  prices: ContractPrice[];
  /** The one cost the product records by itself, in the currency it records. */
  conciergeUsd: number;
  conciergeJobs: number;
  /** Jobs whose pipeline never wrote a cost, so they are counted, not priced. */
  conciergeUnpriced: number;
  /** True when every recorded call in the window has a contract price behind it. */
  complete: boolean;
  /** True when no contract has been loaded for this workspace at all. */
  noContract: boolean;
}

/**
 * What one API charged over a window, at the price in force on each call's own day.
 *
 * The billing unit is the whole ballgame. Per row charges for every successful
 * call. Per run charges once for the batch, however many rows it checked, so a
 * run of four hundred vendors is one charge and not four hundred. Reading it the
 * wrong way puts the figure out by a factor of a thousand, which is why it is a
 * contract term rather than anybody's assumption.
 */
function chargeFor(calls: LookupCall[], prices: ContractPrice[]): { paise: number; priced: number; unpriced: number } {
  let paise = 0;
  let priced = 0;
  let unpriced = 0;
  const chargedBatches = new Set<string>();

  for (const call of calls) {
    if (call.status !== 'complete') continue;
    const price = priceInForce(call.lookupId, call.at, prices);
    if (!price) { unpriced += 1; continue; }
    priced += 1;
    if (price.billingUnit === 'row') {
      paise += price.pricePaise;
      continue;
    }
    // Per run: the batch is charged once, on the price in force when it ran.
    if (chargedBatches.has(call.batchId)) continue;
    chargedBatches.add(call.batchId);
    paise += price.pricePaise;
  }

  return { paise, priced, unpriced };
}

/**
 * Cost to run (PU-04).
 *
 * The lookup cost is the volume the platform recorded, priced at the customer's
 * own contract: irame sets those prices when the deal is signed, so the figure
 * simply appears and is labelled "as per your contract". Nobody at the customer
 * types a price, a bill or an override.
 *
 * Where the contract does not price an API the calls are counted and named rather
 * than charged at a guess, and the window is not called complete. With no
 * contract loaded at all the figure is absent, not zero.
 *
 * The Concierge job cost is the only money the product records on its own. It is
 * recorded in dollars, and it is returned separately rather than converted at a
 * rate nobody has entered or added into a rupee total. Section 3 forbids a
 * blended figure, and a silent conversion is one.
 */
export function costToRun(p: Period): CostToRun {
  const prices = loadContractPrices();
  const callsInWindow = LOOKUP_CALLS.filter(c => c.at >= p.from && c.at <= p.to);
  const complete = callsInWindow.filter(c => c.status === 'complete');
  const charge = chargeFor(callsInWindow, prices);

  const unpriced = PAID_LOOKUPS
    .map(lookup => ({
      name: lookup.name,
      calls: complete.filter(c => c.lookupId === lookup.id && priceInForce(c.lookupId, c.at, prices) === null).length,
    }))
    .filter(row => row.calls > 0);

  const conciergeInWindow = CONCIERGE_JOBS.filter(j => j.at >= p.from && j.at <= p.to && j.status === 'completed');
  const priced = conciergeInWindow.filter(j => j.costWiring === 'priced' && j.llmCostUsd !== null);

  return {
    lookupRupees: prices.length === 0 ? null : charge.paise / 100,
    lookupCalls: complete.length,
    unpriced,
    prices: prices.filter(row => row.effectiveFrom <= p.to && (row.effectiveTo === null || row.effectiveTo >= p.from)),
    conciergeUsd: priced.reduce((s, j) => s + (j.llmCostUsd ?? 0), 0),
    conciergeJobs: conciergeInWindow.length,
    conciergeUnpriced: conciergeInWindow.length - priced.length,
    complete: prices.length > 0 && charge.unpriced === 0,
    noContract: prices.length === 0,
  };
}

export interface NetValue {
  /** What the work avoided is worth. Always known. */
  workAvoided: number;
  /** What the vendor billed for the window, when every bill is in. */
  cost: number | null;
  /** Work avoided minus cost. Null while any bill is missing. */
  net: number | null;
  /** What the hero is called, which depends on whether the cost is known. */
  headline: 'Net value' | 'Work avoided';
}

/**
 * Net value (PU-05).
 *
 * While the cost is unknown the hero reads "Work avoided" and shows that figure.
 * It never reads "Net value" over one real number minus an unknown.
 */
export function netValue(value: ValueFigures, cost: CostToRun): NetValue {
  const known = cost.lookupRupees;
  return {
    workAvoided: value.money,
    cost: known,
    net: known === null ? null : value.money - known,
    headline: known === null ? 'Work avoided' : 'Net value',
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * Value over time
 * ────────────────────────────────────────────────────────────────────────── */

export interface TimeBucket {
  at: number;
  label: string;
  hours: number;
  money: number;
  runs: number;
  rows: number;
}

/**
 * Hours saved per month across the window, priced at the hourly rate.
 *
 * Monthly buckets, because a savings figure per day is noise: a reader is
 * looking for a trend, and the trend is the point of the block.
 */
export type Grain = 'week' | 'month';

/**
 * How wide a bucket has to be before the shape is a trend rather than noise.
 *
 * Three weeks into a financial year, monthly buckets would draw one bar, and one
 * bar is not a chart — so a short window is drawn by week. The grain is returned
 * with the buckets so the block can say which it used.
 */
export const grainFor = (p: Period): Grain => (p.days <= 70 ? 'week' : 'month');

/** The buckets a window is drawn in, oldest first. */
export function buckets(p: Period): { at: number; to: number; label: string }[] {
  if (grainFor(p) === 'month') {
    return monthsInWindow(p.from, p.to).map(m => ({
      at: Math.max(m, p.from),
      to: Math.min(startOfMonthUtc(m + 32 * DAY_MS), p.to),
      label: formatShortMonth(m),
    }));
  }
  // Weeks, counted back from the end of the window so the newest bucket is whole.
  const out: { at: number; to: number; label: string }[] = [];
  const week = 7 * DAY_MS;
  for (let to = p.to; to > p.from; to -= week) {
    const at = Math.max(p.from, to - week);
    out.unshift({ at, to, label: `w/c ${formatDayMonth(at)}` });
  }
  return out;
}

export function valueOverTime(p: Period, scope: Scope, settings: UsageSettings): TimeBucket[] {
  return buckets(p).map(b => {
    const bucketPeriod = makePeriod(p.id, b.label, b.at, b.to);
    const runs = RUNS.filter(run => runInScope(run, scope) && inWindow(run.completedAt, bucketPeriod));
    const v = valueOf(runs, settings, bucketPeriod);
    return {
      at: b.at,
      label: b.label,
      hours: v.hours,
      money: v.money,
      runs: runs.filter(r => r.status === 'complete').length,
      rows: v.rows,
    };
  });
}

/* ──────────────────────────────────────────────────────────────────────────
 * PU-06 · PU-07 — control coverage, and what was never touched
 * ────────────────────────────────────────────────────────────────────────── */

export interface Coverage {
  exercised: number;
  total: number;
  pct: number;
  /** Controls the reader owns that this window has not exercised. */
  untouched: { id: string; name: string; owner: string }[];
}

/**
 * Control coverage (PU-06).
 *
 * How much of the control library the platform actually exercised in the window.
 * A control run fifty times counts once — this is coverage, not volume.
 */
export function controlCoverage(p: Period, scope: Scope): Coverage {
  const library = scope.persona === 'head_of_team'
    ? CONTROL_LIBRARY.filter(c => teamOfName(c.owner) === scope.team)
    : CONTROL_LIBRARY;

  const exercised = new Set(
    RUNS.filter(run => run.status === 'complete' && run.controlId !== null && inWindow(run.completedAt, p) && runInScope(run, scope))
      .map(run => run.controlId as string),
  );

  const total = library.length;
  const hit = library.filter(c => exercised.has(c.controlId)).length;
  return {
    exercised: hit,
    total,
    pct: total === 0 ? 0 : (hit * 100) / total,
    untouched: library.filter(c => !exercised.has(c.controlId)).map(c => ({ id: c.controlId, name: c.name, owner: c.owner })),
  };
}

export interface NeverExercised {
  controls: { id: string; name: string; owner: string }[];
  workflows: string[];
}

/**
 * Never exercised, ever (PU-07).
 *
 * Deliberately ignores the period selector. "This control has never been tested"
 * is a fact about the library, not about April, and it needs no setting at all —
 * which is what makes it the one figure on this page nobody can argue with.
 */
export function neverExercised(scope: Scope): NeverExercised {
  const everRun = new Set(RUNS.filter(r => r.controlId !== null).map(r => r.controlId as string));
  const library = scope.persona === 'head_of_team'
    ? CONTROL_LIBRARY.filter(c => teamOfName(c.owner) === scope.team)
    : CONTROL_LIBRARY;
  return {
    controls: library.filter(c => !everRun.has(c.controlId)).map(c => ({ id: c.controlId, name: c.name, owner: c.owner })),
    workflows: NEVER_RUN_WORKFLOWS,
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * PU-08 — what the platform caught
 * ────────────────────────────────────────────────────────────────────────── */

export interface ExceptionsCaught {
  bySeverity: { severity: string; total: number; open: number }[];
  total: number;
  open: number;
  /** The newest few, each traceable to the run that raised it. */
  newest: TracedException[];
  /** Exceptions with no run behind them, which is a gap worth naming. */
  untraced: number;
}

const SEVERITY_ORDER = ['Critical', 'High', 'Medium', 'Low'];

export function exceptionsCaught(p: Period, scope: Scope): ExceptionsCaught {
  const rows = TRACED_EXCEPTIONS.filter(ex => {
    if (ex.openedAt < p.from || ex.openedAt > p.to) return false;
    if (scope.persona === 'cfo') return true;
    if (scope.persona === 'head_of_team') return ex.team === scope.team;
    return ex.assignee === scope.userName;
  });

  const bySeverity = SEVERITY_ORDER.map(severity => ({
    severity,
    total: rows.filter(r => r.severity === severity).length,
    open: rows.filter(r => r.severity === severity && r.status !== 'Resolved').length,
  })).filter(r => r.total > 0);

  return {
    bySeverity,
    total: rows.length,
    open: rows.filter(r => r.status !== 'Resolved').length,
    newest: rows.slice().sort((a, b) => b.openedAt - a.openedAt).slice(0, 3),
    untraced: rows.filter(r => r.runId === null).length,
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * PU-09 — work volume, in four units that are never added up
 * ────────────────────────────────────────────────────────────────────────── */

export interface WorkVolume {
  workflowRuns: number;
  bulkRuns: number;
  chatQuestions: number;
  conciergeJobs: number;
  /** Chat answers whose program was frozen into the library — a real outcome. */
  savedAsWorkflow: number;
  /**
   * The newest runs behind the count, so the number opens its list like every
   * other count on the page. The whole set lives in the workflow library, which
   * the block links to rather than paging a thousand rows in here.
   */
  newestRuns: { id: string; workflow: string; ranBy: string; at: number; status: RunStatus; rows: number | null }[];
}

/**
 * Four counts, four units (PU-09).
 *
 * A chat question and a bulk job are not the same kind of thing, so they are
 * never summed — on screen or in the export. Four mini-charts, not one total.
 */
export function workVolume(p: Period, scope: Scope): WorkVolume {
  const runs = runsIn(p, scope).filter(r => r.bulkRunId === null);
  const bulk = BULK_RUNS.filter(b => b.at >= p.from && b.at <= p.to
    && (scope.persona === 'cfo' || RUNS.some(r => r.bulkRunId === b.id && runInScope(r, scope))));
  const chat = CHAT_QUESTIONS.filter(q => q.at >= p.from && q.at <= p.to
    && (scope.persona === 'cfo' || (scope.persona === 'head_of_team' ? q.actor.team === scope.team : q.actor.email === scope.userEmail)));
  const concierge = CONCIERGE_JOBS.filter(j => j.at >= p.from && j.at <= p.to
    && (scope.persona === 'cfo' || (scope.persona === 'head_of_team' ? j.actor.team === scope.team : j.actor.email === scope.userEmail)));

  return {
    workflowRuns: runs.length,
    bulkRuns: bulk.length,
    chatQuestions: chat.length,
    conciergeJobs: concierge.length,
    savedAsWorkflow: chat.filter(q => q.savedAsWorkflow).length,
    newestRuns: runs
      .slice()
      .sort((a, b) => (b.completedAt ?? b.startedAt) - (a.completedAt ?? a.startedAt))
      .slice(0, 12)
      .map(run => ({
        id: run.id,
        workflow: run.workflowName,
        ranBy: run.actor.name,
        at: run.completedAt ?? run.startedAt,
        status: run.status,
        rows: run.rowCount,
      })),
  };
}

/** The same four units, month by month, for the auditor's own work over time. */
export function volumeOverTime(p: Period, scope: Scope): { at: number; label: string; runs: number; chat: number }[] {
  return buckets(p).map(b => {
    const v = workVolume(makePeriod(p.id, b.label, b.at, b.to), scope);
    return { at: b.at, label: b.label, runs: v.workflowRuns, chat: v.chatQuestions };
  });
}

/* ──────────────────────────────────────────────────────────────────────────
 * PU-10 — reliability, and the effort failures wasted
 * ────────────────────────────────────────────────────────────────────────── */

export interface ReliabilityRow {
  workflow: string;
  failed: number;
  total: number;
  failurePct: number;
  wastedHours: number;
}

/** Failure rate per workflow (PU-10). A workflow with no runs produces no row. */
export function reliability(p: Period, scope: Scope): ReliabilityRow[] {
  const runs = runsStartedIn(p, scope);
  const byWorkflow = new Map<string, WorkflowRun[]>();
  for (const run of runs) {
    byWorkflow.set(run.workflowName, [...(byWorkflow.get(run.workflowName) ?? []), run]);
  }
  return Array.from(byWorkflow.entries())
    .map(([workflow, rows]) => {
      const failed = rows.filter(r => r.status === 'failed').length;
      return {
        workflow,
        failed,
        total: rows.length,
        failurePct: (failed * 100) / rows.length,
        wastedHours: rows.filter(r => r.status === 'failed').reduce((s, r) => s + r.durationSecs, 0) / 3600,
      };
    })
    .sort((a, b) => b.failurePct - a.failurePct || b.total - a.total);
}

/**
 * The hours failed runs burned.
 *
 * This is how failed runs are reported honestly without touching the savings
 * total: they never add to what was saved, and they are named as waste here.
 */
export function wastedEffort(p: Period, scope: Scope): { hours: number; runs: number } {
  const failed = runsStartedIn(p, scope).filter(r => r.status === 'failed');
  return { hours: failed.reduce((s, r) => s + r.durationSecs, 0) / 3600, runs: failed.length };
}

/* ──────────────────────────────────────────────────────────────────────────
 * PU-11 — what is stuck right now
 * ────────────────────────────────────────────────────────────────────────── */

export interface StuckRun {
  id: string;
  workflow: string;
  ranBy: string;
  at: number;
  status: RunStatus;
  /** The engine's own words, never truncated. */
  error: string;
  /** How many times this workflow hit this same error in the window. */
  repeats: number;
}

/**
 * Stuck runs (PU-11).
 *
 * Failed, blocked, or paused for more than 24 hours — the spec's own definition.
 * Each row carries the engine's error verbatim, because a summarised error is an
 * error nobody can fix, and the repeat count because one workflow failing four
 * times with one cause is a single afternoon's work, not four problems.
 */
export function stuckRuns(p: Period, scope: Scope): StuckRun[] {
  const stuck = RUNS.filter(run => {
    if (!runInScope(run, scope)) return false;
    if (run.startedAt < p.from || run.startedAt > p.to) return false;
    if (run.status === 'failed' || run.status === 'blocked') return true;
    return run.status === 'paused' && run.updatedAt < ANCHOR - DAY_MS;
  });

  const key = (r: WorkflowRun) => `${r.workflowName}|${r.error ?? ''}`;
  const counts = new Map<string, number>();
  for (const run of stuck) counts.set(key(run), (counts.get(key(run)) ?? 0) + 1);

  return stuck
    .slice()
    .sort((a, b) => b.startedAt - a.startedAt)
    .map(run => ({
      id: run.id,
      workflow: run.workflowName,
      ranBy: run.actor.name,
      at: run.startedAt,
      status: run.status,
      error: run.error ?? 'No error text recorded',
      repeats: counts.get(key(run)) ?? 1,
    }));
}

/* ──────────────────────────────────────────────────────────────────────────
 * PU-12 — AI usage by area, with an accuracy label on every row
 * ────────────────────────────────────────────────────────────────────────── */

/** How well a figure is known. Never omitted, never guessed. */
export type Accuracy = 'exact' | 'estimated' | 'not measured' | 'no record';

export interface AiUsageRow {
  area: string;
  volume: number;
  volumeUnit: string;
  /** What the platform knows about consumption, in words. */
  detail: string;
  accuracy: Accuracy;
  /** The Concierge job cost, in dollars, and nothing else. */
  conciergeUsd?: number;
}

/**
 * AI usage by area (PU-12).
 *
 * The words "AI cost" appear nowhere. Chat estimates its own token usage by
 * dividing text length by four — the code that does it calls itself a stopgap —
 * so it is labelled estimated. SOP-to-RACM records nothing about consumption at
 * all. Concierge records a real dollar cost, and it is called the Concierge job
 * cost, because that is what it is.
 */
export function aiUsageByArea(p: Period): AiUsageRow[] {
  const chat = CHAT_QUESTIONS.filter(q => q.at >= p.from && q.at <= p.to);
  const sop = SOP_RACM_JOBS.filter(j => j.at >= p.from && j.at <= p.to);
  const concierge = CONCIERGE_JOBS.filter(j => j.at >= p.from && j.at <= p.to);
  const runs = RUNS.filter(r => inWindow(r.completedAt, p));
  const priced = concierge.filter(j => j.costWiring === 'priced' && j.llmCostUsd !== null && j.status === 'completed');
  const cacheHits = sop.filter(j => j.cacheHit).length;

  return [
    {
      area: 'Chat (Ask IRA)',
      volume: chat.length,
      volumeUnit: 'questions',
      detail: `${fmtInt(chat.reduce((s, q) => s + q.tokens, 0))} tokens, counted by dividing text length by four`,
      accuracy: 'estimated',
    },
    {
      area: 'SOP to RACM',
      volume: sop.length,
      volumeUnit: 'documents',
      detail: cacheHits > 0
        ? `${fmtInt(cacheHits)} of them reused an earlier result, so the job count says nothing about spend`
        : 'no duration, no usage, no cost recorded',
      accuracy: 'not measured',
    },
    {
      area: 'Concierge tools',
      volume: concierge.length,
      volumeUnit: 'jobs',
      detail: `${fmtInt(priced.length)} of ${fmtInt(concierge.length)} jobs priced every AI call`,
      accuracy: 'exact',
      conciergeUsd: priced.reduce((s, j) => s + (j.llmCostUsd ?? 0), 0),
    },
    {
      area: 'Workflow runs',
      volume: runs.length,
      volumeUnit: 'runs',
      detail: 'duration and rows recorded, consumption not',
      accuracy: 'not measured',
    },
    {
      area: 'Insight generation and extraction',
      volume: INSIGHTS.filter(i => i.at >= p.from && i.at <= p.to).length,
      volumeUnit: 'insights',
      detail: 'the insight is stored, what it cost to generate is not',
      accuracy: 'no record',
    },
  ];
}

/* ──────────────────────────────────────────────────────────────────────────
 * PU-13 — per-person outcomes, alphabetical and unsortable
 * ────────────────────────────────────────────────────────────────────────── */

export interface PersonRow {
  name: string;
  runs: number;
  exceptionsFound: number;
  waitingOnThem: number;
}

/**
 * The team's work by outcome (PU-13).
 *
 * Alphabetical, and the sort cannot be changed by click or by URL. There is no
 * share of the team's work, no rank, and no team average: "you ran 62, the team
 * average is 51" is a ranking through the back door and is banned too. A person
 * with zero runs still appears, because leaving them out is a ranking as well.
 */
export function perPersonOutcomes(p: Period, team: string | undefined): PersonRow[] {
  const members = SEED_USERS.filter(u => u.team === team);
  return members
    .map(member => {
      const runs = RUNS.filter(r => r.actor.email === member.email && inWindow(r.completedAt, p)).length;
      const exceptionsFound = TRACED_EXCEPTIONS.filter(ex => ex.assignee === member.name && ex.openedAt >= p.from && ex.openedAt <= p.to).length;
      const waitingOnThem = TRACED_EXCEPTIONS.filter(ex => ex.assignee === member.name && ex.status !== 'Resolved').length
        + ACTION_PLANS.filter(ap => ap.owner === member.name && ap.status === 'open').length;
      return { name: member.name, runs, exceptionsFound, waitingOnThem };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/* ──────────────────────────────────────────────────────────────────────────
 * PU-14 — my queue
 * ────────────────────────────────────────────────────────────────────────── */

export interface QueueItem {
  id: string;
  kind: 'exception' | 'control test' | 'approval' | 'action plan';
  title: string;
  detail: string;
  dueAt: number | null;
  overdue: boolean;
  /** Where the reader goes to do the thing. */
  target: { view: string; id?: string };
}

/**
 * What is waiting on the reader (PU-14).
 *
 * Overdue first, and every item reaches the thing that needs doing in one click.
 * A queue whose rows are counts rather than links is a page that adds a step
 * instead of removing one.
 */
export function myQueue(scope: Scope): QueueItem[] {
  const name = scope.userName ?? '';
  const items: QueueItem[] = [];

  for (const ex of TRACED_EXCEPTIONS) {
    if (ex.assignee !== name || ex.status === 'Resolved') continue;
    const dueAt = ex.openedAt + 5 * DAY_MS;
    items.push({
      id: ex.ref,
      kind: 'exception',
      title: `${ex.ref} ${ex.title}${ex.amount ? `, ${ex.amount}` : ''}`,
      detail: `${ex.severity} · raised by ${ex.workflowName}`,
      dueAt,
      overdue: dueAt < ANCHOR,
      target: { view: 'engagements', id: ex.engagementId },
    });
  }

  for (const run of SAMPLE_RUNS) {
    if (run.actor.name !== name || run.status !== 'error') continue;
    // An errored validation from three months ago is not still waiting on
    // anybody: it was dealt with, or it was abandoned. A queue that reaches back
    // to December is a queue nobody believes, so this one holds the last month.
    if (run.at < ANCHOR - 30 * DAY_MS) continue;
    items.push({
      id: run.id,
      kind: 'control test',
      title: run.controlName,
      detail: 'A sample validation errored and needs a person',
      dueAt: run.at + 3 * DAY_MS,
      overdue: run.at + 3 * DAY_MS < ANCHOR,
      target: { view: 'engagements', id: run.engagementId },
    });
  }

  for (const plan of ACTION_PLANS) {
    if (plan.owner !== name || plan.status !== 'open') continue;
    items.push({
      id: plan.id,
      kind: 'action plan',
      title: plan.observation,
      detail: plan.reportTitle,
      dueAt: plan.dueAt,
      overdue: plan.dueAt < ANCHOR,
      target: { view: 'reports' },
    });
  }

  // Memory proposals are an approval too — somebody has to decide them.
  for (const memory of pendingMemories()) {
    if (memory.scope !== 'personal' && scope.persona === 'auditor') continue;
    items.push({
      id: memory.id,
      kind: 'approval',
      title: memory.statement,
      detail: `Something the assistant wants to remember · ${memory.source}`,
      dueAt: null,
      overdue: false,
      target: { view: 'knowledge-hub' },
    });
  }

  return items.sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    return (a.dueAt ?? Number.MAX_SAFE_INTEGER) - (b.dueAt ?? Number.MAX_SAFE_INTEGER);
  });
}

/* ──────────────────────────────────────────────────────────────────────────
 * PU-20 — Smart Learn, the assistant's memory
 * ────────────────────────────────────────────────────────────────────────── */

export interface SmartLearn {
  active: number;
  pending: number;
  dueReview: number;
  /** Memories the assistant used in the last seven days. */
  usedThisWeek: number;
  /** Recall events across the whole company, from the store's own figure. */
  totalRecalls: number | null;
  /** Proposals this reader can approve. */
  pendingRows: PlatformMemory[];
  /** True when there is nothing recorded for this scope at all. */
  nothingYet: boolean;
}

/** 'today', 'yesterday', '2 hours ago' and '5 days ago' are inside the week. */
function recalledThisWeek(lastRecalled: string): boolean {
  const v = lastRecalled.trim().toLowerCase();
  if (v === 'today' || v === 'yesterday') return true;
  const m = /^(\d+)\s*(hours?|hrs?|days?)\s+ago$/.exec(v);
  if (!m) return false;
  return m[2].startsWith('h') ? true : Number(m[1]) <= 7;
}

/**
 * Smart Learn (PU-20).
 *
 * The same four numbers the Smart Learn screen computes, scoped to the reader:
 * the auditor sees their own memories, the head of team sees the team tier
 * including proposals waiting on them, and the CFO sees the company. Recall
 * count and last-recalled are real fields written on every use, not estimates.
 */
export function smartLearn(scope: Scope): SmartLearn {
  const scopesFor = scope.persona === 'auditor'
    ? ['personal']
    : scope.persona === 'head_of_team'
      ? ['team', 'personal']
      : ['personal', 'team', 'engagement', 'organization', 'source'];

  const live = liveMemories().filter(m => scopesFor.includes(m.scope));
  const pending = pendingMemories().filter(m => scopesFor.includes(m.scope) && (scope.persona !== 'auditor' || m.scope === 'personal'));

  return {
    active: live.filter(m => m.status === 'active').length,
    pending: pending.length,
    dueReview: renewalsDue().filter(m => scopesFor.includes(m.scope)).length,
    usedThisWeek: live.filter(m => recalledThisWeek(m.lastRecalled)).length,
    // The store keeps one honest figure for recall events, and it is a company
    // figure. Showing it under a team heading would be claiming a split that
    // does not exist.
    totalRecalls: scope.persona === 'cfo' ? RECALLS_THIS_WEEK : null,
    pendingRows: scope.persona === 'auditor' ? [] : pending,
    nothingYet: live.length === 0,
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * PU-21 — created this period
 * ────────────────────────────────────────────────────────────────────────── */

export interface CreatedCount {
  kind: CreatedKind;
  label: string;
  count: number;
  rows: CreatedRecord[];
}

const CREATED_LABEL: Record<CreatedKind, string> = {
  engagement: 'Engagements',
  audit: 'Audit programmes',
  control: 'Controls',
  dashboard: 'Dashboards',
  report: 'Reports',
};

/**
 * What was created in the window (PU-21).
 *
 * Every one of these tables already stamps when a record was saved and who saved
 * it, so this needs no new plumbing and no waiting: it is countable today,
 * backwards through the whole history. What it deliberately does not show is
 * edits, reviews, views or time spent — those need the event log to widen, and
 * the caption says "created" for exactly that reason.
 */
export function createdThisPeriod(p: Period, scope: Scope): CreatedCount[] {
  const kinds: CreatedKind[] = ['engagement', 'audit', 'control', 'dashboard', 'report'];
  return kinds.map(kind => {
    const rows = CREATED_RECORDS.filter(rec => rec.kind === kind
      && rec.createdAt >= p.from && rec.createdAt <= p.to
      && (scope.persona === 'cfo' || personInScope(rec.createdBy, scope)));
    return {
      kind,
      label: CREATED_LABEL[kind],
      count: rows.length,
      rows: rows.slice().sort((a, b) => b.createdAt - a.createdAt),
    };
  });
}

/* ──────────────────────────────────────────────────────────────────────────
 * PU-22 — dashboards, widgets and alerts
 * ────────────────────────────────────────────────────────────────────────── */

export interface ProductActivity {
  dashboardsCreated: number;
  widgetsChanged: number;
  alertsFired: number;
  /** Alert fires with no person behind them. A fact, not a blank. */
  alertsAutomatic: number;
  dashboardRows: AuditEventRow[];
  alertRows: AuditEventRow[];
}

/**
 * What was built and what fired (PU-22).
 *
 * The product already writes a before-and-after event on every dashboard,
 * widget and alert change, and an alert fired by the background worker writes
 * one too with no actor. So this block needs nothing built, and a worker-fired
 * alert is labelled automatic rather than left looking anonymous.
 */
export function productActivity(p: Period, scope: Scope): ProductActivity {
  const events = AUDIT_EVENTS.filter(e => e.at >= p.from && e.at <= p.to
    && (scope.persona === 'cfo' || e.actor === null || personInScope(e.actor, scope)));

  const dashboardRows = events.filter(e => e.entityType === 'dashboard' && e.verb === 'create');
  const alertRows = events.filter(e => e.entityType === 'widget_alert' && e.verb === 'fire');

  return {
    dashboardsCreated: dashboardRows.length,
    widgetsChanged: events.filter(e => e.entityType === 'widget' && (e.verb === 'create' || e.verb === 'update')).length,
    alertsFired: alertRows.length,
    alertsAutomatic: alertRows.filter(e => e.actor === null).length,
    dashboardRows: dashboardRows.slice().sort((a, b) => b.at - a.at),
    alertRows: alertRows.slice().sort((a, b) => b.at - a.at).slice(0, 8),
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * PU-23 — reports
 * ────────────────────────────────────────────────────────────────────────── */

export interface ReportsActivity {
  made: number;
  activity: number;
  activityByType: { type: string; count: number }[];
  shared: number;
  actionPlansOpen: number;
  actionPlansClosed: number;
  rows: { title: string; status: string; by: string; at: number }[];
}

/**
 * Reports (PU-23).
 *
 * A report edited fifty times is one report and fifty activities. The two are
 * shown next to each other and never added together, which is the acceptance
 * test for this block.
 */
export function reportsActivity(p: Period, scope: Scope): ReportsActivity {
  const made = REPORT_RECORDS.filter(r => r.createdAt >= p.from && r.createdAt <= p.to
    && (scope.persona === 'cfo' || personInScope(r.createdBy, scope)));
  const activity = REPORT_ACTIVITY.filter(a => a.at >= p.from && a.at <= p.to
    && (scope.persona === 'cfo' || a.authorType === 'system' || personInScope(a.author, scope)));

  const byType = new Map<string, number>();
  for (const row of activity) byType.set(row.activityType, (byType.get(row.activityType) ?? 0) + 1);

  return {
    made: made.length,
    activity: activity.length,
    activityByType: Array.from(byType.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count),
    shared: REPORT_SHARES.filter(s => s.at >= p.from && s.at <= p.to
      && (scope.persona === 'cfo' || personInScope(s.sharedBy, scope))).length,
    actionPlansOpen: ACTION_PLANS.filter(a => a.status === 'open').length,
    actionPlansClosed: ACTION_PLANS.filter(a => a.status === 'closed').length,
    rows: made
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(r => ({ title: r.title, status: r.status, by: r.createdBy, at: r.createdAt })),
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * PU-24 — sampling
 * ────────────────────────────────────────────────────────────────────────── */

export interface Sampling {
  passed: number;
  failed: number;
  error: number;
  inFlight: number;
  total: number;
  /** The controls with something to look at, worst first. */
  byControl: { control: string; passed: number; failed: number; error: number }[];
}

/**
 * Sample validation outcomes (PU-24).
 *
 * "Errored" is shown apart from "failed" throughout. A failed test is a finding;
 * an errored one is a run that could not reach a verdict and needs a person.
 * Merging them would hide work rather than report it.
 */
export function sampling(p: Period, scope: Scope): Sampling {
  const rows = SAMPLE_RUNS.filter(r => r.at >= p.from && r.at <= p.to
    && (scope.persona === 'cfo' || (scope.persona === 'head_of_team' ? r.actor.team === scope.team : r.actor.email === scope.userEmail)));

  const byControl = new Map<string, { control: string; passed: number; failed: number; error: number }>();
  for (const row of rows) {
    const entry = byControl.get(row.controlName) ?? { control: row.controlName, passed: 0, failed: 0, error: 0 };
    if (row.status === 'passed') entry.passed += 1;
    if (row.status === 'failed') entry.failed += 1;
    if (row.status === 'error') entry.error += 1;
    byControl.set(row.controlName, entry);
  }

  return {
    passed: rows.filter(r => r.status === 'passed').length,
    failed: rows.filter(r => r.status === 'failed').length,
    error: rows.filter(r => r.status === 'error').length,
    inFlight: rows.filter(r => r.status === 'queued' || r.status === 'running').length,
    total: rows.length,
    byControl: Array.from(byControl.values())
      .filter(c => c.failed + c.error > 0)
      .sort((a, b) => b.failed + b.error - (a.failed + a.error))
      .slice(0, 5),
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * PU-25 — AI insights
 * ────────────────────────────────────────────────────────────────────────── */

export interface InsightSummary {
  total: number;
  perRun: number;
  consolidated: number;
  bySeverity: { severity: string; count: number }[];
  newest: { headline: string; severity: string; engagement: string; at: number }[];
}

/**
 * Insights generated (PU-25).
 *
 * A consolidated insight summarises several per-run ones, so counting both
 * together would report the same finding twice. The split is on screen, which is
 * what makes the double count visible rather than possible.
 */
export function insightSummary(p: Period, scope: Scope): InsightSummary {
  const engagementTeam = new Map(ENGAGEMENT_ROWS.map(e => [e.id, e.team]));
  const rows = INSIGHTS.filter(i => i.at >= p.from && i.at <= p.to
    && (scope.persona !== 'head_of_team' || engagementTeam.get(i.engagementId) === scope.team));

  return {
    total: rows.length,
    perRun: rows.filter(i => i.kind === 'per_run').length,
    consolidated: rows.filter(i => i.kind === 'consolidated').length,
    bySeverity: SEVERITY_ORDER
      .map(severity => ({ severity, count: rows.filter(i => i.severity === severity).length }))
      .filter(r => r.count > 0),
    newest: rows
      .slice()
      .sort((a, b) => b.at - a.at)
      .slice(0, 4)
      .map(i => ({ headline: i.headline, severity: i.severity, engagement: i.engagementName, at: i.at })),
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * PU-26 — the risk picture
 * ────────────────────────────────────────────────────────────────────────── */

export interface RiskPicture {
  total: number;
  mapped: number;
  unmapped: number;
  /** The number a CFO acts on: severe risks no control covers. */
  unmappedSevere: { id: string; name: string; priority: string; owner: string }[];
  byPriority: { priority: string; count: number }[];
  byCategory: { category: string; count: number }[];
  aiGeneratedShare: number;
  createdInPeriod: number;
}

/**
 * Risks recorded, prioritised, and not covered (PU-26).
 *
 * Two stories in one register. The picture — how many, how severe, in which
 * category — and the audit gap: which critical and high risks have no control
 * covering them at all. The AI-generated share is labelled as a share, because
 * "the AI wrote a third of your register" is a fact worth knowing in both
 * directions.
 */
export function riskPicture(p: Period, scope: Scope): RiskPicture {
  const rows = RISK_ROWS.filter(r => scope.persona !== 'head_of_team' || r.team === scope.team);
  const unmapped = rows.filter(r => !r.mapped);

  const priorities = ['Critical', 'High', 'Medium', 'Low'];
  const categories = Array.from(new Set(rows.map(r => r.category))).sort();

  return {
    total: rows.length,
    mapped: rows.filter(r => r.mapped).length,
    unmapped: unmapped.length,
    unmappedSevere: unmapped
      .filter(r => r.priority === 'Critical' || r.priority === 'High')
      .map(r => ({ id: r.id, name: r.name, priority: r.priority, owner: r.owner }))
      .sort((a, b) => (a.priority === b.priority ? a.id.localeCompare(b.id) : a.priority === 'Critical' ? -1 : 1)),
    byPriority: priorities
      .map(priority => ({ priority, count: rows.filter(r => r.priority === priority).length }))
      .filter(r => r.count > 0),
    byCategory: categories.map(category => ({ category, count: rows.filter(r => r.category === category).length })),
    aiGeneratedShare: rows.length === 0 ? 0 : (rows.filter(r => r.addedUsing === 'AI Generated').length * 100) / rows.length,
    createdInPeriod: rows.filter(r => r.createdAt >= p.from && r.createdAt <= p.to).length,
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * PU-27 — the engagement portfolio and its motion
 * ────────────────────────────────────────────────────────────────────────── */

export interface ProcessStripRow {
  id: string;
  code: string;
  name: string;
  owner: string;
  reviewer: string | null;
  controlsTested: number;
  controlsTotal: number;
  exceptionsOpen: number;
  actionPlansOpen: number;
  report: 'none' | 'draft' | 'final';
  periodEndAt: number | null;
}

export interface Portfolio {
  byStatus: { status: string; count: number }[];
  total: number;
  /** Engagements whose planned end has passed the period they cover. */
  slipping: { code: string; name: string; owner: string; plannedEndAt: number; periodEndAt: number }[];
  /** History entries written in the window — real changes, not rows touched. */
  changes: number;
  strip: ProcessStripRow[];
}

/**
 * The portfolio, and where each engagement sits (PU-27).
 *
 * Every cell on the process strip reconciles with its own source table and opens
 * it. The strip is sorted by the date the audit period ends, soonest first — a
 * date, never a person.
 */
export function portfolio(p: Period, scope: Scope): Portfolio {
  const rows = ENGAGEMENT_ROWS.filter(e => scope.persona !== 'head_of_team' || e.team === scope.team);
  const statuses = Array.from(new Set(rows.map(e => e.status)));

  const active = rows.filter(e => e.status === 'Active' || e.status === 'In Progress' || e.status === 'Review');

  const strip: ProcessStripRow[] = active.map((eng): ProcessStripRow => {
    const samples = SAMPLE_RUNS.filter(s => s.engagementId === eng.id);
    const tested = new Set(samples.filter(s => s.status === 'passed' || s.status === 'failed').map(s => s.controlId)).size;
    const exceptionsOpen = TRACED_EXCEPTIONS.filter(ex => ex.engagementId === eng.id && ex.status !== 'Resolved').length;
    const plans = ACTION_PLANS.filter(ap => ap.status === 'open').length;
    // A report exists for the engagement when one names it, which is how the
    // reports module links them today.
    const report = REPORT_RECORDS.find(r => r.title.toLowerCase().includes(eng.process.toLowerCase()));
    return {
      id: eng.id,
      code: eng.code,
      name: eng.name,
      owner: eng.owner,
      reviewer: eng.reviewer,
      controlsTested: tested,
      controlsTotal: eng.controls,
      exceptionsOpen,
      actionPlansOpen: Math.min(plans, 4),
      report: report ? report.status : 'none',
      periodEndAt: eng.periodEndAt,
    };
  }).sort((a, b) => (a.periodEndAt ?? Number.MAX_SAFE_INTEGER) - (b.periodEndAt ?? Number.MAX_SAFE_INTEGER));

  return {
    byStatus: statuses
      .map(status => ({ status, count: rows.filter(e => e.status === status).length }))
      .sort((a, b) => b.count - a.count),
    total: rows.length,
    // Slipping means the date it was planned to finish has passed and it has
    // not. An engagement whose sign-off falls after the period it covers is
    // normal, not late, so the comparison is planned end against today.
    slipping: rows
      .filter(e => e.plannedEndAt !== null && e.periodEndAt !== null
        && e.plannedEndAt < ANCHOR && e.status !== 'Closed' && e.status !== 'Review')
      .map(e => ({ code: e.code, name: e.name, owner: e.owner, plannedEndAt: e.plannedEndAt as number, periodEndAt: e.periodEndAt as number })),
    changes: rows.reduce((s, e) => s + e.history.filter(h => h.at >= p.from && h.at <= p.to).length, 0),
    strip,
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * PU-28 — continuous monitoring
 * ────────────────────────────────────────────────────────────────────────── */

export interface Ccm {
  engagementsOn: number;
  engagementsTotal: number;
  schedules: { frequency: string; count: number }[];
  /** Threshold against what the same sample data actually shows. */
  thresholdRows: { engagement: string; threshold: number; actual: number | null; frequency: string }[];
  bulkRuns: number;
  /** Exceptions that moved through an approval gate in the window. */
  gateVerdicts: number;
}

/**
 * Continuous monitoring (PU-28).
 *
 * How much of the auditing runs on a schedule rather than once. The
 * threshold-against-actual line uses the same pass and fail data as the sampling
 * block, never a second computation, so the two can never disagree.
 */
export function ccm(p: Period, scope: Scope): Ccm {
  const teamOf = new Map(ENGAGEMENT_ROWS.map(e => [e.id, e.team]));
  const configs = AUTOMATION_CONFIGS.filter(c => scope.persona !== 'head_of_team' || teamOf.get(c.engagementId) === scope.team);
  const on = configs.filter(c => c.isCcm);

  const frequencies = new Map<string, number>();
  for (const c of on) {
    if (!c.jobFrequency) continue;
    frequencies.set(c.jobFrequency, (frequencies.get(c.jobFrequency) ?? 0) + 1);
  }

  const thresholdRows = on.map(c => {
    const samples = SAMPLE_RUNS.filter(s => s.engagementId === c.engagementId && s.at >= p.from && s.at <= p.to
      && (s.status === 'passed' || s.status === 'failed'));
    // Two tests are not a pass rate. Under the floor the line says so rather
    // than printing a percentage that will swing by fifty points next week.
    const actual = samples.length < 3 ? null : (samples.filter(s => s.status === 'passed').length * 100) / samples.length;
    return {
      engagement: c.engagementName,
      threshold: c.passRateThreshold,
      actual,
      frequency: c.jobFrequency ?? 'unscheduled',
    };
  }).sort((a, b) => (a.actual ?? 101) - (b.actual ?? 101));

  return {
    engagementsOn: on.length,
    engagementsTotal: configs.length,
    schedules: Array.from(frequencies.entries()).map(([frequency, count]) => ({ frequency, count })),
    thresholdRows,
    bulkRuns: BULK_RUNS.filter(b => b.at >= p.from && b.at <= p.to).length,
    gateVerdicts: TRACED_EXCEPTIONS.filter(ex => ex.classification !== null && ex.openedAt >= p.from && ex.openedAt <= p.to).length,
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * PU-19 Layer 1 — the paid lookups, counted
 * ────────────────────────────────────────────────────────────────────────── */

export interface LookupVolume {
  rows: {
    name: string;
    calls: number;
    failed: number;
    /** Batches, which is what a per-run API charges for. */
    batches: number;
    personalData: boolean;
    pricePaise: number | null;
    billingUnit: 'run' | 'row' | null;
    /** What this API charged over the window, at its contract price. */
    chargedPaise: number | null;
  }[];
  calls: number;
  failed: number;
  personalDataCalls: number;
  /** The contract cost divided by the calls it covered. Says what it is. */
  effectiveRatePaise: number | null;
  prices: ContractPrice[];
}

/**
 * Lookup volume, and what the contract charges for it (PU-19).
 *
 * Volume needs nothing new: the calls are recorded today. The charge is that
 * volume at the contract price in force on each call's own day, which is why a
 * renegotiation in February does not move January's figure. The rate shown next
 * to it is the contract cost divided by the calls it covered, and it is described
 * as exactly that rather than as a rate card anybody can quote.
 */
export function lookupVolume(p: Period): LookupVolume {
  const calls = LOOKUP_CALLS.filter(c => c.at >= p.from && c.at <= p.to);
  const complete = calls.filter(c => c.status === 'complete');
  const prices = loadContractPrices();
  const cost = costToRun(p);

  const rows = PAID_LOOKUPS.map(lookup => {
    const mine = calls.filter(c => c.lookupId === lookup.id);
    const mineComplete = mine.filter(c => c.status === 'complete');
    // The row shows the price in force at the end of the window, because that is
    // the one a reader can check against their contract today. The charge itself
    // is computed per call, at whatever was in force then.
    const price = priceInForce(lookup.id, p.to, prices);
    const charge = chargeFor(mine, prices);
    return {
      name: lookup.name,
      calls: mineComplete.length,
      failed: mine.length - mineComplete.length,
      batches: new Set(mineComplete.map(c => c.batchId)).size,
      personalData: lookup.personalData,
      pricePaise: price?.pricePaise ?? null,
      billingUnit: price?.billingUnit ?? null,
      chargedPaise: charge.priced === 0 ? null : charge.paise,
    };
  }).filter(r => r.calls + r.failed > 0).sort((a, b) => (b.chargedPaise ?? 0) - (a.chargedPaise ?? 0) || b.calls - a.calls);

  return {
    rows,
    calls: complete.length,
    failed: calls.length - complete.length,
    personalDataCalls: complete.filter(c => PAID_LOOKUPS.find(l => l.id === c.lookupId)?.personalData).length,
    effectiveRatePaise: cost.lookupRupees !== null && complete.length > 0
      ? Math.round((cost.lookupRupees * 100) / complete.length)
      : null,
    prices: cost.prices,
  };
}

/**
 * The contract, month by month, against the volume it priced.
 *
 * The customer cannot change any of this, so the ledger is a statement rather
 * than a form: what ran, what it charged, and which calls the contract does not
 * cover yet.
 */
export function contractLedger(): { at: number; label: string; calls: number; chargedPaise: number; unpricedCalls: number }[] {
  const prices = loadContractPrices();
  const byMonth = new Map<number, LookupCall[]>();
  for (const call of LOOKUP_CALLS) {
    const m = startOfMonthUtc(call.at);
    byMonth.set(m, [...(byMonth.get(m) ?? []), call]);
  }
  return Array.from(byMonth.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([at, calls]) => {
      const charge = chargeFor(calls, prices);
      return {
        at,
        label: formatMonth(at),
        calls: calls.filter(c => c.status === 'complete').length,
        chargedPaise: charge.paise,
        unpricedCalls: charge.unpriced,
      };
    });
}

/* ──────────────────────────────────────────────────────────────────────────
 * The assumptions strip's own history
 * ────────────────────────────────────────────────────────────────────────── */

export interface ChangeHistory {
  inPeriod: number;
  rows: { field: string; from: string | null; to: string | null; source: string | null; by: string; at: number }[];
}

/**
 * The inputs are themselves counted.
 *
 * Every calibration, pin and entered bill writes a row, so "settings changed
 * this period: 2" is a real figure with a list behind it — the same rule every
 * other number on this page follows.
 */
export function changeHistory(p: Period): ChangeHistory {
  const rows = loadUsageChanges();
  return {
    inPeriod: rows.filter(r => r.at >= p.from && r.at <= p.to).length,
    rows: rows.map(r => ({ field: r.field, from: r.from, to: r.to, source: r.source, by: r.by, at: r.at })),
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * The attention strip
 * ────────────────────────────────────────────────────────────────────────── */

export type AttentionTarget = 'risks' | 'stuck' | 'controls' | 'queue' | 'sampling' | 'memory';

export interface AttentionCard {
  id: string;
  target: AttentionTarget;
  text: string;
  actionLabel: string;
}

/**
 * Needs your attention.
 *
 * At most three cards, each a sentence with one thing to do. Nothing here is
 * sent anywhere and nothing has a threshold to configure: every card is a fact
 * already on the page, said early because acting on it should not wait for a
 * scroll.
 *
 * Cards a reader cannot act on are not shown to them, which is why an API the
 * contract does not price yet is not one. That is ours to fix, not theirs: it is
 * stated plainly in the cost block instead of being handed to somebody with no
 * way to act on it.
 */
export function attentionCards(
  scope: Scope,
  p: Period,
  data: {
    risks: RiskPicture;
    stuck: StuckRun[];
    never: NeverExercised;
    queue: QueueItem[];
    sampling: Sampling;
    smartLearn: SmartLearn;
  },
): AttentionCard[] {
  const cards: AttentionCard[] = [];

  if (scope.persona === 'auditor') {
    const overdue = data.queue.filter(q => q.overdue).length;
    if (overdue > 0) {
      cards.push({
        id: 'queue',
        target: 'queue',
        text: `${overdue} ${overdue === 1 ? 'item is' : 'items are'} past the date you were meant to clear ${overdue === 1 ? 'it' : 'them'}.`,
        actionLabel: 'Open your queue',
      });
    }
    if (data.smartLearn.pending > 0) {
      cards.push({
        id: 'memory',
        target: 'memory',
        text: `The assistant has ${fmtInt(data.smartLearn.pending)} ${data.smartLearn.pending === 1 ? 'thing' : 'things'} it wants to remember about how you work, waiting on you.`,
        actionLabel: 'Decide them',
      });
    }
    return cards.slice(0, 3);
  }

  // A repeated failure is the most actionable fact on the page, so it leads.
  const repeated = data.stuck.filter(s => s.repeats > 1).sort((a, b) => b.repeats - a.repeats)[0];
  if (repeated) {
    cards.push({
      id: 'stuck',
      target: 'stuck',
      text: `${repeated.workflow} has failed ${fmtInt(repeated.repeats)} times with the same error.`,
      actionLabel: 'See what it says',
    });
  } else if (data.stuck.length > 0) {
    cards.push({
      id: 'stuck',
      target: 'stuck',
      text: `${fmtInt(data.stuck.length)} ${data.stuck.length === 1 ? 'run is' : 'runs are'} stuck and nobody has picked ${data.stuck.length === 1 ? 'it' : 'them'} up.`,
      actionLabel: 'See them',
    });
  }

  if (data.risks.unmappedSevere.length > 0) {
    cards.push({
      id: 'risks',
      target: 'risks',
      text: `${fmtInt(data.risks.unmappedSevere.length)} critical and high ${data.risks.unmappedSevere.length === 1 ? 'risk has' : 'risks have'} no control covering ${data.risks.unmappedSevere.length === 1 ? 'it' : 'them'}.`,
      actionLabel: 'See which',
    });
  }

  if (data.sampling.error > 0) {
    cards.push({
      id: 'sampling',
      target: 'sampling',
      text: `${fmtInt(data.sampling.error)} sample ${data.sampling.error === 1 ? 'validation' : 'validations'} could not reach a verdict and ${data.sampling.error === 1 ? 'needs' : 'need'} a person.`,
      actionLabel: 'See them',
    });
  }

  if (scope.persona === 'head_of_team' && data.never.controls.length > 0) {
    cards.push({
      id: 'controls',
      target: 'controls',
      text: `${fmtInt(data.never.controls.length)} of your controls have never been exercised by the platform, in any window.`,
      actionLabel: 'See which',
    });
  }

  if (scope.persona === 'head_of_team' && data.smartLearn.pending > 0) {
    cards.push({
      id: 'memory',
      target: 'memory',
      text: `${fmtInt(data.smartLearn.pending)} team ${data.smartLearn.pending === 1 ? 'memory is' : 'memories are'} waiting for you to approve or reject.`,
      actionLabel: 'Decide them',
    });
  }

  void p;
  return cards.slice(0, 3);
}

/* ──────────────────────────────────────────────────────────────────────────
 * Shared shapes the page and both exports read
 * ────────────────────────────────────────────────────────────────────────── */

/** The whole of a view's numbers, assembled once and passed down. */
export interface UsageSnapshot {
  scope: Scope;
  period: Period;
  prior: Period | null;
  settings: UsageSettings;
  value: ValueFigures;
  priorValue: ValueFigures | null;
  cost: CostToRun;
  net: NetValue;
  overTime: TimeBucket[];
  coverage: Coverage;
  never: NeverExercised;
  exceptions: ExceptionsCaught;
  volume: WorkVolume;
  reliability: ReliabilityRow[];
  wasted: { hours: number; runs: number };
  stuck: StuckRun[];
  aiUsage: AiUsageRow[];
  people: PersonRow[];
  queue: QueueItem[];
  learn: SmartLearn;
  created: CreatedCount[];
  product: ProductActivity;
  reports: ReportsActivity;
  sampling: Sampling;
  insights: InsightSummary;
  risks: RiskPicture;
  portfolio: Portfolio;
  ccm: Ccm;
  lookups: LookupVolume;
  changes: ChangeHistory;
}

/** Assemble a view. One call, so the page and the export can never diverge. */
export function snapshot(scope: Scope, p: Period, settings: UsageSettings): UsageSnapshot {
  const prior = priorPeriod(p);
  return {
    scope,
    period: p,
    prior,
    settings,
    value: valueOf(runsIn(p, scope), settings, p),
    priorValue: prior ? valueOf(runsIn(prior, scope), settings, prior) : null,
    cost: costToRun(p),
    net: netValue(valueOf(runsIn(p, scope), settings, p), costToRun(p)),
    overTime: valueOverTime(p, scope, settings),
    coverage: controlCoverage(p, scope),
    never: neverExercised(scope),
    exceptions: exceptionsCaught(p, scope),
    volume: workVolume(p, scope),
    reliability: reliability(p, scope),
    wasted: wastedEffort(p, scope),
    stuck: stuckRuns(p, scope),
    aiUsage: aiUsageByArea(p),
    people: scope.persona === 'head_of_team' ? perPersonOutcomes(p, scope.team) : [],
    queue: myQueue(scope),
    learn: smartLearn(scope),
    created: createdThisPeriod(p, scope),
    product: productActivity(p, scope),
    reports: reportsActivity(p, scope),
    sampling: sampling(p, scope),
    insights: insightSummary(p, scope),
    risks: riskPicture(p, scope),
    portfolio: portfolio(p, scope),
    ccm: ccm(p, scope),
    lookups: lookupVolume(p),
    changes: changeHistory(p),
  };
}

/** Workflows the library holds, for the never-run block's own denominator. */
export const WORKFLOW_COUNT = WORKFLOWS.length;
/** Controls the library holds — the same rows the Control Library screen draws. */
export const CONTROL_COUNT = CONTROL_LIBRARY.length;
