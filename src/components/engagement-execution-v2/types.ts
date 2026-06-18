// ─── Engagement Execution V2 — Canonical Types ───────────────────────────
// Single source of truth. All statuses are lifecycle only.
// Readiness / derived values are computed in executionState.ts and helpers.ts.

// ─── Const Enums ──────────────────────────────────────────────────────────

export const ControlExecStatus = {
  NOT_STARTED: 'NOT_STARTED',
  POPULATION_READY: 'POPULATION_READY',
  TEST_ITEMS_READY: 'TEST_ITEMS_READY',
  EVIDENCE_IN_PROGRESS: 'EVIDENCE_IN_PROGRESS',
  EVIDENCE_READY: 'EVIDENCE_READY',
  TESTING_IN_PROGRESS: 'TESTING_IN_PROGRESS',
  TESTING_COMPLETE: 'TESTING_COMPLETE',
  PENDING_REVIEW: 'PENDING_REVIEW',
  REJECTED: 'REJECTED',
  CONCLUDED: 'CONCLUDED',
} as const;
export type ControlExecStatus = typeof ControlExecStatus[keyof typeof ControlExecStatus];

export const ImportanceClass = { KEY: 'KEY', NON_KEY: 'NON_KEY' } as const;
export type ImportanceClass = typeof ImportanceClass[keyof typeof ImportanceClass];

export const NatureClass = { PREVENTIVE: 'PREVENTIVE', DETECTIVE: 'DETECTIVE', CORRECTIVE: 'CORRECTIVE' } as const;
export type NatureClass = typeof NatureClass[keyof typeof NatureClass];

export const AutomationClass = { MANUAL: 'MANUAL', IT_DEPENDENT: 'IT_DEPENDENT', AUTOMATED: 'AUTOMATED' } as const;
export type AutomationClass = typeof AutomationClass[keyof typeof AutomationClass];

export const AttributeType = { AUTOMATED: 'AUTOMATED', MANUAL: 'MANUAL' } as const;
export type AttributeType = typeof AttributeType[keyof typeof AttributeType];

/**
 * Attribute scope: does this attribute loop over the control's samples
 * (SAMPLE_BASED) or is it a single control-level check (GENERIC)?
 * Drives whether the per-attribute card uses a per-sample table or a one-shot upload.
 */
export const AttrScope = { SAMPLE_BASED: 'SAMPLE_BASED', GENERIC: 'GENERIC' } as const;
export type AttrScope = typeof AttrScope[keyof typeof AttrScope];

/** Sampling method picked at the control level. */
export const SamplingMethod = {
  RANDOM: 'RANDOM',
  STATISTICAL: 'STATISTICAL',
  COLUMN_FILTER: 'COLUMN_FILTER',
  WORKFLOW: 'WORKFLOW',
} as const;
export type SamplingMethod = typeof SamplingMethod[keyof typeof SamplingMethod];

/** Sampling configuration at the control level. */
export interface SamplingConfig {
  method: SamplingMethod;
  /** Target sample size — applies to RANDOM, STATISTICAL, COLUMN_FILTER. */
  sampleSize: number;
  /** Human-readable filter description shown on the card. Used for COLUMN_FILTER. */
  filterDescription?: string;
  /** Reference to the workflow that generates the sample list. Used for WORKFLOW. */
  samplingWorkflowId?: string;
  samplingWorkflowName?: string;
  /** ISO timestamp when the sample set was generated. Null = not generated yet. */
  generatedAt: string | null;
  /** Generated TestItem IDs that comprise the sample. */
  sampleItemIds: string[];
}

/** A workflow that validates uploaded evidence for a control. */
export interface ValidationWorkflow {
  id: string;
  name: string;
  /** Short description of what the workflow checks (e.g. "OCR PDF + verify CFO signature"). */
  description: string;
  /** ISO timestamp of the last run, null if never run. */
  lastRunAt: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'ERROR';
}

/** Single-shot result for a generic-scope attribute (no sample loop). */
export interface GenericAttributeResult {
  result: AttrResult;
  evidenceIds: string[];
  notes: string;
  testedAt: string | null;
  testedBy: string | null;
}

export const ExecutionMode = { FULL_RUN: 'FULL_RUN', SAMPLING: 'SAMPLING' } as const;
export type ExecutionMode = typeof ExecutionMode[keyof typeof ExecutionMode];

export const SampleResult = { PENDING: 'PENDING', PASS: 'PASS', FAIL: 'FAIL' } as const;
export type SampleResult = typeof SampleResult[keyof typeof SampleResult];

export const AttrResult = { NOT_TESTED: 'NOT_TESTED', PASS: 'PASS', FAIL: 'FAIL' } as const;
export type AttrResult = typeof AttrResult[keyof typeof AttrResult];

export const AttrSource = { AUTO: 'AUTO', MANUAL: 'MANUAL' } as const;
export type AttrSource = typeof AttrSource[keyof typeof AttrSource];

export const ReviewStatus = { NOT_SUBMITTED: 'NOT_SUBMITTED', PENDING: 'PENDING', APPROVED: 'APPROVED', REJECTED: 'REJECTED' } as const;
export type ReviewStatus = typeof ReviewStatus[keyof typeof ReviewStatus];

export const ConclusionValue = { EFFECTIVE: 'EFFECTIVE', INEFFECTIVE: 'INEFFECTIVE' } as const;
export type ConclusionValue = typeof ConclusionValue[keyof typeof ConclusionValue];

export const WorkingPaperStatus = { NOT_GENERATED: 'NOT_GENERATED', DRAFT: 'DRAFT', GENERATED: 'GENERATED', FINAL: 'FINAL' } as const;
export type WorkingPaperStatus = typeof WorkingPaperStatus[keyof typeof WorkingPaperStatus];

export const EngagementStatus = { DRAFT: 'DRAFT', ACTIVE: 'ACTIVE', IN_REVIEW: 'IN_REVIEW', COMPLETED: 'COMPLETED' } as const;
export type EngagementStatus = typeof EngagementStatus[keyof typeof EngagementStatus];

export const WorkflowMappingStatus = { DRAFT: 'DRAFT', READY: 'READY', ACTIVE: 'ACTIVE' } as const;
export type WorkflowMappingStatus = typeof WorkflowMappingStatus[keyof typeof WorkflowMappingStatus];

// ─── Core Interfaces ──────────────────────────────────────────────────────

export interface Assertion {
  id: string;
  name: string;
}

export interface Attribute {
  id: string;
  name: string;
  description: string;
  assertionId: string;
  assertionName: string;
  /** Automation type — MANUAL = auditor evaluates, AUTOMATED = workflow evaluates. */
  type: AttributeType;
  /**
   * Sampling scope — SAMPLE_BASED means the attribute is checked against every sample
   * in the control's sample set. GENERIC means the attribute is a single control-level
   * check with one evidence upload + one Pass/Fail.
   */
  scope: AttrScope;
  required: boolean;
  requiredEvidenceTypes: string[];
  /**
   * Per-evidence-type guidance. Index-aligned with requiredEvidenceTypes.
   * Shown next to the upload control so the user knows what to attach.
   */
  evidenceDescriptions?: string[];
  workflowId?: string;
}

export interface WorkflowMapping {
  workflowId: string;
  workflowName: string;
  version: string;
  status: WorkflowMappingStatus;
  mappedAttributeIds: string[];
}

export interface PopulationSnapshot {
  id: string;
  source: string;
  rows: Record<string, unknown>[];
  rowCount: number;
  locked: boolean;
  lockedAt: string | null;
  checksum: string;
  testUnit: string;
}

export interface Evidence {
  id: string;
  fileName: string;
  evidenceType: string;
  mappedAttributeIds: string[];
  uploadedAt: string;
  uploadedBy: string;
}

export interface AttributeResult {
  attributeId: string;
  result: AttrResult;
  source: AttrSource;
  evidenceIds: string[];
  notes: string;
  testedAt: string | null;
  testedBy: string | null;
  /** Per-sample round history for this attribute. Latest round drives `result`. */
  rounds?: AttributeRoundSampleResult[];
}

/** A single sample's record inside an attribute's testing round. */
export interface AttributeRoundSampleResult {
  roundNumber: number;
  result: AttrResult;
  evidenceIds: string[];
  notes: string;
  testedAt: string | null;
  testedBy: string | null;
}

/**
 * Attribute-level round metadata (scoped to ExecutionControl, not TestItem).
 * Round 1 = initial full population. Round 2+ = retest of failed samples.
 */
export interface AttributeRound {
  roundNumber: number;
  /** Sample (test item) IDs included in this round */
  sampleIds: string[];
  /** ISO timestamp when the round was started */
  startedAt: string;
  /** ISO timestamp when the round was completed; null while in progress */
  completedAt: string | null;
  /** Optional override population reference. Null = inherits control population. */
  populationOverrideRef: string | null;
  /** Counts at completion (cached for header display). Zero if still active. */
  passCount: number;
  failCount: number;
  pendingCount: number;
}

export interface TestItem {
  id: string;
  referenceId: string;
  description: string;
  sourceRow: number | null;
  evidence: Evidence[];
  attributeResults: AttributeResult[];
  sampleResult: SampleResult;
}

export interface ReviewState {
  status: ReviewStatus;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewer: string;
  comments: string;
}

export interface Conclusion {
  value: ConclusionValue | null;
  reason: string;
  generatedAt: string | null;
}

export interface WorkingPaper {
  status: WorkingPaperStatus;
  generatedAt: string | null;
  finalDownloadEnabled: boolean;
}

export interface ControlExecutionState {
  status: ControlExecStatus;
  population: PopulationSnapshot | null;
  executionMode: ExecutionMode | null;
  testItems: TestItem[];
  review: ReviewState;
  workingPaper: WorkingPaper;
  conclusion: Conclusion;
  /** Per-attribute round metadata. Keyed by attributeId. SAMPLE_BASED attrs only. */
  attributeRounds?: Record<string, AttributeRound[]>;
  /** Control-level sampling config + generated sample item IDs. */
  sampling?: SamplingConfig | null;
  /** Workflows that validate uploaded evidence for this control. */
  validationWorkflows?: ValidationWorkflow[];
  /** Single-shot results for GENERIC-scope attributes. Keyed by attributeId. */
  genericResults?: Record<string, GenericAttributeResult>;
}

export interface ExecutionControl {
  id: string;
  name: string;
  description: string;
  process: string;
  owner: string;
  importanceClass: ImportanceClass;
  natureClass: NatureClass;
  automationClass: AutomationClass;
  assertions: Assertion[];
  attributes: Attribute[];
  workflowMappings: WorkflowMapping[];
  execution: ControlExecutionState;
}

export interface EngagementExecution {
  id: string;
  name: string;
  auditPeriodStart: string;
  auditPeriodEnd: string;
  framework: string;
  auditType: string;
  primaryProcess: string;
  owner: string;
  reviewer: string;
  status: EngagementStatus;
  controls: ExecutionControl[];
}
