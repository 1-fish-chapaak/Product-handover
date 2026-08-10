import { entityShort } from '../audit/sox-testing/soxTestingData';
import { normaliseProcess, programmeFor } from './auditScope';
import { NEW_FLOW_ENGAGEMENT_ID } from './flow';
import { validationQA } from './helpers';
import { FIVE_W_1H, ipeChecklist, ROUND_TAG, ROUND_WINDOW_LABEL } from './types';
import type {
  Assertion, Attestation, AuditArchive, AuditRecord, Control, DesignDoc, DesignPoint, DesignTrack, DesignWaiverReason, Deficiency, Discussion, DocStatus,
  // PARKED (Aug 2026) — `GapType` went with the Gap type field; see types.ts.
  // GapType,
  EvidenceFile, ExceptionStatus, ExecKind, ExecutionEvent, Frequency, HandoffTask, IcfrEngagement, IpeTest, Nature, OperatingStep, OperatingTrack,
  ControlClass, ControlType, FiveWOneH, RacmReview, ReviewNote, RiskRating, Role, Severity, RunControlOutcome, RunRecord, Sampling, SignificantAccount, TestProcedure, TestResult, TrackConclusion,
} from './types';

// ── builders ─────────────────────────────────────────────────────────────────────
let _d = 0;
// Flowchart & Policy/SOP strengthen the file but don't gate the design conclusion.
const OPTIONAL_KINDS: DesignDoc['kind'][] = ['Flowchart', 'Policy / SOP'];
/** A required element accounted for without a file: the audit team prepared it,
 *  the client holds it, or there is nothing to hold. It stops gating the design
 *  conclusion, and the reason is what the working paper prints. */
const waivedDoc = (kind: DesignDoc['kind'], reason: DesignWaiverReason, note: string, by = 'A. Mehta'): DesignDoc =>
  ({ id: `dd${++_d}`, kind, name: `${kind} — not provided`, status: 'Missing', required: true, waiver: { reason, note, by, at: '11 Apr' } });

/** Classification is derivable from the cycle — the transaction cycles are
 *  financial, IT general controls answer to compliance, the rest are operational.
 *  The OBJECTIVE is not derivable: it is what the control is for, in the client's
 *  words, so generated rows carry none and the UI falls back to the control
 *  statement rather than printing a mechanical restatement of the title. */
const CLASS_BY_PROCESS: Record<string, ControlClass> = {
  'Procure to Pay': 'Financial', 'Order to Cash': 'Financial', 'Record to Report': 'Financial',
  'Treasury': 'Financial', 'Tax': 'Compliance', 'IT General Controls': 'Compliance',
};
const classOf = (process: string): ControlClass => CLASS_BY_PROCESS[process] ?? 'Operational';

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
const point = (text: string, result: DesignPoint['result'] = 'Pass', wfName = 'Design walkthrough check', stepId?: string): DesignPoint =>
  ({ id: `dp${++_p}`, text, stepId, result, workflowId: `wf-tod-${_p}`, workflowName: wfName, workflowRunRef: result !== 'Not tested' ? 'run · validated' : undefined, validation: result !== 'Not tested' ? { qa: validationQA(text, result === 'Fail'), at: '14 Apr' } : undefined });

let _s = 0;
const step = (code: string, description: string, assertion: Assertion, precision: string, procedures: TestProcedure[], result: OperatingStep['result'] = 'Not tested', extra: Partial<OperatingStep> = {}): OperatingStep => {
  return { id: `os${++_s}`, code, description, assertion, precision, procedures, result, ...extra };
};

let _f = 0;
const file = (name: string, by = 'Risk Owner', kind: EvidenceFile['kind'] = 'PDF'): EvidenceFile => ({ id: `f${++_f}`, name, kind, uploadedBy: by, uploadedAt: '12 Apr' });
const wf = (id: string, name: string, runRef?: string): Partial<OperatingStep> => ({ workflowId: id, workflowName: name, workflowRunRef: runRef });
const attest = (note: string, by: string, files: string[]): Partial<OperatingStep> => ({ attestEnabled: true, attestation: { result: 'Pass', note, by, role: 'risk-owner', at: '12 Apr', evidence: files.map(f => file(f, by)) } as Attestation });

const designTrack = (conclusion: TrackConclusion, documents: DesignDoc[], points: DesignPoint[], testedBy: string | null = null): DesignTrack =>
  ({
    documents, points, conclusion,
    testedBy: conclusion !== 'Not tested' ? (testedBy ?? 'A. Mehta') : null,
    testedAt: conclusion !== 'Not tested' ? '14 Apr' : null,
  });

/** A second source file behind a seeded population.
 *
 *  Most controls stand on one file, so this is the exception rather than the
 *  shape — but "one control, several files" has to be reachable without anyone
 *  building it by hand, or the per-file proof and the per-file draw are features
 *  nobody ever sees. See PopulationSource. */
const secondSource = (file: string, rows: number, count: number, criteria: string, drawn = true) => ({ file, rows, count, criteria, drawn });

const manualTrack = (conclusion: TrackConclusion, steps: OperatingStep[], sampling?: Sampling, popCount = 0, popSource = 'SAP — full-period extract', popFile = 'population_full_period.xlsx', extra?: ReturnType<typeof secondSource>): OperatingTrack => ({
  method: 'Manual',
  // What the population IS, recorded before it was pulled in — the row count on
  // its own never says whether it counted the right things.
  definition: popCount ? {
    basis: 'Transaction-based', instance: `One ${popSource.includes('journal') ? 'journal entry' : 'transaction'} recorded in the period`,
    expectedCount: popCount, includeRejected: false,
    rejectedNote: 'Rejections are held before the control sees them, so the control never operated on those items.',
    by: 'A. Mehta', at: '12 Apr',
  } : undefined,
  population: popCount ? {
    source: popSource, count: popCount + (extra?.count ?? 0), tieOut: 'Agreed to GL control account',
    sourceFile: popFile, sourceCount: popCount * 7 + (extra?.rows ?? 0),
    criteria: `type ${popSource.split('—')[0].trim()}`,
    // The files it stands on. Written out even for the single-file case so the
    // seeds and the application agree on one shape — populationSources() would
    // synthesise the same entry, but a seed that leaves it to a shim is a seed
    // that reads differently from anything the app itself produces.
    sources: [
      {
        id: 'src-1', file: popFile, rows: popCount * 7, count: popCount, criteria: `type ${popSource.split('—')[0].trim()}`,
        ...(sampling ? { draw: { size: extra?.drawn ? Math.ceil(sampling.size / 2) : sampling.size, method: sampling.method, seed: sampling.seed ?? 40817 } } : {}),
        // The first file is worked through and ticked. Something is always left
        // undone on the second — that is the state the call described a ten-file
        // control returning in ("चार का तुमने कर दिया था, दो बच रहा था"), and it
        // only reads as a state at all if the whole thing is not finished.
        ...(extra ? { approvedIpe: { by: 'A. Mehta', at: '13 Apr' }, ...(sampling ? { approvedSample: { by: 'A. Mehta', at: '15 Apr' } } : {}) } : {}),
      },
      ...(extra ? [{
        id: 'src-2', file: extra.file, rows: extra.rows, count: extra.count, criteria: extra.criteria,
        // A different file is a different draw, so it is a different seed. The
        // whole point of storing one is that the reviewer can reperform THIS
        // selection, and one seed shared by two draws reperforms one of them.
        ...(sampling && extra.drawn ? { draw: { size: Math.floor(sampling.size / 2), method: sampling.method, seed: 51923 } } : {}),
        // Proven, never marked. A file whose proof is done and whose draw is not
        // is the ordinary half-finished state, and the marks exist to show it.
        approvedIpe: { by: 'A. Mehta', at: '13 Apr' },
      }] : []),
    ],
    // filterFrom / filterTo / version are stamped by stampPopulationWindows once
    // the audits exist — a population belongs to ONE round and carries that
    // round's window, which cannot be known from in here.
    // expectedCount went with the "Expected instances" field (dev call, Aug
    // 2026). sourceCount above is the reference number now — the population is
    // a seventh of the file it was filtered out of, which is what a filter
    // that filtered looks like.
    // Where it came from. Not derivable from the file, so it was recorded.
    provenance: { system: `${popSource.split('—')[0].trim()} — Production`, extractedBy: 'R. Nair', extractedOn: '2026-04-12' },
    checks: { countMatches: true, dateRangeFull: true, productionSource: true },
    locked: { by: 'A. Mehta', at: '13 Apr' }, version: 'POP-YE',
    evidence: [{ id: 'ev1', name: popFile, kind: 'XLSX', uploadedBy: 'Risk Owner', uploadedAt: '12 Apr' }],
  } : undefined,
  // ── the report behind each file, proven ────────────────────────────────────
  // Seeded only where there are several files. A single-source control registers
  // its report the moment an auditor opens the step, so seeding one would be
  // seeding work the application already does — but a control that has already
  // CONCLUDED never opens that path, and its per-file proof would be a thing the
  // feature supports and nobody can look at.
  //
  // Four dimensions per file, all passed, one verdict for the lot: that is the
  // shape the call settled on ("सेंट्रलाइज्ड कर दो ना").
  ipe: popCount && extra ? {
    reportName: popFile, system: `${popSource.split('—')[0].trim()} — Production`,
    reportRef: 'FBL3N / MK03', parameters: `Company code · full period · ${popSource.split('—')[0].trim()}`,
    generatedBy: 'R. Nair — client finance', generatedAt: '12 Apr',
    recordCount: popCount * 7 + extra.rows, controlTotal: 'Agreed to the GL control account',
    checks: [
      ...ipeChecklist(popFile).map((k, i) => ({ ...k, id: `ipe-s1-${i}`, sourceId: 'src-1', result: 'Pass' as TestResult })),
      ...ipeChecklist(extra.file).map((k, i) => ({ ...k, id: `ipe-s2-${i}`, sourceId: 'src-2', result: 'Pass' as TestResult })),
    ],
    conclusion: 'Reliable', testedBy: 'A. Mehta', testedAt: '13 Apr',
  } : undefined,
  // A draw nobody can reperform is not a procedure — every seeded sample carries
  // the method and the seed that produced it.
  // Every drawn item says which file it came out of, because a control standing
  // on two files that drew from one has tested one — and a paper that cannot
  // show the split cannot show that either. Split down the middle: the seeds are
  // an illustration, not an inference about how many rows each file holds.
  sampling: sampling ? {
    ...sampling,
    seed: sampling.seed ?? 40817,
    samples: extra
      ? sampling.samples.map((s, i) => ({ ...s, sourceId: extra.drawn && i % 2 !== 0 ? 'src-2' : 'src-1' }))
      : sampling.samples,
  } : undefined,
  steps,
  conclusion,
  testedBy: conclusion !== 'Not tested' ? 'A. Mehta' : null,
  testedAt: conclusion !== 'Not tested' ? '16 Apr' : null,
});

const autoTrack = (conclusion: TrackConclusion, steps: OperatingStep[]): OperatingTrack => ({
  method: 'Automated', steps, conclusion,
  testedBy: conclusion !== 'Not tested' ? 'CCM workflows' : null,
  testedAt: conclusion !== 'Not tested' ? '16 Apr' : null,
});

/** A tested entity-produced report. The checks come from the standard
 *  checklist so a seeded paper reads exactly like one the auditor worked; the
 *  findings are what a real paper carries — the tie-out numbers, not "OK". */
let _ipe = 0;
const ipeTest = (meta: {
  reportName: string; system?: string; reportRef: string; parameters: string;
  generatedBy: string; recordCount: number; controlTotal: string; file: string;
  /** One finding per dimension, in checklist order. Period coverage joined the
   *  list in Aug 2026 and every seed pre-dates it, so a missing entry falls back
   *  rather than printing a blank finding on a check that passed. */
  findings: string[];
  /** Which dimension failed, if any — its check goes Fail and the report sinks. */
  failed?: number;
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
      // The seeds carry findings for the three original dimensions in order, so
      // Period coverage — added later, and second in the list — has none of its
      // own. It gets a finding written from the same facts its check shows on
      // screen rather than an empty cell on the paper.
      note: k.dimension === 'Period coverage'
        ? `Earliest and latest instance agreed to the audit period; every month inside it carries instances.`
        : meta.findings[i > 1 ? i - 1 : i],
    })),
    conclusion: reliable ? 'Reliable' : 'Not reliable',
    testedBy: 'A. Mehta',
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
const REVIEWER = 'J. Fernandes';
const approved = (at = '15 Apr'): RacmReview => ({ status: 'Approved', by: REVIEWER, at });
const remark = (text: string, at = '15 Apr'): RacmReview => ({ status: 'Remark', remark: text, by: REVIEWER, at });

// ── the richly-detailed P2P controls (drive the dossier) ─────────────────────────
const DETAILED: Control[] = [
  {
    id: 'P2P-C-01', wpRef: 'P-01', description: 'Vendor master additions and bank-detail changes require dual approval before activation.',
    process: 'Procure to Pay', subProcess: 'Vendor master', nature: 'Automated', type: 'Preventive', frequency: 'Recurring', isKey: true,
    precision: 'Any change to a vendor bank account is blocked until a second authoriser approves in SAP.',
    controlActivity: 'R. Khanna (Master Data) raises every vendor addition and bank-detail change in SAP S/4HANA against the signed vendor request form and the bank confirmation letter. The record stays inactive until a second Master Data authoriser, independent of the raiser, approves the change in the workflow; the approval log is the evidence. Nothing pays out of an unapproved record.',
    owner: 'R. Khanna', riskId: 'R-12', riskDescription: 'Fraudulent or erroneous payments to fictitious or altered vendor bank accounts.',
    rootCause: 'Vendor bank details can be edited in the master record by the same team that raises the payment run, so a single person can redirect a genuine payable.',
    auditSteps: [
      'Obtain the SAP role matrix for the vendor-master transactions (XK01 / XK02) and identify every user holding create and approve.',
      'Obtain the vendor change log for the period and agree the record count to the system total.',
      'For each sampled change, inspect the workflow approval and confirm the approver is a different user from the requester.',
      'Attempt a bank-detail change as the requester in the QA client and confirm the activation block holds.',
      'Confirm the change log is retained and cannot be edited by the master-data team.',
    ],
    objective: 'Payments reach only the vendor the business actually contracted with.', clazz: 'Financial' as const,
    riskRating: 'High',
    performedBy: 'AM', wpRefHard: 'P2P/01', wpRefSoft: '/FY26/ICFR/P2P/P-01 vendor master/', reportRef: '4.1',
    assertions: ['Existence / Occurrence', 'Rights & Obligations'],
    racmReview: approved(),
    // fully through the review gate — signed and countersigned, the paper is final
    wpSignoff: { preparer: { by: 'A. Mehta', at: '17 Apr' }, reviewer: { by: REVIEWER, at: '18 Apr' } },
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
    owner: 'S. Iyer', riskId: 'R-08', riskDescription: 'Unauthorised commitments / purchases outside delegated authority.',
    rootCause: 'The delegation-of-authority matrix is maintained offline and was last refreshed before two reorganisations, so SAP still routes some orders to authority tiers that no longer exist.',
    auditSteps: [
      'Obtain the signed delegation-of-authority matrix in force for FY26 and agree the tiers to the current org structure.',
      'Extract the PO release log (ME2N) for the period and validate it as information produced by the entity.',
      'For each sampled PO, inspect the approval trail and agree the approving tier to the order value per the matrix.',
      'Confirm from the delegation register that the approver held that authority on the approval date.',
      'Re-perform the release-timing check to confirm no order released before its approval timestamp.',
    ],
    objective: 'The group commits money only at the authority level the delegation matrix allows.', clazz: 'Financial' as const,
    riskRating: 'High',
    performedBy: 'AM', wpRefHard: 'P2P/02', wpRefSoft: '/FY26/ICFR/P2P/P-02 purchasing/', reportRef: '4.2',
    assertions: ['Existence / Occurrence', 'Accuracy'],
    racmReview: approved(), testDueInDays: 0,
    design: designTrack('Effective', [
      doc('Process narrative', 'Purchasing narrative v2.pdf', 'Received'),
      doc('Flowchart', 'PO approval flowchart.pdf', 'Received'),
      doc('Walkthrough', 'Walkthrough — 10 Apr.pdf', 'Received'),
      doc('Policy / SOP', 'Delegation-of-authority matrix FY26.xlsx', 'Received'),
      // The client has no segregation matrix for the release strategy, so there is
      // no file to chase — the audit team derived it on the walkthrough call and
      // agreed it with the process owner. A judgement, recorded, not a gap.
      waivedDoc('Segregation of duties', 'Prepared by the audit team',
        'Procurement holds no segregation matrix for the release strategy. Drawn from the 10 Apr walkthrough against the SAP role assignments and agreed with S. Iyer; retained at /FY26/ICFR/P2P/P-02 purchasing/SoD-derived.xlsx.'),
    ], [
      point('DoA tiers map to current org and signing limits.'),
      point('System enforces tier by PO value (not advisory).'),
    ]),
    // the population came out of a client-run report, so the report is tested first
    operating: { ...manualTrack('Not tested', [
      step('B1', 'PO approved at the tier matching its value per the DoA matrix.', 'Existence / Occurrence', 'Per PO', ['Inspection', 'Reperformance'], 'Pass', attest('Approval screenshots for all 25 sampled POs attached; each shows the correct tier per the DoA matrix.', 'S. Iyer', ['PO_approval_screens_25_samples_Apr26.pdf', 'DoA_matrix_FY26_v2_signed.xlsx'])),
      step('B2', 'Approver held the delegated authority on the approval date.', 'Existence / Occurrence', 'Per PO', ['Inspection'], 'Pass', attest('Delegation register extract confirms authority held on each approval date.', 'S. Iyer', ['Delegation_register_extract_01-30Apr26.pdf'])),
      step('B3', 'No release before approval timestamp.', 'Accuracy', 'Per PO', ['Reperformance'], 'Not tested', { ...wf('wf-po-release-timing', 'PO release-timing check', undefined), evidenceMode: 'ai', aiValidation: true, inputFile: file('ME2N_release_timing_extract_Apr26.csv', 'S. Iyer', 'CSV') }),
    ], sampling(25, '25 POs — daily manual control, moderate reliance (handbook — no fixed minimum, judgment documented).', 'Random', 0, PO_SAMPLE_REFS), 2640, 'SAP ECC — ME2N PO release log, FY26 YTD (POs 4500012840–4500013008)', 'ME2N_PO_release_log_FY26_YTD.xlsx'),
      ipe: ipeTest({
        reportName: 'PO release log',
        reportRef: 'ME2N',
        parameters: 'Company code AG01 · document types NB, FO · release date 01 Apr 2026 – 31 Mar 2027 · all purchasing groups',
        generatedBy: 'S. Iyer',
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
    owner: 'M. Nair', riskId: 'R-05', riskDescription: 'Payment for goods not received or at incorrect price.',
    rootCause: 'Tolerance limits were set centrally years ago in absolute rupees and never indexed, so on high-value spares an out-of-tolerance price difference still falls inside the limit and passes the match.',
    auditSteps: [
      'Obtain the MM tolerance configuration export and agree the quantity and price limits to the approved policy.',
      'Extract the invoice register (MIR5) for the period and validate it as information produced by the entity.',
      'For each sampled invoice, agree quantity and price to the PO and the goods receipt, and re-perform the tolerance calculation.',
      'Obtain the blocked-invoice report and confirm every held line was cleared or rejected by the buyer with evidence.',
      'Confirm no held invoice was paid before clearance by agreeing the payment date to the clearance date.',
    ],
    objective: 'The group pays only for goods it ordered and received, at the price it agreed.', clazz: 'Financial' as const,
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
      step('C1', 'Quantity and price agree to PO and GRN within tolerance.', 'Accuracy', 'Per invoice', ['Reperformance', 'Inspection'], 'Not tested', { evidenceMode: 'ai', aiValidation: true, inputFile: file('MIRO_invoice_register_01-30Apr26.csv', 'M. Nair', 'CSV') }),
      step('C2', 'Tolerance breaches are held and cleared with evidence.', 'Existence / Occurrence', 'Per exception', ['Inspection'], 'Not tested', { evidenceMode: 'ai', aiValidation: true, inputFile: file('Tolerance_breach_hold_report_Apr26.xlsx', 'M. Nair', 'XLSX') }),
    ], undefined, 0),
  },
  {
    id: 'P2P-C-04', wpRef: 'P-04', description: 'Duplicate-invoice block prevents posting of invoices matching an existing reference.',
    process: 'Procure to Pay', subProcess: 'Invoice processing', nature: 'Automated', type: 'Preventive', frequency: 'Recurring', isKey: true,
    precision: 'SAP blocks postings where vendor + invoice number + amount match an existing document.',
    controlActivity: 'The duplicate-invoice check is configured in SAP S/4HANA and runs on every invoice as it is posted, comparing vendor, invoice number and amount against documents already on the ledger. A match is blocked at posting; the block log is the evidence. M. Nair (Accounts Payable) reviews the log and releases only after confirming the second document is genuine.',
    owner: 'M. Nair', riskId: 'R-06', riskDescription: 'Duplicate payments to vendors.',
    rootCause: 'The duplicate check compares the invoice reference as typed, so any formatting difference — a leading zero, a trailing space — reads as a new document and clears the block.',
    auditSteps: [
      'Obtain the SAP duplicate-check configuration and confirm the match key includes vendor, reference and amount.',
      'Confirm the check is active across every company code in scope.',
      'Re-perform the exact-match test over the period postings and confirm nil duplicates cleared.',
      'Re-perform the test on reference variants — leading zeros, trailing spaces, case differences — and quantify anything that posted.',
      'For each variant duplicate found, trace to the payment run and establish whether cash left the business.',
    ],
    objective: 'No invoice is paid twice.', clazz: 'Financial' as const,
    riskRating: 'Medium',
    performedBy: 'AM', wpRefHard: 'P2P/04', wpRefSoft: '/FY26/ICFR/P2P/P-04 duplicate block/', reportRef: '4.4',
    assertions: ['Existence / Occurrence', 'Accuracy'],
    racmReview: approved(),
    // concluded ineffective, paper signed — sitting in the reviewer's court
    wpSignoff: { preparer: { by: 'A. Mehta', at: '16 Apr' } },
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
    owner: 'D. Rao', riskId: 'R-19', riskDescription: 'Unauthorised or erroneous manual adjustments to AP.',
    rootCause: 'The review was designed around the month-end reporting pack rather than the posting itself, so it happens after the journal has already hit the ledger.',
    auditSteps: [
      'Obtain the manual-journal narrative and walk the review step with the Controller.',
      'Extract the manual journal register (FB03) for the period and validate it as information produced by the entity.',
      'For each sampled journal, compare the review sign-off date to the posting date.',
      'Confirm the reviewer is independent of the preparer on every sampled journal.',
      'Agree the journal population to the ledger to establish whether the review covered all of it.',
    ],
    objective: 'Manual journals reach the ledger only once someone independent of the preparer has agreed them.', clazz: 'Financial' as const,
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
      step('E1', 'Journal reviewed and signed before posting date.', 'Accuracy', 'Per journal', ['Inspection'], 'Not tested', { evidenceMode: 'ai', aiValidation: true, inputFile: file('FB50_manual_journal_register_Apr26.csv', 'D. Rao', 'CSV') }),
      step('E2', 'Population of manual journals is complete.', 'Completeness', 'Per period', ['Reperformance', 'Inspection']),
    ], undefined, 0),
  },
  {
    id: 'P2P-C-06', wpRef: 'P-06', description: 'Goods-receipt cut-off: receipts at period-end are recorded in the correct period.',
    process: 'Procure to Pay', subProcess: 'Period close', nature: 'Manual', type: 'Detective', frequency: 'Monthly', isKey: false,
    precision: 'Receipts in the last/first 5 days are checked to GRN dates for correct-period recording.',
    controlActivity: 'M. Nair (Accounts Payable) takes the goods-receipt listing for the last five days of the period and the first five of the next, and agrees each line to the GRN date and the carrier documentation. Receipts recorded in the wrong period are reclassified before close; the reviewed listing carries dated sign-off as evidence.',
    owner: 'M. Nair', riskId: 'R-21', riskDescription: 'Goods/liabilities recorded in the wrong period (cut-off).',
    rootCause: 'Receiving sites post goods receipts from paper docket books the next working day, so the recorded date follows the data-entry date rather than the date the goods arrived.',
    auditSteps: [
      'Obtain the cut-off narrative and confirm the review window is defined and applied consistently.',
      'Extract the goods-receipt listing for the five days either side of period end.',
      'Agree each sampled line to the GRN date and the carrier documentation.',
      'Confirm anything recorded in the wrong period was reclassified before close.',
    ],
    objective: 'Goods received before the period ends are recorded in that period.', clazz: 'Financial' as const,
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
    owner: 'M. Nair', riskId: 'R-24', riskDescription: 'Unreconciled goods-received/invoice-received balances misstate liabilities.',
    rootCause: 'Ageing the GR/IR account is a month-end housekeeping task with no owner named in the close calendar, so it slips whenever close is compressed.',
    objective: 'The GR/IR account holds only genuine in-transit items, and they are cleared within policy.', clazz: 'Operational' as const,
    riskRating: 'Low',
    performedBy: 'RS', wpRefHard: 'P2P/07', wpRefSoft: '/FY26/ICFR/P2P/P-07 GR-IR ageing/', reportRef: '4.7',
    assertions: ['Completeness', 'Accuracy'],
    racmReview: remark('Row is incomplete — no design documents or test attributes defined yet. Complete the RACM row, then resubmit for approval.'),
    design: designTrack('Not tested', [], []),
    operating: manualTrack('Not tested', [], undefined, 0),
  },
];

// ── walkthroughs — the design proved on one transaction ──────────────────────────
// Attached after the rows are built, not inside them: the results are keyed by
// attribute id, and the ids are generated as the rows are read. Mapping over each
// control's own steps here means the seed can never drift from the attributes it
// claims to have tested. Only rows whose design has actually been concluded carry
// one — an untested row shows the "not started" state, which is the first thing a
// new audit should see.
// Attendees are the ONE place a name still carries what the person does. It is
// the client's side of the room, and the paper has to say in what capacity they
// answered — the auditor's own name needs no such tag, everyone knows who tested.
const WALKED: Record<string, { attendees: string[]; notes: string; failCode?: string }> = {
  'P2P-C-01': { attendees: ['R. Khanna · Vendor Master Lead', 'P. Nair · IT Applications'], notes: 'Walked a live bank-detail change end to end. SAP held the change in a pending state until a second user with a distinct role released it, and the change log kept both user ids.' },
  'P2P-C-02': { attendees: ['S. Iyer · Procurement', 'M. Desai · Buyer'], notes: 'Walked a ₹42L purchase order. It routed to the tier the value demands and could not be released until that tier approved; the buyer had no override.' },
  'P2P-C-03': { attendees: ['R. Subramanian · AP Lead'], notes: 'Walked an invoice through the three-way match. Quantity and price were matched against the PO and the goods receipt, and the block held until the difference was cleared.' },
  'P2P-C-04': { attendees: ['R. Subramanian · AP Lead', 'P. Nair · IT Applications'], notes: 'Walked a deliberate re-key of a paid invoice. The duplicate block caught the exact reference, but a re-key with a leading zero passed — recorded as the design concern the sample then quantified.' },
  // Design concluded ineffective: the walkthrough is where that was found. The
  // review happens after the journal has already posted, so the attribute that
  // asks whether it prevents the misstatement fails on a real transaction.
  'P2P-C-05': { attendees: ['D. Rao · Controller', 'A. Fernandes · Financial Reporting'], notes: 'Walked a month-end manual journal. The reviewer signed the reporting pack after the journal had already hit the ledger, so the control detects rather than prevents — and on this transaction it detected nothing.', failCode: 'E1' },
};
/** The four judgements the paper states, per row. Only the rows whose design has
 *  been concluded carry them — a judgement recorded before the work is a default
 *  dressed as an opinion. The manual-journal row is the interesting one: its
 *  description never answers WHEN the review happens relative to the posting, and
 *  a detective control cannot prevent the misstatement, which is precisely why its
 *  design concluded ineffective. */
const JUDGED: Record<string, { missing?: FiveWOneH[]; freq: boolean; type: boolean; comp?: string; note: string }> = {
  'P2P-C-01': { freq: true, type: true, note: 'Runs on every change, blocks before the change takes effect — a preventive control at the point the risk arises.' },
  'P2P-C-02': { freq: true, type: true, note: 'Release is blocked until the correct tier approves, so the money is never committed at the wrong level.' },
  'P2P-C-03': { freq: true, type: true, comp: 'P2P-C-04', note: 'Runs per invoice at the point of payment. The duplicate block catches a different failure on the same population, so the two read together.' },
  'P2P-C-04': { freq: true, type: true, comp: 'P2P-C-03', note: 'Automated block on every posting. The three-way match covers the price and quantity exposure the block does not.' },
  'P2P-C-05': { missing: ['When'], freq: true, type: false, note: 'The description does not say the review happens before posting, and on the walked transaction it did not — the journal was already in the ledger. A detective control cannot prevent this misstatement; the design has to become preventive.' },
};
for (const c of DETAILED) {
  const j = JUDGED[c.id];
  if (j && c.design.conclusion !== 'Not tested') {
    c.design.judgements = {
      coverage: Object.fromEntries(FIVE_W_1H.map(a => [a.k, !(j.missing ?? []).includes(a.k)])),
      compensatingControlId: j.comp,
      frequencyAppropriate: j.freq,
      typeAppropriate: j.type,
      note: j.note,
      by: c.performedBy === 'RS' ? 'R. Subramanian' : 'A. Mehta',
      at: '11 Apr',
    };
  }
  const w = WALKED[c.id];
  if (!w || c.design.conclusion === 'Not tested' || c.operating.steps.length === 0) continue;
  c.design.walkthrough = {
    sampleRef: sampleRefs(c.process, 1)[0] ?? '#1000',
    date: '11 Apr',
    tester: c.performedBy === 'RS' ? 'R. Subramanian' : 'A. Mehta',
    attendees: w.attendees,
    attributeResults: Object.fromEntries(c.operating.steps.map(s => [s.id, (w.failCode === s.code ? 'Fail' : 'Pass') as TestResult])),
    notes: w.notes,
    startedBy: c.performedBy === 'RS' ? 'R. Subramanian' : 'A. Mehta',
    startedAt: '11 Apr',
  };
}

// ── generator — fills the register to scale ──────────────────────────────────────
// Each spread carries its process's real risk register: a few risk-phrased
// statements, each covering the controls (by title index) that answer it. Both
// generation batches map a title to the SAME risk, so the Risk Register groups
// base + station controls under one risk instead of minting one risk per control.
type SpreadRisk = { id: string; text: string; covers: number[] };
type Spread = { process: string; prefix: string; wp: string; subs: string[]; titles: string[]; owner: string; risks: SpreadRisk[] };
const SPREADS: Spread[] = [
  { process: 'Order to Cash', prefix: 'O2C', wp: 'O', owner: 'P. Sharma', subs: ['Credit', 'Billing', 'Collections', 'Revenue recognition'], titles: [
    'Credit limits are approved before order release', 'Sales invoices priced from the approved price master', 'Revenue cut-off at period-end agrees to dispatch', 'Credit notes are approved before issue', 'Customer master changes are independently reviewed', 'AR ageing reviewed and provisioned monthly', 'Manual revenue journals are reviewed before posting', 'Cash receipts applied to correct customer accounts', 'Disputed receivables escalated per policy', 'Rebates accrued per contract terms' ],
    risks: [
      { id: 'R-40', text: 'Sales released to customers beyond approved credit limits.', covers: [0] },
      { id: 'R-41', text: 'Customers billed at incorrect prices or terms.', covers: [1] },
      { id: 'R-42', text: 'Revenue recorded in the wrong period or without basis (cut-off).', covers: [2, 6] },
      { id: 'R-43', text: 'Revenue overstated through unapproved credit notes or unaccrued rebates.', covers: [3, 9] },
      { id: 'R-44', text: 'Receivables overstated — uncollectable or disputed balances not provisioned.', covers: [5, 8] },
      { id: 'R-45', text: 'Cash receipts misapplied or customer master data manipulated.', covers: [4, 7] },
    ] },
  { process: 'Record to Report', prefix: 'R2R', wp: 'R', owner: 'D. Rao', subs: ['Journals', 'Reconciliations', 'Close', 'Consolidation'], titles: [
    'Balance-sheet reconciliations reviewed monthly', 'Manual journals approved before posting', 'Intercompany balances agreed and eliminated', 'FX revaluation reviewed at month-end', 'Close checklist completed and signed', 'Consolidation entries reviewed', 'Accruals supported and approved', 'Suspense accounts cleared within policy', 'Trial balance mapped to FS line items', 'Management review of flux analysis' ],
    risks: [
      { id: 'R-50', text: 'Unsupported or unauthorised journals and accruals misstate the ledger.', covers: [1, 6] },
      { id: 'R-51', text: 'Account balances unreconciled or parked in suspense unexplained.', covers: [0, 7] },
      { id: 'R-52', text: 'Intercompany and consolidation entries misstate group results.', covers: [2, 5] },
      { id: 'R-53', text: 'Period close performed incompletely or without review.', covers: [4, 9] },
      { id: 'R-54', text: 'Foreign-currency balances revalued incorrectly.', covers: [3] },
      { id: 'R-55', text: 'Trial balance mis-mapped to financial-statement lines.', covers: [8] },
    ] },
  { process: 'Inventory', prefix: 'INV', wp: 'I', owner: 'K. Bose', subs: ['Costing', 'Counts', 'Provisions'], titles: [
    'Standard costs reviewed and approved', 'Cycle counts performed and variances investigated', 'Slow-moving provision calculated and reviewed', 'Inventory movements restricted to authorised users', 'Net realisable value assessed at period-end', 'GRN matched to physical receipt' ],
    risks: [
      { id: 'R-60', text: 'Inventory valued incorrectly — cost, obsolescence or net realisable value.', covers: [0, 2, 4] },
      { id: 'R-61', text: 'Recorded inventory does not exist or receipts do not match physical stock.', covers: [1, 5] },
      { id: 'R-62', text: 'Unauthorised inventory movements misstate stock.', covers: [3] },
    ] },
  { process: 'Treasury', prefix: 'TRY', wp: 'T', owner: 'A. Verma', subs: ['Payments', 'Banking', 'Investments'], titles: [
    'Payment runs approved by two authorisers', 'Bank reconciliations reviewed monthly', 'New payee setup independently verified', 'Borrowing within board-approved limits', 'FX deals confirmed independently of dealing' ],
    risks: [
      { id: 'R-70', text: 'Payments released without dual authorisation or to unverified payees.', covers: [0, 2] },
      { id: 'R-71', text: 'Bank balances misstated through unreconciled differences.', covers: [1] },
      { id: 'R-72', text: 'Treasury exposures taken outside board-approved limits.', covers: [3, 4] },
    ] },
  { process: 'Payroll', prefix: 'PAY', wp: 'Y', owner: 'N. Pillai', subs: ['Masterdata', 'Processing'], titles: [
    'Joiner/leaver changes approved before payroll run', 'Payroll reconciled to GL each cycle', 'Overtime approved before payment', 'Statutory deductions reconciled and remitted' ],
    risks: [
      { id: 'R-75', text: 'Fictitious, departed or unapproved employees paid.', covers: [0] },
      { id: 'R-76', text: 'Payroll costs unapproved or unreconciled to the ledger.', covers: [1, 2] },
      { id: 'R-77', text: 'Statutory deductions under-remitted, exposing penalties.', covers: [3] },
    ] },
  { process: 'Tax', prefix: 'TAX', wp: 'X', owner: 'S. Gupta', subs: ['Direct', 'Indirect'], titles: [
    'GST returns reviewed before filing', 'Tax provision reviewed by tax lead', 'TDS reconciled to GL and remitted' ],
    risks: [
      { id: 'R-80', text: 'Indirect-tax filings incorrect, late or unreconciled.', covers: [0, 2] },
      { id: 'R-81', text: 'Tax provision materially misstated.', covers: [1] },
    ] },
  { process: 'IT General Controls', prefix: 'ITGC', wp: 'G', owner: 'V. Menon', subs: ['Access', 'Change', 'Operations'], titles: [
    'Privileged access reviewed quarterly', 'User access granted via approved request', 'Terminated users disabled within 24h', 'Program changes tested and approved before deploy', 'Emergency changes reviewed post-implementation', 'Batch job failures monitored and resolved', 'Database backups completed and tested', 'Segregation-of-duties conflicts reviewed' ],
    risks: [
      { id: 'R-85', text: 'Unauthorised or excessive access to financial systems.', covers: [0, 1, 2, 7] },
      { id: 'R-86', text: 'Unauthorised or untested changes reach production.', covers: [3, 4] },
      { id: 'R-87', text: 'Processing failures or data loss corrupt financial data.', covers: [5, 6] },
    ] },
];
const riskFor = (sp: Spread, titleIdx: number): SpreadRisk =>
  sp.risks.find(r => r.covers.includes(titleIdx)) ?? sp.risks[0]!;

/**
 * WHAT THE CONTROL IS FOR, one per risk.
 *
 * The objective is the outcome management is securing; the risk is what happens
 * if it isn't secured. They are the same sentence from opposite ends, which is
 * why this is keyed by risk id rather than written per control — every control
 * answering one risk is aimed at one outcome. Written in the flagship's voice:
 * plain, positive, and about the business rather than the paperwork.
 */
const OBJECTIVE_BY_RISK: Record<string, string> = {
  'R-40': 'Customers can only take on what the business has agreed to let them owe.',
  'R-41': 'What a customer is billed is what the approved price list says.',
  'R-42': 'Revenue lands in the period the goods actually left.',
  'R-43': 'Revenue is only given back where someone with the authority agreed to give it back.',
  'R-44': 'The receivables balance reflects what will realistically be collected.',
  'R-45': 'Money received is credited to the customer who sent it.',
  'R-50': 'Nothing reaches the ledger that a second person has not agreed to.',
  'R-51': 'Every balance is explained by something outside the ledger.',
  'R-52': 'Group results carry no balance that is really the group owing itself.',
  'R-53': 'The books are closed completely, in order, and by the date agreed.',
  'R-54': 'Foreign-currency balances are stated at the rate that actually applies.',
  'R-55': 'Each ledger balance lands on the financial-statement line it belongs to.',
  'R-60': 'Stock is carried at what it is genuinely worth.',
  'R-61': 'The stock on the books is the stock in the warehouse.',
  'R-62': 'Stock only moves on an instruction someone was entitled to give.',
  'R-70': 'Money leaves the group only to a payee two people agreed to pay.',
  'R-71': 'The bank balance on the books is the balance at the bank.',
  'R-72': 'Treasury exposure stays inside the limits the board set.',
  'R-75': 'Only people who actually work here get paid.',
  'R-76': 'Payroll cost in the ledger is the payroll that was approved and run.',
  'R-77': 'What is deducted from pay reaches the authority it is owed to.',
  'R-80': 'Indirect-tax filings are right, reconciled and on time.',
  'R-81': 'The tax charge is what the position at the year end genuinely supports.',
  'R-85': 'Only the people who need access to the financial systems have it.',
  'R-86': 'Nothing reaches production that was not tested and approved first.',
  'R-87': 'Financial data survives processing intact, and failures are noticed.',
};

/** Processes outside the catalogue get one generic risk, so they get one
 *  generic objective — still a purpose rather than a restatement of the title. */
const objectiveFor = (riskId: string, process: string): string =>
  OBJECTIVE_BY_RISK[riskId]
  ?? `${process} balances are complete, accurate, and recorded in the period they belong to.`;

/**
 * Preventive or detective, read off what the control actually does.
 *
 * A control that stops the thing happening is preventive; one that finds it
 * afterwards is detective. Reconciliations, reviews, cut-off checks and
 * escalations are all after the fact — which is the same line the flagship's
 * hand-written controls draw (its three-way match and GR/IR review are both
 * detective). Derived rather than stored because the title already says it, and
 * a register where all 45 rows read "Preventive" tells a reader nothing.
 */
const DETECTIVE = /reconcil|review|monitor|escalat|ageing|cut-off|verification results|investigat|cleared|failures/i;
const typeOf = (title: string): ControlType => (DETECTIVE.test(title) ? 'Detective' : 'Preventive');

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
        isKey: i % 4 !== 0, clazz: classOf(sp.process), precision: `${title} — operates to prevent or detect the risk at transaction level.`,
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
            ? { preparer: { by: 'A. Mehta', at: '18 Apr' } }
            : { preparer: { by: 'A. Mehta', at: '18 Apr' }, reviewer: { by: REVIEWER, at: '19 Apr' } })
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
    { id: 'c1', by: 'A. Mehta', role: 'auditor', at: '2d', text: 'Two of the 25 sampled POs were approved a tier below the DoA. Can you confirm whether a delegation was in force on those dates?' },
    { id: 'c2', by: 'S. Iyer', role: 'risk-owner', at: '1d', text: 'There was a temporary delegation during the Director’s leave — letter attached in the PBC. The system tier wasn’t updated though.' },
    { id: 'c3', by: 'J. Fernandes', role: 'auditor', at: '4h', text: 'If the system tier wasn’t updated, treat as an operating exception and assess severity even with the delegation letter.' },
  ] },
  { id: 'disc-2', controlId: 'P2P-C-04', anchor: 'operating', resolved: false, comments: [
    { id: 'c4', by: 'A. Mehta', role: 'auditor', at: '3d', text: 'The duplicate block misses reference variants (leading zeros). 4 duplicates posted. Raising as a deficiency — see DEF-001.' },
  ] },
  { id: 'disc-3', controlId: 'P2P-C-05', anchor: 'design', resolved: false, comments: [
    { id: 'c5', by: 'A. Mehta', role: 'auditor', at: '2d', text: 'Walkthrough shows the FC reviews after posting, not before. That’s a design gap — the control can’t prevent an erroneous posting.' },
    { id: 'c6', by: 'D. Rao', role: 'risk-owner', at: '1d', text: 'Agreed. We’re moving review to a pre-posting hold from next cycle.' },
  ] },
];

const TASKS: HandoffTask[] = [
  { id: 'PBC-3', type: 'pbc', controlId: 'P2P-C-02', title: 'Provide PO release-timing extract (attribute B3)', detail: 'TOE evidence for B3 — no release before approval timestamp. Upload ME2N_release_timing_extract_Apr26.csv from SAP.', assignee: 'S. Iyer', assigneeRole: 'risk-owner', raisedBy: 'A. Mehta', dueLabel: 'Due today', overdue: false, status: 'open' },
  { id: 'PBC-1', type: 'pbc', controlId: 'P2P-C-06', title: 'Provide cut-off narrative & flowchart', detail: 'Design documents needed to start TOD on goods-receipt cut-off (Cutoff_narrative_FY26.pdf, GR_cutoff_flowchart.pdf).', assignee: 'M. Nair', assigneeRole: 'risk-owner', raisedBy: 'A. Mehta', dueLabel: 'Due today', overdue: false, status: 'open' },
  { id: 'PBC-2', type: 'pbc', controlId: 'P2P-C-03', title: 'Provide tolerance configuration export', detail: 'Control-description evidence for three-way match tolerances.', assignee: 'M. Nair', assigneeRole: 'risk-owner', raisedBy: 'A. Mehta', dueLabel: 'Overdue 1d', overdue: true, status: 'open' },
  { id: 'REM-1', type: 'remediation', controlId: 'P2P-C-04', title: 'Extend duplicate-match key to normalise references', detail: 'Strip leading zeros / whitespace before match. Re-test after deploy.', assignee: 'M. Nair', assigneeRole: 'risk-owner', raisedBy: 'A. Mehta', dueLabel: 'Due 30 Jun', overdue: false, status: 'open' },
];

const DEFICIENCIES: Deficiency[] = [
  // DEF-001 was found by sampling — the control is designed correctly and did not
  // operate. Four variant duplicates posted in the period; the magnitude is what
  // could have been misstated, which is the only number the ladder reads.
  //
  // PARKED (Aug 2026) — the gap type and the priced impact both left the record;
  // see the banners in types.ts. Kept here so the seed can be restored with them:
  //   gapType: 'TG',
  //   exposure: { recovery: 740_000, workingCapital: 440_000, leakage: 0, basis: '4 variant duplicates totalling ₹11.8L. 2 reached payment (₹7.4L) and are recoverable from the vendors by debit note; 2 (₹4.4L) were stopped before the payment run and release working capital on cancellation. Nothing has left the business permanently.' },
  { id: 'DEF-001', controlId: 'P2P-C-04', track: 'operating', description: 'Duplicate-invoice block does not catch reference variants (leading zeros / whitespace); 4 variant duplicates posted in period.', rootCause: 'Match key compares raw reference without normalisation.', likelihood: 'Reasonably possible', magnitude: 1_180_000, mwIndicators: [], compensatingControlId: undefined, aggregationGroup: 'AP payments', reportRef: '4.4',
    remediation: { action: 'Normalise reference in match key; re-test.', date: '30 Jun', owner: 'M. Nair', status: 'In progress' }, status: 'Remediation' },
  // DEF-002 was found in the walkthrough, on a manual control — the review sits
  // after the posting it is meant to stop. Nothing has gone wrong yet; the number
  // is what could pass unchecked in a month of manual journals.
  //
  // PARKED (Aug 2026) — as above:
  //   gapType: 'MDG',
  //   exposure: { recovery: 0, workingCapital: 0, leakage: 640_000, basis: 'No error identified in the period. Priced at the average monthly value of manual AP journals posted without prior review (₹6.4L) — the amount that could reach the ledger unchecked before the next review cycle catches it.' },
  { id: 'DEF-002', controlId: 'P2P-C-05', track: 'design', description: 'Manual AP journal review occurs after posting, so the control cannot prevent an erroneous or unauthorised posting.', rootCause: 'Review step placed post-posting in the process design.', likelihood: 'Reasonably possible', magnitude: 640_000, mwIndicators: [], compensatingControlId: undefined, aggregationGroup: 'AP close', reportRef: '4.5',
    remediation: { action: 'Move review to a pre-posting hold.', date: null, owner: 'D. Rao', status: 'Open' }, status: 'Identified' },
];

// ── review notes — one at each lifecycle stage, so every hat sees its move ───────
const REVIEW_NOTES: ReviewNote[] = [
  // open — blocks P2P-C-04's countersign until the auditor responds and the reviewer verifies
  { id: 'rn-1', controlId: 'P2P-C-04', text: 'The paper concludes on reference-variant duplicates but doesn’t evidence which variants were in the sample — attach the variant list behind D2.', raisedBy: REVIEWER, raisedAt: '2d', status: 'Open' },
  // resolved — waiting on the reviewer's verification (R2R-C-03 sits in the queue)
  { id: 'rn-2', controlId: 'R2R-C-03', text: 'Elimination entries are agreed, but the paper doesn’t show the out-of-balance items over the ₹1L threshold were investigated.', raisedBy: REVIEWER, raisedAt: '3d', status: 'Resolved', resolution: { text: 'Added the intercompany break report — all 3 items over threshold traced to timing differences, cleared in Apr close.', by: 'A. Mehta', at: '1d' } },
  // closed — the full raise → resolve → verify history on the final P2P-C-01 paper
  { id: 'rn-3', controlId: 'P2P-C-01', text: 'Confirm the approver-segregation check covers emergency changes routed outside SAP.', raisedBy: REVIEWER, raisedAt: '6d', status: 'Closed', resolution: { text: 'Emergency changes land in the same vendor-master change log — run #4821 covers them; noted in the walkthrough.', by: 'A. Mehta', at: '5d' }, verified: { by: REVIEWER, at: '5d' } },
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
  ex('P2P-C-02', 'operating', 'attest', 'self-attested', 'S. Iyer', 'risk-owner', '2d', 'B1'),
  ex('P2P-C-02', 'operating', 'attest', 'self-attested', 'S. Iyer', 'risk-owner', '2d', 'B2'),
  ex('P2P-C-04', 'operating', 'conclude', 'concluded operating ineffective', 'A. Mehta', 'auditor', '3d', undefined, 'Ineffective'),
  ex('P2P-C-04', 'operating', 'validate', 'validated', 'A. Mehta', 'auditor', '3d', 'D2', 'Fail'),
  ex('P2P-C-04', 'operating', 'validate', 'validated', 'A. Mehta', 'auditor', '3d', 'D1', 'Pass'),
  ex('P2P-C-01', 'operating', 'conclude', 'concluded operating effective', 'A. Mehta', 'auditor', '4d', undefined, 'Effective'),
  ex('P2P-C-01', 'operating', 'pull-run', 'pulled a workflow run', 'A. Mehta', 'auditor', '4d', 'A1'),
  ex('P2P-C-01', 'design', 'conclude', 'concluded design effective', 'A. Mehta', 'auditor', '5d', undefined, 'Effective'),
  ex('P2P-C-01', 'design', 'validate', 'validated 3 considerations', 'A. Mehta', 'auditor', '5d'),
  ex('P2P-C-01', 'design', 'receive-doc', 'provided', 'R. Khanna', 'risk-owner', '6d', 'Walkthrough'),
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
    by: 'A. Mehta', role: 'auditor', at: '3d ago',
  },
  {
    id: 'run-s2', kind: 'workflow-run', label: 'Workflow run — Approver-segregation check',
    detail: 'run #4821 · 0 conflicts',
    controls: [runOutcome('P2P-C-01', 'Effective')],
    by: 'A. Mehta', role: 'auditor', at: '4d ago',
  },
  {
    id: 'run-s1', kind: 'control-test', label: 'Control test — 2 controls',
    detail: 'Scoping run across PO approval and vendor master controls',
    controls: [runOutcome('P2P-C-01', 'Effective'), runOutcome('P2P-C-02', 'Effective')],
    datasets: ['PO release log (ME2N)', 'Vendor master snapshot'],
    by: 'A. Mehta', role: 'auditor', at: '6d ago',
  },
];

const ENGAGEMENT: IcfrEngagement = {
  id: 'eng-1', code: 'ICFR-26', name: 'FY26 ICFR — Airline P2P & O2C', entity: 'Airline Group Ltd', framework: 'COSO 2013 / SOX 404',
  periodStart: '01 Apr 2025', periodEnd: '31 Mar 2026',
  materiality: 5_000_000, performanceMateriality: 3_750_000, preparer: 'A. Mehta', reviewer: 'J. Fernandes',
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
  // Starts empty on purpose: an audit arrives when someone runs the New audit
  // sheet from the Overview or the SOX audit tab, so the register's empty state
  // is the honest first view. Until then every reader falls back to
  // engagement-level defaults — useAuditControls returns the whole control set,
  // periodLine reads the engagement's own span.
  audits: [],
  signoff: {},
  rulesLog: [],
};

// ── the library lens's seed: run history + the cycles it ran under ───────────────
// The Control Library's library lens reads four facts off a control — how many
// attributes it has, how many of them a workflow evidences, what has been run on
// it, and which audits it sits in. The first two come off the control itself
// (`rich` on racmTemplateForProcesses); these two build the last two.

const outcomesFor = (cs: Control[], outcome: RunControlOutcome['outcome']): RunControlOutcome[] =>
  cs.map(c => ({ controlId: c.id, wpRef: c.wpRef, description: c.description, outcome, checks: c.design.points.length + c.operating.steps.length }));

/** A run history with enough shape to be worth reading: the same control turns
 *  up in runs of different kinds on different dates, so "last run" and "5 runs
 *  in history" say something. Newest first, and all older than the 'live' bulk
 *  run above so the array stays in order when these are appended to it. */
function libraryRunHistory(controls: Control[]): RunRecord[] {
  const processes = Array.from(new Set(controls.map(c => c.process)));
  const mappedAttrs = (c: Control) => c.operating.steps.filter(s => s.workflowId).length;
  const runs: RunRecord[] = [];

  // ① the automated controls' own workflow runs — one record per process.
  // Only controls the 'live' seed actually concluded: the one control per shelf
  // left Not tested (so the RACM and Overview have something to chase) always
  // lands Automated by the nature formula below, and a recent run cannot claim
  // Effective on a control the testing lens still calls untested.
  processes.forEach((p, pi) => {
    const auto = controls.filter(c => c.process === p && c.nature === 'Automated' && mappedAttrs(c) > 0 && c.operating.conclusion !== 'Not tested');
    if (!auto.length) return;
    runs.push({
      id: `run-wf-${pi + 1}`, kind: 'workflow-run',
      label: `Workflow run — ${p} attribute checks`,
      detail: `run #${4800 + pi} · ${auto.reduce((n, c) => n + mappedAttrs(c), 0)} attributes · 0 conflicts`,
      controls: outcomesFor(auto, 'Effective'),
      by: 'A. Mehta', role: 'auditor', at: '4d ago',
    });
  });

  // ② AI read the uploaded walkthroughs for the first process's key, CONCLUDED
  //    controls — same reasoning as ①, against the design track this time.
  const aiTargets = controls.filter(c => c.process === processes[0] && c.isKey && c.design.conclusion !== 'Not tested').slice(0, 3);
  if (aiTargets.length) runs.push({
    id: 'run-ai-1', kind: 'ai-validation',
    label: `AI validation — ${processes[0]} design evidence`,
    detail: `${aiTargets.length} controls · considerations read off the uploaded walkthroughs`,
    controls: outcomesFor(aiTargets, 'Effective'),
    by: 'A. Mehta', role: 'auditor', at: '1w ago',
  });

  // ③ one control that failed first time round — a history of only passes reads
  //    as a seed, and the lens should be able to show a failed run
  const retested = controls.find(c => c.nature === 'Manual' && c.operating.steps.length >= 3);
  if (retested) runs.push({
    id: 'run-ct-1', kind: 'control-test', label: 'Control test — all attributes',
    detail: `${retested.wpRef} · failed on the first pass, retested after remediation`,
    controls: outcomesFor([retested], 'Ineffective'),
    by: 'A. Mehta', role: 'auditor', at: '2w ago',
  });

  // ④ last cycle's control test — only the two processes CY 2025 covered
  const prior = controls.filter(c => processes.slice(0, 2).includes(c.process));
  if (prior.length) runs.push({
    id: 'run-prior-1', kind: 'control-test',
    label: `Control test — ${prior.length} controls`,
    detail: 'CY 2025 cycle · carried forward for reference',
    controls: outcomesFor(prior, 'Effective'),
    by: 'A. Mehta', role: 'auditor', at: '52w ago',
  });

  return runs;
}

/**
 * The cycles this engagement has run — the engagement Overview's primary content.
 *
 * Three, across two fiscal years, and each one earns its place:
 *
 *   CY 2025 · year-end     concluded, and ARCHIVED. Its conclusions and the two
 *                          deficiencies it raised survive as a snapshot, which is
 *                          what makes prior-year continuity possible at all.
 *   CY 2026 · interim      the LIVE cycle — its results are the ones on the
 *                          controls. First in the array, because the array is
 *                          newest-created-first and the live audit is the newest
 *                          unarchived record (see liveAuditId).
 *   CY 2026 · roll-forward  planned, P2P + O2C only. Nothing tested under it yet.
 *
 * What that shape demonstrates: two-year grouping, a coverage timeline with
 * Oct–Dec 2026 visibly uncovered, a Treasury control that appears in two audits
 * (test once, rely many), prior-year deficiencies to carry forward, and the
 * materiality check reading ✓ because both CY 2026 rounds share ₹12 Cr.
 *
 * Scoped by RACM rather than by entity so the record needs no entity lookup —
 * the entities live in another store.
 */
function libraryAudits(processes: string[], controls: Control[]): AuditRecord[] {
  if (!processes.length) return [];
  const basisLabel = 'Profit before tax (consolidated)';
  const first = processes.slice(0, 2);

  // The prior year's archive. Built from the controls it covered so the snapshot
  // names real W/P references rather than invented ones — but its conclusions are
  // ITS conclusions, not this cycle's: two controls failed and were remediated.
  const priorScope = controls.filter(c => first.includes(c.process));
  const failedIds = priorScope.slice(0, 2).map(c => c.id);
  const archive: AuditArchive = {
    conclusions: priorScope.map(c => ({
      controlId: c.id,
      wpRef: c.wpRef,
      process: c.process,
      description: c.description,
      design: 'Effective' as const,
      operating: failedIds.includes(c.id) ? ('Ineffective' as const) : ('Effective' as const),
      conclusion: failedIds.includes(c.id) ? ('Ineffective' as const) : ('Effective' as const),
    })),
    // One was verified on retest, one is still open — which is exactly the split
    // the continuity section exists to show. Next year's audit starts here.
    deficiencies: failedIds.map((controlId, i) => ({
      id: `def-cy25-0${i + 1}`,
      controlId,
      track: 'operating' as const,
      // PARKED (Aug 2026) — and it was wrong even while it lived: 'Testing gap —
      // sample exception' is a sentence, not one of the three codes, and the cast
      // is what let it through. The field is gone; nothing needs to replace it.
      //   gapType: 'Testing gap — sample exception' as GapType,
      description: i === 0
        ? 'Two of five sampled payment approvals were released without the second signature.'
        : 'Quarterly reconciliation for Q3 was signed a month after the close deadline.',
      rootCause: i === 0 ? 'Approval matrix not enforced in the payment run.' : 'No calendar reminder on the close checklist.',
      likelihood: 'Reasonably possible' as const,
      magnitude: i === 0 ? 4.2 : 1.1,
      mwIndicators: [],
      aggregationGroup: first[i % first.length]!,
      remediation: {
        action: i === 0 ? 'Enforce the second signature in the payment run configuration.' : 'Add the close deadline to the reconciliation checklist.',
        date: i === 0 ? '2025-11-30' : '2025-12-15',
        owner: 'R. Iyer',
        status: 'Done' as const,
      },
      status: (i === 0 ? 'Closed' : 'Retest') as ExceptionStatus,
      retest: i === 0 ? { result: 'Pass' as const, at: '12 Dec 2025', by: 'A. Mehta' } : undefined,
      severity: 'Significant Deficiency' as Severity,
    })),
    concludedAt: '12 Jan 2026',
  };

  return [
    {
      id: 'audit-cy26-interim', period: 'CY 2026', yearBasis: 'cy', fiscalYear: 2026,
      periodSpan: 'Jan 2026 – Dec 2026', round: 'interim', windowFrom: '2026-01-01', windowTo: '2026-06-30',
      scopeKind: 'racm', scopeNames: processes, scopeIds: [],
      files: [{ name: 'altura-group-tb-2026.xlsx', kind: 'tb' }, { name: 'altura-group-gl-2026.csv', kind: 'gl' }],
      materiality: { basisLabel, benchmark: 240, pct: 5 }, overall: 12,
      by: 'A. Mehta', role: 'auditor', at: '02 Jan 2026',
    },
    {
      id: 'audit-cy26-rf', period: 'CY 2026', yearBasis: 'cy', fiscalYear: 2026,
      periodSpan: 'Jan 2026 – Dec 2026', round: 'rollforward', windowFrom: '2026-07-01', windowTo: '2026-09-30',
      scopeKind: 'racm', scopeNames: first, scopeIds: [],
      // Same threshold as the interim round on purpose: one opinion, one ruler.
      // The consistency check on the engagement Overview is reading these two.
      files: [], materiality: { basisLabel, benchmark: 240, pct: 5 }, overall: 12,
      rolledFromId: 'audit-cy26-interim',
      by: 'A. Mehta', role: 'auditor', at: '04 Jul 2026',
    },
    {
      id: 'audit-cy25', period: 'CY 2025', yearBasis: 'cy', fiscalYear: 2025,
      periodSpan: 'Jan 2025 – Dec 2025', round: 'yearend', windowFrom: '2025-10-01', windowTo: '2025-12-31',
      scopeKind: 'racm', scopeNames: first, scopeIds: [],
      files: [{ name: 'altura-group-tb-2025.xlsx', kind: 'tb' }],
      materiality: { basisLabel, benchmark: 210, pct: 5 }, overall: 10.5,
      signoff: { preparer: { by: 'A. Mehta', at: '10 Jan 2026' }, reviewer: { by: 'J. Fernandes', at: '12 Jan 2026' }, icfrConclusion: 'Effective' },
      archive,
      by: 'A. Mehta', role: 'auditor', at: '03 Jan 2025',
    },
  ];
}

/**
 * The findings Altura's live cycle has raised — and the controls they came from.
 *
 * A deficiency is a conclusion about a control that FAILED, so seeding one
 * without failing its control would leave the Control Library reading Effective
 * while Deficiency management shows a finding against it. This flips the five
 * controls it names to Ineffective as it goes, which is why it takes the control
 * array and edits it rather than returning findings on their own.
 *
 * Which controls: only ones the 'live' seed has actually tested. Every process's
 * LAST control is left Not tested by racmTemplateForProcesses, so nothing here
 * may sit on index 4 — a finding against an untested control is a contradiction.
 *
 * The spread is chosen to exercise every rule the tab implements:
 *   Treasury 1     MW by magnitude, CAPPED to Significant Deficiency by a
 *                  compensating control that is itself effective
 *   Procure 3      MW by INDICATOR — the cap is blocked (helpers.assessSeverity),
 *                  so this one stays a material weakness and drives the audit's
 *                  ICFR conclusion to "not effective"
 *   Order 3        Significant Deficiency in its own right
 *   Order 4        a Deficiency that AGGREGATES with the one above — same group,
 *                  combined ₹6.4 Cr against a ₹2.4 Cr band
 *   Fixed 4        clearly trivial (₹45 L, under the ₹60 L floor) and closed —
 *                  logged, and deliberately never aggregated
 *   ITGC 0         a Significant Deficiency on its own exposure that AGGREGATES
 *                  to a Material Weakness — and the one finding whose real cost
 *                  is not a number at all: a failed IT general control withdraws
 *                  "test of one" from every automated and IT-dependent control in
 *                  the engagement (helpers.itgcHolds), so it is paid for in work
 *                  that comes back rather than in rupees that moved
 *
 * The five are also spread down the exception lifecycle, one per stage, so the
 * tab shows the whole journey rather than five rows all sitting at the start:
 *   DEF-A-01  Rating review    graded, waiting on the reviewer to confirm it
 *   DEF-A-02  Planning         rating confirmed, owner writing the plan
 *   DEF-A-03  Plan review      plan submitted, auditor has not judged it yet
 *   DEF-A-04  Retest           plan accepted, fix in, ONE failed round on the clock
 *   DEF-A-05  Closed           passed its retest and countersigned
 *   DEF-A-06  Planning         the ITGC — rating confirmed, owner writing the plan
 *
 * Priced against Altura's own thresholds, not the flagship's: materiality
 * ₹12 Cr, SD band 20% (₹2.4 Cr), clearly trivial ₹60 L — see soxConfig on the
 * engagement record. Change those and these grades move, which is the point.
 */
function alturaDeficiencies(controls: Control[]): Deficiency[] {
  /** The nth control of a process, in RACM order. Undefined when the process
   *  was never scoped — the caller skips rather than inventing a control id. */
  const pick = (process: string, i: number): Control | undefined =>
    controls.filter(c => c.process === process)[i];

  /* Fail the track the finding came from, so the control page, the register and
     this tab agree on WHY the control is ineffective — a track concluded
     Ineffective with every attribute still passing reads as a data error. */
  const fail = (c: Control, track: 'design' | 'operating') => {
    if (track === 'operating') {
      c.operating = {
        ...c.operating,
        conclusion: 'Ineffective',
        steps: c.operating.steps.map((s, i) => (i === 0 ? { ...s, result: 'Fail' as TestResult } : s)),
      };
    } else {
      c.design = {
        ...c.design,
        conclusion: 'Ineffective',
        points: c.design.points.map((p, i) => (i === 0 ? { ...p, result: 'Fail' as TestResult } : p)),
      };
    }
  };

  /* Every attribute against every sampled item, for one retest round. `failed`
     names the odd ones out — sample id → the attribute code that failed — and
     everything not named passes, because a round where most things go right is
     the normal shape and listing 20 passes by hand helps nobody. */
  const roundResults = (
    samples: { id: string }[],
    attrs: { code: string }[],
    failed: Record<string, string>,
  ): Record<string, Record<string, TestResult>> =>
    Object.fromEntries(samples.map(s => [
      s.id,
      Object.fromEntries(attrs.map(a => [a.code, (failed[s.id] === a.code ? 'Fail' : 'Pass') as TestResult])),
    ]));

  const payments = pick('Treasury', 0);          // Payment runs approved by two authorisers
  const bankRecs = pick('Treasury', 1);          // Bank reconciliations reviewed monthly — the compensating control
  const vendorMaster = pick('Procure to Pay', 2);
  const revenueCutoff = pick('Order to Cash', 2);
  const creditNotes = pick('Order to Cash', 3);
  const disposals = pick('Fixed Assets', 3);
  // The ITGC workstream is scoped beyond the trial balance (GROUP_WORKSTREAMS in
  // v2ClassicStore) and tested once for the group, so there is exactly one row to
  // pick — no entity copies to choose between.
  const privilegedAccess = pick('IT General Controls', 0);

  const out: Deficiency[] = [];

  if (payments) {
    fail(payments, 'operating');
    out.push({
      // PARKED (Aug 2026) — gapType: 'TG',   (see the banner in types.ts)
      id: 'DEF-A-01', controlId: payments.id, track: 'operating', reportRef: '4.1',
      description: 'Nine of forty sampled payment runs were released on a single authorisation; the second approver was applied after the bank file had been sent.',
      rootCause: 'The payment run releases on the first authorisation and queues the second as an after-the-fact review, so the bank file is transmitted before dual authorisation exists rather than because of it.',
      failedSamples: ['F110-0417', 'F110-0503', 'F110-0528', 'F110-0611', 'F110-0702', 'F110-0719', 'F110-0806', 'F110-0821', 'F110-0912'],
      likelihood: 'Probable', magnitude: 168_000_000, mwIndicators: [],
      // Sized by what could have been misstated, not by what was lost: every
      // payment tested was valid and owed. What failed is the authorisation, so
      // the number is the value that could have moved on one signature.
      aggregationGroup: 'Treasury payments',
      // Bank reconciliations are monthly, independent and concluded effective —
      // they would catch an unauthorised payment within the cycle. That is a
      // genuine cap: MW down to SD, and never to nothing.
      compensatingControlId: bankRecs?.id,
      remediation: {
        // Blank on purpose. The plan is the OWNER's sentence to write at step ③,
        // and the auditor judges it against the root cause — neither of which
        // means anything if it arrives pre-worded.
        action: '',
        date: null, owner: 'A. Verma', status: 'Open',
      },
      // Freshly raised and still being sized — step ②, in the auditor's hands.
      // The root cause is written, so the exception is past ①; the exposure,
      // likelihood, indicators and compensating control are all live, and the
      // conclusion recomputes as they move. It lands on Significant Deficiency
      // (a material weakness by magnitude, capped by the bank reconciliation),
      // so when the auditor is satisfied the button reads "send to the reviewer"
      // rather than "hand to the owner". Nothing downstream has started.
      status: 'Identified',
    });
  }

  if (vendorMaster) {
    fail(vendorMaster, 'operating');
    out.push({
      // PARKED (Aug 2026) — gapType and exposure, kept so the seed restores whole:
      //   gapType: 'TG',
      //   exposure: { recovery: 0, workingCapital: 0, leakage: 4_100_000, basis: 'No fraudulent payee identified on inspection of the period\'s 214 master changes. Priced at the two payments (₹41 L) made to bank details amended in the same week the vendor was created — value that left the group and has not been recovered.' },
      id: 'DEF-A-02', controlId: vendorMaster.id, track: 'operating', reportRef: '4.2',
      description: 'Vendor master changes were reviewed by the same team that raised them for the whole period; no independent review took place at any point in the cycle.',
      rootCause: 'The reviewer role was granted to the shared services team during a February staffing gap and never withdrawn, so the system accepts the person who raised a change as the person who approved it and says nothing about the two being the same.',
      failedSamples: ['VMD-0042', 'VMD-0117', 'VMD-0206'],
      likelihood: 'Probable', magnitude: 132_000_000,
      // An indicator, not a number — this is a control-environment failure, so
      // the compensating-control cap is blocked outright and it stays an MW.
      mwIndicators: ['Ineffective control environment / oversight'],
      aggregationGroup: 'Procure to Pay',
      // Deliberately NOT confirmed yet — this is the reviewer's gate, waiting.
      remediation: {
        // Blank on purpose — see DEF-A-01 above. Nothing has reached the owner
        // yet: the rating is still waiting on the reviewer.
        action: '',
        date: null, owner: 'S. Iyer', status: 'Open',
      },
      // Parked at the rating gate. An indicator settles it as a Material Weakness
      // on its own — no cap to argue, no number to weigh — and a grade that heavy
      // is confirmed by the reviewer before anyone is asked to spend a quarter on
      // it. Until they do, the owner cannot start: that is what blocking means.
      status: 'Rating review',
    });
  }

  if (revenueCutoff) {
    fail(revenueCutoff, 'operating');
    out.push({
      // PARKED (Aug 2026) — gapType and exposure, kept so the seed restores whole:
      //   gapType: 'TG',
      //   exposure: { recovery: 0, workingCapital: 0, leakage: 0, basis: 'The three invoices were reversed and re-raised in the correct period before the close was signed. A timing error corrected within the cycle — no value has left the group and none is trapped.' },
      id: 'DEF-A-03', controlId: revenueCutoff.id, track: 'operating', reportRef: '4.3',
      description: 'Six invoices raised in the last three days of the quarter were not agreed to a dispatch document; three related to goods dispatched in the following period.',
      rootCause: 'The cut-off check starts from the dispatch log and looks for the matching invoice, so an invoice raised with no dispatch behind it is never reached — the test can only find the errors it walks past.',
      failedSamples: ['INV-26-44112', 'INV-26-44119', 'INV-26-44127', 'INV-26-44130', 'INV-26-44136', 'INV-26-44141'],
      likelihood: 'Reasonably possible', magnitude: 46_000_000, mwIndicators: [],
      aggregationGroup: 'Order to Cash',
      ratingConfirm: { grade: 'Significant Deficiency', by: 'J. Fernandes', at: '26 Jun 2026' },
      remediation: {
        action: 'Reconcile invoices raised in the cut-off window to dispatch documents in both directions, rather than sampling one side.',
        date: '15 Aug', owner: 'P. Sharma', status: 'Open',
      },
      // The owner has put the plan up and the auditor has not judged it yet, so
      // nothing is being built in the meantime. A plan aimed at the wrong mechanism
      // is far cheaper to send back now than to discover on the retest in October.
      planSubmitted: { by: 'P. Sharma', at: '03 Jul 2026' },
      status: 'Plan review',
    });
  }

  if (creditNotes) {
    fail(creditNotes, 'design');
    // A retest asks the SAME questions of a post-fix sample, so the round carries
    // the control's own attributes rather than a fresh list written for it.
    const cnAttrs = creditNotes.operating.steps.map(s => ({ code: s.code, description: s.description }));
    // Drawn from July alone: the rolling monthly total went live on 30 June, and a
    // sample reaching back before that proves nothing about the fix.
    const cnSamples = [
      { id: 'cn-rt1-1', ref: 'CN-26-0902', date: '2026-07-06' },
      { id: 'cn-rt1-2', ref: 'CN-26-0917', date: '2026-07-13' },
      { id: 'cn-rt1-3', ref: 'CN-26-0928', date: '2026-07-21' },
      { id: 'cn-rt1-4', ref: 'CN-26-0941', date: '2026-07-29' },
    ];
    out.push({
      // PARKED (Aug 2026) — gapType: 'MDG',   (see the banner in types.ts)
      id: 'DEF-A-04', controlId: creditNotes.id, track: 'design', reportRef: '4.4',
      description: 'Credit notes below ₹2 L are issued without approval by design; the walkthrough confirmed the threshold is applied per note rather than per customer per month.',
      rootCause: 'The approval threshold is evaluated against each note on its own, so any amount at all can be credited to one customer provided it arrives as a series of notes that each stay under ₹2 L.',
      failedSamples: ['CN-26-0781', 'CN-26-0793', 'CN-26-0806', 'CN-26-0814'],
      likelihood: 'Reasonably possible', magnitude: 18_000_000, mwIndicators: [],
      // Individually a Deficiency. It shares a group with DEF-A-03, and the two
      // together clear the SD band — which is exactly what aggregation is for.
      aggregationGroup: 'Order to Cash',
      ratingConfirm: { grade: 'Significant Deficiency', by: 'J. Fernandes', at: '26 Jun 2026' },
      planSubmitted: { by: 'P. Sharma', at: '18 Jun 2026' },
      // The auditor's whole say in the fix: does it address the mechanism? A
      // rolling total measured per customer sees the thing the old threshold
      // could not, so it was accepted and the owner went and built it.
      planReview: { decision: 'Accepted', reason: 'The rolling monthly total is measured per customer, which is exactly what the per-note threshold could not see. Accepted.', by: 'A. Mehta', at: '20 Jun 2026' },
      remediation: {
        action: 'Move the approval threshold to a rolling monthly total per customer and hold issue until it is approved.',
        date: '30 Jun', owner: 'P. Sharma', status: 'Done',
        evidence: [
          { id: 'cn-ev-1', name: 'Credit note approval rule — rolling monthly total.pdf', kind: 'PDF', uploadedBy: 'P. Sharma', uploadedAt: '30 Jun 2026' },
          { id: 'cn-ev-2', name: 'Change ticket CHG-4471.pdf', kind: 'PDF', uploadedBy: 'P. Sharma', uploadedAt: '30 Jun 2026' },
        ],
      },
      // One round run and failed, which is the loop this counter exists to show.
      // The round is never edited: round 2 will be appended alongside it, and
      // `retests.length` is what the reviewer reads as "how many times now?".
      retests: [{
        n: 1,
        windowFrom: '2026-07-01', windowTo: '2026-07-31',
        attributes: cnAttrs,
        samples: cnSamples,
        results: roundResults(cnSamples, cnAttrs, { 'cn-rt1-3': cnAttrs[0]?.code ?? '' }),
        result: 'Fail',
        rationale: 'CN-26-0928 was approved by nobody. The customer had been set up under a second code that month, so the rolling total read ₹1.7 L against each code instead of ₹3.4 L against the customer. The rule works — the key it groups on does not.',
        by: 'A. Mehta', at: '05 Aug 2026',
      }],
      // The latest round's verdict, mirrored for readers that only want the answer.
      retest: { result: 'Fail', at: '05 Aug 2026', by: 'A. Mehta' },
      // The control is monthly, so a second round needs a full month off the
      // corrected grouping key — end of September at the earliest.
      expectedRetestReady: '30 Sep 2026',
      status: 'Retest',
    });
  }

  if (disposals) {
    fail(disposals, 'operating');
    const dpAttrs = disposals.operating.steps.map(s => ({ code: s.code, description: s.description }));
    const dpSamples = [
      { id: 'fa-rt1-1', ref: 'FA-DSP-0203', date: '2026-07-02' },
      { id: 'fa-rt1-2', ref: 'FA-DSP-0211', date: '2026-07-09' },
      { id: 'fa-rt1-3', ref: 'FA-DSP-0218', date: '2026-07-16' },
    ];
    out.push({
      // PARKED (Aug 2026) — gapType: 'TG',   (see the banner in types.ts)
      id: 'DEF-A-05', controlId: disposals.id, track: 'operating', reportRef: '4.5',
      description: 'Two disposals were derecognised in the month after sale; the gain on both was recorded in the correct quarter.',
      rootCause: 'The disposal note travels to finance with the monthly asset run rather than on approval, so an asset sold after that month\'s run has closed cannot be derecognised until the next one comes round.',
      failedSamples: ['FA-DSP-0119', 'FA-DSP-0126'],
      likelihood: 'Reasonably possible', magnitude: 4_500_000, mwIndicators: [],
      aggregationGroup: 'Fixed Assets',
      // No ratingConfirm, and none is owed: ₹45 L is under Altura's ₹60 L floor,
      // so it grades clearly trivial and never reached the reviewer's rating gate.
      remediation: {
        action: 'Route the disposal note to finance on approval rather than with the monthly asset run.',
        date: '30 Jun', owner: 'S. Iyer', status: 'Done',
        evidence: [{ id: 'fa-ev-1', name: 'Disposal workflow — routing change.pdf', kind: 'PDF', uploadedBy: 'S. Iyer', uploadedAt: '30 Jun 2026' }],
      },
      planSubmitted: { by: 'S. Iyer', at: '10 Jun 2026' },
      planReview: { decision: 'Accepted', reason: 'Routing on approval removes the wait for the monthly run, which is the thing that made the disposals late. Accepted.', by: 'A. Mehta', at: '12 Jun 2026' },
      // Retested clean and closed by the reviewer — the terminal four-eyes act, so
      // the tab has one row showing the end of the lifecycle rather than only its start.
      retests: [{
        n: 1,
        windowFrom: '2026-07-01', windowTo: '2026-07-31',
        attributes: dpAttrs,
        samples: dpSamples,
        results: roundResults(dpSamples, dpAttrs, {}),
        result: 'Pass',
        by: 'A. Mehta', at: '18 Jul 2026',
      }],
      // The same verdict, mirrored — a reader who only wants the answer never has
      // to open the round to find it.
      retest: { result: 'Pass', at: '18 Jul 2026', by: 'A. Mehta' },
      signoff: { by: 'J. Fernandes', at: '19 Jul 2026' },
      status: 'Closed',
    });
  }

  if (privilegedAccess) {
    fail(privilegedAccess, 'operating');
    out.push({
      id: 'DEF-A-06', controlId: privilegedAccess.id, track: 'operating', reportRef: '4.6',
      description: 'The quarterly privileged-access review was performed for Q1 only. Q2 was not run, and the Q1 review was signed without any of the 14 flagged conflicts being cleared — eleven of them were still open at the date of testing.',
      rootCause: 'The review is produced as a spreadsheet extract and signed as a whole, so a reviewer can complete it without resolving anything on it: nothing in the process turns a flagged conflict into a task somebody has to close, and nothing stops the next quarter from opening while the last one is still outstanding.',
      failedSamples: ['SAP-PRIV-Q1-2026', 'SAP-PRIV-Q2-2026', 'ARIBA-PRIV-Q2-2026'],
      likelihood: 'Probable',
      // Priced by what the access could have moved, not by what it did: no
      // improper transaction was found. Eleven standing conflicts across the ERP
      // and procurement platforms could post and release a payment unchallenged,
      // so the number is the value that could have gone out on one person's
      // credentials in the period.
      magnitude: 68_000_000,
      // Deliberately NO indicator. On its own ₹6.8 Cr is a Significant
      // Deficiency — above Altura's ₹2.4 Cr band, below the ₹12 Cr materiality.
      // It grades a Material Weakness anyway, because rule 6 combines it with
      // every other live exception failing on Accuracy and the group clears
      // materiality several times over. That is the engine doing its job, and it
      // is a truer answer than an indicator hand-set here: an access failure this
      // wide is material because of what it sits on top of, not because someone
      // typed that it was.
      mwIndicators: [],
      aggregationGroup: 'IT general controls',
      ratingConfirm: { grade: 'Material Weakness', by: 'J. Fernandes', at: '02 Jul 2026' },
      remediation: {
        // Blank on purpose, like DEF-A-01/02 — the plan is the owner's sentence
        // to write, and the auditor judges it against the root cause.
        action: '',
        date: null, owner: 'V. Menon', status: 'Open',
      },
      // The heaviest consequence of this row is not its grade. Until it is fixed
      // and retested, no automated control in the engagement can be tested on one
      // instance — see helpers.itgcHolds, and the banner it puts on the Dashboard
      // and the Control Library.
      status: 'Planning',
    });
  }

  return out;
}

/**
 * "Unable to test — waiting on owner", on one Altura control, so the state has
 * something to show.
 *
 * Deliberately NOT a deficiency: nothing has been shown to have failed, so there
 * is no severity to grade and no plan to write. It sits on the control and waits
 * on the owner like any other document request — and if it is still open at
 * period end it converts, because a control that could never be evidenced cannot
 * be concluded effective.
 *
 * It goes on the FX control because that is the one control per RACM the live
 * seed leaves untested. A control already concluded Effective cannot also be
 * blocked, and the two on one row would read as a data error.
 */
function alturaUnableToTest(controls: Control[]): void {
  const fxDeals = controls.filter(c => c.process === 'Treasury')[4];
  if (!fxDeals) return;
  fxDeals.unableToTest = {
    track: 'operating',
    reason: 'The dealing system holds the deal ticket but not the counterparty confirmation, and the confirmations for the period sit in the dealer’s own mailbox rather than the treasury shared folder. Nothing can be traced from a deal to a confirmation raised independently of the dealer, so the attribute cannot be tested at all — not passed, not failed.',
    needed: 'Counterparty confirmations for every FX deal struck between 1 January and 30 June 2026, exported to the treasury shared folder by someone outside dealing, each carrying its deal ticket reference.',
    raisedBy: 'A. Mehta',
    raisedAt: '24 Jul 2026',
  };
}

/**
 * The one cycle a plain SOX engagement has under way.
 *
 * Every SOX engagement's Overview is the audit portfolio now, so an engagement
 * with no audits would show its testing nowhere — the work would sit behind an
 * audit that doesn't exist. One year-end round covering everything, holding
 * whatever the seed tested. Status derives itself: an engagement whose controls
 * are untested reads Planned without anything having to say so.
 */
function singleAudit(meta: SeedMeta, controls: Control[]): AuditRecord[] {
  if (!controls.length) return [];
  const year = Number(/(\d{4})/.exec(meta.periodEnd ?? '')?.[1] ?? new Date().getFullYear());
  const processes = Array.from(new Set(controls.map(c => c.process)));
  return [{
    id: `audit-${meta.id ?? 'eng'}-ye`,
    period: `FY ${year - 1}-${String(year).slice(-2)}`,
    yearBasis: 'fy',
    fiscalYear: year,
    periodSpan: `Apr ${year - 1} – Mar ${year}`,
    round: 'yearend',
    windowFrom: `${year}-01-01`,
    windowTo: `${year}-03-31`,
    scopeKind: 'racm',
    scopeNames: processes,
    scopeIds: [],
    files: [],
    materiality: { basisLabel: 'Profit before tax (consolidated)', benchmark: 240, pct: 5 },
    overall: 12,
    by: meta.owner ?? 'A. Mehta',
    role: 'auditor',
    at: `01 Apr ${year - 1}`,
  }];
}

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
    // The flagship's testing belongs to an audit too. Its Overview is the audit
    // portfolio now, so leaving it with none would strand 32 tested controls
    // behind an audit that doesn't exist — and show an empty state on the
    // engagement with the most data in it.
    // The flagship was never scoped from trial balances, so it is one company —
    // its own. Named on every row rather than left blank.
    base.controls = withEntityInstances(base.controls, base.id, base.entity);
    base.audits = singleAudit({ id: base.id, periodEnd: base.periodEnd, owner: base.preparer }, base.controls);
    stampPopulationWindows(base.controls, base.audits);
    return base;
  }
  // Any other engagement → a fresh engagement scoped to the picked process —
  // or, when a scoping-derived process list is supplied, one RACM per process.
  // A supplied-but-EMPTY list means scoping was skipped: seed NOTHING (the
  // user adds the RACM from the RACM tab); only an absent list gets the
  // classic single-process default.
  const proc = PROC_LABEL[meta.process ?? 'O2C'] ?? 'Order to Cash';
  // The engagement the Control Library's library lens is built on carries the
  // deeper seed: varied attribute counts, partial workflow mapping, a real run
  // history and the audits those cycles ran under. Every other engagement is
  // seeded exactly as before. See `rich` on racmTemplateForProcesses.
  const rich = meta.id === NEW_FLOW_ENGAGEMENT_ID;
  const built = meta.processes
    ? (meta.processes.length ? racmTemplateForProcesses(meta.processes, meta.seedMode, rich) : [])
    : racmTemplate(proc);
  // Every control gets the company it is tested at, and a process the scoping
  // spread across several companies gets a row each — see withEntityInstances.
  // Only Altura's scoping actually spans companies today, so every other
  // engagement keeps the exact one-row-per-control register it had, now with its
  // own company named on every row.
  const controls = withEntityInstances(built, meta.id, base.entity);
  // A 'live' cycle claims tested controls — back that claim with the run that
  // produced them, so the SOX audit registry isn't empty on arrival. Control
  // test, not bulk test — SOX controls aren't tested in a bulk batch.
  const runs: RunRecord[] = [];
  if (meta.seedMode === 'live') {
    const tested = controls.filter(c => c.design.conclusion === 'Effective' && c.operating.conclusion === 'Effective');
    if (tested.length) {
      const datasets = Array.from(new Set(tested.flatMap(c => requiredDatasetsFor(c).map(d => d.name))));
      const checks = tested.reduce((n, c) => n + c.design.points.length + c.operating.steps.length, 0);
      runs.push({
        id: 'run-seed-live', kind: 'control-test',
        label: `Control test — ${tested.length} control${tested.length === 1 ? '' : 's'}`,
        detail: `${checks} checks · ${datasets.length} dataset${datasets.length === 1 ? '' : 's'}`,
        controls: tested.map(c => ({ controlId: c.id, wpRef: c.wpRef, description: c.description, outcome: 'Effective' as const, checks: c.design.points.length + c.operating.steps.length })),
        datasets, by: 'A. Mehta', role: 'auditor', at: '3d ago',
      });
    }
  }
  // Appended, not prepended: every record these add is older than the run
  // above, so the array stays newest-first.
  if (rich) runs.push(...libraryRunHistory(controls));
  // Findings — Altura only. Built AFTER the run history above on purpose: this
  // fails five of the controls those runs concluded on, and a run record states
  // the outcome as it stood when it ran, so re-reading it here would be wrong.
  // Every other engagement stays clean, as before.
  const deficiencies = rich ? alturaDeficiencies(controls) : [];
  // A blocked control, not a finding — see alturaUnableToTest. Altura only, like
  // the findings above; every other engagement stays clean.
  if (rich) alturaUnableToTest(controls);
  const audits = rich ? libraryAudits(meta.processes ?? [], controls) : singleAudit(meta, controls);
  stampPopulationWindows(controls, audits);
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
    preparer: meta.owner ?? base.preparer,
    controls,
    deficiencies,
    tasks: [],
    discussions: [],
    reviewNotes: [],
    executions: [],
    runs,
    // Every SOX engagement has at least one audit now: the Overview IS the audit
    // portfolio, so testing that belongs to no audit would be testing with no
    // home. Altura has run three rounds across two years; the rest have one.
    audits,
    signoff: {},
    rulesLog: [],
  };
}

/** Give every seeded population the window of the round it was pulled for.
 *
 *  A population belongs to ONE round — that is what the POP-INT / POP-RF /
 *  POP-YE stamp means, and why the tester says a later round re-versions rather
 *  than editing. So it carries that round's window rather than a span stretched
 *  wide enough to satisfy all of them: a 15-month filter sitting under a
 *  six-month interim audit passes the coverage check by being vague, which is
 *  the opposite of what the check is for.
 *
 *  Opening the same control under a DIFFERENT round will now flag the coverage,
 *  and that is correct — a population pulled for the interim window genuinely
 *  does not cover the year-end one, and the version stamp on screen says so.
 *
 *  Runs after the audits are built, because until then there is no window to
 *  read. Mutates in place: these controls were just constructed here and are
 *  not shared with anything yet. */
function stampPopulationWindows(controls: Control[], audits: AuditRecord[]): void {
  if (!audits.length) return;
  for (const c of controls) {
    const pop = c.operating.population;
    if (!pop) continue;
    // Same order of preference the workspace uses to decide what an audit
    // covers: controls picked one by one beat the process filter.
    const audit = audits.find(a => a.controlIds?.includes(c.id))
      ?? audits.find(a => a.scopeNames.includes(c.process))
      ?? audits[0];
    pop.filterFrom = audit.windowFrom;
    pop.filterTo = audit.windowTo;
    pop.version = `POP-${ROUND_TAG[audit.round]}`;
    pop.criteria = `${pop.criteria} · ${ROUND_WINDOW_LABEL[audit.round]}`;
    // Each file's own filter carries the round too — the per-file rows print
    // these rather than the population-level line, so stamping only the latter
    // would leave the round visible in one place and missing in the other.
    pop.sources = pop.sources?.map(s => ({ ...s, criteria: `${s.criteria} · ${ROUND_WINDOW_LABEL[audit.round]}` }));
  }
}

// ── The same control, at every company in its scope ─────────────────────────────
//
// A group audit does not test a control once. It tests it separately at each
// entity the scoping brought in: same control number, same wording, four
// separate lives. Altura's Treasury RACM covers Holdings, Solar, Wind and Smart
// Metering, so TRY-01 is four rows — and one being concluded effective says
// nothing at all about the other three.
//
// Which companies each control runs at is NOT invented here. It is read straight
// off the programme's own RACM derivation — the same mapping the scoping wizard
// wrote when it decided which trial-balance captions were in scope — so the
// register can never disagree with the Configuration tab.

/** Where the row's testing has got to. The whole point of separate rows is that
 *  entities are at different points, so the clones spread across these. */
type EntityStage = 'fresh' | 'design' | 'part' | 'done';

/** One entity's copy of a control: same number, its own working paper, its own
 *  design and operating tracks reset to `stage`. */
function instanceAt(base: Control, entity: string, short: string, stage: EntityStage): Control {
  const designDone = stage !== 'fresh';
  const opDone = stage === 'done';
  return {
    ...base,
    // `id` is the key everything else in the workspace hangs off (findings,
    // tasks, run records), so it has to be unique. `code` is what people read.
    id: `${base.id}@${short.toLowerCase()}`,
    code: base.code ?? base.id,
    // A working paper index has to be unique too — the entity suffix is exactly
    // how a group file references the same control at a different company.
    wpRef: `${base.wpRef}/${short.slice(0, 3).toUpperCase()}`,
    entity,
    design: {
      ...base.design,
      documents: base.design.documents.map(d => ({ ...d, status: (designDone ? 'Received' : 'Requested') as DocStatus })),
      points: base.design.points.map(p => ({ ...p, result: (designDone ? 'Pass' : 'Not tested') as TestResult })),
      conclusion: (designDone ? 'Effective' : 'Not tested') as TrackConclusion,
      testedBy: designDone ? base.design.testedBy : null,
      testedAt: designDone ? base.design.testedAt : null,
    },
    operating: {
      ...base.operating,
      // Nothing is sampled until design is signed off, so a row that hasn't got
      // there carries no population and no sample — the control page opens at ①.
      population: designDone ? base.operating.population : undefined,
      sampling: opDone ? base.operating.sampling : undefined,
      steps: base.operating.steps.map((s, i) => ({
        ...s,
        result: (opDone ? 'Pass' : stage === 'part' && i === 0 ? 'Pass' : 'Not tested') as TestResult,
      })),
      conclusion: (opDone ? 'Effective' : 'Not tested') as TrackConclusion,
      testedBy: opDone ? base.operating.testedBy : null,
      testedAt: opDone ? base.operating.testedAt : null,
    },
  };
}

/**
 * Give every control its entity, and add a row for each further company its
 * process covers.
 *
 * The originals keep their ids and their place at the front of the array —
 * everything that picks a control by position (the seeded findings, the run
 * history) goes on meaning what it meant before. The copies are appended.
 */
function withEntityInstances(controls: Control[], engagementId: string, fallback: string): Control[] {
  const prog = programmeFor(engagementId);
  // The single company the whole engagement is against. Every audit has one, even
  // the ones that were never scoped from trial balances — it is who is being
  // audited — so a control always has an entity to name, and the register never
  // shows a column of dashes.
  const wholeAudit = prog?.groupName ?? fallback;
  const fullName = new Map((prog?.entities ?? []).map(e => [entityShort(e.id, prog!.entities), e.name]));
  const scopeOf = new Map<string, string[]>();
  prog?.racms.forEach(r => scopeOf.set(normaliseProcess(r.process), r.entities));

  const STAGES: EntityStage[] = ['done', 'part', 'design', 'fresh'];
  const copies: Control[] = [];
  controls.forEach((c, i) => {
    // A process the scoping mapped to several companies splits into a row each —
    // same control number, separate lives. A process mapped to one, or an
    // engagement whose RACM was uploaded rather than derived, is the audit's own
    // company and stays one row.
    const shorts = scopeOf.get(normaliseProcess(c.process)) ?? [];
    if (!shorts.length) { c.entity = wholeAudit; return; }
    c.entity = fullName.get(shorts[0]!) ?? shorts[0]!;
    shorts.slice(1).forEach((short, k) => {
      copies.push(instanceAt(c, fullName.get(short) ?? short, short, STAGES[(i + k) % STAGES.length]!));
    });
  });
  return copies.length ? [...controls, ...copies] : controls;
}

/** The attributes a seeded control is tested against, in the order an auditor
 *  would write them: does the check itself hold, are the exceptions dealt with,
 *  was it done in time, is the evidence there, and was the person allowed to do
 *  it. A control takes the first N of these — see `rich` on
 *  racmTemplateForProcesses. */
const ATTRIBUTE_SPINE: { suffix: string; assertion: Assertion; precision: string; procedures: TestProcedure[] }[] = [
  { suffix: 'primary attribute tested', assertion: 'Accuracy', precision: 'Per item', procedures: ['Inspection', 'Reperformance'] },
  { suffix: 'exceptions handled per policy', assertion: 'Existence / Occurrence', precision: 'Per exception', procedures: ['Inspection'] },
  { suffix: 'performed within the required timeframe', assertion: 'Cut-off', precision: 'Per occurrence', procedures: ['Inspection'] },
  { suffix: 'evidence retained and independently inspectable', assertion: 'Completeness', precision: 'Per item', procedures: ['Inspection'] },
  { suffix: 'performed by someone independent of the transaction', assertion: 'Rights & Obligations', precision: 'Per approver', procedures: ['Inspection', 'Inquiry'] },
];

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
 *
 * `rich` deepens the attribute layer for the engagement the Control Library's
 * library lens is built on: two attributes per control tells that lens nothing
 * (every card would read "2 attributes"), so a rich seed varies the count 2–5
 * and maps workflows to only SOME of them, which is the real-world state the
 * lens exists to show — partial automation coverage. Off by default, so every
 * other scoping-derived engagement keeps the exact two-attribute seed it had.
 */
export function racmTemplateForProcesses(names: string[], mode: 'fresh' | 'live' | 'carried' = 'fresh', rich = false): Control[] {
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
          id: `${prefix}-${String(i + 1).padStart(2, '0')}`, wpRef: `${prefix.charAt(0)}X-${String(i + 1).padStart(2, '0')}`, description: title + '.',
          process: name, subProcess: 'General', nature: 'Manual' as Nature, type: typeOf(title), frequency: 'Monthly' as const,
          isKey: i % 4 !== 3, clazz: classOf(name), precision: `${title}.`, controlActivity: activityOf('S. Iyer', 'General', 'Monthly', 'Manual'),
          riskRating: (i % 4 === 3 ? 'Low' : i % 3 === 0 ? 'High' : 'Medium') as RiskRating,
          objective: objectiveFor(`R-${prefix}-1`, name),
          owner: 'S. Iyer', riskId: `R-${prefix}-1`,
          riskDescription: `${name} misstated — additions, movements or reconciliations not controlled.`,
          assertions: ['Accuracy', 'Existence / Occurrence'] as Assertion[],
          design: designTrack('Not tested', [], []),
          operating: manualTrack('Not tested', [], undefined, 0),
        }));
    return shells.map((c, i) => {
      const last = i === shells.length - 1;
      // ── the one control caught mid-flight ──────────────────────────────────
      // Every other control is either untouched or finished, and both of those
      // hide the per-file marks: a finished control is locked, so its Approve
      // and Reject buttons are gone, and an untouched one has no files to mark.
      // The half-done state is the one the call actually described — "चार का
      // तुमने कर दिया था, दो बच रहा था" — so exactly one control is left in it:
      // population locked, both files proven, the first sampled and ticked, the
      // second still waiting for its draw.
      //
      // Treasury only, and only its last control, so every other process keeps
      // its untouched control exactly as it was — several specs walk into that
      // one precisely because nothing has happened to it.
      const midFlight = mode === 'live' && last && name === 'Treasury';
      const designDone = mode === 'carried' || (mode === 'live' && !last) || midFlight;
      const opDone = mode === 'live' && !last;
      // `&& !last` is load-bearing. Every process carries 5 shells, so the one
      // untested control is always i=4 — and 4 % 3 === 1 made it Automated in
      // every process without anyone choosing that. An automated control whose
      // ITGCs hold short-forms to TOD (see operatingApplies), so the single
      // control a demo or a spec can actually walk into was the one control with
      // no Population step, no IPE test and no Sample. The fresh one is Manual.
      const nature: Nature = i % 3 === 1 && !last ? 'Automated' : 'Manual';
      const title = c.description.replace(/\.$/, '');
      const docs: DesignDoc[] = [
        doc('Process narrative', `${name} narrative.pdf`, 'Received'),
        doc('Flowchart', `${name} flowchart.pdf`, 'Received'),
        doc('Walkthrough', `Walkthrough — ${name}.pdf`, designDone ? 'Received' : 'Requested'),
      ];
      // How many attributes this control carries, and how many of them a
      // workflow evidences. An automated control is fully instrumented; a manual
      // one is mapped partially or not at all, which is what makes "3 of 4
      // workflows mapped" a fact worth putting on a card.
      const attrCount = rich ? 2 + (i % 4) : 2;
      const mapped = nature === 'Automated' ? attrCount
        : rich ? (i % 3 === 0 ? 0 : i % 3 === 1 ? 1 : attrCount - 1)
        : 0;
      const opSteps: OperatingStep[] = ATTRIBUTE_SPINE.slice(0, attrCount).map((a, k) => step(
        `${i + 1}.${k + 1}`,
        `${title} — ${a.suffix}.`,
        a.assertion,
        a.precision,
        // an automated control reperforms its primary attribute rather than
        // inspecting it; the rest keep the spine's own procedures
        nature === 'Automated' && k === 0 ? ['Reperformance'] : a.procedures,
        opDone ? 'Pass' : 'Not tested',
        k < mapped
          ? wf(`wf-${c.id.toLowerCase()}-${k + 1}`, `${title} — check ${k + 1}`, opDone ? `run #${6000 + i * (rich ? 8 : 3) + k + 1}` : undefined)
          : {},
      ));
      // Design checks: the control-level pair FIRST, then one per attribute
      // (dev call, Aug 2026 — every attribute carries its own design check).
      //
      // Order is load-bearing twice over. The control-level ones lead because
      // that is how the step reads — does this control address the risk at all,
      // then is each thing it has to do designed to happen. And alturaDeficiencies
      // fails points[0] to seed its design failure, so anything prepended here
      // would silently move which check that finding is against.
      const points: DesignPoint[] = [
        point('Control addresses the stated risk and assertion.', designDone ? 'Pass' : 'Not tested'),
        point('Control operates at sufficient precision.', designDone ? 'Pass' : 'Not tested'),
        ...opSteps.map(s => point(
          `${s.description.replace(/\.$/, '')} — designed to happen, at ${s.precision.toLowerCase()}.`,
          designDone ? 'Pass' : 'Not tested',
          'Design walkthrough check',
          s.id,
        )),
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
          // The first tested control of every process stands on TWO source files
          // (dev call, Aug 2026 — "मल्टीपल फाइल्स वो डाल सकता है"). Seeded rather
          // than left to be built by hand: the per-file IPE proof, the per-file
          // draw and the Source column on the paper are all invisible until a
          // control actually has more than one file, and a feature nobody can
          // reach on arrival is a feature nobody reviews. One control, not all
          // of them — several files is the exception, and a register where every
          // control had two would misrepresent the ordinary case.
          : manualTrack(
            opDone ? 'Effective' : 'Not tested', opSteps,
            opDone || midFlight ? sampling(midFlight ? 12 : 25, 'Standard sample — moderate reliance.', 'Random') : undefined,
            opDone || midFlight ? 2000 + i * 7 : 0, undefined, undefined,
            (opDone && i === 0) || midFlight
              ? secondSource(
                `vendor_master_${name.toLowerCase().replace(/[^a-z]+/g, '_')}.xlsx`, 1840, 265,
                'Active vendors with a payment in the period',
                // The mid-flight control's second file is registered and proven
                // but never drawn — that is the thing left to do.
                !midFlight,
              )
              : undefined,
          ),
      };
    });
  });
}

// ── RACM template for the setup wizard ──────────────────────────────────────────
export function racmTemplate(process: string): Control[] {
  const sp = SPREADS.find(s => s.process === process) ?? SPREADS[0];
  return sp.titles.slice(0, 5).map((title, i) => ({
    id: `${sp.prefix}-${String(i + 1).padStart(2, '0')}`, wpRef: `${sp.wp}-${String(i + 1).padStart(2, '0')}`, description: title + '.',
    process: sp.process, subProcess: sp.subs[i % sp.subs.length], nature: 'Manual' as Nature, type: typeOf(title), frequency: 'Monthly' as const,
    isKey: i % 4 !== 3, clazz: classOf(sp.process), precision: `${title}.`, controlActivity: activityOf(sp.owner, sp.subs[i % sp.subs.length], 'Monthly', 'Manual'),
    riskRating: (i % 4 === 3 ? 'Low' : i % 3 === 0 ? 'High' : 'Medium') as RiskRating,
    objective: objectiveFor(riskFor(sp, i).id, sp.process),
    owner: sp.owner, riskId: riskFor(sp, i).id, riskDescription: riskFor(sp, i).text,
    assertions: ['Accuracy', 'Existence / Occurrence'] as Assertion[],
    design: designTrack('Not tested', [], []),
    operating: manualTrack('Not tested', [], undefined, 0),
  }));
}

