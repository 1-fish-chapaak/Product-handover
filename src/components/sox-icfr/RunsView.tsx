import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight, Calendar, Check, CheckCircle2, ChevronDown, Database, FlaskConical, History, ListChecks, SlidersHorizontal, Sparkles, Workflow, XCircle,
} from 'lucide-react';
import { useIcfr } from './store';
import { cn } from '../../lib/cn';
import type { RunKind, RunRecord } from './types';

/**
 * Runs — the engagement's execution registry. Every bulk test, single-control
 * test, workflow run and AI validation lands here, newest first, with its
 * per-control outcomes one click away.
 */

const KIND_META: Record<RunKind, { label: string; Icon: typeof FlaskConical; chip: string }> = {
  'bulk-test': { label: 'Bulk test', Icon: FlaskConical, chip: 'bg-brand-50 text-brand-700' },
  'control-test': { label: 'Control test', Icon: ListChecks, chip: 'bg-evidence-50 text-evidence-700' },
  'workflow-run': { label: 'Workflow run', Icon: Workflow, chip: 'bg-compliant-50 text-compliant-700' },
  'ai-validation': { label: 'AI validation', Icon: Sparkles, chip: 'bg-mitigated-50 text-mitigated-700' },
};

type FilterId = 'all' | RunKind;
const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'All types' },
  { id: 'bulk-test', label: 'Bulk tests' },
  { id: 'control-test', label: 'Control tests' },
  { id: 'workflow-run', label: 'Workflow runs' },
  { id: 'ai-validation', label: 'AI validations' },
];

type DateId = 'any' | 'today' | '7d' | '30d';
const DATES: { id: DateId; label: string; days: number | null }[] = [
  { id: 'any', label: 'All time', days: null },
  { id: 'today', label: 'Today', days: 0 },
  { id: '7d', label: 'Last 7 days', days: 7 },
  { id: '30d', label: 'Last 30 days', days: 30 },
];
// runs carry relative timestamps ('just now', '3d ago', '2w ago') — read them as days-ago
const daysAgo = (at: string): number => {
  const m = at.match(/(\d+)\s*([dw])/i);
  return m ? parseInt(m[1]!, 10) * (m[2]!.toLowerCase() === 'w' ? 7 : 1) : 0;
};

/** One compact filter button + popover menu — the register's dropdown idiom. */
function FilterMenu<T extends string>({ Icon, ariaLabel, value, options, isDefault, onPick, open, onToggle }: {
  Icon: typeof Calendar; ariaLabel: string; value: T;
  options: { id: T; label: string; count?: number }[];
  isDefault: boolean; onPick: (id: T) => void; open: boolean; onToggle: () => void;
}) {
  const current = options.find(o => o.id === value)!;
  return (
    <div className="relative">
      <button onClick={onToggle} aria-label={ariaLabel}
        className={cn('h-8 px-2.5 inline-flex items-center gap-1.5 rounded-lg border text-[12px] font-semibold transition-colors cursor-pointer',
          isDefault ? 'border-canvas-border bg-canvas-elevated text-ink-700 hover:border-ink-300' : 'border-brand-200 bg-brand-50 text-brand-700')}>
        <Icon size={13} className={isDefault ? 'text-ink-400' : 'text-brand-600'} />
        {current.label}
        {current.count !== undefined && <span className="tabular-nums opacity-60">{current.count}</span>}
        <ChevronDown size={12} className="text-ink-400" />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={onToggle} />
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              className="absolute left-0 mt-1.5 z-20 w-52 rounded-xl border border-canvas-border bg-canvas-elevated shadow-[0_16px_40px_-16px_rgba(15,8,30,.4)] p-1">
              {options.map(o => (
                <button key={o.id} onClick={() => onPick(o.id)}
                  className={cn('w-full text-left px-2.5 py-1.5 rounded-lg text-[12.5px] hover:bg-paper-50 cursor-pointer flex items-center gap-2', o.id === value ? 'text-brand-700 font-semibold' : 'text-ink-700')}>
                  {o.id === value ? <Check size={12} /> : <span className="w-3" />}
                  <span className="flex-1">{o.label}</span>
                  {o.count !== undefined && <span className="text-[11px] text-ink-400 tabular-nums">{o.count}</span>}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function OutcomeChips({ run }: { run: RunRecord }) {
  const eff = run.controls.filter(c => c.outcome === 'Effective').length;
  const ineff = run.controls.length - eff;
  return (
    <span className="inline-flex items-center gap-1.5">
      {eff > 0 && <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-compliant-700"><CheckCircle2 size={13} /> {eff} effective</span>}
      {ineff > 0 && <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-risk-700"><XCircle size={13} /> {ineff} ineffective</span>}
    </span>
  );
}

export default function RunsView() {
  const { eng, openControl } = useIcfr();
  const [filter, setFilter] = useState<FilterId>('all');
  const [date, setDate] = useState<DateId>('any');
  const [menu, setMenu] = useState<'kind' | 'date' | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const dateWindow = DATES.find(d => d.id === date)!;
  const inWindow = useMemo(
    () => eng.runs.filter(r => dateWindow.days === null || daysAgo(r.at) <= dateWindow.days),
    [eng.runs, dateWindow.days],
  );

  // kind counts follow the date window, so the menu reads as what you'll get
  const counts = useMemo(() => {
    const c: Record<FilterId, number> = { all: inWindow.length, 'bulk-test': 0, 'control-test': 0, 'workflow-run': 0, 'ai-validation': 0 };
    inWindow.forEach(r => { c[r.kind] += 1; });
    return c;
  }, [inWindow]);

  const runs = useMemo(() => (filter === 'all' ? inWindow : inWindow.filter(r => r.kind === filter)), [inWindow, filter]);

  return (
    <div>
      {/* filters — one type menu, one date window */}
      <div className="flex items-center gap-1.5 mb-4 flex-wrap">
        <FilterMenu Icon={SlidersHorizontal} ariaLabel="Filter by run type" value={filter}
          options={FILTERS.map(f => ({ id: f.id, label: f.label, count: counts[f.id] }))}
          isDefault={filter === 'all'} open={menu === 'kind'}
          onToggle={() => setMenu(m => (m === 'kind' ? null : 'kind'))}
          onPick={id => { setFilter(id); setMenu(null); }} />
        <FilterMenu Icon={Calendar} ariaLabel="Filter by date" value={date}
          options={DATES.map(d => ({ id: d.id, label: d.label }))}
          isDefault={date === 'any'} open={menu === 'date'}
          onToggle={() => setMenu(m => (m === 'date' ? null : 'date'))}
          onPick={id => { setDate(id); setMenu(null); }} />
      </div>

      {/* the registry */}
      <div className="space-y-2">
        {runs.map(r => {
          const meta = KIND_META[r.kind];
          const isOpen = openId === r.id;
          return (
            <div key={r.id} className="rounded-xl border border-canvas-border bg-canvas-elevated overflow-hidden">
              <button onClick={() => setOpenId(isOpen ? null : r.id)} aria-expanded={isOpen}
                className="w-full flex items-center gap-3 p-3.5 text-left cursor-pointer hover:bg-paper-50/60 transition-colors">
                <span className={cn('w-9 h-9 rounded-lg inline-flex items-center justify-center shrink-0', meta.chip)}><meta.Icon size={16} /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-semibold text-ink-900">{r.label}</span>
                    <span className={cn('px-1.5 h-[17px] inline-flex items-center rounded text-[9.5px] font-bold uppercase tracking-wide', meta.chip)}>{meta.label}</span>
                  </span>
                  <span className="block text-[11.5px] text-ink-500 mt-0.5 truncate">{r.by} · {r.at}{r.detail ? ` · ${r.detail}` : ''}</span>
                </span>
                <OutcomeChips run={r} />
                <ChevronDown size={15} className={cn('text-ink-400 shrink-0 transition-transform', isOpen && 'rotate-180')} />
              </button>
              {isOpen && (
                <div className="border-t border-canvas-border px-3.5 py-3 bg-paper-50/40">
                  {r.datasets && r.datasets.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
                      <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wide text-ink-400"><Database size={11} /> Datasets</span>
                      {r.datasets.map(d => <span key={d} className="px-2 h-[19px] inline-flex items-center rounded border border-canvas-border bg-canvas-elevated text-[10.5px] font-medium text-ink-600">{d}</span>)}
                    </div>
                  )}
                  <div className="space-y-1">
                    {r.controls.map(c => (
                      <div key={c.controlId} className="flex items-center gap-2.5 rounded-lg bg-canvas-elevated border border-canvas-border px-2.5 py-2">
                        <span className="wp-ref shrink-0">{c.wpRef}</span>
                        <span className="text-[12px] text-ink-700 truncate flex-1 min-w-0">{c.description}</span>
                        <span className="text-[10.5px] text-ink-400 tabular-nums shrink-0">{c.checks} check{c.checks === 1 ? '' : 's'}</span>
                        {c.outcome === 'Effective'
                          ? <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-compliant-700 shrink-0"><CheckCircle2 size={12} /> Effective</span>
                          : <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-risk-700 shrink-0"><XCircle size={12} /> Ineffective</span>}
                        <button onClick={() => openControl(c.controlId)}
                          className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand-700 hover:text-brand-800 cursor-pointer shrink-0 transition-colors">
                          Open control <ArrowRight size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {runs.length === 0 && (
          <div className="text-center py-16 text-ink-400 text-[13px] rounded-2xl border border-dashed border-canvas-border">
            <History size={20} className="mx-auto mb-2 opacity-40" />
            {eng.runs.length === 0
              ? 'No runs here yet — test a control, or bulk test from the RACM or Control library, and the run lands in this registry.'
              : 'No runs match these filters — widen the type or the date window.'}
          </div>
        )}
      </div>
    </div>
  );
}
