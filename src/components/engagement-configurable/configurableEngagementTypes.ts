// ─── Configurable Engagement V3 — Core Types ─────────────────────────────
// Pattern-driven engagement platform types.
// See docs/CONFIGURABLE_ENGAGEMENT_V3_MEMORY.md for product rules.

// ─── Pattern Type ─────────────────────────────────────────────────────────

export const EngagementPatternType = {
  COMPLIANCE_CONTROL_TESTING: 'compliance_control_testing',
  INTERNAL_AUDIT_ASSIGNMENT: 'internal_audit_assignment',
  WORKFLOW_AUTOMATION_PROJECT: 'workflow_automation_project',
} as const;
export type EngagementPatternType = (typeof EngagementPatternType)[keyof typeof EngagementPatternType];

export const PATTERN_DISPLAY_LABELS: Record<EngagementPatternType, string> = {
  compliance_control_testing: 'Engagement',
  internal_audit_assignment: 'Audit Assignment',
  workflow_automation_project: 'Project',
};

// ─── Common Status ────────────────────────────────────────────────────────

export const EngagementStatus = {
  DRAFT: 'DRAFT',
  PLANNED: 'PLANNED',
  ACTIVE: 'ACTIVE',
  IN_PROGRESS: 'IN_PROGRESS',
  PENDING_REVIEW: 'PENDING_REVIEW',
  COMPLETED: 'COMPLETED',
  CLOSED: 'CLOSED',
  ON_HOLD: 'ON_HOLD',
} as const;
export type EngagementStatus = (typeof EngagementStatus)[keyof typeof EngagementStatus];

// ─── Compliance Enums ─────────────────────────────────────────────────────

export const ComplianceFramework = {
  SOX_ICFR: 'SOX_ICFR',
  IFC: 'IFC',
  ICOFR: 'ICOFR',
  SOC1: 'SOC1',
  SOC2: 'SOC2',
  GDPR: 'GDPR',
  CUSTOM: 'CUSTOM',
} as const;
export type ComplianceFramework = (typeof ComplianceFramework)[keyof typeof ComplianceFramework];

export const ControlScopeSource = {
  RACM_VERSION: 'RACM_VERSION',
  SELECTED_CONTROLS: 'SELECTED_CONTROLS',
  IMPORTED_CONTROLS: 'IMPORTED_CONTROLS',
  MANUAL_CONTROLS: 'MANUAL_CONTROLS',
} as const;
export type ControlScopeSource = (typeof ControlScopeSource)[keyof typeof ControlScopeSource];

export const TestingInputMethod = {
  UPLOAD_SELECTED_SAMPLES: 'UPLOAD_SELECTED_SAMPLES',
  GENERATE_SAMPLES_FROM_POPULATION: 'GENERATE_SAMPLES_FROM_POPULATION',
  TEST_FULL_POPULATION: 'TEST_FULL_POPULATION',
  DOCUMENT_BASED_TESTING: 'DOCUMENT_BASED_TESTING',
  NO_SAMPLE_BASED_TESTING: 'NO_SAMPLE_BASED_TESTING',
} as const;
export type TestingInputMethod = (typeof TestingInputMethod)[keyof typeof TestingInputMethod];

// ─── Internal Audit Enums ─────────────────────────────────────────────────

export const AuditScopeLevel = {
  PROCESS: 'PROCESS',
  SUB_PROCESS: 'SUB_PROCESS',
  ACTIVITY: 'ACTIVITY',
  SPECIFIC_ELEMENT: 'SPECIFIC_ELEMENT',
} as const;
export type AuditScopeLevel = (typeof AuditScopeLevel)[keyof typeof AuditScopeLevel];

// ─── Automation Project Enums ─────────────────────────────────────────────

export const AutomationInputType = {
  EXCEL_CSV: 'EXCEL_CSV',
  PDF: 'PDF',
  SQL: 'SQL',
  IMAGE: 'IMAGE',
  HYBRID: 'HYBRID',
} as const;
export type AutomationInputType = (typeof AutomationInputType)[keyof typeof AutomationInputType];

export const AutomationSetupMode = {
  SELECT_EXISTING_WORKFLOW: 'SELECT_EXISTING_WORKFLOW',
  CREATE_NEW_WORKFLOW: 'CREATE_NEW_WORKFLOW',
  QA_ADHOC_ANALYSIS: 'QA_ADHOC_ANALYSIS',
  UPLOAD_DATA_FIRST_DECIDE_LATER: 'UPLOAD_DATA_FIRST_DECIDE_LATER',
} as const;
export type AutomationSetupMode = (typeof AutomationSetupMode)[keyof typeof AutomationSetupMode];

export const AutomationOutputType = {
  REPORT: 'REPORT',
  EMAIL: 'EMAIL',
  DASHBOARD: 'DASHBOARD',
  CASE_MANAGEMENT: 'CASE_MANAGEMENT',
  DOWNLOADABLE_FILE: 'DOWNLOADABLE_FILE',
} as const;
export type AutomationOutputType = (typeof AutomationOutputType)[keyof typeof AutomationOutputType];

export const RunType = {
  AD_HOC: 'AD_HOC',
  ONE_TIME: 'ONE_TIME',
  RECURRING: 'RECURRING',
} as const;
export type RunType = (typeof RunType)[keyof typeof RunType];

export const RunFrequency = {
  DAILY: 'DAILY',
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY',
  QUARTERLY: 'QUARTERLY',
  CUSTOM: 'CUSTOM',
} as const;
export type RunFrequency = (typeof RunFrequency)[keyof typeof RunFrequency];

// ─── Pattern-Specific Configs ─────────────────────────────────────────────

export interface ComplianceConfig {
  patternType: typeof EngagementPatternType.COMPLIANCE_CONTROL_TESTING;
  framework: ComplianceFramework;
  auditType: string;
  auditPeriodStart: string;
  auditPeriodEnd: string;
  controlScopeSource: ControlScopeSource;
  racmVersionId?: string;
  selectedControlIds?: string[];
  importBatchId?: string;
  defaultTestingInputMethod: TestingInputMethod;
  allowControlLevelOverride: boolean;
  reviewerRequired: boolean;
  requestPbcEnabled: boolean;
}

export interface InternalAuditConfig {
  patternType: typeof EngagementPatternType.INTERNAL_AUDIT_ASSIGNMENT;
  auditPeriodStart: string;
  auditPeriodEnd: string;
  scopeLevel: AuditScopeLevel;
  businessProcessId?: string;
  subProcessId?: string;
  sopIds?: string[];
  racmVersionId?: string;
  checklistId?: string;
  processOwner: string;
  idrEnabled: boolean;
  announcementRequired: boolean;
  finalReportRequired: boolean;
  actionTrackingEnabled: boolean;
}

export interface AutomationProjectConfig {
  patternType: typeof EngagementPatternType.WORKFLOW_AUTOMATION_PROJECT;
  inputType: AutomationInputType;
  automationSetupMode: AutomationSetupMode;
  workflowIds?: string[];
  outputTypes: AutomationOutputType[];
  reportRequired: boolean;
  reviewRequired: boolean;
  caseCreationEnabled: boolean;
  runType: RunType;
  frequency?: RunFrequency;
  racmReferenceId?: string;
  controlReferenceIds?: string[];
}

export type EngagementConfig = ComplianceConfig | InternalAuditConfig | AutomationProjectConfig;

// ─── Engagement Output ────────────────────────────────────────────────────

export interface EngagementOutput {
  id: string;
  type: string;
  label: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETE' | 'NOT_APPLICABLE';
  generatedAt?: string;
  fileUrl?: string;
}

// ─── Main Engagement Object ──────────────────────────────────────────────

export interface ConfigurableEngagement {
  id: string;
  name: string;
  patternType: EngagementPatternType;
  displayLabel: string;
  description: string;
  owner: string;
  reviewer?: string;
  businessProcess?: string;
  entityOrLocation?: string;
  status: EngagementStatus;
  stage: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  dataPeriodStart?: string;
  dataPeriodEnd?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  config: EngagementConfig;
  outputs: EngagementOutput[];
  createdAt: string;
  updatedAt: string;
}

// ─── Validation ───────────────────────────────────────────────────────────

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}
