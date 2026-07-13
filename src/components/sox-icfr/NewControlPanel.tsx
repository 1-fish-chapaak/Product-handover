import { useEffect, useMemo, useState } from 'react';
import { Check, Star, X } from 'lucide-react';
import { useIcfr } from './store';
import { useToast } from '../shared/Toast';
import { cn } from '../../lib/cn';
import type { Assertion, Frequency, Nature } from './types';

/**
 * New control — one focused form. The control lands in the library and the RACM
 * immediately, linked to an existing risk or a newly minted one, ready to test
 * from its control page.
 */

const ASSERTIONS: Assertion[] = ['Completeness', 'Accuracy', 'Existence / Occurrence', 'Cut-off', 'Valuation', 'Rights & Obligations', 'Presentation'];
const NATURES: Nature[] = ['Manual', 'Automated', 'IT-dependent'];
const FREQUENCIES: Frequency[] = ['Annual', 'Quarterly', 'Monthly', 'Weekly', 'Daily', 'Recurring', 'Ad-hoc'];
const NEW_RISK = '__new-risk__';

const inputCls = 'w-full h-9 px-3 rounded-lg border border-canvas-border text-[12.5px] text-ink-800 bg-canvas-elevated focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-50';

function Field({ label, children, span2 = false }: { label: string; children: React.ReactNode; span2?: boolean }) {
  return <div className={span2 ? 'col-span-2' : undefined}><div className="text-[11px] font-semibold text-ink-500 mb-1">{label}</div>{children}</div>;
}

export default function NewControlPanel({ onClose }: { onClose: () => void }) {
  const { eng, addControl, openControl } = useIcfr();
  const { addToast } = useToast();

  const processes = useMemo(() => Array.from(new Set(eng.controls.map(c => c.process))), [eng.controls]);
  const owners = useMemo(() => Array.from(new Set(eng.controls.map(c => c.owner))), [eng.controls]);
  const riskOptions = useMemo(() => {
    const seen = new Map<string, string>();
    eng.controls.forEach(c => { if (!seen.has(c.riskId)) seen.set(c.riskId, c.riskDescription); });
    return Array.from(seen, ([id, description]) => ({ id, description }));
  }, [eng.controls]);
  const nextRiskId = useMemo(() => {
    const nums = eng.controls.map(c => parseInt(c.riskId.replace(/^R-/, ''), 10)).filter(n => !Number.isNaN(n));
    return `R-${(nums.length ? Math.max(...nums) : 0) + 1}`;
  }, [eng.controls]);

  const [description, setDescription] = useState('');
  const [process, setProcess] = useState(processes[0] ?? 'Procure to Pay');
  const [subProcess, setSubProcess] = useState('');
  const [riskChoice, setRiskChoice] = useState<string>(riskOptions[0]?.id ?? NEW_RISK);
  const [newRiskDesc, setNewRiskDesc] = useState('');
  const [nature, setNature] = useState<Nature>('Manual');
  const [frequency, setFrequency] = useState<Frequency>('Monthly');
  const [owner, setOwner] = useState(owners[0] ?? 'Risk Owner');
  const [isKey, setIsKey] = useState(true);
  const [assertions, setAssertions] = useState<Assertion[]>(['Accuracy']);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const toggleAssertion = (a: Assertion) =>
    setAssertions(prev => (prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]));

  const canCreate = description.trim().length > 0 && (riskChoice !== NEW_RISK || newRiskDesc.trim().length > 0);

  const create = () => {
    if (!canCreate) return;
    const risk = riskChoice === NEW_RISK
      ? { riskId: nextRiskId, riskDescription: newRiskDesc.trim() }
      : { riskId: riskChoice, riskDescription: riskOptions.find(r => r.id === riskChoice)?.description ?? '' };
    const id = addControl({
      description: description.trim(), process, subProcess,
      nature, frequency, owner, isKey, assertions, ...risk,
    });
    addToast({ type: 'success', title: 'Control created', message: `Linked to ${risk.riskId} — now in the library and the RACM.` });
    onClose();
    openControl(id);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div className="px-5 pt-4 pb-3 border-b border-canvas-border">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold text-ink-900" style={{ fontFamily: "'Source Serif 4', serif" }}>New control</h2>
            <button onClick={onClose} className="h-7 w-7 inline-flex items-center justify-center rounded-md text-ink-400 hover:text-ink-700 cursor-pointer" aria-label="Close"><X size={15} /></button>
          </div>
          <p className="text-[12px] text-ink-500 mt-0.5">It lands in the library and the RACM immediately, ready to test.</p>
        </div>

        <div className="p-5 space-y-3.5">
          <Field label="Control description">
            <input value={description} onChange={e => setDescription(e.target.value)} autoFocus
              placeholder="e.g. Vendor bank-detail changes are independently verified before payment"
              className={inputCls} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Process">
              <select value={process} onChange={e => setProcess(e.target.value)} className={cn(inputCls, 'cursor-pointer')}>
                {processes.map(p => <option key={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Sub-process">
              <input value={subProcess} onChange={e => setSubProcess(e.target.value)} placeholder="e.g. Vendor master" className={inputCls} />
            </Field>
          </div>

          <Field label="Linked risk">
            <select value={riskChoice} onChange={e => setRiskChoice(e.target.value)} className={cn(inputCls, 'cursor-pointer')}>
              {riskOptions.map(r => <option key={r.id} value={r.id}>{r.id} — {r.description.length > 56 ? `${r.description.slice(0, 55)}…` : r.description}</option>)}
              <option value={NEW_RISK}>＋ New risk ({nextRiskId})</option>
            </select>
          </Field>
          {riskChoice === NEW_RISK && (
            <Field label={`New risk description (${nextRiskId})`}>
              <input value={newRiskDesc} onChange={e => setNewRiskDesc(e.target.value)} placeholder="What could go wrong that this control prevents or detects?" className={inputCls} />
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Nature">
              <select value={nature} onChange={e => setNature(e.target.value as Nature)} className={cn(inputCls, 'cursor-pointer')}>
                {NATURES.map(n => <option key={n}>{n}</option>)}
              </select>
            </Field>
            <Field label="Frequency">
              <select value={frequency} onChange={e => setFrequency(e.target.value as Frequency)} className={cn(inputCls, 'cursor-pointer')}>
                {FREQUENCIES.map(f => <option key={f}>{f}</option>)}
              </select>
            </Field>
            <Field label="Owner">
              <select value={owner} onChange={e => setOwner(e.target.value)} className={cn(inputCls, 'cursor-pointer')}>
                {owners.map(o => <option key={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Key control">
              <button onClick={() => setIsKey(k => !k)} type="button"
                className={cn('h-9 w-full px-3 inline-flex items-center gap-1.5 rounded-lg border text-[12.5px] font-semibold cursor-pointer transition-colors',
                  isKey ? 'border-mitigated-300 bg-mitigated-50 text-mitigated-700' : 'border-canvas-border text-ink-500 hover:text-ink-800')}>
                <Star size={13} className={isKey ? 'fill-mitigated-200' : undefined} /> {isKey ? 'Key control' : 'Not key'}
              </button>
            </Field>
          </div>

          <Field label="Assertions">
            <div className="flex items-center gap-1.5 flex-wrap">
              {ASSERTIONS.map(a => (
                <button key={a} type="button" onClick={() => toggleAssertion(a)}
                  className={cn('h-7 px-2.5 inline-flex items-center gap-1 rounded-full border text-[11.5px] font-semibold cursor-pointer transition-colors',
                    assertions.includes(a) ? 'border-brand-200 bg-brand-50 text-brand-700' : 'border-canvas-border text-ink-500 hover:text-ink-800')}>
                  {assertions.includes(a) && <Check size={11} />}{a}
                </button>
              ))}
            </div>
          </Field>

          <div className="pt-1.5 flex items-center justify-end gap-2">
            <button onClick={onClose} className="h-9 px-3.5 rounded-lg border border-canvas-border text-[12.5px] font-semibold text-ink-600 hover:text-ink-900 cursor-pointer">Cancel</button>
            <button onClick={create} disabled={!canCreate}
              className="h-9 px-4 rounded-lg bg-brand-600 text-white text-[12.5px] font-semibold hover:bg-brand-700 disabled:opacity-40 transition-colors cursor-pointer">
              Create control
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
