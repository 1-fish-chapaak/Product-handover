/**
 * Control-test catalog — the planner's universe of key controls per process.
 *
 * Each entry is one control and the one check that tests it. `keywords` is
 * how a chat prompt is decomposed (a prompt that hits several entries is
 * several checks); `existingWorkflowId` points at a Workflow Library row when
 * the platform already has an automated test for it; `automatable: false`
 * marks judgement controls that stay manual (they count against coverage —
 * that is the honest ceiling on automation).
 *
 * Coverage is measured against this catalog, so "P2P coverage 50% → 80%"
 * means "of the P2P key controls we know about, how many are tested by a
 * workflow".
 */
import type { ProcessCode } from '../engagements';
import type { ControlType, Frequency } from '../racm';
import type { Rating } from './types';

export interface CatalogEntry {
  key: string;
  process: ProcessCode;
  subProcess: string;
  controlId: string;
  controlTitle: string;
  controlDescription: string;
  riskTitle: string;
  riskRating: Rating;
  frequency: Frequency;
  controlType: ControlType;
  checkName: string;
  checkDescription: string;
  cadence: string;
  keywords: string[];
  automatable: boolean;
  existingWorkflowId?: string;
  existingWorkflowName?: string;
  dataNeeds: string[];
  sampleId: string;
  /** Report area whose last ATR raised a finding on this control. */
  priorFindingArea?: string;
  priorFinding?: string;
}

export const PROCESS_LONG: Record<ProcessCode, string> = {
  P2P: 'Procure-to-Pay',
  O2C: 'Order-to-Cash',
  R2R: 'Record-to-Report',
  S2C: 'Source-to-Contract',
  ITGC: 'IT General Controls',
};

export const PROCESS_BLURB: Record<ProcessCode, string> = {
  P2P: 'Vendors, purchase orders, invoices and payments',
  O2C: 'Customers, pricing, billing and collections',
  R2R: 'Journals, reconciliations and the close',
  S2C: 'Sourcing, contracts and vendor onboarding',
  ITGC: 'Access, segregation of duties and change',
};

const AP = 'sample-ap-audit';
const RECON = 'sample-fin-recon';
const CONTRACT = 'sample-vendor-contract';

export const CHECK_CATALOG: CatalogEntry[] = [
  // ── Procure-to-Pay ──────────────────────────────────────────────────────
  {
    key: 'p2p-dup', process: 'P2P', subProcess: 'Invoice Processing', controlId: 'P2P-C01',
    controlTitle: 'Duplicate invoice prevention',
    controlDescription: 'Invoices matching vendor + reference + amount within 30 days are blocked and routed for release.',
    riskTitle: 'Duplicate or fictitious invoices paid', riskRating: 'High', frequency: 'Daily', controlType: 'Preventive',
    checkName: 'Duplicate invoice detection',
    checkDescription: 'Exact and fuzzy duplicates across vendor, invoice number, amount and date.',
    cadence: 'Daily',
    keywords: ['duplicate invoice', 'duplicate payment', 'duplicate', 'double payment', 'paid twice', 'same invoice'],
    automatable: true, existingWorkflowId: 'lw-010', existingWorkflowName: 'Duplicate Invoice Detection',
    dataNeeds: ['AP invoice register'], sampleId: AP,
    priorFindingArea: 'Procure-to-Pay', priorFinding: '11 duplicate payments (₹38.2L) in FY26 Q1 ATR',
  },
  {
    key: 'p2p-3wm', process: 'P2P', subProcess: 'Invoice Processing', controlId: 'P2P-C02',
    controlTitle: 'Three-way match enforcement',
    controlDescription: 'Invoices are posted only when PO, goods receipt and invoice agree within tolerance.',
    riskTitle: 'Payment without goods received', riskRating: 'High', frequency: 'Daily', controlType: 'Preventive',
    checkName: 'Three-way match exceptions',
    checkDescription: 'Invoices paid without a matching PO / GRN, or outside the 2% price-quantity tolerance.',
    cadence: 'Daily',
    keywords: ['3-way', '3 way', 'three-way', 'three way', '2 way', 'two way', 'grn', 'goods receipt', 'po match', 'without po'],
    automatable: true, existingWorkflowId: 'lw-006', existingWorkflowName: '2 way or 3 way match',
    dataNeeds: ['AP invoice register', 'Purchase orders', 'Goods receipts'], sampleId: AP,
  },
  {
    key: 'p2p-po-approval', process: 'P2P', subProcess: 'Purchase Order Management', controlId: 'P2P-C03',
    controlTitle: 'PO approval per delegation of authority',
    controlDescription: 'POs are approved by the DOA level for their value; split POs that dodge a threshold are flagged.',
    riskTitle: 'Purchases approved above authority', riskRating: 'High', frequency: 'Event-driven', controlType: 'Preventive',
    checkName: 'PO approval & split-PO scan',
    checkDescription: 'POs approved below the required DOA level, and same-vendor POs split just under a threshold.',
    cadence: 'Weekly',
    keywords: ['po approval', 'approval limit', 'doa', 'delegation of authority', 'split po', 'split purchase', 'approval threshold', 'unapproved po'],
    automatable: true, existingWorkflowId: 'lw-011', existingWorkflowName: 'PO Approval Threshold Scan',
    dataNeeds: ['Purchase orders', 'DOA matrix'], sampleId: AP,
  },
  {
    key: 'p2p-vendor-master', process: 'P2P', subProcess: 'Vendor Management', controlId: 'P2P-C04',
    controlTitle: 'Vendor master change review',
    controlDescription: 'Changes to vendor bank details and terms are independently reviewed before the next payment run.',
    riskTitle: 'Payments diverted via bank-detail changes', riskRating: 'High', frequency: 'Weekly', controlType: 'Detective',
    checkName: 'Vendor master change monitor',
    checkDescription: 'Bank-account and payment-term changes, and any payment made within 48h of a change.',
    cadence: 'Daily',
    keywords: ['vendor master', 'vendor change', 'bank detail', 'bank account change', 'bank change'],
    automatable: true, existingWorkflowId: 'lw-012', existingWorkflowName: 'Vendor Master Change Monitor',
    dataNeeds: ['Vendor master', 'Vendor change log'], sampleId: AP,
    priorFindingArea: 'Procure-to-Pay', priorFinding: '3 bank changes paid same day without review — FY26 Q1 ATR',
  },
  {
    key: 'p2p-emp-vendor', process: 'P2P', subProcess: 'Vendor Management', controlId: 'P2P-C05',
    controlTitle: 'Employee–vendor conflict screening',
    controlDescription: 'Vendor bank accounts, addresses and PANs are screened against the employee master.',
    riskTitle: 'Related-party or ghost vendors', riskRating: 'High', frequency: 'Monthly', controlType: 'Detective',
    checkName: 'Employee–vendor match',
    checkDescription: 'Vendors sharing a bank account, address, phone or PAN with an employee.',
    cadence: 'Monthly',
    keywords: ['employee vendor', 'employee-vendor', 'conflict of interest', 'related party', 'ghost vendor', 'same address', 'same bank'],
    automatable: true, dataNeeds: ['Vendor master', 'Employee master'], sampleId: AP,
  },
  {
    key: 'p2p-inactive-vendor', process: 'P2P', subProcess: 'Vendor Management', controlId: 'P2P-C06',
    controlTitle: 'Payments to blocked or dormant vendors',
    controlDescription: 'Payments are blocked for vendors that are inactive, blocked, or missing KYC.',
    riskTitle: 'Payments to unapproved vendors', riskRating: 'Medium', frequency: 'Weekly', controlType: 'Preventive',
    checkName: 'Dormant & blocked vendor payments',
    checkDescription: 'Payments to vendors flagged blocked, dormant > 12 months, or without PAN / GST on file.',
    cadence: 'Weekly',
    keywords: ['inactive vendor', 'blocked vendor', 'dormant vendor', 'one-time vendor', 'kyc', 'without pan', 'gst'],
    automatable: true, dataNeeds: ['Vendor master', 'Payment register'], sampleId: AP,
  },
  {
    key: 'p2p-price-variance', process: 'P2P', subProcess: 'Purchase Order Management', controlId: 'P2P-C07',
    controlTitle: 'Purchase price variance review',
    controlDescription: 'Share of business going to higher-priced vendors for the same item is reviewed monthly.',
    riskTitle: 'Overpayment to favoured vendors', riskRating: 'Medium', frequency: 'Monthly', controlType: 'Detective',
    checkName: 'Higher-price vendor share',
    checkDescription: 'Items bought from several vendors where the higher-priced vendor wins most of the volume.',
    cadence: 'Monthly',
    keywords: ['price variance', 'higher price', 'rate variance', 'purchase price', 'overpriced'],
    automatable: true, existingWorkflowId: 'lw-001', existingWorkflowName: 'Identify Higher Share of Business Awarded to Higher Price Vendors (Monthly Analysis)',
    dataNeeds: ['Purchase orders'], sampleId: AP,
  },
  {
    key: 'p2p-weekend-pay', process: 'P2P', subProcess: 'Payments', controlId: 'P2P-C08',
    controlTitle: 'Out-of-cycle payment approval',
    controlDescription: 'Manual, urgent or weekend payments outside the payment run need CFO approval.',
    riskTitle: 'Unauthorised off-cycle payments', riskRating: 'Medium', frequency: 'Weekly', controlType: 'Detective',
    checkName: 'Off-cycle & weekend payments',
    checkDescription: 'Payments released on weekends / holidays or outside the scheduled run, with their approver.',
    cadence: 'Weekly',
    keywords: ['weekend', 'holiday', 'out of cycle', 'off-cycle', 'manual payment', 'urgent payment'],
    automatable: true, dataNeeds: ['Payment register'], sampleId: AP,
  },
  {
    key: 'p2p-backdated', process: 'P2P', subProcess: 'Invoice Processing', controlId: 'P2P-C09',
    controlTitle: 'Invoice receipt date validation',
    controlDescription: 'The recorded receipt date can never precede the invoice date.',
    riskTitle: 'Back-dated invoices', riskRating: 'Low', frequency: 'Monthly', controlType: 'Detective',
    checkName: 'Back-dated invoice check',
    checkDescription: 'Invoices whose "received" date is earlier than the invoice date.',
    cadence: 'Monthly',
    keywords: ['backdated', 'back-dated', 'back dated', 'receipt date', 'invoice received'],
    automatable: true, existingWorkflowId: 'lw-005', existingWorkflowName: '"Invoice received by emaar" date should not be less than the invoice date',
    dataNeeds: ['AP invoice register'], sampleId: AP,
  },
  {
    key: 'p2p-doa-review', process: 'P2P', subProcess: 'Purchase Order Management', controlId: 'P2P-C10',
    controlTitle: 'Annual DOA matrix review',
    controlDescription: 'The delegation-of-authority matrix is reviewed and re-approved by the board each year.',
    riskTitle: 'Stale approval limits', riskRating: 'Low', frequency: 'Annual', controlType: 'Preventive',
    checkName: 'DOA review walkthrough',
    checkDescription: 'Inspect the signed DOA and board minutes; confirm the ERP limits match.',
    cadence: 'Annual',
    keywords: ['doa review', 'authority matrix'],
    automatable: false, dataNeeds: ['DOA matrix', 'Board minutes'], sampleId: AP,
  },

  // ── Order-to-Cash ───────────────────────────────────────────────────────
  {
    key: 'o2c-price', process: 'O2C', subProcess: 'Pricing', controlId: 'O2C-C01',
    controlTitle: 'Price list adherence',
    controlDescription: 'Sales are billed at the approved price list; deviations need commercial approval.',
    riskTitle: 'Unapproved discounts', riskRating: 'Medium', frequency: 'Monthly', controlType: 'Detective',
    checkName: 'Same-material rate variance',
    checkDescription: 'The same material sold to the same customer at different rates in the period.',
    cadence: 'Monthly',
    keywords: ['different rate', 'pricing', 'price list', 'discount', 'same material', 'rate difference'],
    automatable: true, existingWorkflowId: 'lw-002', existingWorkflowName: 'To check whether same material sold at different rates to same customer',
    dataNeeds: ['Sales invoices', 'Price list'], sampleId: RECON,
  },
  {
    key: 'o2c-credit-limit', process: 'O2C', subProcess: 'Credit Management', controlId: 'O2C-C02',
    controlTitle: 'Credit limit enforcement',
    controlDescription: 'Orders beyond a customer’s credit limit are blocked unless credit control releases them.',
    riskTitle: 'Bad debt from over-limit sales', riskRating: 'High', frequency: 'Daily', controlType: 'Preventive',
    checkName: 'Credit-limit override scan',
    checkDescription: 'Orders released above the credit limit, who released them, and the exposure created.',
    cadence: 'Daily',
    keywords: ['credit limit', 'credit block', 'credit override', 'customer credit', 'over limit'],
    automatable: true, dataNeeds: ['Sales orders', 'Customer master'], sampleId: RECON,
    priorFindingArea: 'Order-to-Cash', priorFinding: '27 over-limit releases without approval — FY26 O2C ATR',
  },
  {
    key: 'o2c-cutoff', process: 'O2C', subProcess: 'Billing', controlId: 'O2C-C03',
    controlTitle: 'Revenue cut-off',
    controlDescription: 'Revenue is booked in the period goods were delivered.',
    riskTitle: 'Revenue recognised in the wrong period', riskRating: 'High', frequency: 'Quarterly', controlType: 'Detective',
    checkName: 'Revenue cut-off test',
    checkDescription: 'Invoices dated in the period with delivery after period end, and the reverse.',
    cadence: 'Quarterly',
    keywords: ['cut-off', 'cutoff', 'cut off', 'revenue recognition', 'period end'],
    automatable: true, dataNeeds: ['Sales invoices', 'Delivery notes'], sampleId: RECON,
  },
  {
    key: 'o2c-credit-notes', process: 'O2C', subProcess: 'Billing', controlId: 'O2C-C04',
    controlTitle: 'Credit note approval',
    controlDescription: 'Credit notes are approved and tied to a return or a documented dispute.',
    riskTitle: 'Revenue reversed after close', riskRating: 'Medium', frequency: 'Monthly', controlType: 'Detective',
    checkName: 'Post-period credit notes',
    checkDescription: 'Credit notes raised in the first 15 days after period end against prior-period invoices.',
    cadence: 'Monthly',
    keywords: ['credit note', 'credit memo', 'sales return', 'returns'],
    automatable: true, dataNeeds: ['Sales invoices', 'Credit notes'], sampleId: RECON,
  },
  {
    key: 'o2c-unapplied', process: 'O2C', subProcess: 'Collections', controlId: 'O2C-C05',
    controlTitle: 'Unapplied cash follow-up',
    controlDescription: 'Unapplied receipts older than 30 days are investigated and cleared.',
    riskTitle: 'Misstated receivables', riskRating: 'Low', frequency: 'Monthly', controlType: 'Detective',
    checkName: 'Unapplied cash ageing',
    checkDescription: 'Receipts not matched to an invoice, aged by bucket.',
    cadence: 'Monthly',
    keywords: ['unapplied', 'receivable', 'collections', 'dso', 'ar aging', 'ar ageing'],
    automatable: true, dataNeeds: ['Bank receipts', 'AR ledger'], sampleId: RECON,
  },
  {
    key: 'o2c-customer-master', process: 'O2C', subProcess: 'Credit Management', controlId: 'O2C-C06',
    controlTitle: 'Customer master change review',
    controlDescription: 'Changes to customer credit terms and limits are approved by credit control.',
    riskTitle: 'Unauthorised credit terms', riskRating: 'Medium', frequency: 'Monthly', controlType: 'Detective',
    checkName: 'Customer master change log',
    checkDescription: 'Credit-term and limit changes without a matching approval.',
    cadence: 'Monthly',
    keywords: ['customer master', 'credit terms'],
    automatable: true, dataNeeds: ['Customer master', 'Change log'], sampleId: RECON,
  },

  // ── Record-to-Report ────────────────────────────────────────────────────
  {
    key: 'r2r-manual-je', process: 'R2R', subProcess: 'Journal Entries', controlId: 'R2R-C01',
    controlTitle: 'Manual journal approval',
    controlDescription: 'Manual journals above ₹10L are approved by the financial controller before posting.',
    riskTitle: 'Unauthorised manual journals', riskRating: 'High', frequency: 'Daily', controlType: 'Preventive',
    checkName: 'After-hours manual journals',
    checkDescription: 'Manual journals posted after 8pm, on weekends or holidays, with approver and amount.',
    cadence: 'Weekly',
    keywords: ['journal', 'manual je', 'manual journal', 'manual entries', 'after hours', 'after-hours', 'je'],
    automatable: true, dataNeeds: ['GL journal lines'], sampleId: RECON,
  },
  {
    key: 'r2r-sod-je', process: 'R2R', subProcess: 'Journal Entries', controlId: 'R2R-C02',
    controlTitle: 'Maker–checker on journals',
    controlDescription: 'The preparer of a journal cannot approve it.',
    riskTitle: 'Self-approved journals', riskRating: 'High', frequency: 'Daily', controlType: 'Preventive',
    checkName: 'Self-approved journal scan',
    checkDescription: 'Journals where preparer and approver are the same user.',
    cadence: 'Weekly',
    keywords: ['self-approved', 'self approved', 'same user', 'maker checker', 'maker-checker', 'posted and approved'],
    automatable: true, dataNeeds: ['GL journal lines', 'User list'], sampleId: RECON,
  },
  {
    key: 'r2r-round', process: 'R2R', subProcess: 'Journal Entries', controlId: 'R2R-C03',
    controlTitle: 'Unusual journal review',
    controlDescription: 'Round-amount and single-line journals are reviewed monthly.',
    riskTitle: 'Estimates booked without support', riskRating: 'Medium', frequency: 'Monthly', controlType: 'Detective',
    checkName: 'Round-amount journals',
    checkDescription: 'Journals in round lakhs / crores with a one-line narrative.',
    cadence: 'Monthly',
    keywords: ['round amount', 'round-sum', 'round figure', 'round number'],
    automatable: true, dataNeeds: ['GL journal lines'], sampleId: RECON,
  },
  {
    key: 'r2r-recon', process: 'R2R', subProcess: 'Close & Reconciliation', controlId: 'R2R-C04',
    controlTitle: 'Balance sheet reconciliation',
    controlDescription: 'Key balance sheet accounts are reconciled to sub-ledgers each month.',
    riskTitle: 'Unreconciled balances', riskRating: 'Medium', frequency: 'Monthly', controlType: 'Detective',
    checkName: 'GL to sub-ledger reconciliation',
    checkDescription: 'Differences between GL control accounts and the sub-ledger, by account.',
    cadence: 'Monthly',
    keywords: ['reconciliation', 'recon', 'reconcile', 'sub-ledger', 'subledger', 'bank reconciliation'],
    automatable: true, existingWorkflowId: 'lw-008', existingWorkflowName: 'Accounting Document Reconciliation Report',
    dataNeeds: ['GL trial balance', 'Sub-ledger'], sampleId: RECON,
  },
  {
    key: 'r2r-suspense', process: 'R2R', subProcess: 'Close & Reconciliation', controlId: 'R2R-C05',
    controlTitle: 'Suspense account clearance',
    controlDescription: 'Suspense and clearing accounts are cleared within 30 days.',
    riskTitle: 'Misstatements parked in suspense', riskRating: 'Medium', frequency: 'Monthly', controlType: 'Detective',
    checkName: 'Suspense account ageing',
    checkDescription: 'Open items in suspense / clearing accounts aged beyond 30 days.',
    cadence: 'Monthly',
    keywords: ['suspense', 'clearing account'],
    automatable: true, dataNeeds: ['GL journal lines'], sampleId: RECON,
  },
  {
    key: 'r2r-topside', process: 'R2R', subProcess: 'Consolidation', controlId: 'R2R-C06',
    controlTitle: 'Top-side adjustment review',
    controlDescription: 'Consolidation adjustments are documented and approved by the CFO.',
    riskTitle: 'Management override', riskRating: 'High', frequency: 'Quarterly', controlType: 'Preventive',
    checkName: 'Top-side adjustment walkthrough',
    checkDescription: 'Inspect each top-side entry for support and CFO approval.',
    cadence: 'Quarterly',
    keywords: ['top-side', 'topside', 'top side', 'consolidation adjustment'],
    automatable: false, dataNeeds: ['Consolidation pack'], sampleId: RECON,
  },

  // ── Source-to-Contract ──────────────────────────────────────────────────
  {
    key: 's2c-contract', process: 'S2C', subProcess: 'Contract Management', controlId: 'S2C-C01',
    controlTitle: 'Spend within contract terms',
    controlDescription: 'Invoices are raised only against active contracts, within cap and scope.',
    riskTitle: 'Off-contract spend', riskRating: 'High', frequency: 'Monthly', controlType: 'Detective',
    checkName: 'Off-contract & expired-contract spend',
    checkDescription: 'Invoices against expired contracts, above contract cap, or outside contract scope.',
    cadence: 'Monthly',
    keywords: ['contract', 'expired contract', 'contract expiry', 'off-contract', 'maverick spend', 'contract cap'],
    automatable: true, dataNeeds: ['AP invoice register', 'Contracts register'], sampleId: CONTRACT,
  },
  {
    key: 's2c-single-source', process: 'S2C', subProcess: 'Sourcing', controlId: 'S2C-C02',
    controlTitle: 'Competitive bidding',
    controlDescription: 'Awards above ₹25L need three bids or a documented single-source justification.',
    riskTitle: 'Uncompetitive awards', riskRating: 'Medium', frequency: 'Event-driven', controlType: 'Preventive',
    checkName: 'Single-source award scan',
    checkDescription: 'Awards above threshold with fewer than three bids and no justification on file.',
    cadence: 'Monthly',
    keywords: ['single source', 'sole source', 'rfq', 'bids', 'tender', 'bidding'],
    automatable: true, dataNeeds: ['Sourcing events', 'Purchase orders'], sampleId: CONTRACT,
  },
  {
    key: 's2c-concentration', process: 'S2C', subProcess: 'Sourcing', controlId: 'S2C-C03',
    controlTitle: 'Vendor concentration monitoring',
    controlDescription: 'Spend concentration by vendor is reviewed each quarter.',
    riskTitle: 'Supplier dependency', riskRating: 'Low', frequency: 'Quarterly', controlType: 'Detective',
    checkName: 'Vendor concentration',
    checkDescription: 'Share of category spend with the top vendors, and quarter-on-quarter drift.',
    cadence: 'Quarterly',
    keywords: ['concentration', 'share of business', 'top vendors', 'dependency'],
    automatable: true, dataNeeds: ['AP invoice register'], sampleId: CONTRACT,
  },
  {
    key: 's2c-onboarding', process: 'S2C', subProcess: 'Vendor Onboarding', controlId: 'S2C-C04',
    controlTitle: 'Vendor due diligence',
    controlDescription: 'New vendors complete KYC, sanctions and financial checks before activation.',
    riskTitle: 'Onboarding unvetted vendors', riskRating: 'Medium', frequency: 'Event-driven', controlType: 'Preventive',
    checkName: 'Due-diligence file inspection',
    checkDescription: 'Sample new vendors; inspect the KYC, sanctions and approval evidence.',
    cadence: 'Quarterly',
    keywords: ['onboarding', 'due diligence', 'vendor registration', 'sanctions'],
    automatable: false, dataNeeds: ['Vendor onboarding files'], sampleId: CONTRACT,
  },

  // ── IT General Controls ─────────────────────────────────────────────────
  {
    key: 'itgc-terminated', process: 'ITGC', subProcess: 'Access Management', controlId: 'ITGC-C01',
    controlTitle: 'Leaver access removal',
    controlDescription: 'Access for leavers is revoked within 24 hours of their exit date.',
    riskTitle: 'Leavers retain system access', riskRating: 'High', frequency: 'Weekly', controlType: 'Preventive',
    checkName: 'Terminated users with active access',
    checkDescription: 'HR leavers still active in the ERP, and any logins after their exit date.',
    cadence: 'Weekly',
    keywords: ['terminated', 'leaver', 'exited employee', 'active access', 'orphan account'],
    automatable: true, dataNeeds: ['HR leavers list', 'ERP user list'], sampleId: RECON,
    priorFindingArea: 'IT General Controls', priorFinding: '14 leavers active > 30 days — FY26 Q1 ITGC ATR',
  },
  {
    key: 'itgc-privileged', process: 'ITGC', subProcess: 'Access Management', controlId: 'ITGC-C02',
    controlTitle: 'Privileged access monitoring',
    controlDescription: 'Privileged sessions are logged and reviewed weekly.',
    riskTitle: 'Misuse of privileged access', riskRating: 'High', frequency: 'Weekly', controlType: 'Detective',
    checkName: 'Privileged session review',
    checkDescription: 'Long or out-of-hours privileged sessions and what they changed.',
    cadence: 'Weekly',
    keywords: ['privileged', 'admin access', 'super user', 'superuser', 'session duration'],
    automatable: true, existingWorkflowId: 'lw-007', existingWorkflowName: 'Access Session Duration Analysis',
    dataNeeds: ['Access logs'], sampleId: RECON,
  },
  {
    key: 'itgc-sod', process: 'ITGC', subProcess: 'Access Management', controlId: 'ITGC-C03',
    controlTitle: 'Segregation of duties',
    controlDescription: 'No user holds conflicting roles (e.g. create vendor + approve payment).',
    riskTitle: 'Conflicting access', riskRating: 'High', frequency: 'Quarterly', controlType: 'Preventive',
    checkName: 'SoD conflict scan',
    checkDescription: 'Users holding role combinations in the SoD rule-set, and whether they used both.',
    cadence: 'Monthly',
    keywords: ['segregation of duties', 'sod', 'conflicting roles', 'toxic combination'],
    automatable: true, dataNeeds: ['ERP user roles', 'SoD rule-set'], sampleId: RECON,
  },
  {
    key: 'itgc-change', process: 'ITGC', subProcess: 'Change Management', controlId: 'ITGC-C04',
    controlTitle: 'Change approval',
    controlDescription: 'Production changes have an approved ticket before deployment.',
    riskTitle: 'Unauthorised production changes', riskRating: 'Medium', frequency: 'Event-driven', controlType: 'Preventive',
    checkName: 'Unapproved change scan',
    checkDescription: 'Deployments with no approved ticket, or approved after the deploy time.',
    cadence: 'Weekly',
    keywords: ['change management', 'production change', 'deployment', 'unapproved change'],
    automatable: true, dataNeeds: ['Deployment log', 'Change tickets'], sampleId: RECON,
  },
  {
    key: 'itgc-uar', process: 'ITGC', subProcess: 'Access Management', controlId: 'ITGC-C05',
    controlTitle: 'User access review',
    controlDescription: 'Business owners recertify user access every quarter.',
    riskTitle: 'Access creep', riskRating: 'Medium', frequency: 'Quarterly', controlType: 'Detective',
    checkName: 'Access recertification inspection',
    checkDescription: 'Inspect the quarter’s sign-offs; confirm removals were actioned.',
    cadence: 'Quarterly',
    keywords: ['access review', 'uar', 'recertification'],
    automatable: false, dataNeeds: ['Access review sign-offs'], sampleId: RECON,
  },
];

export function catalogFor(process: ProcessCode): CatalogEntry[] {
  return CHECK_CATALOG.filter(e => e.process === process);
}
