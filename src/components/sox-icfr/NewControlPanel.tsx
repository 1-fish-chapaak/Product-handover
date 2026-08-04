import { useEffect, useMemo, useState } from 'react';
import { Check, Star, X } from 'lucide-react';
import { useIcfr } from './store';
import { FormSelect } from '../shared/FilterSelect';
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
const NEW_PROCESS = '__new-process__';
const NEW_OWNER = '__new-owner__';
const NEW_PROC_OWNER = '__new-process-owner__';
/** Process owner left unset — the store falls back to the process's recorded
 *  owner, and only then to the control owner. */
const SAME_OWNER = '__same-owner__';

const inputCls = 'w-full h-9 px-3 rounded-lg border border-canvas-border text-[12.5px] text-ink-800 bg-canvas-elevated focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-50';

function Field({ label, required = false, children, span2 = false }: { label: string; required?: boolean; children: React.ReactNode; span2?: boolean }) {
  return <div className={span2 ? 'col-span-2' : undefined}><div className="text-[11px] font-semibold text-ink-500 mb-1">{label}{required && <span className="text-risk-600 ml-0.5" aria-hidden="true">*</span>}</div>{children}</div>;
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
  const [controlActivity, setControlActivity] = useState('');
  const [process, setProcess] = useState(processes[0] ?? 'Procure to Pay');
  const [subProcess, setSubProcess] = useState('');
  const [riskChoice, setRiskChoice] = useState<string>(riskOptions[0]?.id ?? NEW_RISK);
  const [newRiskDesc, setNewRiskDesc] = useState('');
  const [nature, setNature] = useState<Nature>('Manual');
  const [frequency, setFrequency] = useState<Frequency>('Monthly');
  const [owner, setOwner] = useState(owners[0] ?? 'Risk Owner');
  const [processOwner, setProcessOwner] = useState(SAME_OWNER);
  const [newProcOwner, setNewProcOwner] = useState('');
  const [isKey, setIsKey] = useState(true);
  const [assertions, setAssertions] = useState<Assertion[]>(['Accuracy']);
  const [newProcess, setNewProcess] = useState('');
  const [newOwner, setNewOwner] = useState('');
  const [showDiscard, setShowDiscard] = useState(false);

  // Any field moved away from its opening state means unsaved work — leaving then guards.
  const isDirty =
    description.trim().length > 0 || controlActivity.trim().length > 0 || subProcess.trim().length > 0 ||
    newRiskDesc.trim().length > 0 || newProcess.trim().length > 0 || newOwner.trim().length > 0 ||
    process !== (processes[0] ?? 'Procure to Pay') || owner !== (owners[0] ?? 'Risk Owner') ||
    riskChoice !== (riskOptions[0]?.id ?? NEW_RISK) ||
    nature !== 'Manual' || frequency !== 'Monthly' || !isKey ||
    assertions.length !== 1 || assertions[0] !== 'Accuracy';

  const requestClose = () => { if (isDirty) setShowDiscard(true); else onClose(); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showDiscard) { setShowDiscard(false); return; } // a stray Esc dismisses the confirm, never the form
      if (isDirty) setShowDiscard(true); else onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, showDiscard, isDirty]);

  const toggleAssertion = (a: Assertion) =>
    setAssertions(prev => (prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]));

  const canCreate = description.trim().length > 0
    && (riskChoice !== NEW_RISK || newRiskDesc.trim().length > 0)
    && (process !== NEW_PROCESS || newProcess.trim().length > 0)
    && (owner !== NEW_OWNER || newOwner.trim().length > 0)
    && (processOwner !== NEW_PROC_OWNER || newProcOwner.trim().length > 0);

  // The single most-specific blocker, surfaced on the disabled button so it's never trial-and-error.
  const missingHint =
    !description.trim() ? 'Description required'
    : riskChoice === NEW_RISK && !newRiskDesc.trim() ? 'New-risk description required'
    : process === NEW_PROCESS && !newProcess.trim() ? 'New process name required'
    : owner === NEW_OWNER && !newOwner.trim() ? 'New control owner name required'
    : processOwner === NEW_PROC_OWNER && !newProcOwner.trim() ? 'New process owner name required'
    : null;

  const create = () => {
    if (!canCreate) return;
    const risk = riskChoice === NEW_RISK
      ? { riskId: nextRiskId, riskDescription: newRiskDesc.trim() }
      : { riskId: riskChoice, riskDescription: riskOptions.find(r => r.id === riskChoice)?.description ?? '' };
    const id = addControl({
      description: description.trim(),
      controlActivity: controlActivity.trim(),
      process: process === NEW_PROCESS ? newProcess.trim() : process, subProcess,
      nature, frequency, owner: owner === NEW_OWNER ? newOwner.trim() : owner,
      // undefined, not the control owner's name — the store then falls back to
      // whoever the scoping wizard recorded for this process, and only reaches
      // the control owner if that comes up empty too.
      processOwner: processOwner === SAME_OWNER ? undefined
        : processOwner === NEW_PROC_OWNER ? newProcOwner.trim() : processOwner,
      isKey, assertions, ...risk,
    });
    addToast({ type: 'success', title: 'Control created', message: `Linked to ${risk.riskId} — now in the library and the RACM.` });
    onClose();
    openControl(id);
  };

  return (
    <div className="modal-backdrop" onClick={requestClose}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div className="px-5 pt-4 pb-3 border-b border-canvas-border">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold text-ink-900" style={{ fontFamily: "'Source Serif 4', serif" }}>New control</h2>
            <button onClick={requestClose} className="h-7 w-7 inline-flex items-center justify-center rounded-md text-ink-400 hover:text-ink-700 cursor-pointer" aria-label="Close"><X size={15} /></button>
          </div>
          <p className="text-[12px] text-ink-500 mt-0.5">It lands in the library and the RACM immediately, ready to test.</p>
        </div>

        <div className="p-5 space-y-3.5">
          <Field label="Control description" required>
            <input value={description} onChange={e => setDescription(e.target.value)} autoFocus aria-required="true"
              placeholder="e.g. Vendor bank-detail changes are independently verified before payment"
              className={inputCls} />
          </Field>

          {/* Optional on purpose — a control is often raised from the one-line
              statement in a scoping session and written up afterwards. The
              header and the working paper both fall back gracefully when it's
              blank, so requiring it here would only block the quick raise. */}
          <Field label="Control activity">
            <textarea value={controlActivity} onChange={e => setControlActivity(e.target.value)} rows={3}
              placeholder="Who performs it, over which records, when, how it's evidenced, and where exceptions go"
              className={`${inputCls} resize-none leading-relaxed`} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Process">
              <FormSelect value={process} onChange={setProcess} className={inputCls} ariaLabel="Process"
                options={[...processes, { value: NEW_PROCESS, label: '＋ Add new process…' }]} />
            </Field>
            <Field label="Sub-process">
              <input value={subProcess} onChange={e => setSubProcess(e.target.value)} placeholder="e.g. Vendor master" className={inputCls} />
            </Field>
          </div>
          {process === NEW_PROCESS && (
            <Field label="New process name" required>
              <input value={newProcess} onChange={e => setNewProcess(e.target.value)} aria-required="true" placeholder="e.g. Record to Report" className={inputCls} />
            </Field>
          )}

          <Field label="Linked risk">
            <FormSelect value={riskChoice} onChange={setRiskChoice} className={inputCls} ariaLabel="Linked risk" menuCls="w-full"
              options={[...riskOptions.map(r => ({ value: r.id, label: `${r.id} — ${r.description.length > 56 ? `${r.description.slice(0, 55)}…` : r.description}` })), { value: NEW_RISK, label: `＋ New risk (${nextRiskId})` }]} />
          </Field>
          {riskChoice === NEW_RISK && (
            <Field label={`New risk description (${nextRiskId})`} required>
              <input value={newRiskDesc} onChange={e => setNewRiskDesc(e.target.value)} aria-required="true" placeholder="What could go wrong that this control prevents or detects?" className={inputCls} />
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Nature">
              <FormSelect value={nature} onChange={v => setNature(v as Nature)} className={inputCls} ariaLabel="Nature" options={NATURES} />
            </Field>
            <Field label="Frequency">
              <FormSelect value={frequency} onChange={v => setFrequency(v as Frequency)} className={inputCls} ariaLabel="Frequency" options={FREQUENCIES} />
            </Field>
            <Field label="Control owner">
              <FormSelect value={owner} onChange={setOwner} className={inputCls} ariaLabel="Control owner"
                options={[...owners, { value: NEW_OWNER, label: '＋ Add new owner…' }]} />
            </Field>
            {/* Who actually runs it — the name an evidence request goes to. Left
                on "same as control owner" when one person does both. */}
            <Field label="Process owner">
              <FormSelect value={processOwner} onChange={setProcessOwner} className={inputCls} ariaLabel="Process owner"
                options={[{ value: SAME_OWNER, label: 'Same as control owner' }, ...owners, { value: NEW_PROC_OWNER, label: '＋ Add new owner…' }]} />
            </Field>
            <Field label="Key control">
              <button onClick={() => setIsKey(k => !k)} type="button"
                className={cn('h-9 w-full px-3 inline-flex items-center gap-1.5 rounded-lg border text-[12.5px] font-semibold cursor-pointer transition-colors',
                  isKey ? 'border-mitigated-300 bg-mitigated-50 text-mitigated-700' : 'border-canvas-border text-ink-500 hover:text-ink-800')}>
                <Star size={13} className={isKey ? 'fill-mitigated-200' : undefined} /> {isKey ? 'Key control' : 'Not key'}
              </button>
            </Field>
          </div>
          {owner === NEW_OWNER && (
            <Field label="New control owner name" required>
              <input value={newOwner} onChange={e => setNewOwner(e.target.value)} aria-required="true" placeholder="e.g. D. Rao" className={inputCls} />
            </Field>
          )}
          {processOwner === NEW_PROC_OWNER && (
            <Field label="New process owner name" required>
              <input value={newProcOwner} onChange={e => setNewProcOwner(e.target.value)} aria-required="true" placeholder="e.g. S. Iyer" className={inputCls} />
            </Field>
          )}

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

          <div className="pt-1.5 flex items-center justify-between gap-3">
            <span className="text-[11.5px] text-ink-500 inline-flex items-center gap-1 min-w-0" role="status" aria-live="polite">
              {missingHint && (<><span className="text-risk-600" aria-hidden="true">*</span><span className="truncate">{missingHint}</span></>)}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={requestClose} className="h-9 px-3.5 rounded-lg border border-canvas-border text-[12.5px] font-semibold text-ink-600 hover:text-ink-900 cursor-pointer">Cancel</button>
              <button onClick={create} disabled={!canCreate} title={missingHint ?? undefined}
                className="h-9 px-4 rounded-lg bg-brand-600 text-white text-[12.5px] font-semibold hover:bg-brand-700 disabled:opacity-40 transition-colors cursor-pointer">
                Create control
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* discard guard — a dirty form never vanishes on a stray backdrop click or Esc */}
      {showDiscard && (
        <div className="modal-backdrop" onClick={e => { e.stopPropagation(); setShowDiscard(false); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="px-5 pt-4 pb-3 border-b border-canvas-border">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-[15px] font-semibold text-ink-900">Discard this new control?</h2>
                <button onClick={() => setShowDiscard(false)} className="h-7 w-7 inline-flex items-center justify-center rounded-md text-ink-400 hover:text-ink-700 cursor-pointer" aria-label="Keep editing"><X size={15} /></button>
              </div>
            </div>
            <div className="p-5">
              <p className="text-[12.5px] text-ink-600 leading-relaxed">You've started this control but haven't created it yet. Leave now and what you've entered won't be saved.</p>
              <div className="mt-4 flex items-center justify-end gap-2">
                <button onClick={() => setShowDiscard(false)} className="h-9 px-3.5 rounded-lg border border-canvas-border text-[12.5px] font-semibold text-ink-600 hover:text-ink-900 cursor-pointer">Keep editing</button>
                <button onClick={() => { setShowDiscard(false); onClose(); }} className="h-9 px-3.5 rounded-lg bg-brand-600 text-white text-[12.5px] font-semibold hover:bg-brand-700 transition-colors cursor-pointer">Discard</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
