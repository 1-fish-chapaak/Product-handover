import { useState, useMemo, useCallback, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ChevronUp, ChevronDown, ChevronsUpDown, Search, ChevronLeft, ChevronRight, X } from 'lucide-react';

/* ─── Types ─── */
export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  width?: string;
  /** Let this (flexible) column shrink and truncate its content instead of
   *  forcing the table wider than its container. Applies `max-width: 0` to the
   *  cell so an inner `truncate` element ellipsizes rather than pushing the
   *  table into horizontal scroll. Use on the single fluid column. */
  truncate?: boolean;
  render?: (item: T, index: number) => ReactNode;
}

interface SmartTableProps<T extends Record<string, unknown>> {
  columns: Column<T>[];
  data: T[];
  keyField?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchKeys?: string[];
  paginated?: boolean;
  pageSize?: number;
  striped?: boolean;
  /** Pin the column-header row while the rows scroll. The table sits in the
   *  page's scroll container (not its own), so the card's clip + the body's
   *  horizontal-scroll wrapper are dropped to let `position: sticky` escape to
   *  the page scroller. Pair with `stickyHeaderTop` when a toolbar is pinned
   *  above the table, so the header parks just under it instead of behind it. */
  stickyHeader?: boolean;
  /** Tailwind `top-*` class for the sticky header's offset. Defaults to
   *  `top-0`; pass e.g. `top-11` to clear a pinned toolbar of that height. */
  stickyHeaderTop?: string;
  /** Opt out of the row hover tint (e.g. admin tables where it adds no value).
   *  Selected-row treatment is unaffected. */
  noRowHover?: boolean;
  expandable?: (item: T) => ReactNode;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  /** Fully custom empty-state body. When provided, replaces the default
   *  icon + message + clear-search chrome with this node. Caller owns layout.
   *  Can be a function that receives the table's internal search state so the
   *  caller can render a Clear-search affordance alongside other filter clears. */
  emptyContent?: ReactNode | ((ctx: { search: string; clearSearch: () => void }) => ReactNode);
  className?: string;
  headerExtra?: ReactNode;
  animateRows?: boolean;
  /** Row entrance style when animateRows is on. 'fade' (default) is a quiet
   *  opacity stagger; 'rise' adds a slide-up with the admin cascade timing
   *  (matches the Roles permission matrix). */
  rowReveal?: 'fade' | 'rise';
  // 'modern' = minimal AI-SaaS chrome: subtle outer edge, no header fill,
  // sentence-case muted labels, generous rows, no vertical grid lines,
  // very quiet hover. The opposite of a spreadsheet.
  variant?: 'default' | 'modern';
  /** Compact row rhythm for the 'modern' variant — trades the generous py-4
   *  rows for a tighter py-2.5, matching the platform's dense list views
   *  (EvidenceRepository / DataSources). No effect on the 'default' variant. */
  dense?: boolean;
  hideResultCount?: boolean;
  /** Background utility class for the search input. Defaults to 'bg-white';
   *  pass e.g. 'bg-paper-50' to match an adjacent filter control. */
  searchBg?: string;
  /** Show the resting sort-hint icon on sortable column headers even in the
   *  'modern' variant (which otherwise hides it until a column is active). */
  showSortHint?: boolean;
  /** Opt-in selected-row treatment. When provided, rows where this returns true
   *  get a brand tint + a left accent bar (the first cell carries the bar). Used
   *  by surfaces that own selection externally (e.g. Admin checkboxes). Off by
   *  default, so every other SmartTable is unaffected. */
  isRowSelected?: (item: T, index: number) => boolean;
  /** Opt-in `table-layout: fixed`. Column `width` values are then honoured
   *  exactly and the table always fills its container, so a width-less column
   *  takes the remainder. Off by default (auto layout) for existing callers. */
  fixedLayout?: boolean;
}

/* ─── Sort Icon ─── */
function SortIcon({ direction, quiet }: { direction: 'asc' | 'desc' | null; quiet?: boolean }) {
  if (!direction) {
    // Modern (quiet) tables hide the resting icon entirely; default tables
    // show a faint hint so the column reads as sortable.
    if (quiet) return null;
    return <ChevronsUpDown size={12} className="text-text-muted/40" />;
  }
  return direction === 'asc'
    ? <ChevronUp size={12} className="text-primary" />
    : <ChevronDown size={12} className="text-primary" />;
}

/* ─── Component ─── */
export default function SmartTable<T extends Record<string, unknown>>({
  columns,
  data,
  keyField = 'id',
  searchable = true,
  searchPlaceholder = 'Search...',
  searchKeys,
  paginated = true,
  pageSize = 8,
  striped = true,
  fixedLayout = false,
  stickyHeader = false,
  stickyHeaderTop = 'top-0',
  noRowHover = false,
  expandable,
  onRowClick,
  emptyMessage = 'No results found',
  emptyContent,
  className = '',
  headerExtra,
  animateRows = true,
  rowReveal = 'fade',
  variant = 'default',
  dense = false,
  hideResultCount = false,
  searchBg = 'bg-white',
  showSortHint = false,
  isRowSelected,
}: SmartTableProps<T>) {
  const isModern = variant === 'modern';
  // Striping is off in modern mode — modern tables read cleaner without it.
  const stripeOn = striped && !isModern;
  // Honor prefers-reduced-motion: skip the row-reveal stagger entirely.
  const prefersReduced = useReducedMotion();
  const animate = animateRows && !prefersReduced;
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState<unknown>(null);

  // Filter
  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    const keys = searchKeys ?? columns.map(c => c.key);
    return data.filter(item =>
      keys.some(k => {
        const val = item[k];
        return val != null && String(val).toLowerCase().includes(q);
      })
    );
  }, [data, search, searchKeys, columns]);

  // Sort
  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = typeof aVal === 'number' && typeof bVal === 'number'
        ? aVal - bVal
        : String(aVal).localeCompare(String(bVal));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  // Paginate
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const paged = paginated ? sorted.slice(safePage * pageSize, (safePage + 1) * pageSize) : sorted;

  const handleSort = useCallback((key: string) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(0);
  }, [sortKey]);

  const handleToggleExpand = useCallback((id: unknown) => {
    setExpandedId((prev: unknown) => prev === id ? null : id);
  }, []);

  const alignClass = (a?: string) =>
    a === 'center' ? 'text-center' : a === 'right' ? 'text-right' : 'text-left';

  return (
    <div
      className={
        isModern
          ? `${className}`
          // `overflow-clip` rounds the corners (so the sticky header's square
          // top corners can't poke past the card's rounded border) WITHOUT
          // becoming a scroll container — which `overflow-hidden` does, trapping
          // the sticky header inside the card instead of pinning it to the page.
          : `bg-white border border-border-light rounded-xl overflow-clip ${className}`
      }
    >
      {/* Toolbar */}
      {(searchable || headerExtra) && (
        <div className={`flex items-center justify-between gap-3 ${isModern ? 'px-5 py-3' : 'px-4 py-2.5 border-b border-border-light bg-surface-2/50'}`}>
          {searchable && (
            <div className="relative flex-1 max-w-xs">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(0); }}
                placeholder={searchPlaceholder}
                className={`w-full pl-8 pr-8 py-1.5 border border-border ${searchBg} text-[12px] outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all`} style={{ borderRadius: '8px' }}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary cursor-pointer"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          )}
          {headerExtra && <div className="flex items-center gap-2">{headerExtra}</div>}
          {paginated && !hideResultCount && (
            <div className="text-[12px] text-text-muted shrink-0">
              {sorted.length} result{sorted.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}

      {/* Table — `overflow-x-auto` also forces overflow-y to `auto`, which would
          trap the sticky header; drop it when the header is pinned. */}
      <div className={stickyHeader ? '' : 'overflow-x-auto'}>
        <table className={`w-full ${fixedLayout ? 'table-fixed' : ''} ${isModern ? 'text-[13px]' : 'text-[12.5px]'}`}>
          <thead>
            <tr className="bg-surface-2 border-b border-border-light">
              {expandable && <th className={`w-8 ${stickyHeader ? `sticky ${stickyHeaderTop} z-10 bg-surface-2` : ''}`} />}
              {columns.map((col, ci) => (
                <th
                  key={col.key}
                  className={[
                    isModern
                      ? `${dense ? 'py-2.5' : 'py-3'} font-semibold text-text-secondary ${ci === 0 ? 'pl-5 pr-3' : ci === columns.length - 1 ? 'pl-3 pr-5' : 'px-3'}`
                      : 'px-4 py-2.5 font-semibold text-text-secondary',
                    alignClass(col.align),
                    col.sortable !== false ? 'cursor-pointer select-none hover:text-text-secondary transition-colors' : '',
                    // Pin the header row to the page scroller, parked under any
                    // sticky toolbar via `stickyHeaderTop`. Each cell carries the
                    // header fill so scrolled rows don't show through.
                    stickyHeader ? `sticky ${stickyHeaderTop} z-10 bg-surface-2` : '',
                    col.truncate ? 'max-w-0' : '',
                  ].filter(Boolean).join(' ')}
                  style={col.width ? { width: col.width } : undefined}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {col.label}
                    {col.sortable !== false && (
                      <SortIcon direction={sortKey === col.key ? sortDir : null} quiet={isModern && !showSortHint} />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          {paged.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={columns.length + (expandable ? 1 : 0)} className="px-4 py-16 text-center">
                  {emptyContent ? (
                    typeof emptyContent === 'function'
                      ? emptyContent({ search, clearSearch: () => setSearch('') })
                      : emptyContent
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-10 h-10 rounded-xl bg-surface-2 flex items-center justify-center mb-1">
                        <Search size={18} className="text-text-muted/50" />
                      </div>
                      <div className="text-[13px] font-medium text-text-secondary">{emptyMessage}</div>
                      {search && (
                        <button onClick={() => setSearch('')} className="text-[12px] text-primary font-medium hover:underline cursor-pointer mt-1">
                          Clear search
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            </tbody>
          ) : (
            paged.map((item, i) => {
              const id = item[keyField];
              const isExpanded = expandedId === id;
              const totalCols = columns.length + (expandable ? 1 : 0);

              const Wrapper = animate ? motion.tbody : 'tbody';
              const wrapperProps = animate ? (
                rowReveal === 'rise'
                  ? {
                      initial: { opacity: 0, y: 6 },
                      animate: { opacity: 1, y: 0 },
                      transition: { duration: 0.22, delay: i * 0.04, ease: [0.2, 0, 0, 1] as const },
                    }
                  : {
                      initial: { opacity: 0 },
                      animate: { opacity: 1 },
                      transition: { delay: i * 0.02 },
                    }
              ) : {};

              const selected = isRowSelected?.(item, safePage * pageSize + i) ?? false;

              return (
                <Wrapper key={String(id)} {...wrapperProps}>
                  <tr
                    className={[
                      'transition-colors group',
                      isModern
                        ? 'border-b border-border-light/70'
                        : 'border-b border-border-light last:border-0',
                      selected ? 'bg-brand-50/60' : (stripeOn && i % 2 === 1 ? 'bg-surface-2/30' : ''),
                      onRowClick || expandable ? 'cursor-pointer' : '',
                      noRowHover ? '' : (selected ? 'hover:bg-brand-50/70' : (isModern ? 'hover:bg-brand-50/50' : 'hover:bg-primary-xlight/50')),
                    ].filter(Boolean).join(' ')}
                    onClick={() => {
                      if (expandable) handleToggleExpand(id);
                      if (onRowClick) onRowClick(item);
                    }}
                  >
                    {expandable && (
                      <td className="text-center w-8 px-2 py-3">
                        <ChevronRight
                          size={13}
                          className={`text-text-muted transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}
                        />
                      </td>
                    )}
                    {columns.map((col, ci) => (
                      <td
                        key={col.key}
                        className={[
                          isModern
                            ? `${dense ? 'py-2.5' : 'py-4'} ${ci === 0 ? 'pl-5 pr-3' : ci === columns.length - 1 ? 'pl-3 pr-5' : 'px-3'}`
                            : 'px-4 py-3',
                          // Opt-in selected-row accent: a left brand bar carried by the first cell.
                          ci === 0 && selected ? 'shadow-[inset_3px_0_0_#6A12CD]' : '',
                          col.truncate ? 'max-w-0' : '',
                          alignClass(col.align),
                        ].filter(Boolean).join(' ')}
                      >
                        {col.render ? col.render(item, safePage * pageSize + i) : String(item[col.key] ?? '')}
                      </td>
                    ))}
                  </tr>
                  {expandable && isExpanded && (
                    <tr>
                      <td colSpan={totalCols} className="p-0">
                        <div className="px-10 py-4 bg-surface-2/50 border-b border-border-light">
                          {expandable(item)}
                        </div>
                      </td>
                    </tr>
                  )}
                </Wrapper>
              );
            })
          )}
        </table>
      </div>

      {/* Pagination */}
      {paginated && totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border-light bg-surface-2/30">
          <div className="text-[12px] text-text-muted">
            Showing {safePage * pageSize + 1}–{Math.min((safePage + 1) * pageSize, sorted.length)} of {sorted.length}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={safePage === 0}
              className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={`w-7 h-7 rounded-md text-[12px] font-semibold transition-colors cursor-pointer ${
                  i === safePage
                    ? 'bg-primary text-white'
                    : 'text-text-secondary hover:bg-gray-100'
                }`}
              >
                {i + 1}
              </button>
            )).slice(Math.max(0, safePage - 2), safePage + 3)}
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1}
              className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
