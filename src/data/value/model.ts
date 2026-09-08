/**
 * The value model. One saved time number, worked out in one place.
 *
 * The rule that shapes everything: **nothing is estimated.** A run, a turn or
 * a lookup earns a figure only where the effort it replaced is documented by
 * the client or was timed with a stopwatch. Work with neither is counted, put
 * on screen as unvalued, and left at null. Not nought: null. A nought reads as
 * "this saved nothing", and what we mean is "we cannot prove what this saved".
 *
 *   Documented   your own control documentation says the test takes this long
 *   Measured     an auditor was timed doing the same work by hand
 *   (nothing)    counted, listed, and worth no rupees at all
 *
 * Documented sits above measured on purpose. A timing is more accurate. A
 * document the client wrote and signed is harder to argue with, and this page
 * exists to survive an argument.
 *
 * The consequence, which the page states in those words: the headline is a
 * floor, not a total. It grows when evidence grows rather than when the
 * platform gets busier, and that is the property that makes it worth quoting.
 *
 * The page reads and never writes.
 */

import {
  ANCHOR, DAY_MS, CASES, WORKFLOWS, WORKFLOW_BY_ID, TEAMS, ACTORS,
  type Actor, type ExceptionCase,
} from '../usage/seed';
import { ACTIVITY, type Activity } from './activity';
import {
  CHAT_TIMINGS, CONTROL_BY_ID, CONTROL_REGISTER, DECLARED_BAND, GOVT_TIMINGS, INGESTION_TIMINGS,
  SETUP_TIMINGS, STEP_TIMING, WORKFLOW_TIMINGS, controlsFor, documentedHours, isReviewed,
  sharedControls, type ControlRegisterEntry, type Timing,
} from './controls';
import {
  BANDS, BAND_LABEL, DEFAULT_SETTINGS, GOVT_LABEL, GROUP_OF, HELPER_KINDS, monthHours,
  type ActivityGroup, type Band, type ValueSettings,
} from './settings';

export type { ValueSettings } from './settings';
export { BAND_LABEL, BANDS } from './settings';

/* ──────────────────────────────────────────────────────────────────────────
 * Formatting
 * ────────────────────────────────────────────────────────────────────────── */

const INT = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const ONE_DP = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const TWO_DP = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const DATE_FMT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const MONTH_FMT = new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });

export const fmtInt = (n: number): string => INT.format(Math.round(n));
export const fmtOneDp = (n: number): string => ONE_DP.format(n);
export const fmtPct = (n: number): string => `${Math.round(n)}%`;
export const formatDate = (ms: number): string => DATE_FMT.format(new Date(ms));
export const formatMonth = (ms: number): string => MONTH_FMT.format(new Date(ms));

/** A count and its noun, agreeing, so no line ever says "1 hours". */
export const plural = (n: number, one: string, many: string): string =>
  `${fmtInt(n)} ${Math.round(n) === 1 ? one : many}`;

/** Rupees, at the scale the figure is read at. */
export function fmtInr(n: number): string {
  const v = Math.round(n);
  if (Math.abs(v) >= 10_000_000) return `₹${TWO_DP.format(v / 10_000_000)} crore`;
  if (Math.abs(v) >= 100_000) return `₹${TWO_DP.format(v / 100_000)} lakh`;
  return `₹${INT.format(v)}`;
}

export const fmtInrExact = (n: number): string => `₹${TWO_DP.format(n)}`;

/** Hours, as a person says them. */
export function fmtHours(h: number): string {
  if (h >= 100) return `${fmtInt(h)} hours`;
  if (h >= 1) return `${fmtOneDp(h)} hours`;
  return `${fmtInt(h * 60)} minutes`;
}

/** Machine time, in the largest unit that stays readable. */
export function fmtSeconds(seconds: number): string {
  if (seconds >= 86_400) return `${fmtOneDp(seconds / 86_400)} days`;
  if (seconds >= 3_600) return `${fmtOneDp(seconds / 3_600)} hours`;
  if (seconds >= 60) return `${fmtOneDp(seconds / 60)} minutes`;
  if (seconds >= 1) return `${fmtOneDp(seconds)} seconds`;
  return `${fmtInt(seconds * 1000)} ms`;
}

/** Minutes of manual effort, said the way an audit plan says them. */
export const fmtMinutes = (m: number): string =>
  (m >= 60 ? `${fmtOneDp(m / 60)} hours` : `${fmtInt(m)} minutes`);

export const dataAsOfLabel = (): string => `Counted to ${formatDate(ANCHOR)}`;

/**
 * Capacity, in whatever unit the figure is large enough for.
 *
 * A small team over a short window gets back a fraction of a person, and
 * "0.0 of a person" reads as nothing at all rather than as the two working
 * days it really is.
 */
export function fmtCapacity(hours: number, hoursPerDay: number, monthH: number, months: number): string {
  const people = hours / (monthH * Math.max(months, 1));
  if (people >= 0.1) return `${fmtOneDp(people)} of a person`;
  return `${fmtOneDp(hours / hoursPerDay)} working days`;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Who is reading
 * ────────────────────────────────────────────────────────────────────────── */

export type Persona = 'cfo' | 'head_of_team' | 'auditor';

export const PERSONA_TITLE: Record<Persona, string> = {
  cfo: 'Whole company',
  head_of_team: 'One team',
  auditor: 'Your own work',
};

export const PERSONA_QUESTION: Record<Persona, string> = {
  cfo: 'What has this given back against what it costs to run',
  head_of_team: 'How much capacity did my team get back',
  auditor: 'How much of your own week did this hand back',
};

export interface Scope {
  persona: Persona;
  /** Said inside a sentence: "the company", "SOX Audit", "you". */
  subject: string;
  team?: string;
  userEmail?: string;
  userName?: string;
}

/**
 * The highest view a role may read.
 *
 * `ad_usage` reads the company. `ad_usage_people` without it reads that
 * person's own team. Everybody else reads themselves, with no request and no
 * approval: an auditor asking how much of their own week came back should not
 * have to raise a ticket for the answer.
 */
export function personaFor(
  holds: { usage: boolean; people: boolean },
  team: string | null,
): Persona {
  if (holds.usage) return 'cfo';
  if (holds.people && team) return 'head_of_team';
  return 'auditor';
}

/** A lens, never a key. The switch only offers a view the reader could already see. */
export function entitledViews(ceiling: Persona, team: string | null): Persona[] {
  if (ceiling === 'cfo') return team ? ['cfo', 'head_of_team', 'auditor'] : ['cfo', 'auditor'];
  if (ceiling === 'head_of_team') return ['head_of_team', 'auditor'];
  return ['auditor'];
}

export const REFUSAL =
  'That view is above what your role may read. Every signed in person can read their own value here, '
  + 'so ask an administrator if you need the team or the company view.';

/** Money going out is a company level answer. A team head cannot act on it. */
export const showsCost = (persona: Persona): boolean => persona === 'cfo';

/* ──────────────────────────────────────────────────────────────────────────
 * The window
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * A date range, either end of which may be missing.
 *
 * Both ends empty means all time, which is what Usage & Cost does when nothing
 * is set. The page says so rather than leaving a reader to guess whether a
 * blank range means everything or nothing.
 */
export interface Range {
  from: number | null;
  to: number | null;
}

export const ALL_TIME: Range = { from: null, to: null };

export const rangeLabel = (r: Range): string => {
  if (r.from === null && r.to === null) return 'All time';
  if (r.from !== null && r.to === null) return `${formatDate(r.from)} onwards`;
  if (r.from === null && r.to !== null) return `Up to ${formatDate(r.to)}`;
  return `${formatDate(r.from as number)} to ${formatDate(r.to as number)}`;
};

export const rangePhrase = (r: Range): string =>
  (r.from === null && r.to === null ? 'over all time' : 'in this range');

export const inRange = (at: number, r: Range): boolean =>
  (r.from === null || at >= r.from) && (r.to === null || at <= r.to);

/** Roughly how many months the range covers, for capacity phrasing. */
export function rangeMonths(r: Range): number {
  const from = r.from ?? Date.UTC(2024, 3, 1);
  const to = r.to ?? ANCHOR;
  return Math.max(1, (to - from) / (30 * DAY_MS));
}

/** The window immediately before this one, for a period on period reading. */
export function priorRange(r: Range): Range | null {
  if (r.from === null || r.to === null) return null;
  const span = r.to - r.from;
  return { from: r.from - span - 1, to: r.from - 1 };
}

/** The presets, which only ever fill the two date boxes in. */
export const rangePresets: { id: string; label: string; make: () => Range }[] = [
  { id: 'this-month', label: 'This month', make: () => ({ from: Date.UTC(2026, 2, 1), to: ANCHOR }) },
  { id: 'last-month', label: 'Last month', make: () => ({ from: Date.UTC(2026, 1, 1), to: Date.UTC(2026, 2, 1) - 1 }) },
  { id: 'this-quarter', label: 'This quarter', make: () => ({ from: Date.UTC(2026, 0, 1), to: ANCHOR }) },
  { id: 'last-quarter', label: 'Last quarter', make: () => ({ from: Date.UTC(2025, 9, 1), to: Date.UTC(2026, 0, 1) - 1 }) },
  { id: 'fy-to-date', label: 'Financial year to date', make: () => ({ from: Date.UTC(2025, 3, 1), to: ANCHOR }) },
  { id: 'all-time', label: 'All time', make: () => ALL_TIME },
];

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Percentages that add up to a hundred.
 *
 * Three shares rounded on their own can print 86, 14 and 1, and a reader who
 * adds them up finds 101 and stops trusting the page. The largest remainders
 * take the rounding.
 */
export function shares(values: number[]): number[] {
  const total = values.reduce((sum, v) => sum + v, 0);
  if (total === 0) return values.map(() => 0);
  const exact = values.map(v => (v / total) * 100);
  const floors = exact.map(Math.floor);
  let left = 100 - floors.reduce((sum, v) => sum + v, 0);
  const order = exact
    .map((v, i) => ({ i, rest: v - Math.floor(v) }))
    .sort((a, b) => b.rest - a.rest);
  const out = [...floors];
  for (const { i } of order) {
    if (left <= 0) break;
    out[i] += 1;
    left -= 1;
  }
  return out;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

/**
 * A displayed average duration.
 *
 * The median, never the mean. On this workspace a couple of long runs drag the
 * mean well above the middle, and a mean would misstate platform speed on
 * screen by that margin. The longest one per cent are left out of the figure
 * and still counted everywhere else: they happened, they just should not speak
 * for the runs that did not.
 */
export function medianDuration(rows: Activity[]): number {
  const ok = rows.filter(a => a.status === 'ok').map(a => a.durationSecs);
  const cut = percentile(ok, 99);
  return median(ok.filter(v => v <= cut));
}

/* ──────────────────────────────────────────────────────────────────────────
 * Scoping
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Whether a row belongs to the reader.
 *
 * A row with no user on it belongs to the company and to nobody else. It is
 * counted at company level and left out of every team and personal figure,
 * which is why the company total is the only one that reconciles against the
 * ledger row for row.
 */
export function inScope(a: Activity, scope: Scope): boolean {
  if (scope.persona === 'cfo') return true;
  if (scope.persona === 'head_of_team') return a.team !== null && a.team === scope.team;
  return a.runBy !== null && a.runBy.email === scope.userEmail;
}

function caseInScope(c: ExceptionCase, scope: Scope): boolean {
  if (scope.persona === 'cfo') return true;
  const team = WORKFLOW_BY_ID.get(c.workflowId)?.team ?? null;
  if (scope.persona === 'head_of_team') return team === scope.team;
  return c.flaggedBy.email === scope.userEmail;
}

/* ──────────────────────────────────────────────────────────────────────────
 * The two bases
 * ────────────────────────────────────────────────────────────────────────── */

export type Basis = 'documented' | 'measured';

export const BASIS_LABEL: Record<Basis, string> = {
  documented: 'Documented',
  measured: 'Measured',
};

export const BASIS_MEANING: Record<Basis, string> = {
  documented: 'Your own control documentation says the test takes this long.',
  measured: 'An auditor was timed doing the same work by hand.',
};

/** What the evidence says. */
export interface Resolution {
  minutes: number;
  basis: Basis;
  /** Said on screen: where the figure came from. */
  source: string;
  controls: ControlRegisterEntry[];
  timing: Timing | null;
  stale: boolean;
  /**
   * The day this figure started applying.
   *
   * Work done before it is still valued, because the runs were recorded long
   * before anybody wrote the effort down and there is no honest reason to
   * throw that away. The page says which of its value came from a figure
   * supplied later, and settings can turn the reach back off.
   */
  effectiveFrom: number;
}

/** Why a piece of work could not be valued, in the words a reader needs. */
export interface NoBasis {
  reason: string;
  /** Something an admin can act on, where there is one. */
  fix: string;
}

const monthsBetween = (from: number, to: number): number => (to - from) / (30 * DAY_MS);

const usable = (t: Timing | undefined | null, s: ValueSettings): boolean =>
  t !== undefined && t !== null && t.sampleSize >= s.minBenchmarkSample;

export interface WorkflowResolution {
  hit: Resolution | null;
  miss: NoBasis | null;
  awaitingReview: ControlRegisterEntry[];
  timing: Timing | null;
  divergencePct: number | null;
}

/**
 * How long this workflow takes a person, and how we know, or nothing at all.
 *
 * First match wins, in the order settings say. Anything the resolution
 * rejected on the way is carried out beside the answer, because the reason a
 * figure was not used is worth as much on the worklist as the figure that was.
 */
export function resolveWorkflow(
  workflowId: string,
  s: ValueSettings = DEFAULT_SETTINGS,
): WorkflowResolution {
  const mapped = [
    ...controlsFor(workflowId),
    ...s.extraMappings
      .filter(m => m.workflowId === workflowId)
      .map(m => CONTROL_BY_ID.get(m.controlId))
      .filter((c): c is ControlRegisterEntry => c !== undefined),
  ];
  const checked = (c: ControlRegisterEntry) => isReviewed(c) || s.extraApprovals.includes(c.controlId);
  const reviewed = mapped.filter(checked);
  const awaitingReview = mapped.filter(c => !checked(c));
  const timing = WORKFLOW_TIMINGS[workflowId] ?? null;

  // A control with no usable hours contributes nothing rather than nought.
  const priced = reviewed
    .map(c => ({ control: c, hours: documentedHours(c) }))
    .filter((row): row is { control: ControlRegisterEntry; hours: number } => row.hours !== null);
  const documentedMinutes = priced.reduce((sum, row) => sum + row.hours * 60, 0);
  const hasDocument = priced.length > 0 && documentedMinutes > 0;
  const hasTiming = usable(timing, s);

  const divergencePct = timing && hasDocument
    ? Math.abs(timing.minutes - documentedMinutes) / documentedMinutes * 100
    : null;

  const documented = (): Resolution => ({
    minutes: documentedMinutes,
    basis: 'documented',
    source: priced.length === 1
      ? `${priced[0].control.controlId}, ${priced[0].control.sourceDocument} page ${priced[0].control.sourcePage}`
      : `${priced.map(row => row.control.controlId).join(' and ')}, summed`,
    controls: priced.map(row => row.control),
    timing,
    stale: priced.some(row =>
      row.control.reviewedAt !== null && monthsBetween(row.control.reviewedAt, ANCHOR) > s.benchmarkStaleMonths),
    effectiveFrom: Math.max(...priced.map(row => row.control.effectiveFrom)),
  });

  const measured = (): Resolution => ({
    minutes: (timing as Timing).minutes,
    basis: 'measured',
    source: `Timed on ${plural((timing as Timing).sampleSize, 'auditor', 'auditors')} by ${(timing as Timing).timedBy.name}, ${formatDate((timing as Timing).timedAt)}`,
    controls: [],
    timing,
    stale: monthsBetween((timing as Timing).timedAt, ANCHOR) > s.benchmarkStaleMonths,
    effectiveFrom: (timing as Timing).effectiveFrom,
  });

  const order = s.basisOrder === 'documented-first'
    ? [() => (hasDocument ? documented() : null), () => (hasTiming ? measured() : null)]
    : [() => (hasTiming ? measured() : null), () => (hasDocument ? documented() : null)];

  for (const attempt of order) {
    const found = attempt();
    if (found) return { hit: found, miss: null, awaitingReview, timing, divergencePct };
  }

  // Nothing to stand on. Say which of the several possible nothings it is.
  let miss: NoBasis;
  if (awaitingReview.length > 0) {
    miss = {
      reason: `${awaitingReview.map(c => c.controlId).join(', ')} was read out of a document and nobody has checked the reading`,
      fix: 'Check the reading on the controls and benchmarks screen.',
    };
  } else if (timing) {
    miss = {
      reason: `Timed on ${plural(timing.sampleSize, 'auditor', 'auditors')}, under the ${s.minBenchmarkSample} a timing needs`,
      fix: `Time ${s.minBenchmarkSample - timing.sampleSize} more and it starts counting.`,
    };
  } else if (reviewed.length > 0) {
    miss = {
      reason: 'The control it tests documents no hours, and the steps behind it have not been timed',
      fix: 'Time the written step, or get the hours into the matrix.',
    };
  } else {
    miss = {
      reason: 'No control mapped to it and nobody has timed it',
      fix: 'Map it to a control, or time an auditor doing it by hand.',
    };
  }
  return { hit: null, miss, awaitingReview, timing, divergencePct };
}

export interface TimingResolution {
  hit: Resolution | null;
  miss: NoBasis | null;
}

/** A timed surface, by band. Chat and files taken in can only ever reach this. */
function resolveTiming(
  timing: Timing | undefined,
  s: ValueSettings,
  what: string,
): TimingResolution {
  if (usable(timing, s)) {
    const t = timing as Timing;
    return {
      hit: {
        minutes: t.minutes,
        basis: 'measured',
        source: `Timed on ${plural(t.sampleSize, 'auditor', 'auditors')} by ${t.timedBy.name}, ${formatDate(t.timedAt)}`,
        controls: [],
        timing: t,
        stale: monthsBetween(t.timedAt, ANCHOR) > s.benchmarkStaleMonths,
        effectiveFrom: t.effectiveFrom,
      },
      miss: null,
    };
  }
  if (timing) {
    return {
      hit: null,
      miss: {
        reason: `Timed on ${plural(timing.sampleSize, 'auditor', 'auditors')}, under the ${s.minBenchmarkSample} a timing needs`,
        fix: `Time ${s.minBenchmarkSample - timing.sampleSize} more and it starts counting.`,
      },
    };
  }
  return {
    hit: null,
    miss: {
      reason: `${what} has not been timed`,
      fix: 'One sitting with an auditor and a stopwatch brings the whole band into scope.',
    },
  };
}

export const resolveChat = (band: Band, s: ValueSettings = DEFAULT_SETTINGS): TimingResolution =>
  resolveTiming(CHAT_TIMINGS[band], s, `${BAND_LABEL[band]} band chat`);

export const resolveIngestion = (band: Band, s: ValueSettings = DEFAULT_SETTINGS): TimingResolution =>
  resolveTiming(INGESTION_TIMINGS[band], s, `${BAND_LABEL[band]} band files`);

export const resolveGovt = (key: string, s: ValueSettings = DEFAULT_SETTINGS): TimingResolution =>
  resolveTiming(GOVT_TIMINGS[key], s, `${GOVT_LABEL.get(key) ?? key} lookups`);

/* ──────────────────────────────────────────────────────────────────────────
 * What one row saved
 * ────────────────────────────────────────────────────────────────────────── */

export interface Saved {
  /** Null where there is no evidence. Never nought: a nought would be a claim. */
  seconds: number | null;
  basis: Basis | null;
  manualMinutes: number | null;
  /** Whether the row is in the denominator at all. */
  counted: boolean;
  miss: NoBasis | null;
  /** The work happened before the figure that values it was supplied. */
  fromLaterEvidence: boolean;
}

const NOT_COUNTED: Saved = {
  seconds: null, basis: null, manualMinutes: null, counted: false, miss: null, fromLaterEvidence: false,
};

/**
 * The saving on one row.
 *
 * Three outcomes, and the difference between the last two matters more than
 * anything else on the page. A row can be outside the model altogether, a row
 * can be counted and valued, or a row can be counted and left unvalued because
 * nobody has evidence for what it replaced.
 */
export function savedOn(a: Activity, s: ValueSettings = DEFAULT_SETTINGS): Saved {
  if (a.status !== 'ok') return NOT_COUNTED;
  if (HELPER_KINDS.includes(a.kind)) return NOT_COUNTED;
  if (a.kind === 'ingestion' && !a.producedOutput) return NOT_COUNTED;
  if (a.kind === 'govt_lookup' && !a.govtBilled && !a.govtCached) return NOT_COUNTED;

  const found: TimingResolution | WorkflowResolution =
    a.kind === 'workflow_run'
      ? (a.workflowId === null
        ? { hit: null, miss: { reason: 'The run carries no workflow', fix: 'Nothing to do from here.' } }
        : resolveWorkflow(a.workflowId, s))
      : a.kind === 'govt_lookup'
        ? resolveGovt(a.govtLookupKey ?? '', s)
        : a.kind === 'ingestion'
          ? resolveIngestion(a.band, s)
          : resolveChat(a.band, s);

  if (!found.hit) {
    return {
      seconds: null, basis: null, manualMinutes: null, counted: true, miss: found.miss,
      fromLaterEvidence: false,
    };
  }

  // The work happened before anybody wrote down what it costs by hand. The
  // runs were recorded either way, so by default it still counts and the page
  // says how much of its total came that way.
  const later = a.at < found.hit.effectiveFrom;
  if (later && !s.reachBackOverHistory) {
    return {
      seconds: null,
      basis: null,
      manualMinutes: null,
      counted: true,
      miss: {
        reason: `The figure that would value this was supplied on ${formatDate(found.hit.effectiveFrom)}, after the work happened`,
        fix: 'Turn history on in settings to let a figure reach back over work done before it arrived.',
      },
      fromLaterEvidence: false,
    };
  }

  return {
    seconds: Math.max(0, found.hit.minutes * 60 - a.durationSecs),
    basis: found.hit.basis,
    manualMinutes: found.hit.minutes,
    counted: true,
    miss: null,
    fromLaterEvidence: later,
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * The aggregate
 * ────────────────────────────────────────────────────────────────────────── */

export interface Coverage {
  documented: number;
  measured: number;
  unvalued: number;
  documentedPct: number;
  measuredPct: number;
  unvaluedPct: number;
  /** Share of counted activity with any basis at all. */
  valuedPct: number;
}

export interface GroupLine {
  group: ActivityGroup;
  counted: number;
  valued: number;
  hours: number;
  inr: number;
}

export interface BandLine {
  band: Band;
  counted: number;
  valued: number;
  hours: number;
  inr: number;
  eventsPct: number;
  valuePct: number;
}

export interface WorkflowValueLine {
  workflowId: string;
  name: string;
  team: string;
  band: Band;
  controlIds: string[];
  runs: number;
  failed: number;
  medianSecs: number;
  basis: Basis | null;
  manualMinutes: number | null;
  hours: number;
  inr: number;
  source: string;
  citation: { document: string; page: number; controlId: string } | null;
  divergencePct: number | null;
  stale: boolean;
  miss: NoBasis | null;
}

export interface UnvaluedLine {
  key: string;
  what: string;
  band: Band | null;
  events: number;
  reason: string;
  fix: string;
}

export interface BatchLine {
  batchId: string;
  workflowId: string;
  name: string;
  runs: number;
  /** How long the batch itself took, start of the first to end of the last. */
  wallClockSecs: number;
  /** What the same work would have taken by hand, one after another. */
  sequentialMinutes: number | null;
  perRunHours: number;
  /** The setup a batch pays once and a person pays every time. */
  setup: Timing | null;
  upliftHours: number;
  basis: Basis | null;
}

export interface MemberLine {
  actor: Actor;
  runs: number;
  turns: number;
  files: number;
  hours: number;
  inr: number;
  bands: Record<Band, number>;
}

export interface GovtLine {
  key: string;
  label: string;
  calls: number;
  billed: number;
  cached: number;
  costInr: number;
  manualMinutes: number | null;
  hours: number;
  inr: number;
  miss: NoBasis | null;
}

export interface WeekPoint {
  at: number;
  workflow: number;
  chat: number;
  ingestion: number;
  govt: number;
  total: number;
  costInr: number;
}

export interface ExceptionLine {
  workflowId: string;
  name: string;
  total: number;
  high: number;
  medium: number;
  low: number;
}

export interface CostFigures {
  llmUsd: number;
  llmInr: number;
  govtInr: number;
  totalInr: number;
  unpricedRows: number;
  netInr: number;
  ratio: number;
}

export interface Snapshot {
  /** Every row in scope, whatever became of it. */
  events: number;
  /** Rows the model counts: successful, not a helper, not an empty file. */
  counted: number;
  /** Rows with a documented or measured basis behind them. */
  valued: number;
  hours: number;
  inr: number;
  auditorMonths: number;
  /** Machine time on the rows that were valued. */
  machineSeconds: number;
  /** What the same work would have taken by hand. */
  manualHours: number;
  coverage: Coverage;
  /** Share of run volume with a basis, which is what the tab is gated on. */
  runCoveragePct: number;
  groups: GroupLine[];
  bands: BandLine[];
  workflows: WorkflowValueLine[];
  unvalued: UnvaluedLine[];
  batches: BatchLine[];
  batchUpliftHours: number;
  members: MemberLine[];
  govt: GovtLine[];
  weeks: WeekPoint[];
  exceptions: ExceptionLine[];
  exceptionTotal: number;
  exceptionHigh: number;
  medianRunSecs: number;
  cost: CostFigures;
  unattributedRuns: number;
  /** Valued work that happened before the figure valuing it was supplied. */
  valuedFromLaterEvidence: number;
  hoursFromLaterEvidence: number;
  /** Counted rows whose band was worked out later rather than written at the time. */
  backfilledBands: number;
}

const startOfWeek = (at: number): number => {
  const d = new Date(at);
  const day = (d.getUTCDay() + 6) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - day * DAY_MS;
};

const emptyBands = (): Record<Band, number> => ({ high: 0, medium: 0, low: 0 });

/**
 * Everything the page prints, for one reader and one range.
 *
 * Built in a single pass over the rows in scope, so a figure in a tile and the
 * same figure in a table underneath cannot disagree.
 */
export function snapshot(
  scope: Scope,
  r: Range,
  s: ValueSettings = DEFAULT_SETTINGS,
): Snapshot {
  const rows = ACTIVITY.filter(a => inRange(a.at, r) && inScope(a, scope));

  const basisCount: Record<Basis, number> = { documented: 0, measured: 0 };
  const groupAgg = new Map<ActivityGroup, { seconds: number; counted: number; valued: number }>();
  const bandAgg = new Map<Band, { seconds: number; counted: number; valued: number }>();
  const weekMap = new Map<number, WeekPoint>();
  const perWorkflow = new Map<string, { runs: number; failed: number; durations: number[]; seconds: number }>();
  const perMember = new Map<string, { actor: Actor; runs: number; turns: number; files: number; seconds: number; bands: Record<Band, number> }>();
  const perLookup = new Map<string, { calls: number; billed: number; cached: number; costInr: number; seconds: number }>();
  const perBatch = new Map<string, { workflowId: string; runs: number; first: number; last: number; seconds: number; basis: Basis | null; manual: number | null }>();
  const misses = new Map<string, UnvaluedLine>();

  let seconds = 0;
  let counted = 0;
  let valued = 0;
  let unvalued = 0;
  let machineSeconds = 0;
  let llmUsd = 0;
  let govtInr = 0;
  let unpriced = 0;
  let unattributedRuns = 0;
  let runsCounted = 0;
  let runsValued = 0;
  let laterEvidence = 0;
  let laterEvidenceSeconds = 0;
  let backfilledBands = 0;

  const noteMiss = (key: string, what: string, band: Band | null, miss: NoBasis) => {
    const line = misses.get(key) ?? { key, what, band, events: 0, reason: miss.reason, fix: miss.fix };
    line.events += 1;
    misses.set(key, line);
  };

  const week = (at: number): WeekPoint => {
    const key = startOfWeek(at);
    const point = weekMap.get(key)
      ?? { at: key, workflow: 0, chat: 0, ingestion: 0, govt: 0, total: 0, costInr: 0 };
    weekMap.set(key, point);
    return point;
  };

  rows.forEach(a => {
    const saved = savedOn(a, s);
    llmUsd += a.llmCostUsd;
    govtInr += a.govtCostInr;
    if (!a.llmPriced) unpriced += 1;
    week(a.at).costInr += a.llmCostUsd * s.usdToInr + a.govtCostInr;

    if (a.kind === 'workflow_run' && a.workflowId) {
      const w = perWorkflow.get(a.workflowId) ?? { runs: 0, failed: 0, durations: [], seconds: 0 };
      w.runs += 1;
      if (a.status !== 'ok') w.failed += 1;
      else w.durations.push(a.durationSecs);
      w.seconds += saved.seconds ?? 0;
      perWorkflow.set(a.workflowId, w);
      if (a.runBy === null) unattributedRuns += 1;
    }

    if (!saved.counted) return;

    counted += 1;
    if (a.kind === 'workflow_run') runsCounted += 1;
    if (a.bandBackfilled) backfilledBands += 1;

    const group = GROUP_OF[a.kind];
    const g = groupAgg.get(group) ?? { seconds: 0, counted: 0, valued: 0 };
    const b = bandAgg.get(a.band) ?? { seconds: 0, counted: 0, valued: 0 };
    g.counted += 1;
    b.counted += 1;

    if (saved.seconds === null) {
      unvalued += 1;
      if (saved.miss) {
        const key = a.kind === 'workflow_run'
          ? `wf-${a.workflowId}`
          : a.kind === 'govt_lookup'
            ? `govt-${a.govtLookupKey}`
            : `${group}-${a.band}`;
        const what = a.kind === 'workflow_run'
          ? WORKFLOW_BY_ID.get(a.workflowId ?? '')?.name ?? 'A workflow'
          : a.kind === 'govt_lookup'
            ? `${GOVT_LABEL.get(a.govtLookupKey ?? '') ?? 'Government'} lookups`
            : a.kind === 'ingestion'
              ? `${BAND_LABEL[a.band]} band files taken in`
              : `${BAND_LABEL[a.band]} band chat`;
        noteMiss(key, what, a.kind === 'workflow_run' || a.kind === 'govt_lookup' ? null : a.band, saved.miss);
      }
    } else {
      valued += 1;
      if (a.kind === 'workflow_run') runsValued += 1;
      if (saved.fromLaterEvidence) {
        laterEvidence += 1;
        laterEvidenceSeconds += saved.seconds;
      }
      seconds += saved.seconds;
      machineSeconds += a.durationSecs;
      if (saved.basis) basisCount[saved.basis] += 1;
      g.seconds += saved.seconds;
      b.seconds += saved.seconds;
      g.valued += 1;
      b.valued += 1;

      const point = week(a.at);
      point[group] += saved.seconds / 3600;
      point.total += saved.seconds / 3600;
    }

    groupAgg.set(group, g);
    bandAgg.set(a.band, b);

    if (a.runBy) {
      const m = perMember.get(a.runBy.email)
        ?? { actor: a.runBy, runs: 0, turns: 0, files: 0, seconds: 0, bands: emptyBands() };
      if (a.kind === 'workflow_run') m.runs += 1;
      else if (a.kind === 'ingestion') m.files += 1;
      else if (a.kind !== 'govt_lookup') m.turns += 1;
      m.seconds += saved.seconds ?? 0;
      m.bands[a.band] += 1;
      perMember.set(a.runBy.email, m);
    }

    if (a.kind === 'govt_lookup' && a.govtLookupKey) {
      const l = perLookup.get(a.govtLookupKey) ?? { calls: 0, billed: 0, cached: 0, costInr: 0, seconds: 0 };
      l.calls += 1;
      if (a.govtBilled) l.billed += 1;
      if (a.govtCached) l.cached += 1;
      l.costInr += a.govtCostInr;
      l.seconds += saved.seconds ?? 0;
      perLookup.set(a.govtLookupKey, l);
    }

    if (a.kind === 'workflow_run' && a.batchId && a.workflowId && saved.seconds !== null) {
      const bt = perBatch.get(a.batchId)
        ?? {
          workflowId: a.workflowId, runs: 0, first: a.at, last: a.at,
          seconds: 0, basis: saved.basis, manual: saved.manualMinutes,
        };
      bt.runs += 1;
      bt.first = Math.min(bt.first, a.at);
      bt.last = Math.max(bt.last, a.at + a.durationSecs * 1000);
      bt.seconds += saved.seconds;
      perBatch.set(a.batchId, bt);
    }
  });

  const rate = s.hourlyRateInr;

  const batches: BatchLine[] = [...perBatch.entries()]
    .map(([batchId, bt]) => {
      const setup = SETUP_TIMINGS[bt.workflowId] ?? null;
      const setupUsable = usable(setup, s);
      const upliftMinutes = setupUsable && bt.runs > 1 ? (setup as Timing).minutes * (bt.runs - 1) : 0;
      return {
        batchId,
        workflowId: bt.workflowId,
        name: WORKFLOW_BY_ID.get(bt.workflowId)?.name ?? bt.workflowId,
        runs: bt.runs,
        wallClockSecs: Math.max(1, (bt.last - bt.first) / 1000),
        sequentialMinutes: bt.manual === null ? null : bt.manual * bt.runs,
        perRunHours: bt.seconds / 3600,
        setup: setupUsable ? setup : null,
        upliftHours: upliftMinutes / 60,
        basis: bt.basis,
      };
    })
    .filter(b => b.runs > 1)
    .sort((a, b) => (b.perRunHours + b.upliftHours) - (a.perRunHours + a.upliftHours));

  const batchUpliftHours = batches.reduce((sum, b) => sum + b.upliftHours, 0);
  const hours = seconds / 3600 + batchUpliftHours;
  const inr = hours * rate;

  // Setup a batch avoided belongs to the workflow that ran, so it belongs to
  // that workflow's band. Without this the band split lands a couple of hours
  // short of the headline and a reader who adds it up finds the gap.
  batches.forEach(b => {
    if (b.upliftHours === 0) return;
    const band = bandOfWorkflow(b.workflowId, s);
    const agg = bandAgg.get(band) ?? { seconds: 0, counted: 0, valued: 0 };
    agg.seconds += b.upliftHours * 3600;
    bandAgg.set(band, agg);
  });

  const [documentedPct, measuredPct, unvaluedPct] =
    shares([basisCount.documented, basisCount.measured, unvalued]);
  const coverage: Coverage = {
    documented: basisCount.documented,
    measured: basisCount.measured,
    unvalued,
    documentedPct,
    measuredPct,
    unvaluedPct,
    valuedPct: documentedPct + measuredPct,
  };

  const groups: GroupLine[] = (['workflow', 'chat', 'ingestion', 'govt'] as ActivityGroup[])
    .map(group => {
      const g = groupAgg.get(group) ?? { seconds: 0, counted: 0, valued: 0 };
      // The uplift is workflow work, so it sits with the workflow line here
      // for the same reason it sits with that workflow's band above.
      const extra = group === 'workflow' ? batchUpliftHours : 0;
      return {
        group,
        counted: g.counted,
        valued: g.valued,
        hours: g.seconds / 3600 + extra,
        inr: (g.seconds / 3600 + extra) * rate,
      };
    })
    .filter(g => g.counted > 0)
    .sort((a, b) => b.hours - a.hours);

  const bandRows = BANDS.map(band => bandAgg.get(band) ?? { seconds: 0, counted: 0, valued: 0 });
  const eventShares = shares(bandRows.map(b => b.counted));
  const valueShares = shares(bandRows.map(b => b.seconds));
  const bands: BandLine[] = BANDS.map((band, i) => {
    const b = bandRows[i];
    return {
      band,
      counted: b.counted,
      valued: b.valued,
      hours: b.seconds / 3600,
      inr: (b.seconds / 3600) * rate,
      eventsPct: eventShares[i],
      valuePct: valueShares[i],
    };
  }).filter(b => b.counted > 0);

  const workflows: WorkflowValueLine[] = [...perWorkflow.entries()].map(([id, w]) => {
    const meta = WORKFLOW_BY_ID.get(id);
    const res = resolveWorkflow(id, s);
    const cited = res.hit?.controls[0];
    return {
      workflowId: id,
      name: meta?.name ?? id,
      team: meta?.team ?? '—',
      band: bandOfWorkflow(id, s),
      controlIds: res.hit?.controls.map(c => c.controlId) ?? [],
      runs: w.runs,
      failed: w.failed,
      medianSecs: median(w.durations),
      basis: res.hit?.basis ?? null,
      manualMinutes: res.hit?.minutes ?? null,
      hours: w.seconds / 3600,
      inr: (w.seconds / 3600) * rate,
      source: res.hit?.source ?? (res.miss?.reason ?? 'Not valued'),
      citation: cited ? { document: cited.sourceDocument, page: cited.sourcePage, controlId: cited.controlId } : null,
      divergencePct: res.divergencePct,
      stale: res.hit?.stale ?? false,
      miss: res.miss,
    };
  }).sort((a, b) => b.hours - a.hours || b.runs - a.runs);

  const members: MemberLine[] = [...perMember.values()]
    .map(m => ({
      actor: m.actor,
      runs: m.runs,
      turns: m.turns,
      files: m.files,
      hours: m.seconds / 3600,
      inr: (m.seconds / 3600) * rate,
      bands: m.bands,
    }))
    .sort((a, b) => b.hours - a.hours);

  const govt: GovtLine[] = [...perLookup.entries()]
    .map(([key, l]) => {
      const res = resolveGovt(key, s);
      return {
        key,
        label: GOVT_LABEL.get(key) ?? key,
        calls: l.calls,
        billed: l.billed,
        cached: l.cached,
        costInr: l.costInr,
        manualMinutes: res.hit?.minutes ?? null,
        hours: l.seconds / 3600,
        inr: (l.seconds / 3600) * rate,
        miss: res.miss,
      };
    })
    .sort((a, b) => b.hours - a.hours || b.calls - a.calls);

  const casesInRange = CASES.filter(c => inRange(c.flaggedAt, r) && caseInScope(c, scope));
  const perException = new Map<string, ExceptionLine>();
  casesInRange.forEach(c => {
    const line = perException.get(c.workflowId) ?? {
      workflowId: c.workflowId,
      name: WORKFLOW_BY_ID.get(c.workflowId)?.name ?? c.workflowId,
      total: 0, high: 0, medium: 0, low: 0,
    };
    line.total += 1;
    line[c.severity] += 1;
    perException.set(c.workflowId, line);
  });

  const llmInr = llmUsd * s.usdToInr;
  const totalCost = llmInr + govtInr;

  return {
    events: rows.length,
    counted,
    valued,
    hours,
    inr,
    auditorMonths: hours / monthHours(s),
    machineSeconds,
    manualHours: hours + machineSeconds / 3600,
    coverage,
    runCoveragePct: runsCounted === 0 ? 0 : (runsValued / runsCounted) * 100,
    groups,
    bands,
    workflows,
    unvalued: [...misses.values()].sort((a, b) => b.events - a.events),
    batches,
    batchUpliftHours,
    members,
    govt,
    weeks: [...weekMap.values()].sort((a, b) => a.at - b.at),
    exceptions: [...perException.values()].sort((a, b) => b.total - a.total),
    exceptionTotal: casesInRange.length,
    exceptionHigh: casesInRange.filter(c => c.severity === 'high').length,
    medianRunSecs: medianDuration(rows.filter(a => a.kind === 'workflow_run')),
    cost: {
      llmUsd,
      llmInr,
      govtInr,
      totalInr: totalCost,
      unpricedRows: unpriced,
      netInr: inr - totalCost,
      ratio: totalCost === 0 ? 0 : inr / totalCost,
    },
    unattributedRuns,
    valuedFromLaterEvidence: laterEvidence,
    hoursFromLaterEvidence: laterEvidenceSeconds / 3600,
    backfilledBands,
  };
}

/**
 * The band a workflow sits in.
 *
 * Where a checked control documents the hours, they decide it: a four hour
 * test is a big job and a fifteen minute one is not. Otherwise the band
 * declared on the workflow definition stands.
 */
export function bandOfWorkflow(workflowId: string, s: ValueSettings = DEFAULT_SETTINGS): Band {
  const res = resolveWorkflow(workflowId, s);
  if (res.hit && res.hit.basis === 'documented') {
    const hours = res.hit.minutes / 60;
    if (hours >= s.workflowBands.highHours) return 'high';
    if (hours >= s.workflowBands.mediumHours) return 'medium';
    return 'low';
  }
  return DECLARED_BAND[workflowId] ?? 'medium';
}

/* ──────────────────────────────────────────────────────────────────────────
 * A team head's two extra questions
 * ────────────────────────────────────────────────────────────────────────── */

export interface AdoptionLine {
  actor: Actor;
  events: number;
  hours: number;
}

/** Who on the team is not using it, quietest first. This is the line to act on. */
export function adoptionGap(team: string, r: Range, s: ValueSettings = DEFAULT_SETTINGS): AdoptionLine[] {
  const roster = ACTORS.filter(a => a.team === team);
  const rows = ACTIVITY.filter(a => inRange(a.at, r) && a.team === team && a.runBy !== null);
  return roster
    .map(actor => {
      const mine = rows.filter(a => a.runBy?.email === actor.email);
      return {
        actor,
        events: mine.length,
        hours: mine.reduce((sum, a) => sum + (savedOn(a, s).seconds ?? 0), 0) / 3600,
      };
    })
    .sort((a, b) => a.hours - b.hours);
}

export interface Benchmarking {
  team: string;
  hoursPerActiveUser: number;
  activePct: number;
  medianHoursPerActiveUser: number;
  medianActivePct: number;
}

/**
 * The team against the middle of the platform.
 *
 * The median only. A league table of named teams changes how people behave in
 * ways nobody asked for, and a team head coaching their own team does not need
 * to know they came fourth.
 */
export function benchmarking(team: string, r: Range, s: ValueSettings = DEFAULT_SETTINGS): Benchmarking {
  const read = (t: string) => {
    const roster = ACTORS.filter(a => a.team === t);
    const rows = ACTIVITY.filter(a => inRange(a.at, r) && a.team === t && a.runBy !== null);
    const active = new Set(rows.map(a => a.runBy?.email));
    const hours = rows.reduce((sum, a) => sum + (savedOn(a, s).seconds ?? 0), 0) / 3600;
    return {
      hoursPerActiveUser: active.size === 0 ? 0 : hours / active.size,
      activePct: roster.length === 0 ? 0 : (active.size / roster.length) * 100,
    };
  };
  const mine = read(team);
  const all = TEAMS.map(read).filter(t => t.hoursPerActiveUser > 0);
  return {
    team,
    hoursPerActiveUser: mine.hoursPerActiveUser,
    activePct: mine.activePct,
    medianHoursPerActiveUser: median(all.map(t => t.hoursPerActiveUser)),
    medianActivePct: median(all.map(t => t.activePct)),
  };
}

/** The five things that gave the most back, for somebody reading their own week. */
export interface WinLine {
  at: number;
  name: string;
  machineSecs: number;
  savedHours: number;
  basis: Basis;
}

export function topWins(scope: Scope, r: Range, s: ValueSettings = DEFAULT_SETTINGS): WinLine[] {
  return ACTIVITY
    .filter(a => inRange(a.at, r) && inScope(a, scope) && a.status === 'ok')
    .map(a => {
      const saved = savedOn(a, s);
      if (saved.seconds === null || saved.basis === null) return null;
      const name = a.kind === 'workflow_run' && a.workflowId
        ? WORKFLOW_BY_ID.get(a.workflowId)?.name ?? 'A workflow'
        : a.kind === 'govt_lookup'
          ? `${GOVT_LABEL.get(a.govtLookupKey ?? '') ?? 'Government'} lookup`
          : a.kind === 'ingestion' ? 'A file taken in' : 'A chat turn';
      return { at: a.at, name, machineSecs: a.durationSecs, savedHours: saved.seconds / 3600, basis: saved.basis };
    })
    .filter((w): w is WinLine => w !== null)
    .sort((a, b) => b.savedHours - a.savedHours)
    .slice(0, 5);
}

/* ──────────────────────────────────────────────────────────────────────────
 * The worklist
 * ────────────────────────────────────────────────────────────────────────── */

export interface LadderRow {
  workflowId: string;
  name: string;
  team: string;
  band: Band;
  controls: ControlRegisterEntry[];
  awaitingReview: ControlRegisterEntry[];
  timing: Timing | null;
  timingUsed: boolean;
  setup: Timing | null;
  basis: Basis | null;
  manualMinutes: number | null;
  source: string;
  miss: NoBasis | null;
  divergencePct: number | null;
  diverges: boolean;
  stale: boolean;
  runs: number;
  sharedWith: string[];
}

/**
 * Every workflow and how its manual figure resolved, busiest first.
 *
 * This screen is where coverage gets improved, so it is sorted by run volume:
 * the workflows that move the number most sit at the top, and the gap worth
 * closing first is the gap seen first. It reads as a worklist, not a settings
 * page.
 */
export function ladderRows(r: Range, s: ValueSettings = DEFAULT_SETTINGS): LadderRow[] {
  const shared = sharedControls(s.extraMappings);
  return WORKFLOWS.map(w => {
    const res = resolveWorkflow(w.id, s);
    const runs = ACTIVITY.filter(a => a.kind === 'workflow_run' && a.workflowId === w.id && inRange(a.at, r)).length;
    const setup = SETUP_TIMINGS[w.id] ?? null;
    const sharedWith = shared
      .filter(sc => sc.workflowIds.includes(w.id))
      .flatMap(sc => sc.workflowIds
        .filter(id => id !== w.id)
        .map(id => `${sc.controlId} is also tested by ${WORKFLOW_BY_ID.get(id)?.name ?? id}`));
    return {
      workflowId: w.id,
      name: w.name,
      team: w.team,
      band: bandOfWorkflow(w.id, s),
      controls: res.hit?.controls ?? [],
      awaitingReview: res.awaitingReview,
      timing: res.timing,
      timingUsed: res.hit?.basis === 'measured',
      setup: usable(setup, s) ? setup : null,
      basis: res.hit?.basis ?? null,
      manualMinutes: res.hit?.minutes ?? null,
      source: res.hit?.source ?? '',
      miss: res.miss,
      divergencePct: res.divergencePct,
      diverges: res.divergencePct !== null && res.divergencePct > s.divergenceThresholdPct,
      stale: res.hit?.stale ?? false,
      runs,
      sharedWith,
    };
  }).sort((a, b) => b.runs - a.runs);
}

/** What the other three surfaces are waiting on, band by band. */
export interface SurfaceRow {
  surface: string;
  band: Band | null;
  key: string;
  timing: Timing | null;
  used: boolean;
  miss: NoBasis | null;
}

export function surfaceRows(s: ValueSettings = DEFAULT_SETTINGS): SurfaceRow[] {
  const out: SurfaceRow[] = [];
  BANDS.forEach(band => {
    const chat = resolveChat(band, s);
    out.push({
      surface: 'Chat', band, key: `chat-${band}`,
      timing: CHAT_TIMINGS[band] ?? null, used: chat.hit !== null, miss: chat.miss,
    });
  });
  BANDS.forEach(band => {
    const ing = resolveIngestion(band, s);
    out.push({
      surface: 'Files taken in', band, key: `ing-${band}`,
      timing: INGESTION_TIMINGS[band] ?? null, used: ing.hit !== null, miss: ing.miss,
    });
  });
  [...GOVT_LABEL.entries()].forEach(([key, label]) => {
    const g = resolveGovt(key, s);
    out.push({
      surface: `Government lookup, ${label}`, band: null, key: `govt-${key}`,
      timing: GOVT_TIMINGS[key] ?? null, used: g.hit !== null, miss: g.miss,
    });
  });
  return out;
}

/** Register rows nobody has checked yet, which is the queue to work through. */
export const reviewQueue = (s: ValueSettings = DEFAULT_SETTINGS): ControlRegisterEntry[] =>
  CONTROL_REGISTER.filter(c => !isReviewed(c) && !s.extraApprovals.includes(c.controlId));

/** Controls a workflow could be mapped to, for closing a gap on the worklist. */
export const mappableControls = (): ControlRegisterEntry[] => CONTROL_REGISTER;

/** The timing that turns a documented step count into documented hours. */
export const stepTiming = (): Timing => STEP_TIMING;
