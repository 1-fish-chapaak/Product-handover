import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { GRC_CASE_DETAILS, type GrcActivityEntry } from '../../../data/mockData';
import type {
  Persona, WorkflowTemplate, Assignment, ColumnPermission,
} from './workflowTypes';
import { SEED_TEMPLATES, SEED_ASSIGNMENTS, userById, userName } from './workflowData';
import { submit as engineSubmit, applyDecision } from './workflowEngine';

// Bumped to v4 with the team remodel (Tushar leads Risk Owner, Deepak leads
// Auditor, 4-person teams each) — a new key discards stale persisted state that
// referenced the old user ids.
const STORAGE_KEY = 'workflow-engine-v4';

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
  currentUserId: string;
  setCurrentUser: (id: string) => void;
  assignmentModalIds: string[] | null;
  openAssignment: (ids: string[]) => void;
  closeAssignment: () => void;
  upsertTemplate: (t: WorkflowTemplate) => void;
  deleteTemplate: (id: string) => void;
  setDefaultTemplate: (id: string, persona: Persona) => void;
  createAssignments: (p: CreateAssignmentParams) => void;
  submitForApproval: (assignmentId: string, draft: Assignment['draft']) => void;
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

function loadPersisted(): { templates: WorkflowTemplate[]; assignments: Assignment[] } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.templates) && Array.isArray(parsed.assignments)) return parsed;
  } catch { /* ignore */ }
  return null;
}

export function WorkflowProvider({
  role,
  onFinalize,
  children,
}: {
  role: Persona;
  /** Called when an assignment clears its final approval — host writes the
   *  drafted result back onto the exception (classification / review hook). */
  onFinalize: (assignment: Assignment) => void;
  children: React.ReactNode;
}) {
  const persisted = loadPersisted();
  const [templates, setTemplates] = useState<WorkflowTemplate[]>(persisted?.templates ?? SEED_TEMPLATES);
  const [assignments, setAssignments] = useState<Assignment[]>(() => applyDeactivation(persisted?.assignments ?? SEED_ASSIGNMENTS));
  const [currentUserId, setCurrentUserId] = useState<string>('u-ro-1');
  const [assignmentModalIds, setAssignmentModalIds] = useState<string[] | null>(null);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ templates, assignments })); } catch { /* ignore */ }
  }, [templates, assignments]);

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

  const decide = useCallback((assignmentId: string, userId: string, decision: 'approve' | 'reject' | 'send-back', comment: string) => {
    setAssignments(prev => prev.map(a => {
      if (a.id !== assignmentId) return a;
      const res = applyDecision(a, userId, decision, comment, userName(userId));
      res.events.forEach(e => logToCase(a.exceptionId, a.persona, userName(userId), e.message, e.comment));
      if (res.finalized) onFinalize(res.assignment);
      return res.assignment;
    }));
  }, [onFinalize]);

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
    role, templates, assignments, currentUserId, setCurrentUser,
    assignmentModalIds, openAssignment, closeAssignment,
    upsertTemplate, deleteTemplate, setDefaultTemplate,
    createAssignments, submitForApproval, decide, reassign, pullBack, updateDraft,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
