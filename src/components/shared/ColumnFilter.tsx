import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Filter, Check, ChevronDown, Search, X } from 'lucide-react';
import Checkbox from './Checkbox';

interface Props {
  label: string;
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  align?: 'start' | 'end';
  /** Trigger style. `icon` (default) is a tiny funnel button used inside column
      headers. `button` renders a full CTA-style pill with label + chevron. */
  variant?: 'icon' | 'button';
  /** Custom left content per option (e.g. an avatar + name for people filters).
      Receives the option string; defaults to a plain truncated label. */
  renderOption?: (opt: string) => React.ReactNode;
  /** Selection affordance. `check` (default) shows a trailing check on selected
      rows. `checkbox` puts a leading checkbox in front of each row instead —
      the explicit multi-select look (no trailing check). */
  selectIndicator?: 'check' | 'checkbox';
  /** Force the inline search on (or off) regardless of option count. Defaults to
      auto: shown when there are more than 5 options. */
  searchable?: boolean;
}

export default function ColumnFilter({ label, options, value, onChange, align = 'start', variant = 'icon', renderOption, selectIndicator = 'check', searchable }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  // Snapshot of what was selected when the menu opened — used to float those
  // to the top so, with many options, your picks never scroll out of view.
  // Frozen on open so toggling doesn't reorder rows under the cursor.
  const [pinned, setPinned] = useState<string[]>([]);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const hasFilter = value.length > 0;
  const reduce = useReducedMotion();

  // Long lists get an inline search; short ones (Status, Result…) stay clean.
  // `searchable` overrides the auto threshold either way.
  const showSearch = searchable ?? options.length > 5;
  const ordered = pinned.length
    ? [...options].sort((a, b) => Number(pinned.includes(b)) - Number(pinned.includes(a)))
    : options;
  const visibleOptions = query
    ? ordered.filter(o => o.toLowerCase().includes(query.toLowerCase()))
    : ordered;

  useEffect(() => {
    if (!open) { setQuery(''); return; }
    setPinned(value);
    // Focus the search on open so the user can type immediately.
    const t = setTimeout(() => searchRef.current?.focus(), 20);
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const toggle = (opt: string) => {
    onChange(value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt]);
  };

  return (
    <span ref={wrapRef} className="relative inline-flex">
      {variant === 'button' ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
          className={`no-focus-ring inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-[12px] font-medium cursor-pointer transition-colors ${
            hasFilter
              ? 'border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-50/80'
              : open
                ? 'border-brand-600 bg-canvas text-brand-700'
                : 'border-canvas-border bg-canvas-elevated text-ink-700 hover:border-brand-200 hover:bg-canvas'
          }`}
          aria-haspopup="true"
          aria-expanded={open}
        >
          <span>{label}</span>
          {hasFilter && (
            <span className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-brand-600 text-white text-[10px] font-mono tabular-nums">
              {value.length}
            </span>
          )}
          <ChevronDown size={13} className={`text-ink-400 transition-transform ${open ? 'rotate-180 text-brand-600' : ''}`} aria-hidden />
        </button>
      ) : (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
          className={`no-focus-ring w-5 h-5 inline-flex items-center justify-center rounded-md cursor-pointer transition-colors ${
            hasFilter ? 'text-brand-700 bg-brand-50' : 'text-ink-400 hover:text-brand-700 hover:bg-canvas'
          }`}
          aria-label={`Filter ${label}`}
          aria-haspopup="true"
          aria-expanded={open}
        >
          <Filter size={11} strokeWidth={2} />
          {hasFilter && (
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-brand-600" />
          )}
        </button>
      )}
      <AnimatePresence>
      {open && (
        <motion.div
          initial={reduce ? false : { opacity: 0, y: -4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
          transition={{ duration: reduce ? 0 : 0.14, ease: [0.2, 0, 0, 1] }}
          className={`absolute top-full mt-1.5 z-50 overflow-hidden bg-canvas-elevated border border-canvas-border rounded-xl shadow-[0_10px_30px_-12px_rgba(15,8,30,0.28)] normal-case tracking-normal ${showSearch ? 'w-[224px]' : 'min-w-full w-max max-w-[240px]'} ${align === 'end' ? 'right-0 origin-top-right' : 'left-0 origin-top-left'}`}
          onClick={(e) => e.stopPropagation()}
        >
          {showSearch && (
            // Long lists: a borderless cmdk-style search is the header itself.
            <div className="flex items-center gap-2 px-3 h-10 border-b border-canvas-border">
              <Search size={13} className="text-ink-400 shrink-0" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${label.toLowerCase()}…`}
                className="no-focus-ring flex-1 min-w-0 bg-transparent border-0 p-0 text-[12px] text-ink-800 placeholder:text-ink-400 outline-none"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => { setQuery(''); searchRef.current?.focus(); }}
                  className="no-focus-ring grid place-items-center w-4 h-4 rounded-full text-ink-400 hover:text-ink-700 hover:bg-canvas-border/60 cursor-pointer shrink-0"
                  aria-label="Clear search"
                >
                  <X size={11} />
                </button>
              ) : hasFilter ? (
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="text-[10px] text-brand-700 hover:text-brand-600 cursor-pointer font-medium shrink-0"
                >
                  Clear
                </button>
              ) : null}
            </div>
          )}
          {showSearch && hasFilter && !query && (
            <div className="px-3 pt-1.5 text-[10px] uppercase tracking-wider font-semibold text-ink-400 tabular-nums">
              {value.length} selected
            </div>
          )}
          <ul className="p-1 max-h-[256px] overflow-y-auto">
            {visibleOptions.map((opt, i) => {
              const checked = value.includes(opt);
              return (
                <motion.li
                  key={opt}
                  initial={reduce ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: reduce ? 0 : Math.min(i * 0.02, 0.16), duration: reduce ? 0 : 0.13, ease: [0.2, 0, 0, 1] }}
                >
                  <button
                    type="button"
                    onClick={() => toggle(opt)}
                    className={`no-focus-ring flex items-center gap-2.5 w-full text-left px-2 h-8 rounded-lg text-[12px] cursor-pointer transition-colors ${
                      checked ? 'bg-brand-50 text-brand-800 font-medium' : 'text-ink-800 hover:bg-canvas'
                    }`}
                  >
                    {selectIndicator === 'checkbox' && <Checkbox checked={checked} />}
                    <span className="flex items-center gap-2.5 min-w-0 flex-1">
                      {renderOption ? renderOption(opt) : <span className="truncate">{opt}</span>}
                    </span>
                    {selectIndicator === 'check' && (
                      <Check size={14} strokeWidth={2.5} className={`shrink-0 transition-opacity ${checked ? 'text-brand-600 opacity-100' : 'opacity-0'}`} />
                    )}
                  </button>
                </motion.li>
              );
            })}
            {visibleOptions.length === 0 && (
              <li className="px-2 py-3 text-center text-[12px] text-ink-400">{options.length === 0 ? 'No options' : 'No matches'}</li>
            )}
          </ul>
          {!showSearch && hasFilter && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="no-focus-ring w-full text-left px-3 h-8 border-t border-canvas-border text-[11px] font-medium text-brand-700 hover:bg-canvas cursor-pointer transition-colors"
            >
              Clear ({value.length})
            </button>
          )}
        </motion.div>
      )}
      </AnimatePresence>
    </span>
  );
}
