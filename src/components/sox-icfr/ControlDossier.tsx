import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft, FileText, Upload, MessageSquare, Workflow as WorkflowIcon, Hand, AlertTriangle,
  Send, Lock, Download, ClipboardCheck, FileCheck2, FlaskConical, CheckCircle2, XCircle,
  CornerDownRight, Pencil, RotateCcw, Cpu, ChevronRight, Scale, Paperclip,
} from 'lucide-react';
import { useIcfr } from './store';
import {
  controlConclusion, courtFor, designProgress, discussionsFor, operatingProgress, trackResult,
} from './helpers';
import { ConclusionPill, CourtBadge, NatureChip, TrackPill, Tickmark } from './parts';
import { Pill } from '../shared/StatusBadge';
import { downloadControlWorkingPaper } from './icfrWorkingPaper';
import { cn } from '../../lib/cn';
import type {
  Control, DesignDoc, DiscussionAnchor, DocStatus, OperatingStep, Sampling, TestResult, TrackConclusion,
} from './types';

const DOC_TONE: Record<DocStatus, string> = { Received: 'text-compliant-700', Requested: 'text-mitigated-700', Missing: 'text-risk-700' };

// ── small inline override / rationale form ───────────────────────────────────────
function RationaleForm({ title, onCancel, buttons }: { title: string; onCancel: () => void; buttons: { label: string; onClick: (note: string) => void }[] }) {
  const [note, setNote] = useState('');
  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-2 p-3 rounded-xl border border-high-200 bg-high-50/40">
      <div className="text-[11.5px] font-semibold text-high-700 mb-1.5 flex items-center gap-1.5"><Pencil size={12} /> {title}</div>
      <textarea autoFocus value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Record your rationale — this is retained in the working paper." className="w-full text-[12px] rounded-lg border border-canvas-border bg-canvas-elevated px-2.5 py-2 text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-high-200 resize-none" />
      <div className="flex items-center justify-end gap-2 mt-2">
        <button onClick={onCancel} className="h-7 px-2.5 text-[12px] font-semibold text-ink-500 hover:text-ink-800 cursor-pointer">Cancel</button>
        {buttons.map(b => <button key={b.label} disabled={!note.trim()} onClick={() => b.onClick(note.trim())} className="h-7 px-3 text-[12px] font-semibold rounded-lg bg-high-600 text-white disabled:opacity-40 enabled:hover:bg-high-700 transition-colors cursor-pointer">{b.label}</button>)}
      </div>
    </motion.div>
  );
}

// ── one operating attribute — its own workflow and/or self-attestation ────────────
function StepRow({ control, step, canEdit }: { control: Control; step: OperatingStep; canEdit: boolean }) {
  const { setStepResult, overrideStep, pullStepRun, attestStep, addStepEvidence } = useIcfr();
  const [over, setOver] = useState(false);
  const [attestOpen, setAttestOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState(step.attestation?.note ?? '');
  const effective: TestResult = step.override ? (step.override.result as TestResult) : step.result;
  const att = step.attestation;

  const resultBtn = (target: TestResult, label: string, Icon: typeof CheckCircle2, on: boolean, onTone: string) => (
    <button onClick={() => setStepResult(control.id, step.id, target)} className={cn('h-8 px-2.5 inline-flex items-center gap-1 rounded-lg border text-[12px] font-semibold transition-colors cursor-pointer', on ? onTone : 'border-canvas-border bg-canvas-elevated text-ink-600 hover:border-ink-300 hover:text-ink-900')}><Icon size={13} />{label}</button>
  );

  return (
    <div className={cn('step-row', effective === 'Fail' && 'fail', effective === 'Pass' && 'pass')}>
      <div className="flex items-start gap-3.5">
        <Tickmark result={effective} size={22} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[11px] font-bold text-ink-500">{step.code}</span>
            <span className="text-[13px] font-semibold text-ink-900">{step.description}</span>
            {step.override && <span className="override-tag"><Pencil size={9} /> Overridden</span>}
          </div>
          <div className="text-[11px] text-ink-400 mt-1">{step.assertion} · {step.precision} · {step.procedures.join(' / ')}</div>
          {step.override && <div className="text-[11px] text-high-700 mt-1.5 flex items-start gap-1"><CornerDownRight size={11} className="mt-0.5 shrink-0" /> {step.override.rationale} <span className="text-ink-400">— {step.override.by}</span></div>}
        </div>
        {canEdit && (
          <div className="flex items-center gap-1.5 shrink-0">
            {resultBtn('Pass', 'Pass', CheckCircle2, effective === 'Pass', 'bg-compliant-50 border-compliant-300 text-compliant-700')}
            {resultBtn('Fail', 'Fail', XCircle, effective === 'Fail', 'bg-risk-50 border-risk-300 text-risk-700')}
            <button onClick={() => setOver(o => !o)} title="Override result with rationale" className={cn('h-8 w-8 inline-flex items-center justify-center rounded-lg border transition-colors cursor-pointer', step.override ? 'bg-high-50 border-high-300 text-high-700' : 'border-canvas-border bg-canvas-elevated text-ink-600 hover:border-high-300 hover:text-high-700')}><Pencil size={13} /></button>
          </div>
        )}
      </div>

      {/* evidence — each attribute is evidenced on its own */}
      <div className="mt-3 ml-[36px] space-y-2">
        {step.workflowName && (
          <div className="flex items-center gap-2.5 rounded-lg border border-evidence-100 bg-evidence-50/40 px-3 py-2">
            <Cpu size={14} className="text-evidence-700 shrink-0" />
            <div className="min-w-0 flex-1"><div className="text-[12px] font-semibold text-ink-800 truncate">{step.workflowName}</div><div className="text-[10.5px] font-mono text-ink-400">{step.workflowRunRef ?? 'run not pulled yet'}</div></div>
            {canEdit && <button onClick={() => pullStepRun(control.id, step.id)} className="h-7 px-2.5 rounded-md bg-evidence-600 text-white text-[11.5px] font-semibold hover:bg-evidence-700 inline-flex items-center gap-1 cursor-pointer"><WorkflowIcon size={12} /> {step.workflowRunRef ? 'Re-pull' : 'Pull run'}</button>}
          </div>
        )}
        <div className="rounded-lg border border-canvas-border px-3 py-2.5">
          <div className="flex items-center gap-2 text-[11px] font-bold text-ink-600"><Hand size={12} /> Self-attestation {att && <span className="font-normal text-ink-400">· {att.by}, {att.at}</span>}</div>
          {att?.note && !attestOpen && <p className="text-[12px] text-ink-700 mt-1.5 italic">“{att.note}”</p>}
          {att && att.evidence.length > 0 && <div className="flex flex-wrap gap-1.5 mt-1.5">{att.evidence.map(f => <span key={f.id} className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-ink-600 bg-paper-50 border border-canvas-border rounded-md px-1.5 h-[20px]"><Paperclip size={9} />{f.name}</span>)}</div>}
          {canEdit ? (attestOpen ? (
            <div className="mt-2">
              <textarea autoFocus value={noteDraft} onChange={e => setNoteDraft(e.target.value)} rows={2} placeholder="Describe how this attribute is satisfied — this is recorded as your attestation." className="w-full text-[12px] rounded-lg border border-canvas-border bg-canvas-elevated px-2.5 py-2 text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-200 resize-none" />
              <div className="flex items-center gap-2 mt-1.5">
                <button disabled={!noteDraft.trim()} onClick={() => { attestStep(control.id, step.id, noteDraft.trim()); setAttestOpen(false); }} className="h-7 px-2.5 rounded-md bg-brand-600 text-white text-[11.5px] font-semibold disabled:opacity-40 enabled:hover:bg-brand-700 cursor-pointer">Save attestation</button>
                <button onClick={() => addStepEvidence(control.id, step.id, `evidence-${step.code}.pdf`)} className="h-7 px-2.5 rounded-md border border-canvas-border bg-canvas-elevated text-ink-600 text-[11.5px] font-semibold hover:border-brand-300 hover:text-brand-700 inline-flex items-center gap-1 cursor-pointer"><Upload size={11} /> Attach evidence</button>
                <button onClick={() => setAttestOpen(false)} className="h-7 px-2 text-ink-500 text-[11.5px] font-semibold hover:text-ink-800 cursor-pointer">Done</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAttestOpen(true)} className="mt-1.5 h-7 px-2.5 rounded-md border border-canvas-border bg-canvas-elevated text-ink-600 text-[11.5px] font-semibold hover:border-brand-300 hover:text-brand-700 inline-flex items-center gap-1 cursor-pointer"><Pencil size={11} /> {att?.note ? 'Edit attestation' : 'Self-attest with evidence'}</button>
          )) : !att && <p className="text-[11.5px] text-ink-400 mt-1">Not attested</p>}
        </div>
      </div>

      {over && (
        step.override
          ? <div className="mt-2 flex justify-end"><button onClick={() => { overrideStep(control.id, step.id, null); setOver(false); }} className="h-7 px-3 text-[12px] font-semibold rounded-lg border border-canvas-border text-ink-600 hover:text-ink-900 inline-flex items-center gap-1.5 cursor-pointer"><RotateCcw size={12} /> Remove override</button></div>
          : <RationaleForm title="Override this result — record why" onCancel={() => setOver(false)} buttons={[
              { label: 'Override · Pass', onClick: note => { overrideStep(control.id, step.id, { result: 'Pass', by: 'You · Auditor', at: 'just now', rationale: note }); setOver(false); } },
              { label: 'Override · Fail', onClick: note => { overrideStep(control.id, step.id, { result: 'Fail', by: 'You · Auditor', at: 'just now', rationale: note }); setOver(false); } },
            ]} />
      )}
    </div>
  );
}

// ── track conclude controls (with override when it contradicts the evidence) ──────
function ConcludeBar({ control, which, suggestion, canEdit }: { control: Control; which: 'design' | 'operating'; suggestion: TrackConclusion; canEdit: boolean }) {
  const { concludeDesign, concludeOperating, overrideDesign, overrideOperating } = useIcfr();
  const track = control[which];
  const conclude = which === 'design' ? concludeDesign : concludeOperating;
  const override = which === 'design' ? overrideDesign : overrideOperating;
  const [pending, setPending] = useState<TrackConclusion | null>(null);

  if (!canEdit) return null;
  const apply = (target: TrackConclusion) => {
    const contradicts = suggestion !== 'Not tested' && target !== suggestion;
    if (contradicts) { setPending(target); return; }   // overriding the evidence — need rationale
    override(control.id, null); conclude(control.id, target);
  };
  return (
    <div>
      <div className="flex items-center gap-2">
        <button onClick={() => apply('Effective')} className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg bg-compliant-600 text-white text-[12.5px] font-semibold hover:bg-compliant-700 transition-colors cursor-pointer"><CheckCircle2 size={14} /> Conclude effective</button>
        <button onClick={() => apply('Ineffective')} className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border border-risk-200 text-risk-700 text-[12.5px] font-semibold hover:bg-risk-50 transition-colors cursor-pointer"><XCircle size={14} /> Conclude ineffective</button>
        {suggestion !== 'Not tested' && <span className="text-[11px] text-ink-400 inline-flex items-center gap-1"><Scale size={12} /> Evidence suggests <b className="font-semibold text-ink-600">{suggestion}</b></span>}
      </div>
      {pending && (
        <RationaleForm title={`Override the evidence — conclude ${pending} against a ${suggestion} result`} onCancel={() => setPending(null)}
          buttons={[{ label: `Override · ${pending}`, onClick: note => { override(control.id, { result: pending === 'Effective' ? 'Effective' : 'Ineffective', by: 'You · Auditor', at: 'just now', rationale: note }); conclude(control.id, pending); setPending(null); } }]} />
      )}
      {track.override && (
        <div className="mt-2 text-[11.5px] text-high-700 flex items-start gap-1.5 p-2 rounded-lg bg-high-50/50 border border-high-200">
          <Pencil size={12} className="mt-0.5 shrink-0" /><span><b>Conclusion overridden</b> — {track.override.rationale} <span className="text-ink-400">· {track.override.by}</span></span>
          <button onClick={() => override(control.id, null)} className="ml-auto text-ink-400 hover:text-ink-700 inline-flex items-center gap-1 cursor-pointer"><RotateCcw size={11} /> undo</button>
        </div>
      )}
    </div>
  );
}

// ── design track (TOD) ───────────────────────────────────────────────────────────
function DesignTrack({ control, canEdit }: { control: Control; canEdit: boolean }) {
  const { setDocStatus, setDesignPoint, raiseQuery } = useIcfr();
  const d = control.design; const prog = designProgress(control);
  const result = trackResult(d);
  const missing = d.documents.filter(x => x.status !== 'Received');
  const suggestion: TrackConclusion = missing.length > 0 || d.points.some(p => p.result === 'Fail') ? 'Ineffective' : d.points.every(p => p.result === 'Pass') && d.points.length > 0 ? 'Effective' : 'Not tested';

  const setDoc = (doc: DesignDoc, status: DocStatus) => setDocStatus(control.id, doc.id, status);
  return (
    <section className="track track-design">
      <div className="track-head">
        <div>
          <div className="flex items-center gap-2"><span className="track-num">①</span><h3 className="text-[14px] font-bold text-ink-900">Test of design</h3><Pill tone="info">independent</Pill></div>
          <p className="text-[11.5px] text-ink-500 mt-0.5">Is the control designed to prevent or detect the risk? Grounded in the process documents and walkthrough.</p>
        </div>
        <div className="text-right shrink-0"><TrackPill c={result} />{d.testedBy && <div className="text-[10.5px] text-ink-400 mt-1">{d.testedBy} · {d.testedAt}</div>}</div>
      </div>
      <div className="p-5">
        {/* required documents */}
        <div className="flex items-center justify-between mb-2.5">
          <h4 className="text-[12.5px] font-bold text-ink-700 inline-flex items-center gap-1.5"><FileText size={14} /> Required design documents</h4>
          <span className="text-[11px] text-ink-400 tabular-nums">{prog.docsReceived}/{prog.docsTotal} received</span>
        </div>
        <div className="mb-5">
          {d.documents.map(doc => (
            <div key={doc.id} className="doc-row">
              <FileCheck2 size={15} className={cn('shrink-0', DOC_TONE[doc.status])} />
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-semibold text-ink-800 truncate">{doc.kind}</div>
                <div className="text-[11px] text-ink-400 truncate">{doc.name}{doc.uploadedBy ? ` · ${doc.uploadedBy}, ${doc.at}` : ''}</div>
              </div>
              <Pill tone={doc.status === 'Received' ? 'compliant' : doc.status === 'Requested' ? 'mitigated' : 'risk'}>{doc.status}</Pill>
              {canEdit && doc.status !== 'Received' && (
                <div className="flex items-center gap-1">
                  {doc.status === 'Missing' && <button onClick={() => { setDoc(doc, 'Requested'); raiseQuery(control.id, `Provide ${doc.kind.toLowerCase()}`, `Design document needed for TOD: ${doc.kind}.`); }} className="h-7 px-2.5 text-[11.5px] font-semibold rounded-md border border-canvas-border text-ink-600 hover:text-brand-700 hover:border-brand-200 inline-flex items-center gap-1 cursor-pointer"><Send size={11} /> Request</button>}
                  <button onClick={() => setDoc(doc, 'Received')} className="h-7 px-2.5 text-[11.5px] font-semibold rounded-md border border-canvas-border text-ink-600 hover:text-compliant-700 hover:border-compliant-200 inline-flex items-center gap-1 cursor-pointer"><Upload size={11} /> Attach</button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* design considerations */}
        <h4 className="text-[12.5px] font-bold text-ink-700 inline-flex items-center gap-1.5 mb-2.5"><ClipboardCheck size={14} /> Design considerations <span className="font-normal text-ink-400">· assessed in the walkthrough</span></h4>
        <div className="space-y-2 mb-5">
          {d.points.map(p => (
            <div key={p.id} className="flex items-center gap-2.5 py-1.5">
              <Tickmark result={p.result} size={17} />
              <span className="text-[12.5px] text-ink-800 flex-1">{p.text}</span>
              {canEdit && (
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setDesignPoint(control.id, p.id, 'Pass')} className={cn('h-7 px-2.5 text-[11.5px] font-semibold rounded-md border transition-colors cursor-pointer', p.result === 'Pass' ? 'bg-compliant-50 border-compliant-300 text-compliant-700' : 'border-canvas-border bg-canvas-elevated text-ink-600 hover:border-compliant-300 hover:text-compliant-700')}>Pass</button>
                  <button onClick={() => setDesignPoint(control.id, p.id, 'Fail')} className={cn('h-7 px-2.5 text-[11.5px] font-semibold rounded-md border transition-colors cursor-pointer', p.result === 'Fail' ? 'bg-risk-50 border-risk-300 text-risk-700' : 'border-canvas-border bg-canvas-elevated text-ink-600 hover:border-risk-300 hover:text-risk-700')}>Fail</button>
                </div>
              )}
            </div>
          ))}
        </div>

        {missing.length > 0 && <div className="text-[11.5px] text-mitigated-700 bg-mitigated-50/60 border border-mitigated-200 rounded-lg px-3 py-2 mb-3 inline-flex items-center gap-1.5"><AlertTriangle size={13} /> {missing.length} design document{missing.length > 1 ? 's' : ''} outstanding — design cannot be concluded effective without them (override to proceed).</div>}
        <ConcludeBar control={control} which="design" suggestion={suggestion} canEdit={canEdit} />
      </div>
    </section>
  );
}

// ── operating track (TOE) ────────────────────────────────────────────────────────
function OperatingTrack({ control, canEdit }: { control: Control; canEdit: boolean }) {
  const { setPopulation, setSampling } = useIcfr();
  const o = control.operating; const prog = operatingProgress(control);
  const result = trackResult(o);
  const anyFail = o.steps.some(s => (s.override ? s.override.result : s.result) === 'Fail');
  const allTested = o.steps.every(s => (s.override ? s.override.result : s.result) !== 'Not tested') && o.steps.length > 0;
  const suggestion: TrackConclusion = anyFail ? 'Ineffective' : allTested ? 'Effective' : 'Not tested';
  const [sampleSize, setSampleSize] = useState(25);
  const wfCount = o.steps.filter(s => s.workflowName).length;
  const attCount = o.steps.filter(s => s.attestation).length;

  const uploadPop = () => setPopulation(control.id, { source: 'SAP — full-period extract', count: 2640, tieOut: 'Agreed to GL control account', evidence: [{ id: 'ev', name: 'population.xlsx', kind: 'XLSX', uploadedBy: 'You · Auditor', uploadedAt: 'just now' }] });
  const drawSample = () => { const s: Sampling = { basis: `${sampleSize} items — judgment documented (handbook: no fixed minimum).`, method: 'Random', size: sampleSize, samples: Array.from({ length: sampleSize }, (_, i) => ({ id: `s${i}`, ref: `#${1000 + i}`, result: 'Not tested' })) }; setSampling(control.id, s); };

  return (
    <section className="track track-operating">
      <div className="track-head">
        <div>
          <div className="flex items-center gap-2"><span className="track-num">②</span><h3 className="text-[14px] font-bold text-ink-900">Test of operating effectiveness</h3><Pill tone="info">independent</Pill></div>
          <p className="text-[11.5px] text-ink-500 mt-1 max-w-[560px]">Did the control operate as designed across the period? Each attribute is evidenced on its own — by its own linked workflow, or self-attested with evidence.</p>
        </div>
        <div className="text-right shrink-0"><TrackPill c={result} />{o.testedBy && <div className="text-[10.5px] text-ink-400 mt-1">{o.testedBy} · {o.testedAt}</div>}</div>
      </div>
      <div className="p-5">
        {/* sampling context — optional, for manual sampling-based controls */}
        {o.method === 'Manual' && (
          <div className="mb-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-canvas-border p-3.5">
              <div className="text-[11.5px] font-bold text-ink-700 mb-1.5 inline-flex items-center gap-1.5"><Upload size={12} /> Population <span className="font-normal text-ink-400">· optional</span></div>
              {o.population ? (
                <div className="text-[12px] text-ink-700"><div className="font-semibold tabular-nums text-[15px] text-ink-900">{o.population.count.toLocaleString()}</div><div className="text-[11px] text-ink-400">{o.population.source}</div><div className="text-[11px] text-compliant-700 mt-0.5 inline-flex items-center gap-1"><CheckCircle2 size={11} /> {o.population.tieOut}</div></div>
              ) : canEdit ? <button onClick={uploadPop} className="h-8 px-3 text-[12px] font-semibold rounded-lg border border-dashed border-canvas-border text-ink-600 hover:text-brand-700 hover:border-brand-300 inline-flex items-center gap-1.5 cursor-pointer w-full justify-center"><Upload size={13} /> Upload population</button> : <span className="text-[11.5px] text-ink-400">Not uploaded</span>}
            </div>
            <div className="rounded-xl border border-canvas-border p-3.5">
              <div className="text-[11.5px] font-bold text-ink-700 mb-1.5 inline-flex items-center gap-1.5"><FlaskConical size={12} /> Sample <span className="font-normal text-ink-400">· optional</span></div>
              {o.sampling ? (
                <div className="text-[12px] text-ink-700"><div className="font-semibold tabular-nums text-[15px] text-ink-900">{o.sampling.size} items</div><div className="text-[11px] text-ink-400">{o.sampling.method} · {o.sampling.basis}</div></div>
              ) : canEdit ? (
                <div className="flex items-center gap-2">
                  <input type="number" min={1} max={60} value={sampleSize} onChange={e => setSampleSize(Math.max(1, +e.target.value || 1))} className="h-8 w-16 px-2 rounded-lg border border-canvas-border text-[12.5px] text-ink-800 focus:outline-none focus:ring-2 focus:ring-brand-200" />
                  <button disabled={!o.population} onClick={drawSample} className="h-8 px-3 text-[12px] font-semibold rounded-lg border border-canvas-border text-ink-600 enabled:hover:text-brand-700 enabled:hover:border-brand-300 disabled:opacity-40 inline-flex items-center gap-1.5 cursor-pointer"><FlaskConical size={13} /> Draw</button>
                </div>
              ) : <span className="text-[11.5px] text-ink-400">Not drawn</span>}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-3">
          <h4 className="text-[12.5px] font-bold text-ink-700 inline-flex items-center gap-1.5"><ClipboardCheck size={14} /> Test attributes <span className="font-normal text-ink-400">· each evidenced independently</span></h4>
          <span className="text-[11px] text-ink-400 tabular-nums">{wfCount} workflow · {attCount} attested · {prog.passed} pass · {prog.failed} fail</span>
        </div>
        <div className="space-y-3 mb-5">{o.steps.map(s => <StepRow key={s.id} control={control} step={s} canEdit={canEdit} />)}</div>

        <ConcludeBar control={control} which="operating" suggestion={suggestion} canEdit={canEdit} />
      </div>
    </section>
  );
}

// ── discussion rail ──────────────────────────────────────────────────────────────
const ANCHORS: { id: DiscussionAnchor | 'all'; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'control', label: 'Control' }, { id: 'design', label: '① Design' }, { id: 'operating', label: '② Operating' },
];
function DiscussionRail({ control }: { control: Control }) {
  const { eng, role, addComment, resolveDiscussion } = useIcfr();
  const [tab, setTab] = useState<DiscussionAnchor | 'all'>('all');
  const [text, setText] = useState('');
  const threads = useMemo(() => discussionsFor(eng, control.id).filter(d => tab === 'all' || d.anchor === tab), [eng, control.id, tab]);
  const postAnchor: DiscussionAnchor = tab === 'all' ? 'control' : tab;

  return (
    <aside className="track sticky top-20 self-start max-h-[calc(100vh-7rem)] flex flex-col">
      <div className="track-head" style={{ background: 'transparent' }}>
        <div className="flex items-center gap-2"><MessageSquare size={15} className="text-brand-600" /><h3 className="text-[14px] font-bold text-ink-900">Discussion</h3></div>
      </div>
      <div className="px-3 pt-2.5 flex items-center gap-1">
        {ANCHORS.map(a => <button key={a.id} onClick={() => setTab(a.id)} className={cn('h-7 px-2.5 rounded-md text-[11.5px] font-semibold transition-colors cursor-pointer', tab === a.id ? 'bg-brand-600 text-white' : 'text-ink-500 hover:text-ink-800')}>{a.label}</button>)}
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {threads.length === 0 && <div className="text-center text-[12px] text-ink-400 py-10">No discussion here yet. Start a thread below — your role is tagged automatically.</div>}
        {threads.map(d => (
          <div key={d.id} className="space-y-2">
            <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">{d.anchor === 'design' ? '① Design' : d.anchor === 'operating' ? '② Operating' : 'Control'}{d.resolved && <Pill tone="compliant">Resolved</Pill>}<button onClick={() => resolveDiscussion(d.id, !d.resolved)} className="ml-auto text-ink-400 hover:text-brand-700 normal-case cursor-pointer">{d.resolved ? 'reopen' : 'resolve'}</button></div>
            {d.comments.map(c => (
              <div key={c.id} className={cn('disc-bubble', c.role)}>
                <div className="flex items-center justify-between gap-2 mb-1"><span className="text-[11.5px] font-bold text-ink-800">{c.by}</span><span className="text-[10.5px] text-ink-400">{c.at}</span></div>
                <p className="text-[12px] text-ink-700 leading-snug">{c.text}</p>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="p-3 border-t border-[var(--paper-rule)]">
        <div className="text-[10.5px] text-ink-400 mb-1.5">Posting to <b className="text-ink-600">{postAnchor === 'control' ? 'Control' : postAnchor === 'design' ? '① Design' : '② Operating'}</b> as <b className="text-ink-600 capitalize">{role}</b></div>
        <div className="flex items-end gap-2">
          <textarea value={text} onChange={e => setText(e.target.value)} rows={2} placeholder="Add a comment, ask the risk owner, flag for the reviewer…" className="flex-1 text-[12px] rounded-lg border border-canvas-border bg-canvas-elevated px-2.5 py-2 text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-200 resize-none" />
          <button disabled={!text.trim()} onClick={() => { addComment(control.id, postAnchor, text.trim()); setText(''); }} className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-lg bg-brand-600 text-white disabled:opacity-40 enabled:hover:bg-brand-700 transition-colors cursor-pointer"><Send size={15} /></button>
        </div>
      </div>
    </aside>
  );
}

// ── the dossier ──────────────────────────────────────────────────────────────────
export default function ControlDossier() {
  const { eng, role, selectedControlId, back, setView } = useIcfr();
  const control = eng.controls.find(c => c.id === selectedControlId);
  if (!control) return <div className="text-ink-500">Control not found. <button onClick={back} className="text-brand-700 font-semibold">Back to register</button></div>;
  const canEdit = role === 'auditor';
  const concl = controlConclusion(control);

  return (
    <div>
      <button onClick={back} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-500 hover:text-brand-700 mb-3 cursor-pointer transition-colors"><ArrowLeft size={15} /> Control register</button>

      {/* leadsheet header */}
      <div className="leadsheet mb-5">
        <div className="leadsheet-head">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                {control.isKey && <Pill tone="mitigated">Key control</Pill>}
                <NatureChip nature={control.nature} /><Pill tone="draft">{control.type}</Pill><Pill tone="draft">{control.frequency}</Pill>
                <span className="text-[11px] text-ink-400 font-mono">{control.id}</span>
              </div>
              <h1 className="leadsheet-title text-[20px] text-ink-900 leading-snug max-w-[640px]">{control.description}</h1>
              <p className="text-[12.5px] text-ink-500 mt-1.5 max-w-[680px]"><b className="text-ink-700 font-semibold">Precision —</b> {control.precision}</p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2.5 text-[11.5px] text-ink-500">
                <span><span className="text-ink-400">Process</span> · {control.process} / {control.subProcess}</span>
                <span><span className="text-ink-400">Owner</span> · {control.owner}</span>
                <span><span className="text-ink-400">Risk {control.riskId}</span> · {control.riskDescription}</span>
              </div>
            </div>
            <div className="shrink-0 flex flex-col items-end gap-2">
              <div className="leadsheet-stamp">W/P<br />{control.wpRef}</div>
              <CourtBadge court={courtFor(control, eng.tasks)} fromRole={role} />
            </div>
          </div>
          {/* roll-up */}
          <div className="flex items-center gap-3 mt-3.5 pt-3 border-t border-[var(--paper-rule)]">
            <span className="text-[11.5px] font-semibold text-ink-400 uppercase tracking-wide">Control conclusion</span>
            <ConclusionPill c={concl} />
            <span className="text-[11.5px] text-ink-400 inline-flex items-center gap-1.5"><Tickmark result={trackResult(control.design) === 'Effective' ? 'Pass' : trackResult(control.design) === 'Ineffective' ? 'Fail' : 'Not tested'} size={14} /> Design {trackResult(control.design)}</span>
            <span className="text-ink-300">+</span>
            <span className="text-[11.5px] text-ink-400 inline-flex items-center gap-1.5"><Tickmark result={trackResult(control.operating) === 'Effective' ? 'Pass' : trackResult(control.operating) === 'Ineffective' ? 'Fail' : 'Not tested'} size={14} /> Operating {trackResult(control.operating)}</span>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => downloadControlWorkingPaper(eng, control)} className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border border-canvas-border text-[12px] font-semibold text-ink-600 hover:text-ink-900 hover:border-ink-300 transition-colors cursor-pointer"><Download size={13} /> Working paper</button>
              {!canEdit && <span className="text-[11px] text-ink-400 inline-flex items-center gap-1"><Lock size={12} /> {role} · read-only testing</span>}
            </div>
          </div>
        </div>
      </div>

      {/* tracks + discussion */}
      <div className="grid grid-cols-[minmax(0,1fr)_360px] gap-5 items-start">
        <div className="space-y-5">
          <DesignTrack control={control} canEdit={canEdit} />
          <OperatingTrack control={control} canEdit={canEdit} />
          {concl === 'Ineffective' && (
            <div className="rounded-xl border border-risk-200 bg-risk-50/40 p-4">
              <div className="flex items-center gap-2 mb-1"><AlertTriangle size={15} className="text-risk-700" /><h3 className="text-[13px] font-bold text-risk-700">Deficiency raised</h3></div>
              <p className="text-[12px] text-ink-600">This control concluded ineffective. Assess severity (likelihood × magnitude) and remediation in <button onClick={() => setView('deficiencies')} className="font-semibold text-risk-700 hover:underline inline-flex items-center gap-0.5">Deficiencies <ChevronRight size={12} /></button>.</p>
            </div>
          )}
        </div>
        <DiscussionRail control={control} />
      </div>
    </div>
  );
}
