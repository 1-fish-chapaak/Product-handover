/**
 * Every figure the page prints, worked out in one place.
 *
 * One rule governs this file: **a figure here has a column behind it.** If the
 * platform does not record something, nothing here estimates it, models it or
 * fills it in from a rate we picked. There are no assumptions in this file, so
 * there is no assumptions block, and the page has nothing to caveat.
 *
 * That rule takes things away. There is no hours-saved figure, because the
 * product records no manual review pace to compare against. There is no money
 * anywhere, because nothing records a price, a token or a salary. There is no
 * per-person figure for a check that ran, because `workflow_executions` has no
 * user on it. What is left is what happened: what ran, what it read, what it
 * found, and what came out.
 *
 * The page reads and never writes.
 */

import {
  ACTORS, ADMIN_EVENTS, ANCHOR, ATR_SNAPSHOTS, CASES, DAY_MS, DB_CONNECTIONS, DB_QUERIES,
  EXECUTIONS, HISTORY_START, POPULATION_BY_ID, POPULATIONS, RACM_IMPORTS, REPORTS, SAMPLES,
  SAMPLE_RUNS, SEATS, TEAMS, WORKFLOWS, WORKFLOW_BY_ID,
  type Actor, type AdminEvent, type AtrSnapshot, type CaseSeverity, type DbQuery,
  type ExceptionCase, type Population, type RacmImport, type ReportRecord, type Sample,
  type SampleRun, type Seat, type WorkflowExecution,
} from './seed';

/* ──────────────────────────────────────────────────────────────────────────
 * Formatting
 * ────────────────────────────────────────────────────────────────────────── */

const INT = new Intl.NumberFormat('en-IN');
const ONE_DP = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const DATE_FMT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const MONTH_FMT = new Intl.DateTimeFormat('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' });

export const fmtInt = (n: number): string => INT.format(Math.round(n));
export const fmtOneDp = (n: number): string => ONE_DP.format(n);
export const fmtPct = (n: number): string => `${Math.round(n)}%`;
export const formatDate = (ms: number): string => DATE_FMT.format(new Date(ms));
export const formatMonth = (ms: number): string => MONTH_FMT.format(new Date(ms));

/** A count and its noun, agreeing, so no line ever says "1 rows". */
export const plural = (n: number, one: string, many: string): string =>
  `${fmtInt(n)} ${n === 1 ? one : many}`;

/** Bytes at the scale a reader holds in their head. */
export function fmtBytes(bytes: number): string {
  if (bytes >= 1_000_000_000_000) return `${fmtOneDp(bytes / 1_000_000_000_000)} TB`;
  if (bytes >= 1_000_000_000) return `${fmtOneDp(bytes / 1_000_000_000)} GB`;
  if (bytes >= 1_000_000) return `${fmtOneDp(bytes / 1_000_000)} MB`;
  if (bytes >= 1_000) return `${fmtInt(bytes / 1_000)} KB`;
  return `${fmtInt(bytes)} bytes`;
}

/** A span, in the largest unit that keeps it readable. */
export function fmtSeconds(seconds: number): string {
  if (seconds >= 3_600) return `${fmtOneDp(seconds / 3_600)} hours`;
  if (seconds >= 60) return `${fmtInt(seconds / 60)} ${Math.round(seconds / 60) === 1 ? 'minute' : 'minutes'}`;
  if (seconds >= 1) return `${fmtOneDp(seconds)} seconds`;
  return `${fmtInt(seconds * 1000)} ms`;
}

/** A query latency, which is read in milliseconds until it stops being one. */
export const fmtLatency = (ms: number): string =>
  (ms >= 1_000 ? `${fmtOneDp(ms / 1_000)} s` : `${fmtInt(ms)} ms`);

/** The date everything is counted to, said once so no surface can disagree. */
export const dataAsOfLabel = (): string => `Counted to ${formatDate(ANCHOR)}`;

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
  cfo: 'What has this workspace done',
  head_of_team: 'What has my team done',
  auditor: 'What have I done',
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
 * `ad_usage` is the whole company; `ad_usage_people` without it is that
 * person's own team; everybody else gets themselves. There is no null case:
 * every signed-in person can read their own work with no request and no
 * approval.
 */
export function personaFor(
  holds: { usage: boolean; people: boolean },
  team: string | null,
): Persona {
  if (holds.usage) return 'cfo';
  if (holds.people && team) return 'head_of_team';
  return 'auditor';
}

/**
 * Which views the switch may offer.
 *
 * A lens, not a key. It only narrows down the reader's own line, and a view
 * the reader is not entitled to is never offered.
 */
export function entitledViews(ceiling: Persona, team: string | null): Persona[] {
  if (ceiling === 'cfo') return team ? ['cfo', 'head_of_team', 'auditor'] : ['cfo', 'auditor'];
  if (ceiling === 'head_of_team') return ['head_of_team', 'auditor'];
  return ['auditor'];
}

/** What somebody reaching a view above their entitlement by a stale link is told. */
export const REFUSAL =
  'That view is above what your role may read. Every signed-in person can read their own work here; '
  + 'ask an administrator if you need the team or company view.';

/** Whether a record with a person on it belongs to the reader's scope. */
function mine(scope: Scope, actor: Actor): boolean {
  if (scope.persona === 'cfo') return true;
  if (scope.persona === 'head_of_team') return actor.team === scope.team;
  return actor.email === scope.userEmail;
}

/** Whether a record that carries a team but no person belongs to the scope. */
function mineByTeam(scope: Scope, team: string): boolean {
  if (scope.persona === 'cfo') return true;
  if (scope.persona === 'head_of_team') return team === scope.team;
  return false;
}

/* ──────────────────────────────────────────────────────────────────────────
 * The window
 * ────────────────────────────────────────────────────────────────────────── */

export type PeriodId = 'this-month' | 'this-quarter' | 'fy-to-date' | 'this-year' | 'since-start';

export interface Period {
  id: PeriodId;
  label: string;
  /** Said inside a sentence: "this quarter", "in the year to date". */
  phrase: string;
  from: number;
  to: number;
  days: number;
  months: number;
}

/** The windows, anchored on a financial year that starts in April. */
export function period(id: PeriodId): Period {
  const to = ANCHOR;
  const make = (from: number, label: string, phrase: string, months: number): Period => ({
    id, label, phrase, from, to, days: Math.round((to - from) / DAY_MS), months,
  });
  switch (id) {
    case 'this-month': return make(Date.UTC(2026, 2, 1), 'This month', 'this month', 1);
    case 'this-quarter': return make(Date.UTC(2026, 0, 1), 'This quarter', 'this quarter', 3);
    case 'fy-to-date': return make(Date.UTC(2025, 3, 1), 'Financial year to date', 'in the year to date', 12);
    case 'this-year': return make(Date.UTC(2025, 2, 31), 'Last twelve months', 'over the last twelve months', 12);
    default: return make(HISTORY_START, 'Since the start', 'since we started', 24);
  }
}

export const periodOptions: { id: PeriodId; label: string }[] = [
  { id: 'this-month', label: 'This month' },
  { id: 'this-quarter', label: 'This quarter' },
  { id: 'fy-to-date', label: 'Financial year to date' },
  { id: 'this-year', label: 'Last twelve months' },
  { id: 'since-start', label: 'Since the start' },
];

const inWindow = (at: number, p: Period): boolean => at >= p.from && at <= p.to;

const median = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

/* ──────────────────────────────────────────────────────────────────────────
 * What ran
 * ────────────────────────────────────────────────────────────────────────── */

export interface WorkflowLine {
  workflowId: string;
  name: string;
  team: string;
  runs: number;
  failed: number;
  machineSeconds: number;
  lastRunAt: number | null;
}

export interface RunFigures {
  /** True where the scope can be applied to these records at all. */
  attributable: boolean;
  complete: number;
  failed: number;
  blocked: number;
  total: number;
  /** Summed `duration_secs` over completed runs. */
  machineSeconds: number;
  /** Summed `duration_secs` over runs that failed or were blocked. */
  wastedSeconds: number;
  medianSeconds: number;
  /**
   * Rows the completed runs returned, derived from each run's output tables.
   * This is what the checks produced, not what they read: nothing records how
   * much of a table a query touched.
   */
  outputRows: number;
  /** Completed runs whose output carried no tables, so no row count exists. */
  rowsUnknown: number;
  workflows: WorkflowLine[];
  byMonth: { at: number; runs: number; failed: number }[];
}

function runsOf(p: Period, scope: Scope): RunFigures {
  // A workflow execution carries no user. It reaches a team only through the
  // workflow it belongs to, so a person's own view cannot claim any of it.
  const attributable = scope.persona !== 'auditor';
  const inside = attributable
    ? EXECUTIONS.filter(e => inWindow(e.startedAt, p)
      && mineByTeam(scope, WORKFLOW_BY_ID.get(e.workflowId)?.team ?? ''))
    : [];

  const complete = inside.filter(e => e.status === 'complete');
  const failed = inside.filter(e => e.status === 'failed');
  const blocked = inside.filter(e => e.status === 'blocked');
  const secs = (rows: WorkflowExecution[]): number => rows.reduce((s, e) => s + (e.durationSecs ?? 0), 0);

  const workflows: WorkflowLine[] = WORKFLOWS
    .map(w => {
      const own = inside.filter(e => e.workflowId === w.id);
      return {
        workflowId: w.id,
        name: w.name,
        team: w.team,
        runs: own.length,
        failed: own.filter(e => e.status !== 'complete').length,
        machineSeconds: secs(own.filter(e => e.status === 'complete')),
        lastRunAt: own.length === 0 ? null : Math.max(...own.map(e => e.startedAt)),
      };
    })
    .filter(line => line.runs > 0)
    .sort((a, b) => b.runs - a.runs);

  const months = new Map<number, { runs: number; failed: number }>();
  inside.forEach(e => {
    const d = new Date(e.startedAt);
    const key = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
    const row = months.get(key) ?? { runs: 0, failed: 0 };
    row.runs += 1;
    if (e.status !== 'complete') row.failed += 1;
    months.set(key, row);
  });

  return {
    attributable,
    complete: complete.length,
    failed: failed.length,
    blocked: blocked.length,
    total: inside.length,
    machineSeconds: secs(complete),
    wastedSeconds: secs([...failed, ...blocked]),
    medianSeconds: median(complete.map(e => e.durationSecs ?? 0)),
    outputRows: complete.reduce((s, e) => s + (e.outputRows ?? 0), 0),
    rowsUnknown: complete.filter(e => e.outputRows === null).length,
    workflows,
    byMonth: [...months.entries()].map(([at, row]) => ({ at, ...row })).sort((a, b) => a.at - b.at),
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * What was tested
 * ────────────────────────────────────────────────────────────────────────── */

export interface TestedFigures {
  populations: Population[];
  populationRows: number;
  populationBytes: number;
  samples: Sample[];
  sampleRows: number;
  sampleRuns: SampleRun[];
  samplePassed: number;
  sampleFailed: number;
  evidenceBytes: number;
}

function testedOf(p: Period, scope: Scope): TestedFigures {
  const populations = POPULATIONS.filter(pop => inWindow(pop.createdAt, p)
    && (scope.persona === 'head_of_team' ? pop.team === scope.team : mine(scope, pop.uploadedBy)));
  const samples = SAMPLES.filter(s => inWindow(s.createdAt, p)
    && (scope.persona === 'head_of_team'
      ? POPULATION_BY_ID.get(s.populationId)?.team === scope.team
      : mine(scope, s.createdBy)));
  const sampleRuns = SAMPLE_RUNS.filter(r => inWindow(r.ranAt, p) && mine(scope, r.actor));

  return {
    populations,
    populationRows: populations.reduce((s, pop) => s + pop.rowCount, 0),
    populationBytes: populations.reduce((s, pop) => s + pop.sizeBytes, 0),
    samples,
    sampleRows: samples.reduce((s, x) => s + x.rowCount, 0),
    sampleRuns,
    samplePassed: sampleRuns.filter(r => r.status === 'passed').length,
    sampleFailed: sampleRuns.filter(r => r.status === 'failed' || r.status === 'error').length,
    evidenceBytes: sampleRuns.reduce((s, r) => s + r.evidenceSizeBytes, 0),
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * What was found
 * ────────────────────────────────────────────────────────────────────────── */

export interface FoundFigures {
  cases: ExceptionCase[];
  total: number;
  high: number;
  medium: number;
  low: number;
  open: number;
  closed: number;
  /** Open past the date somebody set on them. */
  overdue: number;
  /** The share closed, which is the health figure the product already computes. */
  closedPct: number;
  byWorkflow: { name: string; total: number; high: number; open: number }[];
}

const CLOSED: string[] = ['done', 'resolved'];

function foundOf(p: Period, scope: Scope): FoundFigures {
  const cases = CASES.filter(c => inWindow(c.flaggedAt, p)
    && (scope.persona === 'head_of_team'
      ? WORKFLOW_BY_ID.get(c.workflowId)?.team === scope.team
      : mine(scope, c.flaggedBy)));

  const bySeverity = (s: CaseSeverity): number => cases.filter(c => c.severity === s).length;
  const closed = cases.filter(c => CLOSED.includes(c.status)).length;
  const open = cases.length - closed;

  const byWorkflow = WORKFLOWS
    .map(w => {
      const own = cases.filter(c => c.workflowId === w.id);
      return {
        name: w.name,
        total: own.length,
        high: own.filter(c => c.severity === 'high').length,
        open: own.filter(c => !CLOSED.includes(c.status)).length,
      };
    })
    .filter(l => l.total > 0)
    .sort((a, b) => b.total - a.total);

  return {
    cases,
    total: cases.length,
    high: bySeverity('high'),
    medium: bySeverity('medium'),
    low: bySeverity('low'),
    open,
    closed,
    overdue: cases.filter(c => !CLOSED.includes(c.status) && c.dueDate !== null && c.dueDate < ANCHOR).length,
    closedPct: cases.length === 0 ? 0 : (closed / cases.length) * 100,
    byWorkflow,
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * What came out
 * ────────────────────────────────────────────────────────────────────────── */

export interface ProducedFigures {
  reports: ReportRecord[];
  finalReports: number;
  snapshots: AtrSnapshot[];
  pages: number;
  documentBytes: number;
  byPerson: { name: string; documents: number; pages: number }[];
}

function producedOf(p: Period, scope: Scope): ProducedFigures {
  const reports = REPORTS.filter(r => inWindow(r.createdAt, p)
    && (scope.persona === 'head_of_team' ? r.team === scope.team : mine(scope, r.owner)));
  const snapshots = ATR_SNAPSHOTS.filter(s => inWindow(s.createdAt, p) && mine(scope, s.generatedBy));

  const people = new Map<string, { documents: number; pages: number }>();
  snapshots.forEach(s => {
    const row = people.get(s.generatedBy.name) ?? { documents: 0, pages: 0 };
    row.documents += 1;
    row.pages += s.pageCount;
    people.set(s.generatedBy.name, row);
  });

  return {
    reports,
    finalReports: reports.filter(r => r.status === 'final').length,
    snapshots,
    pages: snapshots.reduce((s, x) => s + x.pageCount, 0),
    documentBytes: snapshots.reduce((s, x) => s + x.sizeBytes, 0),
    byPerson: [...people.entries()]
      .map(([name, row]) => ({ name, ...row }))
      .sort((a, b) => b.documents - a.documents),
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * Queries against a customer's own database
 * ────────────────────────────────────────────────────────────────────────── */

export interface ConnectionLine {
  name: string;
  engine: string;
  queries: number;
  rows: number;
  medianLatencyMs: number;
  /** Null on every engine that does not report it. Never a nought. */
  bytesScanned: number | null;
  failures: number;
}

export interface QueryFigures {
  queries: DbQuery[];
  total: number;
  failures: number;
  rows: number;
  medianLatencyMs: number;
  slowestMs: number;
  /** Summed only over the engines that report it. Null where none in scope do. */
  bytesScanned: number | null;
  /** Connections in scope whose engine reports no bytes figure at all. */
  enginesWithoutBytes: string[];
  lines: ConnectionLine[];
}

function queriesOf(p: Period, scope: Scope): QueryFigures {
  const queries = DB_QUERIES.filter(q => inWindow(q.at, p) && mine(scope, q.actor));
  const withBytes = queries.filter(q => q.bytesScanned !== null);

  const lines: ConnectionLine[] = DB_CONNECTIONS
    .map(c => {
      const own = queries.filter(q => q.connectionId === c.id);
      const bytes = own.filter(q => q.bytesScanned !== null);
      return {
        name: c.name,
        engine: c.engine,
        queries: own.length,
        rows: own.reduce((s, q) => s + q.rowCount, 0),
        medianLatencyMs: median(own.map(q => q.latencyMs)),
        bytesScanned: bytes.length === 0 ? null : bytes.reduce((s, q) => s + (q.bytesScanned as number), 0),
        failures: own.filter(q => q.errorCode !== null).length,
      };
    })
    .filter(l => l.queries > 0)
    .sort((a, b) => b.queries - a.queries);

  return {
    queries,
    total: queries.length,
    failures: queries.filter(q => q.errorCode !== null).length,
    rows: queries.reduce((s, q) => s + q.rowCount, 0),
    medianLatencyMs: median(queries.map(q => q.latencyMs)),
    slowestMs: queries.length === 0 ? 0 : Math.max(...queries.map(q => q.latencyMs)),
    bytesScanned: withBytes.length === 0 ? null : withBytes.reduce((s, q) => s + (q.bytesScanned as number), 0),
    enginesWithoutBytes: [...new Set(lines.filter(l => l.bytesScanned === null).map(l => l.engine))].sort(),
    lines,
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * Imports
 * ────────────────────────────────────────────────────────────────────────── */

export interface ImportFigures {
  imports: RacmImport[];
  rowsTotal: number;
  rowsProcessed: number;
  risks: number;
  controls: number;
  failed: number;
}

function importsOf(p: Period, scope: Scope): ImportFigures {
  const imports = RACM_IMPORTS.filter(i => inWindow(i.createdAt, p)
    && (scope.persona === 'head_of_team' ? i.team === scope.team : mine(scope, i.createdBy)));
  return {
    imports,
    rowsTotal: imports.reduce((s, i) => s + i.rowsTotal, 0),
    rowsProcessed: imports.reduce((s, i) => s + i.rowsProcessed, 0),
    risks: imports.reduce((s, i) => s + i.risksCreated, 0),
    controls: imports.reduce((s, i) => s + i.controlsCreated, 0),
    failed: imports.filter(i => i.status === 'failed').length,
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * Who is on the workspace
 * ────────────────────────────────────────────────────────────────────────── */

export interface WorkspaceFigures {
  seats: Seat[];
  active: number;
  suspended: number;
  teams: { team: string; seats: number }[];
  events: AdminEvent[];
  /** The most recent sign in on each seat. There is no history behind it. */
  lastLogins: { name: string; team: string; at: number | null }[];
}

function workspaceOf(p: Period, scope: Scope): WorkspaceFigures {
  const seats = SEATS.filter(s => scope.persona === 'cfo'
    ? true
    : scope.persona === 'head_of_team'
      ? s.actor.team === scope.team
      : s.actor.email === scope.userEmail);

  const teams = TEAMS
    .map(team => ({ team, seats: seats.filter(s => s.actor.team === team).length }))
    .filter(t => t.seats > 0);

  return {
    seats,
    active: seats.filter(s => s.status === 'active').length,
    suspended: seats.filter(s => s.status === 'suspended').length,
    teams,
    events: ADMIN_EVENTS.filter(e => inWindow(e.occurredAt, p) && mine(scope, e.actor)),
    lastLogins: seats
      .map(s => ({ name: s.actor.name, team: s.actor.team, at: s.lastLoginAt }))
      .sort((a, b) => (b.at ?? 0) - (a.at ?? 0)),
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * What this page cannot say
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * The gaps, named.
 *
 * A page that quietly leaves out what it cannot measure reads as a complete
 * picture, and a reader then draws a conclusion the data does not carry. So
 * the gaps are a section rather than a footnote, and each one says which
 * column is missing.
 */
export const GAPS: { question: string; why: string }[] = [
  {
    question: 'Who ran a check',
    why: 'A workflow execution records no user. The column exists and nothing writes it, so a run can be put against a team through its workflow but never against a person.',
  },
  {
    question: 'How many rows a check read',
    why: 'Only the rows a run returned are recorded, derived from its output tables. Nothing records how much of a table a query touched, so coverage cannot be claimed.',
  },
  {
    question: 'What the AI cost, in tokens or in money',
    why: 'No table records a model, a token count or a price. The figures the providers return are read and discarded, so there is nothing to total.',
  },
  {
    question: 'How often people sign in, or who is active',
    why: 'There is no sign-in event and no last-active column. A single last-login timestamp is overwritten on each sign in, so there is no history behind it and no active-user count above it.',
  },
  {
    question: 'Which screens or features people use',
    why: 'Nothing records a page view or a feature use. The activity log covers only user, team, role and invitation changes.',
  },
  {
    question: 'How much data the workspace holds in total',
    why: 'Sizes are recorded on five separate tables and never summed anywhere, so a storage total would be assembled here rather than read.',
  },
];

/* ──────────────────────────────────────────────────────────────────────────
 * The snapshot
 * ────────────────────────────────────────────────────────────────────────── */

export interface Snapshot {
  scope: Scope;
  period: Period;
  runs: RunFigures;
  tested: TestedFigures;
  found: FoundFigures;
  produced: ProducedFigures;
  queries: QueryFigures;
  imports: ImportFigures;
  workspace: WorkspaceFigures;
}

export function snapshot(scope: Scope, p: Period): Snapshot {
  return {
    scope,
    period: p,
    runs: runsOf(p, scope),
    tested: testedOf(p, scope),
    found: foundOf(p, scope),
    produced: producedOf(p, scope),
    queries: queriesOf(p, scope),
    imports: importsOf(p, scope),
    workspace: workspaceOf(p, scope),
  };
}

export { ACTORS, TEAMS };
