/**
 * Cross-cutting GRC domain seed: owners, SLAs, sub-processes, vendors.
 *
 * Used by:
 *  - CreateEngagementWizard, CaseManagementWorkspace, MyQueueView, ClosedCaseSamplingView
 *  - EngagementOverviewView (sub-process accordion, effectiveness, anomaly strip)
 *  - Vendor360View, EngagementSettingsTab
 *
 * Single source of truth so a name change happens once.
 */

import type { ProcessCode, Engagement } from './engagements';
import type { Severity } from './engagement-exceptions';

// ─── People ──────────────────────────────────────────────────────────────────

export interface Person {
  id: string;
  name: string;
  initials: string;
  role: 'Auditor' | 'Risk Owner' | 'Reviewer' | 'Manager' | 'Specialist';
  capacity?: number;
}

export const PEOPLE: Person[] = [
  { id: 'p-1', name: 'Tushar Goel',   initials: 'TG', role: 'Auditor',     capacity: 160 },
  { id: 'p-2', name: 'Neha Joshi',    initials: 'NJ', role: 'Auditor',     capacity: 160 },
  { id: 'p-3', name: 'Karan Mehta',   initials: 'KM', role: 'Manager',    capacity: 120 },
  { id: 'p-4', name: 'Sneha Desai',   initials: 'SD', role: 'Risk Owner', capacity: 160 },
  { id: 'p-5', name: 'Rohan Patel',   initials: 'RP', role: 'Auditor',     capacity: 160 },
  { id: 'p-6', name: 'Priya Singh',   initials: 'PS', role: 'Risk Owner', capacity: 160 },
  { id: 'p-7', name: 'Deepak Bansal', initials: 'DB', role: 'Specialist', capacity: 160 },
  { id: 'p-8', name: 'Vijay Reddy',   initials: 'VR', role: 'Reviewer',    capacity: 120 },
];

export const CURRENT_USER: Person = PEOPLE[5]; // Priya Singh — risk owner persona for My Queue

export const OWNER_NAMES = PEOPLE.map(p => p.name);

// ─── SLAs (default per severity, hours to resolve) ──────────────────────────

export interface SlaConfig {
  Critical: number;
  High: number;
  Medium: number;
  Low: number;
}

export const DEFAULT_SLA: SlaConfig = {
  Critical: 4,
  High: 24,
  Medium: 72,
  Low: 168,
};

/** Compute SLA pressure given an opened-time and a severity. */
export function slaStatus(openedHoursAgo: number, sev: Severity): {
  label: string;
  tone: 'risk' | 'mitigated' | 'compliant';
  pct: number;
} {
  const sla = DEFAULT_SLA[sev];
  const remaining = sla - openedHoursAgo;
  const pct = Math.min(100, Math.max(0, (openedHoursAgo / sla) * 100));
  if (remaining < 0) return { label: `Overdue ${Math.round(-remaining)}h`, tone: 'risk', pct: 100 };
  if (remaining < sla * 0.25) return { label: `Due in ${Math.round(remaining)}h`, tone: 'mitigated', pct };
  return { label: `Due in ${Math.round(remaining)}h`, tone: 'compliant', pct };
}

// ─── Sub-processes per Process code ─────────────────────────────────────────

export const SUB_PROCESSES: Record<ProcessCode, string[]> = {
  P2P:  ['Vendor Onboarding', 'Purchase Order Management', 'Goods Receipt', 'Invoice Processing', 'Payment Release'],
  O2C:  ['Customer Onboarding', 'Order Management', 'Invoicing', 'Collections', 'Credit Management'],
  R2R:  ['Journal Entries', 'Account Reconciliation', 'Period-End Close', 'Financial Reporting'],
  S2C:  ['Vendor Qualification', 'Contract Authoring', 'Approval & Signing', 'Obligation Tracking'],
  ITGC: ['Access Provisioning', 'Privileged Access', 'Change Management', 'Backup & Recovery'],
};

/** Pick a stable sub-process for a workflow by hashing its id. Demo-only. */
export function subProcessForWorkflow(workflowId: string, process: ProcessCode): string {
  const subs = SUB_PROCESSES[process] ?? ['General'];
  let h = 0;
  for (let i = 0; i < workflowId.length; i++) h = (h * 31 + workflowId.charCodeAt(i)) >>> 0;
  return subs[h % subs.length];
}

// ─── Vendors (for Vendor 360) ───────────────────────────────────────────────

export interface Vendor {
  id: string;
  name: string;
  pan: string;
  category: string;
  risk: 'Critical' | 'High' | 'Medium' | 'Low';
  onboarded: string;
}

export const VENDORS: Vendor[] = [
  { id: 'v-3344', name: 'Acme Logistics Pvt Ltd', pan: 'AAACA1111K', category: 'Logistics',  risk: 'High',     onboarded: 'Jan 2024' },
  { id: 'v-2155', name: 'Stellar IT Services',    pan: 'AAACS2222L', category: 'IT Services', risk: 'Medium',   onboarded: 'Mar 2023' },
  { id: 'v-0044', name: 'Pinnacle Office Supply', pan: 'AAACP3333M', category: 'Stationery',  risk: 'Low',      onboarded: 'Aug 2022' },
  { id: 'v-9912', name: 'Maxwell Engineering',     pan: 'AAACM4444N', category: 'Engineering', risk: 'Critical', onboarded: 'Nov 2021' },
  { id: 'v-7711', name: 'Bharat Travel Partners',  pan: 'AAACB5555O', category: 'Travel',      risk: 'High',     onboarded: 'Apr 2024' },
];

// ─── Engagement → Sibling engagements (engagements covering same process) ──

export function siblingEngagements(eng: Engagement, all: Engagement[]): Engagement[] {
  return all.filter(e => e.id !== eng.id && e.process === eng.process);
}

// ─── Risk register stub (for Exception → Risk linking) ─────────────────────

export interface RiskItem {
  id: string;
  code: string;
  title: string;
  severity: Severity;
  process: ProcessCode;
}

export const RISKS: RiskItem[] = [
  { id: 'r-1', code: 'RSK-P2P-04', title: 'Duplicate vendor payments due to weak duplicate-detection controls', severity: 'High',     process: 'P2P' },
  { id: 'r-2', code: 'RSK-P2P-07', title: 'Unauthorised PO threshold override',                                  severity: 'Medium',   process: 'P2P' },
  { id: 'r-3', code: 'RSK-ITG-02', title: 'Unauthorised privileged access provisioning',                          severity: 'Critical', process: 'ITGC' },
  { id: 'r-4', code: 'RSK-O2C-03', title: 'Revenue recognition timing errors',                                    severity: 'High',     process: 'O2C' },
];

// ─── Classification rationale templates ────────────────────────────────────

export interface RationaleTemplate {
  id: string;
  classification: 'Control Deficiency' | 'Process Gap' | 'False Positive' | 'Other';
  label: string;
  body: string;
}

export const RATIONALES: RationaleTemplate[] = [
  { id: 'rt-1', classification: 'Control Deficiency', label: 'Missing dual approval',         body: 'Control requiring two-person approval was bypassed via override.' },
  { id: 'rt-2', classification: 'Control Deficiency', label: 'Threshold control too lax',     body: 'Detection threshold allows known-bad patterns to pass undetected.' },
  { id: 'rt-3', classification: 'Process Gap',        label: 'SOP not followed',              body: 'Operator did not follow the documented SOP — process change needed.' },
  { id: 'rt-4', classification: 'Process Gap',        label: 'Missing escalation path',       body: 'No documented escalation path for this exception type.' },
  { id: 'rt-5', classification: 'False Positive',     label: 'Legitimate business retry',     body: 'Duplicate pattern matched but was a legitimate vendor retry under contract.' },
  { id: 'rt-6', classification: 'False Positive',     label: 'Tolerance match',               body: 'Difference falls within acceptable tolerance per policy.' },
];

// ─── Action plan templates ──────────────────────────────────────────────────

export interface ActionPlanTemplate {
  id: string;
  label: string;
  steps: string[];
  defaultDueDays: number;
}

export const ACTION_PLANS: ActionPlanTemplate[] = [
  { id: 'ap-1', label: 'Tighten threshold + retest',  steps: ['Adjust workflow threshold', 'Backtest last 90 days', 'Document new threshold', 'Notify auditor'], defaultDueDays: 7 },
  { id: 'ap-2', label: 'Update SOP + train',          steps: ['Update SOP document', 'Train affected operators', 'Audit-trail evidence of training', 'Schedule follow-up'], defaultDueDays: 14 },
  { id: 'ap-3', label: 'Vendor remediation',           steps: ['Contact vendor', 'Reverse posting / issue credit note', 'Document remediation', 'Close case'], defaultDueDays: 5 },
  { id: 'ap-4', label: 'Accept risk with management', steps: ['Document risk acceptance rationale', 'Get management sign-off', 'Add to risk register', 'Schedule review in 6m'], defaultDueDays: 21 },
];
