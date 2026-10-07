import type { AtrObservation, AtrActionPlan, AtrCloseout } from './atrTypes';
import type { AtrEvent, AtrEventKind, AtrEventPatch, AtrEventRole } from './atrTimeline';

// ─── The close-out state machine ───
// One observation, two people. The auditor assigns it and signs things off; the
// risk owner calls it, plans it and does it. The phase is *derived* from the
// observation — there is no separate status to drift out of step with the data.
//
//   unassigned  → auditor assigns a risk owner
//   classify    → RO: True Exception (sub-class + ≥1 plan) or False Positive (reason)
//   fp-review   → a False Positive claims there is nothing to fix, so the
//                 auditor signs that off before it closes anything
//   plan-review → auditor approves or rejects each plan
//   replan      → a plan was rejected: back with the RO to revise and resubmit
//   in-progress → RO records what was actually done on each approved plan
//   action-review → auditor accepts (Implemented / Partially) or rejects with a reason
//   closed      → every plan Implemented, or a False Positive
//
// Rejection never parks the observation with the person who rejected it. A
// rejected plan reopens at the risk owner (replan); rejected *action* clears
// what was recorded, which drops the phase back to in-progress on its own.

export type CloseoutPhase = 'unassigned' | 'classify' | 'fp-review' | 'plan-review' | 'replan' | 'in-progress' | 'action-review' | 'closed';
export type CloseoutRole = 'auditor' | 'owner';

/** Whose move it is in each phase — drives the role toggle's "needs you" dot. */
export const PHASE_ACTOR: Record<CloseoutPhase, CloseoutRole | null> = {
  unassigned: 'auditor',
  classify: 'owner',
  'fp-review': 'auditor',
  'plan-review': 'auditor',
  replan: 'owner',
  'in-progress': 'owner',
  'action-review': 'auditor',
  closed: null,
};

/** One line saying what is happening now, in the panel header. */
export const PHASE_TEXT: Record<CloseoutPhase, string> = {
  unassigned: 'Not assigned yet — the auditor picks a risk owner.',
  classify: 'With the risk owner to classify — true exception or false positive.',
  'fp-review': 'With the auditor to accept or reject the false-positive call.',
  'plan-review': 'With the auditor to approve the action plan.',
  replan: 'Sent back — with the risk owner to revise the action plan and resubmit it.',
  'in-progress': 'With the risk owner to carry out the plan and record what was done.',
  'action-review': 'With the auditor to review the action taken.',
  closed: 'Closed.',
};

export const PHASE_LABEL: Record<CloseoutPhase, string> = {
  unassigned: 'Assign', classify: 'Classify', 'fp-review': 'Review false positive',
  'plan-review': 'Approve plan', replan: 'Revise plan',
  'in-progress': 'Action taken', 'action-review': 'Review action', closed: 'Closed',
};

/** The plans the close-out journey raised, with where each sits in the
 *  observation's own list — so an event can patch the right one. The report's
 *  generated plans are the document's content, not this journey's work, and the
 *  panel leaves them alone. */
export function closeoutPlans(o: AtrObservation): { plans: AtrActionPlan[]; planIdx: number[] } {
  const all = o.actionPlans ?? [];
  const planIdx = all.map((p, i) => (p.closeout ? i : -1)).filter(i => i >= 0);
  return { plans: planIdx.map(i => all[i]), planIdx };
}

/** Which escalation matrix chases this plan: its own when it names one — a plan
 *  owned by another department — otherwise the observation's. Undefined means
 *  nothing is chasing it yet. */
export const resolveMatrixId = (co: AtrCloseout, plan?: AtrActionPlan): string | undefined =>
  plan?.escalationMatrixId ?? co.escalationMatrixId;

export const planApproved = (p: AtrActionPlan) => p.planReview === 'Approved';
/** Sent back by the auditor — the risk owner owns it again until they resubmit. */
export const planRejected = (p: AtrActionPlan) => p.planReview === 'Rejected';
export const planActed = (p: AtrActionPlan) => !!p.actionTaken?.trim();
export const planSettled = (p: AtrActionPlan) => p.status === 'Implemented';

/** Where this observation has got to. */
export function closeoutPhase(o: AtrObservation): CloseoutPhase {
  const { plans } = closeoutPlans(o);
  const co = o.closeout;
  if (!co?.owner) return 'unassigned';
  if (!co.verdict) return 'classify';
  if (co.verdict === 'False Positive') {
    // Nothing closes on the risk owner's word alone.
    if (co.fpReview === 'Approved') return 'closed';
    if (co.fpReview === 'Rejected') return 'classify';
    return 'fp-review';
  }
  // A true exception is not classified until it carries at least one plan.
  if (plans.length === 0) return 'classify';
  // A rejection is the auditor's move already made — it belongs to the owner now.
  if (plans.some(planRejected)) return 'replan';
  if (plans.some(p => p.planReview !== 'Approved')) return 'plan-review';
  if (plans.some(p => !planActed(p))) return 'in-progress';
  if (plans.every(planSettled)) return 'closed';
  return 'action-review';
}

export interface CloseoutState {
  phase: CloseoutPhase;
  /** Whose move it is, or null when it is finished. */
  actor: CloseoutRole | null;
  plans: AtrActionPlan[];
  /** Where each of `plans` sits in the observation's own `actionPlans`. */
  planIdx: number[];
  /** What the journey has recorded so far — never the report's own fields. */
  co: AtrCloseout;
  closed: boolean;
  falsePositive: boolean;
}

export function closeoutState(o: AtrObservation): CloseoutState {
  const phase = closeoutPhase(o);
  const { plans, planIdx } = closeoutPlans(o);
  return {
    phase,
    actor: PHASE_ACTOR[phase],
    plans,
    planIdx,
    co: o.closeout ?? {},
    closed: phase === 'closed',
    // Only a signed-off false positive reads as one; a rejected call is back
    // with the risk owner and the observation is still live.
    falsePositive: o.closeout?.verdict === 'False Positive' && o.closeout?.fpReview === 'Approved',
  };
}

/** How many moves are outstanding on this observation — one for a decision the
 *  whole observation needs, or one per action plan still waiting on someone.
 *  Zero once it is closed. This is the number on the report's Manage CTA. */
export function pendingActions(o: AtrObservation): number {
  const st = closeoutState(o);
  switch (st.phase) {
    case 'unassigned':
    case 'classify':
    case 'fp-review':
      return 1;
    case 'plan-review':
      return st.plans.filter(p => !planApproved(p)).length;
    case 'replan':
      return st.plans.filter(planRejected).length;
    case 'in-progress':
      return st.plans.filter(p => planApproved(p) && !planActed(p)).length;
    case 'action-review':
      return st.plans.filter(p => planActed(p) && !planSettled(p)).length;
    default:
      return 0;
  }
}

// ─── Events ───
// One event, built from the report's own close-out journey. It carries the same
// kinds Manage Exceptions emits (`caseEvents`), so the Report Snapshot trail
// reads identically whether the work was done in a case or on the report — and
// `replay` applies the patch the same way either way.

export function newCloseoutEvent({ kind, role, actor, index, title, summary, detail, patch }: {
  kind: AtrEventKind;
  role: AtrEventRole;
  actor: string;
  /** The observation this acts on. */
  index: number;
  title: string;
  summary: string;
  detail?: string;
  /** Observation / plan changes to replay; the target is filled in here. */
  patch?: Omit<AtrEventPatch, 'observationIndex' | 'observationTitle'>;
}): AtrEvent {
  return {
    id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ts: new Date().toISOString(),
    closeout: true,
    actor,
    role,
    kind,
    summary,
    detail,
    observationIndex: index,
    observationTitle: title,
    patch: patch ? { observationIndex: index, observationTitle: title, ...patch } : undefined,
  };
}
