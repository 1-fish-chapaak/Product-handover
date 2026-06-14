import type {
  ActionTakenReport,
  AttributeTest,
  ControlTest,
  EvidenceFile,
  OwnerReviewRecord,
  PhaseRecord,
  SelfAssessmentRecord,
  WorkflowRun,
} from './types';

// ─── builders ─────────────────────────────────────────────────────────────────

let evSeq = 0;
function evi(name: string, kind: EvidenceFile['kind'], uploadedBy: string, uploadedAt: string): EvidenceFile {
  evSeq += 1;
  return { id: `ev-${evSeq}`, name, kind, uploadedBy, uploadedAt };
}

const emptySelf = (): SelfAssessmentRecord => ({ outcome: null, remark: '', evidence: [], submittedBy: null, submittedAt: null });
const emptyOwner = (): OwnerReviewRecord => ({ verdict: null, remark: '', reviewedBy: null, reviewedAt: null });
const emptyPhase = (): PhaseRecord => ({ result: null, notes: '', evidence: [], testedBy: null, testedAt: null });

function wf(
  workflowId: string,
  workflowName: string,
  lastRunAt: string | null,
  population: number,
  exceptions: number,
  verdict: WorkflowRun['verdict'],
  confidence: number,
  rationale: string,
  columns: string[],
  rows: (string | number)[][],
): WorkflowRun {
  return { workflowId, workflowName, lastRunAt, population, exceptions, verdict, confidence, rationale, columns, rows };
}

interface AttrSeed {
  code: string;
  description: string;
  method: AttributeTest['method'];
  assertion: string;
  workflow?: WorkflowRun;
  selfAssessment?: Partial<SelfAssessmentRecord>;
  ownerReview?: Partial<OwnerReviewRecord>;
  phase1?: Partial<PhaseRecord>;
  phase2?: Partial<PhaseRecord>;
}

function attr(s: AttrSeed): AttributeTest {
  return {
    id: s.code,
    code: s.code,
    description: s.description,
    method: s.method,
    assertion: s.assertion,
    workflow: s.workflow,
    selfAssessment: { ...emptySelf(), ...s.selfAssessment },
    ownerReview: { ...emptyOwner(), ...s.ownerReview },
    phase1: { ...emptyPhase(), ...s.phase1 },
    phase2: { ...emptyPhase(), ...s.phase2 },
  };
}

interface CtrlSeed extends Omit<ControlTest, 'attributes'> {
  attributes: AttrSeed[];
}

function build(seed: CtrlSeed): ControlTest {
  return { ...seed, attributes: seed.attributes.map(attr) };
}

// ─── seed ───────────────────────────────────────────────────────────────────--

const SEED: CtrlSeed[] = [
  // 1 ── Concluded EFFECTIVE (automated, full loop closed)
  {
    controlId: 'P2P-C-01',
    name: 'Vendor master add/change requires dual approval',
    process: 'P2P',
    subProcess: 'Vendor Management',
    isKey: true,
    frequency: 'Monthly',
    owner: 'Meera Iyer',
    performer: 'Rohit Sharma',
    dueLabel: 'Closed this cycle',
    overdue: false,
    stage: 'concluded',
    conclusion: 'Effective',
    atr: null,
    attributes: [
      {
        code: 'P2P-C-01.1',
        description: 'Every vendor add/change carries two distinct approver IDs',
        method: 'Automated',
        assertion: 'Authorisation',
        workflow: wf(
          'wf-vmd-dual', 'Vendor Master Dual-Approval Check', '3 days ago', 412, 0, 'Pass', 98,
          'All 412 vendor change records carried two distinct approver IDs. No self-approval detected.',
          ['Change ID', 'Vendor', 'Maker', 'Approver', 'Distinct?'],
          [['VC-3381', 'Tata Steel', 'rsharma', 'pgupta', 'Yes'], ['VC-3382', 'Reliance', 'akhan', 'mdsouza', 'Yes'], ['VC-3390', 'L&T', 'nverma', 'pgupta', 'Yes']],
        ),
        selfAssessment: { outcome: 'OK', remark: 'Reviewed exception log — clean for the period.', evidence: [evi('vendor-change-log-may.xlsx', 'XLSX', 'Rohit Sharma', '6 days ago')], submittedBy: 'Rohit Sharma', submittedAt: '6 days ago' },
        ownerReview: { verdict: 'Pass', remark: 'Documentation sufficient.', reviewedBy: 'Meera Iyer', reviewedAt: '5 days ago' },
        phase1: { result: 'Pass', notes: 'Re-performed against full population. No deviations.', testedBy: 'PwC · A. Nair', testedAt: '2 days ago' },
        phase2: { result: 'Pass', notes: 'Roll-forward sample of 25 — all dual-approved.', testedBy: 'PwC · A. Nair', testedAt: '1 day ago' },
      },
    ],
  },

  // 2 ── Auditor in PHASE 2 (phase 1 passed)
  {
    controlId: 'P2P-C-02',
    name: 'PO approval threshold enforced by amount tier',
    process: 'P2P',
    subProcess: 'Purchase Orders',
    isKey: true,
    frequency: 'Daily',
    owner: 'Meera Iyer',
    performer: 'Rohit Sharma',
    dueLabel: 'Phase 2 in progress',
    overdue: false,
    stage: 'audit-phase-2',
    conclusion: null,
    atr: null,
    attributes: [
      {
        code: 'P2P-C-02.1',
        description: 'POs above ₹5L route to the tier-2 approver',
        method: 'Automated',
        assertion: 'Authorisation',
        workflow: wf(
          'wf-po-tier', 'PO Tier-Threshold Monitor', '4 hours ago', 1280, 3, 'Hold', 86,
          '3 of 1,280 POs above ₹5L were approved by a tier-1 approver. Possible threshold bypass — needs judgement.',
          ['PO', 'Amount (₹)', 'Tier', 'Approver role', 'Flag'],
          [['PO-88120', '6,40,000', 'Tier-2', 'Manager', 'OK'], ['PO-88134', '8,10,000', 'Tier-1', 'Lead', 'Bypass?'], ['PO-88140', '5,90,000', 'Tier-1', 'Lead', 'Bypass?']],
        ),
        selfAssessment: { outcome: 'OK', remark: 'Three flags are emergency POs with CFO email approval attached.', evidence: [evi('emergency-po-approvals.pdf', 'PDF', 'Rohit Sharma', '3 days ago')], submittedBy: 'Rohit Sharma', submittedAt: '3 days ago' },
        ownerReview: { verdict: 'Pass', remark: 'Emergency approvals are valid per DoA §4.2.', reviewedBy: 'Meera Iyer', reviewedAt: '2 days ago' },
        phase1: { result: 'Pass', notes: 'Interim test of 40 POs — exceptions explained by emergency DoA.', testedBy: 'PwC · A. Nair', testedAt: '1 day ago' },
        phase2: {},
      },
      {
        code: 'P2P-C-02.2',
        description: 'Tier matrix matches the approved Delegation of Authority',
        method: 'Self-assessed',
        assertion: 'Validity',
        selfAssessment: { outcome: 'OK', remark: 'Tier matrix reconciled to DoA v9.', evidence: [evi('doa-v9-signed.pdf', 'PDF', 'Rohit Sharma', '3 days ago')], submittedBy: 'Rohit Sharma', submittedAt: '3 days ago' },
        ownerReview: { verdict: 'Pass', remark: '', reviewedBy: 'Meera Iyer', reviewedAt: '2 days ago' },
        phase1: { result: 'Pass', notes: 'Matrix tie-out agreed.', testedBy: 'PwC · A. Nair', testedAt: '1 day ago' },
        phase2: {},
      },
    ],
  },

  // 3 ── Awaiting AUDIT (CSA complete, auditor not yet started)
  {
    controlId: 'P2P-C-03',
    name: 'Three-way match (PO · GRN · Invoice) before payment',
    process: 'P2P',
    subProcess: 'Invoice Processing',
    isKey: true,
    frequency: 'Weekly',
    owner: 'Sanjay Patel',
    performer: 'Anita Rao',
    dueLabel: 'Ready for auditor',
    overdue: false,
    stage: 'awaiting-audit',
    conclusion: null,
    atr: null,
    attributes: [
      {
        code: 'P2P-C-03.1',
        description: 'Invoice quantity matches GRN quantity within tolerance',
        method: 'Automated',
        assertion: 'Accuracy',
        workflow: wf(
          'wf-3way', 'Three-Way Match Reconciler', '1 hour ago', 2640, 11, 'Fail', 91,
          '11 invoices posted without a matching GRN within ±2% tolerance. Recommend control deficiency unless overrides are documented.',
          ['Invoice', 'PO', 'GRN', 'Inv Qty', 'GRN Qty', 'Δ%'],
          [['INV-55021', 'PO-7720', '—', 120, 0, 'No GRN'], ['INV-55044', 'PO-7731', 'GRN-2210', 500, 460, '8.7%'], ['INV-55077', 'PO-7740', 'GRN-2231', 80, 72, '10%']],
        ),
        selfAssessment: { outcome: 'Not OK', remark: '11 mismatches — 1 has no GRN (service invoice), 10 are quantity tolerance breaches pending vendor credit notes.', evidence: [evi('3way-exceptions-wk23.xlsx', 'XLSX', 'Anita Rao', '2 days ago')], submittedBy: 'Anita Rao', submittedAt: '2 days ago' },
        ownerReview: { verdict: 'Pass', remark: 'Accept self-assessment — exceptions are in-flight, credit notes expected. Flag to auditor.', reviewedBy: 'Sanjay Patel', reviewedAt: '1 day ago' },
        phase1: {},
        phase2: {},
      },
      {
        code: 'P2P-C-03.2',
        description: 'No payment released before all three documents are linked',
        method: 'Self-assessed',
        assertion: 'Completeness',
        selfAssessment: { outcome: 'OK', remark: 'Payment run blocks unmatched invoices automatically.', evidence: [evi('payment-block-config.pdf', 'PDF', 'Anita Rao', '2 days ago')], submittedBy: 'Anita Rao', submittedAt: '2 days ago' },
        ownerReview: { verdict: 'Pass', remark: '', reviewedBy: 'Sanjay Patel', reviewedAt: '1 day ago' },
        phase1: {},
        phase2: {},
      },
    ],
  },

  // 4 ── Concluded INEFFECTIVE → ATR open (the failure showcase)
  {
    controlId: 'P2P-C-04',
    name: 'Duplicate invoice prevention check on AP posting',
    process: 'P2P',
    subProcess: 'Invoice Processing',
    isKey: false,
    frequency: 'Daily',
    owner: 'Sanjay Patel',
    performer: 'Anita Rao',
    dueLabel: 'Remediation due 30 Jun',
    overdue: false,
    stage: 'concluded',
    conclusion: 'Ineffective',
    atr: {
      id: 'ATR-2026-014',
      raisedAt: '2 days ago',
      severity: 'High',
      exception: 'Duplicate-invoice block was disabled for 9 days; 6 duplicate payments totalling ₹18.4L cleared AP.',
      rootCause: 'A patch reset the SAP duplicate-check flag (LFB1) and the change was not picked up in config monitoring.',
      managementAction: 'Re-enable duplicate check, add config-drift alert, recover ₹18.4L from vendors.',
      managementActionDate: '30 Jun 2026',
      remediationOwner: 'Sanjay Patel',
      status: 'In Remediation',
      remediationResult: null,
      closedAt: null,
    },
    attributes: [
      {
        code: 'P2P-C-04.1',
        description: 'AP posting rejects invoices matching an existing (vendor, number, amount) tuple',
        method: 'Automated',
        assertion: 'Validity',
        workflow: wf(
          'wf-dupe', 'Duplicate Invoice Detector', '2 hours ago', 5210, 6, 'Fail', 99,
          '6 confirmed duplicate payments cleared while the SAP duplicate-check flag was off (9-day window).',
          ['Invoice', 'Vendor', 'Amount (₹)', 'Original', 'Paid?'],
          [['INV-9981', 'Sify', '3,10,000', 'INV-9012', 'Yes'], ['INV-9983', 'Sify', '3,10,000', 'INV-9012', 'Yes'], ['INV-10044', 'Wipro', '2,90,000', 'INV-8800', 'Yes']],
        ),
        selfAssessment: { outcome: 'Not OK', remark: 'Duplicate check was inadvertently disabled after the May patch.', evidence: [evi('config-change-log.pdf', 'PDF', 'Anita Rao', '4 days ago')], submittedBy: 'Anita Rao', submittedAt: '4 days ago' },
        ownerReview: { verdict: 'Fail', remark: 'Insufficient — duplicates reached payment. This is a control failure, not an exception.', reviewedBy: 'Sanjay Patel', reviewedAt: '3 days ago' },
        phase1: { result: 'Fail', notes: 'Confirmed 6 duplicate payments. Control was not operating for 9 days.', testedBy: 'PwC · A. Nair', testedAt: '2 days ago' },
        phase2: { result: 'Fail', notes: 'Re-test post-remediation pending management action date.', testedBy: 'PwC · A. Nair', testedAt: '2 days ago' },
      },
    ],
  },

  // 5 ── Awaiting OWNER review (performer submitted Not OK)
  {
    controlId: 'P2P-C-05',
    name: 'Segregation of duties between PO creator and approver',
    process: 'P2P',
    subProcess: 'Purchase Orders',
    isKey: true,
    frequency: 'Monthly',
    owner: 'Meera Iyer',
    performer: 'Rohit Sharma',
    dueLabel: 'With owner since today',
    overdue: false,
    stage: 'awaiting-owner-review',
    conclusion: null,
    atr: null,
    attributes: [
      {
        code: 'P2P-C-05.1',
        description: 'No user holds both PO-create and PO-approve roles',
        method: 'Self-assessed',
        assertion: 'Authorisation',
        selfAssessment: { outcome: 'Not OK', remark: '2 users in the procurement team currently hold both roles after a reorg. Access removal raised with IT (TICKET-4471).', evidence: [evi('sod-conflict-report.xlsx', 'XLSX', 'Rohit Sharma', 'today'), evi('it-access-ticket.pdf', 'PDF', 'Rohit Sharma', 'today')], submittedBy: 'Rohit Sharma', submittedAt: 'today' },
      },
    ],
  },

  // 6 ── Awaiting SELF-ASSESSMENT (performer's task, due today)
  {
    controlId: 'P2P-C-06',
    name: 'Payment release dual sign-off above ₹10L threshold',
    process: 'P2P',
    subProcess: 'Payments',
    isKey: true,
    frequency: 'Monthly',
    owner: 'Meera Iyer',
    performer: 'Rohit Sharma',
    dueLabel: 'Due today',
    overdue: false,
    stage: 'awaiting-self-assessment',
    conclusion: null,
    atr: null,
    attributes: [
      {
        code: 'P2P-C-06.1',
        description: 'Payments above ₹10L carry two authorised sign-offs before release',
        method: 'Automated',
        assertion: 'Authorisation',
        workflow: wf(
          'wf-pay-dual', 'High-Value Payment Sign-off Monitor', '20 minutes ago', 318, 1, 'Hold', 88,
          '1 of 318 high-value payments shows a single sign-off. Awaiting performer attestation.',
          ['Payment', 'Amount (₹)', 'Sign-off 1', 'Sign-off 2', 'Flag'],
          [['PAY-2201', '24,00,000', 'mdsouza', 'pgupta', 'OK'], ['PAY-2218', '11,50,000', 'akhan', '—', 'Single'], ['PAY-2230', '40,00,000', 'mdsouza', 'nverma', 'OK']],
        ),
      },
      {
        code: 'P2P-C-06.2',
        description: 'Both sign-offs are from the authorised signatory list',
        method: 'Self-assessed',
        assertion: 'Validity',
      },
    ],
  },

  // 7 ── Auditor in PHASE 1
  {
    controlId: 'O2C-C-01',
    name: 'Credit limit enforced at order entry',
    process: 'O2C',
    subProcess: 'Order Management',
    isKey: true,
    frequency: 'Daily',
    owner: 'Priya Nair',
    performer: 'Karan Mehta',
    dueLabel: 'Phase 1 in progress',
    overdue: false,
    stage: 'audit-phase-1',
    conclusion: null,
    atr: null,
    attributes: [
      {
        code: 'O2C-C-01.1',
        description: 'Orders exceeding customer credit limit are blocked or routed for approval',
        method: 'Automated',
        assertion: 'Validity',
        workflow: wf(
          'wf-credit', 'Credit-Limit Breach Monitor', '6 hours ago', 4120, 5, 'Hold', 84,
          '5 orders exceeded credit limit without a documented override. Sampling for Phase 1.',
          ['Order', 'Customer', 'Limit (₹)', 'Order (₹)', 'Override?'],
          [['SO-7741', 'Croma', '20,00,000', '22,40,000', 'No'], ['SO-7755', 'Vijay Sales', '5,00,000', '5,30,000', 'Yes'], ['SO-7760', 'Reliance Digital', '50,00,000', '61,00,000', 'No']],
        ),
        selfAssessment: { outcome: 'OK', remark: 'Overrides approved by sales head per policy.', evidence: [evi('credit-override-log.xlsx', 'XLSX', 'Karan Mehta', '2 days ago')], submittedBy: 'Karan Mehta', submittedAt: '2 days ago' },
        ownerReview: { verdict: 'Pass', remark: 'Overrides valid.', reviewedBy: 'Priya Nair', reviewedAt: '1 day ago' },
      },
    ],
  },

  // 8 ── Awaiting AUDIT (hybrid)
  {
    controlId: 'R2R-C-01',
    name: 'Journal entries approved before posting to GL',
    process: 'R2R',
    subProcess: 'Journal Entries',
    isKey: true,
    frequency: 'Monthly',
    owner: 'Vikram Desai',
    performer: 'Sneha Joshi',
    dueLabel: 'Ready for auditor',
    overdue: false,
    stage: 'awaiting-audit',
    conclusion: null,
    atr: null,
    attributes: [
      {
        code: 'R2R-C-01.1',
        description: 'Every manual JE has an approver distinct from the preparer',
        method: 'Automated',
        assertion: 'Authorisation',
        workflow: wf(
          'wf-je-approve', 'Manual JE Approval Check', '1 day ago', 880, 0, 'Pass', 96,
          'All 880 manual JEs carried a distinct approver. No self-approval.',
          ['JE', 'Preparer', 'Approver', 'Amount (₹)', 'Distinct?'],
          [['JE-4410', 'sjoshi', 'vdesai', '12,00,000', 'Yes'], ['JE-4422', 'rkapoor', 'vdesai', '8,40,000', 'Yes']],
        ),
        selfAssessment: { outcome: 'OK', remark: 'Clean for the month.', evidence: [evi('je-approval-extract.xlsx', 'XLSX', 'Sneha Joshi', '3 days ago')], submittedBy: 'Sneha Joshi', submittedAt: '3 days ago' },
        ownerReview: { verdict: 'Pass', remark: '', reviewedBy: 'Vikram Desai', reviewedAt: '2 days ago' },
      },
      {
        code: 'R2R-C-01.2',
        description: 'Supporting documentation attached for JEs above ₹10L',
        method: 'Self-assessed',
        assertion: 'Completeness',
        selfAssessment: { outcome: 'OK', remark: 'All 14 JEs > ₹10L have backup attached.', evidence: [evi('high-value-je-backup.pdf', 'PDF', 'Sneha Joshi', '3 days ago')], submittedBy: 'Sneha Joshi', submittedAt: '3 days ago' },
        ownerReview: { verdict: 'Pass', remark: '', reviewedBy: 'Vikram Desai', reviewedAt: '2 days ago' },
      },
    ],
  },

  // 9 ── Awaiting SELF-ASSESSMENT, overdue (creates urgency in performer view)
  {
    controlId: 'P2P-C-07',
    name: 'Goods receipt matched to PO quantity on inward',
    process: 'P2P',
    subProcess: 'Goods Receipt',
    isKey: false,
    frequency: 'Weekly',
    owner: 'Sanjay Patel',
    performer: 'Anita Rao',
    dueLabel: 'Overdue 2 days',
    overdue: true,
    stage: 'awaiting-self-assessment',
    conclusion: null,
    atr: null,
    attributes: [
      {
        code: 'P2P-C-07.1',
        description: 'GRN quantity does not exceed open PO quantity',
        method: 'Automated',
        assertion: 'Accuracy',
        workflow: wf(
          'wf-grn', 'GRN-PO Quantity Match', '5 hours ago', 1940, 2, 'Hold', 90,
          '2 GRNs exceed open PO quantity. Awaiting performer attestation.',
          ['GRN', 'PO', 'PO Qty', 'GRN Qty', 'Over?'],
          [['GRN-3301', 'PO-9120', 100, 100, 'No'], ['GRN-3314', 'PO-9134', 250, 268, 'Yes'], ['GRN-3320', 'PO-9140', 40, 44, 'Yes']],
        ),
      },
    ],
  },
];

export function seedControlTests(): ControlTest[] {
  return SEED.map(build);
}
