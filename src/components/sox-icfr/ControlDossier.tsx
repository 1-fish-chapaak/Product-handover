import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText, Upload, MessageSquare, Workflow as WorkflowIcon, Hand, AlertTriangle,
  Send, Lock, ClipboardCheck, FileCheck2, FlaskConical, CheckCircle2, XCircle,
  CornerDownRight, Pencil, RotateCcw, Cpu, ChevronRight, Scale, Paperclip, Plus, Trash2,
  Mail, X, Loader2, ChevronDown, Check, PlayCircle, Link2, ListChecks, Gavel, UserCheck, History, FileUp, ArrowLeft,
} from 'lucide-react';
import { useIcfr } from './store';
import { useAuditLog } from '../../context/AdminDataContext';
import {
  controlConclusion, courtFor, designCompleteness, discussionsFor, isControlLocked, operatingProgress,
  sampleSizeGuide, trackResult, pointResult, stepResult,
} from './helpers';
import { programmeFor } from './auditScope';
import { PROGRAMMES } from '../audit/sox-testing/soxTestingData';
import { ConclusionPill, CourtBadge, NatureChip, TrackPill, Tickmark, Stamp, RagStrip, type RagMeterDef } from './parts';
import { Pill } from '../shared/StatusBadge';
import { useToast } from '../shared/Toast';
import { Sparkles, FileSpreadsheet } from 'lucide-react';
import WorkingPaperModal from './WorkingPaperModal';
import { cn } from '../../lib/cn';
import { DESIGN_DOC_KINDS } from './types';
import { sampleRefs } from './mockData';
import type {
  Control, DesignDoc, DesignDocKind, DesignPoint, DiscussionAnchor, DocStatus, OperatingStep,
  Role, Sampling, TestResult, TrackConclusion, ValidationResult,
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
      <div className="text-[0.71875rem] font-semibold text-high-700 mb-1.5 flex items-center gap-1.5"><Pencil size={12} /> {title}</div>
      <textarea autoFocus value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Record your rationale — retained in the working paper." className="w-full text-[0.75rem] rounded-lg border border-canvas-border bg-canvas-elevated px-2.5 py-2 text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-high-200 resize-none" />
      <div className="flex items-center justify-end gap-2 mt-2">
        <button onClick={onCancel} className="h-7 px-2.5 text-[0.75rem] font-semibold text-ink-500 hover:text-ink-800 cursor-pointer">Cancel</button>
        {buttons.map(b => <button key={b.label} disabled={!note.trim()} onClick={() => b.onClick(note.trim())} className="h-7 px-3 text-[0.75rem] font-semibold rounded-lg bg-high-600 text-white disabled:opacity-40 enabled:hover:bg-high-700 transition-colors cursor-pointer">{b.label}</button>)}
      </div>
    </motion.div>
  );
}

function EmptyState({ icon, title, hint, children }: { icon: React.ReactNode; title: string; hint: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-canvas-border bg-paper-50/30 px-5 py-7 text-center">
      <div className="w-10 h-10 rounded-xl bg-canvas-elevated border border-canvas-border flex items-center justify-center mx-auto mb-2.5 text-ink-400">{icon}</div>
      <div className="text-[0.8125rem] font-semibold text-ink-800">{title}</div>
      <p className="text-[0.75rem] text-ink-500 mt-0.5 max-w-[360px] mx-auto">{hint}</p>
      {children && <div className="mt-3 flex items-center justify-center gap-2">{children}</div>}
    </div>
  );
}

/** The menu is portalled to the body and positioned against the trigger, so a
 *  card's own bounds can never clip it — it opens over the page, and flips
 *  above the button when there isn't room below. */
function Dropdown({ trigger, children }: { trigger: React.ReactNode; children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ y: number; right: number; flip: boolean } | null>(null);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (!r) return;
      const MENU_H = 272;                     // max-h-64 + padding, the worst case
      const below = window.innerHeight - r.bottom;
      const flip = below < MENU_H && r.top > below;
      setPos({
        y: flip ? window.innerHeight - r.top + 6 : r.bottom + 6,
        right: window.innerWidth - r.right,
        flip,
      });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => { window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place); };
  }, [open]);

  return (
    <div className="relative">
      <button ref={btnRef} onClick={() => setOpen(o => !o)} className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.75rem] font-semibold text-ink-700 hover:border-ink-300 transition-colors cursor-pointer">{trigger}<ChevronDown size={13} className="text-ink-400" /></button>
      {createPortal(
        <AnimatePresence>
          {open && pos && (
            <>
              {/* below the modal layer (z-50) so a dialog still wins */}
              <div className="fixed inset-0 z-[45]" onClick={() => setOpen(false)} />
              <motion.div
                initial={{ opacity: 0, y: pos.flip ? 4 : -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: pos.flip ? 4 : -4 }}
                style={{ position: 'fixed', right: pos.right, ...(pos.flip ? { bottom: pos.y } : { top: pos.y }) }}
                className="z-[46] w-56 max-h-64 overflow-y-auto rounded-xl border border-canvas-border bg-canvas-elevated shadow-[0_16px_40px_-16px_rgba(15,8,30,.4)] p-1">
                {children(() => setOpen(false))}
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}
const menuItem = 'w-full text-left px-2.5 py-1.5 rounded-lg text-[0.78125rem] text-ink-700 hover:bg-paper-50 cursor-pointer flex items-center gap-2';

// ── request-data modal (TOD) ──────────────────────────────────────────────────────
function RequestDataModal({ control, onClose }: { control: Control; onClose: () => void }) {
  const { requestDataByEmail } = useIcfr();
  const logEvent = useAuditLog();
  const { addToast } = useToast();
  const [sel, setSel] = useState<Set<string>>(() => new Set(control.design.documents.filter(d => d.status !== 'Received').map(d => d.id)));
  const [emails, setEmails] = useState<string[]>(['controls.owner@airindiaexpress.in']);
  const [draft, setDraft] = useState('');
  const addEmail = () => { const e = draft.trim().replace(/,$/, ''); if (e && !emails.includes(e)) setEmails([...emails, e]); setDraft(''); };
  const toggle = (id: string) => setSel(p => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const canSend = sel.size > 0 && emails.length > 0;
  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <motion.div className="modal" onClick={e => e.stopPropagation()} initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-canvas-border">
          <div className="flex items-center gap-2"><Mail size={16} className="text-brand-600" /><h3 className="text-[0.875rem] font-bold text-ink-900">Request design data</h3></div>
          <button onClick={onClose} className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-ink-400 hover:text-ink-800 hover:bg-paper-50 cursor-pointer"><X size={16} /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <div className="text-[0.6875rem] font-bold uppercase tracking-wide text-ink-400 mb-2">Documents to request</div>
            <div className="space-y-1.5">
              {control.design.documents.length === 0 && <p className="text-[0.75rem] text-ink-400">No documents defined yet — add documents to the design track first.</p>}
              {control.design.documents.map(d => {
                const on = sel.has(d.id);
                return (
                  <button key={d.id} onClick={() => toggle(d.id)} className={cn('w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-colors cursor-pointer', on ? 'border-brand-300 bg-brand-50/50' : 'border-canvas-border hover:border-ink-300')}>
                    <span className={cn('w-[18px] h-[18px] rounded-sm border flex items-center justify-center shrink-0', on ? 'bg-brand-600 border-brand-600 text-white' : 'border-ink-300')}>{on && <Check size={12} strokeWidth={3} />}</span>
                    <span className="min-w-0 flex-1"><span className="text-[0.78125rem] font-semibold text-ink-800">{d.kind}</span><span className="text-[0.6875rem] text-ink-400 ml-2">{d.status}</span></span>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="text-[0.6875rem] font-bold uppercase tracking-wide text-ink-400 mb-2">Send to</div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {emails.map(e => <span key={e} className="inline-flex items-center gap-1.5 h-7 pl-2.5 pr-1.5 rounded-lg bg-paper-100 text-[0.75rem] font-medium text-ink-700">{e}<button onClick={() => setEmails(emails.filter(x => x !== e))} className="text-ink-400 hover:text-risk-600 cursor-pointer"><X size={12} /></button></span>)}
            </div>
            <div className="flex items-center gap-2">
              <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addEmail(); } }} type="email" placeholder="name@company.com" className="flex-1 h-9 px-3 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.78125rem] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-200" />
              <button onClick={addEmail} className="h-9 px-3 rounded-lg border border-canvas-border text-[0.78125rem] font-semibold text-ink-600 hover:border-ink-300 cursor-pointer">Add</button>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-canvas-border bg-paper-50/40">
          <span className="text-[0.71875rem] text-ink-400">{sel.size} document{sel.size === 1 ? '' : 's'} · {emails.length} recipient{emails.length === 1 ? '' : 's'}</span>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="h-9 px-3.5 text-[0.78125rem] font-semibold text-ink-600 hover:text-ink-900 cursor-pointer">Cancel</button>
            <button disabled={!canSend} onClick={() => { requestDataByEmail(control.id, Array.from(sel), emails); logEvent({ action: 'Share', description: `Requested ${sel.size} design document(s) for ${control.id} from ${emails.length} recipient(s)`, module: 'SOX ICFR', entity: 'Control' }); addToast({ type: 'success', title: 'Request sent', message: `${sel.size} document request${sel.size === 1 ? '' : 's'} emailed to ${emails.length === 1 ? emails[0] : `${emails.length} recipients`}.` }); onClose(); }} className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[0.78125rem] font-semibold disabled:opacity-40 enabled:hover:bg-brand-700 transition-colors cursor-pointer"><Send size={14} /> Send request</button>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}

// ── conclude footer — always visible, prominent ───────────────────────────────────
function ConcludeFooter({ control, which, suggestion, canEdit, disabled, disableEffective, disableEffectiveNote }: { control: Control; which: 'design' | 'operating'; suggestion: TrackConclusion; canEdit: boolean; disabled?: boolean; disableEffective?: boolean; disableEffectiveNote?: string }) {
  const { me, concludeDesign, concludeOperating, overrideDesign, overrideOperating } = useIcfr();
  const { addToast } = useToast();
  const logEvent = useAuditLog();
  const track = control[which];
  const conclude = which === 'design' ? concludeDesign : concludeOperating;
  const override = which === 'design' ? overrideDesign : overrideOperating;
  const label = which === 'design' ? 'Design' : 'Operating effectiveness';
  const [pending, setPending] = useState<TrackConclusion | null>(null);
  if (!canEdit) return null;
  const apply = (target: TrackConclusion) => {
    conclude(control.id, target);                                  // always save the conclusion
    logEvent({ action: 'Update', description: `Concluded ${which === 'design' ? 'design' : 'operating effectiveness'} ${target.toLowerCase()} for ${control.id}`, module: 'SOX ICFR', entity: 'Control' });
    const contradicts = suggestion !== 'Not tested' && target !== suggestion;
    if (contradicts) setPending(target); else override(control.id, null);
    addToast({ type: 'success', title: `${label} concluded ${target.toLowerCase()}`, message: contradicts ? 'Saved — add a rationale for going against the evidence.' : 'Saved to the working paper.' });
  };
  return (
    <div className="mt-4 pt-4 border-t border-canvas-border">
      <div className="flex items-center gap-2.5 flex-wrap">
        <button disabled={disabled || disableEffective} title={disableEffective ? disableEffectiveNote : undefined} onClick={() => apply('Effective')} className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-compliant-600 text-white text-[0.78125rem] font-semibold enabled:hover:bg-compliant-700 disabled:opacity-40 transition-colors cursor-pointer">{disableEffective ? <Lock size={14} /> : <CheckCircle2 size={15} />} Conclude effective</button>
        <button disabled={disabled} onClick={() => apply('Ineffective')} className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg border border-risk-300 text-risk-700 text-[0.78125rem] font-semibold enabled:hover:bg-risk-50 disabled:opacity-40 transition-colors cursor-pointer"><XCircle size={15} /> Conclude ineffective</button>
        {disableEffective && disableEffectiveNote && <span className="text-[0.71875rem] text-mitigated-700 inline-flex items-center gap-1"><Lock size={11} /> {disableEffectiveNote}</span>}
        {suggestion !== 'Not tested' && <span className="text-[0.71875rem] text-ink-400 inline-flex items-center gap-1"><Scale size={12} /> Evidence suggests <b className="font-semibold text-ink-600">{suggestion}</b></span>}
      </div>
      {pending && <RationaleForm title={`Overriding the evidence — record why you concluded ${pending}`} onCancel={() => setPending(null)} buttons={[{ label: `Save rationale`, onClick: note => { override(control.id, { result: pending === 'Effective' ? 'Effective' : 'Ineffective', by: me, at: 'just now', rationale: note }); setPending(null); } }]} />}
      {track.override && (
        <div className="mt-2.5 text-[0.71875rem] text-high-700 flex items-start gap-1.5 p-2.5 rounded-lg bg-high-50/50 border border-high-200">
          <Pencil size={12} className="mt-0.5 shrink-0" /><span><b>Conclusion overridden</b> — {track.override.rationale} <span className="text-ink-400">· {track.override.by}</span></span>
          <button onClick={() => override(control.id, null)} className="ml-auto text-ink-400 hover:text-ink-700 inline-flex items-center gap-1 cursor-pointer"><RotateCcw size={11} /> undo</button>
        </div>
      )}
    </div>
  );
}

// ── validation results modal — what the AI concluded against the file ─────────────
/**
 * Per-extracted-sample results for one attribute. Both read-outs — AI
 * validation and a pulled workflow run — test the attribute against every item
 * the sample step drew, so both show this same table. Renders nothing when no
 * sample has been extracted; the caller says what that means in its own words.
 */
function SampleResultsTable({ control, step }: { control: Control; step: OperatingStep }) {
  const samples = control.operating.sampling?.samples ?? [];
  if (samples.length === 0) return null;
  const rows = samples.map((s, i) => ({ ...s, i, res: step.sampleResults?.[s.id] ?? ('Not tested' as TestResult) }));
  const passed = rows.filter(r => r.res === 'Pass').length;
  // a run pulled before the sample existed carries no per-item verdicts — say so
  // rather than showing a table that reads as "everything untested"
  const stale = rows.every(r => r.res === 'Not tested');
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <div className="text-[0.65625rem] font-bold uppercase tracking-wide text-ink-400">Result against each extracted sample</div>
        {!stale && <span className="text-[0.6875rem] text-ink-400 tabular-nums">{passed}/{rows.length} passed</span>}
      </div>
      {stale && (
        <p className="text-[0.71875rem] text-mitigated-700 inline-flex items-start gap-1 mb-2">
          <AlertTriangle size={11} className="mt-0.5 shrink-0" />
          This ran before the sample was extracted — run it again to test each item.
        </p>
      )}
      <div className="rounded-lg border border-canvas-border overflow-hidden">
        <div className="grid grid-cols-[1.2fr_1fr_0.8fr_0.7fr] gap-2 px-3 py-1.5 bg-paper-50/70 border-b border-canvas-border text-[0.625rem] font-bold uppercase tracking-wide text-ink-400">
          <span>Reference</span><span>Date</span><span className="text-right">Amount</span><span className="text-right">Result</span>
        </div>
        {rows.map(r => {
          const f = sampleRowFacts(r.i);
          return (
            <div key={r.id} className="grid grid-cols-[1.2fr_1fr_0.8fr_0.7fr] gap-2 px-3 py-1.5 border-b border-canvas-border last:border-b-0 text-[0.71875rem] items-center">
              <span className="font-mono text-ink-700">{r.ref}</span>
              <span className="text-ink-500">{f.date}</span>
              <span className="text-right tabular-nums text-ink-700">₹ {f.amountL} L</span>
              <span className={cn('inline-flex items-center justify-end gap-1 font-bold', r.res === 'Pass' ? 'text-compliant-700' : r.res === 'Fail' ? 'text-risk-700' : 'text-ink-400')}>
                <Tickmark result={r.res} size={13} /> {r.res}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QAResultsModal({ title, validation, control, step, onClose }: { title: string; validation: ValidationResult; control?: Control; step?: OperatingStep; onClose: () => void }) {
  const { qa, summary, table, result, fileName } = validation;
  const passed = qa.filter(x => x.pass).length;
  // An operating attribute is tested against the drawn sample, so its real
  // item-level answer is the sample table. The generated evidence table is the
  // fallback for design considerations, which aren't sampled at all.
  const sampled = !!control?.operating.sampling?.samples.length && !!step;
  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      {/* same width as the workflow-run read-out — both carry the per-sample table */}
      <motion.div className="modal modal-wide" onClick={e => e.stopPropagation()} initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-canvas-border">
          <div className="flex items-center gap-2"><Sparkles size={16} className="text-brand-600" /><h3 className="text-[0.875rem] font-bold text-ink-900">Ask IRA — validation results</h3></div>
          <div className="flex items-center gap-2">
            {result && <span className={cn('inline-flex items-center gap-1 text-[0.75rem] font-bold px-2 h-6 rounded-full', result === 'Pass' ? 'bg-compliant-50 text-compliant-700' : 'bg-risk-50 text-risk-700')}><Tickmark result={result} size={13} /> {result}</span>}
            <button onClick={onClose} className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-ink-400 hover:text-ink-800 hover:bg-paper-50 cursor-pointer"><X size={16} /></button>
          </div>
        </div>
        <div className="px-5 py-2.5 border-b border-canvas-border bg-paper-50/40 flex items-center gap-2 flex-wrap"><p className="text-[0.75rem] text-ink-600"><b className="text-ink-800">Validated —</b> {title}</p>{fileName && <span className="inline-flex items-center gap-1 text-[0.65625rem] font-semibold text-ink-600 bg-canvas-elevated border border-canvas-border rounded-md px-1.5 h-[20px]"><Paperclip size={9} />{fileName}</span>}</div>
        <div className="px-5 py-4 space-y-4 max-h-[58vh] overflow-y-auto">
          {summary && (
            <div className="rounded-lg border border-canvas-border bg-paper-50/50 px-3.5 py-3">
              <div className="text-[0.65625rem] font-bold uppercase tracking-wide text-ink-400 mb-1">Summary</div>
              <p className="text-[0.78125rem] text-ink-700 leading-relaxed">{summary}</p>
            </div>
          )}
          {sampled && <SampleResultsTable control={control!} step={step!} />}
          {table && !sampled && (
            <div>
              <div className="text-[0.65625rem] font-bold uppercase tracking-wide text-ink-400 mb-1.5">Evidence checked</div>
              <div className="rounded-lg border border-canvas-border overflow-hidden">
                <table className="w-full text-[0.75rem]">
                  <thead><tr className="bg-paper-50/60 border-b border-canvas-border">{table.columns.map(c => <th key={c} className="text-left font-semibold text-ink-600 px-3 py-1.5">{c}</th>)}</tr></thead>
                  <tbody>
                    {table.rows.map((row, ri) => (
                      <tr key={ri} className="border-b border-canvas-border/60 last:border-0">
                        {row.map((cell, ci) => {
                          const isResult = ci === table.columns.length - 1;
                          return <td key={ci} className={cn('px-3 py-1.5', isResult ? cn('font-bold', cell === 'Pass' ? 'text-compliant-700' : cell === 'Fail' ? 'text-risk-700' : 'text-ink-600') : 'text-ink-700', ci === 0 && 'font-mono text-[0.6875rem] text-ink-500')}>{cell}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <div>
            <div className="text-[0.65625rem] font-bold uppercase tracking-wide text-ink-400 mb-1.5">Checks</div>
            <div className="space-y-3">
              {qa.map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Tickmark result={item.pass ? 'Pass' : 'Fail'} size={18} />
                  <div><div className="text-[0.78125rem] font-semibold text-ink-900">{item.q}</div><div className="text-[0.75rem] text-ink-600 mt-0.5 leading-relaxed">{item.a}</div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-canvas-border">
          <span className="text-[0.71875rem] text-ink-500">{passed}/{qa.length} checks passed</span>
          <button onClick={onClose} className="h-9 px-4 rounded-lg bg-brand-600 text-white text-[0.78125rem] font-semibold hover:bg-brand-700 cursor-pointer">Close</button>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}

/**
 * Workflow run results — the read-out behind a pulled run, the workflow twin of
 * the AI validation's Q&A modal. A run tests the attribute against every
 * extracted sample, so the answer worth showing isn't the attribute's single
 * Pass / Fail — it's which sampled items passed and which didn't.
 */
function RunResultsModal({ control, step, onClose }: { control: Control; step: OperatingStep; onClose: () => void }) {
  const samples = control.operating.sampling?.samples ?? [];
  const passed = samples.filter(s => step.sampleResults?.[s.id] === 'Pass').length;
  const eff = stepResult(step);
  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <motion.div className="modal modal-wide" onClick={e => e.stopPropagation()} initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-canvas-border">
          <div className="flex items-center gap-2"><WorkflowIcon size={16} className="text-evidence-700" /><h3 className="text-[0.875rem] font-bold text-ink-900">Workflow run — results</h3></div>
          <div className="flex items-center gap-2">
            {eff !== 'Not tested' && <span className={cn('inline-flex items-center gap-1 text-[0.75rem] font-bold px-2 h-6 rounded-full', eff === 'Pass' ? 'bg-compliant-50 text-compliant-700' : 'bg-risk-50 text-risk-700')}><Tickmark result={eff} size={13} /> {eff}</span>}
            <button onClick={onClose} className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-ink-400 hover:text-ink-800 hover:bg-paper-50 cursor-pointer" aria-label="Close"><X size={16} /></button>
          </div>
        </div>
        <div className="px-5 py-2.5 border-b border-canvas-border bg-paper-50/40 flex items-center gap-2 flex-wrap">
          <p className="text-[0.75rem] text-ink-600"><b className="text-ink-800">Tested —</b> {step.code} · {step.description}</p>
          {step.workflowName && <span className="inline-flex items-center gap-1 text-[0.65625rem] font-semibold text-ink-600 bg-canvas-elevated border border-canvas-border rounded-md px-1.5 h-[20px]"><WorkflowIcon size={9} />{step.workflowName}</span>}
          {step.workflowRunRef && <span className="font-mono text-[0.65625rem] text-ink-400">{step.workflowRunRef}</span>}
        </div>
        <div className="px-5 py-4 max-h-[58vh] overflow-y-auto">
          {samples.length === 0
            ? <p className="text-[0.78125rem] text-ink-500 leading-relaxed">
                No sample has been extracted for this control yet, so the run has nothing to report per item — it recorded an overall result only.
                Extract a sample in step 2 and re-pull the run to see it item by item.
              </p>
            : <SampleResultsTable control={control} step={step} />}
        </div>
        {/* the pass count lives on the table's own header — not repeated here */}
        <div className="flex items-center justify-end px-5 py-3.5 border-t border-canvas-border">
          <button onClick={onClose} className="h-9 px-4 rounded-lg bg-brand-600 text-white text-[0.78125rem] font-semibold hover:bg-brand-700 cursor-pointer">Close</button>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}

// ── design consideration row — validated by its own workflow (Q&A) + override ─────
const VALIDATE_MS = 6000;
function PointRow({ control, point, canEdit }: { control: Control; point: DesignPoint; canEdit: boolean }) {
  const { me, setDesignPoint, validateDesignPoint, overrideDesignPoint, removeDesignPoint } = useIcfr();
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
          <div className="flex items-center gap-2"><span className="text-[0.78125rem] font-medium text-ink-800">{point.text}</span>{point.override && <span className="override-tag"><Pencil size={9} /> Overridden</span>}</div>
          <div className="text-[0.6875rem] text-ink-400 mt-1 inline-flex items-center gap-1.5"><WorkflowIcon size={11} /> {point.workflowName ?? 'Design walkthrough check'} · {validating ? 'validating…' : (point.workflowRunRef ?? 'not validated')}</div>
          {point.override && <div className="text-[0.6875rem] text-high-700 mt-1 flex items-start gap-1"><CornerDownRight size={11} className="mt-0.5 shrink-0" /> {point.override.rationale}</div>}
        </div>
        {canEdit && !validating && (
          <div className="flex items-center gap-1.5 shrink-0">
            {point.validation && <button onClick={() => setShowQA(true)} className="h-7 px-2.5 inline-flex items-center gap-1 rounded-md border border-canvas-border bg-canvas-elevated text-[0.71875rem] font-semibold text-ink-600 hover:border-brand-300 hover:text-brand-700 cursor-pointer"><ListChecks size={12} /> View results</button>}
            <button onClick={runValidate} title="Validate via workflow" className="h-7 px-2.5 inline-flex items-center gap-1 rounded-md border border-canvas-border bg-canvas-elevated text-[0.71875rem] font-semibold text-ink-600 hover:border-evidence-300 hover:text-evidence-700 cursor-pointer"><PlayCircle size={12} /> {point.validation ? 'Re-run' : 'Validate'}</button>
            <button onClick={() => setOver(o => !o)} title="Override" className={cn('h-7 w-7 inline-flex items-center justify-center rounded-md border cursor-pointer', point.override ? 'bg-high-50 border-high-300 text-high-700' : 'border-canvas-border bg-canvas-elevated text-ink-600 hover:border-high-300 hover:text-high-700')}><Pencil size={12} /></button>
            <button onClick={() => removeDesignPoint(control.id, point.id)} title="Remove" className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-canvas-border bg-canvas-elevated text-ink-400 hover:border-risk-300 hover:text-risk-600 cursor-pointer"><Trash2 size={12} /></button>
          </div>
        )}
        {validating && <span className="text-[0.6875rem] font-semibold text-evidence-600 shrink-0">Validating…</span>}
      </div>
      {validating && <div className="mt-2.5 ml-8 h-1.5 rounded-full bg-paper-100 overflow-hidden"><motion.div className="h-full bg-evidence-500" initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: VALIDATE_MS / 1000, ease: 'linear' }} /></div>}
      {over && (point.override
        ? <div className="mt-2 flex justify-end"><button onClick={() => { overrideDesignPoint(control.id, point.id, null); setOver(false); }} className="h-7 px-3 text-[0.75rem] font-semibold rounded-lg border border-canvas-border text-ink-600 hover:text-ink-900 inline-flex items-center gap-1.5 cursor-pointer"><RotateCcw size={12} /> Remove override</button></div>
        : <RationaleForm title="Override this consideration — record why" onCancel={() => setOver(false)} buttons={[
            { label: 'Override · Pass', onClick: n => { overrideDesignPoint(control.id, point.id, { result: 'Pass', by: me, at: 'just now', rationale: n }); setOver(false); } },
            { label: 'Override · Fail', onClick: n => { setDesignPoint(control.id, point.id, 'Fail'); overrideDesignPoint(control.id, point.id, { result: 'Fail', by: me, at: 'just now', rationale: n }); setOver(false); } },
          ]} />)}
      <AnimatePresence>{showQA && point.validation && <QAResultsModal title={point.text} validation={point.validation} onClose={() => setShowQA(false)} />}</AnimatePresence>
    </div>
  );
}

// ── operating attribute — its own workflow and/or self-attestation ────────────────
function AttributeRow({ control, step, canEdit, testing }: { control: Control; step: OperatingStep; canEdit: boolean; testing: boolean }) {
  const { me, setStepResult, overrideStep, pullStepRun, attestStep, addStepEvidence, setStepInputFile, mapStepWorkflow, setStepEvidenceMode, toggleStepAttest, runStepValidation, removeAttribute } = useIcfr();
  const logEvent = useAuditLog();
  const [over, setOver] = useState(false);
  const [noteDraft, setNoteDraft] = useState(step.attestation?.note ?? '');
  const [validatingWf, setValidatingWf] = useState(false);
  const [showQA, setShowQA] = useState(false);
  const [showRun, setShowRun] = useState(false);
  const eff = stepResult(step);
  const att = step.attestation;
  const attestOn = step.attestEnabled ?? !!att;   // section 2 — separate toggle, default off (on if already attested)
  // section 1 — validation: AI validation is the default; can switch to a mapped workflow
  const v1: 'ai' | 'workflow' = step.evidenceMode === 'workflow' ? 'workflow' : step.evidenceMode === 'ai' ? 'ai' : (step.workflowName ? 'workflow' : 'ai');
  const busy = testing || validatingWf;
  const runAI = () => { setValidatingWf(true); window.setTimeout(() => { runStepValidation(control.id, step.id); setValidatingWf(false); }, 4000); };

  const resultBtn = (target: TestResult, label: string, Icon: typeof CheckCircle2, on: boolean, tone: string) => (
    <button onClick={() => setStepResult(control.id, step.id, target)} className={cn('h-8 px-2.5 inline-flex items-center gap-1 rounded-lg border text-[0.75rem] font-semibold transition-colors cursor-pointer', on ? tone : 'border-canvas-border bg-canvas-elevated text-ink-600 hover:border-ink-300 hover:text-ink-900')}><Icon size={13} />{label}</button>
  );

  return (
    <div className={cn('step-row', eff === 'Fail' && 'fail', eff === 'Pass' && 'pass')}>
      <div className="flex items-start gap-3.5">
        {busy ? <span className="w-[22px] h-[22px] inline-flex items-center justify-center"><Loader2 size={16} className="animate-spin text-brand-500" /></span> : <Tickmark result={eff} size={22} />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[0.6875rem] font-bold text-ink-500">{step.code}</span>
            <span className="text-[0.8125rem] font-semibold text-ink-900">{step.description}</span>
            {step.override && <span className="override-tag"><Pencil size={9} /> Overridden</span>}
          </div>
          <div className="text-[0.6875rem] text-ink-400 mt-1">{step.assertion} · {step.precision} · {step.procedures.join(' / ')}</div>
          {step.override && <div className="text-[0.6875rem] text-high-700 mt-1.5 flex items-start gap-1"><CornerDownRight size={11} className="mt-0.5 shrink-0" /> {step.override.rationale} <span className="text-ink-400">— {step.override.by}</span></div>}
        </div>
        {canEdit && (
          <div className="flex items-center gap-1.5 shrink-0">
            {resultBtn('Pass', 'Pass', CheckCircle2, eff === 'Pass', 'bg-compliant-50 border-compliant-300 text-compliant-700')}
            {resultBtn('Fail', 'Fail', XCircle, eff === 'Fail', 'bg-risk-50 border-risk-300 text-risk-700')}
            <button onClick={() => setOver(o => !o)} title="Override result with rationale" className={cn('h-8 w-8 inline-flex items-center justify-center rounded-lg border cursor-pointer', step.override ? 'bg-high-50 border-high-300 text-high-700' : 'border-canvas-border bg-canvas-elevated text-ink-600 hover:border-high-300 hover:text-high-700')}><Pencil size={13} /></button>
            <button onClick={() => { removeAttribute(control.id, step.id); logEvent({ action: 'Delete', description: `Removed attribute ${step.code} from ${control.id}`, module: 'SOX ICFR', entity: 'Control' }); }} title="Remove attribute" className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-canvas-border bg-canvas-elevated text-ink-400 hover:border-risk-300 hover:text-risk-600 cursor-pointer"><Trash2 size={13} /></button>
          </div>
        )}
      </div>

      {/* evidence — Section 1: validation (AI validation default / workflow) · Section 2: self-attest (separate) */}
      <div className="mt-3 ml-[36px] space-y-2">
        <div className="rounded-lg border border-canvas-border px-3 py-2.5">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[0.6875rem] font-bold text-ink-600">Validation</span>
            {canEdit && (
              <div className="inline-flex items-center p-0.5 rounded-md border border-canvas-border bg-paper-50/60">
                <button disabled={busy} onClick={() => setStepEvidenceMode(control.id, step.id, 'ai')} className={cn('h-6 px-2 rounded text-[0.6875rem] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed', v1 === 'ai' ? 'bg-canvas-elevated text-brand-700 ring-1 ring-canvas-border' : 'text-ink-500 hover:text-ink-800')}><Sparkles size={11} /> AI validation</button>
                <button disabled={busy} onClick={() => setStepEvidenceMode(control.id, step.id, 'workflow')} className={cn('h-6 px-2 rounded text-[0.6875rem] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed', v1 === 'workflow' ? 'bg-canvas-elevated text-brand-700 ring-1 ring-canvas-border' : 'text-ink-500 hover:text-ink-800')}><WorkflowIcon size={11} /> Workflow</button>
              </div>
            )}
          </div>
          {v1 === 'ai' ? (
            <div className="rounded-md bg-brand-50/30 border border-brand-100 px-2.5 py-2.5 space-y-2">
              {/* required file the AI validates against */}
              <div className="flex items-center gap-2 flex-wrap">
                <Upload size={13} className="text-brand-600 shrink-0" />
                <span className="text-[0.6875rem] font-semibold text-ink-600">Required file</span>
                {step.inputFile
                  ? <span className="inline-flex items-center gap-1 text-[0.65625rem] font-semibold text-ink-700 bg-canvas-elevated border border-canvas-border rounded-md px-1.5 h-[20px] max-w-[180px]"><Paperclip size={9} className="shrink-0" /><span className="truncate">{step.inputFile.name}</span></span>
                  : <span className="text-[0.6875rem] text-ink-400">none uploaded yet</span>}
                {canEdit && !busy && <button onClick={() => { setStepInputFile(control.id, step.id, `${step.code}-evidence.xlsx`); logEvent({ action: 'Upload', description: `Uploaded required file for attribute ${step.code} (${control.id})`, module: 'SOX ICFR', entity: 'Evidence' }); }} className="h-6 px-2 rounded-md border border-canvas-border bg-canvas-elevated text-ink-600 text-[0.6875rem] font-semibold hover:border-brand-300 hover:text-brand-700 inline-flex items-center gap-1 cursor-pointer"><Upload size={10} /> {step.inputFile ? 'Replace' : 'Upload file'}</button>}
              </div>
              {/* run + result */}
              <div className="flex items-center gap-2.5 flex-wrap pt-2 border-t border-brand-100/70">
                <Sparkles size={14} className="text-brand-600 shrink-0" />
                <span className="text-[0.71875rem] text-ink-600 flex-1 min-w-0">AI validation by Ask IRA · <span className="font-mono text-[0.65625rem] text-ink-400">{validatingWf ? 'checking the file…' : (step.validation ? 'done' : 'not run yet')}</span></span>
                {/* the verdict lives on the attribute's tickmark above — repeating
                    it here said the same thing twice */}
                {canEdit && (validatingWf
                  ? <span className="text-[0.71875rem] font-semibold text-brand-600 inline-flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" /> Validating…</span>
                  : <button onClick={runAI} disabled={!step.inputFile} title={step.inputFile ? '' : 'Upload the required file first'} className="h-7 px-2.5 rounded-md bg-brand-600 text-white text-[0.71875rem] font-semibold enabled:hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1 cursor-pointer"><Sparkles size={12} /> {step.validation ? 'Re-run' : 'Run AI validation'}</button>)}
                {step.validation && <button onClick={() => setShowQA(true)} className="text-[0.71875rem] font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800 inline-flex items-center gap-1 cursor-pointer"><ListChecks size={12} /> View results</button>}
              </div>
              {step.validation?.summary && !validatingWf && <p className="text-[0.71875rem] text-ink-600 leading-snug">{step.validation.summary}</p>}
              {!step.inputFile && canEdit && <p className="text-[0.65625rem] text-mitigated-700 inline-flex items-center gap-1"><AlertTriangle size={10} /> Upload the file the AI should check before running validation.</p>}
            </div>
          ) : (
            step.workflowName ? (
              <div className="rounded-md border border-evidence-100 bg-evidence-50/40 px-2.5 py-2 flex items-center gap-2.5">
                <Cpu size={14} className="text-evidence-700 shrink-0" />
                <div className="min-w-0 flex-1"><div className="text-[0.75rem] font-semibold text-ink-800 truncate">{step.workflowName}</div><div className="text-[0.65625rem] font-mono text-ink-400">{step.workflowRunRef ?? 'not run yet'}</div></div>
                {/* no Pass / Fail chip here — the attribute's own tickmark above
                    already carries the result; this is just the way into the
                    per-sample detail behind it */}
                {step.workflowRunRef && <button onClick={() => setShowRun(true)} className="text-[0.71875rem] font-semibold text-evidence-700 underline underline-offset-2 hover:text-evidence-800 inline-flex items-center gap-1 cursor-pointer shrink-0"><ListChecks size={12} /> View results</button>}
                {canEdit && !busy && <>
                  <button onClick={() => pullStepRun(control.id, step.id)} className="h-7 px-2.5 rounded-md bg-evidence-600 text-white text-[0.71875rem] font-semibold hover:bg-evidence-700 inline-flex items-center gap-1 cursor-pointer"><WorkflowIcon size={12} /> {step.workflowRunRef ? 'Re-pull' : 'Pull run'}</button>
                  <Dropdown trigger={<><Link2 size={12} /> Remap</>}>{close => WORKFLOW_LIBRARY.map(w => <button key={w} className={menuItem} onClick={() => { mapStepWorkflow(control.id, step.id, w); close(); }}><WorkflowIcon size={12} className="text-evidence-600" />{w}</button>)}</Dropdown>
                </>}
              </div>
            ) : canEdit ? (
              <Dropdown trigger={<><WorkflowIcon size={12} className="text-evidence-600" /> Map a workflow</>}>{close => WORKFLOW_LIBRARY.map(w => <button key={w} className={menuItem} onClick={() => { mapStepWorkflow(control.id, step.id, w); close(); }}><WorkflowIcon size={12} className="text-evidence-600" />{w}</button>)}</Dropdown>
            ) : <span className="text-[0.71875rem] text-ink-400">No workflow mapped</span>
          )}
        </div>

        <div className="rounded-lg border border-canvas-border px-3 py-2.5">
          <div className="flex items-center gap-2 text-[0.6875rem] font-bold text-ink-600"><Hand size={12} /> Self-attestation <span className="font-normal text-ink-400">· manual pass / fail</span>
            {canEdit && <span className="ml-auto"><Toggle on={attestOn} onChange={v => toggleStepAttest(control.id, step.id, v)} label="Toggle self-attestation" /></span>}
          </div>
          {attestOn && <>
            {att?.result && (
              <div className="mt-2 flex items-center gap-2 flex-wrap text-[0.6875rem]">
                <span className={cn('inline-flex items-center gap-1 font-bold', att.result === 'Pass' ? 'text-compliant-700' : 'text-risk-700')}><Tickmark result={att.result} size={13} /> Attested {att.result}</span>
                <span className="text-ink-400">· by <b className="text-ink-600 font-semibold">{att.by}</b>, {att.at}</span>
              </div>
            )}
            {att?.note && <p className="text-[0.75rem] text-ink-700 mt-1.5 italic">“{att.note}”</p>}
            {att && att.evidence.length > 0 && <div className="flex flex-wrap gap-1.5 mt-2">{att.evidence.map(f => <span key={f.id} className="inline-flex items-center gap-1 text-[0.65625rem] font-semibold text-ink-600 bg-paper-50 border border-canvas-border rounded-md px-1.5 h-[20px]"><Paperclip size={9} />{f.name}</span>)}</div>}
            {canEdit && (
              <div className="mt-2">
                <textarea value={noteDraft} onChange={e => setNoteDraft(e.target.value)} rows={2} placeholder="Describe how this attribute is satisfied — recorded with your attestation." className="w-full text-[0.75rem] rounded-lg border border-canvas-border bg-canvas-elevated px-2.5 py-2 text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-200 resize-none" />
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="text-[0.65625rem] font-semibold text-ink-400 uppercase tracking-wide">Attest</span>
                  <button disabled={!noteDraft.trim()} onClick={() => { attestStep(control.id, step.id, noteDraft.trim(), 'Pass'); logEvent({ action: 'Update', description: `Attested ${step.code} for ${control.id}`, module: 'SOX ICFR', entity: 'Test Result' }); }} className="h-7 px-2.5 rounded-md bg-compliant-600 text-white text-[0.71875rem] font-semibold disabled:opacity-40 enabled:hover:bg-compliant-700 inline-flex items-center gap-1 cursor-pointer"><CheckCircle2 size={12} /> Pass</button>
                  <button disabled={!noteDraft.trim()} onClick={() => { attestStep(control.id, step.id, noteDraft.trim(), 'Fail'); logEvent({ action: 'Update', description: `Attested ${step.code} for ${control.id}`, module: 'SOX ICFR', entity: 'Test Result' }); }} className="h-7 px-2.5 rounded-md border border-risk-300 text-risk-700 text-[0.71875rem] font-semibold disabled:opacity-40 enabled:hover:bg-risk-50 inline-flex items-center gap-1 cursor-pointer"><XCircle size={12} /> Fail</button>
                  <button onClick={() => { addStepEvidence(control.id, step.id, `evidence-${step.code}.pdf`); logEvent({ action: 'Upload', description: `Attached evidence to attribute ${step.code} (${control.id})`, module: 'SOX ICFR', entity: 'Evidence' }); }} className="h-7 px-2.5 rounded-md border border-canvas-border bg-canvas-elevated text-ink-600 text-[0.71875rem] font-semibold hover:border-brand-300 hover:text-brand-700 inline-flex items-center gap-1 cursor-pointer"><Upload size={11} /> Attach evidence</button>
                </div>
              </div>
            )}
          </>}
        </div>
      </div>

      {over && (step.override
        ? <div className="mt-2 flex justify-end"><button onClick={() => { overrideStep(control.id, step.id, null); setOver(false); }} className="h-7 px-3 text-[0.75rem] font-semibold rounded-lg border border-canvas-border text-ink-600 hover:text-ink-900 inline-flex items-center gap-1.5 cursor-pointer"><RotateCcw size={12} /> Remove override</button></div>
        : <RationaleForm title="Override this result — record why" onCancel={() => setOver(false)} buttons={[
            { label: 'Override · Pass', onClick: n => { overrideStep(control.id, step.id, { result: 'Pass', by: me, at: 'just now', rationale: n }); setOver(false); } },
            { label: 'Override · Fail', onClick: n => { overrideStep(control.id, step.id, { result: 'Fail', by: me, at: 'just now', rationale: n }); setOver(false); } },
          ]} />)}
      <AnimatePresence>{showQA && step.validation && <QAResultsModal title={step.description} validation={step.validation} control={control} step={step} onClose={() => setShowQA(false)} />}</AnimatePresence>
      <AnimatePresence>{showRun && <RunResultsModal control={control} step={step} onClose={() => setShowRun(false)} />}</AnimatePresence>
    </div>
  );
}

// ── RAG health — this control's design-step meters, coloured red / amber / green ──
// Only the meters this page is responsible for live here (completeness, evidence
// validated, TOD coverage confidence); RACM, control effectiveness and sample
// testing roll up engagement-wide on the Overview tab.
function designRagMeters(c: Control): RagMeterDef[] {
  const comp = designCompleteness(c);
  const points = c.design.points;
  const passed = points.filter(p => pointResult(p) === 'Pass').length;
  // Evidence validated reads the TOE (user ask): operating checks run across
  // the drawn samples — sample × attribute when a sample exists, attribute
  // level before one is drawn. Same counting rule as Overview's Sample testing.
  const steps = c.operating.steps;
  const samples = c.operating.sampling?.samples ?? [];
  const toeTotal = samples.length ? samples.length * steps.length : steps.length;
  const toeDone = samples.length
    ? steps.reduce((n, s) => n + samples.filter(smp => { const r = s.sampleResults?.[smp.id]; return r && r !== 'Not tested'; }).length, 0)
    : steps.filter(s => s.result !== 'Not tested').length;
  return [
    {
      label: 'Control completeness', pct: comp.pct, detail: `${comp.done}/${comp.total} required elements evidenced`, gate: true,
      explainer: "Every required element needs evidence attached before the design can be concluded effective. Optional elements strengthen the file but don't gate.",
    },
    {
      label: 'Evidence validated', pct: toeTotal ? Math.round((toeDone / toeTotal) * 100) : 0, detail: `${toeDone}/${toeTotal} operating checks run`, gate: true,
      explainer: 'Each operating check has to be run against the sampled evidence — unvalidated checks hold back an effective conclusion.',
    },
    {
      label: 'TOD coverage confidence', pct: points.length ? Math.round((passed / points.length) * 100) : 0, detail: `${passed}/${points.length} considerations pass`,
      explainer: 'How much of the design the considerations cover and pass — higher confidence means a stronger test of design.',
    },
  ];
}

// ── design section (TOD) ──────────────────────────────────────────────────────────
// Realistic evidence file name for a design element — what the "upload" attaches.
const EVIDENCE_EXT: Partial<Record<DesignDocKind, string>> = { 'Precision & thresholds': 'xlsx', 'Segregation of duties': 'xlsx' };
/** A custom element is titled by its name; the standard ones by their kind. */
function docLabel(doc: DesignDoc): string { return doc.kind === 'Custom' ? doc.name : doc.kind; }
function evidenceFileName(label: string, wpRef: string, kind: DesignDocKind): string {
  return `${label.replace(/[^A-Za-z0-9]+/g, '_')}_${wpRef}_FY26.${EVIDENCE_EXT[kind] ?? 'pdf'}`;
}

function DesignSection({ control, canEdit }: { control: Control; canEdit: boolean }) {
  const { addDesignDoc, attachDesignEvidence, removeDesignDoc, addDesignPoint, validateDesignPoint } = useIcfr();
  const logEvent = useAuditLog();
  const d = control.design;
  const [modal, setModal] = useState(false);
  const [newPoint, setNewPoint] = useState('');
  const [addingPoint, setAddingPoint] = useState(false);
  const [validatingAll, setValidatingAll] = useState(false);
  const [attaching, setAttaching] = useState<string | null>(null);
  // custom element — named by the auditor, same inline-form shape as Add check
  const [addingCustom, setAddingCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const runValidateAll = () => { setValidatingAll(true); logEvent({ action: 'Run', description: `Validated all design considerations for ${control.id}`, module: 'SOX ICFR', entity: 'Test Result' }); window.setTimeout(() => { control.design.points.forEach(p => validateDesignPoint(control.id, p.id)); setValidatingAll(false); }, VALIDATE_MS); };
  const attach = (doc: DesignDoc) => {
    setAttaching(doc.id);
    const label = docLabel(doc);
    logEvent({ action: 'Upload', description: `Attached design evidence (${label}) to ${control.id}`, module: 'SOX ICFR', entity: 'Control' });
    window.setTimeout(() => { attachDesignEvidence(control.id, doc.id, evidenceFileName(label, control.wpRef, doc.kind)); setAttaching(null); }, 900);
  };
  const addStandard = (k: DesignDocKind) => { addDesignDoc(control.id, k); logEvent({ action: 'Create', description: `Added design element to ${control.id}`, module: 'SOX ICFR', entity: 'Control' }); };
  const saveCustom = () => {
    if (!customName.trim()) return;
    addDesignDoc(control.id, 'Custom', { name: customName.trim(), description: customDesc.trim() || undefined });
    logEvent({ action: 'Create', description: `Added custom design element "${customName.trim()}" to ${control.id}`, module: 'SOX ICFR', entity: 'Control' });
    setCustomName(''); setCustomDesc(''); setAddingCustom(false);
  };
  // one definition, used by both the empty state and the section header
  const addElementMenu = (
    <Dropdown trigger={<><Plus size={12} /> Add element</>}>{close => <>
      {DESIGN_DOC_KINDS.map(k => <button key={k} className={menuItem} onClick={() => { addStandard(k); close(); }}><FileText size={12} className="text-brand-600" />{k}</button>)}
      <div className="my-1 border-t border-canvas-border" />
      <button className={menuItem} onClick={() => { setAddingCustom(true); close(); }}><Plus size={12} className="text-brand-600" />Custom…</button>
    </>}</Dropdown>
  );
  const customForm = addingCustom && (
    <div className="rounded-lg border border-brand-200 bg-brand-50/30 p-3 mb-2.5 space-y-2">
      <input autoFocus value={customName} onChange={e => setCustomName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') saveCustom(); if (e.key === 'Escape') setAddingCustom(false); }}
        placeholder="Element name — e.g. Delegation of authority matrix" aria-label="Custom element name"
        className="w-full h-9 px-3 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.78125rem] focus:outline-none focus:ring-2 focus:ring-brand-200" />
      <textarea rows={2} value={customDesc} onChange={e => setCustomDesc(e.target.value)}
        onKeyDown={e => { if (e.key === 'Escape') setAddingCustom(false); }}
        placeholder="Description (optional) — what this element should evidence" aria-label="Custom element description"
        className="w-full px-3 py-2 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.78125rem] resize-none focus:outline-none focus:ring-2 focus:ring-brand-200" />
      <div className="flex items-center justify-end gap-2">
        <button onClick={() => { setAddingCustom(false); setCustomName(''); setCustomDesc(''); }} className="h-8 px-3 rounded-lg border border-canvas-border text-[0.75rem] font-semibold text-ink-600 hover:text-ink-900 cursor-pointer">Cancel</button>
        <button disabled={!customName.trim()} onClick={saveCustom} className="h-8 px-3 rounded-lg bg-brand-600 text-white text-[0.75rem] font-semibold disabled:opacity-40 cursor-pointer">Add element</button>
      </div>
    </div>
  );
  const completeness = designCompleteness(control);
  const complete = completeness.total > 0 && completeness.pct === 100;
  const unvalidated = d.points.filter(p => pointResult(p) === 'Not tested').length;
  const missing = d.documents.filter(x => x.status !== 'Received');
  const suggestion: TrackConclusion = d.documents.length === 0 && d.points.length === 0 ? 'Not tested'
    : missing.length > 0 || d.points.some(p => pointResult(p) === 'Fail') ? 'Ineffective'
    : d.points.length > 0 && d.points.every(p => pointResult(p) === 'Pass') ? 'Effective' : 'Not tested';
  const empty = d.documents.length === 0 && d.points.length === 0;

  return (
    <div className="p-5">
      {empty && !addingCustom ? (
        <EmptyState icon={<FileText size={18} />} title="Test of design isn’t set up yet" hint="Add the design elements to evidence (process narrative, flowchart, walkthrough, precision & thresholds) and the design checks to assess. You can request the documents from the control owner by email.">
          {canEdit && <>
            {addElementMenu}
            <button onClick={() => setModal(true)} className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.75rem] font-semibold text-ink-700 hover:border-ink-300 cursor-pointer"><Mail size={13} /> Request data</button>
          </>}
        </EmptyState>
      ) : (
        <>
          {/* design elements — each one evidenced by attached files */}
          <div className="flex items-center justify-between mb-2.5">
            <h4 className="text-[0.78125rem] font-bold text-ink-700 inline-flex items-center gap-1.5"><FileText size={14} /> Design elements &amp; evidence</h4>
            <div className="flex items-center gap-2">
              {canEdit && <button onClick={() => setModal(true)} className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md border border-canvas-border bg-canvas-elevated text-[0.71875rem] font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-700 cursor-pointer"><Mail size={12} /> Request data</button>}
              {canEdit && addElementMenu}
            </div>
          </div>
          {customForm}
          {d.documents.length === 0 ? <p className="text-[0.75rem] text-ink-400 mb-5">{addingCustom ? '' : 'No elements yet — add one or request data.'}</p> : (
            <div className="mb-5 space-y-1.5">
              {d.documents.map(doc => {
                const files = doc.files ?? (doc.status === 'Received' ? [{ id: doc.id + '-f', name: doc.name, kind: 'PDF' as const, uploadedBy: doc.uploadedBy ?? 'Risk Owner', uploadedAt: doc.at ?? '' }] : []);
                const busy = attaching === doc.id;
                return (
                  <div key={doc.id} className={cn('doc-row', doc.status === 'Received' && '!border-compliant-200')}>
                    {busy ? <Loader2 size={15} className="animate-spin text-brand-600 shrink-0" /> : <FileCheck2 size={15} className={cn('shrink-0', DOC_TONE[doc.status])} />}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[0.75rem] font-semibold text-ink-800">{docLabel(doc)}</span>
                        <span className={cn('text-[0.5625rem] font-bold uppercase tracking-wide px-1 h-[15px] inline-flex items-center rounded', doc.required !== false ? 'bg-brand-50 text-brand-700' : 'bg-paper-100 text-ink-400')}>{doc.required !== false ? 'Required' : 'Optional'}</span>
                      </div>
                      {doc.description && <div className="text-[0.6875rem] text-ink-500 mt-0.5">{doc.description}</div>}
                      {files.length > 0 ? (
                        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                          {files.map(f => <span key={f.id} className="inline-flex items-center gap-1 text-[0.65625rem] font-medium text-ink-600 bg-paper-50/70 border border-canvas-border rounded px-1.5 h-[18px] max-w-[240px]"><Paperclip size={9} className="shrink-0" /><span className="truncate">{f.name}</span></span>)}
                          <span className="text-[0.65625rem] text-ink-400">{doc.uploadedBy ? `· ${doc.uploadedBy}, ${doc.at}` : ''}</span>
                        </div>
                      ) : (
                        <div className="text-[0.6875rem] text-ink-400 mt-0.5 truncate">{busy ? 'Uploading evidence…' : doc.status === 'Requested' ? 'Requested from the control owner' : 'No evidence attached yet'}</div>
                      )}
                    </div>
                    <Pill tone={doc.status === 'Received' ? 'compliant' : doc.status === 'Requested' ? 'mitigated' : 'draft'}>{doc.status === 'Received' ? 'Evidenced' : doc.status}</Pill>
                    {canEdit && <div className="flex items-center gap-1">
                      {doc.status !== 'Received' && <button disabled={busy} onClick={() => attach(doc)} className="h-7 px-2.5 text-[0.71875rem] font-semibold rounded-md border border-canvas-border bg-canvas-elevated text-ink-600 hover:text-compliant-700 hover:border-compliant-300 disabled:opacity-50 inline-flex items-center gap-1 cursor-pointer"><Upload size={11} /> Attach evidence</button>}
                      {doc.status === 'Received' && <button disabled={busy} onClick={() => attach(doc)} title="Attach another file" className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-canvas-border bg-canvas-elevated text-ink-400 hover:border-brand-300 hover:text-brand-700 cursor-pointer"><Plus size={12} /></button>}
                      <button onClick={() => { removeDesignDoc(control.id, doc.id); logEvent({ action: 'Delete', description: `Removed design element from ${control.id}`, module: 'SOX ICFR', entity: 'Control' }); }} title="Remove" className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-canvas-border bg-canvas-elevated text-ink-400 hover:border-risk-300 hover:text-risk-600 cursor-pointer"><Trash2 size={12} /></button>
                    </div>}
                  </div>
                );
              })}
            </div>
          )}

          {/* considerations */}
          <div className="flex items-center justify-between mb-2.5 gap-2 flex-wrap">
            <h4 className="text-[0.78125rem] font-bold text-ink-700 inline-flex items-center gap-1.5"><ClipboardCheck size={14} /> Design checks <span className="font-normal text-ink-400">· AI-validated against the evidence</span></h4>
            <div className="flex items-center gap-2">
              {canEdit && d.points.length > 0 && <button disabled={validatingAll} onClick={runValidateAll} className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md bg-evidence-600 text-white text-[0.71875rem] font-semibold enabled:hover:bg-evidence-700 disabled:opacity-70 cursor-pointer">{validatingAll ? <><Loader2 size={12} className="animate-spin" /> Validating…</> : <><PlayCircle size={12} /> Validate all</>}</button>}
              {canEdit && <button onClick={() => setAddingPoint(a => !a)} className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md border border-canvas-border bg-canvas-elevated text-[0.71875rem] font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-700 cursor-pointer"><Plus size={12} /> Add</button>}
            </div>
          </div>
          {addingPoint && (
            <div className="flex items-center gap-2 mb-2.5">
              <input autoFocus value={newPoint} onChange={e => setNewPoint(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newPoint.trim()) { addDesignPoint(control.id, newPoint.trim()); logEvent({ action: 'Create', description: `Added design consideration to ${control.id}`, module: 'SOX ICFR', entity: 'Control' }); setNewPoint(''); setAddingPoint(false); } }} placeholder="e.g. Reviewer is independent of the preparer" className="flex-1 h-9 px-3 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.78125rem] focus:outline-none focus:ring-2 focus:ring-brand-200" />
              <button disabled={!newPoint.trim()} onClick={() => { addDesignPoint(control.id, newPoint.trim()); logEvent({ action: 'Create', description: `Added design consideration to ${control.id}`, module: 'SOX ICFR', entity: 'Control' }); setNewPoint(''); setAddingPoint(false); }} className="h-9 px-3 rounded-lg bg-brand-600 text-white text-[0.75rem] font-semibold disabled:opacity-40 cursor-pointer">Add</button>
            </div>
          )}
          {d.points.length === 0 ? <p className="text-[0.75rem] text-ink-400 mb-2">No considerations yet — add the design points you’ll assess in the walkthrough.</p> : (
            <div className="space-y-2 mb-2">{d.points.map(p => <PointRow key={p.id} control={control} point={p} canEdit={canEdit} />)}</div>
          )}

          {missing.length > 0 && <div className="mt-3 text-[0.71875rem] text-mitigated-700 bg-mitigated-50/60 border border-mitigated-200 rounded-lg px-3 py-2 inline-flex items-center gap-1.5"><AlertTriangle size={13} /> {missing.length} element{missing.length > 1 ? 's' : ''} outstanding — attach evidence or request it from the control owner.</div>}
          {/* effective needs BOTH gates: evidence complete AND every design
              check validated — an unvalidated check is an untested opinion */}
          <ConcludeFooter control={control} which="design" suggestion={suggestion} canEdit={canEdit}
            disableEffective={!complete || unvalidated > 0}
            disableEffectiveNote={!complete
              ? `Locked — ${completeness.total - completeness.done} required element${completeness.total - completeness.done === 1 ? ' still needs' : 's still need'} evidence`
              : unvalidated > 0
                ? `Locked — ${unvalidated} design check${unvalidated === 1 ? '' : 's'} not validated yet`
                : undefined} />
        </>
      )}
      <AnimatePresence>{modal && <RequestDataModal control={control} onClose={() => setModal(false)} />}</AnimatePresence>
    </div>
  );
}

// ── sample extraction (step 2) — population → logic → filters → approve ───────────
/** Deterministic mock row facts so filters and specs are stable across runs. */
function sampleRowFacts(i: number): { date: string; amountL: number } {
  const MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
  const day = ((i * 7) % 27) + 1;
  const amountL = 8 + ((i * 37) % 190); // ₹ lakh, 8–197
  return { date: `${day} ${MONTHS[(i * 5) % 12]} FY26`, amountL };
}

/** The two inputs the sample step needs — the sample is drawn from the master
 *  population, and the transactions tested against each drawn item come from
 *  the transactions file. Mirrors the creation flow's required-files card. */
const REQUIRED_SAMPLE_FILES: { id: 'pop' | 'txn'; name: string; formats: string; tag: string }[] = [
  { id: 'pop', name: 'Population (master data)', formats: 'XLSX', tag: 'Population' },
  { id: 'txn', name: 'Transactions', formats: 'XLSX / CSV', tag: 'Transactions' },
];

/**
 * Add a required file — one entry point for both slots.
 *
 * Opens on the upload dropzone, because that is what the step is asking for.
 * Under it sits "Choose existing", which opens the engagement's files in place:
 * the trial balances, general ledger and RACM / SOP uploaded during scoping are
 * often exactly the transaction data being asked for, so reusing one should cost
 * a click, not a detour. Several can be ticked at once, capped at the number of
 * requirements still open so the list can never promise an attachment it has
 * nowhere to put.
 */
function FilePickerModal({ existing, onUpload, onChoose, slots, onClose }: {
  existing: { name: string; kind: string; rows: number; from: string }[];
  onUpload: () => void;
  onChoose: (files: { name: string; rows: number }[]) => void;
  /** How many requirements are still open — caps what can be ticked. */
  slots: number;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<'pick' | 'existing'>('pick');
  const [picked, setPicked] = useState<string[]>([]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Add a file">
        <div className="px-5 pt-4 pb-3 border-b border-canvas-border flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-ink-900">Add a file</h2>
            <p className="text-[12.5px] text-ink-500 mt-0.5">Add the file — it's read and matched to the requirement it satisfies.</p>
          </div>
          <button onClick={onClose} className="h-7 w-7 inline-flex items-center justify-center rounded-md text-ink-400 hover:text-ink-700 cursor-pointer shrink-0" aria-label="Close"><X size={15} /></button>
        </div>
        <div className="p-5">
          {mode === 'pick' ? (
            /* Uploading is the job, so the modal opens straight onto it. Reusing
               a file the engagement already holds is the shortcut beneath, not a
               fork of equal weight — a two-card chooser made the common path an
               extra decision. */
            <>
              <button
                onClick={onUpload}
                className="w-full rounded-xl border-2 border-dashed border-ink-300/70 hover:border-brand-400 hover:bg-brand-50/60 transition-colors px-4 py-7 flex flex-col items-center gap-1.5 cursor-pointer group"
              >
                <span className="size-9 rounded-lg bg-brand-50 group-hover:bg-brand-100 flex items-center justify-center transition-colors">
                  <FileUp size={15} className="text-brand-600" />
                </span>
                <span className="block text-[13px] font-semibold text-ink-800">Upload a file</span>
                <span className="block text-[11.5px] text-ink-400">.xlsx or .csv, from your device</span>
              </button>

              <div className="mt-4 pt-4 border-t border-canvas-border flex items-center justify-between gap-3">
                <p className="text-[11.5px] text-ink-500">
                  {existing.length > 0
                    ? `${existing.length} file${existing.length === 1 ? '' : 's'} already on this engagement`
                    : 'No files on this engagement yet — upload one above.'}
                </p>
                <button
                  disabled={existing.length === 0}
                  onClick={() => setMode('existing')}
                  className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border border-canvas-border bg-white text-[12px] font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-700 disabled:opacity-40 disabled:hover:border-canvas-border disabled:hover:text-ink-700 disabled:cursor-not-allowed transition-colors cursor-pointer shrink-0"
                >
                  <Paperclip size={12} /> Choose existing
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                onClick={() => { setMode('pick'); setPicked([]); }}
                className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-ink-500 hover:text-brand-700 cursor-pointer transition-colors mb-2.5"
              >
                <ArrowLeft size={12} /> Back
              </button>
              <div className="rounded-lg border border-canvas-border overflow-hidden">
                {existing.map(f => {
                  const on = picked.includes(f.name);
                  // Only as many as there are open requirements — the list must not
                  // let someone tick a third file it has nowhere to put.
                  const full = !on && picked.length >= slots;
                  return (
                    <button
                      key={f.name}
                      disabled={full}
                      onClick={() => setPicked(p => (on ? p.filter(x => x !== f.name) : [...p, f.name]))}
                      className="w-full text-left px-3 py-2.5 border-b border-canvas-border last:border-b-0 hover:bg-brand-50/40 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-2.5"
                    >
                      <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${on ? 'bg-brand-600 border-brand-600 text-white' : 'border-canvas-border bg-white'}`}>
                        {on && <Check size={11} strokeWidth={3} />}
                      </span>
                      <Paperclip size={12} className="text-ink-400 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-mono text-[12px] text-ink-800 truncate">{f.name}</span>
                        <span className="block text-[11px] text-ink-400">{f.kind} · {f.rows.toLocaleString()} rows · {f.from}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-[11.5px] text-ink-400">
                  {picked.length} of {slots} open requirement{slots === 1 ? '' : 's'} selected
                </p>
                <button
                  onClick={() => onChoose(
                    picked.map(n => existing.find(x => x.name === n)).filter(Boolean) as { name: string; rows: number }[],
                  )}
                  disabled={picked.length === 0}
                  className="h-9 px-4 rounded-lg bg-brand-600 text-white text-[12.5px] font-semibold hover:bg-brand-700 disabled:opacity-40 transition-colors cursor-pointer"
                >
                  Attach {picked.length || ''}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function SampleExtractSection({ control, canEdit, locked }: { control: Control; canEdit: boolean; locked: boolean }) {
  const { eng, racmDocs, openAuditId, setPopulation, setSampling, me } = useIcfr();
  const logEvent = useAuditLog();
  const { addToast } = useToast();
  const o = control.operating;

  // 'upload' covers everything before Send — the files card and the logic card
  // are gated on the files themselves, not on a stage
  type Stage = 'upload' | 'extracting' | 'review';
  const [stage, setStage] = useState<Stage>('upload');
  // two inputs, two jobs: samples are drawn from the master population, and the
  // transactions tested against each of them come from the transactions file
  const [popFile, setPopFile] = useState<{ name: string; count: number } | null>(null);
  const [txnFile, setTxnFile] = useState<{ name: string; count: number } | null>(null);
  const [uploading, setUploading] = useState<'pop' | 'txn' | null>(null);
  const [picking, setPicking] = useState(false);
  const [logic, setLogic] = useState('');
  const [sentLogic, setSentLogic] = useState('');
  // how many to draw is the system's call, not a free guess — the handbook sizes
  // it from the control's nature and frequency; the auditor picks off that ladder
  const guide = sampleSizeGuide(control);
  const [rows, setRows] = useState(guide.suggested);
  const [drawn, setDrawn] = useState<string[]>([]);
  const [rejecting, setRejecting] = useState(false);
  // sending with no filter rule is the one thing that can't be guessed — IRA
  // asks for it rather than silently pulling everything
  const [askedForLogic, setAskedForLogic] = useState(false);
  const filesReady = !!popFile && !!txnFile;
  const attachedFiles = REQUIRED_SAMPLE_FILES
    .map(d => { const f = d.id === 'pop' ? popFile : txnFile; return f ? { id: d.id, name: f.name, tag: d.tag } : null; })
    .filter(Boolean) as { id: 'pop' | 'txn'; name: string; tag: string }[];

  // The journey stays LOCAL until approval — nothing is written to the control,
  // so "Reject and try again" is a pure state reset with no store cleanup.
  // What the engagement already holds — the scoping uploads are usually the
  // very transaction data being asked for here, so they're offered for reuse.
  const existingFiles = useMemo(() => {
    // programmeFor, not PROGRAMMES: the Altura group's record lives in the V2
    // store, and reading only the classic one left this list empty — "Choose
    // existing" then claimed the engagement had no files at all.
    const prog = programmeFor(eng.id);
    const out: { name: string; kind: string; rows: number; from: string }[] = [];
    // The open audit's own TB / GL come first — they are this cycle's files,
    // so they are the ones most likely being asked for.
    const audit = eng.audits.find(a => a.id === openAuditId);
    audit?.files.forEach(f => out.push({
      name: f.name,
      kind: f.kind === 'tb' ? 'Trial balance' : 'General ledger',
      rows: f.kind === 'tb' ? 1240 : 18432,
      from: `${audit.period} audit`,
    }));
    prog?.entities.forEach((en: { name: string; tbFile?: string; tbLines?: number }) => {
      if (en.tbFile) out.push({ name: en.tbFile, kind: 'Trial balance', rows: en.tbLines ?? 1240, from: `${en.name} · engagement scoping` });
    });
    if (prog) out.push({ name: `general_ledger_${prog.fy}.csv`, kind: 'General ledger', rows: 18432, from: 'Engagement scoping' });
    racmDocs.forEach(d => out.push({ name: d.name, kind: 'RACM / SOP', rows: 480, from: d.process ? `${d.process} RACM` : 'RACM page' }));
    // A file can reach the list twice (an audit TB that is also the scoping TB).
    return out.filter((f, i) => out.findIndex(x => x.name === f.name) === i);
  }, [eng.id, eng.audits, openAuditId, racmDocs]);

  // The file is matched to the requirement it satisfies — by what it's called,
  // falling back to whichever slot is still open. The auditor never picks.
  const classify = (name: string): 'pop' | 'txn' => {
    const n = name.toLowerCase();
    if (/popul|master/.test(n)) return 'pop';
    if (/transact|txn|ledger|\bgl\b|journal|invoice|payment/.test(n)) return 'txn';
    return popFile ? 'txn' : 'pop';
  };
  const attach = (file: { name: string; count: number }) => {
    const which = classify(file.name);
    if (which === 'pop') setPopFile(file); else setTxnFile(file);
    return which;
  };
  const uploadFile = () => {
    setPicking(false);
    // the simulated pick fills whichever requirement is still open
    const which: 'pop' | 'txn' = popFile ? 'txn' : 'pop';
    setUploading(which);
    window.setTimeout(() => {
      const f = which === 'pop' ? { name: 'population.xlsx', count: 2640 } : { name: 'transactions.xlsx', count: 18432 };
      attach(f);
      setUploading(null);
      logEvent({ action: 'Upload', description: `Added "${f.name}" for ${control.id} — matched to ${which === 'pop' ? 'population' : 'transactions'}`, module: 'SOX ICFR', entity: 'Evidence' });
    }, 1400);
  };
  /** Attach several chosen files at once.
   *
   *  Slots are walked in local variables rather than by calling attach() per
   *  file: classify() falls back to "whichever slot is still open", and in one
   *  tick every call would still see the old state and land on the same slot. */
  const chooseFiles = (files: { name: string; rows: number }[]) => {
    setPicking(false);
    let pop = popFile;
    let txn = txnFile;
    for (const f of files) {
      const file = { name: f.name, count: f.rows };
      const n = f.name.toLowerCase();
      const which: 'pop' | 'txn' = /popul|master/.test(n) ? 'pop'
        : /transact|txn|ledger|\bgl\b|journal|invoice|payment/.test(n) ? 'txn'
        : pop ? 'txn' : 'pop';
      if (which === 'pop') pop = file; else txn = file;
      logEvent({ action: 'Update', description: `Reused "${f.name}" for ${control.id} — matched to ${which === 'pop' ? 'population' : 'transactions'}`, module: 'SOX ICFR', entity: 'Evidence' });
    }
    setPopFile(pop);
    setTxnFile(txn);
  };
  const sendLogic = () => {
    if (!logic.trim()) { setAskedForLogic(true); return; }
    setAskedForLogic(false);
    setSentLogic(logic.trim());
    setStage('extracting');
    logEvent({ action: 'Run', description: `Extracted sample for ${control.id} — ${rows} items from the population, transactions filtered by logic`, module: 'SOX ICFR', entity: 'Test Result' });
    window.setTimeout(() => { setDrawn(sampleRefs(control.process, rows)); setStage('review'); }, 1800);
  };
  const visible = drawn.map((ref, i) => ({ ref, i }));

  const approve = () => {
    const kept = visible.map(v => v.ref);
    setPopulation(control.id, {
      source: `Uploaded — ${popFile?.name ?? 'population.xlsx'}`, count: popFile?.count ?? 2640,
      tieOut: 'Agreed to GL control account',
      evidence: [
        { id: 'pop-ev', name: popFile?.name ?? 'population.xlsx', kind: 'XLSX', uploadedBy: me, uploadedAt: 'just now' },
        { id: 'txn-ev', name: txnFile?.name ?? 'transactions.xlsx', kind: 'XLSX', uploadedBy: me, uploadedAt: 'just now' },
      ],
    });
    const s: Sampling = {
      basis: `${kept.length} items drawn from ${popFile?.name ?? 'the population'} — transactions filtered by: “${sentLogic}”`,
      method: 'Targeted', size: kept.length,
      samples: kept.map((ref, i) => ({ id: `s${i}`, ref, result: 'Not tested' })),
    };
    setSampling(control.id, s);
    logEvent({ action: 'Update', description: `Approved extracted sample for ${control.id} — ${kept.length} items`, module: 'SOX ICFR', entity: 'Test Result' });
    addToast({ type: 'success', title: 'Sample approved', message: `${kept.length} items locked in — continue to the test of operating effectiveness.` });
    document.getElementById('vstep-toe')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const restart = () => {
    setRejecting(false);
    setStage('upload'); setPopFile(null); setTxnFile(null); setLogic(''); setSentLogic(''); setRows(guide.suggested); setDrawn([]); setAskedForLogic(false);
    logEvent({ action: 'Delete', description: `Rejected extracted sample for ${control.id} — journey restarted`, module: 'SOX ICFR', entity: 'Test Result' });
  };

  if (locked) {
    return (
      <div className="p-5">
        <EmptyState icon={<Lock size={18} />} title="Sample extraction is locked" hint="Conclude the Test of Design as effective first — the sample is only worth pulling for a control that is designed effectively.">
          <span className="inline-flex items-center gap-1.5 text-[0.75rem] text-ink-500"><span>Design is currently</span><TrackPill c={trackResult(control.design)} /></span>
        </EmptyState>
      </div>
    );
  }

  // Already approved (this session or seeded) — read-only summary.
  if (o.sampling) {
    return (
      <div className="p-5">
        <div className="rounded-xl border border-compliant-200 bg-compliant-50/30 p-4 flex items-start gap-3">
          <CheckCircle2 size={16} className="text-compliant-700 mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-bold text-ink-900">Sample approved — {o.sampling.size} items</div>
            <p className="text-[11.5px] text-ink-500 mt-0.5">{o.sampling.method} · {o.sampling.basis}</p>
            {o.population && <p className="text-[11px] text-ink-400 mt-1">Population {o.population.count.toLocaleString()} · {o.population.source} · {o.population.tieOut}</p>}
          </div>
        </div>
      </div>
    );
  }

  // A frozen (concluded + signed) control never re-opens the journey.
  if (!canEdit || isControlLocked(control)) {
    return <div className="p-5"><p className="text-[0.75rem] text-ink-400">No sample extracted yet — the auditor or risk owner pulls it from the uploaded population.</p></div>;
  }

  return (
    <div className="p-5">
      {/* 1 — the two required files, in the creation flow's card language:
          requirement chips that tick off, one bulk button, attached list below */}
      <div className="rounded-xl border border-canvas-border bg-canvas-elevated mb-3">
        <div className="flex items-center gap-2 px-4 py-3">
          <FileText size={14} className="text-brand-600 shrink-0" />
          <span className="text-[13px] font-bold text-ink-900">Required files</span>
          <span className="text-[11.5px] text-ink-400">{REQUIRED_SAMPLE_FILES.length} required · {REQUIRED_SAMPLE_FILES.length} total</span>
          {/* one button for both slots — the picker asks which, and offers the
              engagement's own files as well as a fresh upload */}
          <button onClick={() => setPicking(true)}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand-600 hover:bg-brand-700 text-white text-[11.5px] font-semibold transition-colors cursor-pointer">
            <Upload size={12} /> {attachedFiles.length > 0 ? 'Add more' : 'Upload'}
          </button>
        </div>
        <div className="px-4 pb-3.5 flex flex-wrap gap-2">
          {REQUIRED_SAMPLE_FILES.map(d => {
            const done = !!(d.id === 'pop' ? popFile : txnFile);
            return (
              <div key={d.id} className={cn('inline-flex items-center gap-2 px-3 py-2.5 rounded-lg border', done ? 'border-compliant-100 bg-compliant-50/40' : 'border-canvas-border bg-canvas-elevated')}>
                <span className="text-[12.5px] font-semibold text-ink-900">{d.name}</span>
                <span className="px-1.5 py-0.5 rounded-md border border-canvas-border text-[10px] font-bold text-ink-400">{d.formats}</span>
                {done && <Check size={13} className="text-compliant-600 shrink-0" />}
              </div>
            );
          })}
        </div>
      </div>

      {attachedFiles.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-ink-400">
              Attached
              <span className="w-[18px] h-[18px] rounded-full bg-ink-900 text-white text-[10px] font-bold inline-flex items-center justify-center tabular-nums">{attachedFiles.length}</span>
            </span>
            <span className="text-[11.5px] text-ink-400 tabular-nums">{attachedFiles.length}/{REQUIRED_SAMPLE_FILES.length} required inputs satisfied</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {attachedFiles.map(a => (
              <span key={a.id} className="flex items-center gap-1.5 pl-2.5 pr-1.5 h-9 rounded-lg border border-canvas-border bg-canvas-elevated min-w-0">
                <FileText size={12} className="text-ink-400 shrink-0" />
                <span className="text-[12px] text-ink-800 truncate">{a.name}</span>
                <span className="px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 text-[9.5px] font-bold uppercase tracking-wide whitespace-nowrap shrink-0">{a.tag}</span>
                <button onClick={() => (a.id === 'pop' ? setPopFile(null) : setTxnFile(null))} aria-label={`Remove ${a.name}`}
                  className="ml-auto p-1 rounded text-ink-400 hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer shrink-0"><X size={12} /></button>
              </span>
            ))}
          </div>
          {uploading && <span className="mt-2 inline-flex items-center gap-1.5 text-[11.5px] text-ink-400"><Loader2 size={12} className="animate-spin" /> Parsing…</span>}
        </div>
      )}

      {/* something's been added but a requirement is still open — say which,
          without waiting for the auditor to try and move on */}
      {attachedFiles.length > 0 && !filesReady && !uploading && (
        <div className="mb-3 text-[0.71875rem] text-mitigated-800 bg-mitigated-50/60 border border-mitigated-200 rounded-lg px-3 py-2 inline-flex items-start gap-1.5">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          <span>
            {REQUIRED_SAMPLE_FILES.find(d => !(d.id === 'pop' ? popFile : txnFile))!.name} is still missing — the sample can't be pulled until both files are in.
          </span>
        </div>
      )}

      {/* 2 — how many to draw, and the rule that filters the transactions */}
      {/* always here — the logic can be written before the files land; only
          sending waits on them */}
      <div className="subcard p-3.5 mb-3">
          <div className="text-[0.71875rem] font-bold text-ink-700 mb-1.5 inline-flex items-center gap-1.5"><MessageSquare size={12} /> Extraction logic {txnFile && <span className="font-normal text-ink-400">· filters {txnFile.name}</span>}</div>
          {sentLogic ? (
            <div className="flex items-start gap-2 mb-2">
              <CornerDownRight size={12} className="text-ink-400 mt-0.5 shrink-0" />
              <p className="text-[0.75rem] text-ink-700 bg-paper-50 border border-canvas-border rounded-lg px-2.5 py-1.5 flex-1">{sentLogic}</p>
            </div>
          ) : (
            <>
              {/* no rule, no filter — IRA says so and asks for one rather than
                  quietly pulling every transaction */}
              {askedForLogic && (
                <div className="mb-2 rounded-lg border border-mitigated-200 bg-mitigated-50/50 px-2.5 py-2">
                  <p className="text-[0.71875rem] font-semibold text-mitigated-800 inline-flex items-start gap-1.5">
                    <AlertTriangle size={11} className="mt-0.5 shrink-0" /> No extraction logic — nothing to filter the transactions on.
                  </p>
                  <p className="text-[0.71875rem] text-ink-700 leading-relaxed mt-1.5 inline-flex items-start gap-1.5">
                    <Sparkles size={11} className="text-brand-600 mt-0.5 shrink-0" />
                    <span>Which transactions should I pull for each sampled item — by amount, by date window, by counterparty? Tell me the rule and I'll apply it to {txnFile?.name ?? 'the transactions file'}.</span>
                  </p>
                </div>
              )}
              <textarea rows={2} value={logic} onChange={e => { setLogic(e.target.value); if (e.target.value.trim()) setAskedForLogic(false); }}
                placeholder="Explain how to filter the transactions — e.g. payment runs above ₹10L, weighted to quarter-ends, excluding intercompany"
                className={cn('w-full px-3 py-2 rounded-lg border bg-canvas-elevated text-[0.78125rem] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-2 resize-none',
                  askedForLogic ? 'border-mitigated-300 focus:ring-mitigated-200' : 'border-canvas-border focus:ring-brand-200')} />
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="text-[0.71875rem] text-ink-500">Sample rows</span>
                <select value={rows} onChange={e => setRows(+e.target.value)} aria-label="Sample rows"
                  className="h-8 px-2 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.78125rem] tabular-nums cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-200">
                  {Array.from(new Set([guide.suggested, 1, 2, 4, 10, 25, 40, 60])).sort((a, b) => a - b).map(n => (
                    <option key={n} value={n}>{n}{n === guide.suggested ? ' — suggested' : ''}</option>
                  ))}
                </select>
                <span className="text-[0.6875rem] text-ink-400">{control.frequency} · {control.nature} — {guide.range}. {guide.note}</span>
                <div className="flex-1" />
                {/* the logic can be written first — sending needs the data */}
                <button disabled={!filesReady || stage === 'extracting'} onClick={sendLogic}
                  title={filesReady ? undefined : 'Add the required files first — there is nothing to draw from yet'}
                  className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[0.75rem] font-semibold enabled:hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer">
                  {stage === 'extracting' ? <><Loader2 size={13} className="animate-spin" /> Extracting…</> : <><Send size={13} /> Send</>}
                </button>
              </div>
            </>
          )}
          {stage === 'extracting' && (
            <div className="flex items-center gap-1.5 text-[0.75rem] text-brand-600 font-semibold"><Loader2 size={13} className="animate-spin" /> Drawing {rows} from {popFile!.count.toLocaleString()} and filtering {txnFile!.count.toLocaleString()} transactions…</div>
          )}
      </div>

      {/* 3 — extracted result + approve / reject */}
      {stage === 'review' && (
        <div className="subcard p-3.5">
          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
            <div className="text-[0.71875rem] font-bold text-ink-700 inline-flex items-center gap-1.5"><FlaskConical size={12} /> Extracted sample <span className="font-normal text-ink-400">· {drawn.length} rows</span></div>
          </div>
          <div className="rounded-lg border border-canvas-border overflow-hidden mb-3">
            <div className="grid grid-cols-[1.2fr_1fr_0.8fr] gap-2 px-3 py-1.5 bg-paper-50/70 border-b border-canvas-border text-[0.625rem] font-bold uppercase tracking-wide text-ink-400">
              <span>Reference</span><span>Date</span><span className="text-right">Amount</span>
            </div>
            {visible.slice(0, 8).map(({ ref, i }) => {
              const f = sampleRowFacts(i);
              return (
                <div key={ref} className="grid grid-cols-[1.2fr_1fr_0.8fr] gap-2 px-3 py-1.5 border-b border-canvas-border last:border-b-0 text-[0.71875rem]">
                  <span className="font-mono text-ink-700">{ref}</span>
                  <span className="text-ink-500">{f.date}</span>
                  <span className="text-right tabular-nums text-ink-700">₹ {f.amountL} L</span>
                </div>
              );
            })}
            {visible.length > 8 && <div className="px-3 py-1.5 text-[0.6875rem] text-ink-400">+{visible.length - 8} more rows in the extract</div>}
          </div>
          <div className="flex items-center justify-end gap-2">
            <button onClick={() => setRejecting(true)} className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-lg border border-risk-200 text-[0.78125rem] font-semibold text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer">
              <RotateCcw size={13} /> Reject and try again
            </button>
            <button disabled={visible.length === 0} onClick={approve} className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[0.78125rem] font-semibold enabled:hover:bg-brand-700 disabled:opacity-40 transition-colors cursor-pointer">
              <Check size={14} /> Approve and continue
            </button>
          </div>
        </div>
      )}

      {picking && (
        <FilePickerModal
          existing={existingFiles}
          onUpload={uploadFile}
          onChoose={chooseFiles}
          slots={(popFile ? 0 : 1) + (txnFile ? 0 : 1)}
          onClose={() => setPicking(false)}
        />
      )}

      {rejecting && createPortal(
        <div className="modal-backdrop" onClick={() => setRejecting(false)}>
          <motion.div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()} initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}>
            <div className="px-5 py-4">
              <div className="flex items-start gap-3">
                <span className="w-9 h-9 rounded-lg bg-risk-50 text-risk-700 inline-flex items-center justify-center shrink-0"><AlertTriangle size={17} /></span>
                <div>
                  <h3 className="text-[0.875rem] font-bold text-ink-900">Reject this sample?</h3>
                  <p className="text-[0.75rem] text-ink-500 mt-1">Your progress will be gone and you'll have to try again — add the required files and enter the extraction logic from the start.</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-canvas-border bg-paper-50/40">
              <button onClick={() => setRejecting(false)} className="h-9 px-3.5 text-[0.78125rem] font-semibold text-ink-600 hover:text-ink-900 cursor-pointer">Keep working</button>
              <button onClick={restart} className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-risk-600 text-white text-[0.78125rem] font-semibold hover:bg-risk-700 transition-colors cursor-pointer"><RotateCcw size={13} /> Reject and start over</button>
            </div>
          </motion.div>
        </div>,
        document.body)}
    </div>
  );
}

// ── operating section (TOE) — locked until design effective ───────────────────────
function OperatingSection({ control, canEdit, locked }: { control: Control; canEdit: boolean; locked: boolean }) {
  const { addAttribute, testAllAttributes } = useIcfr();
  const logEvent = useAuditLog();
  const o = control.operating; const prog = operatingProgress(control);
  const anyFail = o.steps.some(s => stepResult(s) === 'Fail');
  const allTested = o.steps.length > 0 && o.steps.every(s => stepResult(s) !== 'Not tested');
  const suggestion: TrackConclusion = anyFail ? 'Ineffective' : allTested ? 'Effective' : 'Not tested';
  const [testing, setTesting] = useState(false);
  const [newAttr, setNewAttr] = useState('');
  const [addingAttr, setAddingAttr] = useState(false);
  const wfCount = o.steps.filter(s => s.workflowName).length;
  const attCount = o.steps.filter(s => s.attestEnabled || s.attestation).length;

  const runAll = () => { setTesting(true); logEvent({ action: 'Run', description: `Tested all attributes for ${control.id}`, module: 'SOX ICFR', entity: 'Test Result' }); window.setTimeout(() => { testAllAttributes(control.id); setTesting(false); }, 2400); };

  if (locked) {
    return (
      <div className="p-5">
        <EmptyState icon={<Lock size={18} />} title="Operating effectiveness is locked" hint="Conclude the Test of Design as effective to unlock operating effectiveness testing. A control that isn’t designed effectively isn’t tested for operation.">
          <span className="inline-flex items-center gap-1.5 text-[0.75rem] text-ink-500"><span>Design is currently</span><TrackPill c={trackResult(control.design)} /></span>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="p-5">
      {/* sample context — extraction happens in step 2; this is read-only.
          Every control tests against a sample now, whatever its evidence mode. */}
      <div className="mb-5">
        {o.sampling ? (
          <div className="rounded-xl border border-canvas-border bg-paper-50/40 p-3 flex items-center gap-3 flex-wrap text-[0.71875rem] text-ink-500">
            <span className="inline-flex items-center gap-1.5 font-semibold text-ink-700"><FlaskConical size={12} /> Testing {o.sampling.size} sampled items</span>
            <span>{o.sampling.method} · {o.sampling.basis}</span>
            {o.population && <span className="text-ink-400">Population {o.population.count.toLocaleString()} · {o.population.tieOut}</span>}
          </div>
        ) : !isControlLocked(control) && (
          <div className="rounded-xl border border-dashed border-canvas-border p-3 text-[0.71875rem] text-ink-500 inline-flex items-center gap-1.5">
            <FlaskConical size={12} className="text-ink-400" /> No sample yet — extract and approve one in step 2 to test against sampled items.
          </div>
        )}
      </div>

      {/* attributes */}
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <h4 className="text-[0.78125rem] font-bold text-ink-700 inline-flex items-center gap-1.5"><ClipboardCheck size={14} /> Test attributes <span className="font-normal text-ink-400">· each evidenced independently</span></h4>
        <div className="flex items-center gap-2">
          <span className="text-[0.6875rem] text-ink-400 tabular-nums hidden md:inline">{wfCount} workflow · {attCount} attested · {prog.passed} pass · {prog.failed} fail</span>
          {canEdit && o.steps.length > 0 && <button disabled={testing} onClick={runAll} className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg bg-evidence-600 text-white text-[0.75rem] font-semibold enabled:hover:bg-evidence-700 disabled:opacity-70 transition-colors cursor-pointer">{testing ? <><Loader2 size={13} className="animate-spin" /> Testing…</> : <><PlayCircle size={14} /> Test attributes</>}</button>}
          {canEdit && <button onClick={() => setAddingAttr(a => !a)} className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.75rem] font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-700 cursor-pointer"><Plus size={13} /> Add</button>}
        </div>
      </div>
      {addingAttr && (
        <div className="flex items-center gap-2 mb-3">
          <input autoFocus value={newAttr} onChange={e => setNewAttr(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newAttr.trim()) { addAttribute(control.id, newAttr.trim()); logEvent({ action: 'Create', description: `Added test attribute to ${control.id}`, module: 'SOX ICFR', entity: 'Control' }); setNewAttr(''); setAddingAttr(false); } }} placeholder="e.g. Approval evidenced before the transaction posts" className="flex-1 h-9 px-3 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.78125rem] focus:outline-none focus:ring-2 focus:ring-brand-200" />
          <button disabled={!newAttr.trim()} onClick={() => { addAttribute(control.id, newAttr.trim()); logEvent({ action: 'Create', description: `Added test attribute to ${control.id}`, module: 'SOX ICFR', entity: 'Control' }); setNewAttr(''); setAddingAttr(false); }} className="h-9 px-3 rounded-lg bg-brand-600 text-white text-[0.75rem] font-semibold disabled:opacity-40 cursor-pointer">Add</button>
        </div>
      )}
      {o.steps.length === 0 ? (
        <EmptyState icon={<ClipboardCheck size={18} />} title="No test attributes yet" hint="Add the attributes that prove the control operated. Each attribute is evidenced on its own — map a workflow to automate it, or toggle self-attestation for manual evidence.">
          {canEdit && <button onClick={() => setAddingAttr(true)} className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[0.75rem] font-semibold hover:bg-brand-700 cursor-pointer"><Plus size={13} /> Add the first attribute</button>}
        </EmptyState>
      ) : (
        <div className="space-y-3 mb-1">{o.steps.map(s => <AttributeRow key={s.id} control={control} step={s} canEdit={canEdit} testing={testing && stepResult(s) === 'Not tested'} />)}</div>
      )}

      {/* no sample, no opinion — TOE can't conclude effective on an untested population */}
      {o.steps.length > 0 && <ConcludeFooter control={control} which="operating" suggestion={suggestion} canEdit={canEdit}
        disableEffective={!o.sampling}
        disableEffectiveNote={o.sampling ? undefined : 'Locked — extract and approve a sample in step 2 first'} />}
    </div>
  );
}

// ── vertical stepper step ─────────────────────────────────────────────────────────
// `hideStatus` suppresses the default pill/stamp + flash — used by the sample step,
// whose status drives the node visual only (a "Sample approved" chip rides in `right`).
function VStep({ n, title, subtitle, status, locked, right, children, defaultOpen = true, id, hideStatus }: { n: number; title: string; subtitle: string; status: TrackConclusion; locked?: boolean; right?: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean; id?: string; hideStatus?: boolean }) {
  const nodeClass = locked ? 'locked' : status === 'Effective' ? 'done' : status === 'Ineffective' ? 'fail' : 'active';
  const concluded = !hideStatus && (status === 'Effective' || status === 'Ineffective');
  const [open, setOpen] = useState(defaultOpen);
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
    <motion.div id={id} className="vstep" variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}>
      <div className="vstep-rail" />
      <div className={cn('vstep-node', nodeClass)}>{locked ? <Lock size={15} /> : status === 'Effective' ? <Check size={17} strokeWidth={3} /> : status === 'Ineffective' ? <X size={16} strokeWidth={3} /> : n}</div>
      <div className={cn('panel relative', locked && 'panel-locked')}>
        <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} title={open ? 'Collapse' : 'Expand'} className={cn('w-full flex items-start justify-between gap-3 px-5 pt-4 pb-3 text-left cursor-pointer transition-colors hover:bg-paper-50/40', open && 'border-b border-canvas-border')}>
          <div className="flex items-start gap-2.5 min-w-0">
            <ChevronDown size={16} className={cn('mt-0.5 text-ink-400 shrink-0 transition-transform', !open && '-rotate-90')} />
            <div className="min-w-0">
              <h3 className="text-[0.9375rem] font-bold text-ink-900">{title}</h3>
              {open && <p className="text-[0.71875rem] text-ink-500 mt-0.5 max-w-[520px]">{subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">{right}{hideStatus ? null : concluded ? <Stamp result={status as 'Effective' | 'Ineffective'} animate={false} /> : <TrackPill c={status} />}</div>
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div key="body" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: 'easeInOut' }} className="overflow-hidden">
              {children}
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>{flash && concluded && open && (
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
// the two hands on the working paper — auditor (purple/gavel) and risk owner (amber/check)
const EXEC_ROLE: Record<Role, { Icon: typeof Gavel; accent: string; chip: string; label: string }> = {
  auditor: { Icon: Gavel, accent: 'var(--color-brand-400)', chip: 'bg-brand-50 text-brand-700', label: 'Auditor' },
  'risk-owner': { Icon: UserCheck, accent: 'var(--color-mitigated-500)', chip: 'bg-mitigated-50 text-mitigated-700', label: 'Risk owner' },
  // our branch carries a third persona — the reviewer who countersigns
  reviewer: { Icon: UserCheck, accent: 'var(--color-evidence-500)', chip: 'bg-evidence-50 text-evidence-700', label: 'Reviewer' },
};
const TRACK_FILTERS = [{ id: 'all', label: 'All' }, { id: 'design', label: '① Design' }, { id: 'operating', label: '② Operating' }] as const;

function ExecResult({ result }: { result?: TestResult | TrackConclusion }) {
  if (!result || result === 'Not tested') return null;
  const pass = result === 'Pass' || result === 'Effective';
  return <span className="inline-flex items-center gap-1"><Tickmark result={pass ? 'Pass' : 'Fail'} size={13} /><span className={cn('text-[0.65625rem] font-bold', pass ? 'text-compliant-700' : 'text-risk-700')}>{result}</span></span>;
}

// ── execution history — the shared sign-off trail (both personas, both tracks) ─────
function ExecutionTrail({ control }: { control: Control }) {
  const { eng } = useIcfr();
  const [track, setTrack] = useState<'all' | 'design' | 'operating'>('all');
  const events = useMemo(
    () => eng.executions.filter(e => e.controlId === control.id && (track === 'all' || e.track === track)),
    [eng.executions, control.id, track],
  );
  return (
    <>
      <div className="px-3 pb-2 flex items-center gap-1">
        {TRACK_FILTERS.map(t => <button key={t.id} onClick={() => setTrack(t.id)} className={cn('h-7 px-2.5 rounded-md text-[0.71875rem] font-semibold transition-colors cursor-pointer', track === t.id ? 'bg-brand-600 text-white' : 'text-ink-500 hover:text-ink-800')}>{t.label}</button>)}
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {events.length === 0 ? (
          <div className="text-center text-[0.75rem] text-ink-400 py-10 px-4">No runs yet{track !== 'all' ? ` on the ${track} test` : ''}.<br />Execute a test of design or operating effectiveness — it shows up here for the auditor and the risk owner alike.</div>
        ) : (
          <div className="exec-trail space-y-2">
            {events.map(e => {
              const rm = EXEC_ROLE[e.role];
              const who = e.by.split(' · ')[0];
              return (
                <div key={e.id} className="flex gap-2.5">
                  <span className="exec-node" style={{ color: rm.accent }}><rm.Icon size={13} /></span>
                  <div className="exec-card flex-1 min-w-0" style={{ borderLeftColor: rm.accent }}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[0.75rem] text-ink-800 leading-snug"><b className="font-semibold">{who}</b> {e.verb}</span>
                      <span className="text-[0.65625rem] text-ink-400 shrink-0 mt-0.5">{e.at}</span>
                    </div>
                    {(e.target || e.result) && (
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {e.target && <span className="font-mono text-[0.65625rem] font-semibold text-ink-500 bg-paper-50 border border-canvas-border rounded px-1.5 h-[18px] inline-flex items-center max-w-full truncate">{e.target}</span>}
                        <ExecResult result={e.result} />
                      </div>
                    )}
                    <div className="mt-1.5 inline-flex items-center gap-1.5 text-[0.625rem] font-semibold uppercase tracking-wide text-ink-400">{e.track === 'design' ? '① Design' : '② Operating'}<span className={cn('normal-case tracking-normal rounded px-1.5 h-[16px] inline-flex items-center', rm.chip)}>{rm.label}</span></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function DiscussionPane({ control }: { control: Control }) {
  const { eng, role, addComment, resolveDiscussion } = useIcfr();
  const logEvent = useAuditLog();
  const [tab, setTab] = useState<DiscussionAnchor | 'all'>('all');
  const [text, setText] = useState('');
  const threads = useMemo(() => discussionsFor(eng, control.id).filter(d => tab === 'all' || d.anchor === tab), [eng, control.id, tab]);
  const postAnchor: DiscussionAnchor = tab === 'all' ? 'control' : tab;
  return (
    <>
      <div className="px-3 pb-2 flex items-center gap-1">
        {ANCHORS.map(a => <button key={a.id} onClick={() => setTab(a.id)} className={cn('h-7 px-2.5 rounded-md text-[0.71875rem] font-semibold transition-colors cursor-pointer', tab === a.id ? 'bg-brand-600 text-white' : 'text-ink-500 hover:text-ink-800')}>{a.label}</button>)}
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {threads.length === 0 && <div className="text-center text-[0.75rem] text-ink-400 py-10">No discussion here yet. Start a thread below — your role is tagged automatically.</div>}
        {threads.map(d => (
          <div key={d.id} className="space-y-2">
            <div className="flex items-center gap-2 text-[0.65625rem] font-semibold uppercase tracking-wide text-ink-400">{d.anchor === 'design' ? '① Design' : d.anchor === 'operating' ? '② Operating' : 'Control'}{d.resolved && <Pill tone="compliant">Resolved</Pill>}<button onClick={() => resolveDiscussion(d.id, !d.resolved)} className="ml-auto text-ink-400 hover:text-brand-700 normal-case cursor-pointer">{d.resolved ? 'reopen' : 'resolve'}</button></div>
            {d.comments.map(c => (
              <div key={c.id} className={cn('disc-bubble', c.role)}>
                <div className="flex items-center justify-between gap-2 mb-1"><span className="text-[0.71875rem] font-bold text-ink-800">{c.by}</span><span className="text-[0.65625rem] text-ink-400">{c.at}</span></div>
                <p className="text-[0.75rem] text-ink-700 leading-snug">{c.text}</p>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="p-3 border-t border-canvas-border">
        <div className="text-[0.65625rem] text-ink-400 mb-1.5">Posting to <b className="text-ink-600">{postAnchor === 'control' ? 'Control' : postAnchor === 'design' ? '① Design' : '② Operating'}</b> as <b className="text-ink-600 capitalize">{role}</b></div>
        <div className="flex items-end gap-2">
          <textarea value={text} onChange={e => setText(e.target.value)} rows={2} placeholder="Add a comment or ask the risk owner…" className="flex-1 text-[0.75rem] rounded-lg border border-canvas-border bg-canvas-elevated px-2.5 py-2 text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-200 resize-none" />
          <button disabled={!text.trim()} onClick={() => { addComment(control.id, postAnchor, text.trim()); logEvent({ action: 'Create', description: `Posted comment on ${control.id}`, module: 'SOX ICFR', entity: 'Comment' }); setText(''); }} className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-lg bg-brand-600 text-white disabled:opacity-40 enabled:hover:bg-brand-700 transition-colors cursor-pointer"><Send size={15} /></button>
        </div>
      </div>
    </>
  );
}

// right rail — the collaboration surfaces: what was done (History) and what was said (Discussion)
function ActivityRail({ control }: { control: Control }) {
  const { eng } = useIcfr();
  const [pane, setPane] = useState<'history' | 'discussion'>('history');
  const execCount = eng.executions.filter(e => e.controlId === control.id).length;
  const openDisc = discussionsFor(eng, control.id).filter(d => !d.resolved).length;
  const tabCls = (on: boolean) => cn('flex-1 h-8 rounded-lg text-[0.75rem] font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer', on ? 'bg-canvas-elevated text-brand-700 shadow-[0_1px_4px_-1px_rgba(15,8,30,0.18)] ring-1 ring-canvas-border' : 'text-ink-500 hover:text-ink-800');
  return (
    <aside className="panel sticky top-20 self-start max-h-[calc(100vh-7rem)] flex flex-col">
      <div className="flex items-center gap-1 p-1 m-3 mb-2 rounded-xl bg-paper-50 border border-canvas-border">
        <button onClick={() => setPane('history')} className={tabCls(pane === 'history')}><History size={13} /> History{execCount > 0 && <span className="text-[0.625rem] tabular-nums opacity-70">{execCount}</span>}</button>
        <button onClick={() => setPane('discussion')} className={tabCls(pane === 'discussion')}><MessageSquare size={13} /> Discussion{openDisc > 0 && <span className="text-[0.625rem] tabular-nums opacity-70">{openDisc}</span>}</button>
      </div>
      {pane === 'history' ? <ExecutionTrail control={control} /> : <DiscussionPane control={control} />}
    </aside>
  );
}

// ── the dossier ──────────────────────────────────────────────────────────────────
export default function ControlDossier() {
  const { eng, role, selectedControlId, back, setView } = useIcfr();
  const logEvent = useAuditLog();
  // preview-before-download for this control's working paper
  const [wpPreview, setWpPreview] = useState(false);
  const control = eng.controls.find(c => c.id === selectedControlId);
  if (!control) return <div className="text-ink-500">Control not found. <button onClick={back} className="text-brand-700 font-semibold">Back to register</button></div>;
  // Both personas can now execute TOD and TOE; the shared trail records who did what.
  const canEdit = role === 'auditor' || role === 'risk-owner';
  const concl = controlConclusion(control);
  const designResult = trackResult(control.design);
  const opResult = trackResult(control.operating);
  const toeLocked = designResult !== 'Effective';

  return (
    <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.03 } } }}>
      {/* no local Back button — the breadcrumb above (always rendered by
          SoxIcfrApp for the dossier view) already carries ← and the trail */}

      {/* leadsheet header */}
      <motion.div className="leadsheet mb-5" variants={{ hidden: { opacity: 0, y: 14, scale: 0.99 }, show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } } }}>
        <div className="leadsheet-head">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                {control.isKey && <Pill tone="mitigated">Key control</Pill>}
                <NatureChip nature={control.nature} /><Pill tone="draft">{control.type}</Pill><Pill tone="draft">{control.frequency}</Pill>
                <span className="text-[0.6875rem] text-ink-400 font-mono">{control.id}</span>
              </div>
              {/* Heading = the one-line control statement, same text the RACM
                  and register show. Under it the RACM's Control Activity — who
                  performs it, on what, when and how. Precision used to sit here
                  and was a restatement of the heading, so it read as the title
                  printed twice; it still carries into the working paper. */}
              <h1 className="leadsheet-title text-[1.25rem] text-ink-900 leading-snug max-w-[640px]">{control.description}</h1>
              {control.controlActivity && (
                <p className="text-[0.78125rem] text-ink-500 mt-1.5 max-w-[680px] leading-relaxed">
                  <b className="text-ink-700 font-semibold">Control activity —</b> {control.controlActivity}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-3 text-[0.71875rem] text-ink-500">
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
            <span className="text-[0.71875rem] font-semibold text-ink-400 uppercase tracking-wide">Overall status</span>
            {concl === 'Effective' || concl === 'Ineffective' ? <Stamp result={concl} animate={false} /> : <ConclusionPill c={concl} />}
            <span className="w-px h-4 bg-canvas-border" />
            <span className="text-[0.71875rem] text-ink-400 inline-flex items-center gap-1.5"><Tickmark result={designResult === 'Effective' ? 'Pass' : designResult === 'Ineffective' ? 'Fail' : 'Not tested'} size={14} /> Design {designResult}</span>
            <ChevronRight size={13} className="text-ink-300" />
            <span className="text-[0.71875rem] text-ink-400 inline-flex items-center gap-1.5"><Tickmark result={opResult === 'Effective' ? 'Pass' : opResult === 'Ineffective' ? 'Fail' : 'Not tested'} size={14} /> Operating {toeLocked ? 'locked' : opResult}</span>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => setWpPreview(true)} className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border border-canvas-border text-[0.75rem] font-semibold text-ink-600 hover:text-ink-900 hover:border-ink-300 transition-colors cursor-pointer"><FileSpreadsheet size={13} /> Working paper</button>
              <span className="text-[0.6875rem] text-ink-400 inline-flex items-center gap-1">Auditor &amp; risk owner both test · every run is logged in History</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* control health — the design-step RAG trio, above the stepper (the
          engagement-wide trio lives on the Overview tab). No wrapper card: the
          three meters are already cards, and a box around cards drew a group
          boundary the page didn't need. */}
      <motion.div className="mb-5" variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}>
        <RagStrip meters={designRagMeters(control)} />
      </motion.div>

      {/* stepper + discussion */}
      <div className="grid grid-cols-[minmax(0,1fr)_360px] gap-5 items-start">
        <motion.div className="vstepper" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1, delayChildren: 0.08 } } }}>
          <VStep n={1} title="Test of design" subtitle="Is the control designed to prevent or detect the risk? Grounded in the documents and walkthrough — each consideration validated by a workflow." status={designResult}>
            <DesignSection control={control} canEdit={canEdit} />
          </VStep>
          <VStep n={2} title="Extract sample" subtitle="Pull the testing sample out of the population — add the population and transaction files, explain the extraction logic, then approve it for testing." hideStatus
            status={toeLocked ? 'Not tested' : control.operating.sampling ? 'Effective' : 'Not tested'} locked={toeLocked}
            right={toeLocked
              ? <span className="text-[0.6875rem] font-semibold text-ink-400 inline-flex items-center gap-1"><Lock size={11} /> Unlocks after design</span>
              : control.operating.sampling
                ? <span className="text-[0.6875rem] font-bold text-compliant-700 inline-flex items-center gap-1"><CheckCircle2 size={12} /> Sample approved · {control.operating.sampling.size} items</span>
                : <span className="text-[0.6875rem] font-semibold text-ink-400">Awaiting extraction</span>}>
            <SampleExtractSection control={control} canEdit={canEdit} locked={toeLocked} />
          </VStep>
          <VStep n={3} id="vstep-toe" title="Test of operating effectiveness" subtitle="Did the control operate as designed across the period? Each attribute is evidenced on its own — by its workflow, or self-attested." status={toeLocked ? 'Not tested' : opResult} locked={toeLocked}
            right={toeLocked ? <span className="text-[0.6875rem] font-semibold text-ink-400 inline-flex items-center gap-1"><Lock size={11} /> Unlocks after design</span> : undefined}>
            <OperatingSection control={control} canEdit={canEdit} locked={toeLocked} />
          </VStep>
          {concl === 'Ineffective' && (
            <motion.div variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }} className="ml-[54px] rounded-xl border border-risk-200 bg-risk-50/40 p-4 mt-1">
              <div className="flex items-center gap-2 mb-1"><AlertTriangle size={15} className="text-risk-700" /><h3 className="text-[0.8125rem] font-bold text-risk-700">Deficiency raised</h3></div>
              <p className="text-[0.75rem] text-ink-600">This control concluded ineffective. Assess severity (likelihood × magnitude) and remediation in <button onClick={() => setView('deficiencies')} className="font-semibold text-risk-700 hover:underline inline-flex items-center gap-0.5">Deficiencies <ChevronRight size={12} /></button>.</p>
            </motion.div>
          )}
        </motion.div>
        <motion.div variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}><ActivityRail control={control} /></motion.div>
      </div>

      {wpPreview && (
        <WorkingPaperModal eng={eng} control={control} onClose={() => setWpPreview(false)}
          onDownload={() => logEvent({ action: 'Export', description: `Exported working paper for ${control.id}`, module: 'SOX ICFR', entity: 'Control' })} />
      )}
    </motion.div>
  );
}
