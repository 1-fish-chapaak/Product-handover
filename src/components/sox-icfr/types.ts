// ─── SOX / ICFR — canonical model ─────────────────────────────────────────────
//
// A control-testing engine embedded in an engagement. Framework-agnostic: the
// framework (SOX 404 / IFC) is metadata; what you test is the internal control,
// per-attribute, across Test of Design (TOD) and Test of Operating Effectiveness
// (TOE). All attributes pass both → control Effective.
//
// Grounded in the KPMG ICFR handbook: TOD vs TOE, precision / criteria for
// investigation, no fixed sample sizes (documented basis), deficiency severity
// = likelihood × magnitude vs materiality, MW indicators, aggregation.

export type Role = 'auditor' | 'reviewer' | 'risk-owner';

export type Assertion =
  | 'Completeness' | 'Accuracy' | 'Existence / Occurrence'
  | 'Cut-off' | 'Valuation' | 'Rights & Obligations' | 'Presentation';

export type Nature = 'Manual' | 'Automated';
export type ControlType = 'Preventive' | 'Detective';
export type Frequency = 'Annual' | 'Quarterly' | 'Monthly' | 'Weekly' | 'Daily' | 'Recurring' | 'Ad-hoc';

export type TestResult = 'Pass' | 'Fail' | 'Not tested';
/** TOE evidence procedure — inquiry can never be the SOLE procedure (handbook p250). */
export type TestProcedure = 'Inspection' | 'Reperformance' | 'Observation' | 'Inquiry';

export type Conclusion = 'Effective' | 'Ineffective' | 'In progress' | 'Not started';

/** Where the control sits in its lifecycle. */
export type Stage =
  | 'not-started'
  | 'pbc-requested'      // evidence requested from the risk owner
  | 'evidence-received'
  | 'tod'               // test of design in progress
  | 'toe'               // test of operating effectiveness in progress
  | 'concluded'
  | 'remediation'       // deficiency being remediated by the owner
  | 'in-review'
  | 'signed-off';

/** Whose court the ball is in — the async "baton". */
export type Court = 'auditor' | 'risk-owner' | 'reviewer' | 'none';

export type Likelihood = 'Remote' | 'Reasonably possible' | 'Probable';
export type Severity = 'Deficiency' | 'Significant Deficiency' | 'Material Weakness';

export interface EvidenceFile {
  id: string;
  name: string;
  kind: 'PDF' | 'XLSX' | 'IMG' | 'CSV';
  uploadedBy: string;
  uploadedAt: string;
}

export interface PhaseRecord {
  result: TestResult;
  note: string;
  testedBy: string | null;
  testedAt: string | null;
}

export interface ToeRecord extends PhaseRecord {
  /** Procedures applied — must include more than Inquiry to conclude Pass. */
  procedures: TestProcedure[];
  /** Per-sample pass/fail for the manual path (empty for automated). */
  sampleResults: { sampleId: string; result: TestResult }[];
  /** For the automated path: the workflow run this TOE is drawn from. */
  workflowRunRef?: string;
}

export interface Attribute {
  id: string;
  code: string;            // e.g. "P2P-C-01.1"
  description: string;     // the reperformable procedure
  assertion: Assertion;
  /** Criteria for investigation / precision — what makes it testable. */
  precision: string;
  tod: PhaseRecord;
  toe: ToeRecord;
}

export interface Sample {
  id: string;
  ref: string;
}

export interface Sampling {
  /** Documented basis — NOT just a number (handbook: no fixed sizes). */
  basis: string;
  method: 'Random' | 'Statistical' | 'Targeted' | 'Full population';
  size: number;
  samples: Sample[];
}

export interface Population {
  source: string;
  count: number;
  /** Completeness tie-out — sampling cannot address completeness on its own. */
  tieOut: string;
  evidence: EvidenceFile[];
}

export interface Control {
  id: string;              // "P2P-C-01"
  description: string;
  process: string;
  subProcess: string;
  nature: Nature;
  type: ControlType;
  frequency: Frequency;
  isKey: boolean;
  /** Control-level precision / "would" objective. */
  precision: string;
  owner: string;           // the risk / control owner (1st line)
  riskId: string;
  riskDescription: string;
  assertions: Assertion[];
  /** Automated controls draw TOE from this CCM workflow. */
  workflowId?: string;
  workflowName?: string;
  attributes: Attribute[];
  stage: Stage;
  conclusion: Conclusion;
  population?: Population;
  sampling?: Sampling;
}

export type TaskType = 'pbc' | 'query' | 'exception' | 'remediation' | 'review-note';
export type TaskStatus = 'open' | 'submitted' | 'cleared';

export interface TaskComment {
  by: string;
  at: string;
  text: string;
}

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
  thread: TaskComment[];
}

export interface Deficiency {
  id: string;
  controlId: string;
  attributeId?: string;
  kind: 'design' | 'operating';
  description: string;
  rootCause: string;
  likelihood: Likelihood;
  /** Potential misstatement (₹). Floor = actual error. */
  magnitude: number;
  mwIndicators: string[];
  compensatingControlId?: string;
  aggregationGroup?: string;
  remediation: {
    action: string;
    date: string | null;
    owner: string;
    status: 'Open' | 'In progress' | 'Done';
    result: TestResult;
  };
}

export interface SignificantAccount {
  id: string;
  name: string;
  balance: number;
  inScope: boolean;
  assertions: Assertion[];
}

export interface IcfrEngagement {
  id: string;
  code: string;
  name: string;
  entity: string;
  framework: string;       // "SOX 404 / ICFR"
  periodStart: string;
  periodEnd: string;
  period: 'Interim' | 'Year-end';
  /** Overall + performance materiality (₹). */
  materiality: number;
  performanceMateriality: number;
  preparer: string;
  reviewer: string;
  accounts: SignificantAccount[];
  controls: Control[];
  deficiencies: Deficiency[];
  tasks: HandoffTask[];
}

export const STAGE_LABEL: Record<Stage, string> = {
  'not-started': 'Not started',
  'pbc-requested': 'PBC requested',
  'evidence-received': 'Evidence received',
  tod: 'Test of Design',
  toe: 'Operating effectiveness',
  concluded: 'Concluded',
  remediation: 'Remediation',
  'in-review': 'In review',
  'signed-off': 'Signed off',
};

export const ROLE_LABEL: Record<Role, string> = {
  auditor: 'Auditor',
  reviewer: 'Reviewer',
  'risk-owner': 'Risk Owner',
};
