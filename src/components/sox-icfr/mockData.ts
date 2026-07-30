import { validationQA } from './helpers';
import { ipeChecklist } from './types';
import type {
  Assertion, Attestation, Control, DesignDoc, DesignPoint, DesignTrack, Deficiency, Discussion, DocStatus,
  EvidenceFile, ExecKind, ExecutionEvent, Frequency, HandoffTask, IcfrEngagement, IpeTest, Nature, OperatingStep, OperatingTrack,
  RacmReview, ReviewNote, RiskRating, Role, RunControlOutcome, RunRecord, Sampling, SignificantAccount, TestProcedure, TestResult, TrackConclusion,
} from './types';

// ── builders ─────────────────────────────────────────────────────────────────────
let _d = 0;
// Flowchart & Policy/SOP strengthen the file but don't gate the design conclusion.
const OPTIONAL_KINDS: DesignDoc['kind'][] = ['Flowchart', 'Policy / SOP'];
const doc = (kind: DesignDoc['kind'], name: string, status: DocStatus, by?: string): DesignDoc =>
  ({ id: `dd${++_d}`, kind, name, status, required: !OPTIONAL_KINDS.includes(kind),
     files: status === 'Received' ? [{ id: `ddf${_d}`, name, kind: name.toLowerCase().endsWith('.xlsx') ? 'XLSX' : 'PDF', uploadedBy: by ?? 'Risk Owner', uploadedAt: '12 Apr' }] : undefined,
     uploadedBy: status === 'Received' ? (by ?? 'Risk Owner') : undefined, at: status === 'Received' ? '12 Apr' : undefined });

/**
 * The RACM's Control Activity narrative — WHO performs it, over WHAT records,
 * WHEN, HOW it is evidenced, and where exceptions go.
 *
 * Deliberately NOT a restatement of `description`: the header prints the control
 * statement as its heading, so an activity that paraphrased it would read as the
 * title twice over. This says how the control is actually run.
 */
const activityOf = (owner: string, subProcess: string, frequency: Frequency, nature: Nature): string => {
  const [who, team] = owner.split('·').map(s => s.trim());
  const when: Record<Frequency, string> = {
    Daily: 'each business day',
    Weekly: 'each week',
    Monthly: 'each month, before the ledger closes',
    Quarterly: 'each quarter',
    Annual: 'once a year, ahead of the year-end close',
    Recurring: 'on every transaction, as it is raised',
    'Ad-hoc': 'whenever the event arises',
  };
  const how = nature === 'Automated'
    ? 'The rule is configured in SAP S/4HANA and blocks anything that fails it; the exception log is the evidence.'
    : nature === 'IT-dependent'
      ? 'SAP S/4HANA produces the exception report and the reviewer clears each line, evidencing the outcome on the report itself.'
      : 'The review is performed against the supporting documentation and evidenced by dated sign-off.';
  return `${who}${team ? ` (${team})` : ''} performs this control over ${subProcess.toLowerCase()} records ${when[frequency]}. ${how} Anything that fails is held and escalated to the process owner before release.`;
};

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

/** A tested entity-produced report. The three checks come from the standard
 *  checklist so a seeded paper reads exactly like one the auditor worked; the
 *  findings are what a real paper carries — the tie-out numbers, not "OK". */
let _ipe = 0;
const ipeTest = (meta: {
  reportName: string; system?: string; reportRef: string; parameters: string;
  generatedBy: string; recordCount: number; controlTotal: string; file: string;
  findings: [string, string, string];
  /** Which dimension failed, if any — its check goes Fail and the report sinks. */
  failed?: 0 | 1 | 2;
}): IpeTest => {
  const n = ++_ipe;
  const reliable = meta.failed === undefined;
  return {
    reportName: meta.reportName,
    system: meta.system ?? 'SAP S/4HANA',
    reportRef: meta.reportRef,
    parameters: meta.parameters,
    generatedBy: meta.generatedBy,
    generatedAt: '02 May',
    recordCount: meta.recordCount,
    controlTotal: meta.controlTotal,
    file: { id: `f-ipe-${n}`, name: meta.file, kind: 'XLSX', uploadedBy: meta.generatedBy, uploadedAt: '02 May' },
    checks: ipeChecklist(meta.reportName).map((k, i) => ({
      ...k,
      id: `ipe-${n}-${i}`,
      result: meta.failed === i ? 'Fail' : 'Pass',
      note: meta.findings[i],
    })),
    conclusion: reliable ? 'Reliable' : 'Not reliable',
    testedBy: 'A. Mehta · Auditor',
    testedAt: '03 May',
  };
};

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
  'Fixed Assets': [
    { name: 'Fixed asset register (AS03)', format: 'XLSX', description: 'Asset master with cost, useful life and accumulated depreciation.' },
    { name: 'Depreciation run log (AFAB)', format: 'CSV', description: 'Monthly depreciation postings with run status and exceptions.' },
  ],
};
// The scoping flow names the process in full — reuse the Payroll dataset list.
PROCESS_DATASETS['Payroll (Hire to Retire)'] = PROCESS_DATASETS['Payroll']!;

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
    controlActivity: 'R. Khanna (Master Data) raises every vendor addition and bank-detail change in SAP S/4HANA against the signed vendor request form and the bank confirmation letter. The record stays inactive until a second Master Data authoriser, independent of the raiser, approves the change in the workflow; the approval log is the evidence. Nothing pays out of an unapproved record.',
    owner: 'R. Khanna · Master Data', riskId: 'R-12', riskDescription: 'Fraudulent or erroneous payments to fictitious or altered vendor bank accounts.',
    rootCause: 'Vendor bank details can be edited in the master record by the same team that raises the payment run, so a single person can redirect a genuine payable.',
    auditSteps: [
      'Obtain the SAP role matrix for the vendor-master transactions (XK01 / XK02) and identify every user holding create and approve.',
      'Obtain the vendor change log for the period and agree the record count to the system total.',
      'For each sampled change, inspect the workflow approval and confirm the approver is a different user from the requester.',
      'Attempt a bank-detail change as the requester in the QA client and confirm the activation block holds.',
      'Confirm the change log is retained and cannot be edited by the master-data team.',
    ],
    riskRating: 'High',
    performedBy: 'AM', wpRefHard: 'P2P/01', wpRefSoft: '/FY26/ICFR/P2P/P-01 vendor master/', reportRef: '4.1',
    assertions: ['Existence / Occurrence', 'Rights & Obligations'],
    racmReview: approved(),
    // fully through the review gate — signed and countersigned, the paper is final
    wpSignoff: { preparer: { by: 'A. Mehta · Auditor', at: '17 Apr' }, reviewer: { by: REVIEWER, at: '18 Apr' } },
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
    controlActivity: 'S. Iyer (Procurement) reviews each purchase requisition against the delegation-of-authority matrix before it is converted to a PO. SAP S/4HANA routes the order to the authority tier its value demands and blocks release until that tier approves; the approval trail on the PO is the evidence. Orders raised at the wrong tier are returned to the buyer, not overridden.',
    owner: 'S. Iyer · Procurement', riskId: 'R-08', riskDescription: 'Unauthorised commitments / purchases outside delegated authority.',
    rootCause: 'The delegation-of-authority matrix is maintained offline and was last refreshed before two reorganisations, so SAP still routes some orders to authority tiers that no longer exist.',
    auditSteps: [
      'Obtain the signed delegation-of-authority matrix in force for FY26 and agree the tiers to the current org structure.',
      'Extract the PO release log (ME2N) for the period and validate it as information produced by the entity.',
      'For each sampled PO, inspect the approval trail and agree the approving tier to the order value per the matrix.',
      'Confirm from the delegation register that the approver held that authority on the approval date.',
      'Re-perform the release-timing check to confirm no order released before its approval timestamp.',
    ],
    riskRating: 'High',
    performedBy: 'AM', wpRefHard: 'P2P/02', wpRefSoft: '/FY26/ICFR/P2P/P-02 purchasing/', reportRef: '4.2',
    assertions: ['Existence / Occurrence', 'Accuracy'],
    racmReview: approved(), testDueInDays: 0,
    design: designTrack('Effective', [
      doc('Process narrative', 'Purchasing narrative v2.pdf', 'Received'),
      doc('Flowchart', 'PO approval flowchart.pdf', 'Received'),
      doc('Walkthrough', 'Walkthrough — 10 Apr.pdf', 'Received'),
      doc('Policy / SOP', 'Delegation-of-authority matrix FY26.xlsx', 'Received'),
    ], [
      point('DoA tiers map to current org and signing limits.'),
      point('System enforces tier by PO value (not advisory).'),
    ]),
    // the population came out of a client-run report, so the report is tested first
    operating: { ...manualTrack('Not tested', [
      step('B1', 'PO approved at the tier matching its value per the DoA matrix.', 'Existence / Occurrence', 'Per PO', ['Inspection', 'Reperformance'], 'Pass', attest('Approval screenshots for all 25 sampled POs attached; each shows the correct tier per the DoA matrix.', 'S. Iyer · Procurement', ['PO_approval_screens_25_samples_Apr26.pdf', 'DoA_matrix_FY26_v2_signed.xlsx'])),
      step('B2', 'Approver held the delegated authority on the approval date.', 'Existence / Occurrence', 'Per PO', ['Inspection'], 'Pass', attest('Delegation register extract confirms authority held on each approval date.', 'S. Iyer · Procurement', ['Delegation_register_extract_01-30Apr26.pdf'])),
      step('B3', 'No release before approval timestamp.', 'Accuracy', 'Per PO', ['Reperformance'], 'Not tested', { ...wf('wf-po-release-timing', 'PO release-timing check', undefined), evidenceMode: 'ai', aiValidation: true, inputFile: file('ME2N_release_timing_extract_Apr26.csv', 'S. Iyer · Procurement', 'CSV') }),
    ], sampling(25, '25 POs — daily manual control, moderate reliance (handbook — no fixed minimum, judgment documented).', 'Random', 0, PO_SAMPLE_REFS), 2640, 'SAP ECC — ME2N PO release log, FY26 YTD (POs 4500012840–4500013008)', 'ME2N_PO_release_log_FY26_YTD.xlsx'),
      ipe: ipeTest({
        reportName: 'PO release log',
        reportRef: 'ME2N',
        parameters: 'Company code AG01 · document types NB, FO · release date 01 Apr 2026 – 31 Mar 2027 · all purchasing groups',
        generatedBy: 'S. Iyer · Procurement',
        recordCount: 2640,
        controlTotal: '₹ 412.64 Cr — agreed to GL 21100 (Trade payables) movement',
        file: 'ME2N_PO_release_log_FY26_YTD.xlsx',
        findings: [
          'Parameter screen capture inspected: company code AG01, document types NB and FO, release window 01 Apr 26 – 31 Mar 27 — agrees to the test scope. No purchasing group excluded.',
          '2,640 lines against the ME2N system total of 2,640. Report total ₹412.64 Cr agrees to the GL 21100 movement of ₹412.64 Cr — nil difference. Re-run for Apr–Jun returned 631 lines, which tie to the full extract.',
          '15 lines vouched to the PO print and the approval trail — order value, tier and release date agree in every case. The "days to release" column re-performed off the raw dates without exception.',
        ],
      }),
    },
  },
  {
    id: 'P2P-C-03', wpRef: 'P-03', description: 'Invoices are matched three-way (PO, GRN, invoice) before payment; exceptions route to buyer.',
    process: 'Procure to Pay', subProcess: 'Invoice processing', nature: 'IT-dependent', type: 'Detective', frequency: 'Daily', isKey: true,
    precision: 'Quantity/price tolerance breaches are held and cannot pay until cleared by the buyer.',
    controlActivity: 'M. Nair (Accounts Payable) works the daily blocked-invoice report from SAP S/4HANA, which holds any invoice whose quantity or price falls outside tolerance on the three-way match against the PO and goods receipt. The buyer investigates each held line and clears or rejects it, evidencing the outcome on the report. A held invoice cannot be paid until it is cleared.',
    owner: 'M. Nair · Accounts Payable', riskId: 'R-05', riskDescription: 'Payment for goods not received or at incorrect price.',
    rootCause: 'Tolerance limits were set centrally years ago in absolute rupees and never indexed, so on high-value spares an out-of-tolerance price difference still falls inside the limit and passes the match.',
    auditSteps: [
      'Obtain the MM tolerance configuration export and agree the quantity and price limits to the approved policy.',
      'Extract the invoice register (MIR5) for the period and validate it as information produced by the entity.',
      'For each sampled invoice, agree quantity and price to the PO and the goods receipt, and re-perform the tolerance calculation.',
      'Obtain the blocked-invoice report and confirm every held line was cleared or rejected by the buyer with evidence.',
      'Confirm no held invoice was paid before clearance by agreeing the payment date to the clearance date.',
    ],
    riskRating: 'Medium',
    performedBy: 'RS', wpRefHard: 'P2P/03', wpRefSoft: '/FY26/ICFR/P2P/P-03 invoice processing/', reportRef: '4.3',
    assertions: ['Accuracy', 'Existence / Occurrence'],
    racmReview: remark('Tolerance configuration evidence is still outstanding — approve this row once the MM config export is on file.'), testDueInDays: 0,
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
    controlActivity: 'The duplicate-invoice check is configured in SAP S/4HANA and runs on every invoice as it is posted, comparing vendor, invoice number and amount against documents already on the ledger. A match is blocked at posting; the block log is the evidence. M. Nair (Accounts Payable) reviews the log and releases only after confirming the second document is genuine.',
    owner: 'M. Nair · Accounts Payable', riskId: 'R-06', riskDescription: 'Duplicate payments to vendors.',
    rootCause: 'The duplicate check compares the invoice reference as typed, so any formatting difference — a leading zero, a trailing space — reads as a new document and clears the block.',
    auditSteps: [
      'Obtain the SAP duplicate-check configuration and confirm the match key includes vendor, reference and amount.',
      'Confirm the check is active across every company code in scope.',
      'Re-perform the exact-match test over the period postings and confirm nil duplicates cleared.',
      'Re-perform the test on reference variants — leading zeros, trailing spaces, case differences — and quantify anything that posted.',
      'For each variant duplicate found, trace to the payment run and establish whether cash left the business.',
    ],
    riskRating: 'Medium',
    performedBy: 'AM', wpRefHard: 'P2P/04', wpRefSoft: '/FY26/ICFR/P2P/P-04 duplicate block/', reportRef: '4.4',
    assertions: ['Existence / Occurrence', 'Accuracy'],
    racmReview: approved(),
    // concluded ineffective, paper signed — sitting in the reviewer's court
    wpSignoff: { preparer: { by: 'A. Mehta · Auditor', at: '16 Apr' } },
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
    isMrc: true, mrcThreshold: 250_000,
    process: 'Procure to Pay', subProcess: 'Period close', nature: 'Manual', type: 'Detective', frequency: 'Monthly', isKey: true,
    precision: 'All manual AP journals are reviewed before posting; review evidenced by sign-off.',
    controlActivity: 'D. Rao (Controller) reviews every manual journal to the AP control account each month, before the ledger closes, against the supporting schedule and the originating document. The journal is posted only after review, and the sign-off on the journal package is the evidence. Journals raised without support are returned to the preparer.',
    owner: 'D. Rao · Controller', riskId: 'R-19', riskDescription: 'Unauthorised or erroneous manual adjustments to AP.',
    rootCause: 'The review was designed around the month-end reporting pack rather than the posting itself, so it happens after the journal has already hit the ledger.',
    auditSteps: [
      'Obtain the manual-journal narrative and walk the review step with the Controller.',
      'Extract the manual journal register (FB03) for the period and validate it as information produced by the entity.',
      'For each sampled journal, compare the review sign-off date to the posting date.',
      'Confirm the reviewer is independent of the preparer on every sampled journal.',
      'Agree the journal population to the ledger to establish whether the review covered all of it.',
    ],
    riskRating: 'High',
    performedBy: 'RS', wpRefHard: 'P2P/05', wpRefSoft: '/FY26/ICFR/P2P/P-05 manual journals/', reportRef: '4.5',
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
    controlActivity: 'M. Nair (Accounts Payable) takes the goods-receipt listing for the last five days of the period and the first five of the next, and agrees each line to the GRN date and the carrier documentation. Receipts recorded in the wrong period are reclassified before close; the reviewed listing carries dated sign-off as evidence.',
    owner: 'M. Nair · Accounts Payable', riskId: 'R-21', riskDescription: 'Goods/liabilities recorded in the wrong period (cut-off).',
    rootCause: 'Receiving sites post goods receipts from paper docket books the next working day, so the recorded date follows the data-entry date rather than the date the goods arrived.',
    auditSteps: [
      'Obtain the cut-off narrative and confirm the review window is defined and applied consistently.',
      'Extract the goods-receipt listing for the five days either side of period end.',
      'Agree each sampled line to the GRN date and the carrier documentation.',
      'Confirm anything recorded in the wrong period was reclassified before close.',
    ],
    riskRating: 'Medium',
    performedBy: 'RS', wpRefHard: 'P2P/06', wpRefSoft: '/FY26/ICFR/P2P/P-06 GR cut-off/', reportRef: '4.6',
    assertions: ['Cut-off', 'Completeness'],
    testDueInDays: 0,
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
    isMrc: true,   // review control tagged, threshold not yet documented — surfaces the precision warning
    process: 'Procure to Pay', subProcess: 'Period close', nature: 'Manual', type: 'Detective', frequency: 'Monthly', isKey: false,
    precision: 'GR/IR entries open beyond 60 days are investigated and resolved.',
    controlActivity: 'M. Nair (Accounts Payable) reviews the aged GR/IR report from SAP S/4HANA each month and investigates every entry open beyond 60 days with the buyer and the receiving site. Each item is cleared, accrued or written back with a documented reason; the annotated report is retained as evidence and the closing balance is agreed to the ledger.',
    owner: 'M. Nair · Accounts Payable', riskId: 'R-24', riskDescription: 'Unreconciled goods-received/invoice-received balances misstate liabilities.',
    rootCause: 'Ageing the GR/IR account is a month-end housekeeping task with no owner named in the close calendar, so it slips whenever close is compressed.',
    riskRating: 'Low',
    performedBy: 'RS', wpRefHard: 'P2P/07', wpRefSoft: '/FY26/ICFR/P2P/P-07 GR-IR ageing/', reportRef: '4.7',
    assertions: ['Completeness', 'Accuracy'],
    racmReview: remark('Row is incomplete — no design documents or test attributes defined yet. Complete the RACM row, then resubmit for approval.'),
    design: designTrack('Not tested', [], []),
    operating: manualTrack('Not tested', [], undefined, 0),
  },
];

// ── generator — fills the register to scale ──────────────────────────────────────
// Each spread carries its process's real risk register: a few risk-phrased
// statements, each covering the controls (by title index) that answer it. Both
// generation batches map a title to the SAME risk, so the Risk Register groups
// base + station controls under one risk instead of minting one risk per control.
type SpreadRisk = { id: string; text: string; covers: number[] };
type Spread = { process: string; prefix: string; wp: string; subs: string[]; titles: string[]; owner: string; risks: SpreadRisk[] };
const SPREADS: Spread[] = [
  { process: 'Order to Cash', prefix: 'O2C', wp: 'O', owner: 'P. Sharma · Revenue', subs: ['Credit', 'Billing', 'Collections', 'Revenue recognition'], titles: [
    'Credit limits are approved before order release', 'Sales invoices priced from the approved price master', 'Revenue cut-off at period-end agrees to dispatch', 'Credit notes are approved before issue', 'Customer master changes are independently reviewed', 'AR ageing reviewed and provisioned monthly', 'Manual revenue journals are reviewed before posting', 'Cash receipts applied to correct customer accounts', 'Disputed receivables escalated per policy', 'Rebates accrued per contract terms' ],
    risks: [
      { id: 'R-40', text: 'Sales released to customers beyond approved credit limits.', covers: [0] },
      { id: 'R-41', text: 'Customers billed at incorrect prices or terms.', covers: [1] },
      { id: 'R-42', text: 'Revenue recorded in the wrong period or without basis (cut-off).', covers: [2, 6] },
      { id: 'R-43', text: 'Revenue overstated through unapproved credit notes or unaccrued rebates.', covers: [3, 9] },
      { id: 'R-44', text: 'Receivables overstated — uncollectable or disputed balances not provisioned.', covers: [5, 8] },
      { id: 'R-45', text: 'Cash receipts misapplied or customer master data manipulated.', covers: [4, 7] },
    ] },
  { process: 'Record to Report', prefix: 'R2R', wp: 'R', owner: 'D. Rao · Controller', subs: ['Journals', 'Reconciliations', 'Close', 'Consolidation'], titles: [
    'Balance-sheet reconciliations reviewed monthly', 'Manual journals approved before posting', 'Intercompany balances agreed and eliminated', 'FX revaluation reviewed at month-end', 'Close checklist completed and signed', 'Consolidation entries reviewed', 'Accruals supported and approved', 'Suspense accounts cleared within policy', 'Trial balance mapped to FS line items', 'Management review of flux analysis' ],
    risks: [
      { id: 'R-50', text: 'Unsupported or unauthorised journals and accruals misstate the ledger.', covers: [1, 6] },
      { id: 'R-51', text: 'Account balances unreconciled or parked in suspense unexplained.', covers: [0, 7] },
      { id: 'R-52', text: 'Intercompany and consolidation entries misstate group results.', covers: [2, 5] },
      { id: 'R-53', text: 'Period close performed incompletely or without review.', covers: [4, 9] },
      { id: 'R-54', text: 'Foreign-currency balances revalued incorrectly.', covers: [3] },
      { id: 'R-55', text: 'Trial balance mis-mapped to financial-statement lines.', covers: [8] },
    ] },
  { process: 'Inventory', prefix: 'INV', wp: 'I', owner: 'K. Bose · Supply Chain', subs: ['Costing', 'Counts', 'Provisions'], titles: [
    'Standard costs reviewed and approved', 'Cycle counts performed and variances investigated', 'Slow-moving provision calculated and reviewed', 'Inventory movements restricted to authorised users', 'Net realisable value assessed at period-end', 'GRN matched to physical receipt' ],
    risks: [
      { id: 'R-60', text: 'Inventory valued incorrectly — cost, obsolescence or net realisable value.', covers: [0, 2, 4] },
      { id: 'R-61', text: 'Recorded inventory does not exist or receipts do not match physical stock.', covers: [1, 5] },
      { id: 'R-62', text: 'Unauthorised inventory movements misstate stock.', covers: [3] },
    ] },
  { process: 'Treasury', prefix: 'TRY', wp: 'T', owner: 'A. Verma · Treasury', subs: ['Payments', 'Banking', 'Investments'], titles: [
    'Payment runs approved by two authorisers', 'Bank reconciliations reviewed monthly', 'New payee setup independently verified', 'Borrowing within board-approved limits', 'FX deals confirmed independently of dealing' ],
    risks: [
      { id: 'R-70', text: 'Payments released without dual authorisation or to unverified payees.', covers: [0, 2] },
      { id: 'R-71', text: 'Bank balances misstated through unreconciled differences.', covers: [1] },
      { id: 'R-72', text: 'Treasury exposures taken outside board-approved limits.', covers: [3, 4] },
    ] },
  { process: 'Payroll', prefix: 'PAY', wp: 'Y', owner: 'N. Pillai · HR', subs: ['Masterdata', 'Processing'], titles: [
    'Joiner/leaver changes approved before payroll run', 'Payroll reconciled to GL each cycle', 'Overtime approved before payment', 'Statutory deductions reconciled and remitted' ],
    risks: [
      { id: 'R-75', text: 'Fictitious, departed or unapproved employees paid.', covers: [0] },
      { id: 'R-76', text: 'Payroll costs unapproved or unreconciled to the ledger.', covers: [1, 2] },
      { id: 'R-77', text: 'Statutory deductions under-remitted, exposing penalties.', covers: [3] },
    ] },
  { process: 'Tax', prefix: 'TAX', wp: 'X', owner: 'S. Gupta · Tax', subs: ['Direct', 'Indirect'], titles: [
    'GST returns reviewed before filing', 'Tax provision reviewed by tax lead', 'TDS reconciled to GL and remitted' ],
    risks: [
      { id: 'R-80', text: 'Indirect-tax filings incorrect, late or unreconciled.', covers: [0, 2] },
      { id: 'R-81', text: 'Tax provision materially misstated.', covers: [1] },
    ] },
  { process: 'IT General Controls', prefix: 'ITGC', wp: 'G', owner: 'V. Menon · IT', subs: ['Access', 'Change', 'Operations'], titles: [
    'Privileged access reviewed quarterly', 'User access granted via approved request', 'Terminated users disabled within 24h', 'Program changes tested and approved before deploy', 'Emergency changes reviewed post-implementation', 'Batch job failures monitored and resolved', 'Database backups completed and tested', 'Segregation-of-duties conflicts reviewed' ],
    risks: [
      { id: 'R-85', text: 'Unauthorised or excessive access to financial systems.', covers: [0, 1, 2, 7] },
      { id: 'R-86', text: 'Unauthorised or untested changes reach production.', covers: [3, 4] },
      { id: 'R-87', text: 'Processing failures or data loss corrupt financial data.', covers: [5, 6] },
    ] },
];
const riskFor = (sp: Spread, titleIdx: number): SpreadRisk =>
  sp.risks.find(r => r.covers.includes(titleIdx)) ?? sp.risks[0]!;

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
        // The rating tracks the key judgement: the row that isn't key is the one
        // whose failure the group can absorb, so it sizes at the bottom of the band.
        riskRating: (i % 4 === 0 ? 'Low' : i % 3 === 0 ? 'Medium' : 'High') as RiskRating,
        owner: sp.owner, riskId: riskFor(sp, i).id, riskDescription: riskFor(sp, i).text,
        assertions: ['Accuracy', 'Existence / Occurrence'],
        // review spread: fully-tested rows approved, one recurring remark pattern, rest pending
        racmReview: pat <= 1 ? approved('18 Apr') : pat === 3 ? remark('Precision statement is generic — state the threshold, the reviewer and the evidence retained.', '18 Apr') : undefined,
        // paper sign-off spread: most concluded rows are countersigned; every other
        // pat-6 row is signed but still waits on the reviewer (feeds the queue)
        wpSignoff: design === 'Effective' && operating === 'Effective'
          ? (pat === 6 && idx % 2 === 0
            ? { preparer: { by: 'A. Mehta · Auditor', at: '18 Apr' } }
            : { preparer: { by: 'A. Mehta · Auditor', at: '18 Apr' }, reviewer: { by: REVIEWER, at: '19 Apr' } })
          : undefined,
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
  // DEF-001 was found by sampling — the control is designed correctly and did not
  // operate, so it is a testing gap, and the four variant duplicates that posted
  // are real money: two were paid and are recoverable, two were caught pre-payment.
  { id: 'DEF-001', controlId: 'P2P-C-04', track: 'operating', gapType: 'TG', description: 'Duplicate-invoice block does not catch reference variants (leading zeros / whitespace); 4 variant duplicates posted in period.', rootCause: 'Match key compares raw reference without normalisation.', likelihood: 'Reasonably possible', magnitude: 1_180_000, mwIndicators: [], compensatingControlId: undefined, aggregationGroup: 'AP payments', reportRef: '4.4',
    exposure: { recovery: 740_000, workingCapital: 440_000, leakage: 0, basis: '4 variant duplicates totalling ₹11.8L. 2 reached payment (₹7.4L) and are recoverable from the vendors by debit note; 2 (₹4.4L) were stopped before the payment run and release working capital on cancellation. Nothing has left the business permanently.' },
    remediation: { action: 'Normalise reference in match key; re-test.', date: '30 Jun', owner: 'M. Nair · Accounts Payable', status: 'In progress' }, status: 'Remediation' },
  // DEF-002 was found in the walkthrough, on a manual control — a manual design
  // gap. Nothing has gone wrong yet, so there is no recovery to price: the number
  // is what could pass unchecked in a month of manual journals.
  { id: 'DEF-002', controlId: 'P2P-C-05', track: 'design', gapType: 'MDG', description: 'Manual AP journal review occurs after posting, so the control cannot prevent an erroneous or unauthorised posting.', rootCause: 'Review step placed post-posting in the process design.', likelihood: 'Reasonably possible', magnitude: 640_000, mwIndicators: [], compensatingControlId: undefined, aggregationGroup: 'AP close', reportRef: '4.5',
    exposure: { recovery: 0, workingCapital: 0, leakage: 640_000, basis: 'No error identified in the period. Priced at the average monthly value of manual AP journals posted without prior review (₹6.4L) — the amount that could reach the ledger unchecked before the next review cycle catches it.' },
    remediation: { action: 'Move review to a pre-posting hold.', date: null, owner: 'D. Rao · Controller', status: 'Open' }, status: 'Identified' },
];

// ── review notes — one at each lifecycle stage, so every hat sees its move ───────
const REVIEW_NOTES: ReviewNote[] = [
  // open — blocks P2P-C-04's countersign until the auditor responds and the reviewer verifies
  { id: 'rn-1', controlId: 'P2P-C-04', text: 'The paper concludes on reference-variant duplicates but doesn’t evidence which variants were in the sample — attach the variant list behind D2.', raisedBy: REVIEWER, raisedAt: '2d', status: 'Open' },
  // resolved — waiting on the reviewer's verification (R2R-C-03 sits in the queue)
  { id: 'rn-2', controlId: 'R2R-C-03', text: 'Elimination entries are agreed, but the paper doesn’t show the out-of-balance items over the ₹1L threshold were investigated.', raisedBy: REVIEWER, raisedAt: '3d', status: 'Resolved', resolution: { text: 'Added the intercompany break report — all 3 items over threshold traced to timing differences, cleared in Apr close.', by: 'A. Mehta · Auditor', at: '1d' } },
  // closed — the full raise → resolve → verify history on the final P2P-C-01 paper
  { id: 'rn-3', controlId: 'P2P-C-01', text: 'Confirm the approver-segregation check covers emergency changes routed outside SAP.', raisedBy: REVIEWER, raisedAt: '6d', status: 'Closed', resolution: { text: 'Emergency changes land in the same vendor-master change log — run #4821 covers them; noted in the walkthrough.', by: 'A. Mehta · Auditor', at: '5d' }, verified: { by: REVIEWER, at: '5d' } },
];

const ACCOUNTS: SignificantAccount[] = [
  { id: 'a1', name: 'Accounts Payable', balance: 184_000_000, inScope: true, assertions: ['Completeness', 'Accuracy', 'Cut-off'], process: 'Procure to Pay',
    wcgw: ['Invoices are recorded twice or against the wrong PO', 'Liabilities at period end are incomplete (unrecorded GRNs)'] },
  { id: 'a2', name: 'Inventory', balance: 96_000_000, inScope: true, assertions: ['Existence / Occurrence', 'Valuation'], process: 'Inventory',
    wcgw: ['Recorded stock does not exist (shrinkage, phantom receipts)', 'Slow-moving stock is not written down'] },
  { id: 'a3', name: 'Revenue', balance: 412_000_000, inScope: true, assertions: ['Existence / Occurrence', 'Cut-off'], process: 'Order to Cash',
    wcgw: ['Revenue recognised for undelivered services', 'Sales near period end recorded in the wrong period'] },
  { id: 'a4', name: 'Cash & bank', balance: 58_000_000, inScope: true, assertions: ['Existence / Occurrence'], process: 'Treasury',
    wcgw: ['Payments made to altered or fictitious bank accounts'] },
  { id: 'a5', name: 'Property, plant & equipment', balance: 240_000_000, inScope: false, assertions: ['Existence / Occurrence', 'Valuation'], process: 'Record to Report',
    wcgw: ['Assets no longer in use remain on the register'] },
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

// ── run history — the Runs tab's seed; outcomes/checks derive from the control seed ──
const runOutcome = (id: string, outcome: RunControlOutcome['outcome']): RunControlOutcome => {
  const c = DETAILED.find(x => x.id === id)!;
  return { controlId: c.id, wpRef: c.wpRef, description: c.description, outcome, checks: c.design.points.length + c.operating.steps.length };
};
// Newest first — the store prepends, so the seed matches that order.
const RUNS: RunRecord[] = [
  {
    id: 'run-s3', kind: 'control-test', label: 'Control test — all attributes',
    detail: 'Design considerations & operating attributes tested from the control page',
    controls: [runOutcome('P2P-C-04', 'Ineffective')],
    by: 'A. Mehta · Auditor', role: 'auditor', at: '3d ago',
  },
  {
    id: 'run-s2', kind: 'workflow-run', label: 'Workflow run — Approver-segregation check',
    detail: 'run #4821 · 0 conflicts',
    controls: [runOutcome('P2P-C-01', 'Effective')],
    by: 'A. Mehta · Auditor', role: 'auditor', at: '4d ago',
  },
  {
    id: 'run-s1', kind: 'bulk-test', label: 'Bulk test — 2 controls',
    detail: 'Scoping run across PO approval and vendor master controls',
    controls: [runOutcome('P2P-C-01', 'Effective'), runOutcome('P2P-C-02', 'Effective')],
    datasets: ['PO release log (ME2N)', 'Vendor master snapshot'],
    by: 'A. Mehta · Auditor', role: 'auditor', at: '6d ago',
  },
];

const ENGAGEMENT: IcfrEngagement = {
  id: 'eng-1', code: 'ICFR-26', name: 'FY26 ICFR — Airline P2P & O2C', entity: 'Airline Group Ltd', framework: 'COSO 2013 / SOX 404',
  periodStart: '01 Apr 2025', periodEnd: '31 Mar 2026',
  materiality: 5_000_000, performanceMateriality: 3_750_000, preparer: 'A. Mehta · Auditor', reviewer: 'J. Fernandes · Audit Manager',
  live: true, wentLiveAt: '01 Apr 2025',
  entityDetected: { name: 'Airline Group Ltd', companyCode: 'AG01', source: 'GL upload · Mar 2025' },
  materialityBasis: {
    benchmark: 'assets',
    amounts: { assets: 1_000_000_000, revenue: 820_000_000, pbt: 74_000_000, cash: 58_000_000, equity: 402_000_000 },
    pct: 0.5, pmPct: 75, ctPct: 5,
    source: 'GL Mar 2025 (AG01) · P&L annualized ×12, balance sheet as at 31 Mar 2025',
    allocation: [
      { group: 'Revenue', balance: 412_000_000, sharePct: 55, allocated: 0 },
      { group: 'Accounts Payable', balance: 184_000_000, sharePct: 25, allocated: 0 },
      { group: 'Inventory', balance: 96_000_000, sharePct: 13, allocated: 0 },
      { group: 'Cash & bank', balance: 58_000_000, sharePct: 7, allocated: 0 },
    ],
    lockedAt: '01 Apr 2025 · at go-live',
  },
  rules: { clearlyTrivial: 250_000, sdBandPct: 20, aggregate: true, autoRoute: true, mwIndicators: [] },
  accounts: ACCOUNTS,
  controls: [...DETAILED, ...generate()],
  deficiencies: DEFICIENCIES,
  tasks: TASKS,
  discussions: DISCUSSIONS,
  reviewNotes: REVIEW_NOTES,
  executions: EXECUTIONS,
  runs: RUNS,
  // The Audit logs tab starts empty on purpose — audits only exist once someone
  // runs the New audit wizard, so the empty state is the honest first view.
  audits: [],
  signoff: {},
  rulesLog: [],
};

/** Identity carried in from the app-level Engagement record (engagements.ts). */
export interface SeedMeta { id?: string; code?: string; name?: string; process?: string; /** Scoping-derived process list — when present, the workspace seeds one RACM per entry. */ processes?: string[]; /** Testing state for scoping-derived RACMs — see Engagement.soxSeedMode. */ seedMode?: 'fresh' | 'live' | 'carried'; periodStart?: string; periodEnd?: string; owner?: string; materiality?: number; performanceMateriality?: number; clearlyTrivial?: number; sdBandPct?: number; }
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
  // Any other engagement → a fresh engagement scoped to the picked process —
  // or, when a scoping-derived process list is supplied, one RACM per process.
  // A supplied-but-EMPTY list means scoping was skipped: seed NOTHING (the
  // user adds the RACM from the RACM tab); only an absent list gets the
  // classic single-process default.
  const proc = PROC_LABEL[meta.process ?? 'O2C'] ?? 'Order to Cash';
  const controls = meta.processes
    ? (meta.processes.length ? racmTemplateForProcesses(meta.processes, meta.seedMode) : [])
    : racmTemplate(proc);
  // A 'live' cycle claims tested controls — back that claim with the bulk run
  // that produced them, so the Test runs registry isn't empty on arrival.
  const runs: RunRecord[] = [];
  if (meta.seedMode === 'live') {
    const tested = controls.filter(c => c.design.conclusion === 'Effective' && c.operating.conclusion === 'Effective');
    if (tested.length) {
      const datasets = Array.from(new Set(tested.flatMap(c => requiredDatasetsFor(c).map(d => d.name))));
      const checks = tested.reduce((n, c) => n + c.design.points.length + c.operating.steps.length, 0);
      runs.push({
        id: 'run-seed-live', kind: 'bulk-test',
        label: `Bulk test — ${tested.length} control${tested.length === 1 ? '' : 's'}`,
        detail: `${checks} checks · ${datasets.length} dataset${datasets.length === 1 ? '' : 's'}`,
        controls: tested.map(c => ({ controlId: c.id, wpRef: c.wpRef, description: c.description, outcome: 'Effective' as const, checks: c.design.points.length + c.operating.steps.length })),
        datasets, by: 'A. Mehta · Auditor', role: 'auditor', at: '3d ago',
      });
    }
  }
  return {
    ...base,
    // Scoping-derived engagements set materiality in the scoping wizard — the
    // flagship's worksheet basis would contradict those numbers, so it stays
    // flagship-only and the scope page falls back to the three threshold fields.
    materialityBasis: undefined,
    id: meta.id,
    code: meta.code ?? base.code,
    name: meta.name ?? base.name,
    periodStart: meta.periodStart ?? base.periodStart,
    periodEnd: meta.periodEnd ?? base.periodEnd,
    preparer: meta.owner ? `${meta.owner} · Auditor` : base.preparer,
    controls,
    deficiencies: [],
    tasks: [],
    discussions: [],
    reviewNotes: [],
    executions: [],
    runs,
    signoff: {},
    rulesLog: [],
  };
}

/**
 * One template RACM per scoping-derived process. Catalogue processes reuse
 * their spread (relabelled to the caller's name, e.g. "Payroll (Hire to
 * Retire)"); processes outside the catalogue (e.g. Fixed Assets) get a
 * five-control generic shell so the RACM tab always mirrors the scoping.
 *
 * Every control seeds real design considerations and operating attributes so
 * a bulk test has checks to run. `mode` sets how far testing has progressed:
 * 'fresh' — nothing tested; 'live' — all but the last control per RACM
 * concluded effective (the scoping summary's n−1 story); 'carried' — design
 * conclusions carried from the prior cycle, operating retest pending.
 */
export function racmTemplateForProcesses(names: string[], mode: 'fresh' | 'live' | 'carried' = 'fresh'): Control[] {
  const GENERIC_TITLES: Record<string, string[]> = {
    'Fixed Assets': [
      'Capex additions are approved per the delegation of authority',
      'Assets are capitalised with correct useful lives and start dates',
      'Depreciation run is reviewed against the asset register monthly',
      'Disposals are approved and derecognised in the period of sale',
      'Physical verification results are reconciled to the fixed asset register',
    ],
  };
  return names.flatMap(name => {
    const norm = name.startsWith('Payroll') ? 'Payroll' : name;
    const sp = SPREADS.find(s => s.process === norm);
    const prefix = name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'GEN';
    const shells: Control[] = sp
      ? racmTemplate(sp.process).map(c => ({ ...c, process: name }))
      : (GENERIC_TITLES[name] ?? [
          `${name} transactions are approved before processing`,
          `${name} balances are reconciled to the ledger monthly`,
          `${name} master data changes are independently reviewed`,
          `${name} period-end cut-off is reviewed`,
          `${name} exceptions are escalated and resolved per policy`,
        ]).map((title, i) => ({
          id: `${prefix}-NEW-${i + 1}`, wpRef: `${prefix.charAt(0)}X-${String(i + 1).padStart(2, '0')}`, description: title + '.',
          process: name, subProcess: 'General', nature: 'Manual' as Nature, type: 'Preventive' as const, frequency: 'Monthly' as const,
          isKey: true, precision: `${title}.`, controlActivity: activityOf('S. Iyer · Finance', 'General', 'Monthly', 'Manual'),
          riskRating: (i % 3 === 0 ? 'High' : i % 3 === 1 ? 'Medium' : 'Low') as RiskRating,
          owner: 'S. Iyer · Finance', riskId: `R-${prefix}-1`,
          riskDescription: `${name} misstated — additions, movements or reconciliations not controlled.`,
          assertions: ['Accuracy', 'Existence / Occurrence'] as Assertion[],
          design: designTrack('Not tested', [], []),
          operating: manualTrack('Not tested', [], undefined, 0),
        }));
    return shells.map((c, i) => {
      const last = i === shells.length - 1;
      const designDone = mode === 'carried' || (mode === 'live' && !last);
      const opDone = mode === 'live' && !last;
      const nature: Nature = i % 3 === 1 ? 'Automated' : 'Manual';
      const title = c.description.replace(/\.$/, '');
      const docs: DesignDoc[] = [
        doc('Process narrative', `${name} narrative.pdf`, 'Received'),
        doc('Flowchart', `${name} flowchart.pdf`, 'Received'),
        doc('Walkthrough', `Walkthrough — ${name}.pdf`, designDone ? 'Received' : 'Requested'),
      ];
      const points: DesignPoint[] = [
        point('Control addresses the stated risk and assertion.', designDone ? 'Pass' : 'Not tested'),
        point('Control operates at sufficient precision.', designDone ? 'Pass' : 'Not tested'),
      ];
      const stepExtra = (k: number): Partial<OperatingStep> => nature === 'Automated'
        ? wf(`wf-${c.id.toLowerCase()}-${k}`, `${title} — check ${k}`, opDone ? `run #${6000 + i * 3 + k}` : undefined)
        : {};
      const opSteps: OperatingStep[] = [
        step(`${i + 1}.1`, `${title} — primary attribute tested.`, 'Accuracy', 'Per item', nature === 'Automated' ? ['Reperformance'] : ['Inspection', 'Reperformance'], opDone ? 'Pass' : 'Not tested', stepExtra(1)),
        step(`${i + 1}.2`, `${title} — exceptions handled per policy.`, 'Existence / Occurrence', 'Per exception', ['Inspection'], opDone ? 'Pass' : 'Not tested', stepExtra(2)),
      ];
      const frequency: Frequency = nature === 'Automated' ? 'Recurring' : c.frequency;
      return {
        ...c,
        nature,
        frequency,
        // re-derived, not inherited: the shell was built Manual/Monthly and the
        // activity has to describe the nature and cadence this row ended up with.
        // 'General' is the placeholder sub-process on generated rows — naming the
        // process reads better than "over general records".
        controlActivity: activityOf(c.owner, c.subProcess === 'General' ? name : c.subProcess, frequency, nature),
        design: designTrack(designDone ? 'Effective' : 'Not tested', docs, points),
        operating: nature === 'Automated'
          ? autoTrack(opDone ? 'Effective' : 'Not tested', opSteps)
          : manualTrack(opDone ? 'Effective' : 'Not tested', opSteps, opDone ? sampling(25, 'Standard sample — moderate reliance.', 'Random') : undefined, opDone ? 2000 + i * 7 : 0),
      };
    });
  });
}

// ── RACM template for the setup wizard ──────────────────────────────────────────
export function racmTemplate(process: string): Control[] {
  const sp = SPREADS.find(s => s.process === process) ?? SPREADS[0];
  return sp.titles.slice(0, 5).map((title, i) => ({
    id: `${sp.prefix}-NEW-${i + 1}`, wpRef: `${sp.wp}-${String(i + 1).padStart(2, '0')}`, description: title + '.',
    process: sp.process, subProcess: sp.subs[i % sp.subs.length], nature: 'Manual' as Nature, type: 'Preventive' as const, frequency: 'Monthly' as const,
    isKey: true, precision: `${title}.`, controlActivity: activityOf(sp.owner, sp.subs[i % sp.subs.length], 'Monthly', 'Manual'),
    riskRating: (i % 3 === 0 ? 'High' : i % 3 === 1 ? 'Medium' : 'Low') as RiskRating,
    owner: sp.owner, riskId: riskFor(sp, i).id, riskDescription: riskFor(sp, i).text,
    assertions: ['Accuracy', 'Existence / Occurrence'] as Assertion[],
    design: designTrack('Not tested', [], []),
    operating: manualTrack('Not tested', [], undefined, 0),
  }));
}

