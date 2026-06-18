/**
 * RACM (Risk and Control Matrix) seed for the Compliance / Internal Audit
 * engagement detail pages.
 *
 * Each `RACMRow` is a single risk-to-control mapping with sub-controls
 * (called "attributes" or "plan steps") and SOX assertion metadata.
 *
 * Seeded for P2P sub-processes — the demo Compliance engagements (ENG-001,
 * ENG-005) primarily test P2P controls. ITGC, O2C, R2R rows can be added in
 * follow-ups without touching consumer code.
 */

import type { ProcessCode } from './engagements';

export type SoxAssertion =
  | 'Completeness'
  | 'Accuracy'
  | 'Existence'
  | 'Cutoff'
  | 'Valuation'
  | 'Rights & Obligations'
  | 'Presentation';

export type Frequency = 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Annual' | 'Event-driven';
export type ControlType = 'Preventive' | 'Detective';
export type Automation = 'Manual' | 'IT-dependent' | 'Automated';

/**
 * Attribute scope:
 *   SAMPLE_BASED — the auditor walks every sample in the control's sample set
 *                  and tests this attribute against each sample.
 *   GENERIC      — the attribute is a single control-level check
 *                  (e.g. "policy signed by CFO exists"); no sample loop.
 * Default when omitted = SAMPLE_BASED.
 */
export type AttributeScope = 'SAMPLE_BASED' | 'GENERIC';

export interface ControlAttribute {
  id: string;
  description: string;
  testProcedure: string;
  /** Evidence types the auditor must collect to validate this attribute
   *  (e.g. "Vendor invoice", "KYC PAN copy"). Drives the Evidence tab. */
  requiredEvidence: string[];
  /** Per-evidence-type guidance — what should the auditor actually upload.
   *  Index-aligned with `requiredEvidence`. Shown next to the upload control. */
  evidenceDescriptions?: string[];
  /** Approximate population size for the engagement period — drives the sample
   *  count + the "Upload population" affordance. Population itself is now
   *  managed at the control level; this remains as a hint for sample-size defaults. */
  populationSize: number;
  /** Default sampling target. */
  defaultSampleSize: number;
  /** Sample-based (loops over samples) vs generic (single control-level check). */
  scope?: AttributeScope;
}

export interface RACMRow {
  id: string;
  process: ProcessCode;
  subProcess: string;

  riskId: string;
  riskDescription: string;

  controlId: string;
  controlDescription: string;
  attributes: ControlAttribute[];

  assertion: SoxAssertion;
  frequency: Frequency;
  controlType: ControlType;
  automation: Automation;
  isKey: boolean;
}

export const RACM_LIBRARY: RACMRow[] = [
  // ─── P2P · Vendor Onboarding ──────────────────────────────────────────────
  {
    id: 'racm-1', process: 'P2P', subProcess: 'Vendor Onboarding',
    riskId: 'RSK-VO-01', riskDescription: 'Vendor onboarded without KYC / due diligence — fictitious vendor risk',
    controlId: 'P2P-C-01', controlDescription: 'Vendor master add/change requires dual approval with KYC pack attached',
    attributes: [
      { id: 'P2P-C-01.1', description: 'KYC documents collected (PAN, GST, bank cancelled cheque)', testProcedure: 'Inspect KYC pack in vendor master record for completeness.',
        requiredEvidence: ['KYC PAN copy', 'KYC GST certificate', 'Bank cancelled cheque'],
        evidenceDescriptions: [
          'Vendor PAN card photocopy. Number must match the ERP vendor master.',
          'GST registration certificate (REG-06). Verify validity date and GSTIN match.',
          'Bank cancelled cheque with vendor name printed (not handwritten).',
        ],
        populationSize: 487, defaultSampleSize: 25, scope: 'SAMPLE_BASED' },
      { id: 'P2P-C-01.2', description: 'Dual approval recorded in ERP audit log',                       testProcedure: 'Sample 25 new vendors; verify two distinct approvers in ERP log.',
        requiredEvidence: ['ERP audit log screenshot', 'Approval workflow trail'],
        evidenceDescriptions: [
          'Screenshot of the ERP audit log showing both approver user IDs and timestamps.',
          'Workflow trail export confirming the approval routed through two distinct users (no self-approval).',
        ],
        populationSize: 487, defaultSampleSize: 25, scope: 'SAMPLE_BASED' },
      { id: 'P2P-C-01.3', description: 'Vendor screened against sanctions list',                        testProcedure: 'Run vendor list against sanctions DB; verify timestamp ≤ 24h before activation.',
        requiredEvidence: ['Sanctions screening result', 'Screening timestamp evidence'],
        evidenceDescriptions: [
          'Sanctions screening output (clear / hit) from the configured screening provider.',
          'Timestamp showing the screening was performed within 24h before vendor activation.',
        ],
        populationSize: 487, defaultSampleSize: 25, scope: 'SAMPLE_BASED' },
      // GENERIC attribute — control-level master attestation, no sample loop.
      { id: 'P2P-C-01.4', description: 'Vendor onboarding policy reviewed and signed by Procurement Head for FY26',
        testProcedure: 'Inspect signed policy attestation cover page — one signature covers the whole control period.',
        requiredEvidence: ['Signed policy attestation'],
        evidenceDescriptions: ['Single signed cover page of the FY26 vendor onboarding policy, signed by the Procurement Head with date.'],
        populationSize: 1, defaultSampleSize: 1, scope: 'GENERIC' },
    ],
    assertion: 'Existence', frequency: 'Event-driven', controlType: 'Preventive', automation: 'IT-dependent', isKey: true,
  },
  {
    id: 'racm-2', process: 'P2P', subProcess: 'Vendor Onboarding',
    riskId: 'RSK-VO-02', riskDescription: 'Vendor master changes made without authorization',
    controlId: 'P2P-C-02', controlDescription: 'Vendor master change log reviewed monthly; unauthorized changes investigated',
    attributes: [
      { id: 'P2P-C-02.1', description: 'Monthly change-log report generated from ERP',     testProcedure: 'Inspect report timestamps for past 12 months — confirm monthly cadence.',
        requiredEvidence: ['Monthly change-log report PDF'], populationSize: 12, defaultSampleSize: 3 },
      { id: 'P2P-C-02.2', description: 'Review evidence (sign-off) by AP Lead',             testProcedure: 'Sample 3 months; verify reviewer sign-off captured.',
        requiredEvidence: ['Reviewer sign-off email', 'Reviewed change-log copy'], populationSize: 12, defaultSampleSize: 3 },
    ],
    assertion: 'Accuracy', frequency: 'Monthly', controlType: 'Detective', automation: 'Manual', isKey: false,
  },

  // ─── P2P · Purchase Order Management ──────────────────────────────────────
  {
    id: 'racm-3', process: 'P2P', subProcess: 'Purchase Order Management',
    riskId: 'RSK-PO-01', riskDescription: 'Unauthorized purchases above approval threshold',
    controlId: 'P2P-C-03', controlDescription: 'PO approval threshold enforced by amount tier (DOA matrix)',
    attributes: [
      { id: 'P2P-C-03.1', description: 'DOA matrix configured in ERP per latest policy version',   testProcedure: 'Inspect ERP configuration vs current DOA policy — match approvers to amount tiers.',
        requiredEvidence: ['DOA policy document', 'ERP config screenshot'], populationSize: 1, defaultSampleSize: 1,
        scope: 'GENERIC',
        evidenceDescriptions: ['Current signed DOA (Delegation of Authority) policy document.', 'ERP screenshot showing the configured approval matrix.'] },
      { id: 'P2P-C-03.2', description: 'Threshold-override events require justification + 2-up approval', testProcedure: 'Sample all overrides; verify justification text + escalation approver.',
        requiredEvidence: ['Override justification document', 'Escalation approval email'], populationSize: 34, defaultSampleSize: 30 },
      { id: 'P2P-C-03.3', description: 'POs > ₹10L require CFO approval',                          testProcedure: 'Sample 15 POs > ₹10L; verify CFO approval in workflow.',
        requiredEvidence: ['PO document', 'CFO approval email/workflow trail'], populationSize: 62, defaultSampleSize: 15 },
    ],
    assertion: 'Existence', frequency: 'Daily', controlType: 'Preventive', automation: 'Automated', isKey: true,
  },
  {
    id: 'racm-4', process: 'P2P', subProcess: 'Purchase Order Management',
    riskId: 'RSK-PO-02', riskDescription: 'PO created and approved by the same user (SoD violation)',
    controlId: 'P2P-C-04', controlDescription: 'Segregation of duties — PO creator cannot approve own PO',
    attributes: [
      { id: 'P2P-C-04.1', description: 'ERP role configuration prevents create + approve by same user', testProcedure: 'Inspect role-permission matrix; attempt to approve self-created PO — must fail.',
        requiredEvidence: ['Role-permission matrix export', 'Failed override attempt screenshot'], populationSize: 1, defaultSampleSize: 1 },
      { id: 'P2P-C-04.2', description: 'Quarterly SoD review by IT Audit',                              testProcedure: 'Inspect Q1-Q4 review reports + sign-off.',
        requiredEvidence: ['Quarterly SoD review report', 'IT Audit sign-off'], populationSize: 4, defaultSampleSize: 4 },
    ],
    assertion: 'Rights & Obligations', frequency: 'Quarterly', controlType: 'Preventive', automation: 'IT-dependent', isKey: true,
  },

  // ─── P2P · Goods Receipt ─────────────────────────────────────────────────
  {
    id: 'racm-5', process: 'P2P', subProcess: 'Goods Receipt',
    riskId: 'RSK-GR-01', riskDescription: 'GRN raised without physical receipt verification',
    controlId: 'P2P-C-05', controlDescription: 'GRN requires warehouse + receiver signatures with timestamp',
    attributes: [
      { id: 'P2P-C-05.1', description: 'GRN form captures both signatures',          testProcedure: 'Sample 25 GRNs; inspect for two signatures + receipt timestamp.',
        requiredEvidence: ['Signed GRN form', 'Receipt timestamp photo'], populationSize: 1240, defaultSampleSize: 25 },
      { id: 'P2P-C-05.2', description: 'Quantity received matches PO within tolerance', testProcedure: 'Compare GRN qty to PO qty; verify within ±2% tolerance.',
        requiredEvidence: ['GRN-PO quantity comparison sheet', 'Tolerance calculation'], populationSize: 1240, defaultSampleSize: 25 },
    ],
    assertion: 'Existence', frequency: 'Daily', controlType: 'Preventive', automation: 'Manual', isKey: false,
  },

  // ─── P2P · Invoice Processing ─────────────────────────────────────────────
  {
    id: 'racm-6', process: 'P2P', subProcess: 'Invoice Processing',
    riskId: 'RSK-IP-01', riskDescription: 'Invoice posted without matching PO and GRN — three-way match bypass',
    controlId: 'P2P-C-06', controlDescription: 'Three-way match enforced (PO · GRN · Invoice) before AP posting',
    attributes: [
      { id: 'P2P-C-06.1', description: 'Invoice qty ≤ GRN qty AND GRN qty ≤ PO qty',                  testProcedure: 'Sample 50 invoices; recompute the three-way match — must pass for all.',
        requiredEvidence: ['Vendor invoice', 'GRN copy', 'PO copy', '3-way match calculation'], populationSize: 8412, defaultSampleSize: 50 },
      { id: 'P2P-C-06.2', description: 'Unit price on invoice matches PO unit price (within tolerance)', testProcedure: 'Sample 50 invoices; verify unit-price tolerance ≤ 2%.',
        requiredEvidence: ['Vendor invoice', 'PO copy', 'Price comparison sheet'], populationSize: 8412, defaultSampleSize: 50 },
      { id: 'P2P-C-06.3', description: 'Tolerance break requires AP Manager approval',                testProcedure: 'Inspect all tolerance-breaks for the period; verify AP Manager approval.',
        requiredEvidence: ['Tolerance break log entry', 'AP Manager approval email'], populationSize: 78, defaultSampleSize: 78 },
    ],
    assertion: 'Completeness', frequency: 'Daily', controlType: 'Preventive', automation: 'Automated', isKey: true,
  },
  {
    id: 'racm-7', process: 'P2P', subProcess: 'Invoice Processing',
    riskId: 'RSK-IP-02', riskDescription: 'Duplicate invoice posted from same vendor',
    controlId: 'P2P-C-07', controlDescription: 'Duplicate-invoice detection on PAN + invoice-number + amount + date',
    attributes: [
      { id: 'P2P-C-07.1', description: 'ERP duplicate-check rule active (PAN + invoice number)', testProcedure: 'Inspect ERP rule config; attempt duplicate posting — must block.',
        requiredEvidence: ['ERP rule configuration screenshot', 'Test posting result'], populationSize: 1, defaultSampleSize: 1 },
      { id: 'P2P-C-07.2', description: 'Fuzzy match catches near-duplicates (amount ± 1%)',     testProcedure: 'Inspect detection threshold + last 90 days of detections.',
        requiredEvidence: ['Detection threshold config', '90-day detection log'], populationSize: 1, defaultSampleSize: 1 },
    ],
    assertion: 'Existence', frequency: 'Daily', controlType: 'Preventive', automation: 'Automated', isKey: true,
  },
  {
    id: 'racm-8', process: 'P2P', subProcess: 'Invoice Processing',
    riskId: 'RSK-IP-03', riskDescription: 'Invoice amount tampered after approval',
    controlId: 'P2P-C-08', controlDescription: 'Post-approval edits to invoice fields trigger re-approval workflow',
    attributes: [
      { id: 'P2P-C-08.1', description: 'ERP locks amount/vendor/date fields after approval', testProcedure: 'Attempt edit of approved invoice; system must require re-approval.',
        requiredEvidence: ['ERP field-lock configuration', 'Attempted edit log'], populationSize: 1, defaultSampleSize: 1 },
      { id: 'P2P-C-08.2', description: 'Audit log captures all post-approval edits',         testProcedure: 'Inspect audit log for 60 days; spot-check 10 entries.',
        requiredEvidence: ['Audit log export', 'Sample edit entry detail'], populationSize: 60, defaultSampleSize: 10 },
    ],
    assertion: 'Accuracy', frequency: 'Daily', controlType: 'Detective', automation: 'IT-dependent', isKey: false,
  },

  // ─── P2P · Payment Release ────────────────────────────────────────────────
  {
    id: 'racm-9', process: 'P2P', subProcess: 'Payment Release',
    riskId: 'RSK-PR-01', riskDescription: 'Payment released without dual sign-off above threshold',
    controlId: 'P2P-C-09', controlDescription: 'Payments > ₹10L require dual sign-off (Treasury + CFO)',
    attributes: [
      { id: 'P2P-C-09.1', description: 'Treasury sign-off recorded in payment-run log',  testProcedure: 'Sample all > ₹10L payments; verify Treasury sign-off in log.',
        requiredEvidence: ['Payment run log', 'Treasury sign-off email/system entry'], populationSize: 47, defaultSampleSize: 47 },
      { id: 'P2P-C-09.2', description: 'CFO sign-off recorded in payment-run log',       testProcedure: 'Same sample — verify CFO sign-off.',
        requiredEvidence: ['Payment run log', 'CFO sign-off email/system entry'], populationSize: 47, defaultSampleSize: 47 },
      { id: 'P2P-C-09.3', description: 'Payment-run report reviewed weekly by Controller', testProcedure: 'Inspect weekly review evidence for the engagement period.',
        requiredEvidence: ['Weekly payment-run review report', 'Controller sign-off'], populationSize: 52, defaultSampleSize: 12 },
    ],
    assertion: 'Existence', frequency: 'Daily', controlType: 'Preventive', automation: 'Manual', isKey: true,
  },
  {
    id: 'racm-10', process: 'P2P', subProcess: 'Payment Release',
    riskId: 'RSK-PR-02', riskDescription: 'Payment made to unauthorized bank account',
    controlId: 'P2P-C-10', controlDescription: 'Vendor bank account on file matches payment instruction; changes require dual approval',
    attributes: [
      { id: 'P2P-C-10.1', description: 'Bank-account match validation in payment run',         testProcedure: 'Sample 30 payments; verify bank account on payment matches vendor master.',
        requiredEvidence: ['Payment-run entry with bank acct', 'Vendor master bank acct extract'], populationSize: 4280, defaultSampleSize: 30 },
      { id: 'P2P-C-10.2', description: 'Bank-account change events require dual approval log', testProcedure: 'Inspect all bank-account change events; verify dual approval.',
        requiredEvidence: ['Bank account change log entry', 'Dual approval evidence'], populationSize: 28, defaultSampleSize: 28 },
    ],
    assertion: 'Rights & Obligations', frequency: 'Daily', controlType: 'Preventive', automation: 'IT-dependent', isKey: true,
  },
];

/**
 * Display label for an attribute: `{controlId}-A{n}`.
 * Internal ids are `{controlId}.{n}` (e.g. P2P-C-01.1 → P2P-C-01-A1); ids already
 * in the `-A{n}` form (custom controls) pass through unchanged.
 */
export function attrCode(attributeId: string): string {
  return attributeId.replace(/\.(\d+)$/, '-A$1');
}

/** All RACM rows that belong to a given process. */
export function racmRowsForProcess(process: ProcessCode): RACMRow[] {
  return RACM_LIBRARY.filter(r => r.process === process);
}

/** Generate RACM rows for a process. Returns existing library rows if present, otherwise creates process-appropriate mock data. */
export function generateRacmForProcess(process: ProcessCode): RACMRow[] {
  const existing = racmRowsForProcess(process);
  if (existing.length > 0) return existing;

  const templates: Record<string, { subProcesses: string[]; risks: string[]; controls: string[] }> = {
    O2C: {
      subProcesses: ['Order Entry', 'Credit Management', 'Invoicing', 'Revenue Recognition', 'Collections'],
      risks: ['Unauthorized sales order entry', 'Credit limit exceeded without approval', 'Invoice pricing discrepancy', 'Revenue recognized in wrong period', 'Uncollected receivables write-off without approval', 'Duplicate invoice generation', 'Sales returns not recorded timely', 'Customer master data changes without authorization'],
      controls: ['Sales order requires manager approval above threshold', 'Credit limit override requires credit manager sign-off', 'Invoice auto-matched against confirmed sales order and delivery', 'Revenue cutoff reconciliation at month-end', 'AR aging review and escalation process', 'System prevents duplicate invoice for same delivery', 'Sales return authorization and credit note workflow', 'Customer master change log with dual approval'],
    },
    R2R: {
      subProcesses: ['Journal Entries', 'Account Reconciliation', 'Financial Close', 'Intercompany', 'Consolidation'],
      risks: ['Unauthorized manual journal entries posted', 'Unreconciled balance sheet accounts', 'Delayed financial close', 'Intercompany imbalances unresolved', 'Consolidation adjustments not reviewed', 'Recurring JE template errors', 'Bank reconciliation exceptions unresolved', 'Materiality threshold override'],
      controls: ['Manual JE requires dual approval above materiality', 'Monthly account reconciliation with sign-off', 'Close checklist with deadline tracking', 'Automated intercompany matching and elimination', 'Consolidation package review by controller', 'Recurring JE template validation quarterly', 'Bank reconciliation exceptions escalation within 5 days', 'Materiality threshold enforced by system configuration'],
    },
    ITGC: {
      subProcesses: ['Access Management', 'Change Management', 'Operations', 'Data Backup'],
      risks: ['Unauthorized access to financial applications', 'Changes deployed without testing', 'Batch job failures not detected', 'Data backup not recoverable', 'Privileged access not reviewed', 'Emergency access not logged'],
      controls: ['Quarterly user access review for all financial apps', 'Change request approval and UAT sign-off required', 'Batch monitoring dashboard with automated alerts', 'Monthly backup restore test with documented results', 'Privileged access review by CISO quarterly', 'Emergency access logged and reviewed within 24 hours'],
    },
    S2C: {
      subProcesses: ['Sourcing', 'Contract Negotiation', 'Contract Execution', 'Vendor Management'],
      risks: ['Single-source award without justification', 'Contract terms not aligned with policy', 'Contract executed without authority', 'Vendor performance not monitored'],
      controls: ['Competitive bid required above threshold', 'Legal review mandatory for non-standard terms', 'Contract authority matrix enforced', 'Quarterly vendor scorecard review'],
    },
  };

  const tmpl = templates[process] || templates['O2C'];
  const rows: RACMRow[] = [];
  const prefix = process;

  tmpl.risks.forEach((risk, i) => {
    const subProc = tmpl.subProcesses[i % tmpl.subProcesses.length];
    const control = tmpl.controls[i] || tmpl.controls[0];
    const riskNum = String(i + 1).padStart(2, '0');
    const assertions: SoxAssertion[] = ['Existence', 'Completeness', 'Accuracy', 'Valuation', 'Cutoff', 'Presentation'];
    const frequencies: Frequency[] = ['Monthly', 'Quarterly', 'Event-driven', 'Daily', 'Annual'];
    const ctrlTypes: ControlType[] = ['Preventive', 'Detective'];
    const autos: Automation[] = ['Manual', 'IT-dependent', 'Automated'];

    rows.push({
      id: `racm-${process.toLowerCase()}-${i + 1}`,
      process,
      subProcess: subProc,
      riskId: `RSK-${prefix}-${riskNum}`,
      riskDescription: risk,
      controlId: `${prefix}-C-${riskNum}`,
      controlDescription: control,
      attributes: [
        { id: `${prefix}-C-${riskNum}.1`, description: `Primary test for ${control.toLowerCase().slice(0, 50)}`, testProcedure: `Inspect sample for compliance with ${control.toLowerCase().slice(0, 40)}.`,
          requiredEvidence: ['Supporting documentation', 'Approval evidence'], populationSize: 200 + i * 50, defaultSampleSize: 25 },
        ...(i % 3 === 0 ? [{ id: `${prefix}-C-${riskNum}.2`, description: 'Exception handling and follow-up verification', testProcedure: 'Review exception log and verify resolution within SLA.',
          requiredEvidence: ['Exception log', 'Resolution evidence'], populationSize: 30 + i * 5, defaultSampleSize: 15 }] : []),
      ],
      assertion: assertions[i % assertions.length],
      frequency: frequencies[i % frequencies.length],
      controlType: ctrlTypes[i % ctrlTypes.length],
      automation: autos[i % autos.length],
      isKey: i % 3 === 0,
    });
  });

  return rows;
}

/** Group RACM rows by sub-process — returns ordered groups for rendering. */
export function groupRacmBySubProcess(rows: RACMRow[]): { subProcess: string; rows: RACMRow[] }[] {
  const map = new Map<string, RACMRow[]>();
  rows.forEach(r => {
    const arr = map.get(r.subProcess) ?? [];
    arr.push(r);
    map.set(r.subProcess, arr);
  });
  return Array.from(map.entries()).map(([subProcess, rows]) => ({ subProcess, rows }));
}

/** Available RACM versions per process for the version dropdown. */
export const RACM_VERSIONS: { id: string; label: string; locked: boolean; lockedAt?: string }[] = [
  { id: 'v2.1', label: 'v2.1 — Current (Feb 2026)', locked: true,  lockedAt: 'Feb 12, 2026' },
  { id: 'v2.0', label: 'v2.0 — Nov 2025',           locked: true,  lockedAt: 'Nov 14, 2025' },
  { id: 'v1.9', label: 'v1.9 — Aug 2025',           locked: true,  lockedAt: 'Aug 30, 2025' },
];
