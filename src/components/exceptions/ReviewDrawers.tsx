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
} from 'lucide-react';
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
  'Pending':                          'Under Review',
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

function DrawerShell({
  title,
  subtitle,
  onClose,
  children,
  footer,
  tabs,
  activeTab,
  onTabChange,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
  tabs?: string[];
  activeTab?: string;
  onTabChange?: (t: string) => void;
}) {
  return (
    <motion.aside
      initial={{ x: 24, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 24, opacity: 0 }}
      transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
      className="fixed top-0 right-0 bottom-0 w-full max-w-[560px] bg-canvas-elevated shadow-xl border-l border-canvas-border flex flex-col z-50"
      role="dialog"
      aria-label={title}
    >
      <header className="shrink-0 px-6 pt-5 pb-0 border-b border-canvas-border">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <h2 className="font-display text-[20px] font-semibold text-ink-900 tracking-tight">{title}</h2>
            {subtitle && <p className="text-[12.5px] text-ink-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
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
      <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      <footer className="shrink-0 px-6 py-4 border-t border-canvas-border bg-canvas-elevated flex items-center gap-2">
        {footer}
      </footer>
    </motion.aside>
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

// ─── Review Classification Drawer ───
export function ReviewClassificationDrawer({
  exception,
  onClose,
  onDecision,
  role,
}: {
  exception: GrcException;
  onClose: () => void;
  onDecision: (decision: 'approve' | 'reject') => void;
  role?: 'risk-owner' | 'auditor';
}) {
  const { can } = useCan();
  const canTriage = can('exc_triage');
  const detail = GRC_CASE_DETAILS[exception.id];
  const bulk = exception.bulkId ? GRC_BULK_ACTIONS[exception.bulkId] : null;
  const [comment, setComment] = useState('');
  const isRiskOwner = role === 'risk-owner';

  return (
    <>
      <Overlay onClick={onClose} />
      <DrawerShell
        title={isRiskOwner ? 'Review Request Submitted' : 'Review Classification'}
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
              onReject={() => canTriage && onDecision('reject')}
              onApprove={() => canTriage && onDecision('approve')}
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
          <label className="block text-[12.5px] font-semibold text-ink-800 mb-2">Comment</label>
          <div className="relative">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a review comment..."
              rows={4}
              className="w-full resize-none p-3 pr-10 bg-canvas-elevated border border-canvas-border rounded-[8px] text-[13px] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/20"
            />
            <button
              type="button"
              className="absolute bottom-2 right-2 w-7 h-7 flex items-center justify-center text-ink-400 hover:text-brand-700 cursor-pointer"
              aria-label="Attach file"
            >
              <Paperclip size={14} />
            </button>
          </div>
        </div>

        {detail && <ActivityTimeline entries={detail.activityLog} />}
      </DrawerShell>
    </>
  );
}

// ─── Review Case Drawer (action review) ───
export function ReviewCaseDrawer({
  exception,
  onClose,
  onDecision,
  onViewBulk,
  role,
}: {
  exception: GrcException;
  onClose: () => void;
  onDecision: (
    decision: 'approve' | 'reject',
    payload: { implementation: 'Implemented' | 'Partially Implemented' | null; comment: string },
  ) => void;
  onViewBulk: (bulkId: string) => void;
  role?: 'risk-owner' | 'auditor';
}) {
  const detail = GRC_CASE_DETAILS[exception.id];
  const bulk = exception.bulkId ? GRC_BULK_ACTIONS[exception.bulkId] : null;
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null);
  const [implementation, setImplementation] = useState<'Implemented' | 'Partially Implemented' | null>(null);
  const [comment, setComment] = useState('');

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
  const canSubmit = isViewMode
    ? true
    : decision === 'reject' || (decision === 'approve' && (!isCompletionReview || implementation !== null));

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
      <DrawerShell
        title={isPlanReview ? 'Review Management Action Plan' : isCompletionReview ? 'Review Completed Action' : isClassReview ? 'Review Classification' : 'Case Details'}
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
                // classifies; the Auditor approves/rejects).
                if (!isAuditor) return;
                if (canSubmit && decision) onDecision(decision, { implementation, comment });
              }}
              disabled={!canSubmit || (!isViewMode && !isAuditor)}
              title={!isViewMode && !isAuditor ? 'Only the Auditor can submit a review decision' : undefined}
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

              <div>
                <label className="block text-[12.5px] font-medium text-ink-800 mb-2">Comment</label>
                {!isViewMode && <SuggestedChip message={suggested} onApply={applySuggested} />}
                <div className="relative">
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Add a review comment..."
                    rows={4}
                    className="w-full resize-none p-3 pr-10 bg-canvas-elevated border border-canvas-border rounded-[8px] text-[13px] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/20"
                  />
                  <button
                    type="button"
                    title="Attach file"
                    aria-label="Attach file to comment"
                    className="absolute bottom-2 right-2 w-7 h-7 flex items-center justify-center text-ink-400 hover:text-brand-700 cursor-pointer"
                  >
                    <Paperclip size={14} />
                  </button>
                </div>
              </div>
            </section>

            {/* Activity log lives directly under the decision/comment section */}
            {detail && (
              <div className="mt-4">
                <ActivityTimeline entries={detail.activityLog} />
              </div>
            )}
          </>
      </DrawerShell>
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
}: {
  exception: GrcException;
  onClose: () => void;
  onSubmit: (payload: { note: string; evidence: { name: string }[]; implementation: 'Implemented' | 'Partially Implemented'; comment: string }) => void;
}) {
  const detail = GRC_CASE_DETAILS[exception.id];
  const [implementation, setImplementation] = useState<'Implemented' | 'Partially Implemented' | null>(detail?.completion?.selfAssessment ?? null);
  const [note, setNote] = useState(detail?.completion?.note ?? '');     // Action Taken — manual, no auto-fill
  const [comment, setComment] = useState('');
  const [evidence, setEvidence] = useState<{ name: string }[]>(detail?.completion?.evidence ?? []);
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
      <DrawerShell
        title="Mark Action Complete"
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
              onClick={() => canSubmit && implementation && onSubmit({ note: note.trim(), evidence, implementation, comment: comment.trim() })}
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

          {/* Comment — always shown; the suggested chip appears once a status is
              chosen and pre-fills an editable message. */}
          <div className="mb-4">
            <label className="block text-[12.5px] font-semibold text-ink-800 mb-2">Comment</label>
            <SuggestedChip message={suggested} onApply={applySuggested} />
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a note for the Auditor…"
              rows={3}
              className="w-full resize-none p-3 bg-canvas-elevated border border-canvas-border rounded-[8px] text-[13px] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/20"
            />
          </div>

          {detail && (
            <div className="mt-5">
              <ActivityTimeline entries={detail.activityLog} />
            </div>
          )}
        </>
      </DrawerShell>
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
  actionableId,
  scopeCount = 1,
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
  /** Actionable ID assigned once an actionable classification is chosen — shown
   *  while the management action plan is created. */
  actionableId?: string;
  /** How many linked cases this classify applies to (bulk) — the ID is shared. */
  scopeCount?: number;
}) {
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

  return (
    <>
      <Overlay onClick={onClose} />
      <DrawerShell
        title="Classify Exception"
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
            <Gated permission="exc_classify" mode="disable" title="You don't have permission to classify exceptions">
            <button
              onClick={() => canSave && onSave({
                severity,
                classification,
                comment,
                actionName: requiresActionPlan ? actionPlans[0]?.name.trim() : undefined,
                actionTaken: requiresActionPlan ? actionPlans[0]?.details.trim() : undefined,
                dueDate: requiresActionPlan ? actionPlans.find(p => p.dueDate)?.dueDate : undefined,
                actionPlans: requiresActionPlan
                  ? actionPlans.map(p => ({ name: p.name.trim(), details: p.details.trim(), dueDate: p.dueDate }))
                  : undefined,
              })}
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
          </>
        }
      >
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

        {/* Conditional action-plan fields — multiple plans, each a collapsible
            card so the panel stays compact (only the open one shows its fields). */}
        {requiresActionPlan && (
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

        <div className="mb-5">
          <label className="block text-[12.5px] font-semibold text-ink-800 mb-2">
            Comment <span className="text-[11px] font-normal text-ink-400">(optional)</span>
          </label>
          <div className="relative">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Explain your classification rationale..."
              rows={5}
              className="w-full resize-none p-3 pr-10 bg-canvas-elevated border border-canvas-border rounded-[8px] text-[13px] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/20"
            />
            <button
              type="button"
              className="absolute bottom-2 right-2 w-7 h-7 flex items-center justify-center text-ink-400 hover:text-brand-700 cursor-pointer"
              aria-label="Attach file"
            >
              <Paperclip size={14} />
            </button>
          </div>
        </div>

        {/* Synced activity log — every action by either persona shows here. */}
        <div className="mt-1">
          <ActivityTimeline entries={reclassDetail?.activityLog ?? []} />
        </div>
      </DrawerShell>
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
      <DrawerShell
        title="Request Due Date Change"
        subtitle={`${exception.id} · sends to the auditor for approval`}
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
      </DrawerShell>
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
      <DrawerShell
        title="Review Due Date Request"
        subtitle={`${exception.id} · requested by ${rev.requestedBy}`}
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
      </DrawerShell>
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
      <DrawerShell
        title="Request Due Date Change"
        subtitle={`${n} case${n === 1 ? '' : 's'} · sends to the auditor for approval`}
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
      </DrawerShell>
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
      <DrawerShell
        title="Review Due Date Requests"
        subtitle={`${n} pending request${n === 1 ? '' : 's'}`}
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
      </DrawerShell>
    </>
  );
}

// ─── Bulk-action Scope Chooser ───
// Shown before a single action when the case belongs to a bulk group. Lets the
// user apply the action to all linked cases, only this one, or a chosen subset.
// Ineligible members (the action doesn't apply in their current state) are shown
// disabled; the opened case is always selected.
export interface ScopeCandidate {
  id: string;
  title: string;
  eligible: boolean;
  statusLabel: string;
  isOpened: boolean;
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

  const toggle = (id: string) => {
    if (id === openedId) return; // opened case is always in scope
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const applyAll = () => setSelected(new Set(eligibleIds));
  const onlyThis = () => setSelected(new Set([openedId]));

  const chosen = candidates.filter(c => selected.has(c.id) && c.eligible);
  const count = chosen.length;

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
              <h2 className="font-display text-[19px] font-semibold text-ink-900 tracking-tight truncate">{actionLabel}</h2>
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
            This case is part of a bulk action. Choose which linked cases this <span className="font-medium text-ink-800">{actionLabel.toLowerCase()}</span> applies to.
          </p>
          <div className="flex items-center gap-2 mb-1">
            <button onClick={applyAll} className="h-8 px-3 text-[12px] font-medium rounded-[8px] border border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100 cursor-pointer transition-colors">
              Apply to all ({eligibleIds.length})
            </button>
            <button onClick={onlyThis} className="h-8 px-3 text-[12px] font-medium rounded-[8px] border border-canvas-border bg-canvas-elevated text-ink-700 hover:border-brand-200 cursor-pointer transition-colors">
              Only this case
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-4">
          <div className="border border-canvas-border rounded-[12px] divide-y divide-canvas-border overflow-hidden">
            {candidates.map((c) => {
              const checked = selected.has(c.id) && c.eligible;
              const locked = c.isOpened; // opened is always on and cannot be toggled
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={!c.eligible || locked}
                  onClick={() => toggle(c.id)}
                  title={!c.eligible ? 'No action applies to this case in its current state' : locked ? 'The case you opened — always included' : undefined}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    c.eligible ? (locked ? 'cursor-default' : 'cursor-pointer hover:bg-paper-50/70') : 'opacity-55 cursor-not-allowed'
                  }`}
                >
                  <span className={`w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center shrink-0 ${
                    checked ? 'bg-brand-600 border-brand-600 text-white' : 'bg-canvas-elevated border-canvas-border'
                  }`}>
                    {checked && <Check size={12} strokeWidth={3} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-medium text-brand-700 text-[12.5px]">{c.id}</span>
                      {c.isOpened && <span className="text-[10px] font-semibold text-ink-500 bg-[#F4F2F7] rounded-full px-1.5 h-4 inline-flex items-center">This case</span>}
                    </div>
                    <div className="text-[12px] text-ink-600 truncate mt-0.5">{c.title}</div>
                  </div>
                  <Pill className={c.eligible ? 'bg-mitigated-50 text-mitigated-700' : 'bg-[#EEEEF1] text-ink-500'}>{c.statusLabel}</Pill>
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
            <h2 className="font-display text-[20px] font-semibold text-ink-900 tracking-tight">Bulk Action Group</h2>
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
