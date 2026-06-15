import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft, CheckCircle2, XCircle, Lock, Bot, FlaskConical, ClipboardCheck,
  Database, Shuffle, ShieldCheck, FileWarning, User, Clock, ArrowRight, Download, ShieldQuestion,
} from 'lucide-react';
import { useIcfr } from './store';
import { useToast } from '../shared/Toast';
import { downloadControlWorkingPaper } from './icfrWorkingPaper';
import { attributeEffective, controlConclusion, courtFor, formatINR } from './helpers';
import { ConclusionPill, CourtBadge, NatureChip, ResultChip, StagePill } from './parts';
import { cn } from '../../lib/cn';
import type { Attribute, Control, TestResult } from './types';

export default function ControlWorkspace() {
  const { eng, selectedControlId, back, recordTod, recordToe, setStage } = useIcfr();
  const { addToast } = useToast();
  const control = eng.controls.find(c => c.id === selectedControlId);
  const [selAttrId, setSelAttrId] = useState(control?.attributes[0]?.id ?? '');
  useEffect(() => { setSelAttrId(control?.attributes[0]?.id ?? ''); }, [control?.id, control?.attributes]);
  if (!control) return null;
  const attr = control.attributes.find(a => a.id === selAttrId) ?? control.attributes[0];
  const concl = controlConclusion(control);
  const court = courtFor(control, eng.tasks);
  const def = eng.deficiencies.find(d => d.controlId === control.id);

  return (
    <div className="space-y-4">
      <button onClick={back} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-500 hover:text-brand-700 cursor-pointer transition-colors"><ArrowLeft size={14} /> Command center</button>

      {/* header */}
      <div className="rounded-2xl border border-canvas-border bg-canvas-elevated p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-[12.5px] font-semibold text-brand-700">{control.id}</span>
              {control.isKey && <span className="text-[9.5px] font-bold uppercase tracking-wide text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded">Key control</span>}
              <span className="text-[11.5px] text-ink-400">{control.process} · {control.subProcess}</span>
            </div>
            <h1 className="text-[19px] font-semibold text-ink-900 leading-tight" style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>{control.description}</h1>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <ConclusionPill c={concl} />
            <CourtBadge court={court} />
          </div>
        </div>
        <div className="flex items-center gap-4 mt-3 text-[12px] text-ink-500 flex-wrap">
          <NatureChip nature={control.nature} />
          <span>{control.type}</span>
          <span className="inline-flex items-center gap-1.5"><Clock size={13} />{control.frequency}</span>
          <span className="inline-flex items-center gap-1.5"><User size={13} />Owner: <span className="text-ink-700 font-medium">{control.owner}</span></span>
          <span className="text-ink-400">Risk {control.riskId}: {control.riskDescription}</span>
        </div>
        <div className="mt-3 text-[12px] text-ink-500 inline-flex items-start gap-1.5"><ShieldCheck size={13} className="text-brand-500 mt-0.5 shrink-0" /> <span><span className="font-semibold text-ink-600">Precision:</span> {control.precision}</span></div>
      </div>

      {/* attribute matrix */}
      <section className="rounded-2xl border border-canvas-border bg-canvas-elevated overflow-hidden">
        <header className="px-4 py-3 border-b border-canvas-border flex items-center justify-between">
          <h2 className="text-[13px] font-semibold text-ink-800">Attributes — per-attribute TOD + TOE roll up to the control</h2>
        </header>
        <table className="w-full text-[12.5px]">
          <thead><tr className="text-ink-500 border-b border-canvas-border">
            {['Attribute', 'Assertion', 'Design (TOD)', 'Operating (TOE)', '↩'].map((h, i) => <th key={h} className={cn('text-left font-semibold uppercase tracking-wide text-[10px] px-4 py-2', i > 1 && 'text-center')}>{h}</th>)}
          </tr></thead>
          <tbody>
            {control.attributes.map(a => {
              const sel = a.id === selAttrId;
              return (
                <tr key={a.id} onClick={() => setSelAttrId(a.id)} className={cn('cursor-pointer border-b border-canvas-border/60 last:border-0 transition-colors', sel ? 'bg-brand-50/60' : 'hover:bg-paper-50')}>
                  <td className="px-4 py-2.5"><div className="font-mono text-[11px] text-ink-500">{a.code}</div><div className="text-ink-800 leading-snug max-w-[280px]">{a.description}</div></td>
                  <td className="px-4 py-2.5 text-ink-600">{a.assertion}</td>
                  <td className="px-4 py-2.5 text-center"><div className="inline-flex justify-center"><ResultChip result={a.tod.result} /></div></td>
                  <td className="px-4 py-2.5 text-center"><div className="inline-flex justify-center"><ResultChip result={a.toe.result} /></div></td>
                  <td className="px-4 py-2.5 text-center">{attributeEffective(a) ? <CheckCircle2 size={15} className="text-compliant-700 inline" /> : <span className="text-ink-300">–</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="px-4 py-2.5 bg-paper-50/50 border-t border-canvas-border text-[12.5px] font-medium text-ink-700">
          Roll-up: {control.attributes.every(attributeEffective) ? <span className="text-compliant-700">all attributes pass TOD + TOE → CONTROL EFFECTIVE</span> : control.attributes.some(a => a.tod.result === 'Fail' || a.toe.result === 'Fail') ? <span className="text-risk-700">an attribute failed → CONTROL INEFFECTIVE (deficiency)</span> : <span className="text-ink-500">testing in progress</span>}
        </div>
      </section>

      {/* selected attribute — TOD then TOE */}
      {attr && (
        <AnimatePresence mode="wait">
          <motion.div key={attr.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.16 }} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <TodPanel control={control} attr={attr} onRecord={(r, note) => recordTod(control.id, attr.id, r, note)} />
            <ToePanel control={control} attr={attr} onRecord={(r, note) => recordToe(control.id, attr.id, r, note)} />
          </motion.div>
        </AnimatePresence>
      )}

      <ReviewSection control={control} />

      {/* conclude / deficiency */}
      <div className="rounded-2xl border border-canvas-border bg-canvas-elevated p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="text-[12.5px] text-ink-600 inline-flex items-center gap-2">
          <StagePill stage={control.stage} />
          {def && <span className="inline-flex items-center gap-1.5 text-risk-700"><FileWarning size={14} /> {def.description}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { downloadControlWorkingPaper(eng, control); addToast({ type: 'success', message: `Working_Paper_${control.id}.xlsx` }); }} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-canvas-border text-[13px] font-semibold text-ink-700 hover:border-brand-300 cursor-pointer transition-colors"><Download size={14} /> Working paper</button>
          {concl === 'Effective' && control.stage !== 'signed-off' && control.stage !== 'in-review' && (
            <button onClick={() => setStage(control.id, 'in-review')} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-brand-600 text-white text-[13px] font-semibold hover:bg-brand-500 cursor-pointer transition-colors">Send to reviewer <ArrowRight size={15} /></button>
          )}
          {concl === 'Ineffective' && (
            <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-risk-700"><FileWarning size={15} /> Raised as a deficiency</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── TOD panel ───────────────────────────────────────────────────────────────────

function TodPanel({ control, attr, onRecord }: { control: Control; attr: Attribute; onRecord: (r: TestResult, note: string) => void }) {
  const [note, setNote] = useState(attr.tod.note);
  useEffect(() => setNote(attr.tod.note), [attr.id, attr.tod.note]);
  return (
    <Panel title="① Test of Design" icon={<ClipboardCheck size={15} className="text-brand-600" />} sub="Does the control, as designed, address the risk at sufficient precision? Walkthrough one example.">
      <div className="rounded-lg bg-paper-50/60 border border-canvas-border px-3 py-2 text-[12px] text-ink-600 mb-3"><span className="font-semibold">Precision:</span> {attr.precision}</div>
      <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Walkthrough note — what did you trace, what does it confirm…" className="w-full rounded-lg border border-canvas-border px-3 py-2 text-[12.5px] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-50 resize-none mb-3" />
      <PassFail current={attr.tod.result} onPass={() => onRecord('Pass', note)} onFail={() => onRecord('Fail', note)} failLabel="Design deficiency" />
      {attr.tod.testedAt && <p className="text-[11px] text-ink-400 mt-2">{attr.tod.testedBy} · {attr.tod.testedAt}</p>}
    </Panel>
  );
}

// ─── TOE panel (two paths) ─────────────────────────────────────────────────────--

function ToePanel({ control, attr, onRecord }: { control: Control; attr: Attribute; onRecord: (r: TestResult, note: string) => void }) {
  const [note, setNote] = useState(attr.toe.note);
  useEffect(() => setNote(attr.toe.note), [attr.id, attr.toe.note]);
  const todDone = attr.tod.result === 'Pass';
  const auto = control.nature === 'Automated';

  if (!todDone) {
    return (
      <Panel title="② Operating effectiveness" icon={<FlaskConical size={15} className="text-brand-600" />} sub="Gated by Test of Design.">
        <div className="flex flex-col items-center text-center py-6 text-ink-400 gap-1.5"><Lock size={18} /><p className="text-[12.5px]">Pass Test of Design first — a control that isn't designed to work can't be tested for effectiveness.</p></div>
      </Panel>
    );
  }

  return (
    <Panel title="② Operating effectiveness" icon={<FlaskConical size={15} className="text-brand-600" />} sub={auto ? 'Automated — drawn from the linked CCM workflow.' : 'Manual — population → sample → reperformance.'}>
      {auto ? (
        <div className="rounded-lg border border-evidence-200 bg-evidence-50/40 p-3 mb-3">
          <div className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-ink-800 mb-1"><Bot size={14} className="text-brand-600" />{control.workflowName}</div>
          <div className="text-[12px] text-ink-600">Run {attr.toe.workflowRunRef ?? '—'} · {attr.toe.sampleResults.length || 25} items · {attr.toe.sampleResults.filter(s => s.result === 'Fail').length} exception(s)</div>
        </div>
      ) : (
        <div className="space-y-2 mb-3">
          {control.population && <div className="rounded-lg border border-canvas-border p-2.5 text-[12px]"><div className="inline-flex items-center gap-1.5 font-semibold text-ink-700"><Database size={13} /> Population</div><div className="text-ink-600 mt-0.5">{control.population.count.toLocaleString('en-IN')} · {control.population.source}</div><div className="text-ink-400 text-[11px]">Tie-out: {control.population.tieOut}</div></div>}
          {control.sampling && <div className="rounded-lg border border-canvas-border p-2.5 text-[12px]"><div className="inline-flex items-center gap-1.5 font-semibold text-ink-700"><Shuffle size={13} /> Sample · {control.sampling.method} {control.sampling.size}</div><div className="text-ink-400 text-[11px] mt-0.5">Basis: {control.sampling.basis}</div></div>}
        </div>
      )}
      <div className="text-[11px] text-ink-400 mb-2">Procedures: {attr.toe.procedures.join(' · ') || '—'} <span className="text-ink-300">(inquiry can't be the sole procedure)</span></div>
      <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Testing note / exceptions…" className="w-full rounded-lg border border-canvas-border px-3 py-2 text-[12.5px] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-50 resize-none mb-3" />
      <PassFail current={attr.toe.result} onPass={() => onRecord('Pass', note)} onFail={() => onRecord('Fail', note)} failLabel="Exception" />
      {attr.toe.testedAt && <p className="text-[11px] text-ink-400 mt-2">{attr.toe.testedBy} · {attr.toe.testedAt}</p>}
    </Panel>
  );
}

// ─── bits ────────────────────────────────────────────────────────────────────────

function Panel({ title, icon, sub, children }: { title: string; icon: React.ReactNode; sub?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-canvas-border bg-canvas-elevated overflow-hidden flex flex-col">
      <header className="px-4 py-3 border-b border-canvas-border">
        <h3 className="inline-flex items-center gap-2 text-[13px] font-semibold text-ink-800">{icon}{title}</h3>
        {sub && <p className="text-[11.5px] text-ink-500 mt-0.5">{sub}</p>}
      </header>
      <div className="p-4 flex-1">{children}</div>
    </section>
  );
}

function PassFail({ current, onPass, onFail, failLabel }: { current: TestResult; onPass: () => void; onFail: () => void; failLabel: string }) {
  return (
    <div className="flex items-center gap-2">
      <button onClick={onPass} className={cn('inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-[13px] font-semibold border transition-colors cursor-pointer', current === 'Pass' ? 'bg-compliant-50 border-compliant-700 text-compliant-700' : 'border-canvas-border text-ink-600 hover:border-compliant-700/40 hover:text-compliant-700')}><CheckCircle2 size={15} /> Pass</button>
      <button onClick={onFail} className={cn('inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-[13px] font-semibold border transition-colors cursor-pointer', current === 'Fail' ? 'bg-risk-50 border-risk-700 text-risk-700' : 'border-canvas-border text-ink-600 hover:border-risk-700/40 hover:text-risk-700')}><XCircle size={15} /> {failLabel}</button>
    </div>
  );
}

// ─── Review section (role-aware) ─────────────────────────────────────────────────

function ReviewSection({ control }: { control: Control }) {
  const { eng, role, raiseReviewNote, signOff, clearTask } = useIcfr();
  const { addToast } = useToast();
  const [draft, setDraft] = useState('');
  const notes = eng.tasks.filter(t => t.controlId === control.id && t.type === 'review-note');
  const open = notes.filter(t => t.status === 'open');
  const concl = controlConclusion(control);
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());
  const allReviewed = control.attributes.every(a => reviewed.has(a.id));

  if (role === 'risk-owner') return null;
  if (role === 'auditor' && open.length === 0) return null;
  if (role === 'reviewer' && concl !== 'Effective' && concl !== 'Ineffective' && control.stage !== 'in-review' && control.stage !== 'signed-off') return null;

  const doSignOff = () => {
    const ok = signOff(control.id);
    addToast({ type: ok ? 'success' : 'warning', title: ok ? 'Control signed off' : 'Open notes remain', message: ok ? `${control.id} signed off.` : 'Resolve the open review notes first.' });
  };
  const addNote = () => { if (!draft.trim()) return; raiseReviewNote(control.id, draft.trim()); setDraft(''); addToast({ type: 'info', message: 'Review note sent to the preparer' }); };

  return (
    <section className="rounded-2xl border border-canvas-border bg-canvas-elevated overflow-hidden">
      <header className="px-4 py-3 border-b border-canvas-border flex items-center justify-between">
        <h3 className="inline-flex items-center gap-2 text-[13px] font-semibold text-ink-800"><ShieldQuestion size={15} className="text-evidence-600" /> Review {role === 'reviewer' ? '· you' : ''}</h3>
        {control.stage === 'signed-off' && <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-compliant-700"><CheckCircle2 size={14} /> Signed off</span>}
      </header>
      <div className="p-4 space-y-3">
        {role === 'reviewer' && control.stage !== 'signed-off' && (
          <div>
            <div className="text-[11px] uppercase tracking-wide text-ink-400 font-semibold mb-1.5">Attribute review · annotate each before sign-off</div>
            <div className="rounded-lg border border-canvas-border divide-y divide-canvas-border">
              {control.attributes.map(a => {
                const ok = reviewed.has(a.id);
                return (
                  <div key={a.id} className="flex items-center justify-between gap-2 px-3 py-2 text-[12px]">
                    <span className="inline-flex items-center gap-2 min-w-0"><span className="font-mono text-[11px] text-ink-500">{a.code}</span><span className="text-ink-700 truncate">{a.description}</span></span>
                    <button onClick={() => setReviewed(prev => { const n = new Set(prev); if (n.has(a.id)) n.delete(a.id); else n.add(a.id); return n; })} className={cn('shrink-0 inline-flex items-center gap-1 h-7 px-2.5 rounded-md border text-[11.5px] font-semibold cursor-pointer transition-colors', ok ? 'bg-compliant-50 border-compliant-700 text-compliant-700' : 'border-canvas-border text-ink-500 hover:border-compliant-700/40')}><CheckCircle2 size={12} /> {ok ? 'Reviewed' : 'Mark reviewed'}</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {notes.length === 0 && role === 'reviewer' && <p className="text-[12.5px] text-ink-500">Add a review note for the preparer, or sign off when every attribute is reviewed.</p>}
        {notes.map(n => (
          <div key={n.id} className={cn('rounded-lg border px-3 py-2 flex items-start justify-between gap-3', n.status === 'open' ? 'border-mitigated-700/30 bg-mitigated-50/40' : 'border-canvas-border bg-paper-50/40')}>
            <div className="min-w-0"><div className="text-[12.5px] text-ink-800">{n.thread[n.thread.length - 1]?.text ?? n.detail}</div><div className="text-[11px] text-ink-400 mt-0.5">{n.raisedBy} · {n.status === 'open' ? 'open' : 'cleared'}</div></div>
            {role === 'auditor' && n.status === 'open' && <button onClick={() => { clearTask(n.id); addToast({ type: 'success', message: 'Review note cleared' }); }} className="shrink-0 inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-compliant-700 text-white text-[12px] font-semibold cursor-pointer">Clear</button>}
          </div>
        ))}
        {role === 'reviewer' && control.stage !== 'signed-off' && (
          <div className="flex items-center gap-2">
            <input value={draft} onChange={e => setDraft(e.target.value)} placeholder="Add a review note for the preparer…" className="flex-1 h-9 px-3 rounded-lg border border-canvas-border text-[12.5px] focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-50" />
            <button onClick={addNote} className="h-9 px-3 rounded-lg border border-canvas-border text-[12.5px] font-semibold text-ink-700 hover:border-brand-300 cursor-pointer transition-colors">Add note</button>
            <button onClick={doSignOff} disabled={open.length > 0 || concl !== 'Effective' || !allReviewed} title={!allReviewed ? 'Mark every attribute reviewed first' : open.length > 0 ? 'Clear open notes first' : undefined} className="h-9 px-4 rounded-lg bg-brand-600 text-white text-[12.5px] font-semibold hover:bg-brand-500 cursor-pointer disabled:bg-brand-100 disabled:text-brand-300 disabled:cursor-not-allowed inline-flex items-center gap-1.5 transition-colors"><ShieldCheck size={14} /> Sign off</button>
          </div>
        )}
      </div>
    </section>
  );
}

export { formatINR };
