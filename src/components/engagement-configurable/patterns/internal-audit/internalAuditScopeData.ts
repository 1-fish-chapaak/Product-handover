// ─── Internal Audit Scope — Types & Mock Data ────────────────────────────

export interface BusinessProcess { id: string; name: string; code: string; subProcesses: SubProcess[] }
export interface SubProcess { id: string; name: string; activities: Activity[] }
export interface Activity { id: string; name: string }
export interface SOPItem { id: string; name: string; version: string; process: string }
export interface RACMItem { id: string; name: string; version: string }
export interface ChecklistItem { id: string; name: string; items: number }
export interface WorkflowItem { id: string; name: string; type: 'Automated' | 'Manual' | 'Hybrid' }

export type ScopeReadiness = 'Draft Scope' | 'Needs Details' | 'Scope Ready';

export interface CustomSubProcess { id: string; name: string; businessProcessId: string; createdAt: string; source: 'CUSTOM' }

export interface InternalAuditScopeState {
  scopeLevel: string;
  businessProcessId: string;
  subProcessIds: string[];
  activityIds: string[];
  specificElements: string;
  sopIds: string[];
  racmVersionIds: string[];
  checklistIds: string[];
  selectedWorkflowIds: string[];
  scopeObjective: string;
  inScopeItems: string;
  outOfScopeItems: string;
  customSubProcesses: CustomSubProcess[];
}

import type { InternalAuditAnnouncementState } from './internalAuditAnnouncementData';
import type { InternalAuditRequestState } from './internalAuditRequestsData';
import type { InternalAuditAnalysisState } from './internalAuditAnalysisData';
import type { InternalAuditObservationsState } from './internalAuditObservationsData';
import type { InternalAuditDiscussionState } from './internalAuditDiscussionData';
import type { InternalAuditFinalReportState } from './internalAuditFinalReportData';
import type { InternalAuditActionPlanState } from './internalAuditActionPlanData';

export interface InternalAuditWorkspaceState {
  scope: InternalAuditScopeState;
  announcement: InternalAuditAnnouncementState;
  requests: InternalAuditRequestState;
  analysis: InternalAuditAnalysisState;
  observations: InternalAuditObservationsState;
  discussion: InternalAuditDiscussionState;
  finalReport: InternalAuditFinalReportState;
  actionPlan: InternalAuditActionPlanState;
}

export const DEFAULT_IA_SCOPE: InternalAuditScopeState = {
  scopeLevel: 'PROCESS',
  businessProcessId: '',
  subProcessIds: [],
  activityIds: [],
  specificElements: '',
  sopIds: [],
  racmVersionIds: [],
  checklistIds: [],
  selectedWorkflowIds: [],
  scopeObjective: '',
  inScopeItems: '',
  outOfScopeItems: '',
  customSubProcesses: [],
};

// ─── Mock Data ────────────────────────────────────────────────────────────

export const BUSINESS_PROCESSES: BusinessProcess[] = [
  { id: 'bp-p2p', name: 'Procure to Pay', code: 'P2P', subProcesses: [
    { id: 'sp-vo', name: 'Vendor Onboarding', activities: [{ id: 'a-vr', name: 'Vendor registration' }, { id: 'a-vv', name: 'Vendor verification' }] },
    { id: 'sp-pr', name: 'Purchase Requisition', activities: [{ id: 'a-rc', name: 'Requisition creation' }, { id: 'a-ra', name: 'Requisition approval' }] },
    { id: 'sp-po', name: 'Purchase Order', activities: [{ id: 'a-pc', name: 'PO creation' }, { id: 'a-pa', name: 'PO approval' }, { id: 'a-pd', name: 'PO dispatch' }] },
    { id: 'sp-gr', name: 'Goods Receipt', activities: [{ id: 'a-gi', name: 'GRN inspection' }, { id: 'a-gp', name: 'GRN posting' }] },
    { id: 'sp-ip', name: 'Invoice Processing', activities: [{ id: 'a-im', name: 'Invoice matching' }, { id: 'a-iv', name: 'Invoice validation' }, { id: 'a-ie', name: 'Exception handling' }] },
    { id: 'sp-pp', name: 'Payment Processing', activities: [{ id: 'a-pap', name: 'Payment approval' }, { id: 'a-pe', name: 'Payment execution' }] },
    { id: 'sp-vm', name: 'Vendor Master Changes', activities: [{ id: 'a-vc', name: 'Vendor bank change review' }, { id: 'a-vd', name: 'Duplicate vendor review' }] },
  ]},
  { id: 'bp-o2c', name: 'Order to Cash', code: 'O2C', subProcesses: [
    { id: 'sp-oe', name: 'Order Entry', activities: [{ id: 'a-oc', name: 'Order creation' }] },
    { id: 'sp-bi', name: 'Billing & Invoicing', activities: [{ id: 'a-ig', name: 'Invoice generation' }] },
    { id: 'sp-cr', name: 'Collections & Revenue', activities: [{ id: 'a-rr', name: 'Revenue recognition' }] },
  ]},
  { id: 'bp-r2r', name: 'Record to Report', code: 'R2R', subProcesses: [
    { id: 'sp-je', name: 'Journal Entries', activities: [{ id: 'a-je', name: 'JE posting' }, { id: 'a-jr', name: 'JE review' }] },
    { id: 'sp-re', name: 'Reconciliation', activities: [{ id: 'a-gl', name: 'GL reconciliation' }] },
    { id: 'sp-fc', name: 'Financial Close', activities: [{ id: 'a-mc', name: 'Month-end close' }] },
  ]},
  { id: 'bp-h2r', name: 'Hire to Retire', code: 'H2R', subProcesses: [
    { id: 'sp-rc', name: 'Recruitment', activities: [{ id: 'a-rh', name: 'Hire processing' }] },
    { id: 'sp-py', name: 'Payroll', activities: [{ id: 'a-pr', name: 'Payroll processing' }] },
  ]},
  { id: 'bp-itgc', name: 'IT General Controls', code: 'ITGC', subProcesses: [
    { id: 'sp-ac', name: 'Access Controls', activities: [{ id: 'a-ua', name: 'User access review' }] },
    { id: 'sp-cm', name: 'Change Management', activities: [{ id: 'a-cr', name: 'Change request review' }] },
  ]},
];

export const SOPS: SOPItem[] = [
  { id: 'sop-001', name: 'Procurement Lifecycle Management', version: 'v3.1', process: 'P2P' },
  { id: 'sop-002', name: 'Accounts Payable Invoice Processing', version: 'v2.4', process: 'P2P' },
  { id: 'sop-003', name: 'Vendor Master Change Management', version: 'v1.8', process: 'P2P' },
  { id: 'sop-004', name: 'Revenue Recognition Policy', version: 'v2.0', process: 'O2C' },
  { id: 'sop-005', name: 'Financial Close Procedures', version: 'v4.2', process: 'R2R' },
];

export const RACMS: RACMItem[] = [
  { id: 'racm-p2p', name: 'P2P Financial Controls RACM', version: 'v2.1' },
  { id: 'racm-ap', name: 'AP Process Controls RACM', version: 'v1.4' },
  { id: 'racm-o2c', name: 'O2C Revenue Controls RACM', version: 'v1.0' },
];

export const CHECKLISTS: ChecklistItem[] = [
  { id: 'cl-001', name: 'P2P Internal Audit Checklist', items: 42 },
  { id: 'cl-002', name: 'Accounts Payable Review Checklist', items: 28 },
  { id: 'cl-003', name: 'Vendor Master Review Checklist', items: 15 },
  { id: 'cl-004', name: 'Revenue Cycle Audit Checklist', items: 35 },
];

export const WORKFLOWS: WorkflowItem[] = [
  { id: 'wf-dd', name: 'Duplicate Invoice Detector', type: 'Automated' },
  { id: 'wf-pgi', name: 'PO-GRN-Invoice Match Workflow', type: 'Automated' },
  { id: 'wf-vmr', name: 'Vendor Master Change Review', type: 'Manual' },
  { id: 'wf-par', name: 'Payment Approval Review', type: 'Manual' },
  { id: 'wf-jer', name: 'Journal Entry Anomaly Review', type: 'Automated' },
];

export const SCOPE_LEVEL_LABELS: Record<string, { label: string; desc: string }> = {
  PROCESS: { label: 'Process', desc: 'Full business process scope, such as a complete P2P Audit for a plant.' },
  SUB_PROCESS: { label: 'Sub-process', desc: 'Covers one area such as Accounts Payable or Vendor Onboarding.' },
  ACTIVITY: { label: 'Activity', desc: 'Focuses on a specific activity such as invoice processing or payment approval.' },
  SPECIFIC_ELEMENT: { label: 'Specific Element', desc: 'Focused review on selected vendors, locations, systems, or transaction types.' },
};

// ─── Readiness ────────────────────────────────────────────────────────────

export function deriveIAScopeReadiness(scope: InternalAuditScopeState, engagement: { entityOrLocation?: string; reviewer?: string }, config?: { auditPeriodStart?: string; auditPeriodEnd?: string; processOwner?: string }): { status: ScopeReadiness; checks: { label: string; ok: boolean; required: boolean }[] } {
  const checks = [
    { label: 'Scope level selected', ok: !!scope.scopeLevel, required: true },
    { label: 'Business process selected', ok: !!scope.businessProcessId, required: true },
    { label: 'Entity/location defined', ok: !!engagement.entityOrLocation, required: true },
    { label: 'Scope objective written', ok: scope.scopeObjective.trim().length > 0, required: true },
    { label: 'SOP linked', ok: scope.sopIds.length > 0, required: false },
    { label: 'Checklist linked', ok: scope.checklistIds.length > 0, required: false },
    { label: 'RACM linked', ok: scope.racmVersionIds.length > 0, required: false },
  ];
  const requiredMissing = checks.filter(c => c.required && !c.ok).length;
  const status: ScopeReadiness = requiredMissing === 0 ? 'Scope Ready' : requiredMissing <= 2 ? 'Needs Details' : 'Draft Scope';
  return { status, checks };
}
