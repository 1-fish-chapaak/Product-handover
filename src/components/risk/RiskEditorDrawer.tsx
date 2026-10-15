/** Create a risk, or edit one — the fields a risk is rated from. */
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { Button } from '../shared/Button';
import { useToast } from '../shared/Toast';
import { useAuditLog } from '../../context/AdminDataContext';
import { PROCESS_LONG } from '../../data/auditPlan';
import type { ProcessCode } from '../../data/engagements';
import { CATEGORIES, TIER_ACTION, tierOf, type ErmRisk, type Treatment } from '../../data/erm/model';
import { addRisk, updateRisk } from '../../data/erm/store';
import type { RiskCategory } from '../../data/riskRegister';
import { TierChip } from './riskUi';

const PROCESSES: ProcessCode[] = ['P2P', 'O2C', 'R2R', 'S2C', 'INV', 'ITGC'];
const L_LABEL = ['Rare', 'Unlikely', 'Possible', 'Likely', 'Almost certain'];
const I_LABEL = ['Minor', 'Moderate', 'Significant', 'Major', 'Severe'];

export function Scale({ label, value, onChange, names }: { label: string; value: number; onChange: (v: number) => void; names: string[] }) {
  return (
    <div>
      <div className="text-[0.75rem] font-medium text-ink-700">{label} <span className="text-ink-400 font-normal">— {names[value - 1]}</span></div>
      <div className="mt-1.5 grid grid-cols-5 gap-1" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map(v => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            title={names[v - 1]}
            onClick={() => onChange(v)}
            className={`h-9 rounded-lg border font-mono text-[0.8125rem] font-semibold cursor-pointer transition-colors ${value === v ? 'border-brand-600 bg-brand-600 text-white' : 'border-canvas-border text-ink-700 hover:border-brand-200'}`}
          >{v}</button>
        ))}
      </div>
    </div>
  );
}

export default function RiskEditorDrawer({ risk, defaultProcess, onClose, onSaved }: {
  risk?: ErmRisk; defaultProcess?: string; onClose: () => void; onSaved: (id: string) => void;
}) {
  const { addToast } = useToast();
  const logEvent = useAuditLog();
  const [f, setF] = useState({
    name: risk?.name ?? '',
    description: risk?.description ?? '',
    businessProcess: risk?.businessProcess ?? defaultProcess ?? 'P2P',
    subProcess: risk?.subProcess ?? '',
    category: (risk?.category ?? 'Financial') as RiskCategory,
    owner: risk?.owner ?? '',
    reviewer: risk?.reviewer ?? '',
    likelihood: risk?.likelihood ?? 3,
    impact: risk?.impact ?? 3,
    treatment: (risk?.treatment ?? 'Mitigate') as Treatment,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF(x => ({ ...x, [k]: v }));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const ok = f.name.trim() && f.subProcess.trim() && f.owner.trim();
  const inherent = f.likelihood * f.impact * 4;
  const save = () => {
    if (risk) {
      updateRisk(risk.id, { ...f, name: f.name.trim(), description: f.description.trim() });
      addToast({ message: `${risk.id} updated`, type: 'success' });
      logEvent({ action: 'Update', description: `Edited risk "${f.name}" (${risk.id})`, module: 'Risk Register', entity: 'Risk' });
      onSaved(risk.id);
    } else {
      const created = addRisk({ ...f, name: f.name.trim(), description: f.description.trim(), reviewer: f.reviewer.trim() || f.owner.trim(), priority: inherent >= 60 ? 'Critical' : inherent >= 40 ? 'High' : inherent >= 20 ? 'Medium' : 'Low', controlIds: [] });
      addToast({ message: `${created.id} added to the register`, type: 'success' });
      logEvent({ action: 'Create', description: `Created risk "${created.name}" (${created.id})`, module: 'Risk Register', entity: 'Risk' });
      onSaved(created.id);
    }
  };

  const input = 'mt-1 w-full h-9 px-3 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.8125rem] outline-none focus:border-brand-300';
  return (
    <div className="fixed inset-0 z-50">
      <motion.div className="absolute inset-0 bg-ink-900/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.aside
        role="dialog" aria-label={risk ? `Edit ${risk.id}` : 'New risk'}
        initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
        className="absolute right-0 top-0 h-full w-full max-w-[34rem] bg-canvas-elevated border-l border-canvas-border flex flex-col"
      >
        <div className="flex items-center gap-3 px-6 py-4 border-b border-canvas-border">
          <h2 className="text-[1.125rem] font-semibold text-ink-900">{risk ? `Edit ${risk.id}` : 'New risk'}</h2>
          <button onClick={onClose} aria-label="Close" className="ml-auto size-8 rounded-md flex items-center justify-center text-ink-400 hover:bg-paper-100 cursor-pointer"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <label className="block text-[0.75rem] font-medium text-ink-700">Risk<input autoFocus value={f.name} onChange={e => set('name', e.target.value)} className={input} placeholder="What could go wrong" /></label>
          <label className="block text-[0.75rem] font-medium text-ink-700">Description<textarea value={f.description} onChange={e => set('description', e.target.value)} rows={3} className={`${input} h-auto py-2 resize-none`} placeholder="How it happens and what it costs" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-[0.75rem] font-medium text-ink-700">Process
              <select value={f.businessProcess} onChange={e => set('businessProcess', e.target.value)} className={input}>
                {PROCESSES.map(p => <option key={p} value={p}>{PROCESS_LONG[p]}</option>)}
              </select>
            </label>
            <label className="block text-[0.75rem] font-medium text-ink-700">Sub-process<input value={f.subProcess} onChange={e => set('subProcess', e.target.value)} className={input} placeholder="e.g. Vendor Management" /></label>
            <label className="block text-[0.75rem] font-medium text-ink-700">Category
              <select value={f.category} onChange={e => set('category', e.target.value as RiskCategory)} className={input}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label className="block text-[0.75rem] font-medium text-ink-700">Treatment
              <select value={f.treatment} onChange={e => set('treatment', e.target.value as Treatment)} className={input}>
                {['Mitigate', 'Accept', 'Transfer', 'Avoid'].map(t => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label className="block text-[0.75rem] font-medium text-ink-700">Owner<input value={f.owner} onChange={e => set('owner', e.target.value)} className={input} /></label>
            <label className="block text-[0.75rem] font-medium text-ink-700">Reviewer<input value={f.reviewer} onChange={e => set('reviewer', e.target.value)} className={input} /></label>
          </div>
          <div className="rounded-xl border border-canvas-border p-4 space-y-4">
            <div className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-400">Inherent assessment</div>
            <Scale label="Likelihood" value={f.likelihood} onChange={v => set('likelihood', v)} names={L_LABEL} />
            <Scale label="Impact" value={f.impact} onChange={v => set('impact', v)} names={I_LABEL} />
            <div className="flex items-center gap-2 text-[0.8125rem] text-ink-700">
              Inherent exposure <span className="font-mono font-semibold tabular-nums">{inherent}</span>
              <span className="text-ink-400">· before controls</span>
              <TierChip tier={tierOf(inherent)} size="sm" />
            </div>
            {!risk && <p className="text-[0.75rem] text-ink-500">With no control linked yet, it rates {tierOf(inherent)} — {TIER_ACTION[tierOf(inherent)].charAt(0).toLowerCase() + TIER_ACTION[tierOf(inherent)].slice(1)}. Link controls on the next screen.</p>}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-canvas-border">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!ok} onClick={save}>{risk ? 'Save changes' : 'Add to register'}</Button>
        </div>
      </motion.aside>
    </div>
  );
}
