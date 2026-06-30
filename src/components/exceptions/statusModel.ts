// ─── Exceptions & Cases — single source of truth for the status state machine ───
// Encodes the Classification → Action Review → Status rules so every surface
// (table, KPIs, drawers, mutations) stays consistent.
//
//   Classification (Risk Owner sets):
//     Design / System Deficiency, Procedural Non-Compliance → Action Plan + Due Date required
//     Business as Usual, False Positive                      → no Action Plan required
//     Unclassified                                           → not yet classified
//
//   Action Review (Auditor sets):
//     Actionable   → Approved (Implemented) | Approved (Partially Implemented) | Rejected (Discrepancy)
//     Non-action   → Approved | Rejected
//     Either       → Under Review (classified, awaiting the auditor)
//
//   Status (derived):
//     Closed       ← Approved (Implemented) | Approved (no ATR needed)
//     In-Progress  ← classified & Under Review | Approved (Partially Implemented) | Rejected (non-action)
//     Open         ← Unclassified (no action yet) | Rejected (Discrepancy)
import type {
  GrcExceptionClassification, GrcExceptionStatus, GrcActionStatus, GrcException,
} from '../../data/mockData';

export const NO_PLAN_CLASSIFICATIONS = new Set<GrcExceptionClassification>([
  'Business as Usual',
  'False Positive',
]);

export const ACTIONABLE_CLASSIFICATIONS = new Set<GrcExceptionClassification>([
  'Design Deficiency',
  'System Deficiency',
  'Procedural Non-Compliance',
  'Others',
]);

/** Does this classification need an action plan + due date? */
export function requiresActionPlan(classification: string): boolean {
  return ACTIONABLE_CLASSIFICATIONS.has(classification as GrcExceptionClassification);
}

// Combined Action Review — folds the auditor decision and implementation
// outcome into one label, branching on whether the classification is actionable.
export type CombinedActionReview =
  | 'Pending'
  | 'Approved (Implemented)'
  | 'Approved (Partially Implemented)'
  | 'Rejected (Discrepancy)'
  | 'Approved'
  | 'Rejected';

type ActionReviewBase = 'Pending' | 'Approved' | 'Rejected';

// Legacy mock data sometimes stores 'Implemented' in actionReview — normalise.
export function normaliseActionReview(v: string): ActionReviewBase {
  if (v === 'Approved' || v === 'Rejected' || v === 'Pending') return v;
  if (v === 'Implemented') return 'Approved';
  return 'Pending';
}

export function combineActionReview(
  actionReview: string,
  actionStatus: GrcActionStatus,
  classification: string,
): CombinedActionReview {
  const norm = normaliseActionReview(actionReview);
  if (NO_PLAN_CLASSIFICATIONS.has(classification as GrcExceptionClassification)) {
    if (norm === 'Pending') return 'Pending';
    if (norm === 'Rejected') return 'Rejected';
    return 'Approved';
  }
  if (norm === 'Rejected' || actionStatus === 'Discrepancy') return 'Rejected (Discrepancy)';
  if (norm === 'Pending') return 'Pending';
  if (actionStatus === 'Partially Implemented') return 'Approved (Partially Implemented)';
  return 'Approved (Implemented)';
}

// A classified case awaiting the auditor's decision renders as 'Pending Review'.
export const COMBINED_REVIEW_LABEL: Record<CombinedActionReview, string> = {
  'Pending':                          'Pending Review',
  'Approved (Implemented)':           'Approved (Implemented)',
  'Approved (Partially Implemented)': 'Approved (Partially Implemented)',
  'Rejected (Discrepancy)':           'Rejected (Discrepancy)',
  'Approved':                         'Approved',
  'Rejected':                         'Rejected',
};

export const COMBINED_REVIEW_STYLE: Record<CombinedActionReview, string> = {
  'Pending':                          'bg-[#EEEEF1] text-ink-600',
  'Approved (Implemented)':           'bg-compliant-50 text-compliant-700',
  'Approved (Partially Implemented)': 'bg-mitigated-50 text-mitigated-700',
  'Rejected (Discrepancy)':           'bg-risk-50 text-risk-700',
  'Approved':                         'bg-compliant-50 text-compliant-700',
  'Rejected':                         'bg-risk-50 text-risk-700',
};

// ─── Persona-aware next actions ───────────────────────────────────────────
// The single source of truth behind both the Exceptions-table row CTAs and the
// deep-dive drawer's action buttons, so the Action Hub and the Exceptions tab
// always offer the same next step for a given persona + case state. The actual
// action (and its activity logging) is the shared drawer the caller opens.
export type ExceptionActionKind =
  | 'classify' | 'reclassify' | 'markComplete'
  | 'reviewClassification' | 'reviewPlan' | 'reviewAction' | 'review';

export interface ExceptionAction {
  kind: ExceptionActionKind;
  label: string;
}

/** The actionable next steps a persona can take on an exception right now.
 *  Empty array → the persona can only view. Mirrors ExceptionsTable's CTAs. */
export function exceptionActionsFor(
  ex: Pick<GrcException, 'classification' | 'actionReview' | 'actionPhase' | 'classificationReview'>,
  role: 'risk-owner' | 'auditor',
): ExceptionAction[] {
  const actionable = ACTIONABLE_CLASSIFICATIONS.has(ex.classification);

  if (role === 'risk-owner') {
    if (ex.classification === 'Unclassified') return [{ kind: 'classify', label: 'Classify' }];
    if (ex.actionReview === 'Rejected') return [{ kind: 'reclassify', label: 'Re-Classify' }];
    if (ex.actionPhase === 'in-progress') return [{ kind: 'markComplete', label: 'Mark Complete' }];
    return [];
  }

  // Auditor — may review a pending classification and/or the plan/action.
  const actions: ExceptionAction[] = [];
  if (ex.classificationReview === 'Pending' && ex.classification !== 'Unclassified') {
    actions.push({ kind: 'reviewClassification', label: 'Review Classification' });
  }
  const phase = ex.actionPhase;
  const planStage = phase === 'plan-review'
    || (actionable && !phase && ex.actionReview === 'Pending' && ex.classification !== 'Unclassified');
  if (phase === 'completion-review') actions.push({ kind: 'reviewAction', label: 'Review Action' });
  else if (planStage) actions.push({ kind: 'reviewPlan', label: 'Review Plan' });
  else if (!actionable && ex.actionReview === 'Pending' && ex.classification !== 'Unclassified') {
    actions.push({ kind: 'review', label: 'Review' });
  }
  return actions;
}

// ─── Auditor review stage ──────────────────────────────────────────────────
// Which review the Auditor owes on a case *right now* — the basis for both the
// single Review drawer and the Bulk Review flow. Derived from exceptionActionsFor
// so it can never drift from the table CTAs. Returns null when there is nothing
// for the Auditor to review (unclassified, awaiting the Risk Owner, or decided).
//   plan           → accept/reject the management action plan
//   completion     → review the completed Action Taken + implementation outcome
//   classification → approve/reject a non-actionable disposition (BAU / False Positive)
export type AuditorReviewStage = 'plan' | 'completion' | 'classification';

export function auditorReviewStage(
  ex: Pick<GrcException, 'classification' | 'actionReview' | 'actionPhase' | 'classificationReview'>,
): AuditorReviewStage | null {
  const a = exceptionActionsFor(ex, 'auditor').find(
    x => x.kind === 'reviewPlan' || x.kind === 'reviewAction' || x.kind === 'review',
  );
  if (!a) return null;
  if (a.kind === 'reviewAction') return 'completion';
  if (a.kind === 'reviewPlan') return 'plan';
  return 'classification';
}

// ─── Actionable ID generation ──────────────────────────────────────────────
// An exception classified as an actionable type gets an Actionable ID — the
// identifier its management action plan is tracked under. IDs are sequential
// (ACT-0001, ACT-0002, …); cases classified together in one bulk action share
// a single ID. nextActionableId returns the next free ID given the live set.
export function nextActionableId(items: { actionableId?: string }[]): string {
  let max = 0;
  for (const it of items) {
    const n = it.actionableId ? parseInt(it.actionableId.replace(/\D/g, ''), 10) : NaN;
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return `ACT-${String(max + 1).padStart(4, '0')}`;
}

// ─── Bulk-action scope eligibility ─────────────────────────────────────────
// When a single action is taken on an exception that belongs to a bulk group,
// the scope chooser offers the linked cases. A linked member is only offered if
// the same action validly applies to it right now — these predicates decide that,
// reusing exceptionActionsFor so the rules never drift from the table CTAs.
export type DrawerActionType =
  | 'classify' | 'classification' | 'action' | 'complete' | 'requestDueDate' | 'reviewDueDate';

const ACTION_FAMILY: ExceptionActionKind[] = ['reviewPlan', 'reviewAction', 'review'];

/** The auditor 'action'-drawer stage a case is currently at, or null. Lets the
 *  scope chooser only group members that are at the SAME stage as the opened case
 *  (so one Accept/Reject can't be misapplied across plan- vs completion-review). */
function auditorActionStage(ex: GrcException): ExceptionActionKind | null {
  return exceptionActionsFor(ex, 'auditor').find(a => ACTION_FAMILY.includes(a.kind))?.kind ?? null;
}

/** Is `member` a valid target for `type` right now, for the given persona?
 *  `opened` (the case the user clicked) is only used to phase-match the 'action'
 *  drawer so the same decision applies cleanly to every selected member. */
export function isMemberEligibleForDrawer(
  member: GrcException,
  type: DrawerActionType,
  role: 'risk-owner' | 'auditor',
  opened?: GrcException,
): boolean {
  switch (type) {
    case 'classify':
      return exceptionActionsFor(member, 'risk-owner').some(a => a.kind === 'classify' || a.kind === 'reclassify');
    case 'classification':
      return exceptionActionsFor(member, 'auditor').some(a => a.kind === 'reviewClassification');
    case 'action': {
      const memberStage = auditorActionStage(member);
      const openedStage = opened ? auditorActionStage(opened) : null;
      return memberStage !== null && (openedStage === null || memberStage === openedStage);
    }
    case 'complete':
      return exceptionActionsFor(member, 'risk-owner').some(a => a.kind === 'markComplete');
    case 'requestDueDate':
      return role === 'risk-owner'
        && ACTIONABLE_CLASSIFICATIONS.has(member.classification)
        && !!member.dueDate
        && member.dueDateRevision?.status !== 'Pending';
    case 'reviewDueDate':
      return role === 'auditor' && member.dueDateRevision?.status === 'Pending';
    default:
      return false;
  }
}

/**
 * Derive the case Status from its classification and action-review state.
 * Returns the stored enum value ('Under Review' shows as 'In-Progress').
 */
export function deriveStatus(
  classification: GrcExceptionClassification,
  actionReview: string,
  actionStatus: GrcActionStatus,
): GrcExceptionStatus {
  // No action taken yet.
  if (classification === 'Unclassified') return 'Open';

  const combined = combineActionReview(actionReview, actionStatus, classification);
  switch (combined) {
    case 'Approved (Implemented)':
    case 'Approved':                          // BAU / False Positive — no ATR needed
      return 'Closed';
    case 'Rejected (Discrepancy)':            // reopens at the Risk Owner's end
      return 'Open';
    case 'Approved (Partially Implemented)':
    case 'Rejected':                          // non-action reject — back to Risk Owner
    case 'Pending':                           // classified, awaiting the auditor
    default:
      return 'Under Review';                  // shown as In-Progress
  }
}
