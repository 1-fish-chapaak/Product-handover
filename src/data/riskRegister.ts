/**
 * The risk register — the risks the Risk Register screen lists.
 *
 * In the data layer rather than inside RiskRegister.tsx because it has readers
 * beyond that screen: the RACM tables, Process Hub, and Platform Usage, which
 * reports "Risks on the register". Usage used to count mockData's RISKS (a
 * separate, smaller set) and disagreed with the register itself — 15 against
 * the 18 rows actually on screen.
 *
 * A risk still in `Draft` has no control mapped to it yet; that is what the
 * register's own "not yet mapped to controls" banner counts.
 */

export type RiskLifecycleStatus = 'Draft' | 'Active' | 'Under Review' | 'Archived';
export type RiskPriority = 'Critical' | 'High' | 'Medium' | 'Low';
export type RiskCategory = 'Financial' | 'Operational' | 'Compliance' | 'IT' | 'Fraud' | 'Reporting' | 'Other';

export interface RiskEntry {
  id: string;
  name: string;
  description: string;
  businessProcess: string;
  subProcess: string;
  category: RiskCategory;
  priority: RiskPriority;
  owner: string;
  reviewer: string;
  status: RiskLifecycleStatus;
  lastReviewed: string;
  createdAt: string;
}

export const SEED_RISKS: RiskEntry[] = [
  { id: 'RSK-001', name: 'Unauthorized vendor payments', description: 'Payments processed without proper PO or approval, leading to financial loss', businessProcess: 'P2P', subProcess: 'Accounts Payable', category: 'Financial', priority: 'Critical', owner: 'Rajiv Sharma', reviewer: 'Deepak Bansal', status: 'Active', lastReviewed: 'Apr 10, 2026', createdAt: 'Jan 15, 2026' },
  { id: 'RSK-002', name: 'Duplicate invoices processed', description: 'Same invoice paid twice due to weak detection controls', businessProcess: 'P2P', subProcess: 'Invoice Processing', category: 'Financial', priority: 'High', owner: 'Rajiv Sharma', reviewer: 'Meera Patel', status: 'Active', lastReviewed: 'Apr 8, 2026', createdAt: 'Jan 15, 2026' },
  { id: 'RSK-003', name: 'Fictitious vendor registration', description: 'Vendor created without verification of identity and bank details', businessProcess: 'P2P', subProcess: 'Vendor Management', category: 'Fraud', priority: 'Critical', owner: 'Deepak Bansal', reviewer: 'Rajiv Sharma', status: 'Active', lastReviewed: 'Apr 12, 2026', createdAt: 'Jan 15, 2026' },
  { id: 'RSK-004', name: 'Unauthorized PO creation', description: 'Purchase orders above threshold committed without dual sign-off', businessProcess: 'P2P', subProcess: 'Procurement', category: 'Operational', priority: 'High', owner: 'Meera Patel', reviewer: 'Rajiv Sharma', status: 'Draft', lastReviewed: '—', createdAt: 'Mar 20, 2026' },
  { id: 'RSK-005', name: 'SOD violation in AP', description: 'Same user creates and approves payment transactions', businessProcess: 'P2P', subProcess: 'Accounts Payable', category: 'IT', priority: 'Critical', owner: 'IT Security', reviewer: 'Deepak Bansal', status: 'Under Review', lastReviewed: 'Apr 5, 2026', createdAt: 'Feb 1, 2026' },
  { id: 'RSK-006', name: 'Revenue recognition timing', description: 'Revenue recognized before performance obligation completion under ASC 606', businessProcess: 'O2C', subProcess: 'Revenue Accounting', category: 'Financial', priority: 'High', owner: 'Neha Joshi', reviewer: 'Karan Mehta', status: 'Active', lastReviewed: 'Apr 10, 2026', createdAt: 'Jan 20, 2026' },
  { id: 'RSK-007', name: 'Incorrect journal entries', description: 'Manual JE posted without review or with incorrect amounts', businessProcess: 'R2R', subProcess: 'General Ledger', category: 'Financial', priority: 'High', owner: 'Rohan Patel', reviewer: 'Karan Mehta', status: 'Active', lastReviewed: 'Apr 14, 2026', createdAt: 'Jan 20, 2026' },
  { id: 'RSK-008', name: 'GL balance discrepancy', description: 'Subsidiary balances do not reconcile to consolidated GL', businessProcess: 'R2R', subProcess: 'Reconciliation', category: 'Financial', priority: 'Medium', owner: 'Karan Mehta', reviewer: 'Rohan Patel', status: 'Draft', lastReviewed: '—', createdAt: 'Mar 25, 2026' },
  { id: 'RSK-009', name: 'Credit limit override without approval', description: 'Customer credit limits changed without proper authorization', businessProcess: 'O2C', subProcess: 'Credit Management', category: 'Operational', priority: 'Medium', owner: 'Sneha Desai', reviewer: 'Neha Joshi', status: 'Active', lastReviewed: 'Apr 2, 2026', createdAt: 'Feb 10, 2026' },
  { id: 'RSK-010', name: 'Unauthorized access to financial systems', description: 'Users retain access after role change or termination', businessProcess: 'ITGC', subProcess: 'Access Management', category: 'IT', priority: 'Critical', owner: 'IT Security', reviewer: 'Deepak Bansal', status: 'Active', lastReviewed: 'Apr 15, 2026', createdAt: 'Jan 10, 2026' },
  { id: 'RSK-011', name: 'Uncontrolled change management', description: 'System changes deployed without proper testing and approval', businessProcess: 'ITGC', subProcess: 'Change Management', category: 'IT', priority: 'High', owner: 'IT Security', reviewer: 'Rohan Patel', status: 'Under Review', lastReviewed: 'Apr 1, 2026', createdAt: 'Feb 5, 2026' },
  { id: 'RSK-012', name: 'Regulatory reporting delay', description: 'Financial reports not submitted to regulators within deadline', businessProcess: 'R2R', subProcess: 'Reporting', category: 'Compliance', priority: 'High', owner: 'Karan Mehta', reviewer: 'Neha Joshi', status: 'Active', lastReviewed: 'Apr 8, 2026', createdAt: 'Jan 25, 2026' },
  { id: 'RSK-013', name: 'Contract revenue leakage', description: 'Revenue not billed per contract terms due to manual tracking', businessProcess: 'O2C', subProcess: 'Contract Billing', category: 'Financial', priority: 'Medium', owner: 'Neha Joshi', reviewer: 'Sneha Desai', status: 'Active', lastReviewed: 'Mar 15, 2026', createdAt: 'Dec 1, 2025' },
  { id: 'RSK-014', name: 'Inadequate backup and recovery', description: 'Critical system backups not tested or failing silently', businessProcess: 'ITGC', subProcess: 'Operations', category: 'IT', priority: 'Medium', owner: 'IT Security', reviewer: 'Deepak Bansal', status: 'Draft', lastReviewed: '—', createdAt: 'Apr 10, 2026' },
  { id: 'RSK-021', name: 'Unauthorized sales order pricing', description: 'Order prices or discounts applied outside approved price lists, eroding margin', businessProcess: 'O2C', subProcess: 'Order Management', category: 'Operational', priority: 'High', owner: 'Sneha Desai', reviewer: 'Neha Joshi', status: 'Active', lastReviewed: 'Apr 11, 2026', createdAt: 'Feb 14, 2026' },
  { id: 'RSK-022', name: 'Goods shipped without approved order', description: 'Shipments released and invoiced before the sales order is approved and credit-cleared', businessProcess: 'O2C', subProcess: 'Shipping & Billing', category: 'Operational', priority: 'Critical', owner: 'Neha Joshi', reviewer: 'Karan Mehta', status: 'Active', lastReviewed: 'Apr 9, 2026', createdAt: 'Feb 18, 2026' },
  { id: 'RSK-023', name: 'Customer cash receipts misapplied', description: 'Incoming customer payments posted to the wrong account or invoice, distorting AR balances', businessProcess: 'O2C', subProcess: 'Cash Application', category: 'Financial', priority: 'High', owner: 'Karan Mehta', reviewer: 'Sneha Desai', status: 'Under Review', lastReviewed: 'Apr 4, 2026', createdAt: 'Feb 22, 2026' },
  { id: 'RSK-024', name: 'Aged receivables not provisioned', description: 'Overdue receivables not assessed for impairment, overstating collectible AR', businessProcess: 'O2C', subProcess: 'Collections', category: 'Financial', priority: 'Medium', owner: 'Neha Joshi', reviewer: 'Karan Mehta', status: 'Active', lastReviewed: 'Apr 6, 2026', createdAt: 'Mar 1, 2026' },
];
