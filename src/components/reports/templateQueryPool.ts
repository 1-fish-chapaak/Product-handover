// Query content + helpers for the Generate-from-template wizard.
//
// The wizard's picker is built entirely from the user's live reports (see
// ReportsView's wizardSources) — there is no static catalog. This module owns
// the rich-content lookup (defForKey), the workflow→query projection, and the
// demo-report key map that backfills the seeded reports which ship without
// baked query content. Reuses REPORT_QUERIES_ATR so a wizard-generated report
// is indistinguishable from a hand-assembled one.

import { REPORT_QUERIES_ATR } from '../../data/reportQueries';
import { QUERY_GRAPHS, QUERY_KPIS, QUERY_TABLE_SETS, QUERY_TABLES } from '../../data/queryGraphs';
import { sectionBlurb } from './reportShared';
import type { WorkflowResult, DataBinding, SectionKind } from './reportShared';

export type QuerySource = 'report';

/** A structured finding as it comes off a query — the five parts a real audit
 *  finding carries, plus its scope area. Queries that carry these produce
 *  first-class findings; queries with only prose `findings[]` fall back to a
 *  condition + recommendation (Gap 1 / Gap 2). */
export type FindingDetail = {
  /** The finding statement — what was observed. */
  condition: string;
  /** The rule / standard the condition breaks ("Under Regulation 113…"). */
  criteria?: string;
  /** Why it happened. */
  cause?: string;
  /** What it leads to / the risk it creates. */
  effect?: string;
  /** The recommended action. */
  recommendation?: string;
  /** The real scope area this finding belongs to (e.g. "7.2 Payments"). */
  scopeArea?: string;
  severity?: 'High' | 'Medium' | 'Low';
  /** Optional short title; derived from the condition when absent. */
  title?: string;
};

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
  /** The real scope area these findings belong to, set from the engagement's
   *  scope when the query is added (Gap 2). Falls back to `risk` when absent. */
  scopeArea?: string;
  /** Structured 5-part findings (Gap 1). When present, extractFindings uses these
   *  instead of the prose `findings[]` — criteria/cause/effect and a real scope. */
  findingsDetailed?: FindingDetail[];
  /** Set when the query's run failed (queries.execution_error). A section fed by
   *  it renders the Errored empty state — the error is surfaced, never a zero. */
  executionError?: string;
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
      { label: 'Flagged By AI', value: '140', color: 'text-brand-600' },
      { label: 'Manually Flagged', value: '1', color: 'text-high-700' },
      { label: 'Resolved', value: '3', color: 'text-compliant-700' },
      { label: 'Pending', value: '136', color: 'text-risk-700' },
    ],
    chartData: [40, 55, 80, 65, 90, 75, 95, 70, 85, 100],
  },
  Q02: {
    risk: 'Compliance Risk', severity: 'High',
    kpis: [
      { label: 'Changes Found', value: '47', color: 'text-brand-600' },
      { label: 'Unauthorized', value: '12', color: 'text-risk-700' },
      { label: 'Verified', value: '35', color: 'text-compliant-700' },
      { label: 'Pending', value: '8', color: 'text-high-700' },
    ],
    chartData: [20, 35, 25, 50, 40, 30, 45, 60, 55, 47],
  },
  RA01: {
    risk: 'Aggregate Risk', severity: 'High',
    kpis: [
      { label: 'Total Risks', value: '12', color: 'text-brand-600' },
      { label: 'High', value: '7', color: 'text-risk-700' },
      { label: 'Mitigated', value: '5', color: 'text-compliant-700' },
    ],
    chartData: [12, 10, 11, 9, 12, 10, 8, 12, 11, 12],
  },
  RA02: {
    risk: 'Mitigation Gap', severity: 'High',
    kpis: [
      { label: 'Strategies Reviewed', value: '18', color: 'text-brand-600' },
      { label: 'Effective', value: '10', color: 'text-compliant-700' },
      { label: 'Partial', value: '5', color: 'text-mitigated-700' },
      { label: 'Ineffective', value: '3', color: 'text-risk-700' },
    ],
    chartData: [18, 16, 17, 15, 18, 14, 16, 18, 17, 18],
  },
  CE01: {
    risk: 'Control Gap', severity: 'High',
    kpis: [
      { label: 'Controls Tested', value: '54', color: 'text-brand-600' },
      { label: 'Effective', value: '48', color: 'text-compliant-700' },
      { label: 'Deficient', value: '4', color: 'text-risk-700' },
      { label: 'Pending Test', value: '33', color: 'text-mitigated-700' },
    ],
    chartData: [48, 46, 47, 48, 45, 48, 47, 48, 46, 48],
  },
  WA01: {
    risk: 'Operational Risk', severity: 'Medium',
    kpis: [
      { label: 'Total Runs', value: '115', color: 'text-brand-600' },
      { label: 'Accuracy', value: '94.2%', color: 'text-compliant-700' },
      { label: 'Exceptions', value: '23', color: 'text-high-700' },
      { label: 'Avg Runtime', value: '1.8d', color: 'text-evidence-700' },
    ],
    chartData: [85, 88, 90, 87, 92, 94, 91, 93, 95, 94],
  },
  WA02: {
    risk: 'Processing Risk', severity: 'Medium',
    kpis: [
      { label: 'Exceptions', value: '23', color: 'text-brand-600' },
      { label: 'Auto-Resolved', value: '8', color: 'text-compliant-700' },
      { label: 'Manual Review', value: '12', color: 'text-mitigated-700' },
      { label: 'Escalated', value: '3', color: 'text-risk-700' },
    ],
    chartData: [5, 3, 6, 4, 2, 3, 5, 7, 4, 3],
  },
  EX01: {
    risk: 'Strategic Risk', severity: 'Medium',
    kpis: [
      { label: 'Compliance', value: '94.2%', color: 'text-brand-600' },
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
  // Each list length equals the report's card `queries` count, so the report
  // body renders exactly as many query blocks as the card claims — the cover
  // "N queries", the card chip, and the rendered blocks all agree (they used to
  // disagree: every seeded report rendered the same 2 default queries while its
  // card claimed 3–12). Content is drawn from the 8 rich query keys, cycled where
  // a report needs more than eight.
  'gr-001': ['Q01', 'Q02', 'CE01', 'WA01', 'WA02', 'RA01'],
  'gr-003': ['CE01', 'WA01', 'WA02'],
  'gr-004': ['Q01', 'Q02', 'CE01', 'WA01', 'WA02', 'RA01', 'RA02', 'EX01'],
  'gr-005': ['Q01', 'Q02', 'CE01', 'WA01', 'WA02'],
  'gr-006': ['Q01', 'Q02', 'CE01', 'WA01'],
  'gr-007': ['Q01', 'Q02', 'CE01', 'WA01', 'WA02', 'RA01', 'RA02'],
  // gr-008 deliberately re-uses Q01 (duplicate-invoice) from gr-001 and CE01
  // (control-testing) from gr-003 so the wizard picker has the same query in
  // two reports — that's what makes the "click to swap" affordance visible the
  // moment the wizard opens. Pick Q01 in one report, then watch it offer to
  // swap onto the other. (Q01 + CE01 lead the list to keep that demo intact.)
  'gr-008': ['Q01', 'CE01', 'Q02', 'WA01', 'WA02'],
  'gr-009': ['Q01', 'Q02', 'CE01'],
  'gr-010': ['Q01', 'Q02', 'CE01', 'WA01', 'WA02', 'RA01', 'RA02', 'EX01'],
};

// Structured 5-part findings for the demo queries, each with a real Cumberland-
// style scope area (Gap 1 + Gap 2). A query that has an entry here produces
// first-class findings — criteria (the rule), condition (what was seen), cause,
// effect, recommendation — grouped by their real area, not the risk bucket.
export const QUERY_FINDINGS: Record<string, FindingDetail[]> = {
  Q01: [
    {
      scopeArea: '7.3 Vendor Master Data',
      severity: 'High',
      title: 'Mandatory vendor fields left blank',
      criteria: 'The Vendor Data Standard requires Email, PAN and GST for every active vendor record.',
      condition: '94 vendor records are missing a mandatory Email and 42 are missing a PAN, across the Vendors sheet.',
      cause: 'Vendor onboarding accepts a save without validating mandatory fields.',
      effect: 'Payments and statutory filings can be raised against incomplete vendors, and dunning notices fail to deliver.',
      recommendation: 'Make Email, PAN and GST hard-required at onboarding and back-fill the 94 open records before the next payment run.',
    },
    {
      scopeArea: '7.2 Payments & Disbursements',
      severity: 'High',
      title: 'Duplicate invoice identifiers in the Payments sheet',
      criteria: 'Each invoice must carry a unique identifier under the three-way-match control.',
      condition: 'Invoice INV-005790 appears twice and a further 88 rows share a duplicate key in the Payments sheet.',
      cause: 'The workbook import does not enforce uniqueness on the invoice-id column.',
      effect: 'Duplicate invoices can be paid twice, a direct financial loss and a three-way-match breakdown.',
      recommendation: 'Enforce a unique constraint on invoice id and review the 89 duplicates for double payment.',
    },
  ],
  Q02: [
    {
      scopeArea: '7.4 Access & Segregation of Duties',
      severity: 'High',
      title: 'Vendor master changes without approval',
      criteria: 'Vendor bank-detail changes require a second-person approval within 90 days (SoD policy 4.2).',
      condition: '12 of 47 vendor master changes in the period were applied with no recorded approver.',
      cause: 'The approval workflow can be bypassed by users holding both maker and checker roles.',
      effect: 'A single user can redirect payments to an unauthorised account undetected.',
      recommendation: 'Remove combined maker-checker roles and require dual approval on all bank-detail changes.',
    },
  ],
  CE01: [
    {
      scopeArea: '7.1 Governance & Oversight',
      severity: 'High',
      title: 'Journal-entry override outside policy',
      criteria: 'Manual journal overrides above the threshold need CFO sign-off (control CTR-012).',
      condition: 'Override was detected in 7 instances with no CFO sign-off — a material weakness.',
      cause: 'The override control is preventive in design but not enforced in the ledger system.',
      effect: 'Unauthorised journals can move balances at period end without oversight.',
      recommendation: 'Configure a system block on threshold overrides pending sign-off, and review the 7 instances.',
    },
    {
      scopeArea: '7.5 Financial Reporting',
      severity: 'Medium',
      title: 'Reconciling items open beyond 30 days',
      criteria: 'GL reconciliations must clear reconciling items within 30 days (control CTR-031).',
      condition: '3 accounts carry unreconciled differences older than 30 days.',
      cause: 'Reconciliation ownership is unassigned for two of the three accounts.',
      effect: 'Misstatements can persist undetected into the financial statements.',
      recommendation: 'Assign named owners and clear the three aged reconciliations before quarter close.',
    },
  ],
};

/** The distinct scope areas the query pool can produce findings under — offered
 *  when a custom text section is scoped to one area ("fill from findings in 7.2"). */
export function knownScopeAreas(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  Object.values(QUERY_FINDINGS).flat().forEach(d => {
    const s = d.scopeArea?.trim();
    if (s && !seen.has(s)) { seen.add(s); out.push(s); }
  });
  return out;
}

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
    ...(QUERY_FINDINGS[key] ? { findingsDetailed: QUERY_FINDINGS[key] } : {}),
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
  const high = defs.filter(d => d.severity === 'High').length;
  // Data-anchored sections summarise the attached queries — richer, data-aware
  // prose, but ONLY when queries are actually attached. With no data (e.g. a
  // template applied before queries are added) these fall through to the section's
  // descriptive one-liner, so nothing ever reads "0 queries".
  if (n > 0) {
    if (/testing results|quer(y|ies)|findings|assessment|register/i.test(sectionName))
      return `${n} ${qWord} executed${high > 0 ? ` — ${high} returned high-severity results` : ''}. Detailed results follow.`;
    if (/deficienc|detailed description/i.test(sectionName))
      return high > 0
        ? `${high} of ${n} ${qWord} surfaced high-severity exceptions requiring classification (deficiency / significant deficiency / material weakness). See the query results above for affected records.`
        : 'No high-severity exceptions surfaced by the attached queries. Classify any residual items during review.';
    if (/gap|non-?compliance/i.test(sectionName))
      return high > 0
        ? `${high} of ${n} ${qWord} surfaced potential non-compliance requiring action. Each gap maps to its requirement and owner in the results above.`
        : 'No material gaps identified against the assessed requirements. Record any minor observations during review.';
    if (/recommendation|insight/i.test(sectionName)) {
      const recs = defs.flatMap(d => d.observations).slice(0, 3);
      if (recs.length > 0) return recs.join(' ');
    }
    if (/conclusion|opinion|assertion/i.test(sectionName))
      return high > 0
        ? `Based on the ${n} ${qWord} reviewed, control weaknesses were identified (${high} high-severity). A qualified conclusion is warranted pending remediation of the exceptions above.`
        : `Based on the ${n} ${qWord} reviewed, no significant exceptions were noted. Controls over the covered areas operated effectively for the period.`;
    if (/appendix/i.test(sectionName))
      return `Source queries: ${defs.map(d => d.id).join(', ')}. Full query outputs, parameters, and evidence references are retained with this report.`;
  }
  // Everything else — and every section when no queries are attached — starts from
  // the section's one-line description, matching the template preview.
  return sectionBlurb(sectionName);
}

// ─── Placeholder data binding ────────────────────────────────────────────────
//
// A kpi/chart/table section is a placeholder: it holds no numbers of its own.
// A `DataBinding` names which query, and which field within it, fills the block.
// `bindableSources()` is the catalog the binding UI offers; `resolveBinding()`
// turns a binding + the report's live queries into what actually renders. The
// upload gives the section; the query gives the numbers — never the other way.

export type BindableField = { id: string; label: string };
export type BindableSource = {
  queryKey: string;
  /** Human title for the query row in the binding picker. */
  label: string;
  kpis: BindableField[];
  charts: BindableField[];
  tables: BindableField[];
};

/** The queries a placeholder can bind to, with their bindable fields per kind.
 *  Prefers the report's OWN live queries (the real query answers) when they're
 *  passed — so a binding points at this report's data, not the seeded demo pool
 *  (PRD correction). Falls back to the tenant query catalog at design time, when no
 *  report context exists yet (the template editor binds to a query key that resolves
 *  live at generate). Either way a binding always points at a real, renderable field. */
export function bindableSources(queries?: GeneratedQueryDef[]): BindableSource[] {
  if (queries && queries.length) {
    return queries.map(q => {
      const kpiList = q.kpis?.length ? q.kpis.map(k => ({ label: k.label, value: k.value })) : (QUERY_KPIS[q.id] ?? []);
      const charts = QUERY_GRAPHS[q.id] ?? (q.chartData?.length ? [{ id: `${q.id}-trend`, title: 'Trend', type: 'bar' as const }] : []);
      const tables = QUERY_TABLE_SETS[q.id] ?? (QUERY_TABLES[q.id] ? [{ id: `${q.id}-t`, title: 'Results table' }] : []);
      return {
        queryKey: q.id,
        label: `${q.id} · ${q.risk || q.title}`,
        kpis: kpiList.map(k => ({ id: k.label, label: `${k.label} — ${k.value}` })),
        charts: charts.map(g => ({ id: g.id, label: `${g.title} (${g.type})` })),
        tables: tables.map(t => ({ id: t.id, label: t.title })),
      };
    });
  }
  return Object.keys(KEY_META).map(key => {
    const kpiList = QUERY_KPIS[key] ?? KEY_META[key].kpis.map(k => ({ label: k.label, value: k.value }));
    return {
      queryKey: key,
      // A concise, stable label ("Q01 · Financial Risk"): the query's full title is
      // a whole sentence, too long for a picker option or a KPI caption.
      label: `${key} · ${KEY_META[key].risk}`,
      kpis: kpiList.map(k => ({ id: k.label, label: `${k.label} — ${k.value}` })),
      charts: (QUERY_GRAPHS[key] ?? []).map(g => ({ id: g.id, label: `${g.title} (${g.type})` })),
      tables: (QUERY_TABLE_SETS[key] ?? (QUERY_TABLES[key] ? [{ id: `${key}-t`, title: 'Results table' }] : []))
        .map(t => ({ id: t.id, label: t.title })),
    };
  });
}

/** Fields bindable for a given kind, within one query. Used to populate the
 *  second column of the binding picker once a query is chosen. */
export function fieldsForKind(source: BindableSource | undefined, kind: SectionKind): BindableField[] {
  if (!source) return [];
  if (kind === 'kpi') return source.kpis;
  if (kind === 'chart') return source.charts;
  if (kind === 'table') return source.tables;
  return [];
}

/** A human label for a binding, e.g. "Duplicate-invoice check · Blank Cells". */
export function bindingLabel(binding: DataBinding | undefined): string | null {
  if (!binding) return null;
  const src = bindableSources().find(s => s.queryKey === binding.queryKey);
  const q = src?.label ?? binding.queryKey;
  if (!binding.field) return q;
  const field = [...(src?.kpis ?? []), ...(src?.charts ?? []), ...(src?.tables ?? [])]
    .find(f => f.id === binding.field);
  return `${q} · ${field?.label.split(' — ')[0].split(' (')[0] ?? binding.field}`;
}

export type ResolvedBinding =
  | { status: 'unbound' }
  | { status: 'missing'; queryKey: string }
  | { status: 'empty'; queryKey: string; error?: string }
  | { status: 'errored'; queryKey: string; error: string }
  | { status: 'kpi'; label: string; value: string }
  | { status: 'chart'; title: string; chartType: 'bar' | 'line'; data: number[] }
  | { status: 'table'; columns: string[]; rows: (string | number)[][] };

/** Resolve a placeholder's binding against the report's live queries at generate.
 *  Returns a render-ready result or a non-data status — an unbound block, a bound
 *  query not present in this report, a query whose run errored, or one that ran but
 *  has no data. Never invents zeros: a missing value is a state, not a 0. */
export function resolveBinding(
  kind: SectionKind,
  binding: DataBinding | undefined,
  queries: GeneratedQueryDef[],
): ResolvedBinding {
  if (!binding || !binding.queryKey) return { status: 'unbound' };
  const q = queries.find(d => d.id === binding.queryKey);
  // The bound query isn't in this report's selection.
  if (!q) return { status: 'missing', queryKey: binding.queryKey };
  // The query's run failed — surface the error, never a zero (Errored state).
  if (q.executionError) return { status: 'errored', queryKey: binding.queryKey, error: q.executionError };

  if (kind === 'kpi') {
    // Resolve against the SAME KPI set the picker offered (bindableSources): the
    // report's live query kpis first, the tenant catalog only as a fallback. Keeping
    // the two in step means a field the user just picked actually resolves to a value.
    const kpiList = q.kpis?.length ? q.kpis : (QUERY_KPIS[binding.queryKey] ?? []);
    const kpi = binding.field
      ? kpiList.find(k => k.label === binding.field)
      : kpiList[0];
    if (!kpi || kpi.value == null || kpi.value === '') return { status: 'empty', queryKey: binding.queryKey };
    return { status: 'kpi', label: kpi.label, value: kpi.value };
  }

  if (kind === 'chart') {
    const graph = binding.field ? (QUERY_GRAPHS[binding.queryKey] ?? []).find(g => g.id === binding.field) : undefined;
    const data = q.chartData ?? [];
    if (data.length === 0) return { status: 'empty', queryKey: binding.queryKey };
    const chartType: 'bar' | 'line' = graph?.type === 'bar' ? 'bar' : 'line';
    return { status: 'chart', title: graph?.title ?? q.title, chartType, data };
  }

  // table
  const sets = QUERY_TABLE_SETS[binding.queryKey] ?? [];
  const chosen = binding.field ? sets.find(t => t.id === binding.field) : sets[0];
  const table = chosen ?? QUERY_TABLES[binding.queryKey];
  if (!table || table.rows.length === 0) return { status: 'empty', queryKey: binding.queryKey };
  return { status: 'table', columns: table.columns, rows: table.rows };
}

// ─── Findings — the unit that fills a findings section ───────────────────────
//
// A query is a data source, not a report block. It yields findings; a *finding*
// is the unit that fills a findings section. One query can yield many findings;
// findings from all queries pool together and distribute into the customer's
// sections (grouped by scope area). So 8 queries into a 5-section format make a
// 5-section report, not 8 blocks.

export type ReportFinding = {
  /** Stable id: `${queryId}-f${n}`. */
  id: string;
  /** The query (data source) this finding came from. */
  queryId: string;
  /** Short title — the finding's first clause. */
  title: string;
  severity: 'High' | 'Medium' | 'Low' | string;
  /** The scope area findings group under in the report (Cumberland 7.1, 7.2…). A
   *  real scope tag when the query carries one (Gap 2), else the risk bucket. */
  scopeArea: string;
  /** The rule / standard the condition breaks (Gap 1). */
  criteria?: string;
  /** The finding statement — what was observed. */
  condition: string;
  /** Why it happened (Gap 1). */
  cause?: string;
  /** What it leads to / the risk it creates (Gap 1). */
  effect?: string;
  /** The paired recommendation / management action, when the query has one. */
  recommendation?: string;
};

const titleFrom = (text: string): string => {
  const firstClause = text.split('. ')[0].trim();
  return firstClause.length > 84 ? `${firstClause.slice(0, 84).trim()}…` : firstClause;
};

/** Flatten a report's queries into a pool of structured findings. A query that
 *  carries structured `findingsDetailed` yields first-class 5-part findings with a
 *  real scope area; a query with only prose `findings[]` falls back to condition +
 *  recommendation, scoped by `scopeArea` or the risk bucket. Empty text is dropped. */
export function extractFindings(queries: GeneratedQueryDef[]): ReportFinding[] {
  const out: ReportFinding[] = [];
  queries.forEach(q => {
    const fallbackScope = q.scopeArea?.trim() || q.risk?.trim() || 'General';
    if (q.findingsDetailed?.length) {
      q.findingsDetailed.forEach((d, i) => {
        const condition = (d.condition ?? '').trim();
        if (!condition) return;
        out.push({
          id: `${q.id}-f${i + 1}`,
          queryId: q.id,
          title: d.title?.trim() || titleFrom(condition),
          severity: d.severity ?? q.severity,
          scopeArea: d.scopeArea?.trim() || fallbackScope,
          criteria: d.criteria?.trim() || undefined,
          condition,
          cause: d.cause?.trim() || undefined,
          effect: d.effect?.trim() || undefined,
          recommendation: d.recommendation?.trim() || undefined,
        });
      });
      return;
    }
    const recs = q.observations ?? [];
    (q.findings ?? []).forEach((raw, i) => {
      const text = (raw ?? '').trim();
      if (!text) return;
      out.push({
        id: `${q.id}-f${i + 1}`,
        queryId: q.id,
        title: titleFrom(text),
        severity: q.severity,
        scopeArea: fallbackScope,
        condition: text,
        recommendation: recs[i]?.trim() || undefined,
      });
    });
  });
  return out;
}

/** Group a finding pool by scope area, preserving first-seen order — the shape a
 *  findings section renders (a subheading per area, its findings beneath). */
export function groupFindingsByScope(findings: ReportFinding[]): { scopeArea: string; findings: ReportFinding[] }[] {
  const order: string[] = [];
  const map = new Map<string, ReportFinding[]>();
  findings.forEach(f => {
    if (!map.has(f.scopeArea)) { map.set(f.scopeArea, []); order.push(f.scopeArea); }
    map.get(f.scopeArea)!.push(f);
  });
  return order.map(scopeArea => ({ scopeArea, findings: map.get(scopeArea)! }));
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
  // Lead sentences from the first few queries — deduped so repeated/identical
  // summaries (common when several queries share a source) don't echo.
  const leads = [...new Set(
    defs.map(d => {
      const first = d.summary.split('. ')[0].trim();
      return first.endsWith('.') ? first : `${first}.`;
    }),
  )].slice(0, 3);
  return `This report covers ${defs.length} audit ${defs.length === 1 ? 'query' : 'queries'} (${sevNote}). ${leads.join(' ')}`;
}
