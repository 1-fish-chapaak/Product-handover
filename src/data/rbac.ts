/**
 * RBAC source of truth.
 *
 * Flat permission keys (e.g. `bp_view`) grouped into modules — the same shape
 * the Admin > Roles & Permissions matrix renders. The 24 keys that already
 * existed in AdminView.tsx are kept verbatim; the rest extend coverage to every
 * module in the platform.
 *
 * Roles hold an array of granted keys. `CurrentUserContext` reads these to
 * answer `can(key)`, and the Roles editor writes back to them — one loop.
 *
 * None / View Only / Full Access presets (in the role editor) are unchanged:
 *   None        = []  (no keys)
 *   View Only   = the first key of each module (the `*_view` / `*_use` key)
 *   Full Access = every key in every module
 */

import type { View } from '../hooks/useAppState';
import { PEOPLE } from './grc-domain';

/* ──────────────────────────────────────────────────────────────────────────
 * Permission catalog
 * ────────────────────────────────────────────────────────────────────────── */

export interface PermissionDef {
  key: PermissionKey;
  name: string;
  desc: string;
}

export interface PermissionGroup {
  group: string;
  /** Stable id used for view-gating / module lookups. */
  module: ModuleId;
  perms: PermissionDef[];
}

export type ModuleId =
  | 'business_process'
  | 'workflows'
  | 'reports'
  | 'dashboard'
  | 'datasource'
  | 'engagements'
  | 'controls'
  | 'racm'
  | 'risk'
  | 'exceptions'
  | 'planning'
  | 'concierge'
  | 'memory'
  | 'admin';

export type PermissionKey =
  // Business Process (existing + new edit/archive)
  | 'bp_view' | 'bp_create' | 'bp_edit' | 'bp_delete' | 'bp_share' | 'sop_archive'
  // Workflows (existing)
  | 'wf_view' | 'wf_create' | 'wf_update_delete' | 'wf_output' | 'wf_run' | 'wf_upload'
  // Reports (existing)
  | 'rp_view' | 'rp_edit' | 'rp_comment' | 'rp_share' | 'rp_delete'
  // Dashboard (existing)
  | 'db_view' | 'db_add' | 'db_share' | 'db_delete'
  // Datasource (existing 2 + new 3)
  | 'ds_live' | 'ds_upload' | 'ds_connect' | 'ds_rename' | 'ds_delete'
  // Engagements (new)
  | 'eng_view' | 'eng_create' | 'eng_edit' | 'eng_delete' | 'eng_assign' | 'eng_close' | 'eng_share'
  // Controls (new)
  | 'ctrl_view' | 'ctrl_create' | 'ctrl_edit' | 'ctrl_delete' | 'ctrl_link' | 'ctrl_export' | 'ctrl_share'
  // RACM (existing + new linking/unmap/archive)
  | 'racm_view' | 'racm_edit' | 'racm_generate' | 'racm_share'
  | 'racm_link_risk' | 'racm_link_control' | 'racm_link_workflow' | 'racm_unmap' | 'racm_archive'
  // Risk register (new)
  | 'risk_view' | 'risk_create' | 'risk_edit' | 'risk_archive' | 'risk_delete' | 'risk_share'
  // Exceptions / findings (new)
  | 'exc_view' | 'exc_classify' | 'exc_triage' | 'exc_resolve' | 'exc_assign'
  // Audit planning (new)
  | 'plan_view' | 'plan_edit'
  // AI Concierge (new) — Ask IRA chat is free for everyone, so it has no key
  | 'concierge_use'
  // Memory (Memory-across-platform PRD): view the registry, approve shared
  // proposals in My Queue, administer org rules & policy in Admin
  | 'mem_view' | 'mem_approve' | 'mem_admin'
  // Admin (existing 2 + new 4 + usage)
  | 'ad_logs' | 'ad_logs_export' | 'ad_users_manage' | 'ad_roles_manage' | 'ad_usage' | 'ad_usage_people' | 'ad_usage_self' | 'ad_usage_export';

export const PERMISSION_GROUPS: PermissionGroup[] = [
  { group: 'Business Process', module: 'business_process', perms: [
    { key: 'bp_view',   name: 'View',               desc: 'View business process and their details' },
    { key: 'bp_create', name: 'Create and Update',  desc: 'Build and updates business processes' },
    { key: 'bp_edit',   name: 'Edit Details',       desc: 'Rename SOPs and edit linked risks & controls' },
    { key: 'bp_delete', name: 'Delete',             desc: 'Remove business processes permanently' },
    { key: 'bp_share',  name: 'Sharing Permission', desc: 'Share with specific users and team' },
    { key: 'sop_archive', name: 'Archive SOP',      desc: 'Archive or restore SOPs' },
  ]},
  { group: 'Workflows', module: 'workflows', perms: [
    { key: 'wf_view',          name: 'View',            desc: 'View workflow & their details' },
    { key: 'wf_create',        name: 'Create',          desc: 'Create a copy of the workflow' },
    { key: 'wf_update_delete', name: 'Update & Delete', desc: 'Modify and remove existing workflows' },
    { key: 'wf_output',        name: 'View Output',     desc: 'Preview and download generated outputs' },
    { key: 'wf_run',           name: 'Run',             desc: 'Run workflows individually or in bulk' },
    { key: 'wf_upload',        name: 'Upload Data',     desc: 'Add workflows from external sources' },
  ]},
  { group: 'Reports', module: 'reports', perms: [
    { key: 'rp_view',    name: 'View',               desc: 'View reports and their queries' },
    { key: 'rp_edit',    name: 'Edit/Update',        desc: 'Update report structure and content' },
    { key: 'rp_comment', name: 'Comment on Queries', desc: 'Add comments and attach proofs to queries' },
    { key: 'rp_share',   name: 'Share',              desc: 'Share reports for review and collaboration' },
    { key: 'rp_delete',  name: 'Delete Queries',     desc: 'Remove existing queries' },
  ]},
  { group: 'Dashboard', module: 'dashboard', perms: [
    { key: 'db_view',    name: 'View',               desc: 'View dashboards and insights' },
    { key: 'db_add',     name: 'Add Queries',        desc: 'Add queries and widgets to dashboards' },
    { key: 'db_share',   name: 'Share Queries',      desc: 'Share dashboards for team access' },
    { key: 'db_delete',  name: 'Delete Queries',     desc: 'Delete dashboards and widgets' },
  ]},
  { group: 'Datasource', module: 'datasource', perms: [
    { key: 'ds_live',    name: 'Live Datasource List', desc: 'View active data sources' },
    { key: 'ds_upload',  name: 'Manually Upload',      desc: 'Upload data files manually' },
    { key: 'ds_connect', name: 'Connect Source',       desc: 'Connect a database or API source' },
    { key: 'ds_rename',  name: 'Rename Source',        desc: 'Rename an existing data source' },
    { key: 'ds_delete',  name: 'Remove Source',        desc: 'Remove or disconnect sources (incl. bulk)' },
  ]},
  { group: 'Engagements', module: 'engagements', perms: [
    { key: 'eng_view',   name: 'View',            desc: 'View engagements and their detail' },
    { key: 'eng_create', name: 'Create',          desc: 'Create new engagements' },
    { key: 'eng_edit',   name: 'Edit',            desc: 'Edit engagement fields and scope' },
    { key: 'eng_delete', name: 'Delete',          desc: 'Delete engagements' },
    { key: 'eng_assign', name: 'Assign',          desc: 'Assign owner and reviewer' },
    { key: 'eng_close',  name: 'Close/Finalize',  desc: 'Close or finalize engagements' },
    { key: 'eng_share',  name: 'Share',           desc: 'Share an engagement with users and teams' },
  ]},
  { group: 'Controls', module: 'controls', perms: [
    { key: 'ctrl_view',   name: 'View',          desc: 'View the control library' },
    { key: 'ctrl_create', name: 'Create',        desc: 'Create new controls' },
    { key: 'ctrl_edit',   name: 'Edit',          desc: 'Edit existing controls' },
    { key: 'ctrl_delete', name: 'Delete',        desc: 'Delete controls' },
    { key: 'ctrl_link',   name: 'Link Workflow', desc: 'Link a control to a workflow' },
    { key: 'ctrl_export', name: 'Export',        desc: 'Export the control library' },
    { key: 'ctrl_share',  name: 'Share',         desc: 'Share the control library with users and teams' },
  ]},
  { group: 'RACM', module: 'racm', perms: [
    { key: 'racm_view',     name: 'View',     desc: 'View RACM matrices' },
    { key: 'racm_edit',     name: 'Edit',     desc: 'Edit and rename RACM rows' },
    { key: 'racm_generate', name: 'Generate', desc: 'Generate a RACM' },
    { key: 'racm_share',    name: 'Share',    desc: 'Share a RACM with users and teams' },
    { key: 'racm_link_risk',     name: 'Link Risk',     desc: 'Map a risk to a RACM' },
    { key: 'racm_link_control',  name: 'Link Control',  desc: 'Map a control to a risk in RACM' },
    { key: 'racm_link_workflow', name: 'Link Workflow', desc: 'Map a workflow to a control in RACM' },
    { key: 'racm_unmap',         name: 'Unmap',         desc: 'Remove a risk–control mapping' },
    { key: 'racm_archive',       name: 'Archive',       desc: 'Archive a RACM or remove a risk from it' },
  ]},
  { group: 'Risk Register', module: 'risk', perms: [
    { key: 'risk_view',   name: 'View',   desc: 'View the risk register' },
    { key: 'risk_create', name: 'Create', desc: 'Create new risks' },
    { key: 'risk_edit',    name: 'Edit',    desc: 'Edit existing risks' },
    { key: 'risk_archive', name: 'Archive', desc: 'Archive risks (retire from the active list)' },
    { key: 'risk_delete',  name: 'Delete',  desc: 'Permanently delete an archived risk' },
    { key: 'risk_share',   name: 'Share',   desc: 'Share the risk register with users and teams' },
  ]},
  { group: 'Exceptions', module: 'exceptions', perms: [
    { key: 'exc_view',     name: 'View',     desc: 'View exceptions and findings' },
    { key: 'exc_classify', name: 'Classify', desc: 'Classify exceptions' },
    { key: 'exc_triage',   name: 'Triage',   desc: 'Triage exceptions' },
    { key: 'exc_resolve',  name: 'Resolve',  desc: 'Resolve or close exceptions' },
    { key: 'exc_assign',   name: 'Assign',   desc: 'Assign exceptions to owners' },
  ]},
  { group: 'Audit Planning', module: 'planning', perms: [
    { key: 'plan_view', name: 'View', desc: 'View the audit plan and timeline' },
    { key: 'plan_edit', name: 'Edit', desc: 'Edit the audit plan' },
  ]},
  { group: 'AI Concierge', module: 'concierge', perms: [
    { key: 'concierge_use', name: 'Use AI Concierge', desc: 'Use the AI Concierge tools' },
  ]},
  { group: 'Memory', module: 'memory', perms: [
    { key: 'mem_view',    name: 'View Registry',     desc: 'Browse the Smart Learn memory registry and provenance' },
    { key: 'mem_approve', name: 'Approve Proposals', desc: 'Approve, adjust or reject shared-memory proposals in My Queue' },
    { key: 'mem_admin',   name: 'Manage Org Rules',  desc: 'Create and retire organization-wide memory rules and policy' },
  ]},
  { group: 'Admin', module: 'admin', perms: [
    { key: 'ad_logs',         name: 'Compliance Logs',  desc: 'View compliance-related logs and audit trails' },
    { key: 'ad_logs_export',  name: 'Export Logs',      desc: 'Export audit logs as CSV' },
    { key: 'ad_users_manage', name: 'Manage Users',     desc: 'Manage users and teams' },
    { key: 'ad_roles_manage', name: 'Manage Roles',     desc: 'Manage roles and permissions' },
    { key: 'ad_usage',        name: 'Platform Usage',   desc: 'View workspace-wide platform usage and adoption metrics' },
    // Named per-person visibility. Held alone (without `ad_usage`) it is the
    // team-lead scope: the People tab, scoped to the holder's own team. Held
    // together with `ad_usage` (System Admin) it unlocks every named member and
    // team across the workspace.
    { key: 'ad_usage_people', name: 'Per-person Usage', desc: 'See named member and team activity in Platform Usage' },
    // The floor. Everyone can read their own work on Platform Usage — their
    // queue, their runs, the hours their automation saved. It shows one person
    // and never a comparison, so it is safe to hold on its own.
    { key: 'ad_usage_self',   name: 'My Own Usage',     desc: 'See your own queue, runs and hours saved in Platform Usage' },
    { key: 'ad_usage_export', name: 'Export Usage',     desc: 'Export platform usage as CSV' },
    // There is no Usage Assumptions permission any more. The assumptions and the
    // contract prices used to have their own read-only screen in Administration;
    // the page states both itself now, under the figures they produce, so a
    // second permission for a second surface would gate nothing.
  ]},
];

/** Flat list of every permission key, in catalog order. */
export const ALL_PERMISSION_KEYS: PermissionKey[] = PERMISSION_GROUPS.flatMap(g => g.perms.map(p => p.key));

/** The `*_view` / `*_use` key of each module — the "View Only" preset. */
export const VIEW_ONLY_KEYS: PermissionKey[] = PERMISSION_GROUPS.flatMap(g => g.perms.map(p => p.key).slice(0, 1));

/* ──────────────────────────────────────────────────────────────────────────
 * Preset helpers (None / View Only / Full Access) — unchanged behaviour
 * ────────────────────────────────────────────────────────────────────────── */

export type PermissionPreset = 'none' | 'readonly' | 'full';

export function presetKeys(preset: PermissionPreset): PermissionKey[] {
  if (preset === 'none') return [];
  if (preset === 'full') return [...ALL_PERMISSION_KEYS];
  return [...VIEW_ONLY_KEYS];
}

/* ──────────────────────────────────────────────────────────────────────────
 * Roles
 * ────────────────────────────────────────────────────────────────────────── */

export interface Role {
  id: string;
  name: string;
  type: 'System' | 'Custom';
  description?: string;
  createdBy: string;
  lastModified: string;
  permissions: PermissionKey[];
}

// Helper sets for readable seed-role definitions.
// "View everything" minus admin-log visibility — the Admin area stays admin-only,
// so non-admin roles never see the Admin nav section.
// `ad_usage_self` is added by hand because VIEW_ONLY_KEYS takes only the first
// permission of each group, and the Admin group's first key is `ad_logs`.
const VIEW_ALL: PermissionKey[] = [...VIEW_ONLY_KEYS.filter(k => k !== 'ad_logs'), 'ad_usage_self'];

const AUDITOR_KEYS: PermissionKey[] = [
  ...VIEW_ALL,
  'wf_run', 'wf_output', 'wf_create',
  'eng_create', 'eng_edit', 'eng_assign', 'eng_share',
  'ctrl_edit', 'ctrl_link', 'ctrl_export',
  'racm_edit', 'racm_share', 'racm_link_risk', 'racm_link_control', 'racm_link_workflow', 'racm_unmap', 'racm_archive',
  'bp_edit', 'sop_archive',
  'exc_classify', 'exc_triage', 'exc_assign',
  'rp_edit', 'rp_comment',
  'db_add',
  'ds_upload',
  'plan_edit',
];

const RISK_OWNER_KEYS: PermissionKey[] = [
  ...VIEW_ALL,
  'risk_create', 'risk_edit', 'risk_archive', 'risk_share',
  'exc_classify', 'exc_resolve', 'exc_assign',
  'rp_comment',
];

const REVIEWER_KEYS: PermissionKey[] = [
  ...VIEW_ALL,
  'rp_comment',
  'exc_triage',
];

// A team lead reads their own team's adoption, and nothing else admin. They hold
// `ad_usage_people` WITHOUT `ad_usage`: that combination is the signal Platform
// Usage reads to scope the People tab to the holder's own team (see the view).
const TEAM_LEAD_KEYS: PermissionKey[] = [
  ...VIEW_ALL,
  'ad_usage_people',
];

const ENABLER_KEYS: PermissionKey[] = [
  ...VIEW_ALL,
  // a broad creator/operator, minus org admin
  'bp_create', 'bp_edit', 'bp_share', 'sop_archive',
  'wf_create', 'wf_update_delete', 'wf_output', 'wf_run', 'wf_upload',
  'rp_edit', 'rp_comment', 'rp_share',
  'db_add', 'db_share',
  'ds_upload', 'ds_connect', 'ds_rename',
  'eng_create', 'eng_edit', 'eng_assign', 'eng_share',
  'ctrl_create', 'ctrl_edit', 'ctrl_link', 'ctrl_export', 'ctrl_share',
  'racm_edit', 'racm_generate', 'racm_share', 'racm_link_risk', 'racm_link_control', 'racm_link_workflow', 'racm_unmap', 'racm_archive',
  'risk_create', 'risk_edit', 'risk_archive', 'risk_share',
  'exc_classify', 'exc_triage', 'exc_resolve',
  'plan_edit',
];

export const SEED_ROLES: Role[] = [
  { id: 'role-admin',   name: 'System Admin', type: 'System', createdBy: 'System', lastModified: 'Jan 10, 2026',
    description: 'Full access to every module and admin control.', permissions: [...ALL_PERMISSION_KEYS] },
  { id: 'role-enabler', name: 'Enabler',      type: 'System', createdBy: 'System', lastModified: 'Feb 05, 2026',
    description: 'Broad creator/operator across modules.', permissions: ENABLER_KEYS },
  { id: 'role-auditor', name: 'Auditor',      type: 'System', createdBy: 'System', lastModified: 'Jan 10, 2026',
    description: 'Executes audits — runs workflows, edits engagements & controls.', permissions: AUDITOR_KEYS },
  { id: 'role-risk',    name: 'Risk Owner',   type: 'System', createdBy: 'System', lastModified: 'Jan 10, 2026',
    description: 'Owns risks and resolves exceptions.', permissions: RISK_OWNER_KEYS },
  { id: 'role-reviewer',name: 'Reviewer',     type: 'System', createdBy: 'System', lastModified: 'Jan 12, 2026',
    description: 'Reviews and comments; limited edit.', permissions: REVIEWER_KEYS },
  { id: 'role-viewer',  name: 'Viewer',       type: 'System', createdBy: 'System', lastModified: 'Jan 10, 2026',
    description: 'Read-only across all modules.', permissions: [...VIEW_ALL] },
  { id: 'role-teamlead',name: 'Team Lead',    type: 'System', createdBy: 'System', lastModified: 'Jul 16, 2026',
    description: "Reads their own team's adoption in Platform Usage.", permissions: TEAM_LEAD_KEYS },
];

export function getRole(roleId: string): Role | undefined {
  return SEED_ROLES.find(r => r.id === roleId);
}

/** Map a `Person` (from grc-domain) to a seed role id, by their domain role. */
const PERSON_ROLE_BY_DOMAIN: Record<string, string> = {
  Auditor: 'role-auditor',
  'Risk Owner': 'role-risk',
  Reviewer: 'role-reviewer',
  Manager: 'role-enabler',
  Specialist: 'role-enabler',
};

export const PERSON_ROLES: Record<string, string> = Object.fromEntries(
  PEOPLE.map(p => [p.id, PERSON_ROLE_BY_DOMAIN[p.role] ?? 'role-viewer']),
);

/* ──────────────────────────────────────────────────────────────────────────
 * Route gating — which permission a view requires
 * ────────────────────────────────────────────────────────────────────────── */

/** A view gate is one permission, or a set the user needs ANY of (see App.tsx). */
export const VIEW_PERMISSIONS: Partial<Record<View, PermissionKey | PermissionKey[]>> = {
  // Workflows
  'workflow-templates': 'wf_view',
  'workflow-detail': 'wf_view',
  'workflow-library': 'wf_view',
  'workflow-executor': 'wf_run',
  'workflow-edit-in-chat': 'wf_view',
  // Process hub / business process
  'programs': 'bp_view',
  'business-processes': 'bp_view',
  'bp-detail': 'bp_view',
  // Audit planning
  'audit-planning': 'plan_view',
  // Engagements
  'engagements': 'eng_view',
  'sox-testing': 'eng_view',
  'engagement-overview': 'eng_view',
  'engagement-case-management': 'eng_view',
  'my-queue': 'eng_view',
  'closed-case-sampling': 'eng_view',
  'engagement-compare': 'eng_view',
  'engagement-detail': 'eng_view',
  'engagement-final': 'eng_view',
  'engagement-config': 'eng_view',
  'audit-execution': 'eng_view',
  // Execution
  'execution-testing': 'eng_view',
  'execution-evidence': 'eng_view',
  // Exceptions
  'manage-exceptions': 'exc_view',
  // Governance
  'governance-racm': 'racm_view',
  'governance-racm-detail': 'racm_view',
  'governance-racm-generate': 'racm_generate',
  'racm-full-editor': 'racm_edit',
  'governance-controls': 'ctrl_view',
  'governance-control-detail': 'ctrl_view',
  'audit-risk-register': 'risk_view',
  // Intelligence
  'dashboards': 'db_view',
  'dashboard-detail': 'db_view',
  'reports': 'rp_view',
  'report-history': 'rp_view',
  'report-builder': 'rp_edit',
  'ai-concierge': 'concierge_use',
  'ai-concierge-forensics': 'concierge_use',
  'ai-concierge-table-extractor': 'concierge_use',
  'ai-concierge-workflow-builder': 'concierge_use',
  // Chat (Ask IRA) is intentionally ungated — free for all users.
  // Knowledge / data
  'knowledge-hub': 'ds_live',
  'data-sources': 'ds_live',
  'configuration': 'ds_live',
  // Admin
  'admin-users': 'ad_users_manage',
  'admin-roles': 'ad_roles_manage',
  'admin-logs': 'ad_logs',
  // Either the workspace-wide admin view, or a team lead's own-team scope.
  'platform-usage': ['ad_usage', 'ad_usage_people', 'ad_usage_self'],
  // home, recents, dev routes intentionally ungated (open to all)
};
