import { useEffect, useMemo, useState } from 'react';
import { Check, Plus, Sparkles, Star, X } from 'lucide-react';
import { useIcfr } from './store';
import { FormSelect } from '../shared/FilterSelect';
import { useToast } from '../shared/Toast';
import { cn } from '../../lib/cn';
import { CONTROL_CLASSES, TESTING_STRATEGIES } from './types';
import type { Assertion, ControlClass, ControlType, Frequency, Nature, TestingStrategy } from './types';
import { peekEntityCode, peekProcessCode, riskIdOf } from './racmIds';
import { draftAttributes, draftControlDescription, draftRiskCategory, draftRiskDescription } from './racmImport';
import { draftDesignChecks } from './helpers';

/**
 * New control — one focused form. The control lands in the library and the RACM
 * immediately, linked to an existing risk or a newly minted one, ready to test
 * from its control page.
 *
 * Every RACM column is required before Create (22 Sep). Ira fills the ones she
 * can write from what's already there — the descriptions from their titles, the
 * design checks and attributes from the control description — straight into the
 * field, each with a Put back. Type and assertions are the user's call.
 */

const ASSERTIONS: Assertion[] = ['Completeness', 'Accuracy', 'Existence / Occurrence', 'Cut-off', 'Valuation', 'Rights & Obligations', 'Presentation'];
const NATURES: Nature[] = ['Manual', 'Automated', 'IT-dependent'];
const TYPES: ControlType[] = ['Preventive', 'Detective'];
const FREQUENCIES: Frequency[] = ['Annual', 'Quarterly', 'Monthly', 'Weekly', 'Daily', 'Recurring', 'Ad-hoc'];
const NEW_RISK = '__new-risk__';
const NEW_PROCESS = '__new-process__';
const NEW_OWNER = '__new-owner__';
const NEW_PROC_OWNER = '__new-process-owner__';
const NEW_RISK_OWNER = '__new-risk-owner__';
/** Process owner left unset — the store falls back to the process's recorded
 *  owner, and only then to the control owner. */
const SAME_OWNER = '__same-owner__';
/** Risk owner left unset — nothing is stored, and every read falls back to the
 *  process owner (`ownersOf().riskOwner`), so the two can't drift apart. */
const SAME_PROC_OWNER = '__same-process-owner__';

/** The fields Ira may fill. Her mark on each: `drafted` — her text, untouched;
 *  `edited` — her text, since changed; `spent` — she's had her go (put back, or
 *  cleared by hand) and won't write it again. */
type DraftField = 'controlActivity' | 'newRiskDesc' | 'designChecks' | 'attributes' | 'clazz';
type DraftMark = 'drafted' | 'edited' | 'spent';

const inputCls = 'w-full h-9 px-3 rounded-lg border border-canvas-border text-[12.5px] text-ink-800 bg-canvas-elevated focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-50';
/** inputCls without the fixed height, so a textarea's rows are what set it. */
const areaCls = 'w-full px-3 py-2 rounded-lg border border-canvas-border text-[0.78125rem] text-ink-800 bg-canvas-elevated leading-relaxed resize-none focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-50';

function Field({ label, required = false, children, span2 = false }: { label: string; required?: boolean; children: React.ReactNode; span2?: boolean }) {
  return <div className={span2 ? 'col-span-2' : undefined}><div className="text-[11px] font-semibold text-ink-500 mb-1">{label}{required && <span className="text-risk-600 ml-0.5" aria-hidden="true">*</span>}</div>{children}</div>;
}

/** Under a field Ira filled: where the text came from, and the way back to blank. */
function IraNote({ from, edited, what, onPutBack }: { from: string; edited: boolean; what: string; onPutBack: () => void }) {
  return (
    <p className="mt-1 flex items-center gap-1 text-[0.6875rem] leading-snug text-ink-500">
      <Sparkles size={11} className="text-brand-600 shrink-0" aria-hidden />
      <span>Drafted by Ira from the {from}{edited && ' · Edited'}</span>
      <span aria-hidden="true">·</span>
      <button type="button" onClick={onPutBack} aria-label={`Put back — clear Ira's ${what}`}
        className="font-semibold text-brand-700 hover:text-brand-800 hover:underline cursor-pointer">Put back</button>
    </p>
  );
}

/** One item per row — each editable and removable — with an add at the foot. A
 *  row mounts empty only when it was just added, so that's the one that takes focus. */
function ListEditor({ items, onChange, noun, placeholder }: { items: string[]; onChange: (next: string[]) => void; noun: string; placeholder: string }) {
  return (
    <div className="space-y-1.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-1.5">
          <textarea value={item} onChange={e => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
            rows={Math.max(1, Math.ceil(item.length / 68))} autoFocus={!item} placeholder={placeholder}
            aria-label={`${noun.charAt(0).toUpperCase()}${noun.slice(1)} ${i + 1}`}
            className={cn(areaCls, 'min-h-9 field-sizing-content')} />
          <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label={`Remove ${noun} ${i + 1}`}
            className="h-9 w-7 shrink-0 inline-flex items-center justify-center rounded-md text-ink-400 hover:text-ink-700 cursor-pointer"><X size={13} /></button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, ''])}
        className="h-7 inline-flex items-center gap-1 rounded-md text-[0.75rem] font-semibold text-brand-700 hover:text-brand-800 cursor-pointer">
        <Plus size={12} /> Add {noun}
      </button>
    </div>
  );
}

export default function NewControlPanel({ onClose }: { onClose: () => void }) {
  const { eng, addControl, openControl } = useIcfr();
  const { addToast } = useToast();

  const processes = useMemo(() => Array.from(new Set(eng.controls.map(c => c.process))), [eng.controls]);
  const owners = useMemo(() => Array.from(new Set(eng.controls.map(c => c.owner))), [eng.controls]);
  const riskOptions = useMemo(() => {
    const seen = new Map<string, string>();
    eng.controls.forEach(c => { if (!seen.has(c.riskId)) seen.set(c.riskId, c.riskTitle ?? c.riskDescription); });
    return Array.from(seen, ([id, description]) => ({ id, description }));
  }, [eng.controls]);

  const [description, setDescription] = useState('');
  const [controlActivity, setControlActivity] = useState('');
  const [newRiskTitle, setNewRiskTitle] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [testingStrategy, setTestingStrategy] = useState<TestingStrategy>('Sampling');
  const [process, setProcess] = useState(processes[0] ?? 'Procure to Pay');
  const [subProcess, setSubProcess] = useState('');
  const [riskChoice, setRiskChoice] = useState<string>(riskOptions[0]?.id ?? NEW_RISK);
  const [newRiskDesc, setNewRiskDesc] = useState('');
  // Nature, frequency and assertions start empty too (22 Sep) — required, and
  // nothing on the list is filled silently.
  const [nature, setNature] = useState<Nature | null>(null);
  // No default — whether it stops the error or finds it afterwards is the user's call.
  const [type, setType] = useState<ControlType | null>(null);
  const [frequency, setFrequency] = useState<Frequency | null>(null);
  const [owner, setOwner] = useState(owners[0] ?? 'Risk Owner');
  const [processOwner, setProcessOwner] = useState(SAME_OWNER);
  const [newProcOwner, setNewProcOwner] = useState('');
  const [riskOwner, setRiskOwner] = useState(SAME_PROC_OWNER);
  const [newRiskOwner, setNewRiskOwner] = useState('');
  // One of the six (22 Sep). Starts empty like nature and frequency; Ira reads
  // it off the risk's own words once there is a risk to read.
  const [clazz, setClazz] = useState<ControlClass | null>(null);
  const [isKey, setIsKey] = useState(true);
  const [assertions, setAssertions] = useState<Assertion[]>([]);
  const [designChecks, setDesignChecks] = useState<string[]>([]);
  const [attributes, setAttributes] = useState<string[]>([]);
  const [iraDraft, setIraDraft] = useState<Partial<Record<DraftField, DraftMark>>>({});
  const [newProcess, setNewProcess] = useState('');
  // The ID a new risk will get — ENTITY/PROCESS/R00n (S11), the same rule the
  // store numbers it by: next R for the process at its controls' company.
  const nextRiskId = useMemo(() => {
    const proc = process === NEW_PROCESS ? newProcess.trim() || 'New process' : process;
    const entity = eng.controls.find(c => c.process === proc)?.entity ?? eng.entity;
    const pc = peekProcessCode(proc); const ec = peekEntityCode(entity);
    const prefix = `${ec}/${pc}/R`;
    const nums = eng.controls.filter(c => c.riskId.startsWith(prefix)).map(c => parseInt(c.riskId.slice(prefix.length), 10)).filter(n => !Number.isNaN(n));
    return riskIdOf(ec, pc, (nums.length ? Math.max(...nums) : 0) + 1);
  }, [eng.controls, eng.entity, process, newProcess]);
  const [newOwner, setNewOwner] = useState('');
  const [showDiscard, setShowDiscard] = useState(false);

  // Any field moved away from its opening state means unsaved work — leaving then guards.
  const isDirty =
    description.trim().length > 0 || controlActivity.trim().length > 0 || subProcess.trim().length > 0 ||
    newRiskTitle.trim().length > 0 || newRiskDesc.trim().length > 0 || newProcess.trim().length > 0 || newOwner.trim().length > 0 ||
    process !== (processes[0] ?? 'Procure to Pay') || owner !== (owners[0] ?? 'Risk Owner') ||
    riskChoice !== (riskOptions[0]?.id ?? NEW_RISK) ||
    nature !== null || type !== null || frequency !== null || clazz !== null || !isKey ||
    processOwner !== SAME_OWNER || riskOwner !== SAME_PROC_OWNER ||
    designChecks.length > 0 || attributes.length > 0 ||
    assertions.length > 0;

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

  // ── Ira's drafts ──────────────────────────────────────────────────────────────
  // She writes into a field only while it's empty and only once: after Put back
  // (or a hand-cleared field) the mark reads `spent` and she leaves it alone.
  const mayDraft = (f: DraftField, empty: boolean) => empty && !iraDraft[f];
  const markDrafted = (fields: DraftField[]) => {
    if (!fields.length) return;
    setIraDraft(d => { const next = { ...d }; fields.forEach(f => { next[f] = 'drafted'; }); return next; });
  };
  /** A change by hand to a field Ira filled — still hers if text remains, spent if not. */
  const touched = (f: DraftField, hasText: boolean) =>
    setIraDraft(d => (d[f] === 'drafted' || d[f] === 'edited' ? { ...d, [f]: hasText ? 'edited' : 'spent' } : d));
  const putBack = (f: DraftField) => {
    if (f === 'controlActivity') setControlActivity('');
    if (f === 'newRiskDesc') setNewRiskDesc('');
    if (f === 'designChecks') setDesignChecks([]);
    if (f === 'attributes') setAttributes([]);
    if (f === 'clazz') setClazz(null);
    setIraDraft(d => ({ ...d, [f]: 'spent' }));
  };
  const ownerName = owner === NEW_OWNER ? newOwner.trim() : owner;

  /** The risk's wording, whichever way the risk got here — typed for a new one,
   *  or carried by the control already on an existing one. */
  const riskWords = (title = newRiskTitle, desc = newRiskDesc) =>
    riskChoice === NEW_RISK
      ? [title, desc].filter(t => t.trim()).join(' ')
      : (() => { const r = eng.controls.find(c => c.riskId === riskChoice); return [r?.riskTitle, r?.riskDescription].filter(Boolean).join(' '); })();

  /** Ira's risk category — the risk's own words first, the control's only as a
   *  fallback. Returns what she filled so the caller can mark it.
   *
   *  She re-reads a category that is still her own untouched draft, because the
   *  risk it was read from can change under it: the control title is autofocused,
   *  so reaching for the risk picker blurs it and she reads the category off
   *  whichever risk was linked at the time. Anything the auditor has picked or
   *  edited by hand, or put back, she leaves alone. */
  const draftCategory = (riskText: string, controlText: string): DraftField[] => {
    const hers = iraDraft.clazz === 'drafted';
    if (!hers && !mayDraft('clazz', clazz === null)) return [];
    if (!riskText.trim() && !controlText.trim()) return [];
    setClazz(draftRiskCategory(riskText, controlText).category);
    return ['clazz'];
  };

  /** Design checks and attributes, both read off the control description (and
   *  title). Only fills a list that's still empty; returns what it filled. */
  const draftLists = (title: string, desc: string, t: ControlType | null = type): DraftField[] => {
    if (!desc.trim()) return [];
    const filled: DraftField[] = [];
    if (mayDraft('designChecks', !designChecks.some(x => x.trim()))) {
      const checks = draftDesignChecks({ title, description: desc, type: t, nature, frequency, assertions });
      if (checks.length) { setDesignChecks(checks); filled.push('designChecks'); }
    }
    if (mayDraft('attributes', !attributes.some(x => x.trim()))) {
      const attrs = draftAttributes([title.trim(), desc.trim()].filter(Boolean).join('. '), t);
      if (attrs.length) { setAttributes(attrs); filled.push('attributes'); }
    }
    return filled;
  };

  // Control title loses focus: a blank description gets Ira's, and the lists follow from it.
  const onTitleBlur = () => {
    const filled: DraftField[] = [];
    let desc = controlActivity;
    if (mayDraft('controlActivity', !controlActivity.trim())) {
      const text = draftControlDescription(description, { owner: ownerName || undefined, frequency });
      if (text) { desc = text; setControlActivity(text); filled.push('controlActivity'); }
    }
    markDrafted([...filled, ...draftLists(description, desc), ...draftCategory(riskWords(), [description, desc].filter(Boolean).join('. '))]);
  };
  const onRiskTitleBlur = () => {
    const filled: DraftField[] = [];
    let desc = newRiskDesc;
    if (mayDraft('newRiskDesc', !newRiskDesc.trim())) {
      const text = draftRiskDescription(newRiskTitle);
      if (text) { desc = text; setNewRiskDesc(text); filled.push('newRiskDesc'); }
    }
    markDrafted([...filled, ...draftCategory(riskWords(newRiskTitle, desc), [description, controlActivity].filter(Boolean).join('. '))]);
  };
  /** Picking a risk that already exists brings its wording with it, so Ira can
   *  read the category off it there and then. */
  const pickRisk = (id: string) => {
    setRiskChoice(id);
    if (id === NEW_RISK) return;
    const r = eng.controls.find(c => c.riskId === id);
    const words = [r?.riskTitle, r?.riskDescription].filter(Boolean).join(' ');
    markDrafted(draftCategory(words, [description, controlActivity].filter(Boolean).join('. ')));
  };
  // A type picked after the description can still give Ira the attributes she
  // couldn't read off the wording — the usual ones for that type.
  const pickType = (t: ControlType) => { setType(t); markDrafted(draftLists(description, controlActivity, t)); };

  // The single most-specific blocker, in form order, surfaced on the disabled
  // button so it's never trial-and-error. null once every required field is in.
  const missingHint =
    !description.trim() ? 'Control title required'
    : !controlActivity.trim() ? 'Control description required'
    : process === NEW_PROCESS && !newProcess.trim() ? 'New process name required'
    : riskChoice === NEW_RISK && !newRiskTitle.trim() ? 'New risk title required'
    : riskChoice === NEW_RISK && !newRiskDesc.trim() ? 'New risk description required'
    : !clazz ? 'Risk category required'
    : !nature ? 'Control nature required'
    : !type ? 'Control type required'
    : !frequency ? 'Frequency required'
    : owner === NEW_OWNER && !newOwner.trim() ? 'New control owner name required'
    : processOwner === NEW_PROC_OWNER && !newProcOwner.trim() ? 'New process owner name required'
    : riskOwner === NEW_RISK_OWNER && !newRiskOwner.trim() ? 'New risk owner name required'
    : !designChecks.some(x => x.trim()) ? 'At least one design check required'
    : !attributes.some(x => x.trim()) ? 'At least one attribute required'
    : assertions.length === 0 ? 'At least one assertion required'
    : null;
  const canCreate = missingHint === null;

  const create = () => {
    if (!canCreate || !type || !nature || !frequency) return;
    const existing = eng.controls.find(c => c.riskId === riskChoice);
    const risk = riskChoice === NEW_RISK
      ? { riskId: nextRiskId, riskTitle: newRiskTitle.trim(), riskDescription: newRiskDesc.trim() }
      // An existing risk keeps the name and sentence it already had; picking it
      // again is not an occasion to restate either.
      : { riskId: riskChoice, riskDescription: existing?.riskDescription ?? '', ...(existing?.riskTitle ? { riskTitle: existing.riskTitle } : {}) };
    const id = addControl({
      description: description.trim(),
      controlActivity: controlActivity.trim(),
      process: process === NEW_PROCESS ? newProcess.trim() : process, subProcess,
      type, nature, frequency, owner: ownerName,
      // undefined, not the control owner's name — the store then falls back to
      // whoever the scoping wizard recorded for this process, and only reaches
      // the control owner if that comes up empty too.
      processOwner: processOwner === SAME_OWNER ? undefined
        : processOwner === NEW_PROC_OWNER ? newProcOwner.trim() : processOwner,
      // Same story one step on: "same as process owner" stores nothing.
      riskOwner: riskOwner === SAME_PROC_OWNER ? undefined
        : riskOwner === NEW_RISK_OWNER ? newRiskOwner.trim() : riskOwner,
      isKey, assertions, testingStrategy, designChecks, attributes,
      ...(clazz ? { clazz } : {}),
      ...(effectiveDate.trim() ? { effectiveDate: effectiveDate.trim() } : {}),
      ...risk,
    });
    addToast({ type: 'success', title: 'Control created', message: `Linked to ${risk.riskId} — now in the library and the RACM.` });
    onClose();
    openControl(id);
  };

  const noteFor = (f: DraftField, from: string, what: string) =>
    (iraDraft[f] === 'drafted' || iraDraft[f] === 'edited') && (
      <IraNote from={from} what={what} edited={iraDraft[f] === 'edited'} onPutBack={() => putBack(f)} />
    );

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
          <Field label="Control title" required>
            <input value={description} onChange={e => setDescription(e.target.value)} onBlur={onTitleBlur} autoFocus aria-required="true"
              placeholder="e.g. Vendor bank-detail changes are independently verified before payment"
              className={inputCls} />
          </Field>

          {/* Required since 22 Sep, with the rest of the RACM row. Left blank,
              Ira writes it from the title as the title loses focus — using the
              owner and frequency picked below — and Put back returns it to blank. */}
          <Field label="Control description" required>
            <textarea value={controlActivity} rows={3} aria-required="true"
              onChange={e => { setControlActivity(e.target.value); touched('controlActivity', !!e.target.value.trim()); }}
              onBlur={() => markDrafted(draftLists(description, controlActivity))}
              placeholder="Who performs it, over which records, when, how it's evidenced, and where exceptions go"
              className={areaCls} />
            {noteFor('controlActivity', 'title', 'control description')}
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
            <FormSelect value={riskChoice} onChange={pickRisk} className={inputCls} ariaLabel="Linked risk" menuCls="w-full"
              options={[...riskOptions.map(r => ({ value: r.id, label: `${r.id} — ${r.description.length > 56 ? `${r.description.slice(0, 55)}…` : r.description}` })), { value: NEW_RISK, label: `＋ New risk (${nextRiskId})` }]} />
          </Field>
          {riskChoice === NEW_RISK && (
            <>
              <Field label={`New risk title (${nextRiskId})`} required>
                <input value={newRiskTitle} onChange={e => setNewRiskTitle(e.target.value)} onBlur={onRiskTitleBlur} aria-required="true" placeholder="e.g. Unauthorised vendor payments" className={inputCls} />
              </Field>
              <Field label="New risk description" required>
                <textarea value={newRiskDesc} rows={2} aria-required="true"
                  onChange={e => { setNewRiskDesc(e.target.value); touched('newRiskDesc', !!e.target.value.trim()); }}
                  placeholder="What could go wrong that this control prevents or detects?" className={areaCls} />
                {noteFor('newRiskDesc', 'title', 'risk description')}
              </Field>
            </>
          )}

          {/* Belongs to the risk, not the control, so it sits with the risk.
              Required since 22 Sep; Ira reads it off the risk's own words as
              soon as there are any, and Put back returns it to unpicked. */}
          <Field label="Risk category" required>
            <FormSelect value={clazz ?? ''} onChange={v => { setClazz(v as ControlClass); touched('clazz', true); }}
              className={inputCls} ariaLabel="Risk category" options={CONTROL_CLASSES} placeholder="Pick a risk category" />
            {noteFor('clazz', 'risk', 'risk category')}
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Nature" required>
              <FormSelect value={nature ?? ''} onChange={v => setNature(v as Nature)} className={inputCls} ariaLabel="Nature" options={NATURES} placeholder="Pick a nature" />
            </Field>
            <Field label="Type" required>
              <div role="radiogroup" aria-label="Control type" aria-required="true" className="grid grid-cols-2 gap-1.5">
                {TYPES.map(t => (
                  <button key={t} type="button" role="radio" aria-checked={type === t} onClick={() => pickType(t)}
                    className={cn('h-9 px-2 inline-flex items-center justify-center gap-1 rounded-lg border text-[0.78125rem] font-semibold cursor-pointer transition-colors',
                      type === t ? 'border-brand-200 bg-brand-50 text-brand-700' : 'border-canvas-border text-ink-500 hover:text-ink-800')}>
                    {type === t && <Check size={12} />}{t}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Frequency" required>
              <FormSelect value={frequency ?? ''} onChange={v => setFrequency(v as Frequency)} className={inputCls} ariaLabel="Frequency" options={FREQUENCIES} placeholder="Pick a frequency" />
            </Field>
            <Field label="Control owner" required>
              <FormSelect value={owner} onChange={setOwner} className={inputCls} ariaLabel="Control owner"
                options={[...owners, { value: NEW_OWNER, label: '＋ Add new owner…' }]} />
            </Field>
            {/* Who actually runs it — the name an evidence request goes to. Left
                on "same as control owner" when one person does both. */}
            <Field label="Process owner">
              <FormSelect value={processOwner} onChange={setProcessOwner} className={inputCls} ariaLabel="Process owner"
                options={[{ value: SAME_OWNER, label: 'Same as control owner' }, ...owners, { value: NEW_PROC_OWNER, label: '＋ Add new owner…' }]} />
            </Field>
            {/* Accountable for the risk the control answers — a record on the
                matrix, not a lane that gets tasks. Left on "same as process
                owner" unless someone else owns the risk. */}
            <Field label="Risk owner" required>
              <FormSelect value={riskOwner} onChange={setRiskOwner} className={inputCls} ariaLabel="Risk owner"
                options={[{ value: SAME_PROC_OWNER, label: 'Same as process owner' }, ...owners, { value: NEW_RISK_OWNER, label: '＋ Add new owner…' }]} />
            </Field>
            <Field label="Key control">
              <button onClick={() => setIsKey(k => !k)} type="button"
                className={cn('h-9 w-full px-3 inline-flex items-center gap-1.5 rounded-lg border text-[12.5px] font-semibold cursor-pointer transition-colors',
                  isKey ? 'border-mitigated-300 bg-mitigated-50 text-mitigated-700' : 'border-canvas-border text-ink-500 hover:text-ink-800')}>
                <Star size={13} className={isKey ? 'fill-mitigated-200' : undefined} /> {isKey ? 'Key control' : 'Not key'}
              </button>
            </Field>
            {/* How much of the population the control is tested over. Left on
                Sampling because that is what all but the annual controls get;
                the sample step is what reads it. */}
            <Field label="Testing strategy">
              <FormSelect value={testingStrategy} onChange={v => setTestingStrategy(v as TestingStrategy)} className={inputCls} ariaLabel="Testing strategy" options={TESTING_STRATEGIES} />
            </Field>
            {/* Optional, and blank on most rows: a control in place before the
                period began has no date worth recording. It earns its place when
                the control started mid-year, because the sample then cannot be
                drawn from months it did not exist. */}
            <Field label="Effective date">
              <input value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} placeholder="e.g. 1 Apr 2026" className={inputCls} />
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
          {riskOwner === NEW_RISK_OWNER && (
            <Field label="New risk owner name" required>
              <input value={newRiskOwner} onChange={e => setNewRiskOwner(e.target.value)} aria-required="true" placeholder="e.g. M. Nair" className={inputCls} />
            </Field>
          )}

          {/* What the TOD walks, and what the TOE tests — both read off the
              control description, so Ira fills them once there is one. */}
          <Field label="Design checks" required>
            {designChecks.length === 0 && !iraDraft.designChecks && <p className="text-[0.71875rem] text-ink-400 mb-1">Ira drafts these from the control description — or add your own.</p>}
            <ListEditor items={designChecks} noun="design check" placeholder="e.g. The approver is independent of the preparer"
              onChange={next => { setDesignChecks(next); touched('designChecks', next.some(x => x.trim())); }} />
            {noteFor('designChecks', 'description', 'design checks')}
          </Field>
          <Field label="Attributes" required>
            {attributes.length === 0 && !iraDraft.attributes && <p className="text-[0.71875rem] text-ink-400 mb-1">Ira drafts these from the control description — or add your own.</p>}
            <ListEditor items={attributes} noun="attribute" placeholder="e.g. Approval is evidenced before payment"
              onChange={next => { setAttributes(next); touched('attributes', next.some(x => x.trim())); }} />
            {noteFor('attributes', 'description', 'attributes')}
          </Field>

          <Field label="Assertions" required>
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
