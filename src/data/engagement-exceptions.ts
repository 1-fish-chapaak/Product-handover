/**
 * Engagement-scoped exceptions seed.
 *
 * Each exception originates from a workflow run and belongs to one engagement.
 * The Exception Management tab groups these by workflow; the per-exception
 * drawer opens the full case-management surface for one row.
 */

export type Severity = 'Critical' | 'High' | 'Medium' | 'Low';
export type ExceptionStatus = 'Open' | 'Triaging' | 'Resolved';
export type Classification = 'Control Deficiency' | 'Process Gap' | 'False Positive' | 'Other';

export interface EngagementException {
  id: string;
  ref: string;
  engagementId: string;
  workflowId: string;
  workflowName: string;
  title: string;
  detail?: string;
  severity: Severity;
  status: ExceptionStatus;
  /** Human-readable "X ago" for the demo. */
  opened: string;
  assignee: string;
  /** Optional classification chosen by the risk owner. */
  classification?: Classification;
  /** Optional money amount surfaced inline in the title (display-only). */
  amount?: string;
}

export const ENGAGEMENT_EXCEPTIONS: EngagementException[] = [
  // ─── Automation — AP Duplicate Invoice Monitor (eng-3) ─────────────────────
  { id: 'ex-1248', ref: 'EX-1248', engagementId: 'eng-3', workflowId: 'wf2', workflowName: 'Duplicate Invoice Detector',
    title: 'Duplicate invoice posted — vendor V-3344', detail: 'Invoice INV-2026-4423 matches INV-2026-4399 on PAN/amount/date.',
    severity: 'High', status: 'Open', opened: '4h ago', assignee: 'Priya Singh', amount: '₹2.4L' },
  { id: 'ex-1247', ref: 'EX-1247', engagementId: 'eng-3', workflowId: 'wf2', workflowName: 'Duplicate Invoice Detector',
    title: 'Duplicate invoice posted — vendor V-2155',
    severity: 'Medium', status: 'Triaging', opened: '4h ago', assignee: 'Priya Singh', amount: '₹86K' },
  { id: 'ex-1240', ref: 'EX-1240', engagementId: 'eng-3', workflowId: 'wf2', workflowName: 'Duplicate Invoice Detector',
    title: 'Duplicate invoice posted — vendor V-0044',
    severity: 'Medium', status: 'Open', opened: '1d ago', assignee: 'Priya Singh' },
  { id: 'ex-1220', ref: 'EX-1220', engagementId: 'eng-3', workflowId: 'wf2', workflowName: 'Duplicate Invoice Detector',
    title: 'Duplicate invoice — high-value', detail: 'Multiple postings against the same PO line over 48 hours.',
    severity: 'Critical', status: 'Resolved', opened: '5d ago', assignee: 'Priya Singh', classification: 'Control Deficiency', amount: '₹4.8L' },

  // ─── Automation — IT General Controls Monitoring (eng-6) ───────────────────
  { id: 'ex-2401', ref: 'EX-2401', engagementId: 'eng-6', workflowId: 'wf4', workflowName: 'Vendor Master Change Monitor',
    title: 'Privileged access granted outside change-management window',
    severity: 'Critical', status: 'Open', opened: '1h ago', assignee: 'Deepak Bansal' },
  { id: 'ex-2398', ref: 'EX-2398', engagementId: 'eng-6', workflowId: 'wf4', workflowName: 'Vendor Master Change Monitor',
    title: 'User added to SAP_ADMIN group without ticket',
    severity: 'High', status: 'Triaging', opened: '6h ago', assignee: 'Deepak Bansal' },
  { id: 'ex-2390', ref: 'EX-2390', engagementId: 'eng-6', workflowId: 'wf3', workflowName: 'PO Approval Threshold Scan',
    title: 'Threshold override used without justification',
    severity: 'Medium', status: 'Open', opened: '1d ago', assignee: 'Tushar Goel' },
  { id: 'ex-2380', ref: 'EX-2380', engagementId: 'eng-6', workflowId: 'wf3', workflowName: 'PO Approval Threshold Scan',
    title: 'Backup verification missed for primary AP database',
    severity: 'High', status: 'Triaging', opened: '2d ago', assignee: 'Deepak Bansal' },

  // ─── Automation — O2C Revenue Recognition Monitor (eng-8) ──────────────────
  { id: 'ex-1900', ref: 'EX-1900', engagementId: 'eng-8', workflowId: 'wf2', workflowName: 'Duplicate Invoice Detector',
    title: 'Revenue recognized in wrong period — cutoff anomaly',
    severity: 'High', status: 'Open', opened: '15m ago', assignee: 'Neha Joshi' },
  { id: 'ex-1888', ref: 'EX-1888', engagementId: 'eng-8', workflowId: 'wf2', workflowName: 'Duplicate Invoice Detector',
    title: 'Deferred revenue not recognized at delivery',
    severity: 'Medium', status: 'Triaging', opened: '3h ago', assignee: 'Neha Joshi' },

  // ─── Automation — Vendor Reconciliation Air India (eng-9) ──────────────────
  { id: 'ex-2410', ref: 'EX-2410', engagementId: 'eng-9', workflowId: 'wf1', workflowName: 'Three-Way Match (PO · GRN · Invoice)',
    title: 'Invoice/GRN amount mismatch — vendor V-7711', detail: 'Invoiced amount exceeds GRN by ₹1.2L. PO indicates correct unit price.',
    severity: 'High', status: 'Resolved', opened: '3d ago', assignee: 'Rohan Patel', classification: 'Process Gap', amount: '₹1.2L diff' },
  { id: 'ex-2411', ref: 'EX-2411', engagementId: 'eng-9', workflowId: 'wf1', workflowName: 'Three-Way Match (PO · GRN · Invoice)',
    title: 'PO/Invoice quantity mismatch — line item 4',
    severity: 'Medium', status: 'Open', opened: '3d ago', assignee: 'Rohan Patel' },
  { id: 'ex-2398b', ref: 'EX-2398', engagementId: 'eng-9', workflowId: 'wf1', workflowName: 'Three-Way Match (PO · GRN · Invoice)',
    title: 'Bank statement mismatch — payment reversal not posted',
    severity: 'Critical', status: 'Triaging', opened: '10d ago', assignee: 'Rohan Patel' },

  // ─── Internal Audit — S2C Contract Review (eng-4) ──────────────────────────
  { id: 'ex-3101', ref: 'EX-3101', engagementId: 'eng-4', workflowId: 'wf3', workflowName: 'PO Approval Threshold Scan',
    title: 'Contract awarded without competitive RFQ — three vendor process bypassed',
    detail: 'Single-source justification missing; contract value ₹18L crossed threshold for three-quote requirement.',
    severity: 'High', status: 'Open', opened: '2d ago', assignee: 'Rohan Patel' },
  { id: 'ex-3102', ref: 'EX-3102', engagementId: 'eng-4', workflowId: 'wf1', workflowName: 'Three-Way Match (PO · GRN · Invoice)',
    title: 'Master Service Agreement expired but invoices still being processed',
    severity: 'Medium', status: 'Triaging', opened: '4d ago', assignee: 'Rohan Patel' },
  { id: 'ex-3103', ref: 'EX-3103', engagementId: 'eng-4', workflowId: 'wf4', workflowName: 'Vendor Master Change Monitor',
    title: 'Contract authority matrix violation — sub-VP signed at VP-tier value',
    severity: 'Critical', status: 'Open', opened: '1d ago', assignee: 'Priya Singh' },
  { id: 'ex-3104', ref: 'EX-3104', engagementId: 'eng-4', workflowId: 'wf3', workflowName: 'PO Approval Threshold Scan',
    title: 'Service contract missing obligations register entry', detail: 'No tracker entry for SLA / liquidated damages clause.',
    severity: 'Medium', status: 'Resolved', opened: '12d ago', assignee: 'Rohan Patel', classification: 'Process Gap' },

  // ─── Internal Audit — Vendor Risk Assessment (eng-7) ──────────────────────
  { id: 'ex-3201', ref: 'EX-3201', engagementId: 'eng-7', workflowId: 'wf4', workflowName: 'Vendor Master Change Monitor',
    title: 'Vendor onboarded without sanctions screening',
    severity: 'High', status: 'Open', opened: '6h ago', assignee: 'Priya Singh' },
  { id: 'ex-3202', ref: 'EX-3202', engagementId: 'eng-7', workflowId: 'wf4', workflowName: 'Vendor Master Change Monitor',
    title: 'KYC documents missing for 4 active vendors',
    severity: 'Medium', status: 'Triaging', opened: '2d ago', assignee: 'Priya Singh' },
  { id: 'ex-3203', ref: 'EX-3203', engagementId: 'eng-7', workflowId: 'wf2', workflowName: 'Duplicate Invoice Detector',
    title: 'High-risk-rated vendor not flagged in payment workflow', detail: 'Vendor V-9912 scored Critical risk in Q1 but no escalation flag set.',
    severity: 'Critical', status: 'Open', opened: '1d ago', assignee: 'Neha Joshi' },

  // ─── Engagement Final — P2P Internal Audit Review (ef-001) ─────────────────
  { id: 'ex-5001', ref: 'EX-5001', engagementId: 'ef-001', workflowId: 'wf2', workflowName: 'Duplicate Invoice Detector',
    title: 'Duplicate invoice posted — vendor V-8821', detail: 'Invoice INV-2026-7710 matches INV-2026-7698 on PAN/amount/date.',
    severity: 'Critical', status: 'Open', opened: '2h ago', assignee: 'Karan Mehta', amount: '₹4,12,000' },
  { id: 'ex-5002', ref: 'EX-5002', engagementId: 'ef-001', workflowId: 'wf2', workflowName: 'Duplicate Invoice Detector',
    title: 'Invoice amount exceeds PO by 18%', detail: 'PO-2026-1192 ceiling ₹2,50,000 but invoice amount ₹2,95,000.',
    severity: 'High', status: 'Triaging', opened: '6h ago', assignee: 'Sneha Desai', amount: '₹2,95,000', classification: 'Process Gap' },
  { id: 'ex-5003', ref: 'EX-5003', engagementId: 'ef-001', workflowId: 'wf3', workflowName: 'PO Approval Threshold Scan',
    title: 'Purchase order approved without manager sign-off', detail: 'PO-2026-0834 approved by requester — dual approval policy bypassed.',
    severity: 'Critical', status: 'Open', opened: '1d ago', assignee: 'Karan Mehta' },
  { id: 'ex-5004', ref: 'EX-5004', engagementId: 'ef-001', workflowId: 'wf3', workflowName: 'PO Approval Threshold Scan',
    title: 'Threshold breach — PO split into 3 orders below limit',
    severity: 'High', status: 'Open', opened: '3d ago', assignee: 'Tushar Goel', classification: 'Control Deficiency' },
  { id: 'ex-5005', ref: 'EX-5005', engagementId: 'ef-001', workflowId: 'wf4', workflowName: 'Vendor Master Change Monitor',
    title: 'Vendor bank account changed without verification', detail: 'Vendor V-4410 bank details updated by non-finance user.',
    severity: 'High', status: 'Triaging', opened: '5d ago', assignee: 'Sneha Desai', classification: 'Control Deficiency' },
  { id: 'ex-5006', ref: 'EX-5006', engagementId: 'ef-001', workflowId: 'wf4', workflowName: 'Vendor Master Change Monitor',
    title: 'KYC documents expired for active vendor V-2209',
    severity: 'Medium', status: 'Open', opened: '7d ago', assignee: 'Priya Singh' },
  { id: 'ex-5007', ref: 'EX-5007', engagementId: 'ef-001', workflowId: 'wf2', workflowName: 'Duplicate Invoice Detector',
    title: 'Retrospective duplicate found — already paid', detail: 'INV-2026-3301 paid twice; recovery pending.',
    severity: 'Medium', status: 'Triaging', opened: '10d ago', assignee: 'Karan Mehta', amount: '₹1,87,000', classification: 'Process Gap' },
  { id: 'ex-5008', ref: 'EX-5008', engagementId: 'ef-001', workflowId: 'wf3', workflowName: 'PO Approval Threshold Scan',
    title: 'Emergency PO raised without retrospective approval',
    severity: 'Low', status: 'Resolved', opened: '15d ago', assignee: 'Tushar Goel', classification: 'False Positive' },

  // ─── Engagement Final — AP Duplicate Invoice Monitor (ef-auto-001) ──────────
  { id: 'ex-6001', ref: 'EX-6001', engagementId: 'ef-auto-001', workflowId: 'wf2', workflowName: 'Duplicate Invoice Detector',
    title: 'Duplicate invoice posted — vendor V-5501', detail: 'Invoice INV-2026-9120 matches INV-2026-9089 on PAN/amount/date.',
    severity: 'High', status: 'Open', opened: '3h ago', assignee: 'Priya Singh', amount: '₹3,18,000' },
  { id: 'ex-6002', ref: 'EX-6002', engagementId: 'ef-auto-001', workflowId: 'wf2', workflowName: 'Duplicate Invoice Detector',
    title: 'Invoice amount exceeds PO ceiling by 22%', detail: 'PO-2026-4478 ceiling ₹1,80,000 but invoice amount ₹2,19,600.',
    severity: 'Medium', status: 'Triaging', opened: '1d ago', assignee: 'Karan Mehta', amount: '₹2,19,600', classification: 'Process Gap' },
  { id: 'ex-6003', ref: 'EX-6003', engagementId: 'ef-auto-001', workflowId: 'wf4', workflowName: 'Vendor Master Change Monitor',
    title: 'Vendor bank account changed without dual authorization', detail: 'Vendor V-3302 bank details updated by single AP clerk.',
    severity: 'Critical', status: 'Open', opened: '6h ago', assignee: 'Priya Singh' },
  { id: 'ex-6004', ref: 'EX-6004', engagementId: 'ef-auto-001', workflowId: 'wf4', workflowName: 'Vendor Master Change Monitor',
    title: 'Vendor address change without supporting documentation',
    severity: 'Low', status: 'Resolved', opened: '5d ago', assignee: 'Karan Mehta', classification: 'False Positive' },

  // ─── Compliance — P2P SOX Audit (eng-1) ────────────────────────────────────
  { id: 'ex-1245', ref: 'EX-1245', engagementId: 'eng-1', workflowId: 'wf2', workflowName: 'Duplicate Invoice Detector',
    title: 'Duplicate invoice in SOX testing sample',
    severity: 'Medium', status: 'Open', opened: '3d ago', assignee: 'Tushar Goel' },
  { id: 'ex-1242', ref: 'EX-1242', engagementId: 'eng-1', workflowId: 'wf4', workflowName: 'Vendor Master Change Monitor',
    title: 'Vendor onboarded without KYC completion',
    severity: 'High', status: 'Triaging', opened: '14d ago', assignee: 'Sneha Desai', classification: 'Control Deficiency' },
  { id: 'ex-1198', ref: 'EX-1198', engagementId: 'eng-1', workflowId: 'wf2', workflowName: 'Duplicate Invoice Detector',
    title: 'Segregation of duties violation — same user created and approved PO',
    severity: 'Critical', status: 'Open', opened: '20d ago', assignee: 'Tushar Goel' },
];

/** All exceptions tied to one engagement. */
export function exceptionsForEngagement(engagementId: string): EngagementException[] {
  return ENGAGEMENT_EXCEPTIONS.filter(e => e.engagementId === engagementId);
}

/** Group exceptions by workflow → returns ordered groups for rendering. */
export function groupByWorkflow(exceptions: EngagementException[]): {
  workflowId: string;
  workflowName: string;
  exceptions: EngagementException[];
  severityCounts: Record<Severity, number>;
}[] {
  const map = new Map<string, EngagementException[]>();
  exceptions.forEach(ex => {
    const arr = map.get(ex.workflowId) ?? [];
    arr.push(ex);
    map.set(ex.workflowId, arr);
  });
  return Array.from(map.entries()).map(([workflowId, exs]) => {
    const counts: Record<Severity, number> = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    exs.forEach(e => { counts[e.severity] += 1; });
    return {
      workflowId,
      workflowName: exs[0].workflowName,
      exceptions: exs,
      severityCounts: counts,
    };
  });
}
