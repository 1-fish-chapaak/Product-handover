// ─── Configurable Assignment & Approval Workflow — data model ───
// Everything here is data-driven: no hardcoded level names, approval chains, or
// column permissions. Templates describe the chain; Assignments are live
// instances that snapshot a template version and carry per-assignee RBAC.

export type Persona = 'risk-owner' | 'auditor';

/** How the approvers at a single level reach a verdict. */
export type ApprovalMode =
  | 'all'        // every assignee must approve (parallel-AND)
  | 'any'        // any one assignee approves (parallel-OR)
  | 'sequential';// assignees approve in listed order

export interface OrgUser {
  id: string;
  name: string;
  initials: string;
  role: string;        // job title, e.g. "Audit Manager"
  email: string;
  /** Which side of the case this user works on. */
  persona: Persona;
  active: boolean;     // deactivated users surface a "needs reassignment" flag
}

export interface WorkflowLevel {
  id: string;
  name: string;                 // free text, e.g. "L1 — Team Lead Review"
  assigneeIds: string[];        // approvers at this level
  mode: ApprovalMode;
  slaHours: number;             // overdue after this many hours
  allowSendBack: boolean;       // may bounce to the previous level with a comment
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  persona: Persona;             // determines which side the workflow attaches to
  levels: WorkflowLevel[];      // 1..N approval levels
  isDefault: boolean;           // default for new assignments of this persona
  version: number;              // bumped on edit; assignments snapshot the value
  createdBy: string;            // OrgUser id
  createdAt: string;            // ISO
}

/** Per-column visibility + edit grant the assigner gives the assignee. */
export interface ColumnPermission {
  key: string;
  label: string;
  visible: boolean;
  editable: boolean;
}

export type ApprovalDecision = 'approve' | 'reject' | 'send-back';

export interface LevelApproval {
  userId: string;
  decision: 'approve' | 'reject';
  comment: string;
  at: string;                   // ISO
}

export type LevelStatus = 'pending' | 'in-progress' | 'approved' | 'rejected' | 'sent-back';

export interface LevelState {
  levelId: string;
  status: LevelStatus;
  approvals: LevelApproval[];
}

export type AssignmentStatus =
  | 'drafting'          // assignee is doing the work
  | 'in-approval'       // moving through the levels
  | 'approved'          // final level approved → flowed to next platform stage
  | 'rejected'          // an approver rejected (reopens at assignee)
  | 'needs-reassignment'// assignee deactivated mid-flight
  | 'pulled-back'       // assigner recalled it
  | 'escalated';        // send-back loop limit hit → back to assigner

/** A live instance of a workflow applied to one exception. */
export interface Assignment {
  id: string;
  exceptionId: string;
  workflowId: string;
  workflowName: string;
  workflowVersion: number;      // snapshot — survives later template edits
  persona: Persona;
  levels: WorkflowLevel[];      // snapshot of the template's levels at assign time
  assigneeId: string;           // the team member doing the work
  columnPermissions: ColumnPermission[];
  note?: string;
  dueDate?: string;             // ISO; independent of action-plan due date
  status: AssignmentStatus;
  currentLevelIndex: number;    // -1 while drafting, 0..N-1 during approvals
  levelStates: LevelState[];
  sendBackCount: number;
  assignedBy: string;           // OrgUser id
  assignedAt: string;           // ISO
  /** Snapshot of the assignee's drafted result, applied to the exception on
   *  final approval (the hook into the existing classification/review flow). */
  draft?: {
    classification?: string;
    actionName?: string;
    actionDetails?: string;
    dueDate?: string;
    actionReview?: 'Approved' | 'Rejected' | 'Implemented';
    actionStatus?: 'Implemented' | 'Partially Implemented';
  };
}

export interface SlaState {
  state: 'on-track' | 'at-risk' | 'overdue';
  label: string;          // e.g. "6h left" / "2h overdue"
  remainingHours: number; // negative when overdue
}
