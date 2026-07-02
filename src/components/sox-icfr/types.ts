// ─── SOX / ICFR — model v2 ────────────────────────────────────────────────────
//
// Test of Design (TOD) and Test of Operating Effectiveness (TOE) are INDEPENDENT
// tracks on a control — tested separately, each with its own required documents,
// steps, manual override, and conclusion. The control conclusion rolls up from
// both. Discussions are role-tagged threads anchored to a control or a track.

export type Role = 'auditor' | 'risk-owner';
export const ROLE_LABEL: Record<Role, string> = { auditor: 'Auditor', 'risk-owner': 'Risk Owner' };

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

export type Court = 'auditor' | 'risk-owner' | 'none';
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
/** An optional evidence table the AI returns (e.g. per-item check results). */
export interface ValidationTable { columns: string[]; rows: string[][]; }
export interface ValidationResult {
  qa: ValidationQA[];
  result?: TestResult;       // Pass / Fail the AI concluded against the uploaded file
  summary?: string;          // plain-language summary of what the AI found
  table?: ValidationTable;   // optional supporting table
  fileName?: string;         // the required file the validation ran against
  at: string;
}

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
/** How one attribute is evidenced — choose one per attribute. */
export type EvidenceMode = 'ai' | 'workflow' | 'attest';
/** A manual self-attestation against one attribute: an explicit Pass/Fail
 *  conclusion, supporting text, uploaded evidence, and who attested it. */
export interface Attestation {
  result?: 'Pass' | 'Fail';   // manual conclusion the attester recorded
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
  evidenceMode?: EvidenceMode;
  workflowId?: string;
  workflowName?: string;
  workflowRunRef?: string;
  aiValidation?: boolean;
  inputFile?: EvidenceFile;      // the required file AI validation runs against
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
  // exception lifecycle
  status: ExceptionStatus;
  retest?: { result: 'Pass' | 'Fail'; at: string; by: string };
  signoff?: { by: string; at: string };
}
export type ExceptionStatus = 'Identified' | 'Remediation' | 'Retest' | 'Closed';

export interface SignificantAccount {
  id: string; name: string; balance: number; inScope: boolean; assertions: Assertion[];
}

/** The engagement-level "ground rules" that drive how every exception is evaluated and routed. */
export const MW_INDICATOR_CATALOGUE = [
  'Restatement of previously issued financial statements',
  'Material misstatement identified by audit, not the control',
  'Fraud of any magnitude by senior management',
  'Ineffective control environment / oversight',
  'Ineffective period-end financial reporting process',
] as const;
export interface MaterialityRules {
  clearlyTrivial: number;        // de-minimis threshold (₹) — below this, an exception is clearly trivial
  sdBandPct: number;             // significant-deficiency lower band, as % of overall materiality (e.g. 20)
  aggregate: boolean;            // aggregate individually-minor deficiencies by commonality
  autoRoute: boolean;            // auto-route an exception to the owner/reviewer by computed severity
  mwIndicators: string[];        // MW indicators in force for this engagement (from the catalogue)
}

// ─── Execution history (shared audit trail) ──────────────────────────────────────
// Every test-of-design / test-of-operating action either persona takes is logged here,
// so the auditor and the risk owner each see what the other ran on a control, and when.
export type ExecKind =
  | 'validate' | 'test-all' | 'pull-run' | 'attest' | 'conclude'
  | 'override' | 'request-docs' | 'receive-doc' | 'population' | 'sample';
export interface ExecutionEvent {
  id: string;
  controlId: string;
  track: 'design' | 'operating';
  kind: ExecKind;
  verb: string;                               // active-voice phrase, e.g. 'validated', 'concluded effective'
  target?: string;                            // attribute code / consideration / document the action touched
  result?: TestResult | TrackConclusion;      // outcome, when the action produced one
  by: string;                                 // actor display name
  role: Role;                                 // actor role — drives the trail's glyph + tint
  at: string;
}

export interface IcfrEngagement {
  id: string; code: string; name: string; entity: string; framework: string;
  periodStart: string; periodEnd: string; period: 'Interim' | 'Year-end';
  materiality: number; performanceMateriality: number; preparer: string; reviewer: string;
  rules: MaterialityRules;
  accounts: SignificantAccount[];
  controls: Control[];
  deficiencies: Deficiency[];
  tasks: HandoffTask[];
  discussions: Discussion[];
  executions: ExecutionEvent[];
}

export const DESIGN_DOC_KINDS: DesignDocKind[] = ['Process narrative', 'Flowchart', 'Walkthrough', 'Control description', 'Policy / SOP'];
