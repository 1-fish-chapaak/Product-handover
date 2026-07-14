// One-Click Audit — curated "AI" recommendation seed. The modal's loader
// pretends to derive this from the connected databases + uploaded SOPs/DOAs;
// the plan below is the deterministic result it lands on, demo-style (same
// approach as the other SOX demo features). Every id is stable so selection
// state survives step navigation.

import type { EngType, ProcessCode, AutomationSubtype } from '../../data/engagements';

export interface RecommendedRisk {
  id: string;
  title: string;
  description: string;
  severity: 'High' | 'Medium' | 'Low';
  selected: boolean;
}

export interface RecommendedControl {
  id: string;
  controlId: string;
  /** Which recommended risk this control mitigates. */
  riskId: string;
  title: string;
  description: string;
  frequency: string;
  controlType: 'Preventive' | 'Detective';
  automation: 'Automated' | 'IT-Dependent' | 'Manual';
  isKey: boolean;
  selected: boolean;
}

export interface RecommendedWorkflow {
  id: string;
  name: string;
  description: string;
  cadence: string;
  /** Control the workflow evidences, for the register cross-link. */
  controlId: string;
  selected: boolean;
}

export interface RecommendedEngagement {
  id: string;
  code: string;
  name: string;
  description: string;
  type: EngType;
  subtype?: AutomationSubtype;
  process: ProcessCode;
  framework: string;
  owner: string;
  /** 0–100 model confidence shown on the card. */
  confidence: number;
  /** One-line "why Ira recommends this" rationale. */
  rationale: string;
  /** Evidence the recommendation is grounded in (data sources, SOPs, web). */
  sources: string[];
  /** Editable timeline, yyyy-mm month values. */
  startMonth: string;
  endMonth: string;
  selected: boolean;
  risks: RecommendedRisk[];
  controls: RecommendedControl[];
  workflows: RecommendedWorkflow[];
}

export function buildRecommendedPlan(): RecommendedEngagement[] {
  return [
    {
      id: 'oca-eng-1',
      code: 'ENG-A01',
      name: 'AP Invoice Integrity — Internal Audit',
      description: 'Internal audit of the Procure-to-Pay invoice cycle — duplicate postings, three-way match exceptions, and payment-run overrides across the SAP AP module.',
      type: 'Internal Audit',
      process: 'P2P',
      framework: 'Internal Policy',
      owner: 'Priya Singh',
      confidence: 96,
      rationale: '1.2M AP line items show a 0.8% duplicate-candidate rate and 214 invoices posted without a matching GRN in the last quarter.',
      sources: ['SAP ERP: AP Module', 'Vendor Master Data', 'DOA matrix'],
      startMonth: '2026-08',
      endMonth: '2026-11',
      selected: true,
      risks: [
        { id: 'oca-r-1a', title: 'Duplicate or fictitious invoices', description: 'Same vendor, amount, and reference posted more than once, or invoices for vendors with no purchase history.', severity: 'High', selected: true },
        { id: 'oca-r-1b', title: 'Three-way match bypass', description: 'Invoices paid without PO or goods-receipt matching, overriding tolerance limits.', severity: 'High', selected: true },
        { id: 'oca-r-1c', title: 'Unauthorized payment-run changes', description: 'Bank details or payment terms edited between invoice approval and the payment run.', severity: 'Medium', selected: true },
      ],
      controls: [
        { id: 'oca-c-1a', controlId: 'AP-C01', riskId: 'oca-r-1a', title: 'Duplicate invoice system check', description: 'SAP blocks postings matching vendor + reference + amount within 30 days; exceptions route to AP supervisor for release.', frequency: 'Continuous', controlType: 'Preventive', automation: 'Automated', isKey: true, selected: true },
        { id: 'oca-c-1b', controlId: 'AP-C02', riskId: 'oca-r-1a', title: 'Vendor-invoice fuzzy-match review', description: 'Weekly fuzzy-match report (near-identical reference / amount ±1%) reviewed and dispositioned by AP manager.', frequency: 'Weekly', controlType: 'Detective', automation: 'IT-Dependent', isKey: false, selected: true },
        { id: 'oca-c-1c', controlId: 'AP-C03', riskId: 'oca-r-1b', title: 'Three-way match tolerance enforcement', description: 'Invoices exceeding 2% / ₹10k price-quantity tolerance are blocked; overrides require DOA-level-3 approval, logged.', frequency: 'Continuous', controlType: 'Preventive', automation: 'Automated', isKey: true, selected: true },
        { id: 'oca-c-1d', controlId: 'AP-C04', riskId: 'oca-r-1c', title: 'Payment-run change log review', description: 'Bank-master and payment-term changes in the 48h before a run are reviewed against approvals before release.', frequency: 'Per run', controlType: 'Detective', automation: 'Manual', isKey: true, selected: true },
      ],
      workflows: [
        { id: 'oca-w-1a', name: 'Duplicate Invoice Detection', description: 'Daily scan of AP postings for exact and fuzzy duplicates across vendor, reference, amount, and date.', cadence: 'Daily', controlId: 'AP-C01', selected: true },
        { id: 'oca-w-1b', name: 'GRN-less Payment Monitor', description: 'Flags invoices cleared for payment without goods receipt or with retro-dated GRNs.', cadence: 'Daily', controlId: 'AP-C03', selected: true },
        { id: 'oca-w-1c', name: 'Payment-Run Change Sentinel', description: 'Diffs vendor bank masters against the approved baseline before every payment run.', cadence: 'Per run', controlId: 'AP-C04', selected: true },
      ],
    },
    {
      id: 'oca-eng-2',
      code: 'ENG-A02',
      name: 'Journal Entry & Close Controls — SOX / ICFR',
      description: 'SOX 404 testing over Record-to-Report — manual journals, management-review controls, and close-checklist discipline across 3.8M GL transactions.',
      type: 'SOX / ICFR',
      process: 'R2R',
      framework: 'COSO 2013 / SOX 404',
      owner: 'D. Rao',
      confidence: 91,
      rationale: '6.4% of manual journals in GL history post after 8pm or on weekends, and 41 entries round to ₹1M+ with single-line descriptions.',
      sources: ['GL Transaction History', 'Close SOP', 'PCAOB guidance (web)'],
      startMonth: '2026-09',
      endMonth: '2027-02',
      selected: true,
      risks: [
        { id: 'oca-r-2a', title: 'Unauthorized manual journals', description: 'High-value or after-hours manual entries posted without independent approval.', severity: 'High', selected: true },
        { id: 'oca-r-2b', title: 'Close checklist steps skipped', description: 'Reconciliations or review steps signed off late or not performed before close.', severity: 'Medium', selected: true },
        { id: 'oca-r-2c', title: 'Management override via top-side entries', description: 'Top-side adjustments outside the subledger bypassing normal approval flow.', severity: 'High', selected: true },
      ],
      controls: [
        { id: 'oca-c-2a', controlId: 'JE-C01', riskId: 'oca-r-2a', title: 'JE approval workflow', description: 'Manual journals above ₹5L require preparer/approver segregation enforced in the GL system.', frequency: 'Continuous', controlType: 'Preventive', automation: 'Automated', isKey: true, selected: true },
        { id: 'oca-c-2b', controlId: 'JE-C02', riskId: 'oca-r-2a', title: 'After-hours JE review', description: 'Monthly review of journals posted outside business hours, weekends, and period-end +/- 2 days.', frequency: 'Monthly', controlType: 'Detective', automation: 'IT-Dependent', isKey: false, selected: true },
        { id: 'oca-c-2c', controlId: 'JE-C03', riskId: 'oca-r-2b', title: 'Close checklist sign-off', description: 'Controller certifies the close checklist; open items past SLA escalate to CFO dashboard.', frequency: 'Monthly', controlType: 'Preventive', automation: 'Manual', isKey: true, selected: true },
        { id: 'oca-c-2d', controlId: 'JE-C04', riskId: 'oca-r-2c', title: 'Top-side entry register', description: 'All top-side adjustments logged with business justification and reviewed quarterly by Internal Audit.', frequency: 'Quarterly', controlType: 'Detective', automation: 'Manual', isKey: true, selected: true },
      ],
      workflows: [
        { id: 'oca-w-2a', name: 'After-Hours GL Posting Monitor', description: 'Flags journals posted outside business hours with amount and approver context.', cadence: 'Daily', controlId: 'JE-C02', selected: true },
        { id: 'oca-w-2b', name: 'Round-Amount JE Screen', description: 'Surfaces round-value, single-line, or period-end journals for review sampling.', cadence: 'Weekly', controlId: 'JE-C02', selected: true },
        { id: 'oca-w-2c', name: 'Close Checklist SLA Tracker', description: 'Tracks checklist completion against the close calendar and escalates breaches.', cadence: 'Monthly', controlId: 'JE-C03', selected: true },
      ],
    },
    {
      id: 'oca-eng-3',
      code: 'ENG-A03',
      name: 'Vendor Master Governance — IFC Compliance',
      description: 'Companies Act §143(3)(i) IFC assessment of vendor lifecycle — onboarding KYC, bank-detail changes, dormant-vendor reactivation, and duplicate vendor records.',
      type: 'Compliance',
      process: 'P2P',
      framework: 'IFC',
      owner: 'Sneha Desai',
      confidence: 84,
      rationale: '892 vendor records include 37 near-duplicate names sharing bank accounts and 112 vendors dormant >18 months with open purchase orders.',
      sources: ['Vendor Master Data', 'Procurement SOP'],
      startMonth: '2026-10',
      endMonth: '2027-01',
      selected: true,
      risks: [
        { id: 'oca-r-3a', title: 'Duplicate / collusive vendor records', description: 'Multiple vendor IDs sharing bank accounts, addresses, or tax IDs.', severity: 'High', selected: true },
        { id: 'oca-r-3b', title: 'Unverified bank-detail changes', description: 'Vendor bank changes actioned from email requests without callback verification.', severity: 'High', selected: true },
        { id: 'oca-r-3c', title: 'Dormant vendor reactivation', description: 'Long-dormant vendors reactivated and paid without re-KYC.', severity: 'Medium', selected: true },
      ],
      controls: [
        { id: 'oca-c-3a', controlId: 'VM-C01', riskId: 'oca-r-3a', title: 'Duplicate vendor screening', description: 'New vendor requests screened against existing masters on bank account, PAN/GSTIN, and fuzzy name match.', frequency: 'Continuous', controlType: 'Preventive', automation: 'Automated', isKey: true, selected: true },
        { id: 'oca-c-3b', controlId: 'VM-C02', riskId: 'oca-r-3b', title: 'Bank change callback verification', description: 'Bank-detail changes verified by callback to the registered contact before activation; evidence attached.', frequency: 'Per change', controlType: 'Preventive', automation: 'Manual', isKey: true, selected: true },
        { id: 'oca-c-3c', controlId: 'VM-C03', riskId: 'oca-r-3c', title: 'Dormant vendor re-KYC gate', description: 'Vendors inactive >12 months require refreshed KYC and procurement head approval before new POs.', frequency: 'Per event', controlType: 'Preventive', automation: 'IT-Dependent', isKey: false, selected: true },
        { id: 'oca-c-3d', controlId: 'VM-C04', riskId: 'oca-r-3a', title: 'Quarterly vendor-master hygiene review', description: 'Quarterly analytics pack on duplicates, shared bank accounts, and one-time-vendor misuse reviewed by controller.', frequency: 'Quarterly', controlType: 'Detective', automation: 'IT-Dependent', isKey: false, selected: true },
      ],
      workflows: [
        { id: 'oca-w-3a', name: 'Vendor Master Change Audit', description: 'Streams every vendor-master field change with before/after values and approver.', cadence: 'Daily', controlId: 'VM-C02', selected: true },
        { id: 'oca-w-3b', name: 'Shared Bank Account Detector', description: 'Cross-matches bank accounts across vendor IDs and against the employee master.', cadence: 'Weekly', controlId: 'VM-C01', selected: true },
        { id: 'oca-w-3c', name: 'Dormant Vendor Reactivation Alert', description: 'Alerts when a vendor dormant >12 months receives a PO or payment.', cadence: 'Daily', controlId: 'VM-C03', selected: true },
      ],
    },
    {
      id: 'oca-eng-4',
      code: 'ENG-A04',
      name: 'Workforce Access & Payroll Review',
      description: 'Internal audit of joiner-mover-leaver access hygiene and payroll master integrity across Workday HRIS and downstream systems.',
      type: 'Internal Audit',
      process: 'ITGC',
      framework: 'ISO 27001',
      owner: 'Deepak Bansal',
      confidence: 78,
      rationale: 'Workday shows 19 terminated employees with accounts active >7 days post-exit and 8 payroll bank changes in the exit month.',
      sources: ['Workday HRIS', 'Workday Access Events'],
      startMonth: '2026-11',
      endMonth: '2027-02',
      selected: false,
      risks: [
        { id: 'oca-r-4a', title: 'Leaver access not revoked', description: 'System access surviving termination, including privileged roles.', severity: 'High', selected: true },
        { id: 'oca-r-4b', title: 'Ghost employees on payroll', description: 'Payroll records without matching active HR records or with shared bank accounts.', severity: 'High', selected: true },
      ],
      controls: [
        { id: 'oca-c-4a', controlId: 'HR-C01', riskId: 'oca-r-4a', title: 'Same-day leaver deprovisioning', description: 'Termination in Workday triggers automated access revocation across integrated systems within 24h.', frequency: 'Continuous', controlType: 'Preventive', automation: 'Automated', isKey: true, selected: true },
        { id: 'oca-c-4b', controlId: 'HR-C02', riskId: 'oca-r-4a', title: 'Quarterly user access review', description: 'System owners certify active users against HR headcount quarterly; exceptions remediated in 10 days.', frequency: 'Quarterly', controlType: 'Detective', automation: 'Manual', isKey: true, selected: true },
        { id: 'oca-c-4c', controlId: 'HR-C03', riskId: 'oca-r-4b', title: 'Payroll-to-HR reconciliation', description: 'Monthly reconciliation of payroll register to active HR master; unmatched IDs and shared bank accounts investigated.', frequency: 'Monthly', controlType: 'Detective', automation: 'IT-Dependent', isKey: true, selected: true },
      ],
      workflows: [
        { id: 'oca-w-4a', name: 'Leaver Access Sweep', description: 'Daily diff of terminated employees against active accounts in connected systems.', cadence: 'Daily', controlId: 'HR-C01', selected: true },
        { id: 'oca-w-4b', name: 'Ghost Employee Screen', description: 'Matches payroll register to HR master and flags orphan or duplicate-bank records.', cadence: 'Monthly', controlId: 'HR-C03', selected: true },
      ],
    },
    {
      id: 'oca-eng-5',
      code: 'ENG-A05',
      name: 'Revenue Cut-off Monitor',
      description: 'Always-on monitoring of revenue recognition timing — period-end billing spikes, credit-memo reversals, and deferred-revenue release patterns.',
      type: 'Automation',
      subtype: 'CCM',
      process: 'O2C',
      framework: 'SOX ICFR',
      owner: 'Neha Joshi',
      confidence: 72,
      rationale: 'GL history shows 3.1x billing volume in the last 48h of each quarter with 22% of related credit memos issued in the first week after.',
      sources: ['GL Transaction History', 'IFRS 15 guidance (web)'],
      startMonth: '2026-09',
      endMonth: '2027-03',
      selected: false,
      risks: [
        { id: 'oca-r-5a', title: 'Premature revenue recognition', description: 'Revenue booked before performance obligations are satisfied, reversed post-close.', severity: 'High', selected: true },
        { id: 'oca-r-5b', title: 'Manual deferral overrides', description: 'Deferred-revenue schedules edited manually to accelerate release.', severity: 'Medium', selected: true },
      ],
      controls: [
        { id: 'oca-c-5a', controlId: 'RV-C01', riskId: 'oca-r-5a', title: 'Cut-off analytics review', description: 'Automated comparison of period-end billings vs. shipment/delivery confirmation dates; exceptions reviewed by revenue controller.', frequency: 'Monthly', controlType: 'Detective', automation: 'Automated', isKey: true, selected: true },
        { id: 'oca-c-5b', controlId: 'RV-C02', riskId: 'oca-r-5b', title: 'Deferral schedule change control', description: 'Manual edits to deferred-revenue schedules require dual approval with reason codes.', frequency: 'Per change', controlType: 'Preventive', automation: 'IT-Dependent', isKey: false, selected: true },
      ],
      workflows: [
        { id: 'oca-w-5a', name: 'Period-End Billing Spike Monitor', description: 'Flags customers and SKUs with abnormal end-of-period billing concentration.', cadence: 'Monthly', controlId: 'RV-C01', selected: true },
        { id: 'oca-w-5b', name: 'Credit Memo Reversal Tracker', description: 'Links post-close credit memos back to pre-close revenue postings.', cadence: 'Monthly', controlId: 'RV-C01', selected: true },
      ],
    },
  ];
}

/** "Aug 2026" from "2026-08" — matches the seed engagements' period format. */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m) return month;
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}
