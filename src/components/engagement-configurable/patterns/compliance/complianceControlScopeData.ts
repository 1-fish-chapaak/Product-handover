// ─── Compliance Control Scope — Mock Data & Helpers ───────────────────────

export interface ScopeAttribute {
  id: string;
  code: string;
  name: string;
  assertion: string;
  required: boolean;
  workflowId?: string;
}

export interface ScopeWorkflow {
  id: string;
  name: string;
  version: string;
  type: 'Automated' | 'Manual' | 'Hybrid';
  status: 'Active' | 'Ready' | 'Draft';
  coveredAttributeIds: string[];
}

export interface ScopeControl {
  id: string;
  name: string;
  description: string;
  importance: 'Key' | 'Non-Key';
  nature: 'Preventive' | 'Detective' | 'Corrective';
  automation: 'Manual' | 'Automated' | 'Hybrid';
  process: string;
  owner: string;
  sourceStatus?: 'Active' | 'Needs Review' | 'Imported';
  attributes: ScopeAttribute[];
  workflows: ScopeWorkflow[];
}

export type ControlReadinessStatus = 'Ready' | 'Attributes Missing' | 'Workflow Missing' | 'Workflow Mapping Missing' | 'Needs Review';

export interface ControlReadiness {
  status: ControlReadinessStatus;
  label: string;
  severity: 'success' | 'warning' | 'error' | 'info';
  missingItems: string[];
}

export function deriveComplianceControlReadiness(ctrl: ScopeControl): ControlReadiness {
  if (ctrl.sourceStatus === 'Needs Review' || ctrl.sourceStatus === 'Imported') {
    return { status: 'Needs Review', label: 'Needs Review', severity: 'info', missingItems: ['Control requires review before testing'] };
  }
  if (ctrl.attributes.length === 0) {
    return { status: 'Attributes Missing', label: 'Attributes Missing', severity: 'error', missingItems: ['No attributes configured'] };
  }
  if (ctrl.workflows.length === 0) {
    return { status: 'Workflow Missing', label: 'Workflow Missing', severity: 'error', missingItems: ['No workflows linked'] };
  }
  const unmapped = ctrl.attributes.filter(a => !a.workflowId);
  if (unmapped.length > 0) {
    return { status: 'Workflow Mapping Missing', label: 'Mapping Incomplete', severity: 'warning', missingItems: unmapped.map(a => `${a.code}: ${a.name} has no linked workflow`) };
  }
  return { status: 'Ready', label: 'Ready', severity: 'success', missingItems: [] };
}

// ─── Mock Controls ────────────────────────────────────────────────────────

export const MOCK_COMPLIANCE_CONTROLS: ScopeControl[] = [
  {
    id: 'C001', name: 'Three-way PO/GRN/Invoice Matching',
    description: 'System-enforced three-way matching of purchase orders, goods receipt notes, and invoices before payment release.',
    importance: 'Key', nature: 'Preventive', automation: 'Hybrid', process: 'P2P', owner: 'Rajiv Sharma',
    attributes: [
      { id: 'a1', code: 'A', name: 'PO exists for invoice', assertion: 'Existence', required: true, workflowId: 'wf-pv' },
      { id: 'a2', code: 'B', name: 'GRN exists for invoice', assertion: 'Completeness', required: true, workflowId: 'wf-grn' },
      { id: 'a3', code: 'C', name: 'Invoice amount matches PO amount', assertion: 'Accuracy', required: true, workflowId: 'wf-inv' },
      { id: 'a4', code: 'D', name: 'Payment approval exists', assertion: 'Authorization', required: true, workflowId: 'wf-par' },
    ],
    workflows: [
      { id: 'wf-pv', name: 'PO Validation Workflow', version: 'v2.0', type: 'Automated', status: 'Active', coveredAttributeIds: ['a1'] },
      { id: 'wf-grn', name: 'GRN Matching Workflow', version: 'v1.6', type: 'Automated', status: 'Active', coveredAttributeIds: ['a2'] },
      { id: 'wf-inv', name: 'Invoice Match Workflow', version: 'v2.3', type: 'Automated', status: 'Active', coveredAttributeIds: ['a3'] },
      { id: 'wf-par', name: 'Payment Approval Review', version: 'v1.0', type: 'Manual', status: 'Active', coveredAttributeIds: ['a4'] },
    ],
  },
  {
    id: 'C002', name: 'Duplicate Invoice Detection',
    description: 'Automated scan of invoices against historical data to detect and prevent duplicate payments.',
    importance: 'Key', nature: 'Detective', automation: 'Automated', process: 'P2P', owner: 'Rajiv Sharma',
    attributes: [
      { id: 'a5', code: 'A', name: 'Duplicate invoice number check', assertion: 'Accuracy', required: true, workflowId: 'wf-dd' },
      { id: 'a6', code: 'B', name: 'Vendor + amount duplicate check', assertion: 'Accuracy', required: true, workflowId: 'wf-dd' },
      { id: 'a7', code: 'C', name: 'Duplicate override authorization', assertion: 'Authorization', required: true, workflowId: 'wf-om' },
    ],
    workflows: [
      { id: 'wf-dd', name: 'Duplicate Invoice Detector', version: 'v1.4', type: 'Automated', status: 'Active', coveredAttributeIds: ['a5', 'a6'] },
      { id: 'wf-om', name: 'Override Monitor', version: 'v1.2', type: 'Automated', status: 'Active', coveredAttributeIds: ['a7'] },
    ],
  },
  {
    id: 'C003', name: 'Vendor Master Change Review',
    description: 'Multi-level approval and verification process for vendor master data changes including bank account updates.',
    importance: 'Key', nature: 'Preventive', automation: 'Manual', process: 'P2P', owner: 'Deepak Bansal',
    attributes: [
      { id: 'a8', code: 'A', name: 'Vendor change request approved', assertion: 'Authorization', required: true, workflowId: 'wf-vmr' },
      { id: 'a9', code: 'B', name: 'Bank account change independently verified', assertion: 'Validity', required: true, workflowId: 'wf-vmr' },
      { id: 'a10', code: 'C', name: 'Supporting documents retained', assertion: 'Completeness', required: true, workflowId: 'wf-vmr' },
    ],
    workflows: [
      { id: 'wf-vmr', name: 'Vendor Master Review Workflow', version: 'v1.3', type: 'Manual', status: 'Active', coveredAttributeIds: ['a8', 'a9', 'a10'] },
    ],
  },
  {
    id: 'C004', name: 'Manual Journal Entry Review',
    description: 'Review process for manual journal entries above materiality threshold.',
    importance: 'Key', nature: 'Detective', automation: 'Manual', process: 'R2R', owner: 'Karan Mehta',
    sourceStatus: 'Needs Review',
    attributes: [
      { id: 'a11', code: 'A', name: 'JE authorization verified', assertion: 'Authorization', required: true },
    ],
    workflows: [],
  },
];

export function deriveScopeSummary(controls: ScopeControl[]) {
  const total = controls.length;
  const keyCount = controls.filter(c => c.importance === 'Key').length;
  const readinesses = controls.map(c => deriveComplianceControlReadiness(c));
  const ready = readinesses.filter(r => r.status === 'Ready').length;
  const needsSetup = total - ready;
  const totalAttrs = controls.reduce((s, c) => s + c.attributes.length, 0);
  const totalWorkflows = controls.reduce((s, c) => s + c.workflows.length, 0);
  return { total, keyCount, ready, needsSetup, totalAttrs, totalWorkflows };
}
