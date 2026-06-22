import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { GRC_CASE_DETAILS, type GrcActivityEntry } from '../../../data/mockData';
import type {
  Persona, WorkflowTemplate, Assignment, ColumnPermission, WorkflowLevel, LevelState,
} from './workflowTypes';
import { SEED_TEMPLATES, SEED_ASSIGNMENTS, userById, userName } from './workflowData';
import { submit as engineSubmit, applyDecision } from './workflowEngine';

// No persistence: workflow state lives only in memory, so a hard refresh always
// returns to the default seed (every case unassigned, ready to start from Step 1).
// Older builds persisted under these keys — clear them on load so no stale demo
// state survives a refresh.
const LEGACY_STORAGE_KEYS = Array.from({ length: 9 }, (_, i) => `workflow-engine-v${i + 1}`);

interface CreateAssignmentParams {
  exceptionIds: string[];
  template: WorkflowTemplate;
  assigneeId: string;
  columnPermissions: ColumnPermission[];
  note?: string;
  dueDate?: string;
  assignedBy: string;
}

interface WorkflowContextValue {
  role: Persona;
  templates: WorkflowTemplate[];
  assignments: Assignment[];
  /** Auditor routes assigned per exception — a separate config keyed by exception
   *  id, NOT an assignment, so it never drives the Risk Owner lifecycle / CTAs.
   *  Consumed only at the Risk Owner → Auditor handoff. */
  auditorRoutes: Record<string, { levels: WorkflowLevel[]; name: string }>;
  currentUserId: string;
  setCurrentUser: (id: string) => void;
  assignmentModalIds: string[] | null;
  openAssignment: (ids: string[]) => void;
  closeAssignment: () => void;
  upsertTemplate: (t: WorkflowTemplate) => void;
  deleteTemplate: (id: string) => void;
  setDefaultTemplate: (id: string, persona: Persona) => void;
  createAssignments: (p: CreateAssignmentParams) => void;
  /** Attach an auditor approval route onto the case's existing (Risk Owner)
   *  assignment — one record, not a second assignment. Consumed at handoff. */
  attachAuditorRoute: (p: { exceptionIds: string[]; template: WorkflowTemplate; assignedBy: string; note?: string }) => void;
  submitForApproval: (assignmentId: string, draft: Assignment['draft']) => void;
  /** Resubmit a fully-approved assignment for the Action-Taken review cycle — the
   *  chain (Risk Owner route → Auditor phase) runs again, reviewing the action. */
  submitActionForReview: (assignmentId: string, draft: Assignment['draft']) => void;
  decide: (assignmentId: string, userId: string, decision: 'approve' | 'reject' | 'send-back', comment: string) => void;
  reassign: (assignmentId: string, newAssigneeId: string) => void;
  pullBack: (assignmentId: string) => void;
  updateDraft: (assignmentId: string, draft: Assignment['draft']) => void;
}

const Ctx = createContext<WorkflowContextValue | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export const useWorkflow = (): WorkflowContextValue => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useWorkflow must be used within WorkflowProvider');
  return v;
};

/** Deactivated assignees can't keep working — flag for reassignment (edge case). */
function applyDeactivation(list: Assignment[]): Assignment[] {
  return list.map(a => {
    const u = userById(a.assigneeId);
    if (u && !u.active && (a.status === 'drafting' || a.status === 'in-approval')) {
      return { ...a, status: 'needs-reassignment' as const };
    }
    return a;
  });
}

/** Mirror a workflow event onto the existing case-level Activity Log so it shows
 *  in the Review/Activity drawers — the integration point with the platform. */
function logToCase(exceptionId: string, persona: Persona, author: string, message: string, comment?: string) {
  const detail = GRC_CASE_DETAILS[exceptionId];
  if (!detail) return;
  const entry: GrcActivityEntry = {
    id: `act-wf-${exceptionId}-${Date.now()}-${Math.round(performance.now())}`,
    author,
    role: persona === 'auditor' ? 'Auditor' : 'Risk Owner',
    timestamp: new Date().toISOString(),
    message,
    comment,
  };
  detail.activityLog = [entry, ...detail.activityLog];
}

const AUDITOR_LEAD_ID = 'u-au-owner';

/** Levels for the Auditor phase. It opens at the Auditor who assigned the case
 *  (the Auditor lead) with a Review item. If the Auditor explicitly assigned an
 *  auditor approval route to THIS case, the case then flows through that route
 *  step by step. If no auditor route was assigned, the Auditor lead is the single
 *  final approver — the route is NOT auto-assigned. */
function auditorPhaseLevels(attachedRoute?: WorkflowLevel[]): WorkflowLevel[] {
  const leadReview: WorkflowLevel = {
    id: 'lvl-auditor-lead', name: 'Auditor Review', assigneeIds: [AUDITOR_LEAD_ID], mode: 'any', slaHours: 96, allowSendBack: true,
  };
  if (attachedRoute && attachedRoute.length > 0) {
    return [leadReview, ...attachedRoute.map(l => ({ ...l, assigneeIds: [...l.assigneeIds] }))];
  }
  return [leadReview];
}

/** Hand a completed Risk Owner route off to the Auditor phase: append the auditor
 *  levels and continue the chain at the first of them (status stays in-approval,
 *  so the Approval column is NOT marked approved yet). */
function handoffToAuditor(a: Assignment, levels: WorkflowLevel[]): Assignment {
  const firstIdx = a.levels.length;
  const addedStates: LevelState[] = levels.map(l => ({ levelId: l.id, status: 'pending' as const, approvals: [] }));
  const levelStates = [...a.levelStates, ...addedStates];
  levelStates[firstIdx] = { ...levelStates[firstIdx], status: 'in-progress' };
  return { ...a, levels: [...a.levels, ...levels], levelStates, currentLevelIndex: firstIdx, status: 'in-approval', auditorPhase: true };
}

export function WorkflowProvider({
  role,
  onFinalize,
  onReject,
  onReopenPartial,
  children,
}: {
  role: Persona;
  /** Called when an assignment clears its final approval — host writes the
   *  drafted result back onto the exception (classification / review hook). */
  onFinalize: (assignment: Assignment) => void;
  /** Called when an assignment is rejected in the route — host reopens the case
   *  for the Risk Owner who classified it (mirrors the auditor-reject flow). */
  onReject?: (assignment: Assignment) => void;
  /** Called when the action was approved only as Partially Implemented — host
   *  records "Approved (Partially Implemented)" and reopens for re-classification. */
  onReopenPartial?: (assignment: Assignment) => void;
  children: React.ReactNode;
}) {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>(SEED_TEMPLATES);
  const [assignments, setAssignments] = useState<Assignment[]>(() => applyDeactivation(SEED_ASSIGNMENTS));
  // Auditor routes are a SEPARATE config keyed by exception id — never an
  // assignment, so they don't touch the Risk Owner lifecycle/CTAs.
  const [auditorRoutes, setAuditorRoutes] = useState<Record<string, { levels: WorkflowLevel[]; name: string }>>({});
  const [currentUserId, setCurrentUserId] = useState<string>('u-ro-1');
  const [assignmentModalIds, setAssignmentModalIds] = useState<string[] | null>(null);

  // Clear any state persisted by older builds so a hard refresh never restores
  // stale demo data — the seed above is the single source of truth.
  useEffect(() => {
    try { LEGACY_STORAGE_KEYS.forEach(k => localStorage.removeItem(k)); } catch { /* ignore */ }
  }, []);

  const openAssignment = useCallback((ids: string[]) => setAssignmentModalIds(ids), []);
  const closeAssignment = useCallback(() => setAssignmentModalIds(null), []);
  const setCurrentUser = useCallback((id: string) => setCurrentUserId(id), []);

  const upsertTemplate = useCallback((t: WorkflowTemplate) => {
    setTemplates(prev => {
      const exists = prev.some(x => x.id === t.id);
      // Editing an existing template bumps its version (assignments snapshot the
      // old version, so in-flight work is unaffected — template versioning).
      const next = exists ? { ...t, version: (prev.find(x => x.id === t.id)?.version ?? 0) + 1 } : t;
      return exists ? prev.map(x => (x.id === t.id ? next : x)) : [...prev, next];
    });
  }, []);

  const deleteTemplate = useCallback((id: string) => setTemplates(prev => prev.filter(t => t.id !== id)), []);

  const setDefaultTemplate = useCallback((id: string, persona: Persona) => {
    setTemplates(prev => prev.map(t => (t.persona === persona ? { ...t, isDefault: t.id === id } : t)));
  }, []);

  const createAssignments = useCallback((p: CreateAssignmentParams) => {
    const now = new Date().toISOString();
    const created: Assignment[] = p.exceptionIds.map((exId, i) => ({
      id: `as-${Date.now()}-${i}`,
      exceptionId: exId,
      workflowId: p.template.id,
      workflowName: p.template.name,
      workflowVersion: p.template.version,
      persona: p.template.persona,
      levels: p.template.levels.map(l => ({ ...l, assigneeIds: [...l.assigneeIds] })),
      assigneeId: p.assigneeId,
      columnPermissions: p.columnPermissions.map(c => ({ ...c })),
      note: p.note,
      dueDate: p.dueDate,
      status: 'drafting',
      currentLevelIndex: -1,
      levelStates: p.template.levels.map(l => ({ levelId: l.id, status: 'pending' as const, approvals: [] })),
      sendBackCount: 0,
      assignedBy: p.assignedBy,
      assignedAt: now,
    }));
    setAssignments(prev => [...created, ...prev]);
    const who = userName(p.assigneeId);
    created.forEach(a => logToCase(a.exceptionId, a.persona, userName(p.assignedBy), `Assigned to ${who} via "${p.template.name}"`, p.note));
  }, []);

  const attachAuditorRoute = useCallback((p: { exceptionIds: string[]; template: WorkflowTemplate; assignedBy: string; note?: string }) => {
    const cloneLevels = () => p.template.levels.map(l => ({ ...l, assigneeIds: [...l.assigneeIds] }));
    // Record the auditor route as case config — NOT an assignment, so it never
    // becomes a case's "primary" and never touches the Risk Owner CTAs/lifecycle.
    setAuditorRoutes(prev => {
      const next = { ...prev };
      p.exceptionIds.forEach(id => { next[id] = { levels: cloneLevels(), name: p.template.name }; });
      return next;
    });
    // Mirror onto an existing Risk Owner record purely so the route-chain panel can
    // show "Auditor route attached". The handoff reads the config map regardless.
    setAssignments(prev => prev.map(a => (
      p.exceptionIds.includes(a.exceptionId) && a.persona === 'risk-owner' && a.status !== 'pulled-back'
        ? { ...a, auditorRouteLevels: cloneLevels(), auditorRouteName: p.template.name }
        : a
    )));
    p.exceptionIds.forEach(exId => logToCase(exId, 'auditor', userName(p.assignedBy), `Auditor route "${p.template.name}" assigned — runs after Risk Owner approvals`, p.note));
  }, []);

  const updateDraft = useCallback((assignmentId: string, draft: Assignment['draft']) => {
    setAssignments(prev => prev.map(a => (a.id === assignmentId ? { ...a, draft: { ...a.draft, ...draft } } : a)));
  }, []);

  const submitForApproval = useCallback((assignmentId: string, draft: Assignment['draft']) => {
    setAssignments(prev => prev.map(a => {
      if (a.id !== assignmentId) return a;
      const withDraft = { ...a, draft: { ...a.draft, ...draft } };
      const { assignment, events } = engineSubmit(withDraft);
      events.forEach(e => logToCase(a.exceptionId, a.persona, userName(a.assigneeId), e.message, e.comment));
      return assignment;
    }));
  }, []);

  const submitActionForReview = useCallback((assignmentId: string, draft: Assignment['draft']) => {
    setAssignments(prev => prev.map(a => {
      if (a.id !== assignmentId) return a;
      // Reset to the Risk Owner route levels (strip the auditor phase appended in
      // the plan cycle) and restart the chain — this time reviewing the Action
      // Taken. The handoff to the Auditor phase happens again automatically.
      const tmpl = templates.find(t => t.id === a.workflowId);
      const baseLevels = (tmpl?.levels ?? a.levels).map(l => ({ ...l, assigneeIds: [...l.assigneeIds] }));
      const levelStates = baseLevels.map((l, i) => ({ levelId: l.id, status: (i === 0 ? 'in-progress' : 'pending') as LevelState['status'], approvals: [] }));
      // Snapshot the just-completed plan-approval chain so it stays visible as a
      // stacked, completed cycle alongside the new action-review chain.
      const priorCycles = [...(a.priorCycles ?? []), { label: 'Action plan approval', levels: a.levels, levelStates: a.levelStates }];
      logToCase(a.exceptionId, a.persona, userName(a.assigneeId), `Action taken submitted for review → ${baseLevels[0]?.name ?? 'L1'}`, draft?.actionTaken);
      return {
        ...a,
        levels: baseLevels,
        levelStates,
        status: 'in-approval' as const,
        currentLevelIndex: 0,
        auditorPhase: false,
        actionCycle: true,
        sendBackCount: 0,
        priorCycles,
        draft: { ...a.draft, ...draft },
      };
    }));
  }, [templates]);

  const decide = useCallback((assignmentId: string, userId: string, decision: 'approve' | 'reject' | 'send-back', comment: string) => {
    setAssignments(prev => prev.map(a => {
      if (a.id !== assignmentId) return a;
      const res = applyDecision(a, userId, decision, comment, userName(userId));
      res.events.forEach(e => logToCase(a.exceptionId, a.persona, userName(userId), e.message, e.comment));
      if (res.finalized) {
        // A Risk Owner route's last approver does NOT finalize the case — it hands
        // off to the Auditor phase (auditor route step by step, or the Auditor lead
        // as the final approver). The case is only marked approved once the final
        // auditor approver signs off.
        if (res.assignment.persona === 'risk-owner' && !res.assignment.auditorPhase) {
          // Use the auditor route the Auditor assigned to THIS case — attached onto
          // this record, or (if it was assigned before this RO record existed) held
          // on a standalone auditor record. Otherwise the Auditor lead is the sole
          // final approver; no route is auto-assigned.
          const attachedRoute = res.assignment.auditorRouteLevels ?? auditorRoutes[res.assignment.exceptionId]?.levels;
          const handed = handoffToAuditor(res.assignment, auditorPhaseLevels(attachedRoute));
          const nextName = handed.levels[handed.currentLevelIndex]?.name ?? 'final approval';
          logToCase(a.exceptionId, a.persona, userName(userId), `Risk Owner approvals complete — sent to the Auditor for ${nextName}`);
          return handed;
        }
        // Action cycle approved but only PARTIALLY implemented → the work isn't done,
        // so reopen for re-classification by the person who classified it and restart
        // the whole approval — it does NOT close.
        if (res.assignment.actionCycle && res.assignment.draft?.actionStatus === 'Partially Implemented') {
          const tmpl = templates.find(t => t.id === res.assignment.workflowId);
          const baseLevels = (tmpl?.levels ?? res.assignment.levels).map(l => ({ ...l, assigneeIds: [...l.assigneeIds] }));
          const reopened: Assignment = {
            ...res.assignment,
            levels: baseLevels,
            levelStates: baseLevels.map(l => ({ levelId: l.id, status: 'pending' as const, approvals: [] })),
            status: 'rejected',
            currentLevelIndex: -1,
            auditorPhase: false,
            actionCycle: false,
          };
          logToCase(a.exceptionId, a.persona, userName(userId), 'Action approved as Partially Implemented — reopened for re-classification; approval restarts');
          onReopenPartial?.(reopened);
          return reopened;
        }
        onFinalize(res.assignment);
        return res.assignment;
      }
      if (res.assignment.status === 'rejected') onReject?.(res.assignment);
      return res.assignment;
    }));
  }, [onFinalize, onReject, onReopenPartial, auditorRoutes, templates]);

  const reassign = useCallback((assignmentId: string, newAssigneeId: string) => {
    setAssignments(prev => prev.map(a => {
      if (a.id !== assignmentId) return a;
      logToCase(a.exceptionId, a.persona, userName(a.assignedBy), `Reassigned to ${userName(newAssigneeId)}`);
      return { ...a, assigneeId: newAssigneeId, status: 'drafting', currentLevelIndex: -1, levelStates: a.levels.map(l => ({ levelId: l.id, status: 'pending' as const, approvals: [] })) };
    }));
  }, []);

  const pullBack = useCallback((assignmentId: string) => {
    setAssignments(prev => prev.map(a => {
      if (a.id !== assignmentId) return a;
      logToCase(a.exceptionId, a.persona, userName(a.assignedBy), 'Assignment pulled back by assigner');
      return { ...a, status: 'pulled-back' };
    }));
  }, []);

  const value: WorkflowContextValue = {
    role, templates, assignments, auditorRoutes, currentUserId, setCurrentUser,
    assignmentModalIds, openAssignment, closeAssignment,
    upsertTemplate, deleteTemplate, setDefaultTemplate,
    createAssignments, attachAuditorRoute, submitForApproval, submitActionForReview, decide, reassign, pullBack, updateDraft,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
