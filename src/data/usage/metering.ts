/**
 * Usage and cost — one row per metered turn.
 *
 * A turn is one unit of paid work: a chat turn, a workflow run, a file
 * ingestion. The platform meters each one as it happens and this file holds the
 * same shape the backend stores (`chat_usage_turns`): calls, tokens by model,
 * the government lookups the turn made, and what both cost.
 *
 * This is the one place in the product that talks about money, and it is
 * careful about which kind. An LLM figure is an ESTIMATE priced off published
 * list prices rather than our contracted rates, and when some model in the turn
 * has no rate on file it is a FLOOR as well. A govt figure is a build constant
 * off the connector catalogue. Neither is an invoice, and the screen says so
 * next to the number rather than in a banner nobody reads twice.
 *
 * Nothing here is ever rendered as 0.00 when it means "we do not know". Unknown
 * and free must not look alike.
 *
 * The rows are a deterministic fixture drawn from the same seeded generator and
 * the same people as the rest of the workspace, so a turn here belongs to
 * somebody the Administration roster also lists, and a reload never moves a
 * figure.
 */

import { ACTORS, ANCHOR, DAY_MS, prng, type Actor } from './seed';
import { CONNECTOR_OPERATIONS, type ConnectorOperation } from '../connectors/catalogue';

/* ──────────────────────────────────────────────────────────────────────────
 * Records
 * ────────────────────────────────────────────────────────────────────────── */

export interface UsageModelBreakdown {
  calls: number;
  tokens_in: number;
  tokens_out: number;
  cached_read: number;
  cached_write: number;
  /** Of `tokens_out`, how many were reasoning. A memo, NEVER an addend, because
   *  `tokens_out` already includes it on every provider. 0 also means "this
   *  provider does not report it", not "none happened". */
  thinking: number;
}

export interface UsageOperationBreakdown {
  calls: number;
  cost: number | null;
}

export interface UsageTurn {
  id: number;
  surface: string;
  session_id: string;
  turn_kind: string;
  /** Null on chat and ingest rows: they have no workflow. */
  workflow_id: string | null;
  workflow_name: string | null;
  execution_id: string | null;
  run_by_email: string | null;
  run_by_name: string | null;
  team_id: string | null;

  llm_calls: number;
  tokens_in: number;
  tokens_out: number;
  tokens_total: number;
  /** Of `tokens_out`. See `UsageModelBreakdown.thinking`. */
  tokens_thinking: number;
  cached_tokens_read: number;
  cached_tokens_write: number;
  by_model: Record<string, UsageModelBreakdown>;
  /** null means NOT PRICED, so render a dash and never 0.00. */
  llm_cost: number | null;
  llm_currency: string;
  /** Models in this turn with no rate on file. Non-empty means `llm_cost` is a
   *  floor rather than a total, and it must not be presented as complete. */
  llm_unpriced_models: string[];

  govt_calls: number;
  govt_cost: number | null;
  govt_currency: string;
  by_operation: Record<string, UsageOperationBreakdown>;

  status: string;
  duration_ms: number | null;
  created_at: string;
}

export interface UsageSummary {
  turns: number;
  llm_calls: number;
  tokens_in: number;
  tokens_out: number;
  tokens_total: number;
  tokens_thinking: number;
  llm_cost: number | null;
  llm_currency: string;
  govt_calls: number;
  govt_cost: number | null;
  govt_currency: string;
  /** At least one metered GOVT call in scope had no price on file, so the govt
   *  total is a floor rather than the whole bill. */
  has_unpriced: boolean;
  /** The same claim for the LLM half. Separate from `has_unpriced` because they
   *  qualify two different totals in two different currencies, and one flag
   *  could not say which of them is incomplete. */
  has_unpriced_llm: boolean;
}

/**
 * What the reader has narrowed to. Every field optional; all absent = everything.
 *
 * The tiles and the table read the SAME filters, so the tiles always describe
 * exactly the rows listed below them. Dates are `YYYY-MM-DD` and are inclusive
 * calendar days.
 */
export interface UsageFilters {
  surface?: string;
  turn_kind?: string;
  status?: string;
  /** Case-insensitive substring of the runner's email. */
  run_by?: string;
  date_from?: string;
  date_to?: string;
}

/* ──────────────────────────────────────────────────────────────────────────
 * The rate card
 * ────────────────────────────────────────────────────────────────────────── */

interface ModelRate {
  input: number;
  output: number;
  cache_read: number;
}

/**
 * Published list prices, per million tokens, in USD.
 *
 * Taken from the backend rate card (`app/services/usage/llm_prices.json`,
 * as of 2 September 2026). PUBLISHED prices, not our contracted ones: a
 * contract's numbers do not belong in a repo, so what this prices is an
 * estimate and every surface reading it has to say so.
 *
 * A model with no entry here is UNPRICED, never free. Adding a wrong rate is
 * worse than adding none.
 */
const MODEL_RATES: Record<string, ModelRate> = {
  'claude-opus-4': { input: 15, output: 75, cache_read: 1.5 },
  'claude-sonnet-4': { input: 3, output: 15, cache_read: 0.3 },
  'claude-haiku-4': { input: 1, output: 5, cache_read: 0.1 },
  'gpt-5.5': { input: 5, output: 30, cache_read: 0.5 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6, cache_read: 0.1 },
  'gemini-3.1-pro': { input: 2, output: 12, cache_read: 0.2 },
};

export const RATE_CARD_AS_OF = '2 September 2026';

/** Rate for a model, matched by longest prefix so a dated snapshot bills at its
 *  family's rate. `null` when nothing on the card matches. */
function rateFor(model: string): ModelRate | null {
  const key = Object.keys(MODEL_RATES)
    .filter(k => model.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return key ? MODEL_RATES[key] : null;
}

/** What one turn's tokens cost, and which of its models had no rate.
 *
 *  Returns `null` for the cost when NOTHING in the turn could be priced. A turn
 *  with one priced model and one unpriced one returns the priced part and names
 *  the other, which is what makes the figure a floor. */
function priceTurn(byModel: Record<string, UsageModelBreakdown>): {
  cost: number | null;
  unpriced: string[];
} {
  let total = 0;
  let priced = 0;
  const unpriced: string[] = [];
  Object.entries(byModel).forEach(([model, m]) => {
    const rate = rateFor(model);
    if (!rate) {
      unpriced.push(model);
      return;
    }
    priced += 1;
    const fresh = Math.max(0, m.tokens_in - m.cached_read);
    total +=
      (fresh * rate.input) / 1_000_000 +
      (m.cached_read * rate.cache_read) / 1_000_000 +
      (m.tokens_out * rate.output) / 1_000_000;
  });
  return { cost: priced === 0 ? null : Math.round(total * 1_000_000) / 1_000_000, unpriced };
}

/* ──────────────────────────────────────────────────────────────────────────
 * The seeded workspace
 * ────────────────────────────────────────────────────────────────────────── */

/** The models this workspace actually routes to.
 *
 *  `router-preview` is on the list on purpose and is NOT on the rate card. An
 *  internal routing preview is exactly the case the floor language exists for:
 *  the tokens were spent, and what they cost is not something we can claim. */
const MODELS = [
  'claude-opus-4',
  'claude-sonnet-4',
  'claude-haiku-4',
  'gpt-5.5',
  'gemini-3.1-pro',
  'router-preview',
];

const CHAT_KINDS = ['question', 'clarify', 'revise', 'approve', 'config_resolve', 'suggest_name'];

const WORKFLOWS: { id: string; name: string }[] = [
  { id: 'wf-vendor-master', name: 'Vendor master verification' },
  { id: 'wf-duplicate-payments', name: 'Duplicate payment sweep' },
  { id: 'wf-gst-recon', name: 'GST registration reconciliation' },
  { id: 'wf-payroll-exits', name: 'Payroll exit checks' },
  { id: 'wf-related-party', name: 'Related party screening' },
];

/** The lookups a run reaches for, by workflow. A vendor sweep asks the business
 *  registries; a payroll check asks the employment ones. */
const WORKFLOW_OPS: Record<string, string[]> = {
  'wf-vendor-master': ['govt.gst_basic', 'govt.pan_basic', 'govt.cin_advanced'],
  'wf-duplicate-payments': ['govt.gst_basic'],
  'wf-gst-recon': ['govt.gst_advanced', 'govt.gst_by_pan'],
  'wf-payroll-exits': ['govt.uan_advanced', 'govt.pan_basic'],
  'wf-related-party': ['govt.cin_advanced', 'govt.udyam_by_pan'],
};

const OP_BY_KEY = new Map<string, ConnectorOperation>(
  CONNECTOR_OPERATIONS.map(op => [op.op_key, op]),
);

/** A stable id that looks like the uuid the backend writes, without pretending
 *  to be one. Deterministic, so the same row keeps the same reference.
 *
 *  The varying part leads, because the table shows the first eight characters
 *  and a run of references that all begin the same way is one nobody can tell
 *  apart at a glance. */
function ref(prefix: string, n: number): string {
  const scrambled = ((n * 2_654_435_761) >>> 0).toString(16).padStart(8, '0');
  return `${scrambled}-4c1f-8a${(n % 97).toString(16).padStart(2, '0')}-${prefix}`;
}

/** How many turns the seeded history holds, and how far back it runs. */
const TURN_COUNT = 220;
const WINDOW_DAYS = 84;

function buildTurns(): UsageTurn[] {
  const rand = prng(20260331);
  const turns: UsageTurn[] = [];

  for (let i = 0; i < TURN_COUNT; i += 1) {
    const actor: Actor = ACTORS[Math.floor(rand() * ACTORS.length)];
    const at = ANCHOR - Math.floor(rand() * WINDOW_DAYS) * DAY_MS - Math.floor(rand() * DAY_MS);
    const roll = rand();
    const surface = roll < 0.58 ? 'chat' : roll < 0.86 ? 'workflow' : 'ingest';
    const workflow = WORKFLOWS[Math.floor(rand() * WORKFLOWS.length)];

    // A workflow run does more work than a chat turn, and an ingestion is a
    // single parsing pass. The spread is what makes the table worth sorting.
    const calls =
      surface === 'workflow' ? 3 + Math.floor(rand() * 9) : surface === 'chat' ? 1 + Math.floor(rand() * 3) : 1;

    const by_model: Record<string, UsageModelBreakdown> = {};
    const modelCount = surface === 'workflow' && rand() < 0.45 ? 2 : 1;
    for (let m = 0; m < modelCount; m += 1) {
      // The routing preview is rare, so most rows carry a complete figure and
      // the floor case reads as the exception it is.
      const model =
        rand() < 0.06 ? 'router-preview' : MODELS[Math.floor(rand() * (MODELS.length - 1))];
      const tokens_in = 2_000 + Math.floor(rand() * (surface === 'workflow' ? 90_000 : 24_000));
      const tokens_out = 300 + Math.floor(rand() * (surface === 'workflow' ? 9_000 : 3_000));
      const cached_read = rand() < 0.5 ? Math.floor(tokens_in * (0.2 + rand() * 0.5)) : 0;
      const existing = by_model[model];
      const next: UsageModelBreakdown = {
        calls: Math.max(1, Math.floor(calls / modelCount)),
        tokens_in,
        tokens_out,
        cached_read,
        cached_write: cached_read > 0 ? Math.floor(cached_read * 0.15) : 0,
        // Anthropic and Bedrock bill reasoning inside their output count and
        // report no separate figure, so those rows carry 0 and the table shows
        // a dash rather than claiming no reasoning happened.
        thinking: model.startsWith('claude') ? 0 : Math.floor(tokens_out * rand() * 0.4),
      };
      by_model[model] = existing
        ? {
            calls: existing.calls + next.calls,
            tokens_in: existing.tokens_in + next.tokens_in,
            tokens_out: existing.tokens_out + next.tokens_out,
            cached_read: existing.cached_read + next.cached_read,
            cached_write: existing.cached_write + next.cached_write,
            thinking: existing.thinking + next.thinking,
          }
        : next;
    }

    const tokens_in = Object.values(by_model).reduce((s, m) => s + m.tokens_in, 0);
    const tokens_out = Object.values(by_model).reduce((s, m) => s + m.tokens_out, 0);
    const { cost: llm_cost, unpriced } = priceTurn(by_model);

    // Only a workflow run reaches a registry. A chat turn can ask for one, and
    // when it does it is one lookup rather than a column of them.
    const by_operation: Record<string, UsageOperationBreakdown> = {};
    if (surface === 'workflow' || (surface === 'chat' && rand() < 0.12)) {
      const keys = surface === 'workflow' ? WORKFLOW_OPS[workflow.id] : ['govt.gst_basic'];
      keys.forEach(key => {
        if (surface === 'workflow' && rand() < 0.35) return;
        const op = OP_BY_KEY.get(key);
        if (!op) return;
        const opCalls = surface === 'workflow' ? 4 + Math.floor(rand() * 260) : 1;
        by_operation[key] = {
          calls: opCalls,
          cost: op.unit_price == null ? null : Math.round(opCalls * op.unit_price * 100) / 100,
        };
      });
    }
    const govt_calls = Object.values(by_operation).reduce((s, o) => s + o.calls, 0);
    const pricedOps = Object.values(by_operation).filter(o => o.cost != null);
    const govt_cost =
      pricedOps.length === 0
        ? null
        : Math.round(pricedOps.reduce((s, o) => s + (o.cost ?? 0), 0) * 100) / 100;

    const failed = rand() < 0.05;

    turns.push({
      id: TURN_COUNT - i,
      surface,
      session_id: ref('5e', i + 1),
      turn_kind:
        surface === 'workflow' ? 'run' : surface === 'ingest' ? 'ingest' : CHAT_KINDS[Math.floor(rand() * CHAT_KINDS.length)],
      workflow_id: surface === 'workflow' ? workflow.id : null,
      workflow_name: surface === 'workflow' ? workflow.name : null,
      execution_id: surface === 'workflow' ? ref('ex', i + 1) : null,
      run_by_email: actor.email,
      run_by_name: actor.name,
      team_id: actor.team,
      llm_calls: calls,
      tokens_in,
      tokens_out,
      tokens_total: tokens_in + tokens_out,
      tokens_thinking: Object.values(by_model).reduce((s, m) => s + m.thinking, 0),
      cached_tokens_read: Object.values(by_model).reduce((s, m) => s + m.cached_read, 0),
      cached_tokens_write: Object.values(by_model).reduce((s, m) => s + m.cached_write, 0),
      by_model,
      llm_cost,
      llm_currency: 'USD',
      llm_unpriced_models: unpriced,
      govt_calls,
      govt_cost,
      govt_currency: 'INR',
      by_operation,
      status: failed ? 'failed' : 'ok',
      duration_ms:
        surface === 'workflow'
          ? 8_000 + Math.floor(rand() * 220_000)
          : 900 + Math.floor(rand() * 26_000),
      created_at: new Date(at).toISOString(),
    });
  }

  // Newest first, which is the order the backend returns and the order a reader
  // opening the page expects.
  return turns.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export const USAGE_TURNS: UsageTurn[] = buildTurns();

/* ──────────────────────────────────────────────────────────────────────────
 * Reading them
 * ────────────────────────────────────────────────────────────────────────── */

/** A `YYYY-MM-DD` day, from a timestamp. Both filter bounds are inclusive
 *  calendar days, so the comparison is on the day string rather than on a
 *  moment: a "to" of the 31st has to include everything that happened that
 *  day, not stop at midnight. */
function day(iso: string): string {
  return iso.slice(0, 10);
}

export function filterTurns(rows: UsageTurn[], f: UsageFilters): UsageTurn[] {
  const email = f.run_by?.trim().toLowerCase();
  return rows.filter(r => {
    if (f.surface && r.surface !== f.surface) return false;
    if (f.turn_kind && r.turn_kind !== f.turn_kind) return false;
    if (f.status && r.status !== f.status) return false;
    if (email && !(r.run_by_email ?? '').toLowerCase().includes(email)) return false;
    if (f.date_from && day(r.created_at) < f.date_from) return false;
    if (f.date_to && day(r.created_at) > f.date_to) return false;
    return true;
  });
}

/** The totals for a set of rows.
 *
 *  A cost total is `null` when nothing in the set could be priced, and carries
 *  a flag when only some of it could. Summing an unpriced row as zero would
 *  report the most expensive part of a week as costing nothing. */
export function summarize(rows: UsageTurn[]): UsageSummary {
  const llmPriced = rows.filter(r => r.llm_cost != null);
  const govtPriced = rows.filter(r => r.govt_cost != null);
  const sum = (pick: (r: UsageTurn) => number) => rows.reduce((s, r) => s + pick(r), 0);
  return {
    turns: rows.length,
    llm_calls: sum(r => r.llm_calls),
    tokens_in: sum(r => r.tokens_in),
    tokens_out: sum(r => r.tokens_out),
    tokens_total: sum(r => r.tokens_total),
    tokens_thinking: sum(r => r.tokens_thinking),
    llm_cost:
      llmPriced.length === 0
        ? null
        : Math.round(llmPriced.reduce((s, r) => s + (r.llm_cost ?? 0), 0) * 10_000) / 10_000,
    llm_currency: 'USD',
    govt_calls: sum(r => r.govt_calls),
    govt_cost:
      govtPriced.length === 0
        ? null
        : Math.round(govtPriced.reduce((s, r) => s + (r.govt_cost ?? 0), 0) * 100) / 100,
    govt_currency: 'INR',
    has_unpriced: rows.some(r =>
      Object.values(r.by_operation).some(o => o.cost == null),
    ),
    has_unpriced_llm: rows.some(r => r.llm_unpriced_models.length > 0),
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * Formatting
 * ────────────────────────────────────────────────────────────────────────── */

const SYMBOLS: Record<string, string> = { INR: '₹', USD: '$', EUR: '€' };

/**
 * Money, with "not priced" kept distinct from zero.
 *
 * Four decimals for USD, two for INR: an LLM turn routinely costs less than a
 * cent, and rounding it to 2dp renders most real rows as $0.00, which is the
 * exact confusion this function exists to prevent.
 */
export function formatUsageAmount(amount: number | null, currency = 'INR'): string {
  if (amount == null) return 'Not priced';
  const code = currency.toUpperCase();
  const symbol = SYMBOLS[code] ?? `${currency} `;
  const digits = code === 'USD' && Math.abs(amount) < 1 ? 4 : 2;
  return `${symbol}${amount.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

/** Compact token counts. The exact figure stays in the cell's title. */
export function formatTokens(n: number): string {
  if (n < 1_000) return String(n);
  if (n < 1_000_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

export function formatDuration(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1_000) return `${ms}ms`;
  return `${(ms / 1_000).toFixed(1)}s`;
}

/** The models a turn used, most tokens first. The table shows the top one and
 *  the full list rides along in a tooltip. */
export function modelsUsed(turn: UsageTurn): string[] {
  return Object.entries(turn.by_model)
    .sort((a, b) => b[1].tokens_in + b[1].tokens_out - (a[1].tokens_in + a[1].tokens_out))
    .map(([name]) => name);
}

/** Human label for a turn kind. An unknown kind falls through to the raw value
 *  rather than to "Unknown": a new kind should be legible before this file
 *  learns about it, not hidden. */
const TURN_KIND_LABELS: Record<string, string> = {
  question: 'Question',
  run: 'Workflow run',
  clarify: 'Clarification',
  revise: 'Revision',
  approve: 'Plan approval',
  config_resolve: 'Config intent',
  suggest_name: 'Workflow name',
  ingest: 'File ingestion',
};

export function turnKindLabel(kind: string): string {
  return TURN_KIND_LABELS[kind] ?? kind;
}

/** Filter options, derived from the label maps so a new kind becomes filterable
 *  the moment it becomes legible. One place to edit, not two that drift. */
export const TURN_KIND_OPTIONS = Object.entries(TURN_KIND_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const SURFACE_LABELS: Record<string, string> = {
  chat: 'Chat',
  workflow: 'Workflow',
  ingest: 'Ingestion',
};

export function surfaceLabel(surface: string): string {
  return SURFACE_LABELS[surface] ?? surface;
}

export const SURFACE_OPTIONS = Object.entries(SURFACE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

/** `status` is written at the turn boundary: ok, or failed when the turn
 *  raised. A failed turn still burned tokens, which is why it is worth
 *  filtering to on its own. */
export const STATUS_OPTIONS = [
  { value: 'ok', label: 'Succeeded' },
  { value: 'failed', label: 'Failed' },
];

/** What qualifies a cost figure.
 *
 *  Two separate reasons a total can be incomplete, and they are not the same
 *  claim: some models had no rate on file, so the number is a floor, and the
 *  rates are published list prices rather than our contract, so the number is
 *  an estimate even when complete. */
export function llmCostCaveat(unpricedModels: string[]): string {
  const estimate = `Estimate, priced off published list prices as of ${RATE_CARD_AS_OF}, not contracted rates.`;
  if (unpricedModels.length === 0) return estimate;
  return `Floor only, because there is no rate on file for ${unpricedModels.join(', ')}. ${estimate}`;
}
