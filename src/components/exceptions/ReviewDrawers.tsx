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
  FileText,
  User,
  Pencil,
  Trash2,
  Check,
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

const SEVERITY_STYLE: Record<GrcExceptionSeverity, string> = {
  High:   'bg-high-50 text-high-700',
  Medium: 'bg-mitigated-50 text-mitigated-700',
  Low:    'bg-compliant-50 text-compliant-700',
};

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

        <div className="grid grid-cols-2 gap-3 mb-5">
          <section className="border border-canvas-border rounded-[12px] p-4">
            <SectionLabel>Severity</SectionLabel>
            <Pill className={SEVERITY_STYLE[exception.severity]}>{exception.severity}</Pill>
          </section>
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
  onDecision: (decision: 'approve' | 'reject') => void;
  onViewBulk: (bulkId: string) => void;
  role?: 'risk-owner' | 'auditor';
}) {
  const { can } = useCan();
  const detail = GRC_CASE_DETAILS[exception.id];
  const bulk = exception.bulkId ? GRC_BULK_ACTIONS[exception.bulkId] : null;
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null);
  const [implementation, setImplementation] = useState<'Implemented' | 'Partially Implemented' | null>(null);
  const [comment, setComment] = useState('');

  // "Case Reviewed" mode — Auditor opened a case that's already past pending review,
  // so the decision UI is hidden and only a comment box remains.
  const isAuditor = role === 'auditor';
  const isViewMode = isAuditor && (exception.actionReview !== 'Pending' || exception.classification === 'Unclassified');

  // Submit is enabled only when (a) a decision is chosen and (b) for Approve, an implementation
  // outcome is selected. Reject auto-implies Discrepancy so no extra choice required.
  const canSubmit = isViewMode
    ? true
    : decision === 'reject' || (decision === 'approve' && implementation !== null);

  return (
    <>
      <Overlay onClick={onClose} />
      <DrawerShell
        title={isViewMode ? 'Case Reviewed' : 'Review Case'}
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
                if (!can('exc_resolve')) return; // resolve permission gates the action decision
                if (canSubmit && decision) onDecision(decision);
              }}
              disabled={!canSubmit || (!isViewMode && !can('exc_resolve'))}
              title={!isViewMode && !can('exc_resolve') ? "You don't have permission to resolve exceptions" : undefined}
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

            <div className="grid grid-cols-2 gap-3 mb-4">
              <section className="border border-canvas-border rounded-[12px] p-4">
                <SectionLabel>Severity</SectionLabel>
                <Pill className={SEVERITY_STYLE[exception.severity]}>{exception.severity}</Pill>
              </section>
              <section className="border border-canvas-border rounded-[12px] p-4">
                <SectionLabel>Classification</SectionLabel>
                <Pill className={CLASSIFICATION_STYLE[exception.classification]}>
                  {exception.classification}
                </Pill>
              </section>
            </div>

            {detail && (
              <section className="border border-canvas-border rounded-[12px] p-4 mb-4">
                <SectionLabel>Action Submitted</SectionLabel>
                <h3 className="text-[14px] font-semibold text-ink-900 mb-1.5 leading-snug">
                  <FileText size={14} className="inline mr-1.5 text-ink-500 -mt-0.5" />
                  {detail.actionTitle}
                </h3>
                <div className="inline-flex items-center gap-1.5 text-[12px] text-brand-700 bg-brand-50 rounded-full px-2.5 h-6 mb-2">
                  <Calendar size={11} />
                  {detail.actionDueDate}
                </div>
                <p className="text-[12.5px] text-ink-700 leading-relaxed">{detail.actionDescription}</p>
              </section>
            )}

            <section className="border border-canvas-border rounded-[12px] p-4">
              <SectionLabel>Auditor Decision</SectionLabel>

              {/* Approve / Reject toggle — hidden in Case Reviewed (view) mode */}
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
                      Approve
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
                      Reject
                    </button>
                  </div>
                </div>
              )}

              {/* Approve → mandatory implementation outcome */}
              {!isViewMode && decision === 'approve' && (
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

              {/* Reject → Discrepancy auto-applied */}
              {!isViewMode && decision === 'reject' && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15 }}
                  className="mb-4 p-3 bg-risk-50 border border-risk/40 rounded-[8px]"
                >
                  <div className="flex items-center gap-2 text-[12.5px] font-semibold text-risk-700 mb-1">
                    <Pill className="bg-risk-50 text-risk-700 border border-risk/40">Discrepancy</Pill>
                  </div>
                  <p className="text-[12px] text-risk-700 leading-snug">
                    On submit, the case will reopen at the Risk Owner's end for further action.
                  </p>
                </motion.div>
              )}

              <div>
                <label className="block text-[12.5px] font-medium text-ink-800 mb-2">Comment</label>
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

const SEVERITY_TONE: Record<GrcExceptionSeverity, { base: string; active: string }> = {
  High:   { base: 'text-ink-700', active: 'bg-high-50 border-high text-high-700' },
  Medium: { base: 'text-ink-700', active: 'bg-mitigated-50 border-mitigated text-mitigated-700' },
  Low:    { base: 'text-ink-700', active: 'bg-compliant-50 border-compliant text-compliant-700' },
};

export function ClassifyExceptionDrawer({
  exception,
  onClose,
  onSave,
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
  }) => void;
}) {
  const [severity, setSeverity] = useState<GrcExceptionSeverity>(exception.severity);
  const [classification, setClassification] = useState<string>('');
  const [comment, setComment] = useState('');
  const [actionName, setActionName] = useState('');
  const [actionTaken, setActionTaken] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [classificationOpen, setClassificationOpen] = useState(false);
  const classificationRef = useRef<HTMLDivElement>(null);

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
    if (!classification || !comment.trim()) return false;
    if (requiresActionPlan) {
      if (!actionName.trim() || !actionTaken.trim() || !dueDate) return false;
    }
    return true;
  }, [classification, comment, requiresActionPlan, actionName, actionTaken, dueDate]);

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
                actionName: requiresActionPlan ? actionName.trim() : undefined,
                actionTaken: requiresActionPlan ? actionTaken.trim() : undefined,
                dueDate: requiresActionPlan ? dueDate : undefined,
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
          <label className="block text-[12.5px] font-semibold text-ink-800 mb-2">Severity</label>
          <div className="grid grid-cols-3 gap-2">
            {(['High', 'Medium', 'Low'] as const).map((s) => {
              const selected = severity === s;
              const tone = SEVERITY_TONE[s];
              return (
                <button
                  key={s}
                  onClick={() => setSeverity(s)}
                  className={`h-10 text-[13px] font-medium rounded-[8px] border transition-colors cursor-pointer ${
                    selected ? tone.active : `bg-canvas-elevated border-canvas-border ${tone.base} hover:border-brand-200`
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>

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

        {/* Conditional action-plan fields — mirrors Bulk Classify modal behaviour */}
        {requiresActionPlan && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            className="space-y-4 border-t border-canvas-border pt-5 mb-5"
          >
            {/* Grouped Action Plan card with shared edit/delete toolbar */}
            <div className="border border-canvas-border rounded-[10px] p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] uppercase tracking-wider font-semibold text-ink-500">
                  Action Plan
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      const el = document.querySelector<HTMLInputElement>('input[data-field="action-name"]');
                      el?.focus();
                    }}
                    title="Edit action plan"
                    aria-label="Edit action plan"
                    className="w-6 h-6 flex items-center justify-center rounded text-ink-400 hover:text-brand-700 hover:bg-[#F4F2F7] cursor-pointer"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActionName(''); setActionTaken(''); }}
                    title="Clear action plan"
                    aria-label="Clear action plan"
                    className="w-6 h-6 flex items-center justify-center rounded text-ink-400 hover:text-risk-700 hover:bg-risk-50 cursor-pointer"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[12.5px] font-semibold text-ink-800 mb-2">
                  Action Name <span className="text-risk">*</span>
                </label>
                <input
                  data-field="action-name"
                  value={actionName}
                  onChange={(e) => setActionName(e.target.value)}
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
                    value={actionTaken}
                    onChange={(e) => setActionTaken(e.target.value)}
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
            </div>

            <div>
              <label className="block text-[12.5px] font-semibold text-ink-800 mb-2">
                Due Date <span className="text-risk">*</span>
              </label>
              <div className="w-[220px]">
                <CustomDatePicker value={dueDate} onChange={setDueDate} minDate={todayIso} />
              </div>
            </div>
          </motion.div>
        )}

        <div className="mb-5">
          <label className="block text-[12.5px] font-semibold text-ink-800 mb-2">
            Comment <span className="text-risk">*</span>
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

        <section className="border border-canvas-border rounded-[12px] p-4">
          <SectionLabel>Activity Log</SectionLabel>
          <div className="flex gap-3">
            <div className="shrink-0 w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center">
              <User size={13} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3 mb-0.5">
                <div className="text-[12.5px] text-ink-800">
                  <span className="font-semibold">Ira</span>{' '}
                  <span className="text-ink-500">(AI)</span>
                </div>
                <span className="text-[11px] text-ink-500 tabular-nums whitespace-nowrap">18 Apr 2026, 18:00</span>
              </div>
              <p className="text-[12.5px] text-ink-700 leading-snug">
                Exception flagged by Ira (AI) with <span className="font-semibold text-brand-700 tabular-nums">94%</span> confidence
              </p>
            </div>
          </div>
        </section>
      </DrawerShell>
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
                  <th className="px-4 py-3 font-medium text-[10.5px]">Severity</th>
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
                        <Pill className={SEVERITY_STYLE[c.severity]}>{c.severity}</Pill>
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
