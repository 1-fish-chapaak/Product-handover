// ─── ATR Library + Evidence Repository (mock) ───
// Two report-module concerns:
//   1. ATR_LIBRARY     — every Action Taken Report generated, browsable as a list.
//   2. EVIDENCE_LIBRARY — every piece of audit evidence, segregated by the ATR /
//      audit area it backs, each item linked to its source report + observation.
import type { AtrReportData } from '../components/reports/atrTypes';

/** GeneratedReport-compatible shape so an ATR opens via the existing viewer. */
export interface AtrLibraryReport {
  id: string;
  templateId: string;
  name: string;
  tag: 'Internal Audit';
  generatedBy: string;
  generatedAt: string;
  status: 'final' | 'draft';
  pages: number;
  queries: number;
  /** Audit area used to group/segregate. */
  area: string;
  atrData: AtrReportData;
}

export const ATR_LIBRARY: AtrLibraryReport[] = [
  {
    id: 'gr-atr-lib-001',
    templateId: 'rt-007',
    name: 'FY26 Q1 — Procure-to-Pay Controls ATR',
    tag: 'Internal Audit',
    generatedBy: 'Karan Mehta',
    generatedAt: 'Mar 22, 2026',
    status: 'final',
    pages: 14,
    queries: 3,
    area: 'Procure-to-Pay',
    atrData: {
      meta: {
        reportId: 'ATR-P2P-FY26Q1',
        auditTitle: 'Procure-to-Pay Controls Review',
        auditPeriod: 'FY26 Q1 (Jan–Mar 2026)',
        preparedBy: 'Karan Mehta',
        generatedOn: '22 Mar 2026',
        auditEntity: 'Acme Corp — Finance Shared Services',
      },
      observations: [
        {
          title: 'Duplicate invoice payments to vendors',
          process: 'Accounts Payable',
          description: 'Three-way match was not enforced before payment release for 7 vendors, allowing duplicate invoices to be paid.',
          riskSummary: 'Financial loss from overpayment; weakened payment controls.',
          classification: 'Design Deficiency',
          risk: 'High',
          status: 'Closed',
          actionPlans: [
            { text: 'Configure ERP to enforce PO/GRN/Invoice match before payment.', dueDate: '30 Apr 2026', status: 'Implemented', actionTaken: 'Enabled the mandatory three-way match in SAP MM for all PO-based invoices; tolerance set to 0% on quantity and 2% on price. Re-ran the 7 flagged duplicate invoices — all now block at posting.', evidence: 'P2P_3way_match_config.pdf', verification: 'Auditor verified configuration in production.' },
          ],
        },
        {
          title: 'Vendor master data changes without approval',
          process: 'Vendor Management',
          description: 'Vendor bank-detail changes were processed without a maker-checker approval trail.',
          riskSummary: 'Risk of fraudulent payment redirection.',
          classification: 'Procedural Non-Compliance',
          risk: 'Medium',
          status: 'In Progress',
          actionPlans: [
            { text: 'Enforce maker-checker workflow for all vendor master changes.', dueDate: '15 May 2026', status: 'Partially Implemented', actionTaken: 'Configured a second-level approval step in the vendor master change workflow for bank-detail fields. Roll-out complete for the Finance SSC; plant-level approvers still being onboarded.', evidence: 'Vendor_master_change_log.xlsx' },
          ],
        },
      ],
      insights: [
        { title: 'Control automation reduces exposure', body: 'Automating the three-way match closed the highest-value gap in the cycle.' },
      ],
    },
  },
  {
    id: 'gr-atr-lib-002',
    templateId: 'rt-007',
    name: 'FY26 Q1 — IT General Controls ATR',
    tag: 'Internal Audit',
    generatedBy: 'Priya Mehta',
    generatedAt: 'Mar 18, 2026',
    status: 'draft',
    pages: 11,
    queries: 2,
    area: 'IT General Controls',
    atrData: {
      meta: {
        reportId: 'ATR-ITGC-FY26Q1',
        auditTitle: 'IT General Controls Review',
        auditPeriod: 'FY26 Q1 (Jan–Mar 2026)',
        preparedBy: 'Priya Mehta',
        generatedOn: '18 Mar 2026',
        auditEntity: 'Acme Corp — Information Security',
      },
      observations: [
        {
          title: 'MFA bypass on executive accounts',
          process: 'Identity & Access',
          description: 'MFA bypass was configured at the system level for 6 C-suite accounts without Security Committee approval.',
          riskSummary: 'Account takeover risk for privileged users.',
          classification: 'System Deficiency',
          risk: 'High',
          status: 'In Progress',
          actionPlans: [
            { text: 'Remove MFA bypass and enforce FIDO2 hardware keys for executives.', dueDate: '05 May 2026', status: 'Partially Implemented', actionTaken: 'Revoked the system-level MFA bypass on all 6 C-suite accounts and issued FIDO2 hardware keys. 4 of 6 executives enrolled; 2 pending key collection while travelling.', evidence: 'MFA_enforcement_screenshots.png', verification: 'Pending re-test by IT audit.' },
          ],
        },
        {
          title: 'Privileged access reviews not performed',
          process: 'Access Governance',
          description: 'Quarterly privileged access recertification was overdue for the AP module.',
          riskSummary: 'Excessive standing access; SoD violations.',
          classification: 'Procedural Non-Compliance',
          risk: 'Medium',
          status: 'Open',
          actionPlans: [
            { text: 'Run Q1 privileged access recertification and remediate exceptions.', dueDate: '20 May 2026', status: 'Pending', actionTaken: 'Access extract for the AP module pulled and circulated to data owners; recertification campaign scheduled to open 12 May 2026. No revocations actioned yet.', evidence: 'Access_review_Q1.csv' },
          ],
        },
      ],
      insights: [
        { title: 'Privileged access is the recurring theme', body: 'Both findings trace back to weak privileged-access governance.' },
      ],
    },
  },
  {
    id: 'gr-atr-lib-003',
    templateId: 'rt-007',
    name: 'FY26 — Order-to-Cash Revenue ATR',
    tag: 'Internal Audit',
    generatedBy: 'Neha Joshi',
    generatedAt: 'Feb 28, 2026',
    status: 'final',
    pages: 9,
    queries: 2,
    area: 'Order-to-Cash',
    atrData: {
      meta: {
        reportId: 'ATR-O2C-FY26',
        auditTitle: 'Order-to-Cash Revenue Review',
        auditPeriod: 'FY26 (Apr 2025–Mar 2026)',
        preparedBy: 'Neha Joshi',
        generatedOn: '28 Feb 2026',
        auditEntity: 'Acme Corp — Revenue Operations',
      },
      observations: [
        {
          title: 'Revenue recognised before delivery confirmation',
          process: 'Revenue Recognition',
          description: 'Revenue was recognised on 4 orders prior to a confirmed proof of delivery.',
          riskSummary: 'Revenue cut-off misstatement.',
          classification: 'Design Deficiency',
          risk: 'High',
          status: 'Closed',
          actionPlans: [
            { text: 'Block revenue posting until POD is attached in the system.', dueDate: '10 Mar 2026', status: 'Implemented', actionTaken: 'Added a system hard-stop that prevents the billing document from posting unless a proof-of-delivery is attached. Validated against the 4 flagged orders — all now hold until POD upload.', evidence: 'Revenue_cutoff_testing.xlsx', verification: 'Re-performed; control effective.' },
          ],
        },
        {
          title: 'Orders processed beyond approved credit limit',
          process: 'Credit Management',
          description: 'Sales orders were released above the approved customer credit limit without escalation.',
          riskSummary: 'Increased receivables default risk.',
          classification: 'Procedural Non-Compliance',
          risk: 'Medium',
          status: 'Closed',
          actionPlans: [
            { text: 'Add a hard credit-limit block with manager override logging.', dueDate: '15 Feb 2026', status: 'Implemented', actionTaken: 'Enabled the SAP credit-management hard block at the sales-order stage; any override now requires a credit-manager release that is logged with user, timestamp and reason. Tested with 3 over-limit orders.', evidence: 'Credit_limit_override_log.pdf' },
          ],
        },
      ],
      insights: [
        { title: 'Cycle is well controlled post-remediation', body: 'Both findings are remediated and re-tested as effective.' },
      ],
    },
  },
];

export type EvidenceType = 'PDF' | 'XLSX' | 'DOCX' | 'PNG' | 'CSV';

export interface EvidenceItem {
  id: string;
  name: string;
  type: EvidenceType;
  size: string;
  uploadedBy: string;
  uploadedAt: string;
  /** The ATR report this evidence backs (links to ATR_LIBRARY). */
  atrId: string;
  atrName: string;
  /** Audit area used to segregate the repository. */
  area: string;
  /** The observation / finding the evidence supports. */
  observation: string;
}

// Evidence segregated by audit area + linked to the exact ATR + observation.
export const EVIDENCE_LIBRARY: EvidenceItem[] = [
  // ── Procure-to-Pay ──
  { id: 'ev-001', name: 'P2P_3way_match_config.pdf', type: 'PDF', size: '1.4 MB', uploadedBy: 'Karan Mehta', uploadedAt: '21 Mar 2026', atrId: 'gr-atr-lib-001', atrName: 'FY26 Q1 — Procure-to-Pay Controls ATR', area: 'Procure-to-Pay', observation: 'Duplicate invoice payments to vendors' },
  { id: 'ev-002', name: 'Duplicate_invoice_forensics.xlsx', type: 'XLSX', size: '820 KB', uploadedBy: 'Ira (AI)', uploadedAt: '20 Mar 2026', atrId: 'gr-atr-lib-001', atrName: 'FY26 Q1 — Procure-to-Pay Controls ATR', area: 'Procure-to-Pay', observation: 'Duplicate invoice payments to vendors' },
  { id: 'ev-003', name: 'Vendor_master_change_log.xlsx', type: 'XLSX', size: '610 KB', uploadedBy: 'Tushar Goel', uploadedAt: '14 Mar 2026', atrId: 'gr-atr-lib-001', atrName: 'FY26 Q1 — Procure-to-Pay Controls ATR', area: 'Procure-to-Pay', observation: 'Vendor master data changes without approval' },
  { id: 'ev-004', name: 'Maker_checker_policy.docx', type: 'DOCX', size: '240 KB', uploadedBy: 'Tushar Goel', uploadedAt: '14 Mar 2026', atrId: 'gr-atr-lib-001', atrName: 'FY26 Q1 — Procure-to-Pay Controls ATR', area: 'Procure-to-Pay', observation: 'Vendor master data changes without approval' },
  // ── IT General Controls ──
  { id: 'ev-005', name: 'MFA_enforcement_screenshots.png', type: 'PNG', size: '2.1 MB', uploadedBy: 'Priya Mehta', uploadedAt: '17 Mar 2026', atrId: 'gr-atr-lib-002', atrName: 'FY26 Q1 — IT General Controls ATR', area: 'IT General Controls', observation: 'MFA bypass on executive accounts' },
  { id: 'ev-006', name: 'Security_committee_approval.pdf', type: 'PDF', size: '180 KB', uploadedBy: 'Priya Mehta', uploadedAt: '17 Mar 2026', atrId: 'gr-atr-lib-002', atrName: 'FY26 Q1 — IT General Controls ATR', area: 'IT General Controls', observation: 'MFA bypass on executive accounts' },
  { id: 'ev-007', name: 'Access_review_Q1.csv', type: 'CSV', size: '95 KB', uploadedBy: 'System', uploadedAt: '12 Mar 2026', atrId: 'gr-atr-lib-002', atrName: 'FY26 Q1 — IT General Controls ATR', area: 'IT General Controls', observation: 'Privileged access reviews not performed' },
  // ── Order-to-Cash ──
  { id: 'ev-008', name: 'Revenue_cutoff_testing.xlsx', type: 'XLSX', size: '1.1 MB', uploadedBy: 'Neha Joshi', uploadedAt: '27 Feb 2026', atrId: 'gr-atr-lib-003', atrName: 'FY26 — Order-to-Cash Revenue ATR', area: 'Order-to-Cash', observation: 'Revenue recognised before delivery confirmation' },
  { id: 'ev-009', name: 'Proof_of_delivery_samples.pdf', type: 'PDF', size: '3.4 MB', uploadedBy: 'Neha Joshi', uploadedAt: '26 Feb 2026', atrId: 'gr-atr-lib-003', atrName: 'FY26 — Order-to-Cash Revenue ATR', area: 'Order-to-Cash', observation: 'Revenue recognised before delivery confirmation' },
  { id: 'ev-010', name: 'Credit_limit_override_log.pdf', type: 'PDF', size: '430 KB', uploadedBy: 'Neha Joshi', uploadedAt: '15 Feb 2026', atrId: 'gr-atr-lib-003', atrName: 'FY26 — Order-to-Cash Revenue ATR', area: 'Order-to-Cash', observation: 'Orders processed beyond approved credit limit' },
];
