// ─── Dashboard data model — types ───
// A simple, Power BI-like relationship model (no cardinality, kept friendly).
// Tables carry real rows so multi-table widgets produce real joined results.

export type ColumnType = 'string' | 'number' | 'date';
export type ColumnRole = 'dimension' | 'measure';

export interface ModelColumn {
  name: string;        // raw key, e.g. 'VendorID'
  label: string;       // display, e.g. 'Vendor'
  type: ColumnType;
  role: ColumnRole;
  isKey?: boolean;     // a join-key candidate (drives auto-detect)
}

export type ModelRow = Record<string, string | number>;

export interface ModelTable {
  id: string;          // 'invoices'
  name: string;        // 'Invoices'
  columns: ModelColumn[];
  rows: ModelRow[];
}

/** A single equi-join column pair (raw column names). */
export interface ColumnPair { left: string; right: string; }

/** A connection between two tables. Multiple may exist between the same pair,
 *  but only one is `active` (used when combining those tables). */
export interface Relationship {
  id: string;
  leftTable: string;   // table id
  rightTable: string;  // table id
  columnPairs: ColumnPair[];   // 1..N — multi-column joins matched with AND
  active: boolean;
}

export type AggFn = 'sum' | 'count' | 'avg' | 'min' | 'max' | 'countDistinct';

export interface WidgetModelField {
  table: string;       // table id
  column: string;      // raw column name
  role: ColumnRole;
  agg?: AggFn;         // measures only
}

/** A widget built from one or more related tables. */
export interface WidgetModelConfig {
  fields: WidgetModelField[];
}

/** A filter constraint on a model column. Rows are kept where the column value
 *  is one of `values`. Empty `values` means the filter is inactive (show all).
 *  Used for both global page slicers and chart-click cross-filters; propagates
 *  through active relationships (Power BI semantics — unrelated visuals ignore it). */
export interface ModelFilter {
  table: string;       // table id
  column: string;      // raw column name
  values: (string | number)[];
}

/** A relationship auto-detect proposes (never applied without approval). */
export interface AutoDetectCandidate {
  id: string;
  leftTable: string;
  rightTable: string;
  columnPairs: ColumnPair[];
  reason: string;
  /** True when the table-pair already has an active relationship — this one
   *  would be created Inactive (Power BI's single-active rule). */
  willBeInactive: boolean;
}

/** Shape ModelChart consumes — joined + aggregated rows. */
export interface ModelChartData {
  xLabel: string;
  series: string[];                                  // measure labels
  rows: { label: string; [series: string]: number | string }[];
  error?: string;                                    // set when tables aren't connected
  unrelated?: string[];                              // table ids with no active path
}
