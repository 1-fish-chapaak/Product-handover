/**
 * The timings, and the constants that turn them into money.
 *
 * Usage and cost prices a turn off a rate card: tokens times the model's list
 * price. This file is the other rate card, pointing the other way: how long the
 * same piece of work takes a person, so the difference between that and what
 * the run took is the time the platform gave back.
 *
 * Three rules hold everywhere in here, and the page is worthless without them.
 *
 * 1. **A timing is measured or it is absent.** `minutes: null` means nobody has
 *    stood over that work with a stopwatch yet. It is never a guess, never a
 *    multiple of another band, and never zero. Work under an absent timing is
 *    counted and left unvalued, which is what makes every total on the page a
 *    floor rather than a claim.
 * 2. **Every rate is effective-dated.** A rate agreed today values today's work
 *    and does not rewrite last quarter's. `effectiveAt` picks the entry in force
 *    on the day the work happened, not the newest one.
 * 3. **Every rate carries who set it and when.** The tiles show that provenance
 *    behind the information icon, because a number whose source cannot be named
 *    is a number a CFO is right to throw out.
 */


/* ──────────────────────────────────────────────────────────────────────────
 * Effective dating
 * ────────────────────────────────────────────────────────────────────────── */

export interface Dated<T> {
  /** `YYYY-MM-DD`, the first day this value is in force. */
  from: string;
  value: T;
  /** CAPTURED from the session when somebody enters one. Null on the seeded
   *  examples below, and every surface that prints provenance has to say
   *  "example" for those rather than name a person who set nothing. A line a
   *  reader takes for a record, when nothing recorded it, is the most
   *  dangerous thing on the page. */
  setBy: string | null;
  /** CAPTURED from the clock. Null on a seeded example. Not the same as
   *  `from`: a rate agreed in March can take effect from January. */
  setOn: string | null;
  /** Where the number came from, in one line, printed beside it. */
  source: string;
}

/** The entry in force on a given day. `null` when the work predates the first
 *  entry, which values it at nothing rather than at the oldest rate we happen
 *  to hold. */
export function effectiveAt<T>(series: Dated<T>[], day: string): Dated<T> | null {
  let hit: Dated<T> | null = null;
  for (const entry of series) {
    if (entry.from <= day && (hit === null || entry.from > hit.from)) hit = entry;
  }
  return hit;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Constants
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * What an hour of an auditor's time is worth to this workspace.
 *
 * The internal charge-out rate the workspace already uses to cost its own
 * engagements, so it is their number rather than ours. Every hour on this page
 * is converted at the rate in force on the day the work ran.
 */
export const AUDITOR_HOUR_RATE: Dated<number>[] = [
  {
    from: '2024-04-01',
    value: 460,
    setBy: null,
    setOn: null,
    source: 'FY25 internal charge-out rate, finance',
  },
  {
    from: '2026-01-01',
    value: 500,
    setBy: null,
    setOn: null,
    source: 'FY26 internal charge-out rate, finance',
  },
];

/** What a rupee of model spend is, when the model is billed in dollars. Held
 *  beside the rate card it converts, and dated the same way. */
export const USD_TO_INR: Dated<number>[] = [
  {
    from: '2024-04-01',
    value: 83.1,
    setBy: null,
    setOn: null,
    source: 'Closing rate, RBI reference',
  },
  {
    from: '2026-01-01',
    value: 88.5,
    setBy: null,
    setOn: null,
    source: 'Closing rate, RBI reference',
  },
];

/** One auditor-month, in hours. 8 hours a day over 30 days: the shape a
 *  headcount conversation is actually had in, not a payroll calendar. */
export const HOURS_PER_DAY = 8;
export const DAYS_PER_MONTH = 30;
export const HOURS_PER_AUDITOR_MONTH = HOURS_PER_DAY * DAYS_PER_MONTH;

export const CAPACITY_BASIS = `${HOURS_PER_DAY} hours a day over ${DAYS_PER_MONTH} days, so ${HOURS_PER_AUDITOR_MONTH} hours is one auditor-month.`;

/* ──────────────────────────────────────────────────────────────────────────
 * How long the same work takes by hand
 * ────────────────────────────────────────────────────────────────────────── */

export interface ManualTiming {
  surface: string;
  /** THE NAMED THING this timing is attached to: a workflow id, a report id.
   *  Null where the kind genuinely has one job in it. Never a size: a timing
   *  belongs to a piece of work, and the size falls out of the minutes. */
  target: string | null;
  /** Minutes by hand. `null` = nobody has timed this one, which is not nought:
   *  it lands every run of it in the gap list, unpriced. */
  minutes: number | null;
  /** True where `minutes` is PER UNIT rather than per run, so nothing
   *  multiplies it by the wrong thing.
   *
   *  Where the work scales with a population, the by-hand time scales with it
   *  too: a run's by-hand time is the per-unit timing times the units that run
   *  covered. Controls drafted for an SOP to RACM, entities covered for a bulk
   *  run or a bulk report, one for everything else.
   *
   *  Without this, a run whose cost grows with the population is compared
   *  against a fixed saving, so the runs that save the most read as the ones
   *  that lose the most. */
  perUnit?: boolean;
  /** How many auditors a real sitting would need to watch before this replaces
   *  the estimate. Not a count of anybody timed: nobody has been. */
  sample: number | null;
  measuredBy: string | null;
  measuredOn: string | null;
  /** What was timed, in one line. This is what lets a reader judge whether the
   *  timing matches the work. */
  note: string;
}

/**
 * ONE ROW PER NAMED THING, never one per kind.
 *
 * A kind is not a job. Vendor master verification and a payroll exit check are
 * both workflow runs and nothing alike, so a single "workflow run" figure would
 * price them the same and put them in the same size. The timing therefore hangs
 * off the smallest thing the ledger can name, and size falls out per named
 * thing. **One kind landing in large, medium and small at once is the expected
 * result, not a fault.**
 *
 * **Never borrow a sibling's timing.** A workflow with no row here is unpriced,
 * and its runs go to the gap list. Averaging the other workflows to cover it is
 * exactly the estimate this page refuses, and it would hand the run a size
 * nobody measured.
 *
 * **Three of these have a trap, and getting it wrong inflates the number.**
 * · An SOP to RACM extraction is timed on producing the first DRAFT, not on
 *   finalising the matrix. The review afterwards is still the auditor's time.
 * · A report is timed on WRITING it, not on writing and reviewing it.
 * · An exception is timed on HANDLING it, never on finding it. The finding is
 *   already inside the workflow run that raised it.
 *
 * **Every figure here is an estimate.** Nobody has held a stopwatch, and the
 * page says so wherever it prints one.
 */
export const MANUAL_TIMINGS: ManualTiming[] = [
  /* ── Workflow runs, one per named workflow ─────────────────────────────── */
  {
    surface: 'workflow',
    target: 'wf-vendor-master',
    minutes: 210,
    sample: 5,
    measuredBy: null,
    measuredOn: null,
    note: 'A full vendor sweep: pull the population, look every row up in the registries, compare, write up what came out. Portal lookups included, so lookup minutes are never added on top.',
  },
  {
    surface: 'workflow',
    target: 'wf-related-party',
    minutes: 90,
    sample: 5,
    measuredBy: null,
    measuredOn: null,
    note: 'Screening the population against the related party list and chasing the matches down.',
  },
  {
    surface: 'workflow',
    target: 'wf-gst-recon',
    minutes: 20,
    sample: 5,
    measuredBy: null,
    measuredOn: null,
    note: 'Reconciling registrations against the return, one list against the other.',
  },
  {
    surface: 'workflow',
    target: 'wf-duplicate-payments',
    minutes: 11,
    sample: 5,
    measuredBy: null,
    measuredOn: null,
    note: 'Sorting the ledger and reading down it for the same amount paid twice.',
  },
  {
    surface: 'workflow',
    // Nobody has timed this one. Its runs are UNPRICED and sit in the gap list
    // rather than borrowing a figure from the workflows either side of it.
    target: 'wf-payroll-exits',
    minutes: null,
    sample: null,
    measuredBy: null,
    measuredOn: null,
    note: 'Not timed yet. Checking leavers off against the payroll run.',
  },

  /* ── Bulk runs, PER ENTITY, one per named workflow ─────────────────────
     A bulk run replaces running the test once per entity, so what it is
     measured against is the per-entity job and never the whole-sweep figure
     held above for the same workflow. The two are different jobs: pulling a
     population once is not the same as checking one row. */
  {
    surface: 'bulk',
    target: 'wf-vendor-master',
    minutes: 4,
    perUnit: true,
    sample: 5,
    measuredBy: null,
    measuredOn: null,
    note: 'MINUTES PER VENDOR, not per run. Looking one vendor up in the registries, comparing it and noting what came out. Portal lookups included, so lookup minutes are never added on top.',
  },
  {
    surface: 'bulk',
    target: 'wf-related-party',
    minutes: 2,
    perUnit: true,
    sample: 5,
    measuredBy: null,
    measuredOn: null,
    note: 'MINUTES PER PARTY, not per run. Screening one name against the related party list and chasing a match down.',
  },
  {
    surface: 'bulk',
    target: 'wf-gst-recon',
    minutes: 1,
    perUnit: true,
    sample: 5,
    measuredBy: null,
    measuredOn: null,
    note: 'MINUTES PER REGISTRATION, not per run. Reconciling one registration against the return, one list against the other.',
  },
  {
    surface: 'bulk',
    target: 'wf-duplicate-payments',
    minutes: 1,
    perUnit: true,
    sample: 5,
    measuredBy: null,
    measuredOn: null,
    note: 'MINUTES PER PAYMENT, not per run. Reading one payment against the rest of the ledger for the same amount paid twice.',
  },
  {
    surface: 'bulk',
    // Not timed, exactly as the whole-sweep figure above is not timed. Its
    // runs are UNPRICED and sit in the gap list.
    target: 'wf-payroll-exits',
    minutes: null,
    perUnit: true,
    sample: null,
    measuredBy: null,
    measuredOn: null,
    note: 'Not timed yet. Checking one leaver off against the payroll run.',
  },

  /* ── Reports, one per named report ─────────────────────────────────────── */
  {
    surface: 'report',
    target: 'rp-entity-pack',
    minutes: 120,
    perUnit: true,
    sample: 5,
    measuredBy: null,
    measuredOn: null,
    note: 'Writing the entity pack from work already done. WRITING only: the review that follows is still a person\u2019s time. A bulk pack is written once per entity by hand, which is why each entity counts on its own.',
  },
  {
    surface: 'report',
    target: 'rp-quarterly',
    minutes: 40,
    perUnit: true,
    sample: 5,
    measuredBy: null,
    measuredOn: null,
    note: 'Writing the quarterly control report from work already done. Writing only, not reviewing.',
  },
  {
    surface: 'report',
    target: 'rp-exception-summary',
    minutes: 6,
    perUnit: true,
    sample: 5,
    measuredBy: null,
    measuredOn: null,
    note: 'Writing up the exceptions that came out of a run as a short summary. Writing only, not reviewing.',
  },

  /* ── One job in them, so one figure each ───────────────────────────────── */
  {
    surface: 'sop_racm',
    target: null,
    minutes: 8,
    perUnit: true,
    sample: 5,
    measuredBy: null,
    measuredOn: null,
    note: 'MINUTES PER CONTROL DRAFTED, not per run. An auditor reads the SOP and writes the matrix control by control, so a run\u2019s by-hand time is this times the controls it produced. The DRAFT only: the review and correction that follows is still their time.',
  },
  {
    surface: 'exception',
    target: null,
    minutes: 12,
    sample: 5,
    measuredBy: null,
    measuredOn: null,
    note: 'Compiling one exception with its evidence, routing it to an owner and tracking it to closure. NOT finding it, which the run that raised it already counts, and not the judgement, which a person still makes. One figure for all: the platform\u2019s part is the same shape whatever was found.',
  },
  {
    surface: 'chat',
    target: 'lookup',
    minutes: 3,
    sample: 5,
    measuredBy: null,
    measuredOn: null,
    note: 'Finding one fact in the source files: who owns a control, what a policy says, when something was last run.',
  },
  {
    surface: 'chat',
    target: 'explain',
    minutes: 9,
    sample: 5,
    measuredBy: null,
    measuredOn: null,
    note: 'Working out why a row came back the way it did, and reading enough around it to say so.',
  },
  {
    surface: 'chat',
    target: 'evidence',
    minutes: 25,
    sample: 5,
    measuredBy: null,
    measuredOn: null,
    note: 'Gathering everything held on one subject across the source files and putting it in one place.',
  },
  {
    surface: 'chat',
    target: 'draft',
    minutes: 45,
    sample: 5,
    measuredBy: null,
    measuredOn: null,
    note: 'Writing up an observation or a note from what the files hold. The DRAFT only: the review that follows is still a person\u2019s time.',
  },
];

const TIMING_KEY = (surface: string, target: string | null) => `${surface}:${target ?? ''}`;

const TIMING_BY_KEY = new Map(MANUAL_TIMINGS.map(t => [TIMING_KEY(t.surface, t.target), t]));

/**
 * How many auditors a sitting needs before its result is allowed to price
 * anything.
 *
 * Below this a timing is RECORDED but not USED. One or two people is an
 * anecdote, and an anecdote pricing a quarter is the kind of number that loses
 * an argument the first time somebody asks how many auditors were watched.
 */
export const MIN_SAMPLE = 5;

/**
 * The share of activities that must carry a timing before Platform Value shows
 * figures at all.
 *
 * A workspace with no timings is not wrong when it reports nothing given back:
 * it is correct, and it is useless. Worse, a page of noughts reads as a verdict
 * on the platform when it is a verdict on how much stopwatch work has been
 * done. Below this the tab shows what to do about it instead, and the figures
 * come back on their own once enough sittings exist.
 *
 * Low rather than comfortable, because a floor built on a tenth of the
 * activities is still a floor and still true. This gate is for the empty case,
 * not for quality.
 */
export const MIN_COVERAGE = 0.1;

/** Whether a timing may price work: measured, and measured on enough people. */
export function timingIsUsable(t: ManualTiming | null): boolean {
  return t != null && t.minutes != null && (t.sample ?? 0) >= MIN_SAMPLE;
}

/** The timing for one NAMED thing. Returns null rather than falling back to a
 *  sibling: an untimed workflow is unpriced, not averaged. */
export function timingFor(surface: string, target: string | null): ManualTiming | null {
  return TIMING_BY_KEY.get(TIMING_KEY(surface, target)) ?? null;
}

/** The sittings still outstanding, named. This is the worklist that closes the
 *  gap between the coverage figure and 100%. A cell timed on too few auditors
 *  counts as outstanding too: it is recorded, and it is not used. */
export const UNTIMED_CELLS = MANUAL_TIMINGS.filter(t => !timingIsUsable(t));



/* ──────────────────────────────────────────────────────────────────────────
 * Lookups, by hand
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * How long one registry lookup takes a person: open the portal, key the number
 * in, wait, read the answer back out, paste it where it belongs.
 *
 * These earn time ONLY outside a timed workflow run. Inside one they are
 * already inside the workflow's own timing, and adding them again would count
 * the same minutes twice.
 */
export interface LookupTiming {
  op_key: string;
  minutes: number;
  sample: number;
  measuredBy: string;
  measuredOn: string;
}

export const LOOKUP_TIMINGS: LookupTiming[] = [
  { op_key: 'govt.pan_basic', minutes: 2, sample: 6, measuredBy: 'Vijay Reddy', measuredOn: '2026-02-25' },
  { op_key: 'govt.pan_details_plus', minutes: 3, sample: 6, measuredBy: 'Vijay Reddy', measuredOn: '2026-02-25' },
  { op_key: 'govt.driving_licence', minutes: 3, sample: 5, measuredBy: 'Vijay Reddy', measuredOn: '2026-02-25' },
  { op_key: 'govt.voter_id', minutes: 3, sample: 5, measuredBy: 'Vijay Reddy', measuredOn: '2026-02-25' },
  { op_key: 'govt.passport', minutes: 4, sample: 5, measuredBy: 'Vijay Reddy', measuredOn: '2026-02-26' },
  { op_key: 'govt.vehicle_rc', minutes: 3, sample: 5, measuredBy: 'Vijay Reddy', measuredOn: '2026-02-26' },
  { op_key: 'govt.uan_advanced', minutes: 5, sample: 5, measuredBy: 'Vijay Reddy', measuredOn: '2026-02-26' },
  { op_key: 'govt.email_verification', minutes: 1, sample: 6, measuredBy: 'Vijay Reddy', measuredOn: '2026-02-26' },
  { op_key: 'govt.gst_basic', minutes: 2, sample: 8, measuredBy: 'Vijay Reddy', measuredOn: '2026-02-25' },
  { op_key: 'govt.gst_advanced', minutes: 4, sample: 8, measuredBy: 'Vijay Reddy', measuredOn: '2026-02-25' },
  { op_key: 'govt.gst_by_pan', minutes: 3, sample: 7, measuredBy: 'Vijay Reddy', measuredOn: '2026-02-25' },
  { op_key: 'govt.udyam_basic', minutes: 3, sample: 5, measuredBy: 'Vijay Reddy', measuredOn: '2026-02-27' },
  { op_key: 'govt.udyam_by_pan', minutes: 4, sample: 5, measuredBy: 'Vijay Reddy', measuredOn: '2026-02-27' },
  { op_key: 'govt.cin_advanced', minutes: 6, sample: 6, measuredBy: 'Vijay Reddy', measuredOn: '2026-02-27' },
];

const LOOKUP_BY_KEY = new Map(LOOKUP_TIMINGS.map(t => [t.op_key, t]));

export function lookupTiming(opKey: string): LookupTiming | null {
  return LOOKUP_BY_KEY.get(opKey) ?? null;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Setting a batch up
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * A batch pays its setup once. By hand it is paid every time.
 *
 * Pulling the population, agreeing the parameters and lining the inputs up is
 * work a person repeats for every run in the batch and the platform does once,
 * so `setup × (successful runs − 1)` is time returned that the per-run
 * arithmetic never sees.
 *
 * A workflow with no setup timing contributes nothing to the uplift, and the
 * page names it rather than quietly leaving it out.
 */
export interface SetupTiming {
  workflow_id: string;
  minutes: number | null;
  sample: number | null;
  measuredBy: string | null;
  measuredOn: string | null;
}

export const SETUP_TIMINGS: SetupTiming[] = [
  { workflow_id: 'wf-vendor-master', minutes: 25, sample: 5, measuredBy: 'Meera Nair', measuredOn: '2026-02-11' },
  { workflow_id: 'wf-duplicate-payments', minutes: 20, sample: 5, measuredBy: 'Meera Nair', measuredOn: '2026-02-11' },
  { workflow_id: 'wf-gst-recon', minutes: 30, sample: 5, measuredBy: 'Meera Nair', measuredOn: '2026-02-18' },
  { workflow_id: 'wf-payroll-exits', minutes: 15, sample: 5, measuredBy: 'Meera Nair', measuredOn: '2026-02-18' },
  { workflow_id: 'wf-related-party', minutes: null, sample: null, measuredBy: null, measuredOn: null },
];

const SETUP_BY_ID = new Map(SETUP_TIMINGS.map(t => [t.workflow_id, t]));

export function setupTiming(workflowId: string): SetupTiming | null {
  return SETUP_BY_ID.get(workflowId) ?? null;
}

/** Rounded to a sensible number of decimals for display, never for arithmetic. */
export function formatHours(hours: number): string {
  if (Math.abs(hours) >= 100) return Math.round(hours).toLocaleString('en-IN');
  return hours.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function formatRupees(amount: number, decimals = 0): string {
  return `₹${amount.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}
