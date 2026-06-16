import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, FileText, Upload, MessageSquare, Workflow as WorkflowIcon, Hand, AlertTriangle,
  Send, Lock, Download, ClipboardCheck, FileCheck2, FlaskConical, CheckCircle2, XCircle,
  CornerDownRight, Pencil, RotateCcw, Cpu, ChevronRight, Scale, Paperclip, Plus, Trash2,
  Mail, X, Loader2, ChevronDown, Check, PlayCircle, Link2, ListChecks,
} from 'lucide-react';
import { useIcfr } from './store';
import {
  controlConclusion, courtFor, designProgress, discussionsFor, operatingProgress, trackResult,
  pointResult, stepResult,
} from './helpers';
import { ConclusionPill, CourtBadge, NatureChip, TrackPill, Tickmark, Stamp } from './parts';
import { Pill } from '../shared/StatusBadge';
import { useToast } from '../shared/Toast';
import { Sparkles } from 'lucide-react';
import { downloadControlWorkingPaper } from './icfrWorkingPaper';
import { cn } from '../../lib/cn';
import { DESIGN_DOC_KINDS } from './types';
import type {
  Control, DesignDoc, DesignDocKind, DesignPoint, DiscussionAnchor, DocStatus, EvidenceMode, OperatingStep,
  Sampling, TestResult, TrackConclusion, ValidationQA,
} from './types';

const DOC_TONE: Record<DocStatus, string> = { Received: 'text-compliant-700', Requested: 'text-mitigated-700', Missing: 'text-ink-400' };
const WORKFLOW_LIBRARY = ['Three-way match check', 'Approval-tier check', 'Duplicate-invoice detection', 'Segregation-of-duties scan', 'Timeliness / cut-off check', 'Reconciliation completeness', 'Access review', 'Tolerance-breach monitor'];

// ── primitives ───────────────────────────────────────────────────────────────────
function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={cn('toggle', on && 'on')} />;
}

function RationaleForm({ title, onCancel, buttons }: { title: string; onCancel: () => void; buttons: { label: string; onClick: (note: string) => void }[] }) {
  const [note, setNote] = useState('');
  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-2 p-3 rounded-xl border border-high-200 bg-high-50/40">
      <div className="text-[11.5px] font-semibold text-high-700 mb-1.5 flex items-center gap-1.5"><Pencil size={12} /> {title}</div>
      <textarea autoFocus value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Record your rationale — retained in the working paper." className="w-full text-[12px] rounded-lg border border-canvas-border bg-canvas-elevated px-2.5 py-2 text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-high-200 resize-none" />
      <div className="flex items-center justify-end gap-2 mt-2">
        <button onClick={onCancel} className="h-7 px-2.5 text-[12px] font-semibold text-ink-500 hover:text-ink-800 cursor-pointer">Cancel</button>
        {buttons.map(b => <button key={b.label} disabled={!note.trim()} onClick={() => b.onClick(note.trim())} className="h-7 px-3 text-[12px] font-semibold rounded-lg bg-high-600 text-white disabled:opacity-40 enabled:hover:bg-high-700 transition-colors cursor-pointer">{b.label}</button>)}
      </div>
    </motion.div>
  );
}

function EmptyState({ icon, title, hint, children }: { icon: React.ReactNode; title: string; hint: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-canvas-border bg-paper-50/30 px-5 py-7 text-center">
      <div className="w-10 h-10 rounded-xl bg-canvas-elevated border border-canvas-border flex items-center justify-center mx-auto mb-2.5 text-ink-400">{icon}</div>
      <div className="text-[13px] font-semibold text-ink-800">{title}</div>
      <p className="text-[12px] text-ink-500 mt-0.5 max-w-[360px] mx-auto">{hint}</p>
      {children && <div className="mt-3 flex items-center justify-center gap-2">{children}</div>}
    </div>
  );
}

function Dropdown({ trigger, children }: { trigger: React.ReactNode; children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[12px] font-semibold text-ink-700 hover:border-ink-300 transition-colors cursor-pointer">{trigger}<ChevronDown size={13} className="text-ink-400" /></button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="absolute right-0 mt-1.5 z-20 w-56 max-h-64 overflow-y-auto rounded-xl border border-canvas-border bg-canvas-elevated shadow-[0_16px_40px_-16px_rgba(15,8,30,.4)] p-1">
              {children(() => setOpen(false))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
const menuItem = 'w-full text-left px-2.5 py-1.5 rounded-lg text-[12.5px] text-ink-700 hover:bg-paper-50 cursor-pointer flex items-center gap-2';

// ── request-data modal (TOD) ──────────────────────────────────────────────────────
function RequestDataModal({ control, onClose }: { control: Control; onClose: () => void }) {
  const { requestDataByEmail } = useIcfr();
  const [sel, setSel] = useState<Set<string>>(() => new Set(control.design.documents.filter(d => d.status !== 'Received').map(d => d.id)));
  const [emails, setEmails] = useState<string[]>(['controls.owner@airindiaexpress.in']);
  const [draft, setDraft] = useState('');
  const addEmail = () => { const e = draft.trim().replace(/,$/, ''); if (e && !emails.includes(e)) setEmails([...emails, e]); setDraft(''); };
  const toggle = (id: string) => setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const canSend = sel.size > 0 && emails.length > 0;
  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <motion.div className="modal" onClick={e => e.stopPropagation()} initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-canvas-border">
          <div className="flex items-center gap-2"><Mail size={16} className="text-brand-600" /><h3 className="text-[14px] font-bold text-ink-900">Request design data</h3></div>
          <button onClick={onClose} className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-ink-400 hover:text-ink-800 hover:bg-paper-50 cursor-pointer"><X size={16} /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-ink-400 mb-2">Documents to request</div>
            <div className="space-y-1.5">
              {control.design.documents.length === 0 && <p className="text-[12px] text-ink-400">No documents defined yet — add documents to the design track first.</p>}
              {control.design.documents.map(d => {
                const on = sel.has(d.id);
                return (
                  <button key={d.id} onClick={() => toggle(d.id)} className={cn('w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-colors cursor-pointer', on ? 'border-brand-300 bg-brand-50/50' : 'border-canvas-border hover:border-ink-300')}>
                    <span className={cn('w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center shrink-0', on ? 'bg-brand-600 border-brand-600 text-white' : 'border-ink-300')}>{on && <Check size={12} strokeWidth={3} />}</span>
                    <span className="min-w-0 flex-1"><span className="text-[12.5px] font-semibold text-ink-800">{d.kind}</span><span className="text-[11px] text-ink-400 ml-2">{d.status}</span></span>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-ink-400 mb-2">Send to</div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {emails.map(e => <span key={e} className="inline-flex items-center gap-1.5 h-7 pl-2.5 pr-1.5 rounded-lg bg-paper-100 text-[12px] font-medium text-ink-700">{e}<button onClick={() => setEmails(emails.filter(x => x !== e))} className="text-ink-400 hover:text-risk-600 cursor-pointer"><X size={12} /></button></span>)}
            </div>
            <div className="flex items-center gap-2">
              <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addEmail(); } }} type="email" placeholder="name@company.com" className="flex-1 h-9 px-3 rounded-lg border border-canvas-border bg-canvas-elevated text-[12.5px] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-200" />
              <button onClick={addEmail} className="h-9 px-3 rounded-lg border border-canvas-border text-[12.5px] font-semibold text-ink-600 hover:border-ink-300 cursor-pointer">Add</button>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-canvas-border bg-paper-50/40">
          <span className="text-[11.5px] text-ink-400">{sel.size} document{sel.size === 1 ? '' : 's'} · {emails.length} recipient{emails.length === 1 ? '' : 's'}</span>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="h-9 px-3.5 text-[12.5px] font-semibold text-ink-600 hover:text-ink-900 cursor-pointer">Cancel</button>
            <button disabled={!canSend} onClick={() => { requestDataByEmail(control.id, Array.from(sel), emails); onClose(); }} className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[12.5px] font-semibold disabled:opacity-40 enabled:hover:bg-brand-700 transition-colors cursor-pointer"><Send size={14} /> Send request</button>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}

// ── conclude footer — always visible, prominent ───────────────────────────────────
function ConcludeFooter({ control, which, suggestion, canEdit, disabled }: { control: Control; which: 'design' | 'operating'; suggestion: TrackConclusion; canEdit: boolean; disabled?: boolean }) {
  const { concludeDesign, concludeOperating, overrideDesign, overrideOperating } = useIcfr();
  const { addToast } = useToast();
  const track = control[which];
  const conclude = which === 'design' ? concludeDesign : concludeOperating;
  const override = which === 'design' ? overrideDesign : overrideOperating;
  const label = which === 'design' ? 'Design' : 'Operating effectiveness';
  const [pending, setPending] = useState<TrackConclusion | null>(null);
  if (!canEdit) return null;
  const apply = (target: TrackConclusion) => {
    conclude(control.id, target);                                  // always save the conclusion
    const contradicts = suggestion !== 'Not tested' && target !== suggestion;
    if (contradicts) setPending(target); else override(control.id, null);
    addToast({ type: 'success', title: `${label} concluded ${target.toLowerCase()}`, message: contradicts ? 'Saved — add a rationale for going against the evidence.' : 'Saved to the working paper.' });
  };
  return (
    <div className="mt-4 pt-4 border-t border-canvas-border">
      <div className="flex items-center gap-2.5 flex-wrap">
        <button disabled={disabled} onClick={() => apply('Effective')} className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-compliant-600 text-white text-[12.5px] font-semibold enabled:hover:bg-compliant-700 disabled:opacity-40 transition-colors cursor-pointer"><CheckCircle2 size={15} /> Conclude effective</button>
        <button disabled={disabled} onClick={() => apply('Ineffective')} className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg border border-risk-300 text-risk-700 text-[12.5px] font-semibold enabled:hover:bg-risk-50 disabled:opacity-40 transition-colors cursor-pointer"><XCircle size={15} /> Conclude ineffective</button>
        {suggestion !== 'Not tested' && <span className="text-[11.5px] text-ink-400 inline-flex items-center gap-1"><Scale size={12} /> Evidence suggests <b className="font-semibold text-ink-600">{suggestion}</b></span>}
      </div>
      {pending && <RationaleForm title={`Overriding the evidence — record why you concluded ${pending}`} onCancel={() => setPending(null)} buttons={[{ label: `Save rationale`, onClick: note => { override(control.id, { result: pending === 'Effective' ? 'Effective' : 'Ineffective', by: 'You · Auditor', at: 'just now', rationale: note }); setPending(null); } }]} />}
      {track.override && (
        <div className="mt-2.5 text-[11.5px] text-high-700 flex items-start gap-1.5 p-2.5 rounded-lg bg-high-50/50 border border-high-200">
          <Pencil size={12} className="mt-0.5 shrink-0" /><span><b>Conclusion overridden</b> — {track.override.rationale} <span className="text-ink-400">· {track.override.by}</span></span>
          <button onClick={() => override(control.id, null)} className="ml-auto text-ink-400 hover:text-ink-700 inline-flex items-center gap-1 cursor-pointer"><RotateCcw size={11} /> undo</button>
        </div>
      )}
    </div>
  );
}

// ── validation Q&A modal — review what the workflow asked and found ───────────────
function QAResultsModal({ title, qa, onClose }: { title: string; qa: ValidationQA[]; onClose: () => void }) {
  const passed = qa.filter(x => x.pass).length;
  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <motion.div className="modal" onClick={e => e.stopPropagation()} initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-canvas-border">
          <div className="flex items-center gap-2"><Sparkles size={16} className="text-brand-600" /><h3 className="text-[14px] font-bold text-ink-900">Ask IRA — validation results</h3></div>
          <button onClick={onClose} className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-ink-400 hover:text-ink-800 hover:bg-paper-50 cursor-pointer"><X size={16} /></button>
        </div>
        <div className="px-5 py-2.5 border-b border-canvas-border bg-paper-50/40"><p className="text-[12px] text-ink-600"><b className="text-ink-800">Validated —</b> {title}</p></div>
        <div className="px-5 py-4 space-y-3.5 max-h-[52vh] overflow-y-auto">
          {qa.map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <Tickmark result={item.pass ? 'Pass' : 'Fail'} size={18} />
              <div><div className="text-[12.5px] font-semibold text-ink-900">{item.q}</div><div className="text-[12px] text-ink-600 mt-0.5 leading-relaxed">{item.a}</div></div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-canvas-border">
          <span className="text-[11.5px] text-ink-500">{passed}/{qa.length} checks passed</span>
          <button onClick={onClose} className="h-9 px-4 rounded-lg bg-brand-600 text-white text-[12.5px] font-semibold hover:bg-brand-700 cursor-pointer">Close</button>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}

// ── design consideration row — validated by its own workflow (Q&A) + override ─────
const VALIDATE_MS = 6000;
function PointRow({ control, point, canEdit }: { control: Control; point: DesignPoint; canEdit: boolean }) {
  const { setDesignPoint, validateDesignPoint, overrideDesignPoint, removeDesignPoint } = useIcfr();
  const [over, setOver] = useState(false);
  const [validating, setValidating] = useState(false);
  const [showQA, setShowQA] = useState(false);
  const eff = pointResult(point);
  const runValidate = () => { setValidating(true); window.setTimeout(() => { validateDesignPoint(control.id, point.id); setValidating(false); }, VALIDATE_MS); };

  return (
    <div className="subcard px-3.5 py-3">
      <div className="flex items-start gap-3">
        {validating ? <span className="w-5 h-5 inline-flex items-center justify-center"><Loader2 size={15} className="animate-spin text-evidence-600" /></span> : <Tickmark result={eff} size={20} />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2"><span className="text-[12.5px] font-medium text-ink-800">{point.text}</span>{point.override && <span className="override-tag"><Pencil size={9} /> Overridden</span>}</div>
          <div className="text-[11px] text-ink-400 mt-1 inline-flex items-center gap-1.5"><WorkflowIcon size={11} /> {point.workflowName ?? 'Design walkthrough check'} · {validating ? 'validating…' : (point.workflowRunRef ?? 'not validated')}</div>
          {point.override && <div className="text-[11px] text-high-700 mt-1 flex items-start gap-1"><CornerDownRight size={11} className="mt-0.5 shrink-0" /> {point.override.rationale}</div>}
        </div>
        {canEdit && !validating && (
          <div className="flex items-center gap-1.5 shrink-0">
            {point.validation && <button onClick={() => setShowQA(true)} className="h-7 px-2.5 inline-flex items-center gap-1 rounded-md border border-canvas-border bg-canvas-elevated text-[11.5px] font-semibold text-ink-600 hover:border-brand-300 hover:text-brand-700 cursor-pointer"><ListChecks size={12} /> View results</button>}
            <button onClick={runValidate} title="Validate via workflow" className="h-7 px-2.5 inline-flex items-center gap-1 rounded-md border border-canvas-border bg-canvas-elevated text-[11.5px] font-semibold text-ink-600 hover:border-evidence-300 hover:text-evidence-700 cursor-pointer"><PlayCircle size={12} /> {point.validation ? 'Re-run' : 'Validate'}</button>
            <button onClick={() => setOver(o => !o)} title="Override" className={cn('h-7 w-7 inline-flex items-center justify-center rounded-md border cursor-pointer', point.override ? 'bg-high-50 border-high-300 text-high-700' : 'border-canvas-border bg-canvas-elevated text-ink-600 hover:border-high-300 hover:text-high-700')}><Pencil size={12} /></button>
            <button onClick={() => removeDesignPoint(control.id, point.id)} title="Remove" className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-canvas-border bg-canvas-elevated text-ink-400 hover:border-risk-300 hover:text-risk-600 cursor-pointer"><Trash2 size={12} /></button>
          </div>
        )}
        {validating && <span className="text-[11px] font-semibold text-evidence-600 shrink-0">Validating…</span>}
      </div>
      {validating && <div className="mt-2.5 ml-8 h-1.5 rounded-full bg-paper-100 overflow-hidden"><motion.div className="h-full bg-evidence-500" initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: VALIDATE_MS / 1000, ease: 'linear' }} /></div>}
      {over && (point.override
        ? <div className="mt-2 flex justify-end"><button onClick={() => { overrideDesignPoint(control.id, point.id, null); setOver(false); }} className="h-7 px-3 text-[12px] font-semibold rounded-lg border border-canvas-border text-ink-600 hover:text-ink-900 inline-flex items-center gap-1.5 cursor-pointer"><RotateCcw size={12} /> Remove override</button></div>
        : <RationaleForm title="Override this consideration — record why" onCancel={() => setOver(false)} buttons={[
            { label: 'Override · Pass', onClick: n => { overrideDesignPoint(control.id, point.id, { result: 'Pass', by: 'You · Auditor', at: 'just now', rationale: n }); setOver(false); } },
            { label: 'Override · Fail', onClick: n => { setDesignPoint(control.id, point.id, 'Fail'); overrideDesignPoint(control.id, point.id, { result: 'Fail', by: 'You · Auditor', at: 'just now', rationale: n }); setOver(false); } },
          ]} />)}
      <AnimatePresence>{showQA && point.validation && <QAResultsModal title={point.text} qa={point.validation.qa} onClose={() => setShowQA(false)} />}</AnimatePresence>
    </div>
  );
}

// ── operating attribute — its own workflow and/or self-attestation ────────────────
function AttributeRow({ control, step, canEdit, testing }: { control: Control; step: OperatingStep; canEdit: boolean; testing: boolean }) {
  const { setStepResult, overrideStep, pullStepRun, attestStep, addStepEvidence, mapStepWorkflow, setStepEvidenceMode, toggleStepAttest, runStepValidation, removeAttribute } = useIcfr();
  const [over, setOver] = useState(false);
  const [noteDraft, setNoteDraft] = useState(step.attestation?.note ?? '');
  const [validatingWf, setValidatingWf] = useState(false);
  const [showQA, setShowQA] = useState(false);
  const eff = stepResult(step);
  const att = step.attestation;
  const attestOn = step.attestEnabled ?? !!att;   // section 2 — separate toggle, default off (on if already attested)
  // section 1 — validation: AI validation is the default; can switch to a mapped workflow
  const v1: 'ai' | 'workflow' = step.evidenceMode === 'workflow' ? 'workflow' : step.evidenceMode === 'ai' ? 'ai' : (step.workflowName ? 'workflow' : 'ai');
  const busy = testing || validatingWf;
  const runAI = () => { setValidatingWf(true); window.setTimeout(() => { runStepValidation(control.id, step.id); setValidatingWf(false); }, 4000); };

  const resultBtn = (target: TestResult, label: string, Icon: typeof CheckCircle2, on: boolean, tone: string) => (
    <button onClick={() => setStepResult(control.id, step.id, target)} className={cn('h-8 px-2.5 inline-flex items-center gap-1 rounded-lg border text-[12px] font-semibold transition-colors cursor-pointer', on ? tone : 'border-canvas-border bg-canvas-elevated text-ink-600 hover:border-ink-300 hover:text-ink-900')}><Icon size={13} />{label}</button>
  );

  return (
    <div className={cn('step-row', eff === 'Fail' && 'fail', eff === 'Pass' && 'pass')}>
      <div className="flex items-start gap-3.5">
        {busy ? <span className="w-[22px] h-[22px] inline-flex items-center justify-center"><Loader2 size={16} className="animate-spin text-brand-500" /></span> : <Tickmark result={eff} size={22} />}
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
            {resultBtn('Pass', 'Pass', CheckCircle2, eff === 'Pass', 'bg-compliant-50 border-compliant-300 text-compliant-700')}
            {resultBtn('Fail', 'Fail', XCircle, eff === 'Fail', 'bg-risk-50 border-risk-300 text-risk-700')}
            <button onClick={() => setOver(o => !o)} title="Override result with rationale" className={cn('h-8 w-8 inline-flex items-center justify-center rounded-lg border cursor-pointer', step.override ? 'bg-high-50 border-high-300 text-high-700' : 'border-canvas-border bg-canvas-elevated text-ink-600 hover:border-high-300 hover:text-high-700')}><Pencil size={13} /></button>
            <button onClick={() => removeAttribute(control.id, step.id)} title="Remove attribute" className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-canvas-border bg-canvas-elevated text-ink-400 hover:border-risk-300 hover:text-risk-600 cursor-pointer"><Trash2 size={13} /></button>
          </div>
        )}
      </div>

      {/* evidence — Section 1: validation (AI validation default / workflow) · Section 2: self-attest (separate) */}
      <div className="mt-3 ml-[36px] space-y-2">
        <div className="rounded-lg border border-canvas-border px-3 py-2.5">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] font-bold text-ink-600">Validation</span>
            {canEdit && (
              <div className="inline-flex items-center p-0.5 rounded-md border border-canvas-border bg-paper-50/60">
                <button disabled={busy} onClick={() => setStepEvidenceMode(control.id, step.id, 'ai')} className={cn('h-6 px-2 rounded text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed', v1 === 'ai' ? 'bg-canvas-elevated text-brand-700 ring-1 ring-canvas-border' : 'text-ink-500 hover:text-ink-800')}><Sparkles size={11} /> AI validation</button>
                <button disabled={busy} onClick={() => setStepEvidenceMode(control.id, step.id, 'workflow')} className={cn('h-6 px-2 rounded text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed', v1 === 'workflow' ? 'bg-canvas-elevated text-brand-700 ring-1 ring-canvas-border' : 'text-ink-500 hover:text-ink-800')}><WorkflowIcon size={11} /> Workflow</button>
              </div>
            )}
          </div>
          {v1 === 'ai' ? (
            <div className="rounded-md bg-brand-50/30 border border-brand-100 px-2.5 py-2 flex items-center gap-2.5 flex-wrap">
              <Sparkles size={14} className="text-brand-600 shrink-0" />
              <span className="text-[11.5px] text-ink-600 flex-1 min-w-0">Generic validation by Ask IRA · <span className="font-mono text-[10.5px] text-ink-400">{validatingWf ? 'validating…' : (step.validation ? (step.workflowRunRef ?? 'validated') : 'not run yet')}</span></span>
              {canEdit && (validatingWf
                ? <span className="text-[11.5px] font-semibold text-brand-600 inline-flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" /> Validating…</span>
                : <button onClick={runAI} className="h-7 px-2.5 rounded-md bg-brand-600 text-white text-[11.5px] font-semibold hover:bg-brand-700 inline-flex items-center gap-1 cursor-pointer"><Sparkles size={12} /> {step.validation ? 'Re-run' : 'Run AI validation'}</button>)}
              {step.validation && <button onClick={() => setShowQA(true)} className="text-[11.5px] font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800 inline-flex items-center gap-1 cursor-pointer"><ListChecks size={12} /> View results</button>}
            </div>
          ) : (
            step.workflowName ? (
              <div className="rounded-md border border-evidence-100 bg-evidence-50/40 px-2.5 py-2 flex items-center gap-2.5">
                <Cpu size={14} className="text-evidence-700 shrink-0" />
                <div className="min-w-0 flex-1"><div className="text-[12px] font-semibold text-ink-800 truncate">{step.workflowName}</div><div className="text-[10.5px] font-mono text-ink-400">{step.workflowRunRef ?? 'not run yet'}</div></div>
                {canEdit && !busy && <>
                  <button onClick={() => pullStepRun(control.id, step.id)} className="h-7 px-2.5 rounded-md bg-evidence-600 text-white text-[11.5px] font-semibold hover:bg-evidence-700 inline-flex items-center gap-1 cursor-pointer"><WorkflowIcon size={12} /> {step.workflowRunRef ? 'Re-pull' : 'Pull run'}</button>
                  <Dropdown trigger={<><Link2 size={12} /> Remap</>}>{close => WORKFLOW_LIBRARY.map(w => <button key={w} className={menuItem} onClick={() => { mapStepWorkflow(control.id, step.id, w); close(); }}><WorkflowIcon size={12} className="text-evidence-600" />{w}</button>)}</Dropdown>
                </>}
              </div>
            ) : canEdit ? (
              <Dropdown trigger={<><WorkflowIcon size={12} className="text-evidence-600" /> Map a workflow</>}>{close => WORKFLOW_LIBRARY.map(w => <button key={w} className={menuItem} onClick={() => { mapStepWorkflow(control.id, step.id, w); close(); }}><WorkflowIcon size={12} className="text-evidence-600" />{w}</button>)}</Dropdown>
            ) : <span className="text-[11.5px] text-ink-400">No workflow mapped</span>
          )}
        </div>

        <div className="rounded-lg border border-canvas-border px-3 py-2.5">
          <div className="flex items-center gap-2 text-[11px] font-bold text-ink-600"><Hand size={12} /> Self-attestation {att && <span className="font-normal text-ink-400">· {att.by}, {att.at}</span>}
            {canEdit && <span className="ml-auto"><Toggle on={attestOn} onChange={v => toggleStepAttest(control.id, step.id, v)} label="Toggle self-attestation" /></span>}
          </div>
          {attestOn && <>
            {att?.note && <p className="text-[12px] text-ink-700 mt-2 italic">“{att.note}”</p>}
            {att && att.evidence.length > 0 && <div className="flex flex-wrap gap-1.5 mt-2">{att.evidence.map(f => <span key={f.id} className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-ink-600 bg-paper-50 border border-canvas-border rounded-md px-1.5 h-[20px]"><Paperclip size={9} />{f.name}</span>)}</div>}
            {canEdit && (
              <div className="mt-2">
                <textarea value={noteDraft} onChange={e => setNoteDraft(e.target.value)} rows={2} placeholder="Describe how this attribute is satisfied — recorded as your attestation." className="w-full text-[12px] rounded-lg border border-canvas-border bg-canvas-elevated px-2.5 py-2 text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-200 resize-none" />
                <div className="flex items-center gap-2 mt-1.5">
                  <button disabled={!noteDraft.trim()} onClick={() => attestStep(control.id, step.id, noteDraft.trim())} className="h-7 px-2.5 rounded-md bg-brand-600 text-white text-[11.5px] font-semibold disabled:opacity-40 enabled:hover:bg-brand-700 cursor-pointer">Save attestation</button>
                  <button onClick={() => addStepEvidence(control.id, step.id, `evidence-${step.code}.pdf`)} className="h-7 px-2.5 rounded-md border border-canvas-border bg-canvas-elevated text-ink-600 text-[11.5px] font-semibold hover:border-brand-300 hover:text-brand-700 inline-flex items-center gap-1 cursor-pointer"><Upload size={11} /> Attach evidence</button>
                </div>
              </div>
            )}
          </>}
        </div>
      </div>

      {over && (step.override
        ? <div className="mt-2 flex justify-end"><button onClick={() => { overrideStep(control.id, step.id, null); setOver(false); }} className="h-7 px-3 text-[12px] font-semibold rounded-lg border border-canvas-border text-ink-600 hover:text-ink-900 inline-flex items-center gap-1.5 cursor-pointer"><RotateCcw size={12} /> Remove override</button></div>
        : <RationaleForm title="Override this result — record why" onCancel={() => setOver(false)} buttons={[
            { label: 'Override · Pass', onClick: n => { overrideStep(control.id, step.id, { result: 'Pass', by: 'You · Auditor', at: 'just now', rationale: n }); setOver(false); } },
            { label: 'Override · Fail', onClick: n => { overrideStep(control.id, step.id, { result: 'Fail', by: 'You · Auditor', at: 'just now', rationale: n }); setOver(false); } },
          ]} />)}
      <AnimatePresence>{showQA && step.validation && <QAResultsModal title={step.description} qa={step.validation.qa} onClose={() => setShowQA(false)} />}</AnimatePresence>
    </div>
  );
}

// ── design section (TOD) ──────────────────────────────────────────────────────────
function DesignSection({ control, canEdit }: { control: Control; canEdit: boolean }) {
  const { setDocStatus, addDesignDoc, removeDesignDoc, addDesignPoint, validateDesignPoint } = useIcfr();
  const d = control.design; const prog = designProgress(control);
  const [modal, setModal] = useState(false);
  const [newPoint, setNewPoint] = useState('');
  const [addingPoint, setAddingPoint] = useState(false);
  const [validatingAll, setValidatingAll] = useState(false);
  const runValidateAll = () => { setValidatingAll(true); window.setTimeout(() => { control.design.points.forEach(p => validateDesignPoint(control.id, p.id)); setValidatingAll(false); }, VALIDATE_MS); };
  const missing = d.documents.filter(x => x.status !== 'Received');
  const suggestion: TrackConclusion = d.documents.length === 0 && d.points.length === 0 ? 'Not tested'
    : missing.length > 0 || d.points.some(p => pointResult(p) === 'Fail') ? 'Ineffective'
    : d.points.length > 0 && d.points.every(p => pointResult(p) === 'Pass') ? 'Effective' : 'Not tested';
  const empty = d.documents.length === 0 && d.points.length === 0;

  return (
    <div className="p-5">
      {empty ? (
        <EmptyState icon={<FileText size={18} />} title="Test of design isn’t set up yet" hint="Add the design documents you need (process narrative, flowchart, walkthrough) and the design considerations to assess. You can request the documents from the control owner by email.">
          {canEdit && <>
            <Dropdown trigger={<><Plus size={13} /> Add document</>}>{close => DESIGN_DOC_KINDS.map(k => <button key={k} className={menuItem} onClick={() => { addDesignDoc(control.id, k as DesignDocKind); close(); }}><FileText size={12} className="text-brand-600" />{k}</button>)}</Dropdown>
            <button onClick={() => setModal(true)} className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[12px] font-semibold text-ink-700 hover:border-ink-300 cursor-pointer"><Mail size={13} /> Request data</button>
          </>}
        </EmptyState>
      ) : (
        <>
          {/* documents */}
          <div className="flex items-center justify-between mb-2.5">
            <h4 className="text-[12.5px] font-bold text-ink-700 inline-flex items-center gap-1.5"><FileText size={14} /> Required design documents</h4>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-ink-400 tabular-nums">{prog.docsReceived}/{prog.docsTotal} received</span>
              {canEdit && <button onClick={() => setModal(true)} className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md border border-canvas-border bg-canvas-elevated text-[11.5px] font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-700 cursor-pointer"><Mail size={12} /> Request data</button>}
              {canEdit && <Dropdown trigger={<><Plus size={12} /> Add</>}>{close => DESIGN_DOC_KINDS.map(k => <button key={k} className={menuItem} onClick={() => { addDesignDoc(control.id, k as DesignDocKind); close(); }}><FileText size={12} className="text-brand-600" />{k}</button>)}</Dropdown>}
            </div>
          </div>
          {d.documents.length === 0 ? <p className="text-[12px] text-ink-400 mb-5">No documents yet — add one or request data.</p> : (
            <div className="mb-5 space-y-1.5">
              {d.documents.map(doc => (
                <div key={doc.id} className="doc-row">
                  <FileCheck2 size={15} className={cn('shrink-0', DOC_TONE[doc.status])} />
                  <div className="min-w-0 flex-1"><div className="text-[12px] font-semibold text-ink-800 truncate">{doc.kind}</div><div className="text-[11px] text-ink-400 truncate">{doc.name}{doc.uploadedBy ? ` · ${doc.uploadedBy}, ${doc.at}` : ''}</div></div>
                  <Pill tone={doc.status === 'Received' ? 'compliant' : doc.status === 'Requested' ? 'mitigated' : 'draft'}>{doc.status}</Pill>
                  {canEdit && <div className="flex items-center gap-1">
                    {doc.status !== 'Received' && <button onClick={() => setDocStatus(control.id, doc.id, 'Received')} className="h-7 px-2.5 text-[11.5px] font-semibold rounded-md border border-canvas-border bg-canvas-elevated text-ink-600 hover:text-compliant-700 hover:border-compliant-300 inline-flex items-center gap-1 cursor-pointer"><Upload size={11} /> Attach</button>}
                    <button onClick={() => removeDesignDoc(control.id, doc.id)} title="Remove" className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-canvas-border bg-canvas-elevated text-ink-400 hover:border-risk-300 hover:text-risk-600 cursor-pointer"><Trash2 size={12} /></button>
                  </div>}
                </div>
              ))}
            </div>
          )}

          {/* considerations */}
          <div className="flex items-center justify-between mb-2.5 gap-2 flex-wrap">
            <h4 className="text-[12.5px] font-bold text-ink-700 inline-flex items-center gap-1.5"><ClipboardCheck size={14} /> Design considerations <span className="font-normal text-ink-400">· each validated by a workflow</span></h4>
            <div className="flex items-center gap-2">
              {canEdit && d.points.length > 0 && <button disabled={validatingAll} onClick={runValidateAll} className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md bg-evidence-600 text-white text-[11.5px] font-semibold enabled:hover:bg-evidence-700 disabled:opacity-70 cursor-pointer">{validatingAll ? <><Loader2 size={12} className="animate-spin" /> Validating…</> : <><PlayCircle size={12} /> Validate all</>}</button>}
              {canEdit && <button onClick={() => setAddingPoint(a => !a)} className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md border border-canvas-border bg-canvas-elevated text-[11.5px] font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-700 cursor-pointer"><Plus size={12} /> Add</button>}
            </div>
          </div>
          {addingPoint && (
            <div className="flex items-center gap-2 mb-2.5">
              <input autoFocus value={newPoint} onChange={e => setNewPoint(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newPoint.trim()) { addDesignPoint(control.id, newPoint.trim()); setNewPoint(''); setAddingPoint(false); } }} placeholder="e.g. Reviewer is independent of the preparer" className="flex-1 h-9 px-3 rounded-lg border border-canvas-border bg-canvas-elevated text-[12.5px] focus:outline-none focus:ring-2 focus:ring-brand-200" />
              <button disabled={!newPoint.trim()} onClick={() => { addDesignPoint(control.id, newPoint.trim()); setNewPoint(''); setAddingPoint(false); }} className="h-9 px-3 rounded-lg bg-brand-600 text-white text-[12px] font-semibold disabled:opacity-40 cursor-pointer">Add</button>
            </div>
          )}
          {d.points.length === 0 ? <p className="text-[12px] text-ink-400 mb-2">No considerations yet — add the design points you’ll assess in the walkthrough.</p> : (
            <div className="space-y-2 mb-2">{d.points.map(p => <PointRow key={p.id} control={control} point={p} canEdit={canEdit} />)}</div>
          )}

          {missing.length > 0 && <div className="mt-3 text-[11.5px] text-mitigated-700 bg-mitigated-50/60 border border-mitigated-200 rounded-lg px-3 py-2 inline-flex items-center gap-1.5"><AlertTriangle size={13} /> {missing.length} document{missing.length > 1 ? 's' : ''} outstanding — design can’t be concluded effective without them (override to proceed).</div>}
          <ConcludeFooter control={control} which="design" suggestion={suggestion} canEdit={canEdit} />
        </>
      )}
      <AnimatePresence>{modal && <RequestDataModal control={control} onClose={() => setModal(false)} />}</AnimatePresence>
    </div>
  );
}

// ── operating section (TOE) — locked until design effective ───────────────────────
function OperatingSection({ control, canEdit, locked }: { control: Control; canEdit: boolean; locked: boolean }) {
  const { setPopulation, setSampling, addAttribute, testAllAttributes } = useIcfr();
  const o = control.operating; const prog = operatingProgress(control);
  const anyFail = o.steps.some(s => stepResult(s) === 'Fail');
  const allTested = o.steps.length > 0 && o.steps.every(s => stepResult(s) !== 'Not tested');
  const suggestion: TrackConclusion = anyFail ? 'Ineffective' : allTested ? 'Effective' : 'Not tested';
  const [sampleSize, setSampleSize] = useState(25);
  const [uploading, setUploading] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [newAttr, setNewAttr] = useState('');
  const [addingAttr, setAddingAttr] = useState(false);
  const wfCount = o.steps.filter(s => s.workflowName).length;
  const attCount = o.steps.filter(s => s.attestEnabled || s.attestation).length;

  const uploadPop = () => { setUploading(true); window.setTimeout(() => { setPopulation(control.id, { source: 'SAP — full-period extract', count: 2640, tieOut: 'Agreed to GL control account', evidence: [{ id: 'ev', name: 'population.xlsx', kind: 'XLSX', uploadedBy: 'You · Auditor', uploadedAt: 'just now' }] }); setUploading(false); }, 1800); };
  const drawSample = () => { setDrawing(true); window.setTimeout(() => { const s: Sampling = { basis: `${sampleSize} items — judgment documented (handbook: no fixed minimum).`, method: 'Random', size: sampleSize, samples: Array.from({ length: sampleSize }, (_, i) => ({ id: `s${i}`, ref: `#${1000 + i}`, result: 'Not tested' })) }; setSampling(control.id, s); setDrawing(false); }, 3000); };
  const runAll = () => { setTesting(true); window.setTimeout(() => { testAllAttributes(control.id); setTesting(false); }, 2400); };

  if (locked) {
    return (
      <div className="p-5">
        <EmptyState icon={<Lock size={18} />} title="Operating effectiveness is locked" hint="Conclude the Test of Design as effective to unlock operating effectiveness testing. A control that isn’t designed effectively isn’t tested for operation.">
          <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-500"><span>Design is currently</span><TrackPill c={trackResult(control.design)} /></span>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="p-5">
      {/* optional sampling context */}
      {o.method === 'Manual' && (
        <div className="mb-5 grid grid-cols-2 gap-3">
          <div className="subcard p-3.5">
            <div className="text-[11.5px] font-bold text-ink-700 mb-1.5 inline-flex items-center gap-1.5"><Upload size={12} /> Population <span className="font-normal text-ink-400">· optional</span></div>
            {o.population ? (
              <div className="text-[12px] text-ink-700"><div className="font-semibold tabular-nums text-[15px] text-ink-900">{o.population.count.toLocaleString()}</div><div className="text-[11px] text-ink-400">{o.population.source}</div><div className="text-[11px] text-compliant-700 mt-0.5 inline-flex items-center gap-1"><CheckCircle2 size={11} /> {o.population.tieOut}</div></div>
            ) : canEdit ? <button disabled={uploading} onClick={uploadPop} className="h-9 px-3 text-[12px] font-semibold rounded-lg border border-dashed border-canvas-border text-ink-600 enabled:hover:text-brand-700 enabled:hover:border-brand-300 inline-flex items-center gap-1.5 cursor-pointer w-full justify-center disabled:opacity-70">{uploading ? <><Loader2 size={13} className="animate-spin" /> Uploading…</> : <><Upload size={13} /> Upload population</>}</button> : <span className="text-[11.5px] text-ink-400">Not uploaded</span>}
          </div>
          <div className="subcard p-3.5">
            <div className="text-[11.5px] font-bold text-ink-700 mb-1.5 inline-flex items-center gap-1.5"><FlaskConical size={12} /> Sample <span className="font-normal text-ink-400">· optional</span></div>
            {o.sampling ? (
              <div className="text-[12px] text-ink-700"><div className="font-semibold tabular-nums text-[15px] text-ink-900">{o.sampling.size} items</div><div className="text-[11px] text-ink-400">{o.sampling.method} · {o.sampling.basis}</div></div>
            ) : canEdit ? (
              drawing ? <div className="h-9 inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand-600"><Loader2 size={13} className="animate-spin" /> Processing sample…</div> : (
                <div className="flex items-center gap-2">
                  <input type="number" min={1} max={60} value={sampleSize} onChange={e => setSampleSize(Math.max(1, +e.target.value || 1))} className="h-9 w-16 px-2 rounded-lg border border-canvas-border text-[12.5px] focus:outline-none focus:ring-2 focus:ring-brand-200" />
                  <button disabled={!o.population} onClick={drawSample} className="h-9 px-3 text-[12px] font-semibold rounded-lg border border-canvas-border bg-canvas-elevated text-ink-600 enabled:hover:text-brand-700 enabled:hover:border-brand-300 disabled:opacity-40 inline-flex items-center gap-1.5 cursor-pointer"><FlaskConical size={13} /> Draw</button>
                </div>
              )
            ) : <span className="text-[11.5px] text-ink-400">Not drawn</span>}
          </div>
        </div>
      )}

      {/* attributes */}
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <h4 className="text-[12.5px] font-bold text-ink-700 inline-flex items-center gap-1.5"><ClipboardCheck size={14} /> Test attributes <span className="font-normal text-ink-400">· each evidenced independently</span></h4>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-ink-400 tabular-nums hidden md:inline">{wfCount} workflow · {attCount} attested · {prog.passed} pass · {prog.failed} fail</span>
          {canEdit && o.steps.length > 0 && <button disabled={testing} onClick={runAll} className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg bg-evidence-600 text-white text-[12px] font-semibold enabled:hover:bg-evidence-700 disabled:opacity-70 transition-colors cursor-pointer">{testing ? <><Loader2 size={13} className="animate-spin" /> Testing…</> : <><PlayCircle size={14} /> Test attributes</>}</button>}
          {canEdit && <button onClick={() => setAddingAttr(a => !a)} className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[12px] font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-700 cursor-pointer"><Plus size={13} /> Add</button>}
        </div>
      </div>
      {addingAttr && (
        <div className="flex items-center gap-2 mb-3">
          <input autoFocus value={newAttr} onChange={e => setNewAttr(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newAttr.trim()) { addAttribute(control.id, newAttr.trim()); setNewAttr(''); setAddingAttr(false); } }} placeholder="e.g. Approval evidenced before the transaction posts" className="flex-1 h-9 px-3 rounded-lg border border-canvas-border bg-canvas-elevated text-[12.5px] focus:outline-none focus:ring-2 focus:ring-brand-200" />
          <button disabled={!newAttr.trim()} onClick={() => { addAttribute(control.id, newAttr.trim()); setNewAttr(''); setAddingAttr(false); }} className="h-9 px-3 rounded-lg bg-brand-600 text-white text-[12px] font-semibold disabled:opacity-40 cursor-pointer">Add</button>
        </div>
      )}
      {o.steps.length === 0 ? (
        <EmptyState icon={<ClipboardCheck size={18} />} title="No test attributes yet" hint="Add the attributes that prove the control operated. Each attribute is evidenced on its own — map a workflow to automate it, or toggle self-attestation for manual evidence.">
          {canEdit && <button onClick={() => setAddingAttr(true)} className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[12px] font-semibold hover:bg-brand-700 cursor-pointer"><Plus size={13} /> Add the first attribute</button>}
        </EmptyState>
      ) : (
        <div className="space-y-3 mb-1">{o.steps.map(s => <AttributeRow key={s.id} control={control} step={s} canEdit={canEdit} testing={testing && stepResult(s) === 'Not tested'} />)}</div>
      )}

      {o.steps.length > 0 && <ConcludeFooter control={control} which="operating" suggestion={suggestion} canEdit={canEdit} />}
    </div>
  );
}

// ── vertical stepper step ─────────────────────────────────────────────────────────
function VStep({ n, title, subtitle, status, locked, right, children }: { n: number; title: string; subtitle: string; status: TrackConclusion; locked?: boolean; right?: React.ReactNode; children: React.ReactNode }) {
  const nodeClass = locked ? 'locked' : status === 'Effective' ? 'done' : status === 'Ineffective' ? 'fail' : 'active';
  const concluded = status === 'Effective' || status === 'Ineffective';
  const [flash, setFlash] = useState(false);
  const prev = useRef(status);
  useEffect(() => {
    if (status !== prev.current && (status === 'Effective' || status === 'Ineffective')) {
      setFlash(true);
      const t = window.setTimeout(() => setFlash(false), 1500);
      prev.current = status;
      return () => window.clearTimeout(t);
    }
    prev.current = status;
  }, [status]);

  return (
    <motion.div className="vstep" variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}>
      <div className="vstep-rail" />
      <div className={cn('vstep-node', nodeClass)}>{locked ? <Lock size={15} /> : status === 'Effective' ? <Check size={17} strokeWidth={3} /> : status === 'Ineffective' ? <X size={16} strokeWidth={3} /> : n}</div>
      <div className={cn('panel relative', locked && 'panel-locked')}>
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-canvas-border">
          <div><h3 className="text-[15px] font-bold text-ink-900">{title}</h3><p className="text-[11.5px] text-ink-500 mt-0.5 max-w-[520px]">{subtitle}</p></div>
          <div className="flex items-center gap-2 shrink-0">{right}{concluded ? <Stamp result={status as 'Effective' | 'Ineffective'} /> : <TrackPill c={status} />}</div>
        </div>
        {children}
        <AnimatePresence>{flash && concluded && (
          <motion.div className="stamp-flash" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Stamp result={status as 'Effective' | 'Ineffective'} size="lg" />
          </motion.div>
        )}</AnimatePresence>
      </div>
    </motion.div>
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
    <aside className="panel sticky top-20 self-start max-h-[calc(100vh-7rem)] flex flex-col">
      <div className="flex items-center gap-2 px-4 pt-4 pb-2.5"><MessageSquare size={15} className="text-brand-600" /><h3 className="text-[14px] font-bold text-ink-900">Discussion</h3></div>
      <div className="px-3 flex items-center gap-1">
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
      <div className="p-3 border-t border-canvas-border">
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
  const designResult = trackResult(control.design);
  const opResult = trackResult(control.operating);
  const toeLocked = designResult !== 'Effective';

  return (
    <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.03 } } }}>
      <button onClick={back} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-500 hover:text-brand-700 mb-3 cursor-pointer transition-colors"><ArrowLeft size={15} /> Control register</button>

      {/* leadsheet header */}
      <motion.div className="leadsheet mb-5" variants={{ hidden: { opacity: 0, y: 14, scale: 0.99 }, show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } } }}>
        <div className="leadsheet-head">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                {control.isKey && <Pill tone="mitigated">Key control</Pill>}
                <NatureChip nature={control.nature} /><Pill tone="draft">{control.type}</Pill><Pill tone="draft">{control.frequency}</Pill>
                <span className="text-[11px] text-ink-400 font-mono">{control.id}</span>
              </div>
              <h1 className="leadsheet-title text-[20px] text-ink-900 leading-snug max-w-[640px]">{control.description}</h1>
              <p className="text-[12.5px] text-ink-500 mt-1.5 max-w-[680px]"><b className="text-ink-700 font-semibold">Precision —</b> {control.precision}</p>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-3 text-[11.5px] text-ink-500">
                <span><span className="text-ink-400">Process</span> · {control.process} / {control.subProcess}</span>
                <span className="inline-flex items-center gap-1"><span className="text-ink-400">Owner</span> · <b className="font-semibold text-ink-700">{control.owner}</b></span>
                <span><span className="text-ink-400">Risk {control.riskId}</span> · {control.riskDescription}</span>
                <span><span className="text-ink-400">Assertions</span> · {control.assertions.join(', ')}</span>
              </div>
            </div>
            <div className="shrink-0 flex flex-col items-end gap-2">
              <div className="leadsheet-stamp">W/P<br />{control.wpRef}</div>
              <CourtBadge court={courtFor(control, eng.tasks)} fromRole={role} />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-3.5 pt-3 border-t border-canvas-border flex-wrap">
            <span className="text-[11.5px] font-semibold text-ink-400 uppercase tracking-wide">Conclusion</span>
            <ConclusionPill c={concl} />
            <span className="text-[11.5px] text-ink-400 inline-flex items-center gap-1.5"><Tickmark result={designResult === 'Effective' ? 'Pass' : designResult === 'Ineffective' ? 'Fail' : 'Not tested'} size={14} /> Design {designResult}</span>
            <ChevronRight size={13} className="text-ink-300" />
            <span className="text-[11.5px] text-ink-400 inline-flex items-center gap-1.5"><Tickmark result={opResult === 'Effective' ? 'Pass' : opResult === 'Ineffective' ? 'Fail' : 'Not tested'} size={14} /> Operating {toeLocked ? 'locked' : opResult}</span>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => downloadControlWorkingPaper(eng, control)} className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border border-canvas-border text-[12px] font-semibold text-ink-600 hover:text-ink-900 hover:border-ink-300 transition-colors cursor-pointer"><Download size={13} /> Working paper</button>
              {!canEdit && <span className="text-[11px] text-ink-400 inline-flex items-center gap-1"><Lock size={12} /> {role} · read-only</span>}
            </div>
          </div>
        </div>
      </motion.div>

      {/* stepper + discussion */}
      <div className="grid grid-cols-[minmax(0,1fr)_360px] gap-5 items-start">
        <motion.div className="vstepper" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1, delayChildren: 0.08 } } }}>
          <VStep n={1} title="Test of design" subtitle="Is the control designed to prevent or detect the risk? Grounded in the documents and walkthrough — each consideration validated by a workflow." status={designResult}>
            <DesignSection control={control} canEdit={canEdit} />
          </VStep>
          <VStep n={2} title="Test of operating effectiveness" subtitle="Did the control operate as designed across the period? Each attribute is evidenced on its own — by its workflow, or self-attested." status={toeLocked ? 'Not tested' : opResult} locked={toeLocked}
            right={toeLocked ? <span className="text-[11px] font-semibold text-ink-400 inline-flex items-center gap-1"><Lock size={11} /> Unlocks after design</span> : undefined}>
            <OperatingSection control={control} canEdit={canEdit} locked={toeLocked} />
          </VStep>
          {concl === 'Ineffective' && (
            <motion.div variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }} className="ml-[54px] rounded-xl border border-risk-200 bg-risk-50/40 p-4 mt-1">
              <div className="flex items-center gap-2 mb-1"><AlertTriangle size={15} className="text-risk-700" /><h3 className="text-[13px] font-bold text-risk-700">Deficiency raised</h3></div>
              <p className="text-[12px] text-ink-600">This control concluded ineffective. Assess severity (likelihood × magnitude) and remediation in <button onClick={() => setView('deficiencies')} className="font-semibold text-risk-700 hover:underline inline-flex items-center gap-0.5">Deficiencies <ChevronRight size={12} /></button>.</p>
            </motion.div>
          )}
        </motion.div>
        <motion.div variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}><DiscussionRail control={control} /></motion.div>
      </div>
    </motion.div>
  );
}
