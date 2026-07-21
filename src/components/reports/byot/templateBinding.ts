// ─── Generation: reading a custom mould ─────────────────────────────────────
//
// Extraction saves the mould. This is the other half: at apply or generate,
// every block in a custom template is looked up against THIS report's data.
//
// A block states three things, and all three are read here:
//   · source — which concept fills it (findings, actions, metrics, details)
//   · filter — which slice of that concept it takes (a severity split)
//   · shape  — what it stamps (a repeating card, a table row, a stat, a slot)
//
// Nothing here invents content. When the source has no rows for a block's
// filter, it returns an honest empty state instead of a shape full of dashes,
// because a template that quietly prints an empty grid reads as broken.

import type { TemplateBlock, DataBinding } from '../reportShared';
import type { CardFinding } from '../TemplateBlockBody';

/** Everything this report can offer a template block. */
export interface ReportFacts {
  /** The findings pool, already flattened from the report's queries. */
  findings: CardFinding[];
  /** Report-level numbers a stat strip can carry, by canonical concept. */
  metrics: Partial<Record<MetricKey, string>>;
  /** The report's own details, for fill-in slots on a letterhead. */
  details: Partial<Record<DetailKey, string>>;
}

export type MetricKey =
  | 'exceptions' | 'findings' | 'open' | 'closed' | 'tested'
  | 'critical' | 'high' | 'medium' | 'low' | 'actions' | 'health';

export type DetailKey =
  | 'title' | 'date' | 'period' | 'reference' | 'preparedBy' | 'entity' | 'classification';

/** Which caption means which number. The client's own wording decides, so the
 *  match is on meaning, never on an exact string. */
const METRIC_WORDS: { key: MetricKey; re: RegExp }[] = [
  { key: 'exceptions', re: /\b(exceptions?|records? flagged|items? flagged)\b/i },
  { key: 'findings', re: /\b(findings?|observations?|issues?)\b/i },
  { key: 'open', re: /\b(open|outstanding|unresolved)\b/i },
  { key: 'closed', re: /\b(closed|resolved|remediated)\b/i },
  { key: 'tested', re: /\b(tested|samples?|controls? tested|coverage)\b/i },
  { key: 'critical', re: /\bcritical\b/i },
  { key: 'high', re: /\bhigh\b/i },
  { key: 'medium', re: /\bmedium\b/i },
  { key: 'low', re: /\blow\b/i },
  { key: 'actions', re: /\b(actions?|recommendations?)\b/i },
  { key: 'health', re: /\b(health|completeness|pass rate|%)\b/i },
];

const DETAIL_WORDS: { key: DetailKey; re: RegExp }[] = [
  { key: 'title', re: /\b(report title|title|subject)\b/i },
  { key: 'date', re: /\b(date|issued|report date)\b/i },
  { key: 'period', re: /\b(period|financial year|year ended|coverage)\b/i },
  { key: 'reference', re: /\b(reference|ref|report no|number|id)\b/i },
  { key: 'preparedBy', re: /\b(prepared by|issued by|author|audit lead)\b/i },
  { key: 'entity', re: /\b(entity|organisation|organization|company|client|auditee)\b/i },
  { key: 'classification', re: /\b(classification|confidentiality|distribution)\b/i },
];

/** What a block resolved to, and whether the report had anything for it. */
export type BoundRows = { kind: 'rows'; rows: CardFinding[] };
export type BoundCells = { kind: 'cells'; cells: { label: string; value?: string }[] };
export type BoundNone = { kind: 'none' };
export type Bound = (BoundRows | BoundCells | BoundNone) & {
  /** True when the source produced nothing for this block's filter. */
  empty: boolean;
  /** Said plainly, naming the filter that came up empty. */
  emptyMessage: string;
};

/** The concept a block draws from, taken from its binding and falling back to
 *  its shape when an older template carries no binding. */
function sourceOf(block: TemplateBlock): DataBinding | 'details' {
  if (block.binding) return block.binding;
  if (block.kind === 'cards') return 'findings';
  if (block.kind === 'table') return block.linkedTo ? 'actions' : 'findings';
  if (block.kind === 'stat') return 'metrics';
  if (block.kind === 'slot') return 'details';
  return 'summary';
}

/**
 * Read one block against this report: source, then filter, then shape.
 */
export function resolveBlock(block: TemplateBlock, facts?: ReportFacts): Bound {
  if (!facts) return { kind: 'none', empty: true, emptyMessage: '' };
  const source = sourceOf(block);
  const severity = block.severity?.toLowerCase();

  if (source === 'findings' || source === 'actions') {
    const rows = facts.findings.filter(f => !severity || (f.severity ?? '').toLowerCase() === severity);
    return {
      kind: 'rows',
      rows,
      empty: rows.length === 0,
      emptyMessage: severity
        ? `No ${severity}-rated findings in this report. This section fills itself the moment one is raised.`
        : source === 'actions'
          ? 'No actions yet. This table is built from the findings, so it fills as they are raised.'
          : 'No findings in this report yet. This section fills itself the moment one is raised.',
    };
  }

  if (source === 'metrics') {
    const labels = block.slotLabels?.length ? block.slotLabels : [block.label ?? 'Metric'];
    const cells = labels.map(label => {
      const key = METRIC_WORDS.find(m => m.re.test(label))?.key;
      return { label, value: key ? facts.metrics[key] : undefined };
    });
    const found = cells.filter(c => c.value !== undefined).length;
    return {
      kind: 'cells',
      cells,
      empty: found === 0,
      emptyMessage: 'These numbers are not ones we hold, so they stay blank for you to fill.',
    };
  }

  if (source === 'details') {
    const labels = block.slotLabels ?? [];
    const cells = labels.map(label => {
      const key = DETAIL_WORDS.find(d => d.re.test(label))?.key;
      return { label, value: key ? facts.details[key] : undefined };
    });
    const found = cells.filter(c => c.value !== undefined).length;
    return {
      kind: 'cells',
      cells,
      empty: found === 0,
      emptyMessage: 'We do not track these details, so they stay blank until you fill them once.',
    };
  }

  return { kind: 'none', empty: false, emptyMessage: '' };
}

/** Flatten the report's queries into the pool every bound block reads. */
export function buildReportFacts(
  queries: { severity: string; findings: string[]; observations: string[] }[],
  report: { name?: string; generatedAt?: string; reportPeriod?: string; id?: string | number; generatedBy?: string },
  stats?: { label: string; value: string }[],
): ReportFacts {
  const findings: CardFinding[] = queries.flatMap(q =>
    (q.findings ?? []).map((title, i) => ({
      title,
      severity: q.severity,
      recommendation: q.observations?.[i] ?? q.observations?.[0],
    })),
  );

  const countOf = (word: string) =>
    String(findings.filter(f => (f.severity ?? '').toLowerCase() === word).length);

  const metrics: Partial<Record<MetricKey, string>> = {
    findings: String(findings.length),
    actions: String(findings.length),
    critical: countOf('critical'),
    high: countOf('high'),
    medium: countOf('medium'),
    low: countOf('low'),
  };
  // The report's own KPI tiles carry the numbers we already show at the top,
  // so a stat strip asking for "exceptions" or "closed" gets the same figure
  // the reader sees above rather than a second, differing count.
  for (const tile of stats ?? []) {
    const key = METRIC_WORDS.find(m => m.re.test(tile.label))?.key;
    if (key && metrics[key] === undefined) metrics[key] = tile.value;
  }

  return {
    findings,
    metrics,
    details: {
      title: report.name,
      date: report.generatedAt,
      period: report.reportPeriod,
      reference: report.id !== undefined ? String(report.id).toUpperCase() : undefined,
      preparedBy: report.generatedBy,
    },
  };
}
