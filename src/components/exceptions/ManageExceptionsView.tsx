import { useMemo, useState, useEffect, type ElementType } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  AlertTriangle,
  Tag,
  Clock,
  CheckCircle2,
  FlaskConical,
  FileBarChart,
  Layers,
  ChevronDown,
  History,
  UserPlus,
  CalendarClock,
  Workflow,
  ClipboardList,
  MessageSquare,
  Send,
  X,
} from 'lucide-react';
import { GRC_EXCEPTIONS, GRC_CASE_DETAILS, GRC_BULK_ACTIONS, type GrcException, type GrcExceptionSeverity, type GrcActivityEntry, type GrcActivityAuthorRole, type GrcExceptionClassification, type GrcReviewStatus, type GrcDueDateRevision, type GrcActionStatus, type GrcCaseDetail } from '../../data/mockData';
import { deriveStatus, requiresActionPlan, isMemberEligibleForDrawer, nextActionableId, auditorReviewStage, type ExceptionActionKind, type DrawerActionType } from './statusModel';
import { REPORT_QUERIES_ATR } from '../../data/reportQueries';
import type { ExceptionRole } from '../../hooks/useAppState';
import { useCan } from '../../context/CurrentUserContext';
import { useAuditLog } from '../../context/AdminDataContext';
import {
  ReviewClassificationDrawer,
  ReviewCaseDrawer,
  CompleteActionDrawer,
  BulkActionGroupModal,
  ClassifyExceptionDrawer,
  RequestDueDateDrawer,
  ReviewDueDateDrawer,
  BulkRequestDueDateDrawer,
  BulkReviewDueDateDrawer,
  BulkScopeChooser,
  BulkReviewDrawer,
  type ScopeCandidate,
  type BulkReviewSubmission,
} from './ReviewDrawers';
import ActionHubView, { CircularProgress } from './ActionHubView';
import GenerateATRModal from './GenerateATRModal';
import ExceptionsTable from './ExceptionsTable';
import SampleDataModal, { type SampleDataPayload } from './SampleDataModal';
import BulkAssignDrawer, { type BulkAssignPayload } from './BulkAssignDrawer';
import ExceptionDetailDrawer from './ExceptionDetailDrawer';
import ActivityTimelineDrawer from './ActivityTimelineDrawer';
import { markCommentUnread, clearCommentUnread } from './commentStore';
import { useToast } from '../shared/Toast';
// ─── Assignment & Approval Workflow module (configurable, data-driven) ───
import { WorkflowProvider } from './workflow/WorkflowContext';
import WorkflowModule from './workflow/WorkflowModule';
import ActingAsSwitcher from './ActingAsSwitcher';
import AssignmentModal from './workflow/AssignmentModal';
import WorkflowAssignButton from './workflow/WorkflowAssignButton';
import type { Assignment } from './workflow/workflowTypes';

// `scopeIds` is the set of cases the action applies to — always includes
// `exceptionId` (the opened/primary case that drives the drawer's content).
// Defaults to `[exceptionId]` for non-bulk cases (today's single-case behavior).
// `bulkSkipped` (bulk classify only) carries how many selected cases were left
// out because they're locked by the auditor flow — surfaced in the drawer.
type DrawerState =
  | {
      type: DrawerActionType;
      exceptionId: string;
      scopeIds: string[];
      bulkSkipped?: { awaitingReview: number; approved: number };
    }
  | null;

// Human label per action — used in the bulk scope chooser header.
const ACTION_LABEL: Record<DrawerActionType, string> = {
  classify: 'Classify',
  classification: 'Review Classification',
  action: 'Review',
  complete: 'Mark Action Complete',
  requestDueDate: 'Request Date Change',
  reviewDueDate: 'Review Date Change',
};

// The Auditor review state-transition — the single source of truth shared by the
// single Review drawer and Bulk Review, so both flows move a case identically.
function reviewTransition(
  ex: GrcException,
  input: { decision: 'approve' | 'reject'; implementation: 'Implemented' | 'Partially Implemented' | null },
): { actionStatus: GrcActionStatus; patch: Partial<GrcException>; log: string } {
  const actionable = requiresActionPlan(ex.classification);
  const approved = input.decision === 'approve';

  // Stage 1 · Plan review — accept/reject the management action plan.
  if (actionable && ex.actionPhase === 'plan-review') {
    if (approved) return {
      actionStatus: 'Pending',
      patch: { actionPhase: 'in-progress', status: deriveStatus(ex.classification, 'Pending', 'Pending') },
      log: 'Accepted the management action plan — Risk Owner to implement before the due date.',
    };
    return {
      actionStatus: 'Discrepancy',
      patch: { actionReview: 'Rejected', actionPhase: undefined, status: deriveStatus(ex.classification, 'Rejected', 'Discrepancy') },
      log: 'Rejected the management action plan — reopened for the Risk Owner to revise.',
    };
  }

  // Stage 2 · Completion review (actionable) / disposition review (non-actionable).
  const actionReview: GrcReviewStatus = approved ? 'Approved' : 'Rejected';
  const actionStatus: GrcActionStatus = approved
    ? (actionable ? (input.implementation ?? 'Implemented') : 'Implemented')
    : 'Discrepancy';
  const nextPhase = (approved && actionable && input.implementation === 'Partially Implemented') ? ('in-progress' as const) : undefined;
  const log = approved
    ? (actionable ? `Reviewed the completed action — ${input.implementation ?? 'Implemented'}` : 'Approved the classification — no action plan required')
    : (actionable ? 'Marked the completed action as Discrepancy — reopened for the Risk Owner' : 'Rejected the classification — back to the Risk Owner');
  return { actionStatus, patch: { actionReview, actionPhase: nextPhase, status: deriveStatus(ex.classification, actionReview, actionStatus) }, log };
}

interface ManageExceptionsViewProps {
  role: ExceptionRole;
  setRole: (role: ExceptionRole) => void;
  onBack: () => void;
  embedded?: boolean;
  /** When provided, use this data instead of default GRC_EXCEPTIONS. */
  exceptions?: GrcException[];
  /** Called when exception state changes (classification, bulk actions, etc.). */
  onExceptionsChange?: (exceptions: GrcException[]) => void;
  /** Optional label shown in breadcrumb/header context. */
  contextLabel?: string;
  /** Callback for bulk assign action — when provided, shows "Mark as Case & Assign" button. */
  onBulkAssign?: (selectedExceptionIds: string[]) => void;
}

// ─── Editorial KPI bar ────────────────────────────────────────────────
// One unified surface holding all four KPI cells, separated by 1px
// vertical hairlines. No per-cell background tints — semantic tone is
// reserved for a single 4px leading dot in the label row, never the
// whole tile. Honors the No-RAG rule (no four-tone heatmap strip).

type KpiTone = 'default' | 'info' | 'warning' | 'alert';
type KpiCell = {
  key: string;
  label: string;
  value: number;
  icon: React.ElementType;
  tone: KpiTone;
  active?: boolean;
  onClick?: () => void;
};

const TONE_DOT: Record<KpiTone, string> = {
  default: 'bg-ink-300',
  info: 'bg-brand-500',
  warning: 'bg-mitigated',
  alert: 'bg-high',
};

function KpiBar({ cells, bare = false }: { cells: KpiCell[]; bare?: boolean }) {
  const chrome = bare ? '' : 'border border-canvas-border rounded-[12px] overflow-hidden';
  return (
    <div
      role="group"
      aria-label="Exception KPIs"
      className={`grid grid-cols-4 divide-x divide-canvas-border ${chrome}`}
    >
      {cells.map(cell => (
        <KpiCell key={cell.key} cell={cell} />
      ))}
    </div>
  );
}

function KpiCell({ cell }: { cell: KpiCell }) {
  const { label, value, icon: Icon, tone, active, onClick } = cell;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={!!active}
      // Suppress the global 4px focus-ring halo (would float the cell off the row);
      // the inline accent rule + number color shift carry the active state on their own.
      className={`relative text-left px-6 py-5 transition-colors cursor-pointer focus:outline-none focus-visible:outline-none focus-visible:shadow-none ${
        active ? 'bg-brand-50/40' : 'hover:bg-paper-50/70'
      }`}
    >
      <div className="flex items-center gap-2 mb-3 text-ink-500">
        <Icon size={13} strokeWidth={1.75} className="shrink-0" aria-hidden />
        <span className="text-[11px] uppercase tracking-[0.12em] font-medium leading-none">{label}</span>
        {tone !== 'default' && (
          <span aria-hidden className={`w-1 h-1 rounded-full ${TONE_DOT[tone]} ml-0.5`} />
        )}
      </div>
      <div className={`font-display text-[30px] leading-none tabular-nums tracking-tight ${active ? 'text-brand-700' : 'text-ink-900'}`}>
        {value}
      </div>
      {active && (
        <motion.span
          layoutId="kpi-active-accent"
          className="absolute left-4 right-4 bottom-0 h-[2px] bg-brand-600 rounded-t"
          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        />
      )}
    </button>
  );
}

// Inline variant — used inside the sourceQuery context card. Same
// editorial logic, more compact for a horizontal embed.
function KpiBarInline({ cells }: { cells: KpiCell[] }) {
  return (
    <div
      role="group"
      aria-label="Exception KPIs"
      className="grid grid-cols-4 divide-x divide-canvas-border"
    >
      {cells.map(cell => {
        const { label, value, icon: Icon, tone, active, onClick } = cell;
        return (
          <button
            key={cell.key}
            type="button"
            onClick={onClick}
            aria-pressed={!!active}
            className={`relative text-left px-5 py-3 transition-colors cursor-pointer focus:outline-none focus-visible:outline-none focus-visible:shadow-none ${
              active ? 'bg-brand-50/40' : 'hover:bg-paper-50/70'
            }`}
          >
            <div className="flex items-center gap-2 mb-1.5 text-ink-500">
              <Icon size={12} strokeWidth={1.75} className="shrink-0" aria-hidden />
              <span className="text-[10.5px] uppercase tracking-[0.12em] font-medium leading-none">{label}</span>
              {tone !== 'default' && (
                <span aria-hidden className={`w-1 h-1 rounded-full ${TONE_DOT[tone]} ml-0.5`} />
              )}
            </div>
            <div className={`font-display text-[22px] leading-none tabular-nums tracking-tight ${active ? 'text-brand-700' : 'text-ink-900'}`}>
              {value}
            </div>
            {active && (
              <motion.span
                layoutId="kpi-inline-active-accent"
                className="absolute left-3 right-3 bottom-0 h-[2px] bg-brand-600 rounded-t"
                transition={{ type: 'spring', stiffness: 500, damping: 32 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

// Format an ISO date for activity-log messages (e.g. "30 Apr 2026").
const fmtDue = (iso?: string) => {
  if (!iso) return 'Not set';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};
// Activity-log timestamp, e.g. "12 Jun 2026, 14:30".
const fmtStamp = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

function RoleToggle({ role, setRole }: { role: ExceptionRole; setRole: (r: ExceptionRole) => void }) {
  return (
    <div className="flex items-center gap-1 p-1 bg-canvas-elevated border border-canvas-border rounded-full">
      <button
        onClick={() => setRole('risk-owner')}
        className={`flex items-center gap-1.5 px-3 h-7 text-[12px] font-medium rounded-full transition-colors cursor-pointer ${
          role === 'risk-owner' ? 'bg-brand-50 text-brand-700' : 'text-ink-500 hover:text-ink-700'
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${role === 'risk-owner' ? 'bg-brand-600' : 'bg-ink-300'}`} />
        Risk Owner
      </button>
      <button
        onClick={() => setRole('auditor')}
        className={`flex items-center gap-1.5 px-3 h-7 text-[12px] font-medium rounded-full transition-colors cursor-pointer ${
          role === 'auditor' ? 'bg-brand-50 text-brand-700' : 'text-ink-500 hover:text-ink-700'
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${role === 'auditor' ? 'bg-brand-600' : 'bg-ink-300'}`} />
        Auditor
      </button>
    </div>
  );
}

export default function ManageExceptionsView({ role, setRole, onBack, embedded = false, exceptions: propsExceptions, onExceptionsChange, contextLabel, onBulkAssign }: ManageExceptionsViewProps) {
  // Unify with RBAC: the active role's permissions decide the exception persona.
  // Risk Owner roles resolve exceptions; everyone else operates as the auditor.
  const { can } = useCan();
  useEffect(() => {
    const derived: ExceptionRole = can('exc_resolve') ? 'risk-owner' : 'auditor';
    if (derived !== role) setRole(derived);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [can]);

  const [activeNav, setActiveNav] = useState<'exceptions' | 'action-hub' | 'workflow'>('exceptions');
  const [atrModalOpen, setAtrModalOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawer, setDrawer] = useState<DrawerState>(null);
  // When a single action targets a case in a bulk group, the chooser asks which
  // linked cases to apply it to before the action drawer opens.
  const [scopeChooser, setScopeChooser] = useState<
    { type: DrawerActionType; exceptionId: string; candidates: ScopeCandidate[] } | null
  >(null);
  const [bulkModalId, setBulkModalId] = useState<string | null>(null);
  const [sampleModalOpen, setSampleModalOpen] = useState(false);
  const [sampleCountLeft, setSampleCountLeft] = useState(5);
  const [sampleSheets, setSampleSheets] = useState<{ id: string; name: string; payload: SampleDataPayload }[]>([]);
  const [activeSheetId, setActiveSheetId] = useState<string>('all');
  const [activityDrawerOpen, setActivityDrawerOpen] = useState(false);
  const { addToast } = useToast();
  const logEvent = useAuditLog();
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [bulkRequestDueOpen, setBulkRequestDueOpen] = useState(false);
  const [bulkReviewDueOpen, setBulkReviewDueOpen] = useState(false);
  // Auditor Bulk Review — the reviewable cases + a breakdown of what was skipped.
  const [bulkReview, setBulkReview] = useState<
    { cases: GrcException[]; skipped: { awaitingRiskOwner: number; alreadyReviewed: number } } | null
  >(null);
  /** When set, opens the BulkAssignDrawer scoped to just this one case
   *  (from a per-row "Assign" click). Mutually exclusive with bulkAssignOpen
   *  at the UI level — closing either clears both. */
  const [singleAssignCase, setSingleAssignCase] = useState<GrcException | null>(null);
  const [detailExceptionId, setDetailExceptionId] = useState<string | null>(null);
  // Cross-persona comment channel — bump forces a re-render after we mutate a
  // case's activity log in place (same pattern the action handlers use).
  const [, setCommentTick] = useState(0);
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [bulkCommentText, setBulkCommentText] = useState('');
  // Bulk Actions dropdown — one CTA grouping every multi-select action.
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);
  const [atrExpanded, setAtrExpanded] = useState(false);

  const sourceQuery = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const fromId = new URLSearchParams(window.location.search).get('from');
    if (!fromId) return null;
    return REPORT_QUERIES_ATR[fromId] ? { id: fromId, ...REPORT_QUERIES_ATR[fromId] } : null;
  }, []);

  // Local exception state — always the canonical 10-case GRC_EXCEPTIONS set so the
  // same cases show whether opened standalone or via a report/ATR query drill-in.
  // Props still win when explicitly supplied by an embedded host.
  const [localExceptions, setLocalExceptions] = useState<GrcException[]>(() => {
    if (propsExceptions) return propsExceptions;
    return GRC_EXCEPTIONS;
  });
  // Sync if props change (e.g. new run generates more exceptions)
  const propsKey = propsExceptions?.map(e => e.id).join(',') || '';
  const [prevPropsKey, setPrevPropsKey] = useState(propsKey);
  if (propsKey !== prevPropsKey) {
    setPrevPropsKey(propsKey);
    if (propsExceptions) setLocalExceptions(propsExceptions);
  }
  const exceptions = localExceptions;

  const updateExceptions = (updater: (prev: GrcException[]) => GrcException[]) => {
    setLocalExceptions(prev => {
      const next = updater(prev);
      onExceptionsChange?.(next);
      return next;
    });
  };

  // Selected cases eligible for the bulk due-date flows.
  const ACTIONABLE = new Set(['Design Deficiency', 'System Deficiency', 'Procedural Non-Compliance']);
  const selectedList = exceptions.filter(e => selected.has(e.id));
  const bulkRequestEligible = selectedList.filter(
    e => ACTIONABLE.has(e.classification) && !!e.dueDate && e.dueDateRevision?.status !== 'Pending',
  );
  const bulkReviewEligible = selectedList.filter(e => e.dueDateRevision?.status === 'Pending');

  const drawerException = useMemo(
    () => (drawer ? exceptions.find(e => e.id === drawer.exceptionId) ?? null : null),
    [drawer, exceptions],
  );

  const persona: 'risk-owner' | 'auditor' = role === 'risk-owner' ? 'risk-owner' : 'auditor';

  const statusLabelFor = (ex: GrcException) => (ex.status === 'Under Review' ? 'In-Progress' : ex.status);
  // Suffix appended to each case's activity log when an action spans a bulk group.
  const bulkSuffix = (n: number) => (n > 1 ? ` · applied to ${n} linked cases` : '');

  // ── Always-on comment channel ───────────────────────────────────────────
  // Either persona can comment on any case — individually or in bulk — no matter
  // its status, phase, or review outcome. The comment lands in the case's
  // activity log and the OTHER persona is notified (row indicator) until they
  // open the case. This is never disabled: it's how the two personas talk.
  const personaName = (r: ExceptionRole) => (r === 'auditor' ? 'Auditor' : 'Risk Owner');
  const postComment = (text: string, ids: string[], attachment?: { name: string }) => {
    const body = text.trim();
    if ((!body && !attachment) || ids.length === 0) return;
    const authorRole: GrcActivityAuthorRole = persona === 'auditor' ? 'Auditor' : 'Risk Owner';
    const recipient: ExceptionRole = persona === 'risk-owner' ? 'auditor' : 'risk-owner';
    const stamp = fmtStamp(new Date().toISOString());
    const baseMessage = ids.length > 1 ? `Commented · sent to ${ids.length} cases` : 'Added a comment';
    ids.forEach((id, i) => {
      const entry: GrcActivityEntry = {
        id: `act-comment-${id}-${Date.now()}-${i}`,
        author: 'You',
        role: authorRole,
        timestamp: stamp,
        message: baseMessage,
        kind: 'comment',
        ...(body ? { comment: body } : {}),
        ...(attachment ? { attachment } : {}),
      };
      const detail = GRC_CASE_DETAILS[id];
      if (detail) detail.activityLog = [entry, ...detail.activityLog];
      else GRC_CASE_DETAILS[id] = {
        classificationJustification: '', actionTitle: '', actionDueDate: '',
        actionDescription: '', actionStatus: 'Pending', activityLog: [entry],
      };
    });
    markCommentUnread(ids, recipient);
    setCommentTick(t => t + 1);
    logEvent({
      action: 'Update',
      description: ids.length > 1
        ? `Commented on ${ids.length} exceptions as the ${authorRole}`
        : `Commented on ${ids[0]} as the ${authorRole}`,
      module: 'Exceptions', entity: 'Exception',
    });
    addToast({ type: 'success', message: ids.length > 1
      ? `Comment shared on ${ids.length} cases — the ${personaName(recipient)} will see it.`
      : `Comment shared — the ${personaName(recipient)} will see it.` });
  };

  // Open a case's detail and clear this persona's unread comment badge for it.
  const openDetail = (id: string) => {
    clearCommentUnread(id, persona);
    setDetailExceptionId(id);
    setCommentTick(t => t + 1);
  };

  // Opening a Classify/Action review modal counts as reading the case's comments
  // → clear this persona's unread badge for the open case (and any linked scope).
  useEffect(() => {
    if (!drawer) return;
    const ids = drawer.scopeIds ?? [drawer.exceptionId];
    ids.forEach(id => clearCommentUnread(id, persona));
    setCommentTick(t => t + 1);
  }, [drawer, persona]);

  // The Bulk Actions menu only makes sense with a selection — close it when the
  // selection clears so it never lingers open against an inactive button.
  useEffect(() => {
    if (selected.size === 0) setBulkMenuOpen(false);
  }, [selected.size]);

  // ── Bulk-action funnel ──────────────────────────────────────────────────
  // Every single action routes through beginAction. If the case belongs to a
  // bulk group with more than one applicable member, the scope chooser opens
  // first; otherwise the action drawer opens directly on just this case.
  const openDrawerWithScope = (type: DrawerActionType, ex: GrcException, ids: string[]) => {
    const scopeIds = ids.includes(ex.id) ? ids : [ex.id, ...ids];
    setScopeChooser(null);
    setDrawer({ type, exceptionId: ex.id, scopeIds });
  };

  // Launch the shared Classify drawer over the selected cases — this IS the bulk
  // classify (same UI as the single classify, applied to every editable case).
  //
  // Once an exception is in the auditor flow it must not be silently overwritten:
  // cases awaiting auditor review and auditor-approved cases are LOCKED and skipped.
  // Only editable cases (unclassified, or auditor-rejected) are carried forward —
  // and the Risk Owner gets a clear, numbered breakdown of what was left out.
  const beginBulkClassify = () => {
    const selectedCases = exceptions.filter(e => selected.has(e.id));
    if (selectedCases.length === 0) return;

    const eligible = selectedCases.filter(e => isMemberEligibleForDrawer(e, 'classify', persona));
    const locked = selectedCases.filter(e => !isMemberEligibleForDrawer(e, 'classify', persona));
    const isApproved = (e: GrcException) => e.actionReview === 'Approved' || e.actionReview === 'Implemented';
    const approved = locked.filter(isApproved);
    const awaitingReview = locked.filter(e => !isApproved(e));

    // Record the skip decision on every locked case so the trail is complete.
    if (locked.length > 0) {
      const nowIso = new Date().toISOString();
      locked.forEach(e => {
        const reason = isApproved(e) ? 'auditor-approved' : 'awaiting auditor review';
        const entry: GrcActivityEntry = {
          id: `act-bulkskip-${e.id}-${Date.now()}`,
          author: 'You',
          role: 'Risk Owner',
          timestamp: fmtStamp(nowIso),
          message: `Excluded from a bulk classification — case is ${reason} and is locked from re-classification.`,
        };
        const detail = GRC_CASE_DETAILS[e.id];
        if (detail) detail.activityLog = [entry, ...detail.activityLog];
        else GRC_CASE_DETAILS[e.id] = {
          classificationJustification: '', actionTitle: '', actionDueDate: '',
          actionDescription: '', actionStatus: 'Pending', activityLog: [entry],
        };
      });
      logEvent({
        action: 'Update',
        description: `Bulk classify: ${eligible.length} editable case${eligible.length === 1 ? '' : 's'} included; ${locked.length} skipped (${awaitingReview.length} awaiting auditor review, ${approved.length} auditor-approved)`,
        module: 'Exceptions', entity: 'Exception',
      });
    }

    // Nothing editable in the selection → don't open the drawer; explain why.
    if (eligible.length === 0) {
      addToast({
        type: 'info',
        message: `None of the ${selectedCases.length} selected case${selectedCases.length === 1 ? '' : 's'} can be re-classified — ${awaitingReview.length} awaiting auditor review and ${approved.length} auditor-approved are locked.`,
      });
      setSelected(new Set());
      return;
    }

    // Some were skipped → proceed with the editable ones and report the breakdown.
    if (locked.length > 0) {
      addToast({
        type: 'info',
        message: `Bulk classify applies to ${eligible.length} editable case${eligible.length === 1 ? '' : 's'}. Skipped ${locked.length}: ${awaitingReview.length} awaiting auditor review, ${approved.length} auditor-approved (locked to protect the auditor's decision).`,
      });
    }

    setDrawer({
      type: 'classify',
      exceptionId: eligible[0].id,
      scopeIds: eligible.map(e => e.id),
      bulkSkipped: locked.length > 0 ? { awaitingReview: awaitingReview.length, approved: approved.length } : undefined,
    });
  };

  // ── Auditor Bulk Review ─────────────────────────────────────────────────
  // Review many selected cases at once. Only cases that actually need the
  // Auditor's review are carried forward; the rest are skipped with a clear,
  // numbered breakdown. A single reviewable case opens the focused single drawer.
  const beginBulkReview = () => {
    const selectedCases = exceptions.filter(e => selected.has(e.id));
    if (selectedCases.length === 0) return;

    const reviewable = selectedCases.filter(e => auditorReviewStage(e) !== null);
    const locked = selectedCases.filter(e => auditorReviewStage(e) === null);
    const isDone = (e: GrcException) => e.actionReview === 'Approved' || e.actionReview === 'Implemented';
    const alreadyReviewed = locked.filter(isDone);
    const awaitingRiskOwner = locked.filter(e => !isDone(e));

    if (locked.length > 0) {
      logEvent({
        action: 'Update',
        description: `Bulk review: ${reviewable.length} ready; ${locked.length} skipped (${awaitingRiskOwner.length} awaiting Risk Owner, ${alreadyReviewed.length} already reviewed)`,
        module: 'Exceptions', entity: 'Exception',
      });
    }

    if (reviewable.length === 0) {
      addToast({
        type: 'info',
        message: `None of the ${selectedCases.length} selected case${selectedCases.length === 1 ? '' : 's'} are ready for your review — ${awaitingRiskOwner.length} awaiting the Risk Owner, ${alreadyReviewed.length} already reviewed.`,
      });
      setSelected(new Set());
      return;
    }

    // Exactly one reviewable case → the focused single Review drawer is clearer.
    if (reviewable.length === 1) {
      setSelected(new Set());
      beginAction('action', reviewable[0]);
      return;
    }

    if (locked.length > 0) {
      addToast({
        type: 'info',
        message: `Bulk review covers ${reviewable.length} case${reviewable.length === 1 ? '' : 's'} ready for review. Skipped ${locked.length}: ${awaitingRiskOwner.length} awaiting the Risk Owner, ${alreadyReviewed.length} already reviewed.`,
      });
    }

    setBulkReview({ cases: reviewable, skipped: { awaitingRiskOwner: awaitingRiskOwner.length, alreadyReviewed: alreadyReviewed.length } });
  };

  // Apply every Bulk Review decision in one pass, reusing the shared transition so
  // each case moves exactly as it would through the single Review drawer.
  const applyBulkReview = (subs: BulkReviewSubmission[]) => {
    if (subs.length === 0) return;
    const nowIso = new Date().toISOString();
    const byId = new Map(subs.map(s => [s.id, s]));
    let approvedCount = 0;
    let rejectedCount = 0;

    subs.forEach(s => {
      const ex = exceptions.find(e => e.id === s.id);
      if (!ex) return;
      const t = reviewTransition(ex, { decision: s.decision, implementation: s.implementation });
      if (s.decision === 'approve') approvedCount += 1; else rejectedCount += 1;
      const detail = GRC_CASE_DETAILS[s.id];
      if (detail) {
        detail.actionStatus = t.actionStatus;
        detail.activityLog = [{
          id: `act-bulkrev-${s.id}-${Date.now()}`,
          author: 'You', role: 'Auditor', timestamp: fmtStamp(nowIso),
          message: `${t.log} · part of a bulk review of ${subs.length} cases`,
          comment: s.comment || undefined,
        }, ...detail.activityLog];
      }
    });

    updateExceptions(list => list.map(e => {
      const s = byId.get(e.id);
      if (!s) return e;
      const t = reviewTransition(e, { decision: s.decision, implementation: s.implementation });
      return { ...e, ...t.patch, lastUpdated: nowIso.slice(0, 10) };
    }));

    logEvent({
      action: 'Update',
      description: `Bulk review submitted — ${subs.length} case${subs.length === 1 ? '' : 's'} reviewed (${approvedCount} approved/accepted, ${rejectedCount} rejected)`,
      module: 'Exceptions', entity: 'Exception',
    });
    addToast({
      type: 'success',
      message: `Bulk review submitted — ${subs.length} case${subs.length === 1 ? '' : 's'} reviewed (${approvedCount} approved, ${rejectedCount} rejected).`,
    });
    setSelected(new Set());
    setBulkReview(null);
  };

  const beginAction = (type: DrawerActionType, ex: GrcException) => {
    // A per-row Classify always acts on just that case — bulk classification is
    // done explicitly via the toolbar (select cases → Bulk Classify). No chooser.
    if (type === 'classify') { openDrawerWithScope(type, ex, [ex.id]); return; }

    // Resolve the group from the LIVE exceptions sharing this bulkId — robust to
    // both the default mock and query-derived rows (whose bulkId assignment may
    // differ from the static GRC_BULK_ACTIONS.caseIds).
    const members = ex.bulkId ? exceptions.filter(e => e.bulkId === ex.bulkId) : [];
    // No group, or a singleton group → act on this case alone.
    if (members.length <= 1) { openDrawerWithScope(type, ex, [ex.id]); return; }

    const candidates: ScopeCandidate[] = members.map(m => ({
      id: m.id,
      title: m.title,
      isOpened: m.id === ex.id,
      eligible: m.id === ex.id || isMemberEligibleForDrawer(m, type, persona, ex),
      statusLabel: statusLabelFor(m),
      classification: m.classification,
      actionableId: m.actionableId,
    }));
    const eligibleCount = candidates.filter(c => c.eligible).length;
    // Only the opened case applies → no chooser needed.
    if (eligibleCount <= 1) { openDrawerWithScope(type, ex, [ex.id]); return; }

    // Mark Action Complete applies to every linked case automatically — once the
    // plan is approved, the action taken covers all linked exceptions. No chooser;
    // the drawer surfaces the grouped cases instead.
    if (type === 'complete') {
      openDrawerWithScope(type, ex, candidates.filter(c => c.eligible).map(c => c.id));
      return;
    }

    setScopeChooser({ type, exceptionId: ex.id, candidates });
  };

  // Shared action dispatcher — the Action Hub deep-dive and the Exceptions tab
  // perform identical, recorded actions. Funnels through beginAction so the bulk
  // scope chooser applies in both surfaces.
  const runExceptionAction = (kind: ExceptionActionKind, ex: GrcException) => {
    const type: DrawerActionType =
      kind === 'classify' || kind === 'reclassify' ? 'classify'
      : kind === 'markComplete' ? 'complete'
      : kind === 'reviewClassification' ? 'classification'
      : 'action'; // reviewPlan | reviewAction | review
    beginAction(type, ex);
  };

  const stats = useMemo(() => {
    const total = exceptions.length;
    const classified = exceptions.filter(e => e.classification !== 'Unclassified').length;
    const unclassified = exceptions.filter(e => e.classification === 'Unclassified').length;
    const actionReviewPending = exceptions.filter(e => e.actionReview === 'Pending' && e.classification !== 'Unclassified').length;
    return { total, classified, unclassified, actionReviewPending };
  }, [exceptions]);

  // KPI-driven filter — clicking a tile narrows the table; clicking the active tile clears.
  type KpiFilter = 'total' | 'classified' | 'unclassified' | 'actionReviewPending' | null;
  const [kpiFilter, setKpiFilter] = useState<KpiFilter>(null);

  // Sample-sheet view — narrows rows to the configured sample/filter rules.
  const sheetExceptions = useMemo(() => {
    if (activeSheetId === 'all') return exceptions;
    const sheet = sampleSheets.find(s => s.id === activeSheetId);
    if (!sheet) return exceptions;
    const { mode, filterRows, samplePct } = sheet.payload;
    if (mode === 'sample' && typeof samplePct === 'number') {
      const n = Math.max(1, Math.ceil((exceptions.length * samplePct) / 100));
      const seed = sheet.id.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
      const start = seed % Math.max(1, exceptions.length);
      return Array.from({ length: n }, (_, i) => exceptions[(start + i) % exceptions.length]);
    }
    if (mode === 'filter' && filterRows) {
      const valid = filterRows.filter(r => r.columnKey && r.condition);
      if (valid.length === 0) return exceptions;
      const ratio = Math.max(0.25, 1 - valid.length * 0.25);
      const n = Math.max(1, Math.ceil(exceptions.length * ratio));
      const seed = sheet.id.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
      return [...exceptions]
        .sort((a, b) => ((a.id.charCodeAt((seed) % a.id.length) || 0) - (b.id.charCodeAt((seed) % b.id.length) || 0)))
        .slice(0, n);
    }
    return exceptions;
  }, [exceptions, activeSheetId, sampleSheets]);

  const visibleExceptions = useMemo(() => {
    switch (kpiFilter) {
      case 'classified':           return sheetExceptions.filter(e => e.classification !== 'Unclassified');
      case 'unclassified':         return sheetExceptions.filter(e => e.classification === 'Unclassified');
      case 'actionReviewPending':  return sheetExceptions.filter(e => e.actionReview === 'Pending' && e.classification !== 'Unclassified');
      default:                     return sheetExceptions;
    }
  }, [sheetExceptions, kpiFilter]);
  const toggleKpiFilter = (k: Exclude<KpiFilter, null>) => setKpiFilter(prev => (prev === k ? null : k));

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ─── Workflow integration hook ───
  // When an assignment clears its final approval, write the drafted result back
  // onto the exception using the SAME updateExceptions path the classification /
  // review screens use — no changes to those screens. RO workflows hand the case
  // to the Auditor's action review; Auditor workflows close the case.
  const handleWorkflowFinalize = (a: Assignment) => {
    const today = new Date().toISOString().slice(0, 10);
    updateExceptions(prev => prev.map(e => {
      if (e.id !== a.exceptionId) return e;
      if (a.persona === 'risk-owner') {
        const classification = (a.draft?.classification as GrcException['classification']) ?? e.classification;
        return {
          ...e,
          classification,
          classificationReview: 'Approved' as const,
          actionReview: 'Pending' as const, // now available for Auditor review
          actionPhase: requiresActionPlan(classification) ? ('plan-review' as const) : undefined,
          status: deriveStatus(classification, 'Pending', 'Pending'),
          dueDate: a.draft?.dueDate ?? e.dueDate,
          lastUpdated: today,
        };
      }
      // Auditor workflow → derive the case status from the review outcome.
      const actionReview = (a.draft?.actionReview ?? 'Approved') as GrcReviewStatus;
      const actionStatus: GrcActionStatus = actionReview === 'Rejected' ? 'Discrepancy' : 'Implemented';
      return {
        ...e,
        actionReview,
        actionPhase: undefined,
        status: deriveStatus(e.classification, actionReview, actionStatus),
        lastUpdated: today,
      };
    }));
  };

  return (
    <WorkflowProvider role={role} onFinalize={handleWorkflowFinalize}>
    <div className="h-full w-full flex flex-col overflow-hidden bg-canvas">
      {/* Top chrome — only shown when standalone (Back button); hidden when embedded */}
      {!embedded && (
        <header className="shrink-0 h-[60px] px-6 flex items-center gap-4 bg-canvas-elevated border-b border-canvas-border">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-[12px] text-ink-500 hover:text-brand-700 transition-colors cursor-pointer pr-2 border-r border-canvas-border mr-1"
            aria-label="Back to reports"
          >
            <ArrowLeft size={14} />
            Back
          </button>
          <div className="flex-1" />
        </header>
      )}

      {/* Page header — title + subtitle + tabs (Knowledge Hub pattern) */}
      <div className="border-b border-canvas-border bg-canvas-elevated">
        <div className={`max-w-[1600px] mx-auto px-8 ${embedded ? 'pt-4 pb-0' : 'pt-8 pb-0'}`}>
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              {!embedded && <h1 className="text-[34px] font-semibold tracking-tight text-ink-900 leading-[1.15]">Manage Exceptions</h1>}
              {embedded ? (
                <h2 className="text-[16px] font-semibold text-ink-900 mb-3">Exceptions & Cases</h2>
              ) : (
                <p className="text-[14px] text-ink-500 mt-1 mb-6">
                  {contextLabel
                    ? `Triage and resolve exceptions for ${contextLabel}.`
                    : 'Triage and resolve exceptions surfaced from audit queries.'}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setActivityDrawerOpen(true)}
                title="View activity timeline"
                aria-label="View activity timeline"
                className="w-9 h-9 rounded-[10px] flex items-center justify-center text-ink-500 bg-canvas-elevated border border-canvas-border hover:text-brand-700 hover:border-brand-200 transition-colors cursor-pointer"
              >
                <History size={15} />
              </button>
              <ActingAsSwitcher />
              <RoleToggle role={role} setRole={setRole} />
            </div>
          </div>

          {/* Tabs row */}
          <div className="flex items-center justify-between gap-6 -mb-px">
            <div className="flex items-center gap-0 border-b border-transparent">
              {([
                { id: 'exceptions' as const, label: 'Exceptions', icon: Layers },
                { id: 'action-hub' as const, label: 'Action Hub', icon: FileBarChart },
                { id: 'workflow' as const, label: 'Approval & Configuration', icon: Workflow },
              ] as const).map(t => {
                const Icon = t.icon;
                const isActive = activeNav === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveNav(t.id)}
                    className={`relative flex items-center gap-2 px-4 h-11 text-[13px] font-medium transition-colors cursor-pointer ${
                      isActive ? 'text-brand-700' : 'text-ink-500 hover:text-ink-700'
                    }`}
                  >
                    <Icon size={14} />
                    {t.label}
                    {isActive && (
                      <motion.div
                        layoutId="exceptions-tab-bar"
                        className="absolute left-0 right-0 -bottom-px h-[2px] bg-brand-600"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

          </div>
        </div>
      </div>

      {activeNav === 'action-hub' ? (
        <ActionHubView exceptions={exceptions} role={role} onAction={runExceptionAction} />
      ) : activeNav === 'workflow' ? (
        <WorkflowModule role={role} exceptions={exceptions} />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="flex-1 overflow-auto"
        >
          <div className="px-8 pt-4 pb-8 max-w-[1600px] mx-auto min-h-full flex flex-col">

            {/* Single outer card holds KPI bar, optional sourceQuery summary, and the table — one continuous editorial surface, no center divisions. */}
            <div className="bg-canvas-elevated border border-canvas-border rounded-[12px] overflow-hidden flex-1 flex flex-col min-h-0">
              {/* KPI bar — neutral surface, hairline-separated cells, tone-as-dot. Wrapped with pt so it doesn't sit flush against the card's top border. */}
              <div className="pt-4">
              {sourceQuery ? (
                <KpiBarInline
                  cells={[
                    { key: 'total',          label: 'Total Exceptions',        value: stats.total,                icon: AlertTriangle, tone: 'default', active: kpiFilter === null,                  onClick: () => setKpiFilter(null) },
                    { key: 'classified',     label: 'Exceptions Classified',   value: stats.classified,           icon: Tag,            tone: 'info',    active: kpiFilter === 'classified',          onClick: () => toggleKpiFilter('classified') },
                    { key: 'unclassified',   label: 'Unclassified Exceptions', value: stats.unclassified,         icon: Clock,          tone: 'warning', active: kpiFilter === 'unclassified',        onClick: () => toggleKpiFilter('unclassified') },
                    { key: 'actionPending',  label: 'Action Review Pending',   value: stats.actionReviewPending,  icon: CheckCircle2,   tone: 'alert',   active: kpiFilter === 'actionReviewPending', onClick: () => toggleKpiFilter('actionReviewPending') },
                  ]}
                />
              ) : (
                <KpiBar
                  bare
                  cells={[
                    { key: 'total',          label: 'Total Exceptions',        value: stats.total,                icon: AlertTriangle, tone: 'default', active: kpiFilter === null,                  onClick: () => setKpiFilter(null) },
                    { key: 'classified',     label: 'Exceptions Classified',   value: stats.classified,           icon: Tag,            tone: 'info',    active: kpiFilter === 'classified',          onClick: () => toggleKpiFilter('classified') },
                    { key: 'unclassified',   label: 'Unclassified Exceptions', value: stats.unclassified,         icon: Clock,          tone: 'warning', active: kpiFilter === 'unclassified',        onClick: () => toggleKpiFilter('unclassified') },
                    { key: 'actionPending',  label: 'Action Review Pending',   value: stats.actionReviewPending,  icon: CheckCircle2,   tone: 'alert',   active: kpiFilter === 'actionReviewPending', onClick: () => toggleKpiFilter('actionReviewPending') },
                  ]}
                />
              )}
              </div>

              {sourceQuery && (
                <>
                  {/* Source query ATR — flows directly under the KPI bar */}
                  <div className="px-6 py-5">
                    <div className="flex items-center gap-2 mb-3 text-[11px]">
                      <span className="font-bold text-brand-700 uppercase tracking-wider">Query · {sourceQuery.id}</span>
                    </div>
                    <button
                      onClick={() => setAtrExpanded(p => !p)}
                      className="flex items-start gap-2 text-left w-full mb-4 cursor-pointer focus:outline-none focus-visible:outline-none focus:ring-0 group"
                    >
                      <motion.span
                        animate={{ rotate: atrExpanded ? 0 : -90 }}
                        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                        className="inline-flex mt-1 text-brand-700"
                      >
                        <ChevronDown size={14} />
                      </motion.span>
                      <p className="text-[14px] text-ink-700 leading-relaxed transition-colors group-hover:text-ink-900">
                        {sourceQuery.title}
                      </p>
                    </button>
                    <p className="text-[13px] text-ink-500 leading-relaxed">{sourceQuery.summary}</p>
                  </div>
                  <AnimatePresence initial={false}>
                    {atrExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="px-6 pb-6 pt-1">
                          <div className="space-y-6">
                            {[
                              { title: 'Findings', items: sourceQuery.findings },
                              { title: 'Observations', items: sourceQuery.observations },
                            ].map(section => (
                              <div key={section.title}>
                                <h4 className="text-[11px] font-bold text-ink-500 uppercase tracking-wider mb-3">{section.title}</h4>
                                <ul className="space-y-2.5">
                                  {section.items.map((item, i) => (
                                    <motion.li
                                      key={i}
                                      initial={{ opacity: 0, x: -4 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      transition={{ delay: 0.08 + i * 0.05, duration: 0.3 }}
                                      className="flex gap-2.5 text-[13px] text-ink-700 leading-relaxed"
                                    >
                                      <div className="w-1 h-1 rounded-full mt-2 shrink-0 bg-brand-600/60" />
                                      {item}
                                    </motion.li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}

              {/* Table — nested inside the same card, bare (no own border) */}
              <ExceptionsTable
                bare
              exceptions={visibleExceptions}
              role={role}
              selected={selected}
              onToggleSelect={toggleSelect}
              onToggleAll={(ids) => {
                const allSelected = ids.every(id => selected.has(id));
                if (allSelected) {
                  setSelected(prev => {
                    const next = new Set(prev);
                    ids.forEach(id => next.delete(id));
                    return next;
                  });
                } else {
                  setSelected(prev => {
                    const next = new Set(prev);
                    ids.forEach(id => next.add(id));
                    return next;
                  });
                }
              }}
              onOpenClassification={(ex) => {
                // Risk Owner gets the editable classify drawer to classify (Unclassified)
                // or re-classify a rejected case; otherwise a read-only view.
                const t: DrawerActionType = (role === 'risk-owner' && (ex.classification === 'Unclassified' || ex.actionReview === 'Rejected'))
                  ? 'classify'
                  : 'classification';
                beginAction(t, ex);
              }}
              onOpenAction={(ex) => beginAction('action', ex)}
              onMarkComplete={(ex) => beginAction('complete', ex)}
              onRequestDueDate={(ex) => beginAction('requestDueDate', ex)}
              onReviewDueDate={(ex) => beginAction('reviewDueDate', ex)}
              onOpenActionable={(bulkId) => setBulkModalId(bulkId)}
              onAssign={(ex) => {
                setSingleAssignCase(ex);
              }}
              extraColumns={undefined}
              onOpenDetail={(ex) => openDetail(ex.id)}
              headerLeading={
                <div className="flex items-center gap-2">
                  {/* Assignment & Approval Workflow — distinct workflow action. */}
                  <WorkflowAssignButton selectedIds={[...selected]} />
                  {/* Bulk Actions — one CTA grouping every multi-select action.
                      Always visible; inactive until a case is selected, then it
                      activates (and reveals the persona's applicable actions). */}
                  {(() => {
                    const active = selected.size > 0;
                    const items: { key: string; label: string; icon: ElementType; count: number; onClick: () => void }[] = [
                      { key: 'comment', label: 'Comment', icon: MessageSquare, count: selected.size, onClick: () => { setBulkCommentText(''); setCommentModalOpen(true); } },
                      ...(role === 'risk-owner' && can('exc_classify')
                        ? [{ key: 'classify', label: 'Bulk Classify', icon: Tag, count: selected.size, onClick: beginBulkClassify }]
                        : []),
                      ...(role !== 'risk-owner'
                        ? [{ key: 'review', label: 'Bulk Review', icon: ClipboardList, count: selected.size, onClick: beginBulkReview }]
                        : []),
                      ...(can('exc_assign')
                        ? [{ key: 'assign', label: 'Bulk Assign', icon: UserPlus, count: selected.size, onClick: () => setBulkAssignOpen(true) }]
                        : []),
                      ...(role === 'risk-owner' && bulkRequestEligible.length > 0
                        ? [{ key: 'reqdue', label: 'Request Date Change', icon: CalendarClock, count: bulkRequestEligible.length, onClick: () => setBulkRequestDueOpen(true) }]
                        : []),
                      ...(role !== 'risk-owner' && bulkReviewEligible.length > 0
                        ? [{ key: 'revdue', label: 'Review Date Changes', icon: CalendarClock, count: bulkReviewEligible.length, onClick: () => setBulkReviewDueOpen(true) }]
                        : []),
                    ];
                    return (
                      <div className="relative">
                        <button
                          type="button"
                          disabled={!active}
                          onClick={() => active && setBulkMenuOpen(o => !o)}
                          aria-haspopup="menu"
                          aria-expanded={bulkMenuOpen && active}
                          title={active ? `Bulk actions for ${selected.size} selected case${selected.size === 1 ? '' : 's'}` : 'Select one or more cases to enable bulk actions'}
                          className={`flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium rounded-[8px] border transition-colors ${
                            active
                              ? 'text-white bg-brand-600 border-brand-600 hover:bg-brand-500 cursor-pointer'
                              : 'text-ink-400 bg-canvas-elevated border-canvas-border cursor-not-allowed'
                          }`}
                        >
                          <Layers size={13} />
                          Bulk Actions
                          {active && (
                            <span className="inline-flex items-center h-5 min-w-5 px-1 text-[10.5px] font-semibold bg-white/20 rounded-full tabular-nums">
                              {selected.size}
                            </span>
                          )}
                          <ChevronDown size={13} className={`transition-transform ${bulkMenuOpen && active ? 'rotate-180' : ''}`} />
                        </button>
                        <AnimatePresence>
                          {bulkMenuOpen && active && (
                            <>
                              <div className="fixed inset-0 z-[55]" onClick={() => setBulkMenuOpen(false)} />
                              <motion.div
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={{ duration: 0.14, ease: [0.2, 0, 0, 1] }}
                                className="absolute left-0 top-full mt-1.5 z-[56] w-60 bg-canvas-elevated border border-canvas-border rounded-[10px] shadow-lg py-1"
                                role="menu"
                              >
                                {items.map((item) => {
                                  const Icon = item.icon;
                                  return (
                                    <button
                                      key={item.key}
                                      type="button"
                                      role="menuitem"
                                      onClick={() => { setBulkMenuOpen(false); item.onClick(); }}
                                      className="w-full flex items-center gap-2.5 px-3 h-9 text-[12.5px] font-medium text-ink-700 hover:bg-brand-50 hover:text-brand-700 cursor-pointer transition-colors text-left"
                                    >
                                      <Icon size={14} className="text-ink-500 shrink-0" />
                                      <span className="flex-1">{item.label}</span>
                                      <span className="inline-flex items-center h-5 min-w-5 px-1 text-[10.5px] font-semibold bg-brand-50 text-brand-700 rounded-full tabular-nums">
                                        {item.count}
                                      </span>
                                    </button>
                                  );
                                })}
                              </motion.div>
                            </>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })()}
                </div>
              }
              headerExtras={
                <button
                  onClick={() => setSampleModalOpen(true)}
                  className="inline-flex items-center gap-1.5 h-8 px-2.5 text-[12.5px] font-medium text-ink-700 bg-canvas-elevated border border-canvas-border rounded-[8px] hover:border-brand-200 cursor-pointer"
                >
                  <FlaskConical size={13} />
                  Sample Data
                </button>
              }
              sampleSheets={sampleSheets}
              activeSheetId={activeSheetId}
              onChangeSheet={setActiveSheetId}
            />
            </div>
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {drawer?.type === 'classify' && drawerException && (() => {
          const clScope = drawer.scopeIds;
          // The Actionable ID this classify will use: reuse one already on a scoped
          // case (keeps re-classify stable; a bulk set shares one), else the next free.
          const existingActionableId = drawerException.actionableId
            ?? clScope.map(id => exceptions.find(e => e.id === id)?.actionableId).find(Boolean);
          const plannedActionableId = existingActionableId ?? nextActionableId(exceptions);
          return (
          <ClassifyExceptionDrawer
            key="classify-drawer"
            exception={drawerException}
            onPostComment={(text, attachment) => postComment(text, drawer?.scopeIds ?? [drawerException.id], attachment)}
            actionableId={plannedActionableId}
            scopeCount={clScope.length}
            bulkSkipped={drawer.bulkSkipped}
            linkedCases={clScope.length > 1
              ? clScope
                  .map(id => exceptions.find(e => e.id === id))
                  .filter((e): e is GrcException => !!e)
                  .map(e => ({ id: e.id, title: e.title, classification: e.classification, statusLabel: statusLabelFor(e) }))
              : []}
            onClose={() => setDrawer(null)}
            onSave={(payload) => {
              const classification = payload.classification as GrcException['classification'];
              const nowIso = new Date().toISOString();
              const actionable = requiresActionPlan(classification);
              const plans = actionable ? (payload.actionPlans ?? []) : [];
              const first = plans[0];
              const scope = drawer?.scopeIds ?? [drawerException.id];
              // Actionable → all scoped cases share the planned Actionable ID; non-actionable clears it.
              const assignedActionableId = actionable ? plannedActionableId : undefined;

              // Bulk classify (>1 case) links the scoped cases into a bulk group:
              // they share a bulkId, carry the Bulk chip, and the group is registered
              // so every bulk-aware surface treats them as linked. For an actionable
              // classification the bulk group IS the management action plan, so it
              // reuses the shared Actionable ID — keeping the ID identical across the
              // classify panel, the bulk banner and the Mark Action Complete drawer.
              const isBulk = scope.length > 1;
              const bulkGroupId = isBulk
                ? (scope.map(id => exceptions.find(e => e.id === id)?.bulkId).find(Boolean)
                    ?? assignedActionableId
                    ?? `ACT${String(
                        (Object.keys(GRC_BULK_ACTIONS)
                          .map(k => parseInt(k.replace(/\D/g, ''), 10))
                          .filter(n => !Number.isNaN(n))
                          .reduce((a, b) => Math.max(a, b), 0)) + 1,
                      ).padStart(3, '0')}`)
                : undefined;
              if (isBulk && bulkGroupId) {
                GRC_BULK_ACTIONS[bulkGroupId] = {
                  id: bulkGroupId,
                  caseIds: [...scope],
                  title: first?.name?.trim() || `${classification} · bulk action`,
                };
              }
              const planNote = actionable
                ? ` · submitted ${plans.length} management action plan${plans.length === 1 ? '' : 's'} for review${first?.dueDate ? ` · due ${fmtDue(first.dueDate)}` : ''}`
                : ' · no action plan required';

              // ── Sync the Risk Owner's inputs into each scoped case's detail so the
              //    Auditor's Review Action drawer shows exactly what was entered. ──
              scope.forEach(id => {
                const target = exceptions.find(e => e.id === id);
                if (!target) return;
                const isReclassify = target.classification !== 'Unclassified';
                const detail: GrcCaseDetail = GRC_CASE_DETAILS[id] ?? {
                  classificationJustification: '', actionTitle: '', actionDueDate: '',
                  actionDescription: '', actionStatus: 'Pending', activityLog: [],
                };
                detail.classificationJustification = payload.comment ? `"${payload.comment}"` : detail.classificationJustification;
                detail.actionPlans = actionable ? plans : undefined;
                detail.actionTitle = actionable ? (first?.name || 'Action plan') : 'No action required · documented rationale';
                detail.actionDescription = actionable ? (first?.details || '') : '';
                detail.actionDueDate = actionable && first?.dueDate ? `Due ${fmtDue(first.dueDate)}` : '';
                detail.actionStatus = 'Pending';
                detail.activityLog = [{
                  id: `act-cls-${id}-${Date.now()}`,
                  author: 'You',
                  role: 'Risk Owner',
                  timestamp: fmtStamp(nowIso),
                  message: `${isReclassify ? 'Re-classified' : 'Classified'} as ${classification}${assignedActionableId ? ` · ${assignedActionableId}` : ''}${planNote}${bulkSuffix(scope.length)}`,
                  comment: payload.comment || undefined,
                }, ...detail.activityLog];
                GRC_CASE_DETAILS[id] = detail;
              });

              updateExceptions(prev => prev.map(e =>
                scope.includes(e.id)
                  ? {
                      ...e,
                      severity: payload.severity,
                      classification,
                      classificationReview: 'Approved' as const,
                      actionReview: 'Pending' as const, // (re)classifying hands it back to the Auditor
                      // Actionable plans go to plan-review (Auditor accepts the plan first);
                      // non-actionable cases have no plan stage.
                      actionPhase: actionable ? ('plan-review' as const) : undefined,
                      status: deriveStatus(classification, 'Pending', 'Pending'),
                      actionableId: assignedActionableId,
                      // A bulk classify links the cases (shared bulkId + Bulk chip).
                      bulkId: isBulk ? bulkGroupId : e.bulkId,
                      flags: isBulk
                        ? (e.flags?.includes('Bulk') ? e.flags : [...(e.flags ?? []), 'Bulk' as const])
                        : e.flags,
                      dueDate: (actionable && first?.dueDate) ? first.dueDate : (payload.dueDate ?? e.dueDate),
                      lastUpdated: nowIso.slice(0, 10),
                    }
                  : e
              ));
              const isReclassify = drawerException.classification !== 'Unclassified';
              logEvent({ action: 'Update', description: `${isReclassify ? 'Re-classified' : 'Classified'} ${scope.length > 1 ? `${scope.length} linked cases` : drawerException.id} as ${classification}${assignedActionableId ? ` (${assignedActionableId})` : ''}`, module: 'Exceptions', entity: 'Exception' });
              addToast({ type: 'success', message: scope.length > 1
                ? `Classified ${scope.length} linked cases as ${classification}${assignedActionableId ? ` · ${assignedActionableId}` : ''} — sent to the Auditor.`
                : actionable
                  ? (isReclassify ? `Re-classified — action plan ${assignedActionableId} sent to the Auditor.` : `Classified — action plan ${assignedActionableId} sent to the Auditor for review.`)
                  : 'Classified — sent to the Auditor for review.' });
              setDrawer(null);
            }}
          />
          );
        })()}
        {drawer?.type === 'requestDueDate' && drawerException && (
          <RequestDueDateDrawer
            key="request-duedate-drawer"
            exception={drawerException}
            onClose={() => setDrawer(null)}
            onSubmit={({ revisedDueDate, reason }) => {
              const nowIso = new Date().toISOString();
              const scope = drawer?.scopeIds ?? [drawerException.id];
              updateExceptions(list => list.map(e =>
                scope.includes(e.id)
                  ? {
                      ...e,
                      dueDateRevision: {
                        previousDueDate: e.dueDate ?? '', // each case keeps its own previous date
                        revisedDueDate,
                        reason,
                        status: 'Pending' as const,
                        requestedBy: 'You',
                        requestedAt: nowIso,
                      },
                      lastUpdated: nowIso.slice(0, 10),
                    }
                  : e
              ));
              scope.forEach(id => {
                const target = exceptions.find(e => e.id === id);
                const detail = GRC_CASE_DETAILS[id];
                if (!detail) return;
                detail.activityLog = [{
                  id: `act-dd-req-${id}-${Date.now()}`,
                  author: 'You',
                  role: 'Risk Owner',
                  timestamp: fmtStamp(nowIso),
                  message: `Requested revised due date: ${fmtDue(target?.dueDate)} → ${fmtDue(revisedDueDate)}${bulkSuffix(scope.length)}`,
                  comment: reason,
                }, ...detail.activityLog];
              });
              addToast({ type: 'success', message: scope.length > 1
                ? `Revised due date requested for ${scope.length} linked cases — sent to the auditor.`
                : 'Revised due date request sent to the auditor for approval.' });
              setDrawer(null);
            }}
          />
        )}
        {drawer?.type === 'reviewDueDate' && drawerException && (
          <ReviewDueDateDrawer
            key="review-duedate-drawer"
            exception={drawerException}
            onClose={() => setDrawer(null)}
            onDecision={(decision, comment) => {
              const nowIso = new Date().toISOString();
              const approved = decision === 'approve';
              const scope = drawer?.scopeIds ?? [drawerException.id];
              updateExceptions(list => list.map(e => {
                if (!scope.includes(e.id) || !e.dueDateRevision) return e;
                return {
                  ...e,
                  dueDate: approved ? e.dueDateRevision.revisedDueDate : e.dueDate,
                  dueDateRevision: {
                    ...e.dueDateRevision,
                    status: approved ? ('Approved' as const) : ('Rejected' as const),
                    decisionComment: comment || undefined,
                    decidedBy: 'You',
                    decidedAt: nowIso,
                  },
                  lastUpdated: nowIso.slice(0, 10),
                };
              }));
              scope.forEach(id => {
                const target = exceptions.find(e => e.id === id);
                const rev = target?.dueDateRevision; // each case applies its own revision dates
                const detail = GRC_CASE_DETAILS[id];
                if (!detail || !rev) return;
                detail.activityLog = [{
                  id: `act-dd-dec-${id}-${Date.now()}`,
                  author: 'You',
                  role: 'Auditor',
                  timestamp: fmtStamp(nowIso),
                  message: (approved
                    ? `Approved revised due date → ${fmtDue(rev.revisedDueDate)}`
                    : `Rejected revised due date request (stays ${fmtDue(rev.previousDueDate)})`) + bulkSuffix(scope.length),
                  comment: comment || undefined,
                }, ...detail.activityLog];
              });
              addToast({
                type: approved ? 'success' : 'info',
                message: scope.length > 1
                  ? (approved ? `Revised due dates approved for ${scope.length} linked cases.` : `Revised due date requests rejected for ${scope.length} linked cases.`)
                  : (approved ? 'Revised due date approved and applied.' : 'Revised due date request rejected.'),
              });
              setDrawer(null);
            }}
          />
        )}
        {drawer?.type === 'classification' && drawerException && (
          <ReviewClassificationDrawer
            key="classification-drawer"
            exception={drawerException}
            role={role}
            onPostComment={(text, attachment) => postComment(text, drawer?.scopeIds ?? [drawerException.id], attachment)}
            onClose={() => setDrawer(null)}
            onDecision={() => setDrawer(null)}
          />
        )}
        {drawer?.type === 'action' && drawerException && (
          <ReviewCaseDrawer
            key="action-drawer"
            exception={drawerException}
            role={role}
            onPostComment={(text, attachment) => postComment(text, drawer?.scopeIds ?? [drawerException.id], attachment)}
            onClose={() => setDrawer(null)}
            onDecision={(decision, { implementation, comment }) => {
              const nowIso = new Date().toISOString();
              const approved = decision === 'approve';
              const actionable = requiresActionPlan(drawerException.classification);
              const phase = drawerException.actionPhase;
              const scope = drawer?.scopeIds ?? [drawerException.id];
              const scopeLabel = scope.length > 1 ? `${scope.length} linked cases` : drawerException.id;
              // One decision applies to every scoped case (eligibility kept them in the same stage).
              const pushLogAll = (message: string) => {
                scope.forEach(id => {
                  const d = GRC_CASE_DETAILS[id];
                  if (!d) return;
                  d.activityLog = [{
                    id: `act-rev-${id}-${Date.now()}`,
                    author: 'You', role: 'Auditor', timestamp: fmtStamp(nowIso),
                    message: message + bulkSuffix(scope.length),
                    comment: comment || undefined,
                  }, ...d.activityLog];
                });
              };

              // ── Stage 1 · Plan review — Auditor accepts/rejects the management action plan ──
              if (actionable && phase === 'plan-review') {
                if (approved) {
                  updateExceptions(list => list.map(e => scope.includes(e.id)
                    ? { ...e, actionPhase: 'in-progress' as const, status: deriveStatus(e.classification, 'Pending', 'Pending'), lastUpdated: nowIso.slice(0, 10) }
                    : e));
                  pushLogAll('Accepted the management action plan — Risk Owner to implement before the due date.');
                  addToast({ type: 'success', message: scope.length > 1 ? `Plan accepted for ${scope.length} linked cases — handed back to the Risk Owner.` : 'Management action plan accepted — handed back to the Risk Owner.' });
                } else {
                  scope.forEach(id => { const d = GRC_CASE_DETAILS[id]; if (d) d.actionStatus = 'Discrepancy'; });
                  updateExceptions(list => list.map(e => scope.includes(e.id)
                    ? { ...e, actionReview: 'Rejected' as const, actionPhase: undefined, status: deriveStatus(e.classification, 'Rejected', 'Discrepancy'), lastUpdated: nowIso.slice(0, 10) }
                    : e));
                  pushLogAll('Rejected the management action plan — reopened for the Risk Owner to revise.');
                  addToast({ type: 'info', message: scope.length > 1 ? `Plan rejected for ${scope.length} linked cases — reopened for the Risk Owner.` : 'Plan rejected — reopened for the Risk Owner.' });
                }
                logEvent({ action: 'Update', description: `Plan review ${scopeLabel}: ${approved ? 'Accepted' : 'Rejected'}`, module: 'Exceptions', entity: 'Exception' });
                setDrawer(null);
                return;
              }

              // ── Stage 2 · Completion review (actionable) / classification review (non-actionable) ──
              const actionReview: GrcReviewStatus = approved ? 'Approved' : 'Rejected';
              const newActionStatus: GrcActionStatus = approved
                ? (actionable ? (implementation ?? 'Implemented') : 'Implemented')
                : 'Discrepancy';
              scope.forEach(id => { const d = GRC_CASE_DETAILS[id]; if (d) d.actionStatus = newActionStatus; });
              // Partially implemented → stays with the Risk Owner to finish; otherwise the stage is done.
              const nextPhase = (approved && actionable && implementation === 'Partially Implemented') ? ('in-progress' as const) : undefined;
              updateExceptions(list => list.map(e => scope.includes(e.id)
                ? { ...e, actionReview, actionPhase: nextPhase, status: deriveStatus(e.classification, actionReview, newActionStatus), lastUpdated: nowIso.slice(0, 10) }
                : e));
              pushLogAll(approved
                ? (actionable ? `Reviewed the completed action — ${implementation ?? 'Implemented'}` : 'Approved the classification — no action plan required')
                : (actionable ? 'Marked the completed action as Discrepancy — reopened for the Risk Owner' : 'Rejected the classification — back to the Risk Owner'));
              logEvent({ action: 'Update', description: `Reviewed ${scopeLabel}: ${approved ? (implementation ?? 'Approved') : 'Rejected'}`, module: 'Exceptions', entity: 'Exception' });
              addToast({ type: approved ? 'success' : 'info', message: scope.length > 1
                ? (approved ? (nextPhase ? `Partially implemented — ${scope.length} linked cases back to the Risk Owner.` : `Action review approved for ${scope.length} linked cases.`) : `Reopened ${scope.length} linked cases for the Risk Owner.`)
                : (approved ? (nextPhase ? 'Marked partially implemented — back to the Risk Owner to finish.' : 'Action review approved — case closed.') : 'Reopened for the Risk Owner.') });
              setDrawer(null);
            }}
            onViewBulk={(bulkId) => setBulkModalId(bulkId)}
          />
        )}
        {drawer?.type === 'complete' && drawerException && (() => {
          const scopeIds = drawer?.scopeIds ?? [drawerException.id];
          const linkedCases = scopeIds.length > 1
            ? scopeIds
                .map(id => exceptions.find(e => e.id === id))
                .filter((e): e is GrcException => !!e)
                .map(e => ({ id: e.id, title: e.title, classification: e.classification, statusLabel: statusLabelFor(e) }))
            : [];
          return (
          <CompleteActionDrawer
            key="complete-drawer"
            exception={drawerException}
            bulkId={drawerException.bulkId}
            linkedCases={linkedCases}
            onPostComment={(text, attachment) => postComment(text, drawer?.scopeIds ?? [drawerException.id], attachment)}
            onClose={() => setDrawer(null)}
            onSubmit={({ note, evidence, implementation, comment }) => {
              const nowIso = new Date().toISOString();
              const scope = drawer?.scopeIds ?? [drawerException.id];
              const evNote = evidence.length ? ` · ${evidence.length} evidence file${evidence.length === 1 ? '' : 's'} attached` : '';
              scope.forEach(id => {
                const detail = GRC_CASE_DETAILS[id];
                if (!detail) return;
                detail.completion = { note, evidence, completedAt: fmtStamp(nowIso), selfAssessment: implementation };
                detail.activityLog = [{
                  id: `act-done-${id}-${Date.now()}`,
                  author: 'You',
                  role: 'Risk Owner',
                  timestamp: fmtStamp(nowIso),
                  message: `Reported the action as ${implementation}${evNote} — submitted to the Auditor for review${bulkSuffix(scope.length)}`,
                  comment: comment || note || undefined,
                }, ...detail.activityLog];
              });
              updateExceptions(list => list.map(e => scope.includes(e.id)
                ? { ...e, actionPhase: 'completion-review' as const, status: deriveStatus(e.classification, 'Pending', 'Pending'), lastUpdated: nowIso.slice(0, 10) }
                : e));
              logEvent({ action: 'Update', description: `Marked ${scope.length > 1 ? `${scope.length} linked cases` : drawerException.id} action complete — Risk Owner reports ${implementation}`, module: 'Exceptions', entity: 'Exception' });
              addToast({ type: 'success', message: scope.length > 1
                ? `Submitted ${scope.length} linked cases to the Auditor — you reported "${implementation}".`
                : `Submitted to the Auditor for review — you reported "${implementation}".` });
              setDrawer(null);
            }}
          />
          );
        })()}
        {scopeChooser && (() => {
          const opened = exceptions.find(e => e.id === scopeChooser.exceptionId);
          if (!opened || !opened.bulkId) return null;
          const group = GRC_BULK_ACTIONS[opened.bulkId];
          return (
            <BulkScopeChooser
              key="scope-chooser"
              groupId={opened.bulkId}
              groupTitle={group?.title ?? ''}
              actionLabel={ACTION_LABEL[scopeChooser.type]}
              openedId={opened.id}
              candidates={scopeChooser.candidates}
              onClose={() => setScopeChooser(null)}
              onConfirm={(ids) => openDrawerWithScope(scopeChooser.type, opened, ids)}
            />
          );
        })()}
        {bulkReview && (
          <BulkReviewDrawer
            key="bulk-review-drawer"
            cases={bulkReview.cases}
            skipped={bulkReview.skipped}
            onClose={() => setBulkReview(null)}
            onSubmit={applyBulkReview}
          />
        )}
        {bulkModalId && (
          <BulkActionGroupModal
            key="bulk-modal"
            bulkId={bulkModalId}
            onClose={() => setBulkModalId(null)}
          />
        )}
        {sampleModalOpen && (
          <SampleDataModal
            key="sample-modal"
            defaultName={`Sample Data ${6 - sampleCountLeft}`}
            availableCount={sampleCountLeft}
            totalCount={5}
            onClose={() => setSampleModalOpen(false)}
            onCreate={(payload) => {
              const id = `sheet-${Date.now()}`;
              setSampleSheets(prev => [...prev, { id, name: payload.name, payload }]);
              setActiveSheetId(id);
              setSampleCountLeft(c => Math.max(0, c - 1));
              setSampleModalOpen(false);
              addToast({ type: 'success', message: `Sample sheet "${payload.name}" has been created` });
            }}
          />
        )}
        {bulkRequestDueOpen && bulkRequestEligible.length > 0 && (
          <BulkRequestDueDateDrawer
            key="bulk-request-duedate-drawer"
            exceptions={bulkRequestEligible}
            onClose={() => setBulkRequestDueOpen(false)}
            onSubmit={({ revisedDueDate, reason }) => {
              const nowIso = new Date().toISOString();
              const ids = bulkRequestEligible.map(e => e.id);
              updateExceptions(prev => prev.map(e =>
                ids.includes(e.id)
                  ? {
                      ...e,
                      dueDateRevision: {
                        previousDueDate: e.dueDate ?? '',
                        revisedDueDate,
                        reason,
                        status: 'Pending' as const,
                        requestedBy: 'You',
                        requestedAt: nowIso,
                      },
                      lastUpdated: nowIso.slice(0, 10),
                    }
                  : e
              ));
              ids.forEach(id => {
                const detail = GRC_CASE_DETAILS[id];
                if (!detail) return;
                detail.activityLog = [{
                  id: `act-dd-req-${id}-${Date.now()}`,
                  author: 'You',
                  role: 'Risk Owner',
                  timestamp: fmtStamp(nowIso),
                  message: `Requested revised due date → ${fmtDue(revisedDueDate)}`,
                  comment: reason,
                }, ...detail.activityLog];
              });
              addToast({ type: 'success', message: `Revised due date requested for ${ids.length} case${ids.length === 1 ? '' : 's'} — sent to the auditor.` });
              setSelected(new Set());
              setBulkRequestDueOpen(false);
            }}
          />
        )}
        {bulkReviewDueOpen && bulkReviewEligible.length > 0 && (
          <BulkReviewDueDateDrawer
            key="bulk-review-duedate-drawer"
            exceptions={bulkReviewEligible}
            onClose={() => setBulkReviewDueOpen(false)}
            onDecision={(decision, comment) => {
              const nowIso = new Date().toISOString();
              const approved = decision === 'approve';
              const ids = bulkReviewEligible.map(e => e.id);
              updateExceptions(prev => prev.map(e => {
                if (!ids.includes(e.id) || !e.dueDateRevision) return e;
                return {
                  ...e,
                  dueDate: approved ? e.dueDateRevision.revisedDueDate : e.dueDate,
                  dueDateRevision: {
                    ...e.dueDateRevision,
                    status: approved ? ('Approved' as const) : ('Rejected' as const),
                    decisionComment: comment || undefined,
                    decidedBy: 'You',
                    decidedAt: nowIso,
                  },
                  lastUpdated: nowIso.slice(0, 10),
                };
              }));
              ids.forEach(id => {
                const detail = GRC_CASE_DETAILS[id];
                const ex = bulkReviewEligible.find(e => e.id === id);
                if (!detail || !ex?.dueDateRevision) return;
                detail.activityLog = [{
                  id: `act-dd-dec-${id}-${Date.now()}`,
                  author: 'You',
                  role: 'Auditor',
                  timestamp: fmtStamp(nowIso),
                  message: approved
                    ? `Approved revised due date → ${fmtDue(ex.dueDateRevision.revisedDueDate)}`
                    : `Rejected revised due date request (stays ${fmtDue(ex.dueDateRevision.previousDueDate)})`,
                  comment: comment || undefined,
                }, ...detail.activityLog];
              });
              addToast({
                type: approved ? 'success' : 'info',
                message: approved
                  ? `Approved ${ids.length} revised due date${ids.length === 1 ? '' : 's'}.`
                  : `Rejected ${ids.length} due date request${ids.length === 1 ? '' : 's'}.`,
              });
              setSelected(new Set());
              setBulkReviewDueOpen(false);
            }}
          />
        )}
        {(bulkAssignOpen || singleAssignCase) && (
          <BulkAssignDrawer
            key={singleAssignCase ? `single-assign-${singleAssignCase.id}` : 'bulk-assign-drawer'}
            cases={singleAssignCase ? [singleAssignCase] : exceptions.filter(e => selected.has(e.id))}
            initialAssignees={singleAssignCase ? (singleAssignCase.assignees ?? (singleAssignCase.assignedTo ? [singleAssignCase.assignedTo] : [])) : undefined}
            onClose={() => { setBulkAssignOpen(false); setSingleAssignCase(null); }}
            onApply={(payload: BulkAssignPayload) => {
              if (payload.assignees.length === 0) return;
              const today = new Date().toISOString().slice(0, 10);
              // Update the exceptions — assignees only; assignedTo is no longer
              // written by new flows (kept on the type for back-compat reads).
              updateExceptions(prev => prev.map(e =>
                payload.caseIds.includes(e.id)
                  ? {
                      ...e,
                      assignees: payload.assignees,
                      lastUpdated: today,
                    }
                  : e
              ));
              // Append an activity-log entry per assigned case so the
              // assignment + note are auditable in the Review drawer's
              // Activity Log.
              const assigneeNames = payload.assignees.map(a => a.name).join(', ');
              const nowIso = new Date().toISOString();
              payload.caseIds.forEach(caseId => {
                const detail = GRC_CASE_DETAILS[caseId];
                if (!detail) return;
                const wasAssigned = (() => {
                  const tgt = exceptions.find(e => e.id === caseId);
                  return !!(tgt?.assignees && tgt.assignees.length > 0) || !!tgt?.assignedTo;
                })();
                const entry: GrcActivityEntry = {
                  id: `act-assign-${caseId}-${Date.now()}`,
                  author: 'You',
                  role: role === 'risk-owner' ? 'Risk Owner' : 'Auditor',
                  timestamp: fmtStamp(nowIso),
                  message: `${wasAssigned ? 'Reassigned' : 'Assigned'} to ${assigneeNames}`,
                  comment: payload.note,
                };
                detail.activityLog = [entry, ...detail.activityLog];
              });
              const firstName = payload.assignees[0].name;
              const assigneeLabel =
                payload.assignees.length === 1
                  ? firstName
                  : `${firstName} and ${payload.assignees.length - 1} other${payload.assignees.length - 1 === 1 ? '' : 's'}`;
              addToast({
                type: 'success',
                message: `${payload.caseIds.length} case${payload.caseIds.length === 1 ? '' : 's'} assigned to ${assigneeLabel}`,
              });
              logEvent({ action: 'Update', description: `Assigned ${payload.caseIds.length} exception${payload.caseIds.length === 1 ? '' : 's'} to ${assigneeNames}`, module: 'Exceptions', entity: 'Exception' });
              // Only clear the selection set when the bulk drawer was the one
              // that opened — single-row assigns don't touch the selection.
              if (!singleAssignCase) setSelected(new Set());
              setBulkAssignOpen(false);
              setSingleAssignCase(null);
            }}
          />
        )}
        {detailExceptionId && (() => {
          const ex = exceptions.find(e => e.id === detailExceptionId);
          if (!ex) return null;
          return (
            <ExceptionDetailDrawer
              key="exception-detail-drawer"
              exception={ex}
              extraColumns={undefined}
              role={role}
              onAction={(kind, target) => { setDetailExceptionId(null); runExceptionAction(kind, target); }}
              onComment={(text, attachment) => postComment(text, [ex.id], attachment)}
              onClose={() => setDetailExceptionId(null)}
            />
          );
        })()}
        {activityDrawerOpen && (
          <ActivityTimelineDrawer
            key="activity-timeline-drawer"
            onClose={() => setActivityDrawerOpen(false)}
          />
        )}
        {atrModalOpen && (
          <GenerateATRModal
            key="atr-modal"
            onClose={() => setAtrModalOpen(false)}
          />
        )}
        {commentModalOpen && (
          <div key="bulk-comment-modal">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] z-50"
              onClick={() => setCommentModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: 8 }}
              transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-32px)] max-w-[520px] bg-canvas-elevated shadow-xl border border-canvas-border rounded-[16px] z-[60] flex flex-col"
              role="dialog" aria-label="Comment on selected cases"
            >
              <header className="shrink-0 px-6 pt-5 pb-4 flex items-start justify-between gap-4 border-b border-canvas-border">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center gap-1.5 h-5 px-2 text-[10.5px] font-semibold bg-brand-50 text-brand-700 rounded-full"><MessageSquare size={11} /> Bulk</span>
                    <h2 className="font-display text-[18px] font-semibold text-ink-900 tracking-tight">Comment on {selected.size} case{selected.size === 1 ? '' : 's'}</h2>
                  </div>
                  <p className="text-[12.5px] text-ink-500 leading-snug">
                    Posts to every selected case as the {personaName(persona)}. The {personaName(persona === 'risk-owner' ? 'auditor' : 'risk-owner')} will be notified and can reply on each case.
                  </p>
                </div>
                <button onClick={() => setCommentModalOpen(false)} className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer shrink-0" aria-label="Close"><X size={16} /></button>
              </header>
              <div className="px-6 py-5">
                <label htmlFor="bulk-comment" className="sr-only">Comment</label>
                <textarea
                  id="bulk-comment"
                  autoFocus
                  value={bulkCommentText}
                  onChange={(e) => setBulkCommentText(e.target.value)}
                  onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && bulkCommentText.trim()) { e.preventDefault(); postComment(bulkCommentText, [...selected]); setCommentModalOpen(false); } }}
                  rows={4}
                  placeholder="Write a comment for the selected cases…"
                  className="w-full resize-y rounded-[8px] border border-canvas-border bg-canvas-elevated px-3 py-2.5 text-[13px] text-ink-900 leading-relaxed placeholder:text-ink-400 focus:outline-none focus:border-brand-600 focus:ring-[3px] focus:ring-brand-600/20 transition-colors"
                />
              </div>
              <footer className="shrink-0 px-6 py-4 border-t border-canvas-border flex items-center justify-end gap-3">
                <button type="button" onClick={() => setCommentModalOpen(false)} className="h-9 px-5 text-[13px] font-medium text-ink-700 bg-canvas-elevated border border-canvas-border rounded-[8px] hover:bg-[#F4F2F7] cursor-pointer transition-colors">Cancel</button>
                <button
                  type="button"
                  disabled={!bulkCommentText.trim()}
                  onClick={() => { postComment(bulkCommentText, [...selected]); setCommentModalOpen(false); }}
                  className="inline-flex items-center gap-1.5 h-9 px-4 text-[13px] font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-[8px] cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send size={14} /> Post comment
                </button>
              </footer>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
    {/* Assignment modal — opened from the "Assign to Workflow" header button. */}
    <AssignmentModal />
    </WorkflowProvider>
  );
}

