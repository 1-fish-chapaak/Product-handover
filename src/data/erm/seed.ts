/**
 * The register's risk profile — for every risk on the register: inherent
 * likelihood and impact, the Control Library controls that mitigate it, the
 * indicators that watch it (seven months, Apr → Oct), loss events, and the
 * action plan. Stories are deliberate: some risks ease after a control went
 * live mid-year, a few deteriorate into the red this month, and a handful
 * have no control that actually operates — the gaps the register exists to
 * surface.
 */
import { SEED_RISKS } from '../riskRegister';
import type { ActionItem, ErmRisk, Kri, RiskEvent, Treatment } from './model';

/** "1 2 2 3 5 6 8" → [1, 2, 2, 3, 5, 6, 8] */
const s = (v: string) => v.trim().split(/\s+/).map(Number);

type K = Omit<Kri, 'id'>;
const kri = (name: string, type: Kri['type'], unit: Kri['unit'], amber: number, red: number, values: string, source: string, defn: string, lowerIsWorse = false): K =>
  ({ name, type, unit, amber, red, values: s(values), source, defn, ...(lowerIsWorse ? { lowerIsWorse } : {}) });
const act = (title: string, owner: string, due: string, done = false): Omit<ActionItem, 'id'> => ({ title, owner, due, done });

interface Profile {
  l: number; i: number; t?: Treatment;
  controls: string[];
  since?: Record<string, number>;
  kris: K[];
  events?: RiskEvent[];
  actions?: Omit<ActionItem, 'id'>[];
}

const PROFILE: Record<string, Profile> = {
  'RSK-001': {
    l: 4, i: 5, controls: ['C-001', 'C-004', 'P2P-C03', 'P2P-C08'],
    kris: [
      kri('Payments without an approved PO', 'KCI', '%', 0.5, 1.5, '0.3 0.4 0.3 0.6 0.5 0.7 0.4', 'SAP F110, EKKO', 'Payments in the month with no approved purchase order behind them, as a share of payments'),
      kri('Out-of-cycle payments', 'KRI', 'count', 5, 12, '3 4 6 5 8 11 14', 'SAP F110', 'Payments released outside the scheduled payment run'),
      kri('Payments released by the PO creator', 'KCI', 'count', 1, 3, '0 0 1 0 0 1 0', 'SAP F110, EKKO', 'Payments where the person who raised the PO also released the payment'),
    ],
    events: [{ m: 6, text: '14 out-of-cycle payments in October — 6 to one vendor' }],
    actions: [act('Restrict manual payment runs to treasury', 'Rajiv Sharma', '31 Oct 2026'), act('Adapt out-of-cycle payment control with F110 data', 'Tushar Goel', '15 Nov 2026')],
  },
  'RSK-002': {
    l: 4, i: 3, controls: ['C-003', 'P2P-C01', 'P2P-C02', 'P2P-C09'], since: { 'C-003': 3 },
    kris: [
      kri('Duplicate invoices reaching payment', 'KRI', 'count', 2, 5, '6 7 5 2 1 1 0', 'SAP FBL1N', 'Invoices with the same vendor, amount and reference that reached the payment run'),
      kri('Duplicate payments recovered', 'KRI', '₹ L', 2, 5, '3.1 4.4 2.8 2.4 0.6 0 0', 'Recovery tracker', 'Value recovered from vendors for invoices paid twice'),
    ],
    events: [{ m: 3, text: '₹2.4 L paid twice to vendor V-3344 — recovered', loss: 2.4 }],
    actions: [act('Duplicate detector live on every invoice', 'Tushar Goel', '30 Jun 2026', true)],
  },
  'RSK-003': {
    l: 3, i: 5, controls: ['C-002', 'P2P-C04', 'P2P-C05', 'P2P-C06'],
    kris: [
      kri('Vendors sharing a bank account with an employee', 'KRI', 'count', 1, 2, '0 0 0 1 1 2 2', 'Vendor master, HR master', 'Active vendors whose bank account matches an employee’s salary account'),
      kri('Vendor bank changes without approval', 'KCI', 'count', 2, 5, '1 2 1 3 4 4 4', 'SAP CDHDR', 'Bank detail changes on the vendor master not approved by a second person'),
      kri('Payments to dormant vendors', 'KRI', 'count', 1, 3, '0 1 0 0 1 1 2', 'SAP FBL1N', 'Payments to vendors with no activity in the previous 12 months'),
    ],
    events: [{ m: 5, text: 'Two vendors found sharing an employee’s bank account' }],
    actions: [act('Investigate the two vendor–employee bank matches', 'Deepak Bansal', '20 Oct 2026'), act('Adapt employee–vendor screening with HR data', 'Deepak Bansal', '31 Oct 2026')],
  },
  'RSK-004': {
    l: 3, i: 3, controls: ['C-014', 'P2P-C03', 'P2P-C07', 'P2P-C10'],
    kris: [
      kri('POs above threshold without dual sign-off', 'KCI', 'count', 2, 6, '3 2 4 3 2 2 1', 'SAP EKKO', 'Purchase orders above ₹10 L released with a single approval'),
      kri('PO splitting below the threshold', 'KRI', 'count', 3, 8, '2 3 2 4 3 2 2', 'SAP EKKO', 'Same vendor, same day POs that together cross the approval threshold'),
    ],
    actions: [act('Move dual sign-off into the ERP release strategy', 'Meera Patel', '30 Nov 2026')],
  },
  'RSK-005': {
    l: 4, i: 4, controls: ['C-009', 'ITGC-C03'], since: { 'C-009': 2 },
    kris: [
      kri('Users who can create and approve payments', 'KCI', 'count', 2, 5, '7 6 4 3 3 2 1', 'SAP SUIM', 'Users holding both payment creation and payment approval roles'),
      kri('Payments created and approved by one user', 'KRI', 'count', 1, 3, '4 3 1 0 1 0 0', 'SAP F110', 'Payments where the same user ID appears as creator and approver'),
    ],
    actions: [act('Remove create + approve combinations', 'IT Security', '31 Jul 2026', true)],
  },
  'RSK-006': {
    l: 2, i: 5, controls: ['C-005', 'O2C-C03'],
    kris: [
      kri('Invoices dated before delivery at month end', 'KRI', '%', 1, 3, '0.8 1.1 2.4 1.0 0.9 1.6 0.9', 'SAP VF05, LIKP', 'Invoices raised in the last five days of the month before the goods were delivered'),
      kri('Revenue reversed in the following period', 'KRI', '₹ L', 10, 25, '6 8 22 9 7 12 8', 'GL 4000-series', 'Revenue reversed in the first week of the next month'),
    ],
    actions: [act('Adapt revenue cut-off test with delivery data', 'Neha Joshi', '15 Nov 2026')],
  },
  'RSK-007': {
    l: 3, i: 4, controls: ['C-007', 'R2R-C01', 'R2R-C02', 'R2R-C03'],
    kris: [
      kri('Manual journals posted without approval', 'KCI', 'count', 3, 8, '5 4 6 3 2 2 2', 'SAP FAGLL03', 'Manual journals posted without a recorded approval'),
      kri('Journals posted at weekends by finance users', 'KRI', 'count', 5, 12, '4 6 5 7 3 4 4', 'SAP FAGLL03', 'Journals posted on Saturday or Sunday'),
      kri('Round-sum journals above ₹10 L', 'KRI', 'count', 4, 10, '2 3 5 3 2 3 2', 'SAP FAGLL03', 'Journals for a round amount above ₹10 lakh'),
    ],
  },
  'RSK-008': {
    l: 3, i: 3, controls: ['C-008', 'C-013', 'R2R-C04', 'R2R-C05'],
    kris: [
      kri('Unreconciled balance sheet accounts', 'KCI', 'count', 3, 8, '6 5 4 4 3 2 2', 'Reconciliation tracker', 'Balance sheet accounts not reconciled by working day 5'),
      kri('Suspense balance older than 30 days', 'KRI', '₹ L', 15, 40, '22 18 16 12 14 9 8', 'SAP FAGLL03', 'Value sitting in suspense accounts for more than 30 days'),
    ],
  },
  'RSK-009': {
    l: 3, i: 3, controls: ['C-006', 'O2C-C02', 'O2C-C06'],
    kris: [
      kri('Orders released above credit limit', 'KCI', 'count', 5, 12, '4 6 5 7 9 8 10', 'SAP VKM1', 'Sales orders released while the customer was over limit'),
      kri('Credit limit changes without approval', 'KCI', 'count', 1, 3, '0 1 0 1 2 1 0', 'SAP CDHDR', 'Credit limit increases on the customer master without a recorded approval'),
    ],
    actions: [act('Approve Credit Limit Override control (draft)', 'Sneha Desai', '31 Oct 2026')],
  },
  'RSK-010': {
    l: 4, i: 5, controls: ['C-010', 'ITGC-C01', 'ITGC-C02', 'ITGC-C05'],
    kris: [
      kri('Leavers with active ERP access', 'KCI', 'count', 1, 3, '0 1 1 0 2 3 4', 'HR leavers, SAP SUIM', 'People who left more than 7 days ago whose ERP user is still active'),
      kri('Privileged sessions outside change windows', 'KRI', 'count', 4, 10, '3 5 4 6 8 9 12', 'SAP SM20', 'Firefighter or SAP_ALL sessions outside an approved change window'),
      kri('Access reviews overdue', 'KCI', '%', 10, 25, '5 8 12 15 18 22 24', 'GRC tool', 'Quarterly access certifications past their due date'),
    ],
    events: [{ m: 5, text: 'A leaver’s ID used 9 days after exit — no transactions posted' }],
    actions: [act('Automate leaver removal from the HR feed', 'IT Security', '30 Nov 2026'), act('Close Q2 access certifications', 'Priya Singh', '25 Oct 2026')],
  },
  'RSK-011': {
    l: 3, i: 4, controls: ['ITGC-C04'],
    kris: [
      kri('Deployments without an approved change', 'KCI', 'count', 1, 3, '1 0 2 1 2 3 2', 'Deployment log, ITSM', 'Production deployments with no approved change ticket'),
      kri('Emergency changes not ratified in 5 days', 'KCI', 'count', 2, 5, '1 2 2 3 4 3 1', 'ITSM', 'Emergency changes still without CAB ratification after five working days'),
    ],
  },
  'RSK-012': {
    l: 2, i: 5, controls: ['C-008', 'R2R-C06'],
    kris: [
      kri('Close completed after working day 5', 'KRI', 'days', 6, 8, '5 5 6 5 5 7 5', 'Close calendar', 'Working days taken to complete the monthly close'),
      kri('Regulatory filings due in 15 days not drafted', 'KRI', 'count', 1, 2, '0 0 1 0 0 1 0', 'Compliance calendar', 'Filings due within 15 days with no draft on file'),
    ],
    events: [{ m: 2, text: 'GSTR-9 filed two days late — penalty waived', regulatory: false }],
  },
  'RSK-013': {
    l: 3, i: 3, controls: ['O2C-C01', 'O2C-C04'],
    kris: [
      kri('Billing below contract rate', 'KRI', '₹ L', 3, 8, '2.1 2.6 3.4 4.0 3.2 2.8 2.2', 'SAP VK13, VF05', 'Value under-billed against the contracted price'),
      kri('Unbilled milestones over 30 days', 'KRI', 'count', 2, 6, '3 2 2 1 2 1 1', 'Project billing', 'Contract milestones completed but not billed for more than 30 days'),
    ],
  },
  'RSK-014': {
    l: 2, i: 4, controls: [],
    kris: [
      kri('Backup jobs failed this month', 'KRI', 'count', 2, 5, '1 2 1 3 2 4 4', 'Backup console', 'Scheduled backup jobs that failed or did not run'),
      kri('Days since the last restore test', 'KRI', 'days', 90, 180, '120 151 181 212 242 273 303', 'DR register', 'Days since a backup was last restored and verified'),
    ],
    actions: [act('Design a backup and restore control', 'IT Security', '30 Nov 2026')],
  },
  'RSK-021': {
    l: 3, i: 4, controls: ['O2C-C01'],
    kris: [
      kri('Same material sold at different rates', 'KRI', 'count', 5, 15, '6 8 7 9 12 14 17', 'SAP VBAP', 'Same material, same customer, same month, sold at more than one rate'),
      kri('Discounts above the approved band', 'KCI', '%', 1, 3, '0.8 1.2 1.1 1.5 2.2 2.6 2.7', 'SAP KONV', 'Order value carrying a discount above the approved band'),
    ],
    actions: [act('Price list adherence — review October exceptions', 'Sneha Desai', '24 Oct 2026')],
  },
  'RSK-022': {
    l: 3, i: 4, controls: ['O2C-C02', 'O2C-C03'],
    kris: [
      kri('Deliveries without an approved sales order', 'KCI', 'count', 1, 4, '2 1 3 2 2 1 0', 'SAP LIKP, VBAK', 'Outbound deliveries posted against an unapproved or blocked order'),
    ],
  },
  'RSK-023': {
    l: 2, i: 3, controls: ['O2C-C05'],
    kris: [
      kri('Unapplied cash older than 30 days', 'KRI', '₹ L', 20, 50, '28 31 35 30 33 38 42', 'SAP FBL5N', 'Customer receipts not matched to an invoice within 30 days'),
    ],
  },
  'RSK-024': {
    l: 2, i: 4, controls: ['O2C-C05', 'O2C-C04'],
    kris: [
      kri('Receivables over 180 days', 'KRI', '%', 6, 10, '5.2 5.8 6.1 6.6 6.4 6.1 5.7', 'SAP FBL5N', 'Share of receivables more than 180 days past due'),
    ],
  },
  'RSK-025': {
    l: 3, i: 3, controls: ['C-011', 'S2C-C01'],
    kris: [
      kri('Spend above contract value', 'KRI', '₹ L', 10, 30, '4 6 9 12 14 18 21', 'AP register, contracts', 'Spend against a contract beyond its approved value'),
      kri('Expired contracts with live POs', 'KCI', 'count', 1, 4, '1 1 2 2 3 3 3', 'Contracts register', 'Purchase orders open against a contract that has expired'),
    ],
  },
  'RSK-026': {
    l: 3, i: 4, controls: ['S2C-C02'],
    kris: [
      kri('Awards above ₹25 L without three bids', 'KCI', 'count', 1, 3, '1 0 2 1 2 2 3', 'Sourcing events', 'Awards above the bidding threshold with fewer than three quotes'),
    ],
    actions: [act('Adapt competitive bidding control with sourcing data', 'Deepak Bansal', '30 Nov 2026')],
  },
  'RSK-027': {
    l: 2, i: 4, controls: ['C-012', 'S2C-C03', 'S2C-C04'],
    kris: [
      kri('Spend with the largest supplier', 'KRI', '%', 25, 35, '22 23 24 26 27 27 28', 'AP register', 'Share of addressable spend with the single largest supplier'),
    ],
  },
  'RSK-028': {
    l: 3, i: 4, controls: ['INV-C04', 'INV-C02'],
    kris: [
      kri('Physical count variance', 'KRI', '%', 0.5, 1.5, '0.3 0.4 0.4 0.6 0.5 0.9 1.7', 'SAP MI24', 'Net count variance as a share of book value'),
      kri('Write-offs without approval', 'KCI', 'count', 1, 3, '0 0 1 0 1 1 2', 'SAP MB51', 'Scrap and write-off postings with no approval on file'),
    ],
    events: [{ m: 6, text: 'Bhiwandi warehouse count short by ₹18 L', loss: 18 }],
    actions: [act('Recount Bhiwandi high-value bins', 'Priya Singh', '22 Oct 2026')],
  },
  'RSK-029': {
    l: 3, i: 4, controls: ['INV-C03', 'INV-C06'],
    kris: [
      kri('Stock with no movement in 180 days', 'KRI', '%', 8, 15, '9 9 10 11 11 12 12', 'SAP MB5B, MB51', 'Share of stock value with no issue in 180 days'),
    ],
  },
  'RSK-030': {
    l: 3, i: 3, controls: ['INV-C01', 'INV-C05'],
    kris: [
      kri('Negative stock instances', 'KCI', 'count', 3, 10, '2 3 4 3 5 4 2', 'SAP MB5B', 'Materials that went negative on any day in the month'),
      kri('Back-dated goods receipts', 'KRI', '%', 2, 5, '1.4 1.8 2.2 1.9 2.4 2.1 1.8', 'SAP MB51', 'Goods receipts posted to an earlier date than entry'),
    ],
  },
};

/** The register as rated risks — every seed risk with its profile. */
export function seedErmRisks(): ErmRisk[] {
  return SEED_RISKS.map(r => {
    const p = PROFILE[r.id] ?? { l: 3, i: 3, controls: [], kris: [] };
    return {
      ...r,
      likelihood: p.l,
      impact: p.i,
      treatment: p.t ?? 'Mitigate',
      controlIds: p.controls,
      controlSince: p.since,
      kris: p.kris.map((k, i) => ({ ...k, id: `${r.id}-K${i + 1}` })),
      events: p.events ?? [],
      actions: (p.actions ?? []).map((a, i) => ({ ...a, id: `${r.id}-A${i + 1}` })),
      assessments: [{ at: r.lastReviewed === '—' ? r.createdAt : r.lastReviewed, by: r.reviewer, likelihood: p.l, impact: p.i, note: 'Annual risk assessment' }],
    };
  });
}

/** Controls whose last run raised exceptions — they mitigate, but not fully. */
export const LAST_RUN_EXCEPTIONS: Record<string, number> = {
  'C-004': 3, 'C-007': 5, 'O2C-C01': 17, 'ITGC-C02': 12, 'P2P-C03': 2,
};
