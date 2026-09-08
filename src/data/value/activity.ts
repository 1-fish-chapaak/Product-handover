/**
 * One row per thing the platform did, shaped the way the ledger will store it
 * once the columns this feature needs are on it.
 *
 * Platform Usage reads the ledger as it stands today, which is why it cannot
 * put a workflow run against a person or a team. This page reads the same
 * events with the additions in the specification already made:
 *
 * · `team_id` on every row, written at the time rather than joined live to who
 *   is on which team today. Somebody who changes team leaves the value they
 *   created behind them.
 * · `workflow_id` and `workflow_name` on a run, which everything else hangs off.
 * · a complexity band on every run and every chat turn, **resolved and stored
 *   at the time of the event**, so that changing a threshold next quarter does
 *   not silently reband last quarter. Rows older than the day that column
 *   arrived carry a band worked out afterwards from what they already held,
 *   and they say so rather than passing as the same thing.
 * · a batch id, so runs triggered together can be grouped.
 * · the signals a chat band is read from, so the banding can be checked rather
 *   than taken on trust.
 * · which of the fourteen government lookups ran, and whether it was charged.
 *
 * Workflow runs are the same executions Platform Usage counts, one for one, so
 * a run counted on one page is the same run on the other. Chat, files taken in
 * and government lookups are seeded here, because the usage seed has no field
 * for them.
 */

import {
  ANCHOR, DAY_MS, HISTORY_START, HOUR_MS, EXECUTIONS, WORKFLOW_BY_ID, ACTORS,
  prng, type Actor,
} from '../usage/seed';
import { CONTROL_BY_ID, DECLARED_BAND, WORKFLOW_CONTROL_MAP, documentedHours, isReviewed } from './controls';
import {
  DEFAULT_SETTINGS, GOVT_LOOKUPS, GOVT_PRICE, type ActivityKind, type Band,
} from './settings';

const pick = <T>(rand: () => number, rows: readonly T[]): T => rows[Math.floor(rand() * rows.length)];
const isWeekday = (t: number): boolean => {
  const d = new Date(t).getUTCDay();
  return d !== 0 && d !== 6;
};

/**
 * The day the ledger started recording what a chat turn actually did.
 *
 * Sources touched and whether a turn produced a plan are new columns. Tokens
 * and model calls were always there. So a turn from before this date can still
 * be banded, on less, and every one of those rows is marked as banded
 * afterwards rather than at the time.
 */
export const SIGNALS_RECORDED_FROM = Date.UTC(2025, 9, 1);

/** Everybody who does audit work. Engineering uses the platform, it does not audit. */
const WORKERS = ACTORS.filter(a => a.team !== 'Engineering');
const workersOf = (team: string): Actor[] => WORKERS.filter(a => a.team === team);

/* ──────────────────────────────────────────────────────────────────────────
 * The row
 * ────────────────────────────────────────────────────────────────────────── */

export type ActivityStatus = 'ok' | 'failed' | 'stopped';

/** What a chat turn actually did. The band is read off these and stored. */
export interface ChatSignals {
  datasetsTouched: number;
  producedPlan: boolean;
  usedGovtLookup: boolean;
}

export interface Activity {
  id: string;
  kind: ActivityKind;
  at: number;
  /** Machine time. What the platform took, not what a person would have. */
  durationSecs: number;
  status: ActivityStatus;
  /** Sized at the time of the event and never recomputed. */
  band: Band;
  /**
   * True where the band was worked out later from what the row already held,
   * rather than written when the work happened. Marked, never hidden: it is
   * banded on less than a new row is.
   */
  bandBackfilled: boolean;
  /** Set on a workflow run and nothing else. */
  workflowId: string | null;
  /** Runs triggered together carry the same id. Null for a run started on its own. */
  batchId: string | null;
  /** Null on the handful of rows nothing ever wrote a user to. */
  runBy: Actor | null;
  /** Written at the time. Null where the row carries no user either. */
  team: string | null;
  llmCalls: number;
  tokens: number;
  llmCostUsd: number;
  /**
   * False where the model that ran has no published price. The row still
   * counts, its cost reads as nought, and any total built on it is a floor.
   */
  llmPriced: boolean;
  /** Only on chat turns, so the banding can be checked against what happened. */
  signals: ChatSignals | null;
  govtLookupKey: string | null;
  /** The provider charged for this call, including when it found no record. */
  govtBilled: boolean;
  /** Inside the provider's fourteen day window, so it cost nothing and still saved the trip. */
  govtCached: boolean;
  govtCostInr: number;
  /** A file that produced nothing banks nothing. */
  producedOutput: boolean;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Banding
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * A workflow's band.
 *
 * Where a checked control documents the effort, the hours decide the band: a
 * four hour test is a big job and a fifteen minute one is not. Where no control
 * does, the band declared on the workflow definition stands. Either way the
 * band only picks which evidence applies; it never supplies any.
 */
export function bandForWorkflow(workflowId: string): Band {
  const hours = WORKFLOW_CONTROL_MAP
    .filter(m => m.workflowId === workflowId)
    .map(m => CONTROL_BY_ID.get(m.controlId))
    .filter((c): c is NonNullable<typeof c> => c !== undefined && isReviewed(c))
    .reduce<number | null>((sum, c) => {
      const h = documentedHours(c);
      return h === null ? sum : (sum ?? 0) + h;
    }, null);

  if (hours !== null) {
    const { highHours, mediumHours } = DEFAULT_SETTINGS.workflowBands;
    if (hours >= highHours) return 'high';
    if (hours >= mediumHours) return 'medium';
    return 'low';
  }
  return DECLARED_BAND[workflowId] ?? 'medium';
}

/**
 * A chat turn's band, from what the turn did rather than from what it said.
 *
 * Sources touched first, then whether it produced a plan, then whether it
 * needed a government lookup, and only then how many model calls it took. The
 * call count is a tiebreak on purpose: it is the signal most likely to reward
 * the platform for working harder rather than for the work being harder.
 */
export function bandForChat(signals: ChatSignals | null, llmCalls: number): Band {
  const r = DEFAULT_SETTINGS.chatBands;
  if (signals !== null) {
    if (signals.datasetsTouched >= r.highDatasets) return 'high';
    if (r.planIsHigh && signals.producedPlan) return 'high';
    if (signals.datasetsTouched >= r.mediumDatasets) return 'medium';
    if (r.govtIsMedium && signals.usedGovtLookup) return 'medium';
  }
  if (llmCalls >= r.highLlmCalls) return 'high';
  if (llmCalls >= r.mediumLlmCalls) return 'medium';
  return 'low';
}

/** A file's band, from how much of it there was to read. */
export function bandForIngestion(tokens: number): Band {
  const r = DEFAULT_SETTINGS.ingestionBands;
  if (tokens >= r.highTokens) return 'high';
  if (tokens >= r.mediumTokens) return 'medium';
  return 'low';
}

/* ──────────────────────────────────────────────────────────────────────────
 * Workflow runs
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * The executions, with a person, a team, a band and a batch put on them.
 *
 * Attribution is by team: a run of a SOX Audit workflow was started by
 * somebody on SOX Audit. A few runs carry no user at all, which is the real
 * thing the ledger does today rather than a gap in this fixture. They count
 * for the company and appear on no team and no personal figure.
 *
 * A batch is runs of one workflow started together, and started together is
 * the operative half. The real ledger writes a batch id at the trigger; this
 * fixture has none, so a batch is taken to be runs of the same workflow on the
 * same day, and their start times are set to the moment the batch was
 * triggered. Without that they would sit hours apart and the page would report
 * a two minute workflow as having taken six hours, which is the opposite of
 * what a batch does.
 */
function buildRuns(): Activity[] {
  const rand = prng(7052026);
  const dayKey = (at: number) => Math.floor(at / DAY_MS);

  // Which runs were triggered together, worked out before anything is emitted
  // so that every member of a batch carries the same id.
  const clusters = new Map<string, string[]>();
  EXECUTIONS.forEach(e => {
    if (e.status === 'running') return;
    const key = `${e.workflowId}-${dayKey(e.startedAt)}`;
    clusters.set(key, [...(clusters.get(key) ?? []), e.id]);
  });
  const batchOf = new Map<string, string>();
  // Runs triggered together start together. The trigger is the earliest of
  // them, and the rest are queued a fraction of a second behind it, so the
  // batch's elapsed time is the longest run in it rather than the gap between
  // the first and the last.
  const startedAtOf = new Map<string, number>();
  [...clusters.entries()].forEach(([key, ids]) => {
    if (ids.length < 2) return;
    const triggerAt = Math.min(
      ...ids.map(id => EXECUTIONS.find(e => e.id === id)?.startedAt ?? 0),
    );
    ids.forEach((id, i) => {
      batchOf.set(id, `batch-${key}`);
      startedAtOf.set(id, triggerAt + i * 250);
    });
  });

  return EXECUTIONS
    .filter(e => e.status !== 'running')
    .map((e, i) => {
      const workflow = WORKFLOW_BY_ID.get(e.workflowId);
      const team = workflow?.team ?? null;
      const bench = team ? workersOf(team) : WORKERS;
      const unattributed = i % 437 === 3;
      const status: ActivityStatus =
        e.status === 'complete' ? 'ok' : e.status === 'failed' ? 'failed' : 'stopped';
      const priced = rand() > 0.06;
      return {
        id: `av-run-${e.id}`,
        kind: 'workflow_run' as ActivityKind,
        at: startedAtOf.get(e.id) ?? e.startedAt,
        durationSecs: e.durationSecs ?? 0,
        status,
        band: bandForWorkflow(e.workflowId),
        bandBackfilled: e.startedAt < SIGNALS_RECORDED_FROM,
        workflowId: e.workflowId,
        batchId: batchOf.get(e.id) ?? null,
        runBy: unattributed ? null : pick(rand, bench),
        team: unattributed ? null : team,
        llmCalls: status === 'ok' ? 3 + Math.floor(rand() * 8) : 1 + Math.floor(rand() * 3),
        tokens: Math.round((14_000 + rand() * 70_000) * (status === 'ok' ? 1 : 0.3)),
        llmCostUsd: priced ? Math.round((0.008 + rand() * 0.03) * 10_000) / 10_000 : 0,
        llmPriced: priced,
        signals: null,
        govtLookupKey: null,
        govtBilled: false,
        govtCached: false,
        govtCostInr: 0,
        producedOutput: status === 'ok',
      };
    });
}

/* ──────────────────────────────────────────────────────────────────────────
 * Chat
 * ────────────────────────────────────────────────────────────────────────── */

const CHAT_KINDS: { kind: ActivityKind; weight: number; low: number; high: number }[] = [
  { kind: 'chat_question', weight: 0.40, low: 14, high: 90 },
  { kind: 'chat_clarification', weight: 0.17, low: 8, high: 48 },
  { kind: 'chat_revision', weight: 0.14, low: 12, high: 66 },
  { kind: 'chat_plan_approval', weight: 0.09, low: 6, high: 24 },
  { kind: 'chat_workflow_suggestion', weight: 0.09, low: 4, high: 18 },
  { kind: 'chat_workflow_name', weight: 0.05, low: 2, high: 8 },
  { kind: 'chat_config_intent', weight: 0.06, low: 3, high: 14 },
];

function chatKind(roll: number): { kind: ActivityKind; low: number; high: number } {
  let acc = 0;
  for (const k of CHAT_KINDS) {
    acc += k.weight;
    if (roll <= acc) return k;
  }
  return CHAT_KINDS[0];
}

/**
 * Chat turns, with the signals their band was read from.
 *
 * The spread is wide on purpose, because the real ledger's is: a turn there
 * ranges from one model call over a hundred tokens to fifty one calls over
 * one and three quarter million.
 */
function buildChat(): Activity[] {
  const rand = prng(1409202);
  const out: Activity[] = [];
  let n = 0;

  for (let t = HISTORY_START; t <= ANCHOR; t += DAY_MS) {
    if (!isWeekday(t)) continue;
    // Chat grew as the workspace did, so the recent quarter is busier than the
    // first year. The ramp is a fixture, not a claim.
    const ramp = 0.4 + 0.9 * ((t - HISTORY_START) / (ANCHOR - HISTORY_START));
    const turns = Math.round(rand() * 7 * ramp);
    for (let i = 0; i < turns; i += 1) {
      n += 1;
      const spec = chatKind(rand());
      const actor = pick(rand, WORKERS);
      const failed = rand() < 0.021;
      const priced = rand() > 0.07;
      const llmCalls = 1 + Math.floor(rand() * 14);
      const heavy = rand();
      const full: ChatSignals = {
        datasetsTouched: heavy > 0.86 ? 3 + Math.floor(rand() * 2) : heavy > 0.6 ? 2 : 1,
        producedPlan: spec.kind === 'chat_plan_approval' || rand() < 0.08,
        usedGovtLookup: rand() < 0.12,
      };
      const at = t + (9 + Math.floor(rand() * 9)) * HOUR_MS + Math.floor(rand() * 55) * 60_000;
      // Before the columns existed there is nothing to read but the model
      // calls, so the band comes off those alone and is marked as backfilled.
      const backfilled = at < SIGNALS_RECORDED_FROM;
      const signals: ChatSignals | null = backfilled ? null : full;
      out.push({
        id: `av-chat-${n}`,
        kind: spec.kind,
        at,
        durationSecs: Math.round((spec.low + rand() * (spec.high - spec.low)) * 10) / 10,
        status: failed ? 'failed' : 'ok',
        band: bandForChat(signals, llmCalls),
        bandBackfilled: backfilled,
        workflowId: null,
        batchId: null,
        runBy: actor,
        team: actor.team,
        llmCalls,
        tokens: Math.round(28_000 + rand() * 180_000),
        llmCostUsd: priced && !failed ? Math.round((0.08 + rand() * 0.42) * 10_000) / 10_000 : 0,
        llmPriced: priced,
        signals,
        govtLookupKey: null,
        govtBilled: false,
        govtCached: false,
        govtCostInr: 0,
        producedOutput: !failed,
      });
    }
  }
  return out;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Files taken in
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Ingestion.
 *
 * Some of these rows carry no model call and no token at all: a file accepted
 * and then nothing, a scan the reader could not open, a sheet that was empty.
 * They are counted as events and they bank nothing, because nothing was read
 * out of them for anybody to have saved time on.
 */
function buildIngestion(): Activity[] {
  const rand = prng(30081993);
  const out: Activity[] = [];
  let n = 0;

  for (let t = HISTORY_START; t <= ANCHOR; t += DAY_MS) {
    if (!isWeekday(t)) continue;
    const files = rand() < 0.62 ? 1 + Math.floor(rand() * 3) : 0;
    for (let i = 0; i < files; i += 1) {
      n += 1;
      const actor = pick(rand, WORKERS);
      const empty = rand() < 0.075;
      const failed = !empty && rand() < 0.03;
      const priced = rand() > 0.05;
      const tokens = empty ? 0 : Math.round(4_000 + rand() * 46_000);
      out.push({
        id: `av-ing-${n}`,
        kind: 'ingestion',
        at: t + (9 + Math.floor(rand() * 9)) * HOUR_MS,
        durationSecs: empty ? Math.round(rand() * 20) / 10 : Math.round((5 + rand() * 52) * 10) / 10,
        status: failed ? 'failed' : 'ok',
        band: bandForIngestion(tokens),
        // Tokens were on the row from the start, so a file's band is the same
        // one it would have been given on the day.
        bandBackfilled: false,
        workflowId: null,
        batchId: null,
        runBy: actor,
        team: actor.team,
        llmCalls: empty ? 0 : 1 + Math.floor(rand() * 4),
        tokens,
        llmCostUsd: empty || failed || !priced ? 0 : Math.round((0.001 + rand() * 0.006) * 100_000) / 100_000,
        llmPriced: priced,
        signals: null,
        govtLookupKey: null,
        govtBilled: false,
        govtCached: false,
        govtCostInr: 0,
        producedOutput: !empty && !failed,
      });
    }
  }
  return out;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Government lookups
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * One row per call to the government connector.
 *
 * Two behaviours of the provider decide how these count. It charges for any
 * answer, including no record found, so a lookup that found nothing still cost
 * money and still saved somebody a trip to the portal. And it may reuse its
 * own answer for fourteen days, in which case the call costs nothing and
 * spares the same trip. Value and cost come apart here, and the table shows
 * both columns rather than one blended one.
 */
function buildGovt(): Activity[] {
  const rand = prng(14092026);
  const out: Activity[] = [];
  let n = 0;

  for (let t = HISTORY_START; t <= ANCHOR; t += DAY_MS) {
    if (!isWeekday(t)) continue;
    if (rand() > 0.42) continue;
    const calls = 1 + Math.floor(rand() * 4);
    for (let i = 0; i < calls; i += 1) {
      n += 1;
      const lookup = pick(rand, GOVT_LOOKUPS);
      const actor = pick(rand, WORKERS);
      const cached = rand() < 0.19;
      const failed = rand() < 0.015;
      out.push({
        id: `av-govt-${n}`,
        kind: 'govt_lookup',
        at: t + (10 + Math.floor(rand() * 7)) * HOUR_MS,
        durationSecs: Math.round((0.2 + rand() * 1.6) * 100) / 100,
        status: failed ? 'failed' : 'ok',
        // A lookup is one job whatever it returns, so they all sit in one band
        // and the evidence hangs off the lookup type instead.
        band: 'low',
        bandBackfilled: false,
        workflowId: null,
        batchId: null,
        runBy: actor,
        team: actor.team,
        llmCalls: 0,
        tokens: 0,
        llmCostUsd: 0,
        llmPriced: true,
        signals: null,
        govtLookupKey: lookup.key,
        govtBilled: !cached && !failed,
        govtCached: cached && !failed,
        govtCostInr: !cached && !failed ? (GOVT_PRICE.get(lookup.key) ?? 10) : 0,
        producedOutput: !failed,
      });
    }
  }
  return out;
}

/* ──────────────────────────────────────────────────────────────────────────
 * The ledger
 * ────────────────────────────────────────────────────────────────────────── */

export const ACTIVITY: Activity[] = [
  ...buildRuns(),
  ...buildChat(),
  ...buildIngestion(),
  ...buildGovt(),
].sort((a, b) => a.at - b.at);
