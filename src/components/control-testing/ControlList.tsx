import { useMemo, useState } from 'react';
import { Search, Workflow as WorkflowIcon, ClipboardCheck, Clock, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../lib/cn';
import { Skeleton } from '../shared/Skeleton';
import { ControlStatusPill, MethodChip } from './parts';
import { deriveControlMethod, type ControlTest, type Role } from './types';
import { queueForRole } from './useControlTesting';

type Quick = 'needs-you' | 'untested' | 'concluded' | 'all';

const QUICK_LABEL: Record<Quick, string> = {
  'needs-you': 'Needs you',
  untested: 'In progress',
  concluded: 'Concluded',
  all: 'All',
};

export function ControlList({
  controls,
  role,
  selectedId,
  onSelect,
  loading,
}: {
  controls: ControlTest[];
  role: Role;
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
}) {
  const [query, setQuery] = useState('');
  const [quick, setQuick] = useState<Quick>('needs-you');

  const actionableIds = useMemo(() => new Set(queueForRole(controls, role).actionable.map((c) => c.controlId)), [controls, role]);

  const counts = useMemo(
    () => ({
      'needs-you': actionableIds.size,
      untested: controls.filter((c) => c.stage !== 'concluded').length,
      concluded: controls.filter((c) => c.stage === 'concluded').length,
      all: controls.length,
    }),
    [controls, actionableIds],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return controls.filter((c) => {
      if (quick === 'needs-you' && !actionableIds.has(c.controlId)) return false;
      if (quick === 'untested' && c.stage === 'concluded') return false;
      if (quick === 'concluded' && c.stage !== 'concluded') return false;
      if (!q) return true;
      return (
        c.controlId.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.owner.toLowerCase().includes(q) ||
        c.process.toLowerCase().includes(q)
      );
    });
  }, [controls, query, quick, actionableIds]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* search */}
      <div className="relative mb-3">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search controls, owners, process…"
          className="w-full h-9 pl-9 pr-3 rounded-lg border border-canvas-border bg-canvas-elevated text-[13px] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-50"
        />
      </div>

      {/* quick filters */}
      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        {(['needs-you', 'untested', 'concluded', 'all'] as Quick[]).map((q) => {
          const active = quick === q;
          return (
            <button
              key={q}
              onClick={() => setQuick(q)}
              className={cn(
                'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[12px] font-semibold transition-colors cursor-pointer',
                active ? 'bg-brand-600 text-white' : 'bg-paper-50 text-ink-500 hover:text-ink-700 border border-canvas-border',
              )}
            >
              {QUICK_LABEL[q]}
              <span className={cn('tabular-nums', active ? 'text-white/80' : 'text-ink-400')}>{counts[q]}</span>
            </button>
          );
        })}
      </div>

      {/* list */}
      <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1 space-y-2">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-canvas-border p-3.5 space-y-2.5">
              <div className="flex items-center justify-between"><Skeleton width="w-20" height="h-3.5" /><Skeleton width="w-16" height="h-5" rounded="rounded-full" /></div>
              <Skeleton width="w-full" height="h-3.5" />
              <Skeleton width="w-2/3" height="h-3" />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center text-center py-12 px-4">
            <div className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center mb-3"><ClipboardCheck size={18} className="text-brand-700" /></div>
            <p className="text-[13.5px] font-semibold text-ink-800">Nothing here</p>
            <p className="text-[12.5px] text-ink-500 mt-1">No controls match this filter. Try “All”.</p>
          </div>
        ) : (
          filtered.map((c) => {
            const selected = selectedId === c.controlId;
            const needsYou = actionableIds.has(c.controlId);
            return (
              <motion.button
                key={c.controlId}
                layout
                onClick={() => onSelect(c.controlId)}
                className={cn(
                  'w-full text-left rounded-xl border bg-canvas-elevated p-3.5 transition-all cursor-pointer relative overflow-hidden',
                  selected ? 'border-brand-300 ring-2 ring-brand-50 shadow-[0_8px_24px_-16px_rgba(106,18,205,0.5)]' : 'border-canvas-border hover:border-brand-200',
                )}
              >
                {needsYou && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-brand-500" />}
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="inline-flex items-center gap-2">
                    <span className="font-mono text-[12px] font-semibold text-ink-700">{c.controlId}</span>
                    {c.isKey && <span className="text-[10px] font-bold uppercase tracking-wide text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded">Key</span>}
                  </span>
                  <ControlStatusPill c={c} />
                </div>
                <p className="text-[13px] font-medium text-ink-900 leading-snug mb-2 line-clamp-2">{c.name}</p>
                <div className="flex items-center gap-2 flex-wrap text-[11.5px] text-ink-500">
                  <MethodChip method={deriveControlMethod(c)} />
                  <span className="inline-flex items-center gap-1"><Clock size={12} />{c.frequency}</span>
                  <span className="inline-flex items-center gap-1"><WorkflowIcon size={12} />{c.attributes.filter((a) => a.workflow).length} wf</span>
                  <span className={cn('inline-flex items-center gap-1 ml-auto font-medium', c.overdue ? 'text-risk-700' : 'text-ink-500')}>
                    {c.overdue && <AlertCircle size={12} />}{c.dueLabel}
                  </span>
                </div>
              </motion.button>
            );
          })
        )}
      </div>
    </div>
  );
}
