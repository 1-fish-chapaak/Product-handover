/**
 * Platform Usage — the records the platform already keeps.
 *
 * Built from `Platform-Usage-Build-Spec_6.pdf` (11 Aug 2026). Part 2 of that
 * document is a survey of what the product writes down as it works, and this
 * module is that survey turned into data: workflow runs, chat questions,
 * Concierge jobs, SOP-to-RACM jobs, sample validations, generated insights, the
 * before-and-after event log behind dashboards and alerts, the reports trail,
 * the risk register, the engagement portfolio and its automation config.
 *
 * Two rules hold this file together.
 *
 * **It composes, it does not invent.** Every record is derived from a table the
 * rest of the product already renders — the Workflow Library's own run counts,
 * the Control Library's own controls, the exception register, the engagement
 * list, the report list, the risk register, the dashboard catalog, the member
 * list. When Platform Usage says "14 controls in the library" it counts the same
 * fourteen rows the Control Library screen draws, so two screens can never
 * disagree in front of the same reader.
 *
 * **It is a fixed seed, not a clock.** ANCHOR is Tue 21 Apr 2026, the newest
 * moment anything in this product has happened. History runs back to 1 Oct 2025
 * so the longest window the page offers still has an equal window behind it to
 * compare against. A fixed-seed PRNG, no `Date.now()`, no `Math.random()`: every
 * reload, screenshot and test sees the identical history.
 *
 * The costs are the exception to the first rule, because there is nothing to
 * compose from: the product records no money except one Concierge column, so the
 * vendor's monthly bill is entered by a person (PU-19) and lives in
 * localStorage next to the audited change log for it.
 */

import { WORKFLOWS } from './mockData';
import { GENERATED_REPORTS, SHARED_REPORTS } from './mockData';
import { CONTROL_LIBRARY } from './controlLibrary';
import { SEED_RISKS } from './riskRegister';
import { ENGAGEMENTS } from './engagements';
import { ENGAGEMENT_EXCEPTIONS } from './engagement-exceptions';
import { MY_DASHBOARDS, SHARED_DASHBOARDS } from './dashboards';
import { PROCESS_HUB_RACMS } from './racmRegistry';
import { SEED_USERS } from '../context/AdminDataContext';

/* ──────────────────────────────────────────────────────────────────────────
 * The one line that says what this page does and does not count
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * The coverage note.
 *
 * Defined once, rendered on screen and in both exports, so when a later release
 * widens what is counted one string changes and every surface follows. Section 8
 * of the spec puts this string in the API response for exactly that reason.
 */
export const COVERAGE_NOTE =
  'Counts workflow runs, chat questions, Concierge jobs, sample validations, generated insights, '
  + 'dashboards and the alerts they fire, reports and their activity, the risk register, the '
  + 'engagement portfolio, continuous monitoring, and everything created in the window. '
  + 'It does not count edits, reviews, views or time spent inside a record, and it prices '
  + 'nothing the vendor has not billed.';

/* ── Time ────────────────────────────────────────────────────────────────── */

export const DAY_MS = 86_400_000;
export const HOUR_MS = 3_600_000;

/** The newest moment in the record — Tue 21 Apr 2026, 18:00 UTC. */
export const ANCHOR = Date.UTC(2026, 3, 21, 18, 0, 0);

/** The oldest — Wed 1 Oct 2025, so the longest window has a window behind it. */
export const HISTORY_START = Date.UTC(2025, 9, 1, 0, 0, 0);

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
 * How old the numbers are, said on every view.
 *
 * The seed does not move, so the page says the date of the newest record it can
 * find rather than "updated 4 minutes ago". A freshness claim a mock cannot keep
 * is a lying label.
 */
export const dataAsOfLabel = (): string => `Data as of ${formatDate(ANCHOR)}`;

/** First of the month a moment falls in, UTC. */
export const startOfMonthUtc = (ms: number): number => {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
};

/** Every month a window touches, first of month, oldest first. */
export function monthsInWindow(from: number, to: number): number[] {
  const out: number[] = [];
  let m = startOfMonthUtc(from);
  while (m <= to) {
    out.push(m);
    const d = new Date(m);
    m = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
  }
  return out;
}

const MONTH_INDEX: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

/**
 * "Apr 15, 2026" to a moment.
 *
 * The Workflow Library, Control Library, report list and RACM registry all write
 * their dates this way, and this page reads all four.
 */
export function parseLibraryDate(value: string): number | null {
  const m = /^([A-Z][a-z]{2})\s+(\d{1,2}),\s+(\d{4})$/.exec(value.trim());
  if (!m) return null;
  const month = MONTH_INDEX[m[1]];
  if (month === undefined) return null;
  return Date.UTC(Number(m[3]), month, Number(m[2]), 12, 0, 0);
}

/** ISO "2026-04-01" to a moment. */
export function parseIsoDate(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0) : null;
}

/**
 * "4h ago" / "2 days ago" / "3d ago" to a moment before the anchor.
 *
 * Several of the product's seeds carry relative times because they are rendered
 * as relative times. Reading them against the anchor keeps them on the same
 * calendar as everything else here.
 */
export function parseRelative(value: string): number | null {
  const m = /^(\d+)\s*(m|min|mins|minutes?|h|hrs?|hours?|d|days?|w|weeks?|mo|months?)\s+ago$/i.exec(value.trim());
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  if (unit.startsWith('m') && !unit.startsWith('mo')) return ANCHOR - n * 60_000;
  if (unit.startsWith('h')) return ANCHOR - n * HOUR_MS;
  if (unit.startsWith('d')) return ANCHOR - n * DAY_MS;
  if (unit.startsWith('w')) return ANCHOR - n * 7 * DAY_MS;
  return ANCHOR - n * 30 * DAY_MS;
}

/* ── Deterministic randomness ────────────────────────────────────────────── */

/** mulberry32 — small, evenly spread, and a fixed seed means a fixed history. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Vary a figure by ±spread, deterministically. */
const vary = (base: number, spread: number, r: () => number): number =>
  Math.max(1, Math.round(base * (1 - spread + r() * spread * 2)));

/** Nobody runs a workflow at 3am. Business hours on weekdays, thin at weekends. */
function workingMoment(dayMs: number, r: () => number): number {
  const dow = new Date(dayMs).getUTCDay();
  const weekend = dow === 0 || dow === 6;
  const hour = weekend ? 10 + Math.floor(r() * 4) : 9 + Math.floor(r() * 9);
  return dayMs + hour * HOUR_MS + Math.floor(r() * 60) * 60_000;
}

const startOfDay = (ms: number): number => Math.floor(ms / DAY_MS) * DAY_MS;
const HISTORY_DAYS = Math.round((ANCHOR - HISTORY_START) / DAY_MS);

/* ──────────────────────────────────────────────────────────────────────────
 * Who does the work
 * ────────────────────────────────────────────────────────────────────────── */

/** Roles that can run a workflow. Only these members ever appear as an actor. */
const RUNNER_ROLES = new Set(['role-admin', 'role-enabler', 'role-auditor']);

export interface Actor { name: string; email: string; team: string; weight: number }

/**
 * The people whose work this page reports.
 *
 * Every actor is a real member of the People list. An event by somebody who is
 * not on that list can never be attributed, and its work would silently vanish
 * from the page. A member who is suspended or inactive still appears in history
 * — their work happened — but they do not pick up new runs.
 */
const ACTORS: Actor[] = SEED_USERS
  .filter(u => RUNNER_ROLES.has(u.roleId))
  .map((u, i) => ({
    name: u.name,
    email: u.email,
    team: u.team && u.team !== '—' ? u.team : 'Unassigned',
    // A heavier weight means more of the runs. Admins and enablers drive the
    // automation; auditors run fewer, larger jobs.
    weight: u.status === 'Active' ? (u.roleId === 'role-auditor' ? 2 : 3) + (i % 2) : 1,
  }));

const ACTOR_WEIGHT_TOTAL = ACTORS.reduce((s, a) => s + a.weight, 0);

function pickActor(r: () => number): Actor {
  let t = r() * ACTOR_WEIGHT_TOTAL;
  for (const a of ACTORS) {
    t -= a.weight;
    if (t <= 0) return a;
  }
  return ACTORS[ACTORS.length - 1];
}

const TEAM_BY_NAME = new Map(SEED_USERS.map(u => [u.name, u.team && u.team !== '—' ? u.team : null]));
const EMAIL_BY_NAME = new Map(SEED_USERS.map(u => [u.name, u.email]));

/** Which team a named person is on, or null when they are on none. */
export const teamOfName = (name: string): string | null => TEAM_BY_NAME.get(name) ?? null;
/** A named person's address, for scoping a view to one member. */
export const emailOfName = (name: string): string | null => EMAIL_BY_NAME.get(name) ?? null;

/** Every team with at least one member, alphabetical. */
export const TEAMS: string[] = Array.from(
  new Set(SEED_USERS.map(u => u.team).filter((t): t is string => Boolean(t) && t !== '—')),
).sort();

/* ──────────────────────────────────────────────────────────────────────────
 * §2.1 Workflow runs — the backbone
 * ────────────────────────────────────────────────────────────────────────── */

/** A run's stored outcome. Paused for more than 24 hours reads as stuck. */
export type RunStatus = 'complete' | 'failed' | 'blocked' | 'paused';

/**
 * One execution of one workflow.
 *
 * This is the record every value figure on the page is computed from: how many
 * rows it worked through, how long the engine took, whether it finished, and
 * which control it belongs to. `rowCount` is null on a control test — a control
 * test has no row output, and it replaces a manual test rather than a manual
 * review, so it is valued differently (PU-01).
 */
export interface WorkflowRun {
  id: string;
  workflowId: string;
  workflowName: string;
  /** The control this run exercises, when the library links one. */
  controlId: string | null;
  controlName: string | null;
  status: RunStatus;
  /** Rows the run worked through. Null on a control test. */
  rowCount: number | null;
  durationSecs: number;
  startedAt: number;
  /** Null while a run is still blocked or paused. */
  completedAt: number | null;
  /** When the row was last written — what makes a paused run stuck. */
  updatedAt: number;
  actor: Actor;
  /** Set when the run was part of a bulk execution. */
  bulkRunId: string | null;
  /** The engine's own words. Shown verbatim, never summarised. */
  error: string | null;
}

/**
 * How much data each workflow chews through, how fast the engine is, and how
 * often it falls over.
 *
 * `perMonth` is the Workflow Library's own run count, which that screen presents
 * as recent activity, so it is read here as runs in the last thirty days and
 * played back across the calendar. `controlTest` marks the two workflows that
 * stand in for a manual control test and produce no rows.
 */
interface RunProfile {
  rows: number;
  /** Engine seconds per thousand rows, on top of a fixed start-up cost. */
  secsPerThousand: number;
  failRate: number;
  controlTest?: boolean;
}

const RUN_PROFILE: Record<string, RunProfile> = {
  'wf-001': { rows: 4_200, secsPerThousand: 7, failRate: 0.02 },
  'wf-002': { rows: 600, secsPerThousand: 9, failRate: 0 },
  'wf-003': { rows: 1_100, secsPerThousand: 6, failRate: 0.015 },
  'wf-004': { rows: 2_300, secsPerThousand: 11, failRate: 0 },
  'wf-005': { rows: 8_000, secsPerThousand: 5, failRate: 0.045 },
  'wf-006': { rows: 0, secsPerThousand: 0, failRate: 0, controlTest: true },
  'wf-007': { rows: 2_800, secsPerThousand: 8, failRate: 0.089 },
  'wf-008': { rows: 0, secsPerThousand: 0, failRate: 0.01, controlTest: true },
  'wf-009': { rows: 700, secsPerThousand: 7, failRate: 0.02 },
  'wf-010': { rows: 1_900, secsPerThousand: 6, failRate: 0.03 },
  'wf-011': { rows: 850, secsPerThousand: 9, failRate: 0.06 },
};

/** The control each workflow exercises, straight off the Control Library. */
const CONTROL_FOR_WORKFLOW: Record<string, { id: string; name: string }> = (() => {
  const out: Record<string, { id: string; name: string }> = {};
  for (const c of CONTROL_LIBRARY) {
    for (const wfId of c.linkedWorkflowIds ?? []) out[wfId] = { id: c.controlId, name: c.name };
  }
  return out;
})();

/**
 * Engine errors, verbatim.
 *
 * These are the strings the page shows a team lead. They are written the way an
 * engine writes them, because a summarised error is an error nobody can fix —
 * PU-11 forbids truncating them.
 */
const ERRORS = [
  'Match validation failed at step 4 — missing GRN reference for PO 4500118842',
  'Data source timed out after 120s — SAP_FI connection pool exhausted',
  'Column "invoice_date" not found in Invoice_Master.xlsx — schema changed on 14 Apr',
  'Vendor master lookup returned 503 from the registry service',
  'Tolerance rule rejected: expected numeric, received "N/A" on 214 rows',
  'Out of memory at row 61,004 — split the file and re-run',
];

/** What a run is waiting on when it is paused rather than failed. */
const WAITING = [
  'Waiting on input — a reviewer must confirm 3 flagged matches',
  'Waiting on input — the AP owner has not chosen a tolerance',
];

function buildRuns(): WorkflowRun[] {
  const r = mulberry32(0x50_55_31); // "PU1"
  const runs: WorkflowRun[] = [];
  let seq = 0;

  for (const wf of WORKFLOWS) {
    const profile = RUN_PROFILE[wf.id];
    if (!profile) continue;
    const control = CONTROL_FOR_WORKFLOW[wf.id] ?? null;
    // The library's count is the last thirty days. Spread that pace across the
    // whole history, with a gentle upward trend so "up on last period" is a
    // fact about the seed rather than an accident of it.
    const perDay = wf.runs / 30;

    for (let day = 0; day < HISTORY_DAYS; day++) {
      const dayMs = startOfDay(HISTORY_START) + day * DAY_MS;
      const dow = new Date(dayMs).getUTCDay();
      const weekend = dow === 0 || dow === 6;
      const trend = 0.72 + (day / HISTORY_DAYS) * 0.56; // 0.72 → 1.28
      const expected = perDay * trend * (weekend ? 0.15 : 1.2);
      let count = Math.floor(expected);
      if (r() < expected - count) count += 1;

      for (let i = 0; i < count; i++) {
        const startedAt = workingMoment(dayMs, r);
        if (startedAt > ANCHOR) continue;
        const rowCount = profile.controlTest ? null : vary(profile.rows, 0.35, r);
        const durationSecs = profile.controlTest
          ? vary(95, 0.4, r)
          : Math.max(8, Math.round(18 + ((rowCount ?? 0) / 1000) * profile.secsPerThousand * (0.8 + r() * 0.5)));

        // Outcome. Failures carry the engine's text; a handful of the newest
        // runs are still waiting on a person, which is what "stuck" means.
        let status: RunStatus = 'complete';
        let error: string | null = null;
        const roll = r();
        if (roll < profile.failRate) {
          status = 'failed';
          // A repeated error is the fact a team lead acts on, so a workflow
          // mostly fails for one reason rather than scattering across six. The
          // same mapping fault four times in a week is one afternoon's work; six
          // different faults is a different problem, and the page should be able
          // to tell them apart.
          const own = Number(wf.id.slice(3)) % ERRORS.length;
          error = ERRORS[r() < 0.82 ? own : (own + 1 + Math.floor(r() * (ERRORS.length - 1))) % ERRORS.length];
        }

        const completedAt = status === 'complete' ? startedAt + durationSecs * 1000 : null;
        seq += 1;
        runs.push({
          id: `run-${String(seq).padStart(5, '0')}`,
          workflowId: wf.id,
          workflowName: wf.name,
          controlId: control?.id ?? null,
          controlName: control?.name ?? null,
          status,
          rowCount,
          durationSecs,
          startedAt,
          completedAt,
          updatedAt: completedAt ?? startedAt + durationSecs * 1000,
          actor: pickActor(r),
          bulkRunId: null,
          error,
        });
      }
    }
  }

  runs.sort((a, b) => a.startedAt - b.startedAt);

  /* Bulk executions. A bulk run is one unit of work that fires several
   * workflows, and the spec is explicit that a bulk job and a single run are
   * never added together, so the runs carry the bulk id and the bulk runs are
   * counted on their own. */
  const rb = mulberry32(0x62_75_6c); // "bul"
  let bulk = 0;
  for (let i = 0; i < runs.length; i++) {
    if (rb() < 0.06) {
      bulk += 1;
      const id = `bulk-${String(bulk).padStart(3, '0')}`;
      for (let j = i; j < Math.min(i + 3 + Math.floor(rb() * 3), runs.length); j++) runs[j].bulkRunId = id;
      i += 4;
    }
  }

  /* The stuck tail. Two runs waiting on a person for more than a day and one
   * blocked by a permission, all inside the newest week, so the Head of Team
   * view opens on something real. */
  const recent = runs.filter(x => x.startedAt > ANCHOR - 6 * DAY_MS && x.status === 'complete');
  const stall = (run: WorkflowRun, status: RunStatus, note: string, hoursAgo: number) => {
    run.status = status;
    run.completedAt = null;
    run.startedAt = ANCHOR - hoursAgo * HOUR_MS;
    run.updatedAt = run.startedAt + HOUR_MS;
    run.error = note;
  };
  const waitA = recent.find(x => x.workflowId === 'wf-010');
  const waitB = recent.find(x => x.workflowId === 'wf-001' && x !== waitA);
  const blocked = recent.find(x => x.workflowId === 'wf-005');
  if (waitA) stall(waitA, 'paused', WAITING[0], 26);
  if (waitB) stall(waitB, 'paused', WAITING[1], 41);
  if (blocked) stall(blocked, 'blocked', 'Blocked — the data source credential expired on 19 Apr', 30);

  /* One mapping fault, four times in a week. This is the shape the page exists
   * to surface: a team lead cannot act on "six runs failed", but they can act on
   * one workflow failing four times for one reason, because fixing that mapping
   * clears most of the queue. */
  const repeats = runs
    .filter(x => x.workflowId === 'wf-007' && x.status === 'complete' && x.startedAt > ANCHOR - 7 * DAY_MS)
    .slice(0, 4);
  for (const run of repeats) {
    run.status = 'failed';
    run.completedAt = null;
    run.error = ERRORS[0];
  }

  return runs;
}

/** Every workflow execution the platform has recorded. */
export const RUNS: WorkflowRun[] = buildRuns();

/** The bulk executions, as a unit of their own. */
export const BULK_RUNS: { id: string; at: number; runCount: number }[] = (() => {
  const byId = new Map<string, { id: string; at: number; runCount: number }>();
  for (const run of RUNS) {
    if (!run.bulkRunId) continue;
    const row = byId.get(run.bulkRunId);
    if (row) { row.runCount += 1; row.at = Math.min(row.at, run.startedAt); }
    else byId.set(run.bulkRunId, { id: run.bulkRunId, at: run.startedAt, runCount: 1 });
  }
  return Array.from(byId.values()).sort((a, b) => a.at - b.at);
})();

/** Workflows the library holds that have never run, ever (PU-07). */
export const NEVER_RUN_WORKFLOWS: string[] = WORKFLOWS
  .filter(wf => !RUNS.some(run => run.workflowId === wf.id))
  .map(wf => wf.name)
  .sort();

/* ──────────────────────────────────────────────────────────────────────────
 * §2.2 Chat — every question, and the work behind the answer
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * One question asked of the assistant.
 *
 * `tokens` is the product's own estimate: the code divides the text length by
 * four to stop a runaway conversation, and its own comment calls that a stopgap.
 * It is carried here because the page shows it, and shown only ever with the
 * word "estimated" next to it (PU-12, PU-16).
 */
export interface ChatQuestion {
  id: string;
  at: number;
  actor: Actor;
  /** Abilities the assistant used to answer — the recorded step count. */
  steps: number;
  /** Estimated, not measured. Text length over four. */
  tokens: number;
  /** Whether the answer's program was frozen into the workflow library. */
  savedAsWorkflow: boolean;
  /** Every answer stores the program behind it, so every answer can be re-run. */
  rerunnable: true;
}

function buildChat(): ChatQuestion[] {
  const r = mulberry32(0x63_68_74); // "cht"
  const out: ChatQuestion[] = [];
  let seq = 0;
  for (let day = 0; day < HISTORY_DAYS; day++) {
    const dayMs = startOfDay(HISTORY_START) + day * DAY_MS;
    const dow = new Date(dayMs).getUTCDay();
    const weekend = dow === 0 || dow === 6;
    const trend = 0.6 + (day / HISTORY_DAYS) * 0.9;
    const expected = (weekend ? 0.4 : 3.4) * trend;
    let count = Math.floor(expected);
    if (r() < expected - count) count += 1;
    for (let i = 0; i < count; i++) {
      const at = workingMoment(dayMs, r);
      if (at > ANCHOR) continue;
      seq += 1;
      out.push({
        id: `qna-${String(seq).padStart(5, '0')}`,
        at,
        actor: pickActor(r),
        steps: 3 + Math.floor(r() * 7),
        tokens: vary(2_400, 0.55, r),
        savedAsWorkflow: r() < 0.08,
        rerunnable: true,
      });
    }
  }
  return out;
}

/** Every question asked of the assistant. */
export const CHAT_QUESTIONS: ChatQuestion[] = buildChat();

/* ──────────────────────────────────────────────────────────────────────────
 * §2.3 Concierge — the only place the product records money
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * How each Concierge tool handles cost, read off the spec's own table of the
 * worker code. Three tools price every AI call. One has no cost code at all.
 * Two set the total to zero literally, which is not the same as costing nothing
 * — so those jobs are recorded as unpriced rather than as free.
 */
type CostWiring = 'priced' | 'none' | 'hardcoded-zero';

const CONCIERGE_COST_WIRING: Record<string, CostWiring> = {
  'table': 'priced',
  'medical-report-reader': 'priced',
  'insights-anomaly': 'priced',
  'forensics': 'none',
  'image-analytics': 'hardcoded-zero',
  'speech-auditor': 'hardcoded-zero',
  // The RACM generator is the SOP-to-RACM pipeline; it records nothing about
  // consumption at all, so it is kept as its own record type below.
};

const CONCIERGE_TITLE: Record<string, string> = {
  'table': 'Table Extractor',
  'medical-report-reader': 'Medical Report Reader',
  'insights-anomaly': 'Insights & Anomaly Report',
  'forensics': 'Document Forensics',
  'image-analytics': 'Image Analytics',
  'speech-auditor': 'Speech Auditor',
};

/** One Concierge background job. The only record in the product with a price. */
export interface ConciergeJob {
  id: string;
  toolId: string;
  toolTitle: string;
  at: number;
  actor: Actor;
  status: 'completed' | 'failed';
  durationSecs: number;
  /** Dollars the AI calls actually cost, when the pipeline prices them. */
  llmCostUsd: number | null;
  /** How the number got there, so a zero is never read as free. */
  costWiring: CostWiring;
}

function buildConcierge(): ConciergeJob[] {
  const r = mulberry32(0x63_6f_6e); // "con"
  const out: ConciergeJob[] = [];
  const tools = Object.keys(CONCIERGE_COST_WIRING);
  let seq = 0;
  for (let day = 0; day < HISTORY_DAYS; day++) {
    const dayMs = startOfDay(HISTORY_START) + day * DAY_MS;
    const dow = new Date(dayMs).getUTCDay();
    // Concierge ships behind a flag, so the volume is modest by design.
    const expected = dow === 0 || dow === 6 ? 0.08 : 0.85;
    let count = Math.floor(expected);
    if (r() < expected - count) count += 1;
    for (let i = 0; i < count; i++) {
      const at = workingMoment(dayMs, r);
      if (at > ANCHOR) continue;
      const toolId = tools[Math.floor(r() * tools.length)];
      const wiring = CONCIERGE_COST_WIRING[toolId];
      const failed = r() < 0.07;
      seq += 1;
      out.push({
        id: `cj-${String(seq).padStart(4, '0')}`,
        toolId,
        toolTitle: CONCIERGE_TITLE[toolId],
        at,
        actor: pickActor(r),
        status: failed ? 'failed' : 'completed',
        durationSecs: vary(210, 0.6, r),
        llmCostUsd: failed ? null : wiring === 'priced' ? Math.round(vary(74, 0.7, r)) / 100 : wiring === 'hardcoded-zero' ? 0 : null,
        costWiring: wiring,
      });
    }
  }
  return out;
}

/** Every Concierge job the platform has run. */
export const CONCIERGE_JOBS: ConciergeJob[] = buildConcierge();

/* ── §2.4 SOP to RACM — records the result, nothing about spend ──────────── */

/**
 * One SOP-to-RACM generation.
 *
 * Seven AI stages on the strongest reasoning model, no time limit, and no record
 * of duration, usage or cost. It also caches: a document processed before skips
 * the AI entirely, so counting jobs says nothing at all about spend. Both facts
 * are carried on the record because the page has to say them.
 */
export interface SopRacmJob {
  id: string;
  at: number;
  actor: Actor;
  document: string;
  status: 'complete' | 'failed';
  risksGenerated: number;
  controlsGenerated: number;
  /** True when the pipeline skipped the AI and reused an earlier result. */
  cacheHit: boolean;
}

const SOP_DOCUMENTS = [
  'SOP_Accounts Receivable.pptx', 'Sample SOP.docx', 'Testing RACM (4).xlsx',
  'Agrawal Metals - Fixed Assets - SOP.pdf', 'P2P Vendor Payment SOP v4.docx',
  'ITGC Access Management SOP.pdf', 'Financial Close Procedures.docx',
];

function buildSopRacm(): SopRacmJob[] {
  const r = mulberry32(0x73_6f_70); // "sop"
  const out: SopRacmJob[] = [];
  let seq = 0;
  for (let day = 0; day < HISTORY_DAYS; day++) {
    if (r() > 0.16) continue;
    const dayMs = startOfDay(HISTORY_START) + day * DAY_MS;
    const at = workingMoment(dayMs, r);
    if (at > ANCHOR) continue;
    seq += 1;
    const cacheHit = r() < 0.45;
    out.push({
      id: `sop-${String(seq).padStart(3, '0')}`,
      at,
      actor: pickActor(r),
      document: SOP_DOCUMENTS[Math.floor(r() * SOP_DOCUMENTS.length)],
      status: r() < 0.05 ? 'failed' : 'complete',
      risksGenerated: vary(8, 0.5, r),
      controlsGenerated: vary(19, 0.4, r),
      cacheHit,
    });
  }
  return out;
}

/** Every SOP-to-RACM generation. */
export const SOP_RACM_JOBS: SopRacmJob[] = buildSopRacm();

/* ──────────────────────────────────────────────────────────────────────────
 * §2.5 The paid lookups — the calls an outside vendor bills us for
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * The verification APIs the platform calls, from the spec's own list.
 *
 * These are the most literal cost the product has: a vendor bills the company
 * for each successful lookup. Their calling code lives inside a database column,
 * which is why the list comes from the business rather than from a code search,
 * and why the billing unit — one call per run, or one per row — is still an open
 * question the spec puts at half a day of reading (check 4).
 *
 * The page counts the calls today. It prices them only when somebody enters the
 * vendor's bill (PU-19), and it never shows a rate from outside the product.
 */
export interface PaidLookup {
  id: string;
  /** The workflow name, as the customer's library shows it. */
  name: string;
  verifies: string;
  /** Whether the lookup returns personal identity data (decision 5). */
  personalData: boolean;
}

export const PAID_LOOKUPS: PaidLookup[] = [
  { id: 'pl-01', name: 'PAN Basic API Check', verifies: 'PAN exists and the name matches', personalData: true },
  { id: 'pl-02', name: 'PAN Details API', verifies: 'Full PAN details', personalData: true },
  { id: 'pl-03', name: 'PAN to GST API', verifies: 'GSTINs linked to a PAN', personalData: true },
  { id: 'pl-04', name: 'PAN to MSME Basic API Check', verifies: 'MSME or Udyam linked to a PAN', personalData: true },
  { id: 'pl-05', name: 'GST API Check', verifies: 'GST registration and status', personalData: false },
  { id: 'pl-06', name: 'MSME API Check', verifies: 'MSME or Udyam registration', personalData: false },
  { id: 'pl-07', name: 'CIN API Check', verifies: 'Company registration at the MCA', personalData: false },
  { id: 'pl-08', name: 'Vaahan API Check', verifies: 'Vehicle registration', personalData: true },
  { id: 'pl-09', name: 'UAN Advanced v4 API', verifies: 'Provident-fund account', personalData: true },
  { id: 'pl-10', name: 'Passport API Check', verifies: 'Passport', personalData: true },
  { id: 'pl-11', name: 'Voter ID API Check', verifies: 'Voter ID', personalData: true },
  { id: 'pl-12', name: 'Driving License API Check', verifies: 'Driving licence', personalData: true },
  { id: 'pl-13', name: 'Email API Check', verifies: 'Email address exists', personalData: true },
];

/**
 * One verification call, which is what a vendor charges for.
 *
 * `batchId` is the run the call belongs to. It matters because the billing unit
 * is a contract term: an API billed per row charges for every one of these, and
 * an API billed per run charges once for the whole batch however many rows it
 * checked. Getting that wrong puts the cost out by a factor of a thousand, which
 * is why the unit is a term we hold rather than something anybody guesses.
 */
export interface LookupCall {
  id: string;
  lookupId: string;
  lookupName: string;
  at: number;
  actor: Actor;
  /** The run this call was made inside. */
  batchId: string;
  /** A charge applies only when the call succeeds. */
  status: 'complete' | 'failed';
}

function buildLookupCalls(): LookupCall[] {
  const r = mulberry32(0x70_61_69); // "pai"
  const out: LookupCall[] = [];
  let seq = 0;
  let batch = 0;
  // The heavier checks (PAN, GST, three-way vendor verification) run far more
  // often than a passport check, so the mix is weighted rather than flat.
  const weights = [9, 5, 4, 3, 8, 3, 3, 2, 1, 1, 1, 2, 6];
  const total = weights.reduce((s, w) => s + w, 0);
  for (let day = 0; day < HISTORY_DAYS; day++) {
    const dayMs = startOfDay(HISTORY_START) + day * DAY_MS;
    const dow = new Date(dayMs).getUTCDay();
    const trend = 0.7 + (day / HISTORY_DAYS) * 0.8;
    const expected = (dow === 0 || dow === 6 ? 3 : 46) * trend;
    let count = Math.floor(expected);
    if (r() < expected - count) count += 1;
    // Verification runs in batches: one run of a workflow checks a file of
    // vendors, which is several hundred calls, not one.
    let made = 0;
    while (made < count) {
      const at = workingMoment(dayMs, r);
      let t = r() * total;
      let idx = 0;
      while (idx < weights.length - 1 && t > weights[idx]) { t -= weights[idx]; idx += 1; }
      const lookup = PAID_LOOKUPS[idx];
      const actor = pickActor(r);
      batch += 1;
      const batchId = `lkb-${String(batch).padStart(5, '0')}`;
      const size = Math.min(count - made, 1 + Math.floor(r() * 24));
      for (let i = 0; i < size; i++) {
        if (at > ANCHOR) break;
        seq += 1;
        out.push({
          id: `lk-${String(seq).padStart(6, '0')}`,
          lookupId: lookup.id,
          lookupName: lookup.name,
          at: at + i * 1_400,
          actor,
          batchId,
          status: r() < 0.04 ? 'failed' : 'complete',
        });
      }
      made += size;
    }
  }
  return out;
}

/** Every verification call the platform has made. */
export const LOOKUP_CALLS: LookupCall[] = buildLookupCalls();

/* ──────────────────────────────────────────────────────────────────────────
 * PU-22 The event log — dashboards, widgets and the alerts they fire
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * One before-and-after event.
 *
 * The product already writes one of these on every dashboard, widget and alert
 * change, and on every Smart Learn decision, through one helper called from
 * twenty-two places. An alert fired by the background worker writes an event
 * too, with no actor — which is why a null actor is a fact worth rendering
 * ("automatic") rather than a blank.
 */
export interface AuditEventRow {
  id: string;
  entityType: 'dashboard' | 'widget' | 'widget_alert' | 'usage_setting' | 'contract_price';
  entityName: string;
  verb: 'create' | 'update' | 'delete' | 'fire';
  at: number;
  /** Null when no person was involved. */
  actor: string | null;
}

const DASHBOARD_RECORDS = [...MY_DASHBOARDS, ...SHARED_DASHBOARDS];

const WIDGET_NAMES = [
  'Duplicate invoice trend', 'Vendor spend concentration', 'Open exceptions by severity',
  'Three-way match failures', 'Cash application backlog', 'Credit limit breaches',
  'Journal entry anomalies', 'Control effectiveness by process',
];

const ALERT_NAMES = [
  'Duplicate invoice value over ₹5L', 'Three-way match failure rate over 8%',
  'Unmatched receipts older than 30 days', 'Credit limit breach on a top-20 customer',
];

function buildAuditEvents(): AuditEventRow[] {
  const r = mulberry32(0x65_76_74); // "evt"
  const out: AuditEventRow[] = [];
  let seq = 0;
  const push = (row: Omit<AuditEventRow, 'id'>) => {
    seq += 1;
    out.push({ id: `ae-${String(seq).padStart(5, '0')}`, ...row });
  };

  // Dashboards. The catalog carries a relative "2 hours ago" because that is how
  // the dashboard cards render it, so the creation event sits where that says.
  for (const d of DASHBOARD_RECORDS) {
    const at = parseRelative(d.timeAgo) ?? ANCHOR - Math.floor(r() * 120) * DAY_MS;
    const creator = d.creator === 'You' ? 'Nilesh Anand' : d.creator;
    push({ entityType: 'dashboard', entityName: d.name, verb: 'create', at, actor: creator });
    // A dashboard is edited a few times after it is built.
    const edits = Math.floor(r() * 4);
    for (let i = 0; i < edits; i++) {
      push({ entityType: 'dashboard', entityName: d.name, verb: 'update', at: Math.min(ANCHOR, at + (i + 1) * 3 * DAY_MS), actor: creator });
    }
  }

  // Older dashboards, retired before the catalog's window. They are part of the
  // history the page reports on even though no card renders them any more.
  const RETIRED = ['FY25 Vendor Spend', 'Q3 Close Tracker', 'Receivables Ageing (old)'];
  for (const name of RETIRED) {
    const at = HISTORY_START + Math.floor(r() * 90) * DAY_MS;
    push({ entityType: 'dashboard', entityName: name, verb: 'create', at, actor: pickActor(r).name });
    push({ entityType: 'dashboard', entityName: name, verb: 'delete', at: at + 40 * DAY_MS, actor: pickActor(r).name });
  }

  // Widgets built and changed on those dashboards.
  for (let day = 0; day < HISTORY_DAYS; day++) {
    const dayMs = startOfDay(HISTORY_START) + day * DAY_MS;
    const dow = new Date(dayMs).getUTCDay();
    const expected = dow === 0 || dow === 6 ? 0.1 : 1.1;
    let count = Math.floor(expected);
    if (r() < expected - count) count += 1;
    for (let i = 0; i < count; i++) {
      const at = workingMoment(dayMs, r);
      if (at > ANCHOR) continue;
      push({
        entityType: 'widget',
        entityName: WIDGET_NAMES[Math.floor(r() * WIDGET_NAMES.length)],
        verb: r() < 0.45 ? 'create' : 'update',
        at,
        actor: pickActor(r).name,
      });
    }

    // Alert fires. The worker fires most of them, with no person involved.
    const fires = r() < 0.4 ? 1 + Math.floor(r() * 3) : 0;
    for (let i = 0; i < fires; i++) {
      const at = dayMs + Math.floor(r() * 24) * HOUR_MS;
      if (at > ANCHOR) continue;
      push({
        entityType: 'widget_alert',
        entityName: ALERT_NAMES[Math.floor(r() * ALERT_NAMES.length)],
        verb: 'fire',
        at,
        actor: r() < 0.12 ? pickActor(r).name : null,
      });
    }
  }

  return out.sort((a, b) => a.at - b.at);
}

/** Every event the product's own log holds for this page to read. */
export const AUDIT_EVENTS: AuditEventRow[] = buildAuditEvents();

/* ──────────────────────────────────────────────────────────────────────────
 * PU-23 Reports — created, worked on, shared
 * ────────────────────────────────────────────────────────────────────────── */

export interface ReportRecord {
  id: string;
  title: string;
  status: 'draft' | 'final';
  createdAt: number;
  createdBy: string;
  engagementId: string | null;
}

export interface ReportActivity {
  id: string;
  reportId: string;
  reportTitle: string;
  activityType: 'created' | 'section edited' | 'comment added' | 'status changed' | 'exported' | 'shared';
  /** A person, or the system when a scheduled job did it. */
  authorType: 'user' | 'system';
  author: string;
  at: number;
}

export interface ReportShare {
  id: string;
  reportTitle: string;
  sharedBy: string;
  sharedWith: string;
  at: number;
}

export interface ActionPlanRow {
  id: string;
  reportTitle: string;
  observation: string;
  owner: string;
  status: 'open' | 'closed';
  dueAt: number;
}

const REPORT_RECORDS_BUILT: ReportRecord[] = GENERATED_REPORTS.map((rep, i) => {
  const createdAt = parseLibraryDate(rep.generatedAt) ?? ANCHOR - i * 7 * DAY_MS;
  return {
    id: rep.id,
    title: rep.name,
    // The newest two are still being worked on; everything older went final.
    status: i < 2 ? 'draft' : 'final',
    createdAt,
    createdBy: rep.generatedBy === 'You' ? 'Nilesh Anand' : rep.generatedBy,
    engagementId: null,
  };
});

/** Every report the product holds. */
export const REPORT_RECORDS: ReportRecord[] = REPORT_RECORDS_BUILT
  .slice()
  .sort((a, b) => a.createdAt - b.createdAt);

/**
 * The reports module's own activity trail.
 *
 * A report edited fifty times is one report and fifty activities. The page
 * counts both and never adds them together, which is why they are two record
 * types rather than one number.
 */
export const REPORT_ACTIVITY: ReportActivity[] = (() => {
  const r = mulberry32(0x72_70_74); // "rpt"
  const out: ReportActivity[] = [];
  let seq = 0;
  const kinds: ReportActivity['activityType'][] = [
    'section edited', 'section edited', 'section edited', 'comment added', 'status changed', 'exported', 'shared',
  ];
  for (const rep of REPORT_RECORDS) {
    seq += 1;
    out.push({
      id: `rat-${String(seq).padStart(5, '0')}`,
      reportId: rep.id, reportTitle: rep.title, activityType: 'created',
      authorType: 'user', author: rep.createdBy, at: rep.createdAt,
    });
    const n = 4 + Math.floor(r() * 14);
    for (let i = 0; i < n; i++) {
      const at = Math.min(ANCHOR, rep.createdAt + Math.floor(r() * 18) * DAY_MS + Math.floor(r() * 8) * HOUR_MS);
      const kind = kinds[Math.floor(r() * kinds.length)];
      const system = kind === 'exported' && r() < 0.4;
      seq += 1;
      out.push({
        id: `rat-${String(seq).padStart(5, '0')}`,
        reportId: rep.id, reportTitle: rep.title, activityType: kind,
        authorType: system ? 'system' : 'user',
        author: system ? 'Scheduled export' : (r() < 0.6 ? rep.createdBy : pickActor(r).name),
        at,
      });
    }
  }
  return out.sort((a, b) => a.at - b.at);
})();

/** Every share, from the product's own shared-report table. */
export const REPORT_SHARES: ReportShare[] = SHARED_REPORTS.map((s, i) => ({
  id: s.id,
  reportTitle: s.name,
  sharedBy: s.sharedBy,
  sharedWith: s.sharedWith,
  at: parseLibraryDate(s.sharedAt) ?? ANCHOR - (i + 1) * 9 * DAY_MS,
}));

/** The action-plan tracker behind the reports. */
export const ACTION_PLANS: ActionPlanRow[] = (() => {
  const r = mulberry32(0x61_63_70); // "acp"
  const out: ActionPlanRow[] = [];
  const observations = [
    'Vendor bank-detail changes are not independently verified',
    'Duplicate invoice checks run after payment release',
    'Three-way match tolerances are set per user, not per policy',
    'Journal entries above materiality lack a second reviewer',
    'Credit limit overrides are approved by the requester',
    'Access reviews are evidenced by email rather than the system',
  ];
  REPORT_RECORDS.filter((_, i) => i % 2 === 0).forEach((rep, i) => {
    const n = 1 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) {
      out.push({
        id: `ap-${String(i * 10 + k).padStart(4, '0')}`,
        reportTitle: rep.title,
        observation: observations[Math.floor(r() * observations.length)],
        owner: pickActor(r).name,
        status: r() < 0.55 ? 'closed' : 'open',
        dueAt: rep.createdAt + (20 + Math.floor(r() * 60)) * DAY_MS,
      });
    }
  });
  return out;
})();

/* ──────────────────────────────────────────────────────────────────────────
 * PU-24 Sampling — validation runs and their outcomes
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * One sample validation.
 *
 * A lifecycle, not a flag: queued, running, then passed, failed or errored.
 * "Errored" means the run could not reach a verdict and needs a person, which is
 * a different fact from "failed", so the two never share a bar.
 */
export interface SampleRun {
  id: string;
  engagementId: string;
  engagementName: string;
  controlId: string;
  controlName: string;
  status: 'queued' | 'running' | 'passed' | 'failed' | 'error';
  at: number;
  actor: Actor;
  /** Samples the run worked through. */
  sampleSize: number;
}

const TESTABLE_CONTROLS = CONTROL_LIBRARY.filter(c => c.status === 'Active');

export const SAMPLE_RUNS: SampleRun[] = (() => {
  const r = mulberry32(0x73_6d_70); // "smp"
  const out: SampleRun[] = [];
  const engagements = ENGAGEMENTS.filter(e => e.status !== 'Draft' && e.status !== 'Planned');
  let seq = 0;
  for (let day = 0; day < HISTORY_DAYS; day++) {
    const dayMs = startOfDay(HISTORY_START) + day * DAY_MS;
    const dow = new Date(dayMs).getUTCDay();
    const expected = dow === 0 || dow === 6 ? 0.15 : 2.2;
    let count = Math.floor(expected);
    if (r() < expected - count) count += 1;
    for (let i = 0; i < count; i++) {
      const at = workingMoment(dayMs, r);
      if (at > ANCHOR) continue;
      const eng = engagements[Math.floor(r() * engagements.length)];
      const control = TESTABLE_CONTROLS[Math.floor(r() * TESTABLE_CONTROLS.length)];
      const roll = r();
      // The newest handful are still moving through the lifecycle.
      const fresh = at > ANCHOR - 2 * DAY_MS;
      const status: SampleRun['status'] = fresh && roll < 0.4
        ? (roll < 0.2 ? 'queued' : 'running')
        : roll < 0.71 ? 'passed' : roll < 0.9 ? 'failed' : 'error';
      seq += 1;
      out.push({
        id: `sr-${String(seq).padStart(5, '0')}`,
        engagementId: eng.id,
        engagementName: eng.name,
        controlId: control.controlId,
        controlName: control.name,
        status,
        at,
        actor: pickActor(r),
        sampleSize: vary(25, 0.6, r),
      });
    }
  }
  return out;
})();

/* ──────────────────────────────────────────────────────────────────────────
 * PU-25 AI insights — generated, with a severity
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * One generated insight.
 *
 * `kind` separates an insight about a single run from an engagement-wide
 * consolidation that summarises several. Counting both together would report the
 * same finding twice, so the split is part of the record.
 */
export interface InsightRow {
  id: string;
  kind: 'per_run' | 'consolidated';
  engagementId: string;
  engagementName: string;
  category: 'Control gap' | 'Data quality' | 'Process' | 'Anomaly' | 'Coverage';
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  status: 'new' | 'reviewed' | 'dismissed';
  at: number;
  headline: string;
}

const INSIGHT_HEADLINES = [
  'Three-way match failures cluster on one vendor group',
  'Duplicate invoice flags rise the week before every close',
  'Journal entry anomalies concentrate in two cost centres',
  'Cash application misses remittances with no advice attached',
  'Credit limit breaches are approved by the same two people',
  'Vendor bank-detail changes cluster outside business hours',
  'Sample failures repeat on controls owned by one team',
  'Access review evidence is missing for three privileged roles',
];

export const INSIGHTS: InsightRow[] = (() => {
  const r = mulberry32(0x69_6e_73); // "ins"
  const out: InsightRow[] = [];
  const engagements = ENGAGEMENTS.filter(e => e.status !== 'Draft');
  const severities: InsightRow['severity'][] = ['Critical', 'High', 'Medium', 'Medium', 'Low', 'Low'];
  const categories: InsightRow['category'][] = ['Control gap', 'Data quality', 'Process', 'Anomaly', 'Coverage'];
  let seq = 0;
  for (let day = 0; day < HISTORY_DAYS; day++) {
    const dayMs = startOfDay(HISTORY_START) + day * DAY_MS;
    const expected = 1.05;
    let count = Math.floor(expected);
    if (r() < expected - count) count += 1;
    for (let i = 0; i < count; i++) {
      const at = workingMoment(dayMs, r);
      if (at > ANCHOR) continue;
      const eng = engagements[Math.floor(r() * engagements.length)];
      seq += 1;
      out.push({
        id: `ins-${String(seq).padStart(5, '0')}`,
        kind: r() < 0.16 ? 'consolidated' : 'per_run',
        engagementId: eng.id,
        engagementName: eng.name,
        category: categories[Math.floor(r() * categories.length)],
        severity: severities[Math.floor(r() * severities.length)],
        status: r() < 0.5 ? 'new' : r() < 0.85 ? 'reviewed' : 'dismissed',
        at,
        headline: INSIGHT_HEADLINES[Math.floor(r() * INSIGHT_HEADLINES.length)],
      });
    }
  }
  return out;
})();

/* ──────────────────────────────────────────────────────────────────────────
 * PU-26 Risks — recorded, prioritised, and (not) covered
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * One risk in the register, with the one fact a CFO acts on: whether any control
 * covers it. Mapped and unmapped are read from the Control Library's own risk
 * links, so the two screens cannot disagree about which risks are covered.
 */
export interface RiskRow {
  id: string;
  name: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  category: string;
  /** Mapped means at least one control covers it. */
  mapped: boolean;
  controls: string[];
  owner: string;
  team: string | null;
  /** How the row got into the register. */
  addedUsing: 'Manual' | 'Imported' | 'AI Generated';
  createdAt: number;
}

export const RISK_ROWS: RiskRow[] = (() => {
  const r = mulberry32(0x72_73_6b); // "rsk"
  const coverage = new Map<string, string[]>();
  for (const c of CONTROL_LIBRARY) {
    for (const riskId of c.mappedRisks ?? []) {
      coverage.set(riskId, [...(coverage.get(riskId) ?? []), c.controlId]);
    }
  }
  return SEED_RISKS.map(risk => {
    const controls = coverage.get(risk.id) ?? [];
    const roll = r();
    return {
      id: risk.id,
      name: risk.name,
      priority: risk.priority,
      category: risk.category,
      mapped: controls.length > 0,
      controls,
      owner: risk.owner,
      team: teamOfName(risk.owner),
      // The RACM generator wrote a third of the register; the rest was typed or
      // arrived in a spreadsheet. The share is a labelled fact, not a claim.
      addedUsing: roll < 0.34 ? 'AI Generated' : roll < 0.62 ? 'Imported' : 'Manual',
      createdAt: parseLibraryDate(risk.createdAt) ?? HISTORY_START,
    };
  });
})();

/* ──────────────────────────────────────────────────────────────────────────
 * PU-27 Engagements — the portfolio, its history, and where each one sits
 * ────────────────────────────────────────────────────────────────────────── */

/** One entry in a record's append-only change history. */
export interface HistoryEntry {
  at: number;
  who: string;
  action: string;
  field: string;
  from: string | null;
  to: string | null;
}

export interface EngagementRow {
  id: string;
  code: string;
  name: string;
  type: string;
  process: string;
  status: string;
  owner: string;
  team: string | null;
  reviewer: string | null;
  /** When the record was first stamped. Engagements carry a start, not a create. */
  createdAt: number;
  periodEndAt: number | null;
  plannedEndAt: number | null;
  controls: number;
  history: HistoryEntry[];
}

const HISTORY_FIELDS: { field: string; action: string; from: string; to: string }[] = [
  { field: 'status', action: 'changed', from: 'Draft', to: 'Active' },
  { field: 'reviewer', action: 'assigned', from: '—', to: 'Karan Mehta' },
  { field: 'scope', action: 'changed', from: '18 controls', to: '24 controls' },
  { field: 'planned end', action: 'moved', from: '31 Mar 2026', to: '15 Apr 2026' },
  { field: 'owner', action: 'changed', from: 'Meera Nair', to: 'Neha Joshi' },
  { field: 'RACM version', action: 'locked', from: 'v2.0', to: 'v2.1' },
];

export const ENGAGEMENT_ROWS: EngagementRow[] = (() => {
  const r = mulberry32(0x65_6e_67); // "eng"
  return ENGAGEMENTS.map(eng => {
    const createdAt = (eng.startDate ? parseIsoDate(eng.startDate) : null) ?? HISTORY_START;
    const periodEndAt = eng.endDate ? parseIsoDate(eng.endDate) : null;
    // The planned end is the engagement's own next milestone when it has one.
    const milestone = eng.milestones?.[eng.milestones.length - 1]?.date;
    const plannedEndAt = milestone ? parseIsoDate(milestone) : periodEndAt;
    const entries: HistoryEntry[] = [];
    const n = 3 + Math.floor(r() * 7);
    for (let i = 0; i < n; i++) {
      const spec = HISTORY_FIELDS[Math.floor(r() * HISTORY_FIELDS.length)];
      const at = Math.min(ANCHOR, Math.max(HISTORY_START, createdAt + Math.floor(r() * 300) * DAY_MS));
      entries.push({ at, who: pickActor(r).name, action: spec.action, field: spec.field, from: spec.from, to: spec.to });
    }
    entries.sort((a, b) => a.at - b.at);
    return {
      id: eng.id,
      code: eng.code,
      name: eng.name,
      type: eng.type,
      process: eng.process,
      status: eng.status,
      owner: eng.owner,
      team: teamOfName(eng.owner),
      reviewer: eng.team?.reviewer ?? null,
      createdAt,
      periodEndAt,
      plannedEndAt,
      controls: eng.controls,
      history: entries,
    };
  });
})();

/* ──────────────────────────────────────────────────────────────────────────
 * PU-28 CCM — the automation config on each engagement
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * One engagement's automation config.
 *
 * Continuous monitoring is a mode an engagement runs in, not a separate feature:
 * a flag, a schedule, a pass-rate threshold and an alert config, all stored. So
 * the page can report monitoring coverage rather than only one-off audits.
 */
export interface AutomationConfigRow {
  engagementId: string;
  engagementName: string;
  isCcm: boolean;
  jobFrequency: 'Daily' | 'Weekly' | 'Fortnightly' | 'Monthly' | null;
  passRateThreshold: number;
  alertsOn: boolean;
  approvalLevelsRiskOwner: number;
  approvalLevelsAuditor: number;
}

export const AUTOMATION_CONFIGS: AutomationConfigRow[] = (() => {
  const r = mulberry32(0x63_63_6d); // "ccm"
  const frequencies: AutomationConfigRow['jobFrequency'][] = ['Daily', 'Weekly', 'Fortnightly', 'Monthly'];
  return ENGAGEMENT_ROWS.map(eng => {
    // Automation engagements monitor continuously by design; a few of the audit
    // engagements have been switched into the mode as well.
    const isCcm = eng.type === 'Automation' || r() < 0.22;
    return {
      engagementId: eng.id,
      engagementName: eng.name,
      isCcm,
      jobFrequency: isCcm ? frequencies[Math.floor(r() * frequencies.length)] : null,
      passRateThreshold: 80,
      alertsOn: isCcm && r() < 0.8,
      approvalLevelsRiskOwner: 1 + Math.floor(r() * 3),
      approvalLevelsAuditor: 2,
    };
  });
})();

/* ──────────────────────────────────────────────────────────────────────────
 * PU-08 Exceptions, traced to the run that raised them
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * One exception, with the run behind it.
 *
 * The spec assumes exceptions carry a reference to their run and marks it TO
 * CONFIRM (check 3). Here the link is made on the workflow name the exception
 * already stores, so every counted exception can be opened and traced back to
 * the execution that raised it — which is the acceptance test.
 */
export interface TracedException {
  id: string;
  ref: string;
  title: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  status: 'Open' | 'Triaging' | 'Resolved';
  openedAt: number;
  assignee: string;
  team: string | null;
  engagementId: string;
  workflowName: string;
  /** The run that raised it, when one can be found. */
  runId: string | null;
  amount: string | null;
  classification: string | null;
}

/** The exception register's workflow names, mapped onto the library's own. */
const EXCEPTION_WORKFLOW_ALIASES: Record<string, string> = {
  'PO Approval Threshold Scan': 'Three-Way PO Match',
  'GL Reconciliation Monitor': 'Journal Entry Anomaly Detector',
  'Revenue Cut-off Test': 'Revenue Recognition Checker',
};

export const TRACED_EXCEPTIONS: TracedException[] = (() => {
  const r = mulberry32(0x65_78_63); // "exc"
  return ENGAGEMENT_EXCEPTIONS.map(ex => {
    const openedAt = parseRelative(ex.opened) ?? ANCHOR - Math.floor(r() * 60) * DAY_MS;
    const wfName = EXCEPTION_WORKFLOW_ALIASES[ex.workflowName] ?? ex.workflowName;
    // The raising run is the newest completed run of that workflow before the
    // exception was opened. No run found means no link, said as null.
    let runId: string | null = null;
    for (let i = RUNS.length - 1; i >= 0; i--) {
      const run = RUNS[i];
      if (run.workflowName === wfName && run.completedAt !== null && run.completedAt <= openedAt) {
        runId = run.id;
        break;
      }
    }
    return {
      id: ex.id,
      ref: ex.ref,
      title: ex.title,
      severity: ex.severity,
      status: ex.status,
      openedAt,
      assignee: ex.assignee,
      team: teamOfName(ex.assignee),
      engagementId: ex.engagementId,
      workflowName: wfName,
      runId,
      amount: ex.amount ?? null,
      classification: ex.classification ?? null,
    };
  });
})();

/* ──────────────────────────────────────────────────────────────────────────
 * PU-18 What the calibration job measures from
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * A piece of hand work the platform has a clock on.
 *
 * The assumptions behind every value figure improve on their own by reading
 * these: how long a person actually took over how many rows (`review`), and how
 * long a manual control test actually took (`control_test`). Nobody enters
 * anything; the weekly job reads what the product already recorded.
 *
 * Both are honest proxies, and the page says so. Exception review is not
 * full-file row checking, and a record left open over a weekend is not sixty
 * hours of work — which is why the job trims outliers.
 */
export interface ReviewRecord {
  id: string;
  kind: 'review' | 'control_test';
  who: string;
  startedAt: number;
  finishedAt: number;
  /** Rows the person worked through. Null on a control test. */
  rows: number | null;
}

export const REVIEW_RECORDS: ReviewRecord[] = (() => {
  const r = mulberry32(0x72_65_76); // "rev"
  const out: ReviewRecord[] = [];
  let seq = 0;
  for (let day = 0; day < HISTORY_DAYS; day++) {
    const dayMs = startOfDay(HISTORY_START) + day * DAY_MS;
    const dow = new Date(dayMs).getUTCDay();
    if (dow === 0 || dow === 6) continue;

    // Hand review of exception rows — assigned, then resolved.
    const reviews = r() < 0.55 ? 1 + Math.floor(r() * 2) : 0;
    for (let i = 0; i < reviews; i++) {
      const startedAt = workingMoment(dayMs, r);
      if (startedAt > ANCHOR) continue;
      // A person clears around 236 rows an hour in this workspace, which is what
      // the job will find. A few records are left open far too long; the trim
      // exists for those.
      const rows = vary(430, 0.5, r);
      const hours = rows / vary(236, 0.22, r);
      const outlier = r() < 0.07;
      seq += 1;
      out.push({
        id: `rev-${String(seq).padStart(4, '0')}`,
        kind: 'review',
        who: pickActor(r).name,
        startedAt,
        finishedAt: startedAt + (outlier ? 62 : hours) * HOUR_MS,
        rows,
      });
    }

    // Manual control tests — started, then completed.
    if (r() < 0.28) {
      const startedAt = workingMoment(dayMs, r);
      if (startedAt > ANCHOR) continue;
      seq += 1;
      out.push({
        id: `rev-${String(seq).padStart(4, '0')}`,
        kind: 'control_test',
        who: pickActor(r).name,
        startedAt,
        finishedAt: startedAt + (2.4 + r() * 2.2) * HOUR_MS,
        rows: null,
      });
    }
  }
  return out;
})();

/* ──────────────────────────────────────────────────────────────────────────
 * PU-21 Created this period — five tables, one pattern
 * ────────────────────────────────────────────────────────────────────────── */

export type CreatedKind = 'engagement' | 'audit' | 'control' | 'dashboard' | 'report';

/**
 * One record, and when it was first stamped.
 *
 * None of these needs new plumbing: engagements, RACMs, controls, dashboards and
 * reports all already stamp when they were saved and who saved them, so "how
 * many were created in this window" is countable today, backwards through the
 * whole history. Edits, reviews and views are deliberately not here — those need
 * the event log to widen (PU-15), and the block's caption says "created" for
 * exactly that reason.
 */
export interface CreatedRecord {
  id: string;
  kind: CreatedKind;
  name: string;
  createdAt: number;
  createdBy: string;
  team: string | null;
}

export const CREATED_RECORDS: CreatedRecord[] = (() => {
  const out: CreatedRecord[] = [];

  for (const eng of ENGAGEMENT_ROWS) {
    out.push({ id: `cr-eng-${eng.id}`, kind: 'engagement', name: eng.name, createdAt: eng.createdAt, createdBy: eng.owner, team: eng.team });
  }

  // "Audits" are the RACMs an audit cycle runs from — the audit programme.
  for (const racm of PROCESS_HUB_RACMS) {
    const createdAt = racm.createdAt ? parseLibraryDate(racm.createdAt) : null;
    if (createdAt === null) continue;
    out.push({ id: `cr-racm-${racm.id}`, kind: 'audit', name: racm.name, createdAt, createdBy: 'Abhinav Sharma', team: teamOfName('Abhinav Sharma') });
  }

  for (const c of CONTROL_LIBRARY) {
    const createdAt = parseLibraryDate(c.createdAt ?? '');
    if (createdAt === null) continue;
    out.push({ id: `cr-ctl-${c.controlId}`, kind: 'control', name: c.name, createdAt, createdBy: c.owner, team: teamOfName(c.owner) });
  }

  for (const ev of AUDIT_EVENTS) {
    if (ev.entityType !== 'dashboard' || ev.verb !== 'create') continue;
    out.push({ id: `cr-dash-${ev.id}`, kind: 'dashboard', name: ev.entityName, createdAt: ev.at, createdBy: ev.actor ?? 'automatic', team: teamOfName(ev.actor ?? '') });
  }

  for (const rep of REPORT_RECORDS) {
    out.push({ id: `cr-rep-${rep.id}`, kind: 'report', name: rep.title, createdAt: rep.createdAt, createdBy: rep.createdBy, team: teamOfName(rep.createdBy) });
  }

  return out.sort((a, b) => a.createdAt - b.createdAt);
})();

/* ──────────────────────────────────────────────────────────────────────────
 * PU-19 The contract prices, set by irame when the deal is signed
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * What one verification call costs, as the contract says.
 *
 * Nobody at the customer sets these. Lookup prices are part of what was sold, so
 * irame's own operations seed them platform-side when the deal is signed: the
 * API, whether the vendor bills per run or per row, the charge, and the date it
 * came into force. The customer's page reads them and says "as per your
 * contract"; there is no price form, no pin field and no bill screen anywhere in
 * the product, because none of these numbers is theirs to type.
 *
 * Rows are versioned rather than edited. A renegotiation closes the row in force
 * and opens a new one, so last quarter's cost stays what it was when it was
 * reported.
 *
 * The billing unit is the one term that has to be right: an API billed per row
 * charges for every call, and one billed per run charges once for a batch of
 * several hundred. It is verified once against the workflow's stored program at
 * signature, by our own ops, and never guessed here.
 */
export interface ContractPrice {
  lookupId: string;
  vendor: string;
  apiName: string;
  /** A contract term, verified against the workflow's stored program. */
  billingUnit: 'run' | 'row';
  pricePaise: number;
  effectiveFrom: number;
  effectiveTo: number | null;
  /** Who seeded it, which is always irame operations. */
  setBy: string;
  setAt: number;
}

/**
 * The contract on this workspace.
 *
 * Placeholder terms for the demo tenant, seeded the way irame operations would
 * seed a signed contract. Real numbers arrive with the real contract; the shape
 * and the flow are what matter here. The two renegotiated rows are deliberate:
 * they prove the versioning holds, and that a March figure does not move when an
 * April price does.
 */
const SIGNED_AT = Date.UTC(2025, 8, 15, 10, 0, 0);
const OPS = 'irame operations';

export const CONTRACT_PRICES: ContractPrice[] = [
  { lookupId: 'pl-01', vendor: 'Signzy', apiName: 'PAN Basic API Check', billingUnit: 'row', pricePaise: 175, effectiveFrom: SIGNED_AT, effectiveTo: Date.UTC(2026, 0, 31), setBy: OPS, setAt: SIGNED_AT },
  // Renegotiated from 1 Feb 2026. The older row stays, so October's cost stays October's.
  { lookupId: 'pl-01', vendor: 'Signzy', apiName: 'PAN Basic API Check', billingUnit: 'row', pricePaise: 150, effectiveFrom: Date.UTC(2026, 1, 1), effectiveTo: null, setBy: OPS, setAt: Date.UTC(2026, 0, 20, 11, 0, 0) },
  { lookupId: 'pl-02', vendor: 'Signzy', apiName: 'PAN Details API', billingUnit: 'row', pricePaise: 300, effectiveFrom: SIGNED_AT, effectiveTo: null, setBy: OPS, setAt: SIGNED_AT },
  { lookupId: 'pl-03', vendor: 'Signzy', apiName: 'PAN to GST API', billingUnit: 'row', pricePaise: 400, effectiveFrom: SIGNED_AT, effectiveTo: null, setBy: OPS, setAt: SIGNED_AT },
  { lookupId: 'pl-04', vendor: 'Signzy', apiName: 'PAN to MSME Basic API Check', billingUnit: 'row', pricePaise: 350, effectiveFrom: SIGNED_AT, effectiveTo: null, setBy: OPS, setAt: SIGNED_AT },
  { lookupId: 'pl-05', vendor: 'Signzy', apiName: 'GST API Check', billingUnit: 'row', pricePaise: 200, effectiveFrom: SIGNED_AT, effectiveTo: null, setBy: OPS, setAt: SIGNED_AT },
  { lookupId: 'pl-06', vendor: 'Signzy', apiName: 'MSME API Check', billingUnit: 'row', pricePaise: 250, effectiveFrom: SIGNED_AT, effectiveTo: null, setBy: OPS, setAt: SIGNED_AT },
  { lookupId: 'pl-07', vendor: 'Karza', apiName: 'CIN API Check', billingUnit: 'run', pricePaise: 1_200, effectiveFrom: SIGNED_AT, effectiveTo: null, setBy: OPS, setAt: SIGNED_AT },
  { lookupId: 'pl-08', vendor: 'Karza', apiName: 'Vaahan API Check', billingUnit: 'row', pricePaise: 600, effectiveFrom: SIGNED_AT, effectiveTo: null, setBy: OPS, setAt: SIGNED_AT },
  { lookupId: 'pl-09', vendor: 'Karza', apiName: 'UAN Advanced v4 API', billingUnit: 'row', pricePaise: 900, effectiveFrom: SIGNED_AT, effectiveTo: null, setBy: OPS, setAt: SIGNED_AT },
  { lookupId: 'pl-10', vendor: 'Karza', apiName: 'Passport API Check', billingUnit: 'row', pricePaise: 800, effectiveFrom: SIGNED_AT, effectiveTo: null, setBy: OPS, setAt: SIGNED_AT },
  { lookupId: 'pl-11', vendor: 'Karza', apiName: 'Voter ID API Check', billingUnit: 'row', pricePaise: 500, effectiveFrom: SIGNED_AT, effectiveTo: null, setBy: OPS, setAt: SIGNED_AT },
  { lookupId: 'pl-12', vendor: 'Karza', apiName: 'Driving License API Check', billingUnit: 'row', pricePaise: 550, effectiveFrom: SIGNED_AT, effectiveTo: null, setBy: OPS, setAt: SIGNED_AT },
  // Priced from 1 Mar 2026 only: the email check was added to the contract later,
  // so the calls before that date sit in the page's honest unpriced state.
  { lookupId: 'pl-13', vendor: 'Signzy', apiName: 'Email API Check', billingUnit: 'row', pricePaise: 40, effectiveFrom: Date.UTC(2026, 2, 1), effectiveTo: null, setBy: OPS, setAt: Date.UTC(2026, 1, 24, 9, 0, 0) },
];

/**
 * The contract the page should read.
 *
 * Config, not input. The seeded contract above is what ships; a platform-side
 * override can replace it wholesale (that is how a signed contract reaches a
 * tenant, and how a tenant with no contract loaded yet is represented). Nothing
 * in the product's UI writes this key: there is no screen that can.
 */
const CONTRACT_KEY = 'irame.platformUsage.contract.v1';

export function loadContractPrices(): ContractPrice[] {
  try {
    const raw = localStorage.getItem(CONTRACT_KEY);
    if (!raw) return CONTRACT_PRICES;
    const rows = JSON.parse(raw) as ContractPrice[];
    return Array.isArray(rows) ? rows : CONTRACT_PRICES;
  } catch {
    return CONTRACT_PRICES;
  }
}

/** The price in force for one API on one day, or null when it was not priced. */
export function priceInForce(lookupId: string, at: number, prices = loadContractPrices()): ContractPrice | null {
  return prices.find(row => row.lookupId === lookupId
    && row.effectiveFrom <= at
    && (row.effectiveTo === null || row.effectiveTo >= at)) ?? null;
}

/* ──────────────────────────────────────────────────────────────────────────
 * The audit trail behind the numbers nobody types
 * ────────────────────────────────────────────────────────────────────────── */

/** What changed, so the numbers behind the figures are auditable too. */
export type UsageChangeEntity = 'usage_setting' | 'contract_price';

export interface UsageChange {
  entity: UsageChangeEntity;
  field: string;
  from: string | null;
  to: string | null;
  /** default, measured or manual: which kind of number this now is. */
  source: string | null;
  by: string;
  at: number;
}

const CHANGES_KEY = 'irame.platformUsage.changes.v3';

function readJson<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function writeJson<T>(key: string, rows: T[]): void {
  try { localStorage.setItem(key, JSON.stringify(rows)); } catch { /* private mode */ }
}

/**
 * Every change to a number behind a figure, newest first.
 *
 * Two kinds reach this list. The calibration job writes one whenever it moves an
 * assumption to the customer's own measured pace. Every contract price row is one
 * too, because a price that changed last month explains a cost that changed last
 * month, and the customer is entitled to see that without asking anybody.
 */
export function loadUsageChanges(): UsageChange[] {
  const entered = readJson<UsageChange>(CHANGES_KEY);
  const contract: UsageChange[] = loadContractPrices().map(row => ({
    entity: 'contract_price',
    field: row.apiName,
    from: null,
    to: `${(row.pricePaise / 100).toFixed(2)} rupees per ${row.billingUnit}`,
    source: row.effectiveTo === null ? 'in force' : 'superseded',
    by: row.setBy,
    at: row.setAt,
  }));
  return [...entered, ...contract].sort((a, b) => b.at - a.at);
}

/** Record one change. Used by the calibration job, never by a form. */
export function recordUsageChange(next: UsageChange): UsageChange[] {
  const rows = readJson<UsageChange>(CHANGES_KEY);
  // The job runs on every page open; the same measurement is one change, not one
  // a day, so an identical row at the same instant is not written twice.
  if (!rows.some(row => row.entity === next.entity && row.field === next.field && row.to === next.to && row.at === next.at)) {
    writeJson(CHANGES_KEY, [next, ...rows]);
  }
  return loadUsageChanges();
}
