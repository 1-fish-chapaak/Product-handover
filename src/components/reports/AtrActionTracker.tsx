import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { X, ListChecks, AlertTriangle, Clock, CheckCircle2, Search, ExternalLink } from 'lucide-react';
import type { AtrLibraryReport } from '../../data/atrLibrary';
import type { AtrActionStatus } from './atrTypes';

interface ActionRow {
  id: string;
  atrId: string;
  atrName: string;
  observation: string;
  process?: string;
  text: string;
  dueDate?: string;
  status: AtrActionStatus;
  owner?: string;
}

const STATUS_META: Record<AtrActionStatus, { cls: string; dot: string }> = {
  Implemented: { cls: 'bg-compliant-50 text-compliant-700 border-compliant/30', dot: 'bg-compliant' },
  'Partially Implemented': { cls: 'bg-mitigated-50 text-mitigated-700 border-mitigated/30', dot: 'bg-mitigated' },
  Pending: { cls: 'bg-high-50 text-high-700 border-high/30', dot: 'bg-high' },
  Overdue: { cls: 'bg-risk-50 text-risk-700 border-risk/30', dot: 'bg-risk' },
  'Not Due': { cls: 'bg-paper-100 text-ink-600 border-canvas-border', dot: 'bg-ink-400' },
};
const ORDER: AtrActionStatus[] = ['Overdue', 'Pending', 'Partially Implemented', 'Not Due', 'Implemented'];

/** Cross-ATR action-item tracker — every management action plan across all ATRs,
 *  filterable by status, with an open/in-progress roll-up. */
export default function AtrActionTracker({ atrs, onOpen, onClose }: {
  atrs: AtrLibraryReport[];
  onOpen: (atrId: string) => void;
  onClose: () => void;
}) {
  const [statusFilter, setStatusFilter] = useState<AtrActionStatus | 'all' | 'open'>('open');
  const [q, setQ] = useState('');

  const rows = useMemo<ActionRow[]>(() => {
    const out: ActionRow[] = [];
    atrs.forEach(a => a.atrData.observations.forEach(o => o.actionPlans.forEach((p, i) => {
      if (!p.text?.trim()) return;
      out.push({
        id: `${a.id}-${o.title}-${i}`, atrId: a.id, atrName: a.name,
        observation: o.title, process: o.process, text: p.text,
        dueDate: p.dueDate, status: p.status ?? 'Pending', owner: a.riskOwner,
      });
    })));
    return out;
  }, [atrs]);

  const counts = useMemo(() => {
    const c = { Implemented: 0, 'Partially Implemented': 0, Pending: 0, Overdue: 0, 'Not Due': 0 } as Record<AtrActionStatus, number>;
    rows.forEach(r => { c[r.status]++; });
    return c;
  }, [rows]);
  const openCount = counts.Pending + counts['Partially Implemented'] + counts.Overdue;

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter(r => {
      if (statusFilter === 'open' && !(r.status === 'Pending' || r.status === 'Partially Implemented' || r.status === 'Overdue')) return false;
      if (statusFilter !== 'all' && statusFilter !== 'open' && r.status !== statusFilter) return false;
      if (s && !(r.text.toLowerCase().includes(s) || r.observation.toLowerCase().includes(s) || r.atrName.toLowerCase().includes(s) || (r.owner ?? '').toLowerCase().includes(s))) return false;
      return true;
    }).sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status));
  }, [rows, statusFilter, q]);

  const KPIS = [
    { key: 'open' as const, label: 'Open', value: openCount, icon: Clock, tone: 'text-high-700 bg-high-50' },
    { key: 'Overdue' as const, label: 'Overdue', value: counts.Overdue, icon: AlertTriangle, tone: 'text-risk-700 bg-risk-50' },
    { key: 'Partially Implemented' as const, label: 'In Progress', value: counts['Partially Implemented'], icon: ListChecks, tone: 'text-mitigated-700 bg-mitigated-50' },
    { key: 'Implemented' as const, label: 'Implemented', value: counts.Implemented, icon: CheckCircle2, tone: 'text-compliant-700 bg-compliant-50' },
  ];

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="fixed inset-0 bg-ink-900/50 backdrop-blur-[2px] z-[60]" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: 8 }} transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[1040px] max-w-[95vw] h-[82vh] bg-canvas-elevated rounded-[16px] shadow-xl border border-canvas-border z-[65] flex flex-col" role="dialog" aria-label="Action item tracker"
      >
        <header className="shrink-0 px-6 py-3.5 flex items-center justify-between gap-4 border-b border-canvas-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[10px] bg-brand-50 text-brand-700 flex items-center justify-center"><ListChecks size={17} /></div>
            <div>
              <h2 className="text-[0.9375rem] font-semibold text-ink-900 leading-tight">Action Item Tracker</h2>
              <p className="text-[0.75rem] text-ink-500">Every management action plan across {atrs.length} ATR{atrs.length === 1 ? '' : 's'}.</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-draft-50 flex items-center justify-center cursor-pointer"><X size={16} /></button>
        </header>

        {/* KPI row — clickable filters */}
        <div className="shrink-0 px-6 py-3 grid grid-cols-4 gap-3 border-b border-canvas-border">
          {KPIS.map(k => (
            <button key={k.key} onClick={() => setStatusFilter(k.key)} className={`text-left rounded-[10px] border p-3 transition-colors cursor-pointer ${statusFilter === k.key ? 'border-brand-400 ring-2 ring-brand-600/15' : 'border-canvas-border hover:border-brand-200'}`}>
              <div className="flex items-center gap-2 mb-1"><span className={`w-6 h-6 rounded-[7px] flex items-center justify-center ${k.tone}`}><k.icon size={13} /></span><span className="text-[1.25rem] font-bold tabular-nums text-ink-900 leading-none">{k.value}</span></div>
              <div className="text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-500">{k.label}</div>
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <div className="shrink-0 px-6 py-2.5 flex items-center gap-3 border-b border-canvas-border">
          <div className="relative flex-1 max-w-[320px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search actions, owners, ATRs…" className="w-full h-9 pl-9 pr-3 rounded-[8px] border border-canvas-border bg-canvas text-[0.8125rem] text-ink-900 focus:outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/15" />
          </div>
          <div className="flex items-center gap-1 ml-auto">
            {(['open', 'all'] as const).map(f => (
              <button key={f} onClick={() => setStatusFilter(f)} className={`h-8 px-3 rounded-[7px] text-[0.75rem] font-semibold capitalize transition-colors cursor-pointer ${statusFilter === f ? 'bg-brand-600 text-white' : 'bg-paper-50 text-ink-600 hover:bg-paper-100'}`}>{f === 'open' ? 'Open only' : 'All'}</button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-20 text-center text-ink-500">
              <CheckCircle2 size={24} className="text-compliant" />
              <div className="text-[0.8125rem] font-medium text-ink-700">Nothing here — no matching action items.</div>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-paper-50 z-10">
                <tr className="text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-ink-500">
                  <th className="px-6 py-2 font-semibold">Action plan</th>
                  <th className="px-3 py-2 font-semibold w-[150px]">Owner</th>
                  <th className="px-3 py-2 font-semibold w-[120px]">Due</th>
                  <th className="px-3 py-2 font-semibold w-[160px]">Status</th>
                  <th className="px-3 py-2 font-semibold w-[60px]"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const m = STATUS_META[r.status];
                  return (
                    <tr key={r.id} className="border-t border-canvas-border hover:bg-paper-50/60">
                      <td className="px-6 py-2.5">
                        <div className="text-[0.8125rem] text-ink-800 leading-snug line-clamp-2">{r.text}</div>
                        <div className="text-[0.625rem] text-ink-400 mt-0.5 truncate">{r.observation} · {r.atrName}</div>
                      </td>
                      <td className="px-3 py-2.5 text-[0.75rem] text-ink-600">{r.owner ?? '—'}</td>
                      <td className="px-3 py-2.5 text-[0.75rem] text-ink-600 tabular-nums">{r.dueDate ?? '—'}</td>
                      <td className="px-3 py-2.5"><span className={`inline-flex items-center gap-1.5 h-6 px-2 rounded-full border text-[0.625rem] font-semibold ${m.cls}`}><span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />{r.status}</span></td>
                      <td className="px-3 py-2.5"><button onClick={() => { onClose(); onOpen(r.atrId); }} title="Open ATR" className="w-7 h-7 rounded-[7px] flex items-center justify-center text-ink-400 hover:text-brand-700 hover:bg-brand-50 cursor-pointer"><ExternalLink size={13} /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </motion.div>
    </>
  );
}
