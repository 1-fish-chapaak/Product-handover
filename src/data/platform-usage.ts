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
import { MY_DASHBOARDS, SHARED_DASHBOARDS } from './dashboards';
import { ENGAGEMENTS } from './engagements';
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
  'Counts runs, chat, Concierge, Smart Learn, dashboards and alerts, reports, sampling, insights, ' +
  'risks, engagements and items created. Edits and reviews appear as the event log fills.';

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
export function parseLibraryDate(value: string): number {
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
 * The per-API price list, empty until somebody splits a bill.
 *
 * Layer 3, and optional: the invoices above already give an exact cost. This
 * only exists for a business that wants that cost split per workflow, and its
 * per-workflow total for a month should reconcile against the invoice for the
 * same month. A gap between them is a flag worth showing rather than hiding.
 *
 * A workflow is billable exactly when this table holds a row for it — there is
 * no second flag and no separate list to keep in sync. It ships empty because
 * the vendor price list has not been supplied, so cost to run has nothing to
 * price and says exactly that. It is not a placeholder for a future feature:
 * the plumbing is built, and the moment a row lands here every past period is
 * priced from runs already recorded.
 *
 * The rows a CFO enters are held per browser rather than in this array, so the
 * shipped default stays empty and the entered prices survive a reload.
 */
export const WORKFLOW_API_PRICING: WorkflowApiPrice[] = [];

/* ── Layer 2 · the month's bill, which is what the business actually knows ── */

/**
 * One vendor invoice for one month.
 *
 * The primary cost input, and deliberately the dullest one. Nobody filling a
 * price form reliably knows a per-API rate, or whether a workflow bills once a
 * run or once a row. What they know with certainty is the number on the bill,
 * so that is the number the page asks for: one row per vendor per month, summed
 * over the window, exact and reconcilable against what finance paid.
 *
 * Past months can be entered at any time and history fills in behind them.
 */
export interface VendorInvoice {
  vendor: string;
  /** First of the month, UTC. One invoice per vendor per month. */
  periodMonth: number;
  amountPaise: number;
  /** Credit notes, disputes, anything the figure needs said next to it. */
  note: string | null;
  enteredBy: string;
  enteredAt: number;
}

const INVOICES_KEY = 'irame.platformUsage.invoices.v1';

/** Every invoice entered, oldest month first. Ships empty. */
export function loadInvoices(): VendorInvoice[] {
  try {
    const raw = localStorage.getItem(INVOICES_KEY);
    if (!raw) return [];
    const saved = JSON.parse(raw) as VendorInvoice[];
    return Array.isArray(saved) ? saved.slice().sort((a, z) => a.periodMonth - z.periodMonth) : [];
  } catch {
    return [];
  }
}

function persistInvoices(rows: VendorInvoice[]): void {
  try { localStorage.setItem(INVOICES_KEY, JSON.stringify(rows)); } catch { /* storage unavailable */ }
}

/** Enter, or correct, one month's bill. Re-entering a month replaces it. */
export function addInvoice(next: VendorInvoice): VendorInvoice[] {
  const rows = [
    ...loadInvoices().filter(r => !(r.vendor === next.vendor && r.periodMonth === next.periodMonth)),
    next,
  ].sort((a, z) => a.periodMonth - z.periodMonth || a.vendor.localeCompare(z.vendor));
  persistInvoices(rows);
  return rows;
}

export function removeInvoice(vendor: string, periodMonth: number): VendorInvoice[] {
  const rows = loadInvoices().filter(r => !(r.vendor === vendor && r.periodMonth === periodMonth));
  persistInvoices(rows);
  return rows;
}

/** First of the month a moment falls in, UTC. */
export const startOfMonthUtc = (ms: number): number => {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
};

/** Every month the window touches, first of month, oldest first. */
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

/* ── Layer 3 · the optional per-API split ────────────────────────────────── */

const PRICING_KEY = 'irame.platformUsage.pricing.v1';

/** Every price row in force, entered ones included. */
export function loadPricing(): WorkflowApiPrice[] {
  try {
    const raw = localStorage.getItem(PRICING_KEY);
    if (!raw) return WORKFLOW_API_PRICING;
    const saved = JSON.parse(raw) as WorkflowApiPrice[];
    return Array.isArray(saved) ? [...WORKFLOW_API_PRICING, ...saved] : WORKFLOW_API_PRICING;
  } catch {
    return WORKFLOW_API_PRICING;
  }
}

function persistPricing(rows: WorkflowApiPrice[]): void {
  try { localStorage.setItem(PRICING_KEY, JSON.stringify(rows)); } catch { /* storage unavailable */ }
}

/**
 * Price one workflow's lookup from a given date.
 *
 * A renegotiated price never rewrites the old one: the row in force is closed
 * the day before the new one starts, and both stay. That is what makes last
 * quarter's cost still read as last quarter's cost after a contract changes.
 */
export function addPrice(next: Omit<WorkflowApiPrice, 'effectiveTo'>): WorkflowApiPrice[] {
  const entered = loadPricing().filter(r => !WORKFLOW_API_PRICING.includes(r));
  const closed = entered.map(r =>
    r.workflowId === next.workflowId && r.effectiveTo === null && r.effectiveFrom < next.effectiveFrom
      ? { ...r, effectiveTo: next.effectiveFrom - DAY_MS }
      : r);
  // Re-entering a price for the same start date replaces that row rather than
  // stacking two prices on one day, which no cost calculation could resolve.
  const rows = [
    ...closed.filter(r => !(r.workflowId === next.workflowId && r.effectiveFrom === next.effectiveFrom)),
    { ...next, effectiveTo: null },
  ].sort((a, z) => a.workflowId.localeCompare(z.workflowId) || a.effectiveFrom - z.effectiveFrom);
  persistPricing(rows);
  return loadPricing();
}

/** Remove one entered price row. The shipped list can never be edited away. */
export function removePrice(workflowId: string, effectiveFrom: number): WorkflowApiPrice[] {
  const entered = loadPricing()
    .filter(r => !WORKFLOW_API_PRICING.includes(r))
    .filter(r => !(r.workflowId === workflowId && r.effectiveFrom === effectiveFrom));
  persistPricing(entered);
  return loadPricing();
}

/** Billable means "has a price row". One list, one truth. */
export const billableWorkflowIds = (): Set<string> =>
  new Set(loadPricing().map(p => p.workflowId));

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
 * 10 · Who a name belongs to
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * The team a person is on, by name.
 *
 * The rest of the product stores a person's name on the thing they made — the
 * dashboard's creator, the engagement's owner, the report's author. A team lens
 * needs the team behind that name, and the roster is the only place it exists.
 * A name that is not on the roster returns null and is never claimed by a team:
 * an engagement owned by somebody outside the platform belongs to nobody's
 * team, and saying otherwise would put another team's work on a lead's screen.
 */
const TEAM_BY_NAME: Map<string, string> = new Map(
  SEED_USERS.filter(u => u.team && u.team !== '—').map(u => [u.name, u.team]),
);

export const teamOfName = (name: string): string | null => TEAM_BY_NAME.get(name) ?? null;

const EMAIL_BY_NAME: Map<string, string> = new Map(SEED_USERS.map(u => [u.name, u.email]));

export const emailOfName = (name: string): string | null => EMAIL_BY_NAME.get(name) ?? null;

/* ──────────────────────────────────────────────────────────────────────────
 * 11 · Alerts, and the worker that fires them — PU-22
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * One alert firing on a dashboard widget.
 *
 * Dashboards and widgets already write a before-and-after event on every
 * create, update and delete, and Platform Usage counts those from the product's
 * own event log. An alert firing is the one event in that family with no person
 * behind it: a background worker checks the widget on a schedule and writes the
 * event itself. That is why `firedBy` is nullable rather than pointing at
 * whoever built the widget, and why the page labels those rows automatic. A
 * fire attributed to a person who was asleep at the time is a lie the reader
 * cannot detect.
 */
export interface AlertFire {
  id: string;
  at: number;
  dashboardId: string;
  dashboardName: string;
  widgetName: string;
  /** What tripped, in the words the alert itself uses. */
  condition: string;
  /** Null when the scheduled worker fired it, which is most of the time. */
  firedBy: string | null;
  team: string | null;
}

/** The widgets that carry an alert, and what each one watches. */
const ALERT_RULES: { dashboardId: string; widget: string; condition: string; perMonth: number }[] = [
  { dashboardId: 'p2p', widget: 'Duplicate invoice flags', condition: 'Duplicate flags above 25 in a day', perMonth: 4 },
  { dashboardId: 'p2p', widget: 'Invoices without a PO', condition: 'More than 2% of invoices have no purchase order', perMonth: 3 },
  { dashboardId: 'grc', widget: 'Controls failing', condition: 'A key control fails two runs in a row', perMonth: 2 },
  { dashboardId: 'grc', widget: 'Open deficiencies', condition: 'Open deficiencies above 10', perMonth: 2 },
  { dashboardId: 'o2c', widget: 'Credit limit overrides', condition: 'An override above 10 lakh with no approver', perMonth: 3 },
  { dashboardId: 'shared-2', widget: 'Overdue action plans', condition: 'An action plan is past its due date', perMonth: 5 },
];

const DASHBOARD_BY_ID: Map<string, { name: string; creator: string }> = new Map(
  [...MY_DASHBOARDS, ...SHARED_DASHBOARDS].map(d => [d.id, { name: d.name, creator: d.creator }]),
);

function buildAlertFires(): AlertFire[] {
  const r = mulberry32(0x71a3d90b);
  const fires: AlertFire[] = [];
  const months = (ANCHOR - HISTORY_START) / (DAY_MS * 30.44);
  let seq = 0;

  for (const rule of ALERT_RULES) {
    const dash = DASHBOARD_BY_ID.get(rule.dashboardId);
    if (!dash) continue;
    const total = Math.round(rule.perMonth * months);

    for (let i = 0; i < total; i++) {
      const dayMs = startOfDay(HISTORY_START + Math.floor(r() * (ANCHOR - HISTORY_START)));
      // Most fires are the worker's. The rest are somebody re-running the
      // widget by hand and tripping the same rule while they watch.
      const byHand = r() < 0.2;
      const actor = byHand ? pickActor(r) : null;
      fires.push({
        id: `fire-${String(++seq).padStart(4, '0')}`,
        at: workingMoment(dayMs, r),
        dashboardId: rule.dashboardId,
        dashboardName: dash.name,
        widgetName: rule.widget,
        condition: rule.condition,
        firedBy: actor?.name ?? null,
        team: actor?.team ?? null,
      });
    }
  }

  return fires.sort((a, z) => a.at - z.at);
}

/** Every alert the platform has fired, worker and hand alike. */
export const ALERT_FIRES: AlertFire[] = buildAlertFires();

/** Dashboards live in the workspace right now — the context under the counts. */
export const DASHBOARD_TOTAL: number = MY_DASHBOARDS.length + SHARED_DASHBOARDS.length;

/** Widgets carrying an alert right now. */
export const ALERT_RULE_TOTAL: number = ALERT_RULES.length;

/* ──────────────────────────────────────────────────────────────────────────
 * 12 · Sampling — the validation runs and how they ended — PU-24
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * A sample validation run and its lifecycle.
 *
 * Testing a control on a sample is its own kind of run: it is queued, it runs,
 * and it ends passed, failed or errored. The last two are different facts and
 * the page never merges them. A failed run is a finding — the control did not
 * hold. An errored run is not a finding at all: the check could not be
 * completed, so somebody has to look at it before anything can be concluded.
 * Reading one as the other either invents a deficiency or hides one.
 */
export type SampleRunStatus = 'queued' | 'running' | 'passed' | 'failed' | 'error';

export interface SampleRun {
  id: string;
  at: number;
  engagementId: string;
  engagementName: string;
  controlId: string;
  controlName: string;
  status: SampleRunStatus;
  /** How many items the sample held. */
  sampleSize: number;
  userEmail: string;
  userName: string;
  team: string;
  /** Why the run errored, verbatim. Null on every other status. */
  note: string | null;
}

/** Why a sample run could not be concluded. Shown as written, never summarised. */
const SAMPLE_ERRORS = [
  'Evidence file for sample item 14 could not be opened',
  'Sample selection returned fewer items than the population requires',
  'Approver named on the sample is not in the user directory',
  'Two sample items point at the same document, so the sample is short',
];

/** The engagements that are actually being tested, with their process. */
const TESTING_ENGAGEMENTS = ENGAGEMENTS.filter(e =>
  e.status === 'Active' || e.status === 'In Progress' || e.status === 'Review');

function buildSampleRuns(): SampleRun[] {
  const r = mulberry32(0x2c6f18a5);
  const rows: SampleRun[] = [];
  let seq = 0;

  for (const eng of TESTING_ENGAGEMENTS) {
    // A sample run tests one control, so the controls come from the library the
    // engagement's process actually has. An engagement whose process has no
    // controls in the library is tested by nothing, and shows exactly that.
    // Never more controls than the engagement itself holds: a snapshot of eight
    // controls cannot produce validations for fourteen, and a strip reading
    // "9 of 4 controls tested" is the page contradicting itself.
    const inProcess = CONTROL_LIBRARY.filter(c => c.businessProcess === eng.process);
    const controls = inProcess.slice(0, Math.max(0, Math.min(inProcess.length, eng.controls)));
    if (controls.length === 0) continue;

    const perControl = 2 + Math.floor(r() * 4);
    for (const c of controls) {
      for (let i = 0; i < perControl; i++) {
        const dayMs = startOfDay(HISTORY_START + Math.floor(r() * (ANCHOR - HISTORY_START)));
        const at = workingMoment(dayMs, r);
        const roll = r();
        // A run started in the last two days may still be in flight; older ones
        // have all landed one way or the other.
        const inFlight = ANCHOR - at < 2 * DAY_MS;
        const status: SampleRunStatus = inFlight
          ? (roll < 0.5 ? 'queued' : 'running')
          : roll < 0.68 ? 'passed' : roll < 0.9 ? 'failed' : 'error';
        const actor = pickActor(r);

        rows.push({
          id: `sample-${String(++seq).padStart(4, '0')}`,
          at,
          engagementId: eng.id,
          engagementName: eng.name,
          controlId: c.controlId,
          controlName: c.name,
          status,
          sampleSize: 15 + Math.floor(r() * 30),
          userEmail: actor.email,
          userName: actor.name,
          team: actor.team,
          note: status === 'error' ? SAMPLE_ERRORS[Math.floor(r() * SAMPLE_ERRORS.length)] : null,
        });
      }
    }
  }

  return rows.sort((a, z) => a.at - z.at);
}

/** Every sample validation the platform has recorded. */
export const SAMPLE_RUNS: SampleRun[] = buildSampleRuns();

/* ──────────────────────────────────────────────────────────────────────────
 * 13 · AI insights — what the assistant wrote down by itself — PU-25
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * One generated insight.
 *
 * Two kinds, and the difference matters enough to be a field rather than a
 * label. A per-run insight is written off one run. A consolidated insight is
 * the assistant reading a whole engagement and saying one thing about it, so it
 * summarises per-run insights that are already counted. Adding the two together
 * counts the same finding twice, which is why the split is carried all the way
 * to the screen.
 */
export type InsightKind = 'per_run' | 'consolidated';

export interface InsightRow {
  id: string;
  at: number;
  kind: InsightKind;
  engagementId: string;
  engagementName: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  category: string;
  title: string;
  /** Whose run produced it. Null on a consolidated insight: nobody ran it. */
  userEmail: string | null;
  userName: string | null;
  team: string | null;
}

const INSIGHT_CATEGORIES = ['Exception pattern', 'Data quality', 'Control design', 'Timing', 'Coverage'] as const;

const INSIGHT_TITLES: Record<string, (subject: string) => string> = {
  'Exception pattern': s => `The same vendor accounts for a third of the flags in ${s}`,
  'Data quality': s => `Nearly one in ten rows in ${s} arrives without an approver`,
  'Control design': s => `${s} is checked after payment, not before it`,
  Timing: s => `${s} runs after month end, so the exceptions land too late to act on`,
  Coverage: s => `${s} covers one entity, and the population spans four`,
};

const startOfMonth = (ms: number): number => {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
};

const nextMonth = (ms: number): number => {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
};

function buildInsights(): InsightRow[] {
  const r = mulberry32(0x54b8e207);
  const rows: InsightRow[] = [];
  let seq = 0;

  // Per-run: a share of the completed runs leaves one behind, carrying the
  // actor of the run that produced it so an auditor can be shown their own.
  const completed = RUNS.filter(x => x.status === 'complete');
  for (const run of completed) {
    // Roughly two runs in five leave an insight behind. Thinner than that and a
    // single person's view reads as "the assistant never notices anything",
    // which is a fact about the sample rather than about the product.
    if (r() > 0.4) continue;
    const eng = TESTING_ENGAGEMENTS[Math.floor(r() * TESTING_ENGAGEMENTS.length)];
    if (!eng) break;
    const category = INSIGHT_CATEGORIES[Math.floor(r() * INSIGHT_CATEGORIES.length)];
    const roll = r();
    rows.push({
      id: `insight-${String(++seq).padStart(4, '0')}`,
      at: run.completedAt ?? run.startedAt,
      kind: 'per_run',
      engagementId: eng.id,
      engagementName: eng.name,
      severity: roll < 0.08 ? 'Critical' : roll < 0.3 ? 'High' : roll < 0.68 ? 'Medium' : 'Low',
      category,
      title: INSIGHT_TITLES[category](run.controlName ?? run.workflowName),
      userEmail: run.userEmail,
      userName: run.userName,
      team: run.team,
    });
  }

  // Consolidated: one reading of a whole engagement, monthly, by nobody.
  for (const eng of TESTING_ENGAGEMENTS) {
    for (let month = startOfMonth(HISTORY_START); month <= ANCHOR; month = nextMonth(month)) {
      if (r() > 0.55) continue;
      const category = INSIGHT_CATEGORIES[Math.floor(r() * INSIGHT_CATEGORIES.length)];
      const roll = r();
      rows.push({
        id: `insight-${String(++seq).padStart(4, '0')}`,
        at: workingMoment(month + 20 * DAY_MS, r),
        kind: 'consolidated',
        engagementId: eng.id,
        engagementName: eng.name,
        severity: roll < 0.12 ? 'Critical' : roll < 0.42 ? 'High' : roll < 0.8 ? 'Medium' : 'Low',
        category,
        title: INSIGHT_TITLES[category](eng.name),
        userEmail: null,
        userName: null,
        team: teamOfName(eng.owner),
      });
    }
  }

  return rows.filter(x => x.at <= ANCHOR).sort((a, z) => a.at - z.at);
}

/** Every insight the assistant has written down. */
export const INSIGHT_ROWS: InsightRow[] = buildInsights();

/* ──────────────────────────────────────────────────────────────────────────
 * 14 · Continuous monitoring — the automation config on an engagement — PU-28
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * How an engagement is automated.
 *
 * Continuous control monitoring is not a separate feature. It is a mode on an
 * engagement: the same checks, run on a schedule, raising exceptions as they
 * happen instead of once at the end of an audit. Every engagement therefore
 * carries a small configuration — is it continuous, how often the job runs,
 * what pass rate it expects, and how many approvals an exception needs — and
 * this is that configuration, read off the engagement itself.
 *
 * The pass-rate threshold is the number the page compares reality against. It
 * comes from the engagement's own automation config where the creation wizard
 * set one, and otherwise from the platform default of 80%, which is the value
 * the engagement would run under today.
 */
export interface EngagementAutomation {
  engagementId: string;
  engagementName: string;
  isCcm: boolean;
  /** How often the scheduled job runs. */
  cadence: string;
  /** The pass rate the engagement expects, as a percentage. */
  passRateThreshold: number;
  /** Approval levels an exception passes through, per side. */
  approvalLevelsRiskOwner: number;
  approvalLevelsAuditor: number;
  owner: string;
  team: string | null;
  status: string;
}

/** The platform's own default, applied where an engagement set no threshold. */
export const DEFAULT_PASS_RATE_THRESHOLD = 80;

function buildAutomation(): EngagementAutomation[] {
  const r = mulberry32(0x1d9c4f36);
  return ENGAGEMENTS.map(e => {
    const cfg = e.automationConfig;
    const isCcm = e.subtype === 'CCM' || Boolean(cfg?.cadence);
    return {
      engagementId: e.id,
      engagementName: e.name,
      isCcm,
      cadence: cfg?.cadence ?? (isCcm ? (r() < 0.5 ? 'Daily' : 'Weekly') : 'On request'),
      passRateThreshold: cfg?.threshold ?? DEFAULT_PASS_RATE_THRESHOLD,
      approvalLevelsRiskOwner: 1 + Math.floor(r() * 3),
      approvalLevelsAuditor: 1 + Math.floor(r() * 2),
      owner: e.owner,
      team: teamOfName(e.owner),
      status: e.status,
    };
  });
}

/** The automation configuration of every engagement. */
export const ENGAGEMENT_AUTOMATION: EngagementAutomation[] = buildAutomation();

/* ──────────────────────────────────────────────────────────────────────────
 * 15 · Dev guards — the ways this record can go quietly wrong
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
