import type {
  OrgUser, WorkflowTemplate, ColumnPermission, Assignment, LevelState,
} from './workflowTypes';

// ─── Org directory ───────────────────────────────────────────────────────
// Risk-owner side and auditor side, each with one extra approver tier. One
// user is inactive to demo the "assignee deactivated → needs reassignment" flag.
// Two leads own their side and run approvals: Tushar Goel (Risk Owner) and
// Deepak Bansal (Auditor). Each has a 4-person team they assign work / routes to.
export const ORG_USERS: OrgUser[] = [
  // ── Risk Owner side — Tushar leads; 4 team members ──
  { id: 'u-ro-owner', name: 'Tushar Goel',  initials: 'TG', role: 'Risk Owner (Lead)', email: 'tushar.goel@company.com',  persona: 'risk-owner', active: true },
  { id: 'u-ro-1', name: 'Sneha Desai',  initials: 'SD', role: 'Risk Analyst',       email: 'sneha.desai@company.com',  persona: 'risk-owner', active: true },
  { id: 'u-ro-2', name: 'Neha Joshi',   initials: 'NJ', role: 'Compliance Lead',     email: 'neha.joshi@company.com',   persona: 'risk-owner', active: true },
  { id: 'u-ro-3', name: 'Vikram Nair',  initials: 'VN', role: 'Process Owner',       email: 'vikram.nair@company.com',  persona: 'risk-owner', active: true },
  { id: 'u-ro-4', name: 'Aarti Rao',    initials: 'AR', role: 'Risk Analyst',        email: 'aarti.rao@company.com',    persona: 'risk-owner', active: true },
  // ── Auditor side — Deepak leads; 4 team members ──
  { id: 'u-au-owner', name: 'Deepak Bansal', initials: 'DB', role: 'Auditor (Lead)', email: 'deepak.bansal@company.com', persona: 'auditor', active: true },
  { id: 'u-au-1', name: 'Karan Mehta',  initials: 'KM', role: 'Audit Manager',       email: 'karan.mehta@company.com',  persona: 'auditor', active: true },
  { id: 'u-au-2', name: 'Priya Mehta',  initials: 'PM', role: 'Senior Auditor',      email: 'priya.mehta@company.com',  persona: 'auditor', active: true },
  { id: 'u-au-3', name: 'Anil Kapoor',  initials: 'AK', role: 'Engagement Partner',  email: 'anil.kapoor@company.com',  persona: 'auditor', active: true },
  { id: 'u-au-4', name: 'Ritu Shah',    initials: 'RS', role: 'Audit Senior',        email: 'ritu.shah@company.com',    persona: 'auditor', active: true },
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
    createdBy: 'u-ro-owner',
    createdAt: '2026-05-01T09:00:00.000Z',
    levels: [
      { id: 'lvl-ro-1', name: 'L1 — Team Review',         assigneeIds: ['u-ro-2'],     mode: 'any', slaHours: 48, allowSendBack: true },
      { id: 'lvl-ro-2', name: 'L2 — Process Owner',       assigneeIds: ['u-ro-3'],     mode: 'all', slaHours: 72, allowSendBack: true },
      { id: 'lvl-ro-3', name: 'L3 — Risk Owner Sign-off', assigneeIds: ['u-ro-owner'], mode: 'any', slaHours: 96, allowSendBack: true },
      // Final gate: the management action plan must also clear the Auditor before
      // it is approved (Step 4 — approved by all Risk Owners AND the Auditor).
      { id: 'lvl-ro-4', name: 'L4 — Auditor Sign-off',    assigneeIds: ['u-au-owner'], mode: 'any', slaHours: 96, allowSendBack: true },
    ],
  },
  {
    id: 'wf-au-default',
    name: 'Audit Review – Manager → Senior Partner',
    persona: 'auditor',
    isDefault: true,
    version: 1,
    createdBy: 'u-au-owner',
    createdAt: '2026-05-02T09:00:00.000Z',
    levels: [
      { id: 'lvl-au-1', name: 'L1 — Audit Manager',  assigneeIds: ['u-au-1'], mode: 'any', slaHours: 48, allowSendBack: true },
      { id: 'lvl-au-2', name: 'L2 — Senior Partner', assigneeIds: ['u-au-3'], mode: 'any', slaHours: 72, allowSendBack: false },
    ],
  },
];

// ─── Seeded in-flight assignments (so My Work / Approvals demo immediately) ─
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const freshStates = (t: WorkflowTemplate): LevelState[] =>
  t.levels.map(l => ({ levelId: l.id, status: 'pending' as const, approvals: [] }));

// Build the level states for a seeded assignment. Levels BELOW the current one
// are marked approved (with an approval entry, so the inbox shows prior comments);
// the current level is in-progress; a fully-approved assignment approves them all.
function seedStates(template: WorkflowTemplate, currentLevelIndex: number, fullyApproved: boolean, baseHrs: number): LevelState[] {
  const states = freshStates(template);
  const approve = (i: number) => {
    const lvl = template.levels[i];
    if (!lvl || !states[i]) return;
    states[i].status = 'approved';
    states[i].approvals = lvl.assigneeIds.map(uid => ({ userId: uid, decision: 'approve' as const, comment: 'Reviewed and approved.', at: hoursAgo(Math.max(1, baseHrs - (i + 1) * 4)) }));
  };
  if (fullyApproved) {
    template.levels.forEach((_, i) => approve(i));
  } else if (currentLevelIndex >= 0) {
    for (let i = 0; i < currentLevelIndex; i++) approve(i);
    if (states[currentLevelIndex]) states[currentLevelIndex].status = 'in-progress';
  }
  return states;
}

function seedAssignment(
  partial: Pick<Assignment, 'id' | 'exceptionId' | 'assigneeId' | 'assignedBy' | 'status' | 'currentLevelIndex'> &
    Partial<Pick<Assignment, 'draft' | 'note'>>,
  template: WorkflowTemplate,
  assignedHoursAgo: number,
): Assignment {
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
    levelStates: seedStates(template, partial.currentLevelIndex, partial.status === 'approved', assignedHoursAgo),
    sendBackCount: 0,
    assignedBy: partial.assignedBy,
    assignedAt: hoursAgo(assignedHoursAgo),
    draft: partial.draft,
  };
}

const RO_ROUTE = SEED_TEMPLATES[0]; // L1 Neha → L2 Vikram → L3 Tushar → L4 Deepak (Auditor)
const AU_ROUTE = SEED_TEMPLATES[1]; // L1 Karan → L2 Anil

// Seeded in-flight assignments on the FULLY-MOCKED cases only (EXC001, EXC003,
// EXC004, EXC005) so the Approval column shows live, end-to-end route positions.
// The five blank cases (EXC002, EXC006, EXC007, EXC009, EXC010) are deliberately
// left UNASSIGNED so the flow can be driven from Step 1 (Auditor assigns → Risk
// Owner classifies → action plan → approval route). Risk-owner work is done by
// Sneha (u-ro-1); auditor work by the Auditor lead — neither is an approver on
// their own chain, so the self-approval guard is respected.
export const SEED_ASSIGNMENTS: Assignment[] = [
  // ── Risk-owner route — live positions at L1, L2 and L3 ──
  // At L1 — awaiting Tushar (EXC001). Past SLA → overdue badge.
  seedAssignment({ id: 'as-ro-2', exceptionId: 'EXC001', assigneeId: 'u-ro-1', assignedBy: 'u-ro-owner', status: 'in-approval', currentLevelIndex: 0, draft: { classification: 'System Deficiency', actionName: 'Decommission legacy VPN endpoint', actionDetails: 'Retire the legacy endpoint and enforce SSO + MFA for remaining access paths.', dueDate: '2026-07-15' } }, RO_ROUTE, 52),
  // At L2 (L1 approved) — awaiting Deepak (EXC004).
  seedAssignment({ id: 'as-ro-3', exceptionId: 'EXC004', assigneeId: 'u-ro-1', assignedBy: 'u-ro-owner', status: 'in-approval', currentLevelIndex: 1, draft: { classification: 'System Deficiency', actionName: 'Enforce FIDO2 MFA for C-suite', actionDetails: 'Issue hardware keys and remove the system-level MFA bypass.', dueDate: '2026-07-20' } }, RO_ROUTE, 34),
  // At L3 (L1+L2 approved) — awaiting Neha (EXC005).
  seedAssignment({ id: 'as-ro-4', exceptionId: 'EXC005', assigneeId: 'u-ro-1', assignedBy: 'u-ro-owner', status: 'in-approval', currentLevelIndex: 2, draft: { classification: 'Procedural Non-Compliance', actionName: 'Automate DSR SLA tracking', actionDetails: 'Add intake SLA timers with escalation before the 30-day limit.', dueDate: '2026-07-10' } }, RO_ROUTE, 44),

  // ── Auditor route — at L1 (lead has approved; team chain running) ──
  seedAssignment({ id: 'as-au-2', exceptionId: 'EXC003', assigneeId: 'u-au-owner', assignedBy: 'u-au-owner', status: 'in-approval', currentLevelIndex: 0, draft: { actionReview: 'Approved', actionStatus: 'Implemented' } }, AU_ROUTE, 20),
];
