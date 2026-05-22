/**
 * Shared engagement seed data used by the engagement list (EngagementsView)
 * and the engagement detail page (EngagementDetailView).
 *
 * Single source of truth so adding/changing an engagement is one edit, not two.
 */

export type ProcessCode = 'P2P' | 'O2C' | 'R2R' | 'S2C' | 'ITGC';
export type EngStatus = 'Active' | 'In Progress' | 'Planned' | 'Review' | 'Draft' | 'Closed';
export type EngType = 'Compliance' | 'Internal Audit' | 'Automation';
/** Concrete project shape for Automation engagements — kept undefined for Compliance / Internal Audit. */
export type AutomationSubtype = 'CCM' | 'Reconciliation' | 'MIS' | 'Forensic' | 'Image Analytics' | 'Custom';

export interface Engagement {
  id: string;
  code: string;
  name: string;
  description: string;
  type: EngType;
  /** Required for Automation; ignored for Compliance / Internal Audit. */
  subtype?: AutomationSubtype;
  process: ProcessCode;
  framework: string;
  owner: string;
  status: EngStatus;
  periodStart: string;
  periodEnd: string;
  controls: number;
  /** 0–100. For Compliance/IA = controls effective %, for Automation = % of recent runs without exceptions. */
  health: number;
  /** Failed tests / open findings / unresolved alerts (universal — anything that needs attention). */
  openIssues: number;
  /** Human-readable relative time of last control test / fieldwork / monitor run. */
  lastActivity: string;
  /** Human-readable next milestone — sign-off due / report due / next run. */
  nextScheduled: string;
}

export const ENGAGEMENTS: Engagement[] = [
  {
    id: 'eng-1', code: 'ENG-001', name: 'P2P — SOX Audit',
    description: 'SOX ICFR testing of Procure-to-Pay controls — vendor master, PO approval, three-way match, payment release.',
    type: 'Compliance', process: 'P2P', framework: 'SOX ICFR', owner: 'Tushar Goel',
    status: 'Active', periodStart: 'Apr 2025', periodEnd: 'Mar 2026', controls: 24,
    health: 75, openIssues: 3, lastActivity: '2d ago', nextScheduled: 'Sign-off in 12d',
  },
  {
    id: 'eng-2', code: 'ENG-002', name: 'O2C — SOX Audit',
    description: 'Order-to-Cash SOX testing across customer master, credit limits, invoicing, and revenue recognition cutoffs.',
    type: 'Compliance', process: 'O2C', framework: 'SOX ICFR', owner: 'Neha Joshi',
    status: 'Active', periodStart: 'Apr 2025', periodEnd: 'Mar 2026', controls: 18,
    health: 89, openIssues: 1, lastActivity: '6h ago', nextScheduled: 'Walkthrough in 4d',
  },
  {
    id: 'eng-3', code: 'ENG-003', name: 'AP Duplicate Invoice Monitor',
    description: 'Always-on monitoring for duplicate AP invoice posting — daily scan against vendor, amount, invoice number, and date.',
    type: 'Automation', subtype: 'CCM', process: 'P2P', framework: 'Internal Policy', owner: 'Priya Singh',
    status: 'In Progress', periodStart: 'Apr 2025', periodEnd: 'Mar 2026', controls: 6,
    health: 94, openIssues: 2, lastActivity: '4h ago', nextScheduled: 'in 8h',
  },
  {
    id: 'eng-4', code: 'ENG-004', name: 'S2C — Contract Review',
    description: 'Internal audit of source-to-contract — vendor qualification, contract authority matrix, and obligation tracking.',
    type: 'Internal Audit', process: 'S2C', framework: 'Internal Policy', owner: 'Rohan Patel',
    status: 'Planned', periodStart: 'Jul 2025', periodEnd: 'Sep 2025', controls: 14,
    health: 0, openIssues: 0, lastActivity: 'Not started', nextScheduled: 'Fieldwork Jul 1',
  },
  {
    id: 'eng-5', code: 'ENG-005', name: 'P2P — IFC Assessment',
    description: 'Indian Financial Controls assessment for P2P process per Companies Act 2013 §143(3)(i) requirements.',
    type: 'Compliance', process: 'P2P', framework: 'IFC', owner: 'Sneha Desai',
    status: 'Planned', periodStart: 'Aug 2025', periodEnd: 'Oct 2025', controls: 18,
    health: 0, openIssues: 0, lastActivity: 'Not started', nextScheduled: 'Kickoff Aug 5',
  },
  {
    id: 'eng-6', code: 'ENG-006', name: 'IT General Controls Monitoring',
    description: 'Continuous monitoring of IT general controls — access provisioning, privileged access, change management, backup.',
    type: 'Automation', subtype: 'CCM', process: 'ITGC', framework: 'ISO 27001', owner: 'Deepak Bansal',
    status: 'Active', periodStart: 'Jun 2025', periodEnd: 'Jan 2026', controls: 15,
    health: 58, openIssues: 7, lastActivity: '1h ago', nextScheduled: 'in 23h',
  },
  {
    id: 'eng-7', code: 'ENG-007', name: 'Vendor Risk Assessment',
    description: 'Operational internal audit of vendor onboarding, KYC, sanctions screening, and ongoing risk scoring.',
    type: 'Internal Audit', process: 'P2P', framework: 'Internal Policy', owner: 'Priya Singh',
    status: 'Draft', periodStart: 'Oct 2025', periodEnd: 'Nov 2025', controls: 8,
    health: 0, openIssues: 0, lastActivity: 'Draft', nextScheduled: 'Plan due Sep 20',
  },
  {
    id: 'eng-8', code: 'ENG-008', name: 'O2C — Revenue Recognition Monitor',
    description: 'Always-on monitoring of revenue recognition timing — cutoffs, deferred revenue, and ASC 606 obligations.',
    type: 'Automation', subtype: 'CCM', process: 'O2C', framework: 'SOX ICFR', owner: 'Neha Joshi',
    status: 'Review', periodStart: 'Oct 2025', periodEnd: 'Jan 2026', controls: 10,
    health: 82, openIssues: 4, lastActivity: '15m ago', nextScheduled: 'in 45m',
  },
  {
    id: 'eng-9', code: 'ENG-009', name: 'Vendor Reconciliation — Air India',
    description: 'Three-way reconciliation across vendor invoices, GRN data, and bank statements for pan-India vendors.',
    type: 'Automation', subtype: 'Reconciliation', process: 'P2P', framework: 'Internal Policy', owner: 'Rohan Patel',
    status: 'Active', periodStart: 'Jul 2025', periodEnd: 'Mar 2026', controls: 4,
    health: 91, openIssues: 6, lastActivity: '3d ago', nextScheduled: 'Weekly batch in 2d',
  },
  {
    id: 'ef-auto-001', code: 'EF-AUTO-001', name: 'AP Duplicate Invoice Monitor',
    description: 'Continuous monitoring for duplicate AP invoice posting — daily scan against vendor, amount, invoice number, and date.',
    type: 'Automation', subtype: 'CCM', process: 'P2P', framework: 'Internal Policy', owner: 'Priya Singh',
    status: 'Active', periodStart: 'Oct 2025', periodEnd: 'Mar 2026', controls: 4,
    health: 88, openIssues: 4, lastActivity: '3h ago', nextScheduled: 'in 8h',
  },
  {
    id: 'ef-001', code: 'EF-001', name: 'P2P Internal Audit Review',
    description: 'Internal audit of Procure to Pay process covering duplicate invoices, PO approvals, and vendor master changes.',
    type: 'Internal Audit', process: 'P2P', framework: 'Internal Policy', owner: 'Karan Mehta',
    status: 'In Progress', periodStart: 'Jan 2026', periodEnd: 'Jun 2026', controls: 8,
    health: 68, openIssues: 5, lastActivity: '2h ago', nextScheduled: 'Pending review',
  },
];

export const PROCESS_COLORS: Record<ProcessCode, string> = {
  P2P: '#6a12cd', O2C: '#0284c7', R2R: '#d97706', S2C: '#059669', ITGC: '#7c3aed',
};
