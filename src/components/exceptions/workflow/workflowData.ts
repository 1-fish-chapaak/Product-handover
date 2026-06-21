import type {
  OrgUser, WorkflowTemplate, ColumnPermission, Assignment,
} from './workflowTypes';

// ─── Org directory ───────────────────────────────────────────────────────
// Four unique profiles per side. Each side has a lead who creates routes and runs
// approvals — Tushar Goel (Risk Owner) and Deepak Bansal (Auditor) — plus team
// members they assign work and approvals to. These are the identities shown in
// the "Acting as" switcher (filtered to the current screen's persona).
export const ORG_USERS: OrgUser[] = [
  // ── Risk Owner side — Tushar leads; 4 profiles total ──
  { id: 'u-ro-owner', name: 'Tushar Goel',  initials: 'TG', role: 'Risk Owner (Lead)', email: 'tushar.goel@company.com',  persona: 'risk-owner', active: true },
  { id: 'u-ro-1', name: 'Sneha Desai',  initials: 'SD', role: 'Risk Analyst',       email: 'sneha.desai@company.com',  persona: 'risk-owner', active: true },
  { id: 'u-ro-2', name: 'Neha Joshi',   initials: 'NJ', role: 'Compliance Lead',     email: 'neha.joshi@company.com',   persona: 'risk-owner', active: true },
  { id: 'u-ro-3', name: 'Vikram Nair',  initials: 'VN', role: 'Process Owner',       email: 'vikram.nair@company.com',  persona: 'risk-owner', active: true },
  // ── Auditor side — Deepak leads; 4 profiles total ──
  { id: 'u-au-owner', name: 'Deepak Bansal', initials: 'DB', role: 'Auditor (Lead)', email: 'deepak.bansal@company.com', persona: 'auditor', active: true },
  { id: 'u-au-1', name: 'Karan Mehta',  initials: 'KM', role: 'Audit Manager',       email: 'karan.mehta@company.com',  persona: 'auditor', active: true },
  { id: 'u-au-2', name: 'Priya Mehta',  initials: 'PM', role: 'Senior Auditor',      email: 'priya.mehta@company.com',  persona: 'auditor', active: true },
  { id: 'u-au-3', name: 'Anil Kapoor',  initials: 'AK', role: 'Engagement Partner',  email: 'anil.kapoor@company.com',  persona: 'auditor', active: true },
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

// Defaults: every column is visible to the assignee; the work fields
// (classification, due date) are also editable so they can do the job.
const EDITABLE_DEFAULT = new Set(['classification', 'dueDate']);

export function buildDefaultPermissions(): ColumnPermission[] {
  return COLUMN_CATALOG.map(c => ({
    key: c.key,
    label: c.label,
    visible: true,
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
    // Risk-owner levels only. When the last one approves, the case is NOT marked
    // approved — it hands off to the Auditor phase (the Auditor's own route runs
    // step by step, or the Auditor lead signs off if no auditor route exists).
    levels: [
      { id: 'lvl-ro-1', name: 'L1 — Team Review',         assigneeIds: ['u-ro-2'],     mode: 'any', slaHours: 48, allowSendBack: true },
      { id: 'lvl-ro-2', name: 'L2 — Process Owner',       assigneeIds: ['u-ro-3'],     mode: 'all', slaHours: 72, allowSendBack: true },
      { id: 'lvl-ro-3', name: 'L3 — Risk Owner Sign-off', assigneeIds: ['u-ro-owner'], mode: 'any', slaHours: 96, allowSendBack: true },
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

// No in-flight assignments are seeded — every exception starts unassigned. The
// first assignment is created live when the Auditor assigns a case to a Risk
// Owner (Step 1), so the whole approval flow is exercised from scratch.
export const SEED_ASSIGNMENTS: Assignment[] = [];
