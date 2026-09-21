/**
 * A summary table on Platform Value.
 *
 * The page carried six hand-rolled `<table>` elements, each with its own
 * header weights, its own hairlines and its own column padding. DESIGN §7.10.3
 * says `SmartTable` is the default for any list and the two registry tables are
 * the only sanctioned exceptions, so these are that table now.
 *
 * It is the `modern` variant, which renders no card of its own, so it nests
 * inside a section card without a second border around it. Search, sorting,
 * paging, striping and the row cascade are all off: these are three to six line
 * summaries a reader takes in at a glance, not lists anybody needs to work.
 *
 * The columns carry explicit widths and `fixedLayout`, because the browser left
 * to itself spreads four short columns across the whole page and the figures
 * end up a hand's width apart from the words they belong to.
 */

import type { ReactNode } from 'react';
import SmartTable, { type Column } from '../shared/SmartTable';

/** A row is whatever the caller puts in it, plus an id for the key. */
export type ValueRow = Record<string, unknown> & { id: string };

export interface ValueColumn {
  key: string;
  label: string;
  /** A fixed width pulls the figure columns together at the right. Leave the
   *  first column width-less so it takes the remainder. */
  width?: string;
  align?: 'left' | 'right';
  /** Let this column shrink and ellipsize instead of forcing the table wider.
   *  Use it on the one fluid column. */
  truncate?: boolean;
  /** The information icon for the table, in this header cell. It rides in the
   *  header rather than above the table because these two columns carry most
   *  of the value story and had nothing behind them. */
  note?: ReactNode;
  render?: (row: ValueRow) => ReactNode;
}

export default function ValueTable({
  columns,
  rows,
  paginated = false,
  pageSize = 8,
}: {
  columns: ValueColumn[];
  rows: ValueRow[];
  /** Off by default: most of these are three to six line summaries. Turn it on
   *  for the one list that is genuinely long, so it does not run past the
   *  section it sits in. */
  paginated?: boolean;
  pageSize?: number;
}) {
  const cols: Column<ValueRow>[] = columns.map(c => ({
    key: c.key,
    label: c.label,
    sortable: false,
    align: c.align ?? 'left',
    width: c.width,
    truncate: c.truncate,
    filter: c.note,
    render: c.render ? row => c.render!(row) : undefined,
  }));

  return (
    <SmartTable<ValueRow>
      columns={cols}
      data={rows}
      keyField="id"
      variant="modern"
      dense
      fixedLayout
      nowrapHeaders
      noRowHover
      animateRows={false}
      searchable={false}
      paginated={paginated}
      pageSize={pageSize}
      hideResultCount
    />
  );
}
