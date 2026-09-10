/**
 * Platform Value — what the work gave back.
 *
 * Usage and cost prices a turn forwards: tokens times the model's list price.
 * This module prices the same turn backwards: how long that work takes a
 * person, less what the run itself took, times the hour rate. Same rows, same
 * filters, same discipline, opposite direction.
 *
 *   time returned = manual minutes for the row's band − the run's own duration
 *   value         = time returned × the auditor hour rate in force that day
 *
 * **Nothing here is estimated.** A model with no published price adds nothing to
 * cost; work with no timing on file adds nothing to value. Both totals are
 * floors that grow as the evidence grows, and every surface reading them has to
 * say so. There are no multipliers in this file and there is no setting that
 * adds one.
 *
 * Three rules that stop the same minute being counted twice:
 *
 * · A workflow timing was taken on the WHOLE manual activity, portal lookups
 *   included, so lookup minutes are never added on top of a timed workflow run.
 *   Lookups earn their own time only outside one.
 * · A turn that failed or was stopped banks no value. It still counts as a
 *   turn, which is what keeps this tab reconciling with Usage and cost.
 * · A scheduled run carries no user. It counts for the company and is excluded
 *   from every team and personal figure, said out loud rather than absorbed.
 */

import { BAND_ORDER, SIZE_THRESHOLDS, bandPlain, type WorkBand } from './bands';
import {
  AUDITOR_HOUR_RATE,
  USD_TO_INR,
  effectiveAt,
  type Dated,
} from './timings';
import {
  recordIsUsable,
  resolveTiming,
  type TimingKind,
  type TimingRecord,
} from './timingStore';
import type { UsageTurn } from './metering';

/**
 * What a row IS, in the words the reader uses.
 *
 * `surface` is our word and `turn` is our word, and neither means anything to
 * an audit lead. Everything visible says workflow runs, bulk runs, questions in
 * chat and the rest, and this is the one place those words are decided.
 */
const WORK_NOUN: Record<string, { one: string; many: string }> = {
  workflow: { one: 'workflow run', many: 'workflow runs' },
  bulk: { one: 'bulk run', many: 'bulk runs' },
  chat: { one: 'question in chat', many: 'questions in chat' },
  sop_racm: { one: 'SOP to RACM extraction', many: 'SOP to RACM extractions' },
  report: { one: 'report generated', many: 'reports generated' },
  exception: { one: 'exception handled', many: 'exceptions handled' },
};

export function workNoun(surface: string, plural = true): string {
  const n = WORK_NOUN[surface];
  if (!n) return surface;
  return plural ? n.many : n.one;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Scope and range
 * ────────────────────────────────────────────────────────────────────────── */

export type ValueScope =
  | { kind: 'company' }
  | { kind: 'team'; team: string }
  | { kind: 'person'; email: string };

export interface ValueFilters {
  /** Inclusive `YYYY-MM-DD` bounds. Absent means the whole history. */
  date_from?: string;
  date_to?: string;
  scope: ValueScope;
}

export const COMPANY_SCOPE: ValueScope = { kind: 'company' };

export function scopeLabel(scope: ValueScope): string {
  if (scope.kind === 'company') return 'the whole company';
  if (scope.kind === 'team') return scope.team;
  return scope.email;
}

const day = (iso: string) => iso.slice(0, 10);

/** The rows in scope.
 *
 *  A row with no user belongs to the company and to nobody, so it survives the
 *  company scope and is dropped by both of the others. That is a real exclusion
 *  and the page prints how many rows it removed. */
export function scopeTurns(rows: UsageTurn[], f: ValueFilters): UsageTurn[] {
  return rows.filter(r => {
    if (f.date_from && day(r.created_at) < f.date_from) return false;
    if (f.date_to && day(r.created_at) > f.date_to) return false;
    if (f.scope.kind === 'team') return r.team_id === f.scope.team;
    if (f.scope.kind === 'person') return r.run_by_email === f.scope.email;
    return true;
  });
}

/* ──────────────────────────────────────────────────────────────────────────
 * One turn
 * ────────────────────────────────────────────────────────────────────────── */

export type ValueBasis = 'band' | 'lookups';

/** WHY an activity carries no value, as a category rather than as a
 *  sentence. The sentence is for the reader; this is so the page can say which
 *  gaps a stopwatch closes and which ones nothing closes. */
export type UnvaluedKind = 'no-timing' | 'did-not-finish' | 'no-rate';

export interface TurnValue {
  /** Which bucket this run's by-hand time falls into. A grouping only: nothing
   *  in the calculation above depends on it. */
  size: WorkBand | null;
  turn: UsageTurn;
  /** How many records this activity covered. A workflow run covers the rows it
   *  read; a question in chat and a file read each cover one thing. It is the
   *  multiplier on the per record estimate, so it is the single biggest lever
   *  on every figure this page prints. */
  records: number;
  /** Minutes the same work takes a person. Null = no timing on file. */
  manual_minutes: number | null;
  /** Which table supplied the manual minutes. */
  basis: ValueBasis | null;
  /** Named, and shown on the page. Null when the work IS valued. */
  unvalued_reason: string | null;
  unvalued_kind: UnvaluedKind | null;
  run_minutes: number;
  /** manual − run. Negative is kept, never clamped: a run that took longer than
   *  the hand activity is exactly the thing this page has to be able to show. */
  returned_minutes: number | null;
  value_rupees: number | null;
  /** The hour rate in force on the day this turn ran. */
  rate: Dated<number> | null;
  /** Running cost, both halves in rupees so they can be added. Null where the
   *  half could not be priced at all. */
  model_cost_inr: number | null;
  /** The SAME bill, in the currency it actually arrived in. Carried alongside
   *  the conversion rather than instead of it: the AI bill is quoted in dollars
   *  wherever it is named as a bill, and in rupees wherever it sits inside an
   *  addition, and a page that only kept one of the two could not do both. */
  model_cost_usd: number | null;
  lookup_cost_inr: number | null;
  fx: Dated<number> | null;
}

/** The records an activity covered.
 *
 *  A workflow run covers the rows it actually read. Everything else covers one
 *  thing: one question, one file. A run that produced no tables covered
 *  nothing, which is why it prices at nothing rather than at one. */
/** Which named thing a run's timing hangs off: this workflow, this report,
 *  this chat type. Null where the kind genuinely has one job in it. */
export function timingTargetFor(turn: UsageTurn): string | null {
  if (turn.surface === 'workflow' || turn.surface === 'bulk') return turn.workflow_id;
  if (turn.surface === 'report') return turn.workflow_id;
  if (turn.surface === 'chat') return turn.chat_type;
  return null;
}

export function recordsCovered(turn: UsageTurn): number {
  if (turn.surface !== 'workflow') return 1;
  return turn.records_examined ?? 0;
}

export function valueTurn(turn: UsageTurn): TurnValue {
  const d = day(turn.created_at);
  const records = recordsCovered(turn);
  // Resolved by the day the activity ran, never by whatever is current, so
  // changing a rate leaves last quarter's figure exactly as it was.
  const rate = effectiveAt(AUDITOR_HOUR_RATE, d);
  const fx = effectiveAt(USD_TO_INR, d);
  const run_minutes = (turn.duration_ms ?? 0) / 60_000;

  const model_cost_inr =
    turn.llm_cost == null || fx == null
      ? null
      : turn.llm_currency === 'USD'
        ? turn.llm_cost * fx.value
        : turn.llm_cost;
  const model_cost_usd = turn.llm_currency === 'USD' ? turn.llm_cost : null;
  const lookup_cost_inr = turn.govt_cost;

  const base = {
    turn,
    /* READ OFF THE ROW. The size was stamped from this run's own completion
       time when it ran, so tuning a threshold today cannot re-bucket a period
       that has already been quoted. No kind is pinned to a size: a bulk run is
       sized by how long it took, exactly like everything else. */
    size: turn.size,
    records,
    run_minutes,
    rate,
    model_cost_inr,
    model_cost_usd,
    lookup_cost_inr,
    fx,
  };

  const unvalued = (reason: string, kind: UnvaluedKind): TurnValue => ({
    ...base,
    manual_minutes: null,
    basis: null,
    unvalued_reason: reason,
    unvalued_kind: kind,
    returned_minutes: null,
    value_rupees: null,
  });

  if (turn.status !== 'ok') {
    return unvalued(
      turn.status === 'stopped'
        ? 'Someone stopped the activity before it finished, so there is no time to count.'
        : 'The activity failed, so there is no time to count.',
      'did-not-finish',
    );
  }
  if (rate == null)
    return unvalued('No hourly rate was agreed for the day this ran.', 'no-rate');

  // Resolved against the day this ran, so a timing entered later never
  // rewrites it. Recorded is not the same as usable either: a sitting on fewer
  // than five auditors is an anecdote, and it prices nothing.
  //
  // ONE FLAT FIGURE for an activity of this size, never multiplied by the rows
  // it read. The population is already answered by the band: a sweep over four
  // thousand rows makes enough lookups to land in `high`. Multiplying on top of
  // that double counts it, and it priced fifty runs at six hundred auditor
  // hours each.
  /* Read off the ROW, not resolved now. The minutes were stamped when the
     activity ran, so a timing edited later cannot move what this run was
     worth. Size is read off these minutes when the page is drawn. */
  const manual_minutes: number | null = turn.by_hand_minutes;
  const basis: ValueBasis | null = manual_minutes == null ? null : 'band';

  if (manual_minutes == null) {
    return unvalued(
      turn.workflow_name
        ? `${turn.workflow_name} has no by hand figure at all, so its runs are unpriced rather than covered by another workflow's timing.`
        : `${workNoun(turn.surface).replace(/^./, c => c.toUpperCase())} have no by hand figure at all.`,
      'no-timing',
    );
  }
  /* A run slower than the by hand figure saved nothing. It did not COST time:
     nobody sat and watched it, and letting it subtract would quietly net off
     savings made elsewhere. So the floor is zero, and the run stays in every
     count so the population never changes shape. */
  const returned_minutes = Math.max(0, manual_minutes - run_minutes);
  return {
    ...base,
    manual_minutes,
    basis,
    unvalued_reason: null,
    unvalued_kind: null,
    returned_minutes,
    value_rupees: (returned_minutes / 60) * rate.value,
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * The rollup
 * ────────────────────────────────────────────────────────────────────────── */

export interface UnvaluedGroup {
  reason: string;
  turns: number;
  /** The rows themselves, newest first. A count nobody can open is a count
   *  nobody can check, and this list is the one the page asks the reader to
   *  accept on trust. */
  rows: UsageTurn[];
}

/** One kind of work with timings still outstanding: how many sittings would
 *  close it, and how much work that would price. This is what turns the gap
 *  list from a complaint into a worklist. */
export interface TimingGap {
  surface: string;
  /** The named things needing a stopwatch, so the worklist can say WHICH
   *  workflow rather than which kind. */
  names: string[];
  /** Sizes of that work with no timing on file, in view. */
  sittings: number;
  turns: number;
}

/** One size, and the sum that makes it. Size is the page's top-level split:
 *  every kind of activity lands in one of three buckets by how long it takes a
 *  person by hand. */
export interface BandSplit {
  band: WorkBand;
  /** Runs that FINISHED and carry a by-hand time. Only these are in the totals,
   *  so the count has to say so rather than leave a reader wondering why the
   *  figures cover fewer runs than were fired. */
  succeeded: number;
  hours: number;
  /** Minutes, both sides, so the row can show the subtraction it rests on. */
  manual_minutes: number;
  run_minutes: number;
  /** What made up this size: the kinds inside it, the same figures again. */
  kinds: {
    surface: string;
    succeeded: number;
    manual_minutes: number;
    run_minutes: number;
    hours: number;
  }[];
}

export interface SurfaceSplit {
  surface: string;
  turns: number;
  /** Ran and finished. Distinct from `valued_turns`: a kind nobody has timed
   *  can succeed every time and still price nothing, which is exactly the case
   *  the "Ran / Succeeded" pair on the table exists to make visible. */
  succeeded: number;
  valued_turns: number;
  hours: number;
  /** Minutes, both of them, because that is the scale a run lives at and the
   *  scale the by hand timing was taken at. The subtraction stays in minutes
   *  and converts to hours once, at the end. */
  avg_run_minutes: number | null;
  /** The by hand figure the saving is measured against, averaged across the
   *  bands present and weighted by how many of each ran, because a kind spans
   *  several bands and one number has to stand for them. */
  avg_manual_minutes: number | null;
  /** valued × (by hand − run). Exact rather than indicative: both averages are
   *  means over the SAME set, so this reproduces `hours` to the minute. */
  worked_minutes: number | null;
  /** The two sums the averages divide, so a panel can show the division rather
   *  than assert its answer. */
  run_minutes_total: number;
  manual_minutes_total: number;
  /** How many activities each average is drawn from. */
  averaged_over: number;
}

/** One batch, as the reader meets it: what it was, how big, what it took on the
 *  clock against the same runs added up, and what the setup it paid once was
 *  worth. */
export interface BatchRow {
  id: string;
  workflow_name: string | null;
  /** Runs that finished, and runs in the batch at all. */
  finished: number;
  runs: number;
  elapsed_minutes: number;
  sequential_minutes: number;
  /** Null where nobody has timed setting this workflow up, so it earns nothing
   *  and the page says which one rather than printing a nought. */
  setup_minutes: number | null;
  extra_hours: number | null;
}

export interface BatchUplift {
  batches: number;
  /** Every run those batches contained, finished or not: what "on the clock"
   *  and "run time added up" are both measured over. */
  runs: number;
  /** Of those, the ones that finished. Only these earn the setup uplift. */
  finished: number;
  hours: number;
  /** Workflows that were run in a batch and have no setup timing on file, so
   *  their batches contribute nothing. Named, never silently dropped. */
  untimed_workflows: string[];
  /** Wall clock the batches actually took, and what the same runs would have
   *  taken one after another. */
  elapsed_minutes: number;
  sequential_minutes: number;
  rows: BatchRow[];
}

export interface MonthSplit {
  /** `YYYY-MM`. */
  month: string;
  label: string;
  hours: number;
  people: number;
  hours_per_person: number;
}

export interface ValueRollup {
  counted_turns: number;
  valued_turns: number;
  coverage: number;

  hours_returned: number;
  value_created: number;
  /** The two halves of the subtraction, kept so a tile can print its own
   *  arithmetic with the real numbers in it rather than a formula. */
  manual_minutes_total: number;
  run_minutes_total: number;
  /** The timing cells that actually priced something in this scope, so the
   *  inputs a tile names are the inputs it used. */
  timings_used: TimingRecord[];

  /** The rate that priced the most turns in this scope, for the tile's working. */
  rate: Dated<number> | null;
  fx: Dated<number> | null;

  unvalued: UnvaluedGroup[];
  /** Work with no timing, grouped by the kind of work that would close it. */
  timing_gaps: TimingGap[];
  /** Work in view carrying no value only because nobody has timed it yet. */
  untimed_turns: number;
  by_band: BandSplit[];
  by_surface: SurfaceSplit[];
  batch: BatchUplift;
  by_month: MonthSplit[];

  /* Capacity */
  active_people: number;
  hours_per_person: number;
  teams_present: number;

  /* Cost */
  model_cost_inr: number | null;
  /** The AI bill in the currency it arrived in, summed over the same activities
   *  as `model_cost_inr`, so the two are the same bill said two ways. */
  model_cost_usd: number | null;
  lookup_cost_inr: number | null;
  running_cost_inr: number | null;
  returned_per_rupee: number | null;
  has_unpriced_model: boolean;
  has_unpriced_lookup: boolean;

  /** Rows in scope with no user on them. Company scope only: the other scopes
   *  cannot contain them. */
  orphan_turns: number;
}

const MONTH_LABEL = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

export function rollUp(rows: UsageTurn[]): ValueRollup {
  const valued = rows.map(valueTurn);
  const banked = valued.filter(v => v.returned_minutes != null);

  const hours_returned = banked.reduce((s, v) => s + (v.returned_minutes ?? 0), 0) / 60;
  const value_created = banked.reduce((s, v) => s + (v.value_rupees ?? 0), 0);

  // The rate and the fx quoted in the working are the ones that priced the most
  // turns here, so the tile's arithmetic is the arithmetic most of the rows
  // actually went through.
  const modal = <T,>(items: (T | null)[]): T | null => {
    const counts = new Map<string, { key: T; n: number }>();
    items.forEach(i => {
      if (i == null) return;
      const k = JSON.stringify(i);
      const hit = counts.get(k);
      if (hit) hit.n += 1;
      else counts.set(k, { key: i, n: 1 });
    });
    return [...counts.values()].sort((a, b) => b.n - a.n)[0]?.key ?? null;
  };

  const unvaluedMap = new Map<string, UsageTurn[]>();
  valued.forEach(v => {
    if (!v.unvalued_reason) return;
    const list = unvaluedMap.get(v.unvalued_reason) ?? [];
    list.push(v.turn);
    unvaluedMap.set(v.unvalued_reason, list);
  });

  /* ONE SITTING CLOSES ONE NAMED THING, so the worklist is keyed on the named
     thing and never on the kind that reached it. Keyed on the kind, a workflow
     that also runs in batches came back as two rows asking for two stopwatch
     sittings on the same workflow, and the total was double what the work
     actually is. */
  const gapNames = new Map<string, string>();
  const gapSurface = new Map<string, string>();
  const gapTurns = new Map<string, number>();
  valued.forEach(v => {
    if (v.unvalued_kind !== 'no-timing') return;
    const surface = v.turn.surface;
    const key = `${surface}:${timingTargetFor(v.turn) ?? ''}`;
    if (v.turn.workflow_name) gapNames.set(key, v.turn.workflow_name);
    gapSurface.set(key, surface);
    gapTurns.set(key, (gapTurns.get(key) ?? 0) + 1);
  });
  const timing_gaps: TimingGap[] = [...gapTurns.entries()]
    .map(([key, turns]) => ({
      surface: gapSurface.get(key) as string,
      names: gapNames.has(key) ? [gapNames.get(key) as string] : [],
      // One named thing, one sitting. Always.
      sittings: 1,
      turns,
    }))
    .sort((a, b) => b.turns - a.turns);

  const by_band: BandSplit[] = BAND_ORDER.map(band => {
    const inBand = valued.filter(v => v.size === band && v.returned_minutes != null);
    const kinds = [...new Set(inBand.map(v => v.turn.surface))]
      .map(surface => {
        const of = inBand.filter(v => v.turn.surface === surface);
        return {
          surface,
          succeeded: of.length,
          manual_minutes: of.reduce((a, v) => a + (v.manual_minutes ?? 0), 0),
          run_minutes: of.reduce((a, v) => a + v.run_minutes, 0),
          hours: of.reduce((a, v) => a + (v.returned_minutes ?? 0), 0) / 60,
        };
      })
      .sort((a, b) => b.manual_minutes - a.manual_minutes);
    return {
      band,
      succeeded: inBand.length,
      hours: inBand.reduce((s2, v) => s2 + (v.returned_minutes ?? 0), 0) / 60,
      manual_minutes: inBand.reduce((a, v) => a + (v.manual_minutes ?? 0), 0),
      run_minutes: inBand.reduce((a, v) => a + v.run_minutes, 0),
      kinds,
    };
  }).filter(b => b.succeeded > 0);

  /* A row has to agree with its own size, and the check is the PLATFORM column,
     never the by-hand one. A medium row cannot show 20 minutes a run when
     medium means 5 to 15. The by-hand figure has no such constraint and will
     range widely inside a row, because that row holds different workflows.
     Caught here as an assertion rather than left for a reader to spot. */
  if (import.meta.env?.DEV) {
    for (const b of by_band) {
      const perRun = b.run_minutes / b.succeeded;
      const inside =
        b.band === 'high'
          ? perRun > SIZE_THRESHOLDS.large
          : b.band === 'medium'
            ? perRun >= SIZE_THRESHOLDS.medium && perRun <= SIZE_THRESHOLDS.large
            : perRun < SIZE_THRESHOLDS.medium;
      if (!inside) {
        console.error(
          `Platform Value: the ${bandPlain(b.band)} row shows ${perRun.toFixed(2)} min a run, which is outside the band it is named after.`,
        );
      }
    }
  }

  const surfaces = [...new Set(rows.map(r => r.surface))];
  const by_surface: SurfaceSplit[] = surfaces
    .map(surface => {
      const inSurface = valued.filter(v => v.turn.surface === surface);
      const priced = inSurface.filter(v => v.returned_minutes != null);
      // The averages are drawn from the activities the working actually uses,
      // so the working is exact. Where a kind has none, the run average is
      // still worth showing over all of them.
      const runFrom = priced.length > 0 ? priced : inSurface;
      const avg = (xs: number[]) => (xs.length === 0 ? null : xs.reduce((a, c) => a + c, 0) / xs.length);
      const avg_run_minutes = avg(runFrom.map(v => v.run_minutes));
      const avg_manual_minutes = avg(priced.map(v => v.manual_minutes ?? 0));
      return {
        surface,
        turns: inSurface.length,
        succeeded: inSurface.filter(v => v.turn.status === 'ok').length,
        valued_turns: priced.length,
        hours: priced.reduce((s2, v) => s2 + (v.returned_minutes ?? 0), 0) / 60,
        avg_run_minutes,
        avg_manual_minutes,
        worked_minutes:
          avg_manual_minutes == null || avg_run_minutes == null
            ? null
            : priced.length * (avg_manual_minutes - avg_run_minutes),
        run_minutes_total: runFrom.reduce((a, v) => a + v.run_minutes, 0),
        manual_minutes_total: priced.reduce((a, v) => a + (v.manual_minutes ?? 0), 0),
        averaged_over: runFrom.length,
      };
    })
    .sort((a, b) => b.hours - a.hours);

  /* ── Batch uplift ────────────────────────────────────────────────────────
     A batch pays its setup once. By hand it is paid on every run in it, so the
     time returned is the timed setup times one fewer than the successful runs
     the batch actually made. A batch of one returns nothing, which is correct.
  */
  const batches = new Map<string, UsageTurn[]>();
  rows.forEach(r => {
    if (!r.batch_id) return;
    const list = batches.get(r.batch_id) ?? [];
    list.push(r);
    batches.set(r.batch_id, list);
  });
  let batchHours = 0;
  let batchRuns = 0;
  let batchFinished = 0;
  let elapsed_minutes = 0;
  let sequential_minutes = 0;
  const untimed = new Set<string>();
  const batchRows: BatchRow[] = [];
  batches.forEach((members, id) => {
    const ok = members.filter(m => m.status === 'ok');
    batchRuns += members.length;
    batchFinished += ok.length;
    const starts = members.map(m => new Date(m.created_at).getTime());
    const ends = members.map(m => new Date(m.created_at).getTime() + (m.duration_ms ?? 0));
    const elapsed = (Math.max(...ends) - Math.min(...starts)) / 60_000;
    const sequential = members.reduce((s2, m) => s2 + (m.duration_ms ?? 0), 0) / 60_000;
    elapsed_minutes += elapsed;
    sequential_minutes += sequential;

    const wfId = members[0].workflow_id;
    const when = day(members[0].created_at);
    const setup = wfId ? resolveTiming('setup', null, wfId, when) : null;
    const usableSetup = recordIsUsable(setup);
    // A batch pays setup once. By hand it is paid on every run in it, so every
    // run after the first is setup time given back.
    const extra = usableSetup ? (setup!.minutes * Math.max(0, ok.length - 1)) / 60 : null;
    if (extra == null) {
      if (members[0].workflow_name) untimed.add(members[0].workflow_name);
    } else {
      batchHours += extra;
    }

    batchRows.push({
      id,
      workflow_name: members[0].workflow_name,
      finished: ok.length,
      runs: members.length,
      elapsed_minutes: elapsed,
      sequential_minutes: sequential,
      setup_minutes: usableSetup ? setup!.minutes : null,
      extra_hours: extra,
    });
  });
  // Biggest batches at the top, because that is where the argument is.
  batchRows.sort((a, b) => b.runs - a.runs);

  /* ── Months ─────────────────────────────────────────────────────────────── */
  const monthKeys = [...new Set(rows.map(r => r.created_at.slice(0, 7)))].sort();
  const by_month: MonthSplit[] = monthKeys.map(month => {
    const inMonth = valued.filter(v => v.turn.created_at.slice(0, 7) === month);
    const hrs = inMonth.reduce((s, v) => s + (v.returned_minutes ?? 0), 0) / 60;
    const people = new Set(
      inMonth.map(v => v.turn.run_by_email).filter((e): e is string => e != null),
    ).size;
    return {
      month,
      label: MONTH_LABEL(month),
      hours: hrs,
      people,
      hours_per_person: people === 0 ? 0 : hrs / people,
    };
  });

  /* ── Cost ───────────────────────────────────────────────────────────────── */
  const modelPriced = valued.filter(v => v.model_cost_inr != null);
  const lookupPriced = valued.filter(v => v.lookup_cost_inr != null);
  const model_cost_inr =
    modelPriced.length === 0 ? null : modelPriced.reduce((s, v) => s + (v.model_cost_inr ?? 0), 0);
  // Summed over the SAME activities, so the dollar figure and the rupee figure
  // are the one bill converted, never two different populations.
  const model_cost_usd =
    modelPriced.length === 0 ? null : modelPriced.reduce((s, v) => s + (v.model_cost_usd ?? 0), 0);
  const lookup_cost_inr =
    lookupPriced.length === 0
      ? null
      : lookupPriced.reduce((s, v) => s + (v.lookup_cost_inr ?? 0), 0);
  const running_cost_inr =
    model_cost_inr == null && lookup_cost_inr == null
      ? null
      : (model_cost_inr ?? 0) + (lookup_cost_inr ?? 0);

  const people = new Set(rows.map(r => r.run_by_email).filter((e): e is string => e != null));

  const manualTotal = banked.reduce((s, v) => s + (v.manual_minutes ?? 0), 0);
  const runTotal = banked.reduce((s, v) => s + v.run_minutes, 0);

  return {
    counted_turns: rows.length,
    valued_turns: banked.length,
    coverage: rows.length === 0 ? 0 : banked.length / rows.length,

    hours_returned,
    value_created,
    manual_minutes_total: manualTotal,
    run_minutes_total: runTotal,
    /* Keyed by the NAMED THING, because that is what a timing hangs off now.
       Keyed by size it resolved nothing at all: size is an outcome of the
       minutes, so `resolveTiming` had no record to find and every panel's
       inputs list came back empty. */
    /* Deduped on the RECORD. A workflow and its bulk form hold two different
       timings, one for the whole sweep and one per entity, so both appear. */
    timings_used: [
      ...new Map(
        banked
          .filter(v => v.basis === 'band')
          .map(v =>
            resolveTiming(
              v.turn.surface as TimingKind,
              null,
              timingTargetFor(v.turn),
              day(v.turn.created_at),
            ),
          )
          .filter((t): t is TimingRecord => t != null)
          .map(t => [t.id, t] as const),
      ).values(),
    ],

    rate: modal(valued.map(v => v.rate)),
    fx: modal(valued.map(v => v.fx)),

    unvalued: [...unvaluedMap.entries()]
      .map(([reason, list]) => ({ reason, turns: list.length, rows: list }))
      .sort((a, b) => b.turns - a.turns),
    timing_gaps,
    untimed_turns: valued.filter(v => v.unvalued_kind === 'no-timing').length,
    by_band,
    by_surface,
    batch: {
      batches: batches.size,
      runs: batchRuns,
      finished: batchFinished,
      hours: batchHours,
      untimed_workflows: [...untimed].sort(),
      elapsed_minutes,
      sequential_minutes,
      rows: batchRows,
    },
    by_month,

    active_people: people.size,
    hours_per_person: people.size === 0 ? 0 : hours_returned / people.size,
    teams_present: new Set(rows.map(r => r.team_id).filter((t): t is string => t != null)).size,

    model_cost_inr,
    model_cost_usd,
    lookup_cost_inr,
    running_cost_inr,
    returned_per_rupee:
      running_cost_inr == null || running_cost_inr === 0 ? null : value_created / running_cost_inr,
    has_unpriced_model: rows.some(r => r.llm_unpriced_models.length > 0),
    has_unpriced_lookup: rows.some(r => Object.values(r.by_operation).some(o => o.cost == null)),

    orphan_turns: rows.filter(r => r.run_by_email == null).length,
  };
}

/** The middle valued turn in scope, ranked on what it netted after its own
 *  running cost.
 *
 *  The MIDDLE one, not the best one. A worked example picked for being the
 *  strongest row on the page is an advertisement, and the first reader who
 *  sorts the table finds a weaker one and stops believing the rest. The
 *  weakest row gets shown too, in the Cost lens, on purpose. */
/** The turn whose running cost came closest to swallowing what it returned. The
 *  page has to be able to point at one: the arithmetic that proves the platform
 *  pays for itself has to be able to flag a run that did not. */
export function worstNet(rows: UsageTurn[]): TurnValue | null {
  const valued = rows
    .map(valueTurn)
    .filter(v => v.value_rupees != null && (v.model_cost_inr != null || v.lookup_cost_inr != null));
  return (
    valued.sort(
      (a, b) =>
        (a.value_rupees ?? 0) -
        ((a.model_cost_inr ?? 0) + (a.lookup_cost_inr ?? 0)) -
        ((b.value_rupees ?? 0) - ((b.model_cost_inr ?? 0) + (b.lookup_cost_inr ?? 0))),
    )[0] ?? null
  );
}

export function netOf(v: TurnValue): number | null {
  if (v.value_rupees == null) return null;
  return v.value_rupees - ((v.model_cost_inr ?? 0) + (v.lookup_cost_inr ?? 0));
}

/* ──────────────────────────────────────────────────────────────────────────
 * Taking it away
 * ────────────────────────────────────────────────────────────────────────── */

/** One field, safe for a spreadsheet. Quotes everything and doubles inner
 *  quotes: a workflow name with a comma in it must not become two columns. */
function cell(v: string | number | null): string {
  if (v == null) return '';
  return `"${String(v).replace(/"/g, '""')}"`;
}

/**
 * The page's own arithmetic, one row per activity, so a reader who does not believe
 * a total can rebuild it.
 *
 * Every column the page adds up is here, INCLUDING the ones that came out
 * empty: a row with no value carries the reason in the last column rather than
 * a zero, so a spreadsheet sum of the value column reproduces the page's figure
 * exactly and the rows that are missing from it are named.
 */
export function toCsv(rows: UsageTurn[]): string {
  const head = [
    'When',
    'Run by',
    'Team',
    'Kind of activity',
    'Workflow',
    'How big the activity was',
    'Outcome',
    'Minutes by hand',
    'Minutes the run took',
    'Hours given back',
    'What that time is worth (INR)',
    'AI cost (USD, as billed)',
    'AI cost (INR, converted)',
    'Registry lookup cost (INR)',
    'Net (INR)',
    'Why it carries no value',
  ];
  const round = (n: number | null, dp = 2) => (n == null ? null : Number(n.toFixed(dp)));
  const body = rows.map(valueTurn).map(v =>
    [
      v.turn.created_at,
      v.turn.run_by_name ?? 'Started by the scheduler',
      v.turn.team_id ?? '',
      workNoun(v.turn.surface, false),
      v.turn.workflow_name ?? '',
      v.size ? bandPlain(v.size) : 'Not timed',
      v.turn.status === 'ok' ? 'Finished' : v.turn.status === 'stopped' ? 'Stopped' : 'Failed',
      v.manual_minutes,
      round(v.run_minutes),
      round(v.returned_minutes == null ? null : v.returned_minutes / 60),
      round(v.value_rupees),
      round(v.model_cost_usd, 4),
      round(v.model_cost_inr),
      round(v.lookup_cost_inr),
      round(netOf(v)),
      v.unvalued_reason ?? '',
    ]
      .map(cell)
      .join(','),
  );
  return [head.map(cell).join(','), ...body].join('\n');
}
