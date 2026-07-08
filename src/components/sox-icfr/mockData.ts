import { validationQA } from './helpers';
import type {
  Assertion, Attestation, Control, DesignDoc, DesignPoint, DesignTrack, Deficiency, Discussion, DocStatus,
  EvidenceFile, ExecKind, ExecutionEvent, HandoffTask, IcfrEngagement, Nature, OperatingStep, OperatingTrack,
  RacmReview, Role, Sampling, SignificantAccount, TestProcedure, TestResult, TrackConclusion,
} from './types';

// ── builders ─────────────────────────────────────────────────────────────────────
let _d = 0;
const doc = (kind: DesignDoc['kind'], name: string, status: DocStatus, by?: string): DesignDoc =>
  ({ id: `dd${++_d}`, kind, name, status, uploadedBy: status === 'Received' ? (by ?? 'Risk Owner') : undefined, at: status === 'Received' ? '12 Apr' : undefined });

let _p = 0;
const point = (text: string, result: DesignPoint['result'] = 'Pass', wfName = 'Design walkthrough check'): DesignPoint =>
  ({ id: `dp${++_p}`, text, result, workflowId: `wf-tod-${_p}`, workflowName: wfName, workflowRunRef: result !== 'Not tested' ? 'run · validated' : undefined, validation: result !== 'Not tested' ? { qa: validationQA(text, result === 'Fail'), at: '14 Apr' } : undefined });

let _s = 0;
const step = (code: string, description: string, assertion: Assertion, precision: string, procedures: TestProcedure[], result: OperatingStep['result'] = 'Not tested', extra: Partial<OperatingStep> = {}): OperatingStep =>
  ({ id: `os${++_s}`, code, description, assertion, precision, procedures, result, ...extra });

let _f = 0;
const file = (name: string, by = 'Risk Owner', kind: EvidenceFile['kind'] = 'PDF'): EvidenceFile => ({ id: `f${++_f}`, name, kind, uploadedBy: by, uploadedAt: '12 Apr' });
const wf = (id: string, name: string, runRef?: string): Partial<OperatingStep> => ({ workflowId: id, workflowName: name, workflowRunRef: runRef });
const attest = (note: string, by: string, files: string[]): Partial<OperatingStep> => ({ attestEnabled: true, attestation: { result: 'Pass', note, by, role: 'risk-owner', at: '12 Apr', evidence: files.map(f => file(f, by)) } as Attestation });

const designTrack = (conclusion: TrackConclusion, documents: DesignDoc[], points: DesignPoint[], testedBy: string | null = null): DesignTrack =>
  ({ documents, points, conclusion, testedBy: conclusion !== 'Not tested' ? (testedBy ?? 'A. Mehta · Auditor') : null, testedAt: conclusion !== 'Not tested' ? '14 Apr' : null });

const manualTrack = (conclusion: TrackConclusion, steps: OperatingStep[], sampling?: Sampling, popCount = 0, popSource = 'SAP — full-period extract', popFile = 'population_full_period.xlsx'): OperatingTrack => ({
  method: 'Manual',
  population: popCount ? { source: popSource, count: popCount, tieOut: 'Agreed to GL control account', evidence: [{ id: 'ev1', name: popFile, kind: 'XLSX', uploadedBy: 'Risk Owner', uploadedAt: '12 Apr' }] } : undefined,
  sampling,
  steps,
  conclusion,
  testedBy: conclusion !== 'Not tested' ? 'A. Mehta · Auditor' : null,
  testedAt: conclusion !== 'Not tested' ? '16 Apr' : null,
});

const autoTrack = (conclusion: TrackConclusion, steps: OperatingStep[]): OperatingTrack => ({
  method: 'Automated', steps, conclusion,
  testedBy: conclusion !== 'Not tested' ? 'CCM workflows' : null,
  testedAt: conclusion !== 'Not tested' ? '16 Apr' : null,
});

const sampling = (size: number, basis: string, method: Sampling['method'], fails = 0, refs?: string[]): Sampling => ({
  basis, method, size,
  samples: Array.from({ length: size }, (_, i) => ({ id: `sm${i}`, ref: refs?.[i % (refs.length || 1)] ?? `#${1000 + i}`, result: i < fails ? 'Fail' : 'Pass' })),
});

// ── real procurement seed — the vendor & document population behind P2P testing ──
export interface ProcurementVendor { code: string; name: string; category: string; }
export const PROCUREMENT_VENDORS: ProcurementVendor[] = [
  { code: 'V-100214', name: 'Indian Oil Skytanking', category: 'Aviation fuel — into-plane' },
  { code: 'V-100377', name: 'Shell MRPL Aviation Fuels', category: 'Aviation fuel' },
  { code: 'V-100482', name: 'CFM International', category: 'Engine spares (LEAP-1B)' },
  { code: 'V-100518', name: 'Boeing Distribution Services', category: 'Airframe spares & consumables' },
  { code: 'V-100629', name: 'Lufthansa Technik', category: 'Component MRO' },
  { code: 'V-100655', name: 'Skyport Ground Services', category: 'Ground handling' },
  { code: 'V-100701', name: 'TajSATS Air Catering', category: 'Inflight catering' },
  { code: 'V-100746', name: 'Menzies Aviation', category: 'Ground handling — international' },
  { code: 'V-100802', name: 'Amadeus IT Group', category: 'PSS / distribution' },
  { code: 'V-100815', name: 'Collins Aerospace', category: 'Avionics spares' },
  { code: 'V-100863', name: 'Dnata Catering', category: 'Inflight catering — international' },
  { code: 'V-100907', name: 'Jeppesen (Boeing)', category: 'Nav charts & flight planning' },
];

export interface ProcurementPO { po: string; vendor: ProcurementVendor; date: string; amountINR: number; grn: string; invoice: string; }
/** FY26 PO population extract — deterministic so the demo reads the same every run. */
export const PROCUREMENT_POS: ProcurementPO[] = Array.from({ length: 25 }, (_, i) => {
  const vendor = PROCUREMENT_VENDORS[i % PROCUREMENT_VENDORS.length]!;
  return {
    po: `45000${12840 + i * 7}`,
    vendor,
    date: `${String(((i * 3) % 28) + 1).padStart(2, '0')} ${i < 13 ? 'Apr' : 'May'} 2025`,
    amountINR: (((i * 137) % 60) + 8) * 100_000,
    grn: `50002${3110 + i * 3}`,
    invoice: `${vendor.code.replace('V-', 'INV/')}/${2600 + i}`,
  };
});
const PO_SAMPLE_REFS = PROCUREMENT_POS.map(p => `PO ${p.po} · ${p.vendor.name}`);

/** Realistic sample references per process — real POs for P2P, ledger refs elsewhere. */
export function sampleRefs(process: string, n: number): string[] {
  if (process === 'Procure to Pay') return Array.from({ length: n }, (_, i) => PO_SAMPLE_REFS[i % PO_SAMPLE_REFS.length]!);
  return Array.from({ length: n }, (_, i) => `#${1000 + i}`);
}

// ── required datasets per process — compiled + deduped by the bulk-test flow ─────
export interface RequiredDataset { name: string; format: 'CSV' | 'XLSX' | 'PDF'; description: string; }
export const PROCESS_DATASETS: Record<string, RequiredDataset[]> = {
  'Procure to Pay': [
    { name: 'PO release log (ME2N)', format: 'CSV', description: 'FY26 purchase orders with approver, DoA tier and release timestamps.' },
    { name: 'Invoice register (MIRO)', format: 'CSV', description: 'Posted vendor invoices — number, vendor, amount, GL account, entered-by.' },
    { name: 'Vendor master snapshot', format: 'XLSX', description: 'Active vendors with bank details and the immutable change log.' },
    { name: 'GRN register (MIGO)', format: 'CSV', description: 'Goods receipts with dates and quantities for the three-way match.' },
  ],
  'Order to Cash': [
    { name: 'Sales invoice register (VF05)', format: 'CSV', description: 'Billed invoices with price, customer and dispatch reference.' },
    { name: 'Approved price master', format: 'XLSX', description: 'Current price list with effective dates and approval trail.' },
    { name: 'AR ageing extract', format: 'CSV', description: 'Open receivables aged by bucket with provision flags.' },
  ],
  'Record to Report': [
    { name: 'GL trial balance', format: 'CSV', description: 'Period-end trial balance tying postings to FS line items.' },
    { name: 'Manual journal register (FB50)', format: 'CSV', description: 'Manual journals with preparer, approver and posting timestamps.' },
    { name: 'Reconciliation tracker', format: 'XLSX', description: 'Balance-sheet reconciliations with reviewer sign-off status.' },
  ],
  'Inventory': [
    { name: 'Stock ledger extract (MB52)', format: 'CSV', description: 'Quantities and values by material and plant at period end.' },
    { name: 'Cycle count results', format: 'XLSX', description: 'Count sheets with variances and investigation notes.' },
  ],
  'Treasury': [
    { name: 'Payment run log (F110)', format: 'CSV', description: 'Payment proposals and releases with both authoriser IDs.' },
    { name: 'Bank statements (MT940)', format: 'CSV', description: 'Full-period bank statements for reconciliation tie-out.' },
  ],
  'Payroll': [
    { name: 'Payroll register', format: 'XLSX', description: 'Gross-to-net by employee with cost-centre mapping.' },
    { name: 'Joiner / leaver report', format: 'CSV', description: 'HR movements with effective dates and approvals.' },
  ],
  'Tax': [
    { name: 'GST returns workpapers', format: 'XLSX', description: 'GSTR filings reconciled to the revenue and ITC ledgers.' },
    { name: 'TDS deduction register', format: 'CSV', description: 'Section-wise TDS with challan references and remittance dates.' },
  ],
  'IT General Controls': [
    { name: 'User access dump (SUIM)', format: 'CSV', description: 'Users, roles and privileged flags across in-scope systems.' },
    { name: 'Change tickets export', format: 'CSV', description: 'Transports with test evidence and approver per change.' },
    { name: 'Batch job run log', format: 'CSV', description: 'Scheduled job outcomes with failure resolution notes.' },
  ],
};

/** Which datasets a control needs for bulk testing — deterministic, deduped across
 *  a selection by dataset name. Attestation-only manual controls need no files. */
export function requiredDatasetsFor(c: Control): RequiredDataset[] {
  const needsData = c.nature !== 'Manual'
    || c.operating.steps.some(s => s.evidenceMode === 'workflow' || s.evidenceMode === 'ai' || !!s.workflowName || !!s.aiValidation);
  if (!needsData) return [];
  const cat = PROCESS_DATASETS[c.process] ?? PROCESS_DATASETS['Record to Report']!;
  let h = 0; for (let i = 0; i < c.id.length; i++) h = (h * 31 + c.id.charCodeAt(i)) >>> 0;
  const first = cat[h % cat.length]!;
  const second = cat[(h >>> 3) % cat.length]!;
  return first.name === second.name ? [first] : [first, second];
}

// ── RACM row review seeds — the audit manager's approval / remark per row ────────
const REVIEWER = 'J. Fernandes · Audit Manager';
const approved = (at = '15 Apr'): RacmReview => ({ status: 'Approved', by: REVIEWER, at });
const remark = (text: string, at = '15 Apr'): RacmReview => ({ status: 'Remark', remark: text, by: REVIEWER, at });

// ── the richly-detailed P2P controls (drive the dossier) ─────────────────────────
const DETAILED: Control[] = [
  {
    id: 'P2P-C-01', wpRef: 'P-01', description: 'Vendor master additions and bank-detail changes require dual approval before activation.',
    process: 'Procure to Pay', subProcess: 'Vendor master', nature: 'Automated', type: 'Preventive', frequency: 'Recurring', isKey: true,
    precision: 'Any change to a vendor bank account is blocked until a second authoriser approves in SAP.',
    owner: 'R. Khanna · Master Data', riskId: 'R-12', riskDescription: 'Fraudulent or erroneous payments to fictitious or altered vendor bank accounts.',
    assertions: ['Existence / Occurrence', 'Rights & Obligations'],
    racmReview: approved(),
    design: designTrack('Effective', [
      doc('Process narrative', 'P2P vendor-master narrative v3.pdf', 'Received'),
      doc('Flowchart', 'Vendor onboarding flowchart.pdf', 'Received'),
      doc('Walkthrough', 'Walkthrough — 11 Apr (R. Khanna).pdf', 'Received'),
      doc('Control description', 'SAP config — dual control MM.pdf', 'Received'),
    ], [
      point('Second-authoriser role is segregated from the requester in SAP roles.'),
      point('Block cannot be bypassed by the requester (tested in config).'),
      point('Change log is retained and immutable.'),
    ]),
    operating: autoTrack('Effective', [
      step('A1', 'Bank-detail change is blocked until a distinct second user approves.', 'Existence / Occurrence', 'Per change', ['Reperformance', 'Inspection'], 'Pass', wf('wf-vendor-block', 'Vendor bank-change block', 'run #4821 · 312/312 changes')),
      step('A2', 'Approver identity differs from requester on every change in period.', 'Rights & Obligations', 'Per change', ['Reperformance'], 'Pass', wf('wf-vendor-segregation', 'Approver-segregation check', 'run #4821 · 0 conflicts')),
    ]),
  },
  {
    id: 'P2P-C-02', wpRef: 'P-02', description: 'Purchase orders are approved per the delegation-of-authority matrix before release.',
    process: 'Procure to Pay', subProcess: 'Purchasing', nature: 'Manual', type: 'Preventive', frequency: 'Daily', isKey: true,
    precision: 'POs above ₹5L route to the next authority tier; release is blocked without approval at the correct tier.',
    owner: 'S. Iyer · Procurement', riskId: 'R-08', riskDescription: 'Unauthorised commitments / purchases outside delegated authority.',
    assertions: ['Existence / Occurrence', 'Accuracy'],
    racmReview: approved(),
    design: designTrack('Effective', [
      doc('Process narrative', 'Purchasing narrative v2.pdf', 'Received'),
      doc('Flowchart', 'PO approval flowchart.pdf', 'Received'),
      doc('Walkthrough', 'Walkthrough — 10 Apr.pdf', 'Received'),
      doc('Policy / SOP', 'Delegation-of-authority matrix FY26.xlsx', 'Received'),
    ], [
      point('DoA tiers map to current org and signing limits.'),
      point('System enforces tier by PO value (not advisory).'),
    ]),
    operating: manualTrack('Not tested', [
      step('B1', 'PO approved at the tier matching its value per the DoA matrix.', 'Existence / Occurrence', 'Per PO', ['Inspection', 'Reperformance'], 'Pass', attest('Approval screenshots for all 25 sampled POs attached; each shows the correct tier per the DoA matrix.', 'S. Iyer · Procurement', ['PO_approval_screens_25_samples_Apr26.pdf', 'DoA_matrix_FY26_v2_signed.xlsx'])),
      step('B2', 'Approver held the delegated authority on the approval date.', 'Existence / Occurrence', 'Per PO', ['Inspection'], 'Pass', attest('Delegation register extract confirms authority held on each approval date.', 'S. Iyer · Procurement', ['Delegation_register_extract_01-30Apr26.pdf'])),
      step('B3', 'No release before approval timestamp.', 'Accuracy', 'Per PO', ['Reperformance'], 'Not tested', { ...wf('wf-po-release-timing', 'PO release-timing check', undefined), evidenceMode: 'ai', aiValidation: true, inputFile: file('ME2N_release_timing_extract_Apr26.csv', 'S. Iyer · Procurement', 'CSV') }),
    ], sampling(25, '25 POs — daily manual control, moderate reliance (handbook — no fixed minimum, judgment documented).', 'Random', 0, PO_SAMPLE_REFS), 2640, 'SAP ECC — ME2N PO release log, FY26 YTD (POs 4500012840–4500013008)', 'ME2N_PO_release_log_FY26_YTD.xlsx'),
  },
  {
    id: 'P2P-C-03', wpRef: 'P-03', description: 'Invoices are matched three-way (PO, GRN, invoice) before payment; exceptions route to buyer.',
    process: 'Procure to Pay', subProcess: 'Invoice processing', nature: 'IT-dependent', type: 'Detective', frequency: 'Daily', isKey: true,
    precision: 'Quantity/price tolerance breaches are held and cannot pay until cleared by the buyer.',
    owner: 'M. Nair · Accounts Payable', riskId: 'R-05', riskDescription: 'Payment for goods not received or at incorrect price.',
    assertions: ['Accuracy', 'Existence / Occurrence'],
    racmReview: remark('Tolerance configuration evidence is still outstanding — approve this row once the MM config export is on file.'),
    design: designTrack('Effective', [
      doc('Process narrative', 'AP three-way match narrative.pdf', 'Received'),
      doc('Flowchart', '3-way match flowchart.pdf', 'Received'),
      doc('Walkthrough', 'Walkthrough — 09 Apr.pdf', 'Received'),
      doc('Control description', 'Tolerance config — MM.pdf', 'Requested'),
    ], [
      point('Tolerances are set centrally and changes are controlled (GITC reliance).'),
      point('Held items cannot be released to pay without buyer clearance.', 'Not tested'),
    ]),
    operating: manualTrack('Not tested', [
      step('C1', 'Quantity and price agree to PO and GRN within tolerance.', 'Accuracy', 'Per invoice', ['Reperformance', 'Inspection'], 'Not tested', { evidenceMode: 'ai', aiValidation: true, inputFile: file('MIRO_invoice_register_01-30Apr26.csv', 'M. Nair · Accounts Payable', 'CSV') }),
      step('C2', 'Tolerance breaches are held and cleared with evidence.', 'Existence / Occurrence', 'Per exception', ['Inspection'], 'Not tested', { evidenceMode: 'ai', aiValidation: true, inputFile: file('Tolerance_breach_hold_report_Apr26.xlsx', 'M. Nair · Accounts Payable', 'XLSX') }),
    ], undefined, 0),
  },
  {
    id: 'P2P-C-04', wpRef: 'P-04', description: 'Duplicate-invoice block prevents posting of invoices matching an existing reference.',
    process: 'Procure to Pay', subProcess: 'Invoice processing', nature: 'Automated', type: 'Preventive', frequency: 'Recurring', isKey: true,
    precision: 'SAP blocks postings where vendor + invoice number + amount match an existing document.',
    owner: 'M. Nair · Accounts Payable', riskId: 'R-06', riskDescription: 'Duplicate payments to vendors.',
    assertions: ['Existence / Occurrence', 'Accuracy'],
    racmReview: approved(),
    design: designTrack('Effective', [
      doc('Process narrative', 'Duplicate-block narrative.pdf', 'Received'),
      doc('Control description', 'SAP duplicate-check config.pdf', 'Received'),
      doc('Walkthrough', 'Walkthrough — 09 Apr.pdf', 'Received'),
    ], [
      point('Match key includes vendor, reference and amount.'),
      point('Check is active across all company codes in scope.'),
    ]),
    operating: autoTrack('Ineffective', [
      step('D1', 'Exact-match duplicate postings are blocked.', 'Existence / Occurrence', 'Per posting', ['Reperformance'], 'Pass', wf('wf-dup-exact', 'Exact-match duplicate block', 'run #4822 · 0 exact duplicates')),
      step('D2', 'Near-duplicates (trailing-space / leading-zero reference variants) are blocked.', 'Existence / Occurrence', 'Per posting', ['Reperformance', 'Inspection'], 'Fail', wf('wf-dup-variant', 'Reference-variant duplicate block', 'run #4822 · 4 variant duplicates posted')),
    ]),
  },
  {
    id: 'P2P-C-05', wpRef: 'P-05', description: 'Manual journals to AP control account are reviewed and approved by the Financial Controller.',
    process: 'Procure to Pay', subProcess: 'Period close', nature: 'Manual', type: 'Detective', frequency: 'Monthly', isKey: true,
    precision: 'All manual AP journals are reviewed before posting; review evidenced by sign-off.',
    owner: 'D. Rao · Controller', riskId: 'R-19', riskDescription: 'Unauthorised or erroneous manual adjustments to AP.',
    assertions: ['Accuracy', 'Completeness'],
    racmReview: remark('Design gap stands — the review happens after posting. Redesign the control to a pre-posting hold before this row is approved (see DEF-002).'),
    design: designTrack('Ineffective', [
      doc('Process narrative', 'Manual-journal narrative.pdf', 'Received'),
      doc('Walkthrough', 'Walkthrough — 12 Apr.pdf', 'Received'),
      doc('Control description', 'Review checklist.pdf', 'Missing'),
    ], [
      point('Review occurs before posting, not after.', 'Fail'),
      point('Reviewer is independent of the preparer.'),
      point('Review covers completeness of the journal population.', 'Fail'),
    ]),
    operating: manualTrack('Not tested', [
      step('E1', 'Journal reviewed and signed before posting date.', 'Accuracy', 'Per journal', ['Inspection'], 'Not tested', { evidenceMode: 'ai', aiValidation: true, inputFile: file('FB50_manual_journal_register_Apr26.csv', 'D. Rao · Controller', 'CSV') }),
      step('E2', 'Population of manual journals is complete.', 'Completeness', 'Per period', ['Reperformance', 'Inspection']),
    ], undefined, 0),
  },
  {
    id: 'P2P-C-06', wpRef: 'P-06', description: 'Goods-receipt cut-off: receipts at period-end are recorded in the correct period.',
    process: 'Procure to Pay', subProcess: 'Period close', nature: 'Manual', type: 'Detective', frequency: 'Monthly', isKey: false,
    precision: 'Receipts in the last/first 5 days are checked to GRN dates for correct-period recording.',
    owner: 'M. Nair · Accounts Payable', riskId: 'R-21', riskDescription: 'Goods/liabilities recorded in the wrong period (cut-off).',
    assertions: ['Cut-off', 'Completeness'],
    design: designTrack('Not tested', [
      doc('Process narrative', 'Cut-off narrative.pdf', 'Requested'),
      doc('Flowchart', 'GR cut-off flowchart.pdf', 'Missing'),
      doc('Walkthrough', 'Walkthrough — to schedule', 'Missing'),
    ], [
      point('Cut-off window is defined and applied consistently.', 'Not tested'),
    ]),
    operating: manualTrack('Not tested', [
      step('F1', 'Receipts near period-end recorded in correct period per GRN.', 'Cut-off', 'Per item', ['Inspection', 'Reperformance']),
    ], undefined, 0),
  },
  {
    id: 'P2P-C-07', wpRef: 'P-07', description: 'Aged GR/IR items are reviewed and cleared each month.',
    process: 'Procure to Pay', subProcess: 'Period close', nature: 'Manual', type: 'Detective', frequency: 'Monthly', isKey: false,
    precision: 'GR/IR entries open beyond 60 days are investigated and resolved.',
    owner: 'M. Nair · Accounts Payable', riskId: 'R-24', riskDescription: 'Unreconciled goods-received/invoice-received balances misstate liabilities.',
    assertions: ['Completeness', 'Accuracy'],
    racmReview: remark('Row is incomplete — no design documents or test attributes defined yet. Complete the RACM row, then resubmit for approval.'),
    design: designTrack('Not tested', [], []),
    operating: manualTrack('Not tested', [], undefined, 0),
  },
];

// ── generator — fills the register to scale ──────────────────────────────────────
type Spread = { process: string; prefix: string; wp: string; subs: string[]; titles: string[]; owner: string };
const SPREADS: Spread[] = [
  { process: 'Order to Cash', prefix: 'O2C', wp: 'O', owner: 'P. Sharma · Revenue', subs: ['Credit', 'Billing', 'Collections', 'Revenue recognition'], titles: [
    'Credit limits are approved before order release', 'Sales invoices priced from the approved price master', 'Revenue cut-off at period-end agrees to dispatch', 'Credit notes are approved before issue', 'Customer master changes are independently reviewed', 'AR ageing reviewed and provisioned monthly', 'Manual revenue journals are reviewed before posting', 'Cash receipts applied to correct customer accounts', 'Disputed receivables escalated per policy', 'Rebates accrued per contract terms' ] },
  { process: 'Record to Report', prefix: 'R2R', wp: 'R', owner: 'D. Rao · Controller', subs: ['Journals', 'Reconciliations', 'Close', 'Consolidation'], titles: [
    'Balance-sheet reconciliations reviewed monthly', 'Manual journals approved before posting', 'Intercompany balances agreed and eliminated', 'FX revaluation reviewed at month-end', 'Close checklist completed and signed', 'Consolidation entries reviewed', 'Accruals supported and approved', 'Suspense accounts cleared within policy', 'Trial balance mapped to FS line items', 'Management review of flux analysis' ] },
  { process: 'Inventory', prefix: 'INV', wp: 'I', owner: 'K. Bose · Supply Chain', subs: ['Costing', 'Counts', 'Provisions'], titles: [
    'Standard costs reviewed and approved', 'Cycle counts performed and variances investigated', 'Slow-moving provision calculated and reviewed', 'Inventory movements restricted to authorised users', 'Net realisable value assessed at period-end', 'GRN matched to physical receipt' ] },
  { process: 'Treasury', prefix: 'TRY', wp: 'T', owner: 'A. Verma · Treasury', subs: ['Payments', 'Banking', 'Investments'], titles: [
    'Payment runs approved by two authorisers', 'Bank reconciliations reviewed monthly', 'New payee setup independently verified', 'Borrowing within board-approved limits', 'FX deals confirmed independently of dealing' ] },
  { process: 'Payroll', prefix: 'PAY', wp: 'Y', owner: 'N. Pillai · HR', subs: ['Masterdata', 'Processing'], titles: [
    'Joiner/leaver changes approved before payroll run', 'Payroll reconciled to GL each cycle', 'Overtime approved before payment', 'Statutory deductions reconciled and remitted' ] },
  { process: 'Tax', prefix: 'TAX', wp: 'X', owner: 'S. Gupta · Tax', subs: ['Direct', 'Indirect'], titles: [
    'GST returns reviewed before filing', 'Tax provision reviewed by tax lead', 'TDS reconciled to GL and remitted' ] },
  { process: 'IT General Controls', prefix: 'ITGC', wp: 'G', owner: 'V. Menon · IT', subs: ['Access', 'Change', 'Operations'], titles: [
    'Privileged access reviewed quarterly', 'User access granted via approved request', 'Terminated users disabled within 24h', 'Program changes tested and approved before deploy', 'Emergency changes reviewed post-implementation', 'Batch job failures monitored and resolved', 'Database backups completed and tested', 'Segregation-of-duties conflicts reviewed' ] },
];

const NATURES: Nature[] = ['Manual', 'Automated', 'IT-dependent'];
const STATIONS = ['BOM', 'DEL', 'COK', 'BLR'];
// two cycles so the register carries ~100 controls — second cycle is station-level
const BATCHES = [{ off: 0, tag: '' }, { off: 3, tag: ' · station' }];
function generate(): Control[] {
  const out: Control[] = [];
  let n = 1;
  for (const b of BATCHES) for (const sp of SPREADS) {
    sp.titles.forEach((title, i) => {
      const idx = i + (b.tag ? sp.titles.length : 0);
      const station = STATIONS[n % STATIONS.length];
      const desc = b.tag ? `${title} — ${station}` : title;
      const pat = (n + b.off) % 7;
      const lower = title.toLowerCase();
      const nature: Nature = lower.includes('reconcil') || lower.includes('review') || lower.includes('approved') ? 'Manual'
        : (i % 3 === 1 ? 'Automated' : NATURES[i % 3]);
      // independent design / operating conclusions
      const design: TrackConclusion = pat === 4 || pat === 5 ? 'Not tested' : 'Effective';
      const operating: TrackConclusion = pat <= 1 || pat === 6 ? 'Effective' : 'Not tested';
      const designConcluded = design === 'Effective';
      const docs: DesignDoc[] = [
        doc('Process narrative', `${sp.prefix} narrative.pdf`, designConcluded ? 'Received' : pat === 5 ? 'Received' : 'Requested'),
        doc('Flowchart', `${sp.prefix} flowchart.pdf`, designConcluded ? 'Received' : 'Requested'),
        doc('Walkthrough', `Walkthrough — ${sp.process}.pdf`, designConcluded ? 'Received' : pat === 5 ? 'Requested' : 'Missing'),
      ];
      const points: DesignPoint[] = [point('Control addresses the stated risk and assertion.', designConcluded ? 'Pass' : 'Not tested'), point('Control operates at sufficient precision.', designConcluded ? 'Pass' : 'Not tested')];
      const evidenced = operating === 'Effective';
      const stepExtra = (k: number): Partial<OperatingStep> => nature === 'Automated'
        ? wf(`wf-${sp.prefix.toLowerCase()}-${idx}-${k}`, `${title} — check ${k}`, evidenced ? `run #${5000 + n}` : undefined)
        : evidenced ? attest(`Evidence for attribute ${k} of "${title.toLowerCase()}" attached and reviewed.`, sp.owner, [`${sp.prefix}-attr${k}.pdf`]) : {};
      const opSteps: OperatingStep[] = [
        step(`${n}.1`, `${title} — primary attribute tested.`, 'Accuracy', nature === 'Automated' ? 'Per transaction' : 'Per item', nature === 'Automated' ? ['Reperformance'] : ['Inspection', 'Reperformance'], evidenced ? 'Pass' : 'Not tested', stepExtra(1)),
        step(`${n}.2`, `${title} — exceptions handled per policy.`, 'Existence / Occurrence', 'Per exception', ['Inspection'], evidenced ? 'Pass' : 'Not tested', stepExtra(2)),
      ];
      const op = nature === 'Automated'
        ? autoTrack(operating, opSteps)
        : manualTrack(operating, opSteps, evidenced ? sampling(25, 'Standard sample — moderate reliance.', 'Random') : undefined, evidenced ? 2000 + n * 7 : 0);
      out.push({
        id: `${sp.prefix}-C-${String(idx + 1).padStart(2, '0')}`, wpRef: `${sp.wp}-${String(idx + 1).padStart(2, '0')}`,
        description: desc + '.', process: sp.process, subProcess: sp.subs[i % sp.subs.length],
        nature, type: i % 3 === 0 ? 'Detective' : 'Preventive', frequency: nature === 'Automated' ? 'Recurring' : (['Daily', 'Monthly', 'Quarterly'] as const)[i % 3],
        isKey: i % 4 !== 0, precision: `${title} — operates to prevent or detect the risk at transaction level.`,
        owner: sp.owner, riskId: `R-${40 + n}`, riskDescription: `Risk addressed by: ${title.toLowerCase()}.`,
        assertions: ['Accuracy', 'Existence / Occurrence'],
        // review spread: fully-tested rows approved, one recurring remark pattern, rest pending
        racmReview: pat <= 1 ? approved('18 Apr') : pat === 3 ? remark('Precision statement is generic — state the threshold, the reviewer and the evidence retained.', '18 Apr') : undefined,
        design: designTrack(design, docs, points),
        operating: op,
      });
      n++;
    });
  }
  return out;
}

// ── discussions, tasks, deficiencies, accounts ───────────────────────────────────
const DISCUSSIONS: Discussion[] = [
  { id: 'disc-1', controlId: 'P2P-C-02', anchor: 'operating', resolved: false, comments: [
    { id: 'c1', by: 'A. Mehta · Auditor', role: 'auditor', at: '2d', text: 'Two of the 25 sampled POs were approved a tier below the DoA. Can you confirm whether a delegation was in force on those dates?' },
    { id: 'c2', by: 'S. Iyer · Procurement', role: 'risk-owner', at: '1d', text: 'There was a temporary delegation during the Director’s leave — letter attached in the PBC. The system tier wasn’t updated though.' },
    { id: 'c3', by: 'J. Fernandes · Audit Manager', role: 'auditor', at: '4h', text: 'If the system tier wasn’t updated, treat as an operating exception and assess severity even with the delegation letter.' },
  ] },
  { id: 'disc-2', controlId: 'P2P-C-04', anchor: 'operating', resolved: false, comments: [
    { id: 'c4', by: 'A. Mehta · Auditor', role: 'auditor', at: '3d', text: 'The duplicate block misses reference variants (leading zeros). 4 duplicates posted. Raising as a deficiency — see DEF-001.' },
  ] },
  { id: 'disc-3', controlId: 'P2P-C-05', anchor: 'design', resolved: false, comments: [
    { id: 'c5', by: 'A. Mehta · Auditor', role: 'auditor', at: '2d', text: 'Walkthrough shows the FC reviews after posting, not before. That’s a design gap — the control can’t prevent an erroneous posting.' },
    { id: 'c6', by: 'D. Rao · Controller', role: 'risk-owner', at: '1d', text: 'Agreed. We’re moving review to a pre-posting hold from next cycle.' },
  ] },
];

const TASKS: HandoffTask[] = [
  { id: 'PBC-3', type: 'pbc', controlId: 'P2P-C-02', title: 'Provide PO release-timing extract (attribute B3)', detail: 'TOE evidence for B3 — no release before approval timestamp. Upload ME2N_release_timing_extract_Apr26.csv from SAP.', assignee: 'S. Iyer · Procurement', assigneeRole: 'risk-owner', raisedBy: 'A. Mehta · Auditor', dueLabel: 'Due today', overdue: false, status: 'open' },
  { id: 'PBC-1', type: 'pbc', controlId: 'P2P-C-06', title: 'Provide cut-off narrative & flowchart', detail: 'Design documents needed to start TOD on goods-receipt cut-off (Cutoff_narrative_FY26.pdf, GR_cutoff_flowchart.pdf).', assignee: 'M. Nair · Accounts Payable', assigneeRole: 'risk-owner', raisedBy: 'A. Mehta · Auditor', dueLabel: 'Due today', overdue: false, status: 'open' },
  { id: 'PBC-2', type: 'pbc', controlId: 'P2P-C-03', title: 'Provide tolerance configuration export', detail: 'Control-description evidence for three-way match tolerances.', assignee: 'M. Nair · Accounts Payable', assigneeRole: 'risk-owner', raisedBy: 'A. Mehta · Auditor', dueLabel: 'Overdue 1d', overdue: true, status: 'open' },
  { id: 'REM-1', type: 'remediation', controlId: 'P2P-C-04', title: 'Extend duplicate-match key to normalise references', detail: 'Strip leading zeros / whitespace before match. Re-test after deploy.', assignee: 'M. Nair · Accounts Payable', assigneeRole: 'risk-owner', raisedBy: 'A. Mehta · Auditor', dueLabel: 'Due 30 Jun', overdue: false, status: 'open' },
];

const DEFICIENCIES: Deficiency[] = [
  { id: 'DEF-001', controlId: 'P2P-C-04', track: 'operating', description: 'Duplicate-invoice block does not catch reference variants (leading zeros / whitespace); 4 variant duplicates posted in period.', rootCause: 'Match key compares raw reference without normalisation.', likelihood: 'Reasonably possible', magnitude: 1_180_000, mwIndicators: [], compensatingControlId: undefined, aggregationGroup: 'AP payments', remediation: { action: 'Normalise reference in match key; re-test.', date: '30 Jun', owner: 'M. Nair · Accounts Payable', status: 'In progress' }, status: 'Remediation' },
  { id: 'DEF-002', controlId: 'P2P-C-05', track: 'design', description: 'Manual AP journal review occurs after posting, so the control cannot prevent an erroneous or unauthorised posting.', rootCause: 'Review step placed post-posting in the process design.', likelihood: 'Reasonably possible', magnitude: 640_000, mwIndicators: [], compensatingControlId: undefined, aggregationGroup: 'AP close', remediation: { action: 'Move review to a pre-posting hold.', date: null, owner: 'D. Rao · Controller', status: 'Open' }, status: 'Identified' },
];

const ACCOUNTS: SignificantAccount[] = [
  { id: 'a1', name: 'Accounts Payable', balance: 184_000_000, inScope: true, assertions: ['Completeness', 'Accuracy', 'Cut-off'] },
  { id: 'a2', name: 'Inventory', balance: 96_000_000, inScope: true, assertions: ['Existence / Occurrence', 'Valuation'] },
  { id: 'a3', name: 'Revenue', balance: 412_000_000, inScope: true, assertions: ['Existence / Occurrence', 'Cut-off'] },
  { id: 'a4', name: 'Cash & bank', balance: 58_000_000, inScope: true, assertions: ['Existence / Occurrence'] },
  { id: 'a5', name: 'Property, plant & equipment', balance: 240_000_000, inScope: false, assertions: ['Existence / Occurrence', 'Valuation'] },
];

// ── execution history — both personas act; each sees the other's runs ─────────────
let _e = 0;
const ex = (controlId: string, track: 'design' | 'operating', kind: ExecKind, verb: string, by: string, role: Role, at: string, target?: string, result?: TestResult | TrackConclusion): ExecutionEvent =>
  ({ id: `ex${++_e}`, controlId, track, kind, verb, target, result, by, role, at });

// Newest first — the store prepends, so the seed matches that order.
const EXECUTIONS: ExecutionEvent[] = [
  ex('P2P-C-02', 'operating', 'attest', 'self-attested', 'S. Iyer · Risk Owner', 'risk-owner', '2d', 'B1'),
  ex('P2P-C-02', 'operating', 'attest', 'self-attested', 'S. Iyer · Risk Owner', 'risk-owner', '2d', 'B2'),
  ex('P2P-C-04', 'operating', 'conclude', 'concluded operating ineffective', 'A. Mehta · Auditor', 'auditor', '3d', undefined, 'Ineffective'),
  ex('P2P-C-04', 'operating', 'validate', 'validated', 'A. Mehta · Auditor', 'auditor', '3d', 'D2', 'Fail'),
  ex('P2P-C-04', 'operating', 'validate', 'validated', 'A. Mehta · Auditor', 'auditor', '3d', 'D1', 'Pass'),
  ex('P2P-C-01', 'operating', 'conclude', 'concluded operating effective', 'A. Mehta · Auditor', 'auditor', '4d', undefined, 'Effective'),
  ex('P2P-C-01', 'operating', 'pull-run', 'pulled a workflow run', 'A. Mehta · Auditor', 'auditor', '4d', 'A1'),
  ex('P2P-C-01', 'design', 'conclude', 'concluded design effective', 'A. Mehta · Auditor', 'auditor', '5d', undefined, 'Effective'),
  ex('P2P-C-01', 'design', 'validate', 'validated 3 considerations', 'A. Mehta · Auditor', 'auditor', '5d'),
  ex('P2P-C-01', 'design', 'receive-doc', 'provided', 'R. Khanna · Risk Owner', 'risk-owner', '6d', 'Walkthrough'),
];

const ENGAGEMENT: IcfrEngagement = {
  id: 'eng-1', code: 'ICFR-26', name: 'FY26 ICFR — Airline P2P & O2C', entity: 'Airline Group Ltd', framework: 'COSO 2013 / SOX 404',
  periodStart: '01 Apr 2025', periodEnd: '31 Mar 2026', period: 'Interim',
  materiality: 5_000_000, performanceMateriality: 3_750_000, preparer: 'A. Mehta · Auditor', reviewer: 'J. Fernandes · Audit Manager',
  rules: { clearlyTrivial: 250_000, sdBandPct: 20, aggregate: true, autoRoute: true, mwIndicators: [] },
  accounts: ACCOUNTS,
  controls: [...DETAILED, ...generate()],
  deficiencies: DEFICIENCIES,
  tasks: TASKS,
  discussions: DISCUSSIONS,
  executions: EXECUTIONS,
};

/** Identity carried in from the app-level Engagement record (engagements.ts). */
export interface SeedMeta { id?: string; code?: string; name?: string; process?: string; periodStart?: string; periodEnd?: string; owner?: string; materiality?: number; performanceMateriality?: number; clearlyTrivial?: number; sdBandPct?: number; }
const PROC_LABEL: Record<string, string> = { P2P: 'Procure to Pay', O2C: 'Order to Cash', R2R: 'Record to Report', S2C: 'Order to Cash', ITGC: 'IT General Controls' };

export function seedIcfrEngagement(meta?: SeedMeta): IcfrEngagement {
  const base = structuredClone(ENGAGEMENT);
  if (meta?.materiality) base.materiality = meta.materiality;
  if (meta?.performanceMateriality) base.performanceMateriality = meta.performanceMateriality;
  if (meta?.clearlyTrivial != null) base.rules.clearlyTrivial = meta.clearlyTrivial;
  if (meta?.sdBandPct) base.rules.sdBandPct = meta.sdBandPct;
  // No meta, or the flagship engagement → the fully-populated demo, with identity overlaid.
  if (!meta || !meta.id || meta.id === 'eng-1') {
    if (meta) {
      if (meta.code) base.code = meta.code;
      if (meta.name) base.name = meta.name;
      if (meta.periodStart) base.periodStart = meta.periodStart;
      if (meta.periodEnd) base.periodEnd = meta.periodEnd;
    }
    return base;
  }
  // Any other engagement → a fresh engagement scoped to the picked process, ready to configure.
  const proc = PROC_LABEL[meta.process ?? 'O2C'] ?? 'Order to Cash';
  return {
    ...base,
    id: meta.id,
    code: meta.code ?? base.code,
    name: meta.name ?? base.name,
    period: 'Interim',
    periodStart: meta.periodStart ?? base.periodStart,
    periodEnd: meta.periodEnd ?? base.periodEnd,
    preparer: meta.owner ? `${meta.owner} · Auditor` : base.preparer,
    controls: racmTemplate(proc),
    deficiencies: [],
    tasks: [],
    discussions: [],
    executions: [],
  };
}

// ── RACM template for the setup wizard ──────────────────────────────────────────
export function racmTemplate(process: string): Control[] {
  const sp = SPREADS.find(s => s.process === process) ?? SPREADS[0];
  return sp.titles.slice(0, 5).map((title, i) => ({
    id: `${sp.prefix}-NEW-${i + 1}`, wpRef: `${sp.wp}-${String(i + 1).padStart(2, '0')}`, description: title + '.',
    process: sp.process, subProcess: sp.subs[i % sp.subs.length], nature: 'Manual' as Nature, type: 'Preventive' as const, frequency: 'Monthly' as const,
    isKey: true, precision: `${title}.`, owner: sp.owner, riskId: `R-${i + 1}`, riskDescription: `Risk addressed by: ${title.toLowerCase()}.`,
    assertions: ['Accuracy', 'Existence / Occurrence'] as Assertion[],
    design: designTrack('Not tested', [], []),
    operating: manualTrack('Not tested', [], undefined, 0),
  }));
}

export const TEMPLATE_ACCOUNTS = ACCOUNTS;
