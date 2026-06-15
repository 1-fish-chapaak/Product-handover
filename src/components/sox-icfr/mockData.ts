import type {
  Assertion, Attribute, Control, Deficiency, EvidenceFile, HandoffTask,
  IcfrEngagement, PhaseRecord, TestProcedure, TestResult, ToeRecord,
} from './types';

const AUDITOR = 'A. Nair · PwC';
const REVIEWER = 'S. Menon · Manager';

let ev = 0;
function evi(name: string, kind: EvidenceFile['kind'], by: string, at: string): EvidenceFile {
  ev += 1; return { id: `ev-${ev}`, name, kind, uploadedBy: by, uploadedAt: at };
}
const tod = (result: TestResult, note = '', by: string | null = null, at: string | null = null): PhaseRecord => ({ result, note, testedBy: by, testedAt: at });
function toe(result: TestResult, opts: Partial<ToeRecord> = {}): ToeRecord {
  return { result, note: '', testedBy: null, testedAt: null, procedures: [], sampleResults: [], ...opts };
}
const samplePass = (n: number, prefix: string): { sampleId: string; result: TestResult }[] =>
  Array.from({ length: n }, (_, i) => ({ sampleId: `${prefix}-${String(i + 1).padStart(3, '0')}`, result: 'Pass' as TestResult }));

interface AttrSeed {
  code: string; description: string; assertion: Assertion; precision: string;
  tod: PhaseRecord; toe: ToeRecord;
}
function attr(s: AttrSeed): Attribute {
  return { id: s.code, code: s.code, description: s.description, assertion: s.assertion, precision: s.precision, tod: s.tod, toe: s.toe };
}

const INSPECT_REPERFORM: TestProcedure[] = ['Inspection', 'Reperformance'];

// ─── controls ─────────────────────────────────────────────────────────────────--

const CONTROLS: Control[] = [
  // 1 · Signed off, Effective (automated — full loop)
  {
    id: 'P2P-C-01', description: 'Vendor master add/change requires dual approval with KYC pack',
    process: 'P2P', subProcess: 'Vendor Onboarding', nature: 'Automated', type: 'Preventive', frequency: 'Daily',
    isKey: true, precision: 'Blocks any add/change lacking a second distinct approver (₹0 tolerance).',
    owner: 'Rohit Sharma', riskId: 'RSK-VO-01', riskDescription: 'Fictitious / unauthorised vendor onboarded',
    assertions: ['Existence / Occurrence'], workflowId: 'wf-vmd', workflowName: 'Vendor Master Dual-Approval Check',
    stage: 'signed-off', conclusion: 'Effective',
    attributes: [
      attr({ code: 'P2P-C-01.1', description: 'Two distinct approver IDs on every vendor change', assertion: 'Existence / Occurrence', precision: 'Self-approval blocked by SAP role design', tod: tod('Pass', 'Designed to block self-approval — confirmed in config.', AUDITOR, '5 days ago'), toe: toe('Pass', { procedures: INSPECT_REPERFORM, sampleResults: samplePass(25, 'VC'), note: 'Workflow scanned 412 changes — 0 self-approvals.', testedBy: AUDITOR, testedAt: '2 days ago', workflowRunRef: 'run-vmd-0418' }) }),
    ],
  },
  // 2 · In review (automated)
  {
    id: 'P2P-C-02', description: 'PO approval routed by amount tier per Delegation of Authority',
    process: 'P2P', subProcess: 'Purchase Orders', nature: 'Automated', type: 'Preventive', frequency: 'Daily',
    isKey: true, precision: 'POs > ₹5L route to tier-2; thresholds match DoA v9.',
    owner: 'Rohit Sharma', riskId: 'RSK-PO-02', riskDescription: 'PO approved outside delegated authority',
    assertions: ['Existence / Occurrence'], workflowId: 'wf-po-tier', workflowName: 'PO Tier-Threshold Monitor',
    stage: 'in-review', conclusion: 'Effective',
    attributes: [
      attr({ code: 'P2P-C-02.1', description: 'POs above ₹5L approved by tier-2', assertion: 'Existence / Occurrence', precision: '₹5L threshold per DoA', tod: tod('Pass', '', AUDITOR, '3 days ago'), toe: toe('Pass', { procedures: INSPECT_REPERFORM, sampleResults: samplePass(25, 'PO'), note: '3 emergency POs explained by CFO email.', testedBy: AUDITOR, testedAt: '1 day ago', workflowRunRef: 'run-po-0419' }) }),
      attr({ code: 'P2P-C-02.2', description: 'Tier matrix reconciles to approved DoA', assertion: 'Rights & Obligations', precision: 'Matrix = DoA v9', tod: tod('Pass', '', AUDITOR, '3 days ago'), toe: toe('Pass', { procedures: ['Inspection'], sampleResults: samplePass(1, 'DOA'), note: 'Matrix tie-out agreed to DoA v9.', testedBy: AUDITOR, testedAt: '1 day ago' }) }),
    ],
  },
  // 3 · TOE in progress, manual — waiting on owner (PBC), then auditor
  {
    id: 'P2P-C-03', description: 'Three-way match (PO · GRN · Invoice) before payment',
    process: 'P2P', subProcess: 'Invoice Processing', nature: 'Manual', type: 'Detective', frequency: 'Weekly',
    isKey: true, precision: 'Quantity & price matched within ±2% before AP release.',
    owner: 'Anita Rao', riskId: 'RSK-IP-03', riskDescription: 'Payment without valid goods receipt',
    assertions: ['Accuracy', 'Existence / Occurrence'],
    stage: 'toe', conclusion: 'In progress',
    population: { source: 'AP invoice register Apr–Jun', count: 2640, tieOut: 'Agreed to GL AP control account', evidence: [evi('ap-register-q1.xlsx', 'XLSX', 'Anita Rao', '2 days ago')] },
    sampling: { basis: 'Weekly control · low-risk routine population · 25 random items for reperformance', method: 'Random', size: 25, samples: Array.from({ length: 25 }, (_, i) => ({ id: `s3-${i}`, ref: `INV-${55000 + i}` })) },
    attributes: [
      attr({ code: 'P2P-C-03.1', description: 'Invoice qty matches GRN qty within tolerance', assertion: 'Accuracy', precision: '±2% tolerance', tod: tod('Pass', 'Walkthrough INV-55021 traced PO→GRN→invoice.', AUDITOR, '2 days ago'), toe: toe('Not tested', { procedures: INSPECT_REPERFORM }) }),
      attr({ code: 'P2P-C-03.2', description: 'No payment released before all three docs linked', assertion: 'Existence / Occurrence', precision: 'AP run blocks unmatched', tod: tod('Pass', '', AUDITOR, '2 days ago'), toe: toe('Not tested', { procedures: ['Inspection'] }) }),
    ],
  },
  // 4 · Concluded Ineffective → remediation (the deficiency showcase)
  {
    id: 'P2P-C-04', description: 'Duplicate invoice prevention on AP posting',
    process: 'P2P', subProcess: 'Invoice Processing', nature: 'Automated', type: 'Detective', frequency: 'Daily',
    isKey: true, precision: 'Rejects matching (vendor, number, amount) tuples at posting.',
    owner: 'Anita Rao', riskId: 'RSK-IP-04', riskDescription: 'Duplicate payment to vendor',
    assertions: ['Accuracy'], workflowId: 'wf-dupe', workflowName: 'Duplicate Invoice Detector',
    stage: 'remediation', conclusion: 'Ineffective',
    attributes: [
      attr({ code: 'P2P-C-04.1', description: 'AP rejects invoices matching an existing tuple', assertion: 'Accuracy', precision: 'Exact (vendor, number, amount) match', tod: tod('Pass', 'Designed correctly — block exists in SAP.', AUDITOR, '4 days ago'), toe: toe('Fail', { procedures: INSPECT_REPERFORM, sampleResults: [{ sampleId: 'INV-9981', result: 'Fail' }, { sampleId: 'INV-9983', result: 'Fail' }, { sampleId: 'INV-10044', result: 'Fail' }], note: 'Block disabled 9 days after May patch — 6 duplicates paid (₹18.4L).', testedBy: AUDITOR, testedAt: '2 days ago', workflowRunRef: 'run-dupe-0419' }) }),
    ],
  },
  // 5 · TOD failed → design deficiency (manual)
  {
    id: 'P2P-C-05', description: 'Segregation of duties between PO creator and approver',
    process: 'P2P', subProcess: 'Purchase Orders', nature: 'Manual', type: 'Preventive', frequency: 'Monthly',
    isKey: true, precision: 'No user holds both PO-create and PO-approve roles.',
    owner: 'Rohit Sharma', riskId: 'RSK-PO-05', riskDescription: 'Unauthorised PO created and self-approved',
    assertions: ['Existence / Occurrence'],
    stage: 'concluded', conclusion: 'Ineffective',
    attributes: [
      attr({ code: 'P2P-C-05.1', description: 'No user holds both create and approve roles', assertion: 'Existence / Occurrence', precision: 'Role matrix enforces SoD', tod: tod('Fail', 'Design gap — 2 users hold both roles after a reorg; matrix not updated.', AUDITOR, '1 day ago'), toe: toe('Not tested', { procedures: INSPECT_REPERFORM }) }),
    ],
  },
  // 6 · Not started → PBC requested (waiting on owner)
  {
    id: 'P2P-C-06', description: 'Payment release dual sign-off above ₹10L',
    process: 'P2P', subProcess: 'Payments', nature: 'Manual', type: 'Preventive', frequency: 'Monthly',
    isKey: true, precision: 'Payments > ₹10L carry two authorised sign-offs.',
    owner: 'Anita Rao', riskId: 'RSK-PY-06', riskDescription: 'High-value payment released by one person',
    assertions: ['Existence / Occurrence'],
    stage: 'pbc-requested', conclusion: 'Not started',
    attributes: [
      attr({ code: 'P2P-C-06.1', description: 'Two authorised sign-offs on payments > ₹10L', assertion: 'Existence / Occurrence', precision: '₹10L threshold', tod: tod('Not tested'), toe: toe('Not tested', { procedures: INSPECT_REPERFORM }) }),
    ],
  },
  // 7 · TOE, automated, auditor court
  {
    id: 'P2P-C-07', description: 'Goods receipt matched to PO quantity on inward',
    process: 'P2P', subProcess: 'Goods Receipt', nature: 'Automated', type: 'Detective', frequency: 'Weekly',
    isKey: false, precision: 'GRN qty cannot exceed open PO qty.',
    owner: 'Anita Rao', riskId: 'RSK-GR-07', riskDescription: 'Goods received beyond ordered quantity',
    assertions: ['Accuracy'], workflowId: 'wf-grn', workflowName: 'GRN-PO Quantity Match',
    stage: 'toe', conclusion: 'In progress',
    attributes: [
      attr({ code: 'P2P-C-07.1', description: 'GRN qty does not exceed open PO qty', assertion: 'Accuracy', precision: 'Hard block at receipt', tod: tod('Pass', '', AUDITOR, '2 days ago'), toe: toe('Not tested', { procedures: INSPECT_REPERFORM, workflowRunRef: 'run-grn-0419' }) }),
    ],
  },
  // 8 · Evidence received → TOD next (manual, auditor court)
  {
    id: 'R2R-C-01', description: 'Manual journal entries approved before posting to GL',
    process: 'R2R', subProcess: 'Journal Entries', nature: 'Manual', type: 'Preventive', frequency: 'Monthly',
    isKey: true, precision: 'Every manual JE has an approver distinct from preparer.',
    owner: 'Sneha Joshi', riskId: 'RSK-JE-01', riskDescription: 'Unauthorised manual journal posted',
    assertions: ['Existence / Occurrence', 'Accuracy'],
    stage: 'evidence-received', conclusion: 'Not started',
    population: { source: 'Manual JE listing FY26', count: 880, tieOut: 'Agreed to GL JE count', evidence: [evi('je-listing-fy26.xlsx', 'XLSX', 'Sneha Joshi', '1 day ago')] },
    attributes: [
      attr({ code: 'R2R-C-01.1', description: 'Approver distinct from preparer on every manual JE', assertion: 'Existence / Occurrence', precision: 'Maker-checker enforced', tod: tod('Not tested'), toe: toe('Not tested', { procedures: INSPECT_REPERFORM }) }),
      attr({ code: 'R2R-C-01.2', description: 'Supporting documentation attached for JEs > ₹10L', assertion: 'Accuracy', precision: '₹10L threshold', tod: tod('Not tested'), toe: toe('Not tested', { procedures: ['Inspection'] }) }),
    ],
  },
];

const DEFICIENCIES: Deficiency[] = [
  {
    id: 'DEF-001', controlId: 'P2P-C-04', attributeId: 'P2P-C-04.1', kind: 'operating',
    description: 'Duplicate-invoice block disabled for 9 days; 6 duplicate payments (₹18.4L) cleared AP.',
    rootCause: 'May patch reset the SAP duplicate-check flag (LFB1); config-drift not monitored.',
    likelihood: 'Reasonably possible', magnitude: 1_840_000, mwIndicators: [],
    aggregationGroup: 'Accounts Payable',
    remediation: { action: 'Re-enable block, add config-drift alert, recover ₹18.4L.', date: '30 Jun 2026', owner: 'Anita Rao', status: 'In progress', result: 'Not tested' },
  },
  {
    id: 'DEF-002', controlId: 'P2P-C-05', attributeId: 'P2P-C-05.1', kind: 'design',
    description: 'SoD design gap — 2 users hold both PO-create and PO-approve roles.',
    rootCause: 'Role matrix not updated after a procurement reorg.',
    likelihood: 'Reasonably possible', magnitude: 600_000, mwIndicators: [],
    aggregationGroup: 'Purchase Orders',
    remediation: { action: 'Remove conflicting access (TICKET-4471), refresh role matrix.', date: '20 Jun 2026', owner: 'Rohit Sharma', status: 'Open', result: 'Not tested' },
  },
];

const TASKS: HandoffTask[] = [
  { id: 'T-01', type: 'pbc', controlId: 'P2P-C-06', title: 'Upload payment register (> ₹10L) Apr–Jun', detail: 'Population of high-value payments for sampling.', assignee: 'Anita Rao', assigneeRole: 'risk-owner', raisedBy: AUDITOR, dueLabel: 'Due in 2 days', overdue: false, status: 'open', thread: [{ by: AUDITOR, at: 'today', text: 'Please share the full population so we can sample.' }] },
  { id: 'T-02', type: 'pbc', controlId: 'P2P-C-03', title: 'Confirm AP register completeness tie-out', detail: 'Provide the GL reconciliation for the AP population.', assignee: 'Anita Rao', assigneeRole: 'risk-owner', raisedBy: AUDITOR, dueLabel: 'Due in 1 day', overdue: false, status: 'open', thread: [] },
  { id: 'T-03', type: 'remediation', controlId: 'P2P-C-04', title: 'Remediate duplicate-invoice control', detail: 'Re-enable block + recover ₹18.4L by the management action date.', assignee: 'Anita Rao', assigneeRole: 'risk-owner', raisedBy: AUDITOR, dueLabel: 'Due 30 Jun', overdue: false, status: 'open', thread: [{ by: AUDITOR, at: '2 days ago', text: 'Raised as a significant deficiency — please remediate and we will re-test.' }] },
  { id: 'T-04', type: 'review-note', controlId: 'P2P-C-02', title: 'Reviewer: confirm emergency-PO rationale documented', detail: 'Evidence the CFO email approvals are attached to the working paper.', assignee: AUDITOR, assigneeRole: 'auditor', raisedBy: REVIEWER, dueLabel: 'Open', overdue: false, status: 'open', thread: [{ by: REVIEWER, at: '1 day ago', text: 'Looks good — just attach the CFO emails before I sign off.' }] },
];

export const ICFR_ENGAGEMENT: IcfrEngagement = {
  id: 'icfr-eng-1', code: 'ENG-001', name: 'P2P — ICFR / SOX', entity: 'Air India Express Ltd',
  framework: 'SOX 404 / ICFR', periodStart: 'Apr 2025', periodEnd: 'Mar 2026', period: 'Interim',
  materiality: 5_000_000, performanceMateriality: 3_750_000, preparer: AUDITOR, reviewer: REVIEWER,
  accounts: [
    { id: 'ac-ap', name: 'Accounts Payable', balance: 184_000_000, inScope: true, assertions: ['Completeness', 'Accuracy', 'Existence / Occurrence'] },
    { id: 'ac-exp', name: 'Operating Expenses', balance: 920_000_000, inScope: true, assertions: ['Completeness', 'Cut-off', 'Accuracy'] },
    { id: 'ac-inv', name: 'Inventory', balance: 240_000_000, inScope: true, assertions: ['Existence / Occurrence', 'Valuation'] },
    { id: 'ac-cash', name: 'Cash & Bank', balance: 410_000_000, inScope: false, assertions: ['Existence / Occurrence'] },
  ],
  controls: CONTROLS,
  deficiencies: DEFICIENCIES,
  tasks: TASKS,
};

export function seedIcfrEngagement(): IcfrEngagement {
  return JSON.parse(JSON.stringify(ICFR_ENGAGEMENT)) as IcfrEngagement;
}

/** Fresh, untested controls for a process — the RACM template the setup wizard imports. */
export function racmTemplate(process: string): Control[] {
  return ICFR_ENGAGEMENT.controls.filter(c => c.process === process).map(c => ({
    ...c,
    stage: 'not-started', conclusion: 'Not started', benchmarked: false,
    population: undefined, sampling: undefined,
    attributes: c.attributes.map(a => attr({ code: a.code, description: a.description, assertion: a.assertion, precision: a.precision, tod: tod('Not tested'), toe: toe('Not tested', { procedures: a.toe.procedures }) })),
  }));
}

export const TEMPLATE_ACCOUNTS = ICFR_ENGAGEMENT.accounts;
