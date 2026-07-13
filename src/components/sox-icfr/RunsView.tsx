import { useMemo, useState } from 'react';
import {
  ArrowRight, CheckCircle2, ChevronDown, Database, FlaskConical, History, ListChecks, Sparkles, Workflow, XCircle,
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
  { id: 'all', label: 'All' },
  { id: 'bulk-test', label: 'Bulk tests' },
  { id: 'control-test', label: 'Control tests' },
  { id: 'workflow-run', label: 'Workflow runs' },
  { id: 'ai-validation', label: 'AI validations' },
];

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
  const [openId, setOpenId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c: Record<FilterId, number> = { all: eng.runs.length, 'bulk-test': 0, 'control-test': 0, 'workflow-run': 0, 'ai-validation': 0 };
    eng.runs.forEach(r => { c[r.kind] += 1; });
    return c;
  }, [eng.runs]);

  const runs = useMemo(() => (filter === 'all' ? eng.runs : eng.runs.filter(r => r.kind === filter)), [eng.runs, filter]);

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-[22px] font-semibold text-ink-900 tracking-tight" style={{ fontFamily: "'Source Serif 4', serif" }}>Runs</h1>
        <p className="text-[13px] text-ink-500 mt-0.5">Every execution in this engagement — bulk tests, control tests, workflow runs and AI validations, newest first.</p>
      </div>

      {/* kind filters */}
      <div className="flex items-center gap-1.5 mb-4 flex-wrap">
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} className={cn('view-chip', filter === f.id && 'on')}>
            {f.label} <span className="tabular-nums opacity-60">{counts[f.id]}</span>
          </button>
        ))}
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
            No runs here yet — test a control, or bulk test from the RACM or Control library, and the run lands in this registry.
          </div>
        )}
      </div>
    </div>
  );
}
