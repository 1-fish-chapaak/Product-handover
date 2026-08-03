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

import type { TemplateBlock, DataBinding, ScaleMap } from '../reportShared';
import type { CardFinding } from '../TemplateBlockBody';

/** Everything this report can offer a template block.
 *
 *  THE TREE: query → finding → exceptions. One client "finding" or
 *  "observation" is one query card — its rating, its written finding, its
 *  recommendation. The exceptions are the flagged rows underneath that finding,
 *  not the other way round. Each level fills its own parts of the report:
 *
 *    the finding itself      the query card, one stamp per query
 *    report count boxes      exception counts added up across the queries
 *    a finding's own counts  that query's exception counts
 *    evidence annexures      that query's exception rows, in their layout
 */
export interface ReportFacts {
  /** The findings pool: one entry per query card, in report order. */
  findings: CardFinding[];
  /** Report-level numbers a stat strip can carry, by canonical concept. */
  metrics: Partial<Record<MetricKey, string>>;
  /** The report's own details, for fill-in slots on a letterhead. */
  details: Partial<Record<DetailKey, string>>;
  /** The category tags this report's queries carry, which is where a draft
   *  in-scope list comes from. What was EXCLUDED is never in here: that was
   *  decided before the queries ran. */
  categories: string[];
  /** The exception rows behind the findings — the query output itself, which
   *  is what an evidence annexure prints. */
  evidence: { title: string; columns: string[]; rows: string[][] }[];
  /** Their word for each of ours, from the template this report is printed in.
   *  A count strip captioned in their words resolves through it. */
  scaleMap?: ScaleMap;
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

/** A caption written in the client's own rating word, read back to the count we
 *  hold for it. Their words are the ones printed on their reports, so a count
 *  strip only ever names theirs. */
function theirRatingKey(label: string, map?: ScaleMap): MetricKey | undefined {
  if (!map) return undefined;
  for (const ours of ['high', 'medium', 'low'] as const) {
    const word = map[ours];
    if (word && new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(label)) return ours;
  }
  return undefined;
}

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
/** A grid straight out of the query: an evidence annexure's own records, or the
 *  in-scope list. Their columns, our rows. */
export type BoundGrid = { kind: 'grid'; columns: string[]; rows: string[][] };
export type BoundNone = { kind: 'none' };
export type Bound = (BoundRows | BoundCells | BoundGrid | BoundNone) & {
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
 *
 * THE FILLING STEP CAN ONLY FILL WHAT EXTRACTION KEPT AND BOUND. A part left
 * out at the check screen can never be filled here, however much data exists
 * for it, and neither can a part the client settled as fixed wording, as a
 * person's to write, or as one with nothing connected. So the answer to "why is
 * this not filled by the query?" is always the same: look at what was kept and
 * bound, never at the data.
 */
export function resolveBlock(block: TemplateBlock, facts?: ReportFacts): Bound {
  if (!facts) return { kind: 'none', empty: true, emptyMessage: '' };
  if (block.fill !== 'query') return { kind: 'none', empty: true, emptyMessage: '' };
  const source = sourceOf(block);
  // A severity split names its rating in THEIR word ("Observations — Moderate"),
  // so it is read back to ours before the findings are filtered. Their word is
  // also the one the empty state says, because it is their document.
  const theirSplit = block.severity?.trim();
  const severity = theirSplit
    ? (theirRatingKey(theirSplit, facts.scaleMap) ?? theirSplit.toLowerCase())
    : undefined;

  if (source === 'findings' || source === 'actions') {
    const rows = facts.findings.filter(f => !severity || (f.severity ?? '').toLowerCase() === severity);
    return {
      kind: 'rows',
      rows,
      empty: rows.length === 0,
      emptyMessage: severity
        ? `No ${theirSplit}-rated findings in this report. This section fills itself the moment one is raised.`
        : source === 'actions'
          ? 'No actions yet. This table is built from the findings, so it fills as they are raised.'
          : 'No findings in this report yet. This section fills itself the moment one is raised.',
    };
  }

  if (source === 'metrics') {
    const labels = block.slotLabels?.length ? block.slotLabels : [block.label ?? 'Metric'];
    const cells = labels.map(label => {
      // Their own rating word answers first: a strip captioned "Priority 1"
      // counts the findings we rate high, and no wording of ours matches it.
      const key = theirRatingKey(label, facts.scaleMap) ?? METRIC_WORDS.find(m => m.re.test(label))?.key;
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

  // The in-scope list: a draft, built from the category tags the report's
  // queries carry. Never a claim about what was left out — that decision was
  // taken before the queries ran, so the client writes it.
  if (source === 'scope') {
    const rows = facts.categories.map(c => [c]);
    return {
      kind: 'grid',
      columns: block.columns?.length ? block.columns : ['In scope'],
      rows,
      empty: rows.length === 0,
      emptyMessage: 'This fills with the areas your queries cover once the report has some. Anything deliberately left out is yours to add.',
    };
  }

  // An evidence annexure: the exception rows behind ONE finding, printed in
  // their annexure layout. Amounts in here are our own query output.
  //
  // Which finding's rows? The annexure's own place in the report. Annexure 1
  // belongs to the first finding, annexure 2 to the second — printing the first
  // finding's records under every annexure is the same document three times.
  if (source === 'evidence') {
    const mine = facts.evidence[block.evidenceIndex ?? 0];
    return {
      kind: 'grid',
      columns: mine?.columns ?? block.columns ?? [],
      rows: mine?.rows ?? [],
      empty: !mine || mine.rows.length === 0,
      emptyMessage: 'This fills with the records behind the finding it belongs to, straight from the query that raised it.',
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

/** The finding's headline: the query's own title, cut at its first break. A
 *  card carries a headline and a narrative, and the whole descriptor sentence
 *  in the headline slot reads as a paragraph in bold. */
function headline(title: string | undefined, fallback: string): string {
  const raw = (title ?? '').trim();
  if (!raw) return fallback;
  const cut = raw.split(/(?<=[.?!])\s|\s[—–]\s|,\s(?=[a-z])/)[0].trim().replace(/[.:;,]$/, '');
  return cut.length >= 12 ? cut.slice(0, 110) : raw.slice(0, 110);
}

/**
 * Read the report's queries into the pool every bound block draws from.
 *
 * ONE QUERY CARD IS ONE FINDING. Its rating, its written finding and its
 * recommendation are the finding; the flagged rows under it are its exceptions,
 * which give it its own counts and its evidence annexure. Where an auditor cuts
 * finer than that — promoting a group of exceptions into its own observation
 * through Manage Exceptions — the split arrives here as another query card, so
 * the stamp fires once per observation however they cut them.
 */
export function buildReportFacts(
  queries: {
    severity: string; findings: string[]; observations: string[];
    /** The query's category tag, which is what a draft in-scope list is made of. */
    risk?: string;
    title?: string;
    /** The query's own KPI tiles: this finding's exception counts. */
    kpis?: { label: string; value: string }[];
    /** A bulk run's own output table: the exception rows themselves. */
    outputTable?: { columns: string[]; rows: (string | number)[][] };
  }[],
  report: { name?: string; generatedAt?: string; reportPeriod?: string; id?: string | number; generatedBy?: string },
  stats?: { label: string; value: string }[],
  scaleMap?: ScaleMap,
): ReportFacts {
  /** One query's own exception counts, read off its tiles by meaning. */
  const countsOf = (kpis?: { label: string; value: string }[]) => {
    if (!kpis?.length) return undefined;
    const pick = (re: RegExp) => kpis.find(k => re.test(k.label))?.value;
    const counts = {
      total: pick(/\b(total|flagged|found|changes|records?|exceptions?|rows?)\b/i),
      // A state, never a category: "unauthorised" says what kind of exception
      // it is, not whether anyone has dealt with it.
      open: pick(/\b(open|pending|outstanding|unresolved)\b/i),
      closed: pick(/\b(closed|resolved|verified|reviewed|remediated)\b/i),
    };
    return counts.total || counts.open || counts.closed ? counts : undefined;
  };

  const findings: CardFinding[] = queries.map((q, i) => ({
    title: headline(q.title, q.findings?.[0] ?? `Finding ${i + 1}`),
    severity: q.severity,
    // The written finding, as the query card states it.
    narrative: (q.findings ?? []).join(' '),
    recommendation: (q.observations ?? []).join(' ') || undefined,
    counts: countsOf(q.kpis),
    evidence: q.outputTable
      ? {
        title: q.title ?? '',
        columns: q.outputTable.columns,
        rows: q.outputTable.rows.map(r => r.map(cell => String(cell))),
      }
      : undefined,
  }));

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
  // A report-level count box counts exceptions across every finding. The tiles
  // above answer first when the report shows one; otherwise the findings' own
  // counts add up to the same number.
  const sum = (pick: (c: NonNullable<CardFinding['counts']>) => string | undefined) => {
    const values = findings.flatMap(f => {
      const raw = f.counts ? pick(f.counts) : undefined;
      const n = raw ? Number(raw.replace(/[^\d.-]/g, '')) : NaN;
      return Number.isFinite(n) ? [n] : [];
    });
    return values.length ? String(values.reduce((a, b) => a + b, 0)) : undefined;
  };
  metrics.exceptions ??= sum(c => c.total);
  metrics.open ??= sum(c => c.open);
  metrics.closed ??= sum(c => c.closed);

  return {
    findings,
    metrics,
    scaleMap,
    // The categories the queries carry, deduped and in the order they appear —
    // the draft in-scope list.
    categories: [...new Set(queries.map(q => q.risk).filter((r): r is string => !!r && r.trim().length > 0))],
    // Query output, kept as it came, IN FINDING ORDER: annexure n prints the
    // nth finding's rows, so the two lists have to be the same list.
    evidence: findings.flatMap(f => (f.evidence ? [f.evidence] : [])),
    details: {
      title: report.name,
      date: report.generatedAt,
      period: report.reportPeriod,
      reference: report.id !== undefined ? String(report.id).toUpperCase() : undefined,
      preparedBy: report.generatedBy,
    },
  };
}
