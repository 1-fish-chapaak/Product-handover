import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Workflow, Grid3x3, AlertTriangle, Shield } from 'lucide-react';
import { BUSINESS_PROCESSES, RACMS, RISKS, CONTROLS } from '../../data/mockData';

// ─── Command Palette ────────────────────────────────────────────────────────
//
// Global Cmd+K / Ctrl+K palette. Lets users jump to a Process, RACM, Risk, or
// Control from anywhere in the app. Mounted once at the App shell root so the
// keyboard listener and overlay are universal.
//
// Navigation: dispatches a CustomEvent on `window` rather than coupling to
// useAppState directly. App.tsx already uses this pattern for `irame:open-report`
// — we follow the same convention with `irame:command-palette-navigate`.
//
// Data sources: imported from `data/mockData.ts` (BUSINESS_PROCESSES, RACMS,
// RISKS, CONTROLS). These are stably exported and live outside the three files
// (BusinessProcesses.tsx, RacmListTable.tsx, RiskRegister.tsx) currently being
// edited in parallel — zero collision risk.

// ─── Types ──────────────────────────────────────────────────────────────────

type CommandKind = 'process' | 'racm' | 'risk' | 'control';

interface CommandItem {
  kind: CommandKind;
  id: string;
  name: string;
  /** Optional secondary meta (e.g. business process abbr) shown right-aligned. */
  meta?: string;
  /** Target view to route to. */
  view: string;
}

interface NavigateDetail {
  kind: CommandKind;
  id: string;
  view: string;
  /** For 'process' selections, the BP id ("p2p", "o2c", etc.) so the shell can drill in. */
  bpId?: string;
}

const MAX_RESULTS = 30;

const KIND_LABEL: Record<CommandKind, string> = {
  process: 'Processes',
  racm:    'RACMs',
  risk:    'Risks',
  control: 'Controls',
};

const KIND_ORDER: CommandKind[] = ['process', 'racm', 'risk', 'control'];

const KIND_ICON: Record<CommandKind, typeof Workflow> = {
  process: Workflow,
  racm:    Grid3x3,
  risk:    AlertTriangle,
  control: Shield,
};

// ─── Data normalization ─────────────────────────────────────────────────────
//
// Flatten the four seed arrays into a single CommandItem list, computed once
// at module load time. Names are stable, so we don't need to recompute per
// render.

const ALL_ITEMS: CommandItem[] = [
  ...BUSINESS_PROCESSES.map<CommandItem>(bp => ({
    kind: 'process',
    id:   bp.id,
    name: bp.name,
    meta: bp.abbr,
    view: 'business-processes',
  })),
  ...RACMS.map<CommandItem>(r => ({
    kind: 'racm',
    id:   r.id,
    name: r.name,
    meta: r.bpId.toUpperCase(),
    view: 'governance-racm',
  })),
  ...RISKS.map<CommandItem>(r => ({
    kind: 'risk',
    id:   r.id,
    name: r.name,
    meta: r.bpId.toUpperCase(),
    view: 'audit-risk-register',
  })),
  ...CONTROLS.map<CommandItem>(c => ({
    kind: 'control',
    id:   c.id,
    name: c.name,
    meta: c.id,
    view: 'governance-controls',
  })),
];

// ─── Search ─────────────────────────────────────────────────────────────────
//
// Case-insensitive contains match against name + id + meta. Cheap and
// predictable; covers the common "I know roughly what I'm looking for" case.

function matches(item: CommandItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    item.name.toLowerCase().includes(q) ||
    item.id.toLowerCase().includes(q)   ||
    (item.meta?.toLowerCase().includes(q) ?? false)
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function CommandPalette() {
  const [open, setOpen]               = useState(false);
  const [query, setQuery]             = useState('');
  const [highlightIdx, setHighlight]  = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef  = useRef<HTMLDivElement>(null);

  // ─── Global Cmd+K / Ctrl+K binding ────────────────────────────────────────
  // Listen at the window level so the palette opens from anywhere. We allow
  // the open shortcut even when an input has focus — it's a global escape
  // hatch, not a chat composer keybind.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isK = e.key === 'k' || e.key === 'K';
      if (isK && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(prev => !prev);
        setQuery('');
        setHighlight(0);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ─── Filtered + grouped results ──────────────────────────────────────────
  // Memo keyed on the trimmed query: re-filter only when the typed text
  // actually changes. We cap at MAX_RESULTS so very generic queries don't
  // produce a 100-row list.
  const groups = useMemo(() => {
    const filtered = ALL_ITEMS.filter(it => matches(it, query)).slice(0, MAX_RESULTS);
    const byKind: Record<CommandKind, CommandItem[]> = {
      process: [], racm: [], risk: [], control: [],
    };
    for (const it of filtered) byKind[it.kind].push(it);
    return KIND_ORDER
      .map(kind => ({ kind, items: byKind[kind] }))
      .filter(g => g.items.length > 0);
  }, [query]);

  // Flat list mirroring the rendered order. Drives keyboard navigation —
  // ArrowUp/Down walks this list regardless of which section the item is in.
  const flatItems = useMemo(
    () => groups.flatMap(g => g.items),
    [groups],
  );

  // Reset highlight when results change (typing a new query).
  useEffect(() => { setHighlight(0); }, [query]);

  // Reset highlight + query when the palette closes/reopens.
  useEffect(() => {
    if (open) {
      setQuery('');
      setHighlight(0);
      // Defer focus to next tick so the input is in the DOM. autoFocus also
      // works, but only on initial mount; we re-focus on every open.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Keep the highlighted row visible during keyboard navigation.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-cmd-idx="${highlightIdx}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlightIdx]);

  const close = useCallback(() => setOpen(false), []);

  const selectItem = useCallback((item: CommandItem) => {
    // Mirror the existing `irame:open-report` pattern: the palette is a leaf
    // component that dispatches; App.tsx owns the router and listens. Keeps
    // the palette decoupled from useAppState plumbing.
    const detail: NavigateDetail = {
      kind: item.kind,
      id:   item.id,
      view: item.view,
      bpId: item.kind === 'process' ? item.id : undefined,
    };
    window.dispatchEvent(new CustomEvent('irame:command-palette-navigate', { detail }));
    close();
  }, [close]);

  // ─── Keyboard navigation inside the palette ──────────────────────────────
  // Esc closes regardless of focus. Arrow keys + Enter only fire while the
  // palette is open and at least one result exists.
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (flatItems.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight(prev => (prev + 1) % flatItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(prev => (prev - 1 + flatItems.length) % flatItems.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const picked = flatItems[highlightIdx];
      if (picked) selectItem(picked);
    }
  };

  // Track the running index across groups so each row knows its position in
  // flatItems (needed for highlight + role="option" wiring).
  let runningIdx = -1;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="palette-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="fixed inset-0 bg-ink-900/40 z-50 flex items-start justify-center pt-[15vh]"
          onClick={close}
        >
          <motion.div
            key="palette-card"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            exit   ={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            className="w-[600px] max-w-[90vw] bg-paper-0 rounded-xl shadow-2xl border border-paper-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search input */}
            <input
              ref={inputRef}
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search processes, RACMs, risks, controls..."
              aria-label="Search command"
              aria-controls="cmd-palette-listbox"
              aria-activedescendant={flatItems[highlightIdx] ? `cmd-opt-${highlightIdx}` : undefined}
              className="w-full px-5 py-4 text-[0.875rem] text-ink-800 bg-transparent border-b border-paper-200 placeholder:text-ink-400 focus:outline-none"
            />

            {/* Results / states */}
            <div
              ref={listRef}
              id="cmd-palette-listbox"
              role="listbox"
              aria-label="Command results"
              className="max-h-[420px] overflow-y-auto py-1"
            >
              {/* Empty input → tip */}
              {query.trim() === '' && flatItems.length === ALL_ITEMS.length && (
                <div className="px-5 py-8 text-center text-[0.8125rem] text-ink-500">
                  Type to search…
                </div>
              )}

              {/* Query present but no matches */}
              {query.trim() !== '' && flatItems.length === 0 && (
                <div className="px-5 py-8 text-center text-[0.8125rem] text-ink-500">
                  No results
                </div>
              )}

              {/* Grouped results — only render groups once the user starts typing,
                  OR show the full grouped list when the input is empty as a
                  passive directory of available targets. */}
              {(query.trim() !== '' || flatItems.length !== ALL_ITEMS.length) &&
                groups.map(group => {
                  const Icon = KIND_ICON[group.kind];
                  return (
                    <div key={group.kind}>
                      <div
                        className="px-5 pt-3 pb-1 text-[0.625rem] font-bold tracking-wider uppercase text-ink-500"
                        role="presentation"
                      >
                        {KIND_LABEL[group.kind]}
                      </div>
                      {group.items.map((item) => {
                        runningIdx += 1;
                        const idx = runningIdx;
                        const isHighlighted = idx === highlightIdx;
                        return (
                          <div
                            key={`${group.kind}-${item.id}`}
                            id={`cmd-opt-${idx}`}
                            data-cmd-idx={idx}
                            role="option"
                            aria-selected={isHighlighted}
                            onMouseEnter={() => setHighlight(idx)}
                            onClick={() => selectItem(item)}
                            className={
                              'px-5 py-2.5 flex items-center gap-3 cursor-pointer hover:bg-paper-50 ' +
                              (isHighlighted ? 'bg-brand-50' : '')
                            }
                          >
                            <Icon size={16} className="text-ink-500 shrink-0" aria-hidden="true" />
                            <span className="text-[0.8125rem] text-ink-800 font-medium truncate">
                              {item.name}
                            </span>
                            {item.meta && (
                              <span className="text-[0.6875rem] text-ink-500 ml-auto shrink-0">
                                {item.meta}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
            </div>

            {/* Footer tip */}
            <div className="px-5 py-2.5 border-t border-paper-200 text-[0.6875rem] text-ink-400 flex items-center justify-between">
              <span>↑↓ to navigate · Enter to select · Esc to close</span>
              <span className="text-ink-300">⌘K</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
