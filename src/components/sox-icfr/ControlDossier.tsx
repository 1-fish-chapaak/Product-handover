import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText, Upload, MessageSquare, Workflow as WorkflowIcon, Hand, AlertTriangle,
  Send, Lock, ClipboardCheck, FileCheck2, FlaskConical, CheckCircle2, XCircle,
  CornerDownRight, Pencil, RotateCcw, Cpu, ChevronRight, Scale, Paperclip, Plus, Trash2,
  Mail, X, Loader2, ChevronDown, Check, PlayCircle, Link2, ListChecks, Gavel, UserCheck, History, FileUp, ArrowLeft, Footprints, BadgeCheck, Star,
  Database, Circle, PenLine, Eye, ChevronUp, AlertCircle, FileWarning,
} from 'lucide-react';
import { useIcfr } from './store';
import { useAuditLog } from '../../context/AdminDataContext';
import {
  // PARKED (Aug 2026) — `formatINR` came in only to price the exposure strip in
  // the deficiency banner below. Both go back together.
  // formatINR,
  concludeRationale, controlCode, controlConclusion, courtFor, operatingApplies, designCompleteness, designOutstanding, discussionsFor, extractionCriteria,
  isControlLocked, itgcHolds, operatingProgress, populationLocked, sampleSizeGuide, trackResult, pointResult, stepResult,
  countVerdict, coverageVerdict, derivedRunCount, populationReady, designBasis, auditorProvenChecks, suggestedDesignChecks, suggestPopulationFile, fmtDay, parseDay, EXTRACT_WOBBLE,
  monthlyBreakdown, spikeMonths, priorRoundCount, fileUsable, originLabel, guessFileKind, type PopVerdict,
} from './helpers';
import { useAuditFiles } from './useAuditFiles';
import { ownersOf, programmeFor } from './auditScope';
import { ConclusionPill, CourtBadge, NatureChip, OriginPicker, Toggle, TrackPill, Tickmark, Stamp, RagCard, type RagMeterDef } from './parts';
import { Pill } from '../shared/StatusBadge';
import { useToast } from '../shared/Toast';
import { Sparkles, FileSpreadsheet } from 'lucide-react';
import DataPickerModal, { type AttachmentSelection } from '../chat/DataPickerModal';
import WorkingPaperModal from './WorkingPaperModal';
import RemediationBriefModal from './RemediationBriefModal';
import { DeficiencyCard } from './extraViews';
import DatePicker from '../shared/DatePicker';
import { cn } from '../../lib/cn';
// PARKED (Aug 2026) — Gap type and Priced impact left this screen; the banners in
// types.ts say why. The imports go back with the blocks that used them:
//   EXPOSURE_LABEL, exposureTotal, GAP_LABEL   (values)
//   Exposure                                    (type)
import { AUDITOR_PROOF_KINDS, DESIGN_DOC_KINDS, DESIGN_WAIVER_REASONS, FIVE_W_1H, ipeSuggestion, ROLE_LABEL, ROUND_TAG } from './types';
import { requiredDatasetsFor, sampleRefs } from './mockData';
import type {
  AuditRound, Control, DesignDoc, DesignDocKind, DesignPoint, DesignWaiverReason, DiscussionAnchor, DocStatus, OperatingStep,
  AuditorProofKind, FileOrigin, IpeCheck, IpeConclusion, Role, Sampling, TestResult, TrackConclusion, ValidationResult,
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
  // Addressed to the process owner, copying the control owner. The person who
  // can actually produce the file is not usually the person accountable for the
  // control, and a request sent only to the accountable name is a request that
  // has to be forwarded before anyone can act on it.
  const owners = ownersOf(control);
  const [emails, setEmails] = useState<string[]>(() => {
    const seeded = [owners.processOwnerEmail, owners.controlOwnerEmail].filter((e): e is string => !!e);
    return seeded.length ? Array.from(new Set(seeded)) : [];
  });
  const [draft, setDraft] = useState('');
  const addEmail = () => { const e = draft.trim().replace(/,$/, ''); if (e && !emails.includes(e)) setEmails([...emails, e]); setDraft(''); };
  const toggle = (id: string) => setSel(p => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const canSend = sel.size > 0 && emails.length > 0;
  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <motion.div className="modal" onClick={e => e.stopPropagation()} initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-canvas-border">
          <div className="flex items-center gap-2"><Mail size={16} className="text-brand-600" /><h3 className="text-[0.875rem] font-bold text-ink-900">Request TOD data</h3></div>
          <button onClick={onClose} className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-ink-400 hover:text-ink-800 hover:bg-paper-50 cursor-pointer"><X size={16} /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <div className="text-[0.6875rem] font-bold uppercase tracking-wide text-ink-400 mb-2">Documents to request</div>
            <div className="space-y-1.5">
              {control.design.documents.length === 0 && <p className="text-[0.75rem] text-ink-400">No documents defined yet — add documents to TOD first.</p>}
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
            <p className="text-[0.71875rem] text-ink-500 mb-2">
              {owners.single
                ? <><b className="font-semibold text-ink-700">{owners.processOwner}</b> owns and runs this control.</>
                : <><b className="font-semibold text-ink-700">{owners.processOwner}</b> runs the process and is who this reaches; <b className="font-semibold text-ink-700">{owners.controlOwner}</b> is accountable for the control and is copied.</>}
            </p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {emails.map(e => <span key={e} className="inline-flex items-center gap-1.5 h-7 pl-2.5 pr-1.5 rounded-lg bg-paper-100 text-[0.75rem] font-medium text-ink-700">{e}<button onClick={() => setEmails(emails.filter(x => x !== e))} className="text-ink-400 hover:text-risk-600 cursor-pointer"><X size={12} /></button></span>)}
              {emails.length === 0 && <span className="text-[0.71875rem] text-ink-400">No address on file for either owner — add one below.</span>}
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
            <button disabled={!canSend} onClick={() => { requestDataByEmail(control.id, Array.from(sel), emails); logEvent({ action: 'Share', description: `Requested ${sel.size} TOD document(s) for ${control.id} from ${emails.length} recipient(s)`, module: 'SOX ICFR', entity: 'Control' }); addToast({ type: 'success', title: 'Request sent', message: `${sel.size} document request${sel.size === 1 ? '' : 's'} emailed to ${emails.length === 1 ? emails[0] : `${emails.length} recipients`}.` }); onClose(); }} className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[0.78125rem] font-semibold disabled:opacity-40 enabled:hover:bg-brand-700 transition-colors cursor-pointer"><Send size={14} /> Send request</button>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}

/**
 * What stands in for steps 2–4 on an automated control.
 *
 * Says the thing rather than leaving a gap: which three steps are absent, why
 * they are absent, and — the part that matters to a reviewer — what would bring
 * them back. A short-form paper that does not name its own precondition reads as
 * work someone skipped.
 */
function ShortFormNote({ control }: { control: Control }) {
  return (
    <div className="rounded-xl border border-canvas-border bg-paper-50/50 px-5 py-4 my-1.5">
      <div className="flex items-start gap-2.5">
        <span className="w-7 h-7 rounded-lg bg-brand-50 text-brand-600 inline-flex items-center justify-center shrink-0"><Cpu size={14} /></span>
        <div className="min-w-0">
          <h4 className="text-[0.8125rem] font-bold text-ink-900">Population, sample and TOE don't apply</h4>
          <p className="text-[0.75rem] text-ink-500 mt-1 leading-relaxed max-w-[42rem]">
            {control.description.split('.')[0]} runs automatically, so it does the same thing to every
            transaction — testing fifty proves nothing that testing one did not. The design test is the
            whole test, and this control concludes on it alone.
          </p>
          <p className="text-[0.71875rem] text-ink-400 mt-2 leading-relaxed max-w-[42rem]">
            That holds while the IT general controls behind the system do. If change management or access
            fails, nobody can say the logic that ran in March is the logic that ran in October — these three
            steps come back and the control is tested like a manual one.
          </p>
        </div>
      </div>
    </div>
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
  const label = which === 'design' ? 'TOD' : 'TOE';
  // The box is open before either button is pressed, drafted from the evidence.
  // Seeded once per track state so a rationale already on the paper is what you
  // come back to, and re-testing redrafts rather than leaving stale words behind.
  const drafted = concludeRationale(control, which);
  const [note, setNote] = useState(track.rationale ?? drafted);
  const [seed, setSeed] = useState(track.rationale ?? drafted);
  if (seed !== (track.rationale ?? drafted)) { setSeed(track.rationale ?? drafted); setNote(track.rationale ?? drafted); }
  if (!canEdit) return null;
  const apply = (target: TrackConclusion) => {
    const rationale = note.trim();
    conclude(control.id, target, rationale);                       // conclusion and its words, together
    logEvent({ action: 'Update', description: `Concluded ${which === 'design' ? 'TOD' : 'TOE'} ${target.toLowerCase()} for ${control.id}`, module: 'SOX ICFR', entity: 'Control' });
    // Going against the evidence is still its own record — the same words, filed
    // as an override so the banner and the working paper both show the departure.
    const contradicts = suggestion !== 'Not tested' && target !== suggestion;
    if (contradicts) override(control.id, { result: target === 'Effective' ? 'Effective' : 'Ineffective', by: me, at: 'just now', rationale });
    else override(control.id, null);
    addToast({ type: 'success', title: `${label} concluded ${target.toLowerCase()}`, message: contradicts ? 'Saved against the evidence — your rationale is on the paper.' : 'Saved to the working paper.' });
  };
  return (
    <div className="mt-4 pt-4 border-t border-canvas-border">
      {suggestion !== 'Not tested' && <div className="text-[0.71875rem] text-ink-400 inline-flex items-center gap-1 mb-2"><Scale size={12} /> Evidence suggests <b className="font-semibold text-ink-600">{suggestion}</b></div>}
      {/* Drafted, not demanded: the words are already here and the buttons never
          wait on them, so a clean control concludes in one click and the paper
          still carries a sentence saying what was tested and what it showed. */}
      <label className="block">
        <span className="text-[0.71875rem] font-semibold text-ink-500">Rationale</span>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
          placeholder="Record your rationale — retained in the working paper."
          className="mt-1 w-full text-[0.75rem] rounded-lg border border-canvas-border bg-canvas-elevated px-2.5 py-2 text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-200 resize-none" />
      </label>
      <div className="flex items-center gap-2.5 flex-wrap mt-2.5">
        <button disabled={disabled || disableEffective} title={disableEffective ? disableEffectiveNote : undefined} onClick={() => apply('Effective')} className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-compliant-600 text-white text-[0.78125rem] font-semibold enabled:hover:bg-compliant-700 disabled:opacity-40 transition-colors cursor-pointer">{disableEffective ? <Lock size={14} /> : <CheckCircle2 size={15} />} Conclude effective</button>
        <button disabled={disabled} onClick={() => apply('Ineffective')} className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg border border-risk-300 text-risk-700 text-[0.78125rem] font-semibold enabled:hover:bg-risk-50 disabled:opacity-40 transition-colors cursor-pointer"><XCircle size={15} /> Conclude ineffective</button>
        {disableEffective && disableEffectiveNote && <span className="text-[0.71875rem] text-mitigated-700 inline-flex items-center gap-1"><Lock size={11} /> {disableEffectiveNote}</span>}
      </div>
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
  const { me, setDesignPoint, validateDesignPoint, overrideDesignPoint, removeDesignPoint, linkDesignPointEvidence, setDesignPointProof } = useIcfr();
  const [over, setOver] = useState(false);
  const [validating, setValidating] = useState(false);
  const [showQA, setShowQA] = useState(false);
  const [linking, setLinking] = useState(false);
  const [proving, setProving] = useState(false);
  const eff = pointResult(point);
  const runValidate = () => { setValidating(true); window.setTimeout(() => { validateDesignPoint(control.id, point.id); setValidating(false); }, VALIDATE_MS); };

  // The elements this check points at. Resolved by id every render rather than
  // cached — an element that was removed must stop being cited, not linger as a
  // reference to a document nobody can open.
  const linked = control.design.documents.filter(d => point.evidencedBy?.includes(d.id));
  const attach = (kind: AuditorProofKind) => {
    setDesignPointProof(control.id, point.id, {
      kind,
      file: { id: `ap-${point.id}`, name: `${kind.replace(/[^A-Za-z0-9]+/g, '_')}_${control.id}.pdf`, kind: 'PDF', uploadedBy: me, uploadedAt: 'just now' },
    });
    setProving(false);
  };

  return (
    <div className="subcard px-3.5 py-3">
      <div className="flex items-start gap-3">
        {validating ? <span className="w-5 h-5 inline-flex items-center justify-center"><Loader2 size={15} className="animate-spin text-evidence-600" /></span> : <Tickmark result={eff} size={20} />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2"><span className="text-[0.78125rem] font-medium text-ink-800">{point.text}</span>{point.override && <span className="override-tag"><Pencil size={9} /> Overridden</span>}</div>
          <div className="text-[0.6875rem] text-ink-400 mt-1 inline-flex items-center gap-1.5"><WorkflowIcon size={11} /> {point.workflowName ?? 'Design walkthrough check'} · {validating ? 'validating…' : (point.workflowRunRef ?? 'not validated')}</div>
          {point.override && <div className="text-[0.6875rem] text-high-700 mt-1 flex items-start gap-1"><CornerDownRight size={11} className="mt-0.5 shrink-0" /> {point.override.rationale}</div>}

          {/* ── what proves this check ──────────────────────────────────────────
              Two lines, and the difference between them is the whole point: the
              first cites what the CLIENT gave us, by reference to the element it
              was uploaded against — the same file never enters the audit twice.
              The second is the auditor's own work, which has no element to live
              on because elements are client-supplied. A check with only the first
              was read; a check with the second was tested. */}
          <div className="mt-2 space-y-1">
            <div className="flex items-start gap-1.5 flex-wrap text-[0.6875rem]">
              <span className="text-ink-400 shrink-0">Evidenced by</span>
              {linked.length > 0
                ? linked.map(d => (
                  <span key={d.id} className="inline-flex items-center gap-1 rounded-md border border-canvas-border bg-canvas-elevated px-1.5 py-0.5 text-ink-600" title={d.files?.[0]?.name ?? 'no file attached to this element yet'}>
                    <Link2 size={9} /> {docLabel(d)}
                  </span>
                ))
                : <span className="text-ink-300">nothing linked</span>}
              {canEdit && <button onClick={() => setLinking(l => !l)} className="text-brand-600 font-semibold hover:underline cursor-pointer">{linked.length ? 'Change' : 'Link elements'}</button>}
            </div>

            <div className="flex items-start gap-1.5 flex-wrap text-[0.6875rem]">
              <span className="text-ink-400 shrink-0">Auditor's proof</span>
              {point.auditorProof ? (
                <span className="inline-flex items-center gap-1 rounded-md border border-evidence-200 bg-evidence-50/50 px-1.5 py-0.5 text-evidence-700" title={point.auditorProof.file.name}>
                  <Paperclip size={9} /> {point.auditorProof.kind}
                </span>
              ) : <span className="text-ink-300">none — taken on the documents</span>}
              {canEdit && (point.auditorProof
                ? <button onClick={() => setDesignPointProof(control.id, point.id, null)} className="text-ink-400 font-semibold hover:text-risk-600 hover:underline cursor-pointer">Remove</button>
                : <button onClick={() => setProving(p => !p)} className="text-brand-600 font-semibold hover:underline cursor-pointer">Attach your own</button>)}
            </div>
          </div>

          {/* pick from what is already on this control — never an upload box */}
          {linking && canEdit && (
            <div className="mt-2 rounded-lg border border-canvas-border bg-paper-50/60 p-2.5">
              <span className="block text-[0.625rem] font-bold uppercase tracking-wider text-ink-400 mb-1.5">Which elements evidence this check?</span>
              {control.design.documents.length === 0 ? (
                <p className="text-[0.6875rem] text-ink-400">No design elements on this control yet — add one above first.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {control.design.documents.map(d => {
                    const on = point.evidencedBy?.includes(d.id) ?? false;
                    return (
                      <button key={d.id}
                        onClick={() => linkDesignPointEvidence(control.id, point.id, on ? (point.evidencedBy ?? []).filter(x => x !== d.id) : [...(point.evidencedBy ?? []), d.id])}
                        className={cn('h-7 px-2.5 rounded-md border text-[0.6875rem] font-semibold transition-colors cursor-pointer', on ? 'bg-brand-50 border-brand-300 text-brand-700' : 'border-canvas-border bg-canvas-elevated text-ink-600 hover:border-ink-300')}>
                        {on && <Check size={10} className="inline -mt-0.5 mr-1" />}{docLabel(d)}
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="text-[0.625rem] text-ink-400 mt-2">A link, not a copy — the file stays on the element it was uploaded against.</p>
            </div>
          )}

          {proving && canEdit && (
            <div className="mt-2 rounded-lg border border-canvas-border bg-paper-50/60 p-2.5">
              <span className="block text-[0.625rem] font-bold uppercase tracking-wider text-ink-400 mb-1.5">What did you do on this check?</span>
              <div className="flex flex-wrap gap-1.5">
                {AUDITOR_PROOF_KINDS.map(k => (
                  <button key={k} onClick={() => attach(k)} className="h-7 px-2.5 rounded-md border border-canvas-border bg-canvas-elevated text-[0.6875rem] font-semibold text-ink-700 hover:border-evidence-300 hover:text-evidence-700 transition-colors cursor-pointer">{k}</button>
                ))}
              </div>
              <p className="text-[0.625rem] text-ink-400 mt-2">This is what the conclusion's basis is read from — nobody types the basis.</p>
            </div>
          )}
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
              placeholder={w.attendees.length ? 'Add another…' : 'Name · role, then Enter'} aria-label="Add an attendee"
              className="h-[22px] px-2 w-[170px] rounded border border-canvas-border bg-canvas-elevated text-[0.65625rem] focus:outline-none focus:ring-2 focus:ring-brand-200" />
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
//
// All three live in the right rail above History and Discussion: they are a read
// on the work rather than part of it, and a full-width strip across the top of
// the paper pushed step ① — the thing the auditor came here to do — below the
// fold.
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
      explainer: "Every required element needs evidence attached before TOD can be concluded effective. Optional elements strengthen the file but don't gate.",
    },
    {
      label: 'Evidence validated', pct: toeTotal ? Math.round((toeDone / toeTotal) * 100) : 0, detail: `${toeDone}/${toeTotal} operating checks run`, gate: true,
      explainer: 'Each operating check has to be run against the sampled evidence — unvalidated checks hold back an effective conclusion.',
    },
    {
      label: 'TOD coverage confidence', pct: points.length ? Math.round((passed / points.length) * 100) : 0, detail: `${passed}/${points.length} considerations pass`,
      explainer: 'How much of the design the considerations cover and pass — higher confidence means a stronger TOD.',
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
  const { role, addDesignDoc, attachDesignEvidence, removeDesignDoc, waiveDesignDoc, clearDesignWaiver, addDesignPoint, validateDesignPoint } = useIcfr();
  // The owner keeps the evidence lane and loses the testing lane — see the note
  // on the dossier's own canEdit / canTest split.
  const isOwner = role === 'risk-owner';
  const canTest = canEdit && role === 'auditor';
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
  const proven = auditorProvenChecks(control);
  // Dismissed for this sitting only. Not persisted: a suggestion waved away on
  // Monday should come back when the control is picked up again in a later
  // round, because what the control does may have moved since.
  const [dismissed, setDismissed] = useState<string[]>([]);
  const suggestions = suggestedDesignChecks(control).filter(s => !dismissed.includes(s));
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
        <EmptyState icon={<FileText size={18} />} title="TOD isn’t set up yet" hint="Add the design elements to evidence (process narrative, flowchart, walkthrough, precision & thresholds) and the design checks to assess. You can request the documents from the control owner by email.">
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

          {/* ── considerations — the auditor's checks, not the owner's ──────────
              Each row is an attribute-level test outcome with the auditor's
              validation, override and rationale on it. Shown to the first line,
              it tells them exactly what is being assessed and how it is going. */}
          {isOwner ? null : (<>
          {/* ── what the list is missing ────────────────────────────────────────
              Above the checks rather than below them, because it is about the
              set as a whole. Nothing is inserted for you: an auditor who did not
              choose a check is an auditor who will not defend it at review. */}
          {canTest && suggestions.length > 0 && (
            <div className="mb-3 rounded-xl border border-brand-200 bg-brand-50/40 p-3.5">
              <div className="flex items-start gap-2">
                <Sparkles size={14} className="text-brand-600 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[0.75rem] text-ink-700 leading-relaxed">
                    <span className="font-bold text-ink-900">Ira read this control.</span> {suggestions.length} consideration{suggestions.length === 1 ? '' : 's'} worth testing {suggestions.length === 1 ? 'is' : 'are'} not on the list yet — from its objective, assertions and nature.
                  </p>
                  <div className="mt-2 space-y-1.5">
                    {suggestions.map(s => (
                      <div key={s} className="flex items-start justify-between gap-2.5 rounded-lg border border-canvas-border bg-canvas-elevated px-2.5 py-2">
                        <span className="text-[0.71875rem] text-ink-700 leading-relaxed min-w-0">{s}</span>
                        <span className="flex items-center gap-1 shrink-0">
                          <button onClick={() => { addDesignPoint(control.id, s); logEvent({ action: 'Create', description: `Added a suggested design check to ${control.id}`, module: 'SOX ICFR', entity: 'Control' }); }}
                            className="h-7 px-2.5 rounded-md bg-brand-600 text-white text-[0.6875rem] font-semibold hover:bg-brand-700 transition-colors cursor-pointer">Add</button>
                          <button onClick={() => setDismissed(d => [...d, s])} title="Not relevant to this control"
                            className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-canvas-border text-ink-400 hover:text-ink-700 hover:border-ink-300 transition-colors cursor-pointer"><X size={12} /></button>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
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
          {/* Read off the auditor's own proof across the checks — see designBasis.
              It used to be read off the walkthrough alone, which meant a control
              could carry three reperformed checks and still describe itself as
              documents-only. */}
          <p className="mt-3 text-[0.71875rem] text-ink-500 leading-relaxed">
            <span className="text-ink-400">Basis</span> · {designBasis(control)}
            {proven > 0 && <span className="text-ink-400"> — {proven} of {control.design.points.length} check{control.design.points.length === 1 ? '' : 's'} carry the auditor's own proof</span>}
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
          <ConcludeFooter control={control} which="design" suggestion={suggestion} canEdit={canTest}
            disableEffective={!complete || unvalidated > 0}
            disableEffectiveNote={!complete
              ? `Locked — ${completeness.total - completeness.done} required element${completeness.total - completeness.done === 1 ? ' still needs' : 's still need'} evidence`
              : unvalidated > 0
                ? `Locked — ${unvalidated} design check${unvalidated === 1 ? '' : 's'} not validated yet`
                : undefined} />
          </>)}
          {/* What the owner gets in its place: the state of their own lane. */}
          {isOwner && (
            <p className="mt-3 text-[0.71875rem] text-ink-500 leading-relaxed rounded-lg border border-canvas-border bg-paper-50/60 px-3 py-2.5">
              {missing.length > 0
                ? <><span className="font-semibold text-ink-700">{missing.length} document{missing.length > 1 ? 's' : ''} still outstanding.</span> Attach what you hold — the auditor takes it from there.</>
                : <><span className="font-semibold text-ink-700">Everything asked for is on file.</span> The auditor's testing and its conclusion are not shown here.</>}
            </p>
          )}
        </>
      )}
      <AnimatePresence>{modal && <RequestDataModal control={control} onClose={() => setModal(false)} />}</AnimatePresence>
    </div>
  );
}

// ── sample extraction (step ③) — transaction detail → size/method/seed → draw ───
/** Deterministic mock row facts so filters and specs are stable across runs. */
function sampleRowFacts(i: number): { date: string; amountL: number } {
  const MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
  const day = ((i * 7) % 27) + 1;
  const amountL = 8 + ((i * 37) % 190); // ₹ lakh, 8–197
  return { date: `${day} ${MONTHS[(i * 5) % 12]} FY26`, amountL };
}

// ── IPE (inside step ②) — the entity-produced report is itself under test ────────
/** Rebuilt Aug 2026 (Step-2 action item 17).
 *
 *  A report the CLIENT produced is not trustworthy because it arrived. Before a
 *  single item is sampled out of it, the report itself is the thing under test:
 *  was it run from the live system with the parameters this test assumes, does
 *  it hold every record it should, and is what it says about each record true?
 *
 *  It sits INSIDE step ②, under the population it proves and above the lock,
 *  rather than taking a number of its own — the model has said since it was
 *  first written that IPE is "worked alongside the population it proves", and a
 *  sixth step would have renumbered every step after it.
 *
 *  Not reliable holds the lock shut, and the sample, the TOE and the sign-off
 *  all sit behind that lock. The cascade is the point: a population drawn from
 *  an unproven report is not a weaker population, it is the wrong one. One fix
 *  upstream opens all four. See populationReady. */
const IPE_TONE: Record<IpeConclusion, string> = {
  'Reliable': 'text-compliant-700',
  'Not reliable': 'text-risk-700',
  'Not tested': 'text-ink-400',
};

/** One dimension, worked. The assertion and the procedure are seeded — the
 *  auditor tests, never authors, so the standard cannot quietly shrink to
 *  whatever somebody had time for. What they add is the finding and the proof. */
function IpeCheckRow({ control, check, canWrite, reportCount }: { control: Control; check: IpeCheck; canWrite: boolean; reportCount: number }) {
  const { me, setIpeCheck } = useIcfr();
  const [draft, setDraft] = useState(check.note ?? '');
  const [counted, setCounted] = useState('');
  const answered = check.result !== 'Not tested';

  // The call's own example, made operable: the auditor queries the system
  // themselves, and the difference between what they counted and what the
  // report claims IS the finding. Typed once, written out in words.
  const n = Number(counted);
  const variance = counted.trim() !== '' && Number.isFinite(n) && n >= 0 ? n - reportCount : null;
  const pct = variance != null && reportCount > 0 ? Math.abs(Math.round((variance / reportCount) * 1000) / 10) : 0;
  const countedNote = variance == null ? ''
    : variance === 0
      ? `Counted independently in the source system over the same window — ${n.toLocaleString()} records, agreeing to the report's ${reportCount.toLocaleString()} exactly.`
      : `Counted independently in the source system over the same window — ${n.toLocaleString()} records against the report's ${reportCount.toLocaleString()}. ${Math.abs(variance).toLocaleString()} ${variance > 0 ? 'record(s) the report does not show' : 'record(s) the report shows that the system does not hold'} — ${pct}%.`;

  const save = (result?: TestResult) => {
    const note = draft.trim();
    setIpeCheck(control.id, check.id, { ...(result ? { result } : {}), note: note || undefined });
  };
  const attach = () => {
    const file = { id: `ev-${check.id}-${(check.evidence?.length ?? 0) + 1}`, name: `IPE_${check.dimension.replace(/[^A-Za-z0-9]+/g, '_')}_${control.id}.pdf`, kind: 'PDF' as const, uploadedBy: me, uploadedAt: 'just now' };
    setIpeCheck(control.id, check.id, { evidence: [...(check.evidence ?? []), file] });
  };

  return (
    <div className="subcard px-3.5 py-3">
      <div className="flex items-start gap-3">
        <Tickmark result={check.result} size={18} />
        <div className="min-w-0 flex-1">
          <span className="block text-[0.65625rem] font-bold uppercase tracking-wider text-ink-400">{check.dimension}</span>
          <p className="text-[0.78125rem] text-ink-800 leading-relaxed mt-0.5">{check.description}</p>
          <p className="text-[0.6875rem] text-ink-400 leading-relaxed mt-1 flex items-start gap-1.5"><FlaskConical size={11} className="mt-0.5 shrink-0" /> {check.method}</p>

          {/* the auditor's own count, only where counting is the procedure */}
          {check.dimension === 'Completeness' && canWrite && !answered && (
            <div className="mt-2.5 rounded-md border border-canvas-border bg-canvas-elevated px-2.5 py-2">
              <span className="block text-[0.625rem] font-bold uppercase tracking-wider text-ink-400 mb-1.5">Count it yourself</span>
              <div className="flex items-center gap-2 flex-wrap">
                <input type="number" min={0} value={counted} onChange={e => setCounted(e.target.value)} placeholder="records in the system"
                  className="w-44 h-8 px-2.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.78125rem] tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-200" />
                <span className="text-[0.6875rem] text-ink-400">the report claims <span className="tabular-nums font-semibold text-ink-700">{reportCount.toLocaleString()}</span></span>
                {variance != null && (
                  <span className={cn('text-[0.6875rem] font-bold', variance === 0 ? 'text-compliant-700' : 'text-risk-700')}>
                    {variance === 0 ? 'Ties' : `Off by ${Math.abs(variance).toLocaleString()} · ${pct}%`}
                  </span>
                )}
                {variance != null && (
                  <button onClick={() => setDraft(countedNote)}
                    className="h-8 px-3 rounded-md border border-canvas-border text-[0.71875rem] font-semibold text-ink-700 hover:border-ink-300 transition-colors cursor-pointer">Write it up</button>
                )}
              </div>
            </div>
          )}

          {/* the finding — required to fail, because a failure nobody wrote down is not one */}
          {canWrite && !answered ? (
            <div className="mt-2.5">
              <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={2}
                placeholder={check.dimension === 'Completeness' ? 'What the tie-out showed — the numbers, and the variance if there is one' : check.dimension === 'Accuracy' ? 'Which records were vouched, to what, and what was found' : 'What the parameter screen showed, and how it agrees to the test scope'}
                className="w-full px-2.5 py-2 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.71875rem] leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-brand-200" />
              <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                <button onClick={() => save('Pass')} disabled={!draft.trim()} title={draft.trim() ? undefined : 'Record what was found first.'}
                  className="h-8 px-3 inline-flex items-center gap-1.5 rounded-md bg-compliant-600 text-white text-[0.71875rem] font-semibold enabled:hover:bg-compliant-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"><CheckCircle2 size={12} /> Pass</button>
                <button onClick={() => save('Fail')} disabled={!draft.trim()} title={draft.trim() ? undefined : 'Record what was found first.'}
                  className="h-8 px-3 inline-flex items-center gap-1.5 rounded-md border border-risk-300 text-risk-700 text-[0.71875rem] font-semibold enabled:hover:bg-risk-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"><XCircle size={12} /> Fail</button>
                <button onClick={attach} className="h-8 px-3 inline-flex items-center gap-1.5 rounded-md border border-canvas-border bg-canvas-elevated text-[0.71875rem] font-semibold text-ink-600 hover:border-evidence-300 hover:text-evidence-700 transition-colors cursor-pointer"><Paperclip size={12} /> Attach proof</button>
                <span className="text-[0.625rem] text-ink-400">This prints on the working paper.</span>
              </div>
            </div>
          ) : check.note ? (
            <p className="mt-2 text-[0.6875rem] text-ink-600 leading-relaxed">
              <span className="text-ink-400">Found</span> · {check.note}
              {canWrite && answered && <button onClick={() => { setDraft(check.note ?? ''); setIpeCheck(control.id, check.id, { result: 'Not tested' }); }} className="ml-2 text-brand-600 font-semibold hover:underline cursor-pointer">Re-test</button>}
            </p>
          ) : null}

          {check.evidence && check.evidence.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {check.evidence.map(f => (
                <span key={f.id} className="inline-flex items-center gap-1 rounded-md border border-canvas-border bg-canvas-elevated px-2 py-1 text-[0.65625rem] text-ink-600"><Paperclip size={10} /> {f.name}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function IpeSection({ control, canWrite, isAuditor }: { control: Control; canWrite: boolean; isAuditor: boolean }) {
  const { me, registerIpe, concludeIpe, clearIpe } = useIcfr();
  const logEvent = useAuditLog();
  const { addToast } = useToast();
  const files = useAuditFiles();
  const pop = control.operating.population;
  const sourceFile = files.find(f => f.name === pop?.sourceFile);
  const ipe = control.operating.ipe;
  const reliable = ipe?.conclusion === 'Reliable';
  // Settled work folds away; unsettled work does not get to hide.
  const [open, setOpen] = useState(!reliable);

  // Everything the audit already knows is filled in. The auditor is asked only
  // for what the platform cannot know — the report's identifier in the source
  // system, who at the client ran it, and what it totals to.
  const [name, setName] = useState(sourceFile?.name ?? '');
  const [system, setSystem] = useState(sourceFile?.system ?? '');
  const [ref, setRef] = useState('');
  const [params, setParams] = useState(pop?.criteria ?? '');
  const [by, setBy] = useState(sourceFile?.systemFetched ? `${me} — pulled by the audit team` : '');
  // NOT prefilled from the file record. When the file reached the audit and when
  // the client ran the report are different dates, and "run on: at scoping" is a
  // claim about the client that nobody made.
  const [at, setAt] = useState('');
  const [count, setCount] = useState(String(pop?.sourceCount ?? sourceFile?.rows ?? ''));
  const [total, setTotal] = useState('');

  if (!pop) return null;
  const suggestion = ipe ? ipeSuggestion(ipe) : 'Not tested';
  const allAnswered = !!ipe && ipe.checks.every(k => k.result !== 'Not tested');
  const canRegister = !!name.trim() && !!system.trim() && !!ref.trim() && !!by.trim() && Number(count) > 0;

  const field = (label: string, value: string, set: (v: string) => void, placeholder: string, type: 'text' | 'number' = 'text') => (
    <label className="min-w-0">
      <span className="block text-[0.625rem] font-bold uppercase tracking-wider text-ink-400 mb-1">{label}</span>
      <input type={type} value={value} onChange={e => set(e.target.value)} placeholder={placeholder}
        className="w-full h-8 px-2.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.75rem] text-ink-800 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-brand-200" />
    </label>
  );

  return (
    <div className={cn('rounded-xl border', reliable ? 'border-compliant-200 bg-compliant-50/30' : ipe?.conclusion === 'Not reliable' ? 'border-risk-200 bg-risk-50/30' : 'border-canvas-border bg-paper-50/50')}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left cursor-pointer">
        {open ? <ChevronDown size={14} className="text-ink-400 shrink-0" /> : <ChevronRight size={14} className="text-ink-400 shrink-0" />}
        <span className="text-[0.78125rem] font-bold text-ink-900">IPE test</span>
        <span className="text-[0.6875rem] text-ink-400 min-w-0 truncate">— the report this population came out of, proven before anything is built on it</span>
        <span className={cn('ml-auto shrink-0 text-[0.71875rem] font-bold', IPE_TONE[ipe?.conclusion ?? 'Not tested'])}>
          {ipe ? ipe.conclusion : 'Not tested'}
        </span>
      </button>

      {open && (
        <div className="px-3.5 pb-3.5">
          {!ipe ? (
            canWrite && isAuditor ? (
              <>
                <p className="text-[0.71875rem] text-ink-500 leading-relaxed mb-3">
                  {sourceFile?.systemFetched
                    ? <>This source was pulled from <span className="font-semibold text-ink-700">{sourceFile.system}</span> by the audit team, so how it was run is already known. What it holds and what it says still have to be proven.</>
                    : <>A report the client generated is not reliable because it arrived. Register it, and the three checks every entity-produced report answers are seeded for you to work.</>}
                </p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                  {field('Report name', name, setName, 'e.g. New vendor master listing')}
                  {field('Source system', system, setSystem, 'e.g. SAP S/4HANA — Production')}
                  {field('Report / transaction code', ref, setRef, 'e.g. S_ALR_87012086')}
                  {field('Run by (at the client)', by, setBy, 'who generated it')}
                  {field('Run on', at, setAt, 'e.g. 4 Apr 2026')}
                  {field('Records in the report', count, setCount, 'row count', 'number')}
                </div>
                <div className="mt-2.5">
                  <span className="block text-[0.625rem] font-bold uppercase tracking-wider text-ink-400 mb-1">Parameters it was run with</span>
                  <textarea value={params} onChange={e => setParams(e.target.value)} rows={2} placeholder="Company code, date range, document types — exactly how it was run"
                    className="w-full px-2.5 py-2 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.71875rem] leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-brand-200" />
                </div>
                <div className="mt-2.5">
                  {field('Control total, and what it was agreed to', total, setTotal, 'e.g. ₹41.2 Cr, agreed to GL 200100')}
                </div>
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <button disabled={!canRegister} title={canRegister ? undefined : 'Name, system, report code, who ran it and the record count are all needed.'}
                    onClick={() => {
                      registerIpe(control.id, { reportName: name.trim(), system: system.trim(), reportRef: ref.trim(), parameters: params.trim(), generatedBy: by.trim(), generatedAt: at.trim(), recordCount: Number(count), controlTotal: total.trim() });
                      logEvent({ action: 'Create', description: `Registered "${name.trim()}" as information produced by the entity on ${control.id}`, module: 'SOX ICFR', entity: 'Evidence' });
                    }}
                    className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[0.78125rem] font-semibold enabled:hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"><FileCheck2 size={14} /> Register the report</button>
                  <span className="text-[0.65625rem] text-ink-400">The population cannot lock until this report is proven reliable.</span>
                </div>
              </>
            ) : (
              <p className="text-[0.71875rem] text-ink-400 leading-relaxed">The report behind this population has not been registered yet. Only the auditor can test it.</p>
            )
          ) : (
            <>
              {/* what was registered — the facts anyone needs to re-run it */}
              <div className="rounded-lg border border-canvas-border bg-canvas-elevated px-3 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="block text-[0.78125rem] font-bold text-ink-900 truncate">{ipe.reportName}</span>
                    <span className="block text-[0.6875rem] text-ink-500 mt-0.5 truncate">{ipe.system} · <span className="font-mono">{ipe.reportRef}</span> · {ipe.recordCount.toLocaleString()} records</span>
                  </div>
                  {canWrite && isAuditor && (
                    <button onClick={() => { clearIpe(control.id); logEvent({ action: 'Delete', description: `Withdrew the registered report on ${control.id} — IPE testing restarted`, module: 'SOX ICFR', entity: 'Evidence' }); }}
                      className="shrink-0 h-7 px-2.5 inline-flex items-center gap-1 rounded-md border border-canvas-border text-[0.6875rem] font-semibold text-ink-500 hover:border-risk-300 hover:text-risk-600 transition-colors cursor-pointer"><RotateCcw size={11} /> Withdraw</button>
                  )}
                </div>
                <div className="mt-2 pt-2 border-t border-canvas-border grid grid-cols-2 gap-x-4 gap-y-1 text-[0.6875rem] text-ink-500">
                  {ipe.parameters && <span className="min-w-0 col-span-2"><span className="text-ink-400">Run with</span> · {ipe.parameters}</span>}
                  {ipe.generatedBy && <span className="min-w-0 truncate"><span className="text-ink-400">Run by</span> · {ipe.generatedBy}{ipe.generatedAt ? `, ${ipe.generatedAt}` : ''}</span>}
                  {ipe.controlTotal && <span className="min-w-0 truncate"><span className="text-ink-400">Totals to</span> · {ipe.controlTotal}</span>}
                </div>
              </div>

              <div className="mt-2.5 space-y-1.5">
                {ipe.checks.map(k => <IpeCheckRow key={k.id} control={control} check={k} canWrite={canWrite && isAuditor} reportCount={ipe.recordCount} />)}
              </div>

              {/* the verdict — a single failure sinks it, so the suggestion is stated and the auditor signs it */}
              <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
                <p className="text-[0.65625rem] text-ink-400 min-w-0">
                  {ipe.conclusion !== 'Not tested'
                    ? <>Concluded <span className={cn('font-bold', IPE_TONE[ipe.conclusion])}>{ipe.conclusion.toLowerCase()}</span> by {ipe.testedBy}{ipe.testedAt ? `, ${ipe.testedAt}` : ''}.</>
                    : allAnswered
                      ? <>All three worked. The checks read <span className="font-semibold text-ink-600">{suggestion.toLowerCase()}</span> — a single failure sinks the report.</>
                      : 'Work all three checks before concluding.'}
                </p>
                {canWrite && isAuditor && ipe.conclusion === 'Not tested' && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button disabled={!allAnswered || suggestion !== 'Reliable'} title={!allAnswered ? 'Work all three checks first.' : suggestion !== 'Reliable' ? 'A check failed — the report cannot be concluded reliable.' : undefined}
                      onClick={() => { concludeIpe(control.id, 'Reliable'); setOpen(false); addToast({ type: 'success', title: 'Report reliable', message: `${ipe.reportName} — the population can be locked.` }); }}
                      className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-compliant-600 text-white text-[0.78125rem] font-semibold enabled:hover:bg-compliant-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"><CheckCircle2 size={14} /> Reliable</button>
                    <button disabled={!allAnswered}
                      onClick={() => { concludeIpe(control.id, 'Not reliable'); addToast({ type: 'error', title: 'Report not reliable', message: 'The population cannot be locked off this report.' }); }}
                      className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg border border-risk-300 text-risk-700 text-[0.78125rem] font-semibold enabled:hover:bg-risk-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"><XCircle size={14} /> Not reliable</button>
                  </div>
                )}
                {canWrite && isAuditor && ipe.conclusion !== 'Not tested' && (
                  <button onClick={() => concludeIpe(control.id, 'Not tested')}
                    className="shrink-0 h-8 px-3 inline-flex items-center gap-1.5 rounded-md border border-canvas-border text-[0.71875rem] font-semibold text-ink-600 hover:border-ink-300 transition-colors cursor-pointer"><RotateCcw size={12} /> Reopen</button>
                )}
              </div>

              {ipe.conclusion === 'Not reliable' && (
                <p className="mt-2 text-[0.6875rem] text-risk-700 leading-relaxed flex items-start gap-1.5">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                  <span>The population cannot be locked off this report, so the sample, the TOE and the sign-off stay shut. Get a corrected report and register it, or re-test the check that failed.</span>
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
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
/** A Date back to 'YYYY-MM-DD' by its LOCAL parts. `toISOString().slice(0, 10)`
 *  would convert to UTC first and hand back the previous day west of it — the
 *  same drift `parseDay` exists to avoid. */
function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function PopulationPreviewModal({ control, onClose }: { control: Control; onClose: () => void }) {
  const pop = control.operating.population!;
  const SHOWN = 25;
  const rows = useMemo(() => {
    // Deterministic — a tiny LCG seeded off the control id.
    let s = control.id.split('').reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
    const next = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
    const start = (parseDay(pop.filterFrom) ?? new Date(2026, 0, 1)).getTime();
    const end = (parseDay(pop.filterTo) ?? new Date(2026, 11, 31)).getTime();
    const span = Math.max(1, end - start);
    const who = ['R. Nair', 'S. Kulkarni', 'A. Verma', 'P. Desai', 'M. Iyer'];
    const kind = ['Vendor payment run', 'Payroll disbursement', 'Inter-company transfer', 'Utility settlement', 'Treasury sweep'];
    return Array.from({ length: Math.min(SHOWN, pop.count) }, (_, i) => ({
      ref: `${control.id}-${String(i + 1).padStart(5, '0')}`,
      date: isoDay(new Date(start + next() * span)),
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
                  <td className="px-3 py-1.5 text-ink-600 whitespace-nowrap tabular-nums">{fmtDay(r.date)}</td>
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

/** The count, with the context it takes to judge it.
 *
 *  "Count matches expected" used to be a tick box. It was the wrong shape twice
 *  over: the arithmetic was the application's to do, and the judgement it was
 *  standing in for — does this number look like a year of this control — cannot
 *  be made from the number alone. So the arithmetic is done above (countVerdict)
 *  and this shows the two things that make the judgement possible: how the
 *  instances fall across the months, and what the same control returned last
 *  round. Then it asks.
 */
function CountContext({ control, canWrite, locked }: { control: Control; canWrite: boolean; locked: boolean }) {
  const { eng, openAuditId, me, setPopulationFacts } = useIcfr();
  const logEvent = useAuditLog();
  const pop = control.operating.population;
  const months = monthlyBreakdown(control);
  const spikes = spikeMonths(months);
  const prior = priorRoundCount(eng, control, openAuditId);
  if (!pop) return null;

  const live = months.filter(m => m.n > 0);
  const zeros = months.filter(m => m.n === 0);
  const peak = months.reduce((n, m) => Math.max(n, m.n), 0);
  const perMonth = live.length ? Math.round(pop.count / live.length) : null;
  const drift = prior ? Math.round(((pop.count - prior.n) / prior.n) * 100) : null;
  const confirmed = pop.countConfirmed;

  return (
    <>
      <span className="block text-[0.65625rem] font-bold uppercase tracking-wider text-ink-400 mt-4 mb-2">Does the count read right?</span>
      <div className="rounded-xl border border-canvas-border bg-canvas-elevated p-3.5">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[0.71875rem] text-ink-500">
          <span className="text-[0.8125rem] font-bold text-ink-900 tabular-nums">{pop.count.toLocaleString()} instances</span>
          {perMonth != null && <span><span className="text-ink-400">around</span> <b className="font-semibold text-ink-700 tabular-nums">{perMonth.toLocaleString()}</b> a month</span>}
          {prior && (
            <span>
              <span className="text-ink-400">{prior.label}</span> · <b className="font-semibold text-ink-700 tabular-nums">{prior.n.toLocaleString()}</b>
              {drift != null && <span className={cn('ml-1 tabular-nums font-semibold', Math.abs(drift) >= 25 ? 'text-mitigated-800' : 'text-ink-400')}>{drift >= 0 ? '+' : ''}{drift}%</span>}
            </span>
          )}
        </div>

        {/* the months, as bars — a hole and a spike are both things you see
            faster than you read */}
        {months.length > 0 && (
          <>
            {/* The number sits in its own fixed row and the bar takes what is
                left, so a full-height bar cannot push the row taller than the
                months beside it. */}
            <div className="mt-3 flex items-stretch gap-1 h-16" role="img"
              aria-label={`Instances by month — ${months.map(m => `${m.label} ${m.n}`).join(', ')}`}>
              {months.map(m => {
                const zero = m.n === 0;
                const spike = spikes.has(m.key);
                return (
                  <div key={m.key} className="flex-1 min-w-0 flex flex-col items-center gap-1" title={`${m.label} · ${m.n.toLocaleString()} instances`}>
                    <span className={cn('text-[0.5625rem] font-bold tabular-nums leading-none shrink-0', zero ? 'text-risk-700' : spike ? 'text-mitigated-800' : 'text-ink-400')}>{m.n.toLocaleString()}</span>
                    <div className="flex-1 w-full flex items-end">
                      <div className={cn('w-full rounded-sm', zero ? 'bg-risk-200' : spike ? 'bg-mitigated-400' : 'bg-brand-200')}
                        style={{ height: zero ? 3 : `${Math.max(8, Math.round((m.n / Math.max(1, peak)) * 100))}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-1 flex items-center gap-1">
              {months.map(m => <span key={m.key} className={cn('flex-1 min-w-0 text-center text-[0.5625rem] font-semibold uppercase tracking-wide', m.n === 0 ? 'text-risk-700' : 'text-ink-400')}>{m.label}</span>)}
            </div>
          </>
        )}

        {zeros.length > 0 && (
          <p className="mt-2.5 text-[0.71875rem] text-risk-700 inline-flex items-start gap-1.5">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            <span>No instances at all in {zeros.map(m => m.label).join(', ')} — either the control did not run, or those months are not in the extract.</span>
          </p>
        )}
        {spikes.size > 0 && (
          <p className="mt-1.5 text-[0.71875rem] text-mitigated-800 inline-flex items-start gap-1.5">
            <AlertCircle size={12} className="mt-0.5 shrink-0" />
            <span>{months.filter(m => spikes.has(m.key)).map(m => m.label).join(', ')} holds more than double a typical month — usually a duplicate load or a second entity, occasionally the business itself.</span>
          </p>
        )}

        <div className="mt-3 pt-3 border-t border-canvas-border flex items-center justify-between gap-3 flex-wrap">
          {confirmed ? (
            <span className="text-[0.71875rem] font-semibold text-compliant-700 inline-flex items-center gap-1.5"><CheckCircle2 size={13} /> Count agreed by {confirmed.by}, {confirmed.at}</span>
          ) : (
            <p className="text-[0.65625rem] text-ink-400 min-w-0 flex-1">The arithmetic is settled above. This is the judgement it cannot make — that this is what a{months.length ? ` ${months.length}-month` : ''} run of this control looks like.</p>
          )}
          {!confirmed && canWrite && !locked && (
            <button onClick={() => { setPopulationFacts(control.id, { countConfirmed: { by: me, at: 'just now' } }); logEvent({ action: 'Update', description: `Agreed the population count for ${control.id} — ${pop.count.toLocaleString()} instances`, module: 'SOX ICFR', entity: 'Evidence' }); }}
              className="shrink-0 h-8 px-3 inline-flex items-center gap-1.5 rounded-md border border-canvas-border bg-canvas-elevated text-[0.71875rem] font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-700 transition-colors cursor-pointer"><Check size={12} /> The count reads right</button>
          )}
        </div>
      </div>
    </>
  );
}

/** Bring a file this control needs into the audit — and answer, once, where it
 *  came from.
 *
 *  The file lands in the audit's registry rather than on this control, so the
 *  next control that needs the same vendor master or access review picks it out
 *  of the list and is never asked the question again. */
/** `preset` arrives when the file was already chosen in the data picker. The
 *  modal then has exactly one question left — where it came from — and asking
 *  for the file a second time would be asking for something already given. */
function ControlUploadModal({ onClose, onAdd, preset }: { onClose: () => void; onAdd: (name: string, rows: number, origin: FileOrigin) => void; preset?: { name: string; rows: number } }) {
  const [name, setName] = useState(preset?.name ?? '');
  const [rows, setRows] = useState(preset?.rows ?? 0);
  const [origin, setOrigin] = useState<FileOrigin | undefined>();
  const [reading, setReading] = useState(false);
  const pick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls,.csv';
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return;
      setReading(true);
      // This prototype holds no file bytes — the row count is stated as a read
      // of the file, deterministic from its name so it never moves.
      window.setTimeout(() => {
        setName(f.name);
        setRows(400 + (f.name.split('').reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 5) % 19000));
        setReading(false);
      }, 900);
    };
    input.click();
  };
  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <motion.div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()} initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}>
        <div className="px-5 py-4">
          <h3 className="text-[0.875rem] font-bold text-ink-900">Add a source file</h3>
          <p className="text-[0.75rem] text-ink-500 mt-1 leading-relaxed">
            It joins this audit's files, so every other control can draw on it without being asked where it came from again.
          </p>

          {name ? (
            <div className="mt-3 flex items-center gap-2 px-3 py-2.5 rounded-lg border border-canvas-border bg-paper-50/60">
              <FileText size={13} className="text-brand-600 shrink-0" />
              <span className="text-[0.78125rem] font-semibold text-ink-900 truncate min-w-0">{name}</span>
              <span className="text-[0.6875rem] text-ink-400 tabular-nums shrink-0 ml-auto">{rows.toLocaleString()} rows</span>
              {/* No "choose a different file" when the picker already chose it —
                  that road leads back to the picker, not to this modal. */}
              {!preset && (
                <button onClick={() => { setName(''); setOrigin(undefined); }} aria-label="Choose a different file"
                  className="p-1 rounded text-ink-400 hover:text-risk-700 cursor-pointer shrink-0"><X size={12} /></button>
              )}
            </div>
          ) : (
            <button onClick={pick} disabled={reading}
              className="mt-3 w-full px-3 py-4 rounded-xl border border-dashed border-canvas-border bg-canvas-elevated hover:border-brand-400 hover:bg-brand-50/40 transition-colors cursor-pointer text-[0.78125rem] font-semibold text-ink-700 inline-flex items-center justify-center gap-2">
              {reading ? <><Loader2 size={14} className="animate-spin" /> Reading…</> : <><Upload size={14} className="text-brand-600" /> Choose a file</>}
            </button>
          )}

          <span className="block text-[0.65625rem] font-bold uppercase tracking-wider text-ink-400 mt-4 mb-2">Where did this file come from?</span>
          <OriginPicker value={origin} onPick={setOrigin} disabled={!name} />
          <p className="text-[0.65625rem] text-ink-400 mt-2 leading-relaxed">
            Asked once, here, and recorded on the file. Nothing that reads this file later has to ask again — and it can only be changed back on the file itself, under Configuration.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-canvas-border bg-paper-50/40">
          <button onClick={onClose} className="h-9 px-3.5 text-[0.78125rem] font-semibold text-ink-600 hover:text-ink-900 cursor-pointer">Cancel</button>
          <button disabled={!name || !origin} title={!name ? 'Choose a file first' : !origin ? 'Say where it came from first' : undefined}
            onClick={() => origin && onAdd(name, rows, origin)}
            className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[0.78125rem] font-semibold enabled:hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"><Plus size={13} /> Add file</button>
        </div>
      </motion.div>
    </div>,
    document.body);
}

/** STEP 1 — POPULATION.
 *
 *  Pick the file, filter it down to THIS control's instances, check three things,
 *  lock. The filter is the point: 18,432 general-ledger rows are not 340 payment
 *  approvals, and a "population" the same size as the file it came out of is a
 *  file somebody copied rather than a population somebody defined — which is why
 *  that case gets a warning rather than a silent pass.
 *
 *  Filtering lives HERE and only here. Step ③ draws off what this produced; it
 *  does not narrow it further, which is the confusion the two steps used to
 *  share.
 */
function PopulationSection({ control, canEdit }: { control: Control; canEdit: boolean }) {
  const { eng, openAuditId, role, me, setPopulation, clearPopulation, setPopulationFacts, lockPopulation, registerFile } = useIcfr();
  const logEvent = useAuditLog();
  const { addToast } = useToast();
  const files = useAuditFiles();
  const pop = control.operating.population;
  // Where this population's data came from — read off the file record, never
  // held here. Correcting the file record moves this line on every control.
  const sourceFile = files.find(f => f.name === pop?.sourceFile);
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
  const [from, setFrom] = useState(winFrom);
  const [to, setTo] = useState(winTo);
  const [extracting, setExtracting] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sourcePicker, setSourcePicker] = useState(false);
  const [uploadPreset, setUploadPreset] = useState<{ name: string; rows: number } | undefined>();
  // What the auditor expects the filter to return, stated BEFORE it runs. An
  // expectation recorded afterwards is an expectation fitted to the answer, so
  // it is asked for here and the extract will not run without it.
  const [expected, setExpected] = useState('');
  const chosen = files.find(f => f.name === picked);
  // What the application can offer towards that number: how many times the
  // control itself runs over the window. Not the same thing as how many
  // instances it touches, so it is a hint beside the field, never the value.
  const runsInWindow = derivedRunCount(control, from, to);

  // Drafted the moment a source is picked, then the auditor's to edit. Reseeded
  // when the source changes — criteria written against a spreadsheet do not
  // describe a pull from SAP, and silently keeping them would be worse than
  // asking again.
  const drafted = extractionCriteria(control, from, to, chosen && { system: chosen.system, name: chosen.name });
  const [criteria, setCriteria] = useState(drafted);
  const [criteriaSeed, setCriteriaSeed] = useState(drafted);
  if (criteriaSeed !== drafted) { setCriteriaSeed(drafted); setCriteria(drafted); }

  const extract = () => {
    if (!chosen || !Number(expected)) return;
    setExtracting(true);
    window.setTimeout(() => {
      // The filter narrows the file to this control's instances, and it lands on
      // the figure written down before the run. A number invented from the file
      // size would disagree with any expectation typed above it, so every extract
      // would open on a variance nobody asked to see.
      //
      // It is not made to agree exactly — a filter that returns the estimate to
      // the row is its own kind of unreal. The wobble sits on the OVER side and
      // inside the 5% band, because a shortfall is a completeness gate now: an
      // extract that undershot by chance would open every demo on a block that
      // has nothing to do with what is being shown. Deterministic from the
      // control id: the same extract twice running to a different number is not
      // something a working paper can carry.
      const want = Number(expected);
      const slack = Math.floor(want * EXTRACT_WOBBLE);
      const seed = control.id.split('').reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 11);
      const wobble = slack === 0 ? 0 : seed % (slack + 1);
      const narrowed = Math.max(1, Math.min(chosen.rows, want + wobble));
      setPopulation(control.id, {
        version,
        source: `${chosen.name} · ${chosen.from}`,
        sourceFile: chosen.name, sourceCount: chosen.rows,
        criteria: criteria.trim() || 'No filter applied',
        filterFrom: from || undefined, filterTo: to || undefined,
        // The criteria are prose now, but the over-extraction breakdown still
        // needs a dimension to name ("type Banking 1,180 · type Other 238"). The
        // sub-process is what the old Transaction-type box defaulted to, so this
        // is the same answer it always gave — just no longer typed by hand.
        filterType: control.subProcess !== 'General' ? control.subProcess : undefined,
        expectedCount: Number(expected),
        count: narrowed,
        // The person signed in is the person who just ran the extract, so that
        // one fact is filled in rather than asked for. The system fills itself in
        // too when the pull came from one — that is the whole point of fetching
        // rather than being handed a file. It stays editable either way.
        provenance: { system: chosen.system ?? '', extractedBy: me, extractedOn: '' },
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
    // The criteria come back as they were written, not redrafted — the point of
    // refiltering is to edit what you had, and a fresh draft would throw it away.
    if (pop.criteria && pop.criteria !== 'No filter applied') { setCriteriaSeed(pop.criteria); setCriteria(pop.criteria); }
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

  // Stated above the list, never applied to it. See suggestPopulationFile.
  const hint = useMemo(
    () => (pop ? null : suggestPopulationFile(eng, control, files, requiredDatasetsFor(control).map(r => r.name))),
    [eng, control, files, pop],
  );

  // The two sums the application does for itself, and what is still missing
  // before the population can be locked.
  const cv = countVerdict(control);
  const gv = coverageVerdict(control, winFrom, winTo);
  const needsExpected = pop?.expectedCount == null && derivedRunCount(control, pop?.filterFrom, pop?.filterTo) == null;
  const [expectedDraft, setExpectedDraft] = useState('');
  const ready = populationReady(control, winFrom, winTo);
  // Named in the order the step is worked, so the message always points at the
  // next thing to do rather than the last thing outstanding.
  const ipe = control.operating.ipe;
  const missing = needsExpected ? 'Record how many instances were expected before locking.'
    : cv?.blocks && !pop?.countNote?.trim()
      ? (cv.level === 'fail' ? 'The extract is short — refilter, or record why the shortfall stands, before locking.' : 'Refilter, or accept the count difference with a reason, before locking.')
      : gv?.blocks && !pop?.coverageNote?.trim() ? 'Settle the period gap, or record why it stands, before locking.'
        : !pop?.countConfirmed ? 'Agree the count reads right before locking.'
          // Named as its own reason rather than folded into the catch-all: the
          // auditor who cannot lock needs to be told the block is upstream of
          // the population entirely, not in the filter they were just editing.
          : !ipe ? 'Register the report this population came out of, and prove it, before locking.'
            : ipe.conclusion === 'Not reliable' ? 'The report behind this population is not reliable — nothing can be locked off it.'
              : ipe.conclusion === 'Not tested' ? 'Finish the IPE test on the report before locking.'
                : 'A check that did not hold needs resolving before locking.';

  return (
    <div className="p-5">
      {!pop ? (
        canWrite ? (
          <>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h4 className="text-[0.8125rem] font-bold text-ink-900">Select the source</h4>
                <p className="text-[0.71875rem] text-ink-500 mt-1 leading-relaxed">A file the client sent, or a pull straight from the system of record. Then say what to take out of it: the source is the raw data; the population is what this control actually operated on.</p>
              </div>
              {/* A source this control needs that the audit hasn't got. Answered
                  once here, then reusable by every other control. Hidden while
                  the list is empty — the empty state below carries the same
                  action, and two buttons for one job is one button too many. */}
              {files.length > 0 && (
                <button onClick={() => setSourcePicker(true)}
                  className="shrink-0 h-8 px-3 inline-flex items-center gap-1.5 rounded-md border border-canvas-border bg-canvas-elevated text-[0.71875rem] font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-700 transition-colors cursor-pointer"><Database size={12} /> Add a source</button>
              )}
            </div>
            {/* ── which one it would take, and why ─────────────────────────────
                Stated above the list, not applied to it. Nothing is pre-selected:
                a row already ticked when the screen opens gets confirmed without
                being read, and the auditor owns this choice. The reason is the
                part worth printing — "31 P2P controls draw off it" can be argued
                with, a confidence score cannot. */}
            {hint && (
              <div className="mb-3 rounded-lg border border-brand-200 bg-brand-50/40 px-3.5 py-2.5 flex items-start gap-2">
                <Sparkles size={13} className="text-brand-600 mt-0.5 shrink-0" />
                <p className="text-[0.71875rem] text-ink-700 leading-relaxed min-w-0">
                  <span className="font-semibold text-ink-900">Likely {hint.name}</span> — {hint.reason}. Pick it below if you agree.
                </p>
              </div>
            )}
            <div className="rounded-xl border border-canvas-border overflow-hidden mb-4">
              {files.length === 0 ? (
                /* No trial balance or general ledger was attached when the audit
                   was created, so there is nothing to filter. That is a thing to
                   fix from here rather than a wall: the file is uploaded, asked
                   where it came from, and joins the audit's files — so the next
                   control finds it waiting rather than uploading it again. */
                <div className="px-4 py-5 text-center">
                  <span className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 inline-flex items-center justify-center"><FileUp size={17} /></span>
                  <p className="text-[0.78125rem] font-semibold text-ink-800 mt-2">No source data on this audit yet</p>
                  <p className="text-[0.71875rem] text-ink-500 mt-1 leading-relaxed max-w-[26rem] mx-auto">
                    No trial balance or general ledger was attached when this audit was created. Upload what this control operates on, or connect the system it lives in, and it joins the audit's sources — every other control can then draw on it without being asked where it came from again.
                  </p>
                  <button onClick={() => setSourcePicker(true)}
                    className="mt-3 h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[0.78125rem] font-semibold hover:bg-brand-700 transition-colors cursor-pointer"><Database size={14} /> Add a source</button>
                </div>
              ) : files.map(f => {
                const on = picked === f.name;
                // No answer, no population. Removing "unknown" means a file
                // nobody can place is not a source you can build a test on.
                const usable = fileUsable(f);
                return (
                  <button key={f.name} onClick={() => usable && setPicked(f.name)} disabled={!usable}
                    title={usable ? undefined : 'Say where this file came from on its file record before drawing a population off it'}
                    className={cn('w-full text-left flex items-center gap-2.5 px-3 py-2.5 border-b border-canvas-border last:border-b-0 transition-colors',
                      !usable ? 'opacity-55 cursor-not-allowed' : on ? 'bg-brand-50 cursor-pointer' : 'hover:bg-paper-50 cursor-pointer')}>
                    <span className={cn('w-3.5 h-3.5 rounded-full border-[3px] shrink-0', on ? 'border-brand-600' : 'border-ink-300')} />
                    {/* a pull from a system reads differently from a file somebody
                        sent, and the icon is the fastest way to say which */}
                    {f.systemFetched
                      ? <Database size={13} className={cn('shrink-0', on ? 'text-brand-600' : 'text-ink-400')} />
                      : <FileText size={13} className={cn('shrink-0', on ? 'text-brand-600' : 'text-ink-400')} />}
                    <span className={cn('text-[0.78125rem] truncate min-w-0', on ? 'font-semibold text-brand-700' : 'text-ink-800')}>{f.name}</span>
                    {f.system && <span className="shrink-0 text-[0.6875rem] text-ink-400 hidden md:inline">{f.system}</span>}
                    {/* provenance, inherited — stated on every file so the
                        choice of source is made knowing what it is */}
                    <span className={cn('shrink-0 px-1.5 py-0.5 rounded text-[0.59375rem] font-bold uppercase tracking-wide whitespace-nowrap',
                      !usable ? 'bg-mitigated-50 text-mitigated-800' : f.origin === 'Client-prepared' ? 'bg-paper-100 text-ink-600' : 'bg-compliant-50 text-compliant-700')}>
                      {originLabel(f)}
                    </span>
                    <span className="text-[0.6875rem] text-ink-400 tabular-nums shrink-0 ml-auto">{f.rows.toLocaleString()} rows</span>
                    <span className="text-[0.6875rem] text-ink-400 shrink-0 hidden sm:inline">{f.from}</span>
                  </button>
                );
              })}
            </div>

            {/* One statement, not two boxes. A type-and-account pair only ever
                described a spreadsheet someone had already shaped; pulled from a
                system, the criteria ARE the query and no fixed set of fields
                fits them. Drafted from the control and its window, then edited. */}
            <div className="flex items-center justify-between gap-3 mb-2">
              <span className="block text-[0.65625rem] font-bold uppercase tracking-wider text-ink-400">Extraction criteria</span>
              <span className="inline-flex items-center gap-1 text-[0.65625rem] text-ink-400"><Sparkles size={11} className="text-brand-500" /> drafted for you</span>
            </div>
            <textarea value={criteria} onChange={e => setCriteria(e.target.value)} rows={2}
              placeholder="What to take out of the source — in plain English, for the reviewer."
              className="w-full rounded-lg border border-canvas-border bg-canvas-elevated px-2.5 py-2 text-[0.78125rem] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-200 resize-none" />
            <div className="mt-2.5">
              {/* PARKED (Aug 2026) — Date from / Date to.
                  The IPE check already asks whether the report was run over the
                  audit period, and it asks it of the report's own parameters
                  rather than of the auditor's memory. Typing the window again
                  here could only produce a second answer to a question already
                  answered — and when the two disagreed, nothing said which one
                  the sample actually came off. The window now comes from the
                  period, and the IPE proves it. Kept so it can be restored:

                  <div className="block min-w-0">
                    <span className="block text-[0.65625rem] text-ink-400 mb-1">Date from</span>
                    <DatePicker value={from} max={to || undefined} onChange={e => setFrom(e.target.value)}
                      placeholder="Pick a date" aria-label="Filter date from"
                      className="w-full h-8 px-2.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.78125rem] text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-200" />
                  </div>
                  <div className="block min-w-0">
                    <span className="block text-[0.65625rem] text-ink-400 mb-1">Date to</span>
                    <DatePicker value={to} min={from || undefined} onChange={e => setTo(e.target.value)}
                      placeholder="Pick a date" aria-label="Filter date to"
                      className="w-full h-8 px-2.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.78125rem] text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-200" />
                  </div>
              */}
            </div>
            {/* The window is stated, not asked for — it is the audit's own, which
                the form was already defaulting to, and the IPE is what proves the
                report actually covers it. */}
            <p className="mt-2 text-[0.65625rem] text-ink-400">
              {winFrom && winTo
                ? <>Period covered · {winFrom} – {winTo} — the audit's own window.</>
                : <>Period covered · the audit's own window.</>}{' '}
              The IPE check on this report is what confirms it was run over that period.
            </p>

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
                {extracting ? <><Loader2 size={14} className="animate-spin" /> Extracting…</> : <><Database size={14} /> Extract population</>}
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
              {/* source · provenance · filter. The provenance is inherited from
                  the file record and is read-only here on purpose: it belongs to
                  the file, and changing it on one control would be changing it
                  for the thirty-nine others that read the same file. */}
              <p className="text-[0.71875rem] text-ink-500 mt-1.5">
                <span className="text-ink-400">Source</span> · {pop.sourceFile ?? pop.source}
                {sourceFile && <> — <span className={cn('font-semibold', fileUsable(sourceFile) ? 'text-ink-700' : 'text-mitigated-800')}>{originLabel(sourceFile)}</span> <span className="text-ink-400">(recorded at upload)</span></>}
              </p>
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
              Nobody is asked to agree with arithmetic. The period and the count
              are both things it already holds the numbers for, so it does the
              sum and states the answer. A failed sum is argued with in writing,
              not ticked past.

              Period first, then the count — so the count's arithmetic and the
              count's context sit next to each other rather than either side of
              a check about something else. */}
          <span className="block text-[0.65625rem] font-bold uppercase tracking-wider text-ink-400 mb-2">Checked automatically</span>
          <div className="space-y-1.5">
            <VerdictRow label="Period covered" v={gv} note={pop.coverageNote} canWrite={canWrite && !locked}
              placeholder="e.g. the system was cut over on 1 Mar — pre-cutover instances are in the legacy extract, tested separately"
              onNote={t => setPopulationFacts(control.id, { coverageNote: t })}
              onRefilter={isAuditor ? refilter : undefined} />
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
          </div>

          {/* ── the count, with what it takes to judge it ───────────────────
              Nobody can say whether 1,418 is the right number by looking at
              1,418. The months it falls across and the same control's figure
              last round are what turn it into something a person can agree or
              disagree with — so they are put on the screen, and the agreement
              is asked for afterwards rather than instead. */}
          <CountContext control={control} canWrite={canWrite && !locked} locked={locked} />

          {/* ── the report itself, under test ───────────────────────────────
              Last thing before the lock, because it is the last thing that has
              to be true: the count and the period check what the FILTER did,
              this checks whether the thing filtered was worth filtering. */}
          <div className="mt-4">
            <IpeSection control={control} canWrite={canWrite && !locked} isAuditor={isAuditor} />
          </div>

          {/* Where the data came from is NOT asked here. It was answered when
              the file entered the audit, it is shown read-only on the source
              line above, and it is changed on the file record — never on a
              control that happens to be reading the file today. */}

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

      {/* The platform's own data picker, the same one chat and the workflow
          builder use — files already on the platform, folders, and live database
          connections in one place. A file picked here still has to say where it
          came from, so it hands off to the upload modal that asks; a system pull
          does not, because the fetch is the answer. */}
      <DataPickerModal
        open={sourcePicker}
        onClose={() => setSourcePicker(false)}
        title="Add a population source"
        confirmLabel="Use this source"
        attachHint="Pick the file or table this control's population comes out of."
        // The chat tabs PLUS Connect. A population legitimately comes from either
        // side — a file the client sent, or a pull the audit team makes itself
        // from the system of record — and until this was passed the Connect tab
        // was unreachable here, which left the connect-db branch below as code
        // that could never run. The default tab list is untouched everywhere else.
        tabs={['favourites', 'upload', 'all', 'file', 'integrated', 'connect']}
        onConfirm={(selections: AttachmentSelection[]) => {
          setSourcePicker(false);
          const sel = selections[0];
          if (!sel) return;
          // A file still has to say where it came from — but not which file it
          // is, twice. It carries straight through to the provenance question.
          if (sel.kind === 'upload') {
            setUploadPreset({ name: sel.name, rows: 400 + (sel.name.split('').reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 5) % 19000) });
            setUploading(true);
            return;
          }
          // Deterministic from the name so the same table never reports two
          // different sizes — the prototype holds no rows to count.
          const rows = 800 + (sel.name.split('').reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7) % 24000);
          const system = sel.kind === 'connect-db' ? `${sel.name} — ${sel.database}` : sel.subtype || sel.name;
          registerFile({
            name: sel.name, kind: 'System extract', rows,
            from: `Pulled on ${control.id}`, uploadedBy: me, uploadedAt: 'just now',
            // No origin question: systemFetched IS the provenance. See fileUsable.
            systemFetched: true, system, originBy: me, originAt: 'just now',
          });
          logEvent({ action: 'Run', description: `Connected "${sel.name}" from ${system} as a population source on ${control.id} — ${rows.toLocaleString()} rows`, module: 'SOX ICFR', entity: 'Evidence' });
          addToast({ type: 'success', title: 'Source connected', message: `${sel.name} — fetched from ${system}. Every control on this audit can use it now.` });
          setPicked(sel.name);
        }}
      />

      {uploading && (
        <ControlUploadModal preset={uploadPreset} onClose={() => { setUploading(false); setUploadPreset(undefined); }}
          onAdd={(name, rows, origin) => {
            // A trial balance uploaded here is a trial balance, not a nameless
            // "source file" — the registry on Configuration lists it beside the
            // ones attached at creation, so it has to read like them.
            registerFile({ name, kind: guessFileKind(name), rows, from: `Uploaded on ${control.id}`, uploadedBy: me, uploadedAt: 'just now', origin, originBy: me, originAt: 'just now' });
            logEvent({ action: 'Upload', description: `Added "${name}" to the audit's files from ${control.id} — ${origin.toLowerCase()}, ${rows.toLocaleString()} rows`, module: 'SOX ICFR', entity: 'Evidence' });
            addToast({ type: 'success', title: 'File added', message: `${name} — ${origin.toLowerCase()}. Every control on this audit can use it now.` });
            setPicked(name);
            setUploading(false);
            setUploadPreset(undefined);
          }} />
      )}

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

/** STEP 3 — SAMPLE.
 *
 *  A draw, and nothing else. Filtering happened at step ① and produced the
 *  population; this step reaches into it and pulls items out. The two used to
 *  look alike — both had a file to pick and a rule to write — and that is what
 *  made them easy to confuse, so every filter control is gone from here: no
 *  file, no criteria, no extraction logic. How many, then draw.
 *
 *  Method and seed are still recorded, because a draw nobody can reperform is
 *  not a procedure. They are stated as facts of the draw rather than asked for:
 *  the seed is derived from the control and the round, so the same control drawn
 *  twice lands on the same items and the reviewer can check it did.
 */
function SampleExtractSection({ control, canEdit, locked }: { control: Control; canEdit: boolean; locked: boolean }) {
  const { eng, openAuditId, role, setSampling } = useIcfr();
  // Drawing a sample is the auditor's act — the store refuses it from anyone
  // else, so the journey is not offered to anyone else either.
  const canDraw = canEdit && role === 'auditor';
  const logEvent = useAuditLog();
  const { addToast } = useToast();
  const o = control.operating;

  type Stage = 'ready' | 'drawing' | 'review';
  const [stage, setStage] = useState<Stage>('ready');
  // How many to draw is the table's call, not a free guess — sized from the
  // control's frequency, nature and risk rating, and reduced to sizing-like-a-
  // manual-control the moment an ITGC underneath it fails.
  const holds = itgcHolds(eng, control);
  const guide = sampleSizeGuide(control, holds);
  const [rows, setRows] = useState(guide.suggested);
  const [drawn, setDrawn] = useState<string[]>([]);
  const [rejecting, setRejecting] = useState(false);
  // Reperformable by construction: same control, same round, same items. Nobody
  // is asked to invent a seed, and nobody can quietly reroll one until the draw
  // comes out convenient.
  const method: Sampling['method'] = 'Random';
  const seed = useMemo(
    () => 10000 + (`${control.id}·${openAuditId ?? ''}`.split('').reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 17) % 89999),
    [control.id, openAuditId],
  );

  const draw = () => {
    setStage('drawing');
    logEvent({ action: 'Run', description: `Drew ${rows} items for ${control.id} — ${method.toLowerCase()}, seed ${seed}`, module: 'SOX ICFR', entity: 'Test Result' });
    window.setTimeout(() => { setDrawn(sampleRefs(control.process, rows)); setStage('review'); }, 1800);
  };
  const visible = drawn.map((ref, i) => ({ ref, i }));

  const approve = () => {
    const kept = visible.map(v => v.ref);
    // The population is already in and locked — this step only records the draw
    // off it, and the two facts that make the draw reperformable.
    const s: Sampling = {
      basis: `${kept.length} items drawn from ${o.population?.version ?? 'the locked population'} · ${method.toLowerCase()}, seed ${seed} · spread across the period`,
      method, size: kept.length, seed,
      samples: kept.map((ref, i) => ({ id: `s${i}`, ref, result: 'Not tested' })),
    };
    setSampling(control.id, s);
    logEvent({ action: 'Update', description: `Approved the sample for ${control.id} — ${kept.length} items, ${method.toLowerCase()}, seed ${seed}`, module: 'SOX ICFR', entity: 'Test Result' });
    addToast({ type: 'success', title: 'Sample drawn', message: `${kept.length} items — test them against the attributes.` });
  };
  const restart = () => {
    setRejecting(false);
    setStage('ready'); setRows(guide.suggested); setDrawn([]);
    logEvent({ action: 'Delete', description: `Rejected the drawn sample for ${control.id} — draw restarted`, module: 'SOX ICFR', entity: 'Test Result' });
  };

  // Two gates stand in front of the draw, and they fail for different reasons —
  // so the locked state names the one actually holding it up.
  if (locked) {
    const designBlocked = trackResult(control.design) !== 'Effective';
    return (
      <div className="p-5">
        {designBlocked ? (
          <EmptyState icon={<Lock size={18} />} title="The draw is locked" hint="Conclude TOD as effective first — a sample is only worth pulling for a control that is designed to work.">
            <span className="inline-flex items-center gap-1.5 text-[0.75rem] text-ink-500"><span>TOD is currently</span><TrackPill c={trackResult(control.design)} /></span>
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

  // Already drawn (this session or seeded) — read-only. Nothing is outstanding
  // once the items exist: the confirmation gate that used to sit here went with
  // the IPE step.
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
      {/* what the draw comes off — stated, not asked for. The population was
          filtered and locked at step ①; this step cannot narrow it further. */}
      <div className="inline-flex items-center gap-2 px-3 py-2.5 rounded-lg border border-compliant-100 bg-compliant-50/40">
        <Lock size={12} className="text-compliant-700 shrink-0" />
        <span className="text-[0.78125rem] font-semibold text-ink-900">Population {o.population?.version ?? 'locked'}</span>
        <span className="text-[0.6875rem] text-ink-500 tabular-nums">{o.population?.count.toLocaleString()} instances</span>
        <Check size={13} className="text-compliant-600 shrink-0" />
      </div>

      {/* how many, then draw. That is the whole screen. */}
      <div className="mt-4 flex items-end justify-between gap-3 flex-wrap">
        <label className="block min-w-0">
          <span className="block text-[0.65625rem] font-bold uppercase tracking-wider text-ink-400 mb-1">Sample size</span>
          <select value={rows} onChange={e => setRows(+e.target.value)} disabled={stage !== 'ready'}
            className="w-44 h-9 px-2.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.78125rem] tabular-nums cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:opacity-60">
            {Array.from(new Set([guide.suggested, 1, 2, 4, 10, 25, 40, 60])).sort((a, b) => a - b).map(n => (
              <option key={n} value={n}>{n} items{n === guide.suggested ? ' — suggested' : ''}</option>
            ))}
          </select>
        </label>
        <button disabled={stage !== 'ready'} onClick={draw}
          className="shrink-0 h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[0.78125rem] font-semibold enabled:hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer">
          {stage === 'drawing' ? <><Loader2 size={14} className="animate-spin" /> Drawing…</> : <><FlaskConical size={14} /> Draw sample</>}
        </button>
      </div>
      <p className="text-[0.65625rem] text-ink-400 mt-2 leading-relaxed">
        {control.frequency} · {control.nature}{control.riskRating ? ` · ${control.riskRating.toLowerCase()} risk` : ''} — band {guide.range}. {guide.note} Frequency sets the floor; the control's risk rating moves it inside the band.
      </p>
      <p className="text-[0.65625rem] text-ink-400 mt-1 leading-relaxed">
        Random, seed <span className="tabular-nums font-semibold text-ink-600">{seed}</span> — spread across the whole period. The seed comes off this control and this round and is stored on the paper, so the reviewer reperforms the draw and lands on these same items.
      </p>
      {stage === 'drawing' && (
        <div className="mt-2.5 flex items-center gap-1.5 text-[0.75rem] text-brand-600 font-semibold"><Loader2 size={13} className="animate-spin" /> Drawing {rows} from {o.population?.count.toLocaleString()} · {method.toLowerCase()}, seed {seed}…</div>
      )}

      {/* what came out — approve it onto the paper, or throw it back. Flat: it
          sits directly under the draw that produced it, and a box here would be
          the only one left on the step. */}
      {stage === 'review' && (
        <>
        <div className="ac-div my-4" />
        <div>
          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
            <div className="text-[0.71875rem] font-bold text-ink-700 inline-flex items-center gap-1.5"><FlaskConical size={12} /> Drawn sample <span className="font-normal text-ink-400">· {drawn.length} items</span></div>
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

      {rejecting && createPortal(
        <div className="modal-backdrop" onClick={() => setRejecting(false)}>
          <motion.div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()} initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}>
            <div className="px-5 py-4">
              <div className="flex items-start gap-3">
                <span className="w-9 h-9 rounded-lg bg-risk-50 text-risk-700 inline-flex items-center justify-center shrink-0"><AlertTriangle size={17} /></span>
                <div>
                  <h3 className="text-[0.875rem] font-bold text-ink-900">Reject this sample?</h3>
                  <p className="text-[0.75rem] text-ink-500 mt-1">These items go and the draw starts again from the size. The population is untouched — it is locked, and rejecting a draw never reaches back into it.</p>
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
        <EmptyState icon={<Lock size={18} />} title="TOE is locked" hint="Conclude TOD as effective to unlock TOE. A control that isn’t designed effectively isn’t tested for operation.">
          <span className="inline-flex items-center gap-1.5 text-[0.75rem] text-ink-500"><span>TOD is currently</span><TrackPill c={trackResult(control.design)} /></span>
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
  { id: 'all', label: 'All' }, { id: 'control', label: 'Control' }, { id: 'design', label: '② TOD' }, { id: 'operating', label: '④ TOE' },
];
// the two hands on the working paper — auditor (purple/gavel) and risk owner (amber/check)
const EXEC_ROLE: Record<Role, { Icon: typeof Gavel; accent: string; chip: string; label: string }> = {
  auditor: { Icon: Gavel, accent: 'var(--color-brand-400)', chip: 'bg-brand-50 text-brand-700', label: 'Auditor' },
  'risk-owner': { Icon: UserCheck, accent: 'var(--color-mitigated-500)', chip: 'bg-mitigated-50 text-mitigated-700', label: 'Risk owner' },
  // our branch carries a third persona — the reviewer who countersigns
  reviewer: { Icon: UserCheck, accent: 'var(--color-evidence-500)', chip: 'bg-evidence-50 text-evidence-700', label: 'Reviewer' },
};
const TRACK_FILTERS = [{ id: 'all', label: 'All' }, { id: 'design', label: '② TOD' }, { id: 'operating', label: '④ TOE' }] as const;

function ExecResult({ result }: { result?: TestResult | TrackConclusion }) {
  if (!result || result === 'Not tested') return null;
  const pass = result === 'Pass' || result === 'Effective';
  return <span className="inline-flex items-center gap-1"><Tickmark result={pass ? 'Pass' : 'Fail'} size={13} /><span className={cn('text-[0.65625rem] font-bold', pass ? 'text-compliant-700' : 'text-risk-700')}>{result}</span></span>;
}

// ── execution history — the shared sign-off trail (both personas, both tracks) ─────
function ExecutionTrail({ control }: { control: Control }) {
  const { eng, role } = useIcfr();
  const isOwner = role === 'risk-owner';
  const [track, setTrack] = useState<'all' | 'design' | 'operating'>('all');
  const events = useMemo(
    // The trail used to filter on control id alone, so every auditor verb and
    // every Pass/Fail sat in the owner's right rail: what was tested, what was
    // concluded, what was overridden. The owner sees THEIR OWN actions and the
    // things addressed to them — a record of what they did and what was asked,
    // which is what a trail is for from where they stand.
    () => eng.executions.filter(e => e.controlId === control.id
      && (track === 'all' || e.track === track)
      && (!isOwner || e.role === 'risk-owner' || e.kind === 'request-docs' || e.kind === 'receive-doc')),
    [eng.executions, control.id, track, isOwner],
  );
  return (
    <>
      <div className="px-3 pb-2 flex items-center gap-1">
        {TRACK_FILTERS.map(t => <button key={t.id} onClick={() => setTrack(t.id)} className={cn('h-7 px-2.5 rounded-md text-[0.71875rem] font-semibold transition-colors cursor-pointer', track === t.id ? 'bg-brand-600 text-white' : 'text-ink-500 hover:text-ink-800')}>{t.label}</button>)}
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {events.length === 0 ? (
          <div className="text-center text-[0.75rem] text-ink-400 py-10 px-4">No runs yet{track !== 'all' ? ` on ${track === 'design' ? 'TOD' : 'TOE'}` : ''}.<br />Execute TOD or TOE — it shows up here for the auditor and the risk owner alike.</div>
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
                    <div className="mt-1.5 inline-flex items-center gap-1.5 text-[0.625rem] font-semibold uppercase tracking-wide text-ink-400">{e.track === 'design' ? '① TOD' : '② TOE'}<span className={cn('normal-case tracking-normal rounded px-1.5 h-[16px] inline-flex items-center', rm.chip)}>{rm.label}</span></div>
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
            <div className="flex items-center gap-2 text-[0.65625rem] font-semibold uppercase tracking-wide text-ink-400">{d.anchor === 'design' ? '① TOD' : d.anchor === 'operating' ? '② TOE' : 'Control'}{d.resolved && <Pill tone="compliant">Resolved</Pill>}<button onClick={() => resolveDiscussion(d.id, !d.resolved)} className="ml-auto text-ink-400 hover:text-brand-700 normal-case cursor-pointer">{d.resolved ? 'reopen' : 'resolve'}</button></div>
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
        <div className="text-[0.65625rem] text-ink-400 mb-1.5">Posting to <b className="text-ink-600">{postAnchor === 'control' ? 'Control' : postAnchor === 'design' ? '① TOD' : '② TOE'}</b> as <b className="text-ink-600 capitalize">{role}</b></div>
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

/** "Unable to test — waiting on owner".
 *
 *  Deliberately NOT an exception. An exception says a control failed; this says
 *  nobody could tell, which is a different claim and carries none of the same
 *  consequences — there is no exposure to size and no likelihood to judge, so a
 *  severity here would be invented rather than assessed. It is a request in the
 *  owner's court, like any other document request.
 *
 *  It only becomes an exception if the period closes with it still open: at that
 *  point the control genuinely could not be evidenced as operating, so it
 *  concludes ineffective and runs the ordinary ladder, carrying this reason across
 *  so the paper says why rather than merely that. */
function UnableToTestBanner({ control }: { control: Control }) {
  const { role, markUnableToTest, resolveUnableToTest, escalateUnableToTest } = useIcfr();
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  const [needed, setNeeded] = useState('');
  const block = control.unableToTest;
  const isAuditor = role === 'auditor';

  if (!block) {
    if (!isAuditor || isControlLocked(control)) return null;
    return asking ? (
      <div className="rounded-xl border border-mitigated-200 bg-mitigated-50/40 p-4 space-y-2">
        <h3 className="text-[0.8125rem] font-bold text-mitigated-800 inline-flex items-center gap-1.5"><FileWarning size={15} /> Record that you can't test this</h3>
        <p className="text-[0.75rem] text-ink-600">This is not a finding — nothing has been shown to have failed. It goes to {ownersOf(control).processOwner} as a request, and testing picks up where it left off once they produce it.</p>
        <input value={reason} onChange={e => setReason(e.target.value)} placeholder="What is blocking the test — e.g. the approval log isn't retained by the system"
          className="w-full h-8 px-2.5 rounded-md border border-canvas-border bg-canvas-elevated text-[0.78125rem] focus:outline-none focus:border-brand-300" />
        <input value={needed} onChange={e => setNeeded(e.target.value)} placeholder="What the owner has to produce for testing to resume"
          className="w-full h-8 px-2.5 rounded-md border border-canvas-border bg-canvas-elevated text-[0.78125rem] focus:outline-none focus:border-brand-300" />
        <div className="flex items-center gap-2">
          <button disabled={!reason.trim() || !needed.trim()} onClick={() => { markUnableToTest(control.id, 'operating', reason.trim(), needed.trim()); setAsking(false); setReason(''); setNeeded(''); }}
            className="h-8 px-3 rounded-lg bg-mitigated-700 text-white text-[0.75rem] font-semibold enabled:hover:bg-mitigated-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">Send the request</button>
          <button onClick={() => setAsking(false)} className="h-8 px-2.5 rounded-lg border border-canvas-border text-[0.75rem] font-semibold text-ink-600 cursor-pointer">Cancel</button>
        </div>
      </div>
    ) : (
      <button onClick={() => setAsking(true)} className="text-[0.75rem] font-semibold text-ink-500 hover:text-mitigated-800 cursor-pointer inline-flex items-center gap-1.5">
        <FileWarning size={13} /> Can't test this — record why
      </button>
    );
  }

  return (
    <div className={cn('rounded-xl border p-4', block.convertedTo ? 'border-risk-200 bg-risk-50/40' : 'border-mitigated-200 bg-mitigated-50/40')}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h3 className={cn('text-[0.8125rem] font-bold inline-flex items-center gap-1.5', block.convertedTo ? 'text-risk-700' : 'text-mitigated-800')}>
            <FileWarning size={15} />
            {block.convertedTo ? `Never evidenced — raised as ${block.convertedTo}` : `Unable to test — waiting on ${ownersOf(control).processOwner}`}
          </h3>
          <p className="text-[0.75rem] text-ink-700 mt-1">{block.reason}</p>
          <p className="text-[0.75rem] text-ink-600 mt-0.5"><span className="text-ink-400">Needed</span> · {block.needed}</p>
          <p className="text-[0.6875rem] text-ink-400 mt-1">Recorded by {block.raisedBy} · {block.raisedAt}. No severity applies — nothing has been shown to have failed.</p>
        </div>
        {isAuditor && !block.convertedTo && (
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => resolveUnableToTest(control.id)} className="h-8 px-3 rounded-lg bg-brand-600 text-white text-[0.75rem] font-semibold hover:bg-brand-700 cursor-pointer">Received — resume testing</button>
            <button onClick={() => escalateUnableToTest(control.id)} title="The period is closing and it never arrived — the control could not be evidenced, so it becomes an ordinary exception"
              className="h-8 px-3 rounded-lg border border-risk-300 text-risk-700 text-[0.75rem] font-semibold hover:bg-risk-50 cursor-pointer">Never arrived — raise it</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── the dossier ──────────────────────────────────────────────────────────────────
export default function ControlDossier() {
  const { eng, role, selectedControlId, back, setView, reopenControl } = useIcfr();
  const logEvent = useAuditLog();
  // preview-before-download for this control's working paper
  const [wpPreview, setWpPreview] = useState(false);
  // The owner's own document — see RemediationBriefModal.
  const [briefOpen, setBriefOpen] = useState(false);
  // the way back into a concluded control — reason required, trail recorded
  const [reopening, setReopening] = useState(false);
  const [reopenWhy, setReopenWhy] = useState('');
  // The deficiency this paper raised, graded here rather than somewhere else.
  const [defOpen, setDefOpen] = useState(false);
  const control = eng.controls.find(c => c.id === selectedControlId);
  if (!control) return <div className="text-ink-500">Control not found. <button onClick={back} className="text-brand-700 font-semibold">Back to register</button></div>;
  // ── who is standing here, and what that permits ─────────────────────────────
  // Rewritten Aug 2026 (Step-2 action item 23). The risk owner is the FIRST LINE:
  // they supply evidence and remediate. They are not the tester, and the working
  // paper is the audit's evidence file, not the auditee's — it carries sample
  // lists and results, materiality thresholds, the severity rule set, review
  // notes, override rationales and other people's controls. Handing it over
  // breaks independence outright: the owner learns exactly what will be tested
  // and at what threshold, and reads findings that are not final yet.
  //
  // Everything this hat cannot do is ABSENT, not greyed out — the rule the
  // deficiency screens already follow. Absent also fixes a live bug: `canEdit`
  // used to be true for the owner, so they were shown Conclude and Override
  // buttons that the store then silently dropped on the floor.
  const isAuditor = role === 'auditor';
  const isOwner = role === 'risk-owner';
  // The evidence lane stays theirs — attaching documents, answering a request,
  // self-attesting. That is the whole reason they are on this page.
  const canEdit = isAuditor || isOwner;
  // The testing pen does not. Conclusions, overrides, the draw, attribute
  // results and the sign-off are the auditor's alone.
  const canTest = isAuditor;
  const headOwners = ownersOf(control);
  // Automated + ITGCs holding = the design test IS the test. Everything on this
  // page that asked "have both tracks concluded?" now asks the narrower question.
  const opApplies = operatingApplies(eng, control);
  const concl = controlConclusion(control, opApplies);
  const controlLocked = isControlLocked(control, opApplies);
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
                <span className="text-[0.6875rem] text-ink-400 font-mono">{controlCode(control)}</span>
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
                {/* Which company's copy this is. The same control number is tested
                    separately at each entity in scope, and this page is one of
                    them — so the entity belongs beside the process, not buried. */}
                {control.entity && (
                  <span className="inline-flex items-center gap-1">
                    <span className="text-ink-400">Entity</span> · <b className="font-semibold text-ink-700">{control.entity}</b>
                  </span>
                )}
                <span><span className="text-ink-400">Process</span> · {control.process} / {control.subProcess}</span>
                {/* Both names, because they are two different people doing two
                    different jobs — and this page is where you find out who to
                    ask. The register shows only the accountable one. */}
                <span className="inline-flex items-center gap-1"><span className="text-ink-400">Control owner</span> · <b className="font-semibold text-ink-700">{headOwners.controlOwner}</b></span>
                {!headOwners.single && <span className="inline-flex items-center gap-1"><span className="text-ink-400">Process owner</span> · <b className="font-semibold text-ink-700">{headOwners.processOwner}</b></span>}
                <span><span className="text-ink-400">Risk {control.riskId}</span> · {control.riskDescription}</span>
                <span><span className="text-ink-400">Assertions</span> · {control.assertions.join(', ')}</span>
                {/* why the risk exists at all — a control aimed at the symptom
                    rather than the cause is the commonest design gap there is */}
                {control.rootCause && <span><span className="text-ink-400">Root cause</span> · {control.rootCause}</span>}
              </div>
            </div>
            {/* whose court it is, right-aligned. The W/P stamp that used to sit
                beside it is gone: a working-paper reference is an audit output,
                and the control page is where the work happens, not where the
                paper is cited. It survives in the exported paper and report. */}
            <div className="shrink-0 flex items-center justify-end gap-2">
              <CourtBadge court={courtFor(control, eng.tasks)} fromRole={role} />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-3.5 pt-3 border-t border-canvas-border flex-wrap">
            {/* The conclusion and the two track verdicts are the auditor's read,
                and an owner watching it move learns what is being tested and how
                it is going. They see what is asked of them instead. */}
            {isOwner ? (
              <span className="text-[0.71875rem] font-semibold text-ink-400 uppercase tracking-wide">Your control</span>
            ) : (
              <>
                <span className="text-[0.71875rem] font-semibold text-ink-400 uppercase tracking-wide">Overall status</span>
                {concl === 'Effective' || concl === 'Ineffective' ? <Stamp result={concl} animate={false} /> : <ConclusionPill c={concl} />}
                <span className="w-px h-4 bg-canvas-border" />
                <span className="text-[0.71875rem] text-ink-400 inline-flex items-center gap-1.5"><Tickmark result={designResult === 'Effective' ? 'Pass' : designResult === 'Ineffective' ? 'Fail' : 'Not tested'} size={14} /> TOD {designResult}</span>
                <ChevronRight size={13} className="text-ink-300" />
                <span className="text-[0.71875rem] text-ink-400 inline-flex items-center gap-1.5"><Tickmark result={opResult === 'Effective' ? 'Pass' : opResult === 'Ineffective' ? 'Fail' : 'Not tested'} size={14} /> TOE {toeLocked ? 'locked' : opResult}</span>
              </>
            )}
            <div className="ml-auto flex items-center gap-2">
              {/* The register already hides this from the owner. The same document
                  reachable from a different screen is not a restriction. */}
              {isOwner ? (
                /* What they get instead — built from owner-safe fields upwards,
                   never by filtering the paper down. */
                <button onClick={() => setBriefOpen(true)}
                  className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border border-canvas-border text-[0.75rem] font-semibold text-ink-600 hover:text-ink-900 hover:border-ink-300 transition-colors cursor-pointer"><FileText size={13} /> Remediation brief</button>
              ) : (
                <button onClick={() => { setWpPreview(true); logEvent({ action: 'Export', description: `Opened the working paper for ${control.id} — ${ROLE_LABEL[role]}`, module: 'SOX ICFR', entity: 'Evidence' }); }}
                  className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border border-canvas-border text-[0.75rem] font-semibold text-ink-600 hover:text-ink-900 hover:border-ink-300 transition-colors cursor-pointer"><FileSpreadsheet size={13} /> Working paper</button>
              )}
              {isAuditor && isControlLocked(control) && (
                <button onClick={() => setReopening(true)} className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border border-canvas-border text-[0.75rem] font-semibold text-ink-600 hover:text-risk-700 hover:border-risk-300 transition-colors cursor-pointer"><RotateCcw size={13} /> Reopen</button>
              )}
              <span className="text-[0.6875rem] text-ink-400 inline-flex items-center gap-1">
                {isOwner ? 'You supply the evidence — the auditor tests it. Every upload is logged in History.' : 'Every run is logged in History'}
              </span>
            </div>
          </div>
        </div>
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

      {/* Blocked testing sits above the steps, because it is the reason none of
          them can run — not a finding underneath them. */}
      <UnableToTestBanner control={control} />

      {/* stepper + discussion */}
      <div className="grid grid-cols-[minmax(0,1fr)_360px] gap-5 items-start">
        <motion.div className="vstepper" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1, delayChildren: 0.08 } } }}>
          {/* Design leads (user ask). It is also the order the work happens in:
              design gates operating, so a control whose design fails never needs
              a population at all — building one first was work done on spec. */}
          <VStep n={1} title={isOwner ? 'Documents' : 'TOD'}
            subtitle={isOwner
              ? 'The documents this control needs on file. Attach what you hold — the auditor tests them.'
              : 'Test of design — the documents on file, one transaction traced end-to-end, and a design check for each thing that has to be true. Concludes effective or ineffective.'}
            status={designResult} hideStatus={isOwner}>
            <DesignSection control={control} canEdit={canEdit} />
          </VStep>
          {/* An automated control stops here while its ITGCs hold — see
              operatingApplies. The steps are not rendered locked, they are not
              rendered at all: a greyed-out Population would say "you still owe
              this", and the whole point is that nobody does. */}
          {/* ── steps ②–⑤ are the audit's own work ──────────────────────────────
              The sample and its results, the attribute outcomes, the conclusion
              and the sign-off state are all things the first line must not see:
              knowing what will be tested, and at what threshold, is the whole
              reason the three lines are separate. The owner's page ends at the
              documents they supply and the exception they have to fix. */}
          {isOwner ? null : !opApplies ? (
            <ShortFormNote control={control} />
          ) : (
          <>
          <VStep n={2} title="Population" subtitle="Pick the source file and filter it down to this control's instances, then check the count, the period and the source before locking it. Nothing downstream runs until it is locked." hideStatus
            status={popLocked ? 'Effective' : 'Not tested'}
            right={popLocked
              ? <span className="text-[0.6875rem] font-bold text-compliant-700 inline-flex items-center gap-1"><Lock size={12} /> Locked · {control.operating.population?.count.toLocaleString()} instances</span>
              : control.operating.population
                ? <span className="text-[0.6875rem] font-semibold text-mitigated-800 inline-flex items-center gap-1"><AlertTriangle size={11} /> Extracted, not yet locked</span>
                : <span className="text-[0.6875rem] font-semibold text-ink-400">Nothing extracted yet</span>}>
            <PopulationSection control={control} canEdit={canEdit} />
          </VStep>
          <VStep n={3} title="Sample" subtitle="Drawn off the locked population, sized by how often the control runs, with the selection method and its seed stored so anyone can reproduce the same items." hideStatus
            status={sampleLocked ? 'Not tested' : control.operating.sampling ? 'Effective' : 'Not tested'} locked={sampleLocked}
            right={toeLocked
              ? <span className="text-[0.6875rem] font-semibold text-ink-400 inline-flex items-center gap-1"><Lock size={11} /> Unlocks after TOD</span>
              : control.operating.sampling
                ? <span className="text-[0.6875rem] font-bold text-compliant-700 inline-flex items-center gap-1"><CheckCircle2 size={12} /> {control.operating.sampling.size} items</span>
                : !popLocked
                  ? <span className="text-[0.6875rem] font-semibold text-ink-400 inline-flex items-center gap-1"><Lock size={11} /> Unlocks once the population locks</span>
                  : <span className="text-[0.6875rem] font-semibold text-ink-400">Awaiting the draw</span>}>
            <SampleExtractSection control={control} canEdit={canEdit} locked={sampleLocked} />
          </VStep>
          <VStep n={4} id="vstep-toe" title="TOE" subtitle="Test of operating effectiveness — each sampled item against each attribute, pass or fail, with the evidence attached. Concludes effective or ineffective." status={toeLocked ? 'Not tested' : opResult} locked={toeLocked}
            right={toeLocked ? <span className="text-[0.6875rem] font-semibold text-ink-400 inline-flex items-center gap-1"><Lock size={11} /> Unlocks after TOD</span> : undefined}>
            <OperatingSection control={control} canEdit={canEdit} locked={toeLocked} />
          </VStep>
          </>
          )}
          {!isOwner && <VStep n={5} title="Sign-off" subtitle="The auditor signs the paper, the reviewer countersigns it, and the control is done. Nobody countersigns work they prepared." hideStatus
            status={control.wpSignoff?.reviewer ? 'Effective' : 'Not tested'} locked={!controlLocked}
            right={control.wpSignoff?.reviewer
              ? <span className="text-[0.6875rem] font-bold text-compliant-700 inline-flex items-center gap-1"><BadgeCheck size={12} /> Control done</span>
              : control.wpSignoff?.preparer
                ? <span className="text-[0.6875rem] font-semibold text-ink-400">Awaiting countersign</span>
                : controlLocked
                  ? <span className="text-[0.6875rem] font-semibold text-ink-400">Ready to sign</span>
                  : <span className="text-[0.6875rem] font-semibold text-ink-400 inline-flex items-center gap-1"><Lock size={11} /> Unlocks once {opApplies ? 'both tracks conclude' : 'the design concludes'}</span>}>
            <SignOffSection control={control} />
          </VStep>}
          {concl === 'Ineffective' && (
            <motion.div variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }} className="ml-[54px] rounded-xl border border-risk-200 bg-risk-50/40 p-4 mt-1">
              {/* ── graded here, and only here ───────────────────────────────
                  This used to send the auditor to the Deficiency management tab
                  to grade the finding their own testing had just raised, which
                  meant leaving the paper, finding the row again, and coming back
                  to a page scrolled somewhere else. The finding belongs to this
                  control, so the whole banner is the toggle and the card opens
                  underneath it — the same card the tab renders, with the same
                  writes and the same four-eyes rules. No link off this page:
                  every route out of here was a route away from the work. */}
              <div
                role={def ? 'button' : undefined}
                tabIndex={def ? 0 : undefined}
                aria-expanded={def ? defOpen : undefined}
                aria-label={def ? `${defOpen ? 'Collapse' : 'Expand'} ${def.id}` : undefined}
                onClick={def ? () => setDefOpen(o => !o) : undefined}
                onKeyDown={def ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDefOpen(o => !o); } } : undefined}
                className={cn('flex items-start justify-between gap-3', def && 'cursor-pointer')}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <AlertTriangle size={15} className="text-risk-700" /><h3 className="text-[0.8125rem] font-bold text-risk-700">Deficiency raised</h3>
                    {def && <span className="font-mono text-[0.6875rem] font-semibold text-risk-700/80">{def.id}</span>}
                    {/* PARKED (Aug 2026) — Gap type: derivable from the control's
                        nature and the failed track, so the pill was restating two
                        answers the paper already holds. `gapNature` in types.ts
                        writes the same sentence read-only for the working paper.
                        The original line, and the note that went with it:

                        what kind of gap this is — a design gap needs a redesign, a
                        testing gap needs discipline, and the fix follows the label

                        {def?.gapType && <Pill tone="risk">{GAP_LABEL[def.gapType]}</Pill>} */}
                  </div>
                  <p className="text-[0.75rem] text-ink-600">
                    {/* The owner has to see their own finding — they cannot fix
                        what they cannot read. What they do not get is the ruler:
                        likelihood × magnitude against materiality is the grading
                        basis, and an auditee who knows the threshold knows what
                        will and will not be pursued. The card below already
                        redacts it (showMateriality={'{'}!isOwner{'}'}); this line has to
                        stop advertising it. */}
                    {isOwner
                      ? <>A gap was found on this control. {def ? <>Open it {defOpen ? 'below' : 'here'} for what failed, the root cause and what is owed — and record your fix.</> : <>The detail follows once it is raised.</>}</>
                      : <>This control concluded ineffective. {def
                        ? <>Assess severity (likelihood × magnitude) and remediation {defOpen ? 'below' : 'here'} — it opens on this paper.</>
                        : <>Severity and remediation are assessed once the deficiency is raised.</>}</>}
                  </p>
                </div>
                {def && (
                  <span className="shrink-0 mt-0.5 text-risk-700">
                    {defOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </span>
                )}
              </div>
              {/* PARKED (Aug 2026) — Priced impact. Recovery, working-capital
                  unblock and leakage say what the gap was WORTH to the business;
                  ICFR asks what could have been MISSTATED, which is the magnitude
                  the severity ladder already reads. Two different numbers sitting
                  on one finding, and the strip showed the wrong one. Kept whole so
                  it can be lifted to the Internal Audit engagement type intact —
                  see the banner in types.ts. The original block, and the note that
                  went with it:

                  priced, if the auditor has priced it — the number is what moves a
                  CFO. Only while the card is shut: open, the card prices it in full
                  and the same figures twice on one screen is one figure too many.

                  {def && !defOpen && exposureTotal(def.exposure) > 0 && (
                    <div className="mt-2.5 pt-2.5 border-t border-risk-200/70 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.71875rem]">
                      <span className="font-semibold text-risk-700">Exposure {formatINR(exposureTotal(def.exposure))}</span>
                      {(Object.keys(EXPOSURE_LABEL) as (keyof typeof EXPOSURE_LABEL)[])
                        .filter(k => (def.exposure as Exposure)[k] > 0)
                        .map(k => <span key={k} className="text-ink-600"><span className="text-ink-400">{EXPOSURE_LABEL[k]}</span> · {formatINR((def.exposure as Exposure)[k])}</span>)}
                    </div>
                  )} */}
              {/* Fade-and-lift rather than a height animation: the card is most of
                  a screen, and no overflow-hidden wrapper means nothing inside it
                  gets clipped while it settles. */}
              <AnimatePresence initial={false}>
                {def && defOpen && (
                  <motion.div key="def-card" className="mt-3"
                    initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}>
                    <DeficiencyCard d={def} defaultOpen showControlLink={false} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </motion.div>
        {/* right rail — the three confidence scores, then the collaboration
            surfaces. They read on the work rather than being part of it, so
            they sit with what was done and what was said; the stepper gets the
            full width of the page it earns. No wrapper card: the meters are
            already cards, and a box around cards drew a group boundary the
            rail didn't need. */}
        <motion.div className="space-y-2.5" variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}>
          {designRagMeters(control).map(m => <RagCard key={m.label} m={m} stacked />)}
          <ActivityRail control={control} />
        </motion.div>
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
      {briefOpen && <RemediationBriefModal defId={def?.id} onClose={() => setBriefOpen(false)} />}
    </motion.div>
  );
}
