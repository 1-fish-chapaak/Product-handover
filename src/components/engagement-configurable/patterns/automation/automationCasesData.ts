// ─── Automation Cases — Types & Helpers ────────────────────────────────────

export type CaseStatus = 'DRAFT' | 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'CANCELLED';
export type CasePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type CaseCategory = 'RECONCILIATION_MISMATCH' | 'DUPLICATE' | 'MISSING_DOCUMENT' | 'POLICY_VIOLATION' | 'DATA_QUALITY' | 'OTHER';
export type DeficiencyType = 'SYSTEM_DEFICIENCY' | 'DESIGN_DEFICIENCY' | 'OPERATING_DEFICIENCY' | 'DATA_DEFICIENCY' | 'DOCUMENTATION_DEFICIENCY' | 'CONTROL_DEFICIENCY' | 'PROCESS_DEFICIENCY' | 'OTHER';
export type RemediationStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED' | 'ACCEPTED' | 'REJECTED';

export const DEFICIENCY_LABELS: Record<DeficiencyType, string> = {
  SYSTEM_DEFICIENCY: 'System Deficiency', DESIGN_DEFICIENCY: 'Design Deficiency', OPERATING_DEFICIENCY: 'Operating Deficiency',
  DATA_DEFICIENCY: 'Data Deficiency', DOCUMENTATION_DEFICIENCY: 'Documentation Deficiency', CONTROL_DEFICIENCY: 'Control Deficiency',
  PROCESS_DEFICIENCY: 'Process Deficiency', OTHER: 'Other',
};
export const DEFICIENCY_CLS: Record<DeficiencyType, string> = {
  SYSTEM_DEFICIENCY: 'bg-red-50 text-red-700', DESIGN_DEFICIENCY: 'bg-amber-50 text-amber-700', OPERATING_DEFICIENCY: 'bg-orange-50 text-orange-700',
  DATA_DEFICIENCY: 'bg-blue-50 text-blue-700', DOCUMENTATION_DEFICIENCY: 'bg-purple-50 text-purple-700', CONTROL_DEFICIENCY: 'bg-red-50 text-red-600',
  PROCESS_DEFICIENCY: 'bg-amber-50 text-amber-600', OTHER: 'bg-gray-100 text-gray-600',
};
export const REMEDIATION_STATUS_CLS: Record<RemediationStatus, string> = {
  NOT_STARTED: 'bg-gray-100 text-gray-600', IN_PROGRESS: 'bg-blue-50 text-blue-700', SUBMITTED: 'bg-purple-50 text-purple-700',
  ACCEPTED: 'bg-emerald-50 text-emerald-700', REJECTED: 'bg-red-50 text-red-700',
};
export const DEFICIENCY_TYPES: DeficiencyType[] = ['SYSTEM_DEFICIENCY', 'DESIGN_DEFICIENCY', 'OPERATING_DEFICIENCY', 'DATA_DEFICIENCY', 'DOCUMENTATION_DEFICIENCY', 'CONTROL_DEFICIENCY', 'PROCESS_DEFICIENCY', 'OTHER'];

// User-facing status labels for audit assignment flow
export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  DRAFT: 'Draft', OPEN: 'Sent to Owner', IN_PROGRESS: 'Owner Response In Progress',
  RESOLVED: 'Submitted for Review', CLOSED: 'Accepted & Closed', CANCELLED: 'Closed — Not Required',
};

export interface CaseHistoryItem { id: string; action: string; actor: string; timestamp: string; comments: string }

export interface AutomationCase {
  id: string; title: string; description: string;
  sourceRunId: string; sourceExceptionId: string;
  severity: CasePriority; category: CaseCategory; owner: string;
  dueDate: string; status: CaseStatus; priority: CasePriority;
  deficiencyType?: DeficiencyType;
  reviewer?: string;
  remediationPlan?: string;
  rootCause?: string;
  preventiveAction?: string;
  remediationOwner?: string;
  remediationDueDate?: string;
  remediationStatus?: RemediationStatus;
  closureNotes?: string;
  auditorNotes?: string;
  sourceWorkflowName?: string;
  evidenceRefs: string[]; comments: string;
  createdAt: string; updatedAt: string;
  history: CaseHistoryItem[];
}

export interface AutomationCasesState {
  cases: AutomationCase[];
  linkedExceptionIds: string[];
  caseNotes: string;
}

export const CASE_STATUS_CLS: Record<CaseStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-600', OPEN: 'bg-blue-50 text-blue-700', IN_PROGRESS: 'bg-purple-50 text-purple-700',
  RESOLVED: 'bg-emerald-50 text-emerald-700', CLOSED: 'bg-gray-50 text-gray-500', CANCELLED: 'bg-gray-50 text-gray-400',
};
export const CASE_PRIORITY_CLS: Record<CasePriority, string> = {
  LOW: 'bg-gray-100 text-gray-600', MEDIUM: 'bg-blue-50 text-blue-700', HIGH: 'bg-amber-50 text-amber-700', CRITICAL: 'bg-red-50 text-red-700',
};
export const CASE_CAT_LABELS: Record<CaseCategory, string> = {
  RECONCILIATION_MISMATCH: 'Reconciliation Mismatch', DUPLICATE: 'Duplicate', MISSING_DOCUMENT: 'Missing Document',
  POLICY_VIOLATION: 'Policy Violation', DATA_QUALITY: 'Data Quality', OTHER: 'Other',
};

export function deriveCasesSummary(state: AutomationCasesState) {
  const c = state.cases;
  return {
    total: c.length,
    sentToOwner: c.filter(x => x.status === 'OPEN').length,
    withOwner: c.filter(x => x.status === 'IN_PROGRESS').length,
    submittedForReview: c.filter(x => x.status === 'RESOLVED').length,
    acceptedClosed: c.filter(x => x.status === 'CLOSED').length,
    closedNotRequired: c.filter(x => x.status === 'CANCELLED').length,
    criticalHigh: c.filter(x => (x.priority === 'CRITICAL' || x.priority === 'HIGH') && !['CLOSED', 'CANCELLED'].includes(x.status)).length,
  };
}
