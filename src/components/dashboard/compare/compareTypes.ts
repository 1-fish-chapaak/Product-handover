import type { ModelChartData } from '../model/relationshipTypes';

// ─── Dashboard Compare — the vocabulary ───
// A comparison is two "sides", A and B. Each side is either a date range on the
// fact tables' date columns, or one value of a dimension (Finance vs Operations).
// The dashboard holds one CompareConfig; a widget may override it (pin its own
// sides, or opt out). Everything a widget renders in compare mode comes from a
// CompareResult produced by compareEngine.runCompare.

/** How to read a metric's movement. Not every metric follows the same logic:
 *  fewer duplicates is good, more compliance is good, invoice volume is neither. */
export type Polarity = 'higherBetter' | 'lowerBetter' | 'neutral';
export type CompareChartMode = 'overlay' | 'side-by-side';
export type CompareTone = 'good' | 'bad' | 'neutral';

/** `${table}.${column}` — stable across widgets, e.g. 'invoices.AmountAtRisk'. */
export type MetricKey = string;

export type CompareSide =
  | { kind: 'period'; from: string; to: string; label: string }             // ISO yyyy-mm-dd, inclusive
  | { kind: 'entity'; table: string; column: string; value: string | number; label: string };

/** The view a span of time is read in. */
export type Grain = 'day' | 'week' | 'month' | 'quarter' | 'year';

/** A span sliced by a view — 1 Jan 2022 → 31 Dec 2024 read yearly is three
 *  sides (2022, 2023, 2024); read monthly, thirty-six. Two sides behave exactly
 *  like the A/B comparison; more than two switch the widgets to series mode. */
export interface PeriodSeries { from: string; to: string; grain: Grain }

export type ComparePresetId =
  | 'this-month' | 'last-month' | 'same-month-last-year' | 'previous-period' | 'this-quarter' | 'last-quarter';

/** Seed-dashboard slots that can take part (they have no persisted widget object). */
export type SeedSlot = 'kpi0' | 'kpi1' | 'kpi2' | 'kpi3' | 'w1' | 'w2' | 'w3' | 'w4' | 'table';

/** Stored on a widget (`widget.compare`). Absent === inherit. */
export type WidgetCompareOverride =
  | { mode: 'inherit'; chartMode?: CompareChartMode }
  | { mode: 'off' }
  | { mode: 'pin'; a: CompareSide; b: CompareSide; chartMode?: CompareChartMode };

export interface CompareConfig {
  enabled: boolean;
  a: CompareSide;
  b: CompareSide;
  /** Series mode: the whole span and the view it is read in. When it resolves
   *  to more than two periods every widget shows one series per period, and
   *  `a` / `b` hold the first and last so anything two-sided still reads. */
  periods?: PeriodSeries;
  /** Default for chart widgets. Bars are always grouped; this governs lines/areas. */
  chartMode: CompareChartMode;
  /** User overrides; defaults come from polarity.ts. */
  polarity: Record<MetricKey, Polarity>;
  /** Divide period totals by day count when the two ranges differ in length. */
  normalizePerDay?: boolean;
  /** Overrides for seed-dashboard slots (user widgets keep theirs on the widget). */
  seedOverrides?: Partial<Record<SeedSlot, WidgetCompareOverride>>;
}

/** What a widget actually compares this render, after override resolution.
 *  `sides` is the full list (always ≥ 2); `a` and `b` are its first and last. */
export interface ResolvedCompare {
  a: CompareSide;
  b: CompareSide;
  sides: CompareSide[];
  chartMode: CompareChartMode;
  source: 'dashboard' | 'widget';
}
/** More than two sides — the widgets render a series per period. */
export const isSeriesCompare = (rc: ResolvedCompare): boolean => rc.sides.length > 2;

export interface DeltaStat {
  a: number;
  b: number;
  /** b − a (B reads as "current", A as "baseline"). */
  delta: number;
  /** Percent change, null when A is 0 (undefined ratio). */
  pct: number | null;
  tone: CompareTone;
  polarity: Polarity;
}

export interface MergedRow {
  /** Aligned label. Positional alignment on a time axis reads 'May · Aug'. */
  label: string;
  labelA?: string;
  labelB?: string;
  presentIn: 'both' | 'a' | 'b';
  values: Record<string /* series */, DeltaStat>;
}

export type CompareCaveat =
  | { kind: 'range-length'; aDays: number; bDays: number }
  | { kind: 'suppressed-filter'; table: string; column: string; label: string }
  | { kind: 'no-data'; side: 'a' | 'b' }
  | { kind: 'no-date-column'; tables: string[] }
  | { kind: 'entity-dimension-on-axis' }
  | { kind: 'empty-periods'; labels: string[]; of: number };

export interface CompareResult {
  a: ModelChartData;
  b: ModelChartData;
  /** Measure labels, as ModelChartData.series. */
  series: string[];
  /** series label → metric key, for polarity lookup. */
  seriesMetricKey: Record<string, MetricKey>;
  alignBy: 'label' | 'position';
  merged: MergedRow[];
  /** Whole-widget totals per series (ungrouped re-run — correct for averages). */
  kpi: Record<string, DeltaStat>;
  caveats: CompareCaveat[];
  error?: string;
}

export interface CompareSummary { headline: string; bullets: string[]; caveats: string[] }

// ─── Series mode (three periods or more) ───

/** One category across every period. `values[series][i]` is null when that
 *  period has no row for the category. */
export interface SeriesRow {
  label: string;
  values: Record<string /* series */, (number | null)[]>;
  /** Last period vs first, per series — what the variance table sorts on. */
  span: Record<string, DeltaStat>;
}

export interface SeriesCompareResult {
  sides: CompareSide[];
  series: string[];
  seriesMetricKey: Record<string, MetricKey>;
  /** 'periods' — the x axis is the periods themselves (the widget's own axis
   *  collapses to one point per period). 'category' — the widget keeps its
   *  axis and every period is one series on it. */
  axis: 'periods' | 'category';
  /** The widget's axis label ('Country'), or the view's ('Month') on a period axis. */
  xLabel: string;
  rows: SeriesRow[];
  /** Per series, the whole-widget total for each period. */
  totals: Record<string, number[]>;
  /** Per series, each period against the one before it (index 0 is null). */
  steps: Record<string, (DeltaStat | null)[]>;
  /** Per series, last period against the first. */
  span: Record<string, DeltaStat>;
  /** Per-period data, kept for small-multiple renderings (pies). */
  perPeriod: ModelChartData[];
  caveats: CompareCaveat[];
  error?: string;
}

export const sideKey = (s: CompareSide): string =>
  s.kind === 'period' ? `p:${s.from}:${s.to}` : `e:${s.table}.${s.column}=${String(s.value)}`;
export const sameSide = (x: CompareSide, y: CompareSide): boolean => sideKey(x) === sideKey(y);
