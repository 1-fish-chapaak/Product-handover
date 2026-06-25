// ─── Workflow engine — pure, data-driven transition logic ───
// No hardcoded chains: every decision is derived from the assignment's snapshot
// of levels + modes. Functions are pure and return new objects + activity events
// so the context can persist and mirror them to the case Activity Log.

import type { Assignment, WorkflowLevel, SlaState, LevelState } from './workflowTypes';

const HOUR_MS = 3_600_000;
const SEND_BACK_LIMIT = 3;

/** SLA roll-up for a level/assignment that started at `startIso`. */
export function computeSla(startIso: string, slaHours: number, nowMs = Date.now()): SlaState {
  const elapsed = (nowMs - new Date(startIso).getTime()) / HOUR_MS;
  const remaining = slaHours - elapsed;
  if (remaining < 0) {
    const over = Math.abs(remaining);
    return { state: 'overdue', remainingHours: remaining, label: `${fmtH(over)} overdue` };
  }
  const state = remaining <= Math.max(1, slaHours * 0.25) ? 'at-risk' : 'on-track';
  return { state, remainingHours: remaining, label: `${fmtH(remaining)} left` };
}

function fmtH(h: number): string {
  if (h >= 48) return `${Math.round(h / 24)}d`;
  if (h >= 1) return `${Math.round(h)}h`;
  return `${Math.max(1, Math.round(h * 60))}m`;
}

export function currentLevel(a: Assignment): WorkflowLevel | null {
  if (a.currentLevelIndex < 0 || a.currentLevelIndex >= a.levels.length) return null;
  return a.levels[a.currentLevelIndex];
}

/** The next approver expected to act at the current level (for sequential mode). */
export function nextActorId(a: Assignment): string | null {
  const lvl = currentLevel(a);
  if (!lvl) return null;
  const state = a.levelStates[a.currentLevelIndex];
  const acted = new Set(state.approvals.map(ap => ap.userId));
  if (lvl.mode === 'sequential') {
    return lvl.assigneeIds.find(id => !acted.has(id)) ?? null;
  }
  return null; // parallel modes accept any pending approver
}

/** Whether `userId` may act on the current level right now (self-approval guard). */
export function canAct(a: Assignment, userId: string): { ok: boolean; reason?: string } {
  const lvl = currentLevel(a);
  if (!lvl || a.status !== 'in-approval') return { ok: false, reason: 'Not awaiting approval.' };
  if (userId === a.assigneeId) return { ok: false, reason: 'You cannot approve your own submission.' };
  if (!lvl.assigneeIds.includes(userId)) return { ok: false, reason: 'You are not an approver at this level.' };
  const state = a.levelStates[a.currentLevelIndex];
  if (state.approvals.some(ap => ap.userId === userId)) return { ok: false, reason: 'You have already responded.' };
  if (lvl.mode === 'sequential' && nextActorId(a) !== userId) return { ok: false, reason: 'Waiting on the prior approver in sequence.' };
  return { ok: true };
}

/** Does this user appear anywhere as an approver in the chain? (assignment-time warning) */
export function userInApprovalChain(levels: WorkflowLevel[], userId: string): boolean {
  return levels.some(l => l.assigneeIds.includes(userId));
}

function freshLevelStates(levels: WorkflowLevel[]): LevelState[] {
  return levels.map(l => ({ levelId: l.id, status: 'pending' as const, approvals: [] }));
}

/** Assignee submits their drafted work → enters the approval chain at L1. */
export function submit(a: Assignment): { assignment: Assignment; events: { message: string; comment?: string }[] } {
  const levelStates = freshLevelStates(a.levels);
  if (levelStates[0]) levelStates[0].status = 'in-progress';
  return {
    assignment: { ...a, status: 'in-approval', currentLevelIndex: 0, levelStates, sendBackCount: 0 },
    events: [{ message: `Submitted for approval → ${a.levels[0]?.name ?? 'L1'}` }],
  };
}

export type ApplyResult = {
  assignment: Assignment;
  events: { message: string; comment?: string }[];
  finalized: boolean; // final level approved — caller runs the platform integration hook
};

/** Apply an approver's decision at the current level. */
export function applyDecision(
  a: Assignment,
  userId: string,
  decision: 'approve' | 'reject' | 'send-back',
  comment: string,
  userName: string,
): ApplyResult {
  const idx = a.currentLevelIndex;
  const lvl = a.levels[idx];
  const states = a.levelStates.map(s => ({ ...s, approvals: [...s.approvals] }));
  const state = states[idx];
  const nowIso = new Date().toISOString();
  const lvlName = lvl?.name ?? `L${idx + 1}`;

  if (decision === 'reject') {
    state.status = 'rejected';
    return {
      assignment: { ...a, levelStates: states, status: 'rejected', currentLevelIndex: -1 },
      events: [{ message: `Rejected at ${lvlName} by ${userName} — returned to assignee`, comment }],
      finalized: false,
    };
  }

  if (decision === 'send-back') {
    const count = a.sendBackCount + 1;
    state.status = 'sent-back';
    if (count >= SEND_BACK_LIMIT) {
      return {
        assignment: { ...a, levelStates: states, status: 'escalated', currentLevelIndex: -1, sendBackCount: count },
        events: [{ message: `Send-back limit reached (${count}) at ${lvlName} — escalated to assigner`, comment }],
        finalized: false,
      };
    }
    if (idx === 0) {
      // bounce back to the assignee to revise
      return {
        assignment: { ...a, levelStates: freshLevelStates(a.levels), status: 'drafting', currentLevelIndex: -1, sendBackCount: count },
        events: [{ message: `Sent back to assignee from ${lvlName} by ${userName}`, comment }],
        finalized: false,
      };
    }
    states[idx] = { levelId: state.levelId, status: 'pending', approvals: [] };
    states[idx - 1] = { levelId: states[idx - 1].levelId, status: 'in-progress', approvals: [] };
    return {
      assignment: { ...a, levelStates: states, currentLevelIndex: idx - 1, sendBackCount: count },
      events: [{ message: `Sent back from ${lvlName} to ${a.levels[idx - 1].name} by ${userName}`, comment }],
      finalized: false,
    };
  }

  // approve
  state.approvals.push({ userId, decision: 'approve', comment, at: nowIso });
  const acted = new Set(state.approvals.map(ap => ap.userId));
  const levelComplete =
    lvl.mode === 'any' ? true : lvl.assigneeIds.every(id => acted.has(id));

  if (!levelComplete) {
    state.status = 'in-progress';
    return {
      assignment: { ...a, levelStates: states },
      events: [{ message: `Approved at ${lvlName} by ${userName} (${acted.size}/${lvl.assigneeIds.length})`, comment }],
      finalized: false,
    };
  }

  state.status = 'approved';
  const isLast = idx === a.levels.length - 1;
  if (isLast) {
    return {
      assignment: { ...a, levelStates: states, status: 'approved', currentLevelIndex: a.levels.length },
      events: [{ message: `Final approval at ${lvlName} by ${userName} — case advanced`, comment }],
      finalized: true,
    };
  }
  states[idx + 1] = { ...states[idx + 1], status: 'in-progress' };
  return {
    assignment: { ...a, levelStates: states, currentLevelIndex: idx + 1 },
    events: [{ message: `Approved at ${lvlName} by ${userName} → ${a.levels[idx + 1].name}`, comment }],
    finalized: false,
  };
}

// ─── Selectors ───
const STATUS_RANK: Record<Assignment['status'], number> = {
  'in-approval': 5, approved: 4, rejected: 3, escalated: 3, 'needs-reassignment': 3, drafting: 2, 'pulled-back': 0,
};
/** A case can carry two SEPARATE routes — the Risk Owner's (the lifecycle: classify
 *  → plan → action, then the Auditor phase at handoff) and an auditor route the
 *  Auditor marked independently. For the case's status display the Risk Owner
 *  assignment always wins when present (it owns the lifecycle); the auditor route is
 *  a config consumed only at handoff and must NOT bleed into the Risk Owner column.
 *  Only a case with no Risk Owner assignment shows its auditor assignment. */
export function primaryAssignment(all: Assignment[], exceptionId: string): Assignment | undefined {
  const rank = (a: Assignment) => (a.persona === 'risk-owner' ? 100 : 0) + (STATUS_RANK[a.status] ?? 0);
  return all
    .filter(a => a.exceptionId === exceptionId && a.status !== 'pulled-back')
    .sort((x, y) => rank(y) - rank(x))[0];
}

export function assignmentsForAssignee(all: Assignment[], userId: string): Assignment[] {
  return all.filter(a => a.assigneeId === userId && (a.status === 'drafting' || a.status === 'rejected'));
}

export function pendingApprovalsForUser(all: Assignment[], userId: string): Assignment[] {
  return all.filter(a => a.status === 'in-approval' && canAct(a, userId).ok);
}
