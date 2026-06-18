/* Shared types for Control Library */

export interface ControlRow {
  id: string;
  controlId: string;
  name: string;
  description: string;
  objective: string;
  businessProcess: 'P2P' | 'O2C' | 'R2R' | 'ITGC' | 'S2C';
  subProcess: string;
  classification: 'Key' | 'Non-Key';
  nature: 'Preventive' | 'Detective' | 'Corrective';
  automation: 'Manual' | 'IT-dependent' | 'Automated';
  frequency: string;
  owner: string;
  assertions: string[];
  mappedRisks: string[];
  linkedWorkflows: string[];   // workflow names
  linkedWorkflowIds: string[]; // workflow IDs from mock data
  usedInRACMs: number;
  status: 'Draft' | 'Active' | 'Archived';
  createdAt: string;
  updatedAt: string;
}

export const BP_COLORS: Record<string, string> = {
  P2P: '#6a12cd', O2C: '#0284c7', R2R: '#d97706', ITGC: '#16a34a', S2C: '#8b5cf6',
};

export const AUTOMATION_STYLES: Record<string, { bg: string; text: string }> = {
  Automated:      { bg: 'bg-evidence-50', text: 'text-evidence-700' },
  Manual:         { bg: 'bg-gray-100',    text: 'text-gray-700' },
  'IT-dependent': { bg: 'bg-purple-100',  text: 'text-purple-800' },
};

export const NATURE_STYLES: Record<string, { bg: string; text: string }> = {
  Preventive: { bg: 'bg-compliant-50', text: 'text-compliant-700' },
  Detective:  { bg: 'bg-evidence-50',  text: 'text-evidence-700' },
  Corrective: { bg: 'bg-mitigated-50', text: 'text-mitigated-700' },
};

export const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  Draft:    { bg: 'bg-gray-100',      text: 'text-gray-600',      dot: 'bg-gray-400' },
  Active:   { bg: 'bg-emerald-50',    text: 'text-emerald-700',   dot: 'bg-emerald-500' },
  Archived: { bg: 'bg-gray-50',       text: 'text-gray-400',      dot: 'bg-gray-300' },
};

/** Derived design status — NOT stored, always computed */
export type ControlDesignStatus = 'Complete' | 'Incomplete';

export function getControlDesignStatus(control: { linkedWorkflowIds: string[]; assertions: string[] }): ControlDesignStatus {
  if (control.linkedWorkflowIds.length > 0 && control.assertions.length > 0) return 'Complete';
  return 'Incomplete';
}

/** Derived readiness — NOT stored, always computed */
export type ControlReadiness = 'Ready' | 'Workflow Missing';

export function getControlReadiness(control: { linkedWorkflowIds: string[] }): ControlReadiness {
  return control.linkedWorkflowIds.length > 0 ? 'Ready' : 'Workflow Missing';
}

/* ─── RACM ↔ Control mapping ─── */
export const RACM_CONTROL_MAP: Record<string, string[]> = {
  'RACM-001': ['C-001', 'C-002', 'C-003', 'C-004'],
  'RACM-002': ['C-001', 'C-003', 'C-014'],
  'RACM-003': ['C-005', 'C-006'],
  'RACM-004': ['C-007', 'C-008'],
  'RACM-005': ['C-007', 'C-008', 'C-013'],
  'RACM-006': ['C-011', 'C-012'],
};

/* ─── Per-control change history ─── */
export const CONTROL_HISTORY: Record<string, { date: string; user: string; action: string }[]> = {
  'C-001': [
    { date: 'Apr 22, 2026', user: 'Tushar Goel', action: 'Marked control as Ready' },
    { date: 'Apr 15, 2026', user: 'Tushar Goel', action: 'Added 5 test attributes to workflow' },
    { date: 'Mar 18, 2026', user: 'Karan Mehta', action: 'Linked workflow "Three-Way PO Match"' },
    { date: 'Feb 10, 2026', user: 'Sneha Desai', action: 'Mapped risks RSK-001, RSK-002' },
    { date: 'Jan 15, 2026', user: 'Tushar Goel', action: 'Control created' },
  ],
  'C-002': [
    { date: 'Apr 20, 2026', user: 'Deepak Bansal', action: 'Marked control as Ready' },
    { date: 'Apr 12, 2026', user: 'Deepak Bansal', action: 'Added 3 test attributes to workflow' },
    { date: 'Mar 10, 2026', user: 'Karan Mehta', action: 'Linked workflow "Vendor Master Change Monitor"' },
    { date: 'Feb 5, 2026', user: 'Sneha Desai', action: 'Mapped risks RSK-003, RSK-004' },
    { date: 'Jan 20, 2026', user: 'Deepak Bansal', action: 'Control created' },
  ],
  'C-003': [
    { date: 'Apr 18, 2026', user: 'Tushar Goel', action: 'Marked control as Ready' },
    { date: 'Mar 15, 2026', user: 'Tushar Goel', action: 'Added 2 test attributes to workflow' },
    { date: 'Mar 1, 2026', user: 'Karan Mehta', action: 'Linked workflow "Duplicate Invoice Detector"' },
    { date: 'Feb 8, 2026', user: 'Tushar Goel', action: 'Mapped risk RSK-002' },
    { date: 'Jan 22, 2026', user: 'Tushar Goel', action: 'Control created' },
  ],
  'C-007': [
    { date: 'Apr 16, 2026', user: 'Rohan Patel', action: 'Marked control as Ready' },
    { date: 'Mar 17, 2026', user: 'Rohan Patel', action: 'Added 2 test attributes to workflow' },
    { date: 'Mar 5, 2026', user: 'Karan Mehta', action: 'Linked workflow "Journal Entry Anomaly Detector"' },
    { date: 'Feb 20, 2026', user: 'Rohan Patel', action: 'Mapped risk RSK-011' },
    { date: 'Feb 15, 2026', user: 'Rohan Patel', action: 'Control created' },
  ],
  'C-010': [
    { date: 'Mar 15, 2026', user: 'Priya Singh', action: 'Submitted for review — pending workflow linkage' },
    { date: 'Mar 5, 2026', user: 'Priya Singh', action: 'Mapped risk RSK-009' },
    { date: 'Mar 1, 2026', user: 'Priya Singh', action: 'Control created' },
  ],
  'C-006': [
    { date: 'Feb 10, 2026', user: 'Sneha Desai', action: 'Control created — workflow pending' },
  ],
  'C-008': [
    { date: 'Feb 28, 2026', user: 'Karan Mehta', action: 'Mapped risk RSK-012' },
    { date: 'Feb 18, 2026', user: 'Karan Mehta', action: 'Control created — workflow pending' },
  ],
};

export const ASSERTION_LABELS: Record<string, string> = {
  completeness:  'Completeness',
  accuracy:      'Accuracy',
  authorization: 'Authorization',
  occurrence:    'Occurrence',
  cutoff:        'Cut-off',
  valuation:     'Valuation',
  existence:     'Existence',
};

/* ─── Test Attributes ─── */
export type EvidenceType = 'PO' | 'Invoice' | 'GRN' | 'Approval' | 'System Log' | 'Other';

export interface TestAttribute {
  id: string;
  label: string;
  name: string;
  description: string;
  evidenceRequired: boolean;
  evidenceType: EvidenceType | '';
  mandatory: boolean;
  passCriteria: string;
  failureCriteria: string;
  status: 'Active' | 'Draft';
}

/* Seed attributes keyed by workflow ID */
export const SEED_WORKFLOW_ATTRIBUTES: Record<string, TestAttribute[]> = {
  'wf-007': [
    { id: 'TA-001', label: 'TA-001', name: 'PO exists and is approved', description: 'Verify a valid Purchase Order exists with appropriate approval before payment.', evidenceRequired: true, evidenceType: 'PO', mandatory: true, passCriteria: 'Approved PO present with matching amount', failureCriteria: 'PO missing, unapproved, or amount mismatch', status: 'Active' },
    { id: 'TA-002', label: 'TA-002', name: 'GRN matches PO quantity', description: 'Confirm Goods Receipt Note quantity matches the PO line items within tolerance.', evidenceRequired: true, evidenceType: 'GRN', mandatory: true, passCriteria: 'GRN quantity within 5% of PO', failureCriteria: 'Quantity variance exceeds 5%', status: 'Active' },
    { id: 'TA-003', label: 'TA-003', name: 'Invoice amount matches PO/GRN', description: 'Validate invoice amount matches both PO and GRN amounts within tolerance.', evidenceRequired: true, evidenceType: 'Invoice', mandatory: true, passCriteria: 'Invoice total within tolerance of PO and GRN', failureCriteria: 'Amount mismatch exceeding tolerance', status: 'Active' },
    { id: 'TA-004', label: 'TA-004', name: 'Payment approval obtained', description: 'Verify appropriate payment approval was obtained before release.', evidenceRequired: true, evidenceType: 'Approval', mandatory: true, passCriteria: 'Dual approval documented for amounts > threshold', failureCriteria: 'Missing or single approval for high-value payment', status: 'Active' },
    { id: 'TA-005', label: 'TA-005', name: 'System match log reviewed', description: 'Review automated matching system log for any overrides or exceptions.', evidenceRequired: true, evidenceType: 'System Log', mandatory: false, passCriteria: 'No manual overrides in matching log', failureCriteria: 'Unauthorized override detected', status: 'Active' },
  ],
  'wf-002': [
    { id: 'TA-006', label: 'TA-006', name: 'Vendor registration form complete', description: 'Confirm all required fields in vendor registration are completed.', evidenceRequired: true, evidenceType: 'Other', mandatory: true, passCriteria: 'All required fields populated', failureCriteria: 'Missing mandatory information', status: 'Active' },
    { id: 'TA-007', label: 'TA-007', name: 'Tax ID verified', description: 'Verify vendor tax identification number against government database.', evidenceRequired: true, evidenceType: 'System Log', mandatory: true, passCriteria: 'Tax ID validated and matches vendor name', failureCriteria: 'Tax ID invalid or mismatch', status: 'Active' },
    { id: 'TA-008', label: 'TA-008', name: 'Change notification sent', description: 'Confirm email notification was sent to finance head on vendor master change.', evidenceRequired: true, evidenceType: 'Approval', mandatory: true, passCriteria: 'Notification email delivered within 24 hours', failureCriteria: 'Notification missing or delayed', status: 'Active' },
  ],
  'wf-001': [
    { id: 'TA-009', label: 'TA-009', name: 'Duplicate scan executed', description: 'Verify automated duplicate scan ran before invoice was processed.', evidenceRequired: true, evidenceType: 'System Log', mandatory: true, passCriteria: 'Scan log shows execution with no duplicates found', failureCriteria: 'Scan not executed or duplicate not flagged', status: 'Active' },
    { id: 'TA-010', label: 'TA-010', name: 'Flag reviewed and resolved', description: 'If duplicate flag raised, confirm it was reviewed and resolved.', evidenceRequired: true, evidenceType: 'Approval', mandatory: false, passCriteria: 'Resolution documented with approver sign-off', failureCriteria: 'Flag ignored or overridden without documentation', status: 'Active' },
  ],
  'wf-003': [
    { id: 'TA-011', label: 'TA-011', name: 'Threshold rule applied', description: 'Confirm threshold rules were correctly applied to flag high-value payment.', evidenceRequired: true, evidenceType: 'System Log', mandatory: true, passCriteria: 'Payment correctly flagged per threshold configuration', failureCriteria: 'Payment bypassed threshold check', status: 'Active' },
    { id: 'TA-012', label: 'TA-012', name: 'Additional approval obtained', description: 'Verify additional review and approval was obtained for flagged payment.', evidenceRequired: true, evidenceType: 'Approval', mandatory: true, passCriteria: 'Senior approval documented before payment release', failureCriteria: 'Payment released without additional approval', status: 'Active' },
  ],
  'wf-004': [
    { id: 'TA-013', label: 'TA-013', name: 'ASC 606 criteria mapped', description: 'Verify revenue transaction was evaluated against all ASC 606 criteria.', evidenceRequired: true, evidenceType: 'Other', mandatory: true, passCriteria: 'All five steps of ASC 606 documented', failureCriteria: 'Incomplete ASC 606 evaluation', status: 'Active' },
    { id: 'TA-014', label: 'TA-014', name: 'Revenue timing validated', description: 'Confirm revenue recognition timing aligns with performance obligation completion.', evidenceRequired: true, evidenceType: 'Invoice', mandatory: true, passCriteria: 'Recognition date matches obligation completion', failureCriteria: 'Premature or delayed recognition', status: 'Active' },
  ],
  'wf-005': [
    { id: 'TA-015', label: 'TA-015', name: 'Anomaly model executed', description: 'Confirm AI anomaly detection model ran on journal entry batch.', evidenceRequired: true, evidenceType: 'System Log', mandatory: true, passCriteria: 'Model execution log present with score output', failureCriteria: 'Model not executed or no output', status: 'Active' },
    { id: 'TA-016', label: 'TA-016', name: 'High-score entries reviewed', description: 'Verify all entries with anomaly score above threshold were reviewed.', evidenceRequired: true, evidenceType: 'Approval', mandatory: true, passCriteria: 'Review documented for all flagged entries', failureCriteria: 'Flagged entries not reviewed', status: 'Active' },
  ],
  'wf-006': [
    { id: 'TA-017', label: 'TA-017', name: 'Expiry alert sent', description: 'Confirm alert was sent to stakeholder before contract expiry date.', evidenceRequired: true, evidenceType: 'System Log', mandatory: true, passCriteria: 'Alert sent at least 30 days before expiry', failureCriteria: 'Alert not sent or sent late', status: 'Active' },
  ],
  'wf-008': [
    { id: 'TA-018', label: 'TA-018', name: 'Role matrix loaded', description: 'Verify current role matrix was loaded for conflict detection.', evidenceRequired: true, evidenceType: 'System Log', mandatory: true, passCriteria: 'Current role matrix version used', failureCriteria: 'Outdated or missing role matrix', status: 'Active' },
    { id: 'TA-019', label: 'TA-019', name: 'Conflicts detected and reported', description: 'Confirm SOD conflicts were detected and violation report generated.', evidenceRequired: true, evidenceType: 'Other', mandatory: true, passCriteria: 'Violation report generated with all conflicts listed', failureCriteria: 'Known conflicts not detected', status: 'Active' },
  ],
};
