// Pickable query catalog for the Generate-from-template wizard.
//
// Reuses the rich query content in REPORT_QUERIES_ATR — the same content the
// report view renders for its query cards — so a wizard-generated report is
// indistinguishable from a hand-assembled one. The same underlying query can
// be reachable from three places (a report it's attached to, an Ask IRA chat,
// a workflow run); rows are deduped by `key` when selected.

import { REPORT_QUERIES_ATR } from '../../data/reportQueries';
import { QUERY_SESSIONS } from '../../data/queryHistory';

export type QuerySource = 'report' | 'ira' | 'workflow';

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
  /** Rich-content key in REPORT_QUERIES_ATR — the dedupe unit across sources. */
  key: string;
  /** Short display title for the picker row. */
  label: string;
  source: QuerySource;
  /** Where it comes from — report name, chat prompt, or workflow name. */
  sourceLabel: string;
  risk: string;
  severity: 'High' | 'Medium' | 'Low';
  /** Workflow-tab rows only: the run that produced this result query. */
  wfId?: string;
  wfMeta?: string;
  /** Recent Chats rows only: the QUERY_SESSIONS time bucket (TODAY / YESTERDAY / …). */
  chatGroup?: string;
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

const pick = (
  key: string,
  source: QuerySource,
  sourceLabel: string,
  label: string,
): PickableQuery => ({
  uid: `${source}:${key}`,
  key,
  label,
  source,
  sourceLabel,
  risk: KEY_META[key].risk,
  severity: KEY_META[key].severity,
});

// Recent Chats derives from QUERY_SESSIONS — the canonical history every
// picker shows (Add Query modal, dashboard AddDataModal). Only prompts that
// map to rich query content are offerable; the rest can't become a block.
const CHAT_PROMPT_TO_KEY: Record<string, string> = {
  'Detect duplicate invoice entries across vendors': 'Q01',
  'Show unauthorized vendor master changes — last 90 days': 'Q02',
  'Risk identification across P2P, O2C, R2R, S2C processes': 'RA01',
  'Mitigation strategy effectiveness — partially mitigated high risks': 'RA02',
  'Control testing results — effectiveness across 87 controls': 'CE01',
  'Workflow execution performance — runs and accuracy': 'WA01',
  'Exception trend analysis — flagged vs resolved': 'WA02',
  'Board-level GRC posture summary': 'EX01',
};
const chatPool = (): PickableQuery[] =>
  QUERY_SESSIONS.flatMap(g =>
    g.items
      .filter(p => CHAT_PROMPT_TO_KEY[p] && KEY_META[CHAT_PROMPT_TO_KEY[p]])
      .map(p => ({ ...pick(CHAT_PROMPT_TO_KEY[p], 'ira', p, p), chatGroup: g.group }))
  );

// Workflow-tab row: label = workflow name, sourceLabel = the result query it
// contributes (kept so search still matches on query text).
const pickWf = (
  key: string,
  name: string,
  queryTitle: string,
  wfId: string,
  wfMeta: string,
): PickableQuery => ({
  ...pick(key, 'workflow', queryTitle, name),
  wfId,
  wfMeta,
});

/** Everything the wizard can offer, grouped by the picker's three tabs. */
export const QUERY_POOL: Record<QuerySource, PickableQuery[]> = {
  report: [
    pick('Q01', 'report', 'FY26 Q1 SOX Compliance Report', 'Duplicate invoice entries by vendor, date, and amount'),
    pick('Q02', 'report', 'FY26 Q1 SOX Compliance Report', 'Unauthorized vendor master changes — last 90 days'),
    pick('RA01', 'report', 'P2P Risk Assessment — March 2026', 'Risk identification across P2P, O2C, R2R, S2C'),
    pick('RA02', 'report', 'P2P Risk Assessment — March 2026', 'Mitigation strategy effectiveness — high risks'),
    pick('CE01', 'report', 'Workflow Performance — Feb 2026', 'Control testing results across 87 controls'),
  ],
  ira: chatPool(),
  workflow: [
    // Only workflows with a finished run that produced query results appear
    // here (mirrors WORKFLOWS in mockData: id/type/lastRun/runs). Picking one
    // adds the result query from its latest finished run; picking more than
    // one rolls the selection into a bulk audit (the wizard appends the
    // cross-workflow rollup, BULK_ROLLUP_KEY, at Continue).
    pickWf('Q01', 'Duplicate Invoice Detector', 'Duplicate invoice entries by vendor, date, and amount', 'WF-001', 'Detection · Last run Mar 18, 2026 · 12 runs'),
    pickWf('Q02', 'Vendor Master Change Monitor', 'Unauthorized vendor master changes — last 90 days', 'WF-002', 'Monitoring · Last run Mar 20, 2026 · 8 runs'),
  ],
};

/** Cross-workflow rollup appended when 2+ workflows are selected (= bulk audit). */
export const BULK_ROLLUP_KEY = 'WA01';

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

/** Materialize a picker row into a fully renderable query block. */
export function toGeneratedQuery(item: PickableQuery, addedBy: string): GeneratedQueryDef {
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
  if (/deficienc/i.test(sectionName))
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
