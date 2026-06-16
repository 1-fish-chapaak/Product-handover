// ─── SOX / ICFR — model v2 ────────────────────────────────────────────────────
//
// Test of Design (TOD) and Test of Operating Effectiveness (TOE) are INDEPENDENT
// tracks on a control — tested separately, each with its own required documents,
// steps, manual override, and conclusion. The control conclusion rolls up from
// both. Discussions are role-tagged threads anchored to a control or a track.

export type Role = 'auditor' | 'reviewer' | 'risk-owner';
export const ROLE_LABEL: Record<Role, string> = { auditor: 'Auditor', reviewer: 'Reviewer', 'risk-owner': 'Risk Owner' };

export type Assertion =
  | 'Completeness' | 'Accuracy' | 'Existence / Occurrence'
  | 'Cut-off' | 'Valuation' | 'Rights & Obligations' | 'Presentation';

export type Nature = 'Manual' | 'Automated' | 'IT-dependent';
export type ControlType = 'Preventive' | 'Detective';
export type Frequency = 'Annual' | 'Quarterly' | 'Monthly' | 'Weekly' | 'Daily' | 'Recurring' | 'Ad-hoc';

export type TestResult = 'Pass' | 'Fail' | 'Not tested';
export type TestProcedure = 'Inspection' | 'Reperformance' | 'Observation' | 'Inquiry';
export type TrackConclusion = 'Effective' | 'Ineffective' | 'Not tested';
export type TrackStatus = 'Not started' | 'In progress' | 'Concluded';
export type Conclusion = 'Effective' | 'Ineffective' | 'In progress' | 'Not started';

export type Court = 'auditor' | 'risk-owner' | 'reviewer' | 'none';
export type Likelihood = 'Remote' | 'Reasonably possible' | 'Probable';
export type Severity = 'Deficiency' | 'Significant Deficiency' | 'Material Weakness';

/** A manual override of a computed/automated result, with who/why. */
export interface Override {
  result: TestResult | 'Effective' | 'Ineffective';
  by: string;
  at: string;
  rationale: string;
}

export interface EvidenceFile {
  id: string;
  name: string;
  kind: 'PDF' | 'XLSX' | 'IMG' | 'CSV';
  uploadedBy: string;
  uploadedAt: string;
}

// ─── Design track (TOD) ─────────────────────────────────────────────────────────

export type DesignDocKind = 'Process narrative' | 'Flowchart' | 'Walkthrough' | 'Control description' | 'Policy / SOP';
export type DocStatus = 'Received' | 'Requested' | 'Missing';
export interface DesignDoc {
  id: string;
  kind: DesignDocKind;
  name: string;
  status: DocStatus;
  uploadedBy?: string;
  at?: string;
}
/** The Q&A a validation workflow produced — reviewable after it runs. */
export interface ValidationQA { q: string; a: string; pass: boolean; }
export interface ValidationResult { qa: ValidationQA[]; at: string; }

/** A design consideration — validated by its own workflow, with manual override. */
export interface DesignPoint {
  id: string;
  text: string;
  workflowId?: string;
  workflowName?: string;
  workflowRunRef?: string;
  validation?: ValidationResult;
  result: TestResult;
  override?: Override;
}
export interface DesignTrack {
  documents: DesignDoc[];
  points: DesignPoint[];
  conclusion: TrackConclusion;
  override?: Override;
  testedBy: string | null;
  testedAt: string | null;
}

// ─── Operating track (TOE) ──────────────────────────────────────────────────────

export type OperatingMethod = 'Automated' | 'Manual';
/** A first-line self-attestation against one attribute: text + uploaded evidence. */
export interface Attestation {
  note: string;
  evidence: EvidenceFile[];
  by: string;
  role: Role;
  at: string;
}
/** One attribute (test step). Each attribute is evidenced independently — by its
 *  own linked workflow, or by self-attestation with text + uploaded evidence. */
export interface OperatingStep {
  id: string;
  code: string;
  description: string;
  assertion: Assertion;
  precision: string;
  procedures: TestProcedure[];
  workflowId?: string;
  workflowName?: string;
  workflowRunRef?: string;
  aiValidation?: boolean;
  validation?: ValidationResult;
  attestEnabled?: boolean;
  attestation?: Attestation;
  result: TestResult;
  override?: Override;
}
export interface Sample { id: string; ref: string; result: TestResult; }
export interface Sampling {
  basis: string;
  method: 'Random' | 'Statistical' | 'Targeted' | 'Full population';
  size: number;
  samples: Sample[];
}
export interface Population {
  source: string;
  count: number;
  tieOut: string;
  evidence: EvidenceFile[];
}
export interface OperatingTrack {
  method: OperatingMethod;        // dominant evidence mode — informational; each attribute is evidenced independently
  population?: Population;
  sampling?: Sampling;
  steps: OperatingStep[];
  conclusion: TrackConclusion;
  override?: Override;
  testedBy: string | null;
  testedAt: string | null;
}

// ─── Control ─────────────────────────────────────────────────────────────────────

export interface Control {
  id: string;
  wpRef: string;            // working-paper cross-reference (the signature)
  description: string;
  process: string;
  subProcess: string;
  nature: Nature;
  type: ControlType;
  frequency: Frequency;
  isKey: boolean;
  precision: string;
  owner: string;
  riskId: string;
  riskDescription: string;
  assertions: Assertion[];
  design: DesignTrack;
  operating: OperatingTrack;
}

// ─── Discussions (role-tagged threads) ──────────────────────────────────────────

export type DiscussionAnchor = 'control' | 'design' | 'operating';
export interface DiscussionComment {
  id: string;
  by: string;
  role: Role;
  at: string;
  text: string;
}
export interface Discussion {
  id: string;
  controlId: string;
  anchor: DiscussionAnchor;
  resolved: boolean;
  comments: DiscussionComment[];
}

// ─── Handoffs, deficiencies, scope, engagement ───────────────────────────────────

export type TaskType = 'pbc' | 'query' | 'remediation';
export type TaskStatus = 'open' | 'submitted' | 'cleared';
export interface HandoffTask {
  id: string;
  type: TaskType;
  controlId: string;
  title: string;
  detail: string;
  assignee: string;
  assigneeRole: Role;
  raisedBy: string;
  dueLabel: string;
  overdue: boolean;
  status: TaskStatus;
}

export interface Deficiency {
  id: string;
  controlId: string;
  track: 'design' | 'operating';
  description: string;
  rootCause: string;
  likelihood: Likelihood;
  magnitude: number;
  mwIndicators: string[];
  compensatingControlId?: string;
  aggregationGroup?: string;
  remediation: { action: string; date: string | null; owner: string; status: 'Open' | 'In progress' | 'Done' };
}

export interface SignificantAccount {
  id: string; name: string; balance: number; inScope: boolean; assertions: Assertion[];
}

export interface IcfrEngagement {
  id: string; code: string; name: string; entity: string; framework: string;
  periodStart: string; periodEnd: string; period: 'Interim' | 'Year-end';
  materiality: number; performanceMateriality: number; preparer: string; reviewer: string;
  accounts: SignificantAccount[];
  controls: Control[];
  deficiencies: Deficiency[];
  tasks: HandoffTask[];
  discussions: Discussion[];
}

export const DESIGN_DOC_KINDS: DesignDocKind[] = ['Process narrative', 'Flowchart', 'Walkthrough', 'Control description', 'Policy / SOP'];
