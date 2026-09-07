/**
 * The records this page reads, shaped the way the platform actually stores them.
 *
 * Every interface below is a table that exists today, and every field is a
 * column that exists on it. Where the real table has no column for something,
 * this file has no field for it either, so a figure the page cannot honestly
 * produce cannot be produced here by accident.
 *
 * The tables, and where they live in the backend:
 *
 * · `workflows`                     app/models/workflow.py
 * · `workflow_executions`           app/models/workflow_execution.py
 * · `engagement_populations`        app/models/engagement_population.py
 * · `engagement_samples`            app/models/engagement_sample.py
 * · `engagement_sample_runs`        app/models/engagement_sample_run.py
 * · `report_card_cases_staging`     app/models/report_card_cases_staging.py
 * · `reports`                       app/models/report.py
 * · `report_atr_snapshots`          app/models/report_atr_snapshot.py
 * · `db_connections`                app/models/db_connection.py
 * · `db_connection_audit`           app/models/db_connection_audit.py
 * · `racm_imports`                  app/models/racm_import.py
 * · `activity_logs`                 app/models/activity_log.py
 * · `accounts` / `tenant_memberships`
 *
 * Two absences are deliberate and are the reason the page reads the way it
 * does. A workflow execution carries no user: the column exists and nothing
 * ever writes it, so a check that ran cannot be put against a name. And no
 * table anywhere records a token, a model or a cost, so this file has no field
 * for one and the page never prints one.
 *
 * The values are a deterministic fixture, drawn from a seeded generator so a
 * figure quoted in one place can be checked against another and a reload never
 * moves it. The shape is real; the volume is a demo workspace.
 */

/* ──────────────────────────────────────────────────────────────────────────
 * Time
 * ────────────────────────────────────────────────────────────────────────── */

export const MINUTE_MS = 60_000;
export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;

/**
 * The day everything is counted to.
 *
 * A quarter end, deliberately, so "this quarter against last" compares like
 * with like rather than a part quarter against a whole one.
 */
export const ANCHOR = Date.UTC(2026, 2, 31, 18, 0, 0);

/** Where the seeded history starts: two whole financial years back. */
export const HISTORY_START = Date.UTC(2024, 3, 1, 0, 0, 0);

/** A small deterministic generator, so a reload never moves a figure. */
export function prng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1_664_525 + 1_013_904_223) >>> 0;
    return s / 4_294_967_296;
  };
}

const pick = <T>(rand: () => number, rows: readonly T[]): T => rows[Math.floor(rand() * rows.length)];
const isWeekday = (t: number): boolean => {
  const d = new Date(t).getUTCDay();
  return d !== 0 && d !== 6;
};

/* ──────────────────────────────────────────────────────────────────────────
 * People
 * ────────────────────────────────────────────────────────────────────────── */

export interface Actor {
  name: string;
  email: string;
  team: string;
}

/**
 * The people on the workspace.
 *
 * The same names, emails and teams the Administration roster carries, so a
 * person counted here and a person listed there are the same person.
 *
 * **Every persona anybody can sign in as is in this list**, and that is a
 * requirement rather than a coincidence. The own-work view scopes on the
 * signed-in email, so a persona missing from here would open the page on an
 * empty one.
 *
 * Priya Singh signs in as `priya.singh@irame.ai` and appears on the roster as
 * `priya@irame.ai`. Her sign-in address is the one used here, because that is
 * what the page scopes on.
 */
export const ACTORS: Actor[] = [
  { name: 'Abhinav Sharma', email: 'abhinav@irame.ai',       team: 'SOX Audit' },
  { name: 'Aditya Thakur',  email: 'aditya.thakur@irame.ai', team: 'SOX Audit' },
  { name: 'Ayushi Narang',  email: 'ayushi.narang@irame.ai', team: 'SOX Audit' },
  { name: 'Tushar Goel',    email: 'tushar.goel@irame.ai',   team: 'SOX Audit' },
  { name: 'Priya Singh',    email: 'priya.singh@irame.ai',   team: 'SOX Audit' },
  { name: 'Meera Nair',     email: 'meera.nair@irame.ai',    team: 'IFC Team' },
  { name: 'Vijay Reddy',    email: 'vijay.reddy@irame.ai',   team: 'IFC Team' },
  { name: 'Rohan Desai',    email: 'rohan.desai@irame.ai',   team: 'Engineering' },
  { name: 'Sana Kapoor',    email: 'sana.kapoor@irame.ai',   team: 'Engineering' },
  { name: 'Ajay Mudhai',    email: 'ajaym@irame.ai',         team: 'Management' },
  { name: 'Karan Mehta',    email: 'karan.mehta@irame.ai',   team: 'Management' },
  { name: 'Nilesh Anand',   email: 'nilesh.anand@irame.ai',  team: 'Management' },
];

export const TEAMS: string[] = [...new Set(ACTORS.map(a => a.team))].sort();

const BY_EMAIL = new Map(ACTORS.map(a => [a.email, a]));
export const actorByEmail = (email: string): Actor | undefined => BY_EMAIL.get(email);

/**
 * Who does audit work.
 *
 * The two audit teams and the managers over them. Engineering is deliberately
 * out: they use the platform, and giving them audit work would put it on a
 * team that never did any.
 */
const WORKERS = ACTORS.filter(a => a.team !== 'Engineering');
const OWNERS = WORKERS;

/**
 * `accounts.last_login_at` and `tenant_memberships`.
 *
 * The login timestamp is a single column that is overwritten on every sign in,
 * so it is the last one and there is no history behind it. Nothing here counts
 * logins, because nothing records them.
 */
export interface Seat {
  actor: Actor;
  status: 'active' | 'suspended' | 'invited';
  /** `accounts.last_login_at`. Null for a seat that has never signed in. */
  lastLoginAt: number | null;
  /** `tenant_memberships.joined_at`. */
  joinedAt: number;
}

function buildSeats(): Seat[] {
  const rand = prng(31032026);
  return ACTORS.map((actor, i) => {
    const joinedAt = HISTORY_START + Math.floor(rand() * 500) * DAY_MS;
    const suspended = actor.email === 'sana.kapoor@irame.ai';
    return {
      actor,
      status: suspended ? 'suspended' : 'active',
      lastLoginAt: suspended ? ANCHOR - 96 * DAY_MS : ANCHOR - Math.floor(rand() * (i === 0 ? 1 : 14)) * DAY_MS,
      joinedAt,
    };
  });
}

export const SEATS: Seat[] = buildSeats();

/* ──────────────────────────────────────────────────────────────────────────
 * Workflows and their executions
 * ────────────────────────────────────────────────────────────────────────── */

/** `workflows`. Carries `team_id` and `creator_id`, so a run has a team through it. */
export interface Workflow {
  id: string;
  name: string;
  team: string;
  createdBy: Actor;
}

export const WORKFLOWS: Workflow[] = [
  { id: 'wf-je-anomaly',   name: 'Journal entry anomalies',      team: 'SOX Audit', createdBy: ACTORS[0] },
  { id: 'wf-payment-flag', name: 'High value payment flagging',  team: 'SOX Audit', createdBy: ACTORS[1] },
  { id: 'wf-three-way',    name: 'Three way purchase order match', team: 'SOX Audit', createdBy: ACTORS[2] },
  { id: 'wf-po-approval',  name: 'Purchase order approval limits', team: 'SOX Audit', createdBy: ACTORS[3] },
  { id: 'wf-grn-match',    name: 'Goods receipt match',          team: 'IFC Team',  createdBy: ACTORS[5] },
  { id: 'wf-vendor-watch', name: 'Vendor master changes',        team: 'IFC Team',  createdBy: ACTORS[6] },
  { id: 'wf-payroll-dup',  name: 'Duplicate payroll payments',   team: 'IFC Team',  createdBy: ACTORS[5] },
  { id: 'wf-dormant',      name: 'Dormant account review',       team: 'SOX Audit', createdBy: ACTORS[4] },
  { id: 'wf-sod',          name: 'Segregation of duties',        team: 'SOX Audit', createdBy: ACTORS[0] },
  { id: 'wf-credit',       name: 'Credit note authorisation',    team: 'IFC Team',  createdBy: ACTORS[6] },
  { id: 'wf-contract',     name: 'Contract expiry',              team: 'IFC Team',  createdBy: ACTORS[5] },
];

export const WORKFLOW_BY_ID = new Map(WORKFLOWS.map(w => [w.id, w]));

/**
 * `workflow_executions`.
 *
 * **There is no user on this record**, and that is the real schema rather than
 * an omission here. `triggered_by_user_id` exists on the table and no writer
 * ever sets it, so a run cannot be attributed to a person and this page never
 * pretends otherwise.
 *
 * `outputRows` stands for the row count the runs API derives at read time from
 * the `audit_output` JSONB rather than from a column. It is null wherever the
 * run produced no tables, which is every run that failed before it got there.
 */
export interface WorkflowExecution {
  id: string;
  workflowId: string;
  engagementId: string | null;
  status: 'complete' | 'failed' | 'blocked' | 'running';
  startedAt: number;
  /** Null while a run is still going. */
  completedAt: number | null;
  /** `duration_secs`, a float. The only duration the product records anywhere. */
  durationSecs: number | null;
  /** Derived from `audit_output` at read time. Null where the run made no tables. */
  outputRows: number | null;
  executionError: string | null;
}

const ENGAGEMENTS = ['eng-fy26-sox', 'eng-fy26-ifc', 'eng-fy26-p2p', null];

const EXECUTION_ERRORS = [
  'the source table was locked by another job',
  'the connection to the finance warehouse timed out',
  'a column the query reads was renamed at source',
  'the file the run expected had not landed yet',
];

function buildExecutions(): WorkflowExecution[] {
  const rand = prng(20260331);
  const out: WorkflowExecution[] = [];
  let n = 0;

  const emit = (startedAt: number) => {
    n += 1;
    const workflow = pick(rand, WORKFLOWS);
    const roll = rand();
    const status: WorkflowExecution['status'] =
      roll < 0.955 ? 'complete' : roll < 0.99 ? 'failed' : 'blocked';
    // Drawn from what a query over a few hundred thousand rows takes, which is
    // seconds to a few minutes rather than the hours a person would take.
    const durationSecs = Math.round((6 + rand() * 240) * 10) / 10;
    return out.push({
      id: `wfe-${n}`,
      workflowId: workflow.id,
      engagementId: pick(rand, ENGAGEMENTS),
      status,
      startedAt,
      completedAt: startedAt + Math.round(durationSecs * 1000),
      durationSecs,
      // A complete run returns the exceptions it found and the rows behind
      // them, which is tens to thousands, not the whole table it read. A run
      // that failed produced no tables, so there is nothing to derive from.
      outputRows: status === 'complete' ? Math.round(40 + rand() * 3_600) : null,
      executionError: status === 'complete' ? null : pick(rand, EXECUTION_ERRORS),
    });
  };

  for (let t = HISTORY_START; t < Date.UTC(2026, 0, 1); t += DAY_MS) {
    if (!isWeekday(t)) continue;
    const runs = rand() < 0.55 ? 1 + Math.floor(rand() * 3) : 0;
    for (let i = 0; i < runs; i += 1) emit(t + (9 + Math.floor(rand() * 9)) * HOUR_MS);
  }

  const quarterStart = Date.UTC(2026, 0, 1);
  const quarterDays = Math.round((Date.UTC(2026, 2, 31) - quarterStart) / DAY_MS);
  for (let i = 0; i < 352; i += 1) {
    const day = Math.floor((i / 356) * quarterDays);
    emit(quarterStart + day * DAY_MS + (9 + Math.floor(rand() * 9)) * HOUR_MS);
  }

  return out.sort((a, b) => a.startedAt - b.startedAt);
}

export const EXECUTIONS: WorkflowExecution[] = buildExecutions();

/* ──────────────────────────────────────────────────────────────────────────
 * What was tested
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * `engagement_populations`.
 *
 * The rows live in DuckDB on object storage and Postgres holds this metadata,
 * so `row_count` and `size_bytes` are the two figures the platform can state
 * about a population without opening it.
 */
export interface Population {
  id: string;
  name: string;
  engagementId: string;
  sourceType: 'upload' | 'db_connection';
  rowCount: number;
  sizeBytes: number;
  uploadedBy: Actor;
  team: string;
  createdAt: number;
}

const POPULATION_SPECS: { id: string; name: string; rows: number; engagement: string; team: string; source: 'upload' | 'db_connection'; email: string; daysAgo: number }[] = [
  { id: 'pop-je',        name: 'Journal entries FY26 Q4',        rows: 620_000, engagement: 'eng-fy26-sox', team: 'SOX Audit', source: 'db_connection', email: 'abhinav@irame.ai',       daysAgo: 84 },
  { id: 'pop-payments',  name: 'Vendor payments FY26 Q4',        rows: 310_000, engagement: 'eng-fy26-p2p', team: 'SOX Audit', source: 'db_connection', email: 'aditya.thakur@irame.ai', daysAgo: 80 },
  { id: 'pop-invoices',  name: 'Supplier invoices FY26 Q4',      rows: 214_000, engagement: 'eng-fy26-p2p', team: 'SOX Audit', source: 'upload',        email: 'ayushi.narang@irame.ai', daysAgo: 76 },
  { id: 'pop-po',        name: 'Purchase orders FY26 Q4',        rows:  96_000, engagement: 'eng-fy26-p2p', team: 'SOX Audit', source: 'upload',        email: 'tushar.goel@irame.ai',   daysAgo: 71 },
  { id: 'pop-receipts',  name: 'Goods receipts FY26 Q4',         rows:  74_000, engagement: 'eng-fy26-ifc', team: 'IFC Team',  source: 'upload',        email: 'meera.nair@irame.ai',    daysAgo: 66 },
  { id: 'pop-vendors',   name: 'Vendor master, full extract',    rows:  38_000, engagement: 'eng-fy26-ifc', team: 'IFC Team',  source: 'db_connection', email: 'vijay.reddy@irame.ai',   daysAgo: 62 },
  { id: 'pop-payroll',   name: 'Payroll register FY26 Q4',       rows:  31_000, engagement: 'eng-fy26-ifc', team: 'IFC Team',  source: 'upload',        email: 'meera.nair@irame.ai',    daysAgo: 55 },
  { id: 'pop-users',     name: 'Application user accounts',      rows:  19_000, engagement: 'eng-fy26-sox', team: 'SOX Audit', source: 'db_connection', email: 'priya.singh@irame.ai',   daysAgo: 48 },
  { id: 'pop-access',    name: 'Privileged access grants',       rows:  11_000, engagement: 'eng-fy26-sox', team: 'SOX Audit', source: 'upload',        email: 'priya.singh@irame.ai',   daysAgo: 41 },
  { id: 'pop-credits',   name: 'Credit notes FY26 Q4',           rows:   9_500, engagement: 'eng-fy26-ifc', team: 'IFC Team',  source: 'upload',        email: 'vijay.reddy@irame.ai',   daysAgo: 33 },
  { id: 'pop-contracts', name: 'Customer contracts, live',       rows:   5_500, engagement: 'eng-fy26-ifc', team: 'IFC Team',  source: 'upload',        email: 'meera.nair@irame.ai',    daysAgo: 22 },
];

export const POPULATIONS: Population[] = POPULATION_SPECS.map(s => ({
  id: s.id,
  name: s.name,
  engagementId: s.engagement,
  sourceType: s.source,
  rowCount: s.rows,
  // Parquet on object storage, so a row is tens of bytes rather than hundreds.
  sizeBytes: Math.round(s.rows * 78),
  uploadedBy: actorByEmail(s.email) as Actor,
  team: s.team,
  createdAt: ANCHOR - s.daysAgo * DAY_MS,
}));

export const POPULATION_BY_ID = new Map(POPULATIONS.map(p => [p.id, p]));

/** `engagement_samples`. A sample drawn out of a population, with its own row count. */
export interface Sample {
  id: string;
  populationId: string;
  controlId: string;
  rowCount: number;
  sizeBytes: number;
  createdBy: Actor;
  createdAt: number;
}

/**
 * `engagement_sample_runs`.
 *
 * This one DOES carry a user: `actor_user_external_id` is written on every
 * row. It carries no duration, though, so a sample run can be counted and
 * attributed but never timed.
 */
export interface SampleRun {
  id: string;
  sampleId: string;
  controlId: string;
  status: 'passed' | 'failed' | 'error' | 'queued' | 'running';
  actor: Actor;
  ranAt: number;
  evidenceSizeBytes: number;
}

function buildSamplesAndRuns(): { samples: Sample[]; runs: SampleRun[] } {
  const rand = prng(770118);
  const samples: Sample[] = [];
  const runs: SampleRun[] = [];
  let n = 0;

  POPULATIONS.forEach(pop => {
    const drawn = 2 + Math.floor(rand() * 3);
    for (let i = 0; i < drawn; i += 1) {
      n += 1;
      const rows = 25 + Math.floor(rand() * 60);
      const createdAt = pop.createdAt + Math.floor(rand() * 20) * DAY_MS;
      const sample: Sample = {
        id: `smp-${n}`,
        populationId: pop.id,
        controlId: `ctl-${pop.id}-${i + 1}`,
        rowCount: rows,
        sizeBytes: rows * 4_200,
        createdBy: pop.uploadedBy,
        createdAt,
      };
      samples.push(sample);

      const attempts = 1 + Math.floor(rand() * 3);
      for (let k = 0; k < attempts; k += 1) {
        const roll = rand();
        runs.push({
          id: `smr-${n}-${k}`,
          sampleId: sample.id,
          controlId: sample.controlId,
          status: roll < 0.82 ? 'passed' : roll < 0.94 ? 'failed' : roll < 0.98 ? 'error' : 'queued',
          actor: pick(rand, WORKERS),
          ranAt: Math.min(ANCHOR, createdAt + (k + 1) * 2 * DAY_MS),
          evidenceSizeBytes: Math.round(120_000 + rand() * 2_400_000),
        });
      }
    }
  });

  return {
    samples: samples.sort((a, b) => a.createdAt - b.createdAt),
    runs: runs.sort((a, b) => a.ranAt - b.ranAt),
  };
}

const drawn = buildSamplesAndRuns();
export const SAMPLES: Sample[] = drawn.samples;
export const SAMPLE_RUNS: SampleRun[] = drawn.runs;

/* ──────────────────────────────────────────────────────────────────────────
 * What was found
 * ────────────────────────────────────────────────────────────────────────── */

export type CaseStatus = 'review_pending' | 'in_review' | 'done' | 'resolved';
export type CaseSeverity = 'high' | 'medium' | 'low';

/**
 * `report_card_cases_staging`. One row is one exception a check threw up.
 *
 * `status`, `severity`, `flagged_by_user_external_id` and `flagged_at` are all
 * real columns, so this is the one part of the page that can say what the work
 * found, who flagged it, and whether anybody closed it.
 */
export interface ExceptionCase {
  id: string;
  reportId: string;
  workflowId: string;
  status: CaseStatus;
  severity: CaseSeverity;
  flaggedBy: Actor;
  flaggedAt: number;
  /** `report_card_case_actions.due_date`, where somebody set one. */
  dueDate: number | null;
}

function buildCases(): ExceptionCase[] {
  const rand = prng(5150626);
  const out: ExceptionCase[] = [];
  let n = 0;
  const complete = EXECUTIONS.filter(e => e.status === 'complete');

  complete.forEach(exec => {
    // Most runs find nothing. The ones that do find a handful.
    if (rand() > 0.34) return;
    const found = 1 + Math.floor(rand() * 5);
    for (let i = 0; i < found; i += 1) {
      n += 1;
      const roll = rand();
      const severity: CaseSeverity = roll < 0.16 ? 'high' : roll < 0.55 ? 'medium' : 'low';
      const state = rand();
      const status: CaseStatus =
        state < 0.34 ? 'review_pending' : state < 0.52 ? 'in_review' : state < 0.8 ? 'done' : 'resolved';
      const flaggedAt = exec.completedAt ?? exec.startedAt;
      out.push({
        id: `case-${n}`,
        reportId: `rep-${exec.workflowId}`,
        workflowId: exec.workflowId,
        status,
        severity,
        flaggedBy: pick(rand, WORKERS),
        flaggedAt,
        dueDate: rand() < 0.6 ? flaggedAt + (10 + Math.floor(rand() * 40)) * DAY_MS : null,
      });
    }
  });

  return out.sort((a, b) => a.flaggedAt - b.flaggedAt);
}

export const CASES: ExceptionCase[] = buildCases();

/* ──────────────────────────────────────────────────────────────────────────
 * What came out
 * ────────────────────────────────────────────────────────────────────────── */

/** `reports`. Carries an owner and a team, so it scopes both ways. */
export interface ReportRecord {
  id: string;
  name: string;
  type: string;
  status: 'draft' | 'in_review' | 'final';
  owner: Actor;
  team: string;
  sizeBytes: number;
  createdAt: number;
}

/**
 * `report_atr_snapshots`. Append only, one row per generated document, and it
 * records who generated it and how many pages came out.
 */
export interface AtrSnapshot {
  id: string;
  reportId: string;
  generatedBy: Actor;
  pageCount: number;
  sizeBytes: number;
  createdAt: number;
}

function buildReports(): { reports: ReportRecord[]; snapshots: AtrSnapshot[] } {
  const rand = prng(8080426);
  const reports: ReportRecord[] = [];
  const snapshots: AtrSnapshot[] = [];
  let n = 0;
  let s = 0;

  for (let t = HISTORY_START; t <= ANCHOR; t += 9 * DAY_MS) {
    if (!isWeekday(t)) continue;
    n += 1;
    const owner = pick(rand, OWNERS);
    const workflow = pick(rand, WORKFLOWS);
    const state = rand();
    const report: ReportRecord = {
      id: `rep-${n}`,
      name: `${workflow.name}, ${new Date(t).getUTCFullYear()}`,
      type: rand() < 0.7 ? 'Internal audit' : 'Bulk audit',
      status: state < 0.25 ? 'draft' : state < 0.5 ? 'in_review' : 'final',
      owner,
      team: owner.team,
      sizeBytes: Math.round(180_000 + rand() * 2_600_000),
      createdAt: t + 11 * HOUR_MS,
    };
    reports.push(report);

    // A final report is the one that gets an ATR generated off it, and it is
    // often regenerated once or twice as findings are agreed.
    if (report.status === 'final') {
      const times = 1 + Math.floor(rand() * 3);
      for (let k = 0; k < times; k += 1) {
        s += 1;
        snapshots.push({
          id: `atr-${s}`,
          reportId: report.id,
          generatedBy: rand() < 0.75 ? owner : pick(rand, OWNERS),
          pageCount: 12 + Math.floor(rand() * 40),
          sizeBytes: Math.round(400_000 + rand() * 3_200_000),
          createdAt: Math.min(ANCHOR, report.createdAt + (k + 1) * 3 * DAY_MS),
        });
      }
    }
  }

  return {
    reports: reports.sort((a, b) => a.createdAt - b.createdAt),
    snapshots: snapshots.sort((a, b) => a.createdAt - b.createdAt),
  };
}

const produced = buildReports();
export const REPORTS: ReportRecord[] = produced.reports;
export const ATR_SNAPSHOTS: AtrSnapshot[] = produced.snapshots;

/* ──────────────────────────────────────────────────────────────────────────
 * Queries against a customer's own database
 * ────────────────────────────────────────────────────────────────────────── */

export type DbEngine = 'postgres' | 'mysql' | 'snowflake' | 'bigquery' | 'athena';

/** `db_connections`. */
export interface DbConnection {
  id: string;
  name: string;
  engine: DbEngine;
  team: string;
  status: 'active' | 'inactive';
  lastHealthCheckAt: number;
}

export const DB_CONNECTIONS: DbConnection[] = [
  { id: 'db-erp',       name: 'SAP ECC, finance',      engine: 'postgres',  team: 'SOX Audit', status: 'active',   lastHealthCheckAt: ANCHOR - 2 * HOUR_MS },
  { id: 'db-warehouse', name: 'Finance warehouse',     engine: 'snowflake', team: 'SOX Audit', status: 'active',   lastHealthCheckAt: ANCHOR - 5 * HOUR_MS },
  { id: 'db-hr',        name: 'HR system, replica',    engine: 'mysql',     team: 'IFC Team',  status: 'active',   lastHealthCheckAt: ANCHOR - 26 * HOUR_MS },
  { id: 'db-lake',      name: 'Group data lake',       engine: 'bigquery',  team: 'IFC Team',  status: 'active',   lastHealthCheckAt: ANCHOR - 9 * HOUR_MS },
  { id: 'db-archive',   name: 'Archive, S3 via Athena', engine: 'athena',   team: 'SOX Audit', status: 'inactive', lastHealthCheckAt: ANCHOR - 71 * DAY_MS },
];

/**
 * `db_connection_audit`, the `query_executed` event.
 *
 * The only place in the product where a per-query latency and a row count are
 * persisted. `bytes_scanned` is filled in only by the engines that report it,
 * which is Snowflake, BigQuery and Athena, and is null everywhere else. That
 * null is a real one and the page keeps it as a null.
 */
export interface DbQuery {
  id: string;
  connectionId: string;
  actor: Actor;
  rowCount: number;
  latencyMs: number;
  bytesScanned: number | null;
  errorCode: string | null;
  at: number;
}

const REPORTS_BYTES: DbEngine[] = ['snowflake', 'bigquery', 'athena'];

function buildDbQueries(): DbQuery[] {
  const rand = prng(112233);
  const out: DbQuery[] = [];
  let n = 0;
  const live = DB_CONNECTIONS.filter(c => c.status === 'active');

  for (let t = HISTORY_START; t <= ANCHOR; t += DAY_MS) {
    if (!isWeekday(t)) continue;
    const maturity = (t - HISTORY_START) / (ANCHOR - HISTORY_START);
    const queries = Math.round((2 + rand() * 7) * (0.4 + maturity));
    for (let i = 0; i < queries; i += 1) {
      n += 1;
      const connection = pick(rand, live);
      const failed = rand() < 0.045;
      // Skewed, because most queries pull a page or a slice and a few pull a
      // whole extract. A flat draw would put the median where nothing sits.
      const rows = failed ? 0 : Math.round(rand() ** 3 * 50_000);
      out.push({
        id: `dbq-${n}`,
        connectionId: connection.id,
        actor: pick(rand, WORKERS),
        rowCount: rows,
        // Same shape: seconds normally, and a long tail that is the reason a
        // median is printed on the page rather than an average.
        latencyMs: Math.round(80 + rand() ** 5 * 40_000),
        bytesScanned: REPORTS_BYTES.includes(connection.engine)
          ? Math.round(rows * (140 + rand() * 900) + 2_000_000)
          : null,
        errorCode: failed ? (rand() < 0.5 ? 'connection_timeout' : 'permission_denied') : null,
        at: t + (9 + Math.floor(rand() * 9)) * HOUR_MS + Math.floor(rand() * 59) * MINUTE_MS,
      });
    }
  }

  return out.sort((a, b) => a.at - b.at);
}

export const DB_QUERIES: DbQuery[] = buildDbQueries();

/* ──────────────────────────────────────────────────────────────────────────
 * Imports
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * `racm_imports`. The best instrumented job table in the product: it counts
 * rows in, rows processed, and what got created out of them. It still has no
 * duration, only `created_at` and `updated_at`.
 */
export interface RacmImport {
  id: string;
  fileName: string;
  status: 'complete' | 'failed' | 'running';
  rowsTotal: number;
  rowsProcessed: number;
  risksCreated: number;
  controlsCreated: number;
  mappingsCreated: number;
  createdBy: Actor;
  team: string;
  createdAt: number;
}

function buildImports(): RacmImport[] {
  const rand = prng(660099);
  const out: RacmImport[] = [];
  let n = 0;

  for (let t = HISTORY_START; t <= ANCHOR; t += 11 * DAY_MS) {
    if (!isWeekday(t)) continue;
    n += 1;
    const by = pick(rand, WORKERS);
    const rowsTotal = 40 + Math.floor(rand() * 400);
    const failed = rand() < 0.12;
    const rowsProcessed = failed ? Math.floor(rowsTotal * rand()) : rowsTotal;
    out.push({
      id: `imp-${n}`,
      fileName: `RACM_${new Date(t).getUTCFullYear()}_${by.team.split(' ')[0].toLowerCase()}.xlsx`,
      status: failed ? 'failed' : 'complete',
      rowsTotal,
      rowsProcessed,
      risksCreated: Math.round(rowsProcessed * 0.42),
      controlsCreated: rowsProcessed,
      mappingsCreated: Math.round(rowsProcessed * 1.3),
      createdBy: by,
      team: by.team,
      createdAt: t + 10 * HOUR_MS,
    });
  }

  return out;
}

export const RACM_IMPORTS: RacmImport[] = buildImports();

/* ──────────────────────────────────────────────────────────────────────────
 * Administration activity
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * `activity_logs`.
 *
 * Narrow on purpose, because the real table is narrow: the only actions ever
 * written are the twenty three user, team, role and invitation mutations. It
 * carries no sign in, no page view and no feature use, so nothing here counts
 * one.
 */
export interface AdminEvent {
  id: string;
  action: string;
  actor: Actor;
  resourceType: 'user' | 'team' | 'role' | 'invitation';
  resourceName: string;
  occurredAt: number;
}

const ADMIN_ACTIONS: { action: string; resourceType: AdminEvent['resourceType'] }[] = [
  { action: 'invitation.created',      resourceType: 'invitation' },
  { action: 'invitation.accepted',     resourceType: 'invitation' },
  { action: 'invitation.revoked',      resourceType: 'invitation' },
  { action: 'role.assigned',           resourceType: 'role' },
  { action: 'role.revoked',            resourceType: 'role' },
  { action: 'role.permissions_updated', resourceType: 'role' },
  { action: 'team.member_added',       resourceType: 'team' },
  { action: 'team.member_removed',     resourceType: 'team' },
  { action: 'team.admin_promoted',     resourceType: 'team' },
  { action: 'user.suspended',          resourceType: 'user' },
  { action: 'user.enabled',            resourceType: 'user' },
];

function buildAdminEvents(): AdminEvent[] {
  const rand = prng(424242);
  const out: AdminEvent[] = [];
  let n = 0;
  const admins = ACTORS.filter(a => a.team === 'Management');

  for (let t = HISTORY_START; t <= ANCHOR; t += 6 * DAY_MS) {
    if (!isWeekday(t)) continue;
    if (rand() < 0.45) continue;
    n += 1;
    const spec = pick(rand, ADMIN_ACTIONS);
    const subject = pick(rand, ACTORS);
    out.push({
      id: `act-${n}`,
      action: spec.action,
      actor: pick(rand, admins),
      resourceType: spec.resourceType,
      resourceName: spec.resourceType === 'team' ? subject.team
        : spec.resourceType === 'role' ? 'Auditor'
          : subject.name,
      occurredAt: t + 15 * HOUR_MS,
    });
  }

  return out.sort((a, b) => a.occurredAt - b.occurredAt);
}

export const ADMIN_EVENTS: AdminEvent[] = buildAdminEvents();
