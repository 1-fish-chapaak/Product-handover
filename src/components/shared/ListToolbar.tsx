import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, List, LayoutGrid, SlidersHorizontal } from 'lucide-react';

// ─── Canonical list toolbar (Knowledge Hub pattern) ─────────────────────────
//
// Mirrors the Knowledge Hub search row so every Reports sub-tab reads as one
// family with the rest of the platform:
//
//   [ 🔍 full-width search ─────────────────── ]  [ filters ▾ ]  [ ▤ ▦ ]
//
// The primary type selector (All · IA · ATR · SOX · Evidence) is the chip row
// ABOVE this — the KH "All / Files / Folders" analog — so this row is purely
// the search + secondary controls, exactly like KH's second row.

export interface ListToolbarProps {
  search: string;
  onSearch: (value: string) => void;
  searchPlaceholder?: string;
  /** Right-aligned controls — filter dropdowns, view toggle, clear-all, etc. */
  trailing?: ReactNode;
  /** Compact, fixed-width search (instead of full-width). The trailing controls
   *  then push to the right edge of the row. */
  compactSearch?: boolean;
}

export default function ListToolbar({
  search, onSearch, searchPlaceholder = 'Search…', trailing, compactSearch,
}: ListToolbarProps) {
  return (
    <div className="mb-5 flex items-center gap-3 flex-wrap shrink-0">
      <div className={`relative ${compactSearch ? 'w-full sm:w-[320px]' : 'flex-1 min-w-[240px]'}`}>
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
        <input
          value={search}
          onChange={e => onSearch(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full h-10 pl-10 pr-3 bg-canvas-elevated border border-canvas-border rounded-lg text-[0.8125rem] text-ink-800 placeholder:text-ink-400 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 transition-all"
        />
      </div>
      {trailing && <div className={`flex items-center gap-2 shrink-0 flex-wrap ${compactSearch ? 'sm:ml-auto' : ''}`}>{trailing}</div>}
    </div>
  );
}

// ─── Shared filter primitives ────────────────────────────────────────────────

export interface ToolbarChip<T extends string> {
  key: T;
  label: string;
  icon?: React.ElementType;
  count?: number;
}

/** Light-track segmented chip group — used for the primary type selector. */
export function ToolbarChips<T extends string>({
  options, value, onChange, layoutId,
}: {
  options: ToolbarChip<T>[];
  value: T;
  onChange: (key: T) => void;
  /** Unique per instance so multiple chip groups don't share one indicator. */
  layoutId: string;
}) {
  return (
    <div className="inline-flex items-center gap-1 p-1.5 rounded-lg border border-canvas-border/60 bg-canvas-elevated/40 w-fit max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {options.map(o => {
        const Icon = o.icon;
        const active = value === o.key;
        return (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            className={`shrink-0 relative inline-flex items-center gap-2.5 px-3.5 h-9 rounded-lg text-[0.875rem] transition-colors cursor-pointer ${
              active ? 'text-brand-700 font-semibold' : 'text-ink-500 font-medium hover:text-ink-800'
            }`}
          >
            {active && (
              <motion.div
                layoutId={layoutId}
                className="absolute inset-0 bg-canvas-elevated rounded-lg shadow-[0_1px_2px_rgb(15_8_30_/_0.06),0_2px_6px_rgb(15_8_30_/_0.04)] border border-canvas-border"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              {Icon && <Icon size={15} className={active ? 'text-brand-600' : 'text-ink-400'} />}
              <span>{o.label}</span>
              {typeof o.count === 'number' && (
                <span className={`tabular-nums font-bold text-[0.8125rem] ${active ? 'text-brand-700' : 'text-ink-400'}`}>{o.count}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

const Chevron = ({ className }: { className?: string }) => (
  <svg className={className} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
);

/** Compact filter dropdown — the platform's standard secondary control, styled
 *  to match Knowledge Hub's "All time" pill. Renders a native select for
 *  accessibility with a consistent shell. `block` renders a full-width labelled
 *  row for use inside the Filters popover. */
export function ToolbarSelect({
  label, value, onChange, options, block,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[] | string[];
  block?: boolean;
}) {
  const opts = options.map(o => (typeof o === 'string' ? { value: o, label: o } : o));
  if (block) {
    return (
      <label className="block">
        {label && <span className="block text-[0.6875rem] font-semibold text-ink-500 mb-1.5">{label}</span>}
        <div className="relative flex items-center h-9 pl-3 pr-8 bg-canvas-elevated border border-canvas-border rounded-md hover:border-brand-300 focus-within:border-brand-400 transition-colors">
          <select
            value={value}
            onChange={e => onChange(e.target.value)}
            className="appearance-none bg-transparent w-full text-[0.78125rem] font-medium text-ink-700 cursor-pointer outline-none truncate"
          >
            {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <Chevron className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
        </div>
      </label>
    );
  }
  return (
    <div className="relative inline-flex items-center h-10 pl-3 pr-8 bg-canvas-elevated border border-canvas-border rounded-lg hover:border-brand-300 focus-within:border-brand-400 transition-colors">
      {label && <span className="text-[0.6875rem] text-ink-400 mr-1.5 shrink-0">{label}</span>}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="appearance-none bg-transparent text-[0.78125rem] font-medium text-ink-700 cursor-pointer outline-none pr-1 max-w-[120px] truncate"
      >
        {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <Chevron className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
    </div>
  );
}

/** Combines several filters behind a single "Filters" button + popover so the
 *  toolbar stays compact. Shows an active-count badge; the popover holds the
 *  individual controls (use `ToolbarSelect block`) plus a Clear-all footer. */
export function ToolbarFilterMenu({
  activeCount = 0, onClear, children, label = 'Filters',
}: {
  activeCount?: number;
  onClear?: () => void;
  children: ReactNode;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-2 h-10 pl-3 pr-3 rounded-lg border text-[0.78125rem] font-medium cursor-pointer transition-colors ${
          activeCount > 0
            ? 'bg-brand-50 border-brand-200 text-brand-700'
            : 'bg-canvas-elevated border-canvas-border text-ink-700 hover:border-brand-300'
        }`}
      >
        <SlidersHorizontal size={15} className={activeCount > 0 ? 'text-brand-600' : 'text-ink-400'} />
        {label}
        {activeCount > 0 && (
          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-brand-600 text-white text-[0.625rem] font-bold tabular-nums">{activeCount}</span>
        )}
        <Chevron className={`text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14, ease: [0.2, 0, 0, 1] }}
            className="absolute right-0 top-full mt-2 w-[260px] bg-canvas-elevated border border-canvas-border rounded-xl shadow-[0_8px_28px_-8px_rgb(15_8_30_/_0.22)] z-50 p-3.5"
          >
            <div className="flex flex-col gap-3">{children}</div>
            {onClear && (
              <div className="flex items-center justify-between pt-3 mt-3 border-t border-canvas-border">
                <button
                  type="button"
                  onClick={() => { onClear(); }}
                  disabled={activeCount === 0}
                  className="text-[0.75rem] font-medium text-brand-700 hover:underline cursor-pointer disabled:text-ink-300 disabled:no-underline disabled:cursor-default"
                >
                  Clear all
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-8 px-3 rounded-md bg-brand-600 hover:bg-brand-500 text-white text-[0.75rem] font-semibold cursor-pointer transition-colors"
                >
                  Done
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** List / grid view toggle — matches the chip track radius + brand-active. */
export function ToolbarViewToggle({
  mode, onChange,
}: {
  mode: 'list' | 'grid';
  onChange: (mode: 'list' | 'grid') => void;
}) {
  return (
    <div className="flex items-center gap-0.5 p-1 h-10 bg-canvas-elevated border border-canvas-border rounded-lg">
      <button
        onClick={() => onChange('list')}
        className={`p-1.5 rounded-sm cursor-pointer transition-colors ${mode === 'list' ? 'bg-paper-50 text-brand-700' : 'text-ink-400 hover:text-ink-600'}`}
        title="List view"
      >
        <List size={16} />
      </button>
      <button
        onClick={() => onChange('grid')}
        className={`p-1.5 rounded-sm cursor-pointer transition-colors ${mode === 'grid' ? 'bg-paper-50 text-brand-700' : 'text-ink-400 hover:text-ink-600'}`}
        title="Grid view"
      >
        <LayoutGrid size={16} />
      </button>
    </div>
  );
}
