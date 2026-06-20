import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Paperclip,
  Link as LinkIcon,
  ExternalLink,
  CheckCircle2,
  XCircle,
  ChevronDown,
  Calendar,
  CalendarClock,
  ArrowRight,
  FileText,
  User,
  Plus,
  Trash2,
  Check,
  Sparkles,
  Hash,
  ShieldCheck,
  ClipboardList,
  AlertTriangle,
  Send,
} from 'lucide-react';
import { auditorReviewStage, type AuditorReviewStage } from './statusModel';
import { useWorkflow } from './workflow/WorkflowContext';
import { canAct } from './workflow/workflowEngine';
import WorkflowPipelineView from './workflow/WorkflowPipelineView';
import { CustomDatePicker } from '../shared/CustomDatePicker';
import Gated from '../shared/Gated';
import { useCan } from '../../context/CurrentUserContext';
import {
  GRC_CASE_DETAILS,
  GRC_BULK_ACTIONS,
  GRC_EXCEPTIONS,
  type GrcException,
  type GrcActivityEntry,
  type GrcActionStatus,
  type GrcExceptionClassification,
  type GrcExceptionSeverity,
} from '../../data/mockData';

const CLASSIFICATION_STYLE: Record<GrcExceptionClassification, string> = {
  Unclassified:                'bg-[#F4F2F7] text-ink-600',
  'Design Deficiency':         'bg-high-50 text-high-700',
  'System Deficiency':         'bg-risk-50 text-risk-700',
  'Procedural Non-Compliance': 'bg-brand-50 text-brand-700',
  'Business as Usual':         'bg-compliant-50 text-compliant-700',
  'False Positive':            'bg-[#EEEEF1] text-ink-600',
};

// ─── Suggested (auto-typed, editable) decision message ────────────────────
// When a decision/outcome is chosen, the comment auto-fills with a relatable
// message the user can edit before submitting. Manual edits are preserved: the
// field only re-fills while it's empty or still holds the previous suggestion.
function useSuggestedMessage(suggested: string, value: string, setValue: (v: string) => void) {
  const lastRef = useRef('');
  useEffect(() => {
    if (suggested && (value.trim() === '' || value === lastRef.current)) setValue(suggested);
    lastRef.current = suggested;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggested]);
  return () => { setValue(suggested); lastRef.current = suggested; };
}

// A clickable chip that re-applies the suggested message to the comment field.
function SuggestedChip({ message, onApply }: { message: string; onApply: () => void }) {
  if (!message) return null;
  return (
    <button
      type="button"
      onClick={onApply}
      title="Use this suggested message"
      className="group/sc w-full text-left mb-2 inline-flex items-start gap-1.5 px-2.5 py-1.5 bg-brand-50/70 border border-brand-100 rounded-[8px] text-[11.5px] text-brand-700 hover:bg-brand-50 transition-colors cursor-pointer"
    >
      <Sparkles size={12} className="mt-[1px] shrink-0 text-brand-500" />
      <span className="leading-snug">
        <span className="font-semibold">Suggested:</span> {message}
      </span>
    </button>
  );
}

// Combined Action Review status — folds the auditor decision and the
// implementation outcome into a single label.
type ActionReviewBase = 'Pending' | 'Approved' | 'Rejected';
type CombinedActionReview =
  | 'Pending'
  | 'Approved (Implemented)'
  | 'Approved (Partially Implemented)'
  | 'Rejected (Discrepancy)'
  | 'Approved'
  | 'Rejected';

const COMBINED_REVIEW_STYLE: Record<CombinedActionReview, string> = {
  'Pending':                          'bg-[#EEEEF1] text-ink-600',
  'Approved (Implemented)':           'bg-compliant-50 text-compliant-700',
  'Approved (Partially Implemented)': 'bg-mitigated-50 text-mitigated-700',
  'Rejected (Discrepancy)':           'bg-risk-50 text-risk-700',
  'Approved':                         'bg-compliant-50 text-compliant-700',
  'Rejected':                         'bg-risk-50 text-risk-700',
};
const COMBINED_REVIEW_LABEL: Record<CombinedActionReview, string> = {
  'Pending':                          'Pending Review',
  'Approved (Implemented)':           'Approved (Implemented)',
  'Approved (Partially Implemented)': 'Approved (Partially Implemented)',
  'Rejected (Discrepancy)':           'Rejected (Discrepancy)',
  'Approved':                         'Approved',
  'Rejected':                         'Rejected',
};

const NO_PLAN_CLASSIFICATIONS = new Set<string>(['Business as Usual', 'False Positive']);

// Action-plan due date (ISO YYYY-MM-DD) → "25 Jun 2026".
const fmtPlanDate = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

// Legacy mock data sometimes stores 'Implemented' in actionReview — normalise.
function normaliseActionReview(v: string): ActionReviewBase {
  if (v === 'Approved' || v === 'Rejected' || v === 'Pending') return v;
  if (v === 'Implemented') return 'Approved';
  return 'Pending';
}

function combineActionReview(
  actionReview: string,
  actionStatus: GrcActionStatus,
  classification: string,
): CombinedActionReview {
  const norm = normaliseActionReview(actionReview);
  if (NO_PLAN_CLASSIFICATIONS.has(classification)) {
    if (norm === 'Pending') return 'Pending';
    if (norm === 'Rejected') return 'Rejected';
    return 'Approved';
  }
  if (norm === 'Rejected' || actionStatus === 'Discrepancy') return 'Rejected (Discrepancy)';
  if (norm === 'Pending') return 'Pending';
  if (actionStatus === 'Partially Implemented') return 'Approved (Partially Implemented)';
  return 'Approved (Implemented)';
}

function Overlay({ onClick }: { onClick: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] z-40"
      onClick={onClick}
    />
  );
}

// ── Modal chrome: stack-safe body scroll-lock + ESC-to-close ──────────────
// Centralised here so every modal that uses ModalShell gets it for free. The
// scroll-lock is reference-counted so a nested modal closing doesn't prematurely
// restore scrolling while a base modal is still open.
let openModalCount = 0;
let savedBodyOverflow = '';
function useModalChrome(onClose: () => void) {
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (openModalCount === 0) savedBodyOverflow = document.body.style.overflow;
    openModalCount += 1;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      openModalCount = Math.max(0, openModalCount - 1);
      if (openModalCount === 0) document.body.style.overflow = savedBodyOverflow;
    };
  }, []);
}

const MODAL_WIDTH: Record<'md' | 'lg' | 'xl', string> = {
  md: 'max-w-[640px]',
  lg: 'max-w-[900px]',
  xl: 'max-w-[1060px]',
};

// A chip in a modal's context bar — keeps "what am I acting on" always visible
// at the top of every modal (ID, classification, stage, …).
export function ContextChip({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      {label && <span className="text-[10.5px] uppercase tracking-wider text-ink-400">{label}</span>}
      <span className="text-[12.5px] font-medium text-ink-800">{children}</span>
    </span>
  );
}

// Standard context bar for a single exception — keeps ID + classification (+ any
// extra chip such as stage/Actionable ID) visible at the top of every modal.
export function ExceptionContext({
  exception,
  extra,
}: {
  exception: Pick<GrcException, 'id' | 'classification' | 'actionableId'>;
  extra?: React.ReactNode;
}) {
  return (
    <>
      <ContextChip label="Exception"><span className="font-mono">{exception.id}</span></ContextChip>
      <ContextChip label="Classification">
        <Pill className={CLASSIFICATION_STYLE[exception.classification]}>{exception.classification}</Pill>
      </ContextChip>
      {exception.actionableId && (
        <ContextChip label="Actionable ID"><span className="font-mono text-brand-700">{exception.actionableId}</span></ContextChip>
      )}
      {extra}
    </>
  );
}

/** Read-only approval-route chain for an action modal — shows where the case
 *  sits in its route (who's done, who's pending) so the person taking the action
 *  has the full picture. Display only; the action itself stays in the modal. */
export function RouteChainNote({ exceptionId }: { exceptionId: string }) {
  const { assignments } = useWorkflow();
  const a = assignments.find(x => x.exceptionId === exceptionId && x.status !== 'pulled-back');
  if (!a) return null;
  return (
    <div className="mb-5 rounded-[12px] border border-canvas-border bg-[#FAFAFB] p-4">
      <div className="text-[10.5px] font-semibold uppercase tracking-wider text-ink-500 mb-3">
        Approval route · {a.persona === 'auditor' ? 'Auditor' : 'Risk Owner'} side · {a.workflowName}
      </div>
      <WorkflowPipelineView assignment={a} />
    </div>
  );
}

// ── ModalShell — the unified, centered modal frame for every Exceptions/Action
// Hub action. Replaces the former right-side slide panel. Supports a sticky
// context bar, an optional wizard stepper, three widths, tabs, and a sticky
// footer. Pair it with <Overlay onClick={onClose}/> rendered just before it.
export function ModalShell({
  title,
  subtitle,
  onClose,
  children,
  footer,
  tabs,
  activeTab,
  onTabChange,
  size = 'md',
  context,
  step,
  routeChain,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
  tabs?: string[];
  activeTab?: string;
  onTabChange?: (t: string) => void;
  /** Modal width: md (single-case forms), lg/xl (bulk, table-first). */
  size?: 'md' | 'lg' | 'xl';
  /** Sticky context bar content (ContextChips) — what the action targets. */
  context?: React.ReactNode;
  /** Wizard stepper indicator (multi-step flows). */
  step?: { current: number; total: number; label?: string };
  /** Read-only approval-route chain shown as a segregated section at the top of
   *  the body (when the case is delegated through a route). Display only. */
  routeChain?: React.ReactNode;
}) {
  useModalChrome(onClose);
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, y: 8 }}
      transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
      className={`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-32px)] ${MODAL_WIDTH[size]} max-h-[88vh] bg-canvas-elevated shadow-xl border border-canvas-border rounded-[16px] flex flex-col z-50`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <header className="shrink-0 px-6 pt-5 pb-0 border-b border-canvas-border">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-[20px] font-semibold text-ink-900 tracking-tight">{title}</h2>
              {step && step.total > 1 && (
                <span className="inline-flex items-center gap-2 text-[11.5px] font-medium text-ink-500">
                  <span className="flex items-center gap-1">
                    {Array.from({ length: step.total }).map((_, i) => (
                      <span key={i} className={`h-1.5 rounded-full transition-all ${i + 1 === step.current ? 'w-5 bg-brand-600' : i + 1 < step.current ? 'w-3 bg-brand-400' : 'w-3 bg-[#E5E1EC]'}`} />
                    ))}
                  </span>
                  Step {step.current} of {step.total}{step.label ? ` · ${step.label}` : ''}
                </span>
              )}
            </div>
            {subtitle && <p className="text-[12.5px] text-ink-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        {context && (
          <div className="flex items-center gap-x-3 gap-y-1.5 flex-wrap pb-3">
            {context}
          </div>
        )}
        {tabs && (
          <div className="flex items-center gap-5 -mb-px">
            {tabs.map(t => {
              const active = t === activeTab;
              return (
                <button
                  key={t}
                  onClick={() => onTabChange?.(t)}
                  className={`pb-3 text-[13px] font-medium transition-colors cursor-pointer border-b-2 ${
                    active ? 'border-brand-600 text-brand-700' : 'border-transparent text-ink-500 hover:text-ink-700'
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>
        )}
      </header>
      <div className="flex-1 overflow-y-auto px-6 py-5">{routeChain}{children}</div>
      <footer className="shrink-0 px-6 py-4 border-t border-canvas-border bg-canvas-elevated flex items-center gap-2">
        {footer}
      </footer>
    </motion.div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10.5px] font-semibold uppercase tracking-wider text-ink-500 mb-2">
      {children}
    </div>
  );
}

function Pill({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={`inline-flex items-center h-6 px-2.5 text-[11px] font-medium rounded-full whitespace-nowrap ${className}`}>
      {children}
    </span>
  );
}

function FooterButtons({
  onCancel,
  onReject,
  onApprove,
  disabled = false,
  disabledTitle,
}: {
  onCancel: () => void;
  onReject: () => void;
  onApprove: () => void;
  /** When set, Reject/Approve are greyed + inert (Cancel stays usable). */
  disabled?: boolean;
  disabledTitle?: string;
}) {
  const decisionCls = disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer';
  return (
    <>
      <button
        onClick={onCancel}
        className="flex-1 h-10 text-[13px] font-medium text-ink-700 bg-canvas-elevated border border-canvas-border rounded-[8px] hover:border-brand-200 transition-colors cursor-pointer"
      >
        Cancel
      </button>
      <button
        onClick={onReject}
        disabled={disabled}
        title={disabled ? disabledTitle : undefined}
        className={`flex-1 h-10 text-[13px] font-semibold text-white bg-risk hover:bg-risk-700 rounded-[8px] transition-colors flex items-center justify-center gap-1.5 ${decisionCls}`}
      >
        <XCircle size={14} />
        Reject
      </button>
      <button
        onClick={onApprove}
        disabled={disabled}
        title={disabled ? disabledTitle : undefined}
        className={`flex-1 h-10 text-[13px] font-semibold text-white bg-compliant hover:bg-compliant-700 rounded-[8px] transition-colors flex items-center justify-center gap-1.5 ${decisionCls}`}
      >
        <CheckCircle2 size={14} />
        Approve
      </button>
    </>
  );
}

function ActivityTimeline({ entries }: { entries: GrcActivityEntry[] }) {
  const [showMore, setShowMore] = useState(false);
  const visible = showMore ? entries : entries.slice(0, 3);
  const hiddenCount = entries.length - visible.length;

  return (
    <div>
      <SectionLabel>Activity Log</SectionLabel>
      <ol className="space-y-4">
        {visible.map((entry) => (
          <li key={entry.id} className="flex gap-3">
            <div className="shrink-0 w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center">
              <User size={13} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3 mb-0.5">
                <div className="text-[12.5px] text-ink-800">
                  <span className="font-semibold">{entry.author}</span>{' '}
                  <span className="text-ink-500">[{entry.role}]</span>
                </div>
                <span className="text-[11px] text-ink-500 tabular-nums whitespace-nowrap">{entry.timestamp}</span>
              </div>
              <p className="text-[12.5px] text-ink-700 leading-snug">{entry.message}</p>
              {entry.comment && (
                <div className="mt-2 px-3 py-2 bg-[#FAFAFB] border border-canvas-border rounded-[8px] text-[12px] text-ink-700 leading-relaxed">
                  {entry.comment}
                </div>
              )}
              {entry.attachment && (
                <button className="mt-2 inline-flex items-center gap-1.5 h-6 px-2 bg-brand-50 text-brand-700 text-[11.5px] font-medium rounded-full hover:bg-brand-100 cursor-pointer">
                  <Paperclip size={11} />
                  {entry.attachment.name}
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>
      {hiddenCount > 0 && !showMore && (
        <button
          onClick={() => setShowMore(true)}
          className="mt-4 inline-flex items-center gap-1 text-[12.5px] font-medium text-brand-700 hover:text-brand-600 cursor-pointer"
        >
          <ChevronDown size={13} />
          Show {hiddenCount} more
        </button>
      )}
    </div>
  );
}

// ─── Unified comment box ────────────────────────────────────────────────────
// One classy comment section used across every review modal (Classify, View,
// Review Plan, Review Action, Mark Complete). It merges what used to be two
// boxes — the decision rationale and the cross-persona comment channel — into a
// single host-controlled field: the text is the modal's review comment, and the
// "Post Comment" CTA shares it with the other persona (added to the activity log
// and they're notified). An optional suggested chip pre-fills an editable
// rationale. When `onPostComment` is omitted the box is read-only-friendly
// (Post Comment hidden).
export function CaseCommentBox({
  value,
  onChange,
  onPostComment,
  label = 'Comment',
  hint = 'optional',
  placeholder = 'Add a comment — shared with the other reviewer and captured in the activity log…',
  suggested,
  onApplySuggested,
}: {
  value: string;
  onChange: (v: string) => void;
  onPostComment?: (text: string, attachment?: { name: string }) => void;
  label?: string;
  hint?: string;
  placeholder?: string;
  suggested?: string;
  onApplySuggested?: () => void;
}) {
  const [attachment, setAttachment] = useState<{ name: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const canPost = !!value.trim() || !!attachment;
  const post = () => {
    if (!canPost || !onPostComment) return;
    onPostComment(value.trim(), attachment ?? undefined);
    onChange('');
    setAttachment(null);
  };
  return (
    <div>
      <div className="flex items-baseline gap-1.5 mb-2">
        <span className="text-[12.5px] font-semibold text-ink-800">{label}</span>
        {hint && <span className="text-[11.5px] text-ink-400">{hint}</span>}
      </div>
      {suggested && onApplySuggested && <SuggestedChip message={suggested} onApply={onApplySuggested} />}
      <div className="rounded-[10px] border border-canvas-border bg-canvas-elevated focus-within:border-brand-600 focus-within:ring-[3px] focus-within:ring-brand-600/15 transition-colors">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); post(); } }}
          rows={3}
          placeholder={placeholder}
          className="w-full resize-y bg-transparent px-3.5 py-3 text-[13px] text-ink-900 leading-relaxed placeholder:text-ink-400 focus:outline-none"
        />
        {attachment && (
          <div className="px-3.5 pb-2.5">
            <span className="inline-flex items-center gap-1.5 h-7 pl-2.5 pr-1.5 bg-brand-50 border border-brand-100 rounded-full text-[11.5px] text-ink-700">
              <Paperclip size={11} className="text-brand-600" /> {attachment.name}
              <button type="button" onClick={() => setAttachment(null)} aria-label="Remove attachment" className="w-4 h-4 inline-flex items-center justify-center rounded-full text-ink-500 hover:text-ink-800 hover:bg-white cursor-pointer"><X size={11} /></button>
            </span>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) setAttachment({ name: f.name }); e.target.value = ''; }}
        />
        <div className="flex items-center justify-between gap-3 px-2.5 py-2 border-t border-canvas-border">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            title="Attach a file"
            className="inline-flex items-center gap-1.5 h-8 px-2.5 text-[12px] font-medium text-ink-600 rounded-[8px] hover:bg-[#F4F2F7] hover:text-brand-700 cursor-pointer transition-colors"
          >
            <Paperclip size={14} /> Attach
          </button>
          {onPostComment && (
            <button
              type="button"
              onClick={post}
              disabled={!canPost}
              className="inline-flex items-center gap-1.5 h-8 px-3.5 text-[12.5px] font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-[8px] cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={13} /> Post Comment
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Review Classification Drawer ───
export function ReviewClassificationDrawer({
  exception,
  onClose,
  onDecision,
  onPostComment,
  role,
}: {
  exception: GrcException;
  onClose: () => void;
  onDecision: (decision: 'approve' | 'reject') => void;
  /** Post a free-form comment to this case's thread (always-on channel). */
  onPostComment?: (text: string, attachment?: { name: string }) => void;
  role?: 'risk-owner' | 'auditor';
}) {
  const { can } = useCan();
  const canTriage = can('exc_triage');
  const detail = GRC_CASE_DETAILS[exception.id];
  const bulk = exception.bulkId ? GRC_BULK_ACTIONS[exception.bulkId] : null;
  const [comment, setComment] = useState('');
  const isRiskOwner = role === 'risk-owner';

  // When the case is in an approval route and the acting user is a current-level
  // approver, the decision drives the route engine (advance / send to first Risk
  // Owner on reject) instead of finalizing the case directly. The route governs.
  const { assignments, currentUserId, decide } = useWorkflow();
  const routeAssignment = assignments.find(a => a.exceptionId === exception.id && a.status === 'in-approval');
  const onRouteTurn = !!routeAssignment && canAct(routeAssignment, currentUserId).ok;
  const handleDecision = (decision: 'approve' | 'reject') => {
    if (routeAssignment && onRouteTurn) {
      decide(routeAssignment.id, currentUserId, decision, comment.trim());
      onClose();
    } else {
      onDecision(decision);
    }
  };

  return (
    <>
      <Overlay onClick={onClose} />
      <ModalShell
        title={isRiskOwner ? 'Review Request Submitted' : 'Review Classification'}
        context={<ExceptionContext exception={exception} />}
        onClose={onClose}
        footer={
          isRiskOwner ? (
            <>
              <button
                onClick={onClose}
                className="flex-1 h-10 text-[13px] font-medium text-ink-700 bg-canvas-elevated border border-canvas-border rounded-[8px] hover:border-brand-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={onClose}
                className="flex-[2] h-10 text-[13px] font-semibold rounded-[8px] transition-colors flex items-center justify-center gap-1.5 bg-brand-600 text-white hover:bg-brand-500 cursor-pointer"
              >
                Submit
              </button>
            </>
          ) : (
            <FooterButtons
              onCancel={onClose}
              onReject={() => canTriage && handleDecision('reject')}
              onApprove={() => canTriage && handleDecision('approve')}
              disabled={!canTriage}
              disabledTitle="You don't have permission to review classifications"
            />
          )
        }
      >
        {bulk && (
          <div className="bg-brand-50/70 border border-brand-100 rounded-[12px] p-4 mb-5">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-brand-700 mb-2">
              <LinkIcon size={13} />
              Part of Bulk Action
            </div>
            <div className="flex items-center gap-3 text-[12.5px] text-ink-700">
              <span>ID: <span className="font-mono font-semibold text-brand-700">{bulk.id}</span></span>
              <span className="text-ink-300">|</span>
              <span className="tabular-nums">{bulk.caseIds.length} cases grouped</span>
            </div>
          </div>
        )}

        <div className="mb-5">
          <section className="border border-canvas-border rounded-[12px] p-4">
            <SectionLabel>Classification</SectionLabel>
            <Pill className={CLASSIFICATION_STYLE[exception.classification]}>
              {exception.classification}
            </Pill>
          </section>
        </div>

        <div className="mb-5">
          <CaseCommentBox
            value={comment}
            onChange={setComment}
            onPostComment={onPostComment}
            label="Comment"
            hint="optional"
            placeholder="Add a comment — shared with the other reviewer and captured in the activity log…"
          />
        </div>

        {detail && <ActivityTimeline entries={detail.activityLog} />}
      </ModalShell>
    </>
  );
}

// ─── Review Case Drawer (action review) ───
export function ReviewCaseDrawer({
  exception,
  onClose,
  onDecision,
  onViewBulk,
  onPostComment,
  role,
}: {
  exception: GrcException;
  onClose: () => void;
  onDecision: (
    decision: 'approve' | 'reject',
    payload: { implementation: 'Implemented' | 'Partially Implemented' | null; comment: string },
  ) => void;
  onViewBulk: (bulkId: string) => void;
  /** Post a free-form comment to this case's thread (always-on channel). */
  onPostComment?: (text: string, attachment?: { name: string }) => void;
  role?: 'risk-owner' | 'auditor';
}) {
  const detail = GRC_CASE_DETAILS[exception.id];
  const bulk = exception.bulkId ? GRC_BULK_ACTIONS[exception.bulkId] : null;
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null);
  const [implementation, setImplementation] = useState<'Implemented' | 'Partially Implemented' | null>(null);
  const [comment, setComment] = useState('');

  // Route-aware decision: when the case is mid-approval and the acting user is a
  // current-level approver, the decision advances the route engine (or sends to
  // the first Risk Owner on reject) rather than finalizing the case directly.
  const { assignments, currentUserId, decide } = useWorkflow();
  const routeAssignment = assignments.find(a => a.exceptionId === exception.id && a.status === 'in-approval');
  const onRouteTurn = !!routeAssignment && canAct(routeAssignment, currentUserId).ok;
  const submitDecision = (d: 'approve' | 'reject') => {
    if (routeAssignment && onRouteTurn) {
      decide(routeAssignment.id, currentUserId, d, comment.trim());
      onClose();
    } else {
      onDecision(d, { implementation, comment });
    }
  };

  const isAuditor = role === 'auditor';
  const actionable = ACTIONABLE_CLASSIFICATIONS.has(exception.classification);
  const phase = exception.actionPhase;

  // The Auditor's review has two stages for an actionable plan, plus a single
  // classification review for non-actionable cases:
  //   plan-review       → Accept / Reject the management action plan
  //   completion-review → review the completed work + implementation outcome
  //   classification    → Approve / Reject (Business as Usual / False Positive)
  // A classified, not-yet-reviewed actionable case with no explicit phase (legacy
  // data) defaults to the plan-review stage.
  const isPlanReview = isAuditor && actionable && (phase === 'plan-review' || (!phase && exception.actionReview === 'Pending' && exception.classification !== 'Unclassified'));
  const isCompletionReview = isAuditor && actionable && phase === 'completion-review';
  const isClassReview = isAuditor && !actionable && exception.actionReview === 'Pending' && exception.classification !== 'Unclassified';
  const needsDecision = isPlanReview || isCompletionReview || isClassReview;
  // Anything else (Risk Owner viewing, or an already-decided case) is read-only.
  const isViewMode = !needsDecision;

  const completion = detail?.completion;

  // Submit is enabled when a decision is chosen — and, for a completion Approve,
  // an implementation outcome is selected.
  // Reviewing the Action Taken (completion review) requires a comment — it is
  // captured in the Action Taken Report.
  const completionCommentOk = !isCompletionReview || comment.trim().length > 0;
  const canSubmit = isViewMode
    ? true
    : (decision === 'reject' || (decision === 'approve' && (!isCompletionReview || implementation !== null))) && completionCommentOk;

  // Auto-typed, editable message that reflects the chosen decision/outcome.
  const suggested = (() => {
    if (isViewMode || !decision) return '';
    if (isPlanReview) {
      return decision === 'approve'
        ? 'Management action plan is well-scoped and appropriate — accepted for implementation.'
        : 'Management action plan needs revision before it can be accepted. Please refine and resubmit.';
    }
    if (isCompletionReview) {
      if (decision === 'reject') return 'A discrepancy was identified in the completed action — reopening for the Risk Owner to address.';
      if (implementation === 'Implemented') return 'Action is fully implemented in the system and verified against the evidence provided.';
      if (implementation === 'Partially Implemented') return 'Action is partially implemented — the verified portion is accepted; remaining items to be closed by the Risk Owner.';
      return '';
    }
    if (isClassReview) {
      return decision === 'approve'
        ? 'Classification reviewed and approved — no action plan required.'
        : 'Classification not accepted — reopening for the Risk Owner to re-assess.';
    }
    return '';
  })();
  const applySuggested = useSuggestedMessage(suggested, comment, setComment);

  return (
    <>
      <Overlay onClick={onClose} />
      <ModalShell
        title={isPlanReview ? 'Review Management Action Plan' : isCompletionReview ? 'Review Completed Action' : isClassReview ? 'Review Classification' : 'Case Details'}
        routeChain={<RouteChainNote exceptionId={exception.id} />}
        context={<ExceptionContext exception={exception} extra={
          <ContextChip label="Stage">{isPlanReview ? 'Plan review' : isCompletionReview ? 'Action review' : isClassReview ? 'Classification review' : 'View'}</ContextChip>
        } />}
        onClose={onClose}
        footer={
          <>
            <button
              onClick={onClose}
              className="flex-1 h-10 text-[13px] font-medium text-ink-700 bg-canvas-elevated border border-canvas-border rounded-[8px] hover:border-brand-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (isViewMode) { onClose(); return; }
                // The action review is the Auditor's decision (the Risk Owner
                // classifies; the Auditor approves/rejects). On a route, a
                // current-level approver of either side may act.
                if (!isAuditor && !onRouteTurn) return;
                if (canSubmit && decision) submitDecision(decision);
              }}
              disabled={!canSubmit || (!isViewMode && !isAuditor && !onRouteTurn)}
              title={!isViewMode && !isAuditor && !onRouteTurn ? 'Only the Auditor can submit a review decision' : undefined}
              className={`flex-[2] h-10 text-[13px] font-semibold rounded-[8px] transition-colors flex items-center justify-center gap-1.5 ${
                canSubmit
                  ? 'bg-brand-600 text-white hover:bg-brand-500 cursor-pointer'
                  : 'bg-brand-600/50 text-white/80 cursor-not-allowed'
              }`}
            >
              {isViewMode ? 'Submit' : 'Submit Decision'}
            </button>
          </>
        }
      >
        <>
          {bulk && (
              <div className="bg-brand-50/70 border border-brand-100 rounded-[12px] p-4 mb-5">
                <div className="flex items-center gap-2 text-[13px] font-semibold text-brand-700 mb-2">
                  <LinkIcon size={13} />
                  Part of Bulk Action
                </div>
                <div className="flex items-center gap-3 text-[12.5px] text-ink-700 mb-2">
                  <span>ID: <span className="font-mono font-semibold text-brand-700">{bulk.id}</span></span>
                  <span className="text-ink-300">|</span>
                  <span className="tabular-nums">{bulk.caseIds.length} cases grouped</span>
                </div>
                <button
                  onClick={() => onViewBulk(bulk.id)}
                  className="inline-flex items-center gap-1 text-[12.5px] font-medium text-brand-700 hover:text-brand-600 cursor-pointer"
                >
                  View all cases in this bulk action
                  <ExternalLink size={12} />
                </button>
              </div>
            )}

            <div className="mb-4">
              <section className="border border-canvas-border rounded-[12px] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <SectionLabel>Classification</SectionLabel>
                    <Pill className={CLASSIFICATION_STYLE[exception.classification]}>
                      {exception.classification}
                    </Pill>
                  </div>
                  {exception.actionableId && (
                    <div className="text-right">
                      <SectionLabel>Actionable ID</SectionLabel>
                      <span className="inline-flex items-center gap-1 font-mono font-semibold text-brand-700 text-[12.5px]">
                        <Hash size={12} /> {exception.actionableId}
                      </span>
                    </div>
                  )}
                </div>
              </section>
            </div>

            {detail && (
              <section className="border border-canvas-border rounded-[12px] p-4 mb-4">
                <SectionLabel>{detail.actionPlans && detail.actionPlans.length > 1 ? `Management Action Plans · ${detail.actionPlans.length}` : 'Management Action Plan'}</SectionLabel>
                {detail.actionPlans && detail.actionPlans.length > 0 ? (
                  <div className="space-y-3">
                    {detail.actionPlans.map((p, i) => (
                      <div key={i} className={i > 0 ? 'pt-3 border-t border-canvas-border' : ''}>
                        <h3 className="text-[14px] font-semibold text-ink-900 mb-1.5 leading-snug">
                          <FileText size={14} className="inline mr-1.5 text-ink-500 -mt-0.5" />
                          {p.name || `Management Action Plan ${i + 1}`}
                        </h3>
                        {p.dueDate && (
                          <div className="inline-flex items-center gap-1.5 text-[12px] text-brand-700 bg-brand-50 rounded-full px-2.5 h-6 mb-2">
                            <Calendar size={11} />
                            Due {fmtPlanDate(p.dueDate)}
                          </div>
                        )}
                        {p.details && <p className="text-[12.5px] text-ink-700 leading-relaxed">{p.details}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <h3 className="text-[14px] font-semibold text-ink-900 mb-1.5 leading-snug">
                      <FileText size={14} className="inline mr-1.5 text-ink-500 -mt-0.5" />
                      {detail.actionTitle}
                    </h3>
                    {detail.actionDueDate && (
                      <div className="inline-flex items-center gap-1.5 text-[12px] text-brand-700 bg-brand-50 rounded-full px-2.5 h-6 mb-2">
                        <Calendar size={11} />
                        {detail.actionDueDate}
                      </div>
                    )}
                    <p className="text-[12.5px] text-ink-700 leading-relaxed">{detail.actionDescription}</p>
                  </>
                )}
              </section>
            )}

            {/* Completion review — the Risk Owner's completion note + evidence. */}
            {isCompletionReview && completion && (
              <section className="border border-compliant/40 bg-compliant-50/40 rounded-[12px] p-4 mb-4">
                <SectionLabel>Risk Owner — Action Completed</SectionLabel>
                {completion.selfAssessment && (
                  <div className="mb-2.5">
                    <span className="text-[11px] text-ink-500 mr-1.5">Risk Owner reports:</span>
                    <Pill className={completion.selfAssessment === 'Implemented' ? 'bg-compliant-50 text-compliant-700 border border-compliant/40' : 'bg-mitigated-50 text-mitigated-700 border border-mitigated/40'}>
                      {completion.selfAssessment}
                    </Pill>
                  </div>
                )}
                <p className="text-[12.5px] text-ink-700 leading-relaxed">{completion.note}</p>
                {completion.evidence.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {completion.evidence.map((ev, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 h-7 px-2.5 bg-white border border-canvas-border rounded-full text-[11.5px] text-ink-700">
                        <Paperclip size={11} className="text-brand-600" /> {ev.name}
                      </span>
                    ))}
                  </div>
                )}
                {completion.completedAt && <p className="text-[11px] text-ink-400 mt-2">Marked complete on {completion.completedAt}</p>}
              </section>
            )}

            <section className="border border-canvas-border rounded-[12px] p-4">
              <SectionLabel>Auditor Decision</SectionLabel>

              {/* Accept/Reject (plan) or Approve/Reject (completion / classification) */}
              {!isViewMode && (
                <div className="mb-4">
                  <label className="block text-[12.5px] font-medium text-ink-800 mb-2">
                    Decision <span className="text-risk">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => { setDecision('approve'); }}
                      className={`h-10 text-[12.5px] font-semibold rounded-[8px] border transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                        decision === 'approve'
                          ? 'bg-compliant text-white border-compliant shadow-[0_2px_8px_rgba(22,163,74,0.25)]'
                          : 'bg-compliant-50 border-compliant text-compliant-700 hover:bg-compliant hover:text-white'
                      }`}
                    >
                      <CheckCircle2 size={14} />
                      {isPlanReview ? 'Accept Plan' : 'Approve'}
                    </button>
                    <button
                      onClick={() => { setDecision('reject'); setImplementation(null); }}
                      className={`h-10 text-[12.5px] font-semibold rounded-[8px] border transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                        decision === 'reject'
                          ? 'bg-risk text-white border-risk shadow-[0_2px_8px_rgba(220,38,38,0.25)]'
                          : 'bg-risk-50 border-risk text-risk-700 hover:bg-risk hover:text-white'
                      }`}
                    >
                      <XCircle size={14} />
                      {isPlanReview ? 'Reject Plan' : 'Reject'}
                    </button>
                  </div>
                  {isPlanReview && decision === 'approve' && (
                    <p className="text-[11.5px] text-ink-500 mt-2 leading-snug">The Risk Owner will implement this plan, then submit evidence of completion for your final review.</p>
                  )}
                </div>
              )}

              {/* Completion Approve → mandatory implementation outcome */}
              {isCompletionReview && decision === 'approve' && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15 }}
                  className="mb-4"
                >
                  <label className="block text-[12.5px] font-medium text-ink-800 mb-2">
                    Implementation Status <span className="text-risk">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['Implemented', 'Partially Implemented'] as const).map((status) => {
                      const selected = implementation === status;
                      return (
                        <button
                          key={status}
                          onClick={() => setImplementation(status)}
                          className={`h-10 text-[12.5px] font-medium rounded-[8px] border transition-colors cursor-pointer ${
                            selected
                              ? 'bg-brand-50 border-brand-600 text-brand-700'
                              : 'bg-canvas-elevated border-canvas-border text-ink-700 hover:border-brand-200'
                          }`}
                        >
                          {status}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* Reject → reopen at the Risk Owner's end (Discrepancy on completion). */}
              {!isViewMode && decision === 'reject' && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15 }}
                  className="mb-4 p-3 bg-risk-50 border border-risk/40 rounded-[8px]"
                >
                  {isCompletionReview && (
                    <div className="flex items-center gap-2 text-[12.5px] font-semibold text-risk-700 mb-1">
                      <Pill className="bg-risk-50 text-risk-700 border border-risk/40">Discrepancy</Pill>
                    </div>
                  )}
                  <p className="text-[12px] text-risk-700 leading-snug">
                    {isPlanReview
                      ? "On submit, the management action plan is rejected and the case reopens for the Risk Owner to revise and resubmit."
                      : "On submit, the case will reopen at the Risk Owner's end for further action."}
                  </p>
                </motion.div>
              )}

              <CaseCommentBox
                value={comment}
                onChange={setComment}
                onPostComment={onPostComment}
                label="Comment"
                hint={isCompletionReview ? 'required for this review' : 'optional'}
                placeholder={isCompletionReview ? 'Add your review comment (required)…' : 'Add a comment — shared with the other reviewer and captured in the activity log…'}
                suggested={!isViewMode ? suggested : undefined}
                onApplySuggested={!isViewMode ? applySuggested : undefined}
              />
              {isCompletionReview && (
                <p className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-brand-700">
                  <FileText size={12} className="shrink-0" /> The comment you submit with the decision is captured in the Action Taken Report (ATR).
                </p>
              )}
            </section>

            {/* Activity & comments log — every action and comment shows here. */}
            {detail && (
              <div className="mt-4">
                <ActivityTimeline entries={detail.activityLog} />
              </div>
            )}
          </>
      </ModalShell>
    </>
  );
}

// ─── Mark Action Complete Drawer (Risk Owner) ───
// After the Auditor accepts the plan, the Risk Owner implements it and submits a
// completion note + evidence; this moves the case to the Auditor's completion review.
export function CompleteActionDrawer({
  exception,
  onClose,
  onSubmit,
  onPostComment,
  bulkId,
  linkedCases = [],
}: {
  exception: GrcException;
  onClose: () => void;
  onSubmit: (payload: { note: string; evidence: { name: string }[]; implementation: 'Implemented' | 'Partially Implemented'; comment: string }) => void;
  /** Post a free-form comment to this case's thread (always-on channel). */
  onPostComment?: (text: string, attachment?: { name: string }) => void;
  /** Bulk group this case belongs to — surfaces the "Part of Bulk Action" banner. */
  bulkId?: string;
  /** Live linked cases the action taken is recorded against (all, once the plan is
   *  approved). When more than one, the banner + grouped-cases link appear. */
  linkedCases?: LinkedCaseRow[];
}) {
  const detail = GRC_CASE_DETAILS[exception.id];
  const [implementation, setImplementation] = useState<'Implemented' | 'Partially Implemented' | null>(detail?.completion?.selfAssessment ?? null);
  const [note, setNote] = useState(detail?.completion?.note ?? '');     // Action Taken — manual, no auto-fill
  const [comment, setComment] = useState('');
  const [evidence, setEvidence] = useState<{ name: string }[]>(detail?.completion?.evidence ?? []);
  const [showGroup, setShowGroup] = useState(false);
  const isBulk = linkedCases.length > 1;
  const fileRef = useRef<HTMLInputElement>(null);
  // Risk Owner describes the action (manual) and reports how it landed.
  const canSubmit = note.trim().length > 0 && implementation !== null;

  // Once a status is picked, the Comment box auto-fills with an editable message.
  const suggested = implementation === 'Implemented'
    ? 'The management action plan has been fully implemented in the system. Evidence is attached for the Auditor’s review.'
    : implementation === 'Partially Implemented'
      ? 'The management action plan has been partially implemented. The remaining items are in progress; interim evidence is attached for review.'
      : '';
  const applySuggested = useSuggestedMessage(suggested, comment, setComment);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const incoming = Array.from(files).map(f => ({ name: f.name }));
    setEvidence(prev => [...prev, ...incoming.filter(n => !prev.some(p => p.name === n.name))]);
  };

  return (
    <>
      <Overlay onClick={onClose} />
      <ModalShell
        title="Mark Action Complete"
        context={<ExceptionContext exception={exception} extra={isBulk ? <ContextChip label="Applies to">{linkedCases.length} linked cases</ContextChip> : undefined} />}
        onClose={onClose}
        footer={
          <>
            <button
              onClick={onClose}
              className="flex-1 h-10 text-[13px] font-medium text-ink-700 bg-canvas-elevated border border-canvas-border rounded-[8px] hover:border-brand-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => { if (canSubmit && implementation) onSubmit({ note: note.trim(), evidence, implementation, comment: comment.trim() }); }}
              disabled={!canSubmit}
              className={`flex-[2] h-10 text-[13px] font-semibold rounded-[8px] transition-colors flex items-center justify-center gap-1.5 ${
                canSubmit ? 'bg-brand-600 text-white hover:bg-brand-500 cursor-pointer' : 'bg-brand-600/50 text-white/80 cursor-not-allowed'
              }`}
            >
              <CheckCircle2 size={14} />
              Submit for Review
            </button>
          </>
        }
      >
        <>
          {isBulk && (
            <div className="bg-brand-50/70 border border-brand-100 rounded-[12px] p-4 mb-4">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-brand-700 mb-2">
                <LinkIcon size={13} />
                Part of Bulk Action
              </div>
              <div className="flex items-center gap-3 text-[12.5px] text-ink-700 mb-2">
                {bulkId && (
                  <>
                    <span>ID: <span className="font-mono font-semibold text-brand-700">{bulkId}</span></span>
                    <span className="text-ink-300">|</span>
                  </>
                )}
                <span className="tabular-nums">{linkedCases.length} cases grouped</span>
              </div>
              <p className="text-[11.5px] text-ink-600 leading-snug mb-2">
                The plan was approved for the whole group, so this action taken is recorded against every linked case.
              </p>
              <button
                onClick={() => setShowGroup(true)}
                className="inline-flex items-center gap-1 text-[12.5px] font-medium text-brand-700 hover:text-brand-600 cursor-pointer"
              >
                View grouped cases
                <ExternalLink size={12} />
              </button>
            </div>
          )}

          <p className="text-[12.5px] text-ink-600 leading-relaxed mb-4">
            Confirm the management action plan has been completed. Use the attach icon to add evidence as proof — the Auditor will review and record the outcome.
          </p>

          {detail && (detail.actionPlans?.length || detail.actionTitle) && (
            <section className="border border-canvas-border rounded-[12px] p-4 mb-4">
              <SectionLabel>Management Action Plan</SectionLabel>
              {(detail.actionPlans && detail.actionPlans.length > 0 ? detail.actionPlans : [{ name: detail.actionTitle, details: detail.actionDescription, dueDate: '' }]).map((p, i) => (
                <div key={i} className={i > 0 ? 'pt-2.5 mt-2.5 border-t border-canvas-border' : ''}>
                  <h3 className="text-[13.5px] font-semibold text-ink-900 leading-snug">
                    <FileText size={13} className="inline mr-1.5 text-ink-500 -mt-0.5" />
                    {p.name || `Management Action Plan ${i + 1}`}
                  </h3>
                  {p.dueDate && (
                    <span className="inline-flex items-center gap-1.5 text-[11.5px] text-brand-700 bg-brand-50 rounded-full px-2.5 h-6 mt-1.5">
                      <Calendar size={11} /> Due {fmtPlanDate(p.dueDate)}
                    </span>
                  )}
                </div>
              ))}
            </section>
          )}

          {/* Action Taken — the Risk Owner describes what was done (manual). */}
          <div className="mb-4">
            <label className="block text-[12.5px] font-semibold text-ink-800 mb-2">
              Action Taken <span className="text-risk">*</span>
            </label>
            <div className="relative">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Describe the action you completed before the due date…"
                rows={4}
                className="w-full resize-none p-3 pr-10 bg-canvas-elevated border border-canvas-border rounded-[8px] text-[13px] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/20"
              />
              <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                title="Attach evidence"
                aria-label="Attach evidence"
                className="absolute bottom-2 right-2 w-7 h-7 flex items-center justify-center text-ink-400 hover:text-brand-700 cursor-pointer"
              >
                <Paperclip size={14} />
              </button>
            </div>
            {evidence.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {evidence.map((ev) => (
                  <span key={ev.name} className="inline-flex items-center gap-1.5 h-7 pl-2.5 pr-1 bg-brand-50 border border-brand-200 rounded-full text-[11.5px] text-brand-700">
                    <Paperclip size={11} /> {ev.name}
                    <button onClick={() => setEvidence(prev => prev.filter(e => e.name !== ev.name))} className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-white/70 cursor-pointer"><X size={11} /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Implementation Status — Risk Owner reports how it landed, after Action Taken. */}
          <div className="mb-4">
            <label className="block text-[12.5px] font-semibold text-ink-800 mb-2">
              Implementation Status <span className="text-risk">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['Implemented', 'Partially Implemented'] as const).map((status) => {
                const selected = implementation === status;
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setImplementation(status)}
                    className={`h-10 text-[12.5px] font-medium rounded-[8px] border transition-colors cursor-pointer ${
                      selected
                        ? (status === 'Implemented' ? 'bg-compliant-50 border-compliant text-compliant-700' : 'bg-mitigated-50 border-mitigated text-mitigated-700')
                        : 'bg-canvas-elevated border-canvas-border text-ink-700 hover:border-brand-200'
                    }`}
                  >
                    {status}
                  </button>
                );
              })}
            </div>
            <p className="text-[11.5px] text-ink-500 mt-2 leading-snug">The Auditor reviews your evidence and confirms the final outcome.</p>
          </div>

          {/* Unified comment — the note for the Auditor and the cross-persona
              comment channel in one box; the suggested chip pre-fills an editable
              message once a status is chosen. */}
          <div className="mb-4">
            <CaseCommentBox
              value={comment}
              onChange={setComment}
              onPostComment={onPostComment}
              label="Comment"
              hint="optional"
              placeholder="Add a note for the Auditor — shared with them and captured in the activity log…"
              suggested={suggested}
              onApplySuggested={applySuggested}
            />
          </div>

          {detail && (
            <div className="mt-5">
              <ActivityTimeline entries={detail.activityLog} />
            </div>
          )}
        </>
      </ModalShell>
      <AnimatePresence>
        {showGroup && (
          <BulkCasesModal key="complete-group" groupId={bulkId} cases={linkedCases} onClose={() => setShowGroup(false)} />
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Classify Exception Drawer (Risk Owner) ───
const CLASSIFY_OPTIONS: string[] = [
  'Business as Usual',
  'False Positive',
  'Design Deficiency',
  'System Deficiency',
  'Procedural Non-Compliance',
];

// Classifications that require an action plan (matches BulkClassifyModal).
const ACTIONABLE_CLASSIFICATIONS = new Set<string>([
  'Design Deficiency',
  'System Deficiency',
  'Procedural Non-Compliance',
]);

// A single remediation action plan. Actionable classifications can carry several,
// each rendered as a collapsible card in the Classify drawer.
interface ActionPlanDraft {
  id: string;
  name: string;
  details: string;
  dueDate: string;
}

export function ClassifyExceptionDrawer({
  exception,
  onClose,
  onSave,
  onPostComment,
  actionableId,
  scopeCount = 1,
  linkedCases = [],
  bulkSkipped,
}: {
  exception: GrcException;
  onClose: () => void;
  onSave: (payload: {
    severity: GrcExceptionSeverity;
    classification: string;
    comment: string;
    actionName?: string;
    actionTaken?: string;
    dueDate?: string;
    actionPlans?: { name: string; details: string; dueDate: string }[];
  }) => void;
  /** Post a free-form comment to this case's thread (always-on channel). */
  onPostComment?: (text: string, attachment?: { name: string }) => void;
  /** Actionable ID assigned once an actionable classification is chosen — shown
   *  while the management action plan is created. */
  actionableId?: string;
  /** How many linked cases this classify applies to (bulk) — the ID is shared. */
  scopeCount?: number;
  /** The linked cases a bulk classify applies to — surfaces the "View all linked
   *  cases" link when more than one. */
  linkedCases?: LinkedCaseRow[];
  /** Cases left out of a bulk classify because they're locked by the auditor flow
   *  — shown as a clear, numbered breakdown so the Risk Owner knows what was skipped. */
  bulkSkipped?: { awaitingReview: number; approved: number };
}) {
  const isBulk = linkedCases.length > 1;
  // If the acting user is the assignee of a drafting route for this case, saving
  // the classification + action plan submits it into the approval chain (Step 2 →
  // Step 4). Driven entirely from this existing modal — no new modal surface.
  const { assignments, currentUserId, submitForApproval } = useWorkflow();
  const routeDraft = assignments.find(
    a => a.exceptionId === exception.id && a.status === 'drafting' && a.assigneeId === currentUserId,
  );
  const [showLinked, setShowLinked] = useState(false);
  const [stepIdx, setStepIdx] = useState(0); // 0 = Classify, 1 = Action Plan
  const skippedTotal = (bulkSkipped?.awaitingReview ?? 0) + (bulkSkipped?.approved ?? 0);
  // Re-classifying a (rejected) case pre-fills the previous classification,
  // rationale and action plans so the Risk Owner can update them.
  const reclassDetail = GRC_CASE_DETAILS[exception.id];
  const isReclassify = exception.classification !== 'Unclassified';
  // Severity is AI-assigned and no longer editable in the panel — carried through as-is.
  const severity = exception.severity;
  const [classification, setClassification] = useState<string>(isReclassify ? exception.classification : '');
  const [comment, setComment] = useState(
    isReclassify && reclassDetail?.classificationJustification
      ? reclassDetail.classificationJustification.replace(/^"|"$/g, '')
      : '',
  );
  const [actionPlans, setActionPlans] = useState<ActionPlanDraft[]>(() => {
    if (isReclassify && reclassDetail?.actionPlans?.length) {
      return reclassDetail.actionPlans.map((p, i) => ({ id: `ap-${i + 1}`, name: p.name, details: p.details, dueDate: p.dueDate }));
    }
    return [{ id: 'ap-1', name: '', details: '', dueDate: '' }];
  });
  const [expandedPlan, setExpandedPlan] = useState<string>('ap-1');
  const [classificationOpen, setClassificationOpen] = useState(false);
  const classificationRef = useRef<HTMLDivElement>(null);

  const updatePlan = (id: string, patch: Partial<ActionPlanDraft>) =>
    setActionPlans(prev => prev.map(p => (p.id === id ? { ...p, ...patch } : p)));
  const addPlan = () => {
    const id = `ap-${Date.now()}`;
    setActionPlans(prev => [...prev, { id, name: '', details: '', dueDate: '' }]);
    setExpandedPlan(id);
  };
  const removePlan = (id: string) => {
    setActionPlans(prev => (prev.length > 1 ? prev.filter(p => p.id !== id) : prev));
    setExpandedPlan(prev => (prev === id ? '' : prev));
  };

  // Block any due-date earlier than today.
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Close the classification dropdown on outside click or Escape.
  useEffect(() => {
    if (!classificationOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (!classificationRef.current?.contains(e.target as Node)) setClassificationOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setClassificationOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [classificationOpen]);

  const requiresActionPlan = ACTIONABLE_CLASSIFICATIONS.has(classification);

  const canSave = useMemo(() => {
    // Comment is optional — only classification (and an action plan when the
    // classification requires one) are mandatory.
    if (!classification) return false;
    if (requiresActionPlan) {
      if (actionPlans.length === 0) return false;
      if (actionPlans.some(p => !p.name.trim() || !p.details.trim() || !p.dueDate)) return false;
    }
    return true;
  }, [classification, requiresActionPlan, actionPlans]);

  // Adaptive wizard: actionable classifications get a 2nd "Action Plan" step;
  // Business as Usual / False Positive need no plan, so it's a single step.
  const totalSteps = requiresActionPlan ? 2 : 1;
  const step = Math.min(stepIdx, totalSteps - 1);
  const step1Valid = !!classification; // Step 1 needs a classification to proceed.
  const doSave = () => {
    if (!canSave) return;
    const firstPlan = requiresActionPlan ? actionPlans[0] : undefined;
    const planDueDate = requiresActionPlan ? actionPlans.find(p => p.dueDate)?.dueDate : undefined;
    onSave({
      severity,
      classification,
      comment,
      actionName: firstPlan?.name.trim(),
      actionTaken: firstPlan?.details.trim(),
      dueDate: planDueDate,
      actionPlans: requiresActionPlan
        ? actionPlans.map(p => ({ name: p.name.trim(), details: p.details.trim(), dueDate: p.dueDate }))
        : undefined,
    });
    // Submit into the approval route when the acting user owns a drafting
    // assignment — the chain then runs for the action plan (Step 4).
    if (routeDraft) {
      submitForApproval(routeDraft.id, {
        classification,
        actionName: firstPlan?.name.trim(),
        actionDetails: firstPlan?.details.trim(),
        dueDate: planDueDate,
      });
    }
  };

  return (
    <>
      <Overlay onClick={onClose} />
      <ModalShell
        title={isBulk ? 'Bulk Classify' : 'Classify Exception'}
        subtitle={isBulk ? `Apply one classification & action plan to ${linkedCases.length} linked cases` : undefined}
        routeChain={isBulk ? undefined : <RouteChainNote exceptionId={exception.id} />}
        size={isBulk ? 'lg' : 'md'}
        step={totalSteps > 1 ? { current: step + 1, total: totalSteps, label: step === 0 ? 'Classify' : 'Action Plan' } : undefined}
        context={
          <>
            <ContextChip label={isBulk ? 'Cases' : 'Exception'}>
              <span className="font-mono">{isBulk ? `${linkedCases.length} cases` : exception.id}</span>
            </ContextChip>
            <ContextChip label="Current">
              <Pill className={CLASSIFICATION_STYLE[exception.classification]}>{exception.classification}</Pill>
            </ContextChip>
            {classification && classification !== exception.classification && (
              <ContextChip label="New">
                <Pill className={CLASSIFICATION_STYLE[classification as GrcExceptionClassification]}>{classification}</Pill>
              </ContextChip>
            )}
          </>
        }
        onClose={onClose}
        footer={
          <>
            <button
              onClick={onClose}
              className="h-10 px-5 text-[13px] font-medium text-ink-700 bg-canvas-elevated border border-canvas-border rounded-[8px] hover:border-brand-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <div className="flex-1" />
            {step === 1 && (
              <button
                onClick={() => setStepIdx(0)}
                className="h-10 px-5 text-[13px] font-medium text-ink-700 bg-canvas-elevated border border-canvas-border rounded-[8px] hover:border-brand-200 transition-colors cursor-pointer"
              >
                Back
              </button>
            )}
            {step === 0 && totalSteps > 1 ? (
              <button
                onClick={() => step1Valid && setStepIdx(1)}
                disabled={!step1Valid}
                className={`h-10 px-5 text-[13px] font-semibold rounded-[8px] transition-colors flex items-center gap-1.5 ${
                  step1Valid ? 'bg-brand-600 text-white hover:bg-brand-500 cursor-pointer' : 'bg-brand-600/50 text-white/80 cursor-not-allowed'
                }`}
              >
                Next <ArrowRight size={14} />
              </button>
            ) : (
              <Gated permission="exc_classify" mode="disable" title="You don't have permission to classify exceptions">
              <button
                onClick={doSave}
                disabled={!canSave}
                className={`h-10 px-5 text-[13px] font-semibold rounded-[8px] transition-colors ${
                  canSave
                    ? 'bg-brand-600 text-white hover:bg-brand-500 cursor-pointer'
                    : 'bg-brand-600/50 text-white/80 cursor-not-allowed'
                }`}
              >
                Save Classification
              </button>
              </Gated>
            )}
          </>
        }
      >
        {step === 0 && isBulk && (
          <div className="mb-5 rounded-[12px] border border-brand-100 bg-brand-50/60 p-3.5">
            <div className="flex items-center gap-2 text-[12.5px] font-semibold text-brand-700 mb-1.5">
              <LinkIcon size={13} />
              Bulk classification · {linkedCases.length} cases
            </div>
            <p className="text-[11.5px] text-ink-600 leading-snug mb-2">
              The same classification and management action plan will be applied to all linked cases.
            </p>
            <button
              type="button"
              onClick={() => setShowLinked(true)}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-brand-700 hover:text-brand-600 cursor-pointer"
            >
              View all linked cases
              <ExternalLink size={12} />
            </button>
          </div>
        )}

        {/* Skipped, locked cases — auditor-reviewed cases can't be silently overwritten. */}
        {step === 0 && skippedTotal > 0 && (
          <div className="mb-5 rounded-[12px] border border-mitigated/40 bg-mitigated-50/50 p-3.5">
            <div className="flex items-center gap-2 text-[12.5px] font-semibold text-mitigated-700 mb-1.5">
              <ShieldCheck size={13} />
              {skippedTotal} case{skippedTotal === 1 ? '' : 's'} skipped — locked by the auditor flow
            </div>
            <p className="text-[11.5px] text-ink-600 leading-snug mb-2.5">
              An auditor-reviewed exception can’t be silently overwritten. Only editable cases —
              <span className="font-medium text-ink-700"> unclassified</span> or
              <span className="font-medium text-ink-700"> auditor-rejected</span> — are included in this bulk classification.
            </p>
            <ul className="space-y-1.5">
              {(bulkSkipped?.awaitingReview ?? 0) > 0 && (
                <li className="flex items-center gap-2 text-[12px] text-ink-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-mitigated shrink-0" />
                  <span className="font-semibold tabular-nums">{bulkSkipped?.awaitingReview}</span> awaiting auditor review
                </li>
              )}
              {(bulkSkipped?.approved ?? 0) > 0 && (
                <li className="flex items-center gap-2 text-[12px] text-ink-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-compliant shrink-0" />
                  <span className="font-semibold tabular-nums">{bulkSkipped?.approved}</span> auditor-approved
                </li>
              )}
            </ul>
          </div>
        )}

        {step === 0 && (
        <div className="mb-5">
          <label className="block text-[12.5px] font-semibold text-ink-800 mb-2">
            Classification <span className="text-risk">*</span>
          </label>
          <div ref={classificationRef} className="relative">
            <button
              type="button"
              onClick={() => setClassificationOpen(o => !o)}
              aria-haspopup="listbox"
              aria-expanded={classificationOpen}
              className="w-full h-10 px-3 bg-canvas-elevated border border-canvas-border rounded-[8px] text-[13px] text-ink-800 flex items-center justify-between focus:outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/20 hover:border-brand-200 cursor-pointer transition-colors"
            >
              <span className={classification ? 'text-ink-800' : 'text-ink-400'}>
                {classification || 'Select classification…'}
              </span>
              <ChevronDown
                size={14}
                className={`text-ink-400 transition-transform duration-150 ${classificationOpen ? 'rotate-180' : ''}`}
              />
            </button>
            <AnimatePresence>
              {classificationOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                  role="listbox"
                  className="absolute top-full mt-1 left-0 w-full z-30 bg-canvas-elevated border border-canvas-border rounded-[8px] shadow-lg overflow-hidden py-1"
                >
                  {CLASSIFY_OPTIONS.map(c => {
                    const selected = classification === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => {
                          setClassification(c);
                          setClassificationOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-[13px] flex items-center justify-between cursor-pointer transition-colors ${
                          selected ? 'bg-brand-50 text-brand-700' : 'text-ink-800 hover:bg-[#FAFAFB]'
                        }`}
                      >
                        <span>{c}</span>
                        {selected && <Check size={14} className="text-brand-700 shrink-0" />}
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {classification && !requiresActionPlan && (
            <span className="mt-2 inline-block text-[11.5px] text-ink-500">No action plan required.</span>
          )}
        </div>
        )}

        {/* Step 2 · Management action plan(s) — only for actionable classifications. */}
        {step === 1 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            className="border-t border-canvas-border pt-5 mb-5"
          >
            {actionableId && (
              <div className="mb-3 flex items-center justify-between gap-3 px-3 py-2.5 rounded-[10px] bg-brand-50/70 border border-brand-100">
                <div className="flex items-center gap-2 min-w-0">
                  <Hash size={13} className="text-brand-600 shrink-0" />
                  <span className="text-[11.5px] text-ink-600">Actionable ID</span>
                  <span className="font-mono font-semibold text-brand-700 text-[12.5px]">{actionableId}</span>
                </div>
                <span className="text-[11px] text-ink-500 shrink-0">
                  {scopeCount > 1 ? `Shared across ${scopeCount} linked cases` : 'Auto-generated'}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10.5px] uppercase tracking-wider font-semibold text-ink-500">
                Management Action Plans
                <span className="ml-1.5 normal-case tracking-normal text-ink-400 tabular-nums">· {actionPlans.length}</span>
              </span>
              <button
                type="button"
                onClick={addPlan}
                className="inline-flex items-center gap-1 h-7 px-2.5 text-[12px] font-semibold text-brand-700 bg-brand-50 rounded-[8px] hover:bg-brand-100 transition-colors cursor-pointer"
              >
                <Plus size={13} />
                Add plan
              </button>
            </div>

            <div className="space-y-2.5">
              {actionPlans.map((plan, idx) => {
                const open = expandedPlan === plan.id;
                const complete = plan.name.trim() && plan.details.trim() && !!plan.dueDate;
                return (
                  <div key={plan.id} className="border border-canvas-border rounded-[10px] overflow-hidden">
                    {/* Collapsible header */}
                    <div className={`flex items-center gap-2 pl-3 pr-2 h-11 ${open ? 'bg-[#FAFAFB]' : ''}`}>
                      <button
                        type="button"
                        onClick={() => setExpandedPlan(open ? '' : plan.id)}
                        aria-expanded={open}
                        className="flex-1 min-w-0 flex items-center gap-2.5 text-left cursor-pointer h-full"
                      >
                        <span className="shrink-0 w-5 h-5 rounded-full bg-brand-50 text-brand-700 text-[11px] font-bold flex items-center justify-center tabular-nums">
                          {idx + 1}
                        </span>
                        <span className="flex-1 min-w-0 truncate text-[13px] font-semibold text-ink-800">
                          {plan.name.trim() || `Management Action Plan ${idx + 1}`}
                        </span>
                        {plan.dueDate && (
                          <span className="hidden sm:inline-flex items-center gap-1 h-6 px-2 text-[11px] text-brand-700 bg-brand-50 rounded-full shrink-0 tabular-nums">
                            <Calendar size={10} />
                            {plan.dueDate}
                          </span>
                        )}
                        {!complete && (
                          <span
                            className="w-1.5 h-1.5 rounded-full bg-mitigated shrink-0"
                            title="Incomplete — fill in all required fields"
                            aria-label="Incomplete"
                          />
                        )}
                        <ChevronDown
                          size={14}
                          className={`text-ink-400 transition-transform duration-150 shrink-0 ${open ? 'rotate-180' : ''}`}
                        />
                      </button>
                      {actionPlans.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePlan(plan.id)}
                          title="Remove this action plan"
                          aria-label={`Remove action plan ${idx + 1}`}
                          className="shrink-0 w-7 h-7 flex items-center justify-center rounded text-ink-400 hover:text-risk-700 hover:bg-risk-50 cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>

                    {/* Collapsible body */}
                    <AnimatePresence initial={false}>
                      {open && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
                          className="overflow-hidden"
                        >
                          <div className="px-3 pt-3 pb-3.5 space-y-3 border-t border-canvas-border">
                            <div>
                              <label className="block text-[12.5px] font-semibold text-ink-800 mb-2">
                                Action Name <span className="text-risk">*</span>
                              </label>
                              <input
                                value={plan.name}
                                onChange={(e) => updatePlan(plan.id, { name: e.target.value })}
                                placeholder="e.g. MFA enforcement for executive accounts"
                                className="w-full h-10 px-3 bg-canvas-elevated border border-canvas-border rounded-[8px] text-[13px] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/20"
                              />
                            </div>

                            <div>
                              <label className="block text-[12.5px] font-semibold text-ink-800 mb-2">
                                Action Details <span className="text-risk">*</span>
                              </label>
                              <div className="relative">
                                <textarea
                                  value={plan.details}
                                  onChange={(e) => updatePlan(plan.id, { details: e.target.value })}
                                  rows={4}
                                  placeholder="Describe the remediation steps, evidence, and rollout plan…"
                                  className="w-full resize-none p-3 pr-10 bg-canvas-elevated border border-canvas-border rounded-[8px] text-[13px] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/20"
                                />
                                <button
                                  type="button"
                                  title="Attach file"
                                  aria-label="Attach file to action details"
                                  className="absolute bottom-2 right-2 w-7 h-7 flex items-center justify-center text-ink-400 hover:text-brand-700 cursor-pointer"
                                >
                                  <Paperclip size={14} />
                                </button>
                              </div>
                            </div>

                            <div>
                              <label className="block text-[12.5px] font-semibold text-ink-800 mb-2">
                                Due Date <span className="text-risk">*</span>
                              </label>
                              <div className="w-[220px]">
                                <CustomDatePicker
                                  value={plan.dueDate}
                                  onChange={(v) => updatePlan(plan.id, { dueDate: v })}
                                  minDate={todayIso}
                                />
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Unified comment box — classification rationale and the cross-persona
            comment channel in one; with the synced activity log below. */}
        {step === 0 && (
        <div className="mb-5">
          <CaseCommentBox
            value={comment}
            onChange={setComment}
            onPostComment={onPostComment}
            label="Comment"
            hint="optional"
            placeholder="Explain your classification rationale — shared with the Auditor and captured in the activity log…"
          />
        </div>
        )}

        {step === 0 && (
        <div className="mt-1">
          <ActivityTimeline entries={reclassDetail?.activityLog ?? []} />
        </div>
        )}
      </ModalShell>
      <AnimatePresence>
        {showLinked && (
          <BulkCasesModal key="classify-linked" cases={linkedCases} onClose={() => setShowLinked(false)} />
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Due Date Revision (Risk Owner request → Auditor approval) ───

function formatDueDate(iso?: string): string {
  if (!iso) return 'Not set';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const REVISION_STATUS_STYLE: Record<'Pending' | 'Approved' | 'Rejected', string> = {
  Pending:  'bg-mitigated-50 text-mitigated-700',
  Approved: 'bg-compliant-50 text-compliant-700',
  Rejected: 'bg-risk-50 text-risk-700',
};

// Shared "previous → revised" visual so both roles see the change identically.
function DueDateDelta({ previous, revised }: { previous?: string; revised?: string }) {
  return (
    <div className="flex items-stretch gap-2.5">
      <div className="flex-1 rounded-[10px] border border-canvas-border bg-[#FAFAFB] p-3">
        <div className="text-[10.5px] font-semibold uppercase tracking-wider text-ink-500 mb-1">Previous Due Date</div>
        <div className="text-[14px] font-semibold text-ink-600 line-through decoration-ink-300">{formatDueDate(previous)}</div>
      </div>
      <div className="flex items-center shrink-0">
        <ArrowRight size={16} className="text-ink-400" />
      </div>
      <div className="flex-1 rounded-[10px] border border-brand-200 bg-brand-50/60 p-3">
        <div className="text-[10.5px] font-semibold uppercase tracking-wider text-brand-700 mb-1">Revised Due Date</div>
        <div className="text-[14px] font-bold text-brand-700">{formatDueDate(revised)}</div>
      </div>
    </div>
  );
}

// Risk Owner — request a revised due date (goes to the auditor for approval).
export function RequestDueDateDrawer({
  exception,
  onClose,
  onSubmit,
}: {
  exception: GrcException;
  onClose: () => void;
  onSubmit: (payload: { revisedDueDate: string; reason: string }) => void;
}) {
  const existing = exception.dueDateRevision;
  const pending = existing?.status === 'Pending';
  const current = exception.dueDate;
  const [revisedDueDate, setRevisedDueDate] = useState('');
  const [reason, setReason] = useState('');
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const canSubmit = !pending && !!revisedDueDate && revisedDueDate !== current && reason.trim().length > 0;

  return (
    <>
      <Overlay onClick={onClose} />
      <ModalShell
        title="Request Due Date Change"
        subtitle="Sends to the auditor for approval"
        context={<ExceptionContext exception={exception} />}
        onClose={onClose}
        footer={
          <>
            <button
              onClick={onClose}
              className="flex-1 h-10 text-[13px] font-medium text-ink-700 bg-canvas-elevated border border-canvas-border rounded-[8px] hover:border-brand-200 transition-colors cursor-pointer"
            >
              {pending ? 'Close' : 'Cancel'}
            </button>
            {!pending && (
              <button
                onClick={() => canSubmit && onSubmit({ revisedDueDate, reason: reason.trim() })}
                disabled={!canSubmit}
                className={`flex-[2] h-10 text-[13px] font-semibold rounded-[8px] transition-colors flex items-center justify-center gap-1.5 ${
                  canSubmit
                    ? 'bg-brand-600 text-white hover:bg-brand-500 cursor-pointer'
                    : 'bg-brand-600/50 text-white/80 cursor-not-allowed'
                }`}
              >
                <CalendarClock size={14} />
                Send Request to Auditor
              </button>
            )}
          </>
        }
      >
        <div className="mb-5">
          <SectionLabel>Management Action Plan</SectionLabel>
          <h3 className="text-[14px] font-semibold text-ink-900 leading-snug">{exception.title}</h3>
        </div>

        {pending && existing ? (
          <div className="rounded-[12px] border border-mitigated/40 bg-mitigated-50/60 p-4 mb-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[12.5px] font-semibold text-mitigated-700">Revision already requested</span>
              <Pill className={REVISION_STATUS_STYLE[existing.status]}>Awaiting auditor approval</Pill>
            </div>
            <DueDateDelta previous={existing.previousDueDate} revised={existing.revisedDueDate} />
            <p className="text-[12.5px] text-ink-700 leading-relaxed mt-3">{existing.reason}</p>
            <p className="text-[11px] text-ink-500 mt-2">
              Requested by {existing.requestedBy} · {formatDueDate(existing.requestedAt.slice(0, 10))}
            </p>
          </div>
        ) : (
          <>
            <div className="mb-5">
              <SectionLabel>Current Due Date</SectionLabel>
              <div className="inline-flex items-center gap-2 h-9 px-3 rounded-[8px] border border-canvas-border bg-[#FAFAFB] text-[13px] font-semibold text-ink-800">
                <Calendar size={13} className="text-ink-500" />
                {formatDueDate(current)}
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-[12.5px] font-semibold text-ink-800 mb-2">
                Revised Due Date <span className="text-risk">*</span>
              </label>
              <div className="w-[220px]">
                <CustomDatePicker value={revisedDueDate} onChange={setRevisedDueDate} minDate={todayIso} />
              </div>
              {revisedDueDate && revisedDueDate === current && (
                <p className="mt-2 text-[11.5px] text-risk-700">Pick a date different from the current due date.</p>
              )}
            </div>

            {revisedDueDate && revisedDueDate !== current && (
              <div className="mb-5">
                <SectionLabel>Preview</SectionLabel>
                <DueDateDelta previous={current} revised={revisedDueDate} />
              </div>
            )}

            <div className="mb-5">
              <label className="block text-[12.5px] font-semibold text-ink-800 mb-2">
                Reason for change <span className="text-risk">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                placeholder="Explain why the action can't be completed by the current due date…"
                className="w-full resize-none p-3 bg-canvas-elevated border border-canvas-border rounded-[8px] text-[13px] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/20"
              />
            </div>
          </>
        )}
      </ModalShell>
    </>
  );
}

// Auditor — review a pending revised-due-date request (approve / reject).
export function ReviewDueDateDrawer({
  exception,
  onClose,
  onDecision,
}: {
  exception: GrcException;
  onClose: () => void;
  onDecision: (decision: 'approve' | 'reject', comment: string) => void;
}) {
  const rev = exception.dueDateRevision;
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null);
  const [comment, setComment] = useState('');

  if (!rev) return null;
  const isPending = rev.status === 'Pending';
  const canSubmit = isPending && decision !== null;

  return (
    <>
      <Overlay onClick={onClose} />
      <ModalShell
        title="Review Due Date Request"
        subtitle={`Requested by ${rev.requestedBy}`}
        context={<ExceptionContext exception={exception} />}
        onClose={onClose}
        footer={
          <>
            <button
              onClick={onClose}
              className="flex-1 h-10 text-[13px] font-medium text-ink-700 bg-canvas-elevated border border-canvas-border rounded-[8px] hover:border-brand-200 transition-colors cursor-pointer"
            >
              {isPending ? 'Cancel' : 'Close'}
            </button>
            {isPending && (
              <button
                onClick={() => canSubmit && decision && onDecision(decision, comment.trim())}
                disabled={!canSubmit}
                className={`flex-[2] h-10 text-[13px] font-semibold rounded-[8px] transition-colors flex items-center justify-center gap-1.5 ${
                  canSubmit
                    ? 'bg-brand-600 text-white hover:bg-brand-500 cursor-pointer'
                    : 'bg-brand-600/50 text-white/80 cursor-not-allowed'
                }`}
              >
                Submit Decision
              </button>
            )}
          </>
        }
      >
        <div className="mb-5">
          <SectionLabel>Management Action Plan</SectionLabel>
          <h3 className="text-[14px] font-semibold text-ink-900 leading-snug">{exception.title}</h3>
        </div>

        <div className="mb-5">
          <SectionLabel>Requested Change</SectionLabel>
          <DueDateDelta previous={rev.previousDueDate} revised={rev.revisedDueDate} />
        </div>

        <div className="mb-5">
          <SectionLabel>Reason from Risk Owner</SectionLabel>
          <div className="px-3 py-2.5 bg-[#FAFAFB] border border-canvas-border rounded-[8px] text-[12.5px] text-ink-800 leading-relaxed">
            {rev.reason}
          </div>
          <p className="text-[11px] text-ink-500 mt-2">
            Requested by {rev.requestedBy} · {formatDueDate(rev.requestedAt.slice(0, 10))}
          </p>
        </div>

        {isPending ? (
          <section className="border border-canvas-border rounded-[12px] p-4">
            <SectionLabel>Auditor Decision</SectionLabel>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                onClick={() => setDecision('approve')}
                className={`h-10 text-[12.5px] font-semibold rounded-[8px] border transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                  decision === 'approve'
                    ? 'bg-compliant text-white border-compliant shadow-[0_2px_8px_rgba(22,163,74,0.25)]'
                    : 'bg-compliant-50 border-compliant text-compliant-700 hover:bg-compliant hover:text-white'
                }`}
              >
                <CheckCircle2 size={14} />
                Approve new date
              </button>
              <button
                onClick={() => setDecision('reject')}
                className={`h-10 text-[12.5px] font-semibold rounded-[8px] border transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                  decision === 'reject'
                    ? 'bg-risk text-white border-risk shadow-[0_2px_8px_rgba(220,38,38,0.25)]'
                    : 'bg-risk-50 border-risk text-risk-700 hover:bg-risk hover:text-white'
                }`}
              >
                <XCircle size={14} />
                Reject
              </button>
            </div>
            {decision === 'approve' && (
              <p className="mb-4 text-[12px] text-compliant-700 leading-snug">
                On approve, the action plan's due date moves to <span className="font-semibold">{formatDueDate(rev.revisedDueDate)}</span>.
              </p>
            )}
            {decision === 'reject' && (
              <p className="mb-4 text-[12px] text-risk-700 leading-snug">
                On reject, the due date stays at <span className="font-semibold">{formatDueDate(rev.previousDueDate)}</span> and the request returns to the Risk Owner.
              </p>
            )}
            <div>
              <label className="block text-[12.5px] font-medium text-ink-800 mb-2">Comment</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder="Add a note for the Risk Owner (optional)…"
                className="w-full resize-none p-3 bg-canvas-elevated border border-canvas-border rounded-[8px] text-[13px] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/20"
              />
            </div>
          </section>
        ) : (
          <div className="rounded-[12px] border border-canvas-border p-4">
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] font-semibold text-ink-800">Decision</span>
              <Pill className={REVISION_STATUS_STYLE[rev.status]}>{rev.status}</Pill>
            </div>
            {rev.decisionComment && (
              <p className="text-[12.5px] text-ink-700 leading-relaxed mt-3">{rev.decisionComment}</p>
            )}
            {rev.decidedBy && (
              <p className="text-[11px] text-ink-500 mt-2">
                {rev.status} by {rev.decidedBy}{rev.decidedAt ? ` · ${formatDueDate(rev.decidedAt.slice(0, 10))}` : ''}
              </p>
            )}
          </div>
        )}
      </ModalShell>
    </>
  );
}

// Risk Owner — request one revised due date across several selected cases.
export function BulkRequestDueDateDrawer({
  exceptions,
  onClose,
  onSubmit,
}: {
  exceptions: GrcException[];
  onClose: () => void;
  onSubmit: (payload: { revisedDueDate: string; reason: string }) => void;
}) {
  const [revisedDueDate, setRevisedDueDate] = useState('');
  const [reason, setReason] = useState('');
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const canSubmit = !!revisedDueDate && reason.trim().length > 0;
  const n = exceptions.length;

  return (
    <>
      <Overlay onClick={onClose} />
      <ModalShell
        title="Request Due Date Change"
        size="lg"
        context={<ContextChip label="Applies to">{n} selected case{n === 1 ? '' : 's'}</ContextChip>}
        subtitle="Sends to the auditor for approval"
        onClose={onClose}
        footer={
          <>
            <button
              onClick={onClose}
              className="flex-1 h-10 text-[13px] font-medium text-ink-700 bg-canvas-elevated border border-canvas-border rounded-[8px] hover:border-brand-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => canSubmit && onSubmit({ revisedDueDate, reason: reason.trim() })}
              disabled={!canSubmit}
              className={`flex-[2] h-10 text-[13px] font-semibold rounded-[8px] transition-colors flex items-center justify-center gap-1.5 ${
                canSubmit ? 'bg-brand-600 text-white hover:bg-brand-500 cursor-pointer' : 'bg-brand-600/50 text-white/80 cursor-not-allowed'
              }`}
            >
              <CalendarClock size={14} />
              Send {n} Request{n === 1 ? '' : 's'}
            </button>
          </>
        }
      >
        <div className="mb-5">
          <SectionLabel>Selected Cases</SectionLabel>
          <div className="border border-canvas-border rounded-[10px] divide-y divide-canvas-border max-h-[200px] overflow-y-auto">
            {exceptions.map(e => (
              <div key={e.id} className="flex items-center justify-between px-3 py-2.5">
                <span className="text-[12.5px] font-mono font-medium text-brand-700">{e.id}</span>
                <span className="text-[12px] text-ink-600 tabular-nums">Current: {formatDueDate(e.dueDate)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-5">
          <label className="block text-[12.5px] font-semibold text-ink-800 mb-2">
            New Revised Due Date <span className="text-risk">*</span>
          </label>
          <div className="w-[220px]">
            <CustomDatePicker value={revisedDueDate} onChange={setRevisedDueDate} minDate={todayIso} />
          </div>
          <p className="mt-2 text-[11.5px] text-ink-500">Applied to all {n} selected case{n === 1 ? '' : 's'}.</p>
        </div>

        <div className="mb-5">
          <label className="block text-[12.5px] font-semibold text-ink-800 mb-2">
            Reason for change <span className="text-risk">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            placeholder="Explain why these actions can't be completed by their current due dates…"
            className="w-full resize-none p-3 bg-canvas-elevated border border-canvas-border rounded-[8px] text-[13px] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/20"
          />
        </div>
      </ModalShell>
    </>
  );
}

// Auditor — approve / reject several pending revised-due-date requests at once.
export function BulkReviewDueDateDrawer({
  exceptions,
  onClose,
  onDecision,
}: {
  exceptions: GrcException[];
  onClose: () => void;
  onDecision: (decision: 'approve' | 'reject', comment: string) => void;
}) {
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null);
  const [comment, setComment] = useState('');
  const canSubmit = decision !== null;
  const n = exceptions.length;

  return (
    <>
      <Overlay onClick={onClose} />
      <ModalShell
        title="Review Due Date Requests"
        size="lg"
        context={<ContextChip label="Pending">{n} request{n === 1 ? '' : 's'}</ContextChip>}
        onClose={onClose}
        footer={
          <>
            <button
              onClick={onClose}
              className="flex-1 h-10 text-[13px] font-medium text-ink-700 bg-canvas-elevated border border-canvas-border rounded-[8px] hover:border-brand-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => canSubmit && decision && onDecision(decision, comment.trim())}
              disabled={!canSubmit}
              className={`flex-[2] h-10 text-[13px] font-semibold rounded-[8px] transition-colors flex items-center justify-center gap-1.5 ${
                canSubmit ? 'bg-brand-600 text-white hover:bg-brand-500 cursor-pointer' : 'bg-brand-600/50 text-white/80 cursor-not-allowed'
              }`}
            >
              Submit Decision
            </button>
          </>
        }
      >
        <div className="mb-5">
          <SectionLabel>Pending Requests</SectionLabel>
          <div className="border border-canvas-border rounded-[10px] divide-y divide-canvas-border max-h-[260px] overflow-y-auto">
            {exceptions.map(e => (
              <div key={e.id} className="px-3 py-2.5">
                <div className="text-[12.5px] font-mono font-medium text-brand-700 mb-1">{e.id}</div>
                <div className="flex items-center gap-2 text-[12px]">
                  <span className="text-ink-500 line-through decoration-ink-300 tabular-nums">{formatDueDate(e.dueDateRevision?.previousDueDate)}</span>
                  <ArrowRight size={12} className="text-ink-400" />
                  <span className="font-semibold text-brand-700 tabular-nums">{formatDueDate(e.dueDateRevision?.revisedDueDate)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <section className="border border-canvas-border rounded-[12px] p-4">
          <SectionLabel>Decision · applies to all {n}</SectionLabel>
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button
              onClick={() => setDecision('approve')}
              className={`h-10 text-[12.5px] font-semibold rounded-[8px] border transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                decision === 'approve'
                  ? 'bg-compliant text-white border-compliant shadow-[0_2px_8px_rgba(22,163,74,0.25)]'
                  : 'bg-compliant-50 border-compliant text-compliant-700 hover:bg-compliant hover:text-white'
              }`}
            >
              <CheckCircle2 size={14} />
              Approve all
            </button>
            <button
              onClick={() => setDecision('reject')}
              className={`h-10 text-[12.5px] font-semibold rounded-[8px] border transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                decision === 'reject'
                  ? 'bg-risk text-white border-risk shadow-[0_2px_8px_rgba(220,38,38,0.25)]'
                  : 'bg-risk-50 border-risk text-risk-700 hover:bg-risk hover:text-white'
              }`}
            >
              <XCircle size={14} />
              Reject all
            </button>
          </div>
          <div>
            <label className="block text-[12.5px] font-medium text-ink-800 mb-2">Comment</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Add a note for the Risk Owner (optional)…"
              className="w-full resize-none p-3 bg-canvas-elevated border border-canvas-border rounded-[8px] text-[13px] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/20"
            />
          </div>
        </section>
      </ModalShell>
    </>
  );
}

// ─── Management Action Plan viewer (read-only) ───
// Opened from the bulk scope chooser so the Auditor can inspect the plan a Risk
// Owner submitted for any linked case — including ones they've deselected from
// the review — before deciding. Reads the case's submitted plan(s) from the
// shared case-detail store; falls back to the legacy single-plan shape.
function ViewActionPlanModal({
  exceptionId,
  classification,
  actionableId,
  onClose,
}: {
  exceptionId: string;
  classification: GrcExceptionClassification;
  actionableId?: string;
  onClose: () => void;
}) {
  const detail = GRC_CASE_DETAILS[exceptionId];
  const plans = detail?.actionPlans && detail.actionPlans.length > 0
    ? detail.actionPlans
    : detail?.actionTitle
      ? [{ name: detail.actionTitle, details: detail.actionDescription, dueDate: '' }]
      : [];
  return (
    <>
      <div className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] z-[70]" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 8 }}
        transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] max-w-[92vw] bg-canvas-elevated rounded-[16px] shadow-xl border border-canvas-border z-[71] flex flex-col max-h-[80vh]"
        role="dialog"
        aria-label="Management Action Plan"
      >
        <header className="shrink-0 px-6 py-5 flex items-start justify-between gap-4 border-b border-canvas-border">
          <div className="min-w-0">
            <h2 className="font-display text-[18px] font-semibold text-ink-900 tracking-tight">Management Action Plan</h2>
            <p className="text-[12.5px] text-ink-500 mt-0.5 flex items-center gap-2">
              <span className="font-mono font-medium text-brand-700">{exceptionId}</span>
              {actionableId && (
                <>
                  <span className="text-ink-300">·</span>
                  <span className="inline-flex items-center gap-1 font-mono text-brand-700"><Hash size={11} />{actionableId}</span>
                </>
              )}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer shrink-0" aria-label="Close">
            <X size={16} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="mb-4">
            <SectionLabel>Classification</SectionLabel>
            <Pill className={CLASSIFICATION_STYLE[classification]}>{classification}</Pill>
          </div>
          <SectionLabel>{plans.length > 1 ? `Plans submitted by Risk Owner · ${plans.length}` : 'Plan submitted by Risk Owner'}</SectionLabel>
          {plans.length > 0 ? (
            <div className="space-y-3">
              {plans.map((p, i) => (
                <div key={i} className="border border-canvas-border rounded-[12px] p-4">
                  <h3 className="text-[14px] font-semibold text-ink-900 mb-1.5 leading-snug">
                    <FileText size={14} className="inline mr-1.5 text-ink-500 -mt-0.5" />
                    {p.name || `Management Action Plan ${i + 1}`}
                  </h3>
                  {p.dueDate && (
                    <div className="inline-flex items-center gap-1.5 text-[12px] text-brand-700 bg-brand-50 rounded-full px-2.5 h-6 mb-2">
                      <Calendar size={11} /> Due {fmtPlanDate(p.dueDate)}
                    </div>
                  )}
                  {p.details && <p className="text-[12.5px] text-ink-700 leading-relaxed">{p.details}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[12.5px] text-ink-500">No management action plan has been submitted for this case yet.</p>
          )}
        </div>
      </motion.div>
    </>
  );
}

// ─── Grouped-cases viewer ───
// A compact read-only list of the cases linked in a bulk action — opened from the
// "View grouped cases" link in the Mark Action Complete drawer so the Risk Owner
// can see exactly which exceptions the action taken is recorded against.
export interface LinkedCaseRow {
  id: string;
  title: string;
  classification: GrcExceptionClassification;
  statusLabel: string;
}

function BulkCasesModal({
  groupId,
  cases,
  onClose,
}: {
  groupId?: string;
  cases: LinkedCaseRow[];
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] z-[70]" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 8 }}
        transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[560px] max-w-[92vw] bg-canvas-elevated rounded-[16px] shadow-xl border border-canvas-border z-[71] flex flex-col max-h-[80vh]"
        role="dialog"
        aria-label="Grouped cases"
      >
        <header className="shrink-0 px-6 py-5 flex items-start justify-between gap-4 border-b border-canvas-border">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 h-5 px-2 text-[10.5px] font-semibold bg-brand-50 text-brand-700 rounded-full"><LinkIcon size={11} /> Bulk</span>
              <h2 className="font-display text-[18px] font-semibold text-ink-900 tracking-tight">Grouped Cases</h2>
            </div>
            <p className="text-[12.5px] text-ink-500 leading-snug">
              {groupId && <span className="font-mono tabular-nums">ID: {groupId} · </span>}{cases.length} linked cases · the action taken applies to all
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer shrink-0" aria-label="Close">
            <X size={16} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="border border-canvas-border rounded-[12px] divide-y divide-canvas-border overflow-hidden">
            {cases.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                <span className="font-mono font-medium text-brand-700 text-[12.5px] shrink-0">{c.id}</span>
                <span className="flex-1 min-w-0 truncate text-[12px] text-ink-600">{c.title}</span>
                <Pill className={CLASSIFICATION_STYLE[c.classification]}>{c.classification}</Pill>
                <Pill className="bg-mitigated-50 text-mitigated-700">{c.statusLabel}</Pill>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ─── Bulk Review (Auditor) ───
// Lets the Auditor review many cases at once. Each case keeps its own stage —
// plan review, completed-action review, or non-actionable disposition — so the
// Auditor sees the full management action plan / action taken step by step and
// decides per case, with stage-grouped shortcuts to accept everything at once.
export interface BulkReviewSubmission {
  id: string;
  stage: AuditorReviewStage;
  decision: 'approve' | 'reject';
  implementation: 'Implemented' | 'Partially Implemented' | null;
  comment: string;
}

interface BulkReviewItemState {
  decision: 'approve' | 'reject' | null;
  implementation: 'Implemented' | 'Partially Implemented' | null;
  comment: string;
}

const STAGE_META: Record<AuditorReviewStage, { label: string; approve: string; reject: string; bulk: string }> = {
  plan:           { label: 'Action Plan Review',    approve: 'Accept Plan', reject: 'Reject Plan', bulk: 'Accept all plans' },
  completion:     { label: 'Action Taken Review',   approve: 'Approve',     reject: 'Reject',      bulk: 'Approve all action taken' },
  classification: { label: 'Classification Review', approve: 'Approve',     reject: 'Reject',      bulk: 'Approve all' },
};

const STAGE_BADGE: Record<AuditorReviewStage, string> = {
  plan:           'bg-brand-50 text-brand-700',
  completion:     'bg-mitigated-50 text-mitigated-700',
  classification: 'bg-[#EEEEF1] text-ink-600',
};

// Auto-typed, editable message that reflects the chosen decision — same wording
// the single Review drawer suggests, so the captured comments stay consistent.
function suggestReviewComment(stage: AuditorReviewStage, decision: 'approve' | 'reject', implementation: 'Implemented' | 'Partially Implemented' | null): string {
  if (stage === 'plan') {
    return decision === 'approve'
      ? 'Management action plan is well-scoped and appropriate — accepted for implementation.'
      : 'Management action plan needs revision before it can be accepted. Please refine and resubmit.';
  }
  if (stage === 'completion') {
    if (decision === 'reject') return 'A discrepancy was identified in the completed action — reopening for the Risk Owner to address.';
    if (implementation === 'Partially Implemented') return 'Action is partially implemented — the verified portion is accepted; remaining items to be closed by the Risk Owner.';
    return 'Action is fully implemented in the system and verified against the evidence provided.';
  }
  return decision === 'approve'
    ? 'Classification reviewed and approved — no action plan required.'
    : 'Classification not accepted — reopening for the Risk Owner to re-assess.';
}

export function BulkReviewDrawer({
  cases,
  skipped,
  onClose,
  onSubmit,
}: {
  cases: GrcException[];
  skipped: { awaitingRiskOwner: number; alreadyReviewed: number };
  onClose: () => void;
  onSubmit: (subs: BulkReviewSubmission[]) => void;
}) {
  // ── Group MAP-wise ──────────────────────────────────────────────────────
  // Actionable cases group by their shared Actionable ID (one management action
  // plan → one decision). Non-actionable cases (Business as Usual / False
  // Positive) have NO action plan, so they group by their bulk action (or stand
  // alone) and are reviewed as a disposition. Stage is part of the key, so every
  // group sits at exactly one review stage.
  const groups = useMemo(() => {
    const m = new Map<string, GrcException[]>();
    cases.forEach(c => {
      const stage = auditorReviewStage(c) ?? 'plan';
      const key = `${c.actionableId ?? c.bulkId ?? c.id}::${stage}`;
      const arr = m.get(key);
      if (arr) arr.push(c); else m.set(key, [c]);
    });
    return Array.from(m.entries()).map(([key, cs]) => {
      const rep = cs[0];
      const stage = auditorReviewStage(rep) ?? 'plan';
      const detail = GRC_CASE_DETAILS[rep.id];
      const plans = detail?.actionPlans && detail.actionPlans.length > 0
        ? detail.actionPlans
        : detail?.actionTitle ? [{ name: detail.actionTitle, details: detail.actionDescription, dueDate: '' }] : [];
      return {
        key, stage,
        actionable: stage !== 'classification',
        actionableId: rep.actionableId,
        classification: rep.classification,
        cases: cs,
        plans,
        completion: detail?.completion,
      };
    });
  }, [cases]);
  type GroupT = typeof groups[number];

  const [decisions, setDecisions] = useState<Record<string, BulkReviewItemState>>(
    () => Object.fromEntries(groups.map(g => [g.key, { decision: null, implementation: null, comment: '' }])),
  );
  const [expanded, setExpanded] = useState<string>(groups[0]?.key ?? '');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [linkedModalKey, setLinkedModalKey] = useState<string | null>(null);
  const [stepIdx, setStepIdx] = useState(0); // 0 = Decide, 1 = Confirm & Submit
  // Per-group case scope — which linked exceptions the decision applies to.
  // Defaults to all; the "View linked exceptions" picker can narrow it (apply to
  // all / only this / a subset).
  const [scopes, setScopes] = useState<Record<string, string[]>>({});
  const scopeIds = (g: GroupT): string[] => scopes[g.key] ?? g.cases.map(c => c.id);
  const scopeCount = (g: GroupT): number => scopeIds(g).length;

  const setGroup = (key: string, patch: Partial<BulkReviewItemState>) =>
    setDecisions(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }));

  // Choosing/changing a decision auto-fills the comment with an editable suggestion
  // (only while empty), so completion comments are never left blank.
  const choose = (g: GroupT, decision: 'approve' | 'reject') => {
    const cur = decisions[g.key];
    const implementation = g.stage === 'completion' && decision === 'approve' ? (cur.implementation ?? 'Implemented') : null;
    const suggested = suggestReviewComment(g.stage, decision, implementation);
    setGroup(g.key, { decision, implementation, comment: cur.comment.trim() ? cur.comment : suggested });
  };
  const setImpl = (g: GroupT, implementation: 'Implemented' | 'Partially Implemented') => {
    const cur = decisions[g.key];
    const suggested = suggestReviewComment('completion', 'approve', implementation);
    const prevSuggested = suggestReviewComment('completion', 'approve', cur.implementation);
    setGroup(g.key, { implementation, comment: !cur.comment.trim() || cur.comment === prevSuggested ? suggested : cur.comment });
  };

  type Validity = 'pending' | 'invalid' | 'valid';
  const validity = (g: GroupT): Validity => {
    const st = decisions[g.key];
    if (!st?.decision) return 'pending';
    if (g.stage === 'completion') {
      if (st.decision === 'approve' && !st.implementation) return 'invalid';
      if (!st.comment.trim()) return 'invalid'; // completion comments are captured in the ATR
    }
    return 'valid';
  };

  const decidedValid = groups.filter(g => validity(g) === 'valid');
  const decidedInvalid = groups.filter(g => validity(g) === 'invalid');
  const pendingCount = groups.filter(g => validity(g) === 'pending').length;
  const canSubmit = decidedValid.length > 0 && decidedInvalid.length === 0;
  const reviewedCaseCount = decidedValid.reduce((n, g) => n + scopeCount(g), 0);

  // Checkbox selection → bulk Accept / Reject of the chosen groups (Select all
  // covers every group, so "Reject all" = Select all + Reject).
  const allKeys = groups.map(g => g.key);
  const allSelected = selected.size === allKeys.length && allKeys.length > 0;
  const toggleSelectAll = () => setSelected(allSelected ? new Set() : new Set(allKeys));
  const toggleSelect = (key: string) => setSelected(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  const applyToSelected = (decision: 'approve' | 'reject') => {
    if (selected.size === 0) return;
    setDecisions(prev => {
      const next = { ...prev };
      groups.forEach(g => {
        if (!selected.has(g.key)) return;
        const implementation = g.stage === 'completion' && decision === 'approve' ? 'Implemented' as const : null;
        next[g.key] = { decision, implementation, comment: suggestReviewComment(g.stage, decision, implementation) };
      });
      return next;
    });
    setSelected(new Set());
  };

  const submit = () => {
    if (!canSubmit) return;
    const subs: BulkReviewSubmission[] = [];
    decidedValid.forEach(g => {
      const st = decisions[g.key];
      const ids = new Set(scopeIds(g));
      g.cases.filter(c => ids.has(c.id)).forEach(c => subs.push({ id: c.id, stage: g.stage, decision: st.decision as 'approve' | 'reject', implementation: st.implementation, comment: st.comment.trim() }));
    });
    onSubmit(subs);
  };

  const skippedTotal = skipped.awaitingRiskOwner + skipped.alreadyReviewed;
  const linkedModalGroup = linkedModalKey ? groups.find(g => g.key === linkedModalKey) : null;
  // Render order: group by review stage so the stage name shows once per section.
  const STAGE_ORDER: AuditorReviewStage[] = ['plan', 'completion', 'classification'];
  const stagesInOrder = STAGE_ORDER.filter(s => groups.some(g => g.stage === s));

  return (
    <>
      <Overlay onClick={onClose} />
      <ModalShell
        title="Bulk Review"
        subtitle={`${cases.length} case${cases.length === 1 ? '' : 's'} ready — grouped by action plan`}
        size="xl"
        step={{ current: stepIdx + 1, total: 2, label: stepIdx === 0 ? 'Decide' : 'Confirm & Submit' }}
        context={
          <>
            <ContextChip label="Cases">{cases.length}</ContextChip>
            <ContextChip label="Action plans">{groups.length}</ContextChip>
            <ContextChip label="Decided"><span className="text-compliant-700">{decidedValid.length}</span> / {groups.length}</ContextChip>
          </>
        }
        onClose={onClose}
        footer={
          <>
            <button
              onClick={onClose}
              className="h-10 px-5 text-[13px] font-medium text-ink-700 bg-canvas-elevated border border-canvas-border rounded-[8px] hover:border-brand-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <div className="flex-1" />
            {stepIdx === 1 && (
              <button
                onClick={() => setStepIdx(0)}
                className="h-10 px-5 text-[13px] font-medium text-ink-700 bg-canvas-elevated border border-canvas-border rounded-[8px] hover:border-brand-200 transition-colors cursor-pointer"
              >
                Back
              </button>
            )}
            {stepIdx === 0 ? (
              <button
                onClick={() => canSubmit && setStepIdx(1)}
                disabled={!canSubmit}
                title={decidedInvalid.length > 0 ? 'Some decided plans need an implementation outcome and a comment' : undefined}
                className={`h-10 px-5 text-[13px] font-semibold rounded-[8px] transition-colors flex items-center justify-center gap-1.5 ${
                  canSubmit ? 'bg-brand-600 text-white hover:bg-brand-500 cursor-pointer' : 'bg-brand-600/50 text-white/80 cursor-not-allowed'
                }`}
              >
                Review {decidedValid.length} decision{decidedValid.length === 1 ? '' : 's'} <ArrowRight size={14} />
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={!canSubmit}
                className={`h-10 px-5 text-[13px] font-semibold rounded-[8px] transition-colors flex items-center justify-center gap-1.5 ${
                  canSubmit ? 'bg-brand-600 text-white hover:bg-brand-500 cursor-pointer' : 'bg-brand-600/50 text-white/80 cursor-not-allowed'
                }`}
              >
                <ClipboardList size={14} />
                Submit {decidedValid.length} decision{decidedValid.length === 1 ? '' : 's'}{reviewedCaseCount > decidedValid.length ? ` · ${reviewedCaseCount} cases` : ''}
              </button>
            )}
          </>
        }
      >
        {stepIdx === 0 && (<>
        {/* Progress + what's outstanding */}
        <div className="mb-4 rounded-[12px] border border-canvas-border p-3.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12.5px] font-semibold text-ink-800">Reviewed {decidedValid.length} of {groups.length} action plan{groups.length === 1 ? '' : 's'}</span>
            <span className="text-[11.5px] text-ink-500 tabular-nums">{pendingCount} pending{decidedInvalid.length > 0 ? ` · ${decidedInvalid.length} need a comment` : ''}</span>
          </div>
          <div className="h-1.5 rounded-full bg-[#EEEEF1] overflow-hidden">
            <div className="h-full bg-brand-600 transition-all" style={{ width: `${Math.round((decidedValid.length / Math.max(1, groups.length)) * 100)}%` }} />
          </div>
          <p className="text-[11.5px] text-ink-500 leading-snug mt-2.5">
            Cases are grouped by their management action plan — one decision applies to every linked case. Expand a plan to review it step by step, or tick plans and use Accept / Reject below.
          </p>
        </div>

        {/* Skipped, non-reviewable cases */}
        {skippedTotal > 0 && (
          <div className="mb-4 rounded-[12px] border border-mitigated/40 bg-mitigated-50/50 p-3.5">
            <div className="flex items-center gap-2 text-[12.5px] font-semibold text-mitigated-700 mb-1.5">
              <ShieldCheck size={13} />
              {skippedTotal} case{skippedTotal === 1 ? '' : 's'} not included — nothing to review yet
            </div>
            <ul className="space-y-1.5">
              {skipped.awaitingRiskOwner > 0 && (
                <li className="flex items-center gap-2 text-[12px] text-ink-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-mitigated shrink-0" />
                  <span className="font-semibold tabular-nums">{skipped.awaitingRiskOwner}</span> awaiting the Risk Owner (unclassified, in progress, or reopened)
                </li>
              )}
              {skipped.alreadyReviewed > 0 && (
                <li className="flex items-center gap-2 text-[12px] text-ink-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-compliant shrink-0" />
                  <span className="font-semibold tabular-nums">{skipped.alreadyReviewed}</span> already reviewed
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Selection toolbar — tick plans, then Accept / Reject. Select all + Reject = Reject all. */}
        <div className="mb-3 flex items-center justify-between gap-3 rounded-[10px] border border-canvas-border bg-[#FAFAFB] px-3 py-2">
          <button
            type="button"
            onClick={toggleSelectAll}
            className="inline-flex items-center gap-2 text-[12px] font-medium text-ink-700 cursor-pointer"
          >
            <span className={`w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center shrink-0 ${
              allSelected ? 'bg-brand-600 border-brand-600 text-white' : selected.size > 0 ? 'bg-brand-50 border-brand-300 text-brand-600' : 'bg-canvas-elevated border-canvas-border'
            }`}>
              {allSelected ? <Check size={12} strokeWidth={3} /> : selected.size > 0 ? <span className="w-2 h-0.5 bg-brand-600 rounded" /> : null}
            </span>
            Select all{selected.size > 0 ? ` · ${selected.size} selected` : ''}
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => applyToSelected('approve')}
              disabled={selected.size === 0}
              className={`inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-semibold rounded-[8px] border transition-colors ${
                selected.size > 0 ? 'bg-compliant-50 border-compliant text-compliant-700 hover:bg-compliant hover:text-white cursor-pointer' : 'bg-canvas-elevated border-canvas-border text-ink-400 cursor-not-allowed'
              }`}
            >
              <CheckCircle2 size={13} /> Accept{selected.size > 0 ? ` (${selected.size})` : ''}
            </button>
            <button
              type="button"
              onClick={() => applyToSelected('reject')}
              disabled={selected.size === 0}
              className={`inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-semibold rounded-[8px] border transition-colors ${
                selected.size > 0 ? 'bg-risk-50 border-risk text-risk-700 hover:bg-risk hover:text-white cursor-pointer' : 'bg-canvas-elevated border-canvas-border text-ink-400 cursor-not-allowed'
              }`}
            >
              <XCircle size={13} /> Reject{selected.size > 0 ? ` (${selected.size})` : ''}
            </button>
          </div>
        </div>
        <p className="text-[11px] text-ink-400 mb-3 -mt-1">Tip: tick <span className="font-medium text-ink-500">Select all</span> then Reject to reject every plan. Bulk actions add a suggested comment you can still edit.</p>

        {/* Per-plan groups */}
        <SectionLabel>Management Action Plans</SectionLabel>
        {stagesInOrder.map(stage => {
          const stageGroups = groups.filter(g => g.stage === stage);
          return (
          <div key={stage} className="mb-4">
            {/* Stage name shown once per section — not on every plan */}
            <div className="flex items-center gap-2 mb-2">
              <span className={`inline-flex items-center h-5 px-2 text-[10.5px] font-semibold rounded-full ${STAGE_BADGE[stage]}`}>{STAGE_META[stage].label}</span>
              <span className="text-[11px] text-ink-400 tabular-nums">{stageGroups.length} plan{stageGroups.length === 1 ? '' : 's'}</span>
            </div>
            <div className="space-y-2.5">
          {stageGroups.map((g) => {
            const st = decisions[g.key];
            const v = validity(g);
            const open = expanded === g.key;
            const isSelected = selected.has(g.key);
            const linkedCount = g.cases.length;
            const headPlanName = g.plans[0]?.name;
            const statusPill = v === 'valid'
              ? (st.decision === 'approve'
                  ? <Pill className="bg-compliant-50 text-compliant-700">{g.stage === 'plan' ? 'Plan accepted' : 'Approved'}</Pill>
                  : <Pill className="bg-risk-50 text-risk-700">Rejected</Pill>)
              : v === 'invalid'
                ? <Pill className="bg-mitigated-50 text-mitigated-700">Needs a comment</Pill>
                : <Pill className="bg-[#EEEEF1] text-ink-500">Pending</Pill>;

            return (
              <div key={g.key} className={`border rounded-[12px] overflow-hidden ${open ? 'border-brand-200' : 'border-canvas-border'}`}>
                {/* Group header — checkbox + plan identity */}
                <div className={`flex items-center gap-2.5 px-3 py-3 ${open ? 'bg-brand-50/40' : ''}`}>
                  <button
                    type="button"
                    onClick={() => toggleSelect(g.key)}
                    aria-label={`Select ${g.actionableId ?? g.cases[0].id}`}
                    className={`w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center shrink-0 cursor-pointer ${
                      isSelected ? 'bg-brand-600 border-brand-600 text-white' : 'bg-canvas-elevated border-canvas-border'
                    }`}
                  >
                    {isSelected && <Check size={12} strokeWidth={3} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpanded(open ? '' : g.key)}
                    className="flex items-center gap-2.5 flex-1 min-w-0 text-left cursor-pointer"
                  >
                    <ChevronDown size={15} className={`shrink-0 text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {g.actionable && g.actionableId
                          ? <span className="inline-flex items-center gap-0.5 font-mono font-semibold text-brand-700 text-[12.5px]"><Hash size={11} />{g.actionableId}</span>
                          : <Pill className={CLASSIFICATION_STYLE[g.classification]}>{g.classification}</Pill>}
                      </div>
                      <div className="text-[12px] text-ink-600 truncate mt-0.5">
                        {g.actionable ? (headPlanName || 'Management action plan') : 'No action plan required'}
                      </div>
                    </div>
                  </button>
                  {statusPill}
                </div>

                {/* Linked exceptions — scope picker (apply to all / only this / subset) */}
                {linkedCount > 1 && (
                  <div className="flex items-center gap-2 px-3 pb-2.5 -mt-1 pl-[42px]">
                    <span className="text-[11.5px] text-ink-500">
                      {scopeCount(g) < linkedCount
                        ? <>Applies to <span className="font-semibold text-ink-700">{scopeCount(g)}</span> of {linkedCount} linked exceptions</>
                        : <>{linkedCount} linked exceptions</>}
                    </span>
                    <button
                      type="button"
                      onClick={() => setLinkedModalKey(g.key)}
                      className="inline-flex items-center gap-1 text-[11.5px] font-medium text-brand-700 hover:text-brand-600 cursor-pointer"
                    >
                      Choose linked exceptions
                      <ExternalLink size={11} />
                    </button>
                  </div>
                )}

                {/* Body */}
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }} className="overflow-hidden">
                      <div className="px-4 pb-4 pt-1 border-t border-canvas-border space-y-4">
                        {/* Management action plan — step by step (or the no-plan note) */}
                        {g.actionable ? (
                          <div>
                            <SectionLabel>Management Action Plan{g.plans.length > 1 ? ` · ${g.plans.length}` : ''}</SectionLabel>
                            {g.plans.length > 0 ? (
                              <ol className="space-y-2.5">
                                {g.plans.map((p, i) => (
                                  <li key={i} className="flex gap-2.5">
                                    <span className="shrink-0 w-5 h-5 rounded-full bg-brand-50 text-brand-700 text-[11px] font-bold flex items-center justify-center tabular-nums">{i + 1}</span>
                                    <div className="min-w-0">
                                      <div className="text-[13px] font-semibold text-ink-900 leading-snug">{p.name || `Management Action Plan ${i + 1}`}</div>
                                      {p.dueDate && (
                                        <span className="inline-flex items-center gap-1 text-[11.5px] text-brand-700 bg-brand-50 rounded-full px-2 h-5 mt-1">
                                          <Calendar size={10} /> Due {fmtPlanDate(p.dueDate)}
                                        </span>
                                      )}
                                      {p.details && <p className="text-[12px] text-ink-700 leading-relaxed mt-1">{p.details}</p>}
                                    </div>
                                  </li>
                                ))}
                              </ol>
                            ) : (
                              <p className="text-[12px] text-ink-500">No management action plan recorded.</p>
                            )}
                          </div>
                        ) : (
                          <div className="rounded-[10px] border border-canvas-border bg-[#FAFAFB] p-3">
                            <SectionLabel>No Action Plan Required</SectionLabel>
                            <p className="text-[12px] text-ink-600 leading-relaxed">
                              Classified as <span className="font-medium text-ink-800">{g.classification}</span> — no management action plan is required. Confirm the disposition: <span className="font-medium">Approve</span> to close, or <span className="font-medium">Reject</span> to send it back to the Risk Owner to re-assess.
                            </p>
                          </div>
                        )}

                        {/* Action taken — completion review only */}
                        {g.stage === 'completion' && g.completion && (
                          <div className="rounded-[10px] border border-compliant/30 bg-compliant-50/30 p-3">
                            <SectionLabel>Action Taken — Risk Owner</SectionLabel>
                            {g.completion.selfAssessment && (
                              <div className="mb-2">
                                <span className="text-[11px] text-ink-500 mr-1.5">Risk Owner reports:</span>
                                <Pill className={g.completion.selfAssessment === 'Implemented' ? 'bg-compliant-50 text-compliant-700 border border-compliant/40' : 'bg-mitigated-50 text-mitigated-700 border border-mitigated/40'}>
                                  {g.completion.selfAssessment}
                                </Pill>
                              </div>
                            )}
                            <p className="text-[12px] text-ink-700 leading-relaxed">{g.completion.note}</p>
                            {g.completion.evidence.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {g.completion.evidence.map((ev, i) => (
                                  <span key={i} className="inline-flex items-center gap-1.5 h-6 px-2 bg-white border border-canvas-border rounded-full text-[11px] text-ink-700">
                                    <Paperclip size={10} className="text-brand-600" /> {ev.name}
                                  </span>
                                ))}
                              </div>
                            )}
                            {g.completion.completedAt && <p className="text-[11px] text-ink-400 mt-1.5">Marked complete on {g.completion.completedAt}</p>}
                            {scopeCount(g) > 1 && <p className="text-[11px] text-ink-400 mt-1.5">Applies to {scopeCount(g)} linked case{scopeCount(g) === 1 ? '' : 's'}.</p>}
                          </div>
                        )}

                        {/* Decision */}
                        <div>
                          <label className="block text-[12px] font-semibold text-ink-800 mb-2">Your decision{scopeCount(g) > 1 ? ` · applies to ${scopeCount(g)} cases` : ''}</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => choose(g, 'approve')} className={`h-9 text-[12px] font-semibold rounded-[8px] border transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${st.decision === 'approve' ? 'bg-compliant text-white border-compliant' : 'bg-compliant-50 border-compliant text-compliant-700 hover:bg-compliant hover:text-white'}`}>
                              <CheckCircle2 size={13} /> {STAGE_META[g.stage].approve}
                            </button>
                            <button onClick={() => choose(g, 'reject')} className={`h-9 text-[12px] font-semibold rounded-[8px] border transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${st.decision === 'reject' ? 'bg-risk text-white border-risk' : 'bg-risk-50 border-risk text-risk-700 hover:bg-risk hover:text-white'}`}>
                              <XCircle size={13} /> {STAGE_META[g.stage].reject}
                            </button>
                          </div>

                          {g.stage === 'completion' && st.decision === 'approve' && (
                            <div className="mt-2.5">
                              <label className="block text-[11.5px] font-medium text-ink-700 mb-1.5">Implementation status <span className="text-risk">*</span></label>
                              <div className="grid grid-cols-2 gap-2">
                                {(['Implemented', 'Partially Implemented'] as const).map(s => (
                                  <button key={s} onClick={() => setImpl(g, s)} className={`h-9 text-[12px] font-medium rounded-[8px] border transition-colors cursor-pointer ${st.implementation === s ? 'bg-brand-50 border-brand-600 text-brand-700' : 'bg-canvas-elevated border-canvas-border text-ink-700 hover:border-brand-200'}`}>
                                    {s}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {st.decision && (
                            <div className="mt-2.5">
                              <label className="block text-[11.5px] font-medium text-ink-700 mb-1.5">Comment {g.stage === 'completion' && <span className="text-risk">*</span>}</label>
                              <textarea value={st.comment} onChange={(e) => setGroup(g.key, { comment: e.target.value })} rows={2} placeholder={g.stage === 'completion' ? 'Required — captured in the ATR…' : 'Add a comment (optional)…'} className="w-full resize-none p-2.5 bg-canvas-elevated border border-canvas-border rounded-[8px] text-[12.5px] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/20" />
                              {g.stage === 'completion' && (
                                <p className="mt-1 flex items-center gap-1.5 text-[11px] text-brand-700"><FileText size={11} className="shrink-0" /> Captured in the Action Taken Report (ATR).</p>
                              )}
                              {v === 'invalid' && (
                                <p className="mt-1 flex items-center gap-1.5 text-[11px] text-mitigated-700"><AlertTriangle size={11} className="shrink-0" />{st.decision === 'approve' && !st.implementation ? 'Select an implementation status.' : 'A comment is required for this decision.'}</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
            </div>
          </div>
          );
        })}

        {pendingCount > 0 && (
          <p className="mt-4 text-[11.5px] text-ink-500 leading-snug">
            {pendingCount} undecided plan{pendingCount === 1 ? '' : 's'} will stay pending — you can submit the decided ones now and return to the rest later.
          </p>
        )}
        </>)}

        {/* Step 2 · Confirm — a reviewable summary table of every decision. */}
        {stepIdx === 1 && (
          <div>
            <div className="mb-4 rounded-[12px] border border-canvas-border bg-[#FAFAFB] p-3.5">
              <div className="text-[12.5px] font-semibold text-ink-800 mb-1">Confirm your review</div>
              <p className="text-[11.5px] text-ink-500 leading-snug">
                Submitting records {decidedValid.length} decision{decidedValid.length === 1 ? '' : 's'} across {reviewedCaseCount} case{reviewedCaseCount === 1 ? '' : 's'}.{pendingCount > 0 ? ` ${pendingCount} undecided plan${pendingCount === 1 ? '' : 's'} stay pending.` : ''} Review and Submit, or go Back to change anything.
              </p>
            </div>
            <SectionLabel>Decisions ({decidedValid.length})</SectionLabel>
            <div className="border border-canvas-border rounded-[12px] overflow-hidden">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="bg-[#FAFAFB] border-b border-canvas-border text-left text-ink-500 uppercase tracking-wider">
                    <th className="px-4 py-2.5 font-medium text-[10.5px]">Action Plan</th>
                    <th className="px-4 py-2.5 font-medium text-[10.5px]">Decision</th>
                    <th className="px-4 py-2.5 font-medium text-[10.5px] text-center">Cases</th>
                    <th className="px-4 py-2.5 font-medium text-[10.5px]">Comment</th>
                  </tr>
                </thead>
                <tbody>
                  {decidedValid.map(g => {
                    const st = decisions[g.key];
                    const approved = st.decision === 'approve';
                    return (
                      <tr key={g.key} className="border-b border-canvas-border last:border-0 align-top">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {g.actionableId
                              ? <span className="inline-flex items-center gap-0.5 font-mono font-semibold text-brand-700 text-[12px]"><Hash size={10} />{g.actionableId}</span>
                              : <Pill className={CLASSIFICATION_STYLE[g.classification]}>{g.classification}</Pill>}
                          </div>
                          <div className="text-[11px] text-ink-500 mt-0.5">{STAGE_META[g.stage].label} · {scopeCount(g)} case{scopeCount(g) === 1 ? '' : 's'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <Pill className={approved ? 'bg-compliant-50 text-compliant-700' : 'bg-risk-50 text-risk-700'}>
                            {approved ? (g.stage === 'plan' ? 'Plan accepted' : g.stage === 'completion' ? (st.implementation ?? 'Approved') : 'Approved') : 'Rejected'}
                          </Pill>
                        </td>
                        <td className="px-4 py-3 text-center tabular-nums text-ink-700">{scopeCount(g)}</td>
                        <td className="px-4 py-3 text-ink-600"><span className="block max-w-[280px] truncate" title={st.comment}>{st.comment || '—'}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </ModalShell>
      <AnimatePresence>
        {linkedModalGroup && (
          <LinkedScopeModal
            key="bulk-review-linked"
            actionableId={linkedModalGroup.actionableId}
            cases={linkedModalGroup.cases.map(c => ({ id: c.id, title: c.title, statusLabel: STAGE_META[linkedModalGroup.stage].label }))}
            selected={scopeIds(linkedModalGroup)}
            onApply={(ids) => { setScopes(prev => ({ ...prev, [linkedModalGroup.key]: ids })); setLinkedModalKey(null); }}
            onClose={() => setLinkedModalKey(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Linked-exceptions scope picker (Bulk Review) ───
// Lets the Auditor choose which linked exceptions a plan's decision applies to —
// apply to all, only the primary, or a hand-picked subset. Mirrors the bulk-action
// scope chooser so the interaction is familiar.
function LinkedScopeModal({
  actionableId,
  cases,
  selected,
  onApply,
  onClose,
}: {
  actionableId?: string;
  cases: { id: string; title: string; statusLabel: string }[];
  selected: string[];
  onApply: (ids: string[]) => void;
  onClose: () => void;
}) {
  const primary = cases[0]?.id;
  const [sel, setSel] = useState<Set<string>>(() => new Set(selected.length ? selected : cases.map(c => c.id)));
  const toggle = (id: string) => setSel(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const count = cases.filter(c => sel.has(c.id)).length;
  const allSelected = count === cases.length && cases.length > 0;
  const toggleAll = () => setSel(allSelected ? new Set() : new Set(cases.map(c => c.id)));

  return (
    <>
      <div className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] z-[70]" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 8 }}
        transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[560px] max-w-[92vw] bg-canvas-elevated rounded-[16px] shadow-xl border border-canvas-border z-[71] flex flex-col max-h-[82vh]"
        role="dialog"
        aria-label="Choose linked exceptions"
      >
        <header className="shrink-0 px-6 py-5 flex items-start justify-between gap-4 border-b border-canvas-border">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 h-5 px-2 text-[10.5px] font-semibold bg-brand-50 text-brand-700 rounded-full"><LinkIcon size={11} /> Linked</span>
              <h2 className="font-display text-[18px] font-semibold text-ink-900 tracking-tight">Linked Exceptions</h2>
            </div>
            <p className="text-[12.5px] text-ink-500 leading-snug">
              {actionableId && <span className="font-mono tabular-nums">ID: {actionableId} · </span>}{cases.length} linked cases · choose which this review applies to
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer shrink-0" aria-label="Close">
            <X size={16} />
          </button>
        </header>

        <div className="px-6 pt-4 pb-2">
          <button
            type="button"
            onClick={toggleAll}
            className="inline-flex items-center gap-2 text-[12.5px] font-medium text-ink-700 cursor-pointer"
          >
            <span className={`w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center shrink-0 ${
              allSelected ? 'bg-brand-600 border-brand-600 text-white' : count > 0 ? 'bg-brand-50 border-brand-300 text-brand-600' : 'bg-canvas-elevated border-canvas-border'
            }`}>
              {allSelected ? <Check size={12} strokeWidth={3} /> : count > 0 ? <span className="w-2 h-0.5 bg-brand-600 rounded" /> : null}
            </span>
            Select all{count > 0 ? ` · ${count} of ${cases.length} selected` : ''}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-4">
          <div className="border border-canvas-border rounded-[12px] divide-y divide-canvas-border overflow-hidden">
            {cases.map((c) => {
              const checked = sel.has(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggle(c.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer hover:bg-paper-50/70 transition-colors"
                >
                  <span className={`w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center shrink-0 ${checked ? 'bg-brand-600 border-brand-600 text-white' : 'bg-canvas-elevated border-canvas-border'}`}>
                    {checked && <Check size={12} strokeWidth={3} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-medium text-brand-700 text-[12.5px]">{c.id}</span>
                      {c.id === primary && <span className="text-[10px] font-semibold text-ink-500 bg-[#F4F2F7] rounded-full px-1.5 h-4 inline-flex items-center">Primary</span>}
                    </div>
                    <div className="text-[12px] text-ink-600 truncate mt-0.5">{c.title}</div>
                  </div>
                  <Pill className="bg-mitigated-50 text-mitigated-700">{c.statusLabel}</Pill>
                </button>
              );
            })}
          </div>
        </div>

        <footer className="shrink-0 px-6 py-4 border-t border-canvas-border flex items-center gap-2">
          <button onClick={onClose} className="flex-1 h-10 text-[13px] font-medium text-ink-700 bg-canvas-elevated border border-canvas-border rounded-[8px] hover:border-brand-200 transition-colors cursor-pointer">
            Cancel
          </button>
          <button
            onClick={() => count > 0 && onApply(cases.filter(c => sel.has(c.id)).map(c => c.id))}
            disabled={count === 0}
            className={`flex-[2] h-10 text-[13px] font-semibold rounded-[8px] transition-colors flex items-center justify-center gap-1.5 ${
              count > 0 ? 'bg-brand-600 text-white hover:bg-brand-500 cursor-pointer' : 'bg-brand-600/50 text-white/80 cursor-not-allowed'
            }`}
          >
            Apply to {count} case{count === 1 ? '' : 's'}
          </button>
        </footer>
      </motion.div>
    </>
  );
}

// ─── Bulk-action Scope Chooser ───
// Shown before a single action when the case belongs to a bulk group. Lets the
// user apply the action to all linked cases, only this one, or a chosen subset.
// Ineligible members (the action doesn't apply in their current state) are shown
// disabled; the opened case is always selected. Each row surfaces the case's
// classification and — for actionable cases — a link to view the submitted plan.
export interface ScopeCandidate {
  id: string;
  title: string;
  eligible: boolean;
  statusLabel: string;
  isOpened: boolean;
  classification: GrcExceptionClassification;
  actionableId?: string;
}

export function BulkScopeChooser({
  groupId,
  groupTitle,
  actionLabel,
  openedId,
  candidates,
  onConfirm,
  onClose,
}: {
  groupId: string;
  groupTitle: string;
  actionLabel: string;
  openedId: string;
  candidates: ScopeCandidate[];
  onConfirm: (ids: string[]) => void;
  onClose: () => void;
}) {
  const eligibleIds = useMemo(() => candidates.filter(c => c.eligible).map(c => c.id), [candidates]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(eligibleIds));
  const [viewPlanId, setViewPlanId] = useState<string | null>(null);

  const toggle = (id: string) => {
    if (id === openedId) return; // opened case is always in scope
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const chosen = candidates.filter(c => selected.has(c.id) && c.eligible);
  const count = chosen.length;
  // Select all toggles every eligible case; the opened case always stays in scope.
  const allSelected = count === eligibleIds.length && eligibleIds.length > 0;
  const toggleAll = () => setSelected(allSelected ? new Set([openedId]) : new Set(eligibleIds));

  // When the Risk Owner classified the group in one bulk action, every linked case
  // shares the same classification and management action plan (one Actionable ID).
  // In that case we surface them once, up top — not repeated on every row.
  const commonClassification = candidates.length > 0 && candidates.every(c => c.classification === candidates[0].classification)
    ? candidates[0].classification
    : null;
  const commonActionable = !!commonClassification && ACTIONABLE_CLASSIFICATIONS.has(commonClassification);
  const sharedActionableId = commonActionable && candidates.every(c => c.actionableId && c.actionableId === candidates[0].actionableId)
    ? candidates[0].actionableId
    : undefined;
  const sharedPlan = commonActionable && !!sharedActionableId; // identical plan across the group
  const commonPlanCaseId = candidates.find(c => c.isOpened)?.id ?? candidates[0]?.id;

  const viewing = viewPlanId ? candidates.find(c => c.id === viewPlanId) : null;

  return (
    <>
      <Overlay onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 8 }}
        transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] max-w-[92vw] bg-canvas-elevated rounded-[16px] shadow-xl border border-canvas-border z-[60] flex flex-col max-h-[82vh]"
        role="dialog"
        aria-label="Choose cases for this bulk action"
      >
        <header className="shrink-0 px-6 py-5 flex items-start justify-between gap-4 border-b border-canvas-border">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 h-5 px-2 text-[10.5px] font-semibold bg-brand-50 text-brand-700 rounded-full"><LinkIcon size={11} /> Bulk</span>
              <h2 className="text-[19px] font-semibold text-ink-900 tracking-tight truncate">{actionLabel}</h2>
            </div>
            <p className="text-[12.5px] text-ink-500 leading-snug">
              <span className="font-mono tabular-nums">ID: {groupId}</span> · {candidates.length} linked cases{groupTitle ? <> · <span className="text-ink-600">{groupTitle}</span></> : null}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer shrink-0" aria-label="Close">
            <X size={16} />
          </button>
        </header>

        <div className="px-6 pt-4 pb-2">
          <p className="text-[12.5px] text-ink-600 leading-relaxed mb-3">
            This case is part of a bulk action. Choose which linked cases this <span className="font-medium text-ink-800">{actionLabel.toLowerCase()}</span> applies to{commonClassification ? '.' : ' — review each case’s classification and submitted plan before you decide.'}
          </p>

          {/* Shared classification + plan — the group was classified together, so
              show it once here rather than repeating it on every linked case. */}
          {commonClassification && (
            <div className="mb-3 rounded-[12px] border border-brand-100 bg-brand-50/60 p-3.5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10.5px] font-semibold uppercase tracking-wider text-ink-500">Classification</span>
                  <Pill className={CLASSIFICATION_STYLE[commonClassification]}>{commonClassification}</Pill>
                </div>
                {sharedActionableId && (
                  <span className="inline-flex items-center gap-1 font-mono font-semibold text-brand-700 text-[12px]">
                    <Hash size={11} />{sharedActionableId}
                  </span>
                )}
              </div>
              {sharedPlan && (
                <div className="mt-2.5 flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-[11.5px] text-ink-600 leading-snug">The same management action plan applies to all linked cases.</p>
                  <button
                    type="button"
                    onClick={() => setViewPlanId(commonPlanCaseId)}
                    className="shrink-0 inline-flex items-center gap-1 text-[12px] font-medium text-brand-700 hover:text-brand-600 cursor-pointer"
                  >
                    <FileText size={12} /> View Management Action Plan
                    <ExternalLink size={11} />
                  </button>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={toggleAll}
            className="inline-flex items-center gap-2 mb-1 text-[12.5px] font-medium text-ink-700 cursor-pointer"
          >
            <span className={`w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center shrink-0 ${
              allSelected ? 'bg-brand-600 border-brand-600 text-white' : count > 1 ? 'bg-brand-50 border-brand-300 text-brand-600' : 'bg-canvas-elevated border-canvas-border'
            }`}>
              {allSelected ? <Check size={12} strokeWidth={3} /> : count > 1 ? <span className="w-2 h-0.5 bg-brand-600 rounded" /> : null}
            </span>
            Select all{count > 0 ? ` · ${count} of ${eligibleIds.length} selected` : ''}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-4">
          <div className="border border-canvas-border rounded-[12px] divide-y divide-canvas-border overflow-hidden">
            {candidates.map((c) => {
              const checked = selected.has(c.id) && c.eligible;
              const locked = c.isOpened; // opened is always on and cannot be toggled
              const actionable = ACTIONABLE_CLASSIFICATIONS.has(c.classification);
              return (
                <div key={c.id} className={`px-4 py-3 ${c.eligible ? '' : 'opacity-55'}`}>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={!c.eligible || locked}
                      onClick={() => toggle(c.id)}
                      title={!c.eligible ? 'No action applies to this case in its current state' : locked ? 'The case you opened — always included' : undefined}
                      className={`flex items-center gap-3 flex-1 min-w-0 text-left transition-colors ${
                        c.eligible ? (locked ? 'cursor-default' : 'cursor-pointer') : 'cursor-not-allowed'
                      }`}
                    >
                      <span className={`w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center shrink-0 ${
                        checked ? 'bg-brand-600 border-brand-600 text-white' : 'bg-canvas-elevated border-canvas-border'
                      }`}>
                        {checked && <Check size={12} strokeWidth={3} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-medium text-brand-700 text-[12.5px]">{c.id}</span>
                          {c.isOpened && <span className="text-[10px] font-semibold text-ink-500 bg-[#F4F2F7] rounded-full px-1.5 h-4 inline-flex items-center">This case</span>}
                          {!checked && c.eligible && !locked && <span className="text-[10px] font-semibold text-ink-400">Deselected</span>}
                          {!commonClassification && <Pill className={CLASSIFICATION_STYLE[c.classification]}>{c.classification}</Pill>}
                        </div>
                        <div className="text-[12px] text-ink-600 truncate mt-0.5">{c.title}</div>
                      </div>
                    </button>
                    <Pill className={c.eligible ? 'bg-mitigated-50 text-mitigated-700' : 'bg-[#EEEEF1] text-ink-500'}>{c.statusLabel}</Pill>
                  </div>
                  {!sharedPlan && actionable && (
                    <div className="pl-[30px] mt-1.5">
                      <button
                        type="button"
                        onClick={() => setViewPlanId(c.id)}
                        className="inline-flex items-center gap-1 text-[12px] font-medium text-brand-700 hover:text-brand-600 cursor-pointer"
                      >
                        <FileText size={12} /> View Management Action Plan
                        <ExternalLink size={11} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <footer className="shrink-0 px-6 py-4 border-t border-canvas-border flex items-center gap-2">
          <button onClick={onClose} className="flex-1 h-10 text-[13px] font-medium text-ink-700 bg-canvas-elevated border border-canvas-border rounded-[8px] hover:border-brand-200 transition-colors cursor-pointer">
            Cancel
          </button>
          <button
            onClick={() => count > 0 && onConfirm(chosen.map(c => c.id))}
            disabled={count === 0}
            className={`flex-[2] h-10 text-[13px] font-semibold rounded-[8px] transition-colors flex items-center justify-center gap-1.5 ${
              count > 0 ? 'bg-brand-600 text-white hover:bg-brand-500 cursor-pointer' : 'bg-brand-600/50 text-white/80 cursor-not-allowed'
            }`}
          >
            Continue with {count} case{count === 1 ? '' : 's'}
          </button>
        </footer>
      </motion.div>

      <AnimatePresence>
        {viewing && (
          <ViewActionPlanModal
            key="scope-view-plan"
            exceptionId={viewing.id}
            classification={viewing.classification}
            actionableId={viewing.actionableId}
            onClose={() => setViewPlanId(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Bulk Action Group Modal ───
export function BulkActionGroupModal({
  bulkId,
  onClose,
}: {
  bulkId: string;
  onClose: () => void;
}) {
  const bulk = GRC_BULK_ACTIONS[bulkId];
  const cases = useMemo(
    () => (bulk ? bulk.caseIds.map(id => GRC_EXCEPTIONS.find(e => e.id === id)).filter(Boolean) as GrcException[] : []),
    [bulk],
  );

  if (!bulk) return null;

  return (
    <>
      <Overlay onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 8 }}
        transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] max-w-[92vw] bg-canvas-elevated rounded-[16px] shadow-xl border border-canvas-border z-[60] flex flex-col max-h-[82vh]"
        role="dialog"
        aria-label="Bulk Action Group"
      >
        <header className="shrink-0 px-6 py-5 flex items-start justify-between gap-4 border-b border-canvas-border">
          <div>
            <h2 className="text-[20px] font-semibold text-ink-900 tracking-tight">Bulk Action Group</h2>
            <p className="text-[12.5px] text-ink-500 mt-0.5 font-mono tabular-nums">
              ID: {bulk.id} · {cases.length} cases
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="border border-canvas-border rounded-[12px] overflow-hidden">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="bg-[#FAFAFB] border-b border-canvas-border text-left text-ink-500 uppercase tracking-wider">
                  <th className="px-4 py-3 font-medium text-[10.5px]">Exception ID</th>
                  <th className="px-4 py-3 font-medium text-[10.5px]">Classification</th>
                  <th className="px-4 py-3 font-medium text-[10.5px]">Action Review Status</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => {
                  const d = GRC_CASE_DETAILS[c.id];
                  const actionStatus = d?.actionStatus ?? 'Pending';
                  const combined = combineActionReview(c.actionReview, actionStatus, c.classification);
                  return (
                    <tr key={c.id} className="border-b border-canvas-border last:border-b-0">
                      <td className="px-4 py-3 align-middle">
                        <span className="font-mono font-medium text-brand-700 text-[12.5px]">{c.id}</span>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <Pill className={CLASSIFICATION_STYLE[c.classification]}>{c.classification}</Pill>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <Pill className={COMBINED_REVIEW_STYLE[combined]}>{COMBINED_REVIEW_LABEL[combined]}</Pill>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        </div>
      </motion.div>
    </>
  );
}
