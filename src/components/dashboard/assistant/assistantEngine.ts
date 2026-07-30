// ─── Dashboard AI Assistant — the "Ira" engine ───
// A deterministic natural-language engine that drives the dashboard by prompt:
// it analyses the REAL model data (MODEL_TABLES via the same buildWidgetRows /
// join engine the widgets use), answers analytical questions with real numbers,
// creates any widget in the chart catalogue, applies/clears page filters, and
// explains individual widgets. It honours the current filter context so its
// answers always match what's on screen.
//
// The engine is PURE: runAssistant() returns an AssistantResult describing the
// reply plus any action to perform (create a widget, set a filter, clear filters).
// DashboardView executes those actions against its real state.

import { MODEL_TABLES, DEFAULT_RELATIONSHIPS } from '../model/modelData';
import { buildWidgetRows, distinctValues, AGG_LABEL, colByName, tableById } from '../model/joinEngine';
import type { ModelTable, Relationship, ModelFilter, WidgetModelField, WidgetModelConfig, AggFn } from '../model/relationshipTypes';

// ─────────────────────────────────────────────────────────────────────────────
// The system prompt — the assistant's charter. This is the "well thought prompt"
// that defines Ira's role, capabilities, tools and behaviour. In this prototype
// the intents below implement it deterministically over real data; the same
// prompt is LLM-ready if a model backend is wired in later.
// ─────────────────────────────────────────────────────────────────────────────
export const ASSISTANT_SYSTEM_PROMPT = `You are **Ira**, the AI analyst embedded in the iRAME dashboard. You help the user
understand and operate their dashboard entirely through conversation.

## Who you are
A sharp, concise data analyst for governance, risk & compliance. You speak plainly,
lead with the number or the action, and never invent data — every figure you quote
comes from the live dashboard data model.

## What you can do (your tools)
1. ANALYSE DATA — answer any question about the data with real, computed numbers:
   totals, averages, counts, breakdowns by any dimension, top/bottom-N rankings,
   distributions, month/quarter trends, and comparisons. Always honour the filters
   currently applied to the page.
2. CREATE WIDGETS — build any visual in the catalogue from a prompt:
   KPI, Bar / Column, Line, Area, Pie, Table, and Slicer. Infer the measure,
   dimension and aggregation from the request (e.g. "amount by region as a pie").
3. EXPLAIN A WIDGET — when the user asks about a specific widget (or one is focused),
   describe what it shows, its highest/lowest categories, total and any notable skew.
4. FILTER THE PAGE — apply or clear slicer-style filters ("show only flagged",
   "filter region to North", "clear filters"). Filters cascade to every related widget.
5. SUMMARISE — give a dashboard-level briefing: key totals, risk exposure, the
   biggest contributors and anything that stands out.

## The data model (star schema)
- Invoices (fact): Status (Closed/Flagged/Open), Invoice Amount ₹, Amount at Risk ₹,
  Duplicate Count — linked to Vendors, Departments, Calendar, Payment Methods.
- Vendors: Vendor Name, Region (North/South/East/West), Risk Score.
- Departments: Department, Owner. Calendar: Month, Quarter, Year.
- Payment Methods: Method, Channel.

## How you answer
- Lead with the answer. One or two tight sentences, then supporting detail if useful.
- Quote real numbers; format money in ₹ with Indian grouping.
- When you create a widget or change a filter, say what you did in one line.
- If a request is ambiguous, make the most reasonable assumption and state it.
- Offer 2-3 relevant follow-up suggestions when helpful.
- If something is outside the data (no such field), say so briefly and suggest what IS available.`;

// ─── Field dictionary ───────────────────────────────────────────────────────

interface MeasureDef { table: string; column: string; label: string; defaultAgg: AggFn; money?: boolean; synonyms: string[]; }
interface DimensionDef { table: string; column: string; label: string; synonyms: string[]; }

const MEASURES: MeasureDef[] = [
  { table: 'invoices', column: 'Amount', label: 'Invoice Amount (₹)', defaultAgg: 'sum', money: true, synonyms: ['invoice amount', 'invoiced amount', 'invoice value', 'amount', 'spend', 'spending', 'value', 'invoiced'] },
  { table: 'invoices', column: 'AmountAtRisk', label: 'Amount at Risk (₹)', defaultAgg: 'sum', money: true, synonyms: ['amount at risk', 'at risk', 'risk amount', 'exposure', 'amount-at-risk'] },
  { table: 'invoices', column: 'DuplicateCount', label: 'Duplicate Count', defaultAgg: 'sum', synonyms: ['duplicate count', 'duplicates', 'duplicate', 'dupes', 'dupe count'] },
  { table: 'vendors', column: 'RiskScore', label: 'Risk Score', defaultAgg: 'avg', synonyms: ['risk score', 'riskiness', 'vendor risk', 'risk rating'] },
  { table: 'payments', column: 'Amount', label: 'Paid Amount (₹)', defaultAgg: 'sum', money: true, synonyms: ['paid amount', 'payment amount', 'paid', 'payments'] },
];

const DIMENSIONS: DimensionDef[] = [
  { table: 'vendors', column: 'Region', label: 'Region', synonyms: ['region', 'regions', 'area', 'zone', 'geography'] },
  { table: 'vendors', column: 'VendorName', label: 'Vendor Name', synonyms: ['vendor name', 'vendor', 'vendors', 'supplier', 'suppliers'] },
  { table: 'departments', column: 'Department', label: 'Department', synonyms: ['department', 'departments', 'dept', 'function'] },
  { table: 'departments', column: 'Owner', label: 'Owner', synonyms: ['owner', 'owners'] },
  { table: 'invoices', column: 'Status', label: 'Status', synonyms: ['status', 'state'] },
  { table: 'calendar', column: 'Month', label: 'Month', synonyms: ['month', 'months', 'monthly'] },
  { table: 'calendar', column: 'Quarter', label: 'Quarter', synonyms: ['quarter', 'quarters', 'quarterly'] },
  { table: 'calendar', column: 'Year', label: 'Year', synonyms: ['year', 'years', 'yearly'] },
  { table: 'paymentMethods', column: 'Method', label: 'Method', synonyms: ['payment method', 'method', 'methods'] },
  { table: 'paymentMethods', column: 'Channel', label: 'Channel', synonyms: ['channel', 'channels'] },
];

// Chart catalogue — the prompt-recognised aliases → the stored chartType label
// (what ModelChart renders on, via type.toLowerCase().includes(...)).
const CHART_TYPES: { type: string; aliases: string[] }[] = [
  { type: 'KPI', aliases: ['kpi', 'kpis', 'scorecard', 'metric card', 'single number'] },
  { type: 'Bar Chart', aliases: ['bar chart', 'bar', 'column chart', 'column', 'clustered column', 'stacked bar'] },
  { type: 'Line Chart', aliases: ['line chart', 'line', 'trend line'] },
  { type: 'Area Chart', aliases: ['area chart', 'area'] },
  { type: 'Pie Chart', aliases: ['pie chart', 'pie', 'donut', 'doughnut'] },
  { type: 'Table', aliases: ['table', 'grid'] },
  { type: 'Slicer', aliases: ['slicer', 'filter widget', 'slicer widget'] },
];

const AGG_WORDS: { agg: AggFn; words: string[] }[] = [
  { agg: 'avg', words: ['average', 'avg', 'mean'] },
  { agg: 'sum', words: ['total', 'sum', 'sum of', 'combined'] },
  { agg: 'max', words: ['maximum', 'max', 'largest'] },
  { agg: 'min', words: ['minimum', 'min', 'smallest'] },
  { agg: 'countDistinct', words: ['distinct', 'unique'] },
  { agg: 'count', words: ['count', 'number of', 'how many'] },
];

// ─── result + context types ─────────────────────────────────────────────────

export interface UserWidget {
  chartType: string;
  title: string;
  xField: string;
  yField: string;
  color?: string;
  model?: WidgetModelConfig;
  slicerMode?: string;
}

export type AssistantAction =
  | { kind: 'createWidget'; widget: UserWidget }
  | { kind: 'setFilter'; table: string; column: string; label: string; values: (string | number)[] }
  | { kind: 'clearFilters' };

export interface AssistantResult {
  text: string;
  table?: { columns: string[]; rows: (string | number)[][] };
  action?: AssistantAction;
  suggestions?: string[];
}

export interface AssistantContext {
  tables?: ModelTable[];
  relationships?: Relationship[];
  /** Filters currently applied to the page (so answers match the screen). */
  filters?: ModelFilter[];
  /** A widget the user is asking about (per-widget "Ask AI"). */
  focusedWidget?: UserWidget | null;
  /** Titles of widgets on the dashboard (for summaries / "what's on my dashboard"). */
  widgetTitles?: string[];
}

// ─── formatting ─────────────────────────────────────────────────────────────

const inr = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
const money = (n: number) => `₹${inr(n)}`;
const num = (n: number) => (Number.isInteger(n) ? inr(n) : n.toLocaleString('en-IN', { maximumFractionDigits: 1 }));
const fmtMeasure = (m: MeasureDef, n: number) => (m.money ? money(n) : num(n));

// ─── matching helpers ───────────────────────────────────────────────────────

function findMeasure(text: string): MeasureDef | null {
  let best: { m: MeasureDef; len: number } | null = null;
  for (const m of MEASURES) for (const s of m.synonyms) {
    if (text.includes(s) && (!best || s.length > best.len)) best = { m, len: s.length };
  }
  return best?.m ?? null;
}
/** All dimensions mentioned, in order of first appearance in the prompt. */
function findAllDimensions(text: string): DimensionDef[] {
  const hits: { d: DimensionDef; idx: number }[] = [];
  for (const d of DIMENSIONS) {
    let idx = -1;
    for (const s of d.synonyms) { const i = text.indexOf(s); if (i >= 0 && (idx < 0 || i < idx)) idx = i; }
    if (idx >= 0) hits.push({ d, idx });
  }
  return hits.sort((a, b) => a.idx - b.idx).map(h => h.d);
}
function findChartType(text: string): string | null {
  let best: { type: string; len: number } | null = null;
  for (const c of CHART_TYPES) for (const a of c.aliases) {
    if (text.includes(a) && (!best || a.length > best.len)) best = { type: c.type, len: a.length };
  }
  return best?.type ?? null;
}
function findAgg(text: string): AggFn | null {
  let best: { agg: AggFn; len: number } | null = null;
  for (const g of AGG_WORDS) for (const w of g.words) {
    if (text.includes(w) && (!best || w.length > best.len)) best = { agg: g.agg, len: w.length };
  }
  return best?.agg ?? null;
}

// ─── compute helpers (real data via the join engine) ────────────────────────

function ctxDefaults(ctx: AssistantContext) {
  return {
    tables: ctx.tables ?? MODEL_TABLES,
    rels: ctx.relationships ?? DEFAULT_RELATIONSHIPS,
    filters: ctx.filters ?? [],
  };
}

interface Row { label: string; value: number; }

/** Group a measure by a dimension (or none) and return sorted rows + series label. */
function computeGrouped(ctx: AssistantContext, dim: DimensionDef | null, measure: MeasureDef | null, agg: AggFn): { rows: Row[]; seriesLabel: string; total: number } {
  const { tables, rels, filters } = ctxDefaults(ctx);
  const fields: WidgetModelField[] = [];
  if (dim) fields.push({ table: dim.table, column: dim.column, role: 'dimension' });
  if (measure) fields.push({ table: measure.table, column: measure.column, role: 'measure', agg });
  const config: WidgetModelConfig = { fields };
  const data = buildWidgetRows(tables, rels, config, filters);
  const seriesKey = data.series[0];
  const rows: Row[] = data.rows.map(r => ({ label: r.label, value: Number(r[seriesKey]) || 0 }));
  const seriesLabel = measure ? `${AGG_LABEL[agg]} of ${measure.label}` : 'Count';
  // Total across groups (sum for additive; for avg we recompute the OVERALL
  // average, but only when grouped — guard against infinite recursion when the
  // call is already ungrouped (dim === null).
  let total = rows.reduce((s, r) => s + r.value, 0);
  if (measure && agg === 'avg' && dim) { const flat = computeGrouped(ctx, null, measure, 'avg'); total = flat.rows[0]?.value ?? 0; }
  return { rows, seriesLabel, total };
}

// ─── widget builder ─────────────────────────────────────────────────────────

function buildWidget(chartType: string, dim: DimensionDef | null, measure: MeasureDef | null, agg: AggFn): UserWidget | null {
  if (chartType === 'Slicer') {
    const d = dim ?? DIMENSIONS[0];
    return { chartType: 'Slicer', title: d.label, xField: d.label, yField: '', slicerMode: 'list', model: { fields: [{ table: d.table, column: d.column, role: 'dimension' }] } };
  }
  const fields: WidgetModelField[] = [];
  // KPI: measure only (no dimension needed). Others: dimension + measure.
  if (chartType === 'KPI') {
    const m = measure ?? MEASURES[0];
    fields.push({ table: m.table, column: m.column, role: 'measure', agg });
    return { chartType, title: `${AGG_LABEL[agg]} of ${m.label}`, xField: '', yField: m.label, color: '#6a12cd', model: { fields } };
  }
  const d = dim ?? DIMENSIONS[0];
  const m = measure ?? MEASURES[0];
  fields.push({ table: d.table, column: d.column, role: 'dimension' });
  fields.push({ table: m.table, column: m.column, role: 'measure', agg });
  return { chartType, title: `${m.label} by ${d.label}`, xField: d.label, yField: m.label, color: '#6a12cd', model: { fields } };
}

// ─── intent handlers ────────────────────────────────────────────────────────

const CREATE_RE = /\b(create|add|make|build|generate|insert|plot|draw|visuali[sz]e|show me a|give me a|put)\b/;
const CLEAR_RE = /\b(clear|reset|remove)\b.*\bfilter/;
const FILTER_RE = /\b(filter|show only|only show|show just|where|slice)\b/;
const SUMMARY_RE = /\b(summari[sz]e|summary|overview|briefing|insights?|highlights|tell me about the dashboard|what'?s going on|key (metrics|findings|numbers))\b/;
const EXPLAIN_RE = /\b(explain|describe|analy[sz]e|break ?down|what does|what'?s in|tell me about|insights? on)\b/;
const HELP_RE = /\b(what can you do|help me|how do you work|capabilities|what do you do|commands)\b/;
const TOP_RE = /\b(top|highest|most|largest|biggest|leading|max)\b/;
const BOTTOM_RE = /\b(bottom|lowest|least|smallest|min)\b/;

/** Parse "top 3" / "top N" → count. */
function topN(text: string): number { const m = text.match(/\b(top|bottom)\s+(\d+)/); return m ? Math.max(1, parseInt(m[2], 10)) : 3; }

function suggestFor(measure: MeasureDef | null, dim: DimensionDef | null): string[] {
  const s: string[] = [];
  if (measure && dim) s.push(`Create a bar chart of ${measure.label.replace(/ \(₹\)/, '')} by ${dim.label}`);
  s.push('Summarise the dashboard');
  s.push('Show only flagged invoices');
  return s.slice(0, 3);
}

// ─── the entry point ────────────────────────────────────────────────────────

export function runAssistant(prompt: string, ctx: AssistantContext = {}): AssistantResult {
  const text = ` ${prompt.toLowerCase().trim()} `;

  // 0 — help
  if (HELP_RE.test(text)) {
    return {
      text: `I'm **Irame**, your dashboard analyst. I can:\n• **Analyse** — "total amount at risk", "top 3 vendors by spend", "invoice amount by region", "duplicate count by month"\n• **Create widgets** — "add a pie chart of status", "create a KPI of total amount", "add a slicer on region"\n• **Filter** — "show only flagged", "filter region to North", "clear filters"\n• **Explain** — open a widget's menu → *Ask Ira*, or "explain the amount-by-region chart"\n• **Summarise** — "summarise the dashboard"`,
      suggestions: ['Summarise the dashboard', 'Top 3 vendors by amount', 'Add a pie chart of status'],
    };
  }

  // 1 — clear filters
  if (CLEAR_RE.test(text) || /^\s*(clear|reset)\s+(all\s+)?filters?\s*$/.test(text)) {
    return { text: 'Cleared all page filters — every widget is back to the full data set.', action: { kind: 'clearFilters' } };
  }

  const measure = findMeasure(text);
  const chartType = findChartType(text);
  const dims = findAllDimensions(text);
  const dim = dims[0] ?? null;
  // Detect the aggregation from the prompt, but strip the measure's own words
  // first so a measure like "Duplicate Count" doesn't trigger the COUNT agg.
  let aggText = text;
  if (measure) for (const s of measure.synonyms) aggText = aggText.split(s).join(' ');
  const agg = findAgg(aggText) ?? measure?.defaultAgg ?? 'sum';

  // 2 — create a widget (explicit verb + a chart type or the word widget/chart/graph)
  if (CREATE_RE.test(text) && (chartType || /\b(widget|chart|graph|visual)\b/.test(text))) {
    const type = chartType ?? (dim && !measure ? 'Slicer' : measure && !dim ? 'KPI' : 'Bar Chart');
    const widget = buildWidget(type, dim, measure, agg);
    if (!widget) return { text: "I couldn't tell which field to visualise. Try \"add a bar chart of amount by region\".", suggestions: suggestFor(measure, dim) };
    const what = type === 'Slicer' ? `a **Slicer** on ${widget.title}`
      : type === 'KPI' ? `a **KPI** — ${widget.title}`
      : `a **${type}** — ${widget.title}`;
    return {
      text: `Added ${what} to your dashboard.`,
      action: { kind: 'createWidget', widget },
      suggestions: ['Summarise the dashboard', measure ? `Total ${measure.label.replace(/ \(₹\)/, '')}` : 'Top vendors by amount', 'Show only flagged'],
    };
  }

  // 3 — apply a filter ("show only flagged", "filter region to North")
  if (FILTER_RE.test(text) && !CREATE_RE.test(text)) {
    // Find a dimension + a matching value token in the prompt.
    const { tables } = ctxDefaults(ctx);
    for (const d of (dim ? [dim, ...DIMENSIONS] : DIMENSIONS)) {
      const values = distinctValues(tables, d.table, d.column);
      const matched = values.filter(v => text.includes(` ${String(v).toLowerCase()} `) || text.includes(String(v).toLowerCase()));
      if (matched.length) {
        return {
          text: `Filtered **${d.label}** to ${matched.map(v => `**${v}**`).join(', ')}. Every related widget now reflects this.`,
          action: { kind: 'setFilter', table: d.table, column: d.column, label: d.label, values: matched },
          suggestions: ['Clear filters', 'Summarise the dashboard'],
        };
      }
    }
    return { text: "Tell me the value to filter by — e.g. \"show only flagged\", \"filter region to North\", or \"only the Finance department\".", suggestions: ['Show only flagged', 'Filter region to North', 'Clear filters'] };
  }

  // 4 — explain a specific / focused widget
  if (ctx.focusedWidget && (EXPLAIN_RE.test(text) || /\b(this|that|the)\b.*\b(widget|chart|graph|visual)\b/.test(text) || /\bit\b/.test(text))) {
    return explainWidget(ctx, ctx.focusedWidget);
  }

  // 5 — dashboard summary
  if (SUMMARY_RE.test(text) && !measure && !dim) {
    return summariseDashboard(ctx);
  }

  // 6 — analytical query (needs at least a measure or a dimension)
  if (measure || dim) {
    // 6a — count / how many
    if (/\bhow many\b|\bnumber of\b|\bcount\b/.test(text) && dim && !measure) {
      const { tables } = ctxDefaults(ctx);
      const distinct = distinctValues(tables, dim.table, dim.column).length;
      const g = computeGrouped(ctx, dim, null, 'count');
      const totalRows = g.rows.reduce((s, r) => s + r.value, 0);
      return { text: `There are **${distinct}** distinct ${dim.label.toLowerCase()} value${distinct === 1 ? '' : 's'}${totalRows ? `, across **${num(totalRows)}** record${totalRows === 1 ? '' : 's'}` : ''}.`, suggestions: [`${dim.label} distribution`, 'Summarise the dashboard'] };
    }

    // 6b — top / bottom N ranking by a measure
    if ((TOP_RE.test(text) || BOTTOM_RE.test(text)) && dim && measure) {
      const g = computeGrouped(ctx, dim, measure, agg);
      if (!g.rows.length) return { text: `No data to rank ${dim.label.toLowerCase()} by ${measure.label.replace(/ \(₹\)/, '').toLowerCase()}${ctx.filters?.length ? ' under the current filters' : ''}.` };
      const desc = !BOTTOM_RE.test(text);
      const sorted = [...g.rows].sort((a, b) => desc ? b.value - a.value : a.value - b.value);
      const n = Math.min(topN(text), sorted.length);
      const picked = sorted.slice(0, n);
      const lead = picked[0];
      const verb = desc ? 'highest' : 'lowest';
      return {
        text: `**${lead.label}** has the ${verb} ${measure.label.replace(/ \(₹\)/, '').toLowerCase()} at **${fmtMeasure(measure, lead.value)}**.` + (n > 1 ? ` Top ${n}:` : ''),
        table: n > 1 ? { columns: [dim.label, g.seriesLabel], rows: picked.map(r => [r.label, fmtMeasure(measure, r.value)]) } : undefined,
        suggestions: [`Create a bar chart of ${measure.label.replace(/ \(₹\)/, '')} by ${dim.label}`, 'Summarise the dashboard'],
      };
    }

    // 6c — measure by dimension (breakdown)
    if (measure && dim) {
      const g = computeGrouped(ctx, dim, measure, agg);
      if (!g.rows.length) return { text: `I can't break **${measure.label.replace(/ \(₹\)/, '')}** down by **${dim.label}** — those tables aren't linked in this data model.`, suggestions: [`${measure.label.replace(/ \(₹\)/, '')} by region`, 'Summarise the dashboard'] };
      const sorted = [...g.rows].sort((a, b) => b.value - a.value);
      const top = sorted[0];
      return {
        text: `${g.seriesLabel} by ${dim.label} — total **${fmtMeasure(measure, g.total)}**, led by **${top.label}** (${fmtMeasure(measure, top.value)}).`,
        table: { columns: [dim.label, g.seriesLabel], rows: sorted.map(r => [r.label, fmtMeasure(measure, r.value)]) },
        suggestions: [`Create a bar chart of ${measure.label.replace(/ \(₹\)/, '')} by ${dim.label}`, `Top 3 ${dim.label.toLowerCase()} by ${measure.label.replace(/ \(₹\)/, '').toLowerCase()}`],
      };
    }

    // 6d — a single measure total / average
    if (measure && !dim) {
      const g = computeGrouped(ctx, null, measure, agg);
      const v = g.rows[0]?.value ?? 0;
      const word = agg === 'avg' ? 'Average' : agg === 'max' ? 'Maximum' : agg === 'min' ? 'Minimum' : 'Total';
      return {
        text: `**${word} ${measure.label.replace(/ \(₹\)/, '')}** is **${fmtMeasure(measure, v)}**${ctx.filters?.length ? ' (within the current filters)' : ''}.`,
        suggestions: [`${measure.label.replace(/ \(₹\)/, '')} by region`, `${measure.label.replace(/ \(₹\)/, '')} by month`, `Create a KPI of ${measure.label.replace(/ \(₹\)/, '')}`],
      };
    }

    // 6e — distribution / list of a dimension (no measure)
    if (dim && !measure) {
      const g = computeGrouped(ctx, dim, null, 'count');
      if (!g.rows.length) return { text: `No ${dim.label.toLowerCase()} values under the current filters.` };
      const sorted = [...g.rows].sort((a, b) => b.value - a.value);
      return {
        text: `${dim.label} distribution — ${sorted.length} value${sorted.length === 1 ? '' : 's'}, most common is **${sorted[0].label}** (${num(sorted[0].value)} records).`,
        table: { columns: [dim.label, 'Records'], rows: sorted.map(r => [r.label, num(r.value)]) },
        suggestions: [`Add a slicer on ${dim.label}`, `Invoice amount by ${dim.label.toLowerCase()}`],
      };
    }
  }

  // 7 — fallback
  return {
    text: `I can analyse the data, build widgets and filter the page. Try:\n• "Total amount at risk"\n• "Top 3 vendors by invoice amount"\n• "Add a pie chart of status"\n• "Show only flagged invoices"`,
    suggestions: ['Summarise the dashboard', 'Invoice amount by region', 'Add a pie chart of status'],
  };
}

// ─── widget explanation ─────────────────────────────────────────────────────

export function explainWidget(ctx: AssistantContext, widget: UserWidget): AssistantResult {
  const { tables, rels, filters } = ctxDefaults(ctx);
  if (widget.chartType === 'Slicer') {
    const f = widget.model?.fields?.[0];
    const label = f ? colByName(tableById(tables, f.table), f.column)?.label ?? f.column : widget.title;
    const n = f ? distinctValues(tables, f.table, f.column).length : 0;
    return { text: `**${widget.title}** is a Slicer on **${label}** with ${n} value${n === 1 ? '' : 's'}. Selecting values here filters every related widget on the page.`, suggestions: [`${label} distribution`, 'Summarise the dashboard'] };
  }
  if (!widget.model?.fields?.length) {
    return { text: `**${widget.title}** — I can analyse data-model widgets in detail. This one isn't backed by the data model, so I can only describe it by title.` };
  }
  const data = buildWidgetRows(tables, rels, widget.model, filters);
  const seriesKey = data.series[0];
  const rows = data.rows.map(r => ({ label: r.label, value: Number(r[seriesKey]) || 0 }));
  if (!rows.length) return { text: `**${widget.title}** has no data under the current filters.` };
  const measureField = widget.model.fields.find(f => f.role === 'measure');
  const md = measureField ? MEASURES.find(m => m.table === measureField.table && m.column === measureField.column) : null;
  const fmt = (v: number) => (md ? fmtMeasure(md, v) : num(v));
  const sorted = [...rows].sort((a, b) => b.value - a.value);
  const total = rows.reduce((s, r) => s + r.value, 0);
  const top = sorted[0], bottom = sorted[sorted.length - 1];
  const share = total ? Math.round((top.value / total) * 100) : 0;
  if (widget.chartType === 'KPI') {
    return { text: `**${widget.title}** shows **${fmt(rows[0].value)}**${filters.length ? ' under the current filters' : ''}.`, suggestions: ['Summarise the dashboard'] };
  }
  return {
    text: `**${widget.title}** — ${data.series[0]} across ${rows.length} ${data.xLabel.toLowerCase()}${rows.length === 1 ? '' : 's'}. Total **${fmt(total)}**. Highest is **${top.label}** (${fmt(top.value)}, ${share}% of total); lowest is **${bottom.label}** (${fmt(bottom.value)}).`,
    table: { columns: [data.xLabel, data.series[0]], rows: sorted.slice(0, 6).map(r => [r.label, fmt(r.value)]) },
    suggestions: ['Summarise the dashboard', `Top 3 ${data.xLabel.toLowerCase()}`],
  };
}

// ─── dashboard summary ──────────────────────────────────────────────────────

function summariseDashboard(ctx: AssistantContext): AssistantResult {
  const totalAmt = computeGrouped(ctx, null, MEASURES[0], 'sum').rows[0]?.value ?? 0;
  const atRisk = computeGrouped(ctx, null, MEASURES[1], 'sum').rows[0]?.value ?? 0;
  const dupes = computeGrouped(ctx, null, MEASURES[2], 'sum').rows[0]?.value ?? 0;
  const byStatus = computeGrouped(ctx, DIMENSIONS[4], null, 'count').rows; // Status distribution
  const flagged = byStatus.find(r => r.label === 'Flagged')?.value ?? 0;
  const byRegion = [...computeGrouped(ctx, DIMENSIONS[0], MEASURES[0], 'sum').rows].sort((a, b) => b.value - a.value);
  const topRegion = byRegion[0];
  const byVendorRisk = [...computeGrouped(ctx, DIMENSIONS[1], MEASURES[3], 'avg').rows].sort((a, b) => b.value - a.value);
  const riskiest = byVendorRisk[0];
  const pct = totalAmt ? Math.round((atRisk / totalAmt) * 100) : 0;
  return {
    text: `**Dashboard summary**${ctx.filters?.length ? ' (current filters applied)' : ''}\n` +
      `• **Invoice amount:** ${money(totalAmt)} total\n` +
      `• **At risk:** ${money(atRisk)} (${pct}% of invoiced), across **${num(flagged)}** flagged invoice${flagged === 1 ? '' : 's'} and **${num(dupes)}** duplicates\n` +
      `• **Top region by spend:** ${topRegion?.label} (${money(topRegion?.value ?? 0)})\n` +
      `• **Riskiest vendor:** ${riskiest?.label} (risk score ${num(riskiest?.value ?? 0)})`,
    table: { columns: ['Region', 'Invoice Amount'], rows: byRegion.map(r => [r.label, money(r.value)]) },
    suggestions: ['Top 3 vendors by amount at risk', 'Add a pie chart of status', 'Amount by month'],
  };
}
