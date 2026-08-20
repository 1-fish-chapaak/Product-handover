/**
 * Shared engagement seed data used by the engagement list (EngagementsView)
 * and the engagement detail page (EngagementDetailView).
 *
 * Single source of truth so adding/changing an engagement is one edit, not two.
 */

export type ProcessCode = 'P2P' | 'O2C' | 'R2R' | 'S2C' | 'ITGC';
export type EngStatus = 'Active' | 'In Progress' | 'Planned' | 'Review' | 'Draft' | 'Closed';
export type EngType = 'Compliance' | 'Internal Audit' | 'Automation' | 'SOX / ICFR';
/** Concrete project shape for Automation engagements — kept undefined for Compliance / Internal Audit. */
export type AutomationSubtype = 'CCM' | 'Reconciliation' | 'MIS' | 'Forensic' | 'Image Analytics' | 'Custom';

/** Headline materiality ground rules captured for a SOX / ICFR engagement at creation.
 *  The full rule set (severity bands, aggregation, auto-routing) is managed in the SOX workspace. */
export interface SoxConfig {
  overallMateriality: number;
  performanceMateriality: number;
  clearlyTrivial: number;
  sdBandPct: number;
  aggregate: boolean;
  keyOnly: boolean;
}

/** A dated engagement milestone (ISO yyyy-mm-dd). Drives the "Upcoming milestones" feed. */
export interface EngagementMilestone {
  label: string;
  date: string;
}

/** People attached to an engagement beyond the primary owner. */
export interface EngagementTeam {
  reviewer?: string;
  auditors?: string[];
  riskOwners?: string[];
}

/** Scope configuration captured at creation for a Compliance engagement. */
export interface ComplianceConfig {
  racmVersion: string;
  samplingMethod: string;
  sampleSize?: number;
  materiality: number;
}

/** Scope configuration captured at creation for an Internal Audit engagement. */
export interface AuditScopeConfig {
  scopeLevel: string;
  subProcesses: string[];
  linkedRacms: string[];
  linkedSops: string[];
  tatDays: number;
  idrTemplate: string;
  cadence: string;
}

/** Scope configuration captured at creation for an Automation engagement. */
export interface AutomationConfig {
  templates: string[];
  inputSources: string[];
  cadence: string;
  threshold: number;
  alertRecipients: string[];
}

/** One legal entity inside the group the engagement covers. Mirrors the SOX
 *  scoping flow's GroupEntity, minus the ownership % and trial-balance fields
 *  that only the SOX derivation needs. */
export interface EngagementEntity {
  id: string;
  name: string;
  type: 'Holding' | 'Subsidiary';
}

export interface Engagement {
  id: string;
  code: string;
  name: string;
  description: string;
  type: EngType;
  /** Required for Automation; ignored for Compliance / Internal Audit. */
  subtype?: AutomationSubtype;
  /** Present only for SOX / ICFR engagements. */
  soxConfig?: SoxConfig;
  /** Scoping-derived process list (SOX Testing flow) — the ICFR workspace
   *  seeds one RACM per entry instead of the single-process template. */
  soxProcesses?: string[];
  /** How the scoping-derived workspace seeds its testing state (SOX Testing
   *  flow only). 'live' = testing in flight (all but one control per RACM
   *  concluded), 'carried' = design carried from the prior cycle with the
   *  operating retest pending, 'fresh' (default) = nothing tested yet. */
  soxSeedMode?: 'fresh' | 'live' | 'carried';
  /** Present only for Compliance engagements created via the wizard. */
  complianceConfig?: ComplianceConfig;
  /** Present only for Internal Audit engagements created via the wizard. */
  auditConfig?: AuditScopeConfig;
  /** Present only for Automation engagements created via the wizard. */
  automationConfig?: AutomationConfig;
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
  /** Group (listed / holding) company the engagement runs under — shown on the
   *  engagement card as the entity in scope. */
  entity?: string;
  /** Legal entities inside that group covered by the engagement, captured on
   *  the creation wizard's Basics step. SOX engagements derive theirs from the
   *  scoping uploads instead (see SoxProgramme.entities). */
  groupEntities?: EngagementEntity[];
  /** ISO period bounds (yyyy-mm-dd) — the machine-readable twin of periodStart/periodEnd. */
  startDate?: string;
  endDate?: string;
  /** Reviewer + team beyond the primary owner. */
  team?: EngagementTeam;
  /** Dated milestones (ISO) — source of truth for the Upcoming milestones feed. */
  milestones?: EngagementMilestone[];
  /** Set for engagements drafted by Ira's One-Click Audit — drives the "AI Recommended" badge. */
  aiRecommended?: boolean;
}

export const ENGAGEMENTS: Engagement[] = [
  {
    id: 'eng-1', code: 'ENG-001', name: 'FY26 ICFR — Airline P2P & O2C',
    description: 'SOX 404 / ICFR engagement — entity-wide scoping, Procure-to-Pay key controls, design + operating effectiveness, and deficiency evaluation against materiality.',
    type: 'SOX / ICFR', process: 'P2P', framework: 'COSO 2013 / SOX 404', owner: 'A. Mehta',
    status: 'Active', periodStart: 'Apr 2025', periodEnd: 'Mar 2026', controls: 100,
    health: 75, openIssues: 3, lastActivity: '2d ago', nextScheduled: 'Sign-off in 12d',
    startDate: '2025-04-01', endDate: '2026-03-31',
    milestones: [
      { label: 'Kickoff', date: '2025-04-15' },
      { label: 'Interim testing complete', date: '2025-10-31' },
      { label: 'Management sign-off', date: '2026-05-27' },
    ],
  },
  {
    id: 'eng-2', code: 'ENG-002', name: 'O2C — SOX / ICFR',
    description: 'Order-to-Cash SOX testing across customer master, credit limits, invoicing, and revenue recognition cut-offs.',
    type: 'SOX / ICFR', process: 'O2C', framework: 'COSO 2013 / SOX 404', owner: 'Neha Joshi',
    status: 'Active', periodStart: 'Apr 2025', periodEnd: 'Mar 2026', controls: 18,
    health: 89, openIssues: 1, lastActivity: '6h ago', nextScheduled: 'Walkthrough in 4d',
    startDate: '2025-04-01', endDate: '2026-03-31',
    milestones: [
      { label: 'Kickoff', date: '2025-05-05' },
      { label: 'Walkthroughs', date: '2026-05-19' },
      { label: 'Final sign-off', date: '2026-06-30' },
    ],
  },
  {
    id: 'eng-sox-3', code: 'ENG-010', name: 'R2R — SOX / ICFR',
    description: 'Record-to-Report SOX testing — manual journals, reconciliations, close checklist, and management review controls.',
    type: 'SOX / ICFR', process: 'R2R', framework: 'COSO 2013 / SOX 404', owner: 'D. Rao',
    status: 'Planned', periodStart: 'Apr 2025', periodEnd: 'Mar 2026', controls: 22,
    health: 0, openIssues: 0, lastActivity: 'Not started', nextScheduled: 'Kickoff Jul 1',
    startDate: '2025-04-01', endDate: '2026-03-31',
    milestones: [
      { label: 'Kickoff', date: '2026-07-01' },
      { label: 'Fieldwork complete', date: '2026-09-15' },
      { label: 'Sign-off', date: '2026-11-30' },
    ],
  },
  {
    // The roll-forward demo: this cycle's interim arrives already tested AND
    // countersigned (see signedInterim in sox-icfr/mockData.ts), so the Roll
    // forward flow — parent picked, dates derived, materiality inherited, scope
    // restricted to what passed — can be walked without concluding an audit by
    // hand first. Altura (SOX-104) stays the testing demo; this one exists to
    // be rolled forward.
    id: 'eng-sox-rf', code: 'SOX-105', name: 'FY27 ICFR — Altura Renewables',
    description: 'FY 2026-27 ICFR cycle for the renewables arm — interim testing complete and countersigned, ready to roll forward to year end.',
    type: 'SOX / ICFR', process: 'O2C', framework: 'COSO 2013 / SOX 404', owner: 'A. Mehta',
    status: 'Active', periodStart: 'Apr 2026', periodEnd: 'Mar 2027', controls: 10,
    health: 80, openIssues: 0, lastActivity: '6d ago', nextScheduled: 'Roll-forward planning',
    entity: 'Altura Renewables Ltd',
    soxProcesses: ['Order to Cash', 'Treasury'], soxSeedMode: 'live',
    startDate: '2026-04-01', endDate: '2027-03-31',
    milestones: [
      { label: 'Interim sign-off', date: '2026-08-14' },
      { label: 'Roll-forward fieldwork', date: '2026-12-15' },
      { label: 'Year-end sign-off', date: '2027-04-15' },
    ],
  },
  {
    id: 'eng-3', code: 'ENG-003', name: 'AP Duplicate Invoice Monitor',
    description: 'Always-on monitoring for duplicate AP invoice posting — daily scan against vendor, amount, invoice number, and date.',
    type: 'Automation', subtype: 'CCM', process: 'P2P', framework: 'Internal Policy', owner: 'Priya Singh',
    status: 'In Progress', periodStart: 'Apr 2025', periodEnd: 'Mar 2026', controls: 6,
    health: 94, openIssues: 2, lastActivity: '4h ago', nextScheduled: 'in 8h',
    startDate: '2025-04-01', endDate: '2026-03-31',
    milestones: [
      { label: 'Go-live', date: '2025-04-21' },
      { label: 'Quarterly rule review', date: '2026-06-15' },
      { label: 'FY coverage attestation', date: '2026-09-30' },
    ],
  },
  {
    id: 'eng-4', code: 'ENG-004', name: 'S2C — Contract Review',
    description: 'Internal audit of source-to-contract — vendor qualification, contract authority matrix, and obligation tracking.',
    type: 'Internal Audit', process: 'S2C', framework: 'Internal Policy', owner: 'Rohan Patel',
    status: 'Planned', periodStart: 'Jul 2025', periodEnd: 'Sep 2025', controls: 14,
    health: 0, openIssues: 0, lastActivity: 'Not started', nextScheduled: 'Fieldwork Jul 1',
    startDate: '2025-07-01', endDate: '2025-09-30',
    milestones: [
      { label: 'Fieldwork start', date: '2025-07-01' },
      { label: 'Draft report', date: '2025-08-20' },
      { label: 'Closing meeting', date: '2025-09-25' },
    ],
  },
  {
    id: 'eng-5', code: 'ENG-005', name: 'P2P — IFC Assessment',
    description: 'Indian Financial Controls assessment for P2P process per Companies Act 2013 §143(3)(i) requirements.',
    type: 'Compliance', process: 'P2P', framework: 'IFC', owner: 'Sneha Desai',
    status: 'Planned', periodStart: 'Aug 2025', periodEnd: 'Oct 2025', controls: 18,
    health: 0, openIssues: 0, lastActivity: 'Not started', nextScheduled: 'Kickoff Aug 5',
    startDate: '2025-08-01', endDate: '2025-10-31',
    milestones: [
      { label: 'Kickoff', date: '2025-08-05' },
      { label: 'Control testing complete', date: '2025-09-30' },
      { label: 'IFC report', date: '2025-10-24' },
    ],
  },
  {
    id: 'eng-6', code: 'ENG-006', name: 'IT General Controls Monitoring',
    description: 'Continuous monitoring of IT general controls — access provisioning, privileged access, change management, backup.',
    type: 'Automation', subtype: 'CCM', process: 'ITGC', framework: 'ISO 27001', owner: 'Deepak Bansal',
    status: 'Active', periodStart: 'Jun 2025', periodEnd: 'Jan 2026', controls: 15,
    health: 58, openIssues: 7, lastActivity: '1h ago', nextScheduled: 'in 23h',
    startDate: '2025-06-01', endDate: '2026-01-31',
    milestones: [
      { label: 'Coverage review', date: '2025-09-01' },
      { label: 'Recalibration', date: '2026-01-10' },
      { label: 'Annual attestation', date: '2026-05-16' },
    ],
  },
  {
    id: 'eng-7', code: 'ENG-007', name: 'Vendor Risk Assessment',
    description: 'Operational internal audit of vendor onboarding, KYC, sanctions screening, and ongoing risk scoring.',
    type: 'Internal Audit', process: 'P2P', framework: 'Internal Policy', owner: 'Priya Singh',
    status: 'Draft', periodStart: 'Oct 2025', periodEnd: 'Nov 2025', controls: 8,
    health: 0, openIssues: 0, lastActivity: 'Draft', nextScheduled: 'Plan due Sep 20',
    startDate: '2025-10-01', endDate: '2025-11-30',
    milestones: [
      { label: 'Audit plan due', date: '2025-09-20' },
      { label: 'Fieldwork start', date: '2025-10-06' },
      { label: 'Final report', date: '2025-11-24' },
    ],
  },
  {
    id: 'eng-8', code: 'ENG-008', name: 'O2C — Revenue Recognition Monitor',
    description: 'Always-on monitoring of revenue recognition timing — cutoffs, deferred revenue, and ASC 606 obligations.',
    type: 'Automation', subtype: 'CCM', process: 'O2C', framework: 'SOX ICFR', owner: 'Neha Joshi',
    status: 'Review', periodStart: 'Oct 2025', periodEnd: 'Jan 2026', controls: 10,
    health: 82, openIssues: 4, lastActivity: '15m ago', nextScheduled: 'in 45m',
    startDate: '2025-10-01', endDate: '2026-01-31',
    milestones: [
      { label: 'Interim review', date: '2025-11-15' },
      { label: 'Final review', date: '2026-05-15' },
      { label: 'Closeout', date: '2026-05-30' },
    ],
  },
  {
    id: 'eng-9', code: 'ENG-009', name: 'Vendor Reconciliation — Airline Group',
    description: 'Three-way reconciliation across vendor invoices, GRN data, and bank statements for pan-India vendors.',
    type: 'Automation', subtype: 'Reconciliation', process: 'P2P', framework: 'Internal Policy', owner: 'Rohan Patel',
    status: 'Active', periodStart: 'Jul 2025', periodEnd: 'Mar 2026', controls: 4,
    health: 91, openIssues: 6, lastActivity: '3d ago', nextScheduled: 'Weekly batch in 2d',
    startDate: '2025-07-01', endDate: '2026-03-31',
    milestones: [
      { label: 'Pilot reconciliation', date: '2025-07-21' },
      { label: 'Coverage expansion', date: '2025-11-03' },
      { label: 'FY closeout recon', date: '2026-05-17' },
    ],
  },
  {
    id: 'ef-auto-001', code: 'EF-AUTO-001', name: 'AP Invoice Aging Monitor',
    description: 'Continuous monitoring of AP invoice aging — flags overdue invoices, blocked payment runs, and vendors trending past agreed terms.',
    type: 'Automation', subtype: 'CCM', process: 'P2P', framework: 'Internal Policy', owner: 'Priya Singh',
    status: 'Active', periodStart: 'Oct 2025', periodEnd: 'Mar 2026', controls: 4,
    health: 88, openIssues: 4, lastActivity: '3h ago', nextScheduled: 'in 8h',
    startDate: '2025-10-01', endDate: '2026-03-31',
    milestones: [
      { label: 'Go-live', date: '2025-10-15' },
      { label: 'Rule review', date: '2026-01-20' },
      { label: 'Scope refresh', date: '2026-06-01' },
    ],
  },
  {
    id: 'ef-001', code: 'EF-001', name: 'P2P Internal Audit Review',
    description: 'Internal audit of Procure to Pay process covering duplicate invoices, PO approvals, and vendor master changes.',
    type: 'Internal Audit', process: 'P2P', framework: 'Internal Policy', owner: 'Karan Mehta',
    status: 'In Progress', periodStart: 'Jan 2026', periodEnd: 'Jun 2026', controls: 8,
    health: 68, openIssues: 5, lastActivity: '2h ago', nextScheduled: 'Pending review',
    startDate: '2026-01-01', endDate: '2026-06-30',
    milestones: [
      { label: 'Kickoff', date: '2026-01-12' },
      { label: 'Fieldwork complete', date: '2026-04-30' },
      { label: 'Draft report', date: '2026-05-28' },
    ],
  },
  {
    id: 'ef-comp-001', code: 'EF-COMP-001', name: 'P2P SOX Control Testing',
    description: 'SOX ICFR compliance control testing for Procure-to-Pay — RACM, controls, sampling, evidence, attribute testing, and working paper.',
    type: 'Compliance', process: 'P2P', framework: 'SOX ICFR', owner: 'Tushar Goel',
    status: 'Active', periodStart: 'Jan 2026', periodEnd: 'Jun 2026', controls: 24,
    health: 76, openIssues: 3, lastActivity: 'Today', nextScheduled: 'Continue Testing',
    startDate: '2026-01-01', endDate: '2026-06-30',
    milestones: [
      { label: 'Kickoff', date: '2026-01-19' },
      { label: 'Interim testing', date: '2026-05-22' },
      { label: 'Sign-off', date: '2026-06-26' },
    ],
  },
];

export const PROCESS_COLORS: Record<ProcessCode, string> = {
  P2P: '#6a12cd', O2C: '#0284c7', R2R: '#d97706', S2C: '#059669', ITGC: '#7c3aed',
};

/** Runtime registry for engagements created or edited during the session (the seed
 *  array is static). Lets any view (e.g. the SOX experience) resolve a created or
 *  session-edited engagement by id. */
const RUNTIME_ENGAGEMENTS: Engagement[] = [];
/** Upsert — replaces an existing runtime entry so session edits stay current. */
export function registerEngagement(e: Engagement): void {
  const idx = RUNTIME_ENGAGEMENTS.findIndex(x => x.id === e.id);
  if (idx >= 0) RUNTIME_ENGAGEMENTS[idx] = e;
  else RUNTIME_ENGAGEMENTS.unshift(e);
}
export function findEngagement(id: string): Engagement | undefined {
  // Runtime first so session edits win over the static seed.
  return RUNTIME_ENGAGEMENTS.find(e => e.id === id) ?? ENGAGEMENTS.find(e => e.id === id);
}
/** The library's boot list — session-created engagements first (newest on top),
 *  then the seeds, with any session-edited seed replaced by its runtime copy.
 *  Without this a created engagement vanishes from the list when the library
 *  remounts (e.g. Back to Engagements from its workspace). */
export function libraryEngagements(): Engagement[] {
  const fresh = RUNTIME_ENGAGEMENTS.filter(r => !ENGAGEMENTS.some(s => s.id === r.id));
  return [...fresh, ...ENGAGEMENTS.map(s => RUNTIME_ENGAGEMENTS.find(r => r.id === s.id) ?? s)];
}
