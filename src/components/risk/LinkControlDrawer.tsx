/** Link controls to a risk — search the whole Control Library. */
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Check, Search, X } from 'lucide-react';
import { Button } from '../shared/Button';
import { useToast } from '../shared/Toast';
import { useAuditLog } from '../../context/AdminDataContext';
import { PROCESS_LONG } from '../../data/auditPlan';
import type { ProcessCode } from '../../data/engagements';
import type { ErmRisk } from '../../data/erm/model';
import { controlEffect } from '../../data/erm/controls';
import type { ScoreContext } from '../../data/erm/score';
import { linkControl } from '../../data/erm/store';

const STATUS: Record<string, string> = { live: 'Live', 'awaiting-review': 'Awaiting review', 'needs-data': 'Needs data', manual: 'Manual test', 'no-workflow': 'No workflow', draft: 'Draft' };

export default function LinkControlDrawer({ risk, ctx, onClose }: { risk: ErmRisk; ctx: ScoreContext; onClose: () => void }) {
  const { addToast } = useToast();
  const logEvent = useAuditLog();
  const [q, setQ] = useState('');
  const [scope, setScope] = useState<'process' | 'all'>('process');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const list = useMemo(() => [...ctx.index.values()]
    .filter(c => !risk.controlIds.includes(c.controlId) && c.status !== 'Archived')
    .filter(c => scope === 'all' || c.businessProcess === risk.businessProcess)
    .filter(c => !q.trim() || [c.controlId, c.name, c.subProcess, c.description].some(v => v.toLowerCase().includes(q.trim().toLowerCase())))
    .sort((a, b) => (b.subProcess === risk.subProcess ? 1 : 0) - (a.subProcess === risk.subProcess ? 1 : 0) || a.controlId.localeCompare(b.controlId)),
  [ctx, risk, q, scope]);

  const save = () => {
    picked.forEach(id => linkControl(risk.id, id));
    addToast({ message: `${picked.size} control${picked.size === 1 ? '' : 's'} linked — ${risk.id} re-rated`, type: 'success' });
    logEvent({ action: 'Update', description: `Linked ${[...picked].join(', ')} to ${risk.id}`, module: 'Risk Register', entity: 'Risk' });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50">
      <motion.div className="absolute inset-0 bg-ink-900/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.aside
        role="dialog" aria-label={`Link controls to ${risk.id}`}
        initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
        className="absolute right-0 top-0 h-full w-full max-w-[36rem] bg-canvas-elevated border-l border-canvas-border flex flex-col"
      >
        <div className="px-6 py-4 border-b border-canvas-border">
          <div className="flex items-start gap-3">
            <div className="min-w-0">
              <h2 className="text-[1.125rem] font-semibold text-ink-900">Link controls</h2>
              <p className="text-[0.8125rem] text-ink-500 truncate"><span className="font-mono">{risk.id}</span> · {risk.name}</p>
            </div>
            <button onClick={onClose} aria-label="Close" className="ml-auto size-8 rounded-md flex items-center justify-center text-ink-400 hover:bg-paper-100 cursor-pointer"><X size={16} /></button>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" aria-hidden />
              <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search the Control Library" aria-label="Search controls" className="w-full h-9 pl-9 pr-3 rounded-lg border border-canvas-border text-[0.8125rem] outline-none focus:border-brand-300" />
            </div>
            <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-paper-100">
              {(['process', 'all'] as const).map(s => (
                <button key={s} aria-pressed={scope === s} onClick={() => setScope(s)} className={`h-8 px-3 rounded-md text-[0.75rem] font-medium cursor-pointer ${scope === s ? 'bg-canvas-elevated text-ink-900 shadow-sm' : 'text-ink-500'}`}>
                  {s === 'process' ? risk.businessProcess : 'Every process'}
                </button>
              ))}
            </div>
          </div>
        </div>
        <ul className="flex-1 overflow-y-auto divide-y divide-canvas-border">
          {list.length === 0 && <li className="px-6 py-10 text-center text-[0.8125rem] text-ink-500">No controls match.</li>}
          {list.map(c => {
            const e = controlEffect(c, ctx.std);
            const on = picked.has(c.controlId);
            return (
              <li key={c.controlId}>
                <button
                  onClick={() => setPicked(s => { const n = new Set(s); if (n.has(c.controlId)) n.delete(c.controlId); else n.add(c.controlId); return n; })}
                  aria-pressed={on}
                  className={`w-full flex items-start gap-3 px-6 py-3 text-left cursor-pointer ${on ? 'bg-brand-50/50' : 'hover:bg-paper-50/60'}`}
                >
                  <span className={`mt-0.5 size-4 rounded border flex items-center justify-center shrink-0 ${on ? 'bg-brand-600 border-brand-600 text-white' : 'border-ink-300'}`}>{on && <Check size={11} strokeWidth={3} />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-[0.6875rem] text-ink-400">
                      <span className="font-mono text-ink-500">{c.controlId}</span>
                      <span>· {c.library === 'standard' ? 'Standard library' : 'Custom'}</span>
                      <span>· {PROCESS_LONG[c.businessProcess as ProcessCode] ?? c.businessProcess} / {c.subProcess}</span>
                    </span>
                    <span className="block text-[0.8125rem] font-semibold text-ink-900">{c.name}</span>
                    <span className="block text-[0.75rem] text-ink-500 line-clamp-1">{c.description}</span>
                  </span>
                  <span className="text-right shrink-0">
                    <span className="block text-[0.6875rem] font-medium text-ink-700">{STATUS[e.status]}</span>
                    <span className="block text-[0.625rem] text-ink-400 tabular-nums">{Math.round(e.effectiveness * 100)}% effective</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center gap-2 px-6 py-4 border-t border-canvas-border">
          <span className="text-[0.75rem] text-ink-500 tabular-nums">{picked.size} selected</span>
          <Button variant="outline" className="ml-auto" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={picked.size === 0} onClick={save}>Link {picked.size || ''} control{picked.size === 1 ? '' : 's'}</Button>
        </div>
      </motion.aside>
    </div>
  );
}
