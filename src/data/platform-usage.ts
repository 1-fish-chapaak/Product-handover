/**
 * Platform Usage — the record of what the platform did.
 *
 * This module is the record, not the reading of it. It holds the four things
 * the product actually writes down — workflow runs, chat questions, Concierge
 * jobs and SOP-to-RACM jobs — plus the two tables the page needs and the
 * product does not have yet: the assumption settings and the vendor price list.
 * Every figure on the page is computed from these records in
 * `platform-usage-metrics.ts`. Nothing here reads a metric, and nothing here is
 * written by the page: Platform Usage only ever reads.
 *
 * ## What is recorded, and what is not
 *
 * Four areas of the product write down what happens in them. Everything else —
 * creating audits, editing controls, building dashboards, producing reports —
 * leaves no event at all, so this module cannot report on it and the page says
 * so in one plain line. That line is COVERAGE_NOTE, defined once here: when the
 * product event log is extended, one string changes and screen, CSV and PDF all
 * follow.
 *
 * ## Measured, estimated, not measured, no record
 *
 * These are four different facts and the page never blurs them, so the record
 * layer keeps them apart at the source:
 *
 *   measured      run durations, row counts, Concierge job cost, memory recalls
 *   estimated     chat token usage — the product counts characters divided by
 *                 four, a stopgap built to stop runaway conversations, not to
 *                 bill for them
 *   not measured  SOP-to-RACM consumption, workflow AI consumption
 *   no record     everything else in the product
 *
 * ## Where the history comes from
 *
 * Runs are generated, but they are bound to the rest of the product rather than
 * invented beside it:
 *
 *  · a workflow runs exactly as many times as the Workflow Library says it has
 *    (`WORKFLOWS[i].runs`), ending on the date the library shows as its last
 *    run, so the two screens can never disagree;
 *  · a run's control comes from the Control Library's own `linkedWorkflowIds`,
 *    so coverage is a fact about the real library rather than a number of its
 *    own;
 *  · every actor is a member of the roster who is allowed to run workflows, and
 *    a member's history stops when their access did;
 *  · exceptions are the real register's rows, each traced back to the run of its
 *    workflow that was newest when it opened.
 *
 * It is deterministic — fixed-seed PRNG, no Date.now(), no Math.random() — so
 * every reload, test and screenshot sees the same history. The window ends at
 * ANCHOR, Tue 21 Apr 2026, the horizon the rest of the product's records sit on.
 */

import { WORKFLOWS } from './mockData';
import { CONTROL_LIBRARY } from './controlLibrary';
import { ENGAGEMENT_EXCEPTIONS, type EngagementException } from './engagement-exceptions';
import { CONCIERGE_TOOLS } from './conciergeTools';
import { SEED_USERS } from '../context/AdminDataContext';

/* ──────────────────────────────────────────────────────────────────────────
 * 1 · The coverage note
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * The one plain line a page called "Platform Usage" has to carry, or it is read
 * as covering everything. It is written once, here, and every surface renders
 * this string rather than its own wording.
 */
export const COVERAGE_NOTE =
  'Counts runs, chat, Concierge, Smart Learn and items created. Edits and reviews appear as the event log fills.';

/* ──────────────────────────────────────────────────────────────────────────
 * 2 · Time
 * ────────────────────────────────────────────────────────────────────────── */

export const DAY_MS = 86_400_000;
export const HOUR_MS = 3_600_000;

/** The newest moment in the record — Tue 21 Apr 2026, 18:00 UTC. */
export const ANCHOR = Date.UTC(2026, 3, 21, 18, 0, 0);
/** The oldest — Wed 1 Oct 2025, so the longest window has a prior window. */
export const HISTORY_START = Date.UTC(2025, 9, 1, 0, 0, 0);

const DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
});
const DATETIME_FMT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  hour12: false, timeZone: 'UTC',
});

export const formatDate = (ms: number): string => DATE_FMT.format(new Date(ms));
export const formatDateTime = (ms: number): string => DATETIME_FMT.format(new Date(ms));
export const isoDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/**
 * How old the data is. The build rule is "real time": a run that finished two
 * minutes ago is in, and the scope line says the age of the record rather than
 * leaving the reader to assume it is live.
 */
export const dataAsOfLabel = (): string => `Data as of ${formatDate(ANCHOR)}`;

/* ──────────────────────────────────────────────────────────────────────────
 * 3 · Deterministic randomness
 * ────────────────────────────────────────────────────────────────────────── */

/** mulberry32 — small, fast, evenly spread. Fixed seed means fixed history. */
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

/** Business hours on weekdays, thinning to almost nothing at the weekend. */
function workingMoment(dayMs: number, r: () => number): number {
  const dow = new Date(dayMs).getUTCDay();
  const weekend = dow === 0 || dow === 6;
  const hour = weekend ? 10 + Math.floor(r() * 4) : 8 + Math.floor(r() * 10);
  return dayMs + hour * HOUR_MS + Math.floor(r() * 60) * 60_000;
}

const startOfDay = (ms: number): number => Math.floor(ms / DAY_MS) * DAY_MS;

/* ──────────────────────────────────────────────────────────────────────────
 * 4 · The records
 * ────────────────────────────────────────────────────────────────────────── */

/** A run's stored outcome. Paused for more than 24 hours reads as stuck. */
export type RunStatus = 'complete' | 'failed' | 'blocked' | 'paused';

/**
 * One execution of one workflow — the backbone record.
 *
 * Everything the headline rests on is computed from these fields and nothing
 * else. `rowCount` is null when the run has no row output at all: either it
 * never finished, or it is a control test whose result is that the control held
 * or it did not.
 */
export interface WorkflowRun {
  id: string;
  workflowId: string;
  workflowName: string;
  /** The control this run exercised, via the Control Library's own link. */
  controlId: string | null;
  controlName: string | null;
  userEmail: string;
  userName: string;
  team: string;
  startedAt: number;
  /** null while a run is open — a blocked or paused run never completed. */
  completedAt: number | null;
  durationSecs: number;
  rowCount: number | null;
  status: RunStatus;
  /** The engine's own error text. Shown verbatim, never summarised. */
  executionError: string | null;
  /** Set when this run was one leg of a bulk execution. */
  bulkRunId: string | null;
  /** Last state change — what "paused for over 24 hours" is measured from. */
  updatedAt: number;
}

/** One question asked of the chat assistant, and the work behind the answer. */
export interface ChatQuestion {
  id: string;
  userEmail: string;
  team: string;
  askedAt: number;
  /** Assistant steps taken — the stored agent actions behind the answer. */
  steps: number;
  /** ESTIMATED. The product counts characters divided by four. */
  tokensIn: number;
  tokensOut: number;
  /** Whether the answer was frozen into the workflow library. */
  savedAsWorkflow: boolean;
  /** The program behind the answer is stored, so the answer can be re-run. */
  reproducible: boolean;
}

/** One Concierge background job — the only record with a real cost on it. */
export interface ConciergeJob {
  id: string;
  toolId: string;
  toolTitle: string;
  userEmail: string;
  team: string;
  startedAt: number;
  durationSecs: number;
  status: 'completed' | 'failed';
  /** Real dollars billed by the model provider for this job. */
  costUsd: number;
}

/** One SOP-to-RACM generation. Records the result, nothing about spend. */
export interface SopRacmJob {
  id: string;
  userEmail: string;
  team: string;
  startedAt: number;
  status: 'completed' | 'failed';
  /** A cache hit skips the AI entirely, so job count says nothing about spend. */
  cached: boolean;
}

/* ──────────────────────────────────────────────────────────────────────────
 * 5 · Who can run a workflow
 * ────────────────────────────────────────────────────────────────────────── */

/** Roles holding `wf_run`. Only these members ever appear as a run's actor. */
const RUNNER_ROLES = new Set(['role-admin', 'role-enabler', 'role-auditor']);

interface Actor { email: string; name: string; team: string; weight: number }

/**
 * The pool of actors, in roster order. Invited, suspended, locked and inactive
 * members are left out: a member's history stops when their access did.
 *
 * The weights make some people busier than others. They are never surfaced as a
 * ranking — nothing on this page sorts people by output — they only stop the
 * history reading as a rota.
 */
const ACTORS: Actor[] = SEED_USERS
  .filter(u => u.status === 'Active' && RUNNER_ROLES.has(u.roleId) && u.team !== '—')
  .map((u, i) => ({
    email: u.email,
    name: u.name,
    team: u.team,
    weight: [5, 4, 3, 3, 2, 2, 1, 1, 1][i % 9],
  }));

function pickActor(r: () => number): Actor {
  const total = ACTORS.reduce((s, a) => s + a.weight, 0);
  let n = r() * total;
  for (const a of ACTORS) { n -= a.weight; if (n <= 0) return a; }
  return ACTORS[ACTORS.length - 1];
}

/* ──────────────────────────────────────────────────────────────────────────
 * 6 · Workflow profiles and control links
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Workflows that test a control instead of processing rows.
 *
 * They complete with no row output: the answer is that the control held, or it
 * did not. Each such run stands in for one manual control test, which is what
 * makes `manualControlTestHours` a live setting rather than an inert one. Both
 * are the library's Compliance and Monitoring types, checking on a schedule.
 */
const CONTROL_TEST_WORKFLOWS = new Set(['wf-006', 'wf-008']);

/** How much data each workflow chews through, and how long its engine takes.
 *  The run COUNT is deliberately absent — that comes from the library. */
const WORKFLOW_PROFILE: Record<string, { rows: number; secs: number }> = {
  'wf-001': { rows: 9_000, secs: 110 },
  'wf-002': { rows: 1_400, secs: 25 },
  'wf-003': { rows: 4_200, secs: 48 },
  'wf-004': { rows: 26_000, secs: 240 },
  'wf-005': { rows: 18_000, secs: 175 },
  'wf-006': { rows: 850, secs: 18 },
  'wf-007': { rows: 31_000, secs: 280 },
  'wf-008': { rows: 5_400, secs: 65 },
  'wf-009': { rows: 7_200, secs: 80 },
  'wf-010': { rows: 11_000, secs: 125 },
};

/** Control lookup, straight off the Control Library's own workflow links. */
const CONTROL_FOR_WORKFLOW: Record<string, { id: string; name: string }> = (() => {
  const map: Record<string, { id: string; name: string }> = {};
  CONTROL_LIBRARY.forEach(c => {
    (c.linkedWorkflowIds ?? []).forEach(wfId => { map[wfId] ??= { id: c.controlId, name: c.name }; });
  });
  return map;
})();

/** Engine errors, verbatim. A stuck run shows one of these, never a summary. */
const ERRORS = [
  'DataSourceTimeout: SAP ERP AP module did not respond within 120s',
  'SchemaMismatch: expected column "PO_REFERENCE", found "PO_REF" in source Invoice Archive',
  'AuthError: connector credentials for Vendor Master expired on 12 Apr 2026',
  'RowLimitExceeded: source returned 1,204,882 rows, limit is 1,000,000',
  'NullKeyError: 412 rows had no invoice number and could not be matched',
  'ConnectionReset: bank remittance SFTP dropped after 38,204 of 91,000 rows',
];

/* ──────────────────────────────────────────────────────────────────────────
 * 7 · The generator
 * ────────────────────────────────────────────────────────────────────────── */

const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

/** "Apr 15, 2026" → ms. The Workflow Library's own date format. */
function parseLibraryDate(value: string): number {
  const m = /^([A-Za-z]{3})\s+(\d{1,2}),\s*(\d{4})$/.exec(value.trim());
  if (!m) return ANCHOR;
  return Date.UTC(Number(m[3]), MONTHS[m[1]] ?? 0, Number(m[2]), 11, 0, 0);
}

function buildRuns(): WorkflowRun[] {
  const r = mulberry32(0x9f1c2a7d);
  const runs: WorkflowRun[] = [];
  let seq = 0;

  for (const wf of WORKFLOWS) {
    const profile = WORKFLOW_PROFILE[wf.id];
    if (!profile) continue;
    const control = CONTROL_FOR_WORKFLOW[wf.id] ?? null;
    const lastRun = parseLibraryDate(wf.lastRun);
    const controlTest = CONTROL_TEST_WORKFLOWS.has(wf.id);

    // Spread back from the library's last-run date and squeezed toward the
    // recent end: the platform has been used more each quarter, not evenly.
    for (let i = 0; i < wf.runs; i++) {
      const share = wf.runs === 1 ? 0 : i / (wf.runs - 1);
      const dayMs = Math.round(lastRun - Math.pow(share, 1.7) * (lastRun - HISTORY_START));
      const startedAt = workingMoment(startOfDay(dayMs), r);

      const roll = r();
      const status: RunStatus =
        roll < 0.055 ? 'failed' : roll < 0.075 ? 'blocked' : roll < 0.085 ? 'paused' : 'complete';
      const complete = status === 'complete';
      const actor = pickActor(r);
      const durationSecs = vary(profile.secs, 0.35, r);
      // A run that completed and found nothing to process did work no person
      // would have had to do either, so it is worth nothing and says so.
      const emptyRun = complete && !controlTest && r() < 0.03;

      runs.push({
        id: `run-${String(++seq).padStart(4, '0')}`,
        workflowId: wf.id,
        workflowName: wf.name,
        controlId: control?.id ?? null,
        controlName: control?.name ?? null,
        userEmail: actor.email,
        userName: actor.name,
        team: actor.team,
        startedAt,
        completedAt: complete ? startedAt + durationSecs * 1000 : null,
        durationSecs: complete ? durationSecs : Math.round(durationSecs * r()),
        rowCount: controlTest ? null : complete ? (emptyRun ? 0 : vary(profile.rows, 0.4, r)) : null,
        status,
        executionError: complete ? null : ERRORS[Math.floor(r() * ERRORS.length)],
        bulkRunId: null,
        updatedAt: complete ? startedAt + durationSecs * 1000 : startedAt + Math.floor(r() * 6) * HOUR_MS,
      });
    }
  }

  // Bulk executions — several workflows fired at once against one sample. A
  // different unit of work, never added to the single-run count.
  const b = mulberry32(0x3b4d51e9);
  const bulkable = WORKFLOWS.filter(w => WORKFLOW_PROFILE[w.id]);
  for (let n = 0; n < 10; n++) {
    const bulkRunId = `bulk-${String(n + 1).padStart(3, '0')}`;
    const dayMs = HISTORY_START + Math.floor(b() * ((ANCHOR - HISTORY_START) / DAY_MS)) * DAY_MS;
    const startedAt = workingMoment(startOfDay(dayMs), b);
    const actor = pickActor(b);
    const legs = 3 + Math.floor(b() * 3);

    for (let l = 0; l < legs; l++) {
      const wf = bulkable[Math.floor(b() * bulkable.length)];
      const profile = WORKFLOW_PROFILE[wf.id];
      const control = CONTROL_FOR_WORKFLOW[wf.id] ?? null;
      const failed = b() < 0.08;
      const durationSecs = vary(Math.round(profile.secs * 0.3), 0.3, b);
      const legStart = startedAt + l * 90_000;

      runs.push({
        id: `run-${String(++seq).padStart(4, '0')}`,
        workflowId: wf.id,
        workflowName: wf.name,
        controlId: control?.id ?? null,
        controlName: control?.name ?? null,
        userEmail: actor.email,
        userName: actor.name,
        team: actor.team,
        startedAt: legStart,
        completedAt: failed ? null : legStart + durationSecs * 1000,
        durationSecs,
        rowCount: failed ? null : vary(Math.round(profile.rows * 0.18), 0.3, b),
        status: failed ? 'failed' : 'complete',
        executionError: failed ? ERRORS[Math.floor(b() * ERRORS.length)] : null,
        bulkRunId,
        updatedAt: legStart + durationSecs * 1000,
      });
    }
  }

  return runs.sort((a, z) => a.startedAt - z.startedAt);
}

/** Every workflow execution the platform has recorded. */
export const RUNS: WorkflowRun[] = buildRuns();

/** The bulk executions, as a unit of their own. */
export const BULK_RUN_IDS: string[] = Array.from(
  new Set(RUNS.map(r => r.bulkRunId).filter((x): x is string => x !== null)),
);

function buildChat(): ChatQuestion[] {
  const r = mulberry32(0x11a7f30b);
  const out: ChatQuestion[] = [];
  const days = Math.round((ANCHOR - HISTORY_START) / DAY_MS);
  for (let d = 0; d < days; d++) {
    const dayMs = HISTORY_START + d * DAY_MS;
    const dow = new Date(dayMs).getUTCDay();
    const weekend = dow === 0 || dow === 6;
    // Chat has grown across the window: a later day gets more questions.
    const growth = 0.55 + (d / days) * 1.1;
    const asks = weekend ? (r() < 0.35 ? 1 : 0) : Math.round((1 + r() * 3) * growth);
    for (let i = 0; i < asks; i++) {
      const actor = pickActor(r);
      const steps = 3 + Math.floor(r() * 10);
      out.push({
        id: `chat-${out.length + 1}`,
        userEmail: actor.email,
        team: actor.team,
        askedAt: workingMoment(dayMs, r),
        steps,
        tokensIn: vary(1_400 * steps, 0.4, r),
        tokensOut: vary(320 * steps, 0.4, r),
        savedAsWorkflow: r() < 0.06,
        // The program behind the answer is stored on every question, so every
        // answer can be re-run and checked. For an audit product that is the
        // point, not a technical detail.
        reproducible: true,
      });
    }
  }
  return out;
}

export const CHAT_QUESTIONS: ChatQuestion[] = buildChat();

function buildConcierge(): ConciergeJob[] {
  const r = mulberry32(0x77c0de11);
  // The RACM Generator is the SOP-to-RACM pipeline, counted separately: it is
  // the one tool that records nothing about what it consumed.
  const tools = CONCIERGE_TOOLS.filter(t => t.id !== 'racm-generator');
  const out: ConciergeJob[] = [];
  const days = Math.round((ANCHOR - HISTORY_START) / DAY_MS);
  for (let d = 0; d < days; d++) {
    if (r() > 0.42) continue;
    const dayMs = HISTORY_START + d * DAY_MS;
    const tool = tools[Math.floor(r() * tools.length)];
    const actor = pickActor(r);
    const failed = r() < 0.07;
    out.push({
      id: `cj-${out.length + 1}`,
      toolId: tool.id,
      toolTitle: tool.title,
      userEmail: actor.email,
      team: actor.team,
      startedAt: workingMoment(dayMs, r),
      durationSecs: vary(240, 0.7, r),
      status: failed ? 'failed' : 'completed',
      costUsd: failed ? 0 : Number((0.04 + r() * 1.35).toFixed(4)),
    });
  }
  return out;
}

export const CONCIERGE_JOBS: ConciergeJob[] = buildConcierge();

function buildSopRacm(): SopRacmJob[] {
  const r = mulberry32(0x2c9ab410);
  const out: SopRacmJob[] = [];
  const days = Math.round((ANCHOR - HISTORY_START) / DAY_MS);
  for (let d = 0; d < days; d++) {
    if (r() > 0.13) continue;
    const dayMs = HISTORY_START + d * DAY_MS;
    const actor = pickActor(r);
    out.push({
      id: `sop-${out.length + 1}`,
      userEmail: actor.email,
      team: actor.team,
      startedAt: workingMoment(dayMs, r),
      status: r() < 0.05 ? 'failed' : 'completed',
      cached: r() < 0.45,
    });
  }
  return out;
}

export const SOP_RACM_JOBS: SopRacmJob[] = buildSopRacm();

/* ──────────────────────────────────────────────────────────────────────────
 * 7b · Manual review records — what calibration measures against
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * One piece of review work a person did by hand, with a clock on it.
 *
 * This is the record the settings calibration reads: how many rows a person
 * actually got through, and how long it actually took them, from the platform's
 * own timestamps rather than from anybody's opinion. In the backend these are
 * the exception rows' `assigned_at` and `resolved_at` columns plus the rows
 * reviewed. Whether those columns are usable is an open question for
 * engineering; until it is answered this generator stands in for them, and the
 * day the real columns land this whole section is deleted and the calibration
 * reads the table instead. Nothing else in the module changes.
 *
 * The spans are deliberately messy. Some reviews are interrupted, some sit over
 * a weekend, and a couple are the person who forgot to close the record on
 * Friday. That is what makes the trimming in the calibration do real work
 * instead of being decoration.
 */
export interface ReviewRecord {
  id: string;
  userEmail: string;
  team: string;
  assignedAt: number;
  resolvedAt: number;
  rowsReviewed: number;
}

function buildReviews(): ReviewRecord[] {
  const r = mulberry32(0x4d17be03);
  const out: ReviewRecord[] = [];
  const days = Math.round((ANCHOR - HISTORY_START) / DAY_MS);

  for (let d = 0; d < days; d++) {
    const dayMs = HISTORY_START + d * DAY_MS;
    const dow = new Date(dayMs).getUTCDay();
    if (dow === 0 || dow === 6) continue;

    const reviews = 1 + Math.floor(r() * 3);
    for (let i = 0; i < reviews; i++) {
      const actor = pickActor(r);
      const assignedAt = workingMoment(dayMs, r);
      const rowsReviewed = 40 + Math.floor(r() * 560);
      // The person's own pace, which varies by person and by day.
      const paceRows = 150 + r() * 110;
      let hours = rowsReviewed / paceRows;
      // One in twelve was left open far longer than the work took — the record
      // says two days, the review took forty minutes. Calibration has to survive
      // these rather than average them in.
      if (r() < 0.08) hours += 8 + r() * 40;
      out.push({
        id: `rev-${out.length + 1}`,
        userEmail: actor.email,
        team: actor.team,
        assignedAt,
        resolvedAt: assignedAt + Math.round(hours * HOUR_MS),
        rowsReviewed,
      });
    }
  }
  return out;
}

/** Every hand review the platform has a clock on. */
export const REVIEW_RECORDS: ReviewRecord[] = buildReviews();

/* ──────────────────────────────────────────────────────────────────────────
 * 8 · The vendor price list — PU-19
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * One priced vendor lookup.
 *
 * `billingUnit` is the whole ballgame: a run that checks 500 vendors almost
 * certainly makes 500 billable calls rather than one, and the answer lives
 * inside each workflow's stored program. Getting it wrong puts the cost figure
 * out by a factor of a thousand, so it is a per-workflow field with no default.
 *
 * The rows are versioned by date, so renegotiating a contract never rewrites
 * last quarter's cost.
 */
export interface WorkflowApiPrice {
  workflowId: string;
  vendor: string;
  apiName: string;
  billingUnit: 'run' | 'row';
  pricePaise: number;
  effectiveFrom: number;
  effectiveTo: number | null;
}

/**
 * The price list, empty.
 *
 * A workflow is billable exactly when this table holds a row for it — there is
 * no second flag and no separate list to keep in sync. It is empty because the
 * vendor price list has not been supplied, so cost to run has nothing to price
 * and says exactly that. It is not a placeholder for a future feature: the
 * plumbing is built, and the day a row lands here every past period is priced
 * from runs already recorded.
 */
export const WORKFLOW_API_PRICING: WorkflowApiPrice[] = [];

/** Billable means "has a price row". One list, one truth. */
export const billableWorkflowIds = (): Set<string> =>
  new Set(WORKFLOW_API_PRICING.map(p => p.workflowId));

/* ──────────────────────────────────────────────────────────────────────────
 * 9 · Exceptions, traced back to the run that raised them
 * ────────────────────────────────────────────────────────────────────────── */

/** The exception register carries the engagement-side workflow ids. */
const EXCEPTION_WORKFLOW_MAP: Record<string, string> = {
  wf1: 'wf-007', wf2: 'wf-001', wf3: 'wf-003', wf4: 'wf-002',
};

/** "4h ago" / "3d ago" / "15m ago" → a moment before the anchor. */
function parseOpened(value: string): number {
  const m = /^(\d+)([mhd])\s+ago$/.exec(value.trim());
  if (!m) return ANCHOR;
  const n = Number(m[1]);
  const unit = m[2] === 'm' ? 60_000 : m[2] === 'h' ? HOUR_MS : DAY_MS;
  return ANCHOR - n * unit;
}

/**
 * An exception with the run that raised it.
 *
 * The link is the one thing the page needs and the database may not have. Where
 * it exists, every counted exception traces to its run; where it does not, the
 * exception still counts and simply has no run to open. The page never drops a
 * real finding because the plumbing behind it is thin.
 */
export interface TracedException {
  exception: EngagementException;
  openedAt: number;
  runId: string | null;
  workflowId: string | null;
  team: string | null;
  userEmail: string | null;
}

function traceExceptions(): TracedException[] {
  return ENGAGEMENT_EXCEPTIONS.map(e => {
    const openedAt = parseOpened(e.opened);
    const wfId = EXCEPTION_WORKFLOW_MAP[e.workflowId] ?? null;
    const run = wfId
      ? RUNS.filter(x => x.workflowId === wfId && x.startedAt <= openedAt).pop() ?? null
      : null;
    return {
      exception: e,
      openedAt,
      runId: run?.id ?? null,
      workflowId: wfId,
      team: run?.team ?? null,
      userEmail: run?.userEmail ?? null,
    };
  });
}

export const TRACED_EXCEPTIONS: TracedException[] = traceExceptions();

/* ──────────────────────────────────────────────────────────────────────────
 * 10 · Dev guards — the two ways this record can go quietly wrong
 * ────────────────────────────────────────────────────────────────────────── */

if (import.meta.env.DEV) {
  if (ACTORS.length === 0) {
    console.error('[Platform Usage] Nobody on the roster can run a workflow, so the run history is empty.');
  }
  const unprofiled = WORKFLOWS.filter(w => !WORKFLOW_PROFILE[w.id]).map(w => w.id);
  if (unprofiled.length > 0) {
    console.error(
      `[Platform Usage] No run profile for ${unprofiled.join(', ')}. They will read as never run ` +
      'even though the Workflow Library says they have.',
    );
  }
}
