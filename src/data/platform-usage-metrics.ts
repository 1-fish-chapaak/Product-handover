/**
 * Platform Usage — every number on the page, PU-01 to PU-28.
 *
 * One function per metric, each independently testable, each computed from the
 * records in `platform-usage.ts` and from nothing else. The reasoning for why a
 * metric exists lives on the page; what lives here is the arithmetic and the
 * rules that stop the arithmetic lying.
 *
 * ## Four rules held in this file rather than in the components
 *
 * · **No blended AI cost.** The only genuine cost figure in the product is the
 *   Concierge job cost, and it is labelled as exactly that. Chat usage is an
 *   estimate and is returned carrying the word. SOP-to-RACM and workflow AI
 *   record nothing at all and return "not measured", which is a different fact
 *   from zero.
 * · **A total is complete or it is absent.** Cost to run returns a `complete`
 *   flag, and it is false until the vendor price list holds a row. A partial
 *   figure under a complete-sounding label is a defect, so the type makes the
 *   caller handle it.
 * · **Nothing ranks people.** The one per-person function sorts alphabetically
 *   and returns no share, rank or average. There is no parameter that changes
 *   that.
 * · **Failed runs never add to savings.** They are reported as wasted machine
 *   time in their own block. The setting that says so is on the settings
 *   object, so the policy is visible rather than buried in a filter.
 */

import {
  ANCHOR, DAY_MS, HISTORY_START, RUNS, CHAT_QUESTIONS, CONCIERGE_JOBS, SOP_RACM_JOBS,
  TRACED_EXCEPTIONS, BULK_RUN_IDS, REVIEW_RECORDS, loadPricing, loadInvoices, monthsInWindow, billableWorkflowIds,
  ALERT_FIRES, ALERT_RULE_TOTAL, DASHBOARD_TOTAL, SAMPLE_RUNS, INSIGHT_ROWS, ENGAGEMENT_AUTOMATION,
  formatDate, parseLibraryDate, teamOfName, loadUsageChanges, startOfMonthUtc,
  type WorkflowRun, type SampleRunStatus, type UsageChange, type VendorInvoice,
} from './platform-usage';
import { WORKFLOWS } from './mockData';
import { CONTROL_LIBRARY } from './controlLibrary';
import { SEED_RISKS } from './riskRegister';
import { ENGAGEMENTS } from './engagements';
import { ENGAGEMENT_EXCEPTIONS } from './engagement-exceptions';
import { ATR_LIBRARY } from './atrLibrary';
import { liveMemories, pendingMemories } from './memorySession';
import type { PlatformMemory } from './memoryStore';
import type { AdminUser, AuditLog } from '../context/AdminDataContext';

/* ──────────────────────────────────────────────────────────────────────────
 * 1 · Who is reading
 * ────────────────────────────────────────────────────────────────────────── */

/** The three questions the page answers, in the spec's names. */
export type Persona = 'cfo' | 'head_of_team' | 'auditor';

/** What the view is called in an export, where it identifies the file. */
export const PERSONA_TITLE: Record<Persona, string> = {
  cfo: 'Whole company',
  head_of_team: 'My team',
  auditor: 'Just me',
};

/**
 * Whose data is being read.
 *
 * A lens, not a key: the scope is built from the permissions the signed-in role
 * actually holds, so switching never widens what somebody can see. You can
 * narrow down your own line; you can never look sideways into another team.
 */
export interface Scope {
  persona: Persona;
  /** What the scope line says out loud — "SOX Audit", "the whole company". */
  label: string;
  team?: string;
  userEmail?: string;
}

const inScope = (scope: Scope, team: string, email: string): boolean => {
  if (scope.persona === 'cfo') return true;
  if (scope.persona === 'head_of_team') return !scope.team || team === scope.team;
  return !scope.userEmail || email === scope.userEmail;
};

/* ──────────────────────────────────────────────────────────────────────────
 * 2 · The four settings — PU-18
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Where a setting's value came from.
 *
 * This is the difference between a number that survives an audit-committee
 * question and one that does not. "Measured from our own last ninety days"
 * survives it. "The vendor assumed two hundred" does not.
 */
export type SettingSource = 'default' | 'measured' | 'manual';

/** What each source is called on screen, in the export, and in the audit event. */
export const SOURCE_LABEL: Record<SettingSource, string> = {
  default: 'starting value',
  measured: "based on your team's measured pace",
  manual: 'pinned by an admin',
};

/**
 * The four numbers the product cannot compute for itself.
 *
 * Two of them can be measured from the customer's own timestamps, so they carry
 * a source and the page keeps trying to improve them. The other two cannot be
 * measured by any platform — no product knows what an auditor hour costs or how
 * long a working month is — so they stay business-entered.
 *
 * `failedRunsPolicy` is fixed at 'excluded' and carried here so the policy is on
 * the record and travels into every export rather than hiding inside a query.
 */
export interface UsageSettings {
  /** Rows a person can check by hand in an hour. Measurable. */
  manualReviewRate: number;
  manualReviewRateSource: SettingSource;
  /** Hours one manual control test takes. Measurable. */
  manualControlTestHours: number;
  manualControlTestSource: SettingSource;
  /** Blended cost of one auditor hour. Never measurable. */
  hourlyRate: number;
  currency: 'INR';
  /** Hours one person works in a month. Never measurable. */
  hoursPerPersonPerMonth: number;
  failedRunsPolicy: 'excluded';
}

export const DEFAULT_SETTINGS: UsageSettings = {
  manualReviewRate: 200,
  manualReviewRateSource: 'default',
  manualControlTestHours: 4,
  manualControlTestSource: 'default',
  hourlyRate: 1200,
  currency: 'INR',
  hoursPerPersonPerMonth: 160,
  failedRunsPolicy: 'excluded',
};

/** The two settings that carry a source, and the field each one keeps it in. */
export const SOURCE_FIELD: Partial<Record<NumericSetting, 'manualReviewRateSource' | 'manualControlTestSource'>> = {
  manualReviewRate: 'manualReviewRateSource',
  manualControlTestHours: 'manualControlTestSource',
};

const SETTINGS_KEY = 'irame.platformUsage.settings.v2';

export function loadSettings(): UsageSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const saved = JSON.parse(raw) as Partial<UsageSettings>;
    return { ...DEFAULT_SETTINGS, ...saved, currency: 'INR', failedRunsPolicy: 'excluded' };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(next: UsageSettings): void {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
}

/**
 * The measured pace is applied on its own.
 *
 * The calibration job measures what it can from the customer's own timestamps,
 * and once the guards pass the live value switches to it: source becomes
 * `measured`, the label changes, and the change is written down. There is no
 * confirmation step, because at ten thousand people nobody clicks one. A value
 * an admin has pinned is never overwritten — that is the whole point of pinning.
 *
 * Returns the settings to use, and the changes worth recording. A caller that
 * gets an empty change list has nothing to write down.
 */
export function applyMeasured(
  current: UsageSettings,
  calibration: Calibration,
): { settings: UsageSettings; changes: { field: string; from: string; to: string; source: string }[] } {
  const changes: { field: string; from: string; to: string; source: string }[] = [];
  let next = current;

  const consider = (
    key: NumericSetting,
    sourceField: 'manualReviewRateSource' | 'manualControlTestSource',
    suggestion: Suggestion | null,
  ) => {
    if (!suggestion) return;
    // Pinned stays pinned. Already measured at this value has nothing to say.
    if (next[sourceField] === 'manual') return;
    if (next[key] === suggestion.value && next[sourceField] === 'measured') return;
    changes.push({
      field: SETTING_LABEL[key],
      from: String(next[key]),
      to: String(suggestion.value),
      source: SOURCE_LABEL.measured,
    });
    next = { ...next, [key]: suggestion.value, [sourceField]: 'measured' };
  };

  consider('manualReviewRate', 'manualReviewRateSource', calibration.reviewRate);
  consider('manualControlTestHours', 'manualControlTestSource', calibration.controlTestHours);

  return { settings: next, changes };
}

/* ── Calibration — the platform measuring its own assumption ─────────────── */

/** A rate worked out from the platform's own records, and the sample behind it. */
export interface Suggestion { value: number; sampleN: number; windowDays: number }

export interface Calibration {
  /** null when the guards were not met. The reason beside it says which one. */
  reviewRate: Suggestion | null;
  reviewRateReason: string | null;
  controlTestHours: Suggestion | null;
  controlTestHoursReason: string | null;
}

/** A suggestion needs both a long enough window and a big enough sample. */
const CALIBRATION_WINDOW_DAYS = 90;
const CALIBRATION_MIN_SAMPLE = 30;

const NO_MANUAL_TEST_RECORDS =
  'No manual control test carries a start and a finish time yet, so there is nothing to measure this against.';

/**
 * The calibration job, run for whoever is looking.
 *
 * It measures what can be measured from the customer's own timestamps and
 * suggests it. Nothing here is ever applied on its own: the job produces a
 * suggestion and a person adopts it, because a number that changed itself is a
 * number nobody can defend.
 *
 * The honest limit, on the record: reviewing an exception and checking rows by
 * hand are related work, not identical work, so the measured rate is a proxy.
 * It is a recorded proxy, which beats an assumption.
 */
export function calibrate(scope: Scope): Calibration {
  const from = ANCHOR - CALIBRATION_WINDOW_DAYS * DAY_MS;
  const sample = REVIEW_RECORDS.filter(
    r => r.resolvedAt >= from && r.resolvedAt <= ANCHOR && inScope(scope, r.team, r.userEmail),
  );

  const noTests = { controlTestHours: null, controlTestHoursReason: NO_MANUAL_TEST_RECORDS };

  if (sample.length < CALIBRATION_MIN_SAMPLE) {
    return {
      reviewRate: null,
      reviewRateReason: `Only ${sample.length} timed reviews in the last ${CALIBRATION_WINDOW_DAYS} days. ${CALIBRATION_MIN_SAMPLE} are needed before a measured rate means anything.`,
      ...noTests,
    };
  }

  // An exception left open over a weekend is not sixty hours of review, so the
  // slowest and the fastest tenth are dropped before anything is averaged.
  const rates = sample
    .map(r => ({ rows: r.rowsReviewed, hours: (r.resolvedAt - r.assignedAt) / 3_600_000 }))
    .filter(x => x.hours > 0)
    .map(x => ({ ...x, rate: x.rows / x.hours }))
    .sort((a, b) => a.rate - b.rate);
  const cut = Math.floor(rates.length * 0.1);
  const kept = rates.slice(cut, rates.length - cut);

  const rows = kept.reduce((t, x) => t + x.rows, 0);
  const hours = kept.reduce((t, x) => t + x.hours, 0);

  return {
    reviewRate: hours > 0
      ? { value: Math.round(rows / hours), sampleN: kept.length, windowDays: CALIBRATION_WINDOW_DAYS }
      : null,
    reviewRateReason: hours > 0 ? null : 'The timed reviews in this window add up to no measurable time.',
    ...noTests,
  };
}

/** The four settings a person can actually type a number into. */
export type NumericSetting =
  'manualReviewRate' | 'manualControlTestHours' | 'hourlyRate' | 'hoursPerPersonPerMonth';

/** The label each setting carries wherever it is shown or exported. */
export const SETTING_LABEL: Record<NumericSetting, string> = {
  manualReviewRate: 'Rows a person checks by hand in an hour',
  manualControlTestHours: 'Hours one manual control test takes',
  hourlyRate: 'Cost of one auditor hour',
  hoursPerPersonPerMonth: 'Hours one person works in a month',
};

/** The assumptions strip — the same sentence on screen, in CSV and in the PDF. */
export const settingsLine = (s: UsageSettings): string =>
  `${fmtInt(s.manualReviewRate)} rows an hour by hand (${SOURCE_LABEL[s.manualReviewRateSource]}) · ` +
  `${fmtMoney(s.hourlyRate)} an hour · ${fmtInt(s.hoursPerPersonPerMonth)} hours a person a month · ` +
  'failed runs excluded';

/* ──────────────────────────────────────────────────────────────────────────
 * 3 · The period
 * ────────────────────────────────────────────────────────────────────────── */

export type PeriodId = 'this-month' | 'this-quarter' | 'this-year' | 'since-start' | 'custom';

export interface Period {
  id: PeriodId;
  label: string;
  from: number;
  to: number;
  /** Fractional months in the window — what turns hours into people. */
  months: number;
}

export interface CustomRange { from: number; to: number }

const monthsBetween = (from: number, to: number): number =>
  Math.max(0.1, (to - from) / (DAY_MS * 30.44));

const period_ = (id: PeriodId, label: string, from: number, to: number): Period =>
  ({ id, label, from, to, months: monthsBetween(from, to) });

/**
 * The windows on offer.
 *
 * They are measured back from the newest record rather than from today, so the
 * page reads the same in a screenshot taken a year from now. "Since you started"
 * runs to the oldest record the platform still holds, which is the honest
 * meaning of the phrase when run history is eventually trimmed.
 */
export function periodOptions(): { id: PeriodId; label: string }[] {
  return [
    { id: 'this-month', label: 'This month' },
    { id: 'this-quarter', label: 'This quarter' },
    { id: 'this-year', label: 'This year' },
    { id: 'since-start', label: 'Since you started' },
  ];
}

export function period(id: PeriodId, custom?: CustomRange | null): Period {
  const end = new Date(ANCHOR);
  const y = end.getUTCFullYear();
  const m = end.getUTCMonth();

  switch (id) {
    case 'this-month':
      return period_('this-month', 'This month', Date.UTC(y, m, 1), ANCHOR);
    case 'this-quarter': {
      const qStart = Math.floor(m / 3) * 3;
      return period_('this-quarter', 'This quarter', Date.UTC(y, qStart, 1), ANCHOR);
    }
    case 'this-year':
      return period_('this-year', 'This year', Date.UTC(y, 0, 1), ANCHOR);
    case 'since-start':
      return period_('since-start', 'Since you started', HISTORY_START, ANCHOR);
    case 'custom': {
      if (!custom) return period('this-quarter');
      return period_('custom', `${formatDate(custom.from)} to ${formatDate(custom.to)}`, custom.from, custom.to);
    }
  }
}

/**
 * The window immediately before this one, of equal length.
 *
 * A quarter compares with the previous quarter; a custom 17-day range compares
 * with the 17 days before it. When the prior window falls off the front of the
 * record there is nothing honest to compare against and this returns null, so
 * the tiles show no change arrow rather than a fabricated one.
 */
export function priorPeriod(p: Period): Period | null {
  const span = p.to - p.from;
  const from = p.from - span;
  if (from < HISTORY_START - DAY_MS) return null;
  return period_(p.id, `the ${span > DAY_MS * 80 ? 'previous quarter' : 'previous period'}`, from, p.from - 1);
}

/* ──────────────────────────────────────────────────────────────────────────
 * 4 · Selecting records
 * ────────────────────────────────────────────────────────────────────────── */

const within = (ms: number | null, p: Period): boolean =>
  ms !== null && ms >= p.from && ms <= p.to;

/** Runs that finished inside the window, at this scope. */
export function runsIn(p: Period, scope: Scope): WorkflowRun[] {
  return RUNS.filter(r => within(r.completedAt ?? r.startedAt, p) && inScope(scope, r.team, r.userEmail));
}

/* ──────────────────────────────────────────────────────────────────────────
 * 5 · PU-01 to PU-03 — what the work was worth
 * ────────────────────────────────────────────────────────────────────────── */

export interface ValueResult {
  /** PU-01 */
  hours: number;
  /** PU-02 */
  money: number;
  /** PU-03 */
  people: number;
  /** The measured inputs behind the hours, so the page can show its working. */
  runsCounted: number;
  rowsProcessed: number;
  machineHours: number;
  controlTests: number;
}

/**
 * PU-01 · Hours saved, from two kinds of successful run.
 *
 * A row-processing run saves the time a person would have spent reading those
 * rows, less the time the machine actually took. A control-test run has no rows
 * at all — it stands in for one manual control test, so it saves that test's
 * hours less the machine time.
 *
 * Failed runs never appear here. Runs that completed and processed nothing are
 * skipped entirely: there was no work to value.
 */
export function valueOf(runs: WorkflowRun[], s: UsageSettings, months: number): ValueResult {
  let hours = 0;
  let rows = 0;
  let machineSecs = 0;
  let counted = 0;
  let controlTests = 0;

  for (const r of runs) {
    if (r.status !== 'complete') continue;

    if (r.rowCount !== null && r.rowCount > 0) {
      const manual = r.rowCount / s.manualReviewRate;
      hours += manual - r.durationSecs / 3600;
      rows += r.rowCount;
      machineSecs += r.durationSecs;
      counted += 1;
    } else if (r.rowCount === null && r.controlId !== null) {
      hours += s.manualControlTestHours - r.durationSecs / 3600;
      machineSecs += r.durationSecs;
      counted += 1;
      controlTests += 1;
    }
  }

  hours = Math.max(0, hours);
  return {
    hours,
    money: hours * s.hourlyRate,
    people: hours / (s.hoursPerPersonPerMonth * Math.max(months, 0.1)),
    runsCounted: counted,
    rowsProcessed: rows,
    machineHours: machineSecs / 3600,
    controlTests,
  };
}

/** The change on a tile — the same calculation over the prior window. */
export const deltaPct = (now: number, before: number | null): number | null => {
  if (before === null || before <= 0) return null;
  return ((now - before) / before) * 100;
};

/**
 * Hours lost to failed runs.
 *
 * This is how failed runs are reported honestly without touching the savings
 * total: the machine time they burned, counted separately and named as waste.
 */
export function wastedEffort(runs: WorkflowRun[]): { hours: number; runs: number } {
  const failed = runs.filter(r => r.status === 'failed');
  return { hours: failed.reduce((s, r) => s + r.durationSecs, 0) / 3600, runs: failed.length };
}

/**
 * The value line month by month — what the hero chart draws.
 *
 * Buckets are days for a short window and months for a long one, so a month
 * view is not one bar and a year view is not three hundred.
 */
export interface ValuePoint { label: string; from: number; to: number; hours: number; money: number }

export function valueOverTime(p: Period, scope: Scope, s: UsageSettings): ValuePoint[] {
  const span = p.to - p.from;
  const byMonth = span > DAY_MS * 70;
  const buckets: { label: string; from: number; to: number }[] = [];

  if (byMonth) {
    const d = new Date(p.from);
    let cursor = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
    while (cursor <= p.to) {
      const next = Date.UTC(new Date(cursor).getUTCFullYear(), new Date(cursor).getUTCMonth() + 1, 1);
      buckets.push({
        label: new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(new Date(cursor)),
        from: Math.max(cursor, p.from),
        to: Math.min(next - 1, p.to),
      });
      cursor = next;
    }
  } else {
    const days = Math.max(1, Math.ceil(span / DAY_MS));
    const step = days > 31 ? 7 : 1;
    for (let d = 0; d < days; d += step) {
      const from = p.from + d * DAY_MS;
      buckets.push({
        label: new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
          .format(new Date(from)),
        from,
        to: Math.min(from + step * DAY_MS - 1, p.to),
      });
    }
  }

  const runs = runsIn(p, scope);
  return buckets.map(b => {
    const slice = runs.filter(r => within(r.completedAt ?? r.startedAt, { ...p, from: b.from, to: b.to }));
    const v = valueOf(slice, s, 1);
    return { label: b.label, from: b.from, to: b.to, hours: v.hours, money: v.money };
  });
}

/* ──────────────────────────────────────────────────────────────────────────
 * 6 · PU-04 and PU-05 — cost, and net value
 * ────────────────────────────────────────────────────────────────────────── */

export interface CostResult {
  /** True only when every month in the window has its bill entered. */
  complete: boolean;
  /** Real dollars, from the one place in the product that records them. */
  conciergeUsd: number;
  conciergeJobs: number;
  /** Runs of workflows that call a paid vendor lookup. Countable today. */
  lookupRuns: number;
  lookupRows: number;
  /** The invoiced lookup cost in rupees. Null until the window is covered. */
  lookupMoney: number | null;
  /** How many bills that figure is the sum of. */
  invoices: number;
  monthsInWindow: number;
  monthsInvoiced: number;
  /** Rupees per recorded call, derived from the invoices. Never a rate card. */
  effectiveRate: number | null;
  /** What that rate was divided by, and whether it is every run or only the priced ones. */
  recordedCalls: number;
  callsAreAllRuns: boolean;
  /** Layer 3, when somebody has split the bill per API: its total and the gap. */
  split: { total: number; gap: number } | null;
  /** Why the total is incomplete, in the words the tile uses. */
  missing: string | null;
}

/**
 * PU-04 · Cost to run, invoice first.
 *
 * The lookup cost is the vendor's bill, summed over the months the window
 * touches. That is the number finance reconciles, it needs no rate card and no
 * guess about whether a run bills once or five hundred times, and it is exact.
 *
 * A window is only costed when every month in it has a bill entered. A quarter
 * with two of its three invoices in is not a cheaper quarter, it is an unfinished
 * one, so the tile says which months are missing rather than printing a total
 * that will grow next week.
 *
 * The effective rate underneath is context, not a price: the bill divided by the
 * calls the platform recorded that period. It carries where it came from
 * everywhere it appears.
 */
export function costToRun(p: Period, scope: Scope): CostResult {
  const billable = billableWorkflowIds();
  const completed = runsIn(p, scope).filter(r => r.status === 'complete');
  const runs = billable.size > 0 ? completed.filter(r => billable.has(r.workflowId)) : completed;
  const jobs = CONCIERGE_JOBS.filter(
    j => j.status === 'completed' && within(j.startedAt, p) && inScope(scope, j.team, j.userEmail),
  );

  const months = monthsInWindow(p.from, p.to);
  const invoices = loadInvoices().filter(i => months.includes(i.periodMonth));
  const monthsInvoiced = new Set(invoices.map(i => i.periodMonth)).size;
  const complete = months.length > 0 && monthsInvoiced === months.length;
  const invoiced = invoices.reduce((sum, i) => sum + i.amountPaise, 0) / 100;

  // Layer 3, if anybody has split the bill: the same runs priced per API, and
  // the gap against the bill. Shown, never quietly reconciled away.
  const pricing = loadPricing();
  const split = pricing.length > 0
    ? runs.reduce((sum, r) => {
        const at = r.completedAt ?? r.startedAt;
        const price = pricing.find(
          x => x.workflowId === r.workflowId
            && x.effectiveFrom <= at
            && (x.effectiveTo === null || x.effectiveTo >= at),
        );
        if (!price) return sum;
        const units = price.billingUnit === 'row' ? (r.rowCount ?? 0) : 1;
        return sum + (units * price.pricePaise) / 100;
      }, 0)
    : null;

  const missingMonths = months.length - monthsInvoiced;

  return {
    complete,
    conciergeUsd: jobs.reduce((s, j) => s + j.costUsd, 0),
    conciergeJobs: jobs.length,
    lookupRuns: runs.length,
    lookupRows: runs.reduce((s, r) => s + (r.rowCount ?? 0), 0),
    lookupMoney: complete ? invoiced : null,
    invoices: invoices.length,
    monthsInWindow: months.length,
    monthsInvoiced,
    effectiveRate: complete && runs.length > 0 ? invoiced / runs.length : null,
    recordedCalls: runs.length,
    callsAreAllRuns: billable.size === 0,
    split: complete && split !== null ? { total: split, gap: split - invoiced } : null,
    missing: complete
      ? null
      : monthsInvoiced === 0
        ? 'No invoice entered for this period.'
        : `${missingMonths} of the ${months.length} months in this window have no invoice entered yet.`,
  };
}

/**
 * PU-05 · Net value.
 *
 * While the cost is unknowable the hero is not "net value minus a blank": it
 * reads as work avoided, which is exactly what has been measured.
 */
export const netValue = (value: ValueResult, cost: CostResult): number | null =>
  cost.complete && cost.lookupMoney !== null ? value.money - cost.lookupMoney : null;

/* ── The list behind the cost tile, and the bills nobody has entered ─────── */

/**
 * One month of the window: what was billed, and what was recorded.
 *
 * A month with recorded calls and no bill is not a cheap month, it is an
 * unfinished one, and it says so by name. That is what stops a forgotten
 * invoice being discovered in a board meeting instead of on this page.
 */
export interface InvoiceMonth {
  month: number;
  label: string;
  invoices: VendorInvoice[];
  /** Rupees billed for the month. Null when no bill has been entered. */
  amount: number | null;
  /** Runs of the paid lookups recorded that month, bill or no bill. */
  recordedCalls: number;
}

export interface InvoiceLedger {
  months: InvoiceMonth[];
  /** Months with recorded calls and no bill, oldest first. */
  missing: InvoiceMonth[];
  entered: number;
}

const MONTH_LABEL = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

export function invoiceLedger(p: Period, scope: Scope): InvoiceLedger {
  const billable = billableWorkflowIds();
  const completed = runsIn(p, scope).filter(r => r.status === 'complete');
  const calls = billable.size > 0 ? completed.filter(r => billable.has(r.workflowId)) : completed;
  const all = loadInvoices();

  const months: InvoiceMonth[] = monthsInWindow(p.from, p.to).map(month => {
    const invoices = all.filter(i => i.periodMonth === month);
    return {
      month,
      label: MONTH_LABEL.format(new Date(month)),
      invoices,
      amount: invoices.length > 0 ? invoices.reduce((s, i) => s + i.amountPaise, 0) / 100 : null,
      recordedCalls: calls.filter(r => startOfMonthUtc(r.completedAt ?? r.startedAt) === month).length,
    };
  });

  return {
    months,
    missing: months.filter(m => m.amount === null && m.recordedCalls > 0),
    entered: months.reduce((n, m) => n + m.invoices.length, 0),
  };
}

/* ── PU-18 · the assumptions have their own history ──────────────────────── */

export interface ChangeHistory {
  /** Changes made inside the window, newest first. */
  inPeriod: UsageChange[];
  all: UsageChange[];
}

/**
 * Who changed an entered number, from what to what, when, and under which
 * source label. "Settings changed this period: 2" is a real, listable figure,
 * so it opens its list like every other count on the page.
 */
export function changeHistory(p: Period, entity: UsageChange['entity']): ChangeHistory {
  const all = loadUsageChanges().filter(c => c.entity === entity);
  return { all, inPeriod: all.filter(c => c.at >= p.from && c.at <= p.to) };
}

/* ──────────────────────────────────────────────────────────────────────────
 * 7 · PU-06 and PU-07 — what the automation reached
 * ────────────────────────────────────────────────────────────────────────── */

export interface CoverageResult { exercised: number; total: number; pct: number; names: string[] }

/** PU-06 · A control run fifty times counts once. */
export function controlCoverage(p: Period, scope: Scope): CoverageResult {
  const runs = runsIn(p, scope).filter(r => r.status === 'complete' && r.controlId !== null);
  const ids = new Set(runs.map(r => r.controlId as string));
  const names = Array.from(new Set(runs.map(r => r.controlName as string))).sort();
  const total = CONTROL_LIBRARY.length;
  return { exercised: ids.size, total, pct: total === 0 ? 0 : (ids.size * 100) / total, names };
}

export interface NeverExercised { controls: string[]; workflows: string[] }

/**
 * PU-07 · Never exercised, ever.
 *
 * Deliberately ignores the period. "Nothing has ever checked this control" is a
 * fact about the library, not about a window, and it needs no setting — which
 * is what makes it the one figure on the page nobody can argue with.
 */
export function neverExercised(): NeverExercised {
  const everRun = new Set(RUNS.map(r => r.controlId).filter((x): x is string => x !== null));
  const ranWorkflows = new Set(RUNS.map(r => r.workflowId));
  return {
    controls: CONTROL_LIBRARY.filter(c => !everRun.has(c.controlId)).map(c => c.name).sort(),
    workflows: WORKFLOWS.filter(w => !ranWorkflows.has(w.id)).map(w => w.name).sort(),
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * 8 · PU-08 — what was caught
 * ────────────────────────────────────────────────────────────────────────── */

export type Severity = 'Critical' | 'High' | 'Medium' | 'Low';
export const SEVERITIES: Severity[] = ['Critical', 'High', 'Medium', 'Low'];

export interface ExceptionRow {
  id: string; ref: string; title: string; severity: Severity; status: string;
  workflowName: string; runId: string | null; openedAt: number; assignee: string;
}
export interface ExceptionsResult {
  total: number;
  open: number;
  bySeverity: { severity: Severity; total: number; open: number }[];
  rows: ExceptionRow[];
}

/** PU-08 · Every counted exception opens from the page and traces to its run. */
export function exceptionsCaught(p: Period, scope: Scope): ExceptionsResult {
  const traced = TRACED_EXCEPTIONS.filter(t => {
    if (!within(t.openedAt, p)) return false;
    if (scope.persona === 'cfo') return true;
    if (scope.persona === 'head_of_team') return !scope.team || t.team === scope.team;
    return !scope.userEmail || t.userEmail === scope.userEmail;
  });

  const rows: ExceptionRow[] = traced.map(t => ({
    id: t.exception.id,
    ref: t.exception.ref,
    title: t.exception.title,
    severity: t.exception.severity,
    status: t.exception.status,
    workflowName: t.exception.workflowName,
    runId: t.runId,
    openedAt: t.openedAt,
    assignee: t.exception.assignee,
  })).sort((a, b) => b.openedAt - a.openedAt);

  const isOpen = (status: string) => status !== 'Resolved';
  return {
    total: rows.length,
    open: rows.filter(r => isOpen(r.status)).length,
    bySeverity: SEVERITIES.map(severity => {
      const of = rows.filter(r => r.severity === severity);
      return { severity, total: of.length, open: of.filter(r => isOpen(r.status)).length };
    }).filter(s => s.total > 0),
    rows,
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * 9 · PU-09 — work volume, in four units that are never added up
 * ────────────────────────────────────────────────────────────────────────── */

export interface VolumeUnit { key: string; label: string; count: number; note: string }

/**
 * PU-09 · Four counts, four charts, never a sum.
 *
 * A chat question and a bulk job are different units of work. Adding them
 * produces a number that means nothing, so this returns them separately and no
 * caller — screen or export — is given a total to print.
 */
export function workVolume(p: Period, scope: Scope): VolumeUnit[] {
  const runs = runsIn(p, scope);
  const single = runs.filter(r => r.bulkRunId === null);
  const bulkIds = new Set(runs.filter(r => r.bulkRunId !== null).map(r => r.bulkRunId as string));
  const chat = CHAT_QUESTIONS.filter(q => within(q.askedAt, p) && inScope(scope, q.team, q.userEmail));
  const jobs = CONCIERGE_JOBS.filter(j => within(j.startedAt, p) && inScope(scope, j.team, j.userEmail));

  return [
    { key: 'runs', label: 'Workflow runs', count: single.length, note: 'One workflow, run once' },
    { key: 'bulk', label: 'Bulk runs', count: bulkIds.size, note: `Several workflows at once, over ${BULK_RUN_IDS.length} recorded batches` },
    { key: 'chat', label: 'Questions asked', count: chat.length, note: 'Each answer keeps the program behind it' },
    { key: 'concierge', label: 'Concierge jobs', count: jobs.length, note: 'Background jobs on the specialist tools' },
  ];
}

/** The same four units over time, so each gets its own small chart. */
export function volumeOverTime(p: Period, scope: Scope): { label: string; runs: number; bulk: number; chat: number; concierge: number }[] {
  const points = valueOverTime(p, scope, DEFAULT_SETTINGS);
  return points.map(pt => {
    const win = { ...p, from: pt.from, to: pt.to };
    const runs = runsIn(win, scope);
    return {
      label: pt.label,
      runs: runs.filter(r => r.bulkRunId === null).length,
      bulk: new Set(runs.filter(r => r.bulkRunId !== null).map(r => r.bulkRunId)).size,
      chat: CHAT_QUESTIONS.filter(q => within(q.askedAt, win) && inScope(scope, q.team, q.userEmail)).length,
      concierge: CONCIERGE_JOBS.filter(j => within(j.startedAt, win) && inScope(scope, j.team, j.userEmail)).length,
    };
  });
}

/* ──────────────────────────────────────────────────────────────────────────
 * 10 · PU-10 and PU-11 — reliability, and what is stuck
 * ────────────────────────────────────────────────────────────────────────── */

export interface ReliabilityRow { name: string; failed: number; total: number; failurePct: number }
export interface ReliabilityResult { rows: ReliabilityRow[]; wastedHours: number; failedRuns: number }

/** PU-10 · A workflow with no runs in the window produces no row. */
export function reliability(p: Period, scope: Scope): ReliabilityResult {
  const runs = RUNS.filter(r => within(r.startedAt, p) && inScope(scope, r.team, r.userEmail));
  const byName = new Map<string, { failed: number; total: number }>();
  for (const r of runs) {
    const entry = byName.get(r.workflowName) ?? { failed: 0, total: 0 };
    entry.total += 1;
    if (r.status === 'failed') entry.failed += 1;
    byName.set(r.workflowName, entry);
  }
  const rows = Array.from(byName.entries())
    .map(([name, v]) => ({ name, ...v, failurePct: v.total === 0 ? 0 : (v.failed * 100) / v.total }))
    .sort((a, b) => b.failurePct - a.failurePct || b.total - a.total);

  const wasted = wastedEffort(runs);
  return { rows, wastedHours: wasted.hours, failedRuns: wasted.runs };
}

export interface StuckRun {
  id: string; workflowName: string; status: string; error: string; startedAt: number;
  ageHours: number; userName: string;
}

/** PU-11 · Failed, blocked, or paused for more than 24 hours. */
export function stuckRuns(p: Period, scope: Scope): StuckRun[] {
  return RUNS
    .filter(r => within(r.startedAt, p) && inScope(scope, r.team, r.userEmail))
    .filter(r =>
      r.status === 'failed' || r.status === 'blocked'
      || (r.status === 'paused' && r.updatedAt < ANCHOR - DAY_MS))
    .map(r => ({
      id: r.id,
      workflowName: r.workflowName,
      status: r.status === 'paused' ? 'Paused over 24 hours' : r.status === 'blocked' ? 'Blocked' : 'Failed',
      // Verbatim, never truncated. A summarised error is a run nobody can fix.
      error: r.executionError ?? 'No error text was recorded.',
      startedAt: r.startedAt,
      ageHours: (ANCHOR - r.updatedAt) / 3_600_000,
      userName: r.userName,
    }))
    .sort((a, b) => b.startedAt - a.startedAt);
}

/* ──────────────────────────────────────────────────────────────────────────
 * 11 · PU-12 — AI usage by area
 * ────────────────────────────────────────────────────────────────────────── */

/** How well a figure is known. Four different facts, never blurred. */
export type Accuracy = 'exact' | 'estimated' | 'not measured' | 'no record';

export interface AiAreaRow {
  area: string;
  volume: number | null;
  volumeUnit: string;
  detail: string;
  /** Labelled "Concierge job cost" wherever it appears, never "AI cost". */
  costUsd: number | null;
  accuracy: Accuracy;
  note: string;
}

/**
 * PU-12 · Where the AI work happened, and how well each figure is known.
 *
 * The accuracy column is mandatory. Without it this table is four numbers that
 * look equally solid, and one of them is a character count divided by four.
 */
export function aiUsageByArea(p: Period, scope: Scope): AiAreaRow[] {
  const chat = CHAT_QUESTIONS.filter(q => within(q.askedAt, p) && inScope(scope, q.team, q.userEmail));
  const jobs = CONCIERGE_JOBS.filter(j => within(j.startedAt, p) && inScope(scope, j.team, j.userEmail));
  const sop = SOP_RACM_JOBS.filter(j => within(j.startedAt, p) && inScope(scope, j.team, j.userEmail));
  const runs = runsIn(p, scope);
  const cached = sop.filter(j => j.cached).length;

  return [
    {
      area: 'Chat',
      volume: chat.length,
      volumeUnit: 'questions',
      detail: `${fmtInt(chat.reduce((s, q) => s + q.steps, 0))} assistant steps · ` +
        `${fmtInt(chat.reduce((s, q) => s + q.tokensIn + q.tokensOut, 0))} tokens`,
      costUsd: null,
      accuracy: 'estimated',
      note: 'Token usage is counted by dividing text length by four. It was built to stop runaway conversations, not to bill.',
    },
    {
      area: 'Concierge tools',
      volume: jobs.length,
      volumeUnit: 'jobs',
      detail: `${jobs.filter(j => j.status === 'completed').length} completed`,
      costUsd: jobs.reduce((s, j) => s + j.costUsd, 0),
      accuracy: 'exact',
      note: 'The only place in the product that records what a job actually cost.',
    },
    {
      area: 'SOP to RACM',
      volume: sop.length,
      volumeUnit: 'jobs',
      detail: cached > 0 ? `${cached} of them skipped the AI entirely` : 'None hit the cache',
      costUsd: null,
      accuracy: 'not measured',
      note: 'Records nothing about what it consumed, and a cached job is nearly free, so counting jobs says nothing about spend.',
    },
    {
      area: 'Workflows',
      volume: runs.length,
      volumeUnit: 'runs',
      detail: `${runs.filter(r => r.status === 'complete').length} completed`,
      costUsd: null,
      accuracy: 'not measured',
      note: 'A run records its duration and rows, but nothing about the model behind it.',
    },
    {
      area: 'Everywhere else',
      volume: null,
      volumeUnit: '',
      detail: 'Dashboards, insights, extraction',
      costUsd: null,
      accuracy: 'no record',
      note: 'These write no usage record at all, so there is nothing to count. This is not zero.',
    },
  ];
}

/* ──────────────────────────────────────────────────────────────────────────
 * 12 · PU-13 — per person, and never ranked
 * ────────────────────────────────────────────────────────────────────────── */

export interface PersonRow { name: string; runs: number; exceptions: number; waiting: number }

/**
 * PU-13 · The team, alphabetically, with the sort fixed.
 *
 * No share of the team's work, no rank, no average, and no numeric column that
 * can be sorted by click or by URL. A person with no runs still appears, which
 * is the difference between a team list and a leaderboard.
 */
export function perPersonOutcomes(p: Period, team: string, users: AdminUser[]): PersonRow[] {
  const members = users.filter(u => u.team === team);
  const runs = RUNS.filter(r => within(r.completedAt ?? r.startedAt, p) && r.team === team);
  const exceptions = TRACED_EXCEPTIONS.filter(t => within(t.openedAt, p));

  return members
    .map(u => ({
      name: u.name,
      runs: runs.filter(r => r.userEmail === u.email).length,
      exceptions: exceptions.filter(t => t.userEmail === u.email).length,
      waiting: exceptions.filter(t => t.exception.assignee === u.name && t.exception.status !== 'Resolved').length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/* ──────────────────────────────────────────────────────────────────────────
 * 13 · PU-14 — what is waiting on the reader
 * ────────────────────────────────────────────────────────────────────────── */

export interface QueueItem {
  id: string;
  kind: 'Exception' | 'Memory approval' | 'Memory review';
  title: string;
  detail: string;
  ageDays: number;
  /** Where one click has to land. */
  target: { view: string; id: string };
  overdue: boolean;
}

/**
 * PU-14 · The reader's own open items, overdue first.
 *
 * Every item reaches the thing that needs doing in one click. An item that
 * cannot be opened does not belong in a queue — it is a notification, and this
 * page does not notify.
 */
export function myQueue(userName: string, canApprove = false): QueueItem[] {
  const mine = TRACED_EXCEPTIONS.filter(
    t => t.exception.assignee === userName && t.exception.status !== 'Resolved',
  );

  const items: QueueItem[] = mine.map(t => {
    const ageDays = Math.max(0, Math.round((ANCHOR - t.openedAt) / DAY_MS));
    return {
      id: t.exception.id,
      kind: 'Exception',
      title: t.exception.title,
      detail: `${t.exception.ref} · ${t.exception.severity} · from ${t.exception.workflowName}`,
      ageDays,
      target: { view: 'manage-exceptions', id: t.exception.id },
      // Seven days is when an open exception stops being fresh work and starts
      // being a thing somebody forgot.
      overdue: ageDays >= 7,
    };
  });

  // A proposal waiting on somebody else is not this reader's queue. Only
  // somebody who can actually decide it sees it here.
  if (canApprove) {
    for (const m of pendingMemories()) {
      items.push({
        id: m.id,
        kind: 'Memory approval',
        title: m.statement,
        detail: m.pendingNote ?? 'Waiting for a decision before the assistant uses it',
        ageDays: 0,
        target: { view: 'my-queue', id: m.id },
        overdue: false,
      });
    }
  }

  // Their own memories that have reached their review date. This is the one
  // memory item an auditor can act on alone.
  for (const m of liveMemories()) {
    if (!m.renewDue || String(m.scope) !== 'personal') continue;
    items.push({
      id: m.id,
      kind: 'Memory review',
      title: m.statement,
      detail: `Reached its review date${m.reviewBy ? ` on ${m.reviewBy}` : ''}`,
      ageDays: 0,
      target: { view: 'my-queue', id: m.id },
      overdue: false,
    });
  }

  return items.sort((a, b) => Number(b.overdue) - Number(a.overdue) || b.ageDays - a.ageDays);
}

/* ──────────────────────────────────────────────────────────────────────────
 * 14 · PU-21 — what was created this period
 * ────────────────────────────────────────────────────────────────────────── */

export interface CreatedArea {
  key: string;
  label: string;
  count: number;
  /** The records behind the count: what was made, by whom, when. */
  items: { name: string; madeBy: string | null; at: number }[];
}

/**
 * The five areas, and the record each one's creations are counted from.
 *
 * These areas write no usage event, so nothing here can say how often something
 * was opened, edited or reviewed. What every one of them does stamp is who made
 * the record and when, and that is enough to answer "how many were created in
 * this window" today, backwards through the whole history, with no new
 * plumbing. One pattern, five areas.
 */
const CREATED_AREAS: { key: string; label: string; module: string }[] = [
  { key: 'engagements', label: 'Engagements', module: 'Engagements' },
  // The spec's "audits" — in this product an audit is scheduled in Audit
  // Planning and then run as an engagement, so the two are counted apart
  // rather than one standing in for the other.
  { key: 'audits', label: 'Audit plans', module: 'Audit Planning' },
  { key: 'racms', label: 'RACMs', module: 'RACM' },
  { key: 'controls', label: 'Controls', module: 'Control Library' },
  { key: 'dashboards', label: 'Dashboards', module: 'Dashboard' },
  { key: 'reports', label: 'Reports', module: 'Report' },
];

/** "2026-04-19 11:05:37" — the creation stamp, read as UTC like every other date here. */
const parseStamp = (value: string): number => Date.parse(`${value.replace(' ', 'T')}Z`);

/**
 * PU-21 · Created this period.
 *
 * Counts, never activity. The caption says created because that is all this can
 * honestly claim: a record that was made once and never touched again counts
 * exactly the same as one somebody works in daily.
 *
 * A quiet window returns zeros, and they are real zeros. This block never falls
 * back to the "we do not measure this" empty state, because the creation stamp
 * is measured.
 */
export function createdThisPeriod(p: Period, scope: Scope, logs: AuditLog[], users: AdminUser[]): CreatedArea[] {
  const teamOf = new Map(users.map(u => [u.name, u.team]));
  const mine = logs.filter(l => {
    if (l.action !== 'Create' || l.status !== 'Success') return false;
    const at = parseStamp(l.timestamp);
    if (Number.isNaN(at) || at < p.from || at > p.to) return false;
    if (scope.persona === 'cfo') return true;
    if (scope.persona === 'head_of_team') return !scope.team || teamOf.get(l.user) === scope.team;
    return false; // never on the auditor view: a personal creation count is a tally of somebody
  });

  return CREATED_AREAS.map(a => {
    const rows = mine.filter(l => l.module === a.module);
    return {
      key: a.key,
      label: a.label,
      count: rows.length,
      // A count with no list behind it cannot be checked, so every area names
      // what it counted, newest first, and never sorts by the person.
      items: rows
        .map(l => ({ name: namedThing(l.description), madeBy: l.user, at: parseStamp(l.timestamp) }))
        .sort((x, z) => z.at - x.at),
    };
  });
}

/* ──────────────────────────────────────────────────────────────────────────
 * 15 · PU-20 — Smart Learn, memory in use
 * ────────────────────────────────────────────────────────────────────────── */

export interface SmartLearnResult {
  /** False when nothing has been learned for this scope. Not four zeros. */
  hasData: boolean;
  active: number;
  pending: number;
  dueReview: number;
  recalls7d: number;
  /** The proposals this reader may decide. Empty for anybody who may not. */
  proposals: PlatformMemory[];
}

/**
 * PU-20 · The four numbers the Smart Learn screen already computes, scoped.
 *
 * Recall count and last-recalled are real fields written on every use, so
 * "how often is learned knowledge actually being used" is measured rather than
 * inferred. Proposals come back only for somebody who may actually decide them,
 * so a reader who cannot approve never sees a queue that is not theirs.
 */
export function smartLearn(scope: Scope): SmartLearnResult {
  const wanted = scope.persona === 'auditor'
    ? new Set(['personal'])
    : scope.persona === 'head_of_team'
      ? new Set(['personal', 'team', 'engagement'])
      : new Set(['personal', 'team', 'engagement', 'source', 'company', 'org', 'global']);

  const live = liveMemories().filter(m => wanted.has(String(m.scope)));
  const pending = pendingMemories().filter(m => wanted.has(String(m.scope)));
  const canApprove = scope.persona !== 'auditor';

  const recalls7d = live.filter(m => {
    const t = Date.parse(m.lastRecalled);
    if (Number.isNaN(t)) return /hour|today|day/i.test(m.lastRecalled);
    return ANCHOR - t <= 7 * DAY_MS;
  }).length;

  return {
    hasData: live.length > 0 || pending.length > 0,
    active: live.filter(m => m.status === 'active').length,
    pending: canApprove ? pending.length : 0,
    dueReview: live.filter(m => m.renewDue).length,
    recalls7d,
    proposals: canApprove ? pending : [],
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * 16 · PU-22 — dashboards, widgets and the alerts they fire
 * ────────────────────────────────────────────────────────────────────────── */

/** One made thing, and who made it. Sorted by date, never by person. */
export interface MakerRow { name: string; madeBy: string | null; at: number }

export interface ProductActivity {
  dashboardsCreated: number;
  dashboardsChanged: number;
  /** Live rows right now, the context under a count of new ones. */
  dashboardsTotal: number;
  alertsFired: number;
  /** Of those fires, how many the scheduled worker did with nobody watching. */
  automaticFires: number;
  alertRules: number;
  /** The list behind "dashboards built" — every count on this page opens one. */
  makers: MakerRow[];
  fires: { widget: string; dashboard: string; condition: string; at: number; firedBy: string | null }[];
}

/** `Created dashboard "P2P Spend"` → `P2P Spend`. The log's own wording. */
const namedThing = (description: string): string => {
  const quoted = /"([^"]+)"/.exec(description);
  if (quoted) return quoted[1];
  return description.replace(/^(Created|Rearranged|Shared|Exported)\s+/i, '').replace(/\s+dashboard.*$/i, '');
};

/**
 * PU-22 · What was built on the product, and what fired by itself.
 *
 * Dashboards and widgets write a before-and-after event on every change, so
 * these counts are read off the product's own event log rather than inferred
 * from the dashboards that happen to survive today. Alert fires sit in the same
 * family with one difference the page never hides: a scheduled worker wrote
 * most of them, with no person involved, and those rows say automatic.
 */
export function productActivity(p: Period, scope: Scope, logs: AuditLog[], users: AdminUser[]): ProductActivity {
  const teamOf = new Map(users.map(u => [u.name, u.team]));
  const mine = (l: AuditLog): boolean => {
    if (l.module !== 'Dashboard' || l.status !== 'Success') return false;
    const at = parseStamp(l.timestamp);
    if (Number.isNaN(at) || at < p.from || at > p.to) return false;
    if (scope.persona === 'cfo') return true;
    if (scope.persona === 'head_of_team') return !scope.team || teamOf.get(l.user) === scope.team;
    return false; // the auditor view never reports on the workspace at large
  };

  const events = logs.filter(mine);
  const created = events.filter(l => l.action === 'Create');
  const fires = ALERT_FIRES.filter(f => {
    if (f.at < p.from || f.at > p.to) return false;
    if (scope.persona === 'cfo') return true;
    // A worker fire belongs to no team, so a team lens counts only the ones
    // somebody on the team tripped by hand.
    if (scope.persona === 'head_of_team') return !scope.team || f.team === scope.team;
    return false;
  });

  return {
    dashboardsCreated: created.length,
    dashboardsChanged: events.filter(l => l.action === 'Update' || l.action === 'Share').length,
    dashboardsTotal: DASHBOARD_TOTAL,
    alertsFired: fires.length,
    automaticFires: fires.filter(f => f.firedBy === null).length,
    alertRules: ALERT_RULE_TOTAL,
    makers: created
      .map(l => ({ name: namedThing(l.description), madeBy: l.user, at: parseStamp(l.timestamp) }))
      .sort((a, z) => z.at - a.at),
    fires: fires
      .map(f => ({ widget: f.widgetName, dashboard: f.dashboardName, condition: f.condition, at: f.at, firedBy: f.firedBy }))
      .sort((a, z) => z.at - a.at),
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * 17 · PU-23 — reports made, worked on, shared
 * ────────────────────────────────────────────────────────────────────────── */

export interface ReportsActivity {
  made: number;
  /** Every recorded action on a report, of which making one is a single kind. */
  activity: number;
  shared: number;
  byActivity: { label: string; count: number }[];
  /** Action plans on issued reports. A live state, not a count for the window. */
  actionPlansOpen: number;
  actionPlansClosed: number;
  list: MakerRow[];
}

const ACTIVITY_LABEL: Record<string, string> = {
  Create: 'made',
  Update: 'edited',
  Export: 'downloaded',
  Share: 'shared',
  Delete: 'deleted',
};

/**
 * PU-23 · Reports.
 *
 * A report edited fifty times is one report and fifty activities, so the two
 * numbers sit side by side and are never added together. The action-plan counts
 * are deliberately not period-filtered: an action plan is open or it is closed
 * right now, and pretending that state belongs to a window would be the kind of
 * number that changes when the period selector moves for no reason a reader
 * could explain.
 */
export function reportsActivity(p: Period, scope: Scope, logs: AuditLog[], users: AdminUser[]): ReportsActivity {
  const teamOf = new Map(users.map(u => [u.name, u.team]));
  const events = logs.filter(l => {
    if (l.module !== 'Report' || l.status !== 'Success') return false;
    const at = parseStamp(l.timestamp);
    if (Number.isNaN(at) || at < p.from || at > p.to) return false;
    if (scope.persona === 'cfo') return true;
    if (scope.persona === 'head_of_team') return !scope.team || teamOf.get(l.user) === scope.team;
    return false; // reports are a workspace fact, not a personal one
  });

  const made = events.filter(l => l.action === 'Create');
  const byAction = new Map<string, number>();
  events.forEach(l => byAction.set(l.action, (byAction.get(l.action) ?? 0) + 1));

  // The action plans on every issued report, by status. Implemented is closed;
  // anything else is still somebody's to do.
  let open = 0;
  let closed = 0;
  ATR_LIBRARY.forEach(r =>
    r.atrData.observations.forEach(o =>
      o.actionPlans.forEach(a => {
        if (a.status === 'Implemented') closed += 1;
        else open += 1;
      }),
    ),
  );

  return {
    made: made.length,
    activity: events.length,
    shared: events.filter(l => l.action === 'Share').length,
    byActivity: [...byAction.entries()]
      .map(([action, count]) => ({ label: ACTIVITY_LABEL[action] ?? action.toLowerCase(), count }))
      .sort((a, z) => z.count - a.count),
    actionPlansOpen: open,
    actionPlansClosed: closed,
    list: made
      .map(l => ({ name: namedThing(l.description) || l.description.replace(/^Created\s+/, ''), madeBy: l.user, at: parseStamp(l.timestamp) }))
      .sort((a, z) => z.at - a.at),
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * 18 · PU-24 — sampling, and how the validations ended
 * ────────────────────────────────────────────────────────────────────────── */

export interface SamplingResult {
  total: number;
  passed: number;
  failed: number;
  /** Not a finding. The check could not be completed and needs a person. */
  errored: number;
  inFlight: number;
  /** Passed as a share of the validations that actually landed. */
  passRate: number | null;
  /** One row per engagement and control, which is how the testing actually ran. */
  byControl: { control: string; engagement: string; passed: number; failed: number; errored: number }[];
  errors: { control: string; engagement: string; note: string; at: number }[];
}

/**
 * PU-24 · Sample validation runs.
 *
 * Failed and errored are held apart everywhere, including in the type. A failed
 * validation says the control did not hold. An errored one says nothing about
 * the control at all — the evidence would not open, or the sample came back
 * short — and counting it as a failure invents a deficiency that nobody found.
 */
export function sampling(p: Period, scope: Scope): SamplingResult {
  const rows = SAMPLE_RUNS.filter(s => s.at >= p.from && s.at <= p.to && inScope(scope, s.team, s.userEmail));

  const count = (status: SampleRunStatus): number => rows.filter(s => s.status === status).length;
  const passed = count('passed');
  const failed = count('failed');
  const errored = count('error');
  const landed = passed + failed;

  // Keyed by engagement and control together: the same control tested under two
  // engagements is two pieces of testing, and merging them hides which audit the
  // failures belong to.
  const byControl = new Map<string, { control: string; engagement: string; passed: number; failed: number; errored: number }>();
  rows.forEach(s => {
    const key = `${s.engagementId}::${s.controlId}`;
    const bucket = byControl.get(key)
      ?? { control: s.controlName, engagement: s.engagementName, passed: 0, failed: 0, errored: 0 };
    if (s.status === 'passed') bucket.passed += 1;
    if (s.status === 'failed') bucket.failed += 1;
    if (s.status === 'error') bucket.errored += 1;
    byControl.set(key, bucket);
  });

  return {
    total: rows.length,
    passed,
    failed,
    errored,
    inFlight: count('queued') + count('running'),
    passRate: landed === 0 ? null : (passed * 100) / landed,
    byControl: [...byControl.values()]
      .filter(r => r.passed + r.failed + r.errored > 0)
      .sort((a, z) => z.failed + z.errored - (a.failed + a.errored) || a.control.localeCompare(z.control)),
    errors: rows
      .filter(s => s.status === 'error' && s.note)
      .map(s => ({ control: s.controlName, engagement: s.engagementName, note: s.note as string, at: s.at }))
      .sort((a, z) => z.at - a.at),
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * 19 · PU-25 — the insights the assistant generated
 * ────────────────────────────────────────────────────────────────────────── */

export interface InsightsResult {
  /** Per-run insights. The consolidated ones are counted separately on purpose. */
  perRun: number;
  consolidated: number;
  bySeverity: { severity: Severity; perRun: number; consolidated: number }[];
  byCategory: { label: string; count: number }[];
  rows: { title: string; severity: Severity; category: string; engagement: string; kind: string; at: number }[];
}

/**
 * PU-25 · Generated insights, split by kind.
 *
 * A consolidated insight is the assistant's reading of a whole engagement, and
 * it summarises per-run insights that are already counted. The two are returned
 * as separate figures and there is no field holding their sum, so no caller can
 * accidentally report the same finding twice.
 */
export function insights(p: Period, scope: Scope): InsightsResult {
  const rows = INSIGHT_ROWS.filter(i => {
    if (i.at < p.from || i.at > p.to) return false;
    if (scope.persona === 'cfo') return true;
    if (scope.persona === 'head_of_team') return !scope.team || i.team === scope.team;
    return Boolean(scope.userEmail) && i.userEmail === scope.userEmail;
  });

  const byCategory = new Map<string, number>();
  rows.forEach(i => byCategory.set(i.category, (byCategory.get(i.category) ?? 0) + 1));

  return {
    perRun: rows.filter(i => i.kind === 'per_run').length,
    consolidated: rows.filter(i => i.kind === 'consolidated').length,
    bySeverity: SEVERITIES.map(severity => ({
      severity,
      perRun: rows.filter(i => i.severity === severity && i.kind === 'per_run').length,
      consolidated: rows.filter(i => i.severity === severity && i.kind === 'consolidated').length,
    })),
    byCategory: [...byCategory.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, z) => z.count - a.count),
    rows: rows
      .slice()
      .sort((a, z) => z.at - a.at)
      .map(i => ({
        title: i.title,
        severity: i.severity,
        category: i.category,
        engagement: i.engagementName,
        kind: i.kind === 'per_run' ? 'from one run' : 'across the engagement',
        at: i.at,
      })),
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * 20 · PU-26 — the risk picture, and what nothing covers
 * ────────────────────────────────────────────────────────────────────────── */

export interface RiskPicture {
  total: number;
  byPriority: { label: string; count: number }[];
  byCategory: { label: string; count: number }[];
  mapped: number;
  unmapped: number;
  /** The number a CFO acts on: critical or high, and no control covers it. */
  unmappedSevere: number;
  unmappedList: { id: string; name: string; priority: string; category: string; owner: string }[];
  createdInPeriod: number;
  /** True when the scope could only be honoured through the risk's owner. */
  ownerScoped: boolean;
}

const RISK_PRIORITIES = ['Critical', 'High', 'Medium', 'Low'] as const;

/**
 * PU-26 · Risks recorded, prioritised, and covered by nothing.
 *
 * A risk is mapped when some control in the library names it, so the mapping is
 * read off the controls rather than kept as a second number that can drift. The
 * hero figure is the audit gap: critical or high, and nothing tests it.
 *
 * The register records who owns a risk, not which team it belongs to, so a team
 * lens can only reach the risks owned by somebody on that team. That limit is
 * returned rather than hidden, because a team reading zero needs to know whether
 * it means "none of ours" or "we cannot tell".
 */
export function riskPicture(p: Period, scope: Scope): RiskPicture {
  const mine = SEED_RISKS.filter(r => {
    if (r.status === 'Archived') return false;
    if (scope.persona === 'cfo') return true;
    if (scope.persona === 'head_of_team') return !scope.team || teamOfName(r.owner) === scope.team;
    return false; // an auditor is shown their own work, not the whole register
  });

  const mappedRiskIds = new Set(CONTROL_LIBRARY.flatMap(c => c.mappedRisks ?? []));
  const unmapped = mine.filter(r => !mappedRiskIds.has(r.id));

  const byCategory = new Map<string, number>();
  mine.forEach(r => byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + 1));

  return {
    total: mine.length,
    byPriority: RISK_PRIORITIES.map(label => ({ label, count: mine.filter(r => r.priority === label).length })),
    byCategory: [...byCategory.entries()].map(([label, count]) => ({ label, count })).sort((a, z) => z.count - a.count),
    mapped: mine.length - unmapped.length,
    unmapped: unmapped.length,
    unmappedSevere: unmapped.filter(r => r.priority === 'Critical' || r.priority === 'High').length,
    unmappedList: unmapped
      .map(r => ({ id: r.id, name: r.name, priority: r.priority, category: r.category, owner: r.owner }))
      .sort((a, z) => RISK_PRIORITIES.indexOf(a.priority as 'Critical') - RISK_PRIORITIES.indexOf(z.priority as 'Critical')),
    createdInPeriod: mine.filter(r => {
      const at = parseLibraryDate(r.createdAt);
      return at >= p.from && at <= p.to;
    }).length,
    ownerScoped: scope.persona === 'head_of_team',
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * 21 · PU-27 — the engagement portfolio and its motion
 * ────────────────────────────────────────────────────────────────────────── */

export interface EngagementStripRow {
  id: string;
  name: string;
  owner: string;
  reviewer: string | null;
  controlsTested: number;
  controlsTotal: number;
  exceptionsOpen: number;
  actionPlansOpen: number;
  /** none, draft or final — where the writing up has got to. */
  report: 'none' | 'draft' | 'final';
  periodEnd: string;
  /** Days past the end of the audit period, still open. */
  daysOver: number | null;
}

export interface PortfolioResult {
  total: number;
  byStatus: { label: string; count: number }[];
  slipping: { name: string; owner: string; periodEnd: string; daysOver: number }[];
  strip: EngagementStripRow[];
  /** Recorded changes on engagements inside the window. */
  changes: number;
}

/** "2026-03-31" → ms, end of that day. */
const parseIsoDay = (value: string | undefined): number | null => {
  if (!value) return null;
  const t = Date.parse(`${value}T23:59:59Z`);
  return Number.isNaN(t) ? null : t;
};

/**
 * PU-27 · The portfolio, and where each engagement has got to.
 *
 * The strip is one row per engagement that is still open, sorted by the end of
 * its audit period so the soonest sits at the top. Sorting by a date rather
 * than by an owner is deliberate: a portfolio sorted by person is a league
 * table of people, which this page does not do.
 *
 * Slipping is the plainest honest reading available: the audit period has ended
 * and the engagement is still open.
 */
export function portfolio(p: Period, scope: Scope, logs: AuditLog[], users: AdminUser[]): PortfolioResult {
  const teamOf = new Map(users.map(u => [u.name, u.team]));
  const mine = ENGAGEMENTS.filter(e => {
    if (scope.persona === 'cfo') return true;
    if (scope.persona === 'head_of_team') return !scope.team || teamOfName(e.owner) === scope.team;
    return false;
  });

  const openStatuses = new Set(['Active', 'In Progress', 'Review', 'Planned', 'Draft']);
  const byStatus = new Map<string, number>();
  mine.forEach(e => byStatus.set(e.status, (byStatus.get(e.status) ?? 0) + 1));

  const daysOverOf = (e: (typeof ENGAGEMENTS)[number]): number | null => {
    const end = parseIsoDay(e.endDate);
    if (end === null || !openStatuses.has(e.status)) return null;
    const over = Math.floor((ANCHOR - end) / DAY_MS);
    return over > 0 ? over : null;
  };

  // Writing up: an issued report covering the engagement's process is the
  // furthest state the record can prove. No report for the process reads as
  // none, never as late.
  const reportedProcesses = new Set(
    ATR_LIBRARY.map(r => ATR_AREA_PROCESS[r.area] ?? '').filter(Boolean),
  );

  const strip: EngagementStripRow[] = mine
    .filter(e => openStatuses.has(e.status))
    .map(e => {
      const samples = SAMPLE_RUNS.filter(s => s.engagementId === e.id && s.status !== 'queued' && s.status !== 'running');
      const exceptions = ENGAGEMENT_EXCEPTIONS.filter(x => x.engagementId === e.id);
      return {
        id: e.id,
        name: e.name,
        owner: e.owner,
        reviewer: e.team?.reviewer ?? null,
        controlsTested: new Set(samples.map(s => s.controlId)).size,
        controlsTotal: e.controls,
        exceptionsOpen: exceptions.filter(x => x.status === 'Open').length,
        actionPlansOpen: exceptions.filter(x => x.status === 'Triaging').length,
        report: (reportedProcesses.has(e.process) ? 'final' : 'none') as EngagementStripRow['report'],
        periodEnd: e.periodEnd,
        daysOver: daysOverOf(e),
      };
    })
    .sort((a, z) => (parseIsoDay(ENGAGEMENTS.find(e => e.id === a.id)?.endDate) ?? 0)
      - (parseIsoDay(ENGAGEMENTS.find(e => e.id === z.id)?.endDate) ?? 0));

  const changes = logs.filter(l => {
    if (l.module !== 'Engagements' && l.module !== 'Engagement Execution') return false;
    const at = parseStamp(l.timestamp);
    if (Number.isNaN(at) || at < p.from || at > p.to) return false;
    if (scope.persona === 'cfo') return true;
    if (scope.persona === 'head_of_team') return !scope.team || teamOf.get(l.user) === scope.team;
    return false;
  }).length;

  return {
    total: mine.length,
    byStatus: [...byStatus.entries()].map(([label, count]) => ({ label, count })).sort((a, z) => z.count - a.count),
    slipping: mine
      .map(e => ({ name: e.name, owner: e.owner, periodEnd: e.periodEnd, daysOver: daysOverOf(e) }))
      .filter((e): e is { name: string; owner: string; periodEnd: string; daysOver: number } => e.daysOver !== null)
      .sort((a, z) => z.daysOver - a.daysOver),
    strip,
    changes,
  };
}

/** Which process an issued report's audit area belongs to. */
const ATR_AREA_PROCESS: Record<string, string> = {
  'Procure-to-Pay': 'P2P',
  'Order-to-Cash': 'O2C',
  'IT General Controls': 'ITGC',
  'Record-to-Report': 'R2R',
  'Source-to-Contract': 'S2C',
};

/* ──────────────────────────────────────────────────────────────────────────
 * 22 · PU-28 — continuous monitoring, and whether it is holding
 * ────────────────────────────────────────────────────────────────────────── */

export interface CcmRow {
  engagementId: string;
  engagement: string;
  cadence: string;
  threshold: number;
  /** Null when nothing landed in the window, so there is no rate to compare. */
  actual: number | null;
  sampleN: number;
  approvals: string;
  /** Exceptions sitting in an approval gate right now, waiting on a person. */
  inGate: number;
}

export interface CcmResult {
  engagementsOn: number;
  engagementsTotal: number;
  sharePct: number;
  rows: CcmRow[];
  /** Bulk executions in the window, the other thing automation does at scale. */
  bulkRuns: number;
}

/**
 * PU-28 · Continuous monitoring.
 *
 * The threshold each engagement expects, against the pass rate it actually
 * managed, computed from the same sample validations as PU-24 rather than from
 * a second calculation that could disagree with the block above it.
 */
export function ccm(p: Period, scope: Scope): CcmResult {
  const mine = ENGAGEMENT_AUTOMATION.filter(a => {
    if (scope.persona === 'cfo') return true;
    if (scope.persona === 'head_of_team') return !scope.team || a.team === scope.team;
    return false;
  });

  const on = mine.filter(a => a.isCcm);

  const rows: CcmRow[] = on.map(a => {
    const samples = SAMPLE_RUNS.filter(s =>
      s.engagementId === a.engagementId && s.at >= p.from && s.at <= p.to
      && (s.status === 'passed' || s.status === 'failed'));
    const passed = samples.filter(s => s.status === 'passed').length;
    return {
      engagementId: a.engagementId,
      engagement: a.engagementName,
      cadence: a.cadence,
      threshold: a.passRateThreshold,
      actual: samples.length === 0 ? null : (passed * 100) / samples.length,
      sampleN: samples.length,
      approvals: `${a.approvalLevelsRiskOwner} risk owner and ${a.approvalLevelsAuditor} auditor approvals`,
      // Being classified is what moving through a gate looks like in the record.
      inGate: ENGAGEMENT_EXCEPTIONS.filter(x => x.engagementId === a.engagementId && x.status === 'Triaging').length,
    };
  }).sort((a, z) => (a.actual ?? 999) - (z.actual ?? 999));

  const bulkRuns = new Set(
    RUNS.filter(r => r.bulkRunId && (r.completedAt ?? r.startedAt) >= p.from && (r.completedAt ?? r.startedAt) <= p.to
      && inScope(scope, r.team, r.userEmail))
      .map(r => r.bulkRunId),
  ).size;

  return {
    engagementsOn: on.length,
    engagementsTotal: mine.length,
    sharePct: mine.length === 0 ? 0 : (on.length * 100) / mine.length,
    rows,
    bulkRuns,
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * 23 · Needs your attention
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * The page answers before it asks.
 *
 * At most three cards, each a sentence with one thing to do. They are not
 * alerts: nothing is sent anywhere, nothing has a threshold anybody configures,
 * and every card is a fact already on the page said early because acting on it
 * cannot wait for a scroll. When there is nothing, the strip says so once and
 * disappears rather than sitting there empty.
 */
export type AttentionTarget =
  | 'risks' | 'stuck' | 'invoice' | 'queue' | 'controls' | 'sampling' | 'memory' | 'engagements';

export interface AttentionCard {
  id: string;
  /** One sentence, said the way a person would say it. */
  text: string;
  actionLabel: string;
  target: AttentionTarget;
}

/** Everything the strip reads. All of it is already computed for the page. */
export interface AttentionInput {
  risks: RiskPicture;
  stuck: StuckRun[];
  never: NeverExercised;
  sampling: SamplingResult;
  memory: SmartLearnResult;
  queue: QueueItem[];
  ledger: InvoiceLedger;
  portfolio: PortfolioResult;
  canEnterInvoices: boolean;
}

const AT_MOST = 3;

export function attentionCards(persona: Persona, x: AttentionInput): AttentionCard[] {
  const cards: AttentionCard[] = [];

  /** The same workflow, stuck more than once, with one error between them. */
  const repeated = (() => {
    const groups = new Map<string, { name: string; error: string; n: number }>();
    x.stuck.forEach(r => {
      const key = `${r.workflowName}|${r.error}`;
      const found = groups.get(key);
      if (found) found.n += 1;
      else groups.set(key, { name: r.workflowName, error: r.error, n: 1 });
    });
    return Array.from(groups.values()).filter(g => g.n > 1).sort((a, z) => z.n - a.n)[0] ?? null;
  })();

  const uncovered = (): AttentionCard | null =>
    x.risks.unmappedSevere > 0
      ? {
          id: 'risks',
          text: `${plural(x.risks.unmappedSevere, 'critical or high risk has', 'critical and high risks have')} no control covering ${x.risks.unmappedSevere === 1 ? 'it' : 'them'}.`,
          actionLabel: 'See them',
          target: 'risks',
        }
      : null;

  const stuckCard = (): AttentionCard | null => {
    if (repeated) {
      return {
        id: 'stuck-repeat',
        text: `${repeated.name} has failed ${repeated.n} times with the same error.`,
        actionLabel: 'Open it',
        target: 'stuck',
      };
    }
    return x.stuck.length > 0
      ? {
          id: 'stuck',
          text: `${plural(x.stuck.length, 'run is', 'runs are')} stuck and nothing is moving ${x.stuck.length === 1 ? 'it' : 'them'} on.`,
          actionLabel: 'Open them',
          target: 'stuck',
        }
      : null;
  };

  const bill = (): AttentionCard | null => {
    const month = x.ledger.missing[0];
    if (!month || !x.canEnterInvoices) return null;
    return {
      id: 'invoice',
      text: `${month.label} has ${plural(month.recordedCalls, 'recorded call', 'recorded calls')} and no bill entered yet.`,
      actionLabel: 'Add it in Administration',
      target: 'invoice',
    };
  };

  const untested = (): AttentionCard | null =>
    x.never.controls.length > 0
      ? {
          id: 'controls',
          text: `${plural(x.never.controls.length, 'control has', 'controls have')} never been tested by anything, in the whole record.`,
          actionLabel: 'Name them',
          target: 'controls',
        }
      : null;

  const needsAPerson = (): AttentionCard | null =>
    x.sampling.errored > 0
      ? {
          id: 'sampling',
          text: `${plural(x.sampling.errored, 'validation', 'validations')} errored, so ${x.sampling.errored === 1 ? 'it says' : 'they say'} nothing about the control until somebody looks.`,
          actionLabel: 'See them',
          target: 'sampling',
        }
      : null;

  const proposals = (): AttentionCard | null =>
    x.memory.pending > 0
      ? {
          id: 'memory',
          text: `${plural(x.memory.pending, 'memory is', 'memories are')} waiting on you to approve or reject.`,
          actionLabel: 'Open Smart Learn',
          target: 'memory',
        }
      : null;

  const slipping = (): AttentionCard | null =>
    x.portfolio.slipping.length > 0
      ? {
          id: 'engagements',
          text: `${plural(x.portfolio.slipping.length, 'engagement is', 'engagements are')} still open after the audit period ended.`,
          actionLabel: 'See them',
          target: 'engagements',
        }
      : null;

  const overdue = x.queue.filter(i => i.overdue).length;
  const mine = (): AttentionCard | null => {
    if (overdue > 0) {
      return {
        id: 'queue-overdue',
        text: `${plural(overdue, 'thing has', 'things have')} been waiting on you a week or more.`,
        actionLabel: 'Open the oldest',
        target: 'queue',
      };
    }
    return x.queue.length > 0
      ? {
          id: 'queue',
          text: `${plural(x.queue.length, 'thing is', 'things are')} waiting on you.`,
          actionLabel: 'Open the queue',
          target: 'queue',
        }
      : null;
  };

  // Order is the priority: what a reader of this view should act on first.
  const order = persona === 'cfo'
    ? [uncovered, bill, untested, slipping]
    : persona === 'head_of_team'
      ? [stuckCard, needsAPerson, proposals, untested]
      : [mine, proposals];

  order.forEach(make => {
    if (cards.length >= AT_MOST) return;
    const card = make();
    if (card) cards.push(card);
  });

  return cards;
}

/* ──────────────────────────────────────────────────────────────────────────
 * 24 · Formatting
 * ────────────────────────────────────────────────────────────────────────── */

const INT = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const ONE_DP = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const fmtInt = (n: number): string => INT.format(Math.round(n));
export const fmtHours = (n: number): string => (n >= 1000 ? INT.format(Math.round(n)) : ONE_DP.format(n));
export const fmtPeople = (n: number): string => ONE_DP.format(n);

/**
 * A span of time, said the way a person would say it.
 *
 * "0.0 hours of machine time" reads as nothing happened. Under an hour this
 * says minutes, which is both true and legible.
 */
export function fmtDuration(hours: number): string {
  if (hours < 1) {
    const mins = Math.round(hours * 60);
    return mins <= 0 ? 'under a minute' : `${mins} ${mins === 1 ? 'minute' : 'minutes'}`;
  }
  return `${fmtHours(hours)} hours`;
}
export const fmtPct = (n: number): string => `${ONE_DP.format(n)}%`;

/** Rupees the way an Indian reader says them: lakh and crore, not millions. */
export function fmtMoney(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 10_000_000) return `₹${ONE_DP.format(n / 10_000_000)} crore`;
  if (abs >= 100_000) return `₹${ONE_DP.format(n / 100_000)} lakh`;
  return `₹${INT.format(Math.round(n))}`;
}

/** Dollars, for the one figure in the product that is billed in them. */
export const fmtUsd = (n: number): string =>
  `$${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;

export const plural = (n: number, one: string, many: string): string =>
  `${fmtInt(n)} ${n === 1 ? one : many}`;
