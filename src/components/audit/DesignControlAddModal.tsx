// ─── DesignControlAddModal ───────────────────────────────────────────────────
// The Process Hub "Create Control" modal: description, sub-process, Key?,
// attribute list, and "Also add to RACM".
//
// Single source of truth for the create-control form — shared by the Controls
// tab (ControlDesignTab) and the Risk tab's Link Control → Create Control flow,
// so both surfaces show the identical modal.
import { useState } from 'react';
import { motion } from 'motion/react';
import { Shield, X, Plus } from 'lucide-react';
import { Button as BaseButton } from '../shared/Button';
import Toggle from '../shared/Toggle';

// Process Hub button standard (mirrors BusinessProcesses): 8px radius; primary
// CTAs render flat + semibold and lock to a compact h-8.
const Button = (props: React.ComponentProps<typeof BaseButton>) => {
  const isPrimary = (props.variant ?? 'primary') === 'primary';
  return (
    <BaseButton
      {...props}
      className={['rounded-lg!', isPrimary ? 'shadow-none! hover:shadow-none! font-semibold! h-8!' : '', props.className].filter(Boolean).join(' ')}
    />
  );
};

export interface DesignControlAddInput {
  description: string;
  isKey: boolean;
  subProcess: string;
  attributes: string[];
  inRacm: boolean;
}

export default function DesignControlAddModal({ subProcesses, onClose, onCreate }: {
  subProcesses: string[];
  onClose: () => void;
  onCreate: (input: DesignControlAddInput) => void;
}) {
  const [description, setDescription] = useState('');
  const [subProcess, setSubProcess] = useState(subProcesses[0] ?? 'New controls');
  const [isKey, setIsKey] = useState(true);
  const [inRacm, setInRacm] = useState(true);
  const [attrs, setAttrs] = useState<string[]>(['']);

  const setAttr = (i: number, v: string) => setAttrs(prev => prev.map((a, idx) => (idx === i ? v : a)));
  const addAttrRow = () => setAttrs(prev => [...prev, '']);
  const removeAttrRow = (i: number) => setAttrs(prev => prev.filter((_, idx) => idx !== i));
  const valid = description.trim().length > 0;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
        className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] z-40" onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[600px] bg-canvas-elevated rounded-xl border border-canvas-border shadow-xl z-50 flex flex-col max-h-[85vh]"
        role="dialog" aria-label="Add control"
      >
        <header className="shrink-0 px-6 pt-5 pb-4 border-b border-canvas-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-brand-600" />
            <h2 className="text-[1rem] font-bold text-ink-900">Create Control</h2>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-lg text-ink-500 hover:text-ink-800 hover:bg-surface-2 transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60" aria-label="Close"><X size={16} /></button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div>
            <label className="text-[0.6875rem] font-bold text-ink-500 uppercase tracking-wider mb-1.5 block">Control description</label>
            <textarea
              autoFocus value={description} onChange={e => setDescription(e.target.value)} rows={2}
              placeholder="e.g. Bank account changes require independent verification before payment."
              className="w-full px-3 py-2 border border-canvas-border rounded-lg text-[0.8125rem] text-ink-800 bg-white outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/15 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[0.6875rem] font-bold text-ink-500 uppercase tracking-wider mb-1.5 block">Sub-process</label>
              <input
                value={subProcess} onChange={e => setSubProcess(e.target.value)} list="design-control-subprocesses"
                className="w-full px-3 py-2 border border-canvas-border rounded-lg text-[0.8125rem] text-ink-800 bg-white outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/15"
              />
              <datalist id="design-control-subprocesses">{subProcesses.map(s => <option key={s} value={s} />)}</datalist>
            </div>
            <div className="flex items-end pb-1.5">
              <div className="flex items-center gap-2.5">
                <Toggle checked={isKey} onChange={setIsKey} ariaLabel="Key control" />
                <span onClick={() => setIsKey(!isKey)} className="text-[0.78125rem] text-ink-700 font-medium cursor-pointer select-none">
                  Key control
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="text-[0.6875rem] font-bold text-ink-500 uppercase tracking-wider mb-1.5 block">Attributes</label>
            <div className="space-y-2">
              {attrs.map((a, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-ink-300 shrink-0" />
                  <input
                    value={a} onChange={e => setAttr(i, e.target.value)}
                    placeholder={`Attribute ${i + 1}`}
                    className="flex-1 px-3 py-1.5 border border-canvas-border rounded-lg text-[0.78125rem] text-ink-800 bg-white outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/15"
                  />
                  {attrs.length > 1 && (
                    <button onClick={() => removeAttrRow(i)} className="w-7 h-7 inline-flex items-center justify-center rounded-md text-ink-400 hover:text-risk-700 hover:bg-risk-50 cursor-pointer" aria-label="Remove attribute"><X size={13} /></button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={addAttrRow} className="mt-2 inline-flex items-center gap-1 text-[0.75rem] font-semibold text-brand-700 hover:text-brand-600 cursor-pointer">
              <Plus size={12} /> Add attribute
            </button>
          </div>
        </div>

        <footer className="shrink-0 px-6 py-4 border-t border-canvas-border flex items-center justify-between gap-3">
          <label className="inline-flex items-center gap-2 cursor-pointer text-[0.78125rem] text-ink-700 font-medium">
            <input type="checkbox" checked={inRacm} onChange={e => setInRacm(e.target.checked)} className="accent-brand-600 w-4 h-4" />
            Also add to RACM
          </label>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="md" onClick={onClose}>Cancel</Button>
            <Button variant="primary" size="md" onClick={() => onCreate({ description, isKey, subProcess, attributes: attrs, inRacm })} disabled={!valid}>
              Create control
            </Button>
          </div>
        </footer>
      </motion.div>
    </>
  );
}
