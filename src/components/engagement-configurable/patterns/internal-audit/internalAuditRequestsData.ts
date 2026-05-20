// ─── Internal Audit Requests / IDR — Types & Mock Data ────────────────────

export type IARequestStatus = 'DRAFT' | 'SENT' | 'PENDING' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'OVERDUE' | 'CANCELLED';
export type IARequestType = 'SOP_DOCUMENT' | 'POLICY_DOCUMENT' | 'PROCESS_WALKTHROUGH' | 'TRANSACTION_DATA' | 'MASTER_DATA' | 'APPROVAL_MATRIX' | 'EXCEPTION_LOG' | 'SYSTEM_EXTRACT' | 'SUPPORTING_EVIDENCE' | 'OTHER';
export type IALinkedScopeType = 'PROCESS' | 'SUB_PROCESS' | 'ACTIVITY' | 'SOP' | 'CHECKLIST' | 'WORKFLOW' | 'CUSTOM_SCOPE';
export type IAPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface IARequest {
  id: string;
  title: string;
  description: string;
  requestType: IARequestType;
  linkedScopeType: IALinkedScopeType;
  linkedScopeLabel: string;
  requestedFrom: string;
  dueDate: string;
  status: IARequestStatus;
  priority: IAPriority;
  filesReceived: string[];
  progressText?: string;
  comments: string[];
  createdAt: string;
  updatedAt: string;
}

export interface InternalAuditRequestState {
  requests: IARequest[];
  proceedWithoutIDR: boolean;
}

export const REQUEST_TYPE_LABELS: Record<IARequestType, string> = {
  SOP_DOCUMENT: 'SOP / Policy',
  POLICY_DOCUMENT: 'Policy Document',
  PROCESS_WALKTHROUGH: 'Process Walkthrough',
  TRANSACTION_DATA: 'Transaction Data',
  MASTER_DATA: 'Master Data',
  APPROVAL_MATRIX: 'Approval Matrix',
  EXCEPTION_LOG: 'Exception Log',
  SYSTEM_EXTRACT: 'System Extract',
  SUPPORTING_EVIDENCE: 'Supporting Evidence',
  OTHER: 'Other',
};

export const REQUEST_TYPES_LIST: IARequestType[] = ['SOP_DOCUMENT', 'PROCESS_WALKTHROUGH', 'TRANSACTION_DATA', 'MASTER_DATA', 'APPROVAL_MATRIX', 'EXCEPTION_LOG', 'SYSTEM_EXTRACT', 'SUPPORTING_EVIDENCE', 'OTHER'];
export const PRIORITIES_LIST: IAPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
export const SCOPE_TYPE_LABELS: Record<IALinkedScopeType, string> = {
  PROCESS: 'Process', SUB_PROCESS: 'Sub-process', ACTIVITY: 'Activity',
  SOP: 'SOP', CHECKLIST: 'Checklist', WORKFLOW: 'Workflow', CUSTOM_SCOPE: 'Custom',
};

// ─── Mock Data ────────────────────────────────────────────────────────────

export const MOCK_IA_REQUESTS: IARequest[] = [
  {
    id: 'REQ-IA-001', title: 'Provide P2P SOP and process walkthrough',
    description: 'Upload current version of P2P SOP and supporting process walkthrough documentation for the audit period.',
    requestType: 'SOP_DOCUMENT', linkedScopeType: 'PROCESS', linkedScopeLabel: 'P2P — Procure to Pay',
    requestedFrom: 'P2P Process Owner', dueDate: '2026-04-10', status: 'RECEIVED', priority: 'HIGH',
    filesReceived: ['SOP-P2P-001.pdf', 'P2P_Process_Walkthrough.docx'],
    comments: ['Documents uploaded on time.'], createdAt: '2026-04-01', updatedAt: '2026-04-09',
  },
  {
    id: 'REQ-IA-002', title: 'Provide invoice register for audit period',
    description: 'Export full invoice register from ERP covering Apr 2025 — Mar 2026 for sampling and analysis.',
    requestType: 'TRANSACTION_DATA', linkedScopeType: 'ACTIVITY', linkedScopeLabel: 'Invoice Processing',
    requestedFrom: 'AP Manager', dueDate: '2026-04-12', status: 'PARTIALLY_RECEIVED', priority: 'HIGH',
    filesReceived: ['invoice_register_q1.xlsx'], progressText: '1 of 2 files received',
    comments: ['Q1 file received. Q2-Q4 pending.'], createdAt: '2026-04-02', updatedAt: '2026-04-11',
  },
  {
    id: 'REQ-IA-003', title: 'Provide approval matrix and delegation of authority',
    description: 'Share current approval matrix showing payment and PO approval levels by amount and role.',
    requestType: 'APPROVAL_MATRIX', linkedScopeType: 'ACTIVITY', linkedScopeLabel: 'Payment Approval',
    requestedFrom: 'Finance Controller', dueDate: '2026-04-14', status: 'PENDING', priority: 'MEDIUM',
    filesReceived: [], comments: [], createdAt: '2026-04-03', updatedAt: '2026-04-03',
  },
  {
    id: 'REQ-IA-004', title: 'Provide vendor master change log',
    description: 'Export vendor master change log showing all bank account, address, and contact changes during audit period.',
    requestType: 'MASTER_DATA', linkedScopeType: 'SUB_PROCESS', linkedScopeLabel: 'Vendor Master Changes',
    requestedFrom: 'Vendor Master Owner', dueDate: '2026-04-15', status: 'OVERDUE', priority: 'HIGH',
    filesReceived: [], comments: ['Reminder sent on Apr 14.', 'Still awaiting response.'], createdAt: '2026-04-05', updatedAt: '2026-04-15',
  },
  {
    id: 'REQ-IA-005', title: 'Provide exception log and remediation tracker',
    description: 'Share exception log from prior audits and current remediation tracker for P2P exceptions.',
    requestType: 'EXCEPTION_LOG', linkedScopeType: 'ACTIVITY', linkedScopeLabel: 'Exception Handling',
    requestedFrom: 'Process Owner', dueDate: '2026-04-16', status: 'DRAFT', priority: 'MEDIUM',
    filesReceived: [], comments: [], createdAt: '2026-04-08', updatedAt: '2026-04-08',
  },
];

export function deriveIARequestSummary(requests: IARequest[]) {
  return {
    total: requests.length,
    draft: requests.filter(r => r.status === 'DRAFT').length,
    pending: requests.filter(r => r.status === 'PENDING' || r.status === 'SENT').length,
    partial: requests.filter(r => r.status === 'PARTIALLY_RECEIVED').length,
    received: requests.filter(r => r.status === 'RECEIVED').length,
    overdue: requests.filter(r => r.status === 'OVERDUE').length,
  };
}
