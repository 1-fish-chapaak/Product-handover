/**
 * Platform Usage. The records the platform already keeps.
 *
 * Built from `Platform-Usage-Guide.pdf` (17 Aug 2026). Section 3 of that
 * document is a survey of what the product writes down as it works, and this
 * module is that survey turned into data: workflow runs and the populations
 * they test, chat questions, Concierge jobs, SOP-to-RACM jobs, paid lookup
 * calls, sample validations, exceptions, the before-and-after event log behind
 * dashboards and alerts, the reports trail, the risk register, the engagement
 * portfolio and its continuous-monitoring config, plus the hand work the
 * self-measuring assumptions read.
 *
 * Three rules hold the file together.
 *
 * **It composes, it does not invent.** Every record is derived from a table the
 * rest of the product already renders: the Workflow Library's workflows, the
 * Control Library's controls, the risk register, the engagement list, the
 * report list, the dashboard catalog, the member roster. When Platform Usage
 * says "14 controls in the library" it counts the same fourteen rows the
 * library itself draws, so two screens cannot disagree in front of one reader.
 *
 * **It is a fixed seed, not a clock.** ANCHOR is Tue 31 Mar 2026, the last day
 * of the quarter and of the Indian financial year, which is when the renewal
 * conversation this page exists for actually happens. The quarter end matters:
 * the CFO opens on "this quarter compared with last", and comparing three weeks
 * against three months tells nobody anything. History runs back to 1 Jul 2025 so
 * "since you started" covers nine months and the longest window still has
 * something behind it. A fixed-seed PRNG, no `Date.now()` and no `Math.random()`,
 * so every reload, screenshot and test sees the same history.
 *
 * **The quarter is the guide's worked example, to the rupee.** Section 7 prices
 * one quarter of one mid-size customer, and section 15 asks for a seeded
 * customer carrying those exact numbers so every tile can be checked against
 * arithmetic done by hand. January to March 2026 therefore holds 340 successful
 * runs over populations of 1,428,000 rows, in 8.5 hours of machine time, against
 * a contract that charged 18,400 rupees. What the CFO lands on is that table.
 */

import { WORKFLOWS, GENERATED_REPORTS, SHARED_REPORTS } from './mockData';
import { CONTROL_LIBRARY } from './controlLibrary';
import { SEED_RISKS } from './riskRegister';
import { ENGAGEMENTS } from './engagements';
import { ENGAGEMENT_EXCEPTIONS } from './engagement-exceptions';
import { MY_DASHBOARDS, SHARED_DASHBOARDS } from './dashboards';
import { SEED_USERS } from '../context/AdminDataContext';

/* ──────────────────────────────────────────────────────────────────────────
 * The one line that says what this page does and does not count
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * The coverage note.
 *
 * Defined once, rendered on screen and in both exports, so when a later release
 * widens what is counted one string changes and every surface follows.
 */
export const COVERAGE_NOTE =
  'Counts workflow runs and the populations they tested, chat questions, Concierge jobs, '
  + 'SOP-to-RACM jobs, paid verification lookups, sample validations, exceptions, dashboards '
  + 'and the alerts they fired, reports and their activity, the risk register, the engagement '
  + 'portfolio and continuous monitoring. It does not count edits, reviews, views or time spent '
  + 'inside a record, and it prices nothing the contract has not priced.';

/* ── Time ────────────────────────────────────────────────────────────────── */

export const DAY_MS = 86_400_000;
export const HOUR_MS = 3_600_000;
export const MINUTE_MS = 60_000;

/** The newest moment in the record: Tue 31 Mar 2026, 18:00 UTC. */
export const ANCHOR = Date.UTC(2026, 2, 31, 18, 0, 0);

/** The oldest: Tue 1 Jul 2025, so "since you started" covers nine real months. */
export const HISTORY_START = Date.UTC(2025, 6, 1, 0, 0, 0);

/** The guide's worked example: the quarter the CFO lands on. */
export const EXAMPLE_QUARTER = {
  from: Date.UTC(2026, 0, 1, 0, 0, 0),
  to: ANCHOR,
  runs: 340,
  rows: 1_428_000,
  machineMs: 8.5 * HOUR_MS,
  costPaise: 1_840_000,
};

const DATE_FMT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const DATETIME_FMT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC',
});
const MONTH_FMT = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const SHORT_MONTH_FMT = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' });
const DAY_MONTH_FMT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export const formatDate = (ms: number): string => DATE_FMT.format(new Date(ms));
export const formatDateTime = (ms: number): string => DATETIME_FMT.format(new Date(ms));
export const formatMonth = (ms: number): string => MONTH_FMT.format(new Date(ms));
export const formatShortMonth = (ms: number): string => SHORT_MONTH_FMT.format(new Date(ms));
export const formatDayMonth = (ms: number): string => DAY_MONTH_FMT.format(new Date(ms));
export const isoDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/**
 * How old the numbers are, said on every view and in both exports.
 *
 * The seed does not move, so the page states the date of the newest record it
 * holds rather than claiming to be live. "Fresh" in the guide's sense, meaning
 * a run that finished two minutes ago is included, is a property of the query, and
 * the query here reads everything up to this moment.
 */
export const dataAsOfLabel = (): string => `Counted to ${formatDate(ANCHOR)}`;

/* ── Determinism ─────────────────────────────────────────────────────────── */

/** mulberry32. Same seed, same history, every single time. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(rand: () => number, list: readonly T[]): T => list[Math.floor(rand() * list.length) % list.length];

/* ── Who did it ──────────────────────────────────────────────────────────── */

export interface Actor {
  name: string;
  email: string;
  team: string;
}

/**
 * The roster, read off the member list rather than written here.
 *
 * An actor who is not a member can never be attributed, and their work would
 * silently vanish off the page, so every record below picks from this list.
 * Members with no team sit out: the head-of-team view scopes by team, and a
 * run belonging to no team belongs on nobody's screen.
 */
export const ACTORS: Actor[] = SEED_USERS
  .filter(u => u.team && u.team !== '—' && u.status !== 'Invited')
  .map(u => ({ name: u.name, email: u.email, team: u.team }));

export const TEAMS: string[] = [...new Set(ACTORS.map(a => a.team))].sort();

const actorsOfTeam = (team: string) => ACTORS.filter(a => a.team === team);

const SOX = actorsOfTeam('SOX Audit');
const IFC = actorsOfTeam('IFC Team');

/** The signed-in auditor persona, so their own view has work on it. */
const TUSHAR = ACTORS.find(a => a.email === 'tushar.goel@irame.ai') ?? SOX[0];
/** Who keeps re-running the vendor reconciliation when it fails. */
const VENDOR_OWNER = ACTORS.find(a => a.email === 'karan.mehta@irame.ai')
  ?? ACTORS.find(a => a.team === 'Management')
  ?? SOX[0];

/**
 * The workspace owner.
 *
 * They take a share of the vendor reconciliation rather than none of it. The
 * auditor view only ever shows whoever is signed in, so without that share it
 * would open on an empty state that reads like a bug.
 */
const OWNER = ACTORS.find(a => a.email === 'nilesh.anand@irame.ai')
  ?? ACTORS.find(a => a.team === 'Management')
  ?? SOX[0];

/* ──────────────────────────────────────────────────────────────────────────
 * 1 · Populations, and the runs that test them
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * A population under test, which is the thing coverage counts.
 *
 * This is the record that stops the page overstating itself. A scheduled check
 * re-tests the same vendor master every month, and adding those up would show
 * fifty thousand vendors as six lakh rows covered. Coverage counts the
 * population once, however often it is re-tested. The re-tests are counted
 * separately, under the name checks performed.
 */
export interface Population {
  id: string;
  name: string;
  /** How many rows the population holds. Counted once, ever. */
  size: number;
  workflowId: string;
  workflowName: string;
  controlId: string;
  engagementId: string;
  /** How often the workflow runs over it. */
  cadence: 'weekday' | 'weekly' | 'twice-monthly';
  team: string;
}

/**
 * Eleven populations, one per workflow in the library, summing to exactly
 * 1,428,000 rows, which is the guide's worked example.
 */
export const POPULATIONS: Population[] = [
  { id: 'pop-invoices',   name: 'Purchase invoices',      size: 312_000, workflowId: 'wf-001', workflowName: 'Duplicate Invoice Detector',     controlId: 'C-003', engagementId: 'eng-3',     cadence: 'weekly',        team: 'SOX Audit' },
  // Management owns the vendor reconciliation, which is the check the guide's
  // own example is about. It sits with the team the head-of-team view resolves
  // to for a workspace owner, so the view that reads "is anything stuck" opens
  // on something that is actually stuck rather than on a congratulation.
  { id: 'pop-vendors',    name: 'Vendor master',          size:  48_000, workflowId: 'wf-002', workflowName: 'Vendor Master Change Monitor',   controlId: 'C-002', engagementId: 'eng-9',     cadence: 'weekly',        team: 'Management' },
  { id: 'pop-payments',   name: 'Payments ledger',        size: 174_000, workflowId: 'wf-003', workflowName: 'High-Value Payment Flagging',    controlId: 'C-004', engagementId: 'eng-1',     cadence: 'weekday',       team: 'SOX Audit' },
  { id: 'pop-revenue',    name: 'Revenue transactions',   size:  96_000, workflowId: 'wf-004', workflowName: 'Revenue Recognition Checker',    controlId: 'C-005', engagementId: 'eng-8',     cadence: 'weekly',        team: 'IFC Team' },
  { id: 'pop-journals',   name: 'Journal entries',        size: 486_000, workflowId: 'wf-005', workflowName: 'Journal Entry Anomaly Detector', controlId: 'C-007', engagementId: 'eng-sox-3', cadence: 'weekday',       team: 'SOX Audit' },
  { id: 'pop-contracts',  name: 'Open contracts',         size:  12_400, workflowId: 'wf-006', workflowName: 'Contract Expiry Alert',          controlId: 'C-011', engagementId: 'eng-4',     cadence: 'weekly',        team: 'IFC Team' },
  { id: 'pop-grn',        name: 'Goods receipt notes',    size:   9_000, workflowId: 'wf-007', workflowName: 'Three-Way PO Match',             controlId: 'C-001', engagementId: 'eng-1',     cadence: 'weekday',       team: 'SOX Audit' },
  { id: 'pop-access',     name: 'User access records',    size:   8_600, workflowId: 'wf-008', workflowName: 'SOD Violation Detector',         controlId: 'C-009', engagementId: 'eng-6',     cadence: 'weekday',       team: 'Engineering' },
  { id: 'pop-orders',     name: 'Open sales orders',      size:  41_000, workflowId: 'wf-009', workflowName: 'Credit Limit Monitor',           controlId: 'C-006', engagementId: 'eng-2',     cadence: 'weekly',        team: 'IFC Team' },
  { id: 'pop-remittance', name: 'Customer remittances',   size: 218_000, workflowId: 'wf-010', workflowName: 'Cash Application Matcher',       controlId: 'C-005', engagementId: 'eng-2',     cadence: 'weekly',        team: 'IFC Team' },
  { id: 'pop-chargeback', name: 'Chargeback lines',       size:  23_000, workflowId: 'wf-011', workflowName: 'Chargeback Pricing Validation',  controlId: 'C-013', engagementId: 'eng-5',     cadence: 'twice-monthly', team: 'Management' },
];

/** Workflow names, checked against the library so the two screens agree. */
const LIBRARY_WORKFLOW_NAMES = new Map(WORKFLOWS.map(w => [w.id, w.name] as const));
POPULATIONS.forEach(p => {
  const real = LIBRARY_WORKFLOW_NAMES.get(p.workflowId);
  if (real) p.workflowName = real;
});

export type RunStatus = 'passed' | 'failed' | 'blocked';

export interface Run {
  id: string;
  populationId: string;
  workflowId: string;
  workflowName: string;
  controlId: string;
  engagementId: string;
  actor: Actor;
  team: string;
  startedAt: number;
  completedAt: number;
  status: RunStatus;
  /** Rows this run checked. A repeat re-checks the same rows. */
  rowsProcessed: number;
  /** Present only on a run that did not pass. The real text rather than a code. */
  errorText: string | null;
  /** True when a schedule started it rather than a person. */
  scheduled: boolean;
}

const isWeekday = (ms: number) => {
  const d = new Date(ms).getUTCDay();
  return d !== 0 && d !== 6;
};

/** Every day the cadence fires on, between two moments. */
function cadenceDays(cadence: Population['cadence'], from: number, to: number): number[] {
  const out: number[] = [];
  for (let t = Date.UTC(new Date(from).getUTCFullYear(), new Date(from).getUTCMonth(), new Date(from).getUTCDate()); t <= to; t += DAY_MS) {
    const d = new Date(t);
    if (cadence === 'weekday' && isWeekday(t)) out.push(t);
    if (cadence === 'weekly' && d.getUTCDay() === 1) out.push(t);
    if (cadence === 'twice-monthly' && (d.getUTCDate() === 1 || d.getUTCDate() === 15)) out.push(t);
  }
  return out;
}

/**
 * The failures, and why a failure is a separate record.
 *
 * A failure does not use up a scheduled run. The check fires, it fails, and
 * somebody re-runs it, so the day carries a failed attempt as well as the run
 * that eventually worked. That is how the product behaves, and it also keeps the
 * guide's arithmetic straight. Failed runs are excluded from every saving figure
 * and reported on their own as wasted machine time, so counting them inside the
 * 340 would quietly deflate the quarter.
 *
 * The exception is a check that is stuck right now, meaning it failed and
 * nobody has re-run it. Those are written by hand below, because the
 * head-of-team view opens on them and the guide's own attention card reads
 * "Vendor reconciliation failed 4 times, same error".
 */
const REPEAT_FAILURE_TEXT =
  'Connection to the vendor master reset after 30s. Rows 24,001 onward were never read.';

const OTHER_ERRORS: Record<string, string> = {
  'pop-payments': 'Column BANK_IFSC missing from the payments extract. The rule needs it to match a payee.',
  'pop-journals': 'The GL extract for this day arrived empty. Nothing was checked.',
  'pop-grn': 'Two GRN files claim the same batch number. The run stopped rather than double-count.',
  'pop-access': 'The directory export timed out at 4,200 of 8,600 records.',
  'pop-invoices': 'Invoice date parsed as 30/02/2026 on 14 rows. The run stopped rather than guess.',
  'pop-remittance': 'The remittance feed returned HTTP 502 twice. No rows were read.',
  'pop-vendors': REPEAT_FAILURE_TEXT,
};

const BLOCKED_TEXT = 'Waiting on a person: the source file for this period has not been uploaded.';

/**
 * What is stuck at the moment the page is read.
 *
 * A cadence day named here produces the failed or blocked attempt instead of a
 * successful run, and nothing re-ran it afterwards. Four of them are the same
 * error on the same check inside a fortnight, which is a pattern a team lead can
 * do something about.
 */
const STUCK: { populationId: string; at: number; status: RunStatus; manual: boolean }[] = [
  { populationId: 'pop-vendors', at: Date.UTC(2026, 2, 23), status: 'failed', manual: false },
  { populationId: 'pop-vendors', at: Date.UTC(2026, 2, 24), status: 'failed', manual: true },
  { populationId: 'pop-vendors', at: Date.UTC(2026, 2, 30), status: 'failed', manual: false },
  { populationId: 'pop-vendors', at: Date.UTC(2026, 2, 31), status: 'failed', manual: true },
  { populationId: 'pop-payments', at: Date.UTC(2026, 2, 31), status: 'blocked', manual: false },
];

const STUCK_CADENCE_DAYS = new Set(STUCK.filter(s => !s.manual).map(s => `${s.populationId}:${s.at}`));

/**
 * The runs a person started by hand, to make the quarter whole.
 *
 * Three cadence days in March produced a stuck attempt rather than a successful
 * run, so three checks were run on demand instead. The quarter therefore holds
 * exactly the 340 successful runs the guide prices, over populations that were
 * already covered, so coverage does not move. Only the count of checks
 * performed does.
 */
const AD_HOC_RUNS: { populationId: string; at: number }[] = [
  { populationId: 'pop-chargeback', at: Date.UTC(2026, 0, 22) },
  { populationId: 'pop-chargeback', at: Date.UTC(2026, 1, 19) },
  { populationId: 'pop-chargeback', at: Date.UTC(2026, 2, 19) },
];

interface DraftRun extends Omit<Run, 'startedAt'> { day: number; weight: number }

function buildRuns(): Run[] {
  const rand = prng(20260331);
  const drafts: DraftRun[] = [];

  const draft = (
    pop: Population, day: number, at: number, status: RunStatus, actor: Actor, scheduled: boolean, suffix = '',
  ) => {
    drafts.push({
      id: `run-${pop.id}-${isoDay(day)}${suffix}`,
      populationId: pop.id,
      workflowId: pop.workflowId,
      workflowName: pop.workflowName,
      controlId: pop.controlId,
      engagementId: pop.engagementId,
      actor,
      team: actor.team,
      day,
      completedAt: at,
      status,
      rowsProcessed: status === 'passed' ? pop.size : 0,
      errorText: status === 'passed' ? null
        : status === 'blocked' ? BLOCKED_TEXT
          : OTHER_ERRORS[pop.id] ?? 'The run stopped before it finished. No rows were checked.',
      scheduled,
      // Machine time tracks rows, with a little jitter. A run that failed burned
      // time too; it just bought nothing, so it is weighted lower and counted
      // apart.
      weight: (status === 'passed' ? pop.size : pop.size * 0.35) * (0.85 + rand() * 0.3),
    });
  };

  POPULATIONS.forEach(pop => {
    const team = actorsOfTeam(pop.team);
    const roster = team.length > 0 ? team : ACTORS;
    cadenceDays(pop.cadence, HISTORY_START, ANCHOR).forEach((day, i) => {
      // Scheduled work starts at 02:00; a person who kicks it off does it in the
      // working day. Either way the completion time is what the page measures.
      const scheduled = pop.cadence !== 'twice-monthly';
      const startedOffset = scheduled ? 2 * HOUR_MS : (9 + Math.floor(rand() * 7)) * HOUR_MS + Math.floor(rand() * 50) * MINUTE_MS;

      // The auditor persona owns the invoice and GRN checks, so their own view
      // has their own work on it. Everything else rotates through the team.
      const actor = (pop.id === 'pop-invoices' || pop.id === 'pop-grn') && i % 2 === 0
        ? TUSHAR
        : pop.id === 'pop-vendors'
          ? (i % 2 === 0 ? VENDOR_OWNER : OWNER)
          : pick(rand, roster);

      const stuck = STUCK_CADENCE_DAYS.has(`${pop.id}:${day}`);
      if (stuck) {
        const entry = STUCK.find(s => s.populationId === pop.id && s.at === day)!;
        draft(pop, day, day + startedOffset, entry.status, actor, scheduled);
        return;
      }

      // An attempt that failed and was re-run. It is its own record, so the
      // successful run below still counts, and the wasted machine time is
      // reported on its own.
      if (rand() < 0.028) {
        draft(pop, day, day + startedOffset - 25 * MINUTE_MS, 'failed', actor, scheduled, '-attempt');
      }

      draft(pop, day, day + startedOffset, 'passed', actor, scheduled);
    });
  });

  // The stuck attempts a person made by hand, on days the schedule does not fire.
  STUCK.filter(s => s.manual).forEach(entry => {
    const pop = POPULATIONS.find(p => p.id === entry.populationId)!;
    draft(pop, entry.at, entry.at + 11 * HOUR_MS, entry.status, VENDOR_OWNER, false, '-manual');
  });

  AD_HOC_RUNS.forEach(item => {
    const pop = POPULATIONS.find(p => p.id === item.populationId)!;
    const roster = actorsOfTeam(pop.team).length ? actorsOfTeam(pop.team) : ACTORS;
    draft(pop, item.at, item.at + 15 * HOUR_MS, 'passed', pick(rand, roster), false, '-adhoc');
  });

  drafts.sort((a, b) => a.completedAt - b.completedAt);

  /*
   * Machine time.
   *
   * The guide's quarter took 8.5 hours of it across 340 successful runs, so
   * those runs are allocated exactly that much: weights are shared out by a
   * running cumulative total, which makes the sum exact to the millisecond
   * rather than nearly right. Runs outside the quarter use the same rate.
   */
  const inQuarter = (r: DraftRun) => r.completedAt >= EXAMPLE_QUARTER.from && r.completedAt <= EXAMPLE_QUARTER.to;
  const exact = drafts.filter(r => inQuarter(r) && r.status === 'passed');
  const totalWeight = exact.reduce((s, r) => s + r.weight, 0);
  const rate = EXAMPLE_QUARTER.machineMs / totalWeight;

  const durations = new Map<string, number>();
  let cum = 0;
  let allocated = 0;
  exact.forEach(r => {
    cum += r.weight;
    const target = Math.round(EXAMPLE_QUARTER.machineMs * (cum / totalWeight));
    durations.set(r.id, Math.max(1000, target - allocated));
    allocated = target;
  });

  return drafts.map(r => {
    const ms = durations.get(r.id) ?? Math.max(1000, Math.round(r.weight * rate));
    return {
      id: r.id,
      populationId: r.populationId,
      workflowId: r.workflowId,
      workflowName: r.workflowName,
      controlId: r.controlId,
      engagementId: r.engagementId,
      actor: r.actor,
      team: r.team,
      startedAt: r.completedAt - ms,
      completedAt: r.completedAt,
      status: r.status,
      rowsProcessed: r.rowsProcessed,
      errorText: r.errorText,
      scheduled: r.scheduled,
    };
  });
}

export const RUNS: Run[] = buildRuns();

const POPULATION_BY_ID = new Map(POPULATIONS.map(p => [p.id, p] as const));
export const populationOf = (id: string): Population | undefined => POPULATION_BY_ID.get(id);

/* ──────────────────────────────────────────────────────────────────────────
 * 2 · The thirteen paid verification lookups, and what the contract charges
 * ────────────────────────────────────────────────────────────────────────── */

export interface PaidLookup {
  id: string;
  name: string;
  /** What the check confirms, said plainly. */
  verifies: string;
  /** True where the lookup touches somebody's personal identity. */
  personalData: boolean;
}

/**
 * The list from section 10 of the guide.
 *
 * Each is a saved workflow whose calling code lives in a database row, which is
 * why the billable set can change without a deployment. Six touch personal
 * identity. Aadhaar is deliberately absent: the guide records that the
 * screenshot we were given was cut off and that Aadhaar authentication is
 * restricted to licensed entities, so until the business confirms it, adding it
 * here would be inventing a record.
 */
export const PAID_LOOKUPS: PaidLookup[] = [
  { id: 'pl-01', name: 'PAN Basic API Check',           verifies: 'A PAN exists and the name on it matches',      personalData: true },
  { id: 'pl-02', name: 'PAN Details API',               verifies: 'The full record behind a PAN',                 personalData: true },
  { id: 'pl-03', name: 'PAN to GST API',                verifies: 'Which GST registrations sit under a PAN',      personalData: true },
  { id: 'pl-04', name: 'PAN to MSME Basic API Check',   verifies: 'Whether a PAN carries an MSME or Udyam entry', personalData: true },
  { id: 'pl-05', name: 'GST API Check',                 verifies: 'A GST registration and its current status',    personalData: false },
  { id: 'pl-06', name: 'MSME API Check',                verifies: 'An MSME or Udyam registration',                personalData: false },
  { id: 'pl-07', name: 'CIN API Check',                 verifies: 'A company registration at the MCA',            personalData: false },
  { id: 'pl-08', name: 'Vaahan API Check',              verifies: 'A vehicle registration',                       personalData: true },
  { id: 'pl-09', name: 'UAN Advanced v4 API',           verifies: 'A provident-fund account',                     personalData: true },
  { id: 'pl-10', name: 'Passport API Check',            verifies: 'A passport',                                   personalData: true },
  { id: 'pl-11', name: 'Voter ID API Check',            verifies: 'A voter ID',                                   personalData: true },
  { id: 'pl-12', name: 'Driving License API Check',     verifies: 'A driving licence',                            personalData: true },
  { id: 'pl-13', name: 'Email API Check',               verifies: 'An email address exists and accepts post',     personalData: true },
];

/** Said on screen next to the list, because a silent omission is a claim. */
export const AADHAAR_NOTE =
  'Aadhaar is not on this list. The library screenshot we were given was cut off, and Aadhaar '
  + "authentication is restricted to licensed entities, so it would run through the vendor's "
  + 'licence. The business still has to confirm whether it exists here.';

export type BillingUnit = 'row' | 'run';

/**
 * A contract price.
 *
 * Prices are what we sold, not what the customer types. Ops seed them at
 * signing: the API, the vendor, whether the vendor bills per run or per row,
 * the charge, and the date it takes force. A renegotiation starts a new row
 * with a new effective date, so last quarter's cost never rewrites itself.
 */
export interface ContractPrice {
  lookupId: string;
  vendor: string;
  apiName: string;
  billingUnit: BillingUnit;
  pricePaise: number;
  effectiveFrom: number;
  effectiveTo: number | null;
  setBy: string;
  setAt: number;
}

const SIGNED_AT = Date.UTC(2025, 5, 18, 10, 30, 0);
const OPS = 'irame operations';

export const CONTRACT_PRICES: ContractPrice[] = [
  // PAN Basic was renegotiated down from 1 Feb 2026, so the quarter on screen
  // is charged at two prices and January never rewrites itself.
  { lookupId: 'pl-01', vendor: 'Signzy', apiName: 'PAN Basic API Check',         billingUnit: 'row', pricePaise: 175, effectiveFrom: SIGNED_AT, effectiveTo: Date.UTC(2026, 0, 31, 23, 59, 59), setBy: OPS, setAt: SIGNED_AT },
  { lookupId: 'pl-01', vendor: 'Signzy', apiName: 'PAN Basic API Check',         billingUnit: 'row', pricePaise: 150, effectiveFrom: Date.UTC(2026, 1, 1), effectiveTo: null, setBy: OPS, setAt: Date.UTC(2026, 0, 20, 11, 0, 0) },
  { lookupId: 'pl-02', vendor: 'Signzy', apiName: 'PAN Details API',             billingUnit: 'row', pricePaise: 300, effectiveFrom: SIGNED_AT, effectiveTo: null, setBy: OPS, setAt: SIGNED_AT },
  { lookupId: 'pl-03', vendor: 'Signzy', apiName: 'PAN to GST API',              billingUnit: 'row', pricePaise: 400, effectiveFrom: SIGNED_AT, effectiveTo: null, setBy: OPS, setAt: SIGNED_AT },
  { lookupId: 'pl-04', vendor: 'Signzy', apiName: 'PAN to MSME Basic API Check', billingUnit: 'row', pricePaise: 350, effectiveFrom: SIGNED_AT, effectiveTo: null, setBy: OPS, setAt: SIGNED_AT },
  { lookupId: 'pl-05', vendor: 'Signzy', apiName: 'GST API Check',               billingUnit: 'row', pricePaise: 200, effectiveFrom: SIGNED_AT, effectiveTo: null, setBy: OPS, setAt: SIGNED_AT },
  { lookupId: 'pl-06', vendor: 'Signzy', apiName: 'MSME API Check',              billingUnit: 'row', pricePaise: 250, effectiveFrom: SIGNED_AT, effectiveTo: null, setBy: OPS, setAt: SIGNED_AT },
  // Karza bills the company-registration check once per run however many
  // companies it looked up. Reading that term the wrong way puts the figure out
  // by a factor of a thousand, which is why the unit is stored, not assumed.
  { lookupId: 'pl-07', vendor: 'Karza',  apiName: 'CIN API Check',               billingUnit: 'run', pricePaise: 1_200, effectiveFrom: SIGNED_AT, effectiveTo: null, setBy: OPS, setAt: SIGNED_AT },
  { lookupId: 'pl-08', vendor: 'Karza',  apiName: 'Vaahan API Check',            billingUnit: 'row', pricePaise: 600, effectiveFrom: SIGNED_AT, effectiveTo: null, setBy: OPS, setAt: SIGNED_AT },
  { lookupId: 'pl-09', vendor: 'Karza',  apiName: 'UAN Advanced v4 API',         billingUnit: 'row', pricePaise: 900, effectiveFrom: SIGNED_AT, effectiveTo: null, setBy: OPS, setAt: SIGNED_AT },
  { lookupId: 'pl-10', vendor: 'Karza',  apiName: 'Passport API Check',          billingUnit: 'row', pricePaise: 800, effectiveFrom: SIGNED_AT, effectiveTo: null, setBy: OPS, setAt: SIGNED_AT },
  { lookupId: 'pl-11', vendor: 'Karza',  apiName: 'Voter ID API Check',          billingUnit: 'row', pricePaise: 500, effectiveFrom: SIGNED_AT, effectiveTo: null, setBy: OPS, setAt: SIGNED_AT },
  { lookupId: 'pl-12', vendor: 'Karza',  apiName: 'Driving License API Check',   billingUnit: 'row', pricePaise: 550, effectiveFrom: SIGNED_AT, effectiveTo: null, setBy: OPS, setAt: SIGNED_AT },
  // The email check was added to the contract late, so calls before 1 Apr 2026
  // are counted, named, and charged nothing. That is ours to fix, not theirs.
  { lookupId: 'pl-13', vendor: 'Signzy', apiName: 'Email API Check',             billingUnit: 'row', pricePaise: 40, effectiveFrom: Date.UTC(2026, 3, 1), effectiveTo: null, setBy: OPS, setAt: Date.UTC(2026, 2, 24, 9, 0, 0) },
];

/** The price in force for a lookup at a moment, or null if there is none. */
export function priceAt(lookupId: string, at: number): ContractPrice | null {
  return CONTRACT_PRICES.find(p =>
    p.lookupId === lookupId && at >= p.effectiveFrom && (p.effectiveTo === null || at <= p.effectiveTo)) ?? null;
}

export interface LookupCall {
  id: string;
  lookupId: string;
  /** Calls made by one run share a batch. A per-run price charges the batch once. */
  batchId: string;
  runId: string | null;
  at: number;
  ok: boolean;
  actor: Actor;
}

/**
 * How many calls each lookup made in the guide's quarter.
 *
 * These volumes and the contract above multiply out to exactly 18,400 rupees, the
 * cost line of the worked example. The email check runs in the quarter but is
 * not priced until April, so it is counted, named on screen, and charged
 * nothing.
 */
const QUARTER_CALLS: { lookupId: string; jan: number; feb: number; mar: number; perBatch: number }[] = [
  { lookupId: 'pl-01', jan: 1_200, feb: 1_200, mar: 1_200, perBatch: 300 },
  { lookupId: 'pl-02', jan:    60, feb:    70, mar:    70, perBatch: 100 },
  { lookupId: 'pl-03', jan:   140, feb:   130, mar:   130, perBatch: 100 },
  { lookupId: 'pl-04', jan:   100, feb:   100, mar:   100, perBatch: 100 },
  { lookupId: 'pl-05', jan: 1_000, feb: 1_000, mar: 1_000, perBatch: 250 },
  { lookupId: 'pl-06', jan:   140, feb:   130, mar:   130, perBatch: 100 },
  { lookupId: 'pl-07', jan:   180, feb:   180, mar:   180, perBatch:   9 },
  { lookupId: 'pl-08', jan:    40, feb:    40, mar:    40, perBatch:  20 },
  { lookupId: 'pl-09', jan:    20, feb:    20, mar:    20, perBatch:  10 },
  { lookupId: 'pl-10', jan:    10, feb:    10, mar:    10, perBatch:  10 },
  { lookupId: 'pl-11', jan:     8, feb:     8, mar:     8, perBatch:   8 },
  { lookupId: 'pl-12', jan:     6, feb:     7, mar:     7, perBatch:  10 },
  { lookupId: 'pl-13', jan:   120, feb:   120, mar:   120, perBatch: 120 },
];

function buildLookupCalls(): LookupCall[] {
  const rand = prng(770118);
  const out: LookupCall[] = [];
  const vendorRuns = RUNS.filter(r => r.populationId === 'pop-vendors' && r.status === 'passed');

  const months: { start: number; days: number; key: 'jan' | 'feb' | 'mar' }[] = [
    { start: Date.UTC(2026, 0, 1), days: 31, key: 'jan' },
    { start: Date.UTC(2026, 1, 1), days: 28, key: 'feb' },
    { start: Date.UTC(2026, 2, 1), days: 31, key: 'mar' },
  ];

  // The quarter on the guide's numbers.
  QUARTER_CALLS.forEach(spec => {
    months.forEach(month => {
      const total = spec[month.key];
      let made = 0;
      let batch = 0;
      while (made < total) {
        const size = Math.min(spec.perBatch, total - made);
        batch += 1;
        const dayOffset = Math.min(month.days - 1, Math.floor((batch / Math.ceil(total / spec.perBatch)) * (month.days - 1)));
        const at = month.start + dayOffset * DAY_MS + (10 + Math.floor(rand() * 6)) * HOUR_MS;
        const run = vendorRuns.length > 0 ? vendorRuns[Math.floor(rand() * vendorRuns.length) % vendorRuns.length] : null;
        const batchId = `${spec.lookupId}-${month.key}-${batch}`;
        for (let i = 0; i < size; i += 1) {
          out.push({
            id: `${batchId}-${i}`,
            lookupId: spec.lookupId,
            batchId,
            runId: run?.id ?? null,
            at: at + i * 900,
            ok: true,
            actor: run?.actor ?? pick(rand, SOX),
          });
        }
        made += size;
      }
    });
  });

  // Thinner volume before the quarter, so the earlier windows are not empty.
  for (let t = HISTORY_START; t < Date.UTC(2026, 0, 1); t += 7 * DAY_MS) {
    const spec = pick(rand, QUARTER_CALLS);
    const size = 20 + Math.floor(rand() * 60);
    const batchId = `${spec.lookupId}-pre-${isoDay(t)}`;
    for (let i = 0; i < size; i += 1) {
      out.push({
        id: `${batchId}-${i}`,
        lookupId: spec.lookupId,
        batchId,
        runId: null,
        at: t + 11 * HOUR_MS + i * 900,
        ok: rand() > 0.02,
        actor: pick(rand, ACTORS),
      });
    }
  }

  return out.sort((a, b) => a.at - b.at);
}

export const LOOKUP_CALLS: LookupCall[] = buildLookupCalls();

/* ──────────────────────────────────────────────────────────────────────────
 * 3 · Chat, Concierge, and the SOP-to-RACM pipeline
 * ────────────────────────────────────────────────────────────────────────── */

export interface ChatQuestion {
  id: string;
  actor: Actor;
  at: number;
  question: string;
  /** Characters in the question and its answer. Roughly four to a unit. */
  characters: number;
  /** Whether the answer's little program was re-run to check it. */
  verified: boolean;
}

const CHAT_TOPICS = [
  'Which vendors were paid twice last quarter?',
  'Show me every journal entry posted after close.',
  'Which controls have no test evidence this quarter?',
  'What changed on the vendor master in March?',
  'List exceptions still open past their due date.',
  'Which engagements are behind their planned close?',
  'How many invoices breached the three-way match?',
  'Who approved the payments above fifty lakh?',
];

function buildChat(): ChatQuestion[] {
  const rand = prng(4404);
  const out: ChatQuestion[] = [];
  let n = 0;
  for (let t = HISTORY_START; t <= ANCHOR; t += DAY_MS) {
    if (!isWeekday(t)) continue;
    const asked = 2 + Math.floor(rand() * 6);
    for (let i = 0; i < asked; i += 1) {
      n += 1;
      out.push({
        id: `chat-${n}`,
        actor: pick(rand, ACTORS),
        at: t + (9 + Math.floor(rand() * 9)) * HOUR_MS + Math.floor(rand() * 59) * MINUTE_MS,
        question: pick(rand, CHAT_TOPICS),
        characters: 900 + Math.floor(rand() * 5_400),
        verified: rand() > 0.35,
      });
    }
  }
  return out;
}

export const CHAT_QUESTIONS: ChatQuestion[] = buildChat();

/**
 * What the Concierge tools cost, and what they do not.
 *
 * Three of the six price every AI call they make. Two record a zero, which is a
 * recorded zero and not a missing one. The sixth has no cost code at all, so it
 * can be counted and never priced. The page says which is which rather than
 * adding them into one number that would be part real and part guess.
 */
export type CostRecording = 'priced' | 'records-zero' | 'no-cost-code';

export interface ConciergeTool {
  id: string;
  name: string;
  costRecording: CostRecording;
}

export const CONCIERGE_TOOL_LIST: ConciergeTool[] = [
  { id: 'ct-sop',       name: 'SOP reader',            costRecording: 'priced' },
  { id: 'ct-recon',     name: 'Reconciliation helper', costRecording: 'priced' },
  { id: 'ct-sampler',   name: 'Sample designer',       costRecording: 'priced' },
  { id: 'ct-narrative', name: 'Finding writer',        costRecording: 'records-zero' },
  { id: 'ct-mapper',    name: 'Control mapper',        costRecording: 'records-zero' },
  { id: 'ct-image',     name: 'Image analytics',       costRecording: 'no-cost-code' },
];

export interface ConciergeJob {
  id: string;
  toolId: string;
  toolName: string;
  actor: Actor;
  at: number;
  durationMs: number;
  status: 'passed' | 'failed';
  /** Paise, where the tool records a cost at all. null means no cost code. */
  costPaise: number | null;
  /** True where the job was killed for running past its time limit. */
  timedOut: boolean;
}

function buildConcierge(): ConciergeJob[] {
  const rand = prng(6006);
  const out: ConciergeJob[] = [];
  let n = 0;
  for (let t = HISTORY_START; t <= ANCHOR; t += DAY_MS) {
    if (!isWeekday(t) || rand() > 0.55) continue;
    const jobs = 1 + Math.floor(rand() * 3);
    for (let i = 0; i < jobs; i += 1) {
      n += 1;
      const tool = pick(rand, CONCIERGE_TOOL_LIST);
      const timedOut = rand() < 0.06;
      out.push({
        id: `cj-${n}`,
        toolId: tool.id,
        toolName: tool.name,
        actor: pick(rand, ACTORS),
        at: t + (10 + Math.floor(rand() * 7)) * HOUR_MS,
        durationMs: (30 + Math.floor(rand() * 260)) * 1000,
        status: timedOut ? 'failed' : rand() < 0.04 ? 'failed' : 'passed',
        costPaise: tool.costRecording === 'priced' ? 400 + Math.floor(rand() * 2_600)
          : tool.costRecording === 'records-zero' ? 0
            : null,
        timedOut,
      });
    }
  }
  return out;
}

export const CONCIERGE_JOBS: ConciergeJob[] = buildConcierge();

/** Said next to the Concierge figures, because the guide flags it as unconfirmed. */
export const CONCIERGE_WIRING_NOTE =
  'We suspect a wiring gap on the Concierge cost column: the figure may be written for some '
  + 'pipelines and not others. Once somebody confirms it, it is a one-line fix per pipeline. '
  + 'Confirming it is our job.';

export interface SopJob {
  id: string;
  actor: Actor;
  at: number;
  documentName: string;
  /** A repeat document skips the AI entirely, so job count is not spend. */
  servedFromCache: boolean;
  racmRowsProduced: number;
}

function buildSopJobs(): SopJob[] {
  const rand = prng(9110);
  const docs = ['P2P SOP v4.docx', 'O2C SOP v2.docx', 'R2R Close SOP.docx', 'ITGC Access SOP.docx', 'S2C Contracting SOP.docx'];
  const out: SopJob[] = [];
  let n = 0;
  for (let t = HISTORY_START; t <= ANCHOR; t += 5 * DAY_MS) {
    if (rand() > 0.5) continue;
    n += 1;
    const cached = n % 10 !== 1;
    out.push({
      id: `sop-${n}`,
      actor: pick(rand, [...SOX, ...IFC]),
      at: t + 11 * HOUR_MS,
      documentName: pick(rand, docs),
      servedFromCache: cached,
      racmRowsProduced: cached ? 0 : 18 + Math.floor(rand() * 26),
    });
  }
  return out;
}

export const SOP_JOBS: SopJob[] = buildSopJobs();

/* ──────────────────────────────────────────────────────────────────────────
 * 4 · Sampling, exceptions, and how long detection took
 * ────────────────────────────────────────────────────────────────────────── */

export type SampleOutcome = 'queued' | 'running' | 'passed' | 'failed' | 'errored';

export interface SampleValidation {
  id: string;
  engagementId: string;
  controlId: string;
  controlName: string;
  team: string;
  actor: Actor;
  at: number;
  outcome: SampleOutcome;
  sampleSize: number;
}

const CONTROL_NAME = new Map(CONTROL_LIBRARY.map(c => [c.controlId, c.name] as const));

function buildSampling(): SampleValidation[] {
  const rand = prng(3141);
  const out: SampleValidation[] = [];
  let n = 0;
  POPULATIONS.forEach(pop => {
    for (let t = HISTORY_START; t <= ANCHOR; t += 14 * DAY_MS) {
      if (rand() > 0.62) continue;
      n += 1;
      const roll = rand();
      const outcome: SampleOutcome = roll < 0.62 ? 'passed' : roll < 0.86 ? 'failed' : roll < 0.94 ? 'errored' : roll < 0.98 ? 'running' : 'queued';
      out.push({
        id: `sv-${n}`,
        engagementId: pop.engagementId,
        controlId: pop.controlId,
        controlName: CONTROL_NAME.get(pop.controlId) ?? pop.controlId,
        team: pop.team,
        actor: pick(rand, actorsOfTeam(pop.team).length ? actorsOfTeam(pop.team) : ACTORS),
        at: t + 12 * HOUR_MS,
        outcome,
        sampleSize: 25 + Math.floor(rand() * 40),
      });
    }
  });
  return out.sort((a, b) => a.at - b.at);
}

export const SAMPLE_VALIDATIONS: SampleValidation[] = buildSampling();

export type Severity = 'Critical' | 'High' | 'Medium' | 'Low';
export type ExceptionStatus = 'Open' | 'Triaging' | 'Resolved';

export interface TracedException {
  id: string;
  ref: string;
  title: string;
  severity: Severity;
  status: ExceptionStatus;
  engagementId: string;
  controlId: string;
  /** The run that raised it, so a finding can be traced back to its evidence. */
  runId: string | null;
  workflowName: string;
  assignee: Actor;
  team: string;
  /** When the thing actually happened in the business. */
  occurredAt: number;
  /** When the platform caught it. The gap between the two is what CCM buys. */
  detectedAt: number;
  resolvedAt: number | null;
  dueAt: number;
  /**
   * The fingerprint of the source row. Run ids and timestamps are deliberately
   * left out so it stays identical month after month and a repeat is dropped
   * rather than raised again.
   */
  fingerprint: string;
  /** True where the finding predates de-duplication and cannot be trusted to be unique. */
  beforeDeduplication: boolean;
  /**
   * How the risk owner called it. Null until somebody has looked, which is a
   * third state and not the same as calling it right or wrong.
   */
  classification: FindingClassification;
  /** Why a real finding happened. Only on the true-positive path. */
  rootCause: string | null;
  /** Why the check fired on something that was fine. Only on the false-positive path. */
  falsePositiveReason: string | null;
}

/** A risk owner's verdict on a finding, or nothing yet. */
export type FindingClassification = 'true-positive' | 'false-positive' | null;

/** Why real findings happen. The list the risk owners actually pick from. */
export const FINDING_ROOT_CAUSES = [
  'Control not performed',
  'Control performed late',
  'Master data wrong at source',
  'Approval limit not enforced',
  'System configuration drifted',
] as const;

/**
 * Why a check fired on something that was fine.
 *
 * A rising false-positive rate means a control's rule needs tuning, not that
 * the team is failing, so the reasons name the rule rather than the person.
 */
export const FALSE_POSITIVE_REASONS = [
  'Rule does not allow for the approved exception list',
  'Threshold set tighter than the policy',
  'Duplicate vendor record, same company',
  'Timing difference across period end',
] as const;

/** De-duplication shipped on this date. Findings before it are counted apart. */
export const DEDUPLICATION_SHIPPED_AT = Date.UTC(2025, 10, 1);

const EXCEPTION_TITLES = [
  'Invoice paid twice to the same vendor',
  'Vendor bank details changed without approval',
  'Journal entry posted after period close',
  'Payment released without a matching goods receipt',
  'Access granted outside the approval workflow',
  'Contract renewed past its expiry with no review',
  'Credit limit breached on an open order',
  'Chargeback priced off a stale contract rate',
  'Revenue recognised before delivery was confirmed',
  'Remittance applied to the wrong invoice',
];

/**
 * How a risk owner called one finding, and why.
 *
 * About a fifth of what is looked at turns out to be the rule firing on
 * something that was fine, and roughly a quarter of everything has not been
 * looked at yet. Both states are real and the page shows them apart: a
 * false-positive rate computed over findings nobody has classified would read
 * as perfection.
 */
function classify(rand: () => number): Pick<TracedException, 'classification' | 'rootCause' | 'falsePositiveReason'> {
  const roll = rand();
  if (roll < 0.26) return { classification: null, rootCause: null, falsePositiveReason: null };
  if (roll < 0.42) {
    return {
      classification: 'false-positive',
      rootCause: null,
      falsePositiveReason: pick(rand, FALSE_POSITIVE_REASONS),
    };
  }
  return {
    classification: 'true-positive',
    rootCause: pick(rand, FINDING_ROOT_CAUSES),
    falsePositiveReason: null,
  };
}

function buildExceptions(): TracedException[] {
  const rand = prng(2718);
  const out: TracedException[] = [];
  const severities: Severity[] = ['Critical', 'High', 'Medium', 'Low'];

  // Every exception is traced to a run that passed and found something. A
  // finding with no run behind it is a finding nobody can check.
  const candidates = RUNS.filter(r => r.status === 'passed');
  let n = 0;
  candidates.forEach((run, i) => {
    if (i % 7 !== 0) return;
    n += 1;
    const pop = populationOf(run.populationId);
    const severity = severities[Math.floor(rand() * 4) % 4];
    // Continuous checks catch a thing within a day or two. A quarterly manual
    // look catches the same thing months later. That gap is the number.
    const lagDays = run.scheduled ? 1 + Math.floor(rand() * 3) : 20 + Math.floor(rand() * 70);
    const occurredAt = run.completedAt - lagDays * DAY_MS;
    const status: ExceptionStatus = rand() < 0.42 ? 'Resolved' : rand() < 0.7 ? 'Open' : 'Triaging';
    out.push({
      id: `exc-${n}`,
      ref: `EXC-${String(n).padStart(4, '0')}`,
      title: EXCEPTION_TITLES[n % EXCEPTION_TITLES.length],
      severity,
      status,
      engagementId: run.engagementId,
      controlId: run.controlId,
      runId: run.id,
      workflowName: run.workflowName,
      assignee: run.actor,
      team: run.team,
      occurredAt,
      detectedAt: run.completedAt,
      resolvedAt: status === 'Resolved' ? run.completedAt + (2 + Math.floor(rand() * 20)) * DAY_MS : null,
      dueAt: run.completedAt + 14 * DAY_MS,
      fingerprint: `${pop?.id ?? run.populationId}:${run.controlId}:${n % 400}`,
      beforeDeduplication: run.completedAt < DEDUPLICATION_SHIPPED_AT,
      ...classify(rand),
    });
  });

  // The exceptions the engagement screens already list, kept as themselves so
  // the two screens name the same findings.
  ENGAGEMENT_EXCEPTIONS.slice(0, 12).forEach((ex, i) => {
    const actor = ACTORS.find(a => a.name === ex.assignee) ?? SOX[i % Math.max(1, SOX.length)];
    const detectedAt = ANCHOR - (3 + i * 4) * DAY_MS;
    out.push({
      id: `exc-live-${ex.id}`,
      ref: ex.ref,
      title: ex.title,
      severity: ex.severity,
      status: ex.status,
      engagementId: ex.engagementId,
      controlId: POPULATIONS.find(p => p.workflowId === ex.workflowId)?.controlId ?? 'C-001',
      runId: RUNS.find(r => r.workflowId === ex.workflowId && r.status === 'passed')?.id ?? null,
      workflowName: ex.workflowName,
      assignee: actor,
      team: actor.team,
      occurredAt: detectedAt - (1 + i) * DAY_MS,
      detectedAt,
      resolvedAt: ex.status === 'Resolved' ? detectedAt + 5 * DAY_MS : null,
      dueAt: detectedAt + 14 * DAY_MS,
      fingerprint: `live:${ex.id}`,
      beforeDeduplication: false,
      ...classify(rand),
    });
  });

  return out.sort((a, b) => a.detectedAt - b.detectedAt);
}

export const TRACED_EXCEPTIONS: TracedException[] = buildExceptions();

/* ──────────────────────────────────────────────────────────────────────────
 * 5 · Dashboards, alerts, reports
 * ────────────────────────────────────────────────────────────────────────── */

export type ProductEventKind =
  | 'dashboard-created' | 'dashboard-edited' | 'dashboard-deleted'
  | 'widget-added' | 'alert-configured' | 'alert-fired';

export interface ProductEvent {
  id: string;
  kind: ProductEventKind;
  name: string;
  /** null where the scheduled worker did it and no person was involved. */
  actor: Actor | null;
  team: string | null;
  at: number;
  /** The before-and-after the event log keeps, where there is one. */
  before?: string;
  after?: string;
}

function buildProductEvents(): ProductEvent[] {
  const rand = prng(5150);
  const out: ProductEvent[] = [];
  const catalog = [...MY_DASHBOARDS, ...SHARED_DASHBOARDS];

  catalog.forEach((dash, i) => {
    const actor = ACTORS.find(a => a.name === dash.creator) ?? pick(rand, ACTORS);
    // The seven dashboards in the catalog are spread across the whole history
    // rather than bunched at the start, so a window near the anchor has some of
    // them created inside it. There are only seven because there are only seven
    // on the Dashboards screen: this page composes, it does not invent rows.
    const createdAt = HISTORY_START + (14 + i * 40) * DAY_MS;
    if (createdAt > ANCHOR) return;
    out.push({ id: `pe-dash-${dash.id}`, kind: 'dashboard-created', name: dash.name, actor, team: actor.team, at: createdAt });
    const edits = 1 + Math.floor(rand() * 3);
    for (let e = 0; e < edits; e += 1) {
      const at = createdAt + (7 + e * 21) * DAY_MS;
      if (at > ANCHOR) break;
      out.push({
        id: `pe-dash-${dash.id}-edit-${e}`, kind: 'dashboard-edited', name: dash.name, actor, team: actor.team, at,
        before: `${3 + e} widgets`, after: `${4 + e} widgets`,
      });
      out.push({ id: `pe-widget-${dash.id}-${e}`, kind: 'widget-added', name: `Widget on ${dash.name}`, actor, team: actor.team, at: at + HOUR_MS });
    }
  });

  // Alerts. A person configures them and the platform fires them. A fire with no
  // person behind it is recorded as exactly that rather than left blank.
  POPULATIONS.forEach((pop, i) => {
    const actor = pick(rand, actorsOfTeam(pop.team).length ? actorsOfTeam(pop.team) : ACTORS);
    const at = HISTORY_START + (20 + i * 9) * DAY_MS;
    out.push({ id: `pe-alert-cfg-${pop.id}`, kind: 'alert-configured', name: `${pop.workflowName} breach alert`, actor, team: actor.team, at });
    for (let t = at + 14 * DAY_MS; t <= ANCHOR; t += (9 + i) * DAY_MS) {
      if (rand() > 0.45) continue;
      out.push({ id: `pe-alert-fire-${pop.id}-${isoDay(t)}`, kind: 'alert-fired', name: `${pop.workflowName} breach alert`, actor: null, team: pop.team, at: t + 6 * HOUR_MS });
    }
  });

  return out.sort((a, b) => a.at - b.at);
}

export const PRODUCT_EVENTS: ProductEvent[] = buildProductEvents();

export type ReportAction = 'created' | 'moved-to-final' | 'shared' | 'downloaded' | 'commented';

export interface ReportEvent {
  id: string;
  reportId: string;
  reportName: string;
  action: ReportAction;
  actor: Actor;
  team: string;
  at: number;
  /** Who it went to, on a share. */
  sharedWith?: string;
}

function buildReportTrail(): ReportEvent[] {
  const rand = prng(8080);
  const out: ReportEvent[] = [];
  const reports = [...GENERATED_REPORTS, ...SHARED_REPORTS].slice(0, 24) as { id: string; name: string }[];

  reports.forEach((rep, i) => {
    const actor = pick(rand, ACTORS);
    const createdAt = ANCHOR - (250 - i * 9) * DAY_MS;
    if (createdAt < HISTORY_START) return;
    out.push({ id: `re-${rep.id}-c`, reportId: rep.id, reportName: rep.name, action: 'created', actor, team: actor.team, at: createdAt });
    if (rand() > 0.25) {
      out.push({ id: `re-${rep.id}-f`, reportId: rep.id, reportName: rep.name, action: 'moved-to-final', actor, team: actor.team, at: createdAt + 3 * DAY_MS });
      const shares = 1 + Math.floor(rand() * 3);
      for (let s = 0; s < shares; s += 1) {
        const to = pick(rand, ACTORS);
        out.push({
          id: `re-${rep.id}-s${s}`, reportId: rep.id, reportName: rep.name, action: 'shared',
          actor, team: actor.team, at: createdAt + (4 + s * 2) * DAY_MS, sharedWith: to.name,
        });
      }
    }
    if (rand() > 0.6) {
      out.push({ id: `re-${rep.id}-d`, reportId: rep.id, reportName: rep.name, action: 'downloaded', actor: pick(rand, ACTORS), team: actor.team, at: createdAt + 9 * DAY_MS });
    }
  });

  return out.filter(e => e.at <= ANCHOR).sort((a, b) => a.at - b.at);
}

export const REPORT_TRAIL: ReportEvent[] = buildReportTrail();

/* ──────────────────────────────────────────────────────────────────────────
 * 6 · Risks, engagements, continuous monitoring
 * ────────────────────────────────────────────────────────────────────────── */

export interface RiskRow {
  id: string;
  name: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  category: string;
  owner: string;
  team: string;
  /** True where at least one control in the library maps to it. */
  mapped: boolean;
  /** True where the SOP-to-RACM pipeline proposed it rather than a person. */
  raisedByAi: boolean;
  createdAt: number;
}

function buildRisks(): RiskRow[] {
  const mappedIds = new Set(CONTROL_LIBRARY.flatMap(c => c.mappedRisks ?? []));
  return SEED_RISKS.map((risk, i) => {
    const owner = ACTORS.find(a => a.name === risk.owner) ?? ACTORS[i % ACTORS.length];
    return {
      id: risk.id,
      name: risk.name,
      priority: risk.priority,
      category: risk.category,
      owner: risk.owner,
      team: owner.team,
      mapped: mappedIds.has(risk.id),
      raisedByAi: i % 3 === 0,
      createdAt: HISTORY_START + (10 + i * 13) * DAY_MS,
    };
  }).filter(r => r.createdAt <= ANCHOR);
}

export const RISK_ROWS: RiskRow[] = buildRisks();

export interface EngagementRow {
  id: string;
  code: string;
  name: string;
  status: string;
  type: string;
  owner: string;
  reviewer: string;
  team: string;
  plannedEnd: number;
  actualEnd: number | null;
  createdAt: number;
  /** The RACM version locked at creation, so later library edits change nothing. */
  lockedRacmVersion: string;
  changes: number;
  /** How many controls the locked snapshot carries. The denominator of "tested X of Y". */
  controlsInSnapshot: number;
  /** Where the engagement's report has got to. Not every engagement has one yet. */
  reportState: 'none' | 'draft' | 'final';
  /** The period the engagement is auditing, which is what slipping is measured against. */
  auditPeriodEnd: number;
}

function buildEngagements(): EngagementRow[] {
  const rand = prng(6789);
  return ENGAGEMENTS.map((eng, i) => {
    const owner = pick(rand, ACTORS);
    const reviewer = pick(rand, ACTORS);
    const createdAt = HISTORY_START + (5 + i * 21) * DAY_MS;
    const plannedEnd = createdAt + (60 + Math.floor(rand() * 90)) * DAY_MS;
    const closed = eng.status === 'Closed';
    return {
      id: eng.id,
      code: eng.code,
      name: eng.name,
      status: eng.status,
      type: eng.type,
      owner: owner.name,
      reviewer: reviewer.name,
      team: owner.team,
      plannedEnd,
      actualEnd: closed ? plannedEnd + (Math.floor(rand() * 30) - 10) * DAY_MS : null,
      createdAt,
      lockedRacmVersion: `v${1 + (i % 4)}.${i % 3}`,
      changes: 3 + Math.floor(rand() * 22),
      controlsInSnapshot: 4 + Math.floor(rand() * 9),
      // A closed engagement has filed its report. An open one is somewhere
      // between nothing and a draft, which is exactly what the strip shows.
      reportState: (closed ? 'final' : rand() < 0.45 ? 'draft' : 'none') as EngagementRow['reportState'],
      // Planned close normally trails the period being audited by a few weeks.
      // Slipping is planned close against that period end, never against today,
      // so an engagement planning to close months after the period it audits is
      // visible whatever the calendar says.
      auditPeriodEnd: plannedEnd - (10 + Math.floor(rand() * 70)) * DAY_MS,
    };
  }).filter(e => e.createdAt <= ANCHOR);
}

export const ENGAGEMENT_ROWS: EngagementRow[] = buildEngagements();

export interface CcmRow {
  engagementId: string;
  engagementName: string;
  team: string;
  /** The pass-rate the engagement is configured to hold to. */
  thresholdPct: number;
  approvalLevels: number;
  alertsOn: boolean;
}

/**
 * Continuous monitoring is a mode of an engagement, not a separate feature.
 *
 * Which engagements are on a schedule follows the populations that are actually
 * re-tested on one, so a team that runs scheduled checks has scheduled
 * engagements to read about. Deriving it from the engagement list in order
 * instead would hand whole teams an empty block for no reason but the seed.
 */
export const CCM_ROWS: CcmRow[] = [...new Set(POPULATIONS.filter(p => p.cadence !== 'twice-monthly').map(p => p.engagementId))]
  .map((engagementId, i) => {
    const eng = ENGAGEMENT_ROWS.find(e => e.id === engagementId);
    const pop = POPULATIONS.find(p => p.engagementId === engagementId)!;
    return {
      engagementId,
      engagementName: eng?.name ?? pop.workflowName,
      team: pop.team,
      thresholdPct: 80,
      approvalLevels: 2 + (i % 2),
      alertsOn: i % 4 !== 3,
    };
  });

/* ──────────────────────────────────────────────────────────────────────────
 * 6b · What the assistant noticed, and what a person then decided
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * An insight the platform generated by itself.
 *
 * Two kinds, and they must never be added together. A per-run insight is
 * something the assistant noticed inside one check. A consolidated insight is
 * the assistant reading a whole engagement's runs and saying one thing about
 * all of them, so counting both as "insights generated" would count the same
 * observation twice: once in its own right and once inside the summary that
 * describes it.
 */
export type InsightKind = 'per-run' | 'consolidated';

export interface AiInsight {
  id: string;
  kind: InsightKind;
  title: string;
  category: string;
  severity: Severity;
  /** Whether anybody has done anything with it. */
  status: 'new' | 'acknowledged' | 'actioned' | 'dismissed';
  engagementId: string;
  team: string;
  actor: Actor;
  at: number;
}

const INSIGHT_CATEGORIES = ['Data quality', 'Control design', 'Timing', 'Concentration', 'Process drift'];

const PER_RUN_INSIGHTS = [
  'Nine of the exceptions share one vendor',
  'The same approver signs off every breach in this sample',
  'Half of these postings land in the last two days of the month',
  'Two vendor records look like the same company under different names',
  'Amounts cluster just under the approval limit',
];

const CONSOLIDATED_INSIGHTS = [
  'Exceptions in this engagement concentrate in one cost centre',
  'The failure pattern is timing, not authorisation',
  'This control has caught nothing in three cycles',
  'Findings rose after the master-data migration in November',
];

function buildInsights(): AiInsight[] {
  const rand = prng(31415);
  const severities: Severity[] = ['Critical', 'High', 'Medium', 'Low'];
  const statuses: AiInsight['status'][] = ['new', 'acknowledged', 'actioned', 'dismissed'];
  const out: AiInsight[] = [];

  // Per-run insights hang off runs that actually found something, so opening
  // one lands on the run whose data produced it.
  RUNS.filter(r => r.status === 'passed').forEach((run, i) => {
    if (i % 11 !== 0) return;
    out.push({
      id: `ins-run-${run.id}`,
      kind: 'per-run',
      title: PER_RUN_INSIGHTS[out.length % PER_RUN_INSIGHTS.length],
      category: INSIGHT_CATEGORIES[out.length % INSIGHT_CATEGORIES.length],
      severity: severities[Math.floor(rand() * 4) % 4],
      status: statuses[Math.floor(rand() * 4) % 4],
      engagementId: run.engagementId,
      team: run.team,
      actor: run.actor,
      at: run.completedAt,
    });
  });

  // Consolidated insights are written once per engagement per month it was
  // active, which is what makes them far rarer than the per-run kind.
  ENGAGEMENT_ROWS.forEach((eng, i) => {
    const count = 1 + Math.floor(rand() * 3);
    for (let n = 0; n < count; n += 1) {
      const at = eng.createdAt + (30 + n * 45 + Math.floor(rand() * 20)) * DAY_MS;
      if (at > ANCHOR) continue;
      const actor = ACTORS.find(a => a.name === eng.owner) ?? ACTORS[(i + n) % ACTORS.length];
      out.push({
        id: `ins-eng-${eng.id}-${n}`,
        kind: 'consolidated',
        title: CONSOLIDATED_INSIGHTS[(i + n) % CONSOLIDATED_INSIGHTS.length],
        category: INSIGHT_CATEGORIES[(i + n) % INSIGHT_CATEGORIES.length],
        severity: severities[Math.floor(rand() * 4) % 4],
        status: statuses[Math.floor(rand() * 4) % 4],
        engagementId: eng.id,
        team: eng.team,
        actor,
        at,
      });
    }
  });

  return out.sort((a, b) => a.at - b.at);
}

export const AI_INSIGHTS: AiInsight[] = buildInsights();

/**
 * An action plan: what somebody agreed to do about a finding.
 *
 * Raised off findings a risk owner called real, because nobody writes a plan
 * for a false alarm. Closing one takes two gates, so an open plan is a real
 * piece of outstanding work rather than a tick nobody has clicked.
 */
export interface ActionPlan {
  id: string;
  exceptionId: string;
  engagementId: string;
  title: string;
  owner: Actor;
  team: string;
  openedAt: number;
  closedAt: number | null;
  dueAt: number;
}

function buildActionPlans(): ActionPlan[] {
  const rand = prng(1618);
  return TRACED_EXCEPTIONS
    .filter(ex => ex.classification === 'true-positive')
    .filter((_, i) => i % 3 === 0)
    .map(ex => {
      const openedAt = ex.detectedAt + (1 + Math.floor(rand() * 5)) * DAY_MS;
      const closed = ex.status === 'Resolved' && rand() < 0.7;
      return {
        id: `ap-${ex.id}`,
        exceptionId: ex.id,
        engagementId: ex.engagementId,
        title: `Remediate: ${ex.title}`,
        owner: ex.assignee,
        team: ex.team,
        openedAt,
        closedAt: closed ? openedAt + (7 + Math.floor(rand() * 30)) * DAY_MS : null,
        dueAt: openedAt + 30 * DAY_MS,
      };
    })
    .filter(ap => ap.openedAt <= ANCHOR);
}

export const ACTION_PLANS: ActionPlan[] = buildActionPlans();

/**
 * When each control in the library was added, and by whom.
 *
 * The Control Library screen carries no creation stamp of its own in this
 * prototype, so the dates are laid back across the history at a steady rate.
 * The count on this page and the count on that screen still agree, because
 * both are the same fourteen rows.
 */
export interface ControlCreation {
  id: string;
  name: string;
  owner: string;
  team: string;
  at: number;
  /** The assistant proposes controls off an SOP; a person types the rest. */
  raisedByAi: boolean;
}

function buildControlCreations(): ControlCreation[] {
  const rand = prng(2024);
  const span = ANCHOR - HISTORY_START;
  return CONTROL_LIBRARY.map((c, i) => {
    const actor = ACTORS.find(a => a.name === c.owner) ?? ACTORS[i % ACTORS.length];
    return {
      id: c.controlId,
      name: c.name,
      owner: actor.name,
      team: actor.team,
      at: HISTORY_START + Math.floor((span * (i + 0.5)) / CONTROL_LIBRARY.length),
      raisedByAi: rand() < 0.35,
    };
  });
}

export const CONTROL_CREATIONS: ControlCreation[] = buildControlCreations();

/* ──────────────────────────────────────────────────────────────────────────
 * 7 · The hand work the assumptions measure themselves from
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * A person checking rows by hand, meaning an exception assigned then resolved.
 *
 * This is the recorded proxy the row-rate assumption calibrates against. It is
 * close to row-checking rather than the same work, and the page says so. We use
 * it because it is recorded, and a guess would not be.
 */
export interface ManualReview {
  id: string;
  actor: Actor;
  team: string;
  assignedAt: number;
  resolvedAt: number;
  rowsCovered: number;
}

/**
 * Timed manual reviews.
 *
 * Deliberately 47 of them. The guard wants sixty before it replaces a shipped
 * starting value with a measured one, so the row-rate stays labelled a starting
 * value and the page says why. The other assumption below has enough history and
 * does switch, so both states are visible on one screen.
 */
function buildManualReviews(): ManualReview[] {
  const rand = prng(4747);
  const out: ManualReview[] = [];
  for (let i = 0; i < 47; i += 1) {
    const assignedAt = ANCHOR - (118 - i * 2) * DAY_MS;
    const rows = 120 + Math.floor(rand() * 900);
    // Around 198 rows an hour, with the odd review left open over a weekend,
    // which the trim exists to throw away rather than believe.
    const hours = i % 17 === 0 ? 60 + rand() * 12 : rows / (185 + rand() * 26);
    out.push({
      id: `mr-${i + 1}`,
      actor: pick(rand, ACTORS),
      team: pick(rand, ACTORS).team,
      assignedAt,
      resolvedAt: assignedAt + hours * HOUR_MS,
      rowsCovered: rows,
    });
  }
  return out;
}

export const MANUAL_REVIEWS: ManualReview[] = buildManualReviews();

/** A manual control test with start and finish times on it. */
export interface ManualControlTest {
  id: string;
  controlId: string;
  actor: Actor;
  startedAt: number;
  finishedAt: number;
}

/** Thirty-eight of these across 132 days: past both guards, so it calibrates. */
function buildManualControlTests(): ManualControlTest[] {
  const rand = prng(3838);
  const out: ManualControlTest[] = [];
  for (let i = 0; i < 38; i += 1) {
    const startedAt = ANCHOR - (132 - i * 3) * DAY_MS + 10 * HOUR_MS;
    const hours = 3.2 + rand() * 0.9;
    out.push({
      id: `mct-${i + 1}`,
      controlId: CONTROL_LIBRARY[i % CONTROL_LIBRARY.length].controlId,
      actor: pick(rand, ACTORS),
      startedAt,
      finishedAt: startedAt + hours * HOUR_MS,
    });
  }
  return out;
}

export const MANUAL_CONTROL_TESTS: ManualControlTest[] = buildManualControlTests();

/* ──────────────────────────────────────────────────────────────────────────
 * 8 · What is waiting on a person
 * ────────────────────────────────────────────────────────────────────────── */

export type QueueKind = 'exception' | 'approval' | 'action-plan' | 'review';

export interface QueueItem {
  id: string;
  kind: QueueKind;
  title: string;
  detail: string;
  assignee: Actor;
  dueAt: number;
  /** Where the work actually happens. The page itself changes nothing. */
  target: { view: string; id?: string };
}

/**
 * The queue, built from things that already exist rather than a new list.
 *
 * Open exceptions assigned to a person, engagements they review, action plans
 * they own. The view is what puts the overdue ones first.
 */
function buildQueue(): QueueItem[] {
  const out: QueueItem[] = [];

  TRACED_EXCEPTIONS
    .filter(ex => ex.status !== 'Resolved')
    .slice(-40)
    .forEach(ex => {
      out.push({
        id: `q-${ex.id}`,
        kind: 'exception',
        title: ex.title,
        detail: `${ex.severity} · ${ex.ref} · raised by ${ex.workflowName}`,
        assignee: ex.assignee,
        dueAt: ex.dueAt,
        target: { view: 'engagements', id: ex.engagementId },
      });
    });

  ENGAGEMENT_ROWS
    .filter(e => e.actualEnd === null)
    .slice(0, 8)
    .forEach((eng, i) => {
      const actor = ACTORS.find(a => a.name === eng.reviewer) ?? ACTORS[i % ACTORS.length];
      out.push({
        id: `q-rev-${eng.id}`,
        kind: 'review',
        title: `Review ${eng.name}`,
        detail: `${eng.code} · planned close ${formatDate(eng.plannedEnd)}`,
        assignee: actor,
        dueAt: eng.plannedEnd,
        target: { view: 'engagements', id: eng.id },
      });
    });

  SAMPLE_VALIDATIONS
    .filter(sv => sv.outcome === 'failed')
    .slice(-10)
    .forEach(sv => {
      out.push({
        id: `q-plan-${sv.id}`,
        kind: 'action-plan',
        title: `Action plan for ${sv.controlName}`,
        detail: `Sample of ${sv.sampleSize} failed on ${formatDate(sv.at)}`,
        assignee: sv.actor,
        dueAt: sv.at + 21 * DAY_MS,
        target: { view: 'engagements', id: sv.engagementId },
      });
    });

  return out;
}

export const QUEUE_ITEMS: QueueItem[] = buildQueue();

/* ── Small shared helpers ────────────────────────────────────────────────── */

export const within = (ms: number, from: number, to: number): boolean => ms >= from && ms <= to;

/** Controls in the library, counted off the same rows the library screen draws. */
export const CONTROLS = CONTROL_LIBRARY.map(c => ({
  id: c.controlId,
  name: c.name,
  process: c.businessProcess,
  owner: c.owner,
  automation: c.automation,
  status: c.status,
}));
