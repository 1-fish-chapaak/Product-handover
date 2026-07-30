// ─── Run Selector — the descriptor-as-dropdown over stored runs ─────────────
//
// The label naming the comparison window ("Across last 3 runs") IS the
// dropdown trigger, so the header always names the current selection. Free
// multi-select of prior runs with Last-run / Last-3 / All shortcuts; the
// current run is the fixed anchor (pinned, can't be unpicked) and at least one
// prior must stay selected. Extracted from the workflow output-compare card so
// the run-output insight card's trajectory band offers the identical control.

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GitCompareArrows, ChevronDown, Check } from 'lucide-react';

export interface RunOption {
  id: string;
  /** Full run label, e.g. "Jun 2026". */
  label: string;
  /** Human date, e.g. "02 Jun 2026". */
  date: string;
  /** Right-aligned mono figure for the row, e.g. the run's exception count. */
  meta?: string;
}

export default function RunSelector({ priors, current, selectedIds, descriptor, onToggle, onQuick }: {
  /** Prior runs, oldest → newest. */
  priors: RunOption[];
  /** The run being viewed — pinned at the bottom of the list. */
  current?: RunOption;
  selectedIds: Set<string>;
  /** Header wording for the selection — doubles as the trigger label. */
  descriptor: string;
  onToggle: (id: string) => void;
  onQuick: (ids: string[]) => void;
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

  const recent = [...priors].reverse(); // most-recent first in the list
  const lastId = priors[priors.length - 1]?.id;
  const quicks = [
    { label: 'Last run', ids: lastId ? [lastId] : [] },
    { label: 'Last 3', ids: priors.slice(-2).map(r => r.id) }, // 2 priors + current = 3 runs
    { label: 'All', ids: priors.map(r => r.id) },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="group inline-flex items-center gap-1.5 -ml-1 rounded-lg px-1.5 py-1 hover:bg-canvas transition-colors cursor-pointer"
      >
        <span className="size-6 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
          <GitCompareArrows size={13} />
        </span>
        <span className="text-[0.625rem] font-bold uppercase tracking-wider text-brand-700">{descriptor}</span>
        <ChevronDown size={13} className={`text-brand-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-0 top-[calc(100%+6px)] z-30 w-64 rounded-xl border border-canvas-border bg-canvas-elevated p-2 shadow-lg shadow-ink-900/5"
          >
            <div className="px-1.5 pt-1 pb-1.5 text-[0.625rem] font-bold uppercase tracking-wider text-ink-400">Compare against</div>
            <div className="flex flex-wrap gap-1 px-1 pb-2">
              {quicks.map(q => {
                const active = q.ids.length === selectedIds.size && q.ids.every(id => selectedIds.has(id));
                return (
                  <button key={q.label} type="button" onClick={() => onQuick(q.ids)}
                    className={`rounded-md px-2 py-1 text-[0.6875rem] font-semibold transition-colors cursor-pointer ${active ? 'bg-brand-600 text-white' : 'bg-canvas text-ink-600 hover:bg-brand-50 hover:text-brand-700'}`}>
                    {q.label}
                  </button>
                );
              })}
            </div>
            <div className="max-h-56 overflow-y-auto">
              {recent.map(r => {
                const checked = selectedIds.has(r.id);
                const lockLast = checked && selectedIds.size === 1; // keep ≥1 prior
                return (
                  <button key={r.id} type="button"
                    onClick={() => { if (!lockLast) onToggle(r.id); }}
                    disabled={lockLast}
                    title={lockLast ? 'Keep at least one run to compare against' : undefined}
                    className={`w-full flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors ${lockLast ? 'cursor-default' : 'cursor-pointer hover:bg-canvas'}`}>
                    <span className={`size-4 shrink-0 rounded-xs border flex items-center justify-center ${checked ? 'bg-brand-600 border-brand-600 text-white' : 'border-canvas-border bg-canvas'}`}>
                      {checked && <Check size={11} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.75rem] font-semibold text-ink-800">{r.label}</span>
                      <span className="block text-[0.65625rem] text-ink-400">{r.date}</span>
                    </span>
                    {r.meta != null && (
                      <span className="shrink-0 text-[0.6875rem] font-mono text-ink-500 tabular-nums">{r.meta}</span>
                    )}
                  </button>
                );
              })}
            </div>
            {current && (
              <div className="mt-1 flex items-center gap-2.5 border-t border-canvas-border px-2 pt-2">
                <span className="size-4 shrink-0 rounded-xs border border-brand-200 bg-brand-50 flex items-center justify-center text-brand-500">
                  <Check size={11} />
                </span>
                <span className="min-w-0 flex-1 text-[0.71875rem] text-ink-500">
                  <span className="font-semibold text-ink-700">{current.label}</span> · this run
                </span>
                {current.meta != null && (
                  <span className="shrink-0 text-[0.6875rem] font-mono text-ink-500 tabular-nums">{current.meta}</span>
                )}
              </div>
            )}
            <p className="px-2 pt-2 text-[0.65625rem] text-ink-400">
              {selectedIds.size + 1} runs in view · {selectedIds.size >= 2 ? 'trend' : 'delta'}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
