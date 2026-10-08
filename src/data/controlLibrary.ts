/**
 * The Control Library registry — the controls the Control Library screen lists.
 *
 * Kept here, in the data layer, rather than inside ControlLibraryView, because
 * it has a second reader: Platform Usage reports on the library, and a stat
 * labelled "Controls in the library" has to count the same rows the library
 * itself renders. When this lived in the component, Usage counted mockData's
 * CONTROLS (the CTR-xxx set the RACM and Process Hub work from) instead, and
 * the two screens disagreed — the library showed 14, Usage claimed 25.
 *
 * Controls a user creates at runtime live in createdControlsStore and are
 * concatenated on top of this seed by both readers.
 */

import type { ControlRow, TestAttribute } from '../components/governance/controlTypes';


/** Control-level test attributes for library controls that have no linked
 *  workflow yet — every control says how it is tested, workflow or not.
 *  Controls with a workflow take theirs from SEED_WORKFLOW_ATTRIBUTES. */
const A = (id: string, name: string, description: string, evidenceType: TestAttribute['evidenceType'], passCriteria: string, failureCriteria: string): TestAttribute =>
  ({ id, label: id, name, description, evidenceRequired: true, evidenceType, mandatory: true, passCriteria, failureCriteria, status: 'Active' });

const CONTROL_ATTRIBUTES: Record<string, TestAttribute[]> = {
  'C-006': [
    A('TA-101', 'Override approved by credit control', 'Trace each credit-limit override to an approver in credit control.', 'Approval', 'Approved before the order is released', 'Released by sales or without approval'),
    A('TA-102', 'Override within delegated limit', 'Compare the override amount with the approver’s delegated limit.', 'Other', 'Within the approver’s limit', 'Above the approver’s limit'),
  ],
  'C-008': [
    A('TA-103', 'Every GL account reconciled', 'Check the close checklist for a reconciliation per balance-sheet account.', 'Other', 'Reconciled within 5 working days of month end', 'Account missing or late'),
    A('TA-104', 'Reconciling items cleared', 'Age reconciling items on each reconciliation.', 'Other', 'No item older than 60 days', 'Stale items not cleared'),
    A('TA-105', 'Preparer and reviewer sign-off', 'Inspect sign-offs on each reconciliation.', 'Approval', 'Signed by preparer and an independent reviewer', 'Review missing'),
  ],
  'C-010': [
    A('TA-106', 'Quarterly recertification completed', 'Inspect business-owner sign-off for each in-scope system.', 'Approval', 'All owners signed within the quarter', 'Missing sign-off'),
    A('TA-107', 'Removals actioned', 'Trace access flagged for removal to deactivation in the system.', 'System Log', 'Removed within 5 days of the review', 'Still active after 5 days'),
  ],
  'C-012': [
    A('TA-108', 'Risk assessment on file', 'Inspect the latest assessment for each critical supplier.', 'Other', 'Assessed within the last 12 months', 'Assessment missing or stale'),
    A('TA-109', 'High-risk suppliers escalated', 'Trace high-risk ratings to an action plan.', 'Approval', 'Action plan approved by procurement head', 'High risk with no plan'),
  ],
  'C-013': [
    A('TA-110', 'Intercompany balances agree', 'Compare each counterparty pair’s balances at month end.', 'Other', 'Pairs agree, or differences explained', 'Unexplained difference above ₹1L'),
    A('TA-111', 'Differences resolved before close', 'Trace differences to resolution entries.', 'Other', 'Resolved before the consolidation pack', 'Carried into consolidation'),
  ],
  'C-014': [
    A('TA-112', 'Two approvers above threshold', 'Inspect approvals on POs above the dual sign-off threshold.', 'Approval', 'Two distinct approvers recorded', 'Single approval'),
    A('TA-113', 'Approvers hold the DOA level', 'Map each approver to the DOA matrix.', 'PO', 'Both approvers authorised for the value', 'An approver below the required level'),
  ],
};

/** Risks for controls whose seed left them unmapped. */
const EXTRA_RISKS: Record<string, string[]> = { 'C-006': ['RSK-006'], 'C-011': ['RSK-013'] };

const SEED_CONTROLS: ControlRow[] = [
  { id: 'C-001', controlId: 'C-001', name: 'Three-Way PO/GRN/Invoice Matching', description: 'System-enforced three-way matching of Purchase Order, Goods Receipt Note, and Invoice before payment release to prevent unauthorized or duplicate payments.', objective: 'Ensure every payment is backed by a valid PO, goods receipt, and matching invoice.', businessProcess: 'P2P', subProcess: 'Invoice Processing', classification: 'Key', nature: 'Preventive', automation: 'Automated', frequency: 'Per transaction', owner: 'Tushar Goel', assertions: ['completeness', 'accuracy', 'authorization'], mappedRisks: ['RSK-001', 'RSK-002'], linkedWorkflows: ['Three-Way PO Match'], linkedWorkflowIds: ['wf-007'], usedInRACMs: 4, status: 'Active', createdAt: 'Jan 15, 2026', updatedAt: 'Apr 22, 2026' },
  { id: 'C-002', controlId: 'C-002', name: 'Vendor Master Change Approval', description: 'Multi-level approval workflow for vendor master data changes including verification of tax ID, bank details, and compliance checks.', objective: 'Prevent unauthorized changes to vendor master data and fictitious vendor registration.', businessProcess: 'P2P', subProcess: 'Vendor Management', classification: 'Key', nature: 'Preventive', automation: 'Manual', frequency: 'Per transaction', owner: 'Deepak Bansal', assertions: ['authorization', 'occurrence', 'existence'], mappedRisks: ['RSK-003', 'RSK-004'], linkedWorkflows: ['Vendor Master Change Monitor'], linkedWorkflowIds: ['wf-002'], usedInRACMs: 2, status: 'Active', createdAt: 'Jan 20, 2026', updatedAt: 'Apr 20, 2026' },
  { id: 'C-003', controlId: 'C-003', name: 'Duplicate Invoice Detection', description: 'Automated scanning of incoming invoices against historical data to identify and flag potential duplicate submissions before payment processing.', objective: 'Prevent duplicate payments and overpayments to vendors.', businessProcess: 'P2P', subProcess: 'Invoice Processing', classification: 'Key', nature: 'Detective', automation: 'Automated', frequency: 'Per transaction', owner: 'Tushar Goel', assertions: ['accuracy', 'occurrence'], mappedRisks: ['RSK-002'], linkedWorkflows: ['Duplicate Invoice Detector'], linkedWorkflowIds: ['wf-001'], usedInRACMs: 3, status: 'Active', createdAt: 'Jan 22, 2026', updatedAt: 'Apr 18, 2026' },
  { id: 'C-004', controlId: 'C-004', name: 'High-Value Payment Review', description: 'Automatic flagging and additional approval workflow for payments exceeding defined threshold amounts.', objective: 'Ensure high-value transactions receive additional scrutiny and dual authorization.', businessProcess: 'P2P', subProcess: 'Payment Execution', classification: 'Key', nature: 'Preventive', automation: 'IT-dependent', frequency: 'Per transaction', owner: 'Karan Mehta', assertions: ['authorization', 'accuracy'], mappedRisks: ['RSK-001', 'RSK-005'], linkedWorkflows: ['High-Value Payment Flagging'], linkedWorkflowIds: ['wf-003'], usedInRACMs: 2, status: 'Active', createdAt: 'Feb 1, 2026', updatedAt: 'Apr 14, 2026' },
  { id: 'C-005', controlId: 'C-005', name: 'Revenue Recognition Compliance Check', description: 'Automated validation of revenue recognition against ASC 606 criteria for all revenue transactions.', objective: 'Ensure revenue is recognized in compliance with accounting standards.', businessProcess: 'O2C', subProcess: 'Revenue Recognition', classification: 'Key', nature: 'Detective', automation: 'Automated', frequency: 'Monthly', owner: 'Neha Joshi', assertions: ['completeness', 'accuracy', 'cutoff', 'valuation'], mappedRisks: ['RSK-010'], linkedWorkflows: ['Revenue Recognition Checker'], linkedWorkflowIds: ['wf-004'], usedInRACMs: 2, status: 'Active', createdAt: 'Feb 5, 2026', updatedAt: 'Apr 10, 2026' },
  { id: 'C-006', controlId: 'C-006', name: 'Credit Limit Override Approval', description: 'Manual review and approval process for customer credit limit overrides and changes above the defined threshold.', objective: 'Prevent unauthorized credit exposure and override abuse.', businessProcess: 'O2C', subProcess: 'Credit Management', classification: 'Non-Key', nature: 'Preventive', automation: 'Manual', frequency: 'Per transaction', owner: 'Sneha Desai', assertions: ['authorization'], mappedRisks: [], linkedWorkflows: [], linkedWorkflowIds: [], usedInRACMs: 1, status: 'Draft', createdAt: 'Feb 10, 2026', updatedAt: 'Feb 10, 2026' },
  { id: 'C-007', controlId: 'C-007', name: 'Journal Entry Approval', description: 'AI-powered anomaly detection and management review of journal entries to identify unusual patterns that may indicate errors or fraud.', objective: 'Detect and investigate anomalous journal entries before period close.', businessProcess: 'R2R', subProcess: 'Journal Entries', classification: 'Key', nature: 'Detective', automation: 'Automated', frequency: 'Daily', owner: 'Rohan Patel', assertions: ['accuracy', 'occurrence', 'completeness'], mappedRisks: ['RSK-011'], linkedWorkflows: ['Journal Entry Anomaly Detector'], linkedWorkflowIds: ['wf-005'], usedInRACMs: 3, status: 'Active', createdAt: 'Feb 15, 2026', updatedAt: 'Apr 16, 2026' },
  { id: 'C-008', controlId: 'C-008', name: 'Period-End Close Reconciliation', description: 'Monthly reconciliation of all GL accounts to ensure balances are accurate before financial close.', objective: 'Ensure accuracy and completeness of financial reporting.', businessProcess: 'R2R', subProcess: 'Financial Close', classification: 'Key', nature: 'Detective', automation: 'Manual', frequency: 'Monthly', owner: 'Karan Mehta', assertions: ['completeness', 'accuracy', 'valuation', 'cutoff'], mappedRisks: ['RSK-012'], linkedWorkflows: [], linkedWorkflowIds: [], usedInRACMs: 2, status: 'Draft', createdAt: 'Feb 18, 2026', updatedAt: 'Feb 28, 2026' },
  { id: 'C-009', controlId: 'C-009', name: 'SOD Violation Detection', description: 'Real-time segregation of duties conflict detection across all business processes with automatic alerting.', objective: 'Prevent and detect segregation of duties violations.', businessProcess: 'ITGC', subProcess: 'Access Management', classification: 'Key', nature: 'Detective', automation: 'Automated', frequency: 'Daily', owner: 'Priya Singh', assertions: ['authorization', 'occurrence'], mappedRisks: ['RSK-008'], linkedWorkflows: ['SOD Violation Detector'], linkedWorkflowIds: ['wf-008'], usedInRACMs: 2, status: 'Active', createdAt: 'Feb 20, 2026', updatedAt: 'Apr 8, 2026' },
  { id: 'C-010', controlId: 'C-010', name: 'User Access Review', description: 'Quarterly review of all system access rights to ensure appropriate access levels are maintained and unauthorized access is revoked.', objective: 'Ensure only authorized users retain system access per least-privilege principle.', businessProcess: 'ITGC', subProcess: 'Access Management', classification: 'Key', nature: 'Preventive', automation: 'IT-dependent', frequency: 'Quarterly', owner: 'Priya Singh', assertions: ['authorization', 'existence'], mappedRisks: ['RSK-009'], linkedWorkflows: [], linkedWorkflowIds: [], usedInRACMs: 1, status: 'Active', createdAt: 'Mar 1, 2026', updatedAt: 'Mar 15, 2026' },
  { id: 'C-011', controlId: 'C-011', name: 'Contract Expiry Monitoring', description: 'Automated tracking of contract expiration dates with proactive alerts to stakeholders for renewal or termination decisions.', objective: 'Prevent contract lapses and ensure timely renewals.', businessProcess: 'S2C', subProcess: 'Contract Compliance', classification: 'Non-Key', nature: 'Detective', automation: 'Automated', frequency: 'Daily', owner: 'Rohan Patel', assertions: ['completeness', 'cutoff'], mappedRisks: [], linkedWorkflows: ['Contract Expiry Alert'], linkedWorkflowIds: ['wf-006'], usedInRACMs: 1, status: 'Active', createdAt: 'Mar 5, 2026', updatedAt: 'Mar 5, 2026' },
  { id: 'C-012', controlId: 'C-012', name: 'Supplier Risk Assessment', description: 'Periodic assessment of supplier risk profiles including financial stability, compliance, and performance metrics.', objective: 'Identify and mitigate supplier-related risks.', businessProcess: 'S2C', subProcess: 'Supplier Performance', classification: 'Non-Key', nature: 'Preventive', automation: 'Manual', frequency: 'Quarterly', owner: 'Deepak Bansal', assertions: ['existence', 'valuation'], mappedRisks: ['RSK-007'], linkedWorkflows: [], linkedWorkflowIds: [], usedInRACMs: 0, status: 'Draft', createdAt: 'Mar 10, 2026', updatedAt: 'Mar 10, 2026' },
  { id: 'C-013', controlId: 'C-013', name: 'Intercompany Reconciliation', description: 'Monthly reconciliation of intercompany balances across all subsidiaries.', objective: 'Ensure intercompany transactions are accurately recorded and eliminate discrepancies.', businessProcess: 'R2R', subProcess: 'Intercompany', classification: 'Non-Key', nature: 'Detective', automation: 'Manual', frequency: 'Monthly', owner: 'Sneha Desai', assertions: ['completeness', 'accuracy'], mappedRisks: ['RSK-012'], linkedWorkflows: [], linkedWorkflowIds: [], usedInRACMs: 1, status: 'Draft', createdAt: 'Mar 12, 2026', updatedAt: 'Mar 12, 2026' },
  { id: 'C-014', controlId: 'C-014', name: 'Purchase Order Dual Sign-Off', description: 'Dual authorization requirement for all purchase orders above the standard threshold.', objective: 'Ensure proper authorization for purchasing commitments.', businessProcess: 'P2P', subProcess: 'Purchase Orders', classification: 'Non-Key', nature: 'Preventive', automation: 'Manual', frequency: 'Per transaction', owner: 'Tushar Goel', assertions: ['authorization'], mappedRisks: ['RSK-005'], linkedWorkflows: [], linkedWorkflowIds: [], usedInRACMs: 1, status: 'Draft', createdAt: 'Mar 15, 2026', updatedAt: 'Mar 15, 2026' },
];

/** The library rows: seed controls, each completed with its attributes and risks. */
export const CONTROL_LIBRARY: ControlRow[] = SEED_CONTROLS.map(c => ({
  ...c,
  mappedRisks: c.mappedRisks.length ? c.mappedRisks : (EXTRA_RISKS[c.id] ?? c.mappedRisks),
  attributes: CONTROL_ATTRIBUTES[c.id],
}));

