// ─── Compliance Requests / PBC — Mock Data & Types ────────────────────────

// Workspace-level state (persists across tab switches)
import type { SamplesEvidenceState } from './complianceSamplesEvidenceData';
import type { AttributeTestingState } from './complianceAttributeTestingData';
import type { ComplianceReviewState } from './complianceReviewData';
import type { ComplianceConclusionState } from './complianceConclusionData';

export interface ComplianceWorkspaceState {
  requests: PBCRequest[];
  samplesEvidence: SamplesEvidenceState;
  attributeTesting: AttributeTestingState;
  review: ComplianceReviewState;
  conclusion: ComplianceConclusionState;
}

export type PBCRequestStatus = 'Draft' | 'Sent' | 'Pending' | 'Partially Received' | 'Received' | 'Overdue' | 'Cancelled';
export type PBCRequestType = 'Sample File' | 'Population Data' | 'Evidence Documents' | 'Approval Evidence' | 'Exception Support' | 'Other';
export type PBCPriority = 'Low' | 'Medium' | 'High' | 'Critical';

export interface PBCRequest {
  id: string;
  title: string;
  description: string;
  requestType: PBCRequestType;
  linkedControlId: string;
  linkedControlName: string;
  linkedAttributes: string; // e.g. "A, B, C" or "All attributes"
  requestedFrom: string;
  dueDate: string;
  status: PBCRequestStatus;
  priority: PBCPriority;
  filesReceived: string[];
  progressText?: string; // e.g. "12 / 25 samples received"
  comments: string[];
  createdAt: string;
  sentAt?: string;
  receivedAt?: string;
}

export const MOCK_PBC_REQUESTS: PBCRequest[] = [
  {
    id: 'REQ-001',
    title: 'Upload selected invoice sample file',
    description: 'Provide the invoice sample data file for FY26 Q1 covering all P2P transactions above materiality threshold.',
    requestType: 'Sample File',
    linkedControlId: 'C001', linkedControlName: 'Three-way PO/GRN/Invoice Matching',
    linkedAttributes: 'All attributes',
    requestedFrom: 'P2P Process Owner',
    dueDate: '2026-04-10',
    status: 'Received',
    priority: 'High',
    filesReceived: ['invoice_samples_fy26_q1.xlsx'],
    createdAt: '2026-04-01', sentAt: '2026-04-02', receivedAt: '2026-04-09',
    comments: ['Sample file uploaded on time.'],
  },
  {
    id: 'REQ-002',
    title: 'Provide PO, GRN, and Invoice copies for selected samples',
    description: 'Upload PO, GRN, and Invoice document copies for each selected sample. These will be used as evidence for three-way match validation.',
    requestType: 'Evidence Documents',
    linkedControlId: 'C001', linkedControlName: 'Three-way PO/GRN/Invoice Matching',
    linkedAttributes: 'A, B, C',
    requestedFrom: 'AP Manager',
    dueDate: '2026-04-12',
    status: 'Partially Received',
    priority: 'High',
    filesReceived: ['PO_batch_1.zip', 'GRN_batch_1.zip'],
    progressText: '12 / 25 samples received',
    createdAt: '2026-04-02', sentAt: '2026-04-03',
    comments: ['First batch uploaded. Remaining invoices expected by EOD.'],
  },
  {
    id: 'REQ-003',
    title: 'Provide approval logs for payment authorization',
    description: 'Export and upload payment approval logs from ERP showing dual authorization for each payment in the sample.',
    requestType: 'Approval Evidence',
    linkedControlId: 'C001', linkedControlName: 'Three-way PO/GRN/Invoice Matching',
    linkedAttributes: 'D — Payment approval exists',
    requestedFrom: 'Finance Controller',
    dueDate: '2026-04-14',
    status: 'Pending',
    priority: 'Medium',
    filesReceived: [],
    createdAt: '2026-04-03', sentAt: '2026-04-04',
    comments: [],
  },
  {
    id: 'REQ-004',
    title: 'Provide duplicate invoice exception justification',
    description: 'For flagged duplicate invoices that were overridden, provide senior approval documentation and justification.',
    requestType: 'Exception Support',
    linkedControlId: 'C002', linkedControlName: 'Duplicate Invoice Detection',
    linkedAttributes: 'C — Duplicate override authorization',
    requestedFrom: 'AP Lead',
    dueDate: '2026-04-15',
    status: 'Overdue',
    priority: 'High',
    filesReceived: [],
    createdAt: '2026-04-05', sentAt: '2026-04-06',
    comments: ['Reminder sent on Apr 14.', 'Still awaiting response.'],
  },
  {
    id: 'REQ-005',
    title: 'Provide vendor master change approval documents',
    description: 'Upload change request forms, bank verification documents, and approval chain for vendor master changes in the audit period.',
    requestType: 'Evidence Documents',
    linkedControlId: 'C003', linkedControlName: 'Vendor Master Change Review',
    linkedAttributes: 'A, B, C',
    requestedFrom: 'Vendor Master Owner',
    dueDate: '2026-04-16',
    status: 'Draft',
    priority: 'Medium',
    filesReceived: [],
    createdAt: '2026-04-08',
    comments: [],
  },
];

export const REQUEST_TYPES: PBCRequestType[] = ['Sample File', 'Population Data', 'Evidence Documents', 'Approval Evidence', 'Exception Support', 'Other'];
export const PRIORITIES: PBCPriority[] = ['Low', 'Medium', 'High', 'Critical'];

export function derivePBCSummary(requests: PBCRequest[]) {
  const total = requests.length;
  const pending = requests.filter(r => r.status === 'Pending' || r.status === 'Sent').length;
  const partial = requests.filter(r => r.status === 'Partially Received').length;
  const received = requests.filter(r => r.status === 'Received').length;
  const overdue = requests.filter(r => r.status === 'Overdue').length;
  const draft = requests.filter(r => r.status === 'Draft').length;
  return { total, pending, partial, received, overdue, draft };
}
