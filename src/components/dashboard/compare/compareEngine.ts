import { buildWidgetRows, colByName, dateExtent, sortTimeRows, tableById, timeRank } from '../model/joinEngine';
import { localeFor } from '../model/chartTokens';
import type { ModelChartData, ModelFilter, ModelTable, Relationship, WidgetModelConfig } from '../model/relationshipTypes';
import { daysIn, periodSidesOf } from './comparePresets';
import { metricKey, polarityFor, toneFor } from './polarity';
import type {
  CompareCaveat, CompareConfig, CompareResult, CompareSide, DeltaStat, MergedRow, MetricKey, Polarity,
  ResolvedCompare, SeriesCompareResult, SeriesRow, WidgetCompareOverride,
} from './compareTypes';

// ─── The compare engine ───
// Runs a widget's own query twice — once per side — through the same join /
// aggregate engine every widget already uses, then lines the two answers up
// and works out what moved. Nothing here invents numbers.

/** Every 'date'-typed column in the model — a period side filters on all of
 *  them; joinEngine ignores those on tables the widget cannot reach. */
export function dateColumns(tables: ModelTable[]): { table: string; column: string }[] {
  return tables.flatMap(t => t.columns.filter(c => c.type === 'date').map(c => ({ table: t.id, column: c.name })));
}

/** "Today" for a model: its latest dated row, so presets like "this month"
 *  land on data that exists. Falls back to the seed clock (Sep 2026). */
export function compareClock(tables: ModelTable[]): Date {
  const ext = dateExtent(tables);
  return ext ? new Date(`${ext.max}T00:00:00Z`) : new Date(Date.UTC(2026, 8, 15));
}

/** A side as extra ModelFilters. */
export function sideFilters(side: CompareSide, tables: ModelTable[]): ModelFilter[] {
  if (side.kind === 'entity') return [{ table: side.table, column: side.column, values: [side.value] }];
  return dateColumns(tables).map(dc => ({ table: dc.table, column: dc.column, values: [], range: { from: side.from, to: side.to } }));
}

const isDateish = (tables: ModelTable[], table: string, column: string): boolean => {
  if (table === 'calendar') return true;
  return colByName(tableById(tables, table), column)?.type === 'date';
};

/** Page filters that would fight the comparison: a slicer on the very
 *  dimension being compared, or any date / calendar filter during a period
 *  compare. They are suppressed for compare-enabled widgets (and reported). */
export function conflictingFilters(base: ModelFilter[], a: CompareSide, b: CompareSide, tables: ModelTable[]): ModelFilter[] {
  return base.filter(f => {
    for (const s of [a, b]) {
      if (s.kind === 'entity' && s.table === f.table && s.column === f.column) return true;
      if (s.kind === 'period' && isDateish(tables, f.table, f.column)) return true;
    }
    return false;
  });
}

/** usageDeltaPct semantics: percent is undefined (null) when the baseline is 0. */
export function delta(cur: number, prev: number): { delta: number; pct: number | null } {
  const d = cur - prev;
  return { delta: d, pct: prev === 0 ? null : Math.round((d / Math.abs(prev)) * 1000) / 10 };
}
export function deltaStat(a: number, b: number, polarity: Polarity): DeltaStat {
  const { delta: d, pct } = delta(b, a);
  return { a, b, delta: d, pct, tone: toneFor(polarity, d), polarity };
}

/** Positional alignment when both sides are periods and the widget's first
 *  dimension is time (May's single row pairs with Aug's); label alignment
 *  otherwise (Finance row pairs with Finance row). */
export function chooseAlignment(model: WidgetModelConfig, a: CompareSide, b: CompareSide, tables: ModelTable[]): 'label' | 'position' {
  if (a.kind !== 'period' || b.kind !== 'period') return 'label';
  const dim = model.fields.find(f => f.role === 'dimension');
  if (!dim) return 'label';
  return isDateish(tables, dim.table, dim.column) ? 'position' : 'label';
}

const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v) || 0);

export { sortTimeRows };

export function alignRows(a: ModelChartData, b: ModelChartData, alignBy: 'label' | 'position', polarityOf: (series: string) => Polarity): MergedRow[] {
  const series = a.series.length ? a.series : b.series;
  const stat = (ra: Record<string, unknown> | undefined, rb: Record<string, unknown> | undefined, s: string) =>
    deltaStat(ra ? num(ra[s]) : 0, rb ? num(rb[s]) : 0, polarityOf(s));
  if (alignBy === 'position') {
    const n = Math.max(a.rows.length, b.rows.length);
    return Array.from({ length: n }, (_, i) => {
      const ra = a.rows[i], rb = b.rows[i];
      const labelA = ra?.label, labelB = rb?.label;
      return {
        label: labelA && labelB ? (labelA === labelB ? labelA : `${labelA} · ${labelB}`) : (labelA ?? labelB ?? `#${i + 1}`),
        labelA, labelB,
        presentIn: ra && rb ? 'both' : ra ? 'a' : 'b',
        values: Object.fromEntries(series.map(s => [s, stat(ra, rb, s)])),
      };
    });
  }
  const order: string[] = [];
  const seen = new Set<string>();
  [...a.rows, ...b.rows].forEach(r => { if (!seen.has(r.label)) { seen.add(r.label); order.push(r.label); } });
  const byA = new Map(a.rows.map(r => [r.label, r])), byB = new Map(b.rows.map(r => [r.label, r]));
  return order.map(label => {
    const ra = byA.get(label), rb = byB.get(label);
    return { label, labelA: ra?.label, labelB: rb?.label, presentIn: ra && rb ? 'both' : ra ? 'a' : 'b', values: Object.fromEntries(series.map(s => [s, stat(ra, rb, s)])) };
  });
}

export interface RunCompareOptions { polarity: Record<MetricKey, Polarity>; normalizePerDay?: boolean }

export function runCompare(
  tables: ModelTable[], rels: Relationship[], model: WidgetModelConfig,
  baseFilters: ModelFilter[], resolved: ResolvedCompare, opts: RunCompareOptions,
): CompareResult {
  const { a, b } = resolved;
  const caveats: CompareCaveat[] = [];

  // 1. Drop page filters that would fight the comparison.
  const conflicts = conflictingFilters(baseFilters, a, b, tables);
  conflicts.forEach(f => caveats.push({ kind: 'suppressed-filter', table: f.table, column: f.column, label: colByName(tableById(tables, f.table), f.column)?.label ?? f.column }));
  const base = baseFilters.filter(f => !conflicts.includes(f));

  // 2. Period sides need a date column the widget can reach.
  const widgetTables = [...new Set(model.fields.map(f => f.table))];
  if ((a.kind === 'period' || b.kind === 'period') && dateColumns(tables).length === 0) caveats.push({ kind: 'no-date-column', tables: widgetTables });

  // 3. Run the widget's own query per side.
  const dataA = sortTimeRows(buildWidgetRows(tables, rels, model, [...base, ...sideFilters(a, tables)]));
  const dataB = sortTimeRows(buildWidgetRows(tables, rels, model, [...base, ...sideFilters(b, tables)]));
  const series = dataA.series.length ? dataA.series : dataB.series;

  // 4. Series label → metric key → polarity.
  const measures = model.fields.filter(f => f.role === 'measure');
  const seriesMetricKey: Record<string, MetricKey> = {};
  series.forEach((s, i) => { const m = measures[i]; seriesMetricKey[s] = m ? metricKey(m.table, m.column) : `count.${widgetTables[0]}`; });
  const polarityOf = (s: string) => polarityFor(seriesMetricKey[s], opts.polarity, s);

  // 5. Totals per series — an ungrouped re-run keeps averages honest.
  const totalsModel: WidgetModelConfig = { fields: measures.length ? measures : model.fields.filter(f => f.role !== 'dimension') };
  const totA = buildWidgetRows(tables, rels, totalsModel.fields.length ? totalsModel : model, [...base, ...sideFilters(a, tables)]);
  const totB = buildWidgetRows(tables, rels, totalsModel.fields.length ? totalsModel : model, [...base, ...sideFilters(b, tables)]);
  const sumOf = (d: ModelChartData, s: string) => d.rows.reduce((acc, r) => acc + num(r[s]), 0);
  let scaleA = 1, scaleB = 1;
  if (a.kind === 'period' && b.kind === 'period') {
    const da = daysIn({ from: a.from, to: a.to }), db = daysIn({ from: b.from, to: b.to });
    if (Math.abs(da - db) / Math.max(da, db) > 0.1) caveats.push({ kind: 'range-length', aDays: da, bDays: db });
    if (opts.normalizePerDay) { scaleA = 1 / da; scaleB = 1 / db; }
  }
  const kpi: Record<string, DeltaStat> = Object.fromEntries(series.map(s => [s, deltaStat(round1(sumOf(totA, s) * scaleA), round1(sumOf(totB, s) * scaleB), polarityOf(s))]));

  // 6. Line the two answers up.
  const alignBy = chooseAlignment(model, a, b, tables);
  const merged = alignRows(dataA, dataB, alignBy, polarityOf);

  if (dataA.rows.length === 0) caveats.push({ kind: 'no-data', side: 'a' });
  if (dataB.rows.length === 0) caveats.push({ kind: 'no-data', side: 'b' });
  const firstDim = model.fields.find(f => f.role === 'dimension');
  if (firstDim && [a, b].some(s => s.kind === 'entity' && s.table === firstDim.table && s.column === firstDim.column)) caveats.push({ kind: 'entity-dimension-on-axis' });

  return { a: dataA, b: dataB, series, seriesMetricKey, alignBy, merged, kpi, caveats, error: dataA.error ?? dataB.error };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

// ─── Series mode: three periods or more ───
// The same widget query, run once per period, then read two ways: down the
// periods (how the total moved, step by step) and across them (how each
// category moved). Nothing is averaged behind the user's back.

/** 'Jan 2022' → 'Jan' when every side carries its own year — the axis of a
 *  positional alignment is the position, not the date. */
const stripYear = (label: string): string => label.replace(/\s+\d{4}$/, '').trim() || label;

export function runSeriesCompare(
  tables: ModelTable[], rels: Relationship[], model: WidgetModelConfig,
  baseFilters: ModelFilter[], resolved: ResolvedCompare, opts: RunCompareOptions,
): SeriesCompareResult {
  const sides = resolved.sides;
  const caveats: CompareCaveat[] = [];

  // 1. Page filters that would fight the comparison (same rule as A/B).
  const conflicts = conflictingFilters(baseFilters, sides[0], sides[sides.length - 1], tables);
  conflicts.forEach(f => caveats.push({ kind: 'suppressed-filter', table: f.table, column: f.column, label: colByName(tableById(tables, f.table), f.column)?.label ?? f.column }));
  const base = baseFilters.filter(f => !conflicts.includes(f));

  const widgetTables = [...new Set(model.fields.map(f => f.table))];
  if (dateColumns(tables).length === 0) caveats.push({ kind: 'no-date-column', tables: widgetTables });

  // 2. One run per period.
  const perPeriod = sides.map(s => sortTimeRows(buildWidgetRows(tables, rels, model, [...base, ...sideFilters(s, tables)])));
  const series = perPeriod.find(d => d.series.length)?.series ?? [];
  const measures = model.fields.filter(f => f.role === 'measure');
  const seriesMetricKey: Record<string, MetricKey> = {};
  series.forEach((s, i) => { const m = measures[i]; seriesMetricKey[s] = m ? metricKey(m.table, m.column) : `count.${widgetTables[0]}`; });
  const polarityOf = (s: string) => polarityFor(seriesMetricKey[s], opts.polarity, s);

  // 3. Whole-widget totals per period — an ungrouped re-run keeps averages honest.
  const totalsModel: WidgetModelConfig = { fields: measures.length ? measures : model.fields.filter(f => f.role !== 'dimension') };
  const totals: Record<string, number[]> = Object.fromEntries(series.map(s => [s, [] as number[]]));
  sides.forEach((s, i) => {
    const d = buildWidgetRows(tables, rels, totalsModel.fields.length ? totalsModel : model, [...base, ...sideFilters(s, tables)]);
    const scale = opts.normalizePerDay && s.kind === 'period' ? 1 / daysIn({ from: s.from, to: s.to }) : 1;
    series.forEach(k => { totals[k][i] = round1(d.rows.reduce((acc, r) => acc + num(r[k]), 0) * scale); });
  });

  // 4. Down the periods: each against the one before, and last against first.
  const steps: Record<string, (DeltaStat | null)[]> = {};
  const span: Record<string, DeltaStat> = {};
  series.forEach(k => {
    const t = totals[k];
    steps[k] = t.map((v, i) => (i === 0 ? null : deltaStat(t[i - 1], v, polarityOf(k))));
    span[k] = deltaStat(t[0] ?? 0, t[t.length - 1] ?? 0, polarityOf(k));
  });

  // 5. Across the periods. A widget whose own axis collapses to a single point
  //    inside each period (a month chart read monthly) becomes a period axis;
  //    otherwise it keeps its axis and each period is a series on it.
  const widest = Math.max(0, ...perPeriod.map(d => d.rows.length));
  const firstDim = model.fields.find(f => f.role === 'dimension');
  // A time axis inside each period ("Jan 2022 … Dec 2022") is the year-over-year
  // case: strip the year and the periods stack on one Jan–Dec axis. Positional
  // alignment is the fallback for raw dates, which carry no readable label.
  const timeish = widest > 1 && perPeriod.some(d => d.rows.length > 0)
    && perPeriod.every(d => d.rows.every(r => timeRank(stripYear(String(r.label))) !== null));
  const byPos = !timeish && !!firstDim && isDateish(tables, firstDim.table, firstDim.column);
  const axis: 'periods' | 'category' = widest <= 1 ? 'periods' : 'category';
  const xLabel = axis === 'periods' ? 'Period' : (perPeriod.find(d => d.rows.length)?.xLabel ?? 'Category');

  const rows: SeriesRow[] = [];
  if (axis === 'periods') {
    // One row per period: the period is the category.
    sides.forEach((s, i) => {
      rows.push({
        label: s.label,
        values: Object.fromEntries(series.map(k => [k, sides.map((_, j) => (j === i ? totals[k][i] : null))])),
        span: Object.fromEntries(series.map(k => [k, deltaStat(i === 0 ? totals[k][0] : totals[k][i - 1], totals[k][i], polarityOf(k))])),
      });
    });
  } else {
    const key = (label: string) => (timeish ? stripYear(label) : label);
    const order: string[] = [];
    const seen = new Set<string>();
    if (byPos) {
      for (let i = 0; i < widest; i++) {
        const src = perPeriod.find(d => d.rows[i]);
        order.push(src ? stripYear(String(src.rows[i].label)) : `#${i + 1}`);
      }
    } else {
      perPeriod.forEach(d => d.rows.forEach(r => { const k = key(String(r.label)); if (!seen.has(k)) { seen.add(k); order.push(k); } }));
      if (timeish) order.sort((x, y) => (timeRank(x) ?? 0) - (timeRank(y) ?? 0));
    }
    order.forEach((label, i) => {
      const at = (p: ModelChartData): Record<string, unknown> | undefined => (byPos ? p.rows[i] : p.rows.find(r => key(String(r.label)) === label));
      const values: Record<string, (number | null)[]> = {};
      series.forEach(k => { values[k] = perPeriod.map(p => { const r = at(p); return r ? num(r[k]) : null; }); });
      rows.push({
        label,
        values,
        span: Object.fromEntries(series.map(k => {
          const v = values[k];
          const firstSeen = v.find(x => x !== null) ?? 0;
          const lastSeen = [...v].reverse().find(x => x !== null) ?? 0;
          return [k, deltaStat(firstSeen, lastSeen, polarityOf(k))];
        })),
      });
    });
  }

  // A period with no rows at all is the source's own gap, not a collapse — say so.
  const emptyLabels = sides.filter((_, i) => perPeriod[i].rows.length === 0).map(s => s.label);
  if (emptyLabels.length === perPeriod.length) caveats.push({ kind: 'no-data', side: 'a' });
  else if (emptyLabels.length > 0) caveats.push({ kind: 'empty-periods', labels: emptyLabels, of: sides.length });
  const lengths = sides.filter(s => s.kind === 'period').map(s => daysIn({ from: (s as { from: string }).from, to: (s as { to: string }).to }));
  if (lengths.length > 1 && !opts.normalizePerDay) {
    const lo = Math.min(...lengths), hi = Math.max(...lengths);
    if ((hi - lo) / hi > 0.1) caveats.push({ kind: 'range-length', aDays: lo, bDays: hi });
  }

  return {
    sides, series, seriesMetricKey, axis, xLabel, rows, totals, steps, span, perPeriod, caveats,
    error: perPeriod.find(d => d.error)?.error,
  };
}

/** What a widget compares, after its override: null = plain render. A pinned
 *  widget is always two-sided; the dashboard may be a whole series. */
export function resolveCompare(dashboard: CompareConfig, override?: WidgetCompareOverride): ResolvedCompare | null {
  if (override?.mode === 'off') return null;
  if (override?.mode === 'pin') return { a: override.a, b: override.b, sides: [override.a, override.b], chartMode: override.chartMode ?? dashboard.chartMode, source: 'widget' };
  if (!dashboard.enabled) return null;
  const chartMode = override?.chartMode ?? dashboard.chartMode;
  const sides = dashboard.periods ? periodSidesOf(dashboard.periods) : [];
  if (sides.length > 2) return { a: sides[0], b: sides[sides.length - 1], sides, chartMode, source: 'dashboard' };
  return { a: dashboard.a, b: dashboard.b, sides: [dashboard.a, dashboard.b], chartMode, source: 'dashboard' };
}

// ─── Formatting ───

const MINUS = '−';
/** Grouping follows the currency in the series label (₹ → en-IN, $ → en-US);
 *  ₹ is carried as a prefix; one decimal only when needed. */
export function formatValue(v: number, seriesLabel = ''): string {
  const rupee = seriesLabel.includes('₹');
  const locale = localeFor(seriesLabel);
  const abs = Math.abs(v);
  const s = abs >= 1000 || Number.isInteger(abs) ? Math.round(abs).toLocaleString(locale) : abs.toLocaleString(locale, { maximumFractionDigits: 1 });
  return `${v < 0 ? MINUS : ''}${rupee ? '₹' : ''}${s}`;
}
export function formatSigned(v: number, seriesLabel = ''): string {
  if (v === 0) return '±0';
  return `${v > 0 ? '+' : MINUS}${formatValue(Math.abs(v), seriesLabel)}`;
}
export function formatPct(pct: number | null, a: number): string {
  if (pct === null) return a === 0 ? 'new' : '—';
  if (pct === 0) return '0%';
  const abs = Math.abs(pct);
  return `${pct > 0 ? '+' : MINUS}${abs >= 100 ? Math.round(abs) : abs}%`;
}
export function formatDelta(stat: DeltaStat, seriesLabel = ''): { a: string; b: string; delta: string; pct: string } {
  return { a: formatValue(stat.a, seriesLabel), b: formatValue(stat.b, seriesLabel), delta: formatSigned(stat.delta, seriesLabel), pct: formatPct(stat.pct, stat.a) };
}
