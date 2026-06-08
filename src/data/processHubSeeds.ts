// ─────────────────────────────────────────────────────────────────────────────
// Process Hub seed data — controls & workflows, keyed by business process abbr.
//
// Previously the Controls and Workflows tabs shared ONE P2P-flavoured seed list
// (SEED_DESIGN_CONTROLS / SEED_BP_WF) that every built-in process displayed. That
// made O2C/S2C/R2R show P2P's controls, and left no clean place to give each
// process its own. This module is the single source of truth: each process keys
// into its own array, and a process with no entry simply shows nothing (which is
// exactly what we want for an un-built process like S2C).
//
// Types are imported (type-only) from BusinessProcesses so there is no runtime
// import cycle — the value flow is one-way (BusinessProcesses imports these maps).
// ─────────────────────────────────────────────────────────────────────────────
import type { DesignControl, BPWorkflow } from '../components/audit/BusinessProcesses';

// Controls shown in each process's Controls tab (before any local edits / created
// controls are merged in). Add a new process by adding a key here.
export const CONTROLS_BY_PROCESS: Record<string, DesignControl[]> = {
  P2P: [
    { id: 'C-001', name: 'Three-Way PO/GRN/Invoice Matching', description: 'System-enforced three-way matching before payment release.', classification: 'Key', nature: 'Preventive', automation: 'Automated', frequency: 'Per transaction', mappedRisks: ['RSK-001', 'RSK-002'], workflows: [
      { name: 'PO Validation Workflow', type: 'Automated', status: 'Completed', lastRun: 'Apr 28, 2026', runs: 14 },
      { name: 'GRN Matching Workflow', type: 'Automated', status: 'Completed', lastRun: 'Apr 28, 2026', runs: 12 },
      { name: 'Invoice Match Workflow', type: 'Automated', status: 'Ready', lastRun: 'Apr 26, 2026', runs: 10 },
    ], usedInRACMs: 4, assertions: ['Completeness', 'Accuracy', 'Authorization'], attributes: [
      { id: 'C-001-A1', description: 'PO, GRN and invoice quantities reconcile before payment is released.', result: 'Pass', workflows: [{ code: 'WF-P2P-001', name: 'PO Validation Workflow' }, { code: 'WF-P2P-002', name: 'GRN Matching Workflow' }] },
      { id: 'C-001-A2', description: 'Unit price variance stays within the approved tolerance band.', result: 'Pass', workflows: [{ code: 'WF-P2P-003', name: 'Invoice Match Workflow' }] },
      { id: 'C-001-A3', description: 'Matching exceptions are routed for manual approval and cleared.', result: 'Pass', workflows: [] },
    ] },
    { id: 'C-002', name: 'Vendor Master Change Approval', description: 'Multi-level approval for vendor master data changes.', classification: 'Key', nature: 'Preventive', automation: 'Manual', frequency: 'Per transaction', mappedRisks: ['RSK-003', 'RSK-004'], workflows: [
      { name: 'Vendor Change Monitor', type: 'Automated', status: 'Ready', lastRun: 'Apr 20, 2026', runs: 8 },
    ], usedInRACMs: 2, assertions: ['Authorization', 'Occurrence'], attributes: [
      { id: 'C-002-A1', description: 'Every vendor master change carries dual approval before activation.', result: 'Pass', workflows: [{ code: 'WF-P2P-004', name: 'Vendor Change Monitor' }] },
      { id: 'C-002-A2', description: 'Supporting documents are attached to each change request.', result: 'Fail', workflows: [] },
    ] },
    { id: 'C-003', name: 'Duplicate Invoice Detection', description: 'Automated scanning to flag potential duplicate invoices.', classification: 'Key', nature: 'Detective', automation: 'Automated', frequency: 'Per transaction', mappedRisks: ['RSK-002'], workflows: [
      { name: 'Duplicate Invoice Detector', type: 'Automated', status: 'Completed', lastRun: 'Apr 26, 2026', runs: 12 },
      { name: 'Invoice Reconciliation Check', type: 'Manual', status: 'Draft', lastRun: '—', runs: 0 },
    ], usedInRACMs: 3, assertions: ['Accuracy', 'Occurrence'], attributes: [
      { id: 'C-003-A1', description: 'Duplicate scan runs on every invoice batch at intake.', result: 'Pass', workflows: [{ code: 'WF-P2P-005', name: 'Duplicate Invoice Detector' }] },
      { id: 'C-003-A2', description: 'Flagged duplicates are investigated and dispositioned within SLA.', result: 'Pass', workflows: [] },
    ] },
    { id: 'C-004', name: 'High-Value Payment Review', description: 'Additional approval for payments above threshold.', classification: 'Key', nature: 'Preventive', automation: 'IT-dependent', frequency: 'Per transaction', mappedRisks: ['RSK-001'], workflows: [
      { name: 'Payment Approval Review', type: 'Manual', status: 'Ready', lastRun: 'Apr 10, 2026', runs: 3 },
    ], usedInRACMs: 2, assertions: ['Authorization', 'Accuracy'], attributes: [
      { id: 'C-004-A1', description: 'Payments above the threshold receive a documented second approval.', result: 'Pass', workflows: [{ code: 'WF-P2P-006', name: 'Payment Approval Review' }] },
    ] },
    { id: 'C-014', name: 'Purchase Order Dual Sign-Off', description: 'Dual authorization for all POs above threshold.', classification: 'Non-Key', nature: 'Preventive', automation: 'Manual', frequency: 'Per transaction', mappedRisks: ['RSK-005'], workflows: [], usedInRACMs: 1, assertions: ['Authorization'], attributes: [
      { id: 'C-014-A1', description: 'Dual authorization is captured on every PO above the limit.', result: 'Pending', workflows: [] },
    ] },
  ],
  O2C: [
    { id: 'C-101', name: 'Credit Limit Check Before Order Release', description: 'System blocks sales orders that breach the customer credit limit until released by credit control.', classification: 'Key', nature: 'Preventive', automation: 'Automated', frequency: 'Per transaction', mappedRisks: ['RSK-022', 'RSK-009'], workflows: [
      { name: 'Credit Limit Check Monitor', type: 'Automated', status: 'Completed', lastRun: 'Apr 28, 2026', runs: 8 },
      { name: 'Credit Block Release Review', type: 'Manual', status: 'Ready', lastRun: 'Apr 28, 2026', runs: 8 },
    ], usedInRACMs: 4, assertions: ['Authorization', 'Occurrence'], attributes: [
      { id: 'C-101-A1', description: 'Orders exceeding the approved credit limit are placed on hold automatically.', result: 'Pass', workflows: [{ code: 'WF-O2C-001', name: 'Credit Limit Check Monitor' }] },
      { id: 'C-101-A2', description: 'Credit holds are released only with documented credit-control approval.', result: 'Pass', workflows: [] },
    ] },
    { id: 'C-102', name: 'Sales Order Pricing Approval', description: 'Non-standard order prices and discounts require approval before the order is confirmed.', classification: 'Key', nature: 'Preventive', automation: 'Manual', frequency: 'Per transaction', mappedRisks: ['RSK-021'], workflows: [
      { name: 'Pricing Exception Monitor', type: 'Automated', status: 'Ready', lastRun: 'Apr 28, 2026', runs: 8 },
    ], usedInRACMs: 3, assertions: ['Authorization', 'Accuracy'], attributes: [
      { id: 'C-102-A1', description: 'Prices below the approved floor carry a documented sign-off before confirmation.', result: 'Pass', workflows: [{ code: 'WF-O2C-002', name: 'Pricing Exception Monitor' }] },
      { id: 'C-102-A2', description: 'Discounts above the standard band are authorised by the sales manager.', result: 'Fail', workflows: [] },
    ] },
    { id: 'C-103', name: 'Order / Shipment / Invoice Three-Way Match', description: 'Billing is generated only when the order, shipment and invoice quantities reconcile.', classification: 'Key', nature: 'Detective', automation: 'Automated', frequency: 'Per transaction', mappedRisks: ['RSK-013', 'RSK-024'], workflows: [
      { name: 'Order/Shipment/Invoice Match', type: 'Automated', status: 'Completed', lastRun: 'Apr 28, 2026', runs: 8 },
    ], usedInRACMs: 3, assertions: ['Completeness', 'Accuracy'], attributes: [
      { id: 'C-103-A1', description: 'Shipped quantities reconcile to the sales order before invoicing.', result: 'Pass', workflows: [{ code: 'WF-O2C-003', name: 'Order/Shipment/Invoice Match' }] },
      { id: 'C-103-A2', description: 'Billed amounts agree to the priced order line.', result: 'Pass', workflows: [] },
    ] },
    { id: 'C-104', name: 'Goods Shipped Only Against Approved Order', description: 'Warehouse releases stock only for orders that are credit-checked and approved.', classification: 'Key', nature: 'Preventive', automation: 'IT-dependent', frequency: 'Per transaction', mappedRisks: ['RSK-024', 'RSK-022'], workflows: [], usedInRACMs: 2, assertions: ['Occurrence', 'Authorization'], attributes: [
      { id: 'C-104-A1', description: 'Picking is permitted only for orders in approved, credit-released status.', result: 'Pass', workflows: [] },
      { id: 'C-104-A2', description: 'Shipments without a valid approved order are blocked at dispatch.', result: 'Pending', workflows: [] },
    ] },
    { id: 'C-105', name: 'Revenue Recognition Cut-Off Review', description: 'Period-end review confirms revenue is recorded in the period goods/services transfer to the customer.', classification: 'Key', nature: 'Detective', automation: 'Manual', frequency: 'Monthly', mappedRisks: ['RSK-006'], workflows: [], usedInRACMs: 3, assertions: ['Cut-off', 'Occurrence'], attributes: [
      { id: 'C-105-A1', description: 'Shipments around period end are recognised in the correct period.', result: 'Pass', workflows: [] },
      { id: 'C-105-A2', description: 'Revenue postings reconcile to dispatch dates for the cut-off window.', result: 'Fail', workflows: [] },
    ] },
    { id: 'C-106', name: 'Customer Master Change Approval', description: 'Changes to customer master data, including bank and credit terms, require independent approval.', classification: 'Non-Key', nature: 'Preventive', automation: 'Manual', frequency: 'Per transaction', mappedRisks: ['RSK-009'], workflows: [], usedInRACMs: 2, assertions: ['Authorization', 'Existence'], attributes: [
      { id: 'C-106-A1', description: 'Customer master changes carry dual approval before activation.', result: 'Pass', workflows: [] },
    ] },
    { id: 'C-107', name: 'Cash Application Reconciliation', description: 'Daily reconciliation of customer receipts posted to AR against bank deposits.', classification: 'Non-Key', nature: 'Detective', automation: 'IT-dependent', frequency: 'Daily', mappedRisks: ['RSK-023'], workflows: [
      { name: 'Cash Application Reconciliation', type: 'Automated', status: 'Completed', lastRun: 'Apr 28, 2026', runs: 8 },
    ], usedInRACMs: 3, assertions: ['Completeness', 'Accuracy'], attributes: [
      { id: 'C-107-A1', description: 'Receipts posted to customer accounts reconcile to bank deposits daily.', result: 'Pass', workflows: [{ code: 'WF-O2C-004', name: 'Cash Application Reconciliation' }] },
      { id: 'C-107-A2', description: 'Unapplied cash is investigated and cleared within SLA.', result: 'Pending', workflows: [] },
    ] },
    { id: 'C-108', name: 'AR Aging Review & Bad-Debt Provisioning', description: 'Monthly aging review drives the bad-debt provision for aged receivables.', classification: 'Non-Key', nature: 'Detective', automation: 'Manual', frequency: 'Monthly', mappedRisks: ['RSK-024'], workflows: [], usedInRACMs: 2, assertions: ['Valuation', 'Completeness'], attributes: [
      { id: 'C-108-A1', description: 'Aged balances are assessed and provisioned per the provisioning policy.', result: 'Pass', workflows: [] },
      { id: 'C-108-A2', description: 'Provision movements are reviewed and approved each month.', result: 'Pass', workflows: [] },
    ] },
    { id: 'C-109', name: 'Credit Memo Approval', description: 'Credit notes to customers require approval commensurate with value before posting.', classification: 'Non-Key', nature: 'Preventive', automation: 'Manual', frequency: 'Per transaction', mappedRisks: ['RSK-013'], workflows: [], usedInRACMs: 2, assertions: ['Authorization', 'Occurrence'], attributes: [
      { id: 'C-109-A1', description: 'Credit memos above threshold receive a documented second approval.', result: 'Pass', workflows: [] },
    ] },
    { id: 'C-110', name: 'Duplicate Customer Invoice Check', description: 'Automated scan flags potential duplicate invoices raised to the same customer.', classification: 'Non-Key', nature: 'Detective', automation: 'Automated', frequency: 'Per transaction', mappedRisks: ['RSK-013'], workflows: [], usedInRACMs: 1, assertions: ['Accuracy', 'Occurrence'], attributes: [
      { id: 'C-110-A1', description: 'Duplicate scan runs on every billing batch at generation.', result: 'Pass', workflows: [] },
      { id: 'C-110-A2', description: 'Flagged duplicates are dispositioned before invoices are dispatched.', result: 'Pass', workflows: [] },
    ] },
    { id: 'C-111', name: 'Collections Dunning Review', description: 'Overdue accounts are escalated through the dunning cycle and reviewed by collections.', classification: 'Non-Key', nature: 'Detective', automation: 'IT-dependent', frequency: 'Weekly', mappedRisks: ['RSK-024'], workflows: [], usedInRACMs: 1, assertions: ['Completeness'], attributes: [
      { id: 'C-111-A1', description: 'Overdue balances progress through dunning stages on schedule.', result: 'Pending', workflows: [] },
    ] },
    { id: 'C-112', name: 'Sales Returns Authorization', description: 'Customer returns require an authorised RMA before credit is granted.', classification: 'Non-Key', nature: 'Preventive', automation: 'Manual', frequency: 'Per transaction', mappedRisks: ['RSK-013'], workflows: [], usedInRACMs: 1, assertions: ['Authorization', 'Occurrence'], attributes: [
      { id: 'C-112-A1', description: 'Returns are accepted only against an approved return authorisation.', result: 'Pass', workflows: [] },
    ] },
    { id: 'C-113', name: 'Contract Terms vs Billing Reconciliation', description: 'Billing is reconciled to contracted terms to surface revenue leakage.', classification: 'Key', nature: 'Detective', automation: 'IT-dependent', frequency: 'Monthly', mappedRisks: ['RSK-013', 'RSK-006'], workflows: [], usedInRACMs: 3, assertions: ['Accuracy', 'Completeness', 'Valuation'], attributes: [
      { id: 'C-113-A1', description: 'Billed rates and volumes agree to the active customer contract.', result: 'Pass', workflows: [] },
      { id: 'C-113-A2', description: 'Unbilled or under-billed contract lines are identified and corrected.', result: 'Fail', workflows: [] },
    ] },
    { id: 'C-114', name: 'Deferred Revenue Schedule Review', description: 'Deferred revenue release schedules are reviewed for accuracy and completeness.', classification: 'Non-Key', nature: 'Detective', automation: 'Manual', frequency: 'Monthly', mappedRisks: ['RSK-006'], workflows: [], usedInRACMs: 2, assertions: ['Cut-off', 'Valuation'], attributes: [
      { id: 'C-114-A1', description: 'Deferred balances release in line with the performance schedule.', result: 'Pass', workflows: [] },
    ] },
    { id: 'C-115', name: 'Customer Credit Re-Assessment', description: 'Customer credit limits are periodically re-assessed against payment behaviour and exposure.', classification: 'Non-Key', nature: 'Preventive', automation: 'Manual', frequency: 'Quarterly', mappedRisks: ['RSK-022', 'RSK-009'], workflows: [], usedInRACMs: 1, assertions: ['Valuation', 'Authorization'], attributes: [
      { id: 'C-115-A1', description: 'Credit limits are reviewed and re-approved on the defined cycle.', result: 'Pass', workflows: [] },
    ] },
    { id: 'C-116', name: 'Receivable Write-Off Authorization', description: 'Write-offs of uncollectable receivables require authorization at the appropriate level.', classification: 'Non-Key', nature: 'Preventive', automation: 'Manual', frequency: 'Monthly', mappedRisks: ['RSK-024'], workflows: [], usedInRACMs: 1, assertions: ['Authorization', 'Valuation'], attributes: [
      { id: 'C-116-A1', description: 'Write-offs above threshold are authorised before posting.', result: 'Pending', workflows: [] },
    ] },
    { id: 'C-117', name: 'Unbilled Revenue Review', description: 'Unbilled revenue balances are reviewed to confirm goods/services delivered are billed timely.', classification: 'Non-Key', nature: 'Detective', automation: 'IT-dependent', frequency: 'Monthly', mappedRisks: ['RSK-006', 'RSK-013'], workflows: [], usedInRACMs: 2, assertions: ['Completeness', 'Cut-off'], attributes: [
      { id: 'C-117-A1', description: 'Delivered but unbilled items are identified and billed in the period.', result: 'Pass', workflows: [] },
    ] },
    { id: 'C-118', name: 'Remittance Posting Accuracy', description: 'Customer remittances are matched to open invoices so cash is applied to the correct items.', classification: 'Non-Key', nature: 'Detective', automation: 'IT-dependent', frequency: 'Daily', mappedRisks: ['RSK-023'], workflows: [], usedInRACMs: 1, assertions: ['Accuracy', 'Completeness'], attributes: [
      { id: 'C-118-A1', description: 'Remittances are applied to the correct open invoices, not on account.', result: 'Pass', workflows: [] },
    ] },
  ],
};

// Workflows shown in each process's Workflows tab. Keyed the same way as controls.
export const WORKFLOWS_BY_PROCESS: Record<string, BPWorkflow[]> = {
  P2P: [
    { id: 'wf-c1', name: 'Three-Way PO Match', description: 'Automated matching of PO, GRN, and Invoice before payment release.', type: 'Automated', nature: 'Preventive', status: 'Active', linkedControls: ['C-001', 'C-004'], owner: 'Karan Mehta', lastRun: 'May 18, 2026 · 6:00 PM', lastRunStatus: 'Success', lastRunError: null, lastRunErrorKind: null, tags: ['Matching'], isSql: false },
    { id: 'wf-c2', name: 'Vendor Change Monitor', description: 'Monitors vendor master data changes and validates approval chain.', type: 'Automated', nature: 'Detective', status: 'Active', linkedControls: ['C-002'], owner: 'Tushar Goel', lastRun: 'May 18, 2026 · 6:00 PM', lastRunStatus: 'Error', lastRunError: 'Vendor master feed unavailable — connection timed out after 30s.', lastRunErrorKind: 'technical', tags: ['Vendor', 'Master Data'], isSql: true },
    { id: 'wf-c3', name: 'Duplicate Invoice Detector', description: 'Scans invoices against historical data to flag duplicates.', type: 'Automated', nature: 'Detective', status: 'Active', linkedControls: ['C-003'], owner: 'Deepak Bansal', lastRun: 'May 17, 2026 · 2:00 AM', lastRunStatus: 'Error', lastRunError: "Source file 'invoice_register_apr.csv' could not be parsed — column 'Invoice Date' is missing.", lastRunErrorKind: 'data', tags: ['Duplicates', 'Fraud'], isSql: true },
    { id: 'wf-c4', name: 'Payment Approval Review', description: 'Manual review of high-value payment approvals.', type: 'Manual', nature: 'Preventive', status: 'Active', linkedControls: ['C-004'], owner: 'Neha Joshi', lastRun: 'May 16, 2026 · 11:30 AM', lastRunStatus: 'Success', lastRunError: null, lastRunErrorKind: null, tags: ['Payments'], isSql: false },
    { id: 'wf-c5', name: 'PO Dual Sign-Off Check', description: 'Validates dual authorization for purchase orders above threshold.', type: 'Automated', nature: 'Preventive', status: 'Draft', linkedControls: [], owner: 'Tushar Goel', lastRun: null, lastRunStatus: null, lastRunError: null, lastRunErrorKind: null, tags: ['Authorization'], isSql: false },
  ],
  O2C: [
    { id: 'wf-o2c-1', name: 'Credit Limit Check Monitor', description: 'Monitors sales orders against customer credit limits and blocks orders that breach exposure.', type: 'Automated', nature: 'Preventive', status: 'Active', linkedControls: ['C-101', 'C-115'], owner: 'Priya Nair', lastRun: 'May 18, 2026 · 6:00 PM', lastRunStatus: 'Success', lastRunError: null, lastRunErrorKind: null, tags: ['Credit', 'Orders'], isSql: false },
    { id: 'wf-o2c-2', name: 'Order/Shipment/Invoice Match', description: 'Reconciles order, shipment and invoice quantities before billing is released.', type: 'Automated', nature: 'Detective', status: 'Active', linkedControls: ['C-103', 'C-104'], owner: 'Rohan Verma', lastRun: 'May 17, 2026 · 2:00 AM', lastRunStatus: 'Error', lastRunError: "Source file 'shipment_log_apr.csv' could not be parsed — column 'Ship Date' is missing.", lastRunErrorKind: 'data', tags: ['Matching', 'Billing'], isSql: true },
    { id: 'wf-o2c-3', name: 'Cash Application Reconciliation', description: 'Reconciles customer receipts posted to AR against bank deposits each day.', type: 'Automated', nature: 'Detective', status: 'Active', linkedControls: ['C-107', 'C-118'], owner: 'Sneha Kapoor', lastRun: 'May 16, 2026 · 11:30 AM', lastRunStatus: 'Error', lastRunError: 'Bank statement feed unavailable — connection timed out after 30s.', lastRunErrorKind: 'technical', tags: ['Cash', 'Reconciliation'], isSql: true },
  ],
};

/** Seed controls for a process (empty list when the process has none yet). */
export function getSeedControls(bpAbbr: string): DesignControl[] {
  return CONTROLS_BY_PROCESS[bpAbbr] ?? [];
}

/** Seed workflows for a process (empty list when the process has none yet). */
export function getSeedWorkflows(bpAbbr: string): BPWorkflow[] {
  return WORKFLOWS_BY_PROCESS[bpAbbr] ?? [];
}

/** Find a seed control by id across every process (used to resolve a control
 *  opened in a standalone detail tab, where the process isn't always known). */
export function findSeedControl(id: string): DesignControl | undefined {
  for (const list of Object.values(CONTROLS_BY_PROCESS)) {
    const hit = list.find(c => c.id === id);
    if (hit) return hit;
  }
  return undefined;
}
