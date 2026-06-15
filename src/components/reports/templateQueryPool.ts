// Query content + helpers for the Generate-from-template wizard.
//
// The wizard's picker is built entirely from the user's live reports (see
// ReportsView's wizardSources) — there is no static catalog. This module owns
// the rich-content lookup (defForKey), the workflow→query projection, and the
// demo-report key map that backfills the seeded reports which ship without
// baked query content. Reuses REPORT_QUERIES_ATR so a wizard-generated report
// is indistinguishable from a hand-assembled one.

import { REPORT_QUERIES_ATR } from '../../data/reportQueries';
import type { WorkflowResult } from './ReportsView';

export type QuerySource = 'report';

/** Structural twin of ReportsView's QueryShape — a fully renderable query block. */
export type GeneratedQueryDef = {
  id: string;
  risk: string;
  severity: string;
  title: string;
  summary: string;
  findings: string[];
  observations: string[];
  answer: string;
  addedBy: string;
  kpis: { label: string; value: string; color: string }[];
  chartData: number[];
};

export type PickableQuery = {
  /** Unique per picker row: `${source}:${key}`. */
  uid: string;
  /** Dedupe unit — a query key (REPORT_QUERIES_ATR) or `wf:<workflowId>`. */
  key: string;
  /** Short display title for the picker row. */
  label: string;
  source: QuerySource;
  /** Where it comes from — the report this query/workflow lives in. */
  sourceLabel: string;
  risk: string;
  severity: 'High' | 'Medium' | 'Low';
  /** Row kind. A 'workflow' row carries a WorkflowResult instead of a query key. */
  kind: 'query' | 'workflow';
  /** Workflow rows only — the run carried into the report as a result block. */
  workflow?: WorkflowResult;
  /** Workflow rows only — the meta line (WF id · process · N flagged records). */
  wfMeta?: string;
  /** Query rows sourced from a live report carry their full def directly (no
   *  REPORT_QUERIES_ATR lookup by key). Set for dynamic rows; unset for the
   *  static catalog (which resolves via defForKey). */
  def?: GeneratedQueryDef;
};

// Per-key presentation data (risk bucket + KPI tiles + sparkline). Mirrors the
// values the report view already uses for the same keys.
type KeyMeta = {
  risk: string;
  severity: 'High' | 'Medium' | 'Low';
  kpis: GeneratedQueryDef['kpis'];
  chartData: number[];
};
const KEY_META: Record<string, KeyMeta> = {
  Q01: {
    risk: 'Financial Risk', severity: 'High',
    kpis: [
      { label: 'Flagged By AI', value: '140', color: 'text-primary' },
      { label: 'Manually Flagged', value: '1', color: 'text-high-700' },
      { label: 'Resolved', value: '3', color: 'text-compliant-700' },
      { label: 'Pending', value: '136', color: 'text-risk-700' },
    ],
    chartData: [40, 55, 80, 65, 90, 75, 95, 70, 85, 100],
  },
  Q02: {
    risk: 'Compliance Risk', severity: 'High',
    kpis: [
      { label: 'Changes Found', value: '47', color: 'text-primary' },
      { label: 'Unauthorized', value: '12', color: 'text-risk-700' },
      { label: 'Verified', value: '35', color: 'text-compliant-700' },
      { label: 'Pending', value: '8', color: 'text-high-700' },
    ],
    chartData: [20, 35, 25, 50, 40, 30, 45, 60, 55, 47],
  },
  RA01: {
    risk: 'Aggregate Risk', severity: 'High',
    kpis: [
      { label: 'Total Risks', value: '12', color: 'text-primary' },
      { label: 'High', value: '7', color: 'text-risk-700' },
      { label: 'Mitigated', value: '5', color: 'text-compliant-700' },
    ],
    chartData: [12, 10, 11, 9, 12, 10, 8, 12, 11, 12],
  },
  RA02: {
    risk: 'Mitigation Gap', severity: 'High',
    kpis: [
      { label: 'Strategies Reviewed', value: '18', color: 'text-primary' },
      { label: 'Effective', value: '10', color: 'text-compliant-700' },
      { label: 'Partial', value: '5', color: 'text-mitigated-700' },
      { label: 'Ineffective', value: '3', color: 'text-risk-700' },
    ],
    chartData: [18, 16, 17, 15, 18, 14, 16, 18, 17, 18],
  },
  CE01: {
    risk: 'Control Gap', severity: 'High',
    kpis: [
      { label: 'Controls Tested', value: '54', color: 'text-primary' },
      { label: 'Effective', value: '48', color: 'text-compliant-700' },
      { label: 'Deficient', value: '4', color: 'text-risk-700' },
      { label: 'Pending Test', value: '33', color: 'text-mitigated-700' },
    ],
    chartData: [48, 46, 47, 48, 45, 48, 47, 48, 46, 48],
  },
  WA01: {
    risk: 'Operational Risk', severity: 'Medium',
    kpis: [
      { label: 'Total Runs', value: '115', color: 'text-primary' },
      { label: 'Accuracy', value: '94.2%', color: 'text-compliant-700' },
      { label: 'Exceptions', value: '23', color: 'text-high-700' },
      { label: 'Avg Runtime', value: '1.8d', color: 'text-evidence-700' },
    ],
    chartData: [85, 88, 90, 87, 92, 94, 91, 93, 95, 94],
  },
  WA02: {
    risk: 'Processing Risk', severity: 'Medium',
    kpis: [
      { label: 'Exceptions', value: '23', color: 'text-primary' },
      { label: 'Auto-Resolved', value: '8', color: 'text-compliant-700' },
      { label: 'Manual Review', value: '12', color: 'text-mitigated-700' },
      { label: 'Escalated', value: '3', color: 'text-risk-700' },
    ],
    chartData: [5, 3, 6, 4, 2, 3, 5, 7, 4, 3],
  },
  EX01: {
    risk: 'Strategic Risk', severity: 'Medium',
    kpis: [
      { label: 'Compliance', value: '94.2%', color: 'text-primary' },
      { label: 'Material Weakness', value: '2', color: 'text-risk-700' },
      { label: 'Cost Saved', value: '24L', color: 'text-compliant-700' },
      { label: 'Exposure', value: '18L', color: 'text-high-700' },
    ],
    chartData: [91, 91.5, 92, 92.3, 93, 93.2, 93.5, 93.8, 94, 94.2],
  },
};

/** Demo (seed) reports → the rich-content query keys they surface in the
 *  picker. User-generated reports carry their own `generatedQueries`, so they
 *  need no entry here; this only backfills the seeded demo reports that ship
 *  without baked query content. Keyed by report id. (gr-002 is a Bulk Audit —
 *  it surfaces its workflow runs instead, so it has no key list.) */
export const DEMO_REPORT_QUERY_KEYS: Record<string, string[]> = {
  'gr-001': ['Q01', 'Q02'],
  'gr-003': ['CE01', 'WA01', 'WA02'],
  'gr-004': ['RA01', 'RA02', 'EX01'],
};

/** Project a workflow run into a query-shaped def — used only for counting and
 *  composed prose (exec summary, template note sections); the report body still
 *  renders the workflow as its own result block, not a query card. */
export function workflowToQueryDef(w: WorkflowResult): GeneratedQueryDef {
  const n = w.outputTable?.rows.length ?? 0;
  return {
    id: w.workflowId,
    risk: w.businessProcess ?? 'Workflow',
    severity: w.severity,
    title: w.name,
    summary: w.findings[0] ?? `${w.name} flagged ${n} ${n === 1 ? 'record' : 'records'}.`,
    findings: w.findings,
    observations: w.observations,
    answer: '',
    addedBy: 'Workflow',
    kpis: [],
    chartData: [],
  };
}

/** Materialize a rich-content key into a fully renderable query block.
 *  Used by the wizard (via toGeneratedQuery) and by empty drafts when
 *  composing section content from queries attached after creation. */
export function defForKey(key: string, addedBy = 'You'): GeneratedQueryDef | null {
  const rich = REPORT_QUERIES_ATR[key];
  const meta = KEY_META[key];
  if (!rich || !meta) return null;
  return {
    id: key,
    risk: meta.risk,
    severity: meta.severity,
    title: rich.title,
    summary: rich.summary,
    findings: rich.findings,
    observations: rich.observations,
    answer: rich.answer,
    addedBy,
    kpis: meta.kpis,
    chartData: meta.chartData,
  };
}

/** Materialize a picker row into a fully renderable query block. Dynamic rows
 *  carry their own def; static catalog rows resolve via the rich-content key. */
export function toGeneratedQuery(item: PickableQuery, addedBy: string): GeneratedQueryDef {
  if (item.def) return { ...item.def, addedBy };
  return defForKey(item.key, addedBy)!;
}

/**
 * Template arrangement — presentation-only ordering of the selected queries.
 * SOX groups by risk/control area; Internal Audit and customs keep the
 * selection order the user assembled.
 */
export function arrangeForTemplate(templateId: string, defs: GeneratedQueryDef[]): GeneratedQueryDef[] {
  if (templateId === 'rt-001') {
    const sevRank = { High: 0, Medium: 1, Low: 2 } as Record<string, number>;
    return [...defs].sort(
      (a, b) => a.risk.localeCompare(b.risk) || (sevRank[a.severity] ?? 3) - (sevRank[b.severity] ?? 3),
    );
  }
  return defs;
}

/**
 * Deterministic starter prose for a template's non-query sections — used when
 * the wizard bakes the advertised section structure into a generated report.
 * Every string is editable placeholder content, composed from the attached
 * queries where the section maps to query data.
 */
export function composeSectionContent(sectionName: string, defs: GeneratedQueryDef[]): string {
  const n = defs.length;
  const qWord = n === 1 ? 'query' : 'queries';
  const risks = [...new Set(defs.map(d => d.risk))];
  const high = defs.filter(d => d.severity === 'High').length;
  if (/scope|objective/i.test(sectionName))
    return `This review covers ${n} audit ${qWord} spanning ${risks.join(', ')}. Objective: validate that controls over the covered processes operate effectively and surface exceptions for remediation.`;
  if (/methodology/i.test(sectionName))
    return 'Design and operating effectiveness were assessed for each area in scope. Testing combined AI-assisted full-population scans with rule-based exception detection; flagged records are grouped into cases for auditor validation, and evidence is retained against each query.';
  if (/testing results|quer(y|ies)|findings/i.test(sectionName))
    return `${n} ${qWord} executed${high > 0 ? ` — ${high} returned high-severity results` : ''}. Detailed results follow.`;
  if (/deficienc|detailed description/i.test(sectionName))
    return high > 0
      ? `${high} of ${n} ${qWord} surfaced high-severity exceptions requiring classification (deficiency / significant deficiency / material weakness). See the query results above for affected records.`
      : 'No high-severity exceptions surfaced by the attached queries. Classify any residual items during review.';
  if (/remediation/i.test(sectionName))
    return 'Assign remediation owners and due dates to each accepted exception; re-testing follows remediation. Status rolls up here as cases progress.';
  if (/recommendation|insight/i.test(sectionName)) {
    const recs = defs.flatMap(d => d.observations).slice(0, 3);
    return recs.length > 0 ? recs.join(' ') : 'Recommendations will be drafted from query observations.';
  }
  if (/appendix/i.test(sectionName))
    return `Source queries: ${defs.map(d => d.id).join(', ')}. Full query outputs, parameters, and evidence references are retained with this report.`;
  return `${sectionName} — drafted for this report; edit to finalize.`;
}

/** Deterministic executive-summary rollup composed from the selected queries. */
export function composeExecSummary(templateName: string, defs: GeneratedQueryDef[]): string {
  if (defs.length === 0) {
    return `${templateName} draft. Attach queries to populate this report — the executive summary will roll up their findings here.`;
  }
  const high = defs.filter(d => d.severity === 'High').length;
  const sevNote = high > 0
    ? `${high} of ${defs.length} ${defs.length === 1 ? 'query is' : 'queries are'} high severity`
    : `${defs.length} ${defs.length === 1 ? 'query' : 'queries'} reviewed, none high severity`;
  const leads = defs.slice(0, 3).map(d => {
    const first = d.summary.split('. ')[0].trim();
    return first.endsWith('.') ? first : `${first}.`;
  });
  return `This report covers ${defs.length} audit ${defs.length === 1 ? 'query' : 'queries'} (${sevNote}). ${leads.join(' ')}`;
}
