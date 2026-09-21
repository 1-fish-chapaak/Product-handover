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
import { BAND_RULE_VERSION, sizeForRunMinutes, type WorkBand } from './bands';
import { timingFor } from './timings';
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

  /** `ok`, `failed`, or `stopped` when a person halted the run. All three
   *  count as turns; only `ok` banks any value. */
  status: string;
  duration_ms: number | null;
  created_at: string;

  /** What a chat turn was for, from the fixed list in `CHAT_TYPES`. Null on
   *  every other kind. Written when the turn happens; NEVER inferred later from
   *  what the run burned. */
  chat_type: string | null;
  /** How many controls an SOP-to-RACM extraction drafted. Null on every other
   *  kind. Its by-hand time is minutes-per-control times this, so a four
   *  control SOP and a sixty control SOP are not the same job. */
  controls_drafted: number | null;
  /** How many entities a bulk run or a bulk report covered. Null everywhere
   *  else. By hand the work is done once per entity, so this is what the
   *  per-entity timing is multiplied by. */
  entities_covered: number | null;
  /** THE UNITS THIS RUN COVERED, whatever they are for its kind: entities for
   *  a bulk run or a bulk report, controls for an SOP to RACM, 1 for
   *  everything else. `by_hand_minutes` is the per-unit timing times this. */
  units_covered: number;
  /** How long this job takes a person BY HAND, resolved when the row was
   *  written and never recomputed. This is the figure the saving is measured
   *  against, and the figure the activity's SIZE is read off when the page is
   *  drawn. Storing the minutes rather than the size is the point: edit a
   *  timing tomorrow and last quarter's figure stays exactly as it was.
   *  Null where nobody has timed this kind, which is not the same as nought. */
  by_hand_minutes: number | null;
  /** The run's SIZE, from its own completion time, stamped when it ran.
   *  Thresholds will be tuned, and history must not silently re-bucket when
   *  they are. Null on a run that did not finish: only successful runs are
   *  sized. */
  size: WorkBand | null;
  /** Which version of the sizing rule was in force. */
  band_rule: string;

  /** The batch this run was fired in, when it was fired in one. A batch pays
   *  its setup once where a person pays it every time, which is time the
   *  per-run arithmetic never sees. Null on a run fired on its own. */
  batch_id: string | null;
  /** How many runs the batch holds, including this one. 1 when there is no
   *  batch. */
  batch_size: number;

  /** Rows the run actually read, derived from `audit_output` the way the runs
   *  API derives it. Null on chat and ingest, which read no population, and on
   *  any run that produced no tables. */
  records_examined: number | null;
  /** Exceptions the run surfaced, and how many of them were high. Null wherever
   *  `records_examined` is null. */
  exceptions_found: number | null;
  exceptions_high: number | null;
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

/**
 * What a chat turn was FOR, recorded on the row when the turn happens.
 *
 * A chat turn used to carry nothing that said what was asked, so one blended
 * timing covered every question and the whole population sat in one size. This
 * is the short fixed list that fixes it: four types, no more, each timed on its
 * own, so chat spreads across sizes like every other kind.
 *
 * **It is written at the time of the turn and never inferred afterwards.**
 * Deriving it from duration, tokens or model calls would be exactly the
 * circular reasoning this page exists to avoid: the run's own cost would decide
 * what it is worth, and the comparison against a person would mean nothing.
 */
export const CHAT_TYPES = ['lookup', 'explain', 'evidence', 'draft'] as const;
export type ChatType = (typeof CHAT_TYPES)[number];

export const CHAT_TYPE_LABELS: Record<ChatType, string> = {
  lookup: 'Looking something up',
  explain: 'Explaining a result',
  evidence: 'Pulling evidence together',
  draft: 'Drafting a write-up',
};

/** What a report generation was OF. A bulk report fires one of these per entity
 *  it covers, exactly as a bulk workflow fires one run per row, so the saving
 *  scales with the entities and not with the single act of generating. */
const REPORTS: { id: string; name: string }[] = [
  { id: 'rp-entity-pack', name: 'Entity audit pack' },
  { id: 'rp-quarterly', name: 'Quarterly control report' },
  { id: 'rp-exception-summary', name: 'Exception summary' },
];

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
const TURN_COUNT = 280;
const WINDOW_DAYS = 84;

/** A batch dispatches its runs together, seconds apart, and they then run
 *  alongside each other. They have to sit that way in the history too: a two
 *  minute workflow whose batch members are scattered across a day reports a six
 *  hour batch, which argues the opposite of what a batch does. */
const BATCH_DISPATCH_GAP_MS = 15_000;

interface OpenBatch {
  id: string;
  /** Batches never mix kinds: a run only joins one of its own surface. */
  surface: string;
  workflow: { id: string; name: string };
  size: number;
  /** Followers still to be emitted into this batch. */
  remaining: number;
  startedAt: number;
  seq: number;
}

function buildTurns(): UsageTurn[] {
  const rand = prng(20260331);
  const turns: UsageTurn[] = [];
  let batch: OpenBatch | null = null;
  let batchCount = 0;

  for (let i = 0; i < TURN_COUNT; i += 1) {
    const actor: Actor = ACTORS[Math.floor(rand() * ACTORS.length)];
    let at = ANCHOR - Math.floor(rand() * WINDOW_DAYS) * DAY_MS - Math.floor(rand() * DAY_MS);
    const roll = rand();
    /* Six kinds now. Chat still leads because it is what people do most, and
       the three added kinds are rarer and much heavier: an SOP to RACM
       extraction replaces most of a working day by hand. */
    /* Six kinds. Reading a file is NOT one of them: it is a step inside
       answering a question or running a workflow, not a job anybody would do
       for its own sake, and counting it separately double counts against the
       work it feeds. A run that turns out to be part of a batch becomes a
       `bulk` run below. */
    const surface =
      roll < 0.44
        ? 'chat'
        : roll < 0.72
          ? 'workflow'
          : roll < 0.82
            ? 'sop_racm'
            : roll < 0.92
              ? 'report'
              : 'exception';
    let workflow = WORKFLOWS[Math.floor(rand() * WORKFLOWS.length)];
    let report = REPORTS[Math.floor(rand() * REPORTS.length)];
    /* Both kinds that can be fired in bulk. A workflow sweeps a population; a
       report is written once per entity by hand, so a bulk report covering
       forty entities is forty jobs avoided. */
    const canBatch = surface === 'workflow' || surface === 'report';
    /* Set once the batch machinery below has decided. A workflow run that
       joins a batch is reported as a BULK run, because that is the job it
       replaced: the test run once per entity, not once. */
    let kind = surface;

    // Batches. A run either joins the batch that is still open, opens a new
    // one, or is fired on its own. Members share a workflow and a start, and
    // the followers land minutes after the opener rather than wherever the
    // history generator would have put them.
    let batch_id: string | null = null;
    let batch_size = 1;
    if (canBatch) {
      if (batch && batch.remaining > 0 && batch.surface === surface) {
        if (surface === 'workflow') workflow = batch.workflow;
        else report = batch.workflow;
        batch.seq += 1;
        batch.remaining -= 1;
        at = batch.startedAt + batch.seq * BATCH_DISPATCH_GAP_MS;
        batch_id = batch.id;
        batch_size = batch.size;
      } else if (rand() < 0.45) {
        batchCount += 1;
        const followers = 1 + Math.floor(rand() * 4);
        batch = {
          id: `bat-${String(batchCount).padStart(3, '0')}`,
          surface,
          workflow: surface === 'workflow' ? workflow : report,
          size: followers + 1,
          remaining: followers,
          startedAt: at,
          seq: 0,
        };
        batch_id = batch.id;
        batch_size = batch.size;
      } else {
        batch = null;
      }
      if (batch_id && surface === 'workflow') kind = 'bulk';
    }

    // A workflow run does more work than a chat turn, and an ingestion is a
    // single parsing pass. The spread is what makes the table worth sorting.
    const calls =
      surface === 'workflow'
        ? 3 + Math.floor(rand() * 9)
        : surface === 'chat'
          ? 1 + Math.floor(rand() * 3)
          : surface === 'sop_racm'
            ? 2 + Math.floor(rand() * 4)
            : surface === 'report'
              ? 1 + Math.floor(rand() * 4)
              : 1;

    const by_model: Record<string, UsageModelBreakdown> = {};
    const modelCount =
      (surface === 'workflow' || surface === 'sop_racm') && rand() < 0.45 ? 2 : 1;
    for (let m = 0; m < modelCount; m += 1) {
      // The routing preview is rare, so most rows carry a complete figure and
      // the floor case reads as the exception it is.
      const model =
        rand() < 0.06 ? 'router-preview' : MODELS[Math.floor(rand() * (MODELS.length - 1))];
      const inSpread =
        surface === 'workflow' ? 90_000
        : surface === 'sop_racm' ? 70_000
        : surface === 'report' ? 30_000
        : surface === 'exception' ? 9_000
        : 24_000;
      const outSpread =
        surface === 'sop_racm' ? 14_000
        : surface === 'report' ? 12_000
        : surface === 'workflow' ? 9_000
        : surface === 'exception' ? 1_200
        : 3_000;
      const tokens_in = 2_000 + Math.floor(rand() * inSpread);
      const tokens_out = 300 + Math.floor(rand() * outSpread);
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
        // A sweep asks one registry once per row of its population. The spread
        // is what a few hundred vendors or employees looks like, and it is the
        // half of a run's cost that dwarfs its tokens: 124 lookups is ₹1,240
        // against a model bill of ₹16.
        const opCalls = surface === 'workflow' ? 4 + Math.floor(rand() * 130) : 1;
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

    // A turn ends one of three ways, and the three are not interchangeable. A
    // failed turn raised. A stopped turn was halted by the person who started
    // it, which is a real thing a long sweep gets: it burned what it burned and
    // it banks no value, but it is still a turn and it still counts in the run
    // totals, which is what keeps this tab and Usage and cost reconciling.
    const outcome = rand();
    const stoppable = surface === 'workflow' || surface === 'sop_racm' || surface === 'report';
    const status = outcome < 0.05 ? 'failed' : stoppable && outcome < 0.09 ? 'stopped' : 'ok';

    // Scheduled runs carry no user. The column exists and the scheduler does
    // not write it, so these rows belong to the company and to nobody: they are
    // counted at company scope and excluded from every team and personal
    // figure, said out loud rather than quietly absorbed into somebody's line.
    const orphan = surface === 'workflow' && rand() < 0.07;

    /* A run fired in bulk is a LARGE activity, whatever its own signals say.
     *
     * Bulk is chosen because the population is big: nobody fires a batch to
     * check three vendors. By hand that is the large job, and sizing each run
     * in a batch on its own signals would treat fifty vendor checks as fifty
     * small jobs, which is not how a person would have done them.
     *
     * This raises the value figure, so the row remembers that the size came
     * from bulk and the page says so beside the number rather than burying it. */
    /* Which of this kind's by-hand times applies. NOT the size: size is read
       off the resulting minutes when the page is drawn. The minutes themselves
       are stamped on the row here and never recomputed, so editing a timing
       tomorrow cannot move what last quarter was worth. */
    /* Recorded here, independently of everything the run went on to spend, so
       nothing about the type is read back out of the run's own signals. */
    const chat_type: string | null =
      kind === 'chat' ? CHAT_TYPES[Math.floor(rand() * CHAT_TYPES.length)] : null;

    /* THE RUN'S OWN TIME, and the only thing that decides its size. Read here
       rather than inside the row literal because the size is stamped off it.
       It is a RECORDING, never a promise: nothing on the page may word a
       figure derived from it as a target or a service level. */
    const duration_ms =
      surface === 'workflow'
        ? 8_000 + Math.floor(rand() * 220_000)
        : surface === 'sop_racm'
          ? 40_000 + Math.floor(rand() * 260_000)
          : surface === 'report'
            ? 20_000 + Math.floor(rand() * 140_000)
            : surface === 'exception'
              ? 4_000 + Math.floor(rand() * 20_000)
              : 900 + Math.floor(rand() * 26_000);

    /* An SOP is drafted control by control, so the run has to record how many
       came out: that is what its by-hand time is multiplied by. */
    const controls_drafted =
      kind === 'sop_racm' && status === 'ok' ? 1 + Math.floor(rand() * 60) : null;

    /* By hand a bulk job is done once per entity, so the run has to record how
       many entities it covered.
       IN THIS LEDGER THAT IS ONE. A batch fires one run per entity it covers,
       which is what makes a batch of forty worth forty jobs, so the entities
       are counted by the RUNS in the batch and never again inside each run.
       Multiplying a per-entity timing by a population on top of that counts the
       same population twice, and it is how a page ends up claiming a one minute
       generation replaced a hundred and forty hours of writing. */
    const entities_covered = kind === 'bulk' || (kind === 'report' && batch_id) ? 1 : null;

    /* THE UNITS THIS RUN COVERED. One rule, every kind: entities where the job
       is done once per entity, controls where a matrix is drafted control by
       control, and one everywhere else. */
    const units_covered = entities_covered ?? controls_drafted ?? 1;

    /* The timing hangs off the NAMED thing: this workflow, this report. A
       named thing with no timing is UNPRICED — never covered by averaging its
       siblings, which would hand the run a size nobody measured. Bulk resolves
       against the workflow it fired. */
    const timingTarget =
      kind === 'workflow' || kind === 'bulk'
        ? workflow.id
        : kind === 'report'
          ? report.id
          : kind === 'chat'
            ? chat_type
            : null;
    /* Bulk resolves against its OWN per-entity timing, never against the
       whole-sweep figure held for the same workflow. Pulling a population once
       and checking one row in it are different jobs, and multiplying the
       whole-sweep figure by the population is how a page ends up claiming
       thirty thousand hours. */
    const timing = timingFor(kind, timingTarget);
    const by_hand_minutes =
      timing?.minutes == null
        ? null
        : timing.perUnit
          ? // Nothing came out, so there is no by-hand figure to multiply.
            // Null, never nought: nought is a real saving of nothing and would
            // have put failed runs in the small bucket.
            units_covered > 0 && (kind !== 'sop_racm' || controls_drafted)
            ? timing.minutes * units_covered
            : null
          : timing.minutes;

    // What the run read and what it surfaced. Only a workflow run reads a
    // population, and a run that did not complete produced no tables, so there
    // is nothing to derive from.
    const readsPopulation = (kind === 'workflow' || kind === 'bulk') && status === 'ok';
    const records_examined = readsPopulation
      ? Math.round(((by_hand_minutes ?? 60) > 60 ? 900 : 200) * (1 + rand() * 5))
      : null;
    const exceptions_found =
      records_examined == null ? null : Math.floor(records_examined * (0.004 + rand() * 0.02));
    const exceptions_high =
      exceptions_found == null ? null : Math.floor(exceptions_found * rand() * 0.3);

    turns.push({
      id: TURN_COUNT - i,
      surface: kind,
      session_id: ref('5e', i + 1),
      turn_kind:
        kind === 'workflow'
          ? 'run'
          : kind === 'bulk' || kind === 'sop_racm' || kind === 'report' || kind === 'exception'
            ? kind
            : CHAT_KINDS[Math.floor(rand() * CHAT_KINDS.length)],
      // A report carries its name in the same column a run carries its
      // workflow, so the batch table and the runs list read one column rather
      // than learning a second one.
      workflow_id: surface === 'workflow' ? workflow.id : surface === 'report' ? report.id : null,
      workflow_name:
        surface === 'workflow' ? workflow.name : surface === 'report' ? report.name : null,
      execution_id: surface === 'workflow' || surface === 'report' ? ref('ex', i + 1) : null,
      run_by_email: orphan ? null : actor.email,
      run_by_name: orphan ? null : actor.name,
      team_id: orphan ? null : actor.team,
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
      status,
      duration_ms,
      created_at: new Date(at).toISOString(),
      chat_type,
      controls_drafted,
      entities_covered,
      units_covered,
      by_hand_minutes,
      /* Stamped from THIS run's own duration, at the moment it ran. Not
         re-derived at read time: thresholds will be tuned, and a tuned
         threshold must not re-bucket a period that has already been quoted. */
      size: status === 'ok' ? sizeForRunMinutes(duration_ms / 60_000) : null,
      band_rule: BAND_RULE_VERSION,
      batch_id,
      batch_size,
      records_examined,
      exceptions_found,
      exceptions_high,
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

/* ──────────────────────────────────────────────────────────────────────────
 * The AI bill, said the same way on every tab
 *
 * Three money sources feed these pages and only one of them is a dollar: the
 * model bill arrives in USD, while registry lookups and the firm's own auditor
 * rate are rupees. So the rule is not "one currency", it is one WORDING, and it
 * turns on what the figure is doing in the sentence.
 *
 * · **Named as a bill** — dollars lead, because that is what was billed, with
 *   the conversion beside it. Usage and cost's own column does this, and so
 *   does the working inside Platform Value's cost panel.
 * · **Inside an addition** — rupees lead, because the sum it belongs to is in
 *   rupees, with the dollar named in brackets so the same figure is
 *   recognisable from the tab next door. That is what `billedIn` is for.
 *
 * A rupee page once printed "$0.3572" in a worked example nobody could then add
 * up. That is the failure this exists to make impossible: the dollar is always
 * present, and it is never the thing being added.
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * The bracket that names the dollar beside a rupee figure, for sentences that
 * put words between the two: `₹20 in AI (billed $0.2273)`.
 *
 * Empty string when there is no dollar figure, so the sentence closes up around
 * it rather than printing an empty bracket.
 */
export function billedIn(usd: number | null): string {
  return usd == null ? '' : ` (billed ${formatUsageAmount(usd, 'USD')})`;
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
  bulk: 'Bulk run',
  sop_racm: 'SOP to RACM',
  report: 'Report generated',
  exception: 'Exception handled',
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
  bulk: 'Bulk run',
  sop_racm: 'SOP to RACM',
  report: 'Report',
  exception: 'Exception',
};

export function surfaceLabel(surface: string): string {
  return SURFACE_LABELS[surface] ?? surface;
}

export const SURFACE_OPTIONS = Object.entries(SURFACE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

/** `status` is written at the turn boundary: ok, failed when the turn raised,
 *  or stopped when the person who started it halted it. A failed or stopped
 *  turn still burned tokens and still counts as a turn, which is why both are
 *  worth filtering to on their own. */
const STATUS_LABELS: Record<string, string> = {
  ok: 'Succeeded',
  failed: 'Failed',
  stopped: 'Stopped',
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({
  value,
  label,
}));

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
