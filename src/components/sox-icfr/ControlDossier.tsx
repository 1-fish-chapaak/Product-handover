import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  FileText, Upload, MessageSquare, PanelRightClose, Workflow as WorkflowIcon, Hand, AlertTriangle,
  Send, Lock, ClipboardCheck, FileCheck2, FlaskConical, CheckCircle2, XCircle,
  CornerDownRight, Pencil, RotateCcw, Cpu, ChevronRight, Scale, Paperclip, Plus, Trash2,
  Mail, X, Loader2, ChevronDown, Check, PlayCircle, Link2, ListChecks, Gavel, UserCheck, History, FileUp, ArrowLeft, Footprints, BadgeCheck, Star,
  Database, Circle, PenLine, Eye, Inbox, ChevronUp, AlertCircle, FileWarning, StickyNote, Filter, Quote, CalendarClock, GitBranch} from 'lucide-react';
import { ineffectiveTooEarly, useIcfr } from './store';
import EvidenceAnnotator from './EvidenceAnnotator';
import { IraState, IraDrafted, iraStateOfPoint, iraStateOfStep } from './IraState';
import InlineWhy from './InlineWhy';
import { ToeFiles, ToeGrid } from './ToeGrid';
import NeedsYouPane, { needsYouItems } from './NeedsYouPane';
import RailDetailPane, { RailDetailContext, SampleResultsTable, useOpenRailDetail, itemFocus, verdictCite, type RailDetail } from './RailDetail';
import { useAuditLog } from '../../context/AdminDataContext';
import {
  // PARKED (Aug 2026) — `formatINR` came in only to price the exposure strip in
  // the deficiency banner below. Both go back together.
  // formatINR,
  concludeRationale, controlCode, controlConclusion, courtFor, operatingApplies, designCompleteness, designOutstanding, designOutstandingRequired, discussionsFor, extractionCriteria,
  isControlLocked, isControlLockedIn, itgcHolds, failedItgcs, isItgcDependent, docRequirement, docColumnOf, docNotApplicable, operatingProgress, operatingSuggestion, TOE_MAX_ROUNDS, toeRoundFailed, toeRoundNo, toeRounds, toeSpent, canRedrawToe, canExtendToe, populationLocked, sampleSizeGuide, samplingOf, trackResult, pointResult, stepResult, attestationOverruled, inquiryOnlyAttributes, restsOnStatementAlone,
  countVerdict, coverageVerdict, derivedRunCount, populationReady, designBasis, designSuggestion, auditorProvenChecks, suggestedDesignChecks, suggestPopulationFile, fmtDay, parseDay,
  iraCannotTest, designBlocked, confidenceOf, CONFIDENT_AT, awaitsConfirm, unconfirmedIra, ROLL_PART_LABEL, ROLL_PART_ANCHOR, couldntAskFor, dayMonth,
  monthlyBreakdown, spikeMonths, priorRoundCount, fileUsable, originLabel, guessFileKind, populationSources, ipeChecksFor, samplesFor, sampleSourceOf,
  expectedInputsFor, hasRowCount, isAssisting, sampledSources, reviewNotesFor, isShared, entityCoverage, uncoveredEntities, hasPaths, pathCoverage, untouchedPaths, type PopVerdict,
  requiredFilesOf, requiredFilesCount, requiredFilesReady, passedWithoutFiles, designFilesOf,
  evidenceKindOf,
  designApproved, isEngagementLocked, samePerson, documentSystemRows, awaitingCountersign,
  dealSample, NO_COUNTRY, sampleDate, sampleHome, sampleSplit, spreadPhrase, workingAudit, yearSampleRounds, type SampleSplit, type YearRound, yearEndPending, operatingHeld,
  draftSamplePrompt, readSamplePrompt,
  populationInstances, sampleAmount, seedKeyOf,
  narrowedCount, populationFrom, readRowCount,
  versionWindow, versionAudit, versionNo, versionCollapse, hasVersions, awaitsNewVersion, formatDueDate, conclusionOf,
} from './helpers';
import { useAuditFiles, type AuditFile } from './useAuditFiles';
import { auditCovers, countryFor, countryOf, inScopeEntityNames, ownersOf, programmeFor, scopedForDraw } from './auditScope';
import { ConclusionPill, CourtBadge, NatureChip, OriginPicker, Toggle, TrackPill, Tickmark, Stamp, RagKpiRow, type RagMeterDef } from './parts';
import { Pill } from '../shared/StatusBadge';
import { useToast } from '../shared/Toast';
import { InlineNote, useInlineNote } from './InlineNote';
import { Sparkles, FileSpreadsheet } from 'lucide-react';
import WorkingPaperModal from './WorkingPaperModal';
import RemediationBriefModal from './RemediationBriefModal';
import ControlChatPane, { iraStepUndone } from './ControlChatPane';
import { DESIGN_RUN_STEPS, TOE_RUN_STEPS, controlRun, endRun, runIsLive, startRun, railShown, useControlRun, useIraMode, type ControlRun } from './controlChat';
import { DeficiencyCard } from './extraViews';
import DatePicker from '../shared/DatePicker';
import { cn } from '../../lib/cn';
// PARKED (Aug 2026) — Gap type and Priced impact left this screen; the banners in
// types.ts say why. The imports go back with the blocks that used them:
//   EXPOSURE_LABEL, exposureTotal, GAP_LABEL   (values)
//   Exposure                                    (type)
import { AUDIT_ROUNDS, AUDITOR_PROOF_KINDS, DESIGN_DOC_KINDS, DESIGN_WAIVER_REASONS, FIVE_W_1H, ipeSuggestion, ROLE_LABEL, ROUND_TAG, samplingAgreed } from './types';
import { requiredDatasetsFor, sampleRefs } from './mockData';
import { extraLabel, useRacmConfig } from './racmConfig';
import { racmSetupKeyFor } from './racmLibrary';
import DialogFocus from '../shared/DialogFocus';
import MenuFocus from '../shared/MenuFocus';
import { tabKeys } from '../shared/tabKeys';
import type { RollPart,
  AuditRound, Control, DesignDoc, DesignDocKind, DesignPoint, DesignWaiverReason, DiscussionAnchor, DocStatus, EvidenceFile, OperatingStep,
  AuditorProofKind, ExecutionEvent, FileOrigin, Frequency, IpeCheck, IpeConclusion, PopulationSource, Role, Sampling, SamplingMethodology, SourceRole, TestResult, ToeRound, TrackConclusion, ValidationResult,
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
function RationaleForm({ title, onCancel, buttons }: { title: string; onCancel: () => void; buttons: { label: string; onClick: (note: string) => void; disabled?: boolean; title?: string }[] }) {
  const [note, setNote] = useState('');
  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-2 p-3 rounded-xl border border-high-200 bg-high-50/40">
      <div className="text-[0.75rem] font-semibold text-high-700 mb-1.5 flex items-center gap-1.5"><Pencil size={12} /> {title}</div>
      <textarea autoFocus value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Record your rationale — retained in the working paper." className="w-full text-[0.75rem] rounded-lg border border-canvas-border bg-canvas-elevated px-2.5 py-2 text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-high-200 resize-none" />
      <div className="flex items-center justify-end gap-2 mt-2 flex-wrap">
        {/* Why the buttons are dead, said beside them rather than on hover. */}
        {!note.trim() && <span className="mr-auto text-[0.6875rem] text-ink-500">Write the reason first — the buttons wait for it.</span>}
        <button onClick={onCancel} className="h-7 px-2.5 text-[0.75rem] font-semibold text-ink-500 hover:text-ink-800 cursor-pointer">Cancel</button>
        {buttons.map(b => <button key={b.label} disabled={!note.trim() || b.disabled} title={b.title ?? (note.trim() ? undefined : 'Write the reason first')} onClick={() => b.onClick(note.trim())} className="h-7 px-3 text-[0.75rem] font-semibold rounded-lg bg-high-600 text-white disabled:opacity-40 enabled:hover:bg-high-700 transition-colors cursor-pointer">{b.label}</button>)}
      </div>
    </motion.div>
  );
}

/** The dossier's framed nothing-here panel. Exported because the library's own
 *  control page (ControlLibraryDetail) says the same kind of thing in the same
 *  places, and two empty states that disagree read as two products. */
export function EmptyState({ icon, title, hint, children }: { icon: React.ReactNode; title: string; hint: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-canvas-border bg-paper-50/30 px-5 py-7 text-center">
      <div className="w-10 h-10 rounded-xl bg-canvas-elevated border border-canvas-border flex items-center justify-center mx-auto mb-2.5 text-ink-400">{icon}</div>
      <div className="text-[0.8125rem] font-semibold text-ink-800">{title}</div>
      <p className="text-[0.75rem] text-ink-500 mt-0.5 max-w-90 mx-auto">{hint}</p>
      {children && <div className="mt-3 flex items-center justify-center gap-2">{children}</div>}
    </div>
  );
}

/** The menu is portalled to the body and positioned against the trigger, so a
 *  card's own bounds can never clip it — it opens over the page, and flips
 *  above the button when there isn't room below. */
/** `triggerClass` overrides the trigger's chrome for the rare caller that needs
 *  the control to read as text at rest (the control page's owner fields). Left
 *  out, every caller renders exactly the bordered button it always has. */
/** The open / close control for the header's detail half. It sits at the end of
 *  the activity line — where the sentence stops and the reader is already asking
 *  for the rest — and stays in that one place whether it reads more or less, so
 *  the thing that opened the detail is the thing that closes it. The chevron
 *  turns with the state; the word carries the underline, not the arrow. */
function MoreLink({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      className="group shrink-0 inline-flex items-center gap-0.5 font-medium text-brand-700 hover:text-brand-800 transition-colors cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
    >
      <span className="underline underline-offset-2 decoration-brand-300 group-hover:decoration-brand-500 transition-colors">{open ? 'less' : 'more'}</span>
      <ChevronDown size={13} className={cn('text-brand-500 transition-transform duration-200 ease-out', open && 'rotate-180')} />
    </button>
  );
}

/** One named field in the leadsheet header, read as "name: value". Mirrors the
 *  library control page so the two control screens read the same. */
/** One of the header's classification chips — Financial, Manual, Preventive,
 *  Monthly. Quiet by default: six of these run across the top of the card and a
 *  toned pill each would turn a classification into a traffic light. Two carry
 *  colour: the risk rating, because it IS a judgement, and the risk category,
 *  which is tinted from the shared map so the same word is the same colour here,
 *  on the matrix and in the programme view. */
function HeadChip({ icon, tint, children }: { icon?: React.ReactNode; tint?: string; children: React.ReactNode }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[0.75rem] font-medium whitespace-nowrap',
      tint ?? 'border border-canvas-border bg-paper-50/70 text-ink-700',
    )}>
      {icon && <span className="text-ink-400 shrink-0">{icon}</span>}
      {children}
    </span>
  );
}

function HeadField({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-ink-400">{label}:</span>
      <span className="font-medium text-ink-800">{value}</span>
    </span>
  );
}

/** A column header folded to letters only, so "Sub-Process", "sub process" and
 *  "SubProcess" compare equal. */
const headKey = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
/** Every fact the control header already says, under the names a client's file
 *  tends to give it. A leftover file column matching one of these is a repeat. */
const HEAD_SHOWN_KEYS = new Set([
  'controlid', 'controlref', 'controlreference', 'controlno', 'controlnumber', 'id', 'wpref',
  'riskid', 'riskref', 'risk', 'risktitle', 'riskdescription', 'controltitle', 'controldescription', 'controlactivity',
  'racm', 'process', 'entity', 'controlowner', 'owner', 'processowner', 'riskowner', 'subprocess',
  'riskcategory', 'category', 'riskrating', 'nature', 'type', 'controltype', 'frequency', 'assertion', 'assertions',
  'rootcause', 'objective', 'controlobjective', 'effectivedate', 'country', 'testingstrategy', 'keycontrol', 'key',
].map(headKey));

export function Dropdown({ trigger, children, triggerClass, ariaLabel }: { trigger: React.ReactNode; children: (close: () => void) => React.ReactNode; triggerClass?: string; ariaLabel?: string }) {
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
      <button ref={btnRef} onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open} aria-label={ariaLabel} className={triggerClass ?? "h-8 px-2.5 inline-flex items-center gap-1.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.75rem] font-semibold text-ink-700 hover:border-ink-300 transition-colors cursor-pointer"}>{trigger}<ChevronDown size={13} className="text-ink-400" /></button>
      {createPortal(
        <AnimatePresence>
          {open && pos && (
            <>
              {/* below the modal layer (z-50) so a dialog still wins */}
              <div className="fixed inset-0 z-[45]" onClick={() => setOpen(false)} />
              <motion.div
                initial={{ opacity: 0, y: pos.flip ? 4 : -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: pos.flip ? 4 : -4 }}
                style={{ position: 'fixed', right: pos.right, ...(pos.flip ? { bottom: pos.y } : { top: pos.y }) }}
                role="menu"
                className="z-[46] w-56 max-h-64 overflow-y-auto rounded-xl border border-canvas-border bg-canvas-elevated shadow-[0_16px_40px_-16px_rgba(15,8,30,.4)] p-1">
                <MenuFocus onClose={() => setOpen(false)} />
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
export const menuItem = 'w-full text-left px-2.5 py-1.5 rounded-lg text-[0.8125rem] text-ink-700 hover:bg-paper-50 cursor-pointer flex items-center gap-2';

// ── request-data modal (TOD) ──────────────────────────────────────────────────────
function RequestDataModal({ control, onClose }: { control: Control; onClose: () => void }) {
  const { requestDataByEmail } = useIcfr();
  const logEvent = useAuditLog();
  const { addToast } = useToast();
  // Only what this class of control actually has: an element that does not apply
  // is not listed at all, so nobody is asked for an ITGC's flowchart.
  const askable = control.design.documents.filter(d => !docNotApplicable(control, d));
  // pre-select what's genuinely outstanding — a waived element isn't chased
  const [sel, setSel] = useState<Set<string>>(() => new Set(askable.filter(d => d.status !== 'Received' && !d.waiver).map(d => d.id)));
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
      <motion.div role="dialog" aria-modal="true" aria-labelledby="request-tod-title" className="modal" onClick={e => e.stopPropagation()} initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }}><DialogFocus onEscape={onClose} />
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-canvas-border">
          <div className="flex items-center gap-2"><Mail size={16} className="text-brand-600" /><h3 id="request-tod-title" className="text-[0.875rem] font-bold text-ink-900">Request TOD data</h3></div>
          <button onClick={onClose} aria-label="Close" className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-ink-400 hover:text-ink-800 hover:bg-paper-50 cursor-pointer"><X size={16} /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <div className="text-[0.6875rem] font-bold uppercase tracking-wide text-ink-400 mb-2">Documents to request</div>
            <div className="space-y-1.5">
              {askable.length === 0 && <p className="text-[0.75rem] text-ink-400">Nothing to request — no design element applies to this control.</p>}
              {askable.map(d => {
                const on = sel.has(d.id);
                return (
                  <button key={d.id} onClick={() => toggle(d.id)} className={cn('w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-colors cursor-pointer', on ? 'border-brand-300 bg-brand-50/50' : 'border-canvas-border hover:border-ink-300')}>
                    <span className={cn('w-4.5 h-4.5 rounded-sm border flex items-center justify-center shrink-0', on ? 'bg-brand-600 border-brand-600 text-white' : 'border-ink-300')}>{on && <Check size={12} strokeWidth={3} />}</span>
                    <span className="min-w-0 flex-1"><span className="text-[0.8125rem] font-semibold text-ink-800">{d.kind}</span><span className="text-[0.6875rem] text-ink-400 ml-2">{d.waiver ? 'Waived' : d.status}</span></span>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="text-[0.6875rem] font-bold uppercase tracking-wide text-ink-400 mb-2">Send to</div>
            <p className="text-[0.75rem] text-ink-500 mb-2">
              {owners.single
                ? <><b className="font-semibold text-ink-700">{owners.processOwner}</b> owns and runs this control.</>
                : <><b className="font-semibold text-ink-700">{owners.processOwner}</b> runs the process and is who this reaches; <b className="font-semibold text-ink-700">{owners.controlOwner}</b> is accountable for the control and is copied.</>}
            </p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {emails.map(e => <span key={e} className="inline-flex items-center gap-1.5 h-7 pl-2.5 pr-1.5 rounded-lg bg-paper-100 text-[0.75rem] font-medium text-ink-700">{e}<button aria-label={`Remove ${e}`} onClick={() => setEmails(emails.filter(x => x !== e))} className="text-ink-400 hover:text-risk-600 cursor-pointer"><X size={12} /></button></span>)}
              {emails.length === 0 && <span className="text-[0.75rem] text-ink-400">No address on file for either owner — add one below.</span>}
            </div>
            <div className="flex items-center gap-2">
              <input aria-label="Add an email address" value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addEmail(); } }} type="email" placeholder="name@company.com" className="flex-1 h-9 px-3 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.8125rem] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-200" />
              <button onClick={addEmail} className="h-9 px-3 rounded-lg border border-canvas-border text-[0.8125rem] font-semibold text-ink-600 hover:border-ink-300 cursor-pointer">Add</button>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-canvas-border bg-paper-50/40">
          <span className="text-[0.75rem] text-ink-400">{sel.size} document{sel.size === 1 ? '' : 's'} · {emails.length} recipient{emails.length === 1 ? '' : 's'}</span>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="h-9 px-3.5 text-[0.8125rem] font-semibold text-ink-600 hover:text-ink-900 cursor-pointer">Cancel</button>
            <button disabled={!canSend} onClick={() => { requestDataByEmail(control.id, Array.from(sel), emails); logEvent({ action: 'Share', description: `Requested ${sel.size} TOD document(s) for ${control.id} from ${emails.length} recipient(s)`, module: 'SOX ICFR', entity: 'Control' });  onClose(); }} className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[0.8125rem] font-semibold disabled:opacity-40 enabled:hover:bg-brand-700 transition-colors cursor-pointer"><Send size={14} /> Send request</button>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}

/**
 * The ITGC cascade, said out loud on the control it landed on.
 *
 * Without this, an automated control silently grows three steps it did not have
 * yesterday and its sample size jumps, because somebody concluded a completely
 * different control ineffective. The auditor looking at THIS page had no part in
 * that and no way to find out. So it names the control that did it and offers
 * the way there — "an ITGC failed" is not something anyone can act on.
 *
 * IT-dependent controls get it too. They never had the short form to lose, but
 * the reliance they place on the same systems is just as gone, and their paper
 * has to show they knew.
 */
function ItgcCascadeNotice({ control }: { control: Control }) {
  const { eng, openControl } = useIcfr();
  if (!isItgcDependent(control)) return null;
  const failed = failedItgcs(eng);
  if (!failed.length) return null;
  return (
    <div className="rounded-xl border border-mitigated-200 bg-mitigated-50/40 p-4 mb-4 flex items-start gap-3">
      <Cpu size={16} className="text-mitigated-700 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <h3 className="text-[0.8125rem] font-bold text-mitigated-800">
          Test of one is withdrawn — {failed.length === 1 ? 'an IT general control has' : `${failed.length} IT general controls have`} failed
        </h3>
        <p className="text-[0.75rem] text-ink-700 leading-relaxed mt-1">
          {control.nature === 'Automated'
            ? 'Population, sample and TOE are back on this control, and the sample is sized like a manual one of the same frequency.'
            : 'This control leans on the same systems, so one instance no longer stands for the rest of them.'}
          {' '}Nobody can say the logic that ran in March is the logic that ran in October until this is remediated and retested.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {failed.map(f => (
            <button key={f.id} onClick={() => openControl(f.id)} title={f.description}
              className="inline-flex items-center gap-1.5 max-w-full px-2 h-5.5 rounded-md border border-mitigated-200 bg-canvas-elevated text-[0.6875rem] font-semibold text-mitigated-800 hover:border-mitigated-400 transition-colors cursor-pointer">
              {/* shrink-0 + nowrap: a AIH/TRY/R001/C001-length ID would otherwise
                  break at its slashes inside this one-line chip */}
              <span className="font-mono shrink-0 whitespace-nowrap">{controlCode(f)}</span>
              <span className="truncate font-medium text-ink-600">{f.description}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
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
          <p className="text-[0.75rem] text-ink-500 mt-1 leading-relaxed max-w-168">
            {control.description.split('.')[0]} runs automatically, so it does the same thing to every
            transaction — testing fifty proves nothing that testing one did not. The design test is the
            whole test, and this control concludes on it alone.
          </p>
          <p className="text-[0.75rem] text-ink-400 mt-2 leading-relaxed max-w-168">
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
function ConcludeFooter({ control, which, suggestion, canEdit, disabled, disabledNote, disableEffective, disableEffectiveNote }: { control: Control; which: 'design' | 'operating'; suggestion: TrackConclusion; canEdit: boolean; disabled?: boolean;
  /** Why both buttons are dead — said beside them, because a pair of greyed
   *  buttons with no reason reads as the screen being broken. */
  disabledNote?: string;
  disableEffective?: boolean; disableEffectiveNote?: string }) {
  const { me, concludeDesign, concludeOperating, overrideDesign, overrideOperating } = useIcfr();
  const { addToast } = useToast();
  const logEvent = useAuditLog();
  const track = control[which];
  const conclude = which === 'design' ? concludeDesign : concludeOperating;
  const override = which === 'design' ? overrideDesign : overrideOperating;
  const label = which === 'design' ? 'TOD' : 'TOE';
  // TOD names what it concludes (17 Sep dev call): "Design effective", not
  // "Conclude effective". TOE keeps its wording.
  const effectiveLabel = which === 'design' ? 'Design effective' : 'Conclude effective';
  const ineffectiveLabel = which === 'design' ? 'Design ineffective' : 'Conclude ineffective';
  // The box is open before either button is pressed, drafted from the evidence.
  // Seeded once per track state so a rationale already on the paper is what you
  // come back to, and re-testing redrafts rather than leaving stale words behind.
  const drafted = concludeRationale(control, which);
  const [note, setNote] = useState(track.rationale ?? drafted);
  const [seed, setSeed] = useState(track.rationale ?? drafted);
  // Typed words are never overwritten (21 Sep). The draft is derived from the
  // check and attribute counts, so it changes every time one is marked — and
  // the re-seed below was wiping a rationale mid-sentence for anyone who wrote
  // the reason before finishing the marking, which is the order most auditors
  // work in. Re-drafting is still right for a box nobody has touched.
  const [touched, setTouched] = useState(false);
  if (seed !== (track.rationale ?? drafted)) {
    setSeed(track.rationale ?? drafted);
    if (!touched) setNote(track.rationale ?? drafted);
  }
  // Runs recorded over a draw that has since changed — the store refuses to
  // conclude on them, so the buttons say why instead of failing silently.
  const staleRuns = which === 'operating' ? control.operating.steps.filter(s => s.staleRun).length : 0;
  // Attributes standing on a statement nobody backed. The store refuses to call
  // the control effective on them, so Effective says why — Ineffective stays
  // live, because an account that says the control did not run is still an
  // answer, and blocking it would leave the control nowhere to go.
  const onWordAlone = which === 'operating' ? inquiryOnlyAttributes(control).length : 0;
  // A failed attribute and an effective conclusion cannot both stand. The store
  // refuses it; the button says so rather than looking live and doing nothing.
  // Ineffective stays open — that is the whole point of the round having failed.
  const roundFail = which === 'operating' && toeRoundFailed(control);
  // Ira proposes, a person confirms (agentic UX #1, 1 Oct): the store refuses
  // to conclude over unconfirmed results, so both buttons say so here.
  const waiting = unconfirmedIra(control, which).length;
  // Early conclusions wait (product decision, 5 Oct): Ineffective needs a
  // tested check (TOD), or a drawn sample with a result (TOE). The store
  // refuses it too; this says why beside the button.
  const tooEarly = ineffectiveTooEarly(control, which);
  if (!canEdit) return null;
  const apply = (target: TrackConclusion) => {
    const rationale = note.trim();
    setTouched(false);   // filed — the box belongs to the paper again
    conclude(control.id, target, rationale);                       // conclusion and its words, together
    logEvent({ action: 'Update', description: `Concluded ${which === 'design' ? 'TOD' : 'TOE'} ${target.toLowerCase()} for ${control.id}`, module: 'SOX ICFR', entity: 'Control' });
    // Going against the evidence is still its own record — the same words, filed
    // as an override so the banner and the working paper both show the departure.
    const contradicts = suggestion !== 'Not tested' && target !== suggestion;
    if (contradicts) override(control.id, { result: target === 'Effective' ? 'Effective' : 'Ineffective', by: me, at: 'just now', rationale });
    else override(control.id, null);
  };
  return (
    <div id={`conclude-${which}`} className="mt-4 pt-4 border-t border-canvas-border scroll-mt-4">
      {suggestion !== 'Not tested' && <div className="text-[0.75rem] text-ink-400 inline-flex items-center gap-1 mb-2"><Scale size={12} /> Evidence suggests <b className="font-semibold text-ink-600">{suggestion}</b></div>}
      {/* Drafted, not demanded: the words are already here and the buttons never
          wait on them, so a clean control concludes in one click and the paper
          still carries a sentence saying what was tested and what it showed. */}
      <label className="block">
        <span className="flex items-center gap-2">
          <span className="text-[0.75rem] font-semibold text-ink-500">Rationale</span>
          {/* A draft until a conclusion files it. Ira's own draft carries the
              sparkle; once the auditor types, the words are theirs and the mark
              goes — confirmed (filed) text carries no mark at all. */}
          {!track.rationale && (
            <span className="inline-flex items-center gap-1 text-[0.6875rem] text-ink-400">
              {!touched && <Sparkles size={11} className="text-brand-500" />}
              {touched ? 'draft' : 'Ira · draft'}
            </span>
          )}
        </span>
        <textarea value={note} onChange={e => { setNote(e.target.value); setTouched(true); }} rows={3}
          placeholder="Record your rationale — retained in the working paper."
          className="mt-1 w-full text-[0.75rem] rounded-lg border border-canvas-border bg-canvas-elevated px-2.5 py-2 text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-200 resize-none" />
      </label>
      <div className="flex items-center gap-2.5 flex-wrap mt-2.5">
        <button disabled={disabled || disableEffective || staleRuns > 0 || onWordAlone > 0 || roundFail || waiting > 0} title={disableEffective ? disableEffectiveNote : undefined} onClick={() => apply('Effective')} className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-compliant-600 text-white text-[0.8125rem] font-semibold enabled:hover:bg-compliant-700 disabled:opacity-40 transition-colors cursor-pointer">{disableEffective ? <Lock size={14} /> : <CheckCircle2 size={15} />} {effectiveLabel}</button>
        <button disabled={disabled || staleRuns > 0 || waiting > 0 || !!tooEarly} title={tooEarly ?? undefined} onClick={() => apply('Ineffective')} className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg border border-risk-300 text-risk-700 text-[0.8125rem] font-semibold enabled:hover:bg-risk-50 disabled:opacity-40 transition-colors cursor-pointer"><XCircle size={15} /> {ineffectiveLabel}</button>
        {disabled && disabledNote
          ? <span className="text-[0.75rem] text-mitigated-700 inline-flex items-center gap-1"><BadgeCheck size={11} /> {disabledNote}</span>
          : disableEffective && disableEffectiveNote && <span className="text-[0.75rem] text-mitigated-700 inline-flex items-center gap-1"><Lock size={11} /> {disableEffectiveNote}</span>}
        {tooEarly && !disabled && (
          <span className="text-[0.75rem] text-ink-500 inline-flex items-center gap-1">
            <Lock size={11} /> {tooEarly}
          </span>
        )}
        {waiting > 0 && (
          <span className="text-[0.75rem] text-ink-500 inline-flex items-center gap-1">
            <Sparkles size={11} className="text-brand-500" /> Confirm Ira’s {waiting} result{waiting === 1 ? '' : 's'} above first.
          </span>
        )}
        {staleRuns > 0 && (
          <span className="text-[0.75rem] text-mitigated-700 inline-flex items-center gap-1">
            <AlertTriangle size={11} /> {staleRuns} run{staleRuns === 1 ? ' predates' : 's predate'} the current draw — re-run before concluding.
          </span>
        )}
        {onWordAlone > 0 && (
          <span className="text-[0.75rem] text-mitigated-700 inline-flex items-center gap-1">
            <AlertTriangle size={11} /> {onWordAlone} attribute{onWordAlone === 1 ? ' rests' : 's rest'} on a statement alone — attach what was inspected, or validate the file, before calling this effective.
          </span>
        )}
        {/* The failure itself is stated above, by the block that offers the two
            ways out — so this names the way forward rather than repeating it. */}
        {roundFail && (
          <span className="text-[0.75rem] text-mitigated-700 inline-flex items-center gap-1">
            <AlertTriangle size={11} /> An attribute failed — extend or redraw above, or conclude ineffective.
          </span>
        )}
      </div>
      {track.override && (
        <div className="mt-2.5 text-[0.75rem] text-high-700 flex items-start gap-1.5 p-2.5 rounded-lg bg-high-50/50 border border-high-200">
          <Pencil size={12} className="mt-0.5 shrink-0" /><span><b>Conclusion overridden</b> — {track.override.rationale} <span className="text-ink-400">· {track.override.by}</span></span>
          <button onClick={() => override(control.id, null)} className="ml-auto text-ink-400 hover:text-ink-700 inline-flex items-center gap-1 cursor-pointer"><RotateCcw size={11} /> undo</button>
        </div>
      )}
    </div>
  );
}

// The validation read-out used to be a modal here (QAResultsModal). It is the
// rail's layer 3 now — RailDetail.tsx — and SampleResultsTable moved with it
// (agentic UI review #3, 30 Sep).

/**
 * Workflow run results — the read-out behind a pulled run, the workflow twin of
 * the AI validation's Q&A modal. A run tests the attribute against every
 * extracted sample, so the answer worth showing isn't the attribute's single
 * Pass / Fail — it's which sampled items passed and which didn't.
 */
// PARKED (S1, workflows removed from SOX)
function RunResultsModal({ control, step, onClose }: { control: Control; step: OperatingStep; onClose: () => void }) {
  const { eng } = useIcfr();
  const samples = control.operating.sampling?.samples ?? [];
  const passed = samples.filter(s => step.sampleResults?.[s.id] === 'Pass').length;
  const eff = stepResult(step);
  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <motion.div role="dialog" aria-modal="true" aria-labelledby="workflow-run-title" className="modal modal-wide" onClick={e => e.stopPropagation()} initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }}><DialogFocus onEscape={onClose} />
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-canvas-border">
          <div className="flex items-center gap-2"><WorkflowIcon size={16} className="text-evidence-700" /><h3 id="workflow-run-title" className="text-[0.875rem] font-bold text-ink-900">Workflow run — results</h3></div>
          <div className="flex items-center gap-2">
            {eff !== 'Not tested' && <span className={cn('inline-flex items-center gap-1 text-[0.75rem] font-bold px-2 h-6 rounded-full', eff === 'Pass' ? 'bg-compliant-50 text-compliant-700' : 'bg-risk-50 text-risk-700')}><Tickmark result={eff} size={13} /> {eff}</span>}
            <button onClick={onClose} className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-ink-400 hover:text-ink-800 hover:bg-paper-50 cursor-pointer" aria-label="Close"><X size={16} /></button>
          </div>
        </div>
        <div className="px-5 py-2.5 border-b border-canvas-border bg-paper-50/40 flex items-center gap-2 flex-wrap">
          <p className="text-[0.75rem] text-ink-600"><b className="text-ink-800">Tested —</b> {step.code} · {step.description}</p>
          {step.workflowRunRef && <span className="font-mono text-[0.6875rem] text-ink-400">{step.workflowRunRef}</span>}
        </div>
        <div className="px-5 py-4 max-h-[58vh] overflow-y-auto">
          {samples.length === 0
            ? <p className="text-[0.8125rem] text-ink-500 leading-relaxed">
                No sample has been extracted for this control yet, so the run has nothing to report per item — it recorded an overall result only.
                Draw a sample in step ③ and re-pull the run to see it item by item.
              </p>
            : <SampleResultsTable control={control} step={step} home={sampleHome(eng, a => auditCovers(a, control, eng.id))} />}
        </div>
        {/* the pass count lives on the table's own header — not repeated here */}
        <div className="flex items-center justify-end px-5 py-3.5 border-t border-canvas-border">
          <button onClick={onClose} className="h-9 px-4 rounded-lg bg-brand-600 text-white text-[0.8125rem] font-semibold hover:bg-brand-700 cursor-pointer">Close</button>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}

// ── design consideration row — validated by its own workflow (Q&A) + override ─────
export const VALIDATE_MS = 6000;

/** Ira's run, said on hover only (agentic UI review: "run info … in History and
 *  on hover only"; user ask, 1 Oct). It used to sit on every check's grey line
 *  as "Ask IRA · checked · 3 Sep". Confirmed = the step was concluded. */
function runInfo(v: ValidationResult | undefined, track: { conclusion: TrackConclusion; testedBy: string | null; testedAt: string | null }): string | undefined {
  if (!v) return undefined;
  const confirmed = track.conclusion !== 'Not tested' && track.testedBy
    ? `confirmed by ${track.testedBy}${track.testedAt ? `, ${track.testedAt}` : ''}` : 'not confirmed yet';
  return `Ira ran this ${v.at} · ${confirmed}`;
}
/** The tick's hover: how sure, then the run. */
const tickTitle = (conf: number | undefined, run: string | undefined) =>
  conf != null && run ? `Ira · ${Math.round(conf)}% sure · ${run.replace(/^Ira /, '')}` : undefined;

/** The one thing on the page that says Ira is working (agentic UI review #13):
 *  a thin line on the step being worked — "Reading 3 files · check 2 of 5" —
 *  in place of the header spinner, a spinner on every row and a bar under each.
 *  The count steps through the run's length so it reads as progress rather than
 *  a wait; the rest of the page stays usable underneath it. */
/** "Ira is sure on 7 — Confirm all 7" (agentic UX #1 / #4, 1 Oct). Sure results
 *  are confirmed in one click; the less-sure ones each wait for their own
 *  Confirm on the row (and sit in Needs you). Nothing here for anyone but the
 *  tester — confirming is the testing pen. */
function ConfirmSure({ control, which, rows }: { control: Control; which: 'design' | 'operating'; rows: (DesignPoint | OperatingStep)[] }) {
  const { confirmIra, role } = useIcfr();
  if (role !== 'auditor' || control[which].conclusion !== 'Not tested') return null;
  const waiting = rows.filter(awaitsConfirm);
  if (!waiting.length) return null;
  const sure = waiting.filter(r => (confidenceOf(r.validation, `${control.id}:${r.id}`) ?? 0) >= CONFIDENT_AT);
  const unsure = waiting.length - sure.length;
  return (
    <div className="mb-2.5 flex items-center gap-2 flex-wrap text-[0.75rem] text-ink-600">
      <Sparkles size={12} className="text-brand-500 shrink-0" aria-hidden />
      {sure.length > 0 && <>
        <span>Ira is sure on {sure.length}</span>
        <button onClick={() => confirmIra(control.id, which, sure.map(r => r.id))}
          className="h-6 px-2 rounded-md border border-brand-200 bg-brand-50 text-[0.6875rem] font-semibold text-brand-700 hover:bg-brand-100 transition-colors cursor-pointer">Confirm all {sure.length}</button>
      </>}
      {unsure > 0 && <span className="text-ink-500">{sure.length > 0 && '· '}{unsure} less sure — confirm each below</span>}
    </div>
  );
}

function RunLine({ files, total, noun, label, ms }: { files: number; total: number; noun: string; label?: string; ms: number }) {
  const reduce = useReducedMotion();
  const [at, setAt] = useState(1);
  useEffect(() => {
    if (total <= 1) return;
    const t = window.setInterval(() => setAt(n => Math.min(total, n + 1)), ms / total);
    return () => window.clearInterval(t);
  }, [total, ms]);
  const reading = `Reading ${files} file${files === 1 ? '' : 's'}`;
  return (
    <div role="status" aria-live="polite" className="mb-2.5">
      <p className="text-[0.6875rem] text-ink-500 inline-flex items-center gap-1.5">
        <Sparkles size={11} className="text-brand-500 shrink-0" />
        {label ? `${reading} · ${label}` : `${reading} · ${noun} ${at} of ${total}`}
      </p>
      <div className="mt-1 h-0.5 rounded-full bg-paper-100 overflow-hidden">
        <motion.div className="h-full bg-brand-500" initial={{ width: reduce ? '100%' : 0 }} animate={{ width: '100%' }} transition={{ duration: reduce ? 0 : ms / 1000, ease: 'linear' }} />
      </div>
    </div>
  );
}

/** Which step a live run is working on, read off the shared run itself — so a
 *  run started from the Ira chat shows on the page exactly like one started
 *  here (click-through, 5 Oct). The design and TOE runs walk the shared step
 *  lists; the chat's extract and draw are named by their label. Read inside a
 *  function, never at module load (the sox-icfr import cycle). */
type RunStage = 'design' | 'toe' | 'population' | 'sample' | 'other';
function runStageOf(run: ControlRun | null): RunStage | null {
  if (!run) return null;
  const first = run.steps[0]?.label;
  if (first === DESIGN_RUN_STEPS[0]) return 'design';
  if (first === TOE_RUN_STEPS[0]) return 'toe';
  if (/^Filtering /.test(run.label)) return 'population';
  if (/^Drawing /.test(run.label)) return 'sample';
  return 'other';
}
/** Why a run button is dead while Ira is already working on this control. */
const busyNote = (run: ControlRun) => `Ira is already working on this control — ${run.label.charAt(0).toLowerCase()}${run.label.slice(1)}. Wait for it, or stop it in the Ira panel.`;

/** The progress line for a run this page did not start (the chat's). Same
 *  place and shape as RunLine; it narrates the run's own live step because the
 *  page does not know that run's length. */
function LiveRunLine({ run }: { run: ControlRun }) {
  const now = run.steps[run.steps.length - 1]?.label;
  return (
    <div role="status" aria-live="polite" className="mb-2.5">
      <p className="text-[0.6875rem] text-ink-500 inline-flex items-center gap-1.5">
        <Sparkles size={11} className="text-brand-500 shrink-0" />
        {run.label}{now ? ` · ${now.charAt(0).toLowerCase()}${now.slice(1)}` : ''}…
      </p>
      <div className="mt-1 h-0.5 rounded-full bg-paper-100 overflow-hidden">
        <div className="h-full w-full bg-brand-500/70 motion-safe:animate-pulse" />
      </div>
    </div>
  );
}

/** `checking` — Ira is running across every design check from the section header
 *  (S6, A17). The row wears the same busy state its own validation used to. */
function PointRow({ control, point, canEdit, checking = false }: { control: Control; point: DesignPoint; canEdit: boolean; checking?: boolean }) {
  const { eng, me, role, confirmIra, setDesignPoint, validateDesignPoint, overrideDesignPoint, removeDesignPoint, linkDesignPointEvidence, setDesignPointProof } = useIcfr();
  // The ask Needs you sent the owner for this check, read off their task list.
  const asked = couldntAskFor(eng, control.id, point.id);
  const [over, setOver] = useState(false);
  const [validatingOne, setValidating] = useState(false);
  const validating = validatingOne || checking;
  const openDetail = useOpenRailDetail();
  const [linking, setLinking] = useState(false);
  const [proving, setProving] = useState(false);
  // The attach form's draft — what the auditor did, the file itself, and why it
  // was attached. Held here until Submit, so a half-filled form writes nothing.
  const [proofKind, setProofKind] = useState<AuditorProofKind>(AUDITOR_PROOF_KINDS[0]);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofNote, setProofNote] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const eff = pointResult(point);
  const runValidate = () => { setValidating(true); window.setTimeout(() => { validateDesignPoint(control.id, point.id); setValidating(false); }, VALIDATE_MS); };

  // ── disagreeing with a recorded result costs a sentence (user, 22 Sep) ─────
  // There is no quiet way to change an answer on this row any more: once a
  // check has a result the ticks are gone and Override is the only door, and
  // Override always writes a rationale. A working paper that says "Ira found
  // this fails, and the auditor passed it" without saying why is a paper that
  // cannot be reviewed.
  const iraSaid = point.validation?.result;
  // What Ira said it could not do, and which of the two problems it is. Only
  // while the check is still unmarked: once the auditor has answered it by
  // hand, the assistant's inability to is history and the row should not keep
  // apologising for it.
  const blocked = eff === 'Not tested' ? point.validation?.blocked : undefined;
  const blockKind = blocked ? iraCannotTest(point, control)?.kind ?? 'insufficient' : undefined;
  // Who reached this row's answer, in one word (agentic UI review #1). Nothing
  // once TOD is concluded — confirmed work carries no mark.
  const rowState = iraStateOfPoint(point, control.design.conclusion !== 'Not tested');
  // How sure Ira was — only where Ira's verdict is the one standing. An override
  // or a hand mark is a person's answer and carries no percentage (review #2).
  const conf = !point.override && point.validation?.result && point.validation.result === eff
    ? confidenceOf(point.validation, `${control.id}:${point.id}`) : undefined;
  const flipTo: 'Pass' | 'Fail' = eff === 'Pass' ? 'Fail' : 'Pass';
  const iraVerdict = iraSaid === 'Pass' || iraSaid === 'Fail' ? iraSaid : undefined;
  const run = runInfo(point.validation, control.design);

  // The elements this check points at. Resolved by id every render rather than
  // cached — an element that was removed must stop being cited, not linger as a
  // reference to a document nobody can open.
  const linked = control.design.documents.filter(d => point.evidencedBy?.includes(d.id));
  // The file the check was validated against — its own proof first, then the
  // elements it cites, matching what the validator read. Among the cited
  // elements, one the reader can actually OPEN wins (25 Sep): a seeded
  // engagement's planning documents are file records with no bytes behind them.
  const workingEvidence = point.auditorProof?.file
    ?? (f => f.find(x => !!x.url) ?? f[0])(linked.flatMap(d => d.files ?? []));
  // Layer 2 (agentic UI review #3): Ira's reasons, on hover of the row's one line.
  const reasons = point.validation?.qa.map(x => `${x.pass ? '✓' : '✗'} ${x.q} — ${x.a}`).join('\n');
  const cites = point.validation?.qa.map(x => x.cite).filter((q): q is string => !!q) ?? [];
  // Layer 3 lives in the rail, not a popup (agentic UI review #3).
  const seeWorking = () => point.validation && openDetail({ kind: 'working', title: point.text, validation: point.validation, control, evidence: workingEvidence, confKey: `${control.id}:${point.id}` });
  // One click from Ira's result to the sentence it rests on: the same working,
  // opened on this answer's passage (none if it couldn't test or read no file).
  const seeAnswer = () => point.validation && openDetail({ kind: 'working', title: point.text, validation: point.validation, control, evidence: workingEvidence, confKey: `${control.id}:${point.id}`, focusCite: verdictCite(point.validation) });
  // The tick is Ira's marker while Ira's verdict (or its "couldn't") stands.
  const iraMarked = !!point.validation && !point.override && (conf != null || !!blocked);
  const answerLabel = verdictCite(point.validation) ? "See the passage Ira's answer rests on" : "See Ira's working";
  const closeProof = () => { setProving(false); setProofFile(null); setProofNote(''); setProofKind(AUDITOR_PROOF_KINDS[0]); setDragOver(false); };
  const submitProof = () => {
    if (!proofFile) return;
    setDesignPointProof(control.id, point.id, {
      kind: proofKind,
      file: { id: `ap-${point.id}`, name: proofFile.name, kind: evidenceKindOf(proofFile.name), uploadedBy: me, uploadedAt: 'just now', url: URL.createObjectURL(proofFile) },
      note: proofNote.trim() || undefined,
    });
    closeProof();
  };

  return (
    <div id={`dp-${point.id}`} className={cn('subcard px-3.5 py-3 scroll-mt-4', eff === 'Not tested' && 'subcard-todo')}>
      <div className="flex items-start gap-3">
        {/* No spinner here any more — the section's one progress line says Ira
            is working; the row only says "checking…" beneath its text. */}
        {/* Clicking a recorded tick is how it is changed (review #8) — and it
            always costs a reason: the click opens the "why?" line below. */}
        {iraMarked
          ? <button type="button" onClick={seeAnswer} aria-label={answerLabel} className="shrink-0 rounded cursor-pointer hover:opacity-80"><Tickmark result={eff} size={20} confidence={conf} blocked={!!blocked} title={tickTitle(conf, run)} /></button>
          : canEdit && eff !== 'Not tested' && !point.override
          ? <button onClick={() => setOver(true)} aria-label={`Change this result to ${flipTo.toLowerCase()} — say why`} className="shrink-0 rounded cursor-pointer hover:opacity-80"><Tickmark result={eff} size={20} confidence={conf} title={tickTitle(conf, run)} /></button>
          : <Tickmark result={eff} size={20} confidence={conf} blocked={!!blocked} title={tickTitle(conf, run)} />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2"><span className="text-[0.8125rem] font-medium text-ink-800">{point.text}</span>{rowState === 'review' && point.validation
            ? <button type="button" onClick={seeAnswer} aria-label={`${answerLabel}${run ? ` — ${run}` : ''}`} className="rounded cursor-pointer hover:[&>span]:text-ink-800"><IraState state={rowState} title={tickTitle(conf, run) ?? run} /></button>
            : rowState && rowState !== 'couldnt' && <IraState state={rowState} title={rowState === 'review' ? run : undefined} />}</div>
          <div className="text-[0.6875rem] text-ink-400 mt-1 inline-flex items-center gap-1.5"><WorkflowIcon size={11} /> {point.workflowName ?? 'Design walkthrough check'}{(checking || validating || blocked || !point.validation) && ' · '}{checking ? 'checking…' : validating ? 'validating…' : blocked ? (
            /* ── Ira read it and could not answer it ─────────────────────────
               Text on the row, not a banner of its own (agentic UI review #7):
               the check is still Not tested, so the row already carries the
               amber wash every unanswered check carries, and the tick says so
               too. This only names who left it and why, the reason on hover.
               It clears itself the moment the check is marked or the missing
               element lands, because it is read off the validation the next run
               overwrites. */
            <>
              <button type="button" onClick={seeAnswer} aria-label={`See Ira's working — ${blockKind === 'missing' ? 'Missing files' : 'Not enough to go on'}: ${blocked}`} className="rounded cursor-pointer hover:[&>span]:text-ink-800">
                <IraState state="couldnt" title={`${blockKind === 'missing' ? 'Missing files' : 'Not enough to go on'} — ${blocked}`} />
              </button>
              {asked && <span title={asked.title}>· asked {asked.assignee.split(/\s+/)[0] || asked.assignee}{asked.dueAt ? `, due ${dayMonth(asked.dueAt)}` : ''}</span>}
            </>
          ) : (point.validation ? null : 'not validated')}</div>
          {/* Layer 1 — what Ira found, in one line; the reasons on hover (layer
              2); the full working one click away in the rail (layer 3). */}
          {point.validation?.summary && !point.validation.blocked && !validating && (
            <button onClick={seeWorking} title={reasons} className="mt-1 block max-w-full truncate text-left text-[0.75rem] text-ink-600 hover:text-ink-900 cursor-pointer">{point.validation.summary}</button>
          )}
          {/* The override stands when a file comes or goes after it — it is still
              the auditor's recorded judgement — but it says the evidence under it
              moved, so the reader knows to look again. */}
          {point.override && (
            <div className="text-[0.6875rem] text-high-700 mt-1 flex items-start gap-1 flex-wrap">
              <CornerDownRight size={11} className="mt-0.5 shrink-0" /> <span className="min-w-0">{point.override.rationale}{point.override.evidence && <span className="text-ink-500"> · <Paperclip size={9} className="inline -mt-0.5" /> {point.override.evidence}</span>}</span>
              {point.overrideEvidenceChanged && <span className="inline-flex items-center gap-1 font-semibold text-mitigated-700"><AlertTriangle size={10} className="shrink-0" /> Evidence changed since override</span>}
            </div>
          )}

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
                ? linked.map(d => {
                  // The file name is the link (agentic UI review #4): it opens in
                  // the rail at the passage Ira cited, not a chip that goes nowhere.
                  const f = d.files?.find(x => !!x.url) ?? d.files?.[0];
                  return f ? (
                    <button key={d.id} onClick={() => openDetail({ kind: 'file', file: f, label: docLabel(d), quotes: cites })} title={`Open ${f.name}${cites.length ? ' at the passage Ira cited' : ''}`}
                      className="inline-flex items-center gap-1 rounded-md border border-canvas-border bg-canvas-elevated px-1.5 py-0.5 text-ink-600 hover:text-brand-700 hover:underline underline-offset-2 cursor-pointer">
                      <Link2 size={9} /> {docLabel(d)}
                    </button>
                  ) : (
                    <span key={d.id} className="inline-flex items-center gap-1 rounded-md border border-canvas-border bg-canvas-elevated px-1.5 py-0.5 text-ink-400" title="no file attached to this element yet">
                      <Link2 size={9} /> {docLabel(d)}
                    </span>
                  );
                })
                : <span className="text-ink-300">nothing linked</span>}
              {canEdit && <button onClick={() => setLinking(l => !l)} className="text-brand-600 font-semibold hover:underline cursor-pointer">{linked.length ? 'Change' : 'Link elements'}</button>}
            </div>

            <div className="flex items-start gap-1.5 flex-wrap text-[0.6875rem]">
              <span className="text-ink-400 shrink-0">Auditor's proof</span>
              {point.auditorProof ? (
                <button onClick={() => openDetail({ kind: 'file', file: point.auditorProof!.file, label: point.auditorProof!.kind, quotes: cites })} title={`Open ${point.auditorProof.file.name}`}
                  className="inline-flex items-center gap-1 rounded-md border border-evidence-200 bg-evidence-50/50 px-1.5 py-0.5 text-evidence-700 hover:underline underline-offset-2 cursor-pointer">
                  <Paperclip size={9} /> {point.auditorProof.kind} · <span className="font-medium text-evidence-600 max-w-64 truncate">{point.auditorProof.file.name}</span>
                </button>
              ) : <span className="text-ink-300">none — taken on the documents</span>}
              {canEdit && (point.auditorProof
                ? <button onClick={() => setDesignPointProof(control.id, point.id, null)} className="text-ink-400 font-semibold hover:text-risk-600 hover:underline cursor-pointer">Remove</button>
                : <button onClick={() => setProving(p => !p)} className="text-brand-600 font-semibold hover:underline cursor-pointer">Attach your own</button>)}
            </div>

            {/* the comment the auditor left with it — the finding, not the filename */}
            {point.auditorProof?.note && (
              <div className="flex items-start gap-1 text-[0.6875rem] text-ink-500 leading-relaxed">
                <CornerDownRight size={11} className="mt-0.5 shrink-0 text-ink-300" /> {point.auditorProof.note}
              </div>
            )}
          </div>

          {/* pick from what is already on this control — never an upload box */}
          {linking && canEdit && (
            <div className="mt-2 rounded-lg border border-canvas-border bg-paper-50/60 p-2.5">
              <span className="block text-[0.6875rem] font-bold uppercase tracking-wider text-ink-400 mb-1.5">Which elements evidence this check?</span>
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
              <p className="text-[0.6875rem] text-ink-400 mt-2">A link, not a copy — the file stays on the element it was uploaded against.</p>
            </div>
          )}

          {/* ── attach your own proof ────────────────────────────────────────────
              Three answers, in the order the work happened: what the auditor did,
              the file it produced, and what it showed. The file is picked off this
              machine rather than minted for them, and nothing is written until
              Submit — so a form abandoned half-way leaves the check as it was. */}
          {proving && canEdit && (
            <div className="mt-2 rounded-lg border border-canvas-border bg-paper-50/60 p-2.5 space-y-2.5">
              <div>
                <span className="block text-[0.6875rem] font-bold uppercase tracking-wider text-ink-400 mb-1.5">What did you do on this check?</span>
                <div className="flex flex-wrap gap-1.5">
                  {AUDITOR_PROOF_KINDS.map(k => (
                    <button key={k} onClick={() => setProofKind(k)}
                      className={cn('h-7 px-2.5 rounded-md border text-[0.6875rem] font-semibold transition-colors cursor-pointer',
                        proofKind === k ? 'bg-evidence-50 border-evidence-300 text-evidence-700' : 'border-canvas-border bg-canvas-elevated text-ink-700 hover:border-evidence-300 hover:text-evidence-700')}>
                      {proofKind === k && <Check size={10} className="inline -mt-0.5 mr-1" />}{k}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="block text-[0.6875rem] font-bold uppercase tracking-wider text-ink-400 mb-1.5">The file</span>
                {proofFile ? (
                  <div className="flex items-center gap-2 rounded-md border border-canvas-border bg-canvas-elevated px-2.5 py-2">
                    <span className="w-6 h-6 rounded inline-flex items-center justify-center bg-evidence-50 text-evidence-700 shrink-0"><FileText size={11} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.75rem] font-semibold text-ink-800 truncate" title={proofFile.name}>{proofFile.name}</p>
                      <p className="text-[0.6875rem] text-ink-400">{evidenceKindOf(proofFile.name)} · {Math.max(1, Math.round(proofFile.size / 1024)).toLocaleString()} KB</p>
                    </div>
                    <button onClick={() => setProofFile(null)} title="Choose a different file" aria-label="Choose a different file"
                      className="h-6 w-6 inline-flex items-center justify-center rounded-md text-ink-400 hover:text-risk-600 cursor-pointer"><X size={12} /></button>
                  </div>
                ) : (
                  <label
                    onDragEnter={e => { e.preventDefault(); setDragOver(true); }}
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) setProofFile(f); }}
                    className={cn('block cursor-pointer rounded-md border border-dashed px-3 py-4 text-center transition-colors focus-within:ring-2 focus-within:ring-brand-200',
                      dragOver ? 'border-brand-400 bg-brand-50/50' : 'border-canvas-border bg-canvas-elevated hover:border-brand-300 hover:bg-brand-50/30')}>
                    <input type="file" accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.csv,.doc,.docx" className="sr-only"
                      aria-label="Choose the file that proves this check"
                      onChange={e => { const f = e.target.files?.[0]; if (f) setProofFile(f); e.target.value = ''; }} />
                    <Upload size={14} className="mx-auto text-ink-400 mb-1" />
                    <p className="text-[0.6875rem] font-semibold text-ink-700 leading-tight">Drop a file, or click to browse</p>
                    <p className="text-[0.6875rem] text-ink-400 mt-0.5">PDF, image, XLSX, CSV or Word</p>
                  </label>
                )}
              </div>

              <div>
                <span className="block text-[0.6875rem] font-bold uppercase tracking-wider text-ink-400 mb-1.5">Why you attached it</span>
                <textarea value={proofNote} onChange={e => setProofNote(e.target.value)} rows={2}
                  placeholder="e.g. Reperformed the 14 May payment run — both authorisers were distinct from the preparer."
                  className="w-full px-2.5 py-2 rounded-md border border-canvas-border bg-canvas-elevated text-[0.75rem] leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-brand-200" />
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-[0.6875rem] text-ink-400">This is what the conclusion's basis is read from — nobody types the basis.</p>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={closeProof} className="h-7 px-2.5 rounded-md border border-canvas-border bg-canvas-elevated text-[0.6875rem] font-semibold text-ink-600 hover:text-ink-900 cursor-pointer">Cancel</button>
                  <button disabled={!proofFile} onClick={submitProof}
                    title={proofFile ? 'Attach this file to the check' : 'Choose a file first'}
                    className="h-7 px-3 rounded-md bg-brand-600 text-white text-[0.6875rem] font-semibold enabled:hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">Submit</button>
                </div>
              </div>
            </div>
          )}
        </div>
        {canEdit && !validating && (
          <div className="flex items-center gap-1.5 shrink-0">
            {point.validation && <button onClick={seeWorking} className="h-7 px-2.5 inline-flex items-center gap-1 rounded-md border border-canvas-border bg-canvas-elevated text-[0.75rem] font-semibold text-ink-600 hover:border-brand-300 hover:text-brand-700 cursor-pointer"><ListChecks size={12} /> See the working</button>}
            {/* Ira proposes, the tester confirms (UX #1) — one row at a time. */}
            {role === 'auditor' && control.design.conclusion === 'Not tested' && awaitsConfirm(point) && (
              <button onClick={() => confirmIra(control.id, 'design', [point.id])}
                className="h-7 px-2.5 inline-flex items-center rounded-md border border-brand-200 bg-brand-50 text-[0.75rem] font-semibold text-brand-700 hover:bg-brand-100 cursor-pointer">Confirm</button>
            )}
            {/* PARKED (Aug 2026, user ask) — the workflow Validate / Re-run button.
                The tester can state the result themselves with the two buttons
                below, and Ira now reads every check at once from the Design
                checks header (S6, A17) rather than one row at a time.
                `runValidate` and the `validating` machinery are left in place
                above, so putting this back is one line:
                <button onClick={runValidate} title="Validate via workflow" className="h-7 px-2.5 inline-flex items-center gap-1 rounded-md border border-canvas-border bg-canvas-elevated text-[0.75rem] font-semibold text-ink-600 hover:border-evidence-300 hover:text-evidence-700 cursor-pointer"><PlayCircle size={12} /> {point.validation ? 'Re-run' : 'Validate'}</button> */}
            {/* ── one door at a time (user ask, 22 Sep) ──────────────────────
                Before there is a result, the ticks: somebody has to be able to
                say what this check did. After there is one, they go, and the
                only way to move it is Override — because the mark on the left
                IS the answer, and a pair of live ticks beside a recorded
                verdict invites it to be changed without anyone saying why. The
                pencil went with them: an icon for the one action that writes a
                sentence onto a working paper was the quietest thing in the row
                and should have been the loudest. */}
            {eff === 'Not tested' ? (
              <>
                <button onClick={() => setDesignPoint(control.id, point.id, 'Pass')} title="Mark this check passed" aria-label="Mark this check passed"
                  className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-canvas-border bg-canvas-elevated text-ink-500 hover:border-compliant-300 hover:text-compliant-700 transition-colors cursor-pointer">
                  <Check size={13} />
                </button>
                <button onClick={() => setDesignPoint(control.id, point.id, 'Fail')} title="Mark this check failed" aria-label="Mark this check failed"
                  className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-canvas-border bg-canvas-elevated text-ink-500 hover:border-risk-300 hover:text-risk-700 transition-colors cursor-pointer">
                  <X size={13} />
                </button>
              </>
            ) : (
              <button onClick={() => setOver(o => !o)}
                title={point.override ? 'Take the override off and go back to what was found' : `Record why this check ${eff === 'Pass' ? 'fails' : 'passes'} after all`}
                className={cn('h-7 px-2.5 inline-flex items-center rounded-md border text-[0.75rem] font-semibold transition-colors cursor-pointer',
                  point.override ? 'bg-high-50 border-high-300 text-high-700 hover:bg-high-100' : 'border-canvas-border bg-canvas-elevated text-ink-600 hover:border-high-300 hover:text-high-700')}>
                {point.override ? 'Remove override' : 'Override'}
              </button>
            )}
            {/* PARKED (18 Sep, user ask) — the bin. A design check comes from the
                RACM and is part of what the control was tested against; deleting
                one mid-test rewrites the question after the answer. Failing it,
                or overriding it with a reason, is the way to disagree.
                `removeDesignPoint` is left on the store, so restoring it is:
                <button onClick={() => removeDesignPoint(control.id, point.id)} title="Remove" aria-label="Remove" className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-canvas-border bg-canvas-elevated text-ink-400 hover:border-risk-300 hover:text-risk-600 cursor-pointer"><Trash2 size={12} /></button> */}
          </div>
        )}
      </div>
      {over && (point.override
        ? <div className="mt-2 flex justify-end"><button onClick={() => { overrideDesignPoint(control.id, point.id, null); setOver(false); }} className="h-7 px-3 text-[0.75rem] font-semibold rounded-lg border border-canvas-border text-ink-600 hover:text-ink-900 inline-flex items-center gap-1.5 cursor-pointer"><RotateCcw size={12} /> Remove override</button></div>
        // The title names what is being contradicted, because that is the
        // question the reviewer will ask first.
        : <InlineWhy target={flipTo} iraSaid={iraVerdict} onCancel={() => setOver(false)}
            onSave={(n, ev) => { overrideDesignPoint(control.id, point.id, { result: flipTo, by: me, at: 'just now', rationale: n, evidence: ev }); setOver(false); }} />)}
    </div>
  );
}

// ── key control — a judgement, so it is set here rather than displayed ────────────
// Key/non-key cannot come from an SOP; it is agreed with management. The reviewer
// asked for it to be editable at every control level. Only the auditor sets it,
// and a concluded control refuses the patch — so the switch shows itself shut
// rather than accepting a click that changes nothing.
export function KeyControlChip({ control, canEdit }: { control: Control; canEdit: boolean }) {
  const { eng, role, updateControlMeta } = useIcfr();
  const logEvent = useAuditLog();
  const locked = isControlLockedIn(eng, control);
  const settable = canEdit && role === 'auditor';
  if (!settable) return control.isKey ? <Pill tone="mitigated">Key control</Pill> : null;
  return (
    <button disabled={locked}
      title={locked ? 'The control is concluded — reopen it to change the key judgement'
        : control.isKey ? 'Key control, agreed with management — click to make it non-key'
        : 'Non-key control — click to mark it key'}
      onClick={() => { updateControlMeta(control.id, { isKey: !control.isKey }); logEvent({ action: 'Update', description: `${control.isKey ? 'Unmarked' : 'Marked'} ${control.id} as a key control`, module: 'SOX ICFR', entity: 'Control' }); }}
      className={cn('inline-flex items-center gap-1 h-5.5 px-2 rounded-full border text-[0.6875rem] font-semibold transition-colors',
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
            <div className="text-[0.8125rem] font-semibold text-ink-800">Walkthrough not started</div>
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
        <h5 className="text-[0.8125rem] font-bold text-ink-700 inline-flex items-center gap-1.5">
          <Footprints size={14} /> Walkthrough
          <span className="font-normal text-ink-400">· one transaction, the same attributes the sample tests</span>
        </h5>
        <span className="inline-flex items-center gap-1.5">
          <span className="text-[0.6875rem] font-semibold text-ink-500 bg-paper-50/70 border border-canvas-border rounded px-1.5 h-4.5 inline-flex items-center">{w.sampleRef}</span>
          {steps.length > 0 && <Pill tone={failed > 0 ? 'risk' : tested === steps.length ? 'compliant' : 'draft'}>{tested}/{steps.length} attributes</Pill>}
        </span>
      </div>

      {/* who walked it, when, and who was in the room — captured once, printed once */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
        <label className="block">
          <span className="text-[0.6875rem] font-bold uppercase tracking-wide text-ink-400">Performed by</span>
          <input value={w.tester} disabled={!canEdit} onChange={e => setWalkthroughMeta(control.id, { tester: e.target.value })}
            className="mt-0.5 w-full h-8 px-2.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.75rem] text-ink-800 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-brand-200" />
        </label>
        <label className="block">
          <span className="text-[0.6875rem] font-bold uppercase tracking-wide text-ink-400">Date walked</span>
          <input value={w.date} disabled={!canEdit} onChange={e => setWalkthroughMeta(control.id, { date: e.target.value })}
            className="mt-0.5 w-full h-8 px-2.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.75rem] text-ink-800 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-brand-200" />
        </label>
      </div>
      <div className="mb-3">
        <span className="text-[0.6875rem] font-bold uppercase tracking-wide text-ink-400">Attended by (client)</span>
        <div className="flex items-center gap-1.5 flex-wrap mt-1">
          {w.attendees.map(a => (
            <span key={a} className="inline-flex items-center gap-1 text-[0.6875rem] font-medium text-ink-700 bg-paper-50/70 border border-canvas-border rounded px-1.5 h-5">
              <UserCheck size={9} className="shrink-0" />{a}
              {canEdit && <button onClick={() => setWalkthroughMeta(control.id, { attendees: w.attendees.filter(x => x !== a) })} aria-label={`Remove ${a}`} className="text-ink-400 hover:text-risk-600 cursor-pointer"><X size={9} /></button>}
            </span>
          ))}
          {canEdit && (
            <input value={attendee} onChange={e => setAttendee(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && attendee.trim()) { setWalkthroughMeta(control.id, { attendees: [...w.attendees, attendee.trim()] }); setAttendee(''); } }}
              placeholder={w.attendees.length ? 'Add another…' : 'Name · role, then Enter'} aria-label="Add an attendee"
              className="h-5.5 px-2 w-42.5 rounded border border-canvas-border bg-canvas-elevated text-[0.6875rem] focus:outline-none focus:ring-2 focus:ring-brand-200" />
          )}
          {!canEdit && w.attendees.length === 0 && <span className="text-[0.6875rem] text-ink-400">Not recorded</span>}
        </div>
      </div>

      {/* the attributes — the same list the sample will test */}
      {steps.length === 0 ? (
        <div className="text-[0.75rem] text-mitigated-700 bg-mitigated-50/60 border border-mitigated-200 rounded-lg px-3 py-2 flex items-start gap-1.5">
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
                  <span className="text-[0.6875rem] text-ink-400 ml-1.5">({[s.code, s.assertion].filter(Boolean).join(' · ')})</span>
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
          <input aria-label="New attribute" autoFocus value={newAttr} onChange={e => setNewAttr(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') { setAddingAttr(false); setNewAttr(''); }
              if (e.key === 'Enter' && newAttr.trim()) { addAttribute(control.id, newAttr.trim()); logEvent({ action: 'Create', description: `Added test attribute to ${control.id}`, module: 'SOX ICFR', entity: 'Control' }); setNewAttr(''); setAddingAttr(false); }
            }}
            placeholder="e.g. Approval evidenced before the transaction posts"
            className="flex-1 h-8 px-3 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.75rem] focus:outline-none focus:ring-2 focus:ring-brand-200" />
          <button disabled={!newAttr.trim()} onClick={() => { addAttribute(control.id, newAttr.trim()); logEvent({ action: 'Create', description: `Added test attribute to ${control.id}`, module: 'SOX ICFR', entity: 'Control' }); setNewAttr(''); setAddingAttr(false); }}
            className="h-8 px-3 rounded-lg bg-brand-600 text-white text-[0.75rem] font-semibold disabled:opacity-40 cursor-pointer">Add</button>
        </div>
      ) : (
        <button onClick={() => setAddingAttr(true)} className="mt-2 h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md border border-canvas-border bg-canvas-elevated text-[0.75rem] font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-700 cursor-pointer"><Plus size={12} /> Add attribute</button>
      ))}

      <label className="block mt-3">
        <span className="text-[0.6875rem] font-bold uppercase tracking-wide text-ink-400">What the walkthrough showed</span>
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
// ── operating attribute — its required files + AI validation, and/or self-attestation ─
function AttributeRow({ control, step, canEdit, testing }: { control: Control; step: OperatingStep; canEdit: boolean; testing: boolean }) {
  const iraMode = useIraMode();
  const { eng, me, role, confirmIra, setStepResult, overrideStep, attestStep, addStepEvidence, uploadRequiredFile, clearRequiredFile, toggleStepAttest, runStepValidation } = useIcfr();
  const logEvent = useAuditLog();
  const [over, setOver] = useState(false);
  const [noteDraft, setNoteDraft] = useState(step.attestation?.note ?? '');
  const [validatingWf, setValidatingWf] = useState(false);
  const openDetail = useOpenRailDetail();
  const seeWorking = () => step.validation && openDetail({ kind: 'working', title: `${step.code} · ${step.description}`, validation: step.validation, control, step, confKey: `${control.id}:${step.id}`, home: sampleHome(eng, a => auditCovers(a, control, eng.id)) });
  const eff = stepResult(step);
  const att = step.attestation;
  const attestOn = step.attestEnabled ?? !!att;   // section 2 — separate toggle, default off (on if already attested)
  const overruled = attestationOverruled(step);   // the file and the attester disagree — the file wins, and says so
  const wordAlone = restsOnStatementAlone(step);  // attested, with nothing behind it — cannot carry an effective conclusion
  // section 1 — the files this attribute is proven against. AI validation reads
  // all of them, so it waits until every line on the checklist has its upload.
  const reqFiles = requiredFilesOf(step, control);
  const { uploaded, total } = requiredFilesCount(step, control);
  const ready = requiredFilesReady(step, control);
  const busy = testing || validatingWf;
  // Any run on this control — the chat's included — holds this button too.
  const liveRun = useControlRun(control.id);
  // Stop in the Ira tab ends the shared run at once; the page's own clock
  // used to keep saying "checking…" until its timer ran out (click-through, 5 Oct).
  useEffect(() => { if (validatingWf && !liveRun) setValidatingWf(false); }, [validatingWf, liveRun]);
  // One word for who reached this attribute's answer (agentic UI review #1).
  const rowState = iraStateOfStep(step, control.operating.conclusion !== 'Not tested');
  const conf = !step.override && step.validation?.result && step.validation.result === eff
    ? confidenceOf(step.validation, `${control.id}:${step.id}`) : undefined;
  // The "why?" line (review #8): open with the result the attribute would move
  // TO. Going against Ira's own verdict opens it; so does the tick and the pencil.
  const [why, setWhy] = useState<'Pass' | 'Fail' | null>(null);
  const iraVerdict = step.validation?.result === 'Pass' || step.validation?.result === 'Fail' ? step.validation.result : undefined;
  const run = runInfo(step.validation, control.operating);
  // One attribute's own run — narrated in the rail like every other, and named
  // so the reader can tell it from the one that reads them all.
  const runAI = () => {
    setValidatingWf(true);
    const t = startRun(control.id, `Reading the files behind attribute ${step.code}`, TOE_RUN_STEPS, 4000, true);
    // A Stop in the Ira tab (UX #15) ends the run; its result is then dropped.
    window.setTimeout(() => { const live = runIsLive(control.id, t); endRun(control.id); setValidatingWf(false); if (live) runStepValidation(control.id, step.id); }, 4000);
  };

  // The per-attribute file checklist and its "upload several" pile left this
  // row (agentic UI review #5, 30 Sep): the same file was listed once per
  // attribute that needs it. Every file is listed ONCE now, above the
  // attributes, in ToeFiles — each line says which attributes it serves.

  // No Pass without the evidence (17 Sep dev call) — the Pass button, an
  // override and an attestation all wait for every required file. Fail never does.
  const passLock = ready ? undefined : `Upload all ${total} required files first`;
  const resultBtn = (target: TestResult, label: string, Icon: typeof CheckCircle2, on: boolean, tone: string) => {
    const locked = target === 'Pass' && !ready;
    return (
      <button onClick={() => {
          // Contradicting what Ira found is an override, and an override says why.
          if (iraVerdict && !step.override && target !== eff && (target === 'Pass' || target === 'Fail')) { setOver(false); setWhy(target); return; }
          setStepResult(control.id, step.id, target);
        }} disabled={locked} title={locked ? passLock : undefined}
        className={cn('h-8 px-2.5 inline-flex items-center gap-1 rounded-lg border text-[0.75rem] font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed', on ? tone : 'border-canvas-border bg-canvas-elevated text-ink-600 enabled:hover:border-ink-300 enabled:hover:text-ink-900')}>{locked ? <Lock size={12} /> : <Icon size={13} />}{label}</button>
    );
  };

  return (
    <div id={`step-${step.id}`} className={cn('step-row scroll-mt-4', eff === 'Fail' && 'fail', eff === 'Pass' && 'pass')}>
      <div className="flex items-start gap-3.5">
        {canEdit && eff !== 'Not tested' && !step.override
          ? <button onClick={() => { setOver(false); setWhy(eff === 'Pass' ? 'Fail' : 'Pass'); }} aria-label={`Change this result to ${eff === 'Pass' ? 'fail' : 'pass'} — say why`} className="shrink-0 rounded cursor-pointer hover:opacity-80"><Tickmark result={eff} size={22} confidence={conf} title={tickTitle(conf, run)} /></button>
          : <Tickmark result={eff} size={22} confidence={conf} blocked={!!step.validation?.blocked && eff === 'Not tested'} title={tickTitle(conf, run)} />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[0.6875rem] font-bold text-ink-500">{step.code}</span>
            <span className="text-[0.8125rem] font-semibold text-ink-900">{step.description}</span>
            {rowState && <IraState state={rowState} title={rowState === 'review' ? run : rowState === 'couldnt' ? step.validation?.blocked : undefined} />}
          </div>
          <div className="text-[0.6875rem] text-ink-400 mt-1">{[step.assertion, step.precision, step.procedures.join(' / ')].filter(Boolean).join(' · ')}</div>
          {step.override && <div className="text-[0.6875rem] text-high-700 mt-1.5 flex items-start gap-1"><CornerDownRight size={11} className="mt-0.5 shrink-0" /> {step.override.rationale}{step.override.evidence && <span className="text-ink-500"> · <Paperclip size={9} className="inline -mt-0.5" /> {step.override.evidence}</span>} <span className="text-ink-400">— {step.override.by}</span></div>}
        </div>
        {canEdit && (
          <div className="flex items-center gap-1.5 shrink-0">
            {role === 'auditor' && control.operating.conclusion === 'Not tested' && awaitsConfirm(step) && (
              <button onClick={() => confirmIra(control.id, 'operating', [step.id])}
                className="h-8 px-2.5 inline-flex items-center rounded-lg border border-brand-200 bg-brand-50 text-[0.75rem] font-semibold text-brand-700 hover:bg-brand-100 cursor-pointer">Confirm</button>
            )}
            {resultBtn('Pass', 'Pass', CheckCircle2, eff === 'Pass', 'bg-compliant-50 border-compliant-300 text-compliant-700')}
            {resultBtn('Fail', 'Fail', XCircle, eff === 'Fail', 'bg-risk-50 border-risk-300 text-risk-700')}
            <button onClick={() => { if (step.override) { setWhy(null); setOver(o => !o); } else setWhy(w => w ? null : eff === 'Pass' ? 'Fail' : 'Pass'); }} title={step.override ? 'Remove the override' : 'Override result — say why'} aria-label={step.override ? 'Remove the override' : 'Override result — say why'} className={cn('h-8 w-8 inline-flex items-center justify-center rounded-lg border cursor-pointer', step.override ? 'bg-high-50 border-high-300 text-high-700' : 'border-canvas-border bg-canvas-elevated text-ink-600 hover:border-high-300 hover:text-high-700')}><Pencil size={13} /></button>
            {/* PARKED (22 Sep, user ask) — the bin, for the same reason the
                design check lost its own: an attribute comes from the RACM and
                is part of what every sampled item was tested against. Deleting
                one mid-test rewrites the question after the answer, and the
                sample was drawn to cover it. Failing it, or overriding it with
                a reason, is the way to disagree. `removeAttribute` stays on the
                store; the attribute list itself is edited on the engagement
                control page, which is where adding one happens too. */}
          </div>
        )}
      </div>

      {/* evidence — Section 1: required files + AI validation · Section 2: self-attest (separate) */}
      <div className="mt-3 ml-9 space-y-2">
        <div className="rounded-lg border border-canvas-border px-3 py-2.5">
          <div className="mb-2">
            <span className="text-[0.6875rem] font-bold text-ink-600">AI validation</span>
          </div>
          {/* The recorded run was made over a draw that no longer exists — the
              sample changed underneath it. Results that predate the sample were
              not testing these items, so the run is stale and the operating
              track refuses to conclude until it is re-run (or re-attested). */}
          {step.staleRun && (
            <p className="mb-1.5 text-[0.75rem] leading-snug" title="This run predates the current draw — the items it tested are no longer the sample. Re-run it before the operating test can conclude.">
              <span className="font-semibold text-mitigated-800">Re-run needed</span> <span className="text-ink-500">— the sample changed since this ran.</span>
            </p>
          )}
          <div className="rounded-md bg-brand-50/30 border border-brand-100 px-2.5 py-2.5 space-y-2">
            {/* What this attribute reads — named, not listed again: the files
                themselves are uploaded once, in the Files list above. */}
            <p className="text-[0.6875rem] text-ink-500">
              {total === 0 ? 'No required files listed — add them on the engagement control page.'
                : <>Reads {reqFiles.map(f => f.label).join(', ')} · <span className={cn('tabular-nums', ready ? 'text-compliant-700' : 'text-ink-600')}>{uploaded} of {total} in</span></>}
            </p>
            {/* run + result */}
            <div className="flex items-center gap-2.5 flex-wrap pt-2 border-t border-brand-100/70">
              <Sparkles size={14} className="text-brand-600 shrink-0" />
              <span className="text-[0.75rem] text-ink-600 flex-1 min-w-0">Ira · <span className="text-ink-400">{busy ? 'checking…' : (step.validation ? 'checked the files' : 'not run yet')}</span></span>
              {/* the verdict lives on the attribute's tickmark above — repeating
                  it here said the same thing twice */}
              {/* Manual only (Stage 1a) — in Automatic, Ira runs from its plan's Start. */}
              {canEdit && !busy && iraMode === 'manual' && (
                <button onClick={runAI} disabled={!ready || !!liveRun} title={liveRun ? busyNote(liveRun) : ready ? undefined : total > 0 ? `Upload all ${total} required files first` : 'No required files listed for this attribute'} className="h-7 px-2.5 rounded-md bg-brand-600 text-white text-[0.75rem] font-semibold enabled:hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5 transition-colors cursor-pointer"><Sparkles size={12} /> {step.validation ? 'Re-run' : 'Run AI validation'}</button>)}
              {step.validation && <button onClick={seeWorking} className="text-[0.75rem] font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800 inline-flex items-center gap-1 cursor-pointer"><ListChecks size={12} /> See the working</button>}
            </div>
            {validatingWf && <RunLine files={uploaded} total={1} noun="attribute" label={`attribute ${step.code}`} ms={4000} />}
            {step.validation?.summary && !validatingWf && <p className="text-[0.75rem] text-ink-600 leading-snug cursor-help" title={step.validation.qa.map(x => `${x.pass ? '✓' : '✗'} ${x.q} — ${x.a}`).join('\n')}>{step.validation.summary}</p>}
            {/* only for a list that exists — an empty one already says where to add files */}
            {canEdit && !ready && total > 0 && <p className="text-[0.6875rem] text-mitigated-700 inline-flex items-center gap-1"><AlertTriangle size={10} /> Upload every required file to pass this attribute or run AI validation — {uploaded} of {total} in.</p>}
          </div>
        </div>

        <div className="rounded-lg border border-canvas-border px-3 py-2.5">
          <div className="flex items-center gap-2 text-[0.6875rem] font-bold text-ink-600"><Hand size={12} /> Self-attestation <span className="font-normal text-ink-400">· manual pass / fail</span>
            {canEdit && <span className="ml-auto"><Toggle on={attestOn} onChange={v => toggleStepAttest(control.id, step.id, v)} label="Toggle self-attestation" /></span>}
          </div>
          {attestOn && <>
            {att?.result && (
              <div className="mt-2 flex items-center gap-2 flex-wrap text-[0.6875rem]">
                <span className={cn('inline-flex items-center gap-1 font-bold', overruled ? 'text-ink-400 line-through decoration-ink-300' : att.result === 'Pass' ? 'text-compliant-700' : 'text-risk-700')}><Tickmark result={att.result} size={13} /> Attested {att.result}</span>
                <span className="text-ink-400">· by <b className="text-ink-600 font-semibold">{att.by}</b>, {att.at}</span>
              </div>
            )}
            {/* The file says the opposite. An attestation is somebody's account of
                what they saw, and it is kept as exactly that — but the attribute
                answers to the evidence, so the validation is the result and this
                says so rather than leaving two verdicts on one card. */}
            {overruled && (
              <p className="mt-2 text-[0.75rem] leading-snug" title={`The validation reached ${step.validation!.result} on this attribute, and it stands — an attestation supports evidence, it does not overrule it. The note above is on the record, but the result is ${step.validation!.result}. To depart from the file, use the auditor's override and say why.`}>
                <span className="font-semibold text-mitigated-800">Validation stands at {step.validation!.result}</span> <span className="text-ink-500">— the attestation doesn't overrule it.</span>
              </p>
            )}
            {/* Inquiry. The attester wrote what they saw and attached nothing,
                and nothing was validated behind them — so the whole of the
                evidence is the sentence above. Said here rather than only at the
                conclusion, because the fix belongs on this card: attach what the
                visit produced, or run the validation. */}
            {wordAlone && (
              <p className="mt-2 text-[0.75rem] leading-snug" title="This attribute rests on the statement alone — nothing was attached and nothing was validated behind it. An attribute proven by inquiry is not tested, so the control cannot be concluded effective while it stands. Attach what was inspected, or run the validation.">
                <span className="font-semibold text-mitigated-800">Statement only</span> <span className="text-ink-500">— nothing attached or validated, so this can't pass.</span>
              </p>
            )}
            {att?.note && <p className="text-[0.75rem] text-ink-700 mt-1.5 italic">“{att.note}”</p>}
            {att && att.evidence.length > 0 && <div className="flex flex-wrap gap-1.5 mt-2">{att.evidence.map(f => <span key={f.id} className="inline-flex items-center gap-1 text-[0.6875rem] font-semibold text-ink-600 bg-paper-50 border border-canvas-border rounded-md px-1.5 h-5"><Paperclip size={9} />{f.name}</span>)}</div>}
            {canEdit && (
              <div className="mt-2">
                <textarea value={noteDraft} onChange={e => setNoteDraft(e.target.value)} rows={2} placeholder="Describe how this attribute is satisfied — recorded with your attestation." className="w-full text-[0.75rem] rounded-lg border border-canvas-border bg-canvas-elevated px-2.5 py-2 text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-200 resize-none" />
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="text-[0.6875rem] font-semibold text-ink-400 uppercase tracking-wide">Attest</span>
                  <button disabled={!noteDraft.trim() || !ready} title={passLock} onClick={() => { attestStep(control.id, step.id, noteDraft.trim(), 'Pass'); logEvent({ action: 'Update', description: `Attested ${step.code} for ${control.id}`, module: 'SOX ICFR', entity: 'Test Result' }); }} className="h-7 px-2.5 rounded-md bg-compliant-600 text-white text-[0.75rem] font-semibold disabled:opacity-40 enabled:hover:bg-compliant-700 inline-flex items-center gap-1 cursor-pointer"><CheckCircle2 size={12} /> Pass</button>
                  <button disabled={!noteDraft.trim()} onClick={() => { attestStep(control.id, step.id, noteDraft.trim(), 'Fail'); logEvent({ action: 'Update', description: `Attested ${step.code} for ${control.id}`, module: 'SOX ICFR', entity: 'Test Result' }); }} className="h-7 px-2.5 rounded-md border border-risk-300 text-risk-700 text-[0.75rem] font-semibold disabled:opacity-40 enabled:hover:bg-risk-50 inline-flex items-center gap-1 cursor-pointer"><XCircle size={12} /> Fail</button>
                  <button onClick={() => { addStepEvidence(control.id, step.id, `evidence-${step.code}.pdf`); logEvent({ action: 'Upload', description: `Attached evidence to attribute ${step.code} (${control.id})`, module: 'SOX ICFR', entity: 'Evidence' }); }} className="h-7 px-2.5 rounded-md border border-canvas-border bg-canvas-elevated text-ink-600 text-[0.75rem] font-semibold hover:border-brand-300 hover:text-brand-700 inline-flex items-center gap-1 cursor-pointer"><Upload size={11} /> Attach evidence</button>
                </div>
              </div>
            )}
          </>}
        </div>
      </div>

      {over && (step.override
        ? <div className="mt-2 flex justify-end"><button onClick={() => { overrideStep(control.id, step.id, null); setOver(false); }} className="h-7 px-3 text-[0.75rem] font-semibold rounded-lg border border-canvas-border text-ink-600 hover:text-ink-900 inline-flex items-center gap-1.5 cursor-pointer"><RotateCcw size={12} /> Remove override</button></div>
        : null)}
      {why && !step.override && (
        <InlineWhy target={why} iraSaid={iraVerdict} onCancel={() => setWhy(null)}
          onSave={(n, ev) => { overrideStep(control.id, step.id, { result: why, by: me, at: 'just now', rationale: n, evidence: ev }); setWhy(null); }} />
      )}
    </div>
  );
}

// ── TOE attributes, folded (user pick, 1 Oct) ─────────────────────────────────
/** An attribute in one line: its tick, code, description, Ira's mark and how
 *  many of its files are in. Click to open the full card. */
function CompactAttributeLine({ control, step, onOpen, open }: { control: Control; step: OperatingStep; onOpen: () => void; open?: boolean }) {
  const eff = stepResult(step);
  const state = iraStateOfStep(step, control.operating.conclusion !== 'Not tested');
  const conf = !step.override && step.validation?.result && step.validation.result === eff
    ? confidenceOf(step.validation, `${control.id}:${step.id}`) : undefined;
  const { uploaded, total } = requiredFilesCount(step, control);
  const run = runInfo(step.validation, control.operating);
  return (
    <button id={`step-${step.id}`} onClick={onOpen} aria-expanded={open}
      className="scroll-mt-4 w-full text-left flex items-center gap-2.5 rounded-lg border border-canvas-border bg-canvas-elevated px-3 py-2 hover:border-ink-300 transition-colors cursor-pointer">
      <Tickmark result={eff} size={18} confidence={conf} blocked={!!step.validation?.blocked && eff === 'Not tested'} title={tickTitle(conf, run)} />
      <span className="font-mono text-[0.6875rem] font-bold text-ink-500 shrink-0">{step.code}</span>
      <span className="text-[0.8125rem] font-medium text-ink-900 truncate min-w-0 flex-1">{step.description}</span>
      {state && <IraState state={state} title={state === 'review' ? run : state === 'couldnt' ? step.validation?.blocked : undefined} />}
      {total > 0 && <span className="text-[0.6875rem] text-ink-400 tabular-nums shrink-0">{uploaded}/{total} files</span>}
      {open !== undefined && (open ? <ChevronUp size={13} className="text-ink-400 shrink-0" /> : <ChevronDown size={13} className="text-ink-400 shrink-0" />)}
    </button>
  );
}

/** The attribute card, folded to its line until opened. */
function FoldableAttribute({ control, step, canEdit, testing }: { control: Control; step: OperatingStep; canEdit: boolean; testing: boolean }) {
  const [open, setOpen] = useState(false);
  if (!open) return <CompactAttributeLine control={control} step={step} open={false} onOpen={() => setOpen(true)} />;
  return (
    <div className="space-y-1">
      <button onClick={() => setOpen(false)} aria-expanded
        className="inline-flex items-center gap-1 text-[0.6875rem] font-semibold text-ink-500 hover:text-ink-800 cursor-pointer"><ChevronUp size={12} /> Fold {step.code}</button>
      <AttributeRow control={control} step={step} canEdit={canEdit} testing={testing} />
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
  // level before one is drawn. The same counting rule runs at engagement level
  // as Sample testing, and both are wanted: the register answer says how much
  // testing ground is covered, this one says where the shortfall sits.
  const steps = c.operating.steps;
  const samples = c.operating.sampling?.samples ?? [];
  const toeTotal = samples.length ? samples.length * steps.length : steps.length;
  // A SETTLED attribute counts whole (23 Sep). Counting only the per-item marks
  // made this meter stricter than the rule the product actually enforces:
  // `concludeOperating` gates on `stepResult(s) === 'Not tested'` — attribute
  // level, never cell level — so a control could be concluded, signed and closed
  // and still read 0% here. 32 of the 40 concluded controls in the seed did
  // exactly that, printing a red nought on the same line as "TOE effective".
  //
  // Two readings of one fact are allowed to differ in precision; they are not
  // allowed to disagree. So: an attribute that is settled has been run across
  // the draw, by whichever route settled it, and one still open counts the items
  // actually marked — which is the progress reading, and the only place a
  // part-done attribute has anything to say.
  const toeDone = samples.length
    ? steps.reduce((n, s) => n + (stepResult(s) !== 'Not tested'
      ? samples.length
      : samples.filter(smp => { const r = s.sampleResults?.[smp.id]; return r && r !== 'Not tested'; }).length), 0)
    // stepResult, not the raw result: an attribute settled by override IS
    // settled, and a meter that says otherwise contradicts the row above it.
    : steps.filter(s => stepResult(s) !== 'Not tested').length;
  return [
    {
      // Optional elements are out of the denominator entirely, and a WAIVED
      // element counts as done — a recorded judgement with a mandatory reason is
      // not a missing file. This one gates: below 100% the TOD conclusion is
      // locked, and the lock names how many are still outstanding.
      label: 'Control completeness', short: 'Elements', pct: comp.pct, detail: `${comp.done}/${comp.total} required elements evidenced`, gate: true,
      empty: comp.total === 0,
      formula: 'required elements evidenced or waived ÷ required elements × 100',
    },
    {
      // A check is one sample × attribute CELL, not an attribute — 25 items
      // against 3 attributes is 75 checks. Before a sample is drawn it counts at
      // attribute level so the denominator is never zero mid-testing, and any
      // result other than "not tested" counts as run. Held to 100%: part-tested
      // is not tested.
      label: 'Evidence validated', short: 'Evidence', pct: toeTotal ? Math.round((toeDone / toeTotal) * 100) : 0, detail: `${toeDone}/${toeTotal} operating checks run`, gate: true,
      empty: toeTotal === 0,
      formula: 'operating checks run ÷ operating checks total × 100',
    },
    {
      // An overridden pass counts as a pass — the auditor's recorded judgement is
      // the answer. Not-yet-tested drags this down exactly as hard as failed: an
      // untested check gives no confidence either way. The only QUALITY measure
      // of the three, which is why it gates nothing on its own.
      label: 'Design coverage confidence', short: 'Coverage', pct: points.length ? Math.round((passed / points.length) * 100) : 0, detail: `${passed}/${points.length} considerations pass`,
      empty: points.length === 0,
      formula: 'design considerations passing ÷ all design considerations × 100',
    },
  ];
}

// ── one evidence file, opened (S6, A19) ─────────────────────────────────────────────
/** A file's type as its name says it — 'PDF', 'DOCX'. Read off the name rather than
 *  `kind`, which has no word for a Word file and files one under PDF. */
function fileTypeOf(f: EvidenceFile): string {
  const m = /\.([a-z0-9]+)$/i.exec(f.name);
  return m ? m[1].toUpperCase() : f.kind;
}

/** Only a file picked off this machine in this session carries bytes (`url`). A
 *  sample file has a name and a record but nothing to show, and the modal says so
 *  plainly rather than drawing a page that isn't there. */
function EvidencePreviewModal({ file, element, onClose }: { file: EvidenceFile; element: string; onClose: () => void }) {
  const type = fileTypeOf(file);
  const isPdf = type === 'PDF';
  const isImage = file.kind === 'IMG' || ['PNG', 'JPG', 'JPEG', 'GIF', 'WEBP'].includes(type);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <motion.div className="modal modal-wide" role="dialog" aria-modal="true" aria-label={`Preview of ${file.name}`} onClick={e => e.stopPropagation()} initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }}><DialogFocus />
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-canvas-border">
          <div className="flex items-center gap-2 min-w-0"><FileText size={16} className="text-brand-600 shrink-0" /><h3 className="text-[0.875rem] font-bold text-ink-900 truncate" title={file.name}>{file.name}</h3></div>
          <button onClick={onClose} aria-label="Close" className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-lg text-ink-400 hover:text-ink-800 hover:bg-paper-50 cursor-pointer"><X size={16} /></button>
        </div>
        <div className="px-5 py-2.5 border-b border-canvas-border bg-paper-50/40 text-[0.75rem] text-ink-600 flex items-center gap-x-2 gap-y-1 flex-wrap">
          <span className="font-mono text-[0.6875rem] font-semibold text-ink-600 bg-canvas-elevated border border-canvas-border rounded-md px-1.5 h-5 inline-flex items-center">{type}</span>
          <span><b className="text-ink-800">{element}</b></span>
          <span className="text-ink-300">·</span>
          <span>Uploaded by {file.uploadedBy}{file.uploadedAt ? ` · ${file.uploadedAt}` : ''}</span>
        </div>
        <div className="px-5 py-4 max-h-[70vh] overflow-auto">
          {!file.url ? (
            <p className="text-[0.8125rem] text-ink-500 leading-relaxed">A preview isn’t available for sample files in this prototype.</p>
          ) : isPdf ? (
            <iframe src={file.url} title={file.name} className="w-full h-[62vh] rounded-lg border border-canvas-border bg-paper-50" />
          ) : isImage ? (
            <img src={file.url} alt={file.name} className="block max-w-full max-h-[62vh] mx-auto rounded-lg border border-canvas-border" />
          ) : (
            <p className="text-[0.8125rem] text-ink-500 leading-relaxed">{type} files can’t be shown here. The file is attached to {element} all the same.</p>
          )}
        </div>
        <div className="flex items-center justify-end px-5 py-3.5 border-t border-canvas-border">
          <button onClick={onClose} className="h-9 px-4 rounded-lg bg-brand-600 text-white text-[0.8125rem] font-semibold hover:bg-brand-700 cursor-pointer">Close</button>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}

// ── design section (TOD) ──────────────────────────────────────────────────────────
/** A custom element is titled by its name; the standard ones by their kind. */
function docLabel(doc: DesignDoc): string { return doc.kind === 'Custom' ? doc.name : doc.kind; }
// PARKED (S6, C7) — the invented file name the old 900ms "upload" attached. The
// Attach evidence button now opens a real file picker and keeps each file's own
// name, so nothing calls these; left in place in case a seeded demo wants them.
const EVIDENCE_EXT: Partial<Record<DesignDocKind, string>> = { 'Precision & thresholds': 'xlsx', 'Segregation of duties': 'xlsx' };
function evidenceFileName(label: string, wpRef: string, kind: DesignDocKind): string {
  return `${label.replace(/[^A-Za-z0-9]+/g, '_')}_${wpRef}_FY26.${EVIDENCE_EXT[kind] ?? 'pdf'}`;
}

function DesignSection({ control, canEdit: canEditIn, locked = false }: { control: Control; canEdit: boolean;
  /** The reviewer has approved this TOD. The step is read-only from then on —
   *  evidence, checks and the conclusion all stand as approved. Reopening it
   *  goes through the reviewer's own send-back, which is the door that already
   *  exists for it (`returnDesign`). */
  locked?: boolean }) {
  const { role, me, confirmIra, addDesignDoc, attachDesignEvidence, removeDesignFile, waiveDesignDoc, clearDesignWaiver, addDesignPoint, setDesignPoint, validateDesignPoint, runDesignIra } = useIcfr();
  // The owner keeps the evidence lane and loses the testing lane — see the note
  // on the dossier's own canEdit / canTest split.
  const isOwner = role === 'risk-owner';
  const canEdit = canEditIn && !locked;
  // The footer still RENDERS once approved — its buttons go dead with a reason
  // beside them, which is what says "approved, and here is how to change it".
  // Dropping it would leave the step ending in silence.
  const canTest = canEditIn && role === 'auditor';
  const logEvent = useAuditLog();
  const d = control.design;
  const [modal, setModal] = useState(false);
  // which element is being waived — one at a time, same shape as the override form
  const [waiving, setWaiving] = useState<string | null>(null);
  const [newPoint, setNewPoint] = useState('');
  const [addingPoint, setAddingPoint] = useState(false);
  /** Which attribute the check being added belongs to. '' means the control as a
   *  whole — the kind of check that has no single attribute to sit under. */
  const [newPointStep, setNewPointStep] = useState('');
  const [validatingAll, setValidatingAll] = useState(false);
  // One hidden file picker for every element: the button that opens it says which
  // element the chosen files belong to. No "Uploading…" state — the files are on
  // this machine already, so they land the moment they are chosen.
  const filePicker = useRef<HTMLInputElement>(null);
  const pickingFor = useRef<DesignDoc | null>(null);
  const [previewing, setPreviewing] = useState<{ file: EvidenceFile; element: string } | null>(null);
  const [iraRunning, setIraRunning] = useState(false);
  // custom element — named by the auditor, same inline-form shape as Add check
  const [addingCustom, setAddingCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const runValidateAll = () => { setValidatingAll(true); logEvent({ action: 'Run', description: `Validated all design considerations for ${control.id}`, module: 'SOX ICFR', entity: 'Test Result' }); window.setTimeout(() => { control.design.points.forEach(p => validateDesignPoint(control.id, p.id)); setValidatingAll(false); }, VALIDATE_MS); };
  // PARKED (S6, A17) — Pass all / Fail all. The header's one button is now "Run
  // Ira on design checks"; the per-row ✓ / ✗ stay for marking a check by hand.
  // Every check at once, the same call the row buttons make one at a time — so
  // the trail reads identically whether they were marked together or singly.
  const markAll = (result: TestResult) => {
    logEvent({ action: 'Update', description: `Marked every design consideration ${result.toLowerCase()} for ${control.id}`, module: 'SOX ICFR', entity: 'Test Result' });
    control.design.points.forEach(p => setDesignPoint(control.id, p.id, result));
  };
  // Opens the picker for this element. What was chosen comes back to `attachPicked`.
  const attach = (doc: DesignDoc) => {
    pickingFor.current = doc;
    filePicker.current?.click();
  };
  const attachPicked = (list: FileList | null) => {
    const doc = pickingFor.current;
    pickingFor.current = null;
    if (!doc || !list || list.length === 0) return;
    const files = Array.from(list).map(f => ({ name: f.name, kind: evidenceKindOf(f.name), url: URL.createObjectURL(f) }));
    attachDesignEvidence(control.id, doc.id, files);
    logEvent({ action: 'Upload', description: `Attached ${files.map(f => f.name).join(', ')} to the ${docLabel(doc)} design element on ${control.id}`, module: 'SOX ICFR', entity: 'Control' });
  };
  // The auditor can take any file off; the control owner only one they uploaded.
  const canRemoveFile = (f: EvidenceFile) => canEdit && (role === 'auditor' || (isOwner && f.uploadedBy === me));
  const removeFile = (doc: DesignDoc, f: EvidenceFile) => {
    removeDesignFile(control.id, doc.id, f.id);
    logEvent({ action: 'Delete', description: `Removed ${f.name} from the ${docLabel(doc)} design element on ${control.id}`, module: 'SOX ICFR', entity: 'Control' });
  };

  // ── Ira on the design checks (S6, A17) ────────────────────────────────────
  // One button in the checks header, run on the auditor's ask — never on upload.
  // It says why it can't run rather than hiding: no checks, nothing on file, or a
  // concluded TOD. A file coming or going after a run turns it into Re-run.
  const elementsOnFile = d.documents.filter(doc => designFilesOf(doc).length > 0).length;
  // Checks arrive with the RACM and can no longer be written here (18 Sep), so
  // "add one first" would name a door that was taken off its hinges.
  // A required element that is not on file stops the test (user ask, 22 Sep).
  // Ira used to run anyway and fail every check for the same reason — an
  // assessment of the file room, filed as an assessment of the control. The
  // store refuses it now, so this names the reason rather than offering a
  // button that would do nothing. Worded as the thing to do, with the elements
  // named, because "cannot start" without a list sends the reader hunting.
  const iraMissing = designOutstandingRequired(control)
    .map(doc => (doc.kind === 'Custom' ? doc.name : doc.kind));
  const iraBlocked = d.points.length === 0 ? 'This control’s RACM lists no design checks — there is nothing to assess'
    : iraMissing.length > 0 ? `Attach ${iraMissing.join(', ')} first — the design checks are read against the evidence, and that is not on file yet`
    : elementsOnFile === 0 ? 'Upload evidence to a design element first'
    : d.conclusion !== 'Not tested' ? 'TOD is concluded — it has to be reopened or returned before Ira runs again'
    : null;
  const iraStale = !!d.ira?.evidenceChanged;
  // Whatever Ira is running on this control, from whichever door — the chat's
  // runs used to leave this step silent and its button live (double run).
  const liveRun = useControlRun(control.id);
  const chatRun = !iraRunning && runStageOf(liveRun) === 'design' ? liveRun : null;
  // Stopped from the Ira tab: the progress line goes the moment the run does,
  // not when this page's timer runs out (click-through, 5 Oct).
  useEffect(() => { if (iraRunning && !liveRun) setIraRunning(false); }, [iraRunning, liveRun]);
  // Checks the last run read and could not answer. Still Not tested, still
  // holding the conclusion — the count is here so that is visible without
  // opening every row.
  const iraCouldNot = designBlocked(control);  // The button is here; the narration is in the rail (user ask, 22 Sep). The
  // row of checks below already shows each one turning over, so a second
  // progress bar on this side would be the same fact twice — what the rail
  // adds is the sentence that says what is being read and, when it lands, what
  // it found. `true` asks the rail to come forward, since the reader pressed
  // this on the left and would otherwise be watching the wrong column.
  const runIra = () => {
    setIraRunning(true);
    const t = startRun(control.id, 'Reading the evidence against each check', DESIGN_RUN_STEPS, VALIDATE_MS, true);
    logEvent({ action: 'Run', description: `Ran Ira on the design checks for ${control.id}`, module: 'SOX ICFR', entity: 'Test Result' });
    window.setTimeout(() => { const live = runIsLive(control.id, t); endRun(control.id); setIraRunning(false); if (live) runDesignIra(control.id); }, VALIDATE_MS);
  };
  // ── Automatic mode (agentic UX #3, user ask 1 Oct) ─────────────────────────
  // Ira reads the design evidence itself the moment it can — once per state of
  // the evidence, so a Stop or an Undo is not simply re-run over the top — and
  // confirms its own SURE results in the tester's name. The less-sure wait for
  // the tester; the conclusion is never Ira's.
  //
  // Ira's plan you approve (Stage 1a, 2 Oct): none of it moves until Start is
  // pressed on the plan in the Ira tab — in Manual too, where Ira then reads
  // and stops for the tester to confirm. A step taken off the plan is the
  // tester's, and only the ticked checks count towards "due".
  const iraMode = useIraMode();
  const plan = control.iraPlan;
  const planRuns = !!plan?.started && !plan.skipped.includes('design');
  const autoKey = useRef('');
  const autoDue = d.conclusion === 'Not tested' && (iraStale || d.points.some(p => (!plan?.checks || plan.checks.includes(p.id)) && !p.validation && !p.override && pointResult(p) === 'Not tested'));
  useEffect(() => {
    // An undone step waits for Run again on the plan (5 Oct) — Undo is not a cue to re-read.
    if (!planRuns || !canTest || locked || iraRunning || iraBlocked || !autoDue || controlRun(control.id) || iraStepUndone(control.id, 'design')) return;
    const key = `${control.id}|${d.documents.map(x => designFilesOf(x).length).join(',')}|${iraStale}`;
    if (autoKey.current === key) return;
    autoKey.current = key;
    runIra();
  }); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (iraMode !== 'automatic' || !planRuns || !canTest || locked || d.conclusion !== 'Not tested') return;
    const sure = d.points.filter(p => awaitsConfirm(p) && (confidenceOf(p.validation, `${control.id}:${p.id}`) ?? 0) >= CONFIDENT_AT);
    if (sure.length) confirmIra(control.id, 'design', sure.map(p => p.id), { byIra: true });
  }, [iraMode, planRuns, canTest, locked, d.conclusion, d.points, control.id, confirmIra]);
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
      {/* Only the kinds this class of control actually has — offering an ITGC a
          process narrative invites the auditor to file something that will then sit
          on the paper as evidence of a design the control does not work that way. */}
      {DESIGN_DOC_KINDS.filter(k => !docNotApplicable(control, { kind: k })).map(k => <button key={k} role="menuitem" className={menuItem} onClick={() => { addStandard(k); close(); }}><FileText size={12} className="text-brand-600" />{k}</button>)}
      <div className="my-1 border-t border-canvas-border" role="separator" />
      <button role="menuitem" className={menuItem} onClick={() => { setAddingCustom(true); close(); }}><Plus size={12} className="text-brand-600" />Custom…</button>
    </>}</Dropdown>
  );
  const customForm = addingCustom && (
    <div className="rounded-lg border border-brand-200 bg-brand-50/30 p-3 mb-2.5 space-y-2">
      <input autoFocus value={customName} onChange={e => setCustomName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') saveCustom(); if (e.key === 'Escape') setAddingCustom(false); }}
        placeholder="Element name — e.g. Delegation of authority matrix" aria-label="Custom element name"
        className="w-full h-9 px-3 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.8125rem] focus:outline-none focus:ring-2 focus:ring-brand-200" />
      <textarea rows={2} value={customDesc} onChange={e => setCustomDesc(e.target.value)}
        onKeyDown={e => { if (e.key === 'Escape') setAddingCustom(false); }}
        placeholder="Description (optional) — what this element should evidence" aria-label="Custom element description"
        className="w-full px-3 py-2 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.8125rem] resize-none focus:outline-none focus:ring-2 focus:ring-brand-200" />
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
  // the control as built didn't do what it claims on a real transaction. The
  // rule itself now lives in helpers.ts: the chat rail concludes too, and two
  // copies of it would be two products disagreeing about one paper.
  const suggestion: TrackConclusion = designSuggestion(control);
  // Keyed on the CHECKS alone. Documents are now seeded from the class table the
  // moment a control exists, so an empty document list stopped meaning "nobody has
  // set this up" — it broke the deliberately-incomplete RACM row, which showed
  // three "to provide" rows instead of its empty state. What still means nobody
  // has set it up is that the RACM row lists no design checks.
  const empty = d.points.length === 0 && d.documents.every(x => x.status !== 'Received');

  // ── the checks, filed under what they are about (dev call, Aug 2026) ────────
  // Design and operating already test the SAME attributes — see Walkthrough in
  // types.ts, where the attributes are defined once and proven twice. The checks
  // were the one part of TOD that sat outside them, so they are grouped here:
  // the control-level ones first (does it address the risk, at what precision),
  // then one group per attribute (is THIS thing designed to happen).
  //
  // A check whose stepId names an attribute that no longer exists falls to the
  // control-level group rather than disappearing — a check nobody can see is a
  // check nobody can answer, and the conclusion still counts it.
  const steps = control.operating.steps;
  const stepIds = new Set(steps.map(s => s.id));
  const controlChecks = d.points.filter(p => !p.stepId || !stepIds.has(p.stepId));
  const stepChecks = steps.map(s => ({ step: s, points: d.points.filter(p => p.stepId === s.id) })).filter(g => g.points.length > 0);

  return (
    <div className="p-5">
      {empty && !addingCustom ? (
        <EmptyState icon={<FileText size={18} />} title="TOD isn’t set up yet" hint="Add the design elements this control is evidenced by — process narrative, flowchart, walkthrough, precision &amp; thresholds. The design checks come from its RACM.">
          {canEdit && addElementMenu}
        </EmptyState>
      ) : (
        <>
          {/* design elements — each one evidenced by attached files */}
          <div className="flex items-center justify-between mb-2.5">
            <h4 className="text-[0.8125rem] font-bold text-ink-700 inline-flex items-center gap-1.5"><FileText size={14} /> Design elements &amp; evidence</h4>
            <div className="flex items-center gap-2">
              {/* PARKED (18 Sep, user ask) — Request data. The email request lives
                  on the TOE population step, where the file that is actually
                  chased is asked for; `setModal` and `RequestDataModal` are left
                  in place, so restoring it is:
                  <button onClick={() => setModal(true)} className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md border border-canvas-border bg-canvas-elevated text-[0.75rem] font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-700 cursor-pointer"><Mail size={12} /> Request data</button> */}
              {canEdit && addElementMenu}
            </div>
          </div>
          {customForm}
          {d.documents.length === 0 ? <p className="text-[0.75rem] text-ink-400 mb-5">{addingCustom ? '' : 'No elements yet — add one.'}</p> : (
            <div className="mb-5 space-y-1.5">
              {d.documents.map(doc => {
                const files = designFilesOf(doc);
                // Required / Optional / Not applicable, read off the control's class
                // rather than a flag on the element — see DOC_REQUIREMENTS.
                const docReq = docRequirement(control, doc);
                return (
                  <div key={doc.id} id={`doc-${doc.id}`} className="scroll-mt-4">
                  <div className={cn('doc-row', doc.status === 'Received' && '!border-compliant-200', doc.waiver && doc.status !== 'Received' && '!border-evidence-200')}>
                    {doc.waiver && doc.status !== 'Received' ? <BadgeCheck size={15} className="shrink-0 text-evidence-600" />
                      : <FileCheck2 size={15} className={cn('shrink-0', DOC_TONE[doc.status])} />}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[0.75rem] font-semibold text-ink-800">{docLabel(doc)}</span>
                        <span className={cn('text-[0.625rem] font-bold uppercase tracking-wide px-1 h-3.75 inline-flex items-center rounded',
                          docReq === 'Required' ? 'bg-brand-50 text-brand-700' : 'bg-paper-100 text-ink-500')}>{docReq}</span>
                      </div>
                      {doc.description && <div className="text-[0.6875rem] text-ink-500 mt-0.5">{doc.description}</div>}
                      {files.length > 0 ? (
                        <div className="flex items-start gap-1.5 mt-1 flex-wrap">
                          {/* Each file says who uploaded it and when (S6, A19 — the
                              user asked for the uploader back on the file). Its name
                              opens a preview; the X takes that one file off. */}
                          {files.map(f => (
                            <span key={f.id} className={cn('inline-flex items-center gap-1 max-w-full rounded-md border border-canvas-border bg-paper-50/70 pl-1.5 py-0.5', canRemoveFile(f) ? 'pr-0.5' : 'pr-1.5')}>
                              <button onClick={() => setPreviewing({ file: f, element: docLabel(doc) })} title={`Preview ${f.name}`}
                                className="group min-w-0 inline-flex items-start gap-1.5 text-left rounded-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40">
                                <Paperclip size={10} className="shrink-0 mt-0.75 text-ink-400" />
                                <span className="min-w-0">
                                  <span className="block max-w-64 truncate text-[0.6875rem] font-medium text-ink-700 underline-offset-2 group-hover:text-brand-700 group-hover:underline">{f.name}</span>
                                  <span className="block max-w-64 truncate text-[0.6875rem] text-ink-400">Uploaded by {f.uploadedBy}{f.uploadedAt ? ` · ${f.uploadedAt}` : ''}</span>
                                </span>
                              </button>
                              {canRemoveFile(f) && (
                                <button onClick={() => removeFile(doc, f)} title="Remove this file" aria-label={`Remove ${f.name}`}
                                  className="h-5 w-5 shrink-0 inline-flex items-center justify-center rounded text-ink-400 hover:text-risk-600 hover:bg-risk-50 cursor-pointer"><X size={10} /></button>
                              )}
                            </span>
                          ))}
                        </div>
                      ) : doc.waiver ? (
                        <div className="text-[0.6875rem] text-evidence-700 mt-0.5 flex items-start gap-1">
                          <CornerDownRight size={11} className="mt-0.5 shrink-0" />
                          <span><span className="font-semibold">{doc.waiver.reason}</span> — {doc.waiver.note} <span className="text-ink-400">· {doc.waiver.by}, {doc.waiver.at}</span></span>
                        </div>
                      ) : (
                        <div className="text-[0.6875rem] text-ink-400 mt-0.5 truncate">{
                          docReq === 'Not applicable' ? `Not produced for ${docColumnOf(control) === 'ITGC' ? 'an IT general control' : `a ${docColumnOf(control).toLowerCase()} control`} — not chased, not counted`
                            : doc.status === 'Requested' ? 'Requested from the control owner' : 'No evidence attached yet'}</div>
                      )}
                    </div>
                    {/* An element this class of control does not have shows no chase
                        status — there is nothing outstanding to report. It still
                        says "Evidenced" if somebody attached one anyway. */}
                    {(docReq !== 'Not applicable' || doc.status === 'Received') &&
                      <Pill tone={doc.status === 'Received' ? 'compliant' : doc.waiver ? 'evidence' : doc.status === 'Requested' ? 'mitigated' : 'draft'}>{doc.status === 'Received' ? 'Evidenced' : doc.waiver ? 'Waived' : doc.status}</Pill>}
                    {canEdit && <div className="flex items-center gap-1">
                      {docReq !== 'Not applicable' && doc.status !== 'Received' && !doc.waiver && <button onClick={() => setWaiving(x => x === doc.id ? null : doc.id)} title="Account for this element without a file" className="h-7 px-2.5 text-[0.75rem] font-semibold rounded-md border border-canvas-border bg-canvas-elevated text-ink-600 hover:text-evidence-700 hover:border-evidence-300 disabled:opacity-50 inline-flex items-center gap-1 cursor-pointer"><BadgeCheck size={11} /> Not applicable</button>}
                      {doc.waiver && <button onClick={() => clearDesignWaiver(control.id, doc.id)} title="Remove the waiver — the element is required again, and can take evidence" aria-label={`Remove the waiver on ${docLabel(doc)}`} className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-canvas-border bg-canvas-elevated text-ink-400 hover:border-brand-300 hover:text-brand-700 cursor-pointer"><RotateCcw size={12} /></button>}
                      {/* a waived element offers no upload. Waiving it settled
                          that there is no file to give; the way back is to lift
                          the waiver first, which puts the element back in the
                          count before anything is attached to it. */}
                      {doc.status !== 'Received' && !doc.waiver && <button onClick={() => attach(doc)} title="Choose one or more files — PDF, image, XLSX, CSV or Word" className="h-7 px-2.5 text-[0.75rem] font-semibold rounded-md border border-canvas-border bg-canvas-elevated text-ink-600 hover:text-compliant-700 hover:border-compliant-300 disabled:opacity-50 inline-flex items-center gap-1 cursor-pointer"><Upload size={11} /> Attach evidence</button>}
                      {doc.status === 'Received' && <button onClick={() => attach(doc)} title="Attach another file" aria-label={`Attach another file to ${docLabel(doc)}`} className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-canvas-border bg-canvas-elevated text-ink-400 hover:border-brand-300 hover:text-brand-700 cursor-pointer"><Plus size={12} /></button>}
                      {/* PARKED (22 Sep, user ask) — the bin. A design element
                          is what the design was read against, and dropping one
                          after the checks have been marked changes what the
                          conclusion rests on without changing the conclusion.
                          "Not applicable", beside it, is the honest way to
                          account for an element that will not be provided — it
                          asks for a reason and the working paper prints it.
                          `removeDesignDoc` stays on the store. */}
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
              PARKED (Aug 2026, user ask) — the "Ira read this control" panel that
              proposed considerations the list did not carry, each with Add and a
              dismiss. Everything behind it is left intact and compiling —
              `suggestions` above, `suggestedDesignChecks` in helpers, the
              `dismissed` state, `addDesignPoint` — so restoring it is uncommenting
              this block and nothing else.

              It sat above the checks rather than below, because it was about the
              set as a whole, and it never inserted anything for you: an auditor who
              did not choose a check is an auditor who will not defend it at review.

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
                        <span className="text-[0.75rem] text-ink-700 leading-relaxed min-w-0">{s}</span>
                        <span className="flex items-center gap-1 shrink-0">
                          <button onClick={() => { addDesignPoint(control.id, s); logEvent({ action: 'Create', description: `Added a suggested design check to ${control.id}`, module: 'SOX ICFR', entity: 'Control' }); }}
                            className="h-7 px-2.5 rounded-md bg-brand-600 text-white text-[0.6875rem] font-semibold hover:bg-brand-700 transition-colors cursor-pointer">Add</button>
                          <button onClick={() => setDismissed(d => [...d, s])} title="Not relevant to this control" aria-label="Not relevant to this control"
                            className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-canvas-border text-ink-400 hover:text-ink-700 hover:border-ink-300 transition-colors cursor-pointer"><X size={12} /></button>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          */}
          <div className="flex items-center justify-between mb-2.5 gap-2 flex-wrap">
            <h4 className="text-[0.8125rem] font-bold text-ink-700 inline-flex items-center gap-1.5 flex-wrap"><ClipboardCheck size={14} /> Design checks <span className="font-normal text-ink-400">· assessed against the evidence</span>
              {/* What the run left behind, said once at the top so it does not
                  have to be found by scrolling. Plain text now, not an amber
                  chip (agentic UI review #7): these are checks waiting for a
                  person, an ordinary state, and amber is kept for outcomes. */}
              {iraCouldNot.length > 0 && !iraRunning && (
                <span className="font-normal text-ink-500 whitespace-nowrap cursor-help"
                  title={`Ira read the evidence and could not reach a verdict on ${iraCouldNot.length === 1 ? 'this one' : 'these'} — mark ${iraCouldNot.length === 1 ? 'it' : 'them'} yourself, or attach what ${iraCouldNot.length === 1 ? 'it needs' : 'they need'}`}>
                  · {iraCouldNot.length} Ira couldn’t test
                </span>
              )}
            </h4>
            <div className="flex items-center gap-2">
              {/* PARKED (Aug 2026, user ask) — the Validate all button. `runValidateAll`
                  and `validatingAll` are left above so restoring it is one line:
                  <button disabled={validatingAll} onClick={runValidateAll} className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md bg-evidence-600 text-white text-[0.75rem] font-semibold enabled:hover:bg-evidence-700 disabled:opacity-70 cursor-pointer">{validatingAll ? <><Loader2 size={12} className="animate-spin" /> Validating…</> : <><PlayCircle size={12} /> Validate all</>}</button> */}
              {/* PARKED (S6, A17) — Pass all / Fail all, replaced by the Ira button
                  beside them. `markAll` is left above, so restoring them is:
                <button onClick={() => markAll('Pass')} title="Mark every check passed" className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md border border-compliant-300 bg-compliant-50 text-[0.75rem] font-semibold text-compliant-700 hover:bg-compliant-100 transition-colors cursor-pointer"><CheckCircle2 size={12} /> Pass all</button>
                <button onClick={() => markAll('Fail')} title="Mark every check failed" className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md border border-canvas-border bg-canvas-elevated text-[0.75rem] font-semibold text-ink-600 hover:border-risk-300 hover:text-risk-700 transition-colors cursor-pointer"><XCircle size={12} /> Fail all</button> */}
              {/* Manual only (Stage 1a): in Automatic, Ira runs from its plan's Start. */}
              {canTest && !iraRunning && iraMode === 'manual' && (
                <button onClick={runIra} disabled={!!iraBlocked || !!liveRun}
                    title={liveRun ? busyNote(liveRun) : iraBlocked ?? (iraStale
                      ? 'A design element’s files changed since Ira last ran — run it again to check against what is on file now'
                      : 'Ira reads every design check against the evidence on file and marks each one Pass or Fail')}
                    className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md bg-brand-600 text-white text-[0.75rem] font-semibold enabled:hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer">
                    <Sparkles size={12} /> {iraStale ? 'Re-run AI validation' : 'Run AI validation'}
                  </button>)}
              {/* PARKED (18 Sep, user ask) — Add a design check. The checks come
                  from the RACM, and writing a new one here put the question and
                  the answer in the same hand. `addingPoint` and the form below
                  are left in place, so restoring it is:
                  <button onClick={() => setAddingPoint(a => !a)} aria-label="Add a design check" className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md border border-canvas-border bg-canvas-elevated text-[0.75rem] font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-700 cursor-pointer"><Plus size={12} /> Add</button> */}
            </div>
          </div>
          {addingPoint && (() => {
            const submit = () => {
              if (!newPoint.trim()) return;
              addDesignPoint(control.id, newPoint.trim(), newPointStep || undefined);
              const where = steps.find(s => s.id === newPointStep);
              logEvent({ action: 'Create', description: `Added design consideration to ${control.id}${where ? ` — attribute ${where.code}` : ''}`, module: 'SOX ICFR', entity: 'Control' });
              setNewPoint(''); setNewPointStep(''); setAddingPoint(false);
            };
            return (
              <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                <input autoFocus value={newPoint} onChange={e => setNewPoint(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submit(); }} placeholder="e.g. Reviewer is independent of the preparer" className="flex-1 min-w-64 h-9 px-3 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.8125rem] focus:outline-none focus:ring-2 focus:ring-brand-200" />
                {/* What the check is ABOUT, asked at the point of writing it. Filed
                    afterwards it never gets filed — and a check under the wrong
                    heading reads as a check of something it never tested. */}
                {steps.length > 0 && (
                  <select value={newPointStep} onChange={e => setNewPointStep(e.target.value)} aria-label="What this check is about"
                    className="h-9 px-2.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.75rem] text-ink-700 max-w-64 focus:outline-none focus:ring-2 focus:ring-brand-200 cursor-pointer">
                    <option value="">The control as a whole</option>
                    {steps.map(s => <option key={s.id} value={s.id}>{s.code} · {s.description}</option>)}
                  </select>
                )}
                <button disabled={!newPoint.trim()} onClick={submit} className="h-9 px-3 rounded-lg bg-brand-600 text-white text-[0.75rem] font-semibold disabled:opacity-40 cursor-pointer">Add</button>
              </div>
            );
          })()}
          {/* Why "Run AI validation" is dead, said under it rather than only on
              hover (click-through, 5 Oct). Not once TOD is concluded — the
              conclusion footer already says why the step is closed. */}
          {canTest && iraMode === 'manual' && !iraRunning && !liveRun && iraBlocked && d.conclusion === 'Not tested' && (
            <p className="-mt-1 mb-2.5 text-[0.6875rem] text-ink-500">{iraBlocked}.</p>
          )}
          {iraRunning && <RunLine files={d.documents.reduce((n, doc) => n + designFilesOf(doc).length, 0)} total={d.points.length} noun="check" ms={VALIDATE_MS} />}
          {chatRun && <LiveRunLine run={chatRun} />}
          {/* A run of another step (the chat's extract or draw) still holds this
              button, so it says why in one line. */}
          {canTest && iraMode === 'manual' && !iraRunning && liveRun && !chatRun && d.conclusion === 'Not tested' && (
            <p className="-mt-1 mb-2.5 text-[0.6875rem] text-ink-500">{busyNote(liveRun)}</p>
          )}
          {!iraRunning && !chatRun && <ConfirmSure control={control} which="design" rows={d.points} />}
          {d.points.length === 0 ? <p className="text-[0.75rem] text-ink-400 mb-5">No considerations yet — add the design points you’ll assess in the walkthrough.</p> : (
            <div className="space-y-4 mb-5">
              {controlChecks.length > 0 && (
                <div className="space-y-2">
                  {/* Only labelled when there is something to tell it apart FROM.
                      One heading over one list names nothing. */}
                  {stepChecks.length > 0 && (
                    <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-400">The control as a whole</p>
                  )}
                  {controlChecks.map(p => <PointRow key={p.id} control={control} point={p} canEdit={canEdit} checking={iraRunning || !!chatRun} />)}
                </div>
              )}
              {stepChecks.map(g => (
                <div key={g.step.id} className="space-y-2">
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-400 flex items-baseline gap-1.5 min-w-0">
                    <span className="font-mono normal-case text-ink-500 shrink-0">{g.step.code}</span>
                    <span className="truncate normal-case font-medium text-ink-500">{g.step.description}</span>
                  </p>
                  {g.points.map(p => <PointRow key={p.id} control={control} point={p} canEdit={canEdit} checking={iraRunning || !!chatRun} />)}
                </div>
              ))}
            </div>
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
          <p className="mt-3 text-[0.75rem] text-ink-500 leading-relaxed">
            <span className="text-ink-400">Basis</span> · {designBasis(control)}
            {proven > 0 && <span className="text-ink-400"> — {proven} of {control.design.points.length} check{control.design.points.length === 1 ? '' : 's'} carry the auditor's own proof</span>}
            <span className="text-ink-300"> · </span>
            <span className="text-ink-400">In operation</span> · {control.design.walkthrough ? 'yes — seen running on a live transaction' : docsIn > 0 ? 'evidenced by the documents on file' : 'not yet evidenced'}
          </p>

          {/* Required elements only: an Optional one missing is a thinner file,
              not a gap, and the amber line used to nag about the Flowchart. */}
          {iraMissing.length > 0 && <div className="mt-3 text-[0.75rem] text-mitigated-700 bg-mitigated-50/60 border border-mitigated-200 rounded-lg px-3 py-2 inline-flex items-center gap-1.5"><AlertTriangle size={13} /> {iraMissing.length} required element{iraMissing.length > 1 ? 's' : ''} outstanding — attach evidence, request it from the control owner, or mark it not applicable.</div>}
          {/* Effective needs every gate: evidence accounted for, every design check
              validated — an unvalidated check is an untested opinion — the control
              confirmed in operation, and the basis on the record. Inquiry-only
              considerations WARN rather than block here (the standard treats a
              walkthrough's inquiry and observation as ordinarily sufficient for
              design); operating is where inquiry alone actually refuses. */}
          <ConcludeFooter control={control} which="design" suggestion={suggestion} canEdit={canTest}
            disabled={locked}
            disabledNote={locked ? `Approved by ${control.design.approval?.approvedBy?.by ?? 'the reviewer'} — ask them to send it back to change it` : undefined}
            disableEffective={!complete || unvalidated > 0}
            disableEffectiveNote={!complete
              ? `Locked — ${completeness.total - completeness.done} required element${completeness.total - completeness.done === 1 ? ' still needs' : 's still need'} evidence`
              : unvalidated > 0
                ? `Locked — ${unvalidated} design check${unvalidated === 1 ? '' : 's'} not validated yet`
                : undefined} />
          </>)}
          {/* What the owner gets in its place: the state of their own lane. */}
          {isOwner && (
            <p className="mt-3 text-[0.75rem] text-ink-500 leading-relaxed rounded-lg border border-canvas-border bg-paper-50/60 px-3 py-2.5">
              {missing.length > 0
                ? <><span className="font-semibold text-ink-700">{missing.length} document{missing.length > 1 ? 's' : ''} still outstanding.</span> Attach what you hold — the auditor takes it from there.</>
                : <><span className="font-semibold text-ink-700">Everything asked for is on file.</span> The auditor's testing and its conclusion are not shown here.</>}
            </p>
          )}
        </>
      )}
      <AnimatePresence>{modal && <RequestDataModal control={control} onClose={() => setModal(false)} />}</AnimatePresence>
      {/* the one picker behind every element's Attach evidence and + */}
      <input ref={filePicker} type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.csv,.doc,.docx" className="sr-only" tabIndex={-1} aria-hidden="true"
        onChange={e => { attachPicked(e.target.files); e.target.value = ''; }} />
      <AnimatePresence>{previewing && <EvidencePreviewModal file={previewing.file} element={previewing.element} onClose={() => setPreviewing(null)} />}</AnimatePresence>
    </div>
  );
}

// ── sample extraction (step ③) — transaction detail → size/method/seed → draw ───
/** A drawn row's amount, in full rupees. The date is the draw's (sampleDate,
 *  A28) and the amount is the population instance on that date (sampleAmount,
 *  S9 A32), so the row prices the same as the population preview and the
 *  exposure working. */
const rowRupees = (n: number): string => `₹${n.toLocaleString('en-IN')}`;

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
  const { eng, openAuditId, me, setIpeCheck } = useIcfr();
  // Only read for the Period coverage check — the same two helpers the parked
  // "Period covered" row used, so the auditor sees exactly what it showed.
  const audit = eng.audits.find(a => a.id === openAuditId);
  // The version's window, not the audit's — see `versionWindow`. On a rebuilt
  // control the two differ, and only the first is a fair test of coverage.
  const cwin = audit ? versionWindow(control, audit) : undefined;
  const cover = check.dimension === 'Period coverage' ? coverageVerdict(control, cwin?.from, cwin?.to) : null;
  const emptyMonths = check.dimension === 'Period coverage' ? monthlyBreakdown(control).filter(m => m.n === 0).map(m => m.label) : [];
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
          <span className="block text-[0.6875rem] font-bold uppercase tracking-wider text-ink-400">{check.dimension}</span>
          <p className="text-[0.8125rem] text-ink-800 leading-relaxed mt-0.5">{check.description}</p>
          <p className="text-[0.6875rem] text-ink-400 leading-relaxed mt-1 flex items-start gap-1.5"><FlaskConical size={11} className="mt-0.5 shrink-0" /> {check.method}</p>

          {/* What the parked "Period covered" row put on screen: the audit's own
              window, the span the extract actually holds, and any month inside
              the period with nothing in it. Stated as context, not as a verdict
              — the auditor is the one concluding now, and they cannot conclude
              on dates they have to go and look up. */}
          {check.dimension === 'Period coverage' && canWrite && !answered && cover && (
            <div className="mt-2.5 rounded-md border border-canvas-border bg-canvas-elevated px-2.5 py-2">
              <span className="block text-[0.6875rem] font-bold uppercase tracking-wider text-ink-400 mb-1.5">What the extract holds</span>
              <p className="text-[0.6875rem] text-ink-600 leading-relaxed">
                <span className="font-semibold text-ink-900">{cover.headline}</span> — {cover.detail}
              </p>
              {emptyMonths.length > 0 && (
                <p className="text-[0.6875rem] text-mitigated-800 leading-relaxed mt-1">
                  No instances at all in {emptyMonths.join(', ')} — either the control did not run, or those months are not in the extract.
                </p>
              )}
            </div>
          )}

          {/* the auditor's own count, only where counting is the procedure */}
          {check.dimension === 'Completeness' && canWrite && !answered && (
            <div className="mt-2.5 rounded-md border border-canvas-border bg-canvas-elevated px-2.5 py-2">
              <span className="block text-[0.6875rem] font-bold uppercase tracking-wider text-ink-400 mb-1.5">Count it yourself</span>
              <div className="flex items-center gap-2 flex-wrap">
                <input type="number" min={0} value={counted} onChange={e => setCounted(e.target.value)} placeholder="records in the system"
                  className="w-44 h-8 px-2.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.8125rem] tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-200" />
                <span className="text-[0.6875rem] text-ink-400">the report claims <span className="tabular-nums font-semibold text-ink-700">{reportCount.toLocaleString()}</span></span>
                {variance != null && (
                  <span className={cn('text-[0.6875rem] font-bold', variance === 0 ? 'text-compliant-700' : 'text-risk-700')}>
                    {variance === 0 ? 'Ties' : `Off by ${Math.abs(variance).toLocaleString()} · ${pct}%`}
                  </span>
                )}
                {variance != null && (
                  <button onClick={() => setDraft(countedNote)}
                    className="h-8 px-3 rounded-md border border-canvas-border text-[0.75rem] font-semibold text-ink-700 hover:border-ink-300 transition-colors cursor-pointer">Write it up</button>
                )}
              </div>
            </div>
          )}

          {/* the finding — required to fail, because a failure nobody wrote down is not one */}
          {canWrite && !answered ? (
            <div className="mt-2.5">
              <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={2}
                placeholder={check.dimension === 'Completeness' ? 'What the tie-out showed — the numbers, and the variance if there is one' : check.dimension === 'Accuracy' ? 'Which records were vouched, to what, and what was found' : check.dimension === 'Period coverage' ? 'The span the extract holds, and what accounts for any empty month inside the period' : 'What the parameter screen showed, and how it agrees to the test scope'}
                className="w-full px-2.5 py-2 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.75rem] leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-brand-200" />
              <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                <button onClick={() => save('Pass')} disabled={!draft.trim()} title={draft.trim() ? undefined : 'Record what was found first.'}
                  className="h-8 px-3 inline-flex items-center gap-1.5 rounded-md bg-compliant-600 text-white text-[0.75rem] font-semibold enabled:hover:bg-compliant-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"><CheckCircle2 size={12} /> Pass</button>
                <button onClick={() => save('Fail')} disabled={!draft.trim()} title={draft.trim() ? undefined : 'Record what was found first.'}
                  className="h-8 px-3 inline-flex items-center gap-1.5 rounded-md border border-risk-300 text-risk-700 text-[0.75rem] font-semibold enabled:hover:bg-risk-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"><XCircle size={12} /> Fail</button>
                <button onClick={attach} className="h-8 px-3 inline-flex items-center gap-1.5 rounded-md border border-canvas-border bg-canvas-elevated text-[0.75rem] font-semibold text-ink-600 hover:border-evidence-300 hover:text-evidence-700 transition-colors cursor-pointer"><Paperclip size={12} /> Attach proof</button>
                {/* The refusal said where it applies, not only on hover. */}
                <span className="text-[0.6875rem] text-ink-400">{draft.trim() ? 'This prints on the working paper.' : 'Write what you found first — Pass and Fail wait for it.'}</span>
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
                <span key={f.id} className="inline-flex items-center gap-1 rounded-md border border-canvas-border bg-canvas-elevated px-2 py-1 text-[0.6875rem] text-ink-600"><Paperclip size={10} /> {f.name}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function IpeSection({ control, canWrite, isAuditor }: { control: Control; canWrite: boolean; isAuditor: boolean }) {
  // `me` went with the parked form — it only ever stamped the Run by field.
  const { registerIpe, concludeIpe, clearIpe, approveSource } = useIcfr();
  const logEvent = useAuditLog();
  const { addToast } = useToast();
  const files = useAuditFiles();
  const pop = control.operating.population;
  const sourceFile = files.find(f => f.name === pop?.sourceFile);
  const sources = populationSources(control);
  const ipe = control.operating.ipe;
  const reliable = ipe?.conclusion === 'Reliable';
  // Settled work folds away; unsettled work does not get to hide.
  const [open, setOpen] = useState(!reliable);
  // Which file's checks are unfolded. One at a time, and the one that opens on
  // arrival is the first still owing work — a control returned to after a week
  // should land on what is left rather than on what is finished.
  const [openSource, setOpenSource] = useState<string | null>(() => sources.find(s => !s.approvedIpe)?.id ?? null);

  // ── PARKED (Aug 2026) — the registration form ─────────────────────────────
  // Eight fields, and the audit already held five of them: the report's name was
  // the source file's name, its record count was the file's row count, the
  // system came off the file record and the parameters were prefilled from this
  // control's extraction criteria — which is OUR filter wearing the label of the
  // CLIENT's statement about how they ran their report. Two different facts, one
  // name. Asking all of it again per control is what made this step read as the
  // same questions over and over, and what got it typed through with "qw".
  //
  // The checks below are seeded from the file instead (see the effect under
  // this), so the work survives and only the asking goes. Restoring the form is
  // uncommenting this block, the state above it and the register button.
  //
  // const [name, setName] = useState(sourceFile?.name ?? '');
  // const [system, setSystem] = useState(sourceFile?.system ?? '');
  // const [ref, setRef] = useState('');
  // const [params, setParams] = useState(pop?.criteria ?? '');
  // const [by, setBy] = useState(sourceFile?.systemFetched ? `${me} — pulled by the audit team` : '');
  // const [at, setAt] = useState('');
  // const [count, setCount] = useState(String(pop?.sourceCount ?? sourceFile?.rows ?? ''));
  // const [total, setTotal] = useState('');

  // The report IS the source file, and everything the seeding needs is already
  // on it. So the record is created the moment there is a population to test,
  // and the auditor arrives at the three checks rather than at a form.
  const needsIpe = !!pop && !control.operating.ipe && canWrite && isAuditor;
  useEffect(() => {
    if (!needsIpe || !pop) return;
    registerIpe(control.id, {
      reportName: sourceFile?.name ?? pop.sourceFile ?? 'the source report',
      system: sourceFile?.system ?? '',
      reportRef: '',
      parameters: '',
      generatedBy: '',
      generatedAt: '',
      recordCount: pop.sourceCount ?? sourceFile?.rows ?? 0,
      controlTotal: '',
    });
  }, [needsIpe, control.id, pop, sourceFile, registerIpe]);

  if (!pop) return null;
  const suggestion = ipe ? ipeSuggestion(ipe) : 'Not tested';
  const allAnswered = !!ipe && ipe.checks.every(k => k.result !== 'Not tested');
  // canRegister and the `field` helper went with the form they gated and built.
  // Both are in the parked block's history if it ever comes back.

  return (
    <div className={cn('rounded-xl border', reliable ? 'border-compliant-200 bg-compliant-50/30' : ipe?.conclusion === 'Not reliable' ? 'border-risk-200 bg-risk-50/30' : 'border-canvas-border bg-paper-50/50')}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left cursor-pointer">
        {open ? <ChevronDown size={14} className="text-ink-400 shrink-0" /> : <ChevronRight size={14} className="text-ink-400 shrink-0" />}
        <span className="text-[0.8125rem] font-bold text-ink-900">IPE test</span>
        <span className="text-[0.6875rem] text-ink-400 min-w-0 truncate">— the report this population came out of, proven before anything is built on it</span>
        <span className={cn('ml-auto shrink-0 text-[0.75rem] font-bold', IPE_TONE[ipe?.conclusion ?? 'Not tested'])}>
          {ipe ? ipe.conclusion : 'Not tested'}
        </span>
      </button>

      {open && (
        <div className="px-3.5 pb-3.5">
          {!ipe ? (
            /* The eight-field form stood here and is parked — see the note at the
               top of this component. What is left is the one honest case: a hat
               that cannot seed the record, told why rather than shown a form it
               is not allowed to submit. */
            <p className="text-[0.75rem] text-ink-400 leading-relaxed">The report behind this population has not been registered yet. Only the auditor can test it.</p>
          ) : (
            <>
              {/* What the audit holds about the report. Every part is optional
                  except the count, because nothing is typed in any more — the
                  record is seeded off the source file, so a separator is only
                  printed when there is something on both sides of it.
                  On a population standing on several files this is the header
                  for all of them; each file's own name and row count head its
                  own group of checks below. */}
              <div className="rounded-lg border border-canvas-border bg-canvas-elevated px-3 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="block text-[0.8125rem] font-bold text-ink-900 truncate">
                      {sources.length > 1 ? `${sources.length} reports behind this population` : ipe.reportName}
                    </span>
                    <span className="block text-[0.6875rem] text-ink-500 mt-0.5 truncate">
                      {[ipe.system, ipe.reportRef, `${(sources.length > 1 ? sources.reduce((a, s) => a + s.rows, 0) : ipe.recordCount).toLocaleString()} records`].filter(Boolean).join(' · ')}
                    </span>
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

              {/* ── the checks, one group per file ────────────────────────────
                  "IPE टेस्ट तो एक ही रो होगा, उसके नीचे दो रहेगा" — one test,
                  one verdict, and underneath it each file proven on its own.
                  The four dimensions are asked of every file separately because
                  proving one file says nothing about the next: a general ledger
                  that ties out is no evidence at all about a vendor master.
                  With one file there is nothing to distinguish, so the heading
                  is left off and the checks read exactly as they always did. */}
              {sources.length <= 1 ? (
                <div className="mt-2.5 space-y-1.5">
                  {ipe.checks.map(k => <IpeCheckRow key={k.id} control={control} check={k} canWrite={canWrite && isAuditor} reportCount={sources[0]?.rows ?? ipe.recordCount} />)}
                </div>
              ) : (
                <div className="mt-2.5 space-y-2">
                  {sources.map(s => {
                    const checks = ipeChecksFor(control, s.id);
                    if (!checks.length) return null;
                    const passed = checks.filter(k => k.result === 'Pass').length;
                    const failed = checks.some(k => k.result === 'Fail');
                    const answered = checks.every(k => k.result !== 'Not tested');
                    const done = !!s.approvedIpe;
                    const isOpen = openSource === s.id;
                    return (
                      <div key={s.id} className={cn('rounded-lg border overflow-hidden', done ? 'border-compliant-200 bg-compliant-50/20' : 'border-canvas-border bg-canvas-elevated')}>
                        {/* One file's row. Clicking it opens that file's four
                            dimensions and closes whichever was open — "उस फाइल
                            का रो को क्लिक करोगे तब चारों नीचे का खुलेगा, फिर
                            दूसरे फाइल में क्लिक करोगे तो उसका खुलेगा". Four
                            checks × ten files unfolded at once is a screen
                            nobody can work in. */}
                        <button onClick={() => setOpenSource(isOpen ? null : s.id)}
                          aria-expanded={isOpen}
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-left cursor-pointer">
                          {isOpen ? <ChevronDown size={13} className="text-ink-400 shrink-0" /> : <ChevronRight size={13} className="text-ink-400 shrink-0" />}
                          {done ? <CheckCircle2 size={13} className="text-compliant-600 shrink-0" /> : <FileText size={13} className="text-ink-400 shrink-0" />}
                          <span className="text-[0.75rem] font-bold text-ink-800 truncate min-w-0">{s.file}</span>
                          <span className="text-[0.6875rem] text-ink-400 shrink-0 tabular-nums hidden sm:inline">{s.rows.toLocaleString()} records</span>
                          <span className={cn('ml-auto shrink-0 text-[0.6875rem] font-bold',
                            failed ? 'text-risk-700' : done ? 'text-compliant-700' : passed === checks.length ? 'text-compliant-700' : 'text-ink-400')}>
                            {failed ? 'a check failed' : done ? 'done' : `${passed}/${checks.length} proven`}
                          </span>
                        </button>
                        {isOpen && (
                          <div className="px-3 pb-3">
                            <div className="space-y-1.5">
                              {/* The count each check is measured against is
                                  THIS file's row count, not the control's total
                                  — a variance worked out against the wrong
                                  denominator is worse than no variance at all. */}
                              {checks.map(k => <IpeCheckRow key={k.id} control={control} check={k} canWrite={canWrite && isAuditor} reportCount={s.rows} />)}
                            </div>
                            {canWrite && isAuditor && (
                              <div className="mt-2.5 flex items-center justify-between gap-3 flex-wrap">
                                <p className="text-[0.6875rem] text-ink-400 min-w-0">
                                  {done
                                    ? `Marked done by ${s.approvedIpe!.by}, ${s.approvedIpe!.at}. Answering a check again takes the mark off.`
                                    : answered
                                      ? 'Mark it done and the next file opens. This is a marker, not a lock — the verdict on the report is still signed once, below.'
                                      : `Work all ${checks.length} checks on this file first.`}
                                </p>
                                {done ? (
                                  <button onClick={() => approveSource(control.id, s.id, 'ipe', false)}
                                    className="shrink-0 h-8 px-3 inline-flex items-center gap-1.5 rounded-md border border-canvas-border text-[0.75rem] font-semibold text-ink-500 hover:text-ink-900 hover:border-ink-300 transition-colors cursor-pointer"><RotateCcw size={11} /> Take the mark off</button>
                                ) : (
                                  <button disabled={!answered} title={answered ? undefined : `Work all ${checks.length} checks on this file first.`}
                                    onClick={() => {
                                      approveSource(control.id, s.id, 'ipe', true);
                                      // "अगला पे जाओगे" — the next file that
                                      // still owes work opens itself. Landing on
                                      // a closed list after every approval is
                                      // ten extra clicks on a ten-file control.
                                      const next = sources.find(x => x.id !== s.id && !x.approvedIpe);
                                      setOpenSource(next?.id ?? null);
                                    }}
                                    className="shrink-0 h-8 px-3.5 inline-flex items-center gap-1.5 rounded-md bg-brand-600 text-white text-[0.75rem] font-semibold enabled:hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"><Check size={12} /> Approve and continue</button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* the verdict — a single failure sinks it, so the suggestion is stated and the auditor signs it */}
              <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
                <p className="text-[0.6875rem] text-ink-400 min-w-0">
                  {ipe.conclusion !== 'Not tested'
                    ? <>Concluded <span className={cn('font-bold', IPE_TONE[ipe.conclusion])}>{ipe.conclusion.toLowerCase()}</span> by {ipe.testedBy}{ipe.testedAt ? `, ${ipe.testedAt}` : ''}.</>
                    : allAnswered
                      ? <>All {ipe.checks.length} worked. The checks read <span className="font-semibold text-ink-600">{suggestion.toLowerCase()}</span> — a single failure sinks the report.</>
                      : `Work all ${ipe.checks.length} checks before concluding.`}
                </p>
                {canWrite && isAuditor && ipe.conclusion === 'Not tested' && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button disabled={!allAnswered || suggestion !== 'Reliable'} title={!allAnswered ? `Work all ${ipe.checks.length} checks first.` : suggestion !== 'Reliable' ? 'A check failed — the report cannot be concluded reliable.' : undefined}
                      onClick={() => { concludeIpe(control.id, 'Reliable'); setOpen(false);  }}
                      className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-compliant-600 text-white text-[0.8125rem] font-semibold enabled:hover:bg-compliant-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"><CheckCircle2 size={14} /> Reliable</button>
                    <button disabled={!allAnswered}
                      onClick={() => { concludeIpe(control.id, 'Not reliable');  }}
                      className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg border border-risk-300 text-risk-700 text-[0.8125rem] font-semibold enabled:hover:bg-risk-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"><XCircle size={14} /> Not reliable</button>
                  </div>
                )}
                {canWrite && isAuditor && ipe.conclusion !== 'Not tested' && (
                  <button onClick={() => concludeIpe(control.id, 'Not tested')}
                    className="shrink-0 h-8 px-3 inline-flex items-center gap-1.5 rounded-md border border-canvas-border text-[0.75rem] font-semibold text-ink-600 hover:border-ink-300 transition-colors cursor-pointer"><RotateCcw size={12} /> Reopen</button>
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
            <span className="text-[0.6875rem] font-bold uppercase tracking-wider text-ink-400">{label}</span>
            <span className={cn('text-[0.8125rem] font-semibold', accent)}>{v.headline}</span>
            {v.level === 'warn' && !answered && <span className="text-[0.6875rem] font-bold uppercase tracking-wider text-mitigated-700">Variance</span>}
            {v.level === 'fail' && !answered && <span className="text-[0.6875rem] font-bold uppercase tracking-wider text-risk-700">Completeness</span>}
          </div>
          <p className="text-[0.6875rem] text-ink-500 leading-relaxed mt-0.5">{v.detail}</p>

          {/* Where the surplus sits. Only an overshoot has this — missing rows
              are not in the extract to be grouped. */}
          {v.breakdown && v.breakdown.length > 0 && (
            <div className="mt-2 rounded-md border border-canvas-border bg-canvas-elevated px-2.5 py-2">
              <span className="block text-[0.6875rem] font-bold uppercase tracking-wider text-ink-400 mb-1">Where the extra rows sit</span>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {v.breakdown.map(b => (
                  <span key={b.label} className="text-[0.6875rem] text-ink-600">
                    {b.label} <span className="tabular-nums font-semibold text-ink-900">{b.n.toLocaleString()}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          {v.causes && !answered && <p className="mt-1.5 text-[0.6875rem] text-ink-400 leading-relaxed">{v.causes}</p>}

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
                    <span className="text-[0.6875rem] text-ink-400">Adjust the filter and extract again — the comparison re-runs.</span>
                  </div>
                )}
                <span className="block text-[0.6875rem] text-ink-400 mb-1">{onRefilter ? 'Or accept it, and say why:' : 'Say why:'}</span>
                <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={2} placeholder={placeholder}
                  className="w-full px-2.5 py-2 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.75rem] leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-brand-200" />
                <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                  <button disabled={!draft.trim()} onClick={() => { onNote(draft.trim()); setOpen(false); }}
                    className="h-7 px-3 rounded-md bg-brand-600 text-white text-[0.6875rem] font-semibold enabled:hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer">Accept with reason</button>
                  <span className="text-[0.6875rem] text-ink-400">This prints on the working paper beside the figure.</span>
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
  const { eng } = useIcfr();
  const pop = control.operating.population!;
  const SHOWN = 25;
  const home = sampleHome(eng, a => auditCovers(a, control, eng.id));
  const rows = useMemo(() => {
    // Reference, date and amount are the population's own (populationInstances,
    // S9 A32) — the same instances a drawn item's amount and the exposure working
    // read, already in date order. The descriptive columns stay a tiny LCG
    // seeded off the control id.
    let s = seedKeyOf(control).split('').reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
    const next = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
    const who = ['R. Nair', 'S. Kulkarni', 'A. Verma', 'P. Desai', 'M. Iyer'];
    const kind = ['Vendor payment run', 'Payroll disbursement', 'Inter-company transfer', 'Utility settlement', 'Treasury sweep'];
    return populationInstances(control, SHOWN, home).map(it => ({
      ...it,
      description: kind[Math.floor(next() * kind.length)],
      account: `${2100 + Math.floor(next() * 6) * 10} — ${['Trade payables', 'Bank — current', 'Payroll clearing', 'Inter-company', 'Accruals', 'Treasury'][Math.floor(next() * 6)]}`,
      approver: who[Math.floor(next() * who.length)],
    }));
  }, [control, home]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <motion.div role="dialog" aria-modal="true" aria-labelledby="population-title" className="modal" style={{ maxWidth: 940 }} onClick={e => e.stopPropagation()} initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}><DialogFocus onEscape={onClose} />
        <div className="px-5 py-4 border-b border-canvas-border flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 id="population-title" className="text-[0.875rem] font-bold text-ink-900">The population</h3>
              {pop.version && <span className="wp-ref">{pop.version}</span>}
              {pop.locked && <span className="inline-flex items-center gap-1 text-[0.6875rem] font-bold text-compliant-700"><Database size={11} /> Locked</span>}
            </div>
            <p className="text-[0.75rem] text-ink-500 mt-1">
              First {rows.length} of <span className="tabular-nums font-semibold text-ink-700">{pop.count.toLocaleString()}</span> instances
              {pop.sourceFile && <> · filtered out of <span className="font-mono text-[0.6875rem] text-ink-600">{pop.sourceFile}</span></>}
            </p>
            <p className="text-[0.6875rem] text-ink-400 mt-0.5">Filter · {pop.criteria ?? '—'}</p>
          </div>
          <button onClick={onClose} className="shrink-0 h-8 px-3 rounded-md border border-canvas-border text-[0.75rem] font-semibold text-ink-600 hover:text-ink-900 hover:border-ink-300 transition-colors cursor-pointer">Close</button>
        </div>
        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full border-collapse text-[0.75rem]">
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
      <span className="block text-[0.6875rem] font-bold uppercase tracking-wider text-ink-400 mt-4 mb-2">Does the count read right?</span>
      <div className="rounded-xl border border-canvas-border bg-canvas-elevated p-3.5">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[0.75rem] text-ink-500">
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
                    <span className={cn('text-[0.625rem] font-bold tabular-nums leading-none shrink-0', zero ? 'text-risk-700' : spike ? 'text-mitigated-800' : 'text-ink-400')}>{m.n.toLocaleString()}</span>
                    <div className="flex-1 w-full flex items-end">
                      <div className={cn('w-full rounded-sm', zero ? 'bg-risk-200' : spike ? 'bg-mitigated-400' : 'bg-brand-200')}
                        style={{ height: zero ? 3 : `${Math.max(8, Math.round((m.n / Math.max(1, peak)) * 100))}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-1 flex items-center gap-1">
              {months.map(m => <span key={m.key} className={cn('flex-1 min-w-0 text-center text-[0.6875rem] font-semibold uppercase tracking-wide', m.n === 0 ? 'text-risk-700' : 'text-ink-400')}>{m.label}</span>)}
            </div>
          </>
        )}

        {zeros.length > 0 && (
          <p className="mt-2.5 text-[0.75rem] text-risk-700 inline-flex items-start gap-1.5">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            <span>No instances at all in {zeros.map(m => m.label).join(', ')} — either the control did not run, or those months are not in the extract.</span>
          </p>
        )}
        {spikes.size > 0 && (
          <p className="mt-1.5 text-[0.75rem] text-mitigated-800 inline-flex items-start gap-1.5">
            <AlertCircle size={12} className="mt-0.5 shrink-0" />
            <span>{months.filter(m => spikes.has(m.key)).map(m => m.label).join(', ')} holds more than double a typical month — usually a duplicate load or a second entity, occasionally the business itself.</span>
          </p>
        )}

        <div className="mt-3 pt-3 border-t border-canvas-border flex items-center justify-between gap-3 flex-wrap">
          {confirmed ? (
            <span className="text-[0.75rem] font-semibold text-compliant-700 inline-flex items-center gap-1.5"><CheckCircle2 size={13} /> Count agreed by {confirmed.by}, {confirmed.at}</span>
          ) : (
            <p className="text-[0.6875rem] text-ink-400 min-w-0 flex-1">The arithmetic is settled above. This is the judgement it cannot make — that this is what a{months.length ? ` ${months.length}-month` : ''} run of this control looks like.</p>
          )}
          {!confirmed && canWrite && !locked && (
            <button onClick={() => { setPopulationFacts(control.id, { countConfirmed: { by: me, at: 'just now' } }); logEvent({ action: 'Update', description: `Agreed the population count for ${control.id} — ${pop.count.toLocaleString()} instances`, module: 'SOX ICFR', entity: 'Evidence' }); }}
              className="shrink-0 h-8 px-3 inline-flex items-center gap-1.5 rounded-md border border-canvas-border bg-canvas-elevated text-[0.75rem] font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-700 transition-colors cursor-pointer"><Check size={12} /> The count reads right</button>
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
/*  `preset` went with the data picker (dev call, Aug 2026) — it existed so a
 *  file already chosen there was not asked for twice. Upload is the only door
 *  now, so the modal always starts empty and always asks both questions. */
function ControlUploadModal({ onClose, onAdd }: { onClose: () => void; onAdd: (name: string, rows: number, origin: FileOrigin) => void }) {
  const [name, setName] = useState('');
  const [rows, setRows] = useState(0);
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
        setRows(readRowCount(f.name));
        setReading(false);
      }, 900);
    };
    input.click();
  };
  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <motion.div role="dialog" aria-modal="true" aria-labelledby="add-source-title" className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()} initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}><DialogFocus onEscape={onClose} />
        <div className="px-5 py-4">
          <h3 id="add-source-title" className="text-[0.875rem] font-bold text-ink-900">Add a source file</h3>
          <p className="text-[0.75rem] text-ink-500 mt-1 leading-relaxed">
            It joins this audit's files, so every other control can draw on it without being asked where it came from again.
          </p>

          {name ? (
            <div className="mt-3 flex items-center gap-2 px-3 py-2.5 rounded-lg border border-canvas-border bg-paper-50/60">
              <FileText size={13} className="text-brand-600 shrink-0" />
              <span className="text-[0.8125rem] font-semibold text-ink-900 truncate min-w-0">{name}</span>
              <span className="text-[0.6875rem] text-ink-400 tabular-nums shrink-0 ml-auto">{rows.toLocaleString()} rows</span>
              <button onClick={() => { setName(''); setOrigin(undefined); }} aria-label="Choose a different file"
                className="p-1 rounded text-ink-400 hover:text-risk-700 cursor-pointer shrink-0"><X size={12} /></button>
            </div>
          ) : (
            <button onClick={pick} disabled={reading}
              className="mt-3 w-full px-3 py-4 rounded-xl border border-dashed border-canvas-border bg-canvas-elevated hover:border-brand-400 hover:bg-brand-50/40 transition-colors cursor-pointer text-[0.8125rem] font-semibold text-ink-700 inline-flex items-center justify-center gap-2">
              {reading ? <><Loader2 size={14} className="animate-spin" /> Reading…</> : <><Upload size={14} className="text-brand-600" /> Choose a file</>}
            </button>
          )}

          <span className="block text-[0.6875rem] font-bold uppercase tracking-wider text-ink-400 mt-4 mb-2">Where did this file come from?</span>
          <OriginPicker value={origin} onPick={setOrigin} disabled={!name} />
          <p className="text-[0.6875rem] text-ink-400 mt-2 leading-relaxed">
            Asked once, here, and recorded on the file. Nothing that reads this file later has to ask again — and it can only be changed back on the file itself, under Configuration.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-canvas-border bg-paper-50/40">
          <button onClick={onClose} className="h-9 px-3.5 text-[0.8125rem] font-semibold text-ink-600 hover:text-ink-900 cursor-pointer">Cancel</button>
          <button disabled={!name || !origin} title={!name ? 'Choose a file first' : !origin ? 'Say where it came from first' : undefined}
            onClick={() => origin && onAdd(name, rows, origin)}
            className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[0.8125rem] font-semibold enabled:hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"><Plus size={13} /> Add file</button>
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
/** The attributes still owed a file, and the way to chase them.
 *
 *  One implementation, two homes: the picker (while the first file is being
 *  chosen) and the source list (every time after that). A gap that only appeared
 *  in the picker vanished the moment the first file landed, which is exactly
 *  when somebody would come back to look for it.
 *
 *  The data is the owner's, so the ask goes to them rather than being worked
 *  around — "आपको RO को रिमाइंडर भी देना पड़ेगा ईमेल पे कि भाई यहाँ आओ और फाइल
 *  अपलोड करो". It lands on the same task list the design documents use.
 */
function AwaitingInputs({ control, canAsk }: { control: Control; canAsk: boolean }) {
  const { remindOwnerForFiles } = useIcfr();
  const logEvent = useAuditLog();
  const { addToast } = useToast();
  const { awaiting } = useMemo(() => expectedInputsFor(control), [control]);
  if (!awaiting.length) return null;
  return (
    <div className="mt-1.5">
      <p className="text-[0.6875rem] text-mitigated-800 leading-relaxed">
        {awaiting.length} attribute{awaiting.length === 1 ? '' : 's'} — {awaiting.map(a => a.code).join(', ')} — {awaiting.length === 1 ? 'is still missing a required file' : 'are still missing required files'}. {awaiting.length === 1 ? 'It is' : 'They are'} uploaded on the attribute's checklist in TOE.
      </p>
      {canAsk && (
        <button onClick={() => {
          const what = `Attribute${awaiting.length === 1 ? '' : 's'} ${awaiting.map(a => a.code).join(', ')} on ${control.id} ${awaiting.length === 1 ? 'is' : 'are'} still missing required files. Send them to the auditor, who attaches them on the attribute's checklist in TOE.`;
          remindOwnerForFiles(control.id, what);
          logEvent({ action: 'Update', description: `Asked the owner of ${control.id} to upload the source data`, module: 'SOX ICFR', entity: 'Evidence' });
        }}
          className="mt-1.5 h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md border border-mitigated-300 bg-canvas-elevated text-[0.6875rem] font-semibold text-mitigated-800 hover:border-mitigated-400 transition-colors cursor-pointer"><Mail size={11} /> Ask the owner to upload</button>
      )}
    </div>
  );
}

/** Pick a file, say what to take out of it, extract.
 *
 *  One implementation, two callers: the first file — which creates the
 *  population — and every file after it, which joins the one already there. A
 *  control rarely stands on one file (dev call, Aug 2026), and the questions are
 *  identical either way, so a second copy of this form would only be a second
 *  place to fix anything wrong with it.
 *
 *  The instance count comes off the SOURCE, not off a figure anyone types: the
 *  same rule the first file has followed since "Expected instances" was cut.
 */
function SourcePickerForm({ control, exclude, submitLabel, onSubmit, seedFile, seedCriteria }: {
  control: Control;
  /** Files already in this population. Offered once, never twice — the same
   *  file added again is the same rows counted again. */
  exclude: string[];
  submitLabel: string;
  onSubmit: (file: AuditFile, criteria: string, count: number) => void;
  /** A refilter re-opens this form on what was extracted last time: the file
   *  stays picked and the filter comes back as it was WRITTEN, not redrafted.
   *  The point of refiltering is to edit an over-inclusive filter, and a fresh
   *  draft would throw away the sentence being corrected. */
  seedFile?: string;
  seedCriteria?: string;
}) {
  const { eng, openAuditId, me, role, registerFile, remindOwnerForFiles } = useIcfr();
  const isAuditor = role === 'auditor';
  const logEvent = useAuditLog();
  const { addToast } = useToast();
  const all = useAuditFiles();
  // Only what was uploaded FOR this audit (user ask, 12 Aug) — the trial balance
  // and ledger attached when the audit was created, plus anything sent in
  // through Upload file since. What this drops is everything the engagement
  // merely holds: scoping trial balances, the system pulls other controls drew
  // on, and the required files attributes elsewhere were proven against. Those
  // were offered because a file the audit demonstrably has is a file this step
  // could use — but they made the list read as the engagement's drive rather than this audit's
  // evidence, and picking one meant drawing a population off a file nobody put
  // here. The registry on Configuration and the working paper still list
  // everything; this narrowing is the picker's alone.
  //
  // The one exception is the file a REFILTER already stands on. Those
  // populations were drawn before this rule, off system pulls, and dropping a
  // population's own source out of the list left the form showing a picked file
  // it could not resolve — nothing selectable, and Extract doing nothing. A file
  // the audit is demonstrably reading is a file this list has to offer.
  const files = all.filter(f => (f.ofAudit || f.name === seedFile) && !exclude.includes(f.name));
  const [picked, setPicked] = useState<string | null>(seedFile ?? null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  // A run on this control from the Ira chat — its own extract shows here as
  // progress; any run holds Extract, so one population is never filtered twice.
  const liveRun = useControlRun(control.id);
  const popRun = !busy && runStageOf(liveRun) === 'population' ? liveRun : null;
  const chosen = files.find(f => f.name === picked);
  const audit = eng.audits.find(a => a.id === openAuditId);
  const from = audit?.windowFrom ?? '';
  const to = audit?.windowTo ?? '';

  const drafted = extractionCriteria(control, from, to, chosen && { system: chosen.system, name: chosen.name });
  // Redrafting on every file pick is the right help on a first extract and the
  // wrong one on a refilter: the restored sentence is the thing being corrected,
  // and picking the file again — or a replacement for one no longer offered —
  // would silently throw it away. So a seeded box is the auditor's to edit, and
  // only an unseeded one redrafts underneath them.
  const [criteria, setCriteria] = useState(seedCriteria ?? drafted);
  const [criteriaSeed, setCriteriaSeed] = useState(drafted);
  if (criteriaSeed !== drafted) { setCriteriaSeed(drafted); if (!seedCriteria) setCriteria(drafted); }
  // The population named a file the audit no longer offers — a seed-only source,
  // or one dropped from the registry since. The filter still comes back; the
  // file has to be picked again, and the form has to say which of the two is
  // missing rather than sitting disabled with a full-looking form.
  const seedFileMissing = !!seedFile && !all.some(f => f.name === seedFile);

  // What the attributes' required files actually are. This is the answer to
  // "which files", and it beats any heuristic: a file uploaded against an
  // attribute is a fact, not a guess.
  const { inputs } = useMemo(() => expectedInputsFor(control), [control]);
  // …of which only the ones actually on this audit can be offered. A required
  // file that nobody uploaded here is still worth knowing about — AwaitingInputs
  // below says who owes it — but it is not a row in this list, and a banner
  // pointing at rows that are not there is worse than no banner.
  const onAudit = new Set(files.map(f => f.name));
  const expected = new Map(inputs.filter(i => onAudit.has(i.name)).map(i => [i.name, i]));
  // The attributes' required files come first. The rest of the audit's files stay
  // selectable — a manual control may list no required file at all, and a step that
  // could offer it nothing would be a step it could never finish — but they are
  // visibly not what anything here reads.
  const ordered = useMemo(
    () => [...files].sort((a, b) => Number(expected.has(b.name)) - Number(expected.has(a.name))),
    [files, inputs],
  );
  const firstOther = ordered.findIndex(f => !expected.has(f.name));
  // The heuristic only runs where there is nothing better. See suggestPopulationFile.
  const hint = useMemo(
    () => (inputs.length ? null : suggestPopulationFile(eng, control, files, requiredDatasetsFor(control).map(r => r.name))),
    [eng, control, files, inputs],
  );

  const submit = () => {
    if (!chosen) return;
    setBusy(true);
    window.setTimeout(() => {
      // A filtered subset, never the whole file — see narrowedCount, which the
      // chat's own extract reads too so both doors produce one population.
      onSubmit(chosen, criteria.trim() || 'No filter applied', narrowedCount(control, chosen));
      setBusy(false);
      setPicked(null);
    }, 1500);
  };

  return (
    <>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-[0.8125rem] font-bold text-ink-900">Select the source</h4>
          <p className="text-[0.75rem] text-ink-500 mt-1 leading-relaxed">The files this control's evidence comes from. Then say what to take out of them: the source is the raw data; the population is what this control actually operated on.</p>
        </div>
        {/* Upload, not "Add a source" (dev call, Aug 2026). The picker it
            replaced offered the platform's whole data catalogue and a
            connect-a-database tab — neither of which is where a control's
            evidence comes from. A file the owner sends is, so that is the one
            door. Hidden while the list is empty: the empty state below carries
            the same action, and two buttons for one job is one button too many. */}
        {files.length > 0 && (
          <button onClick={() => setUploading(true)}
            className="shrink-0 h-8 px-3 inline-flex items-center gap-1.5 rounded-md border border-canvas-border bg-canvas-elevated text-[0.75rem] font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-700 transition-colors cursor-pointer"><FileUp size={12} /> Upload file</button>
        )}
      </div>

      {/* ── which one it would take, and why ─────────────────────────────────
          Stated above the list, not applied to it. Nothing is pre-selected: a
          row already ticked when the screen opens gets confirmed without being
          read, and the auditor owns this choice. The reason is the part worth
          printing — "31 P2P controls draw off it" can be argued with, a
          confidence score cannot. */}
      {hint && (
        <div className="mb-3 rounded-lg border border-brand-200 bg-brand-50/40 px-3.5 py-2.5 flex items-start gap-2">
          <Sparkles size={13} className="text-brand-600 mt-0.5 shrink-0" />
          <p className="text-[0.75rem] text-ink-700 leading-relaxed min-w-0">
            <span className="font-semibold text-ink-900">Likely {hint.name}</span> — {hint.reason}. Pick it below if you agree.
          </p>
        </div>
      )}
      {/* ── where the list comes from ────────────────────────────────────────
          Said out loud, because otherwise the ordering is a mystery: these are
          the files the control's own attributes were proven against, and
          picking anything else is picking a file no attribute here names.

          Two versions now that the list holds only what was uploaded for this
          audit. A required file that IS here is still called out and still
          sorts first. One that is NOT here used to be pointed at as "first in
          the list" while not being in the list at all — so it is named instead,
          as a file this control reads that somebody still has to send in. */}
      {inputs.length > 0 && (
        <div className="mb-3 rounded-lg border border-brand-200 bg-brand-50/40 px-3.5 py-2.5 flex items-start gap-2">
          <Paperclip size={13} className="text-brand-600 mt-0.5 shrink-0" />
          <div className="min-w-0">
            {expected.size > 0 ? (
              <p className="text-[0.75rem] text-ink-700 leading-relaxed">
                <span className="font-semibold text-ink-900">{expected.size === 1 ? 'One file is' : `${expected.size} files are`} what this control reads</span> — {expected.size === 1 ? 'a required file' : 'required files'} on its attributes. {expected.size === 1 ? 'It is' : 'They are'} first in the list.
              </p>
            ) : (
              <p className="text-[0.75rem] text-ink-700 leading-relaxed">
                <span className="font-semibold text-ink-900">{inputs.length === 1 ? 'The file' : 'The files'} this control reads {inputs.length === 1 ? 'is' : 'are'} not on this audit</span> — {inputs.map(i => i.name).join(', ')}. {inputs.length === 1 ? 'It was' : 'They were'} uploaded as {inputs.length === 1 ? 'a required file' : 'required files'} on {inputs.length === 1 ? 'an attribute' : 'its attributes'}, but nobody has uploaded {inputs.length === 1 ? 'it' : 'them'} here. Upload above, or draw this population off a file that is.
              </p>
            )}
            {/* The other half of the truth. An attribute still missing a
                required file is a thing somebody owes, and hiding it here
                would make the list look complete when it is not. */}
            <AwaitingInputs control={control} canAsk={isAuditor} />
          </div>
        </div>
      )}
      <div className="rounded-xl border border-canvas-border overflow-hidden mb-4">
        {files.length === 0 ? (
          /* Nothing left to draw on — either the audit arrived without a trial
             balance or general ledger, or every file it has is already in this
             population. Both are fixed the same way: upload one, answer where
             it came from, and it joins the audit's files so the next control
             finds it waiting rather than uploading it again. */
          <div className="px-4 py-5 text-center">
            <span className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 inline-flex items-center justify-center"><FileUp size={17} /></span>
            <p className="text-[0.8125rem] font-semibold text-ink-800 mt-2">{exclude.length ? 'Every file on this audit is already in this population' : 'No source data on this audit yet'}</p>
            <p className="text-[0.75rem] text-ink-500 mt-1 leading-relaxed max-w-104 mx-auto">
              {exclude.length
                ? 'Upload another one and it joins the audit\'s sources — every other control can then draw on it without being asked where it came from again.'
                : 'No trial balance or general ledger was attached when this audit was created. Upload what this control operates on and it joins the audit\'s sources — every other control can then draw on it without being asked where it came from again.'}
            </p>
            <button onClick={() => setUploading(true)}
              className="mt-3 h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[0.8125rem] font-semibold hover:bg-brand-700 transition-colors cursor-pointer"><FileUp size={14} /> Upload file</button>
          </div>
        ) : ordered.map((f, idx) => {
          const on = picked === f.name;
          // No answer, no population. Removing "unknown" means a file nobody
          // can place is not a source you can build a test on.
          const usable = fileUsable(f);
          const wanted = expected.get(f.name);
          return (
            <div key={f.name}>
              {/* The line between the attributes' required files and everything else.
                  Only drawn when there is something on both sides of it. */}
              {inputs.length > 0 && idx === firstOther && idx > 0 && (
                <div className="px-3 py-1.5 bg-paper-50/70 border-b border-canvas-border text-[0.6875rem] font-bold uppercase tracking-wide text-ink-500">
                  Not a required file on any of this control's attributes
                </div>
              )}
              <button onClick={() => usable && setPicked(f.name)} disabled={!usable}
                title={usable ? undefined : 'Say where this file came from on its file record before drawing a population off it'}
                className={cn('w-full text-left flex items-center gap-2.5 px-3 py-2.5 border-b border-canvas-border last:border-b-0 transition-colors',
                  !usable ? 'opacity-55 cursor-not-allowed' : on ? 'bg-brand-50 cursor-pointer' : 'hover:bg-paper-50 cursor-pointer')}>
                <span className={cn('w-3.5 h-3.5 rounded-full border-[3px] shrink-0', on ? 'border-brand-600' : 'border-ink-300')} />
                {/* a pull from a system reads differently from a file somebody
                    sent, and the icon is the fastest way to say which */}
                {f.systemFetched
                  ? <Database size={13} className={cn('shrink-0', on ? 'text-brand-600' : 'text-ink-400')} />
                  : <FileText size={13} className={cn('shrink-0', on ? 'text-brand-600' : 'text-ink-400')} />}
                <span className={cn('text-[0.8125rem] truncate min-w-0', on ? 'font-semibold text-brand-700' : 'text-ink-800')}>{f.name}</span>
                {/* Which attributes read it. The reason a file is at the top of
                    the list belongs on the row, not in a paragraph above it. */}
                {wanted && (
                  <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 text-[0.6875rem] font-bold whitespace-nowrap">
                    <Paperclip size={9} /> {wanted.attributes.join(', ')}
                  </span>
                )}
                {f.system && <span className="shrink-0 text-[0.6875rem] text-ink-400 hidden lg:inline">{f.system}</span>}
                {/* provenance, inherited — stated on every file so the choice of
                    source is made knowing what it is */}
                <span className={cn('shrink-0 px-1.5 py-0.5 rounded text-[0.6875rem] font-bold uppercase tracking-wide whitespace-nowrap',
                  !usable ? 'bg-mitigated-50 text-mitigated-800' : f.origin === 'Client-prepared' ? 'bg-paper-100 text-ink-600' : 'bg-compliant-50 text-compliant-700')}>
                  {originLabel(f)}
                </span>
                {/* A PDF has no rows to count, so none is claimed for it. */}
                <span className="text-[0.6875rem] text-ink-400 tabular-nums shrink-0 ml-auto">{hasRowCount(f.name) ? `${f.rows.toLocaleString()} rows` : 'no row count'}</span>
                <span className="text-[0.6875rem] text-ink-400 shrink-0 hidden sm:inline">{f.from}</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* One statement, not two boxes. A type-and-account pair only ever
          described a spreadsheet someone had already shaped; pulled from a
          system, the criteria ARE the query and no fixed set of fields fits
          them. Drafted from the control and its window, then edited. */}
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="block text-[0.6875rem] font-bold uppercase tracking-wider text-ink-400">Extraction criteria</span>
        {/* A refilter is not a draft — the sentence in the box is the auditor's
            own, and calling it drafted would invite them to trust it as new. */}
        {seedCriteria
          ? <span className="inline-flex items-center gap-1 text-[0.6875rem] text-ink-400"><RotateCcw size={11} className="text-ink-400" /> as you wrote it</span>
          : <IraDrafted />}
      </div>
      <textarea value={criteria} onChange={e => setCriteria(e.target.value)} rows={2}
        aria-label="Extraction criteria"
        placeholder="What to take out of the source — in plain English, for the reviewer."
        className="w-full rounded-lg border border-canvas-border bg-canvas-elevated px-2.5 py-2 text-[0.8125rem] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-200 resize-none" />
      {/* The window is stated, not asked for — it is the audit's own, which the
          form was already defaulting to, and the IPE is what proves the report
          actually covers it. */}
      <p className="mt-2 text-[0.6875rem] text-ink-400">
        {from && to ? <>Period covered · {from} – {to} — the audit's own window.</> : <>Period covered · the audit's own window.</>}{' '}
        The IPE check on this report is what confirms it was run over that period.
      </p>

      {popRun && <div className="mt-3"><LiveRunLine run={popRun} /></div>}
      <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[0.6875rem] text-ink-400 min-w-0">
          {liveRun && !popRun && !busy ? busyNote(liveRun) : !chosen ? (seedFileMissing
            ? <>The audit no longer offers <span className="font-semibold text-ink-600">{seedFile}</span> — pick the file this filter should run against.</>
            : 'Pick the source file first.')
            : hasRowCount(chosen.name)
              ? <>Filtering <span className="tabular-nums font-semibold text-ink-600">{chosen.rows.toLocaleString()}</span> rows by: {criteria || 'nothing yet'}</>
              : <>Filtering {chosen.name} by: {criteria || 'nothing yet'} — a PDF has no rows to count.</>}
        </p>
        <button disabled={!chosen || busy || !!liveRun} onClick={submit}
          title={liveRun && !busy ? busyNote(liveRun) : !chosen ? 'Pick a source file first' : undefined}
          className="shrink-0 h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[0.8125rem] font-semibold enabled:hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer">
          {busy ? <><Loader2 size={14} className="animate-spin" /> Extracting…</> : <><Database size={14} /> {submitLabel}</>}
        </button>
      </div>

      {uploading && (
        <ControlUploadModal onClose={() => setUploading(false)}
          onAdd={(name, rows, origin) => {
            // A trial balance uploaded here is a trial balance, not a nameless
            // "source file" — the registry on Configuration lists it beside the
            // ones attached at creation, so it has to read like them.
            registerFile({ name, kind: guessFileKind(name), rows, from: `Uploaded on ${control.id}`, uploadedBy: me, uploadedAt: 'just now', origin, originBy: me, originAt: 'just now' });
            logEvent({ action: 'Upload', description: `Added "${name}" to the audit's files from ${control.id} — ${origin.toLowerCase()}, ${rows.toLocaleString()} rows`, module: 'SOX ICFR', entity: 'Evidence' });
            setPicked(name);
            setUploading(false);
          }} />
      )}
    </>
  );
}

function PopulationSection({ control, canEdit, locked: gated = false }: { control: Control; canEdit: boolean; locked?: boolean }) {
  const { eng, openAuditId, role, me, setPopulation, clearPopulation, addPopulationSource, removePopulationSource, setSourceRole, lockPopulation } = useIcfr();
  const logEvent = useAuditLog();
  const { addToast } = useToast();
  const files = useAuditFiles();
  const pop = control.operating.population;
  const audit = eng.audits.find(a => a.id === openAuditId);
  const version = `POP-${audit ? ROUND_TAG[audit.round] : 'v1'}`;
  const canWrite = canEdit && !isControlLockedIn(eng, control);
  const isAuditor = role === 'auditor' && canWrite;
  // The first line stops at the extract. Everything past it — proving the
  // report, locking, and every step the lock opens — is the audit's own work,
  // and the owner seeing it is the independence problem the whole page is
  // arranged around.
  const isOwnerView = role === 'risk-owner';
  // The window the audit actually tests, as real dates. The coverage check
  // measures the filter against this, and prose like 'Jan 2026' cannot be
  // measured — so the filter asks for dates rather than a label.
  // Narrowed to the LIVE VERSION's window. A control rebuilt in November is not
  // tested on April's transactions, and a population extracted across the whole
  // year would be pulling from months this version of the control did not exist —
  // which is exactly what `effectiveDate` has been warning about in prose since
  // before there was anywhere to act on it. Unchanged on a control never rebuilt.
  const vWin = audit ? versionWindow(control, audit) : null;
  const winFrom = vWin?.from ?? '';
  const winTo = vWin?.to ?? '';

  const [withdrawing, setWithdrawing] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  // ── the filter was wrong but the file was right ─────────────────────────────
  // Rebuilt Aug 2026. Refilter existed, and went out with the multi-file rewrite
  // when the extract form's state moved into SourcePickerForm and the parent
  // could no longer seed it — which left withdraw as the only way out of an
  // over-inclusive filter, i.e. start the whole step again and retype the
  // sentence from a fresh draft. The seed is held here because dropping the
  // population is what puts the form back on screen, so it has to outlive it.
  const [refilterSeed, setRefilterSeed] = useState<{ file: string; criteria?: string } | null>(null);
  const [confirmRefilter, setConfirmRefilter] = useState(false);
  // Adding a second file is deliberately a step the auditor takes, not a form
  // sitting open under a finished population: the common case is one file, and
  // a picker that is always there reads as work still owed.
  const [addingSource, setAddingSource] = useState(false);
  const [dropping, setDropping] = useState<PopulationSource | null>(null);
  // Turning a sampled file into an assisting table throws its items away, so
  // it is confirmed. Turning one back is not — an assisting table has nothing
  // to lose.
  const [roleChange, setRoleChange] = useState<{ source: PopulationSource; drawn: number } | null>(null);
  const sources = populationSources(control);

  // The extract itself lives in SourcePickerForm — the first file and every file
  // after it ask the same two questions, so they are asked in one place.
  const extract = (chosen: AuditFile, criteria: string, narrowed: number) => {
    // The record itself is built by `populationFrom`, which the chat's extract
    // calls too — one population, whichever door it was run from.
    setPopulation(control.id, populationFrom(control, chosen, criteria, narrowed, { version, me, from: winFrom, to: winTo }));
    setRefilterSeed(null);
    logEvent({ action: 'Run', description: `Extracted the population for ${control.id} — ${narrowed.toLocaleString()} instances from ${chosen.rows.toLocaleString()} rows in ${chosen.name}`, module: 'SOX ICFR', entity: 'Evidence' });
  };

  /** Drop the extract and re-open the form on what it was filtered with, so an
   *  over-inclusive filter is a sentence to edit rather than a step to redo.
   *  Same drop as a withdrawal — the items and their results were drawn off the
   *  filter being corrected, so they cannot survive it. */
  const beginRefilter = () => {
    if (!pop) return;
    setRefilterSeed({
      file: pop.sourceFile ?? sources[0]?.file ?? '',
      // 'No filter applied' is the absence of a filter, not one worth restoring.
      criteria: pop.criteria && pop.criteria !== 'No filter applied' ? pop.criteria : undefined,
    });
    clearPopulation(control.id);
    setConfirmRefilter(false);
    logEvent({ action: 'Update', description: `Refiltering the population for ${control.id} — the extract was dropped and the filter returned for editing`, module: 'SOX ICFR', entity: 'Evidence' });
  };

  const addSource = (chosen: AuditFile, criteria: string, narrowed: number) => {
    addPopulationSource(control.id, { file: chosen.name, rows: chosen.rows, count: narrowed, criteria });
    setAddingSource(false);
    logEvent({ action: 'Update', description: `Added ${chosen.name} to the population for ${control.id} — ${narrowed.toLocaleString()} instances from ${chosen.rows.toLocaleString()} rows`, module: 'SOX ICFR', entity: 'Evidence' });
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
  // countVerdict is no longer read on this screen — its row is parked. It still
  // runs inside the working paper, which prints the extracted-vs-expected
  // comparison for a reviewer reperforming the extract.
  // const cv = countVerdict(control);
  // coverageVerdict went the same way — the Period covered row is parked, and
  // the check that replaced it reads the verdict for itself inside the IPE test.
  // const gv = coverageVerdict(control, winFrom, winTo);
  // Both went with the Count row: needsExpected only ever decided whether to
  // show the expected-count recorder, and expectedDraft was that input's state.
  // const needsExpected = pop?.expectedCount == null && derivedRunCount(control, pop?.filterFrom, pop?.filterTo) == null;
  // const [expectedDraft, setExpectedDraft] = useState('');
  const ready = populationReady(control, winFrom, winTo);
  // Named in the order the step is worked, so the message always points at the
  // next thing to do rather than the last thing outstanding.
  const ipe = control.operating.ipe;
  // Everything else on this step is parked, so the only thing that can hold the
  // lock is the report — and its four checks now carry the period coverage and
  // the completeness those parked rows used to compute.
  const missing =
          // Named as its own reason rather than folded into the catch-all: the
          // auditor who cannot lock needs to be told the block is upstream of
          // the population entirely, not in the filter they were just editing.
          !ipe ? 'Register the report this population came out of, and prove it, before locking.'
            : ipe.conclusion === 'Not reliable' ? 'The report behind this population is not reliable — nothing can be locked off it.'
              : ipe.conclusion === 'Not tested' ? 'Finish the IPE test on the report before locking.'
                : 'A check that did not hold needs resolving before locking.';

  // Locked until the reviewer approves TOD (S6, A36). Named `gated` in here
  // because `locked` already means the population's own lock. Nothing live sits
  // behind it — a picker under a lock is a pen that lands nowhere. The owner is
  // told what to wait for without being told how TOD went.
  if (gated) {
    const concluded = trackResult(control.design) !== 'Not tested';
    // Pending until year end (A29) outranks the approval: it is the reason that
    // decides this audit, and TOD's state has nothing to do with it.
    const held = operatingHeld(control, audit);
    if (held) return <HeldState held={held} yearEndHint={`This control runs once a year, so there is nothing to pull for it before the year closes.${pop ? ' What was already extracted stays as it is.' : ''}`} />;
    return (
      <div className="p-5">
        <EmptyState icon={<Lock size={18} />} title="Population is locked"
          hint={`${isOwnerView
            ? 'The auditor’s design test comes first, and the reviewer approves it. Uploading and filtering the data opens after that.'
            : concluded
              ? `TOD is concluded. Waiting for ${eng.reviewer || 'the reviewer'} to approve the design — the population opens as soon as it is approved.`
              : 'Finish TOD first — mark the design effective — then the reviewer approves it. Data is only worth pulling against a design someone has checked.'}${pop ? ' What was already extracted stays as it is.' : ''}`}>
          {!isOwnerView && <span className="inline-flex items-center gap-1.5 text-[0.75rem] text-ink-500"><span>TOD is currently</span><TrackPill c={trackResult(control.design)} /></span>}
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="p-5">
      {!pop ? (
        canWrite ? (
          <>
            {refilterSeed && (
              <p className="mb-3 text-[0.75rem] text-ink-600 bg-paper-50/60 border border-canvas-border rounded-lg px-3 py-2 flex items-start gap-1.5">
                <Filter size={13} className="mt-0.5 shrink-0 text-ink-400" />
                <span>The extract is gone and the filter is back as you wrote it. Edit it and extract again — nothing else about this control has moved.</span>
              </p>
            )}
            <SourcePickerForm control={control} exclude={[]} submitLabel={refilterSeed ? 'Extract again' : 'Extract population'} onSubmit={extract}
              seedFile={refilterSeed?.file} seedCriteria={refilterSeed?.criteria} />
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
                {/* Only where every file actually has rows to count. A total
                    that silently skipped a PDF would be a total nobody can
                    reconcile to the files listed under it. */}
                {pop.sourceCount != null && sources.every(s => hasRowCount(s.file)) && <span className="text-[0.75rem] font-medium text-ink-400"> from {pop.sourceCount.toLocaleString()} rows</span>}
              </p>
              {/* The source line used to name one file and one filter. It names
                  the count of them now — the files themselves are listed below,
                  because a control can stand on several and a single line could
                  only ever have shown the first. */}
              <p className="text-[0.75rem] text-ink-500 mt-1.5">
                <span className="text-ink-400">Filtered out of</span> {sources.length} source file{sources.length === 1 ? '' : 's'}
              </p>
              {locked && <p className="text-[0.6875rem] text-ink-400 mt-1.5">Locked by {pop.locked!.by}, {pop.locked!.at}</p>}
            </div>
            <div className="shrink-0 flex items-center gap-2">
              {/* the population is a number until somebody can look at it */}
              <button onClick={() => setPreviewing(true)}
                className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md border border-canvas-border text-[0.75rem] font-semibold text-ink-600 hover:text-ink-900 hover:border-ink-300 transition-colors cursor-pointer"><Eye size={11} /> Preview</button>
              {/* Refilter sits before Withdraw because it is the smaller of the
                  two and answers the commoner mistake: the file was right, the
                  filter was not. Both drop the same things — this one hands the
                  filter back instead of a blank form.

                  Offered on a LOCKED population too, exactly as Withdraw is: the
                  wrong filter is normally found after testing has started, which
                  is to say after the lock. Hiding it there would leave the case
                  it exists for with no answer but a full restart. */}
              {isAuditor && (
                <button onClick={() => (control.operating.sampling ? setConfirmRefilter(true) : beginRefilter())}
                  className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md border border-canvas-border text-[0.75rem] font-semibold text-ink-600 hover:text-brand-700 hover:border-brand-300 transition-colors cursor-pointer"><Filter size={11} /> Refilter</button>
              )}
              {isAuditor && (
                <button onClick={() => setWithdrawing(true)}
                  className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md border border-canvas-border text-[0.75rem] font-semibold text-ink-500 hover:text-risk-700 hover:border-risk-300 transition-colors cursor-pointer"><RotateCcw size={11} /> Withdraw</button>
              )}
            </div>
          </div>

          {unfiltered && (
            <p className="mt-3 text-[0.75rem] text-mitigated-800 bg-mitigated-50/60 border border-mitigated-200 rounded-lg px-3 py-2 flex items-start gap-1.5">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <span>The population is the same size as the files it came from — nothing was filtered out. Unless this control really does operate on every row, refilter it down first.</span>
            </p>
          )}

          {/* ── the files it stands on ──────────────────────────────────────
              One row per file, with what the file held and what this control's
              filter left of it. A control rarely stands on one (dev call, Aug
              2026 — "मल्टीपल फाइल्स वो डाल सकता है"), and each row carries its
              own proof and its own draw, so the state of each file's work is
              readable without opening anything. */}
          <div className="mt-4">
            <div className="flex items-center justify-between gap-3 mb-2">
              <span className="block text-[0.6875rem] font-bold uppercase tracking-wider text-ink-400">Source files · {sources.length}</span>
              {isAuditor && !locked && !addingSource && (
                <button onClick={() => setAddingSource(true)}
                  className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md border border-canvas-border bg-canvas-elevated text-[0.75rem] font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-700 transition-colors cursor-pointer"><FileUp size={11} /> Add file</button>
              )}
            </div>
            <div className="rounded-xl border border-canvas-border overflow-hidden">
              {sources.map(s => {
                const rec = files.find(f => f.name === s.file);
                const checks = ipeChecksFor(control, s.id);
                const proven = checks.filter(k => k.result === 'Pass').length;
                const drawn = samplesFor(control, s.id).length;
                return (
                  <div key={s.id} className="border-b border-canvas-border last:border-b-0 px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      {rec?.systemFetched ? <Database size={13} className="shrink-0 text-ink-400" /> : <FileText size={13} className="shrink-0 text-ink-400" />}
                      <span className="text-[0.8125rem] font-semibold text-ink-800 truncate min-w-0">{s.file}</span>
                      {rec && (
                        <span className={cn('shrink-0 px-1.5 py-0.5 rounded text-[0.6875rem] font-bold uppercase tracking-wide whitespace-nowrap',
                          !fileUsable(rec) ? 'bg-mitigated-50 text-mitigated-800' : rec.origin === 'Client-prepared' ? 'bg-paper-100 text-ink-600' : 'bg-compliant-50 text-compliant-700')}>
                          {originLabel(rec)}
                        </span>
                      )}
                      <span className="ml-auto shrink-0 text-[0.6875rem] text-ink-500 tabular-nums">
                        <span className="font-semibold text-ink-700">{s.count.toLocaleString()}</span>
                        {hasRowCount(s.file) ? ` of ${s.rows.toLocaleString()} rows` : ' instances'}
                      </span>
                      {/* Dropping the LAST file is a withdrawal, and Withdraw is
                          already the button for that — so this one only appears
                          when there is something left behind after it. */}
                      {isAuditor && !locked && sources.length > 1 && (
                        <button onClick={() => setDropping(s)} title={`Drop ${s.file}`} aria-label={`Drop ${s.file}`}
                          className="shrink-0 h-7 w-7 inline-flex items-center justify-center rounded-md border border-canvas-border text-ink-400 hover:border-risk-300 hover:text-risk-600 transition-colors cursor-pointer"><Trash2 size={12} /></button>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2.5 flex-wrap pl-5.75">
                      {/* Population or assisting table. Asked on the row because
                          it is a fact about THIS file, and because it changes
                          what the two numbers beside it mean: an assisting
                          table's rows are not instances of the control and are
                          never counted as any. */}
                      {isAuditor && !locked ? (
                        <select value={s.role ?? 'population'} aria-label={`What ${s.file} is to this control`}
                          onChange={e => {
                            const next = e.target.value as SourceRole;
                            if (next === 'assisting' && drawn > 0) { setRoleChange({ source: s, drawn }); return; }
                            setSourceRole(control.id, s.id, next);
                          }}
                          className={cn('h-6 pl-1.5 pr-5 rounded border text-[0.6875rem] font-bold uppercase tracking-wide cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-200',
                            isAssisting(s) ? 'border-canvas-border bg-paper-50 text-ink-500' : 'border-brand-200 bg-brand-50 text-brand-700')}>
                          <option value="population">Population</option>
                          <option value="assisting">Assisting</option>
                        </select>
                      ) : (
                        <span className={cn('px-1.5 py-0.5 rounded text-[0.6875rem] font-bold uppercase tracking-wide',
                          isAssisting(s) ? 'bg-paper-100 text-ink-600' : 'bg-brand-50 text-brand-700')}>
                          {isAssisting(s) ? 'Assisting' : 'Population'}
                        </span>
                      )}
                      <span className="text-[0.6875rem] text-ink-400 min-w-0 truncate">{s.criteria ?? 'No filter applied'}</span>
                      {/* How the testing of this file is going — how much of it was
                          drawn, how far its IPE checks have got — is the auditor's
                          read, not the owner's. They supplied the file; how much of
                          it is being looked at tells them how closely to expect to
                          be examined, which is the thing independence turns on. */}
                      {!isOwnerView && <>
                        <span className="text-[0.6875rem] text-ink-400">·</span>
                        <span className={cn('text-[0.6875rem] font-semibold', checks.length && proven === checks.length ? 'text-compliant-700' : 'text-ink-400')}>
                          {checks.length ? `${proven}/${checks.length} checks proven` : 'not registered yet'}
                        </span>
                      </>}
                      {/* An assisting table is proven and then left alone. Said
                          once, here, so its blank sample column reads as correct
                          rather than as work nobody got to. */}
                      {isAssisting(s)
                        ? <><span className="text-[0.6875rem] text-ink-400">·</span><span className="text-[0.6875rem] text-ink-500">joined by the workflow, never sampled</span></>
                        : !isOwnerView && drawn > 0 && <><span className="text-[0.6875rem] text-ink-400">·</span><span className="text-[0.6875rem] font-semibold text-brand-700">{drawn} sampled</span></>}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-1.5 text-[0.6875rem] text-ink-400 leading-relaxed">
              Each file is proved on its own and sampled on its own. The verdict on the report is one for all of them — a check that fails on any file sinks the lot.
            </p>
            {/* ── still owed ──────────────────────────────────────────────────
                A control with a population can still be short a file: an
                attribute still missing a required file owes one, and until
                this was said here the only place it appeared was
                the picker — which is closed the moment the first file lands. A
                gap you can only see while doing something else is a gap nobody
                chases. */}
            <AwaitingInputs control={control} canAsk={isAuditor} />
            {addingSource && (
              <div className="mt-3 rounded-xl border border-canvas-border bg-paper-50/50 p-3.5">
                <SourcePickerForm control={control} exclude={sources.map(s => s.file)} submitLabel="Add to the population" onSubmit={addSource} />
                <div className="mt-2.5 flex justify-end">
                  <button onClick={() => setAddingSource(false)} className="h-8 px-3 text-[0.75rem] font-semibold text-ink-500 hover:text-ink-900 cursor-pointer">Cancel</button>
                </div>
              </div>
            )}
          </div>

          <div className="ac-div my-4" />

          {/* ── PARKED (Aug 2026) — "Checked automatically" ────────────────
              The Count row went first; Period covered is the last of the two,
              and the heading goes with it because there is nothing left under
              it. Both were arithmetic the application had already done, stated
              back as checks that went green on their own — which read as the
              IPE checks asked a second time.

              Period coverage is NOT lost: it is the fourth manual check in the
              IPE test now, with the same window and empty-month facts shown as
              context beside it. That is the honest version of the question —
              the sum never knew whether an empty March is a hole in the extract
              or a month the control did not run in, and it went green either
              way.

              coverageVerdict and monthlyBreakdown still run: the check reads
              them for that context, and the working paper still prints the
              comparison.

          // {/* ── what the application worked out for itself ──────────────────
          // Nobody is asked to agree with arithmetic. The period and the count
          // are both things it already holds the numbers for, so it does the
          // sum and states the answer. A failed sum is argued with in writing,
          // not ticked past.
          //
          // Period first, then the count — so the count's arithmetic and the
          // count's context sit next to each other rather than either side of
          // a check about something else. *⁄}
          // <span className="block text-[0.6875rem] font-bold uppercase tracking-wider text-ink-400 mb-2">Checked automatically</span>
          // <div className="space-y-1.5">
          // <VerdictRow label="Period covered" v={gv} note={pop.coverageNote} canWrite={canWrite && !locked}
          // placeholder="e.g. the system was cut over on 1 Mar — pre-cutover instances are in the legacy extract, tested separately"
          // onNote={t => setPopulationFacts(control.id, { coverageNote: t })}
          // onRefilter={isAuditor ? refilter : undefined} />
          // {/* ── PARKED (Aug 2026) — the Count row ──────────────────────
          // "1,223 extracted against 1,200 expected — 23 over, 2%, inside
          // the 5% band." Arithmetic the application had already done,
          // stated back as a check that goes green on its own, and the same
          // ground the IPE Completeness check covers by asking whether the
          // report was whole in the first place.
          //
          // Its expected-count recorder went with it — that input only ever
          // existed to feed this comparison. Period covered stays; it is the
          // one of the two that says something the filter cannot.
          //
          // The lock no longer waits on a countNote either (see
          // populationReady): this row was the only place to write one.
          //
          // // <VerdictRow label="Count" v={cv} note={pop.countNote} canWrite={canWrite && !locked}
          // // placeholder="e.g. the expected figure was last year's estimate — volumes rose after the new vendor onboarding"
          // // onNote={t => setPopulationFacts(control.id, { countNote: t })}
          // // onRefilter={isAuditor ? refilter : undefined}>
          // // {cv && cv.blocks && needsExpected && (
          // // <div className="mt-2 flex items-center gap-2">
          // // <input type="number" min={1} value={expectedDraft} onChange={e => setExpectedDraft(e.target.value)} placeholder="expected"
          // // disabled={!canWrite || locked}
          // // className="w-28 h-8 px-2.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.8125rem] tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:opacity-50" />
          // // <button disabled={!canWrite || locked || !Number(expectedDraft)}
          // // onClick={() => setPopulationFacts(control.id, { expectedCount: Number(expectedDraft) })}
          // // className="h-8 px-3 rounded-md border border-canvas-border text-[0.75rem] font-semibold text-ink-700 enabled:hover:border-ink-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer">Record</button>
          // // <span className="text-[0.6875rem] text-ink-400">then the comparison is ours to make</span>
          // // </div>
          // // )}
          // // </VerdictRow>
          // *⁄}
          // </div>
          */}

          {/* ── PARKED (Aug 2026) — "Does the count read right?" ───────────
              The month bars, the prior round's figure and the agreement button
              that set countConfirmed. CountContext is still defined below, so
              restoring the step's judgement layer is uncommenting one line.

              Its copy had also gone stale: "The arithmetic is settled above"
              pointed at the two computed rows parked earlier the same day, so
              by then it named something no longer on the screen.

              The count agreement no longer gates the lock either — see
              populationReady. What the lock waits on now is the report, and its
              four checks are the ones a person actually performs.

          // {/* ── the count, with what it takes to judge it ───────────────────
          // Nobody can say whether 1,418 is the right number by looking at
          // 1,418. The months it falls across and the same control's figure
          // last round are what turn it into something a person can agree or
          // disagree with — so they are put on the screen, and the agreement
          // is asked for afterwards rather than instead. *⁄}
          // <CountContext control={control} canWrite={canWrite && !locked} locked={locked} />
          */}

          {/* ── the report itself, under test ───────────────────────────────
              Last thing before the lock, because it is the last thing that has
              to be true: the count and the period check what the FILTER did,
              this checks whether the thing filtered was worth filtering. */}
          {!isOwnerView && (
            <div id="ipe-test" className="mt-4 scroll-mt-4">
              <IpeSection control={control} canWrite={canWrite && !locked} isAuditor={isAuditor} />
            </div>
          )}

          {/* Where the data came from is NOT asked here. It was answered when
              the file entered the audit, it is shown read-only on the source
              line above, and it is changed on the file record — never on a
              control that happens to be reading the file today. */}

          <div id="lock-population" className="mt-3 scroll-mt-4 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[0.6875rem] text-ink-400 min-w-0">
              {/* The owner is told what happens next without being told what is
                  being looked for. "Locked" is a fact about their data; the
                  checks behind it are not theirs to read. */}
              {isOwnerView
                ? locked
                  ? 'The auditor has locked this. It is the version their testing draws on — a later round re-versions rather than editing it.'
                  : 'The auditor tests the report this came out of, then locks it. Nothing here is final until they do.'
                : locked ? 'Every later step draws off this version. A later round re-versions rather than editing it.'
                  : ready ? 'Nothing downstream runs until the population is locked.'
                    : missing}
            </p>
            {!locked && isAuditor && (
              <button disabled={!ready} title={ready ? undefined : missing}
                onClick={() => { lockPopulation(control.id); logEvent({ action: 'Update', description: `Locked the population for ${control.id}`, module: 'SOX ICFR', entity: 'Evidence' });  }}
                className="shrink-0 h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[0.8125rem] font-semibold enabled:hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"><Lock size={14} /> Lock the population</button>
            )}
            {locked && <span className="shrink-0 inline-flex items-center gap-1.5 text-[0.75rem] font-bold text-compliant-700"><Database size={13} /> Locked</span>}
          </div>
        </>
      )}

      {previewing && pop && createPortal(<PopulationPreviewModal control={control} onClose={() => setPreviewing(false)} />, document.body)}

      {/* PARKED (dev call, Aug 2026) — the platform's data picker used to open
          here as "Add a source", offering the whole catalogue plus a
          connect-a-database tab. Both are gone with it: a control's population
          comes from the file its evidence came from, not from browsing the
          platform. The connect path also carried the one way to skip the
          provenance question (systemFetched IS the answer — see fileUsable), so
          every source now arrives through the upload modal and every source is
          asked where it came from. The upload modal itself moved into
          SourcePickerForm, which is the only place a file is chosen now. */}

      {/* ── refilter, once a sample has been drawn ──────────────────────────
          Only asked when there is something to lose. Before the draw, dropping
          an extract to re-run it costs nothing and a dialog would be noise. */}
      {confirmRefilter && createPortal(
        <div className="modal-backdrop" onClick={() => setConfirmRefilter(false)}>
          <motion.div role="dialog" aria-modal="true" aria-labelledby="refilter-title" className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()} initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}><DialogFocus onEscape={() => setConfirmRefilter(false)} />
            <div className="px-5 py-4">
              <div className="flex items-start gap-3">
                <span className="w-9 h-9 rounded-lg bg-mitigated-50 text-mitigated-800 inline-flex items-center justify-center shrink-0"><Filter size={17} /></span>
                <div className="min-w-0">
                  <h3 id="refilter-title" className="text-[0.875rem] font-bold text-ink-900">Refilter this population?</h3>
                  <p className="text-[0.75rem] text-ink-500 mt-1">
                    The {control.operating.sampling!.size} items drawn off it go, and so does every result recorded against them — they were drawn from the filter you are about to change.
                    {sources.length > 1 && <> The other {sources.length - 1} source file{sources.length === 2 ? '' : 's'} go too, and can be added back after.</>}
                  </p>
                  <p className="text-[0.75rem] text-ink-600 mt-2">Your filter comes straight back into the form, so you edit it rather than write it again.</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-canvas-border bg-paper-50/40">
              <button onClick={() => setConfirmRefilter(false)} className="h-9 px-3.5 text-[0.8125rem] font-semibold text-ink-600 hover:text-ink-900 cursor-pointer">Keep it</button>
              <button onClick={beginRefilter}
                className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[0.8125rem] font-semibold hover:bg-brand-700 transition-colors cursor-pointer"><Filter size={13} /> Refilter</button>
            </div>
          </motion.div>
        </div>,
        document.body)}

      {withdrawing && createPortal(
        <div className="modal-backdrop" onClick={() => setWithdrawing(false)}>
          <motion.div role="dialog" aria-modal="true" aria-labelledby="withdraw-population-title" className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()} initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}><DialogFocus onEscape={() => setWithdrawing(false)} />
            <div className="px-5 py-4">
              <div className="flex items-start gap-3">
                <span className="w-9 h-9 rounded-lg bg-risk-50 text-risk-700 inline-flex items-center justify-center shrink-0"><AlertTriangle size={17} /></span>
                <div>
                  <h3 id="withdraw-population-title" className="text-[0.875rem] font-bold text-ink-900">Withdraw this population?</h3>
                  <p className="text-[0.75rem] text-ink-500 mt-1">All {sources.length} source file{sources.length === 1 ? '' : 's'} go, and so do{control.operating.sampling ? ` the ${control.operating.sampling.size} items drawn off them and ` : ' '}every result recorded against them. To replace just one file, drop that file instead.</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-canvas-border bg-paper-50/40">
              <button onClick={() => setWithdrawing(false)} className="h-9 px-3.5 text-[0.8125rem] font-semibold text-ink-600 hover:text-ink-900 cursor-pointer">Keep it</button>
              <button onClick={() => { clearPopulation(control.id); setWithdrawing(false); logEvent({ action: 'Delete', description: `Withdrew the population for ${control.id}`, module: 'SOX ICFR', entity: 'Evidence' }); }}
                className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-risk-600 text-white text-[0.8125rem] font-semibold hover:bg-risk-700 transition-colors cursor-pointer"><RotateCcw size={13} /> Withdraw</button>
            </div>
          </motion.div>
        </div>,
        document.body)}

      {/* ── a sampled file becoming an assisting table ──────────────────────
          Worth confirming, because the items go. An assisting table is joined
          onto the population rather than tested, so items drawn from one were
          testing the wrong thing — but somebody spent time on them, and a
          dropdown that silently binned that work would not be trusted twice. */}
      {roleChange && createPortal(
        <div className="modal-backdrop" onClick={() => setRoleChange(null)}>
          <motion.div role="dialog" aria-modal="true" aria-labelledby="role-change-title" className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()} initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}><DialogFocus onEscape={() => setRoleChange(null)} />
            <div className="px-5 py-4">
              <div className="flex items-start gap-3">
                <span className="w-9 h-9 rounded-lg bg-mitigated-50 text-mitigated-800 inline-flex items-center justify-center shrink-0"><AlertTriangle size={17} /></span>
                <div className="min-w-0">
                  <h3 id="role-change-title" className="text-[0.875rem] font-bold text-ink-900">Make {roleChange.source.file} an assisting table?</h3>
                  <p className="text-[0.75rem] text-ink-500 mt-1">
                    An assisting table is joined onto the population, not tested — so its {roleChange.drawn} drawn item{roleChange.drawn === 1 ? '' : 's'} go, along with every attribute result recorded against them, and its {roleChange.source.count.toLocaleString()} instances leave the population count.
                  </p>
                  <p className="text-[0.75rem] text-ink-600 mt-2 font-semibold">Its four checks stay. A join onto an unproven table produces an unproven answer, so it is still proven — just never sampled.</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-canvas-border bg-paper-50/40">
              <button onClick={() => setRoleChange(null)} className="h-9 px-3.5 text-[0.8125rem] font-semibold text-ink-600 hover:text-ink-900 cursor-pointer">Keep it sampled</button>
              <button onClick={() => {
                setSourceRole(control.id, roleChange.source.id, 'assisting');
                logEvent({ action: 'Update', description: `Marked ${roleChange.source.file} an assisting table on ${control.id}`, module: 'SOX ICFR', entity: 'Evidence' });
                setRoleChange(null);
              }}
                className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-mitigated-600 text-white text-[0.8125rem] font-semibold hover:bg-mitigated-700 transition-colors cursor-pointer">Make it assisting</button>
            </div>
          </motion.div>
        </div>,
        document.body)}

      {/* ── dropping ONE file ──────────────────────────────────────────────
          Worth confirming and worth being precise about, because the whole
          point of the decision is what does NOT happen: the other files keep
          their proof, their sample and their results. An auditor who expects a
          drop to cost them everything will not use it. */}
      {dropping && createPortal(
        <div className="modal-backdrop" onClick={() => setDropping(null)}>
          <motion.div role="dialog" aria-modal="true" aria-labelledby="drop-source-title" className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()} initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}><DialogFocus onEscape={() => setDropping(null)} />
            <div className="px-5 py-4">
              <div className="flex items-start gap-3">
                <span className="w-9 h-9 rounded-lg bg-risk-50 text-risk-700 inline-flex items-center justify-center shrink-0"><AlertTriangle size={17} /></span>
                <div className="min-w-0">
                  <h3 id="drop-source-title" className="text-[0.875rem] font-bold text-ink-900">Drop {dropping.file}?</h3>
                  <p className="text-[0.75rem] text-ink-500 mt-1">
                    Its {dropping.count.toLocaleString()} instances leave the population, its checks go unproven again
                    {samplesFor(control, dropping.id).length > 0 && <>, and the {samplesFor(control, dropping.id).length} items drawn off it — with every result recorded against them — go too</>}.
                  </p>
                  <p className="text-[0.75rem] text-ink-600 mt-2 font-semibold">The other {sources.length - 1} file{sources.length - 1 === 1 ? '' : 's'} keep{sources.length - 1 === 1 ? 's' : ''} everything — their proof, their sample and their results are untouched.</p>
                  <p className="text-[0.6875rem] text-ink-400 mt-2">The report goes back to untested either way: one verdict covers every file, so it cannot stand while the files under it change.</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-canvas-border bg-paper-50/40">
              <button onClick={() => setDropping(null)} className="h-9 px-3.5 text-[0.8125rem] font-semibold text-ink-600 hover:text-ink-900 cursor-pointer">Keep it</button>
              <button onClick={() => {
                removePopulationSource(control.id, dropping.id);
                logEvent({ action: 'Delete', description: `Dropped ${dropping.file} from the population for ${control.id}`, module: 'SOX ICFR', entity: 'Evidence' });
                setDropping(null);
              }}
                className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-risk-600 text-white text-[0.8125rem] font-semibold hover:bg-risk-700 transition-colors cursor-pointer"><Trash2 size={13} /> Drop the file</button>
            </div>
          </motion.div>
        </div>,
        document.body)}
    </div>
  );
}

/**
 * Where the number came from, in one line.
 *
 * Since #22 nothing about the size is decided on the control: the frequency and
 * the risk rating are the RACM row's, and the number is read off the table the
 * engagement agreed once for every control in it. The question an auditor
 * actually arrives with is "why four?", and the only answer that holds is the
 * row and the column it was read from — so the CELL is shown, not just the
 * number it produced.
 *
 * Both inputs read as facts of the control rather than as fields, because
 * changing either one here is not something this step can do: they sit behind a
 * lock, in the quiet weights the page uses for stated facts, and the sentence
 * after them says where each is actually settled.
 */
function SizeDerivation({ control, guide, methodology }: {
  control: Control; guide: ReturnType<typeof sampleSizeGuide>; methodology: SamplingMethodology;
}) {
  // A test of one is not read off the table at all — it rests on the automation
  // and its ITGCs — so claiming a cell for it would be inventing a derivation.
  if (!guide.cell) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[0.6875rem] text-ink-500">
        <Scale size={10} className="text-ink-400 shrink-0" />
        <span className="font-semibold text-ink-600">Automated</span>
        <span className="text-ink-400">→</span>
        <span className="font-bold text-ink-700">test of one</span>
        <span className="text-ink-400">— not sized from the agreed table.</span>
      </span>
    );
  }
  // An unrated control still lands in a column — the middle one — and saying
  // "Medium risk" without saying that would put a rating in the RACM row's
  // mouth that nobody has given it.
  const rated = !!control.riskRating;
  return (
    <span className="inline-flex items-baseline gap-1.5 flex-wrap text-[0.6875rem] text-ink-500">
      <Scale size={10} className="text-ink-400 shrink-0 self-center" />
      <span className="font-semibold text-ink-600">{guide.cell.frequency}</span>
      <span className="text-ink-300">·</span>
      <span className="font-semibold text-ink-600">{guide.cell.rating} risk</span>
      <span className="text-ink-400">→</span>
      <span className="font-bold text-ink-700 tabular-nums">{guide.suggested} item{guide.suggested === 1 ? '' : 's'}</span>
      <span className="text-ink-400">
        , from the {samplingAgreed(methodology) ? 'agreed' : 'proposed'} methodology (v{methodology.version}
        {samplingAgreed(methodology) ? '' : ', not signed yet'}).
      </span>
      <span className="text-ink-400">
        Frequency{rated ? ' and rating come' : ' comes'} from the RACM row{rated ? '' : ' — unrated, so it reads as the middle column'}; the number comes from the engagement's table. Neither is set here.
      </span>
    </span>
  );
}

/**
 * A size the auditor set against the one the agreed table gave.
 *
 * Allowed, and never blocked — a methodology that cannot be departed from stops
 * being a methodology and becomes a cage. But it is a DEPARTURE, not an edit, so
 * it cannot be made silently and it cannot be read as an ordinary value: the ask
 * is for the reason first, and once set the size is stated against the number it
 * departed from, with the reason and the name beside it.
 *
 * Appended under the Sample step's methodology card, affordance included, so the
 * one place the number can be moved is the one place it is explained.
 */
function SampleSizeDeparture({ control, agreed, canEdit }: { control: Control; agreed: number; canEdit: boolean }) {
  const { resizeSample } = useIcfr();
  const logEvent = useAuditLog();
  const { addToast } = useToast();
  const s = control.operating.sampling;
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState(String(s?.size ?? agreed));
  const [why, setWhy] = useState('');
  if (!s) return null;
  const dep = s.override;
  // The draw before any extension after a failure — what the table is compared with.
  const base = s.size - s.samples.filter(x => x.extension).length;
  const n = Number(size);
  const valid = Number.isInteger(n) && n >= 1 && n !== s.size;

  const save = () => {
    resizeSample(control.id, n, why.trim());
    logEvent({ action: 'Update', description: `Departed from the agreed sample size on ${control.id} — ${n} items where the methodology gives ${agreed}: ${why.trim()}`, module: 'SOX ICFR', entity: 'Test Result' });
    setWhy(''); setOpen(false);
  };

  return (
    <div className={cn('mt-4 rounded-xl border p-3.5', dep ? 'border-mitigated-200 bg-mitigated-50/50' : 'border-canvas-border bg-paper-50/40')}>
      {dep ? (
        <div className="flex items-start gap-2.5">
          <AlertTriangle size={14} className="text-mitigated-700 mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[0.75rem] font-bold text-mitigated-700">
              Departure from the agreed methodology — set to <span className="tabular-nums">{dep.size}</span> items where the table gives <span className="tabular-nums">{dep.agreed}</span>
            </p>
            <p className="text-[0.6875rem] text-ink-700 mt-1 leading-relaxed">{dep.reason}</p>
            {/* An extension after a failure moves the size again, and it is not
                part of this departure — so the two numbers are kept apart. */}
            {s.size !== dep.size && (
              <p className="text-[0.6875rem] text-ink-500 mt-1">Standing at <span className="tabular-nums font-semibold text-ink-700">{s.size}</span> items now, after the sample was extended.</p>
            )}
            <p className="text-[0.6875rem] text-ink-400 mt-1">{dep.by} · {dep.at} — recorded on the working paper and the trail.</p>
          </div>
        </div>
      ) : base !== agreed && s.method !== 'Full population' ? (
        /* The same rule the methodology page counts by (sizeDeparture): a draw
           standing at another number than the table is a departure whether or
           not one was recorded — saying "the number the table gives it" over a
           different number was the contradiction (click-through, 5 Oct). */
        <div className="flex items-start gap-2.5">
          <AlertTriangle size={14} className="text-mitigated-700 mt-0.5 shrink-0" />
          <p className="text-[0.6875rem] text-ink-600 leading-relaxed">
            <span className="font-bold text-mitigated-700">Drawn at <span className="tabular-nums">{base}</span> items where the agreed table gives <span className="tabular-nums">{agreed}</span></span> — no reason for the difference is on the record, so it counts as a departure from the methodology.
            {s.size !== base && <> Standing at <span className="tabular-nums font-semibold text-ink-700">{s.size}</span> now, after the sample was extended.</>}
          </p>
        </div>
      ) : (
        <p className="text-[0.6875rem] text-ink-500 leading-relaxed">
          This control is tested at <span className="font-semibold text-ink-700 tabular-nums">{base}</span> items, the number the agreed table gives it.
          {s.size !== base && <> Standing at <span className="tabular-nums font-semibold text-ink-700">{s.size}</span> now, after the sample was extended.</>}
          {' '}Testing a different number is allowed, and is recorded as a departure from the methodology rather than as a change of mind.
        </p>
      )}

      {canEdit && !open && (
        <button onClick={() => { setSize(String(s.size)); setOpen(true); }}
          className="mt-2.5 h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.75rem] font-semibold text-ink-700 hover:border-mitigated-300 hover:text-mitigated-700 transition-colors cursor-pointer">
          <Scale size={13} /> {dep ? 'Revise the departure' : 'Test a different number of items'}
        </button>
      )}

      {canEdit && open && (
        <div className="mt-3 pt-3 border-t border-canvas-border">
          <div className="flex items-center gap-2 flex-wrap">
            <label className="inline-flex items-center gap-2">
              <span className="text-[0.75rem] font-semibold text-ink-600">Test</span>
              <input type="number" min={1} autoFocus value={size} onChange={e => setSize(e.target.value)}
                aria-label="Number of items to test"
                className="h-8 w-20 px-2 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.8125rem] text-ink-800 tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-200" />
              <span className="text-[0.75rem] text-ink-500">items, against an agreed <span className="font-semibold text-ink-700 tabular-nums">{agreed}</span></span>
            </label>
          </div>
          {/* The question is the specific one. "Why a different size" invites
              "professional judgment", which is what #22 was raised about; asking
              what the table did not know about this control asks for the fact
              that would have changed the table had it been known. */}
          <label className="block mt-2.5">
            <span className="text-[0.75rem] font-semibold text-ink-600">What does this control have that the agreed table did not allow for?</span>
            <textarea value={why} onChange={e => setWhy(e.target.value)} rows={2}
              placeholder="e.g. the control changed hands in August, so the period either side of the handover is tested separately"
              className="mt-1.5 w-full text-[0.75rem] rounded-lg border border-canvas-border bg-canvas-elevated px-2.5 py-2 text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-200 resize-none" />
          </label>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <button disabled={!valid || !why.trim()} onClick={save}
              title={!valid ? 'Give a whole number of items, different from the size now' : why.trim() ? undefined : 'A departure with no reason is a size nobody can defend'}
              className="h-8 px-3.5 inline-flex items-center gap-1.5 rounded-md bg-mitigated-600 text-white text-[0.75rem] font-semibold enabled:hover:bg-mitigated-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer">
              <Scale size={12} /> Record the departure
            </button>
            <button onClick={() => { setOpen(false); setWhy(''); }} className="h-8 px-3 text-[0.75rem] font-semibold text-ink-500 hover:text-ink-900 cursor-pointer">Cancel</button>
            <span className="text-[0.6875rem] text-ink-400">Recorded results on any item dropped go with it, and the tested attributes go stale until re-run.</span>
          </div>
        </div>
      )}
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
 *  One draw PER SOURCE FILE (dev call, Aug 2026 — "10 फाइल्स होंगी तो 10 रोज़
 *  दिखेंगे… सब पे 'ड्रा सैंपल' वाली चीज़ होगी"). A control standing on a ledger
 *  and a vendor master has two populations of instances, and one draw spread
 *  across both would leave whichever file it happened to miss untested. The
 *  items all land in one list, tagged with the file they came from, so TOE still
 *  tests one sample and the paper can still say where each item is from.
 *
 *  Method and seed are still recorded, because a draw nobody can reperform is
 *  not a procedure. They are stated as facts of the draw rather than asked for:
 *  the seed is derived from the control, the round AND the file, so two files
 *  under one control do not land on the same items, and the same file drawn
 *  twice does.
 */
function SourceDrawRow({ control, source, canDraw, single, isOpen, onToggle, onApproved }: {
  control: Control; source: PopulationSource; canDraw: boolean; single: boolean;
  isOpen: boolean; onToggle: () => void;
  /** Open the next file still owing work — "अप्रूव करोगे, अगला पे जाओगे". */
  onApproved: () => void;
}) {
  const { eng, openAuditId, drawSourceSample, approveSource, redrawSource } = useIcfr();
  const logEvent = useAuditLog();
  const { addToast } = useToast();
  // How many to draw is the table's call, not a free guess — sized from the
  // control's frequency, nature and risk rating, and reduced to sizing-like-a-
  // manual-control the moment an ITGC underneath it fails.
  const holds = itgcHolds(eng, control);
  const methodology = samplingOf(eng);
  const guide = sampleSizeGuide(control, holds, methodology);
  const already = samplesFor(control, source.id);
  // Only the companies in scope take items (17 Sep) — the store deals with the same list.
  const drawControl = scopedForDraw(control, inScopeEntityNames(eng.id, workingAudit(eng, openAuditId)));

  type Stage = 'ready' | 'drawing' | 'review';
  const [stage, setStage] = useState<Stage>('ready');
  // The chat draws too. Its draw of THIS file shows here as progress, and any
  // run on the control holds Draw sample so the same file is not drawn twice.
  const liveRun = useControlRun(control.id);
  const drawRun = runStageOf(liveRun) === 'sample' && liveRun!.label.endsWith(`from ${source.file}`) ? liveRun : null;
  const [drawn, setDrawn] = useState<string[]>([]);
  const [rejecting, setRejecting] = useState(false);
  const [redrawing, setRedrawing] = useState(false);
  const ext = already.filter(x => x.extension).length;
  // What to take out of THIS file, in words. Drafted from the sizing table and
  // the file, then the auditor's to rewrite — "प्रॉम्प्ट फॉलोज़, सैंपल फॉलोज़",
  // one ask per file because each file's question is its own. The words set how
  // many and which months; how the items are picked and what they are spread
  // across was agreed on the engagement (A28), so that is never theirs to change.
  const audit = workingAudit(eng, openAuditId);
  const method: Sampling['method'] = methodology.method;
  const drafted = draftSamplePrompt(source, guide.suggested, audit);
  const [prompt, setPrompt] = useState(drafted);
  const [promptSeed, setPromptSeed] = useState(drafted);
  if (promptSeed !== drafted) { setPromptSeed(drafted); setPrompt(drafted); }
  // Every month the ask can reach is a month this version of the control ran in.
  const vAudit = versionAudit(control, audit);
  const plan = readSamplePrompt(prompt, source, guide.suggested, vAudit, methodology);
  // The stretch the items are dealt inside — the months the ask named, else the
  // audit's whole window — and the round any undated item already here was drawn in.
  const stretch = versionAudit(control, vAudit && plan.months ? { ...vAudit, windowFrom: plan.months.from, windowTo: plan.months.to } : vAudit);
  const home = sampleHome(eng, a => auditCovers(a, control, eng.id));
  const seed = useMemo(
    () => 10000 + (`${seedKeyOf(control)}·${source.id}·${openAuditId ?? ''}`.split('').reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 17) % 89999),
    [control.id, source.id, openAuditId],
  );

  const draw = () => {
    setStage('drawing');
    logEvent({ action: 'Run', description: `Drew ${plan.size} items from ${source.file} for ${control.id} — ${prompt.trim() || 'no ask recorded'} (${method.toLowerCase()}, ${spreadPhrase(methodology.spread)})`, module: 'SOX ICFR', entity: 'Test Result' });
    window.setTimeout(() => { setDrawn(sampleRefs(control.process, plan.size)); setStage('review'); }, 1800);
  };
  // Where each drawn item falls — its date, and on a shared control its company.
  // The store deals the approved items with the same call on the same inputs (the
  // other files' items, this file's key, the months asked for), so the rows shown
  // are the rows filed.
  const dealt = drawn.length
    ? dealSample(drawControl, stretch, methodology, drawn.length,
      (control.operating.sampling?.samples ?? []).filter(x => sampleSourceOf(control, x) !== source.id),
      `${seedKeyOf(control)}·${source.id}`, e => countryOf(eng.id, e), home)
    : [];

  const approve = () => {
    // The ask travels with the draw, with the months it narrowed to, and so do
    // method and seed — a reviewer holding only "25 items, random" cannot tell
    // whether the auditor asked for two months and got twenty-five rows instead.
    drawSourceSample(control.id, source.id, { size: drawn.length, method, seed, prompt: prompt.trim() || undefined, ...(plan.months ? { months: plan.months } : {}) }, drawn);
    logEvent({ action: 'Update', description: `Approved the sample from ${source.file} for ${control.id} — ${drawn.length} items, ${method.toLowerCase()}, seed ${seed}`, module: 'SOX ICFR', entity: 'Test Result' });
    setStage('ready'); setDrawn([]);
  };
  const restart = () => {
    setRejecting(false);
    // The ask survives a rejected draw on purpose: the usual reason to reject is
    // that the items came out wrong, not that the question was wrong, and
    // retyping it every time would train people to accept whatever appeared.
    setStage('ready'); setDrawn([]);
    logEvent({ action: 'Delete', description: `Rejected the drawn sample from ${source.file} for ${control.id} — draw restarted`, module: 'SOX ICFR', entity: 'Test Result' });
  };

  const done = !!source.approvedSample;
  const drawnAlready = already.length > 0;

  // ── the row itself ────────────────────────────────────────────────────────
  // Every file is an accordion, open one at a time: "10 फाइल हैं, एक अकॉर्डियन
  // खोलोगे, ये सारा स्टेप करोगे… अप्रूव करोगे, अगला पे जाओगे". Ten draw forms
  // and ten item tables unfolded together is a screen nobody can work in, and
  // the header alone answers the question the auditor actually returns with:
  // which files are done and which are still owed.
  const header = (
    <button onClick={onToggle} aria-expanded={isOpen}
      className="w-full flex items-center gap-2 px-3.5 py-3 text-left cursor-pointer">
      {isOpen ? <ChevronDown size={13} className="text-ink-400 shrink-0" /> : <ChevronRight size={13} className="text-ink-400 shrink-0" />}
      {done ? <CheckCircle2 size={13} className="text-compliant-600 shrink-0" /> : <FileText size={13} className="text-ink-400 shrink-0" />}
      <span className="text-[0.8125rem] font-bold text-ink-900 truncate min-w-0">{source.file}</span>
      <span className="text-[0.6875rem] text-ink-400 shrink-0 tabular-nums hidden sm:inline">{source.count.toLocaleString()} instances</span>
      <span className={cn('ml-auto shrink-0 text-[0.6875rem] font-bold',
        done ? 'text-compliant-700' : drawnAlready ? 'text-brand-700' : 'text-ink-400')}>
        {done ? 'done' : drawnAlready ? `${already.length} items drawn` : 'not drawn yet'}
      </span>
    </button>
  );

  return (
    <div className={cn('rounded-xl border overflow-hidden', done ? 'border-compliant-200 bg-compliant-50/20' : 'border-canvas-border')}>
      {header}
      {isOpen && (
        <div className="px-3.5 pb-3.5">
          {drawnAlready ? (
            <>
              {/* what was drawn off this file */}
              <div className="rounded-lg border border-canvas-border bg-canvas-elevated px-3 py-2.5">
                <p className="text-[0.75rem] text-ink-700">
                  {already.length} item{already.length === 1 ? '' : 's'} drawn{ext > 0 && <span className="text-ink-500"> · {already.length - ext} original + {ext} extension</span>} — from {source.count.toLocaleString()} instances
                </p>
                {/* What was asked for, in the words it was asked in. A reviewer
                    holding only "25 items, random" cannot tell whether the
                    auditor asked for two months and got twenty-five rows. */}
                {source.draw?.prompt && (
                  <p className="text-[0.6875rem] text-ink-500 mt-1.5 leading-relaxed">
                    <span className="text-ink-400">Asked for</span> · {source.draw.prompt}
                  </p>
                )}
                {source.draw && (
                  <p className="text-[0.6875rem] text-ink-400 mt-1">
                    {source.draw.method.toLowerCase()}, seed <span className="tabular-nums">{source.draw.seed}</span> — reperform the draw with these and land on the same items.
                  </p>
                )}
                <div className="mt-2 rounded-lg border border-canvas-border overflow-hidden">
                  <div className="grid grid-cols-[1.2fr_1fr_0.8fr] gap-2 px-3 py-1.5 bg-paper-50/70 border-b border-canvas-border text-[0.6875rem] font-bold uppercase tracking-wide text-ink-500">
                    <span>Reference</span><span>Date</span><span className="text-right">Amount</span>
                  </div>
                  {/* Every drawn item, not the first few (17 Sep — a list cut at
                      six read as a draw of six). Long draws scroll in place. */}
                  <div className="max-h-64 overflow-y-auto">
                    {already.map(smp => (
                      <div key={smp.id} className="grid grid-cols-[1.2fr_1fr_0.8fr] gap-2 px-3 py-1.5 border-b border-canvas-border last:border-b-0 text-[0.75rem]">
                        <span className="font-mono text-ink-700">{smp.ref}</span>
                        {/* the date the quarter split counts it under (A28) */}
                        <span className="text-ink-500">{fmtDay(sampleDate(smp, home))}</span>
                        <span className="text-right tabular-nums text-ink-700">{rowRupees(sampleAmount(control, smp.ref, sampleDate(smp, home), home))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {canDraw && (
                <div className="mt-2.5 flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-[0.6875rem] text-ink-400 min-w-0">
                    {done
                      ? `Marked done by ${source.approvedSample!.by}, ${source.approvedSample!.at}. A re-draw takes the mark off.`
                      : 'Mark it done and the next file opens. This is a marker, not a lock — TOE still tests every item.'}
                  </p>
                  <div className="shrink-0 flex items-center gap-2">
                    {/* "सैंपल आया, तुम सैंपल पढ़े, तुमको अच्छा नहीं लगा… वापस से
                        'ड्रा सैंपल' क्लिक हो जाएगा". Offered after approval too,
                        because the reason to re-draw usually turns up later. */}
                    <button onClick={() => setRedrawing(true)}
                      className="h-8 px-3 inline-flex items-center gap-1.5 rounded-md border border-risk-200 text-[0.75rem] font-semibold text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer"><RotateCcw size={11} /> Reject and retry</button>
                    {done ? (
                      <button onClick={() => approveSource(control.id, source.id, 'sample', false)}
                        className="h-8 px-3 inline-flex items-center gap-1.5 rounded-md border border-canvas-border text-[0.75rem] font-semibold text-ink-500 hover:text-ink-900 hover:border-ink-300 transition-colors cursor-pointer">Take the mark off</button>
                    ) : (
                      <button onClick={() => { approveSource(control.id, source.id, 'sample', true); onApproved(); }}
                        className="h-8 px-3.5 inline-flex items-center gap-1.5 rounded-md bg-brand-600 text-white text-[0.75rem] font-semibold hover:bg-brand-700 transition-colors cursor-pointer"><Check size={12} /> {/* Not a second "Approve and continue" (click-through, 5 Oct):
                          the draw is already approved onto the paper above —
                          this only marks the file done and opens the next. */}
                        {single ? 'Mark this file done' : 'Mark done, open next file'}</button>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : !canDraw ? (
            <p className="text-[0.75rem] text-ink-400">Nothing drawn yet — the auditor draws the sample off the locked population.</p>
          ) : (
            <>
              {/* ── say what you want out of this file ─────────────────────
                  A size dropdown could only ever ask "how many", and how many
                  is not always the question: "क्या 25 निकालना है, किस महीने का
                  निकालना है, सब डिपेंड करता है उसपे". Twenty-five vendors off a
                  master answers whether every vendor has a PAN; twenty-five rows
                  of a journal table will not find a duplicate invoice, and the
                  real answer there is two months tested end to end. So the ask
                  is written, drafted from the sizing table so the ordinary case
                  is still one read and a click. It sets how many and which
                  months — the method and spread above are the audit's (A28). */}
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className="block text-[0.6875rem] font-bold uppercase tracking-wider text-ink-400">Ask for the sample</span>
                <IraDrafted />
              </div>
              <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={2} disabled={stage !== 'ready'}
                aria-label={`Ask for the sample from ${source.file}`}
                placeholder="In plain English — how many items, and from which months."
                className="w-full rounded-lg border border-canvas-border bg-canvas-elevated px-2.5 py-2 text-[0.8125rem] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-200 resize-none disabled:opacity-60" />
              {/* How it was read, before it runs. A prompt nobody confirms the
                  reading of is a prompt that quietly did something else. */}
              <p className="mt-1.5 text-[0.6875rem] text-ink-500 leading-relaxed">
                <span className="font-semibold text-ink-700">Read as:</span> {plan.reading}
              </p>
              <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
                {/* Not "the table says 4" but the cell that said it — #22 moved
                    the number onto an agreed table, and a number read off a
                    table is only defensible while the reader can see the row
                    and the column it came from. */}
                <div className="min-w-0">
                  <SizeDerivation control={control} guide={guide} methodology={methodology} />
                  <p className="text-[0.6875rem] text-ink-400 mt-1">Band {guide.range}. Ask for something else and the paper records what you asked for.</p>
                </div>
                <button disabled={stage !== 'ready' || !!liveRun} onClick={draw} title={liveRun ? busyNote(liveRun) : undefined}
                  className="shrink-0 h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[0.8125rem] font-semibold enabled:hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer">
                  {stage === 'drawing' ? <><Loader2 size={14} className="animate-spin" /> Drawing…</> : <><FlaskConical size={14} /> Draw sample</>}
                </button>
              </div>
              {/* The band is the control's, so on a multi-file control it is
                  stated once under the list rather than on every row. */}
              {single && (
                <p className="text-[0.6875rem] text-ink-400 mt-2 leading-relaxed">
                  {control.frequency} · {control.nature}{control.riskRating ? ` · ${control.riskRating.toLowerCase()} risk` : ''} — {guide.note} Frequency sets the floor; the control's risk rating moves it inside the band.
                </p>
              )}
              <p className="text-[0.6875rem] text-ink-400 mt-1 leading-relaxed">
                Seed <span className="tabular-nums font-semibold text-ink-600">{seed}</span> — off this control, this round and this file, and stored on the paper with the ask, so the reviewer reperforms the draw and lands on these same items.
              </p>
              {drawRun && stage === 'ready' && <div className="mt-2.5"><LiveRunLine run={drawRun} /></div>}
              {liveRun && !drawRun && stage === 'ready' && <p className="mt-2.5 text-[0.6875rem] text-ink-500">{busyNote(liveRun)}</p>}
              {stage === 'drawing' && (
                <div className="mt-2.5 flex items-center gap-1.5 text-[0.75rem] text-brand-600 font-semibold"><Loader2 size={13} className="animate-spin" /> Drawing {plan.size} from {source.count.toLocaleString()} · {method.toLowerCase()}, seed {seed}…</div>
              )}

              {/* what came out — approve it onto the paper, or throw it back */}
              {stage === 'review' && (
                <>
                <div className="ac-div my-3.5" />
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                    <div className="text-[0.75rem] font-bold text-ink-700 inline-flex items-center gap-1.5"><FlaskConical size={12} /> Drawn sample <span className="font-normal text-ink-400">· {drawn.length} items</span></div>
                  </div>
                  <div className="rounded-lg border border-canvas-border overflow-hidden mb-3">
                    <div className="grid grid-cols-[1.2fr_1fr_0.8fr] gap-2 px-3 py-1.5 bg-paper-50/70 border-b border-canvas-border text-[0.6875rem] font-bold uppercase tracking-wide text-ink-500">
                      <span>Reference</span><span>Date</span><span className="text-right">Amount</span>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {drawn.map((ref, i) => (
                        <div key={`${ref}-${i}`} className="grid grid-cols-[1.2fr_1fr_0.8fr] gap-2 px-3 py-1.5 border-b border-canvas-border last:border-b-0 text-[0.75rem]">
                          <span className="font-mono text-ink-700">{ref}</span>
                          <span className="text-ink-500">{fmtDay(dealt[i]?.date)}</span>
                          <span className="text-right tabular-nums text-ink-700">{rowRupees(sampleAmount(control, ref, dealt[i]?.date, home))}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => setRejecting(true)} className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-lg border border-risk-200 text-[0.8125rem] font-semibold text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer">
                      <RotateCcw size={13} /> Reject and retry
                    </button>
                    <button disabled={drawn.length === 0} onClick={approve} className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[0.8125rem] font-semibold enabled:hover:bg-brand-700 disabled:opacity-40 transition-colors cursor-pointer">
                      <Check size={14} /> Approve and continue
                    </button>
                  </div>
                </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {rejecting && createPortal(
        <div className="modal-backdrop" onClick={() => setRejecting(false)}>
          <motion.div role="dialog" aria-modal="true" aria-labelledby="reject-sample-title" className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()} initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}><DialogFocus onEscape={() => setRejecting(false)} />
            <div className="px-5 py-4">
              <div className="flex items-start gap-3">
                <span className="w-9 h-9 rounded-lg bg-risk-50 text-risk-700 inline-flex items-center justify-center shrink-0"><AlertTriangle size={17} /></span>
                <div>
                  <h3 id="reject-sample-title" className="text-[0.875rem] font-bold text-ink-900">Reject this sample?</h3>
                  <p className="text-[0.75rem] text-ink-500 mt-1">These items go and the draw starts again from the size. Only {source.file} is affected — the population is untouched, and any other file's sample stays exactly as it is.</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-canvas-border bg-paper-50/40">
              <button onClick={() => setRejecting(false)} className="h-9 px-3.5 text-[0.8125rem] font-semibold text-ink-600 hover:text-ink-900 cursor-pointer">Keep working</button>
              <button onClick={restart} className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-risk-600 text-white text-[0.8125rem] font-semibold hover:bg-risk-700 transition-colors cursor-pointer"><RotateCcw size={13} /> Reject and start over</button>
            </div>
          </motion.div>
        </div>,
        document.body)}

      {/* Throwing back a draw that is already on the paper. Worth confirming
          separately: the items exist, TOE may have been tested against them,
          and those results go with them. */}
      {redrawing && createPortal(
        <div className="modal-backdrop" onClick={() => setRedrawing(false)}>
          <motion.div role="dialog" aria-modal="true" aria-labelledby="redraw-title" className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()} initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}><DialogFocus onEscape={() => setRedrawing(false)} />
            <div className="px-5 py-4">
              <div className="flex items-start gap-3">
                <span className="w-9 h-9 rounded-lg bg-risk-50 text-risk-700 inline-flex items-center justify-center shrink-0"><AlertTriangle size={17} /></span>
                <div className="min-w-0">
                  <h3 id="redraw-title" className="text-[0.875rem] font-bold text-ink-900">Draw {source.file} again?</h3>
                  <p className="text-[0.75rem] text-ink-500 mt-1">Its {already.length} item{already.length === 1 ? '' : 's'} go, along with every attribute result recorded against them, and the file goes back to its draw.</p>
                  <p className="text-[0.75rem] text-ink-600 mt-2 font-semibold">Only this file. The population is locked and untouched, and every other file keeps its own sample and its own results.</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-canvas-border bg-paper-50/40">
              <button onClick={() => setRedrawing(false)} className="h-9 px-3.5 text-[0.8125rem] font-semibold text-ink-600 hover:text-ink-900 cursor-pointer">Keep it</button>
              <button onClick={() => {
                redrawSource(control.id, source.id);
                logEvent({ action: 'Delete', description: `Rejected the sample from ${source.file} on ${control.id} — the draw was reopened`, module: 'SOX ICFR', entity: 'Test Result' });
                setRedrawing(false);
              }}
                className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-risk-600 text-white text-[0.8125rem] font-semibold hover:bg-risk-700 transition-colors cursor-pointer"><RotateCcw size={13} /> Reject and retry</button>
            </div>
          </motion.div>
        </div>,
        document.body)}
    </div>
  );
}

function SampleExtractSection({ control, canEdit, locked }: { control: Control; canEdit: boolean; locked: boolean }) {
  const { eng, role, openAuditId } = useIcfr();
  // Drawing a sample is the auditor's act — the store refuses it from anyone
  // else, so the journey is not offered to anyone else either.
  const canDraw = canEdit && role === 'auditor' && !isControlLockedIn(eng, control);
  const o = control.operating;
  // Only the files the control is tested ON. An assisting table is joined onto
  // the population by the workflow and never drawn from, so offering it a Draw
  // sample button would be offering to test the wrong thing.
  const sources = sampledSources(populationSources(control));
  const assisting = populationSources(control).filter(isAssisting);
  const holds = itgcHolds(eng, control);
  const methodology = samplingOf(eng);
  const guide = sampleSizeGuide(control, holds, methodology);
  // One file open at a time, starting on the first that still owes work. A
  // control with ten files is not finished in one sitting, and the point of the
  // marks is that returning to it lands on what is left.
  const [openSource, setOpenSource] = useState<string | null>(() => sources.find(s => !s.approvedSample)?.id ?? null);

  // Two gates stand in front of the draw, and they fail for different reasons —
  // so the locked state names the one actually holding it up. The design gate
  // includes the reviewer's approval of TOD (S6, A36). A year-end control in an
  // interim or roll-forward audit (A29) is held ahead of both, and says only that.
  if (locked) {
    const held = operatingHeld(control, eng.audits.find(a => a.id === openAuditId));
    if (held) return <HeldState held={held} yearEndHint="This control runs once a year. Its sample is drawn in the year-end audit, once the year has closed." />;
    const awaitingApproval = trackResult(control.design) === 'Effective' && !designApproved(control);
    const designBlocked = trackResult(control.design) !== 'Effective' || awaitingApproval;
    return (
      <div className="p-5">
        {designBlocked ? (
          <EmptyState icon={<Lock size={18} />} title="The draw is locked" hint={awaitingApproval
            ? 'TOD is marked Design effective and waiting for the reviewer’s approval. The draw opens once it is approved.'
            : 'Mark TOD as Design effective first — a sample is only worth pulling for a control that is designed to work.'}>
            <span className="inline-flex items-center gap-1.5 text-[0.75rem] text-ink-500"><span>TOD is currently</span><TrackPill c={trackResult(control.design)} /></span>
          </EmptyState>
        ) : (
          <EmptyState icon={<Lock size={18} />} title="The draw is locked"
            hint={o.population
              ? 'The population is extracted but not locked. Settle the checks at step ② and lock it — a sample drawn from a population that can still change proves nothing.'
              : 'No population yet. Pick the source file and filter it down at step ② — the draw comes off a locked population, never off a file.'}>
            <span className="inline-flex items-center gap-1.5 text-[0.75rem] text-ink-500">
              <span>Population is currently</span>
              <Pill tone="draft">{!o.population ? 'Not extracted' : 'Not locked'}</Pill>
            </span>
          </EmptyState>
        )}
      </div>
    );
  }

  const drawnFiles = sources.filter(s => samplesFor(control, s.id).length > 0).length;
  // Drawn and marked done are different states, and the difference is the whole
  // point of the marks: a file drawn but not ticked is a file somebody still has
  // to look at.
  const doneFiles = sources.filter(s => s.approvedSample).length;

  // The engagement's sampling methodology (A28) — what every file's draw below
  // follows — and this control's tested items across the year's rounds, each counted
  // in the round its date falls in, so the split reads the same from either round.
  const current = workingAudit(eng, openAuditId);
  /** The control as the draw saw it — only its companies in scope (17 Sep). */
  const drawControl = scopedForDraw(control, inScopeEntityNames(eng.id, current));
  const yearRounds = yearSampleRounds(eng, control, current, a => auditCovers(a, control, eng.id));
  const yearTotal = yearRounds.reduce((n, r) => n + r.tested, 0);
  const roundLabel = (r: YearRound) => {
    const label = AUDIT_ROUNDS.find(x => x.id === r.audit.round)?.label ?? r.audit.round;
    // Two rounds of one kind in a year are told apart by where they stop.
    return yearRounds.filter(x => x.audit.round === r.audit.round).length > 1 ? `${label} to ${fmtDay(r.audit.windowTo)}` : label;
  };
  // The draw read back along each group the audit spreads by. A shared control's
  // companies are counted in the coverage strip already, so that axis is left to
  // the strip rather than said twice.
  const splits = o.sampling?.samples.length
    ? sampleSplit(drawControl, current, methodology, e => countryOf(eng.id, e), sampleHome(eng, a => auditCovers(a, control, eng.id))).filter(sp => !(sp.axis === 'entity' && isShared(control)))
    : [];
  const emptyGroups = splits.flatMap(sp => sp.groups.filter(g => g.n === 0 && g.label !== NO_COUNTRY).map(g => g.label));
  const SPLIT_LABEL: Record<SampleSplit['axis'], string> = { quarter: 'By quarter', country: 'By country', entity: 'By entity' };

  return (
    <div className="p-5">
      {/* what the draw comes off — stated, not asked for. The population was
          filtered and locked at step ①; this step cannot narrow it further. */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <div className="inline-flex items-center gap-2 px-3 py-2.5 rounded-lg border border-compliant-100 bg-compliant-50/40">
          <Database size={12} className="text-compliant-700 shrink-0" />
          <span className="text-[0.8125rem] font-semibold text-ink-900">Population {o.population?.version ?? 'locked'}</span>
          <span className="text-[0.6875rem] text-ink-500 tabular-nums">{o.population?.count.toLocaleString()} instances</span>
          <Check size={13} className="text-compliant-600 shrink-0" />
        </div>
        {sources.length > 1 && (
          <span className="text-[0.6875rem] text-ink-500">
            across {sources.length} files — <span className="font-semibold text-ink-700">{drawnFiles} of {sources.length} sampled</span>
            {doneFiles < sources.length && <span className="text-ink-400">, {doneFiles} marked done</span>}
          </span>
        )}
        {/* Named, not omitted. A file that was in the population step and is not
            here reads as something forgotten unless the step says why. */}
        {assisting.length > 0 && (
          <span className="text-[0.6875rem] text-ink-400">
            {assisting.map(a => a.file).join(', ')} {assisting.length === 1 ? 'is an assisting table' : 'are assisting tables'} — joined, not sampled.
          </span>
        )}
      </div>

      {/* ── how this engagement samples, and the year so far (A28) ───────────
          Selection and spread were agreed on the engagement, once for every
          control on it, so they are stated here rather than asked — the files
          below ask only how many and from which months. The running total answers #38: a control is tested
          across the year's rounds, and nothing used to add them up against the
          number the sizing table sets. */}
      <div className="mt-4 rounded-xl border border-canvas-border bg-paper-50/40 p-3.5">
        <p className="text-[0.75rem] text-ink-700">
          <span className="font-bold">Method: {methodology.method}</span> · {spreadPhrase(methodology.spread)} <span className="text-ink-400">(agreed for this engagement)</span>
        </p>
        {/* Last round's draw, set beside this one (#13). The method is the
            engagement's, so it is compared rather than reused: a control does
            not get to keep a method the engagement has since moved off. */}
        {control.rollForward?.sampling && (
          <p className="mt-0.5 text-[0.6875rem] text-ink-500">
            {control.rollForward.sampling.method === methodology.method
              ? `Same method as last round (${methodology.method}).`
              : `Last round drew ${control.rollForward.sampling.method} — this engagement now agrees ${methodology.method}.`}
          </p>
        )}
        {/* And how many, derived rather than chosen (#22). The method above and
            the size are settled together on the engagement, and this says which
            cell of the agreed table this control landed in. */}
        <div className="mt-1"><SizeDerivation control={control} guide={guide} methodology={methodology} /></div>
        {yearRounds.length > 0 && (
          <>
            <div className="ac-div my-2.5" />
            <div className="flex items-baseline justify-between gap-x-3 gap-y-1 flex-wrap">
              {/* Past the target it stops being a fraction — "26 of 5" reads as a
                  counting error rather than a control tested more than it had to be. */}
              {yearTotal > guide.suggested
                ? <span className="text-[0.75rem] font-bold text-ink-700"><span className="tabular-nums">{yearTotal}</span> samples tested this year — above the target of <span className="tabular-nums">{guide.suggested}</span></span>
                : <span className="text-[0.75rem] font-bold text-ink-700">This year so far: <span className="tabular-nums">{yearTotal} of {guide.suggested}</span> samples tested</span>}
              {/* The cell that set this target is stated once at the top of the
                  card, so here it is only the number it produced. */}
              <span className="text-[0.6875rem] text-ink-400 tabular-nums">Target {guide.suggested}</span>
            </div>
            <p className="mt-1 text-[0.6875rem] text-ink-500 tabular-nums">
              {yearRounds.map((r, i) => (
                <span key={r.audit.id}>
                  {i > 0 && <span className="text-ink-300"> · </span>}
                  {roundLabel(r)} {r.tested}
                  {r.current && <span className="font-semibold text-brand-700"> ← this audit</span>}
                </span>
              ))}
            </p>
          </>
        )}
      </div>

      {/* ── a size set against the agreed one ────────────────────────────────
          The one place on this page the number can be moved, and the one place
          it is explained. Only once something has been drawn: before that there
          is no size to depart from. */}
      {o.sampling && <SampleSizeDeparture control={control} agreed={guide.suggested} canEdit={canDraw} />}

      {/* ── who the sample reaches ───────────────────────────────────────────
          A shared control concludes once for every company it answers for, so
          the sample has to actually reach each of them — the same rule the
          files below already follow, applied along the other axis. A company
          with nothing drawn has had nothing tested, and the overall size
          (which looks perfectly healthy) would carry the reader straight past
          that unless this strip says it. */}
      {isShared(control) && (() => {
        const cov = entityCoverage(drawControl);
        const missing = uncoveredEntities(drawControl);
        return (
          <div className={cn('mt-4 rounded-xl border p-3.5', missing.length ? 'border-high-200 bg-high-50/30' : 'border-canvas-border bg-paper-50/40')}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[0.75rem] font-bold text-ink-700">One conclusion, {cov.length} companies</span>
              <span className="text-[0.6875rem] text-ink-400">— every company this control answers for needs items of its own in the sample.</span>
            </div>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              {cov.map(e => (
                <span key={e.entity} className={cn('inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg border text-[0.6875rem] font-semibold',
                  e.drawn === 0 ? 'border-high-300 bg-high-50 text-high-700' : e.failed > 0 ? 'border-risk-200 bg-risk-50/50 text-risk-700' : 'border-canvas-border bg-canvas-elevated text-ink-700')}>
                  {e.entity}
                  <span className={cn('font-normal', e.drawn === 0 ? 'text-high-700' : 'text-ink-400')}>
                    {e.drawn === 0 ? 'nothing drawn' : `${e.drawn} item${e.drawn === 1 ? '' : 's'}${e.failed ? ` · ${e.failed} failed` : ''}`}
                  </span>
                </span>
              ))}
            </div>
            {missing.length > 0 && (
              <p className="mt-2 text-[0.6875rem] text-high-700 leading-relaxed">
                <b className="font-semibold">{missing.join(' and ')}</b> {missing.length === 1 ? 'has' : 'have'} no item in the draw — a conclusion recorded now would cover {missing.length === 1 ? 'a company' : 'companies'} nothing was tested at. Extend the sample until every company is reached.
              </p>
            )}
          </div>
        );
      })()}

      {/* ── which routes the draw has touched ────────────────────────────────
          A control with more than one way through it — a payment released by
          hand vs auto-released under a threshold — is only tested when the
          draw has landed on each route. Same rule as the companies above and
          the files below, along a third axis: a draw that never touched the
          second route has not tested the second route. */}
      {hasPaths(control) && (() => {
        const cov = pathCoverage(control);
        const missed = untouchedPaths(control);
        return (
          <div className={cn('mt-4 rounded-xl border p-3.5', missed.length ? 'border-high-200 bg-high-50/30' : 'border-canvas-border bg-paper-50/40')}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[0.75rem] font-bold text-ink-700">One control, {cov.length} routes</span>
              <span className="text-[0.6875rem] text-ink-400">— every route work can take through this control needs items of its own in the sample.</span>
            </div>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              {cov.map(p => (
                <span key={p.path} className={cn('inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg border text-[0.6875rem] font-semibold',
                  p.drawn === 0 ? 'border-high-300 bg-high-50 text-high-700' : 'border-canvas-border bg-canvas-elevated text-ink-700')}>
                  {p.path}
                  <span className={cn('font-normal', p.drawn === 0 ? 'text-high-700' : 'text-ink-400')}>
                    {p.drawn === 0 ? 'never touched' : `${p.drawn} item${p.drawn === 1 ? '' : 's'}`}
                  </span>
                </span>
              ))}
            </div>
            {missed.length > 0 && (
              <p className="mt-2 text-[0.6875rem] text-high-700 leading-relaxed">
                The draw never touched <b className="font-semibold">{missed.join(' or ')}</b> — that route has not been tested, however healthy the overall size looks. Extend the sample until every route is reached.
              </p>
            )}
          </div>
        );
      })()}

      {/* ── how the draw is spread (A28) ─────────────────────────────────────
          The audit asked for items in every quarter, country or company it
          named. Once something is drawn this reads the sample back along each,
          and names any group left with nothing — the same rule as the strips
          above, along the audit's own axes. */}
      {splits.length > 0 && (
        <div className={cn('mt-4 rounded-xl border p-3.5', emptyGroups.length ? 'border-high-200 bg-high-50/30' : 'border-canvas-border bg-paper-50/40')}>
          <div className="space-y-1">
            {splits.map(sp => (
              <p key={sp.axis} className="text-[0.6875rem] text-ink-500 tabular-nums leading-relaxed">
                <span className="font-bold text-ink-700">{SPLIT_LABEL[sp.axis]}</span>{' '}
                {sp.groups.map((g, i) => (
                  <span key={g.label}>
                    {i > 0 && <span className="text-ink-300"> · </span>}
                    <span className={cn(g.n === 0 && g.label !== NO_COUNTRY && 'font-semibold text-high-700')}>{g.label} {g.n}</span>
                  </span>
                ))}
              </p>
            ))}
          </div>
          {emptyGroups.length > 0 && (
            <p className="mt-2 text-[0.6875rem] text-high-700 leading-relaxed">
              <b className="font-semibold">{emptyGroups.length > 1 ? `${emptyGroups.slice(0, -1).join(', ')} and ${emptyGroups[emptyGroups.length - 1]}` : emptyGroups[0]}</b>{' '}
              {emptyGroups.length === 1 ? 'has' : 'have'} no items — extend the sample.
            </p>
          )}
        </div>
      )}

      {/* ── one row per file ─────────────────────────────────────────────────
          Each file is drawn from separately: a control standing on four
          quarterly extracts that sampled only the first has tested one quarter,
          however healthy the total item count looks. */}
      <div className="mt-4 space-y-2.5">
        {sources.map(s => (
          <SourceDrawRow key={s.id} control={control} source={s} canDraw={canDraw} single={sources.length === 1}
            isOpen={openSource === s.id}
            onToggle={() => setOpenSource(openSource === s.id ? null : s.id)}
            onApproved={() => setOpenSource(sources.find(x => x.id !== s.id && !x.approvedSample)?.id ?? null)} />
        ))}
      </div>

      {/* The band is the control's, not the file's, so on a multi-file control
          it is stated once underneath rather than repeated on every row. */}
      {sources.length > 1 && (
        <p className="text-[0.6875rem] text-ink-400 mt-3 leading-relaxed">
          {control.frequency} · {control.nature}{control.riskRating ? ` · ${control.riskRating.toLowerCase()} risk` : ''} — band {guide.range}. {guide.note} Frequency sets the floor; the control's risk rating moves it inside the band. Each file is sized off the same band.
        </p>
      )}
      {/* Which ITGC did it. The note above says a failure is in force; a number
          the auditor has to defend needs the name behind it, on the same screen
          as the draw rather than two pages away. */}
      {!holds && failedItgcs(eng).length > 0 && (
        <p className="text-[0.6875rem] text-mitigated-700 mt-1 leading-relaxed">
          Because {failedItgcs(eng).map(f => `${controlCode(f)} — ${f.description.replace(/\.$/, '')}`).join('; ')} concluded ineffective. Test of one comes back when that is remediated and retested.
        </p>
      )}
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
/** The reason a paper goes back. Its own component so the textarea keeps its
 *  draft while the parent re-renders around it. `consequence` says what a return
 *  clears — the whole paper at sign-off, TOD alone from the design approval. Left
 *  out, it reads as it always has. */
function ReturnForm({ onCancel, onReturn, consequence = 'Both conclusions clear, and the paper reopens for the auditor.' }: { onCancel: () => void; onReturn: (reason: string) => void; consequence?: string }) {
  const [reason, setReason] = useState('');
  return (
    <>
      <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} autoFocus
        placeholder="What needs rework — the auditor sees this, and it goes on the trail"
        className="w-full px-2.5 py-2 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.75rem] leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-brand-200" />
      <div className="mt-2 flex items-center gap-2 flex-wrap">
        <button disabled={!reason.trim()} title={reason.trim() ? undefined : 'Say what needs rework — a paper returned without a reason costs the work twice.'}
          onClick={() => onReturn(reason.trim())}
          className="h-8 px-3.5 inline-flex items-center gap-1.5 rounded-md bg-risk-600 text-white text-[0.75rem] font-semibold enabled:hover:bg-risk-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"><CornerDownRight size={12} /> Return</button>
        <button onClick={onCancel} className="h-8 px-3 text-[0.75rem] font-semibold text-ink-500 hover:text-ink-900 cursor-pointer">Cancel</button>
        <span className="text-[0.6875rem] text-ink-400">{consequence}</span>
      </div>
    </>
  );
}

/**
 * The reviewer's challenge, and its life.
 *
 * The store has carried the whole cycle since the review gate landed — raise
 * (reviewer) → resolve (auditor) → verify or reopen (reviewer), each stage
 * stamping its own actor, with the countersign held while any note is open — but
 * the rail that drove it was lost in a merge, so for a while a reviewer could be
 * blocked by a note they had no way to raise, answer or close. This is that rail,
 * rebuilt where the block is felt: inside the sign-off step, above the signatures.
 *
 * Each hat sees only its own move. The raiser never resolves, the resolver never
 * verifies — the four-eyes here is the role gate, not a checkbox.
 */
function ReviewNotesBlock({ control }: { control: Control }) {
  const { eng, role, raiseReviewNote, resolveReviewNote, verifyReviewNote, reopenReviewNote } = useIcfr();
  const notes = reviewNotesFor(eng, control.id);
  const isReviewer = role === 'reviewer';
  const isAuditor = role === 'auditor';
  const [raising, setRaising] = useState('');
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [response, setResponse] = useState('');
  const so = control.wpSignoff;
  const canRaise = isReviewer && isControlLockedIn(eng, control) && !so?.reviewer;

  if (!notes.length && !canRaise) return null;

  const ORDER = { Open: 0, Resolved: 1, Closed: 2 } as const;
  const sorted = [...notes].sort((a, b) => ORDER[a.status] - ORDER[b.status]);

  return (
    <div className="mt-3 rounded-xl border border-canvas-border overflow-hidden">
      <div className="px-3.5 py-2 bg-paper-50/60 border-b border-canvas-border flex items-center gap-2">
        <StickyNote size={13} className="text-ink-500" />
        <span className="text-[0.75rem] font-bold text-ink-700">Review notes</span>
        <span className="text-[0.6875rem] text-ink-400">
          {notes.length === 0 ? 'None raised on this paper' : `${notes.filter(n => n.status !== 'Closed').length} open of ${notes.length}`}
        </span>
      </div>

      {sorted.map(n => (
        <div key={n.id} id={`rn-${n.id}`} className="px-3.5 py-3 border-b border-canvas-border last:border-b-0 scroll-mt-4">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[0.75rem] text-ink-800 leading-relaxed min-w-0">{n.text}</p>
            <span className="shrink-0">
              {n.status === 'Open' ? <Pill tone="risk">Open</Pill>
                : n.status === 'Resolved' ? <Pill tone="evidence">Awaiting verification</Pill>
                : <Pill tone="compliant">Verified &amp; closed</Pill>}
            </span>
          </div>
          <p className="text-[0.6875rem] text-ink-400 mt-1">Raised by {n.raisedBy} · {n.raisedAt}</p>

          {n.resolution && (
            <div className="mt-2 pl-3 border-l-2 border-canvas-border">
              <p className="text-[0.75rem] text-ink-700 leading-relaxed">{n.resolution.text}</p>
              <p className="text-[0.6875rem] text-ink-400 mt-0.5">
                {n.resolution.by} · {n.resolution.at}{n.verified && <> — verified by {n.verified.by} · {n.verified.at}</>}
              </p>
            </div>
          )}

          {/* The auditor answers an open note. No verify pen here: agreeing that
              your own answer settles it is not a second pair of eyes. */}
          {isAuditor && n.status === 'Open' && (
            respondingTo === n.id ? (
              <div className="mt-2.5">
                <textarea autoFocus value={response} onChange={e => setResponse(e.target.value)} rows={2}
                  placeholder="What was done about this — the reviewer verifies against it"
                  className="w-full px-3 py-2 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.75rem] resize-none focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-50" />
                <div className="mt-2 flex items-center gap-2">
                  <button disabled={!response.trim()}
                    onClick={() => { resolveReviewNote(n.id, response.trim()); setRespondingTo(null); setResponse(''); }}
                    className="h-8 px-3 rounded-lg bg-brand-600 text-white text-[0.75rem] font-semibold enabled:hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">Resolve</button>
                  <button onClick={() => { setRespondingTo(null); setResponse(''); }}
                    className="h-8 px-2.5 text-[0.75rem] font-semibold text-ink-500 hover:text-ink-900 cursor-pointer">Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => { setRespondingTo(n.id); setResponse(''); }}
                className="mt-2 h-8 px-3 rounded-lg border border-canvas-border text-[0.75rem] font-semibold text-ink-600 hover:border-brand-300 hover:text-brand-700 cursor-pointer">Resolve with response</button>
            )
          )}

          {/* The reviewer's two answers to an attempt: it settles the point, or it
              does not and the note goes back open. */}
          {isReviewer && n.status === 'Resolved' && (
            <div className="mt-2.5 flex items-center gap-2">
              <button onClick={() => verifyReviewNote(n.id)}
                className="h-8 px-3 rounded-lg bg-compliant-600 text-white text-[0.75rem] font-semibold hover:bg-compliant-700 cursor-pointer inline-flex items-center gap-1.5"><CheckCircle2 size={13} /> Verify &amp; close</button>
              <button onClick={() => reopenReviewNote(n.id)}
                className="h-8 px-3 rounded-lg border border-high-300 text-high-700 text-[0.75rem] font-semibold hover:bg-high-50 cursor-pointer">Reopen</button>
            </div>
          )}
        </div>
      ))}

      {canRaise && (
        <div className="px-3.5 py-3 bg-paper-50/40">
          <textarea value={raising} onChange={e => setRaising(e.target.value)} rows={2}
            placeholder="Raise a review note — the auditor answers it, you verify, and it holds the countersign until it closes"
            className="w-full px-3 py-2 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.75rem] resize-none focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-50" />
          <button disabled={!raising.trim()} onClick={() => { raiseReviewNote(control.id, raising.trim()); setRaising(''); }}
            className="mt-2 h-8 px-3 rounded-lg bg-brand-600 text-white text-[0.75rem] font-semibold enabled:hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">Raise review note</button>
        </div>
      )}
    </div>
  );
}

/**
 * Design sign-off after TOD (S6, A36).
 *
 * TOD is concluded first and everything after it stands on it, so it gets its
 * own second pair of eyes before any data is pulled: prepared by whoever
 * concluded it, approved by the engagement's reviewer. Population, Sample and
 * TOE stay locked until the approval lands.
 *
 * The same shape as the paper's sign-off at step ⑤ — two named rows, one line
 * saying what happens next, the reviewer's two answers side by side — because it
 * is the same act, earlier. Absent for the control owner: how the auditor's design
 * test went is not theirs to read.
 */
// ── The control the owner rebuilt ─────────────────────────────────────────────────
const REBUILD_FREQUENCIES: Frequency[] = ['Annual', 'Quarterly', 'Monthly', 'Weekly', 'Daily', 'Recurring', 'Ad-hoc'];

/** RECORDING THE REBUILT CONTROL, inside the design step where the failure is.
 *
 *  Deliberately not behind the header's Reopen button, though both end with an
 *  untested control. They say opposite things: a reopen says "this conclusion was
 *  reached wrongly", a new version says "this conclusion was right, and the control
 *  it was about no longer exists". Offering them together would invite an auditor to
 *  undo a finding they meant to keep.
 *
 *  Shown only where an accepted REDESIGN is waiting for it. A control that merely
 *  concluded ineffective does not offer it — nobody has agreed to rebuild anything
 *  yet — and a workaround never does, because a workaround leaves the control as it
 *  was and its retest genuinely is the old checks read again.
 *
 *  Only the wording, the date and the frequency are asked for. The frequency because
 *  it moves both clocks that matter — how many occurrences the new version can
 *  produce before period end, and how large its sample has to be. The rest of the
 *  control's attributes are edited the ordinary way: recording the version unlocks
 *  the control, so the attribute fields open with it. */
function RebuildBlock({ control }: { control: Control }) {
  const { eng, role, recordNewVersion } = useIcfr();
  const logEvent = useAuditLog();
  const [open, setOpen] = useState(false);
  const [wording, setWording] = useState(control.description);
  const [liveFrom, setLiveFrom] = useState('');
  const [note, setNote] = useState('');
  const [freq, setFreq] = useState<Frequency>(control.frequency);

  // The fix has to have been declared done. The owner submitting it is what hands
  // the exception to the reviewer, and from that moment there is something to look
  // at: a rebuilt control that is actually running. It stays offered after the
  // close too, because closing an exception does not write the new wording —
  // recording the version is what tells the register what this control now says,
  // and a control whose row still reads the old sentence is a register that is
  // simply wrong about what is in place.
  const def = eng.deficiencies.find(d => d.controlId === control.id
    && (d.status === 'Awaiting reviewer' || d.status === 'Closed')
    && awaitsNewVersion(control, d));
  if (role !== 'auditor' || !def) return null;

  const ready = wording.trim() && liveFrom.trim() && note.trim();
  const fieldCls = 'w-full px-2.5 py-2 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.75rem] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-200';
  const labelCls = 'block text-[0.6875rem] font-bold uppercase tracking-wider text-ink-400 mb-1';

  return (
    <div className="px-5 pb-5">
      <div className="rounded-xl border border-brand-200 bg-brand-50/40 px-3.5 py-3">
        <div className="flex items-start gap-2.5">
          <GitBranch size={15} className="text-brand-700 mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <h4 className="text-[0.8125rem] font-bold text-ink-900">The owner says the control has been rebuilt</h4>
            <p className="text-[0.75rem] text-ink-600 leading-relaxed mt-1">
              {def.id}&apos;s plan was accepted as a redesign, so the control itself is different now. Record what it
              says and the day it started running: the wording that failed is kept as <b className="font-semibold text-ink-800">v{versionNo(control)}</b>,
              and the design test reopens against the new one. Its population and sample will come from the new date
              onwards — transactions from before it cannot evidence a control that did not yet exist.
            </p>
            {!open && (
              <button onClick={() => setOpen(true)}
                className="mt-2.5 h-8 px-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[0.75rem] font-semibold hover:bg-brand-700 transition-colors cursor-pointer">
                <GitBranch size={13} /> Record the rebuilt control
              </button>
            )}
          </div>
        </div>
        {open && (
          <div className="mt-3.5 space-y-3">
            <label className="block">
              <span className={labelCls}>The control as it now reads</span>
              <textarea autoFocus rows={2} value={wording} onChange={e => setWording(e.target.value)} className={`${fieldCls} resize-none`} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className={labelCls}>Running since</span>
                <input type="date" value={liveFrom} onChange={e => setLiveFrom(e.target.value)} className={fieldCls} />
              </label>
              <label className="block">
                <span className={labelCls}>How often it runs</span>
                <select value={freq} onChange={e => setFreq(e.target.value as Frequency)} className={fieldCls}>
                  {REBUILD_FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </label>
            </div>
            <label className="block">
              <span className={labelCls}>What changed — recorded on the paper beside the old wording</span>
              <textarea rows={2} value={note} onChange={e => setNote(e.target.value)}
                placeholder="e.g. a second authoriser was added above ₹5 lakh, and the release moved to before the posting"
                className={`${fieldCls} resize-none`} />
            </label>
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setOpen(false)} className="h-8 px-3 text-[0.75rem] font-semibold text-ink-600 hover:text-ink-900 cursor-pointer">Cancel</button>
              <button disabled={!ready}
                title={ready ? undefined : 'The wording, the date it started and what changed are all needed'}
                onClick={() => {
                  recordNewVersion(control.id, def.id, { description: wording, liveFrom, note, frequency: freq });
                  logEvent({ action: 'Update', description: `Recorded v${versionNo(control) + 1} of ${control.id} — live from ${liveFrom} (${def.id})`, module: 'SOX ICFR', entity: 'Control' });
                  setOpen(false);
                }}
                className="h-8 px-3.5 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[0.75rem] font-semibold enabled:hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer">
                <GitBranch size={13} /> Record v{versionNo(control) + 1}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** THE COLLAPSE RULE, at the moment of signing.
 *
 *  The sign-off step is where a person puts their name to "Effective", and on a
 *  rebuilt control that word alone is not the whole truth — an earlier version of
 *  this same control failed its design test inside this same period. The rule and
 *  the disclosure therefore sit above the signature, not only in the version list
 *  further up the page and not only in the exported paper: a reader who has
 *  scrolled to the bottom to sign has scrolled past both.
 *
 *  It states the verdict rather than gating the button. The two outcomes are
 *  already enforced where they are computed — a rebuild that cannot be operating
 *  tested in time keeps its exception open, which keeps the control off Effective
 *  on its own. Blocking here as well would be the same rule asserted twice, in a
 *  place that could drift from the first. */
function VersionVerdict({ control }: { control: Control }) {
  const { eng } = useIcfr();
  const collapse = versionCollapse(eng, control);
  if (!collapse) return null;
  const tone = collapse.outcome === 'effective-disclosed'
    ? 'border-compliant-200 bg-compliant-50/40 text-compliant-800'
    : collapse.outcome === 'in-progress'
      ? 'border-canvas-border bg-paper-50/60 text-ink-700'
      : 'border-high-200 bg-high-50/40 text-high-800';
  return (
    <div className="px-5 pt-5">
      <div className={cn('rounded-xl border px-3.5 py-3', tone)}>
        <div className="flex items-start gap-2.5">
          <GitBranch size={15} className="mt-0.5 shrink-0 opacity-70" />
          <div className="min-w-0">
            <h4 className="text-[0.8125rem] font-bold">{collapse.verdict}</h4>
            <p className="text-[0.75rem] leading-relaxed mt-1 opacity-90">{collapse.reason}</p>
            {/* The earlier failure, in the same box as the conclusion it qualifies.
                Separating them is how a disclosure stops being read. */}
            <p className="text-[0.75rem] leading-relaxed mt-2 pt-2 border-t border-current/10 opacity-80">{collapse.disclosure}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** WHAT THIS CONTROL HAS BEEN — the live version, then the superseded ones newest
 *  first. Follows the audit-runs pattern rather than the trail's: a version is a
 *  state the control was IN, not an event that happened to it, and it carries a
 *  conclusion of its own that belongs in a column. */
function VersionHistory({ control }: { control: Control }) {
  const { eng, openAuditId, role } = useIcfr();
  const audit = eng.audits.find(a => a.id === openAuditId);
  const prior = control.priorVersions ?? [];
  // The owner is not shown the audit's conclusions anywhere else on this page, and a
  // version table is a table of conclusions.
  if (!prior.length || role === 'risk-owner') return null;
  const collapse = versionCollapse(eng, control);
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-2">
        <History size={14} className="text-ink-400" />
        <h3 className="text-[0.6875rem] font-bold uppercase tracking-wider text-ink-500">What this control has been</h3>
      </div>
      <div className="rounded-xl border border-canvas-border bg-canvas-elevated divide-y divide-canvas-border overflow-hidden">
        {/* The live version first — it IS the control, and the rest is history. */}
        <div className="px-4 py-3 flex items-center gap-3">
          <span className="shrink-0 font-mono text-[0.75rem] font-semibold text-brand-700">v{versionNo(control)}</span>
          <div className="min-w-0 flex-1">
            <p className="text-[0.8125rem] text-ink-800 truncate">{control.description}</p>
            <p className="text-[0.6875rem] text-ink-400 mt-0.5">
              Running since {formatDueDate(audit ? versionWindow(control, audit).from : prior[prior.length - 1].supersededAt)} · this is the control
            </p>
          </div>
          <ConclusionPill c={conclusionOf(eng, control)} />
        </div>
        {[...prior].reverse().map(v => (
          <div key={v.no} className="px-4 py-3 flex items-center gap-3 bg-paper-50/40">
            <span className="shrink-0 font-mono text-[0.75rem] font-semibold text-ink-400">v{v.no}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.8125rem] text-ink-600 truncate">{v.description}</p>
              <p className="text-[0.6875rem] text-ink-400 mt-0.5">
                {audit ? `${formatDueDate(versionWindow(control, audit, v.no).from)} – ` : ''}superseded {formatDueDate(v.supersededAt)} · {v.replaced.defId} · {v.replaced.note}
              </p>
            </div>
            <span className="shrink-0 text-[0.6875rem] font-semibold text-ink-500">TOD {v.design.conclusion.toLowerCase()}</span>
          </div>
        ))}
      </div>
      {collapse && (
        <p className="text-[0.75rem] text-ink-500 leading-relaxed mt-2">
          <b className="font-semibold text-ink-700">{collapse.verdict}.</b> {collapse.reason}
        </p>
      )}
    </div>
  );
}

function DesignApprovalBlock({ control }: { control: Control }) {
  const { eng, role, me, openAuditId, approveDesign, returnDesign } = useIcfr();
  const logEvent = useAuditLog();
  // Required note, same as the paper's return: TOD sent back without a reason
  // costs the auditor the work twice.
  const [returning, setReturning] = useState(false);
  const result = trackResult(control.design);
  if (role === 'risk-owner' || result === 'Not tested') return null;

  const approval = control.design.approval;
  // A conclusion stamped before approvals existed names its preparer the way the
  // rest of the paper does — whoever tested it. approveDesign reads it the same way.
  const preparedBy = approval?.preparedBy ?? (control.design.testedBy ? { by: control.design.testedBy, at: control.design.testedAt ?? '' } : undefined);
  const approvedBy = approval?.approvedBy;
  const ownConclusion = samePerson(preparedBy, me);
  // Mirrors what the store refuses: a sealed audit, and a paper already
  // countersigned. Once approved the answers go — the way back from there is the
  // return at sign-off.
  const open = role === 'reviewer' && !approvedBy && !control.wpSignoff?.reviewer && !isEngagementLocked(eng);
  const canApprove = open && !ownConclusion;

  const Row = ({ label, entry, waiting }: { label: string; entry?: { by: string; at: string }; waiting: string }) => (
    <div className="flex items-center gap-2.5 py-2">
      {entry ? <CheckCircle2 size={16} className="text-compliant-700 shrink-0" /> : <Circle size={15} className="text-ink-300 shrink-0" />}
      <span className="text-[0.75rem] text-ink-400 w-27.5 shrink-0">{label}</span>
      <span className={cn('text-[0.8125rem] min-w-0 truncate', entry ? 'font-semibold text-ink-800' : 'text-ink-400')}>
        {entry ? `${entry.by}${entry.at ? ` · ${entry.at}` : ''}` : waiting}
      </span>
    </div>
  );

  return (
    <div id="design-approval" className="px-5 pb-5 scroll-mt-4">
      <div className="rounded-xl border border-canvas-border overflow-hidden">
        <div className="px-3.5 py-2 bg-paper-50/60 border-b border-canvas-border flex items-center gap-2">
          <BadgeCheck size={13} className="text-ink-500" />
          <span className="text-[0.75rem] font-bold text-ink-700">Design approval</span>
          <span className="text-[0.6875rem] text-ink-400">{approvedBy ? '1 of 1 approved' : '0 of 1 approved'}</span>
        </div>
        <div className="px-3.5 py-1.5">
          <Row label="Prepared by" entry={preparedBy} waiting="—" />
          <div className="ac-div" />
          <Row label="Approved by" entry={approvedBy} waiting={`${eng.reviewer} — not yet approved`} />
        </div>
      </div>

      {/* Approved, the rows above already say so — nothing to add underneath. */}
      {!approvedBy && (
        <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[0.6875rem] text-ink-400 leading-relaxed min-w-0">
            {role === 'auditor' ? 'Waiting for the reviewer to approve TOD.'
              : ownConclusion ? 'You concluded TOD, so you can’t approve it — four-eyes.'
              // …unless the open audit holds them until year end (A29) — then
              // approving opens nothing, and saying it would is the lie
              : canApprove ? `Approving states the design test above is sound${result === 'Effective' && !yearEndPending(control, eng.audits.find(a => a.id === openAuditId)) ? ' — Population, Sample and TOE open once you do' : ''}.`
              : 'Waits for the reviewer.'}
          </p>
          {open && (
            <span className="shrink-0 flex items-center gap-2">
              <button onClick={() => setReturning(r => !r)}
                className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.8125rem] font-semibold text-ink-600 hover:border-risk-300 hover:text-risk-700 transition-colors cursor-pointer"><CornerDownRight size={14} /> Return to the auditor</button>
              {canApprove && (
                <button onClick={() => { approveDesign(control.id); logEvent({ action: 'Update', description: `Approved TOD for ${control.id}`, module: 'SOX ICFR', entity: 'Control' }); }}
                  className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[0.8125rem] font-semibold hover:bg-brand-700 transition-colors cursor-pointer"><Check size={14} /> Approve</button>
              )}
            </span>
          )}
        </div>
      )}

      {returning && open && (
        <div className="mt-3 rounded-xl border border-risk-200 bg-risk-50/30 p-3.5">
          <span className="block text-[0.6875rem] font-bold uppercase tracking-wider text-ink-400 mb-1.5">What needs rework in TOD?</span>
          <ReturnForm consequence="The TOD conclusion clears, and TOD reopens for the auditor." onCancel={() => setReturning(false)} onReturn={note => {
            returnDesign(control.id, note);
            setReturning(false);
            logEvent({ action: 'Update', description: `Returned TOD on ${control.id} to the auditor — ${note}`, module: 'SOX ICFR', entity: 'Control' });
          }} />
        </div>
      )}
    </div>
  );
}

function SignOffSection({ control }: { control: Control }) {
  const { eng, role, me, signOffControlWp, returnControl, openControl, openReviewerQueue } = useIcfr();
  const logEvent = useAuditLog();
  const so = control.wpSignoff;
  const concluded = isControlLockedIn(eng, control);
  const notesPending = eng.reviewNotes.filter(n => n.controlId === control.id && n.status !== 'Closed').length;
  const canSign = role === 'auditor' && concluded && !so?.preparer;
  // The countersign waits for the reviewer's design approval too.
  const designPending = !designApproved(control);
  const canCounter = role === 'reviewer' && !!so?.preparer && !so?.reviewer && notesPending === 0 && so.preparer.by !== me && !designPending;
  // Returning is NOT held by an open note. The two used to share one gate, which
  // dead-ended the reviewer: a paper they had questioned could be neither signed
  // nor sent back. A note says "answer this"; a return says "this needs rework" —
  // and the second is exactly what a reviewer reaches for when the first was not
  // enough. This mirrors what returnControl itself permits.
  const canReturn = role === 'reviewer' && !!so?.preparer && !so?.reviewer;
  // The rest of the reviewer's countersign pile, in the queue's order.
  const waitingNext = awaitingCountersign(eng).filter(c => c.id !== control.id);
  const done = !!so?.preparer && !!so?.reviewer;
  // ── the reviewer's OTHER answer ─────────────────────────────────────────────
  // Restored Aug 2026. returnControl has done the whole job since 9402d19 —
  // clears both conclusions, wipes the signature, stamps who returned it and
  // why, writes the trail entry — and lost its button in the merges that
  // followed. The reviewer queue never stopped advertising the choice: its rows
  // still read "countersign or return". A gate with only one way through is not
  // a gate, so the two answers sit together.
  //
  // The reason is required. Sending a paper back without saying what is wrong
  // costs the auditor the work twice and tells them nothing the second time.
  const [returning, setReturning] = useState(false);

  const Row = ({ label, entry, waiting }: { label: string; entry?: { by: string; at: string }; waiting: string }) => (
    <div className="flex items-center gap-2.5 py-2">
      {entry ? <CheckCircle2 size={16} className="text-compliant-700 shrink-0" /> : <Circle size={15} className="text-ink-300 shrink-0" />}
      <span className="text-[0.75rem] text-ink-400 w-27.5 shrink-0">{label}</span>
      <span className={cn('text-[0.8125rem] min-w-0 truncate', entry ? 'font-semibold text-ink-800' : 'text-ink-400')}>
        {entry ? `${entry.by} · ${entry.at}` : waiting}
      </span>
    </div>
  );

  return (
    <div id="wp-signoff" className="p-5 scroll-mt-4">
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

          {/* The notes sit with the signatures because they are the reason one of
              them is being withheld. */}
          <ReviewNotesBlock control={control} />

          <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[0.6875rem] text-ink-400 leading-relaxed min-w-0">
              {done ? 'Control done — the working paper is locked and downloadable.'
                : canSign ? 'Signing states that the testing above is complete and the conclusions are yours.'
                : role === 'reviewer' && !so?.preparer ? 'Waits for the preparer’s signature.'
                : notesPending > 0 ? `${notesPending} review note${notesPending === 1 ? '' : 's'} must close before the countersign — you can still return the paper.`
                : so?.preparer?.by === me ? 'You prepared this paper, so you can’t countersign it — four-eyes.'
                : role === 'reviewer' && designPending ? 'Approve the design on Test of design first — the countersign waits for it.'
                : 'Waits for the reviewer.'}
            </p>
            {canSign && (
              <button onClick={() => { signOffControlWp(control.id, 'preparer'); logEvent({ action: 'Update', description: `Signed off the working paper for ${control.id}`, module: 'SOX ICFR', entity: 'Control' }); }}
                className="shrink-0 h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[0.8125rem] font-semibold hover:bg-brand-700 transition-colors cursor-pointer"><PenLine size={14} /> Sign off</button>
            )}
            {(canReturn || canCounter) && (
              <span className="shrink-0 flex items-center gap-2">
                {canReturn && (
                  <button onClick={() => setReturning(r => !r)}
                    className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.8125rem] font-semibold text-ink-600 hover:border-risk-300 hover:text-risk-700 transition-colors cursor-pointer"><CornerDownRight size={14} /> Return to auditor</button>
                )}
                {canCounter && (
                  <button onClick={() => { signOffControlWp(control.id, 'reviewer'); logEvent({ action: 'Update', description: `Countersigned the working paper for ${control.id}`, module: 'SOX ICFR', entity: 'Control' }); }}
                    className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[0.8125rem] font-semibold hover:bg-brand-700 transition-colors cursor-pointer"><PenLine size={14} /> Countersign</button>
                )}
                {/* Countersign & next (product decision, 2 Oct): the same countersign,
                    then straight on to the next paper in the Reviewer queue's
                    order — or back to the queue when this was the last one. */}
                {canCounter && (
                  <>
                    <span className="text-[0.6875rem] text-ink-400 tabular-nums" title="Other papers waiting for your countersign">{waitingNext.length} waiting</span>
                    <button onClick={e => {
                      const scroller = e.currentTarget.closest('.overflow-y-auto');
                      signOffControlWp(control.id, 'reviewer');
                      logEvent({ action: 'Update', description: `Countersigned the working paper for ${control.id}`, module: 'SOX ICFR', entity: 'Control' });
                      const next = waitingNext[0];
                      if (!next) { openReviewerQueue('Nothing else waiting for your countersign.'); return; }
                      openControl(next.id);
                      scroller?.scrollTo({ top: 0 });
                    }}
                      className="h-9 px-4 inline-flex items-center gap-1 rounded-lg border border-brand-600 bg-canvas-elevated text-brand-700 text-[0.8125rem] font-semibold hover:bg-brand-50 transition-colors cursor-pointer">Countersign &amp; next <ChevronRight size={14} /></button>
                  </>
                )}
              </span>
            )}
          </div>

          {returning && canReturn && (
            <div className="mt-3 rounded-xl border border-risk-200 bg-risk-50/30 p-3.5">
              <span className="block text-[0.6875rem] font-bold uppercase tracking-wider text-ink-400 mb-1.5">What needs rework?</span>
              <ReturnForm onCancel={() => setReturning(false)} onReturn={reason => {
                returnControl(control.id, reason);
                setReturning(false);
                logEvent({ action: 'Update', description: `Returned ${control.id} to the auditor — ${reason}`, module: 'SOX ICFR', entity: 'Control' });
              }} />
            </div>
          )}

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

/**
 * A round of testing that was set aside, folded shut above the live one.
 *
 * Collapsed by default and open on a click: the reason it was set aside is the
 * part that has to be readable without asking, and the grid is the part you go
 * looking for. Read-only throughout — a closed round is a record, not a form.
 */
function PriorRound({ control, round }: { control: Control; round: ToeRound }) {
  const [open, setOpen] = useState(false);
  const items = round.sampling.samples;
  const attrs = control.operating.steps;
  const failed = Object.values(round.stepResults).filter(r => r === 'Fail').length;
  const passed = Object.values(round.stepResults).filter(r => r === 'Pass').length;
  const cell = (stepId: string, sampleId: string) => round.results[stepId]?.[sampleId] ?? 'Not tested';
  return (
    <div className="rounded-xl border border-canvas-border bg-paper-50/40 overflow-hidden">
      <button onClick={() => setOpen(o => !o)} aria-expanded={open}
        className="w-full text-left px-3.5 py-2.5 flex items-start gap-2.5 hover:bg-paper-50 transition-colors cursor-pointer">
        <History size={13} className="text-ink-400 mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[0.75rem] font-bold text-ink-700">Round {round.n}</span>
            <span className="text-[0.75rem] text-ink-500 tabular-nums">
              {items.length} item{items.length === 1 ? '' : 's'} · {passed} pass · {failed} fail
            </span>
            <span className="text-[0.6875rem] font-semibold text-ink-400 uppercase tracking-wide">set aside</span>
          </div>
          {/* The reason, always visible. It is the whole justification for there
              being a second round at all, so it does not hide behind a click. */}
          <p className="text-[0.75rem] text-ink-600 mt-1 leading-relaxed">
            “{round.setAside.reason}” <span className="text-ink-400">— {round.setAside.by}, {round.setAside.at}</span>
          </p>
        </div>
        <ChevronDown size={14} className={cn('text-ink-400 mt-0.5 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="border-t border-canvas-border px-3.5 py-3 overflow-x-auto">
          <table className="w-full border-collapse text-[0.6875rem]">
            <thead>
              <tr className="text-left">
                <th className="py-1 pr-3 font-semibold text-ink-500 whitespace-nowrap">Item</th>
                {attrs.map(a => <th key={a.id} className="py-1 px-2 font-semibold text-ink-500 whitespace-nowrap font-mono">{a.code}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-canvas-border">
              {items.map(it => (
                <tr key={it.id}>
                  <td className="py-1 pr-3 font-mono text-ink-500 whitespace-nowrap">{it.ref}</td>
                  {attrs.map(a => {
                    const r = cell(a.id, it.id);
                    return (
                      <td key={a.id} className={cn('py-1 px-2 text-center font-mono font-bold',
                        r === 'Pass' ? 'text-compliant-700' : r === 'Fail' ? 'text-risk-700' : 'text-ink-300')}>
                        {r === 'Pass' ? 'P' : r === 'Fail' ? 'F' : '—'}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={attrs.length + 1} className="py-2 text-ink-400">No items were drawn in this round.</td></tr>}
            </tbody>
          </table>
          <p className="text-[0.6875rem] text-ink-400 mt-2">
            {round.sampling.method} · {round.sampling.basis}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * What a failure opens, and what it closes.
 *
 * A first failure is not yet the control's: the draw may have been the thing at
 * fault. So two doors — extend the sample, which is the handbook's answer and
 * needs nothing written, and correct the criteria and draw again, which needs a
 * reason because the alternative is drawing until a clean sample turns up.
 *
 * A failure in the last round closes both. By then the finding is the control's,
 * the deficiency has already been raised against it, and more items cannot
 * unsettle what a second sample has now shown twice.
 */
function RoundActions({ control, canEdit }: { control: Control; canEdit: boolean }) {
  const { eng, extendSample, startToeRound } = useIcfr();
  const logEvent = useAuditLog();
  const { addToast } = useToast();
  const [asking, setAsking] = useState(false);
  const [why, setWhy] = useState('');
  const samp = control.operating.sampling;
  if (!canEdit || !toeRoundFailed(control) || isControlLockedIn(eng, control)) return null;
  const spent = toeSpent(control);
  const canRedraw = canRedrawToe(control);
  const canExtend = canExtendToe(control) && !!samp;
  const extra = samp?.size ?? 0;
  return (
    <div className={cn('rounded-xl border p-3.5 mb-5', spent ? 'border-risk-200 bg-risk-50/40' : 'border-mitigated-200 bg-mitigated-50/50')}>
      <div className="flex items-start gap-2.5">
        <AlertTriangle size={15} className={cn('mt-0.5 shrink-0', spent ? 'text-risk-700' : 'text-mitigated-700')} />
        <div className="min-w-0 flex-1">
          {spent ? (
            <>
              <h4 className="text-[0.8125rem] font-bold text-risk-700">The finding stands</h4>
              <p className="text-[0.75rem] text-ink-700 mt-1 leading-relaxed">
                This is round {toeRoundNo(control)} of {TOE_MAX_ROUNDS}, and it failed too — on a sample drawn to answer the first
                failure. The deficiency has been raised. There is no further round: extending or redrawing now would be
                looking for a kinder sample, not testing the control. Conclude ineffective and work the finding.
              </p>
            </>
          ) : (
            <>
              <h4 className="text-[0.8125rem] font-bold text-mitigated-800">An attribute failed — round {toeRoundNo(control)} of {TOE_MAX_ROUNDS}</h4>
              <p className="text-[0.75rem] text-ink-700 mt-1 leading-relaxed">
                A miss is never ignored. Extend the sample to see whether it is isolated — or, if the draw itself was wrong
                (the window, the entity, reversals nobody excluded), correct the criteria and draw once more. That second
                draw is the last one, and it needs a reason.
              </p>
              <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                {canExtend && (
                  <button onClick={() => {
                    extendSample(control.id, extra);
                    logEvent({ action: 'Update', description: `Extended the sample by ${extra} on ${control.id} after a failure`, module: 'SOX ICFR', entity: 'Test Result' });
                  }}
                    className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.75rem] font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-700 transition-colors cursor-pointer">
                    <Plus size={13} /> Extend the sample — draw {extra} more
                  </button>
                )}
                {canRedraw && (
                  <button onClick={() => setAsking(true)}
                    className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border border-mitigated-300 bg-canvas-elevated text-[0.75rem] font-semibold text-mitigated-800 hover:border-mitigated-400 transition-colors cursor-pointer">
                    <RotateCcw size={13} /> Fix the criteria and draw again
                  </button>
                )}
                {!canRedraw && (
                  <span className="text-[0.6875rem] text-ink-500">The redraw has been used — this is the last round.</span>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {asking && createPortal(
        <div className="modal-backdrop" onClick={() => setAsking(false)}>
          <motion.div role="dialog" aria-modal="true" aria-labelledby="toe-redraw-title" className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()} initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}><DialogFocus onEscape={() => setAsking(false)} />
            <div className="px-5 py-4">
              <h3 id="toe-redraw-title" className="text-[0.875rem] font-bold text-ink-900">Set round {toeRoundNo(control)} aside and draw again?</h3>
              <p className="text-[0.75rem] text-ink-500 mt-1.5 leading-relaxed">
                Round {toeRoundNo(control)} is kept whole — its items, its results and this reason all print on the working
                paper. The draw reopens at step ③, and what you draw next is the last round this control gets.
              </p>
              {/* Required, and the question is the specific one: not "why are you
                  redrawing" — which invites "to be sure" — but what was wrong with
                  the draw. A redraw is only defensible if the first one did not
                  test the control. */}
              <label className="block mt-3.5">
                <span className="text-[0.75rem] font-semibold text-ink-600">Why did the first draw not test this control?</span>
                <textarea autoFocus value={why} onChange={e => setWhy(e.target.value)} rows={3}
                  placeholder="e.g. the extract included reversals and test postings, so the failed item was never a payment the control applies to"
                  className="mt-1.5 w-full text-[0.75rem] rounded-lg border border-canvas-border bg-canvas-elevated px-2.5 py-2 text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-200 resize-none" />
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-canvas-border bg-paper-50/40">
              <button onClick={() => setAsking(false)} className="h-9 px-3.5 text-[0.8125rem] font-semibold text-ink-600 hover:text-ink-900 cursor-pointer">Keep this round</button>
              <button disabled={!why.trim()} onClick={() => {
                startToeRound(control.id, why.trim());
                logEvent({ action: 'Update', description: `Set a TOE round aside on ${control.id} and reopened the draw`, module: 'SOX ICFR', entity: 'Test Result' });
                setWhy(''); setAsking(false);
              }}
                className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[0.8125rem] font-semibold disabled:opacity-40 enabled:hover:bg-brand-700 transition-colors cursor-pointer">
                <RotateCcw size={13} /> Set aside and reopen
              </button>
            </div>
          </motion.div>
        </div>,
        document.body)}
    </div>
  );
}

// ── operating section (TOE) — locked until design effective ───────────────────────
function OperatingSection({ control, canEdit, locked }: { control: Control; canEdit: boolean; locked: boolean }) {
  const { eng, role, openAuditId, addAttribute, validateReadyAttributes, confirmIra } = useIcfr();
  const logEvent = useAuditLog();
  // what the run skipped is said under the run button (agentic UX #11)
  const runNote = useInlineNote();
  const o = control.operating; const prog = operatingProgress(control);
  const anyFail = o.steps.some(s => stepResult(s) === 'Fail');
  const allTested = o.steps.length > 0 && o.steps.every(s => stepResult(s) !== 'Not tested');
  const suggestion: TrackConclusion = operatingSuggestion(control);
  const [testing, setTesting] = useState(false);
  // A TOE run this page did not start (the chat's) shows here like its own.
  // One attribute's own run is left to that attribute's line.
  const liveRun = useControlRun(control.id);
  const chatRun = !testing && runStageOf(liveRun) === 'toe' && !liveRun!.label.startsWith('Reading the files behind attribute') ? liveRun : null;
  // Stopped from the Ira tab: the progress line goes the moment the run does (5 Oct).
  useEffect(() => { if (testing && !liveRun) setTesting(false); }, [testing, liveRun]);
  const openDetail = useOpenRailDetail();
  const [newAttr, setNewAttr] = useState('');
  const [addingAttr, setAddingAttr] = useState(false);
  const attCount = o.steps.filter(s => s.attestEnabled || s.attestation).length;
  // Only an attribute with every required file in can be validated; the rest
  // are skipped, and the line under the run button says which and how many files each is short.
  const ready = o.steps.filter(s => requiredFilesReady(s, control)).length;
  const untested = o.steps.filter(s => stepResult(s) === 'Not tested').length;
  /** Passing attributes the required files don't back yet (17 Sep). */
  const unbacked = passedWithoutFiles(control).length;

  const runAll = () => {
    runNote.clear();
    setTesting(true);
    // Same rule as the design run: the button is here, the narration is in the
    // rail, and the rail comes forward because the reader pressed this on the
    // left and would otherwise be watching the wrong column.
    const t = startRun(control.id, 'Reading the uploaded files against each attribute', TOE_RUN_STEPS, 2400, true);
    logEvent({ action: 'Run', description: `Ran AI validation on ${ready} ready attribute(s) for ${control.id}`, module: 'SOX ICFR', entity: 'Test Result' });
    // An attribute taken off a started plan is not Ira's, so it is not "skipped" either.
    const picked = control.iraPlan?.started ? control.iraPlan.attributes : undefined;
    const skipped = o.steps.filter(s => (!picked || picked.includes(s.id)) && !requiredFilesReady(s, control)).map(s => {
      const { uploaded, total } = requiredFilesCount(s, control);
      const missing = total - uploaded;
      // an attribute with an empty list isn't short a file — it has none to upload
      return total === 0 ? `${s.code}: no required files listed` : `${s.code}: ${missing} file${missing === 1 ? '' : 's'} missing`;
    });
    window.setTimeout(() => {
      const live = runIsLive(control.id, t);
      endRun(control.id);
      setTesting(false);
      if (!live) return;   // stopped from the Ira tab — nothing is written
      validateReadyAttributes(control.id);
      if (skipped.length) runNote.show('warning', `Ran on ${ready} attribute${ready === 1 ? '' : 's'}; skipped ${skipped.join(' · ')}.`);
    }, 2400);
  };
  // ── Automatic mode (agentic UX #3, user ask 1 Oct) ─────────────────────────
  // Attributes whose files are all in get read without a press, once per set of
  // files; Ira's sure results are confirmed in the tester's name. Attributes
  // still short a file are left alone here — the button run is what marks them
  // "couldn't test", and that is the tester's call to make.
  //
  // Ira's plan you approve (Stage 1a, 2 Oct): nothing here runs until Start is
  // pressed on the plan, in either mode, and only for the ticked attributes.
  const iraMode = useIraMode();
  const plan = control.iraPlan;
  const planRuns = !!plan?.started && !plan.skipped.includes('operating');
  const autoKey = useRef('');
  const autoReady = o.steps.filter(s => (!plan?.attributes || plan.attributes.includes(s.id)) && requiredFilesReady(s, control) && !s.validation && !s.override && stepResult(s) === 'Not tested');
  useEffect(() => {
    // An undone step waits for Run again on the plan (5 Oct) — Undo is not a cue to re-read.
    if (!planRuns || role !== 'auditor' || !canEdit || locked || testing || !autoReady.length || controlRun(control.id) || iraStepUndone(control.id, 'operating')) return;
    const key = `${control.id}|${autoReady.map(s => s.id).join(',')}`;
    if (autoKey.current === key) return;
    autoKey.current = key;
    runAll();
  }); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (iraMode !== 'automatic' || !planRuns || role !== 'auditor' || !canEdit || locked || o.conclusion !== 'Not tested') return;
    const sure = o.steps.filter(s => awaitsConfirm(s) && (confidenceOf(s.validation, `${control.id}:${s.id}`) ?? 0) >= CONFIDENT_AT);
    if (sure.length) confirmIra(control.id, 'operating', sure.map(s => s.id), { byIra: true });
  }, [iraMode, planRuns, role, canEdit, locked, o.conclusion, o.steps, control.id, confirmIra]);

  if (locked) {
    // A29 — a year-end control in an interim or roll-forward audit waits for the
    // year-end audit whatever TOD's state, so that is the one reason given.
    const held = operatingHeld(control, eng.audits.find(a => a.id === openAuditId));
    if (held) return <HeldState held={held} yearEndHint="This control runs once a year. It is tested for operation in the year-end audit, once the year has closed." />;
    return (
      <div className="p-5">
        <EmptyState icon={<Lock size={18} />} title="TOE is locked" hint={trackResult(control.design) === 'Effective' && !designApproved(control)
          // S6, A36 — concluded, but the reviewer has not approved it yet
          ? 'TOD is marked Design effective and waiting for the reviewer’s approval. TOE opens once it is approved.'
          : 'Mark TOD as Design effective to unlock TOE. A control that isn’t designed effectively isn’t tested for operation.'}>
          <span className="inline-flex items-center gap-1.5 text-[0.75rem] text-ink-500"><span>TOD is currently</span><TrackPill c={trackResult(control.design)} /></span>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="p-5">
      {/* Rounds that were set aside, above the live one — "same sample neeche aa
          jaayega uske". Folded shut, because the live round is the work; the old
          one is there to be checked, not to be read past. The round below is the
          ORDINARY TOE screen, unchanged: a second round is the same test done
          again, so it is the same screen (user ask). */}
      {toeRounds(control).length > 0 && (
        <div className="space-y-2 mb-5">
          {toeRounds(control).map(r => <PriorRound key={r.n} control={control} round={r} />)}
        </div>
      )}

      {/* sample context — the draw happens in step ③; this is read-only.
          Every control tests against a sample now, whatever its evidence mode. */}
      <div className="mb-5">
        {o.sampling ? (
          <div className="rounded-xl border border-canvas-border bg-paper-50/40 p-3 flex items-center gap-3 flex-wrap text-[0.75rem] text-ink-500">
            <span className="inline-flex items-center gap-1.5 font-semibold text-ink-700"><FlaskConical size={12} /> Testing {o.sampling.size} sampled items</span>
            {/* A size the auditor set against the agreed table is not an
                ordinary value, and the step that records the results is where
                it would most easily be read as one — so it is named here too,
                against the number it departed from. */}
            {o.sampling.override && (
              <span className="inline-flex items-center gap-1.5 font-semibold text-mitigated-700">
                <AlertTriangle size={12} className="shrink-0" />
                Departure from the agreed methodology — the table gives <span className="tabular-nums">{o.sampling.override.agreed}</span>
              </span>
            )}
            <span>{o.sampling.method} · {o.sampling.basis}</span>
            {o.population && <span className="text-ink-400">Population {o.population.count.toLocaleString()} · {o.population.tieOut}</span>}
          </div>
        ) : !isControlLockedIn(eng, control) && (
          <div className="rounded-xl border border-dashed border-canvas-border p-3 text-[0.75rem] text-ink-500 inline-flex items-center gap-1.5">
            <FlaskConical size={12} className="text-ink-400" /> No sample yet — draw one in step ③ to test against sampled items.
          </div>
        )}
      </div>

      {/* Each file once, then the item × attribute grid (agentic UI review #5,
          30 Sep): the files used to be listed again under every attribute that
          needed them, and the per-item answers only lived inside a popup. */}
      <ToeFiles control={control} canEdit={canEdit} onOpenFile={f => openDetail({ kind: 'file', file: f })} />
      <ToeGrid control={control} onOpenWorking={(st, it) => st.validation && openDetail({ kind: 'working', title: `${st.code} · ${st.description}`, validation: st.validation, control, step: st, confKey: `${control.id}:${st.id}`, home: sampleHome(eng, a => auditCovers(a, control, eng.id)), ...(it ? itemFocus(control, st, it) : {}) })}  />

      {/* attributes */}
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <h4 className="text-[0.8125rem] font-bold text-ink-700 inline-flex items-center gap-1.5"><ClipboardCheck size={14} /> Test attributes <span className="font-normal text-ink-400">· each evidenced independently</span></h4>
        <div className="flex items-center gap-2">
          <span className="text-[0.6875rem] text-ink-400 tabular-nums hidden md:inline">{attCount} attested · {prog.passed} pass · {prog.failed} fail</span>
          {/* Manual only (Stage 1a): in Automatic, Ira runs from its plan's Start. */}
          {canEdit && o.steps.length > 0 && !testing && iraMode === 'manual' && <button disabled={(ready === 0 && untested === 0) || !!liveRun} onClick={runAll} title={liveRun ? busyNote(liveRun) : ready === 0 ? 'No attribute has its files yet — Ira will say which it could not test, and draft the ask' : undefined} className={cn('h-8 px-3 inline-flex items-center gap-1.5 rounded-md bg-brand-600 text-white text-[0.75rem] font-semibold enabled:hover:bg-brand-700 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed')}><Sparkles size={12} /> {`Run AI validation on ready attributes (${ready} of ${o.steps.length})`}</button>}
          {canEdit && <button onClick={() => setAddingAttr(a => !a)} className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.75rem] font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-700 cursor-pointer"><Plus size={13} /> Add</button>}
        </div>
      </div>
      <InlineNote note={runNote.note} className="-mt-2 mb-3 text-right" />
      {testing && <RunLine files={o.steps.filter(s => requiredFilesReady(s, control)).reduce((n, s) => n + requiredFilesCount(s, control).uploaded, 0)} total={ready || o.steps.length} noun="attribute" ms={2400} />}
      {chatRun && <LiveRunLine run={chatRun} />}
      {!testing && !chatRun && <ConfirmSure control={control} which="operating" rows={o.steps} />}
      {addingAttr && (
        <div className="flex items-center gap-2 mb-3">
          <input aria-label="New attribute" autoFocus value={newAttr} onChange={e => setNewAttr(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newAttr.trim()) { addAttribute(control.id, newAttr.trim()); logEvent({ action: 'Create', description: `Added test attribute to ${control.id}`, module: 'SOX ICFR', entity: 'Control' }); setNewAttr(''); setAddingAttr(false); } }} placeholder="e.g. Approval evidenced before the transaction posts" className="flex-1 h-9 px-3 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.8125rem] focus:outline-none focus:ring-2 focus:ring-brand-200" />
          <button disabled={!newAttr.trim()} onClick={() => { addAttribute(control.id, newAttr.trim()); logEvent({ action: 'Create', description: `Added test attribute to ${control.id}`, module: 'SOX ICFR', entity: 'Control' }); setNewAttr(''); setAddingAttr(false); }} className="h-9 px-3 rounded-lg bg-brand-600 text-white text-[0.75rem] font-semibold disabled:opacity-40 cursor-pointer">Add</button>
        </div>
      )}
      {o.steps.length === 0 ? (
        <EmptyState icon={<ClipboardCheck size={18} />} title="No test attributes yet" hint="Add the attributes that prove the control operated. Each attribute lists the files it needs — once they're uploaded, run AI validation, or record the result yourself.">
          {canEdit && <button onClick={() => setAddingAttr(true)} className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[0.75rem] font-semibold hover:bg-brand-700 cursor-pointer"><Plus size={13} /> Add the first attribute</button>}
        </EmptyState>
      ) : (
        // Each attribute folded to one line until opened (user pick, 1 Oct: B of
        // three trial layouts) — the grid above carries the per-item answers.
        <div className="space-y-1.5 mb-5">{o.steps.map(st => <FoldableAttribute key={st.id} control={control} step={st} canEdit={canEdit} testing={(testing || !!chatRun) && requiredFilesReady(st, control)} />)}</div>
      )}

      {/* What a failure opens — and, in the last round, what it closes. Directly
          under the attributes, because that is where the failure was just read. */}
      <RoundActions control={control} canEdit={canEdit} />

      {/* No sample, no opinion — and no effective call while any attribute is
          still untested. A failing attribute concludes ineffective and the
          exception is raised — remediation happens outside this flow, and the
          retest comes back HERE once the fixed control has run (Control.retestDue). */}
      {o.steps.length > 0 && <ConcludeFooter control={control} which="operating" suggestion={suggestion} canEdit={canEdit}
        disableEffective={!o.sampling || untested > 0 || unbacked > 0}
        disableEffectiveNote={!o.sampling ? 'Locked — draw the sample in step ③ first'
          : untested > 0 ? `${untested} attribute${untested === 1 ? ' is' : 's are'} still untested — give each a result first`
          : unbacked > 0 ? `${unbacked} passed attribute${unbacked === 1 ? ' is' : 's are'} missing required files`
          : undefined} />}
    </div>
  );
}

// ── vertical stepper step ─────────────────────────────────────────────────────────
// `hideStatus` suppresses the default pill/stamp + flash — used by the sample step,
// whose status drives the node visual only (a "Sample approved" chip rides in `right`).
/**
 * ── Last round's set-up, waiting on the auditor (agentic UX #13) ──────────────
 * First thing in the step it holds. Each part says where it came from and
 * offers the two moves: Confirm unchanged, or Edit. Until one is pressed every
 * action in the step refuses (see `rollHeld` in the store). Once pressed it
 * shrinks to one line of record. Never Ira's to press, in either mode.
 */
function RollForwardBar({ control, parts }: { control: Control; parts: RollPart[] }) {
  const { role, confirmRollPart } = useIcfr();
  const rf = control.rollForward;
  const here = parts.filter(p => rf?.parts[p]);
  if (!rf || !here.length || role !== 'auditor') return null;
  const pending = here.filter(p => rf.parts[p]?.state === 'pending');
  return (
    <div id={ROLL_PART_ANCHOR[here[0]]} className="px-5 pt-5 scroll-mt-4">
      <div className="rounded-xl border border-canvas-border bg-paper-50/60 px-3.5 py-3">
        <p className="text-[0.75rem] text-ink-700 leading-relaxed">
          <span className="font-semibold text-ink-900">From the {rf.from}</span>
          {pending.length > 0 ? ' — check it still holds. Nothing in this step runs until you confirm it or edit it.' : ''}
        </p>
        <ul className="mt-2 space-y-1.5">
          {here.map(p => {
            const st = rf.parts[p]!;
            return (
              <li key={p} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[0.75rem]">
                <span className="min-w-0 flex-1 text-ink-800">
                  {ROLL_PART_LABEL[p]}
                  {p === 'attributes' && rf.sampling && <span className="text-ink-500"> · last round drew {rf.sampling.size}, {rf.sampling.method.toLowerCase()}</span>}
                </span>
                {st.state === 'pending' ? (
                  <span className="flex items-center gap-1.5">
                    <button type="button" onClick={() => confirmRollPart(control.id, p, 'confirmed')}
                      className="h-7 px-2.5 rounded-md bg-brand-600 text-white text-[0.75rem] font-semibold hover:bg-brand-700 transition-colors cursor-pointer">Confirm unchanged</button>
                    <button type="button" onClick={() => confirmRollPart(control.id, p, 'edited')}
                      className="h-7 px-2.5 rounded-md border border-canvas-border bg-canvas-elevated text-[0.75rem] font-semibold text-ink-700 hover:border-ink-300 transition-colors cursor-pointer">Edit</button>
                  </span>
                ) : (
                  <span className="text-[0.6875rem] text-ink-500">{st.state === 'confirmed' ? 'Confirmed unchanged' : 'Taken to edit'} by {st.by} · {st.at}</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/** `sealed` — the step is locked because its own work was approved, not because
 *  a gate holds it shut: the node wears the approval mark, not the padlock. */
function VStep({ n, title, subtitle, status, locked, sealed, right, children, defaultOpen = true, id, hideStatus, arrived }: { n: number; title: string; subtitle: string; status: TrackConclusion; locked?: boolean; sealed?: boolean; right?: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean; id?: string; hideStatus?: boolean; arrived?: boolean }) {
  const nodeClass = locked ? 'locked' : status === 'Effective' ? 'done' : status === 'Ineffective' ? 'fail' : 'active';
  const concluded = !hideStatus && (status === 'Effective' || status === 'Ineffective');
  const [open, setOpen] = useState(defaultOpen);
  // A step somebody was sent to opens, even if it started folded as finished.
  useEffect(() => { if (arrived) setOpen(true); }, [arrived]);
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

  // `arrived` rings the step somebody was sent to. A page that scrolls somewhere
  // without saying why looks like it loaded wrong — the ring is what makes the
  // scroll read as an answer to the click, and it clears itself.
  return (
    <motion.div id={id} className={cn('vstep transition-shadow duration-500', arrived && 'rounded-xl ring-2 ring-brand-500/60 shadow-lg shadow-brand-500/10')} variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}>
      <div className="vstep-rail" />
      <div className={cn('vstep-node', nodeClass)}>{locked ? (sealed ? <BadgeCheck size={15} /> : <Lock size={15} />) : status === 'Effective' ? <Check size={17} strokeWidth={3} /> : status === 'Ineffective' ? <X size={16} strokeWidth={3} /> : n}</div>
      <div className={cn('panel relative', locked && 'panel-locked')}>
        <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} title={open ? 'Collapse' : 'Expand'} className={cn('w-full flex items-start justify-between gap-3 px-5 pt-4 pb-3 text-left cursor-pointer transition-colors hover:bg-paper-50/40', open && 'border-b border-canvas-border')}>
          <div className="flex items-start gap-2.5 min-w-0">
            <ChevronDown size={16} className={cn('mt-0.5 text-ink-400 shrink-0 transition-transform', !open && '-rotate-90')} />
            <div className="min-w-0">
              <h3 className="text-[0.9375rem] font-bold text-ink-900">{title}</h3>
              {/* fills the container — a 520px cap wrapped these to more rows than they needed */}
              {open && <p className="text-[0.75rem] text-ink-500 mt-0.5">{subtitle}</p>}
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
  { id: 'all', label: 'All' }, { id: 'control', label: 'Control' }, { id: 'design', label: '① TOD' }, { id: 'operating', label: '④ TOE' },
];
// the two hands on the working paper — auditor (purple/gavel) and risk owner (amber/check)
const EXEC_ROLE: Record<Role, { Icon: typeof Gavel; accent: string; chip: string; label: string }> = {
  auditor: { Icon: Gavel, accent: 'var(--color-brand-400)', chip: 'bg-brand-50 text-brand-700', label: 'Auditor' },
  'risk-owner': { Icon: UserCheck, accent: 'var(--color-mitigated-500)', chip: 'bg-mitigated-50 text-mitigated-700', label: 'Risk owner' },
  // our branch carries a third persona — the reviewer who countersigns
  reviewer: { Icon: UserCheck, accent: 'var(--color-evidence-500)', chip: 'bg-evidence-50 text-evidence-700', label: 'Reviewer' },
};
const TRACK_FILTERS = [{ id: 'all', label: 'All' }, { id: 'design', label: '① TOD' }, { id: 'operating', label: '④ TOE' }] as const;

function ExecResult({ result }: { result?: TestResult | TrackConclusion }) {
  if (!result || result === 'Not tested') return null;
  const pass = result === 'Pass' || result === 'Effective';
  return <span className="inline-flex items-center gap-1"><Tickmark result={pass ? 'Pass' : 'Fail'} size={13} /><span className={cn('text-[0.6875rem] font-bold', pass ? 'text-compliant-700' : 'text-risk-700')}>{result}</span></span>;
}

/** One Ira run in History (Stage 1c): one line — what it read and how sure it
 *  was — folding open to the files, then each check or attribute with its
 *  answer, confidence and the file the answer was read in. Read off the
 *  snapshot taken at the run, so it still says what this run found after the
 *  rows have been confirmed, overridden or run again. */
function IraRunLine({ e }: { e: ExecutionEvent & { iraRun: NonNullable<ExecutionEvent['iraRun']> } }) {
  const [open, setOpen] = useState(false);
  const { files, items } = e.iraRun;
  const sure = items.filter(i => i.result !== 'blocked' && (i.confidence ?? 0) >= CONFIDENT_AT).length;
  const unsure = items.filter(i => i.result !== 'blocked' && (i.confidence ?? 0) < CONFIDENT_AT).length;
  const couldnt = items.filter(i => i.result === 'blocked').length;
  const failed = items.filter(i => i.result === 'Fail').length;
  const tally = [sure && `${sure} sure`, unsure && `${unsure} less sure`, couldnt && `${couldnt} couldn't test`, failed && `${failed} failed`].filter(Boolean).join(', ');
  return (
    // sits on the trail like every other entry — the node carries Ira's one
    // sparkle, the card is the one line
    <div className="flex gap-2.5">
    <span className="exec-node text-brand-500"><Sparkles size={13} aria-hidden /></span>
    <div className="exec-card flex-1 min-w-0 !p-0" style={{ borderLeftColor: 'var(--color-brand-400)' }}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        className="w-full flex items-center gap-2 px-2.5 py-2 text-left cursor-pointer hover:bg-paper-50/60 rounded-[10px] transition-colors">
        <span className="flex-1 min-w-0 truncate text-[0.75rem] text-ink-800">Ira read {files.length} file{files.length === 1 ? '' : 's'}{tally && <span className="text-ink-500"> · {tally}</span>}</span>
        <span className="text-[0.6875rem] text-ink-400 shrink-0">{e.at}</span>
        <ChevronRight size={13} className={cn('text-ink-400 shrink-0 transition-transform', open && 'rotate-90')} />
      </button>
      {open && (
        <div className="px-2.5 pb-2.5 pt-0.5 space-y-2 border-t border-canvas-border">
          <div className="pt-2 text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-400">{e.track === 'design' ? '① TOD' : '④ TOE'} · files read</div>
          {files.length > 0
            ? <ul className="space-y-0.5">{files.map(f => <li key={f} className="flex items-center gap-1.5 text-[0.6875rem] text-ink-600 min-w-0"><Paperclip size={10} className="text-ink-400 shrink-0" /><span className="truncate">{f}</span></li>)}</ul>
            : <p className="text-[0.6875rem] text-ink-400">No file was on record for this run.</p>}
          <ul className="space-y-1.5">
            {items.map((i, k) => (
              <li key={k} className="flex items-start gap-2 min-w-0">
                <span className="mt-px shrink-0"><Tickmark result={i.result === 'blocked' ? 'Not tested' : i.result} blocked={i.result === 'blocked'} confidence={i.confidence} size={13} /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-[0.6875rem] text-ink-800 leading-snug truncate" title={i.label}>{i.label}</div>
                  <div className="text-[0.6875rem] text-ink-400 truncate">
                    {i.result === 'blocked' ? "Couldn't test" : i.result === 'Pass' ? 'Passed' : 'Failed'}
                    {i.confidence != null && ` · ${Math.round(i.confidence)}% sure`}
                    {i.source && ` · read in ${i.source}`}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
    </div>
  );
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
      <div role="tablist" aria-label="Filter the trail" onKeyDown={tabKeys} className="px-3 pb-2 flex items-center gap-1">
        {TRACK_FILTERS.map(t => <button key={t.id} role="tab" aria-selected={track === t.id} onClick={() => setTrack(t.id)} className={cn('h-7 px-2.5 rounded-md text-[0.75rem] font-semibold transition-colors cursor-pointer', track === t.id ? 'bg-brand-600 text-white' : 'text-ink-500 hover:text-ink-800')}>{t.label}</button>)}
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {events.length === 0 ? (
          <div className="text-center text-[0.75rem] text-ink-400 py-10 px-4">No runs yet{track !== 'all' ? ` on ${track === 'design' ? 'TOD' : 'TOE'}` : ''}.<br />Execute TOD or TOE — it shows up here for the auditor and the risk owner alike.</div>
        ) : (
          <div className="exec-trail space-y-2">
            {events.map(e => {
              if (e.iraRun) return <IraRunLine key={e.id} e={{ ...e, iraRun: e.iraRun }} />;
              const rm = EXEC_ROLE[e.role];
              const who = e.by.split(' · ')[0];
              return (
                <div key={e.id} className="flex gap-2.5">
                  <span className="exec-node" style={{ color: rm.accent }}><rm.Icon size={13} /></span>
                  <div className="exec-card flex-1 min-w-0" style={{ borderLeftColor: rm.accent }}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[0.75rem] text-ink-800 leading-snug"><b className="font-semibold">{who}</b> {e.verb}</span>
                      <span className="text-[0.6875rem] text-ink-400 shrink-0 mt-0.5">{e.at}</span>
                    </div>
                    {(e.target || e.result) && (
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {e.target && <span className="font-mono text-[0.6875rem] font-semibold text-ink-500 bg-paper-50 border border-canvas-border rounded px-1.5 h-4.5 inline-flex items-center max-w-full truncate">{e.target}</span>}
                        <ExecResult result={e.result} />
                      </div>
                    )}
                    <div className="mt-1.5 inline-flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-400">{e.track === 'design' ? '① TOD' : '④ TOE'}<span className={cn('normal-case tracking-normal rounded px-1.5 h-4 inline-flex items-center', rm.chip)}>{rm.label}</span></div>
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
      <div role="tablist" aria-label="Discussion threads" onKeyDown={tabKeys} className="px-3 pb-2 flex items-center gap-1">
        {ANCHORS.map(a => <button key={a.id} role="tab" aria-selected={tab === a.id} onClick={() => setTab(a.id)} className={cn('h-7 px-2.5 rounded-md text-[0.75rem] font-semibold transition-colors cursor-pointer', tab === a.id ? 'bg-brand-600 text-white' : 'text-ink-500 hover:text-ink-800')}>{a.label}</button>)}
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {threads.length === 0 && <div className="text-center text-[0.75rem] text-ink-400 py-10">No discussion here yet. Start a thread below — your role is tagged automatically.</div>}
        {threads.map(d => (
          <div key={d.id} className="space-y-2">
            <div className="flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-400">{d.anchor === 'design' ? '① TOD' : d.anchor === 'operating' ? '④ TOE' : 'Control'}{d.resolved && <Pill tone="compliant">Resolved</Pill>}<button onClick={() => resolveDiscussion(d.id, !d.resolved)} className="ml-auto text-ink-400 hover:text-brand-700 normal-case cursor-pointer">{d.resolved ? 'reopen' : 'resolve'}</button></div>
            {d.comments.map(c => (
              <div key={c.id} className={cn('disc-bubble', c.role)}>
                <div className="flex items-center justify-between gap-2 mb-1"><span className="text-[0.75rem] font-bold text-ink-800">{c.by}</span><span className="text-[0.6875rem] text-ink-400">{c.at}</span></div>
                <p className="text-[0.75rem] text-ink-700 leading-snug">{c.text}</p>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="p-3 border-t border-canvas-border">
        <div className="text-[0.6875rem] text-ink-400 mb-1.5">Posting to <b className="text-ink-600">{postAnchor === 'control' ? 'Control' : postAnchor === 'design' ? '① TOD' : '④ TOE'}</b> as <b className="text-ink-600 capitalize">{role}</b></div>
        <div className="flex items-end gap-2">
          <textarea aria-label="Comment" value={text} onChange={e => setText(e.target.value)} rows={2} placeholder="Add a comment or ask the risk owner…" className="flex-1 text-[0.75rem] rounded-lg border border-canvas-border bg-canvas-elevated px-2.5 py-2 text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-200 resize-none" />
          <button aria-label="Post comment" disabled={!text.trim()} onClick={() => { addComment(control.id, postAnchor, text.trim()); logEvent({ action: 'Create', description: `Posted comment on ${control.id}`, module: 'SOX ICFR', entity: 'Comment' }); setText(''); }} className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-lg bg-brand-600 text-white disabled:opacity-40 enabled:hover:bg-brand-700 transition-colors cursor-pointer"><Send size={15} /></button>
        </div>
      </div>
    </>
  );
}

// right rail — Ira, then the collaboration surfaces: what was done (History)
// and what was said (Discussion).
//
// Ira leads and opens by default (user ask, 21 Sep). The other two panes are
// records of work already finished; Ira is about the work in front of you, so
// a rail that opened on History put the past where the next move should be.
// Nothing was lost to make room — both old panes are one click away, and the
// rail is 40px wider to carry three tabs without cramping them.
/** Which of the rail's three panes is showing. Held by the page so the folded
 *  spine and the open rail agree about it. */
type RailPane = 'needs' | 'ask' | 'activity';
type ActivityView = 'changes' | 'comments';

/** History — what was done and what was said, in one tab (agentic UI review
 *  #6, 30 Sep). History and Discussion were two tabs of their own; the rail is
 *  three now — Needs you, Ira, History (the user kept the old names for the
 *  last two, 30 Sep) — and both records live here, one switch apart. */
function ActivityPane({ control, view, onView }: { control: Control; view: ActivityView; onView: (v: ActivityView) => void }) {
  const { eng } = useIcfr();
  const openDisc = discussionsFor(eng, control.id).filter(d => !d.resolved).length;
  const seg = (on: boolean) => cn('h-7 px-2.5 rounded-md text-[0.75rem] font-semibold transition-colors cursor-pointer', on ? 'bg-paper-100 text-ink-900' : 'text-ink-500 hover:text-ink-800');
  return (
    <>
      <div role="tablist" aria-label="History" onKeyDown={tabKeys} className="px-3 pb-1.5 flex items-center gap-1">
        <button role="tab" aria-selected={view === 'changes'} onClick={() => onView('changes')} className={seg(view === 'changes')}>Changes</button>
        <button role="tab" aria-selected={view === 'comments'} onClick={() => onView('comments')} className={seg(view === 'comments')}>Comments{openDisc > 0 && <span className="ml-1 tabular-nums text-high-700">{openDisc}</span>}</button>
      </div>
      {view === 'changes' ? <ExecutionTrail control={control} /> : <DiscussionPane control={control} />}
    </>
  );
}

function ActivityRail({ control, pane, onPane, onCollapse, detail, onCloseDetail, activityView, onActivityView }: {
  control: Control; pane: RailPane; onPane: (p: RailPane) => void; onCollapse: () => void;
  detail: RailDetail | null; onCloseDetail: () => void; activityView: ActivityView; onActivityView: (v: ActivityView) => void;
}) {
  const { eng, role, me, openAuditId } = useIcfr();
  // The pane belongs to the page, not to this component: the folded spine
  // picks one too, and a rail that forgot which tab was chosen the moment it
  // was folded would make folding it destructive. Picking a tab also closes
  // whatever detail (Ira's working, a file) was open over it.
  const setPane = (p: RailPane) => { onCloseDetail(); onPane(p); };
  // Ambient level (review #11): the count on the tab, never a toast.
  const needs = needsYouItems(control, eng, role, openAuditId, me).length;
  const tabCls = (on: boolean) => cn('flex-1 min-w-0 h-8 rounded-lg text-[0.75rem] font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer', on ? 'bg-canvas-elevated text-brand-700 shadow-[0_1px_4px_-1px_rgba(15,8,30,0.18)] ring-1 ring-canvas-border' : 'text-ink-500 hover:text-ink-800');
  return (
    <aside className="panel overflow-hidden h-full min-h-0 flex flex-col">
      <div className="flex items-center gap-2 m-3 mb-2">
        <div role="tablist" aria-label="Control rail" onKeyDown={tabKeys} className="flex-1 min-w-0 flex items-center gap-1 p-1 rounded-xl bg-paper-50 border border-canvas-border">
          <button role="tab" aria-selected={pane === 'ask' && !detail} onClick={() => setPane('ask')} className={tabCls(pane === 'ask' && !detail)}><Sparkles size={13} /> Ira</button>
          <button role="tab" aria-selected={pane === 'needs' && !detail} onClick={() => setPane('needs')} className={tabCls(pane === 'needs' && !detail)}><Inbox size={13} /> Needs you{needs > 0 && <span className="text-[0.625rem] tabular-nums opacity-70">{needs}</span>}</button>
          <button role="tab" aria-selected={pane === 'activity' && !detail} onClick={() => setPane('activity')} className={tabCls(pane === 'activity' && !detail)}><History size={13} /> History</button>
        </div>
        <button onClick={onCollapse} title="Hide this rail" aria-label="Hide the Ira rail"
          className="shrink-0 w-8 h-8 rounded-lg text-ink-400 hover:text-ink-700 hover:bg-paper-50 inline-flex items-center justify-center transition-colors cursor-pointer">
          <PanelRightClose size={16} />
        </button>
      </div>
      {detail ? <RailDetailPane detail={detail} onBack={onCloseDetail} />
        : pane === 'needs' ? <NeedsYouPane control={control} onGoComments={() => { onActivityView('comments'); setPane('activity'); }} />
        : pane === 'ask' ? <ControlChatPane key={control.id} control={control} />
        : <ActivityPane control={control} view={activityView} onView={onActivityView} />}
    </aside>
  );
}

/** The rail folded away — a spine, not a shut door (user ask, 22 Sep).
 *
 *  It carries the ways back IN and nothing else. It used to stack the three
 *  scores above them (22 Sep) — but the status bar now prints those scores
 *  across the top of the page in either state, so a folded rail repeating them
 *  down an 80px column was the same three numbers twice on one screen, in the
 *  narrower and worse of the two shapes (user ask, 23 Sep).
 *
 *  Every button here unfolds. The difference between them is WHICH pane you
 *  land on, so a reader who wants the history does not have to open the chat
 *  first and then leave it. */
function RailSpine({ control, running, onOpen }: { control: Control; running: boolean; onOpen: (p: RailPane) => void }) {
  const { eng, role, me, openAuditId } = useIcfr();
  const still = useReducedMotion();
  const execCount = eng.executions.filter(e => e.controlId === control.id).length;
  const needs = needsYouItems(control, eng, role, openAuditId, me).length;
  // One shape for all three (user ask, 23 Sep). History and Discussion were
  // naked 15px glyphs stacked under a 36px tile that plainly WAS a button, so
  // they read as leftovers rather than as the other two ways in. They take Ira's
  // tile and Ira's caption — and a flat paper face against its gradient, because
  // the hierarchy is the point: one thing in this column does the work.
  const tile = 'group w-full rounded-xl py-2 flex flex-col items-center gap-1.5 transition-colors cursor-pointer';
  const quietFace = 'relative inline-flex items-center justify-center size-9 rounded-xl border border-canvas-border bg-paper-50 text-ink-500 transition-colors group-hover:border-brand-100 group-hover:bg-brand-50 group-hover:text-brand-700';
  // Sentence case, not capitals (user ask, 30 Sep).
  const cap = 'text-[0.6875rem] font-semibold';
  // The count rides the tile's corner rather than sharing a line with the icon:
  // at this size a numeral beside a glyph reads as part of the glyph.
  const badge = 'absolute -top-1 -right-1 min-w-3.75 h-3.75 px-1 rounded-full inline-flex items-center justify-center text-[0.625rem] font-bold tabular-nums';
  return (
    <div className="panel absolute inset-0 bottom-6 flex flex-col overflow-hidden">
      {/* The fold control sits where it sits in the open rail — top right of
          the head — so it is in the same place in both states. */}
      <button onClick={() => onOpen('ask')} title="Open the Ira rail" aria-label="Open the Ira rail"
        className="shrink-0 h-7 mt-1 mx-1 rounded-lg text-ink-400 hover:text-ink-700 hover:bg-paper-50 inline-flex items-center justify-center transition-colors cursor-pointer">
        <PanelRightClose size={15} className="rotate-180" />
      </button>

      {/* PARKED (22 Sep, user ask) — the five-dot spine stood between the
          scores and the footer. It said which step the control was on, which
          the stepper down the left-hand side of the page already says at full
          size and in words: the folded rail sat directly beside it repeating
          the same five numbers in 20px circles. The scores and the way back to
          Ira are what this column is for, and the chat itself names the step
          in words the moment it is opened. */}

      {/* ── the three ways back in ──────────────────────────────────────────
          At the top, under the fold (user ask, 23 Sep). They sat at the floor
          while the scores filled the column above them, which was the right
          answer then and is the wrong one now that the scores have gone: three
          buttons pinned to the bottom of an otherwise empty 80px strip read as
          having been left there. Under the fold they read as the column's
          content, and they land where the open rail puts the same three — its
          tab row is the first thing in the pane, so unfolding no longer moves
          them from one end of the screen to the other.

          They are the same KIND of thing: each one unfolds, and the only
          difference is which pane you land on. Ira leads and keeps its mark —
          the product's AI signature (brand → fuchsia, Ask IRA's own avatar),
          ringed while a run is in flight so a validation started on the left is
          visible from a column this narrow. */}
      <div className="shrink-0 px-1.5 pt-0.5 pb-2 space-y-1">
        <button onClick={() => onOpen('ask')} title="Ask Ira about this control" aria-label="Open the Ira chat"
          className={cn(tile, 'hover:bg-brand-50')}>
          <span className="relative inline-flex size-9">
            {running && !still && (
              <motion.span aria-hidden className="absolute inset-0 rounded-xl bg-brand-400"
                animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }} />
            )}
            <span className="relative inline-flex items-center justify-center w-full h-full rounded-xl bg-gradient-to-br from-brand-500 to-fuchsia-500 text-white shadow-[0_4px_16px_-4px_rgba(106,18,205,0.5)]">
              <Sparkles size={17} strokeWidth={2.25} />
            </span>
          </span>
          <span className={cn(cap, 'text-brand-700')}>Ira</span>
        </button>
        {/* Needs you, after Ira (user ask, 30 Sep). The count is amber because
            it is somebody's decision waiting. */}
        <button onClick={() => onOpen('needs')} title={needs > 0 ? `Needs you — ${needs}` : 'Needs you'} aria-label="Open what needs you"
          className={cn(tile, 'hover:bg-paper-50')}>
          <span className={quietFace}>
            <Inbox size={17} strokeWidth={2} />
            {needs > 0 && <span className={cn(badge, 'bg-high-100 text-high-700')}>{needs}</span>}
          </span>
          <span className={cn(cap, 'text-ink-400 group-hover:text-brand-700')}>Needs you</span>
        </button>
        <button onClick={() => onOpen('activity')} title={`History — ${execCount} change${execCount === 1 ? '' : 's'}`} aria-label="Open the history"
          className={cn(tile, 'hover:bg-paper-50')}>
          <span className={quietFace}>
            <History size={17} strokeWidth={2} />
            {execCount > 0 && <span className={cn(badge, 'bg-paper-200 text-ink-600')}>{execCount}</span>}
          </span>
          <span className={cn(cap, 'text-ink-400 group-hover:text-brand-700')}>History</span>
        </button>
      </div>
    </div>
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
/**
 * The operating steps' shared "nothing to do here yet" state.
 *
 * Population, Sample and Test of effectiveness are all held by the same two
 * reasons, so they say it in the same words. The year-end wording is each
 * step's own (the rule differs in what it means for that step); the parked
 * wording is written once here, because the auditor's reason is the message
 * and it should not be paraphrased three ways.
 */
function HeldState({ held, yearEndHint }: {
  held: NonNullable<ReturnType<typeof operatingHeld>>; yearEndHint: string;
}) {
  return (
    <div className="p-5">
      <EmptyState icon={<Lock size={18} />}
        title={held.kind === 'parked' ? `Parked until ${held.until} — not yet operated` : `Pending until ${held.until} — tested in the year-end audit`}
        hint={held.kind === 'parked'
          ? `${held.reason} Parked by ${held.by}. This is not a finding — the control has not been shown to have failed, it has not run yet.`
          : yearEndHint} />
    </div>
  );
}

/**
 * PARK THE OPERATING TEST — the control has not run yet.
 *
 * A sibling of UnableToTestBanner above, and deliberately the quieter of the
 * two: that one is a request to a person, this one is a statement of fact about
 * the calendar. Neither is a finding, and both say so.
 *
 * Offered only once the design is concluded and approved. Before that the
 * design gate already holds the operating steps shut, so a second lock would
 * only add noise — and it should not be possible to park a control whose design
 * nobody has checked.
 */
function ParkOperatingBanner({ control }: { control: Control }) {
  const { eng, role, parkOperating, resumeOperating } = useIcfr();
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  const [from, setFrom] = useState('');
  const parked = control.operating.parked;
  const eligible = role === 'auditor' && !isControlLockedIn(eng, control)
    && trackResult(control.design) === 'Effective' && designApproved(control);

  if (parked) {
    return (
      <div className="rounded-xl border border-evidence-200 bg-evidence-50/40 p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h3 className="text-[0.8125rem] font-bold text-evidence-700 inline-flex items-center gap-1.5">
              <CalendarClock size={15} /> Operating test parked until {parked.expectedFrom}
            </h3>
            <p className="text-[0.75rem] text-ink-700 mt-1">{parked.reason}</p>
            <p className="text-[0.6875rem] text-ink-400 mt-1">
              Parked by {parked.by} · {parked.at}. The design is tested; the control has not run yet, so it cannot be
              concluded effective — nobody has watched it operate. This is not a finding.
            </p>
          </div>
          {role === 'auditor' && !isControlLockedIn(eng, control) && (
            <button onClick={() => resumeOperating(control.id)}
              className="shrink-0 h-8 px-3 rounded-lg bg-brand-600 text-white text-[0.75rem] font-semibold hover:bg-brand-700 cursor-pointer">
              It has operated — resume testing
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!eligible || control.unableToTest) return null;

  return asking ? (
    <div className="rounded-xl border border-evidence-200 bg-evidence-50/40 p-4 space-y-2">
      <h3 className="text-[0.8125rem] font-bold text-evidence-700 inline-flex items-center gap-1.5"><CalendarClock size={15} /> Park the operating test</h3>
      <p className="text-[0.75rem] text-ink-600">
        For a control that has not run yet — implemented mid-year, or a system that went live after the period began.
        It stays off the overdue list until you say it has operated, and it is not a finding.
      </p>
      <input value={reason} onChange={e => setReason(e.target.value)}
        placeholder="Why it cannot be tested yet — e.g. the control went live with the new AP system in August"
        className="w-full h-8 px-2.5 rounded-md border border-canvas-border bg-canvas-elevated text-[0.8125rem] focus:outline-none focus:border-brand-300" />
      <input value={from} onChange={e => setFrom(e.target.value)}
        placeholder="Testable from — e.g. 30 Nov 2026"
        className="w-full h-8 px-2.5 rounded-md border border-canvas-border bg-canvas-elevated text-[0.8125rem] focus:outline-none focus:border-brand-300" />
      <div className="flex items-center gap-2">
        <button disabled={!reason.trim() || !from.trim()}
          onClick={() => { parkOperating(control.id, reason.trim(), from.trim()); setAsking(false); setReason(''); setFrom(''); }}
          className="h-8 px-3 rounded-lg bg-evidence-600 text-white text-[0.75rem] font-semibold enabled:hover:bg-evidence-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">Park it</button>
        <button onClick={() => setAsking(false)} className="h-8 px-2.5 rounded-lg border border-canvas-border text-[0.75rem] font-semibold text-ink-600 cursor-pointer">Cancel</button>
        {(!reason.trim() || !from.trim()) && (
          <span className="text-[0.6875rem] text-ink-500">A reason and a date, both — a park with no date is an excuse.</span>
        )}
      </div>
    </div>
  ) : (
    <button onClick={() => setAsking(true)} className="text-[0.75rem] font-semibold text-ink-500 hover:text-evidence-700 cursor-pointer inline-flex items-center gap-1.5">
      <CalendarClock size={13} /> Hasn't operated yet — park the operating test
    </button>
  );
}

/**
 * THE CONTROL CHANGED — AND IT IS OWED A RETEST.
 *
 * A remediation closed against this control, so the thing this paper tested is
 * not the thing running now. The retest is deliberately NOT part of the exception
 * flow (30 Sep): a fix agreed in July cannot be proved in July, because the fixed
 * control has not run yet. So closing the exception raises this flag and the retest
 * happens here, on the audit's own timetable, once there is something to test.
 *
 * It sits above the steps for the same reason the return and reopen notices do —
 * it is the reason to look at this control again — and it deliberately does NOT
 * hide behind the lock. A concluded, countersigned paper about a control that has
 * since been rebuilt is exactly the case this exists to catch, and a banner that
 * vanished at sign-off would only ever appear on papers nobody had finished.
 *
 * Clearing it is the auditor's, and it takes a reason either way: "retested" points
 * at the round, "not needed" is a judgement, and a judgement nobody wrote down did
 * not happen. Cleared, it stops shouting and stays on the page — the fact that a
 * change was noticed and answered is working paper, not housekeeping.
 */
function RetestDueBanner({ control }: { control: Control }) {
  const { eng, role, clearRetestDue } = useIcfr();
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  const due = control.retestDue;
  if (!due) return null;

  const def = eng.deficiencies.find(d => d.id === due.defId);
  const trackWord = due.track === 'design' ? 'design' : 'operating';

  if (due.cleared) {
    return (
      <div className="rounded-xl border border-canvas-border bg-paper-50/60 p-4 mb-4 flex items-start gap-3">
        <CheckCircle2 size={16} className="text-compliant-600 mt-0.5 shrink-0" />
        <div className="min-w-0">
          <h3 className="text-[0.8125rem] font-bold text-ink-800">Retest settled</h3>
          <p className="text-[0.75rem] text-ink-700 leading-relaxed mt-1">{due.cleared.reason}</p>
          <p className="text-[0.6875rem] text-ink-400 mt-1.5">
            {due.cleared.by} · {due.cleared.at}. Raised when {due.defId} closed — {due.note}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-mitigated-200 bg-mitigated-50/40 p-4 mb-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <h3 className="text-[0.8125rem] font-bold text-mitigated-800 inline-flex items-center gap-1.5">
            <RotateCcw size={15} /> Changed since it was tested — a retest is owed
          </h3>
          <p className="text-[0.75rem] text-ink-700 leading-relaxed mt-1">{due.note}</p>
          <p className="text-[0.6875rem] text-ink-500 mt-1.5">
            {due.defId}{def ? ` — ${def.description}` : ''} closed on {due.at} by {due.by}. The {trackWord} track is the one
            that failed and was rebuilt, so it is the one to read again
            {due.fix === 'redesign' ? ' — and a redesign means a new version to record before it can be tested' : ''}.
          </p>
          {/* The conclusions are untouched on purpose. Wiping somebody's signed
              work because a third party closed a remediation would delete it
              without the auditor asking; Reopen is how that is done deliberately. */}
          <p className="text-[0.6875rem] text-ink-400 mt-1">
            Nothing on this paper has been undone — the conclusions still say what they said. This is the note that they
            are about an earlier version of the control.
          </p>
        </div>
        {role === 'auditor' && !isEngagementLocked(eng) && !asking && (
          <button onClick={() => setAsking(true)}
            className="shrink-0 h-8 px-3 rounded-lg bg-mitigated-700 text-white text-[0.75rem] font-semibold hover:bg-mitigated-800 transition-colors cursor-pointer">
            Settle the retest
          </button>
        )}
      </div>
      {asking && (
        <div className="mt-3 space-y-2">
          <textarea autoFocus rows={2} value={reason} onChange={e => setReason(e.target.value)}
            placeholder="What you did — e.g. re-read the failed design checks against the new wording on 12 Oct, all three hold; or why no retest is needed"
            className="w-full px-2.5 py-2 rounded-md border border-canvas-border bg-canvas-elevated text-[0.8125rem] text-ink-800 placeholder:text-ink-400 resize-none focus:outline-none focus:border-brand-300" />
          <div className="flex items-center gap-2 flex-wrap">
            <button disabled={!reason.trim()}
              onClick={() => { clearRetestDue(control.id, reason.trim()); setAsking(false); setReason(''); }}
              className="h-8 px-3 rounded-lg bg-mitigated-700 text-white text-[0.75rem] font-semibold enabled:hover:bg-mitigated-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">Record it</button>
            <button onClick={() => { setAsking(false); setReason(''); }}
              className="h-8 px-2.5 rounded-lg border border-canvas-border text-[0.75rem] font-semibold text-ink-600 cursor-pointer">Cancel</button>
            {!reason.trim() && (
              <span className="text-[0.6875rem] text-ink-500">A retest and a decision not to retest are both judgements — either way, say which and why.</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function UnableToTestBanner({ control }: { control: Control }) {
  const { eng, role, markUnableToTest, resolveUnableToTest, escalateUnableToTest } = useIcfr();
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  const [needed, setNeeded] = useState('');
  const block = control.unableToTest;
  const isAuditor = role === 'auditor';

  if (!block) {
    if (!isAuditor || isControlLockedIn(eng, control)) return null;
    return asking ? (
      <div className="rounded-xl border border-mitigated-200 bg-mitigated-50/40 p-4 space-y-2">
        <h3 className="text-[0.8125rem] font-bold text-mitigated-800 inline-flex items-center gap-1.5"><FileWarning size={15} /> Record that you can't test this</h3>
        <p className="text-[0.75rem] text-ink-600">This is not a finding — nothing has been shown to have failed. It goes to {ownersOf(control).processOwner} as a request, and testing picks up where it left off once they produce it.</p>
        <input value={reason} onChange={e => setReason(e.target.value)} placeholder="What is blocking the test — e.g. the approval log isn't retained by the system"
          className="w-full h-8 px-2.5 rounded-md border border-canvas-border bg-canvas-elevated text-[0.8125rem] focus:outline-none focus:border-brand-300" />
        <input value={needed} onChange={e => setNeeded(e.target.value)} placeholder="What the owner has to produce for testing to resume"
          className="w-full h-8 px-2.5 rounded-md border border-canvas-border bg-canvas-elevated text-[0.8125rem] focus:outline-none focus:border-brand-300" />
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
        {isAuditor && !block.convertedTo && !isControlLockedIn(eng, control) && (
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => resolveUnableToTest(control.id)} className="h-8 px-3 rounded-lg bg-brand-600 text-white text-[0.75rem] font-semibold hover:bg-brand-700 cursor-pointer">Received — resume testing</button>
            <button onClick={() => escalateUnableToTest(control.id)} title="The period is closing and it never arrived — the control could not be evidenced, so it becomes an ordinary deficiency"
              className="h-8 px-3 rounded-lg border border-risk-300 text-risk-700 text-[0.75rem] font-semibold hover:bg-risk-50 cursor-pointer">Never arrived — raise it</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── the dossier ──────────────────────────────────────────────────────────────────
/** A yes/no that outlives the visit. Storage throws in a private window and
 *  comes back empty when site data is cleared, so every touch is guarded and
 *  the default simply stands — the worst case is a preference that lasts the
 *  session instead of the week. */
const RAIL_OPEN_KEY = 'sox-control-rail-open';
function useRemembered(key: string, fallback: boolean) {
  const [on, setOn] = useState(() => {
    try { const v = window.localStorage.getItem(key); return v === null ? fallback : v === '1'; }
    catch { return fallback; }
  });
  // Stable across renders so an effect can depend on it without re-firing.
  const set = useCallback((next: boolean) => {
    setOn(next);
    try { window.localStorage.setItem(key, next ? '1' : '0'); } catch { /* storage blocked */ }
  }, [key]);
  return [on, set] as const;
}

export default function ControlDossier() {
  const { eng, role, selectedControlId, back, setView, reopenControl, focusStep, clearFocusStep, openAuditId } = useIcfr();
  const logEvent = useAuditLog();
  // preview-before-download for this control's working paper
  const [wpPreview, setWpPreview] = useState(false);
  // The owner's own document — see RemediationBriefModal.
  const [briefOpen, setBriefOpen] = useState(false);
  /** The leadsheet header's detail half — activity, risk and fields. Folded by
   *  default (design review, 5 Oct: the page was too long before step ①);
   *  "more" opens it, and folded it still leaves the risk line and status bar. */
  const [headDetailOpen, setHeadDetailOpen] = useState(false);
  // the way back into a concluded control — reason required, trail recorded
  const [reopening, setReopening] = useState(false);
  const [reopenWhy, setReopenWhy] = useState('');
  // The deficiency this paper raised, graded here rather than somewhere else.
  const [defOpen, setDefOpen] = useState(false);
  // Whether the rail is out. It outlives the visit the way the tab order does
  // — an auditor who folds it away to read a wide sample table has said
  // something about how they work, not about this one control, and being made
  // to say it again on the next control would be the tool forgetting.
  const [railOpen, setRailOpen] = useRemembered(RAIL_OPEN_KEY, true);
  // Which pane is showing, held here rather than inside the rail: the folded
  // spine picks one too, and unfolding on the chat when the reader pressed
  // History would be the tool overruling them.
  // Opens on Ira, the first tab (user ask, 1 Oct) — Needs you is one click away.
  const [railPane, setRailPane] = useState<RailPane>('ask');
  const [activityView, setActivityView] = useState<ActivityView>('changes');
  // Layer 3 and file-at-passage views sit over the rail's tabs (review #3, #4).
  const [railDetail, setRailDetail] = useState<RailDetail | null>(null);
  const openRailDetail = useCallback((d: RailDetail) => { setRailDetail(d); setRailOpen(true); }, [setRailOpen]);
  useEffect(() => { setRailDetail(null); }, [selectedControlId]);
  const control = eng.controls.find(c => c.id === selectedControlId);
  // This client's own columns, for the head block. Read above the early return
  // with the rest of the hooks, so it keys off the control when there is one and
  // the engagement's own company when there isn't.
  const clientColumns = useRacmConfig(racmSetupKeyFor(control?.entity ?? eng.entity).key).extras;
  // ── landing where the click was about ──────────────────────────────────────
  // Above the early return on purpose: hooks have to run on every render, and
  // a render that bails before them crashes the page the moment the counts
  // differ. (That is not hypothetical — it did.)
  // A row that says "upload the source data" should land on the Population step,
  // not at the top of a five-step page the reader then has to search. Same
  // one-shot channel the deficiency focus uses: set on the way in, consumed once
  // on arrival, and coming back later lands nowhere in particular.
  //
  // The scroll waits a beat because the step it is aiming at has not mounted
  // when this first runs, and a scroll to nothing is a scroll that silently did
  // nothing.
  const [arrivedAt, setArrivedAt] = useState<string | null>(null);
  useEffect(() => {
    if (!focusStep) return;
    const step = focusStep;
    const t = window.setTimeout(() => {
      document.getElementById(`vstep-${step}`)?.scrollIntoView({ behavior: 'smooth', block: step === 'design' ? 'start' : 'center' });
      setArrivedAt(step);
      clearFocusStep();
    }, 160);
    return () => window.clearTimeout(t);
  }, [focusStep, clearFocusStep]);
  // The ring is a cue, not a state — it says "here" and then gets out of the way.
  useEffect(() => {
    if (!arrivedAt) return;
    const t = window.setTimeout(() => setArrivedAt(null), 2600);
    return () => window.clearTimeout(t);
  }, [arrivedAt]);

  // A run started from the page narrates in the chat, so the rail comes forward
  // to be read — including UNFOLDING it, which the earlier version did not do:
  // pressing "Run AI validation" with the rail folded sent the narration to a
  // pane that was not on the screen, and the reader watched nothing happen.
  // It asks once. `railShown` lowers the flag so a reader who then chooses
  // History, or folds the rail back up, is not dragged around by the next
  // render.
  const run = useControlRun(selectedControlId ?? '');
  useEffect(() => {
    if (!run?.wantsRail || !selectedControlId) return;
    setRailPane('ask');
    setRailDetail(null);
    setRailOpen(true);
    railShown(selectedControlId);
  }, [run?.wantsRail, selectedControlId, setRailOpen]);

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
  // Automated + ITGCs holding = the design test IS the test. Everything on this
  // page that asked "have both tracks concluded?" now asks the narrower question.
  const opApplies = operatingApplies(eng, control);
  const concl = controlConclusion(control, opApplies);
  const controlLocked = isControlLocked(control, opApplies);
  // The evidence lane stays theirs — attaching documents, answering a request,
  // self-attesting. That is the whole reason they are on this page.
  //
  // …until the control concludes. A concluded paper is frozen for everyone, and
  // the store has always refused to write to one; the design and TOE sections
  // used not to carry the lock term, so they went on rendering pens that landed
  // nowhere. Reopening is the way back in, and it says so on the header.
  const canEdit = (isAuditor || isOwner) && !controlLocked;
  // The testing pen does not. Conclusions, overrides, the draw, attribute
  // results and the sign-off are the auditor's alone.
  const canTest = isAuditor && !controlLocked;
  const headOwners = ownersOf(control);
  const designResult = trackResult(control.design);
  const opResult = trackResult(control.operating);
  // ── locked until approved (S6, A36) ─────────────────────────────────────────
  // TOD comes first and the reviewer approves it before anything else opens:
  // Population, Sample and TOE all wait on that approval, because data pulled
  // against a design nobody has checked is work done on spec. It used to be that
  // the population stood on its own and design could be worked in parallel —
  // not any more. Clearing the TOD conclusion (a reopen, a return) clears the
  // approval too, so the steps lock again until TOD is concluded and approved.
  // Also what locks step ① itself: it was the ONLY step that never took a
  // `locked`, so an approved design still offered live Design effective /
  // ineffective buttons — and re-concluding silently OVERWRITES the approval
  // (store.tsx, concludeDesign). Locked, it stands until the reviewer sends it back.
  const todApproved = designApproved(control);
  // ── pending until year end (A29) ────────────────────────────────────────────
  // An Annual control has not run yet in an interim or roll-forward audit, so
  // Population, Sample and TOE wait for the year-end audit (yearEndPending). TOD
  // is untouched. Where the approval gate also applies, this is the reason that
  // decides the audit — approving TOD would not open anything — so it takes the
  // note on its own rather than stacking a second lock message beside it.
  const yePending = yearEndPending(control, eng.audits.find(a => a.id === openAuditId));
  // What a locked step is waiting for, said on the step: TOD not concluded yet,
  // concluded and with the reviewer, or approved but ineffective — which still
  // keeps Sample and TOE shut, because a failed design is not tested for operation.
  const gateNote = yePending ? `Pending until ${yePending.until}`
    : designResult === 'Not tested' ? 'Unlocks after TOD is approved'
    : !todApproved ? `Waiting for ${eng.reviewer || 'the reviewer'} to approve the design.`
    : 'Unlocks once TOD is effective';
  // Step ② is the one that says where the work went.
  const popNote = yePending ? `${gateNote} — tested in the year-end audit` : gateNote;
  // The reviewer's approval gates the population again (product owner, 1 Oct —
  // reverses the "runs alongside" call made earlier that day).
  const toeLocked = designResult !== 'Effective' || !todApproved || !!yePending;
  // Step ② waits on the approval, and on the year end for an Annual control.
  const popGated = !todApproved || !!yePending;
  const popLocked = populationLocked(control);
  // The draw sits behind both of those: an approved, effective design, and a
  // population that has cleared its own gate. Past the approval, an already-drawn
  // sample is never re-locked by the population — that work is done, and its own
  // gate is on the paper.
  const sampleLocked = toeLocked || (!control.operating.sampling && !popLocked);
  // ── finished steps start folded (design review, 5 Oct) ─────────────────────
  // A step whose work is done and whose result is on its header line opens
  // folded, so the page leads with the step still being worked. A click opens
  // it. Only an EFFECTIVE finish folds — an ineffective one carries the next
  // move (a rebuild, a further round) inside it — and a part last round carried
  // over that still waits on a confirm keeps its step open.
  const rollHeld = (...parts: RollPart[]) => parts.some(p => control.rollForward?.parts[p]?.state === 'pending');
  const drawFiles = sampledSources(populationSources(control));
  const foldDesign = !isOwner && todApproved && designResult === 'Effective' && !rollHeld('design', 'checks');
  const foldPop = !isOwner && popLocked && !popGated && !rollHeld('population');
  const foldSample = !sampleLocked && !!control.operating.sampling && drawFiles.length > 0 && drawFiles.every(s => s.approvedSample) && !rollHeld('attributes');
  const foldToe = !toeLocked && opResult === 'Effective';
  const foldFinal = !!control.wpSignoff?.reviewer;
  const def = eng.deficiencies.find(d => d.controlId === control.id);
  const country = countryFor(eng.id, control);

  return (
    <RailDetailContext.Provider value={openRailDetail}>
    <motion.div className="h-full min-h-0 flex flex-col" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.03 } } }}>
      {/* no local Back button — the breadcrumb above (always rendered by
          SoxIcfrApp for the dossier view) already carries ← and the trail */}

      {/* ── Two panes, the way the workflow executor does it ─────────────────
          The page used to be one long scroll with the rail marked `sticky`,
          which never worked: the rail's parent was a grid item exactly as tall
          as the rail, so it had nowhere to travel and simply left with the
          page. Rather than repair the stick, the page stops scrolling. This
          row owns the height it was given, the left column is the only
          scroller, and the rail is a sibling that cannot move because nothing
          around it does. `min-h-0` is what lets the column scroll instead of
          growing; `min-w-0` is what stops a wide table pushing the rail off
          the screen. */}
      <div className="flex-1 min-h-0 grid gap-5 transition-[grid-template-columns] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ gridTemplateColumns: railOpen ? 'minmax(0,1fr) 400px' : 'minmax(0,1fr) 5rem' }}>
        {/* The header travels with the work rather than being frozen above it:
            it is a third of the screen, and the steps are what the auditor
            came for. The white band inside it now ends at this column, which
            is what it should have said all along — the rail beside it is not
            part of the leadsheet. */}
        {/* `clip`, not `hidden`: hidden still lets the browser scroll the box
            sideways to reveal something it has just focused — a modal closing,
            a form opening — and with no sideways scrollbar to put it back, the
            column stays shunted with its left edge cut off. `clip` refuses the
            scroll as well as the scrollbar. */}
        <div className="min-w-0 overflow-y-auto overflow-x-clip pb-6">

      {/* Leadsheet header — the same shape the library's control page carries
          (ControlLibraryDetail): a white band running to both screen edges, the
          objective as the headline, one line of identity, and the detail behind
          a disclosure. What it keeps on top of that is the audit's own: whose
          court the control is in, the overall status with both track verdicts,
          and the working paper. */}
      <motion.div className="rounded-xl border border-canvas-border bg-canvas-elevated px-5 pt-4 pb-0 mb-5" variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } } }}>
        <div className="relative">
          {/* ── the facts, above the name (22 Sep) ─────────────────────────────
              What kind of control this is reads before what it says it does,
              because a reader scanning a register full of these recognises the
              shape before they read the sentence. The schema words are back as
              chips rather than named fields: in a row of six they read as a
              classification, which is what they are, and the ones that need a
              label keep it in the detail below. */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              {/* Key/non-key is agreed with management — it can never be read off
                  an SOP — so the auditor sets it here rather than reading it. */}
              {/* Five facts up front, and only five (agentic UI review, 29 Sep):
                  key, nature, frequency, owner, assertions. Category, type and
                  rating moved behind "More" — each fact is said once, and the
                  chips no longer repeat what the detail below lists. */}
              <KeyControlChip control={control} canEdit={canEdit} />
              {control.nature && <HeadChip icon={control.nature === 'Automated' ? <WorkflowIcon size={11} /> : <Hand size={11} />}>{control.nature}</HeadChip>}
              {control.frequency && <HeadChip>{control.frequency}</HeadChip>}
              {headOwners.controlOwner && <HeadChip icon={<UserCheck size={11} />}><span className="text-ink-400">Owner</span> {headOwners.controlOwner}</HeadChip>}
              {control.assertions.length > 0 && (
                <span className="max-w-72 truncate" title={control.assertions.join(', ')}>
                  <HeadChip><span className="truncate">{control.assertions.join(', ')}</span></HeadChip>
                </span>
              )}
              {/* The control's own number, plain — it is a reference, not a
                  judgement, so it does not wear a chip like one. */}
              <span className="font-mono text-[0.75rem] text-ink-400 ml-1">{control.wpRef ?? control.id}</span>
              {/* Only on a control that has actually been rebuilt — a lone "v1" on
                  every other control would be noise claiming to be information. */}
              {hasVersions(control) && <HeadChip>v{versionNo(control)}</HeadChip>}
            </div>
            {/* whose court it is, right-aligned. The W/P stamp that used to sit
                beside it is gone: a working-paper reference is an audit output,
                and the control page is where the work happens, not where the
                paper is cited. It survives in the exported paper and report. */}
            <div className="shrink-0 flex items-center justify-end gap-2">
              <CourtBadge court={courtFor(control, eng.tasks)} fromRole={role} />
            </div>
          </div>

          {/* Heading = the CONTROL TITLE (17 Sep). The objective held this spot
              while the one-line statement had no name of its own; now that the
              RACM splits title from description, the title is what belongs at
              the top of the control's own page, and the objective reads as one
              more fact about it below. */}
          <h1 className="leadsheet-title text-[1.625rem] leading-[1.25] text-ink-900 mt-2.5">{control.description}</h1>

          {/* The detail half, read in the order the work happens: the risk the
              control answers, then how it is performed. Closed it is one line
              that stops where the row does; open it runs on and the rest
              follows. Either way the toggle sits at the end of that first line,
              in the one place — a chevron in front of the label asked the reader
              to find the control before they knew there was more to read. */}
          <div className="mt-4 text-[0.8125rem] leading-[1.7] text-ink-600">
            <p className={cn('min-w-0', !headDetailOpen && 'flex items-baseline')}>
              <span className="font-semibold text-ink-900 shrink-0 whitespace-nowrap">Risk {control.riskId}</span>
              <span className="text-ink-300 mx-1.5 shrink-0">·</span>
              {/* The short name on one line, the sentence behind the disclosure:
                  a header that opened with the full risk statement pushed every
                  other fact about the control below the fold. */}
              <span className={cn('min-w-0', !headDetailOpen && 'truncate')}>{control.riskTitle ?? control.riskDescription}</span>
              <span className="shrink-0 ml-1.5"><MoreLink open={headDetailOpen} onClick={() => setHeadDetailOpen(o => !o)} /></span>
            </p>
            <AnimatePresence initial={false}>
              {headDetailOpen && (
                <motion.div
                  key="head-detail"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  {control.riskTitle && (
                    <p className="mt-2">
                      <span className="font-semibold text-ink-900">Risk description</span>
                      <span className="text-ink-300 mx-1.5">·</span>
                      {control.riskDescription}
                    </p>
                  )}
                  {/* The RACM's Control Activity narrative. A row that never
                      carried one (O-04, several imports) used to print the label
                      over nothing; the one-line statement is already the
                      heading above, so the line goes rather than repeat it. */}
                  {control.controlActivity?.trim() && (
                    <p className="mt-2">
                      <span className="font-semibold text-ink-900">Control description</span>
                      <span className="text-ink-300 mx-1.5">·</span>
                      {control.controlActivity}
                    </p>
                  )}
                  <div className="mt-3.5 flex flex-wrap items-baseline gap-x-6 gap-y-2">
                    {/* Who and where, moved off the header line (22 Sep): the
                        chips above say what kind of control this is, and six
                        named facts beside them made a strip nobody read. They
                        are still one click away, which is where the reader who
                        wants to know who to ask will look. */}
                    <HeadField label="RACM" value={control.process} />
                    {isShared(control) ? (
                      <>
                        <HeadField label="Performed at" value={control.entity} />
                        <HeadField label="Covers" value={control.entities!.join(', ')} />
                      </>
                    ) : <HeadField label="Entity" value={control.entity} />}
                    {/* Owner, nature, frequency and assertions are on the chip
                        row above — they are not repeated here. */}
                    {!headOwners.single && <HeadField label="Process owner" value={headOwners.processOwner} />}
                    <HeadField label="Sub-process" value={control.subProcess} />
                    <HeadField label="Risk category" value={control.clazz} />
                    <HeadField label="Risk rating" value={control.riskRating} />
                    <HeadField label="Type" value={control.type} />
                    {/* why the risk exists at all — a control aimed at the symptom
                        rather than the cause is the commonest design gap there is */}
                    <HeadField label="Root cause" value={control.rootCause} />
                    <HeadField label="Objective" value={control.objective} />
                    <HeadField label="Effective date" value={control.effectiveDate} />
                    {/* Where the file named no country the row takes its entity's,
                        and the label says which — a country that disagrees with
                        its entity is either a real cross-border arrangement or a
                        bad column mapping, and only the source tells you which. */}
                    <HeadField label={country.source === 'file' ? 'Country (from the file)' : 'Country'} value={country.source === 'none' ? undefined : country.value} />
                    <HeadField label="Testing strategy" value={control.testingStrategy} />
                    {/* This client's own columns, last and under their set-up's
                        names. Nothing here is tested against — it is the client's
                        record, carried so the row reads the same here as on their
                        own matrix. A value whose column has since been dropped
                        from the set-up still shows: the data is real either way. */}
                    {clientColumns.map(col => (
                      <HeadField key={col.header} label={extraLabel(col)} value={control.extras?.[col.header]} />
                    ))}
                    {/* Raw file columns that only repeat a field this header
                        already shows ("Sub-Process", "Control ID") are dropped
                        — the same fact twice under two spellings. */}
                    {Object.entries(control.extras ?? {})
                      .filter(([header]) => !clientColumns.some(col => col.header === header))
                      .filter(([header]) => !HEAD_SHOWN_KEYS.has(headKey(header)))
                      .map(([header, value]) => <HeadField key={header} label={header} value={value} />)}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── the status bar ─────────────────────────────────────────────────
              Full-bleed inside the card, so it reads as the card's own footer
              rather than one more paragraph in it. The verdict is named here
              rather than sitting anonymously in the row of chips above: this is
              the line a reader arrives for, and "Not tested" needs to say what
              it is not tested ABOUT. */}
          <div className="flex items-center gap-3 mt-4 -mx-5 px-5 py-3 border-t border-canvas-border flex-wrap">
            {/* The conclusion and the two track verdicts are the auditor's read,
                and an owner watching it move learns what is being tested and how
                it is going. They see what is asked of them instead. */}
            {isOwner ? (
              <span className="text-[0.6875rem] font-semibold text-ink-400 uppercase tracking-wide">Your control</span>
            ) : (
              <>
                <ConclusionPill c={concl} />
                <span aria-hidden className="w-px h-4 bg-canvas-border" />
                <span className="text-[0.75rem] text-ink-400 inline-flex items-center gap-1.5"><Tickmark result={designResult === 'Effective' ? 'Pass' : designResult === 'Ineffective' ? 'Fail' : 'Not tested'} size={14} /> TOD {designResult.toLowerCase()}</span>
                <ChevronRight size={13} className="text-ink-300" />
                <span className="text-[0.75rem] text-ink-400 inline-flex items-center gap-1.5"><Tickmark result={opResult === 'Effective' ? 'Pass' : opResult === 'Ineffective' ? 'Fail' : 'Not tested'} size={14} /> TOE {toeLocked ? 'locked' : opResult.toLowerCase()}</span>
              </>
            )}
            {/* The three readings, in the gap this row already had between the
                verdict and the paper (user ask, 23 Sep). They were a band of
                their own under this line, which made two rows out of one
                statement: the verdict, and how far the work behind it has got.

                The owner does not get them: they are the auditor's read on how
                the testing is going, and the owner's line above is deliberately
                "Your control" and nothing else.

                With the rail open this row loses 400px, so each number takes a
                ring (user ask, 23 Sep): it is the narrower shape — the number
                moves inside the arc — and the one that survives being skimmed,
                which is all the room there is for it here. Rail shut, the plain
                numbers have the width they want. */}
            {!isOwner && <RagKpiRow meters={designRagMeters(control)} inline dial={railOpen} />}
            {/* Secondary, per DESIGN.md: a tinted purple chip rather than the
                outline every other control on the page already wears. These two
                are the actions of this header, and an outline button beside an
                outline dropdown beside an outline chip says nothing about which
                is which. */}
            <div className="ml-auto flex items-center gap-2">
              {/* The register already hides this from the owner. The same document
                  reachable from a different screen is not a restriction. */}
              {isOwner ? (
                /* What they get instead — built from owner-safe fields upwards,
                   never by filtering the paper down. */
                <button onClick={() => setBriefOpen(true)}
                  className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-50 text-[0.75rem] font-semibold text-brand-700 hover:bg-brand-100 transition-colors cursor-pointer"><FileText size={13} /> Remediation brief</button>
              ) : (
                <button onClick={() => { setWpPreview(true); logEvent({ action: 'Export', description: `Opened the working paper for ${control.id} — ${ROLE_LABEL[role]}`, module: 'SOX ICFR', entity: 'Evidence' }); }}
                  className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-50 text-[0.75rem] font-semibold text-brand-700 hover:bg-brand-100 transition-colors cursor-pointer"><FileSpreadsheet size={13} /> Working paper</button>
              )}
              {isAuditor && controlLocked && (
                <button onClick={() => setReopening(true)} className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-50 text-[0.75rem] font-semibold text-brand-700 hover:bg-brand-100 transition-colors cursor-pointer"><RotateCcw size={13} /> Reopen</button>
              )}
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
                <span className="w-4.5 h-4.5 rounded-md bg-brand-50 text-brand-700 text-[0.625rem] font-bold inline-flex items-center justify-center shrink-0 mt-0.5 tabular-nums">{i + 1}</span>
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

      {/* ── sent back ───────────────────────────────────────────────────────────
          Above the steps, because it is the reason they are open again. A return
          clears both conclusions and the signature; without this the auditor
          finds their work undone with nothing saying who did it or why, which is
          the one thing guaranteed to get the same paper sent back twice. Hidden
          from the owner — reviewer correspondence is not theirs. */}
      {control.reviewReturn && !isOwner && !controlLocked && (
        <div className="rounded-xl border border-mitigated-200 bg-mitigated-50/40 p-4 mb-4 flex items-start gap-3">
          <CornerDownRight size={16} className="text-mitigated-700 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <h3 className="text-[0.8125rem] font-bold text-mitigated-800">Returned by the reviewer</h3>
            <p className="text-[0.75rem] text-ink-700 leading-relaxed mt-1">{control.reviewReturn.reason}</p>
            <p className="text-[0.6875rem] text-ink-400 mt-1.5">
              {control.reviewReturn.by} · {control.reviewReturn.at} — both conclusions were cleared, and the paper is open for testing again.
            </p>
          </div>
        </div>
      )}

      {/* Same reasoning, the auditor's own way back in: a reopened control is
          open because somebody said why, and that sentence belongs where the
          work restarts rather than only in the history rail. */}
      <VersionHistory control={control} />

      {control.reopened && !isOwner && !controlLocked && (
        <div className="rounded-xl border border-canvas-border bg-paper-50/60 p-4 mb-4 flex items-start gap-3">
          <RotateCcw size={16} className="text-ink-500 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <h3 className="text-[0.8125rem] font-bold text-ink-800">Reopened by the auditor</h3>
            {control.reopened.reason && <p className="text-[0.75rem] text-ink-700 leading-relaxed mt-1">{control.reopened.reason}</p>}
            <p className="text-[0.6875rem] text-ink-400 mt-1.5">
              {control.reopened.by} · {control.reopened.at} — both conclusions were cleared, and any signature on the paper went with them.
            </p>
          </div>
        </div>
      )}

      {/* ── the control changed under a closed remediation ───────────────────────
          Alongside the two notices above, and for the same reason: it is why this
          control wants looking at again. Unlike them it survives the lock — a
          signed paper about a control that has since been rebuilt is precisely
          the case it exists to catch. Audit-side: the owner's view of their own
          fix is the exception, not the audit's testing plan. */}
      {!isOwner && <RetestDueBanner control={control} />}

      {/* ── the ITGC cascade, named ──────────────────────────────────────────────
          Same reasoning as the return above: these steps are open because
          something happened elsewhere, and a control page that quietly grows
          three steps reads as a bug. It names the ITGC that did it, because "an
          ITGC failed" is not a fact anyone can act on — "ITGC-04 failed" is. */}
      {!isOwner && <ItgcCascadeNotice control={control} />}

      {/* Blocked testing sits above the steps, because it is the reason none of
          them can run — not a finding underneath them. */}
      <ParkOperatingBanner control={control} />
      <UnableToTestBanner control={control} />

      {/* the stepper — the whole of the left column below the header */}
      <motion.div key={control.id} className="vstepper" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1, delayChildren: 0.08 } } }}>
          {/* Design leads (user ask). It is also the order the work happens in:
              design gates operating, so a control whose design fails never needs
              a population at all — building one first was work done on spec. */}
          {/* The steps are named in full (user ask, 21 Sep): a reader who has
              to expand "TOD" before they know what it is has been made to work
              for nothing. The owner keeps "Documents" — they supply evidence
              rather than test design, and naming the step after a test they
              cannot run would describe somebody else's job. */}
          <VStep n={1} id="vstep-design" arrived={arrivedAt === 'design'} locked={!isOwner && todApproved} sealed defaultOpen={!foldDesign} title={isOwner ? 'Documents' : 'Test of design'}
            subtitle={isOwner
              ? 'The documents this control needs on file. Attach what you hold — the auditor tests them.'
              : 'The documents on file, one transaction traced end-to-end, and a design check for each thing that has to be true. Ends with the design marked effective or ineffective.'}
            status={designResult} hideStatus={isOwner}
            right={!isOwner && todApproved
              ? <span className="text-[0.6875rem] font-semibold text-ink-400 inline-flex items-center gap-1"><BadgeCheck size={11} /> Approved by {control.design.approval?.approvedBy?.by}</span>
              : !isOwner && control.design.carriedFrom
              // A roll-forward carried this conclusion from its parent interim —
              // TOD is retested only where TOD failed (user ask), so the step
              // says where the verdict came from instead of asking for it again.
              ? <span className="text-[0.6875rem] font-semibold text-compliant-700 inline-flex items-center gap-1"><CheckCircle2 size={12} /> Carried from the {control.design.carriedFrom} — retest only if the control changed</span>
              : undefined}>
            {/* Sent back by the reviewer (S6, A36) — first thing in the step,
                because it is the reason TOD is open again. Goes the moment TOD is
                concluded again. Reviewer correspondence is not the owner's. */}
            {!isOwner && control.design.designReturn && (
              <div className="px-5 pt-5">
                <div className="rounded-xl border border-mitigated-200 bg-mitigated-50/40 px-3.5 py-3 flex items-start gap-2.5">
                  <CornerDownRight size={15} className="text-mitigated-700 mt-0.5 shrink-0" />
                  <p className="text-[0.75rem] text-ink-700 leading-relaxed min-w-0">
                    <b className="font-semibold text-mitigated-800">Returned by {control.design.designReturn.by} · {control.design.designReturn.at}</b> — {control.design.designReturn.note}
                  </p>
                </div>
              </div>
            )}
            {!isOwner && <RollForwardBar control={control} parts={['design', 'checks']} />}
            <DesignSection control={control} canEdit={canEdit} locked={todApproved} />
            <DesignApprovalBlock control={control} />
            <RebuildBlock control={control} />
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
          {/* ── the owner's half of step ② ────────────────────────────────────
              Deriving the population is the FIRST LINE's job — "पापुलेशन को
              डिराइव करने का काम ओनर करेगा" — and the data is theirs: they hold
              it, they upload it, they say what to take out of it. Testing it is
              the auditor's, and everything after the extract stays with them.
              So the owner gets the files and the extract, and the report's
              proof, the lock, the sample and the results are absent, not
              greyed: the whole reason the lines are separate is that the first
              line must not learn what will be tested or at what threshold. */}
          {isOwner ? (opApplies && (
            <VStep n={2} id="vstep-population" arrived={arrivedAt === 'population'} title="Population" subtitle="The data this control ran on. Upload the source files and filter them down to this control's instances — the auditor tests what you produce here." hideStatus
              status={control.operating.population && !popGated ? 'Effective' : 'Not tested'} locked={popGated}
              right={popGated
                ? <span className="text-[0.6875rem] font-semibold text-ink-400 inline-flex items-center gap-1"><Lock size={11} /> {popNote}</span>
                : control.operating.population
                ? <span className="text-[0.6875rem] font-bold text-compliant-700 inline-flex items-center gap-1"><CheckCircle2 size={12} /> {control.operating.population.count.toLocaleString()} instances</span>
                : <span className="text-[0.6875rem] font-semibold text-ink-400">Nothing extracted yet</span>}>
              <PopulationSection control={control} canEdit={canEdit} locked={popGated} />
            </VStep>
          )) : !opApplies ? (
            <ShortFormNote control={control} />
          ) : (
          <>
          {/* The count / period / source trio this line used to name was parked on
              2 Aug — three rows that worked out their own answer and then asked a
              person to tick that they agreed. What gates the lock now is the IPE
              conclusion: four checks somebody actually performs on the report the
              population came out of. */}
          <VStep n={2} id="vstep-population" arrived={arrivedAt === 'population'} defaultOpen={!foldPop} title="Population" subtitle="Pick the source file and filter it down to this control's instances, then test the report it came from before locking it. Nothing downstream runs until it is locked." hideStatus
            status={popLocked && !popGated ? 'Effective' : 'Not tested'} locked={popGated}
            right={popGated
              ? <span className="text-[0.6875rem] font-semibold text-ink-400 inline-flex items-center gap-1"><Lock size={11} /> {popNote}</span>
              : popLocked
              ? <span className="text-[0.6875rem] font-bold text-compliant-700 inline-flex items-center gap-1"><Database size={12} /> Locked · {control.operating.population?.count.toLocaleString()} instances</span>
              : control.operating.population
                ? <span className="text-[0.6875rem] font-semibold text-mitigated-800 inline-flex items-center gap-1"><AlertTriangle size={11} /> Extracted, not yet locked</span>
                : <span className="text-[0.6875rem] font-semibold text-ink-400">Nothing extracted yet</span>}>
            <RollForwardBar control={control} parts={['population']} />
            <PopulationSection control={control} canEdit={canEdit} locked={popGated} />
          </VStep>
          <VStep n={3} id="vstep-sample" defaultOpen={!foldSample} title="Sample drawing" subtitle="Drawn off the locked population, sized by how often the control runs, with the selection method and its seed stored so anyone can reproduce the same items." hideStatus
            status={sampleLocked ? 'Not tested' : control.operating.sampling ? 'Effective' : 'Not tested'} locked={sampleLocked}
            right={toeLocked
              ? <span className="text-[0.6875rem] font-semibold text-ink-400 inline-flex items-center gap-1"><Lock size={11} /> {gateNote}</span>
              : control.operating.sampling
                ? <span className="text-[0.6875rem] font-bold text-compliant-700 inline-flex items-center gap-1"><CheckCircle2 size={12} /> {control.operating.sampling.size} items</span>
                : !popLocked
                  ? <span className="text-[0.6875rem] font-semibold text-ink-400 inline-flex items-center gap-1"><Lock size={11} /> Unlocks once the population locks</span>
                  : <span className="text-[0.6875rem] font-semibold text-ink-400">Awaiting the draw</span>}>
            <RollForwardBar control={control} parts={['attributes']} />
            <SampleExtractSection control={control} canEdit={canEdit} locked={sampleLocked} />
          </VStep>
          <VStep n={4} id="vstep-toe" arrived={arrivedAt === 'toe'} defaultOpen={!foldToe} title="Test of effectiveness" subtitle="Each sampled item against each attribute, pass or fail, with the evidence attached. Concludes effective or ineffective." status={toeLocked ? 'Not tested' : opResult} locked={toeLocked}
            right={toeLocked ? <span className="text-[0.6875rem] font-semibold text-ink-400 inline-flex items-center gap-1"><Lock size={11} /> {gateNote}</span> : undefined}>
            <OperatingSection control={control} canEdit={canEdit} locked={toeLocked} />
          </VStep>
          </>
          )}
          {!isOwner && <VStep n={5} id="vstep-signoff" defaultOpen={!foldFinal} title="Final" subtitle="The auditor signs the paper, the reviewer countersigns it, and the control is done. Nobody countersigns work they prepared." hideStatus
            status={control.wpSignoff?.reviewer ? 'Effective' : 'Not tested'} locked={!controlLocked}
            right={control.wpSignoff?.reviewer
              ? <span className="text-[0.6875rem] font-bold text-compliant-700 inline-flex items-center gap-1"><BadgeCheck size={12} /> Control done</span>
              : control.wpSignoff?.preparer
                ? <span className="text-[0.6875rem] font-semibold text-ink-400">Awaiting countersign</span>
                : controlLocked
                  ? <span className="text-[0.6875rem] font-semibold text-ink-400">Ready to sign</span>
                  : <span className="text-[0.6875rem] font-semibold text-ink-400 inline-flex items-center gap-1"><Lock size={11} /> Unlocks once {opApplies ? 'both tracks conclude' : 'the design concludes'}</span>}>
            <VersionVerdict control={control} />
            <SignOffSection control={control} />
          </VStep>}
          {/* `id` on the card below so the rail can bring the reader here — the
              exception's root cause is written on this page, and Ira offers to
              do it from the chat. */}
          {concl === 'Ineffective' && (
            <motion.div id="control-exception" variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }} className="ml-13.5 rounded-xl border border-risk-200 bg-risk-50/40 p-4 mt-1">
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
                    <div className="mt-2.5 pt-2.5 border-t border-risk-200/70 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.75rem]">
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
        </div>
        {/* right rail — ONE section (user ask, 21 Sep): the three scores sit
            inside the same panel as the conversation rather than in a card of
            their own above it. They read on the work rather than being part of
            it, and two stacked boxes drew a boundary that said they were two
            different things. The stepper gets the full width of the page it
            earns.

            400px, not 360: the rail carries a conversation, and a bubble with
            a quick reply under it reads badly at 360. */}
        {/* The rail stays MOUNTED when folded away, clipped rather than
            unmounted. Pulling it out from under a running validation would
            fire the pane's goodbye — "I stopped reading when you moved away"
            — at a reader who did no such thing, and would throw away work
            they asked for. So the panel keeps its full 400px and the track
            slides over it. */}
        <motion.div className="h-full min-h-0 pb-6 relative overflow-hidden" variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}>
          {/* `inert` so a folded rail cannot be tabbed into — it is clipped
              out of sight, not merely out of the way. */}
          <div className="h-full w-100" inert={!railOpen}>
            <ActivityRail control={control} pane={railPane} onPane={setRailPane} onCollapse={() => setRailOpen(false)}
              detail={railDetail} onCloseDetail={() => setRailDetail(null)} activityView={activityView} onActivityView={setActivityView} />
          </div>
          {!railOpen && (
            <RailSpine control={control} running={!!run}
              onOpen={p => { setRailPane(p); setRailDetail(null); setRailOpen(true); }} />
          )}
        </motion.div>
      </div>

      {reopening && createPortal(
        <div className="modal-backdrop" onClick={() => setReopening(false)}>
          <motion.div role="dialog" aria-modal="true" aria-labelledby="reopen-control-title" className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()} initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}><DialogFocus onEscape={() => setReopening(false)} />
            <div className="px-5 py-4">
              <div className="flex items-start gap-3">
                <span className="w-9 h-9 rounded-lg bg-risk-50 text-risk-700 inline-flex items-center justify-center shrink-0"><RotateCcw size={17} /></span>
                <div className="min-w-0">
                  <h3 id="reopen-control-title" className="text-[0.875rem] font-bold text-ink-900">Reopen this control?</h3>
                  <p className="text-[0.75rem] text-ink-500 mt-1 leading-relaxed">
                    Both conclusions go back to <b className="font-semibold text-ink-700">not tested</b> and the sign-off clears — a reopened paper is no longer the paper anybody signed. The evidence, the sample and the results stay where they are; it is the conclusions that have to be reached again.
                  </p>
                </div>
              </div>
              <label className="block mt-3.5">
                <span className="block text-[0.6875rem] font-bold uppercase tracking-wider text-ink-400 mb-1">Why — recorded on the trail</span>
                <textarea autoFocus rows={2} value={reopenWhy} onChange={e => setReopenWhy(e.target.value)}
                  placeholder="e.g. the FX rate feed changed in November — Q3 onwards has to be retested"
                  className="w-full px-2.5 py-2 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.75rem] text-ink-800 placeholder:text-ink-400 resize-none focus:outline-none focus:ring-2 focus:ring-brand-200" />
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-canvas-border bg-paper-50/40">
              <button onClick={() => { setReopening(false); setReopenWhy(''); }} className="h-9 px-3.5 text-[0.8125rem] font-semibold text-ink-600 hover:text-ink-900 cursor-pointer">Keep it closed</button>
              <button disabled={!reopenWhy.trim()} title={reopenWhy.trim() ? undefined : 'A reopened conclusion needs a reason on the trail'}
                onClick={() => { reopenControl(control.id, reopenWhy.trim()); logEvent({ action: 'Update', description: `Reopened ${control.id} — ${reopenWhy.trim()}`, module: 'SOX ICFR', entity: 'Control' }); setReopening(false); setReopenWhy(''); }}
                className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-risk-600 text-white text-[0.8125rem] font-semibold enabled:hover:bg-risk-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"><RotateCcw size={13} /> Reopen</button>
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
    </RailDetailContext.Provider>
  );
}
