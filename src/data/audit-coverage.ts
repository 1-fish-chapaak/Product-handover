/**
 * Audit Coverage: the six lines an audit committee actually asks for.
 *
 * Platform Usage answers "is this paying for itself" with a rate we invented,
 * and the page prints its own eight times swing on that one assumption. A
 * figure that can move eight times is not a figure anybody can take into a
 * board room. This file computes the other question instead, the one the audit
 * lead has to answer every quarter: is the work covering what it said it would,
 * and what is slipping.
 *
 * Two rules hold everything here.
 *
 * **Nothing is computed that is not recorded.** Every figure below lands on a
 * field in `platform-usage.ts`. Where the record does not exist the figure is
 * `null` and the page renders the unmeasured state rather than a comforting
 * nought. That is the difference between "nothing happened" and "we do not
 * measure this", and they never share a rendering.
 *
 * **No assumed rate, anywhere.** There is no hourly rate, no rows-an-hour, no
 * money. Every number here is the customer's own record. It is the whole point
 * of the surface: a figure nobody can argue you out of.
 *
 * The evidence for the six lines, and how each one gets validated before it
 * ships, is in `PLATFORM-USAGE-RESEARCH.md`.
 */

import {
  ACTION_PLANS, ANCHOR, DAY_MS, ENGAGEMENT_ROWS, POPULATIONS, RISK_ROWS, RUNS,
  SAMPLE_VALIDATIONS, TRACED_EXCEPTIONS,
  type ActionPlan, type EngagementRow, type SampleValidation, type TracedException,
} from './platform-usage';
import type { Period, Scope } from './platform-usage-metrics';

const inWindow = (at: number, p: Period) => at >= p.from && at <= p.to;

/**
 * How far the reader is looking, applied to a record.
 *
 * The scope filter on the page narrows to a team or to one person's own work,
 * and a pack that ignored it would print the whole company's figures under a
 * heading that said otherwise. Every record here carries a team, and most carry
 * the person who owns it, so both narrowings land on the record rather than on
 * the presentation.
 */
function owns(
  scope: Scope,
  team: string,
  who: { email?: string; name?: string },
): boolean {
  if (scope.level === 'company') return true;
  if (scope.level === 'team') return team === scope.team;
  if (who.email && scope.userEmail) return who.email === scope.userEmail;
  if (who.name && scope.userName) return who.name === scope.userName;
  return false;
}

/** The whole company, for a call that has no reader in front of it. */
export const WHOLE_COMPANY: Scope = { level: 'company', subject: 'the company' };

/** The middle value, which a handful of very old findings cannot drag. */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/* ──────────────────────────────────────────────────────────────────────────
 * 1 · The plan
 * ────────────────────────────────────────────────────────────────────────── */

export interface PlanFigures {
  onTheBooks: number;
  closed: number;
  closedOnTime: number;
  /**
   * Null rather than nought when nothing has closed at all.
   *
   * On today's records this is exactly what happens: thirteen engagements are
   * on the books and not one of them carries a close, so `actualEnd` is null
   * everywhere. "0% complete" would read as a failing audit function when the
   * truth is that the product never records the end of an engagement. The page
   * says the second thing, because the first would be a lie about the customer.
   */
  completionPct: number | null;
  /** Why the figure is missing, in the words the page will print. */
  blocked: string | null;
  slipping: EngagementRow[];
  rows: EngagementRow[];
}

export function planOf(p: Period, scope: Scope = WHOLE_COMPANY): PlanFigures {
  const inScope = ENGAGEMENT_ROWS.filter(e => owns(scope, e.team, { name: e.owner }));
  const rows = inScope.filter(e => e.createdAt <= p.to);
  const closed = rows.filter(e => e.actualEnd !== null && inWindow(e.actualEnd, p));
  const onTime = closed.filter(e => (e.actualEnd as number) <= e.plannedEnd);

  // Past its planned end, still not closed, and the window has caught up with
  // it. That is what "slipping" means to somebody sitting in the meeting.
  const slipping = rows
    .filter(e => e.actualEnd === null && e.plannedEnd < Math.min(p.to, ANCHOR))
    .sort((a, b) => a.plannedEnd - b.plannedEnd);

  const everClosed = inScope.some(e => e.actualEnd !== null);

  return {
    onTheBooks: rows.length,
    closed: closed.length,
    closedOnTime: onTime.length,
    completionPct: everClosed && rows.length > 0 ? Math.round((closed.length / rows.length) * 100) : null,
    blocked: everClosed
      ? null
      : 'No engagement in your records carries a completion date, so there is nothing to divide. '
        + 'This figure appears as soon as engagements are closed in the product.',
    slipping,
    rows,
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * 2 · What was covered, and what was left out
 * ────────────────────────────────────────────────────────────────────────── */

export interface RiskCoverFigures {
  total: number;
  uncovered: number;
  criticalUncovered: number;
  rows: typeof RISK_ROWS;
}

export function riskCoverOf(scope: Scope = WHOLE_COMPANY): RiskCoverFigures {
  const rows = RISK_ROWS.filter(r => owns(scope, r.team, { name: r.owner }));
  const uncovered = rows.filter(r => !r.mapped);
  return {
    total: rows.length,
    uncovered: uncovered.length,
    criticalUncovered: uncovered.filter(r => r.priority === 'Critical').length,
    rows: uncovered.sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * 3 · Everything, against a sample of it
 * ────────────────────────────────────────────────────────────────────────── */

export interface PopulationFigures {
  /** Rows a machine check read end to end. Each population counted once. */
  fullRows: number;
  /** Rows a person looked at, as a sample of a population. */
  sampledRows: number;
  populations: number;
  samples: number;
  /** How many times over the sample would have to grow to match. Null at nought. */
  multiple: number | null;
  /** The validations themselves, so the count on the page opens its own list. */
  rows: SampleValidation[];
}

export function populationOf(p: Period, scope: Scope = WHOLE_COMPANY): PopulationFigures {
  const samples = SAMPLE_VALIDATIONS.filter(s => inWindow(s.at, p) && owns(scope, s.team, s.actor));
  const sampledRows = samples.reduce((sum, s) => sum + s.sampleSize, 0);

  // A population is counted once however often it was re-tested, the same rule
  // the coverage block already holds. Re-reading one ledger every week is speed,
  // not coverage, and adding the repeats up would be the page's oldest trap.
  const testedIds = new Set(
    RUNS.filter(r => r.status === 'passed' && r.rowsProcessed > 0 && inWindow(r.completedAt, p)
      && owns(scope, r.team, r.actor))
      .map(r => r.populationId),
  );
  const tested = POPULATIONS.filter(pop => testedIds.has(pop.id));
  const fullRows = tested.reduce((sum, pop) => sum + pop.size, 0);

  return {
    fullRows,
    sampledRows,
    populations: tested.length,
    samples: samples.length,
    multiple: sampledRows > 0 ? Math.round(fullRows / sampledRows) : null,
    rows: [...samples].sort((a, b) => b.at - a.at),
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * 4 · How long a thing sat there before anybody saw it
 * ────────────────────────────────────────────────────────────────────────── */

export interface DetectionFigures {
  medianDays: number | null;
  sample: number;
  /** Everything the median was taken over, so the figure opens its own list. */
  rows: TracedException[];
  buckets: { label: string; value: number; rows: TracedException[] }[];
  slowest: TracedException[];
}

export function detectionOf(p: Period, scope: Scope = WHOLE_COMPANY): DetectionFigures {
  const caught = TRACED_EXCEPTIONS.filter(ex => inWindow(ex.detectedAt, p) && ex.detectedAt >= ex.occurredAt
    && owns(scope, ex.team, ex.assignee));
  const lag = (ex: TracedException) => (ex.detectedAt - ex.occurredAt) / DAY_MS;

  const bucket = (label: string, test: (days: number) => boolean) => {
    const rows = caught.filter(ex => test(lag(ex)));
    return { label, value: rows.length, rows };
  };

  return {
    medianDays: median(caught.map(lag)),
    sample: caught.length,
    rows: [...caught].sort((a, b) => b.detectedAt - a.detectedAt),
    buckets: [
      bucket('Same day', d => d < 1),
      bucket('1 to 7 days', d => d >= 1 && d <= 7),
      bucket('8 to 30 days', d => d > 7 && d <= 30),
      bucket('More than 30 days', d => d > 30),
    ],
    slowest: [...caught].sort((a, b) => lag(b) - lag(a)).slice(0, 5),
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * 5 · What was found
 * ────────────────────────────────────────────────────────────────────────── */

export interface FindingFigures {
  raised: number;
  /** The findings raised in the window, so the count opens its own list. */
  raisedRows: TracedException[];
  open: number;
  overdue: TracedException[];
  /**
   * Findings raised before de-duplication shipped, left out of open and
   * overdue and counted here instead.
   *
   * They carry no fingerprint, so nothing guarantees two of them are not the
   * same problem twice. Counting them would put a different open figure on this
   * page than the one the findings ageing block already shows, and two counts of
   * one thing with no reason between them is how a page loses its reader.
   */
  legacyExcluded: number;
  bySeverity: { label: string; value: number; rows: TracedException[] }[];
}

export function findingsOf(p: Period, scope: Scope = WHOLE_COMPANY): FindingFigures {
  const scoped = TRACED_EXCEPTIONS.filter(ex => owns(scope, ex.team, ex.assignee));
  const raised = scoped.filter(ex => inWindow(ex.detectedAt, p));
  const unresolved = scoped.filter(ex => ex.status !== 'Resolved');
  const open = unresolved.filter(ex => !ex.beforeDeduplication);

  const severity = (['Critical', 'High', 'Medium', 'Low'] as const).map(label => {
    const rows = raised.filter(ex => ex.severity === label);
    return { label, value: rows.length, rows };
  });

  return {
    raised: raised.length,
    raisedRows: [...raised].sort((a, b) => b.detectedAt - a.detectedAt),
    open: open.length,
    // Past its date and nobody has closed it. Open on its own is not late.
    overdue: open
      .filter(ex => ex.dueAt < ANCHOR)
      .sort((a, b) => a.dueAt - b.dueAt),
    legacyExcluded: unresolved.length - open.length,
    bySeverity: severity,
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * 6 · What was promised about it, and whether that happened
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * An overdue action plan carries the severity of the finding it answers.
 *
 * The plan itself records no severity, but it exists because of one exception
 * and that exception has one. Without it the Risk column on the page is a
 * column of dashes, which reads as broken rather than as absent.
 */
export interface OverdueAction extends ActionPlan {
  severity: TracedException['severity'] | null;
}

export interface ActionFigures {
  open: number;
  overdue: OverdueAction[];
  closedInWindow: number;
  medianDaysToClose: number | null;
}

export function actionsOf(p: Period, scope: Scope = WHOLE_COMPANY): ActionFigures {
  const scoped = ACTION_PLANS.filter(a => owns(scope, a.team, a.owner));
  const open = scoped.filter(a => a.closedAt === null);
  const closed = scoped.filter(a => a.closedAt !== null && inWindow(a.closedAt, p));

  const severityOf = (a: ActionPlan) =>
    TRACED_EXCEPTIONS.find(ex => ex.id === a.exceptionId)?.severity ?? null;

  return {
    open: open.length,
    overdue: open
      .filter(a => a.dueAt < ANCHOR)
      .sort((a, b) => a.dueAt - b.dueAt)
      .map(a => ({ ...a, severity: severityOf(a) })),
    closedInWindow: closed.length,
    medianDaysToClose: median(closed.map(a => ((a.closedAt as number) - a.openedAt) / DAY_MS)),
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * The pack
 * ────────────────────────────────────────────────────────────────────────── */

export interface CoveragePack {
  period: Period;
  plan: PlanFigures;
  risks: RiskCoverFigures;
  population: PopulationFigures;
  detection: DetectionFigures;
  findings: FindingFigures;
  actions: ActionFigures;
}

/**
 * One call, one set of numbers, the way `snapshot()` already works next door.
 * The page and anything that exports it read this and cannot diverge.
 */
export function pack(p: Period, scope: Scope = WHOLE_COMPANY): CoveragePack {
  return {
    period: p,
    plan: planOf(p, scope),
    risks: riskCoverOf(scope),
    population: populationOf(p, scope),
    detection: detectionOf(p, scope),
    findings: findingsOf(p, scope),
    actions: actionsOf(p, scope),
  };
}
