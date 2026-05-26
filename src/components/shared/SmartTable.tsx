import { useState, useMemo, useCallback, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { ChevronUp, ChevronDown, ChevronsUpDown, Search, ChevronLeft, ChevronRight, X } from 'lucide-react';

/* ─── Types ─── */
export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  width?: string;
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
  stickyHeader?: boolean;
  expandable?: (item: T) => ReactNode;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  className?: string;
  headerExtra?: ReactNode;
  animateRows?: boolean;
  // 'modern' = minimal AI-SaaS chrome: subtle outer edge, no header fill,
  // sentence-case muted labels, generous rows, no vertical grid lines,
  // very quiet hover. The opposite of a spreadsheet.
  variant?: 'default' | 'modern';
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
  expandable,
  onRowClick,
  emptyMessage = 'No results found',
  className = '',
  headerExtra,
  animateRows = true,
  variant = 'default',
}: SmartTableProps<T>) {
  const isModern = variant === 'modern';
  // Striping is off in modern mode — modern tables read cleaner without it.
  const stripeOn = striped && !isModern;
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
          : `bg-white border border-border-light overflow-hidden rounded-xl ${className}`
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
                className="w-full pl-8 pr-8 py-1.5 border border-border bg-white text-[0.75rem] outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all" style={{ borderRadius: '8px' }}
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
          {paginated && (
            <div className="text-[0.75rem] text-text-muted shrink-0">
              {sorted.length} result{sorted.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className={`w-full ${isModern ? 'text-[0.8125rem]' : 'text-[0.75rem]'}`}>
          <thead>
            <tr className={isModern ? 'border-b border-border-light' : 'bg-surface-2 border-b border-border-light'}>
              {expandable && <th className="w-8" />}
              {columns.map((col, ci) => (
                <th
                  key={col.key}
                  className={[
                    isModern
                      ? `py-3 text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-text-muted ${ci === 0 ? 'pl-5 pr-3' : ci === columns.length - 1 ? 'pl-3 pr-5' : 'px-3'}`
                      : 'px-4 py-2.5 font-semibold text-text-secondary',
                    alignClass(col.align),
                    col.sortable !== false ? 'cursor-pointer select-none hover:text-text-secondary transition-colors' : '',
                  ].filter(Boolean).join(' ')}
                  style={col.width ? { width: col.width } : undefined}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {col.label}
                    {col.sortable !== false && (
                      <SortIcon direction={sortKey === col.key ? sortDir : null} quiet={isModern} />
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
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-surface-2 flex items-center justify-center mb-1">
                      <Search size={18} className="text-text-muted/50" />
                    </div>
                    <div className="text-[0.8125rem] font-medium text-text-secondary">{emptyMessage}</div>
                    {search && (
                      <button onClick={() => setSearch('')} className="text-[0.75rem] text-primary font-medium hover:underline cursor-pointer mt-1">
                        Clear search
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            </tbody>
          ) : (
            paged.map((item, i) => {
              const id = item[keyField];
              const isExpanded = expandedId === id;
              const totalCols = columns.length + (expandable ? 1 : 0);

              const Wrapper = animateRows ? motion.tbody : 'tbody';
              const wrapperProps = animateRows ? {
                initial: { opacity: 0 },
                animate: { opacity: 1 },
                transition: { delay: i * 0.02 },
              } : {};

              return (
                <Wrapper key={String(id)} {...wrapperProps}>
                  <tr
                    className={[
                      'transition-colors group',
                      isModern
                        ? 'border-b border-border-light/70'
                        : 'border-b border-border-light last:border-0',
                      stripeOn && i % 2 === 1 ? 'bg-surface-2/30' : '',
                      onRowClick || expandable ? 'cursor-pointer' : '',
                      isModern ? 'hover:bg-paper-50/50' : 'hover:bg-primary-xlight/50',
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
                            ? `py-4 ${ci === 0 ? 'pl-5 pr-3' : ci === columns.length - 1 ? 'pl-3 pr-5' : 'px-3'}`
                            : 'px-4 py-3',
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
          <div className="text-[0.75rem] text-text-muted">
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
                className={`w-7 h-7 rounded-md text-[0.75rem] font-semibold transition-colors cursor-pointer ${
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
