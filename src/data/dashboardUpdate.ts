// ─── "Update Dashboard Data" — seed + pure helpers ───
// The dialog behind the dashboard header's "Update Dashboard" button. It has
// four independent modes, and which ones a dashboard offers depends on what
// feeds it: files behind manually created widgets (Upload Data), file-based
// workflows (Run Workflows), database-connected workflows (Sync Live Data) and,
// for either kind of workflow, the runs it has already produced (Previous Runs).
//
// Mocked end to end: uploads settle on timers, column checks are decided by the
// file name (see mockSchemaDiff), and runs "complete" on a timer that appends
// to the run history. No backend.

import type { DashboardSourceType } from './dashboards';

export type UpdateSegmentId = 'upload' | 'bulk' | 'live' | 'history';

export interface UpdateSegment {
  id: UpdateSegmentId;
  label: string;
  /** Sub-line under the dialog title while this segment is active — names the
   *  action AND which widgets it moves, since only one kind responds to each. */
  description: string;
  /** Green check: this mode's action landed during this dialog visit. */
  complete: boolean;
  /** Spinner instead of the check while this mode has work in flight. */
  busy: boolean;
}

/** A file behind manually created widgets — one replaceable row on Upload Data. */
export interface DashboardFileSource {
  datasetId: string;
  displayName: string;
  widgetCount: number;
  columns: string[];
  /** Also a design-time input of a linked workflow — replacing here only
   *  updates the widgets rendering it; the workflow keeps its own copy. */
  alsoWorkflowInput?: boolean;
}

export interface WorkflowInput {
  inputName: string;
  /** The file the last run used — what a replacement is compared against. */
  fileName: string;
}

export interface LinkedWorkflow {
  id: string;
  name: string;
  /** file = has tabular inputs the pool can replace; live = re-queries a
   *  database at run time, so it takes no uploads and can run unattended. */
  kind: 'file' | 'live';
  /** live only: the connection it reads from. */
  sourceName?: string;
  inputs: WorkflowInput[];
  /** No completed run to base the next one on — can't be run or scheduled
   *  from here until it has run once in the executor. */
  neverRan?: boolean;
  /** Demo affordance: the first batch run of this workflow fails once, so the
   *  failed row (and Retry on the live tab) is reachable in the prototype. */
  failsFirstRun?: boolean;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  completedAt: string; // ISO
  durationSecs: number;
  /** Files the run actually used ("Files: …" on the row). */
  files: string[];
}

export interface DashboardUpdateSeed {
  files: DashboardFileSource[];
  workflows: LinkedWorkflow[];
  runs: WorkflowRun[];
  /** The run each workflow's widgets currently render. */
  currentRunByWorkflow: Record<string, string>;
}

export interface SchemaDtypeMismatch { column: string; expected: string; actual: string }

export interface SchemaDiff {
  compatible: boolean;
  missingColumns: string[];
  extraColumns: string[];
  dtypeMismatches: SchemaDtypeMismatch[];
}

/* ── Seeds ──────────────────────────────────────────────────────────────── */

const runAt = (daysAgo: number, hh: number, mm: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hh, mm, 0, 0);
  return d.toISOString();
};

const INVOICE_COLS = ['Invoice ID', 'Vendor Name', 'Invoice Date', 'Amount', 'Currency', 'GL Account', 'Status', 'Entered By'];
const VENDOR_FIN_COLS = ['Vendor ID', 'Vendor Name', 'Payment Terms', 'Total Spend', 'Open Balance', 'Risk Rating', 'Region'];
const PO_COLS = ['PO Number', 'Vendor Name', 'Date', 'Amount', 'Department', 'Category', 'Approval Status'];

const SEEDS: Record<string, DashboardUpdateSeed> = {
  p2p: {
    files: [
      { datasetId: 'ds-p2p-invoice', displayName: 'Invoice_Master.xlsx', widgetCount: 4, columns: INVOICE_COLS, alsoWorkflowInput: true },
      { datasetId: 'ds-p2p-vendor', displayName: 'Vendor_Finance.xlsx', widgetCount: 2, columns: VENDOR_FIN_COLS },
    ],
    workflows: [
      { id: 'wf-dup', name: 'Invoice Duplicate Detection', kind: 'file', inputs: [
        { inputName: 'AP Invoice Register', fileName: 'ap_invoices_aug.csv' },
        { inputName: 'Vendor Master', fileName: 'vendor_master.xlsx' },
      ] },
      { id: 'wf-pay', name: 'Payment Block Review', kind: 'file', inputs: [
        { inputName: 'Payment Ledger', fileName: 'payment_ledger_aug.xlsx' },
      ] },
      { id: 'wf-vrisk', name: 'Vendor Risk Score', kind: 'file', inputs: [
        { inputName: 'Vendor Master', fileName: 'vendor_master.xlsx' },
      ], neverRan: true },
    ],
    runs: [
      { id: 'run-dup-3', workflowId: 'wf-dup', completedAt: runAt(2, 14, 12), durationSecs: 134, files: ['ap_invoices_aug.csv', 'vendor_master.xlsx'] },
      { id: 'run-dup-2', workflowId: 'wf-dup', completedAt: runAt(16, 9, 40), durationSecs: 128, files: ['ap_invoices_jul.csv', 'vendor_master.xlsx'] },
      { id: 'run-dup-1', workflowId: 'wf-dup', completedAt: runAt(30, 10, 5), durationSecs: 141, files: ['ap_invoices_jun.csv', 'vendor_master.xlsx'] },
      { id: 'run-pay-2', workflowId: 'wf-pay', completedAt: runAt(2, 14, 20), durationSecs: 58, files: ['payment_ledger_aug.xlsx'] },
      { id: 'run-pay-1', workflowId: 'wf-pay', completedAt: runAt(16, 9, 51), durationSecs: 61, files: ['payment_ledger_jul.xlsx'] },
    ],
    currentRunByWorkflow: { 'wf-dup': 'run-dup-3', 'wf-pay': 'run-pay-2' },
  },
  grc: {
    files: [],
    workflows: [
      { id: 'wf-ctl', name: 'Control Testing Status', kind: 'live', sourceName: 'audit_controls_db', inputs: [] },
      { id: 'wf-def', name: 'Deficiency Ageing', kind: 'live', sourceName: 'audit_controls_db', inputs: [], failsFirstRun: true },
      { id: 'wf-cov', name: 'Key Control Coverage', kind: 'live', sourceName: 'audit_controls_db', inputs: [] },
    ],
    runs: [
      { id: 'run-ctl-2', workflowId: 'wf-ctl', completedAt: runAt(1, 6, 2), durationSecs: 44, files: [] },
      { id: 'run-ctl-1', workflowId: 'wf-ctl', completedAt: runAt(2, 6, 1), durationSecs: 47, files: [] },
      { id: 'run-def-2', workflowId: 'wf-def', completedAt: runAt(1, 6, 3), durationSecs: 39, files: [] },
      { id: 'run-def-1', workflowId: 'wf-def', completedAt: runAt(2, 6, 2), durationSecs: 40, files: [] },
      { id: 'run-cov-1', workflowId: 'wf-cov', completedAt: runAt(1, 6, 4), durationSecs: 52, files: [] },
    ],
    currentRunByWorkflow: { 'wf-ctl': 'run-ctl-2', 'wf-def': 'run-def-2', 'wf-cov': 'run-cov-1' },
  },
  s2c: {
    files: [
      { datasetId: 'ds-s2c-invoice', displayName: 'Invoice_Master.xlsx', widgetCount: 3, columns: INVOICE_COLS },
      { datasetId: 'ds-s2c-po', displayName: 'PO_Register.csv', widgetCount: 2, columns: PO_COLS },
    ],
    workflows: [
      { id: 'wf-contract', name: 'Contract Expiry Tracker', kind: 'file', inputs: [
        { inputName: 'Contract Register', fileName: 'contracts_fy26.xlsx' },
      ] },
      { id: 'wf-score', name: 'Vendor Scorecard Sync', kind: 'live', sourceName: 'contract_db', inputs: [] },
    ],
    runs: [
      { id: 'run-contract-2', workflowId: 'wf-contract', completedAt: runAt(3, 11, 30), durationSecs: 96, files: ['contracts_fy26.xlsx'] },
      { id: 'run-contract-1', workflowId: 'wf-contract', completedAt: runAt(21, 11, 15), durationSecs: 102, files: ['contracts_fy26_q1.xlsx'] },
      { id: 'run-score-2', workflowId: 'wf-score', completedAt: runAt(1, 6, 0), durationSecs: 33, files: [] },
      { id: 'run-score-1', workflowId: 'wf-score', completedAt: runAt(2, 6, 0), durationSecs: 35, files: [] },
    ],
    currentRunByWorkflow: { 'wf-contract': 'run-contract-2', 'wf-score': 'run-score-2' },
  },
  excel: {
    files: [
      { datasetId: 'ds-excel-invoice', displayName: 'Invoice_Master.xlsx', widgetCount: 5, columns: INVOICE_COLS },
    ],
    workflows: [],
    runs: [],
    currentRunByWorkflow: {},
  },
  sql: {
    files: [],
    workflows: [
      { id: 'wf-vendor-sync', name: 'Vendor Master Sync', kind: 'live', sourceName: 'Vendor Master', inputs: [] },
    ],
    runs: [
      { id: 'run-vs-2', workflowId: 'wf-vendor-sync', completedAt: runAt(1, 6, 0), durationSecs: 28, files: [] },
      { id: 'run-vs-1', workflowId: 'wf-vendor-sync', completedAt: runAt(2, 6, 0), durationSecs: 31, files: [] },
    ],
    currentRunByWorkflow: { 'wf-vendor-sync': 'run-vs-2' },
  },
};

const EMPTY_SEED: DashboardUpdateSeed = { files: [], workflows: [], runs: [], currentRunByWorkflow: {} };

const FILE_NAME_RE = /\.(xlsx|xls|csv)$/i;
const GENERIC_COLS = ['ID', 'Name', 'Date', 'Amount', 'Category', 'Status'];

/** The dialog's sources for a dashboard. Catalog dashboards have a curated
 *  seed; a dashboard created in-session derives one from its attached sources
 *  (file names → replaceable files, a database → one live workflow). Anything
 *  else (query-only dashboards, shared ones) has nothing to update and the
 *  header button stays hidden. */
export function updateSeedFor(
  dashboardId: string,
  ctx: { dataSource?: DashboardSourceType; dataSourceNames?: string[]; widgetCount: number },
): DashboardUpdateSeed {
  const curated = SEEDS[dashboardId];
  if (curated) return curated;
  const names = ctx.dataSourceNames ?? [];
  const files: DashboardFileSource[] = names
    .filter(n => FILE_NAME_RE.test(n))
    .map((n, i) => ({
      datasetId: `ds-${dashboardId}-${i}`,
      displayName: n,
      widgetCount: Math.max(1, ctx.widgetCount),
      columns: GENERIC_COLS,
    }));
  const db = ctx.dataSource === 'sql' ? names.find(n => !FILE_NAME_RE.test(n)) : undefined;
  if (files.length === 0 && !db) return EMPTY_SEED;
  const workflows: LinkedWorkflow[] = db
    ? [{ id: `wf-${dashboardId}-live`, name: `${db} · live query`, kind: 'live', sourceName: db, inputs: [] }]
    : [];
  const runs: WorkflowRun[] = db
    ? [{ id: `run-${dashboardId}-live-1`, workflowId: `wf-${dashboardId}-live`, completedAt: runAt(1, 9, 0), durationSecs: 24, files: [] }]
    : [];
  return {
    files,
    workflows,
    runs,
    currentRunByWorkflow: db ? { [`wf-${dashboardId}-live`]: `run-${dashboardId}-live-1` } : {},
  };
}

/* ── Segments ───────────────────────────────────────────────────────────── */

export interface SegmentFlags {
  hasFiles: boolean;
  hasWorkflows: boolean;
  hasLive: boolean;
  uploadSaved: boolean;
  uploadBusy: boolean;
  bulkCompleted: boolean;
  bulkBusy: boolean;
  liveSynced: boolean;
  liveBusy: boolean;
  runApplied: boolean;
  historyBusy: boolean;
}

/** Which segments the dialog offers, per the dashboard's sources. "Previous
 *  Runs" serves both kinds of workflow, so it rides on either flag. */
export function buildUpdateSegments(f: SegmentFlags): UpdateSegment[] {
  const out: UpdateSegment[] = [];
  if (f.hasFiles) out.push({
    id: 'upload', label: 'Upload Data',
    description: 'Upload the latest files to refresh your dashboard. Updates the widgets you created manually from those files.',
    complete: f.uploadSaved, busy: f.uploadBusy,
  });
  if (f.hasWorkflows) out.push({
    id: 'bulk', label: 'Run Workflows',
    description: 'Run workflows using the latest available data. Updates the widgets built from those workflows’ runs.',
    complete: f.bulkCompleted, busy: f.bulkBusy,
  });
  if (f.hasLive) out.push({
    id: 'live', label: 'Sync Live Data',
    description: 'Sync your connected live data. Updates the widgets built from database-connected workflows.',
    complete: f.liveSynced, busy: f.liveBusy,
  });
  if (f.hasWorkflows || f.hasLive) out.push({
    id: 'history', label: 'Previous Runs',
    description: 'Put an earlier run’s results back on the dashboard. Updates the widgets built from that workflow’s runs.',
    complete: f.runApplied, busy: f.historyBusy,
  });
  return out;
}

/** The segment the dialog opens on — the first one it offers. */
export function firstUpdateSegment(flags: Pick<SegmentFlags, 'hasFiles' | 'hasWorkflows' | 'hasLive'>): UpdateSegmentId {
  const segments = buildUpdateSegments({
    ...flags,
    uploadSaved: false, uploadBusy: false, bulkCompleted: false, bulkBusy: false,
    liveSynced: false, liveBusy: false, runApplied: false, historyBusy: false,
  });
  return segments[0]?.id ?? 'upload';
}

/* ── Formatting ─────────────────────────────────────────────────────────── */

/** "19 Sep 2026 · 2:12 PM" — 12-hour, so it reads like the schedule copy. */
export function formatRunTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Unknown time';
  const day = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${day} · ${time}`;
}

export function formatRunDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

/** "Last synced 19 Sep 2026 · 2:12 PM" / "Never synced". */
export function describeLastSync(current: WorkflowRun | undefined): string {
  return current ? `Last synced ${formatRunTimestamp(current.completedAt)}` : 'Never synced';
}

/** "Used by 4 widgets · also a workflow input" */
export function fileSourceHint(source: DashboardFileSource): string {
  const widgets = source.widgetCount === 1 ? 'Used by 1 widget' : `Used by ${source.widgetCount} widgets`;
  return source.alsoWorkflowInput ? `${widgets} · also a workflow input` : widgets;
}

/** Mock column type for the "View columns" panel — inferred from the name. */
export function inferColumnType(column: string): string {
  const c = column.toLowerCase();
  if (/date|_at$|time/.test(c)) return 'date';
  if (/amount|total|spend|balance|qty|count|rate|price|number|id$/.test(c)) return 'number';
  return 'text';
}

/** The column check a replacement goes through before it can be saved or
 *  run. Decided by the file name so the prototype is predictable: a name
 *  containing "mismatch" or "old" fails (missing + extra + a type flip);
 *  anything else matches. Type differences alone are advisory. */
export function mockSchemaDiff(columns: string[], fileName: string): SchemaDiff {
  const bad = /mismatch|old/i.test(fileName);
  if (!bad) return { compatible: true, missingColumns: [], extraColumns: [], dtypeMismatches: [] };
  const cols = columns.length > 0 ? columns : GENERIC_COLS;
  return {
    compatible: false,
    missingColumns: cols.slice(0, 2),
    extraColumns: ['Region Code', 'Legacy Ref'],
    dtypeMismatches: [{ column: cols[cols.length - 1], expected: 'number', actual: 'text' }],
  };
}

/** Why one workflow's Previous-runs list is empty. */
export function emptyRunListMessage(workflow: LinkedWorkflow): string {
  return workflow.neverRan
    ? 'No runs from this dashboard yet. Run this workflow from here to see its runs listed.'
    : 'This workflow has runs, but none were launched from this dashboard. Sync or run it from here to see its runs listed.';
}
