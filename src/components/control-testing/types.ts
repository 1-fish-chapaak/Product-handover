// ─── Control Testing (CSA + Independent Audit) — canonical model ──────────────
//
// One control moves through a single lifecycle, viewed by three roles:
//
//   Performer  →  Control Owner  →  Auditor (Phase 1 → Phase 2)  →  [ATR if Fail]
//   ─ self-assessment (CSA) ──┘                └─ independent testing ─┘
//
// Frequency drives WHEN a control is due. Automated attributes pull a workflow
// run as evidence; self-assessed attributes are attested with uploaded evidence.

export type Role = 'performer' | 'owner' | 'auditor';

export type Frequency = 'Ad-hoc' | 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly';

/** Attribute-level test method. */
export type AttributeMethod = 'Automated' | 'Self-assessed';
/** Control-level method, derived from its attributes. */
export type ControlMethod = AttributeMethod | 'Hybrid';

/** Performer self-assessment outcome. */
export type SelfAssessment = 'OK' | 'Not OK';
/** Control-owner review verdict. */
export type OwnerVerdict = 'Pass' | 'Fail';
/** Auditor phase / generic test result. */
export type TestResult = 'Pass' | 'Fail';
/** AI / workflow automated verdict (Hold = needs human judgement). */
export type AutoVerdict = 'Pass' | 'Fail' | 'Hold';

export type Phase = 1 | 2;

/** Lifecycle stage of a control's testing loop. */
export type Stage =
  | 'awaiting-self-assessment'
  | 'awaiting-owner-review'
  | 'awaiting-audit'
  | 'audit-phase-1'
  | 'audit-phase-2'
  | 'concluded';

export type Conclusion = 'Effective' | 'Ineffective' | null;

export type Severity = 'Critical' | 'High' | 'Medium' | 'Low';

export interface EvidenceFile {
  id: string;
  name: string;
  kind: 'PDF' | 'XLSX' | 'IMG' | 'CSV';
  uploadedBy: string;
  uploadedAt: string; // human label, e.g. "2 days ago"
}

/** A workflow run snapshot attached to an automated attribute. */
export interface WorkflowRun {
  workflowId: string;
  workflowName: string;
  lastRunAt: string | null; // null = never run yet
  population: number; // rows scanned
  exceptions: number; // anomalies found
  verdict: AutoVerdict | null; // null = not assessed yet
  confidence: number; // 0–100
  rationale: string;
  columns: string[];
  rows: (string | number)[][];
}

export interface SelfAssessmentRecord {
  outcome: SelfAssessment | null;
  remark: string;
  evidence: EvidenceFile[];
  submittedBy: string | null;
  submittedAt: string | null;
}

export interface OwnerReviewRecord {
  verdict: OwnerVerdict | null;
  remark: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
}

export interface PhaseRecord {
  result: TestResult | null;
  notes: string;
  evidence: EvidenceFile[];
  testedBy: string | null;
  testedAt: string | null;
}

export interface AttributeTest {
  id: string;
  code: string; // e.g. "P2P-C-01.1"
  description: string;
  method: AttributeMethod;
  assertion: string; // Completeness / Accuracy / Validity / Authorisation …
  /** Present when method === 'Automated'. */
  workflow?: WorkflowRun;
  selfAssessment: SelfAssessmentRecord;
  ownerReview: OwnerReviewRecord;
  phase1: PhaseRecord;
  phase2: PhaseRecord;
}

export type AtrStatus = 'Open' | 'In Remediation' | 'Closed';

/** Action Taken Report — raised when a control concludes Ineffective. */
export interface ActionTakenReport {
  id: string; // "ATR-2026-014"
  raisedAt: string;
  severity: Severity;
  exception: string; // what failed
  rootCause: string;
  managementAction: string; // planned remediation
  managementActionDate: string | null; // target date
  remediationOwner: string;
  status: AtrStatus;
  /** Owner returns on the action date and marks whether remediation passed. */
  remediationResult: TestResult | null;
  closedAt: string | null;
}

export interface ControlTest {
  controlId: string; // "P2P-C-01"
  name: string;
  process: string; // "P2P"
  subProcess: string;
  isKey: boolean;
  frequency: Frequency;
  owner: string; // control owner (reviews self-assessment)
  performer: string; // who performs the control
  /** Human due label, e.g. "Due today", "Overdue 2 days", "Due in 4 days". */
  dueLabel: string;
  /** True when the due label represents an overdue control. */
  overdue: boolean;
  stage: Stage;
  conclusion: Conclusion;
  attributes: AttributeTest[];
  atr: ActionTakenReport | null;
}

// ─── Derivations ──────────────────────────────────────────────────────────────

export function deriveControlMethod(c: Pick<ControlTest, 'attributes'>): ControlMethod {
  const hasAuto = c.attributes.some((a) => a.method === 'Automated');
  const hasManual = c.attributes.some((a) => a.method === 'Self-assessed');
  if (hasAuto && hasManual) return 'Hybrid';
  if (hasAuto) return 'Automated';
  return 'Self-assessed';
}

export const STAGE_ORDER: Stage[] = [
  'awaiting-self-assessment',
  'awaiting-owner-review',
  'awaiting-audit',
  'audit-phase-1',
  'audit-phase-2',
  'concluded',
];

export const STAGE_LABEL: Record<Stage, string> = {
  'awaiting-self-assessment': 'Self-assessment',
  'awaiting-owner-review': 'Owner review',
  'awaiting-audit': 'Awaiting audit',
  'audit-phase-1': 'Audit · Phase 1',
  'audit-phase-2': 'Audit · Phase 2',
  concluded: 'Concluded',
};

/** Which role is the actor responsible for moving a control out of this stage. */
export const STAGE_ACTOR: Record<Stage, Role> = {
  'awaiting-self-assessment': 'performer',
  'awaiting-owner-review': 'owner',
  'awaiting-audit': 'auditor',
  'audit-phase-1': 'auditor',
  'audit-phase-2': 'auditor',
  concluded: 'auditor',
};

export const ROLE_LABEL: Record<Role, string> = {
  performer: 'Performer',
  owner: 'Control Owner',
  auditor: 'Auditor',
};
