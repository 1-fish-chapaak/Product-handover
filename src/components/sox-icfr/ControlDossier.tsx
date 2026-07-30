import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText, Upload, MessageSquare, Workflow as WorkflowIcon, Hand, AlertTriangle,
  Send, Lock, ClipboardCheck, FileCheck2, FlaskConical, CheckCircle2, XCircle,
  CornerDownRight, Pencil, RotateCcw, Cpu, ChevronRight, Scale, Paperclip, Plus, Trash2,
  Mail, X, Loader2, ChevronDown, Check, PlayCircle, Link2, ListChecks, Gavel, UserCheck, History, FileUp, ArrowLeft, Footprints, BadgeCheck, Star,
  Database, Dices, Circle, PenLine, Eye,
} from 'lucide-react';
import { useIcfr } from './store';
import { useAuditLog } from '../../context/AdminDataContext';
import {
  controlConclusion, courtFor, designCompleteness, designOutstanding, discussionsFor, formatINR,
  isControlLocked, itgcHolds, operatingProgress, populationLocked, sampleSizeGuide, trackResult, pointResult, stepResult,
  countVerdict, coverageVerdict, derivedRunCount, populationReady, type PopVerdict,
} from './helpers';
import { programmeFor } from './auditScope';
import { ConclusionPill, CourtBadge, NatureChip, Toggle, TrackPill, Tickmark, Stamp, RagStrip, type RagMeterDef } from './parts';
import { Pill } from '../shared/StatusBadge';
import { useToast } from '../shared/Toast';
import { Sparkles, FileSpreadsheet } from 'lucide-react';
import WorkingPaperModal from './WorkingPaperModal';
import { cn } from '../../lib/cn';
import { DESIGN_DOC_KINDS, DESIGN_WAIVER_REASONS, EXPOSURE_LABEL, exposureTotal, FIVE_W_1H, GAP_LABEL, ipeSuggestion, ROUND_TAG } from './types';
import { sampleRefs } from './mockData';
import type {
  AuditRound, Control, DesignDoc, DesignDocKind, DesignPoint, DesignWaiverReason, DiscussionAnchor, DocStatus, Exposure, OperatingStep,
  Role, Sampling, TestResult, TrackConclusion, ValidationResult,
} from './types';

// Short button labels for the waiver reasons — the stored reason is the full
// sentence in types.ts; these are what fits on a button.
const WAIVER_BTN: Record<DesignWaiverReason, string> = {
  'Prepared by the audit team': 'Audit team prepared it',
  'Held by the client — inspected in situ': 'Inspected at the client',
  'Not applicable — design tested off the control description': 'Not applicable',
};

const DOC_TONE: Record<DocStatus, string> = { Received: 'text-compliant-700', Requested: 'text-mitigated-700', Missing: 'text-ink-400' };
export const WORKFLOW_LIBRARY = ['Three-way match check', 'Approval-tier check', 'Duplicate-invoice detection', 'Segregation-of-duties scan', 'Timeliness / cut-off check', 'Reconciliation completeness', 'Access review', 'Tolerance-breach monitor'];

// ── primitives ───────────────────────────────────────────────────────────────────
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
export function Dropdown({ trigger, children }: { trigger: React.ReactNode; children: (close: () => void) => React.ReactNode }) {
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
export const menuItem = 'w-full text-left px-2.5 py-1.5 rounded-lg text-[0.78125rem] text-ink-700 hover:bg-paper-50 cursor-pointer flex items-center gap-2';

// ── request-data modal (TOD) ──────────────────────────────────────────────────────
function RequestDataModal({ control, onClose }: { control: Control; onClose: () => void }) {
  const { requestDataByEmail } = useIcfr();
  const logEvent = useAuditLog();
  const { addToast } = useToast();
  // pre-select what's genuinely outstanding — a waived element isn't chased
  const [sel, setSel] = useState<Set<string>>(() => new Set(control.design.documents.filter(d => d.status !== 'Received' && !d.waiver).map(d => d.id)));
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
                    <span className="min-w-0 flex-1"><span className="text-[0.78125rem] font-semibold text-ink-800">{d.kind}</span><span className="text-[0.6875rem] text-ink-400 ml-2">{d.waiver ? 'Waived' : d.status}</span></span>
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
                Draw a sample in step ③ and re-pull the run to see it item by item.
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

// ── key control — a judgement, so it is set here rather than displayed ────────────
// Key/non-key cannot come from an SOP; it is agreed with management. The reviewer
// asked for it to be editable at every control level. Only the auditor sets it,
// and a concluded control refuses the patch — so the switch shows itself shut
// rather than accepting a click that changes nothing.
export function KeyControlChip({ control, canEdit }: { control: Control; canEdit: boolean }) {
  const { role, updateControlMeta } = useIcfr();
  const logEvent = useAuditLog();
  const locked = isControlLocked(control);
  const settable = canEdit && role === 'auditor';
  if (!settable) return control.isKey ? <Pill tone="mitigated">Key control</Pill> : null;
  return (
    <button disabled={locked}
      title={locked ? 'The control is concluded — reopen it to change the key judgement'
        : control.isKey ? 'Key control, agreed with management — click to make it non-key'
        : 'Non-key control — click to mark it key'}
      onClick={() => { updateControlMeta(control.id, { isKey: !control.isKey }); logEvent({ action: 'Update', description: `${control.isKey ? 'Unmarked' : 'Marked'} ${control.id} as a key control`, module: 'SOX ICFR', entity: 'Control' }); }}
      className={cn('inline-flex items-center gap-1 h-[22px] px-2 rounded-full border text-[0.6875rem] font-semibold transition-colors',
        control.isKey ? 'border-mitigated-200 bg-mitigated-50 text-mitigated-700' : 'border-canvas-border bg-canvas-elevated text-ink-500',
        locked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:border-mitigated-300')}>
      <Star size={10} className={control.isKey ? 'fill-mitigated-300' : ''} />
      {control.isKey ? 'Key control' : 'Non-key'}
      {locked && <Lock size={9} />}
    </button>
  );
}

// ── walkthrough — the design tested against ONE transaction ───────────────────────
// The reviewer's model: design and operating test the SAME attributes, and only
// the sample behind them differs. So this card reads the operating track's
// attributes and records a result per attribute against one walked transaction.
// Attributes can be added from here, because a walkthrough with nothing to prove
// is the state the tool used to leave people in.
function WalkthroughCard({ control, canEdit }: { control: Control; canEdit: boolean }) {
  const { startWalkthrough, setWalkthroughAttribute, setWalkthroughMeta, addAttribute } = useIcfr();
  const logEvent = useAuditLog();
  const w = control.design.walkthrough;
  const steps = control.operating.steps;
  const [attendee, setAttendee] = useState('');
  const [newAttr, setNewAttr] = useState('');
  const [addingAttr, setAddingAttr] = useState(false);

  if (!w) {
    return (
      <div className="subcard px-3.5 py-3 mb-5">
        <div className="flex items-start gap-3">
          <Footprints size={15} className="text-ink-400 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <div className="text-[0.78125rem] font-semibold text-ink-800">Walkthrough not started</div>
            <p className="text-[0.6875rem] text-ink-500 mt-0.5 leading-relaxed">
              Walk one transaction with the control owner and prove the same attributes the sample will test.
              The transaction, who attended and what each attribute showed are what the working paper prints.
            </p>
          </div>
          {canEdit && (
            <button onClick={() => { startWalkthrough(control.id); logEvent({ action: 'Create', description: `Started the walkthrough for ${control.id}`, module: 'SOX ICFR', entity: 'Control' }); }}
              className="h-8 px-3 shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[0.75rem] font-semibold hover:bg-brand-700 transition-colors cursor-pointer">
              <Footprints size={13} /> Start walkthrough
            </button>
          )}
        </div>
      </div>
    );
  }

  const tested = steps.filter(s => (w.attributeResults[s.id] ?? 'Not tested') !== 'Not tested').length;
  const failed = steps.filter(s => w.attributeResults[s.id] === 'Fail').length;

  return (
    <div className="subcard px-3.5 py-3 mb-5">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-2.5">
        <h5 className="text-[0.78125rem] font-bold text-ink-700 inline-flex items-center gap-1.5">
          <Footprints size={14} /> Walkthrough
          <span className="font-normal text-ink-400">· one transaction, the same attributes the sample tests</span>
        </h5>
        <span className="inline-flex items-center gap-1.5">
          <span className="text-[0.65625rem] font-semibold text-ink-500 bg-paper-50/70 border border-canvas-border rounded px-1.5 h-[18px] inline-flex items-center">{w.sampleRef}</span>
          {steps.length > 0 && <Pill tone={failed > 0 ? 'risk' : tested === steps.length ? 'compliant' : 'draft'}>{tested}/{steps.length} attributes</Pill>}
        </span>
      </div>

      {/* who walked it, when, and who was in the room — captured once, printed once */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
        <label className="block">
          <span className="text-[0.625rem] font-bold uppercase tracking-wide text-ink-400">Performed by</span>
          <input value={w.tester} disabled={!canEdit} onChange={e => setWalkthroughMeta(control.id, { tester: e.target.value })}
            className="mt-0.5 w-full h-8 px-2.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.75rem] text-ink-800 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-brand-200" />
        </label>
        <label className="block">
          <span className="text-[0.625rem] font-bold uppercase tracking-wide text-ink-400">Date walked</span>
          <input value={w.date} disabled={!canEdit} onChange={e => setWalkthroughMeta(control.id, { date: e.target.value })}
            className="mt-0.5 w-full h-8 px-2.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.75rem] text-ink-800 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-brand-200" />
        </label>
      </div>
      <div className="mb-3">
        <span className="text-[0.625rem] font-bold uppercase tracking-wide text-ink-400">Attended by (client)</span>
        <div className="flex items-center gap-1.5 flex-wrap mt-1">
          {w.attendees.map(a => (
            <span key={a} className="inline-flex items-center gap-1 text-[0.65625rem] font-medium text-ink-700 bg-paper-50/70 border border-canvas-border rounded px-1.5 h-[20px]">
              <UserCheck size={9} className="shrink-0" />{a}
              {canEdit && <button onClick={() => setWalkthroughMeta(control.id, { attendees: w.attendees.filter(x => x !== a) })} aria-label={`Remove ${a}`} className="text-ink-400 hover:text-risk-600 cursor-pointer"><X size={9} /></button>}
            </span>
          ))}
          {canEdit && (
            <input value={attendee} onChange={e => setAttendee(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && attendee.trim()) { setWalkthroughMeta(control.id, { attendees: [...w.attendees, attendee.trim()] }); setAttendee(''); } }}
              placeholder={w.attendees.length ? 'Add another…' : 'Name, then Enter'} aria-label="Add an attendee"
              className="h-[22px] px-2 w-[150px] rounded border border-canvas-border bg-canvas-elevated text-[0.65625rem] focus:outline-none focus:ring-2 focus:ring-brand-200" />
          )}
          {!canEdit && w.attendees.length === 0 && <span className="text-[0.65625rem] text-ink-400">Not recorded</span>}
        </div>
      </div>

      {/* the attributes — the same list the sample will test */}
      {steps.length === 0 ? (
        <div className="text-[0.71875rem] text-mitigated-700 bg-mitigated-50/60 border border-mitigated-200 rounded-lg px-3 py-2 flex items-start gap-1.5">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span>No test attributes defined yet — without attributes there is nothing for the walkthrough to prove, and nothing for the sample to test either. Add them below; they serve both tracks.</span>
        </div>
      ) : (
        <div className="space-y-1.5">
          {steps.map(s => {
            const r = w.attributeResults[s.id] ?? 'Not tested';
            return (
              <div key={s.id} className="flex items-start gap-2.5 py-1.5 px-2.5 rounded-lg border border-canvas-border bg-canvas-elevated">
                <Tickmark result={r} size={17} />
                <div className="min-w-0 flex-1">
                  <span className="text-[0.75rem] text-ink-800">{s.description}</span>
                  <span className="text-[0.65625rem] text-ink-400 ml-1.5">({s.code} · {s.assertion})</span>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setWalkthroughAttribute(control.id, s.id, 'Pass')}
                      className={cn('h-7 px-2 inline-flex items-center gap-1 rounded-md border text-[0.6875rem] font-semibold transition-colors cursor-pointer', r === 'Pass' ? 'bg-compliant-50 border-compliant-300 text-compliant-700' : 'border-canvas-border bg-canvas-elevated text-ink-600 hover:border-compliant-300 hover:text-compliant-700')}><CheckCircle2 size={12} /> Pass</button>
                    <button onClick={() => setWalkthroughAttribute(control.id, s.id, 'Fail')}
                      className={cn('h-7 px-2 inline-flex items-center gap-1 rounded-md border text-[0.6875rem] font-semibold transition-colors cursor-pointer', r === 'Fail' ? 'bg-risk-50 border-risk-300 text-risk-700' : 'border-canvas-border bg-canvas-elevated text-ink-600 hover:border-risk-300 hover:text-risk-700')}><XCircle size={12} /> Fail</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* attributes are defined once and used by both tracks, so they can be
          added from here as well as from step 3 */}
      {canEdit && (addingAttr ? (
        <div className="flex items-center gap-2 mt-2">
          <input autoFocus value={newAttr} onChange={e => setNewAttr(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') { setAddingAttr(false); setNewAttr(''); }
              if (e.key === 'Enter' && newAttr.trim()) { addAttribute(control.id, newAttr.trim()); logEvent({ action: 'Create', description: `Added test attribute to ${control.id}`, module: 'SOX ICFR', entity: 'Control' }); setNewAttr(''); setAddingAttr(false); }
            }}
            placeholder="e.g. Approval evidenced before the transaction posts"
            className="flex-1 h-8 px-3 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.75rem] focus:outline-none focus:ring-2 focus:ring-brand-200" />
          <button disabled={!newAttr.trim()} onClick={() => { addAttribute(control.id, newAttr.trim()); logEvent({ action: 'Create', description: `Added test attribute to ${control.id}`, module: 'SOX ICFR', entity: 'Control' }); setNewAttr(''); setAddingAttr(false); }}
            className="h-8 px-3 rounded-lg bg-brand-600 text-white text-[0.71875rem] font-semibold disabled:opacity-40 cursor-pointer">Add</button>
        </div>
      ) : (
        <button onClick={() => setAddingAttr(true)} className="mt-2 h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md border border-canvas-border bg-canvas-elevated text-[0.71875rem] font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-700 cursor-pointer"><Plus size={12} /> Add attribute</button>
      ))}

      <label className="block mt-3">
        <span className="text-[0.625rem] font-bold uppercase tracking-wide text-ink-400">What the walkthrough showed</span>
        <textarea rows={2} value={w.notes ?? ''} disabled={!canEdit} onChange={e => setWalkthroughMeta(control.id, { notes: e.target.value })}
          placeholder="How the transaction actually moved, and anything the narrative doesn't say."
          className="mt-0.5 w-full px-2.5 py-2 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.75rem] text-ink-800 placeholder:text-ink-400 resize-none disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-brand-200" />
      </label>
    </div>
  );
}

// ── design judgements — the questions the working paper has to answer ─────────────
// Not evidence, and not a conclusion: the four judgements a reviewer expects to
// find stated. Does the control description answer the six questions; if this
// control fails, does anything else catch it; is the frequency right for the risk;
// is preventive-or-detective the right shape. Left blank they print as "not
// stated", which is honest — but they no longer print as though never asked.
/** The two things the design conclusion has to state besides effective-or-not:
 *  is the control actually in operation, and what does the conclusion rest on.
 *
 *  The basis field is the honest-paper field. A design called effective off the
 *  narrative and a conversation is a different animal from one walked end to end,
 *  and while the walkthrough is parked this is what stops the paper claiming the
 *  stronger of the two. */
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
    <button onClick={() => setStepResult(control.id, step.id, target)}
      className={cn('h-8 px-2.5 inline-flex items-center gap-1 rounded-lg border text-[0.75rem] font-semibold transition-colors cursor-pointer', on ? tone : 'border-canvas-border bg-canvas-elevated text-ink-600 hover:border-ink-300 hover:text-ink-900')}><Icon size={13} />{label}</button>
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
  const { addDesignDoc, attachDesignEvidence, removeDesignDoc, waiveDesignDoc, clearDesignWaiver, addDesignPoint, validateDesignPoint } = useIcfr();
  const logEvent = useAuditLog();
  const d = control.design;
  const [modal, setModal] = useState(false);
  // which element is being waived — one at a time, same shape as the override form
  const [waiving, setWaiving] = useState<string | null>(null);
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
  const docsIn = d.documents.filter(x => x.status === 'Received').length;
  const unvalidated = d.points.filter(p => pointResult(p) === 'Not tested').length;
  // outstanding = neither evidenced nor waived. A waived element is accounted for,
  // so it must not read as missing or push the suggestion to Ineffective.
  const missing = designOutstanding(control);
  // Soft gate: once the auditor commits to walking a transaction, every attribute
  // has to be settled. Before that the walkthrough doesn't hold anything up.
  // Parked with the walkthrough card — nothing reads it while that card is hidden.
  // const walkPending = walkthroughUntested(control);   // helpers.ts
  // A failed walkthrough attribute is a design failure in the reviewer's model —
  // the control as built didn't do what it claims on a real transaction.
  const walkFailed = d.walkthrough ? control.operating.steps.some(s => d.walkthrough!.attributeResults[s.id] === 'Fail') : false;
  const suggestion: TrackConclusion = d.documents.length === 0 && d.points.length === 0 ? 'Not tested'
    : missing.length > 0 || walkFailed || d.points.some(p => pointResult(p) === 'Fail') ? 'Ineffective'
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
                  <div key={doc.id}>
                  <div className={cn('doc-row', doc.status === 'Received' && '!border-compliant-200', doc.waiver && doc.status !== 'Received' && '!border-evidence-200')}>
                    {busy ? <Loader2 size={15} className="animate-spin text-brand-600 shrink-0" />
                      : doc.waiver && doc.status !== 'Received' ? <BadgeCheck size={15} className="shrink-0 text-evidence-600" />
                      : <FileCheck2 size={15} className={cn('shrink-0', DOC_TONE[doc.status])} />}
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
                      ) : doc.waiver ? (
                        <div className="text-[0.6875rem] text-evidence-700 mt-0.5 flex items-start gap-1">
                          <CornerDownRight size={11} className="mt-0.5 shrink-0" />
                          <span><span className="font-semibold">{doc.waiver.reason}</span> — {doc.waiver.note} <span className="text-ink-400">· {doc.waiver.by}, {doc.waiver.at}</span></span>
                        </div>
                      ) : (
                        <div className="text-[0.6875rem] text-ink-400 mt-0.5 truncate">{busy ? 'Uploading evidence…' : doc.status === 'Requested' ? 'Requested from the control owner' : 'No evidence attached yet'}</div>
                      )}
                    </div>
                    <Pill tone={doc.status === 'Received' ? 'compliant' : doc.waiver ? 'evidence' : doc.status === 'Requested' ? 'mitigated' : 'draft'}>{doc.status === 'Received' ? 'Evidenced' : doc.waiver ? 'Waived' : doc.status}</Pill>
                    {canEdit && <div className="flex items-center gap-1">
                      {doc.status !== 'Received' && !doc.waiver && <button disabled={busy} onClick={() => setWaiving(x => x === doc.id ? null : doc.id)} title="Account for this element without a file" className="h-7 px-2.5 text-[0.71875rem] font-semibold rounded-md border border-canvas-border bg-canvas-elevated text-ink-600 hover:text-evidence-700 hover:border-evidence-300 disabled:opacity-50 inline-flex items-center gap-1 cursor-pointer"><BadgeCheck size={11} /> Not applicable</button>}
                      {doc.waiver && <button onClick={() => clearDesignWaiver(control.id, doc.id)} title="Remove the waiver — the element is required again" className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-canvas-border bg-canvas-elevated text-ink-400 hover:border-brand-300 hover:text-brand-700 cursor-pointer"><RotateCcw size={12} /></button>}
                      {doc.status !== 'Received' && <button disabled={busy} onClick={() => attach(doc)} className="h-7 px-2.5 text-[0.71875rem] font-semibold rounded-md border border-canvas-border bg-canvas-elevated text-ink-600 hover:text-compliant-700 hover:border-compliant-300 disabled:opacity-50 inline-flex items-center gap-1 cursor-pointer"><Upload size={11} /> Attach evidence</button>}
                      {doc.status === 'Received' && <button disabled={busy} onClick={() => attach(doc)} title="Attach another file" className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-canvas-border bg-canvas-elevated text-ink-400 hover:border-brand-300 hover:text-brand-700 cursor-pointer"><Plus size={12} /></button>}
                      <button onClick={() => { removeDesignDoc(control.id, doc.id); logEvent({ action: 'Delete', description: `Removed design element from ${control.id}`, module: 'SOX ICFR', entity: 'Control' }); }} title="Remove" className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-canvas-border bg-canvas-elevated text-ink-400 hover:border-risk-300 hover:text-risk-600 cursor-pointer"><Trash2 size={12} /></button>
                    </div>}
                  </div>
                  {/* the waiver is a judgement, so it takes a rationale — the reason
                      picked is the button pressed */}
                  {waiving === doc.id && (
                    <RationaleForm title={`Why won’t ${docLabel(doc)} be provided? The working paper prints this.`} onCancel={() => setWaiving(null)}
                      buttons={DESIGN_WAIVER_REASONS.map(r => ({
                        label: WAIVER_BTN[r],
                        onClick: (n: string) => {
                          waiveDesignDoc(control.id, doc.id, r, n);
                          logEvent({ action: 'Update', description: `Waived design element (${r}) on ${control.id}`, module: 'SOX ICFR', entity: 'Control' });
                          setWaiving(null);
                        },
                      }))} />
                  )}
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
          {d.points.length === 0 ? <p className="text-[0.75rem] text-ink-400 mb-5">No considerations yet — add the design points you’ll assess in the walkthrough.</p> : (
            <div className="space-y-2 mb-5">{d.points.map(p => <PointRow key={p.id} control={control} point={p} canEdit={canEdit} />)}</div>
          )}

          {/* the walkthrough — the design proved on one live transaction.
              Parked 30 Jul (user ask): hidden from TOD. WalkthroughCard and
              its helper stay in place, and the conclude gate below
              drops its walkthrough clause to match — a gate the tester can't
              see is a gate they can't clear.
          <WalkthroughCard control={control} canEdit={canEdit} /> */}

          {/* What the conclusion rests on, DERIVED rather than asked: a control
              with a traced transaction was walked; one without was read. Nobody
              types this, so nobody can overstate it. */}
          <p className="mt-3 text-[0.71875rem] text-ink-500 leading-relaxed">
            <span className="text-ink-400">Basis</span> · {control.design.walkthrough
              ? <>one transaction traced end-to-end on <span className="font-mono text-ink-700">{control.design.walkthrough.sampleRef}</span>, plus the documents</>
              : <>the documents on file — no transaction traced</>}
            <span className="text-ink-300"> · </span>
            <span className="text-ink-400">In operation</span> · {control.design.walkthrough ? 'yes — seen running on a live transaction' : docsIn > 0 ? 'evidenced by the documents on file' : 'not yet evidenced'}
          </p>

          {missing.length > 0 && <div className="mt-3 text-[0.71875rem] text-mitigated-700 bg-mitigated-50/60 border border-mitigated-200 rounded-lg px-3 py-2 inline-flex items-center gap-1.5"><AlertTriangle size={13} /> {missing.length} element{missing.length > 1 ? 's' : ''} outstanding — attach evidence, request it from the control owner, or mark it not applicable.</div>}
          {/* Effective needs every gate: evidence accounted for, every design check
              validated — an unvalidated check is an untested opinion — the control
              confirmed in operation, and the basis on the record. Inquiry-only
              considerations WARN rather than block here (the standard treats a
              walkthrough's inquiry and observation as ordinarily sufficient for
              design); operating is where inquiry alone actually refuses. */}
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

// ── sample extraction (step ③) — attributes → ITGC gate → size/method/seed → gate 2 ───
/** Deterministic mock row facts so filters and specs are stable across runs. */
function sampleRowFacts(i: number): { date: string; amountL: number } {
  const MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
  const day = ((i * 7) % 27) + 1;
  const amountL = 8 + ((i * 37) % 190); // ₹ lakh, 8–197
  return { date: `${day} ${MONTHS[(i * 5) % 12]} FY26`, amountL };
}

/** What the sample step still asks for. The population moved to step ① — it is
 *  locked before anything is drawn from it — so all that is left here is the
 *  transaction detail each drawn item is tested against. */
const REQUIRED_SAMPLE_FILES: { id: 'txn'; name: string; formats: string; tag: string }[] = [
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

// ── IPE gate 1 (inside step ①) — the entity-produced report is itself under test ──

/** Files this engagement already holds — the scoping trial balances, the open
 *  audit's own GL, the RACM uploads. Shared by step ①'s source picker and the
 *  sample step, because both are asking for data the engagement usually has. */
function useEngagementFiles(): { name: string; kind: string; rows: number; from: string }[] {
  const { eng, racmDocs, openAuditId } = useIcfr();
  return useMemo(() => {
    // programmeFor, not PROGRAMMES: the Altura group's record lives in the V2
    // store, and reading only the classic one leaves this list empty.
    const prog = programmeFor(eng.id);
    const out: { name: string; kind: string; rows: number; from: string }[] = [];
    const audit = eng.audits.find(a => a.id === openAuditId);
    audit?.files.forEach(f => out.push({
      name: f.name, kind: f.kind === 'tb' ? 'Trial balance' : 'General ledger',
      rows: f.kind === 'tb' ? 1240 : 18432, from: `${audit.period} audit`,
    }));
    prog?.entities.forEach((en: { name: string; tbFile?: string; tbLines?: number }) => {
      if (en.tbFile) out.push({ name: en.tbFile, kind: 'Trial balance', rows: en.tbLines ?? 1240, from: `${en.name} · engagement scoping` });
    });
    if (prog) out.push({ name: `general_ledger_${prog.fy}.csv`, kind: 'General ledger', rows: 18432, from: 'Engagement scoping' });
    racmDocs.forEach(d => out.push({ name: d.name, kind: 'RACM / SOP', rows: 480, from: d.process ? `${d.process} RACM` : 'RACM page' }));
    // A file can reach the list twice (an audit TB that is also the scoping TB).
    return out.filter((f, i) => out.findIndex(x => x.name === f.name) === i);
  }, [eng.id, eng.audits, openAuditId, racmDocs]);
}

/** '2026-01-31' → '31 Jan 2026'. Left alone if it isn't a date. */
function shortDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** One thing the application checked for itself.
 *
 *  There is no tick box here on purpose. The row states what the numbers say and
 *  the auditor either accepts it or writes down why it is wrong — which is a
 *  fact on the paper, where a tick was only ever a signature standing in for a
 *  calculation somebody else had already done. */
function VerdictRow({ label, v, note, canWrite, placeholder, onNote, onRefilter, children }: {
  label: string; v: PopVerdict | null; note?: string; canWrite: boolean; placeholder: string;
  onNote: (t: string) => void; onRefilter?: () => void; children?: React.ReactNode;
}) {
  const [draft, setDraft] = useState(note ?? '');
  const [open, setOpen] = useState(false);
  if (!v) return null;
  const answered = !!note?.trim();
  // A blocking check that has been answered reads as settled, not as still
  // wrong — the disagreement stands, but it is no longer holding anything up.
  const tone = v.level === 'pass' ? 'pass' : answered ? 'settled' : v.level;
  // Written out rather than built from a `text-${tone}-700` template — Tailwind
  // only generates classes it can see as literals in the source. 700 is the
  // darkest shade the GRC ramps define; -800 resolves to nothing.
  const shell = tone === 'pass' ? 'border-compliant-200 bg-compliant-50/40'
    : tone === 'settled' ? 'border-canvas-border bg-paper-50/60'
      : tone === 'warn' ? 'border-mitigated-200 bg-mitigated-50/40' : 'border-risk-200 bg-risk-50/40';
  const accent = tone === 'pass' ? 'text-compliant-700'
    : tone === 'settled' ? 'text-ink-500'
      : tone === 'warn' ? 'text-mitigated-700' : 'text-risk-700';
  return (
    <div className={cn('rounded-lg border px-3 py-2.5', shell)}>
      <div className="flex items-start gap-2.5">
        <span className={cn('mt-0.5 shrink-0', accent)}>
          {v.level === 'pass' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[0.65625rem] font-bold uppercase tracking-wider text-ink-400">{label}</span>
            <span className={cn('text-[0.78125rem] font-semibold', accent)}>{v.headline}</span>
            {v.level === 'warn' && !answered && <span className="text-[0.625rem] font-bold uppercase tracking-wider text-mitigated-700">Variance</span>}
            {v.level === 'fail' && !answered && <span className="text-[0.625rem] font-bold uppercase tracking-wider text-risk-700">Completeness</span>}
          </div>
          <p className="text-[0.6875rem] text-ink-500 leading-relaxed mt-0.5">{v.detail}</p>

          {/* Where the surplus sits. Only an overshoot has this — missing rows
              are not in the extract to be grouped. */}
          {v.breakdown && v.breakdown.length > 0 && (
            <div className="mt-2 rounded-md border border-canvas-border bg-canvas-elevated px-2.5 py-2">
              <span className="block text-[0.625rem] font-bold uppercase tracking-wider text-ink-400 mb-1">Where the extra rows sit</span>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {v.breakdown.map(b => (
                  <span key={b.label} className="text-[0.6875rem] text-ink-600">
                    {b.label} <span className="tabular-nums font-semibold text-ink-900">{b.n.toLocaleString()}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          {v.causes && !answered && <p className="mt-1.5 text-[0.65625rem] text-ink-400 leading-relaxed">{v.causes}</p>}

          {children}
          {v.blocks && !children && (
            answered && !open ? (
              <p className="mt-1.5 text-[0.6875rem] text-ink-600 leading-relaxed">
                <span className="text-ink-400">Accepted</span> · {note}
                {canWrite && <button onClick={() => { setDraft(note ?? ''); setOpen(true); }} className="ml-2 text-brand-600 font-semibold hover:underline cursor-pointer">Edit</button>}
              </p>
            ) : canWrite ? (
              /* Two ways out, both legitimate: fix the filter, or say why the
                 expectation was the number that was wrong. */
              <div className="mt-2">
                {onRefilter && (
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <button onClick={onRefilter}
                      className="h-7 px-3 inline-flex items-center gap-1.5 rounded-md border border-canvas-border bg-canvas-elevated text-[0.6875rem] font-semibold text-ink-700 hover:border-ink-300 transition-colors cursor-pointer"><RotateCcw size={11} /> Refilter</button>
                    <span className="text-[0.625rem] text-ink-400">Adjust the filter and extract again — the comparison re-runs.</span>
                  </div>
                )}
                <span className="block text-[0.625rem] text-ink-400 mb-1">{onRefilter ? 'Or accept it, and say why:' : 'Say why:'}</span>
                <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={2} placeholder={placeholder}
                  className="w-full px-2.5 py-2 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.71875rem] leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-brand-200" />
                <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                  <button disabled={!draft.trim()} onClick={() => { onNote(draft.trim()); setOpen(false); }}
                    className="h-7 px-3 rounded-md bg-brand-600 text-white text-[0.6875rem] font-semibold enabled:hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer">Accept with reason</button>
                  <span className="text-[0.625rem] text-ink-400">This prints on the working paper beside the figure.</span>
                </div>
              </div>
            ) : <p className="mt-1.5 text-[0.6875rem] text-ink-400">Not resolved.</p>
          )}
        </div>
      </div>
    </div>
  );
}

/** A look at the population itself.
 *
 *  A locked population is otherwise a single number, and a number nobody has
 *  looked at is a number nobody has checked. The rows are generated from the
 *  control's own id so the same population always shows the same items — this
 *  prototype holds no file bytes, and inventing a different set on every open
 *  would make the preview useless for exactly the thing it is for. */
function PopulationPreviewModal({ control, onClose }: { control: Control; onClose: () => void }) {
  const pop = control.operating.population!;
  const SHOWN = 25;
  const rows = useMemo(() => {
    // Deterministic — a tiny LCG seeded off the control id.
    let s = control.id.split('').reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
    const next = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
    const start = pop.filterFrom ? new Date(pop.filterFrom).getTime() : Date.parse('2026-01-01');
    const end = pop.filterTo ? new Date(pop.filterTo).getTime() : Date.parse('2026-12-31');
    const span = Math.max(1, end - start);
    const who = ['R. Nair', 'S. Kulkarni', 'A. Verma', 'P. Desai', 'M. Iyer'];
    const kind = ['Vendor payment run', 'Payroll disbursement', 'Inter-company transfer', 'Utility settlement', 'Treasury sweep'];
    return Array.from({ length: Math.min(SHOWN, pop.count) }, (_, i) => ({
      ref: `${control.id}-${String(i + 1).padStart(5, '0')}`,
      date: new Date(start + next() * span).toISOString().slice(0, 10),
      description: kind[Math.floor(next() * kind.length)],
      account: `${2100 + Math.floor(next() * 6) * 10} — ${['Trade payables', 'Bank — current', 'Payroll clearing', 'Inter-company', 'Accruals', 'Treasury'][Math.floor(next() * 6)]}`,
      amount: Math.round((next() * 480 + 12) * 1000),
      approver: who[Math.floor(next() * who.length)],
    })).sort((a, b) => a.date.localeCompare(b.date));
  }, [control.id, pop.count, pop.filterFrom, pop.filterTo]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <motion.div className="modal" style={{ maxWidth: 940 }} onClick={e => e.stopPropagation()} initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}>
        <div className="px-5 py-4 border-b border-canvas-border flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-[0.875rem] font-bold text-ink-900">The population</h3>
              {pop.version && <span className="wp-ref">{pop.version}</span>}
              {pop.locked && <span className="inline-flex items-center gap-1 text-[0.6875rem] font-bold text-compliant-700"><Lock size={11} /> Locked</span>}
            </div>
            <p className="text-[0.71875rem] text-ink-500 mt-1">
              First {rows.length} of <span className="tabular-nums font-semibold text-ink-700">{pop.count.toLocaleString()}</span> instances
              {pop.sourceFile && <> · filtered out of <span className="font-mono text-[0.6875rem] text-ink-600">{pop.sourceFile}</span></>}
            </p>
            <p className="text-[0.6875rem] text-ink-400 mt-0.5">Filter · {pop.criteria ?? '—'}</p>
          </div>
          <button onClick={onClose} className="shrink-0 h-8 px-3 rounded-md border border-canvas-border text-[0.75rem] font-semibold text-ink-600 hover:text-ink-900 hover:border-ink-300 transition-colors cursor-pointer">Close</button>
        </div>
        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full border-collapse text-[0.71875rem]">
            <thead className="sticky top-0 bg-canvas-elevated">
              <tr>
                {['Reference', 'Date', 'Description', 'Account', 'Amount', 'Approved by'].map(h => (
                  <th key={h} className={cn('px-3 py-2 font-semibold text-ink-500 whitespace-nowrap border-b border-canvas-border text-left', h === 'Amount' && 'text-right')}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.ref} className="border-b border-canvas-border last:border-b-0 hover:bg-paper-50">
                  <td className="px-3 py-1.5 font-mono text-[0.6875rem] text-ink-700 whitespace-nowrap">{r.ref}</td>
                  <td className="px-3 py-1.5 text-ink-600 whitespace-nowrap tabular-nums">{shortDate(r.date)}</td>
                  <td className="px-3 py-1.5 text-ink-800">{r.description}</td>
                  <td className="px-3 py-1.5 text-ink-600 whitespace-nowrap">{r.account}</td>
                  <td className="px-3 py-1.5 text-ink-900 text-right tabular-nums whitespace-nowrap">₹{r.amount.toLocaleString('en-IN')}</td>
                  <td className="px-3 py-1.5 text-ink-600 whitespace-nowrap">{r.approver}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-canvas-border">
          <p className="text-[0.6875rem] text-ink-400 leading-relaxed">
            {pop.locked ? 'This is what the sample is drawn from. Changing it means withdrawing the population and starting again.' : 'Not locked yet — check it reads like this control\'s work before locking.'}
          </p>
        </div>
      </motion.div>
    </div>
  );
}

/** STEP 1 — POPULATION.
 *
 *  Pick the file, filter it down to THIS control's instances, check three things,
 *  lock. The filter is the point: 18,432 general-ledger rows are not 340 payment
 *  approvals, and a "population" the same size as the file it came out of is a
 *  file somebody copied rather than a population somebody defined — which is why
 *  that case gets a warning rather than a silent pass.
 */
function PopulationSection({ control, canEdit }: { control: Control; canEdit: boolean }) {
  const { eng, openAuditId, role, me, setPopulation, clearPopulation, setPopulationFacts, lockPopulation } = useIcfr();
  const logEvent = useAuditLog();
  const { addToast } = useToast();
  const files = useEngagementFiles();
  const pop = control.operating.population;
  const audit = eng.audits.find(a => a.id === openAuditId);
  const version = `POP-${audit ? ROUND_TAG[audit.round] : 'v1'}`;
  const canWrite = canEdit && !isControlLocked(control);
  const isAuditor = role === 'auditor' && canWrite;
  // The window the audit actually tests, as real dates. The coverage check
  // measures the filter against this, and prose like 'Jan 2026' cannot be
  // measured — so the filter asks for dates rather than a label.
  const winFrom = audit?.windowFrom ?? '';
  const winTo = audit?.windowTo ?? '';

  const [picked, setPicked] = useState<string | null>(null);
  const [txnType, setTxnType] = useState(control.subProcess);
  const [account, setAccount] = useState('');
  const [from, setFrom] = useState(winFrom);
  const [to, setTo] = useState(winTo);
  const [extracting, setExtracting] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  // What the auditor expects the filter to return, stated BEFORE it runs. An
  // expectation recorded afterwards is an expectation fitted to the answer, so
  // it is asked for here and the extract will not run without it.
  const [expected, setExpected] = useState('');
  const chosen = files.find(f => f.name === picked);
  // What the application can offer towards that number: how many times the
  // control itself runs over the window. Not the same thing as how many
  // instances it touches, so it is a hint beside the field, never the value.
  const runsInWindow = derivedRunCount(control, from, to);

  const criteria = [txnType && `type ${txnType}`, account && `account ${account}`, (from || to) && `${shortDate(from) || '…'} – ${shortDate(to) || '…'}`].filter(Boolean).join(' · ');

  const extract = () => {
    if (!chosen || !Number(expected)) return;
    setExtracting(true);
    window.setTimeout(() => {
      // The filter narrows the file to this control's instances. Deterministic so
      // the number is stable across runs, and never below one.
      const narrowed = criteria.trim().length === 0
        ? chosen.rows
        : Math.max(1, Math.round(chosen.rows / (7 + (control.id.length % 40))));
      setPopulation(control.id, {
        version,
        source: `${chosen.name} · ${chosen.from}`,
        sourceFile: chosen.name, sourceCount: chosen.rows,
        criteria: criteria || 'No filter applied',
        filterFrom: from || undefined, filterTo: to || undefined,
        expectedCount: Number(expected),
        count: narrowed,
        tieOut: `Filtered from ${chosen.rows.toLocaleString()} rows`,
        evidence: [{ id: 'pop-ev', name: chosen.name, kind: chosen.name.endsWith('.csv') ? 'CSV' : 'XLSX', uploadedBy: me, uploadedAt: 'just now' }],
      });
      setExtracting(false);
      logEvent({ action: 'Run', description: `Extracted the population for ${control.id} — ${narrowed.toLocaleString()} instances from ${chosen.rows.toLocaleString()} rows in ${chosen.name}, against ${Number(expected).toLocaleString()} expected`, module: 'SOX ICFR', entity: 'Evidence' });
    }, 1500);
  };

  // Put the old filter back in the form and drop the population, so fixing an
  // over-inclusive filter is a tweak to what was already there rather than
  // starting the whole step again. The confirm only appears when a sample would
  // go with it — otherwise there is nothing to lose by re-running.
  const refilter = () => {
    if (!pop) return;
    setPicked(pop.sourceFile ?? null);
    if (pop.filterFrom) setFrom(pop.filterFrom);
    if (pop.filterTo) setTo(pop.filterTo);
    setExpected(pop.expectedCount != null ? String(pop.expectedCount) : '');
    if (control.operating.sampling) { setWithdrawing(true); return; }
    clearPopulation(control.id);
    logEvent({ action: 'Update', description: `Refiltering the population for ${control.id} — the extract did not agree with the expected count`, module: 'SOX ICFR', entity: 'Evidence' });
  };

  const locked = !!pop?.locked;
  // A filter that changed nothing didn't filter.
  const unfiltered = !!pop && pop.sourceCount != null && pop.count === pop.sourceCount;

  // The two sums the application does for itself, and what is still missing
  // before the population can be locked.
  const cv = countVerdict(control);
  const gv = coverageVerdict(control, winFrom, winTo);
  const needsExpected = pop?.expectedCount == null && derivedRunCount(control, pop?.filterFrom, pop?.filterTo) == null;
  const [expectedDraft, setExpectedDraft] = useState('');
  const prov = pop?.provenance ?? { system: '', extractedBy: '', extractedOn: '' };
  const ready = populationReady(control, winFrom, winTo);
  const missing = !prov.system.trim() || !prov.extractedBy.trim() || !prov.extractedOn.trim()
    ? 'Record where the data came from before locking.'
    : needsExpected ? 'Record how many instances were expected before locking.'
      : cv?.blocks && !pop?.countNote?.trim() ? 'Refilter, or accept the count difference with a reason, before locking.'
        : 'A check that did not hold needs resolving before locking.';

  return (
    <div className="p-5">
      {!pop ? (
        canWrite ? (
          <>
            <div className="mb-3">
              <h4 className="text-[0.8125rem] font-bold text-ink-900">Select the source file</h4>
              <p className="text-[0.71875rem] text-ink-500 mt-1 leading-relaxed">Then filter it down to this control's instances. The file is the raw data; the population is what this control actually operated on.</p>
            </div>
            <div className="rounded-xl border border-canvas-border overflow-hidden mb-4">
              {files.length === 0 ? (
                <p className="px-3 py-3 text-[0.75rem] text-ink-400">No files on this engagement yet.</p>
              ) : files.map(f => {
                const on = picked === f.name;
                return (
                  <button key={f.name} onClick={() => setPicked(f.name)}
                    className={cn('w-full text-left flex items-center gap-2.5 px-3 py-2.5 border-b border-canvas-border last:border-b-0 transition-colors cursor-pointer', on ? 'bg-brand-50' : 'hover:bg-paper-50')}>
                    <span className={cn('w-3.5 h-3.5 rounded-full border-[3px] shrink-0', on ? 'border-brand-600' : 'border-ink-300')} />
                    <FileText size={13} className={cn('shrink-0', on ? 'text-brand-600' : 'text-ink-400')} />
                    <span className={cn('text-[0.78125rem] truncate min-w-0', on ? 'font-semibold text-brand-700' : 'text-ink-800')}>{f.name}</span>
                    <span className="text-[0.6875rem] text-ink-400 tabular-nums shrink-0 ml-auto">{f.rows.toLocaleString()} rows</span>
                    <span className="text-[0.6875rem] text-ink-400 shrink-0 hidden sm:inline">{f.from}</span>
                  </button>
                );
              })}
            </div>

            <span className="block text-[0.65625rem] font-bold uppercase tracking-wider text-ink-400 mb-2">Filter criteria</span>
            <div className="grid sm:grid-cols-2 gap-x-3 gap-y-2.5">
              <label className="block min-w-0">
                <span className="block text-[0.65625rem] text-ink-400 mb-1">Transaction type</span>
                <input value={txnType} onChange={e => setTxnType(e.target.value)} placeholder="e.g. Payment run"
                  className="w-full h-8 px-2.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.78125rem] focus:outline-none focus:ring-2 focus:ring-brand-200" />
              </label>
              <label className="block min-w-0">
                <span className="block text-[0.65625rem] text-ink-400 mb-1">Account</span>
                <input value={account} onChange={e => setAccount(e.target.value)} placeholder="e.g. 2100 — Trade payables"
                  className="w-full h-8 px-2.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.78125rem] focus:outline-none focus:ring-2 focus:ring-brand-200" />
              </label>
              <label className="block min-w-0">
                <span className="block text-[0.65625rem] text-ink-400 mb-1">Date from</span>
                <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.78125rem] focus:outline-none focus:ring-2 focus:ring-brand-200" />
              </label>
              <label className="block min-w-0">
                <span className="block text-[0.65625rem] text-ink-400 mb-1">Date to</span>
                <input type="date" value={to} onChange={e => setTo(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.78125rem] focus:outline-none focus:ring-2 focus:ring-brand-200" />
              </label>
            </div>

            {/* ── the expectation, before the answer ──────────────────────────
                The only way to tell whether the right number of rows came back
                is to have said what the right number was first. Written down
                afterwards it is not a check, it is a caption. */}
            <div className="mt-3 rounded-lg border border-canvas-border bg-paper-50/60 px-3 py-2.5">
              <div className="flex items-start gap-3 flex-wrap">
                <label className="block shrink-0">
                  <span className="block text-[0.65625rem] text-ink-400 mb-1">Expected instances</span>
                  <input type="number" min={1} value={expected} onChange={e => setExpected(e.target.value)} placeholder="e.g. 1,400"
                    className="w-32 h-8 px-2.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.78125rem] tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-200" />
                </label>
                <p className="text-[0.65625rem] text-ink-400 leading-relaxed flex-1 min-w-[15rem] sm:mt-5">
                  {runsInWindow != null
                    ? <>This control runs <span className="tabular-nums font-semibold text-ink-600">{runsInWindow.toLocaleString()}</span> times over the window you have set. If each run covers many transactions, expect a larger number than that.</>
                    : <>A {control.frequency.toLowerCase()} control has no fixed rhythm, so there is nothing to work this out from — the figure has to come from you.</>}
                </p>
              </div>
              <p className="text-[0.625rem] text-ink-400 mt-2 leading-relaxed">Say it before extracting. Once the extract has run, the two numbers are compared for you — a figure written down afterwards would only ever agree with itself.</p>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
              <p className="text-[0.65625rem] text-ink-400 min-w-0">
                {!chosen ? 'Pick the source file first.'
                  : !Number(expected) ? <>Filtering <span className="tabular-nums font-semibold text-ink-600">{chosen.rows.toLocaleString()}</span> rows — say how many instances you expect before extracting.</>
                    : <>Filtering <span className="tabular-nums font-semibold text-ink-600">{chosen.rows.toLocaleString()}</span> rows by: {criteria || 'nothing yet'} · expecting <span className="tabular-nums font-semibold text-ink-600">{Number(expected).toLocaleString()}</span></>}
              </p>
              <button disabled={!chosen || !Number(expected) || extracting} onClick={extract}
                title={!chosen ? 'Pick a source file first' : !Number(expected) ? 'Record how many instances you expect first' : undefined}
                className="shrink-0 h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[0.78125rem] font-semibold enabled:hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer">
                {extracting ? <><Loader2 size={14} className="animate-spin" /> Extracting…</> : <><Database size={14} /> Extract</>}
              </button>
            </div>
          </>
        ) : <p className="text-[0.75rem] text-ink-400">No population yet — the auditor filters it out of the source data.</p>
      ) : (
        <>
          {/* what the filter produced */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="text-[0.8125rem] font-bold text-ink-900">{locked ? 'Population locked' : 'Population extracted'}</span>
                {pop.version && <span className="wp-ref">{pop.version}</span>}
              </div>
              <p className="text-[1.0625rem] font-bold text-ink-900 tabular-nums leading-none">
                {pop.count.toLocaleString()} <span className="text-[0.75rem] font-medium text-ink-500">instances</span>
                {pop.sourceCount != null && <span className="text-[0.75rem] font-medium text-ink-400"> from {pop.sourceCount.toLocaleString()} rows</span>}
              </p>
              <p className="text-[0.71875rem] text-ink-500 mt-1.5"><span className="text-ink-400">Source</span> · {pop.sourceFile ?? pop.source}</p>
              <p className="text-[0.71875rem] text-ink-500 mt-0.5"><span className="text-ink-400">Filter</span> · {pop.criteria ?? '—'}</p>
              {locked && <p className="text-[0.6875rem] text-ink-400 mt-1.5">Locked by {pop.locked!.by}, {pop.locked!.at}</p>}
            </div>
            <div className="shrink-0 flex items-center gap-2">
              {/* the population is a number until somebody can look at it */}
              <button onClick={() => setPreviewing(true)}
                className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md border border-canvas-border text-[0.71875rem] font-semibold text-ink-600 hover:text-ink-900 hover:border-ink-300 transition-colors cursor-pointer"><Eye size={11} /> Preview</button>
              {isAuditor && (
                <button onClick={() => setWithdrawing(true)}
                  className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md border border-canvas-border text-[0.71875rem] font-semibold text-ink-500 hover:text-risk-700 hover:border-risk-300 transition-colors cursor-pointer"><RotateCcw size={11} /> Withdraw</button>
              )}
            </div>
          </div>

          {unfiltered && (
            <p className="mt-3 text-[0.71875rem] text-mitigated-800 bg-mitigated-50/60 border border-mitigated-200 rounded-lg px-3 py-2 flex items-start gap-1.5">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <span>The population is the same size as the file it came from — nothing was filtered out. Unless this control really does operate on every row, withdraw and filter it down first.</span>
            </p>
          )}

          <div className="ac-div my-4" />

          {/* ── what the application worked out for itself ──────────────────
              Nobody is asked to agree with arithmetic. The count and the period
              are both things it already holds the numbers for, so it does the
              sum and states the answer. A failed sum is argued with in writing,
              not ticked past. */}
          <span className="block text-[0.65625rem] font-bold uppercase tracking-wider text-ink-400 mb-2">Checked automatically</span>
          <div className="space-y-1.5">
            <VerdictRow label="Count" v={cv} note={pop.countNote} canWrite={canWrite && !locked}
              placeholder="e.g. the expected figure was last year's estimate — volumes rose after the new vendor onboarding"
              onNote={t => setPopulationFacts(control.id, { countNote: t })}
              onRefilter={isAuditor ? refilter : undefined}>
              {cv && cv.blocks && needsExpected && (
                <div className="mt-2 flex items-center gap-2">
                  <input type="number" min={1} value={expectedDraft} onChange={e => setExpectedDraft(e.target.value)} placeholder="expected"
                    disabled={!canWrite || locked}
                    className="w-28 h-8 px-2.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.78125rem] tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:opacity-50" />
                  <button disabled={!canWrite || locked || !Number(expectedDraft)}
                    onClick={() => setPopulationFacts(control.id, { expectedCount: Number(expectedDraft) })}
                    className="h-8 px-3 rounded-md border border-canvas-border text-[0.71875rem] font-semibold text-ink-700 enabled:hover:border-ink-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer">Record</button>
                  <span className="text-[0.65625rem] text-ink-400">then the comparison is ours to make</span>
                </div>
              )}
            </VerdictRow>
            <VerdictRow label="Period covered" v={gv} note={pop.coverageNote} canWrite={canWrite && !locked}
              placeholder="e.g. the system was cut over on 1 Mar — pre-cutover instances are in the legacy extract, tested separately"
              onNote={t => setPopulationFacts(control.id, { coverageNote: t })}
              onRefilter={isAuditor ? refilter : undefined} />
          </div>

          {/* ── the facts it cannot work out ────────────────────────────────
              A file name says nothing about the system that produced it, who ran
              the export or when. So those three are asked for as facts and
              printed on the paper — not compressed into a tick box that says
              "production, trust me". */}
          <span className="block text-[0.65625rem] font-bold uppercase tracking-wider text-ink-400 mt-4 mb-1">Where this data came from</span>
          <p className="text-[0.65625rem] text-ink-400 mb-2 leading-relaxed">Nothing here can be worked out from the file, so it is recorded rather than assumed. It prints on the working paper as stated.</p>
          <div className="grid sm:grid-cols-3 gap-x-3 gap-y-2.5">
            <label className="block min-w-0">
              <span className="block text-[0.65625rem] text-ink-400 mb-1">System of record</span>
              <input value={prov.system} disabled={!canWrite || locked} onChange={e => setPopulationFacts(control.id, { provenance: { ...prov, system: e.target.value } })}
                placeholder="e.g. SAP S/4HANA — Production"
                className="w-full h-8 px-2.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.78125rem] focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:opacity-60" />
            </label>
            <label className="block min-w-0">
              <span className="block text-[0.65625rem] text-ink-400 mb-1">Extracted by</span>
              <input value={prov.extractedBy} disabled={!canWrite || locked} onChange={e => setPopulationFacts(control.id, { provenance: { ...prov, extractedBy: e.target.value } })}
                placeholder="e.g. R. Nair · IT"
                className="w-full h-8 px-2.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.78125rem] focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:opacity-60" />
            </label>
            <label className="block min-w-0">
              <span className="block text-[0.65625rem] text-ink-400 mb-1">Extracted on</span>
              <input type="date" value={prov.extractedOn} disabled={!canWrite || locked} onChange={e => setPopulationFacts(control.id, { provenance: { ...prov, extractedOn: e.target.value } })}
                className="w-full h-8 px-2.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.78125rem] focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:opacity-60" />
            </label>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[0.65625rem] text-ink-400 min-w-0">
              {locked ? 'Every later step draws off this version. A later round re-versions rather than editing it.'
                : ready ? 'Nothing downstream runs until the population is locked.'
                  : missing}
            </p>
            {!locked && isAuditor && (
              <button disabled={!ready} title={ready ? undefined : missing}
                onClick={() => { lockPopulation(control.id); logEvent({ action: 'Update', description: `Locked the population for ${control.id}`, module: 'SOX ICFR', entity: 'Evidence' }); addToast({ type: 'success', title: 'Population locked', message: `${pop.count.toLocaleString()} instances — the sample draws from this.` }); }}
                className="shrink-0 h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[0.78125rem] font-semibold enabled:hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"><Lock size={14} /> Lock the population</button>
            )}
            {locked && <span className="shrink-0 inline-flex items-center gap-1.5 text-[0.71875rem] font-bold text-compliant-700"><Lock size={13} /> Locked</span>}
          </div>
        </>
      )}

      {previewing && pop && createPortal(<PopulationPreviewModal control={control} onClose={() => setPreviewing(false)} />, document.body)}

      {withdrawing && createPortal(
        <div className="modal-backdrop" onClick={() => setWithdrawing(false)}>
          <motion.div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()} initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}>
            <div className="px-5 py-4">
              <div className="flex items-start gap-3">
                <span className="w-9 h-9 rounded-lg bg-risk-50 text-risk-700 inline-flex items-center justify-center shrink-0"><AlertTriangle size={17} /></span>
                <div>
                  <h3 className="text-[0.875rem] font-bold text-ink-900">Withdraw this population?</h3>
                  <p className="text-[0.75rem] text-ink-500 mt-1">A different filter is a different population. The sample drawn from this one{control.operating.sampling ? ` — ${control.operating.sampling.size} items — ` : ' '}and every result recorded against it go with it.</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-canvas-border bg-paper-50/40">
              <button onClick={() => setWithdrawing(false)} className="h-9 px-3.5 text-[0.78125rem] font-semibold text-ink-600 hover:text-ink-900 cursor-pointer">Keep it</button>
              <button onClick={() => { clearPopulation(control.id); setWithdrawing(false); setPicked(null); logEvent({ action: 'Delete', description: `Withdrew the population for ${control.id}`, module: 'SOX ICFR', entity: 'Evidence' }); }}
                className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-risk-600 text-white text-[0.78125rem] font-semibold hover:bg-risk-700 transition-colors cursor-pointer"><RotateCcw size={13} /> Withdraw</button>
            </div>
          </motion.div>
        </div>,
        document.body)}
    </div>
  );
}

function SampleExtractSection({ control, canEdit, locked }: { control: Control; canEdit: boolean; locked: boolean }) {
  const { eng, racmDocs, openAuditId, role, setSampling } = useIcfr();
  // Drawing a sample is the auditor's act — the store refuses it from anyone
  // else, so the journey is not offered to anyone else either.
  const canDraw = canEdit && role === 'auditor';
  const logEvent = useAuditLog();
  const { addToast } = useToast();
  const o = control.operating;

  // 'upload' covers everything before Send — the files card and the logic card
  // are gated on the files themselves, not on a stage
  type Stage = 'upload' | 'extracting' | 'review';
  const [stage, setStage] = useState<Stage>('upload');
  // The population is already in and locked (step ①). All this step still asks
  // for is the transaction detail each drawn item is tested against.
  const [txnFile, setTxnFile] = useState<{ name: string; count: number } | null>(null);
  const [uploading, setUploading] = useState<'txn' | null>(null);
  const [picking, setPicking] = useState(false);
  const [logic, setLogic] = useState('');
  const [sentLogic, setSentLogic] = useState('');
  // How many to draw is the table's call, not a free guess — sized from the
  // control's frequency, nature and risk rating, and reduced to sizing-like-a-
  // manual-control the moment an ITGC underneath it fails.
  const holds = itgcHolds(eng, control);
  const guide = sampleSizeGuide(control, holds);
  const [rows, setRows] = useState(guide.suggested);
  // Random or systematic, and the seed behind it — the two facts that let anyone
  // else land on the same items. A draw nobody can reperform is not a procedure.
  const [method, setMethod] = useState<Sampling['method']>('Random');
  const [seed, setSeed] = useState(74812);
  const [drawn, setDrawn] = useState<string[]>([]);
  const [rejecting, setRejecting] = useState(false);
  // sending with no filter rule is the one thing that can't be guessed — IRA
  // asks for it rather than silently pulling everything
  const [askedForLogic, setAskedForLogic] = useState(false);
  const filesReady = !!txnFile;
  const attachedFiles = REQUIRED_SAMPLE_FILES
    .map(d => (txnFile ? { id: d.id, name: txnFile.name, tag: d.tag } : null))
    .filter(Boolean) as { id: 'txn'; name: string; tag: string }[];

  // The journey stays LOCAL until approval — nothing is written to the control,
  // so "Reject and try again" is a pure state reset with no store cleanup.
  // What the engagement already holds — the scoping uploads are usually the
  // very transaction data being asked for here, so they're offered for reuse.
  // The engagement's own files — same list the population picker offers, so a
  // file uploaded at scoping is reusable from either step.
  const existingFiles = useEngagementFiles();

  // One slot left, so a chosen file lands in it whatever it is called.
  const uploadFile = () => {
    setPicking(false);
    setUploading('txn');
    window.setTimeout(() => {
      const f = { name: 'transactions.xlsx', count: 18432 };
      setTxnFile(f);
      setUploading(null);
      logEvent({ action: 'Upload', description: `Added "${f.name}" for ${control.id} — transaction detail for the drawn items`, module: 'SOX ICFR', entity: 'Evidence' });
    }, 1400);
  };
  const chooseFiles = (files: { name: string; rows: number }[]) => {
    setPicking(false);
    const f = files[0];
    if (!f) return;
    setTxnFile({ name: f.name, count: f.rows });
    logEvent({ action: 'Update', description: `Reused "${f.name}" for ${control.id} — transaction detail for the drawn items`, module: 'SOX ICFR', entity: 'Evidence' });
  };
  const sendLogic = () => {
    if (!logic.trim()) { setAskedForLogic(true); return; }
    setAskedForLogic(false);
    setSentLogic(logic.trim());
    setStage('extracting');
    logEvent({ action: 'Run', description: `Drew ${rows} items for ${control.id} — ${method.toLowerCase()}, seed ${seed}`, module: 'SOX ICFR', entity: 'Test Result' });
    window.setTimeout(() => { setDrawn(sampleRefs(control.process, rows)); setStage('review'); }, 1800);
  };
  const visible = drawn.map((ref, i) => ({ ref, i }));

  const approve = () => {
    const kept = visible.map(v => v.ref);
    // The population is already in and locked — this step only records the draw
    // off it, and the two facts that make the draw reperformable.
    const s: Sampling = {
      basis: `${kept.length} items drawn from ${o.population?.version ?? 'the locked population'} · ${method.toLowerCase()}, seed ${seed} · spread across the period — transactions filtered by: “${sentLogic}”`,
      method, size: kept.length, seed,
      samples: kept.map((ref, i) => ({ id: `s${i}`, ref, result: 'Not tested' })),
    };
    setSampling(control.id, s);
    logEvent({ action: 'Update', description: `Approved the sample for ${control.id} — ${kept.length} items, ${method.toLowerCase()}, seed ${seed}`, module: 'SOX ICFR', entity: 'Test Result' });
    addToast({ type: 'success', title: 'Sample drawn', message: `${kept.length} items — confirm the extraction, then test them.` });
  };
  const restart = () => {
    setRejecting(false);
    setStage('upload'); setTxnFile(null); setLogic(''); setSentLogic(''); setRows(guide.suggested); setDrawn([]); setAskedForLogic(false);
    logEvent({ action: 'Delete', description: `Rejected the drawn sample for ${control.id} — draw restarted`, module: 'SOX ICFR', entity: 'Test Result' });
  };

  // Two gates stand in front of the draw, and they fail for different reasons —
  // so the locked state names the one actually holding it up.
  if (locked) {
    const designBlocked = trackResult(control.design) !== 'Effective';
    return (
      <div className="p-5">
        {designBlocked ? (
          <EmptyState icon={<Lock size={18} />} title="The draw is locked" hint="Conclude the Test of Design as effective first — a sample is only worth pulling for a control that is designed to work.">
            <span className="inline-flex items-center gap-1.5 text-[0.75rem] text-ink-500"><span>Design is currently</span><TrackPill c={trackResult(control.design)} /></span>
          </EmptyState>
        ) : (
          <EmptyState icon={<Lock size={18} />} title="The draw is locked"
            hint={o.population
              ? 'The population is extracted but not locked. Settle the checks at step ① and lock it — a sample drawn from a population that can still change proves nothing.'
              : 'No population yet. Pick the source file and filter it down at step ① — the draw comes off a locked population, never off a file.'}>
            <span className="inline-flex items-center gap-1.5 text-[0.75rem] text-ink-500">
              <span>Population is currently</span>
              <Pill tone="draft">{!o.population ? 'Not extracted' : 'Not locked'}</Pill>
            </span>
          </EmptyState>
        )}
      </div>
    );
  }

  // Already drawn (this session or seeded) — read-only, plus IPE gate 2, which is
  // the one thing still outstanding once the items exist.
  if (o.sampling) {
    const s = o.sampling;
    const origCount = s.samples.filter(x => !x.extension).length;
    const extCount = s.samples.length - origCount;
    return (
      <div className="p-5">
        <div className="rounded-xl border border-compliant-200 bg-compliant-50/30 p-4 flex items-start gap-3 mb-3">
          <CheckCircle2 size={16} className="text-compliant-700 mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-[0.8125rem] font-bold text-ink-900">Sample drawn — {s.size} items{extCount > 0 && <span className="font-medium text-ink-500"> · {origCount} original + {extCount} extension</span>}</div>
            <p className="text-[0.71875rem] text-ink-500 mt-0.5">{s.basis}</p>
            {o.population && <p className="text-[0.6875rem] text-ink-400 mt-1">Drawn from {o.population.version ?? 'the population'} · {o.population.count.toLocaleString()} records · {o.population.tieOut}</p>}
          </div>
        </div>
      </div>
    );
  }

  // A frozen (concluded + signed) control never re-opens the journey, and nor
  // does a risk owner — the draw is the auditor's to make.
  if (!canDraw || isControlLocked(control)) {
    return <div className="p-5"><p className="text-[0.75rem] text-ink-400">Nothing drawn yet — the auditor draws the sample off the locked population.</p></div>;
  }

  return (
    <div className="p-5">
      {/* 1 — the transaction detail. Flat: the step is already a card, and a
          card inside a card just draws a second border around the same idea.
          A rule between the two halves says "different thing" just as well. */}
      <div className="flex items-center gap-2">
        <FileText size={14} className="text-brand-600 shrink-0" />
        <span className="text-[0.8125rem] font-bold text-ink-900">Transaction detail</span>
        <span className="text-[0.71875rem] text-ink-400">what each drawn item is tested against</span>
        <button onClick={() => setPicking(true)}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand-600 hover:bg-brand-700 text-white text-[0.71875rem] font-semibold transition-colors cursor-pointer">
          <Upload size={12} /> {attachedFiles.length > 0 ? 'Replace' : 'Upload'}
        </button>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {/* the population is no longer asked for here — it is already in and
            locked upstream, and shown as the fact the draw comes off */}
        <div className="inline-flex items-center gap-2 px-3 py-2.5 rounded-lg border border-compliant-100 bg-compliant-50/40">
          <Lock size={12} className="text-compliant-700 shrink-0" />
          <span className="text-[0.78125rem] font-semibold text-ink-900">Population {o.population?.version ?? 'locked'}</span>
          <span className="text-[0.6875rem] text-ink-500 tabular-nums">{o.population?.count.toLocaleString()} records</span>
          <Check size={13} className="text-compliant-600 shrink-0" />
        </div>
        {REQUIRED_SAMPLE_FILES.map(d => (
          <div key={d.id} className={cn('inline-flex items-center gap-2 px-3 py-2.5 rounded-lg border', txnFile ? 'border-compliant-100 bg-compliant-50/40' : 'border-canvas-border bg-canvas-elevated')}>
            <span className="text-[0.78125rem] font-semibold text-ink-900">{d.name}</span>
            <span className="px-1.5 py-0.5 rounded-md border border-canvas-border text-[0.625rem] font-bold text-ink-400">{d.formats}</span>
            {txnFile && <Check size={13} className="text-compliant-600 shrink-0" />}
          </div>
        ))}
      </div>

      {attachedFiles.length > 0 && (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="inline-flex items-center gap-1.5 text-[0.65625rem] font-bold uppercase tracking-wider text-ink-400">
              Attached
              <span className="w-[18px] h-[18px] rounded-full bg-ink-900 text-white text-[0.625rem] font-bold inline-flex items-center justify-center tabular-nums">{attachedFiles.length}</span>
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {attachedFiles.map(a => (
              <span key={a.id} className="flex items-center gap-1.5 pl-2.5 pr-1.5 h-9 rounded-lg border border-canvas-border bg-canvas-elevated min-w-0">
                <FileText size={12} className="text-ink-400 shrink-0" />
                <span className="text-[0.75rem] text-ink-800 truncate">{a.name}</span>
                <span className="px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 text-[0.59375rem] font-bold uppercase tracking-wide whitespace-nowrap shrink-0">{a.tag}</span>
                <button onClick={() => setTxnFile(null)} aria-label={`Remove ${a.name}`}
                  className="ml-auto p-1 rounded text-ink-400 hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer shrink-0"><X size={12} /></button>
              </span>
            ))}
          </div>
        </div>
      )}
      {uploading && <p className="mt-3 inline-flex items-center gap-1.5 text-[0.71875rem] text-ink-400"><Loader2 size={12} className="animate-spin" /> Parsing…</p>}

      <div className="ac-div my-4" />

      {/* 2 — how many to draw, and the rule that filters the transactions */}
      {/* always here — the logic can be written before the files land; only
          sending waits on them */}
      <div>
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
              {/* size, then HOW — frequency sets the floor, the control's risk
                  raises it, and the method plus its seed are what let anyone
                  else land on the same items */}
              <div className="grid sm:grid-cols-3 gap-x-3 gap-y-2.5 mt-3">
                <label className="block min-w-0">
                  <span className="block text-[0.65625rem] font-bold uppercase tracking-wider text-ink-400 mb-1">Items to draw</span>
                  <select value={rows} onChange={e => setRows(+e.target.value)}
                    className="w-full h-8 px-2 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.78125rem] tabular-nums cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-200">
                    {Array.from(new Set([guide.suggested, 1, 2, 4, 10, 25, 40, 60])).sort((a, b) => a - b).map(n => (
                      <option key={n} value={n}>{n}{n === guide.suggested ? ' — suggested' : ''}</option>
                    ))}
                  </select>
                </label>
                <label className="block min-w-0">
                  <span className="block text-[0.65625rem] font-bold uppercase tracking-wider text-ink-400 mb-1">Selection method</span>
                  <select value={method} onChange={e => setMethod(e.target.value as Sampling['method'])}
                    className="w-full h-8 px-2 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.78125rem] cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-200">
                    {(['Random', 'Systematic', 'Statistical', 'Targeted', 'Full population'] as Sampling['method'][]).map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </label>
                <label className="block min-w-0">
                  <span className="block text-[0.65625rem] font-bold uppercase tracking-wider text-ink-400 mb-1">Seed</span>
                  <div className="flex items-center gap-1.5">
                    <input value={seed} onChange={e => setSeed(Number(e.target.value.replace(/\D/g, '')) || 0)} inputMode="numeric"
                      className="w-full h-8 px-2.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.78125rem] tabular-nums text-ink-800 focus:outline-none focus:ring-2 focus:ring-brand-200" />
                    <button onClick={() => setSeed(10000 + ((seed * 7919 + 104729) % 89999))} title="New seed"
                      className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-lg border border-canvas-border text-ink-500 hover:text-brand-700 hover:border-brand-300 transition-colors cursor-pointer" aria-label="New seed"><Dices size={13} /></button>
                  </div>
                </label>
              </div>
              <p className="text-[0.65625rem] text-ink-400 mt-2 leading-relaxed">
                {control.frequency} · {control.nature}{control.riskRating ? ` · ${control.riskRating.toLowerCase()} risk` : ''} — band {guide.range}. {guide.note} Frequency sets the floor; the control's risk rating moves it inside the band.
                {method === 'Random' || method === 'Systematic' ? ' The seed is stored on the paper, so the reviewer can reperform the draw and land on these same items.' : ' A targeted selection has no seed to reperform — the basis has to carry the reasoning instead.'}
              </p>
              <p className="text-[0.65625rem] text-ink-400 mt-1 leading-relaxed">Spread across the whole period and stratified across the significant classes of transactions.</p>
              <div className="flex items-center justify-end mt-2.5">
                {/* the logic can be written first — sending needs the data */}
                <button disabled={!filesReady || stage === 'extracting'} onClick={sendLogic}
                  title={filesReady ? undefined : 'Add the transaction detail first — there is nothing to test the drawn items against yet'}
                  className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[0.75rem] font-semibold enabled:hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer">
                  {stage === 'extracting' ? <><Loader2 size={13} className="animate-spin" /> Drawing…</> : <><Send size={13} /> Draw the sample</>}
                </button>
              </div>
            </>
          )}
          {stage === 'extracting' && (
            <div className="flex items-center gap-1.5 text-[0.75rem] text-brand-600 font-semibold"><Loader2 size={13} className="animate-spin" /> Drawing {rows} from {o.population?.count.toLocaleString()} · {method.toLowerCase()}, seed {seed}…</div>
          )}
      </div>

      {/* 3 — extracted result + approve / reject. Flat too, for the same reason:
          once the draw lands this sits directly under the logic that produced
          it, and a box here would be the only one left on the step. */}
      {stage === 'review' && (
        <>
        <div className="ac-div my-4" />
        <div>
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
        </>
      )}

      {picking && (
        <FilePickerModal
          existing={existingFiles}
          onUpload={uploadFile}
          onChoose={chooseFiles}
          slots={1}
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

/** STEP 5 — SIGN-OFF. Preparer signs, reviewer countersigns, the paper locks.
 *
 *  Four-eyes is the whole point, so the person who prepared the work can never be
 *  the person who countersigns it — and an open review note holds the countersign
 *  until it closes. Both rules live in the store too; this only shows why the
 *  button isn't there.
 */
function SignOffSection({ control }: { control: Control }) {
  const { eng, role, me, signOffControlWp } = useIcfr();
  const logEvent = useAuditLog();
  const so = control.wpSignoff;
  const concluded = isControlLocked(control);
  const notesPending = eng.reviewNotes.filter(n => n.controlId === control.id && n.status !== 'Closed').length;
  const canSign = role === 'auditor' && concluded && !so?.preparer;
  const canCounter = role === 'reviewer' && !!so?.preparer && !so?.reviewer && notesPending === 0 && so.preparer.by !== me;
  const done = !!so?.preparer && !!so?.reviewer;

  const Row = ({ label, entry, waiting }: { label: string; entry?: { by: string; at: string }; waiting: string }) => (
    <div className="flex items-center gap-2.5 py-2">
      {entry ? <CheckCircle2 size={16} className="text-compliant-700 shrink-0" /> : <Circle size={15} className="text-ink-300 shrink-0" />}
      <span className="text-[0.71875rem] text-ink-400 w-[110px] shrink-0">{label}</span>
      <span className={cn('text-[0.78125rem] min-w-0 truncate', entry ? 'font-semibold text-ink-800' : 'text-ink-400')}>
        {entry ? `${entry.by} · ${entry.at}` : waiting}
      </span>
    </div>
  );

  return (
    <div className="p-5">
      {!concluded ? (
        <EmptyState icon={<Lock size={18} />} title="Sign-off is locked" hint="Both tracks have to conclude first. A signature on a half-tested control says the work is finished when it isn't." />
      ) : (
        <>
          <div className="rounded-xl border border-canvas-border overflow-hidden">
            <div className="px-3.5 py-1.5">
              <Row label="Prepared by" entry={so?.preparer} waiting={`${eng.preparer} — not yet signed`} />
              <div className="ac-div" />
              <Row label="Countersigned" entry={so?.reviewer} waiting={`${eng.reviewer} — not yet countersigned`} />
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[0.6875rem] text-ink-400 leading-relaxed min-w-0">
              {done ? 'Control done — the working paper is locked and downloadable.'
                : canSign ? 'Signing states that the testing above is complete and the conclusions are yours.'
                : role === 'reviewer' && !so?.preparer ? 'Waits for the preparer’s signature.'
                : notesPending > 0 ? `${notesPending} review note${notesPending === 1 ? '' : 's'} must close before the countersign.`
                : so?.preparer?.by === me ? 'You prepared this paper, so you can’t countersign it — four-eyes.'
                : 'Waits for the reviewer.'}
            </p>
            {canSign && (
              <button onClick={() => { signOffControlWp(control.id, 'preparer'); logEvent({ action: 'Update', description: `Signed off the working paper for ${control.id}`, module: 'SOX ICFR', entity: 'Control' }); }}
                className="shrink-0 h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[0.78125rem] font-semibold hover:bg-brand-700 transition-colors cursor-pointer"><PenLine size={14} /> Sign off</button>
            )}
            {canCounter && (
              <button onClick={() => { signOffControlWp(control.id, 'reviewer'); logEvent({ action: 'Update', description: `Countersigned the working paper for ${control.id}`, module: 'SOX ICFR', entity: 'Control' }); }}
                className="shrink-0 h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[0.78125rem] font-semibold hover:bg-brand-700 transition-colors cursor-pointer"><PenLine size={14} /> Countersign</button>
            )}
          </div>

          {done && (
            <div className="mt-3 rounded-xl border border-compliant-200 bg-compliant-50/40 px-3.5 py-3 flex items-start gap-2">
              <BadgeCheck size={15} className="text-compliant-700 mt-0.5 shrink-0" />
              <p className="text-[0.75rem] text-ink-700 leading-relaxed"><b className="font-semibold">Control done.</b> Working paper locked — it can be downloaded, and nothing on it changes without reopening the control.</p>
            </div>
          )}
        </>
      )}
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
      {/* sample context — the draw happens in step ③; this is read-only.
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
            <FlaskConical size={12} className="text-ink-400" /> No sample yet — draw one in step ③ to test against sampled items.
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
        <div className="space-y-3 mb-5">{o.steps.map(s => <AttributeRow key={s.id} control={control} step={s} canEdit={canEdit} testing={testing && stepResult(s) === 'Not tested'} />)}</div>
      )}

      {/* No sample, no opinion. A failing attribute concludes ineffective and the
          exception is raised — remediation and retest happen outside this flow. */}
      {o.steps.length > 0 && <ConcludeFooter control={control} which="operating" suggestion={suggestion} canEdit={canEdit}
        disableEffective={!o.sampling}
        disableEffectiveNote={o.sampling ? undefined : 'Locked — draw the sample in step ③ first'} />}
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
              {/* fills the container — a 520px cap wrapped these to more rows than they needed */}
              {open && <p className="text-[0.71875rem] text-ink-500 mt-0.5">{subtitle}</p>}
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
  { id: 'all', label: 'All' }, { id: 'control', label: 'Control' }, { id: 'design', label: '② Design' }, { id: 'operating', label: '④ Operating' },
];
// the two hands on the working paper — auditor (purple/gavel) and risk owner (amber/check)
const EXEC_ROLE: Record<Role, { Icon: typeof Gavel; accent: string; chip: string; label: string }> = {
  auditor: { Icon: Gavel, accent: 'var(--color-brand-400)', chip: 'bg-brand-50 text-brand-700', label: 'Auditor' },
  'risk-owner': { Icon: UserCheck, accent: 'var(--color-mitigated-500)', chip: 'bg-mitigated-50 text-mitigated-700', label: 'Risk owner' },
  // our branch carries a third persona — the reviewer who countersigns
  reviewer: { Icon: UserCheck, accent: 'var(--color-evidence-500)', chip: 'bg-evidence-50 text-evidence-700', label: 'Reviewer' },
};
const TRACK_FILTERS = [{ id: 'all', label: 'All' }, { id: 'design', label: '② Design' }, { id: 'operating', label: '④ Operating' }] as const;

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
  const { eng, role, selectedControlId, back, setView, reopenControl } = useIcfr();
  const logEvent = useAuditLog();
  // preview-before-download for this control's working paper
  const [wpPreview, setWpPreview] = useState(false);
  // the way back into a concluded control — reason required, trail recorded
  const [reopening, setReopening] = useState(false);
  const [reopenWhy, setReopenWhy] = useState('');
  const control = eng.controls.find(c => c.id === selectedControlId);
  if (!control) return <div className="text-ink-500">Control not found. <button onClick={back} className="text-brand-700 font-semibold">Back to register</button></div>;
  // Both personas can now execute TOD and TOE; the shared trail records who did what.
  const canEdit = role === 'auditor' || role === 'risk-owner';
  const concl = controlConclusion(control);
  const designResult = trackResult(control.design);
  const opResult = trackResult(control.operating);
  const toeLocked = designResult !== 'Effective';
  // Step ① stands on its own — nothing gates it, and it gates nothing until the
  // draw. Design can be worked in parallel: reading narratives and validating
  // considerations needs no data, and what "one instance" means only becomes
  // answerable once you understand the control anyway.
  const popLocked = populationLocked(control);
  // The draw sits behind two gates: design has to conclude effective, and the
  // population has to have cleared gate 1. An already-drawn sample is never
  // re-locked — that work is done, and its own gate is on the paper.
  const sampleLocked = toeLocked || (!control.operating.sampling && !popLocked);
  const def = eng.deficiencies.find(d => d.controlId === control.id);

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
                {/* Key/non-key is agreed with management — it can never be read off
                    an SOP — so the auditor sets it here rather than reading it. */}
                <KeyControlChip control={control} canEdit={canEdit} />
                {control.clazz && <Pill tone="draft">{control.clazz}</Pill>}
                <NatureChip nature={control.nature} /><Pill tone="draft">{control.type}</Pill><Pill tone="draft">{control.frequency}</Pill>
                {control.riskRating && <Pill tone={control.riskRating === 'High' ? 'risk' : control.riskRating === 'Medium' ? 'mitigated' : 'draft'}>{control.riskRating} risk</Pill>}
                <span className="text-[0.6875rem] text-ink-400 font-mono">{control.id}</span>
              </div>
              {/* Heading = the control OBJECTIVE where the RACM carries one: what
                  the control is for, which is what the reviewer reads first. The
                  one-line statement follows it, then the Control Activity — who
                  performs it, on what, when and how. Precision used to head this
                  block and was a restatement of the title, so it read as the title
                  printed twice; it still carries into the working paper. */}
              <h1 className="leadsheet-title text-[1.25rem] text-ink-900 leading-snug max-w-[640px]">{control.objective ?? control.description}</h1>
              {control.objective && (
                <p className="text-[0.78125rem] text-ink-500 mt-1.5 max-w-[680px] leading-relaxed">
                  <b className="text-ink-700 font-semibold">Control —</b> {control.description}
                </p>
              )}
              {control.controlActivity && (
                /* fills the container — it is the longest line on the page and a
                   680px cap was breaking it into more rows than it needed */
                <p className="text-[0.78125rem] text-ink-500 mt-1.5 leading-relaxed">
                  <b className="text-ink-700 font-semibold">Control activity —</b> {control.controlActivity}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-3 text-[0.71875rem] text-ink-500">
                <span><span className="text-ink-400">Process</span> · {control.process} / {control.subProcess}</span>
                <span className="inline-flex items-center gap-1"><span className="text-ink-400">Owner</span> · <b className="font-semibold text-ink-700">{control.owner}</b></span>
                <span><span className="text-ink-400">Risk {control.riskId}</span> · {control.riskDescription}</span>
                <span><span className="text-ink-400">Assertions</span> · {control.assertions.join(', ')}</span>
                {/* why the risk exists at all — a control aimed at the symptom
                    rather than the cause is the commonest design gap there is */}
                {control.rootCause && <span><span className="text-ink-400">Root cause</span> · {control.rootCause}</span>}
              </div>
            </div>
            {/* one row, right-aligned: whose court it is sits beside the stamp
                rather than stacked under it, and the stamp reads on one line */}
            <div className="shrink-0 flex items-center justify-end gap-2">
              <CourtBadge court={courtFor(control, eng.tasks)} fromRole={role} />
              <div className="leadsheet-stamp whitespace-nowrap">W/P {control.wpRef}</div>
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
              {role === 'auditor' && isControlLocked(control) && (
                <button onClick={() => setReopening(true)} className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border border-canvas-border text-[0.75rem] font-semibold text-ink-600 hover:text-risk-700 hover:border-risk-300 transition-colors cursor-pointer"><RotateCcw size={13} /> Reopen</button>
              )}
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

      {/* the audit programme — the steps actually walked in the field, from the
          source RACM. Distinct from the design considerations (what must be true)
          and the test attributes (what each sample proves): these are the
          instructions, so they sit above the stepper rather than inside a step. */}
      {control.auditSteps && control.auditSteps.length > 0 && (
        <motion.div className="mb-5 rounded-xl border border-canvas-border bg-canvas-elevated p-4" variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}>
          <div className="flex items-center gap-2 mb-2.5">
            <ListChecks size={14} className="text-brand-600 shrink-0" />
            <h3 className="text-[0.8125rem] font-bold text-ink-900">Audit programme</h3>
            <span className="text-[0.6875rem] text-ink-400">{control.auditSteps.length} steps · from the RACM</span>
            {control.performedBy && <span className="ml-auto text-[0.6875rem] text-ink-400">Performed by <b className="font-semibold text-ink-600">{control.performedBy}</b></span>}
          </div>
          <ol className="space-y-1.5">
            {control.auditSteps.map((s, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[0.75rem] text-ink-700 leading-relaxed">
                <span className="w-[18px] h-[18px] rounded-md bg-brand-50 text-brand-700 text-[0.625rem] font-bold inline-flex items-center justify-center shrink-0 mt-0.5 tabular-nums">{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
          {(control.wpRefHard || control.wpRefSoft) && (
            <div className="mt-3 pt-2.5 border-t border-canvas-border flex flex-wrap items-center gap-x-5 gap-y-1 text-[0.6875rem] text-ink-500">
              {control.wpRefHard && <span><span className="text-ink-400">Hard-copy file</span> · <span className="font-mono">{control.wpRefHard}</span></span>}
              {control.wpRefSoft && <span className="min-w-0"><span className="text-ink-400">Soft-copy path</span> · <span className="font-mono break-all">{control.wpRefSoft}</span></span>}
              {control.reportRef && <span><span className="text-ink-400">Report ref</span> · <span className="font-mono">{control.reportRef}</span></span>}
            </div>
          )}
        </motion.div>
      )}

      {/* stepper + discussion */}
      <div className="grid grid-cols-[minmax(0,1fr)_360px] gap-5 items-start">
        <motion.div className="vstepper" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1, delayChildren: 0.08 } } }}>
          <VStep n={1} title="Population" subtitle="Pick the source file and filter it down to this control's instances, then check the count, the period and the source before locking it. Nothing downstream runs until it is locked." hideStatus
            status={popLocked ? 'Effective' : 'Not tested'}
            right={popLocked
              ? <span className="text-[0.6875rem] font-bold text-compliant-700 inline-flex items-center gap-1"><Lock size={12} /> Locked · {control.operating.population?.count.toLocaleString()} instances</span>
              : control.operating.population
                ? <span className="text-[0.6875rem] font-semibold text-mitigated-800 inline-flex items-center gap-1"><AlertTriangle size={11} /> Extracted, not yet locked</span>
                : <span className="text-[0.6875rem] font-semibold text-ink-400">Nothing extracted yet</span>}>
            <PopulationSection control={control} canEdit={canEdit} />
          </VStep>
          <VStep n={2} title="Test of design" subtitle="The documents on file, one transaction traced end-to-end, and a design check for each thing that has to be true. Concludes effective or ineffective." status={designResult}>
            <DesignSection control={control} canEdit={canEdit} />
          </VStep>
          <VStep n={3} title="Sample" subtitle="Drawn off the locked population, sized by how often the control runs, with the selection method and its seed stored so anyone can reproduce the same items." hideStatus
            status={sampleLocked ? 'Not tested' : control.operating.sampling ? 'Effective' : 'Not tested'} locked={sampleLocked}
            right={toeLocked
              ? <span className="text-[0.6875rem] font-semibold text-ink-400 inline-flex items-center gap-1"><Lock size={11} /> Unlocks after design</span>
              : control.operating.sampling
                ? <span className="text-[0.6875rem] font-bold text-compliant-700 inline-flex items-center gap-1"><CheckCircle2 size={12} /> {control.operating.sampling.size} items{control.operating.extractionConfirmed ? ' · confirmed' : ' · awaiting gate 2'}</span>
                : !popLocked
                  ? <span className="text-[0.6875rem] font-semibold text-ink-400 inline-flex items-center gap-1"><Lock size={11} /> Unlocks once the population locks</span>
                  : <span className="text-[0.6875rem] font-semibold text-ink-400">Awaiting the draw</span>}>
            <SampleExtractSection control={control} canEdit={canEdit} locked={sampleLocked} />
          </VStep>
          <VStep n={4} id="vstep-toe" title="Test of operating" subtitle="Each sampled item against each attribute — pass or fail, with the evidence attached. Concludes effective or ineffective." status={toeLocked ? 'Not tested' : opResult} locked={toeLocked}
            right={toeLocked ? <span className="text-[0.6875rem] font-semibold text-ink-400 inline-flex items-center gap-1"><Lock size={11} /> Unlocks after design</span> : undefined}>
            <OperatingSection control={control} canEdit={canEdit} locked={toeLocked} />
          </VStep>
          <VStep n={5} title="Sign-off" subtitle="The auditor signs the paper, the reviewer countersigns it, and the control is done. Nobody countersigns work they prepared." hideStatus
            status={control.wpSignoff?.reviewer ? 'Effective' : 'Not tested'} locked={!isControlLocked(control)}
            right={control.wpSignoff?.reviewer
              ? <span className="text-[0.6875rem] font-bold text-compliant-700 inline-flex items-center gap-1"><BadgeCheck size={12} /> Control done</span>
              : control.wpSignoff?.preparer
                ? <span className="text-[0.6875rem] font-semibold text-ink-400">Awaiting countersign</span>
                : isControlLocked(control)
                  ? <span className="text-[0.6875rem] font-semibold text-ink-400">Ready to sign</span>
                  : <span className="text-[0.6875rem] font-semibold text-ink-400 inline-flex items-center gap-1"><Lock size={11} /> Unlocks once both tracks conclude</span>}>
            <SignOffSection control={control} />
          </VStep>
          {concl === 'Ineffective' && (
            <motion.div variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }} className="ml-[54px] rounded-xl border border-risk-200 bg-risk-50/40 p-4 mt-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <AlertTriangle size={15} className="text-risk-700" /><h3 className="text-[0.8125rem] font-bold text-risk-700">Deficiency raised</h3>
                {/* what kind of gap this is — a design gap needs a redesign, a
                    testing gap needs discipline, and the fix follows the label */}
                {def?.gapType && <Pill tone="risk">{GAP_LABEL[def.gapType]}</Pill>}
              </div>
              <p className="text-[0.75rem] text-ink-600">This control concluded ineffective. Assess severity (likelihood × magnitude) and remediation in <button onClick={() => setView('deficiencies')} className="font-semibold text-risk-700 hover:underline inline-flex items-center gap-0.5">Deficiencies <ChevronRight size={12} /></button>.</p>
              {/* priced, if the auditor has priced it — the number is what moves a CFO */}
              {def && exposureTotal(def.exposure) > 0 && (
                <div className="mt-2.5 pt-2.5 border-t border-risk-200/70 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.71875rem]">
                  <span className="font-semibold text-risk-700">Exposure {formatINR(exposureTotal(def.exposure))}</span>
                  {(Object.keys(EXPOSURE_LABEL) as (keyof typeof EXPOSURE_LABEL)[])
                    .filter(k => (def.exposure as Exposure)[k] > 0)
                    .map(k => <span key={k} className="text-ink-600"><span className="text-ink-400">{EXPOSURE_LABEL[k]}</span> · {formatINR((def.exposure as Exposure)[k])}</span>)}
                </div>
              )}
            </motion.div>
          )}
        </motion.div>
        <motion.div variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}><ActivityRail control={control} /></motion.div>
      </div>

      {reopening && createPortal(
        <div className="modal-backdrop" onClick={() => setReopening(false)}>
          <motion.div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()} initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}>
            <div className="px-5 py-4">
              <div className="flex items-start gap-3">
                <span className="w-9 h-9 rounded-lg bg-risk-50 text-risk-700 inline-flex items-center justify-center shrink-0"><RotateCcw size={17} /></span>
                <div className="min-w-0">
                  <h3 className="text-[0.875rem] font-bold text-ink-900">Reopen this control?</h3>
                  <p className="text-[0.75rem] text-ink-500 mt-1 leading-relaxed">
                    Both conclusions go back to <b className="font-semibold text-ink-700">not tested</b> and the sign-off clears — a reopened paper is no longer the paper anybody signed. The evidence, the sample and the results stay where they are; it is the conclusions that have to be reached again.
                  </p>
                </div>
              </div>
              <label className="block mt-3.5">
                <span className="block text-[0.65625rem] font-bold uppercase tracking-wider text-ink-400 mb-1">Why — recorded on the trail</span>
                <textarea autoFocus rows={2} value={reopenWhy} onChange={e => setReopenWhy(e.target.value)}
                  placeholder="e.g. the FX rate feed changed in November — Q3 onwards has to be retested"
                  className="w-full px-2.5 py-2 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.75rem] text-ink-800 placeholder:text-ink-400 resize-none focus:outline-none focus:ring-2 focus:ring-brand-200" />
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-canvas-border bg-paper-50/40">
              <button onClick={() => { setReopening(false); setReopenWhy(''); }} className="h-9 px-3.5 text-[0.78125rem] font-semibold text-ink-600 hover:text-ink-900 cursor-pointer">Keep it closed</button>
              <button disabled={!reopenWhy.trim()} title={reopenWhy.trim() ? undefined : 'A reopened conclusion needs a reason on the trail'}
                onClick={() => { reopenControl(control.id, reopenWhy.trim()); logEvent({ action: 'Update', description: `Reopened ${control.id} — ${reopenWhy.trim()}`, module: 'SOX ICFR', entity: 'Control' }); setReopening(false); setReopenWhy(''); }}
                className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-risk-600 text-white text-[0.78125rem] font-semibold enabled:hover:bg-risk-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"><RotateCcw size={13} /> Reopen</button>
            </div>
          </motion.div>
        </div>,
        document.body)}

      {wpPreview && (
        <WorkingPaperModal eng={eng} control={control} onClose={() => setWpPreview(false)}
          onDownload={() => logEvent({ action: 'Export', description: `Exported working paper for ${control.id}`, module: 'SOX ICFR', entity: 'Control' })} />
      )}
    </motion.div>
  );
}
