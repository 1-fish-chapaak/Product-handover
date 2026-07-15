import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight, Calendar, Check, CheckCircle2, ChevronDown, Database, FlaskConical, History, ListChecks, SlidersHorizontal, Sparkles, Workflow, XCircle,
} from 'lucide-react';
import { useIcfr } from './store';
import DatePicker from '../shared/DatePicker';
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

// runs carry relative timestamps ('just now', '3d ago', '2w ago') — anchor them
// to concrete dates so the range picker has something real to compare against
const daysAgo = (at: string): number => {
  const m = at.match(/(\d+)\s*([dw])/i);
  return m ? parseInt(m[1]!, 10) * (m[2]!.toLowerCase() === 'w' ? 7 : 1) : 0;
};
const toISO = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const isoDaysBack = (n: number): string => { const d = new Date(); d.setDate(d.getDate() - n); return toISO(d); };
const runISO = (at: string): string => isoDaysBack(daysAgo(at));
const fmtShort = (iso: string): string => new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const RANGE_FIELD = 'w-full h-8 px-2.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[12px] font-medium text-ink-800 hover:border-ink-300 transition-colors text-left';

/** The date filter — a From / To range on the shared brand calendar, with quick windows. */
function DateRangeMenu({ from, to, onChange, open, onToggle }: {
  from: string; to: string; onChange: (from: string, to: string) => void; open: boolean; onToggle: () => void;
}) {
  const isDefault = !from && !to;
  const label = isDefault ? 'All time'
    : from && to ? (from === to ? fmtShort(from) : `${fmtShort(from)} – ${fmtShort(to)}`)
    : from ? `From ${fmtShort(from)}`
    : `Until ${fmtShort(to)}`;
  return (
    <div className="relative">
      <button onClick={onToggle} aria-label="Filter by date range"
        className={cn('h-8 px-2.5 inline-flex items-center gap-1.5 rounded-lg border text-[12px] font-semibold transition-colors cursor-pointer',
          isDefault ? 'border-canvas-border bg-canvas-elevated text-ink-700 hover:border-ink-300' : 'border-brand-200 bg-brand-50 text-brand-700')}>
        <Calendar size={13} className={isDefault ? 'text-ink-400' : 'text-brand-600'} />
        {label}
        <ChevronDown size={12} className="text-ink-400" />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={onToggle} />
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              className="absolute left-0 mt-1.5 z-20 w-72 rounded-xl border border-canvas-border bg-canvas-elevated shadow-[0_16px_40px_-16px_rgba(15,8,30,.4)] p-3">
              <div className="grid grid-cols-2 gap-2">
                <label>
                  <span className="block text-[10.5px] font-semibold uppercase tracking-wide text-ink-400 mb-1">From</span>
                  <DatePicker value={from} onChange={e => onChange(e.target.value, to)} max={to || undefined} placeholder="Any" aria-label="Runs from date" className={RANGE_FIELD} />
                </label>
                <label>
                  <span className="block text-[10.5px] font-semibold uppercase tracking-wide text-ink-400 mb-1">To</span>
                  <DatePicker value={to} onChange={e => onChange(from, e.target.value)} min={from || undefined} placeholder="Any" aria-label="Runs to date" className={RANGE_FIELD} />
                </label>
              </div>
              <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                {[{ l: 'Today', d: 0 }, { l: 'Last 7 days', d: 7 }, { l: 'Last 30 days', d: 30 }].map(s => (
                  <button key={s.l} onClick={() => onChange(isoDaysBack(s.d), isoDaysBack(0))}
                    className="h-6 px-2 rounded-md border border-canvas-border text-[11px] font-semibold text-ink-600 hover:text-brand-700 hover:border-brand-300 cursor-pointer transition-colors">
                    {s.l}
                  </button>
                ))}
                <span className="flex-1" />
                {!isDefault && (
                  <button onClick={() => onChange('', '')} className="h-6 px-2 rounded-md text-[11px] font-semibold text-ink-500 hover:text-ink-800 cursor-pointer transition-colors">
                    Clear
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

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
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [menu, setMenu] = useState<'kind' | 'date' | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const inWindow = useMemo(
    () => eng.runs.filter(r => {
      const d = runISO(r.at);
      return (!from || d >= from) && (!to || d <= to);
    }),
    [eng.runs, from, to],
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
        <DateRangeMenu from={from} to={to} open={menu === 'date'}
          onToggle={() => setMenu(m => (m === 'date' ? null : 'date'))}
          onChange={(f, t) => { setFrom(f); setTo(t); }} />
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
