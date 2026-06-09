import type {
  OrgUser, WorkflowTemplate, ColumnPermission, Assignment, LevelState,
} from './workflowTypes';

// ─── Org directory ───────────────────────────────────────────────────────
// Risk-owner side and auditor side, each with one extra approver tier. One
// user is inactive to demo the "assignee deactivated → needs reassignment" flag.
export const ORG_USERS: OrgUser[] = [
  // Risk-owner side
  { id: 'u-ro-1', name: 'Sneha Desai',  initials: 'SD', role: 'Risk Analyst',        email: 'sneha.desai@company.com',  persona: 'risk-owner', active: true },
  { id: 'u-ro-2', name: 'Tushar Goel',  initials: 'TG', role: 'AP Manager',          email: 'tushar.goel@company.com',  persona: 'risk-owner', active: true },
  { id: 'u-ro-3', name: 'Deepak Bansal', initials: 'DB', role: 'Finance Controller',  email: 'deepak.bansal@company.com', persona: 'risk-owner', active: true },
  { id: 'u-ro-4', name: 'Neha Joshi',   initials: 'NJ', role: 'Compliance Lead',      email: 'neha.joshi@company.com',   persona: 'risk-owner', active: true },
  { id: 'u-ro-5', name: 'Vikram Nair',  initials: 'VN', role: 'Process Owner',        email: 'vikram.nair@company.com',  persona: 'risk-owner', active: false },
  // Auditor side
  { id: 'u-au-1', name: 'Karan Mehta',  initials: 'KM', role: 'Audit Manager',        email: 'karan.mehta@company.com',  persona: 'auditor', active: true },
  { id: 'u-au-2', name: 'Priya Mehta',  initials: 'PM', role: 'Senior Auditor',       email: 'priya.mehta@company.com',  persona: 'auditor', active: true },
  { id: 'u-au-3', name: 'Anil Kapoor',  initials: 'AK', role: 'Engagement Partner',   email: 'anil.kapoor@company.com',  persona: 'auditor', active: true },
  { id: 'u-au-4', name: 'Ritu Shah',    initials: 'RS', role: 'Audit Senior',         email: 'ritu.shah@company.com',    persona: 'auditor', active: true },
];

export const userById = (id: string): OrgUser | undefined => ORG_USERS.find(u => u.id === id);
export const userName = (id: string): string => userById(id)?.name ?? id;
export const usersForPersona = (p: OrgUser['persona']): OrgUser[] => ORG_USERS.filter(u => u.persona === p);

// ─── Assignable columns (mirrors the canonical ExceptionsTable columns) ───
export const COLUMN_CATALOG: { key: string; label: string }[] = [
  { key: 'id',            label: 'Exception ID' },
  { key: 'title',         label: 'Title' },
  { key: 'riskCategory',  label: 'Risk Category' },
  { key: 'severity',      label: 'Severity' },
  { key: 'status',        label: 'Status' },
  { key: 'classification', label: 'Classification' },
  { key: 'actionReview',  label: 'Action Review' },
  { key: 'dueDate',       label: 'Due Date' },
  { key: 'actionableId',  label: 'Actionable ID' },
  { key: 'lastUpdated',   label: 'Last Updated' },
  { key: 'assignedTo',    label: 'Assigned To' },
];

// Safe defaults: identifying columns visible + read-only; the work fields
// (classification, due date) visible + editable so the assignee can do the job.
const VISIBLE_DEFAULT = new Set(['id', 'riskCategory', 'severity', 'status', 'classification', 'dueDate']);
const EDITABLE_DEFAULT = new Set(['classification', 'dueDate']);

export function buildDefaultPermissions(): ColumnPermission[] {
  return COLUMN_CATALOG.map(c => ({
    key: c.key,
    label: c.label,
    visible: VISIBLE_DEFAULT.has(c.key),
    editable: EDITABLE_DEFAULT.has(c.key),
  }));
}

// ─── Seeded workflow templates ───────────────────────────────────────────
export const SEED_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'wf-ro-default',
    name: 'P2P Quarterly Review – RO Route',
    persona: 'risk-owner',
    isDefault: true,
    version: 1,
    createdBy: 'u-ro-4',
    createdAt: '2026-05-01T09:00:00.000Z',
    levels: [
      { id: 'lvl-ro-1', name: 'L1 — Team Lead Review',     assigneeIds: ['u-ro-2'], mode: 'any', slaHours: 48, allowSendBack: true },
      { id: 'lvl-ro-2', name: 'L2 — Finance Controller',   assigneeIds: ['u-ro-3'], mode: 'all', slaHours: 72, allowSendBack: true },
      { id: 'lvl-ro-3', name: 'L3 — Compliance Sign-off',  assigneeIds: ['u-ro-4'], mode: 'any', slaHours: 96, allowSendBack: false },
    ],
  },
  {
    id: 'wf-au-default',
    name: 'Audit Review – Manager → Senior Partner',
    persona: 'auditor',
    isDefault: true,
    version: 1,
    createdBy: 'u-au-1',
    createdAt: '2026-05-02T09:00:00.000Z',
    levels: [
      { id: 'lvl-au-1', name: 'L1 — Audit Manager',   assigneeIds: ['u-au-1'], mode: 'any', slaHours: 48, allowSendBack: true },
      { id: 'lvl-au-2', name: 'L2 — Senior Partner',  assigneeIds: ['u-au-3'], mode: 'any', slaHours: 72, allowSendBack: false },
    ],
  },
];

// ─── Seeded in-flight assignments (so My Work / Approvals demo immediately) ─
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const freshStates = (t: WorkflowTemplate): LevelState[] =>
  t.levels.map(l => ({ levelId: l.id, status: 'pending' as const, approvals: [] }));

function seedAssignment(
  partial: Pick<Assignment, 'id' | 'exceptionId' | 'assigneeId' | 'assignedBy' | 'status' | 'currentLevelIndex'> &
    Partial<Pick<Assignment, 'draft' | 'note'>>,
  template: WorkflowTemplate,
  assignedHoursAgo: number,
): Assignment {
  const states = freshStates(template);
  if (partial.currentLevelIndex >= 0 && states[partial.currentLevelIndex]) {
    states[partial.currentLevelIndex].status = 'in-progress';
  }
  return {
    id: partial.id,
    exceptionId: partial.exceptionId,
    workflowId: template.id,
    workflowName: template.name,
    workflowVersion: template.version,
    persona: template.persona,
    levels: template.levels.map(l => ({ ...l, assigneeIds: [...l.assigneeIds] })),
    assigneeId: partial.assigneeId,
    columnPermissions: buildDefaultPermissions(),
    note: partial.note,
    status: partial.status,
    currentLevelIndex: partial.currentLevelIndex,
    levelStates: states,
    sendBackCount: 0,
    assignedBy: partial.assignedBy,
    assignedAt: hoursAgo(assignedHoursAgo),
    draft: partial.draft,
  };
}

export const SEED_ASSIGNMENTS: Assignment[] = [
  // Risk-owner: Sneha is still drafting EXC002.
  seedAssignment(
    { id: 'as-ro-1', exceptionId: 'EXC002', assigneeId: 'u-ro-1', assignedBy: 'u-ro-4', status: 'drafting', currentLevelIndex: -1, note: 'Please classify and draft a remediation plan for the unencrypted PII finding.' },
    SEED_TEMPLATES[0], 6,
  ),
  // Risk-owner: EXC001 already submitted, awaiting L1 (Tushar). Past SLA → overdue.
  seedAssignment(
    {
      id: 'as-ro-2', exceptionId: 'EXC001', assigneeId: 'u-ro-1', assignedBy: 'u-ro-4', status: 'in-approval', currentLevelIndex: 0,
      draft: { classification: 'System Deficiency', actionName: 'Decommission legacy VPN endpoint', actionDetails: 'Retire the legacy endpoint and enforce SSO + MFA for remaining access paths.', dueDate: '2026-07-15' },
    },
    SEED_TEMPLATES[0], 52,
  ),
  // Auditor: EXC003 reviewed case routed through audit chain, awaiting L1 (Karan).
  seedAssignment(
    {
      id: 'as-au-1', exceptionId: 'EXC003', assigneeId: 'u-au-4', assignedBy: 'u-au-1', status: 'in-approval', currentLevelIndex: 0,
      draft: { actionReview: 'Approved', actionStatus: 'Implemented' },
    },
    SEED_TEMPLATES[1], 20,
  ),
];
