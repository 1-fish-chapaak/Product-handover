// ─── Automation Setup — Types & Helpers ────────────────────────────────────

export type SetupMode = 'SELECT_EXISTING_WORKFLOW' | 'CREATE_NEW_WORKFLOW' | 'QA_ADHOC_ANALYSIS' | 'UPLOAD_DATA_FIRST_DECIDE_LATER';
export type SetupStatus = 'NOT_CONFIGURED' | 'DRAFT' | 'NEEDS_INPUT' | 'NEEDS_WORKFLOW' | 'READY_FOR_RUN';
export type TriggerType = 'MANUAL' | 'SCHEDULED' | 'EVENT_BASED';
export type StepType = 'DATA_VALIDATION' | 'RECONCILIATION' | 'DOCUMENT_EXTRACTION' | 'EXCEPTION_DETECTION' | 'REPORT_GENERATION' | 'CASE_CREATION' | 'OTHER';

export interface DraftWorkflowStep {
  id: string; order: number; stepType: StepType; name: string; description: string; inputSourceIds: string[]; outputName: string;
}
export interface DraftWorkflow {
  id: string; name: string; description: string; triggerType: TriggerType; steps: DraftWorkflowStep[]; status: 'DRAFT' | 'READY';
}
export interface QASetup {
  id: string; objective: string; questions: string[]; selectedSourceIds: string[]; expectedOutputs: string[]; status: 'DRAFT' | 'READY';
}
export interface SetupHistoryItem { id: string; action: string; actor: string; timestamp: string; comments: string }

export type ProjectWorkflowStatus = 'DRAFT' | 'SAVED';

export interface ProjectCreatedWorkflow {
  id: string;
  name: string;
  description: string;
  objective: string;
  status: ProjectWorkflowStatus;
  createdAt: string;
  createdBy: string;
  source: 'PROJECT_BUILDER';
  linkedDataSourceIds: string[];
  linkedDataSourceNames: string[];
  builderPrompt: string;
  steps: DraftWorkflowStep[];
}

export interface AutomationSetupState {
  setupMode: SetupMode;
  selectedWorkflowId: string; // backward compat — derived from selectedWorkflowIds[0]
  selectedWorkflowName: string; // backward compat
  selectedWorkflowIds: string[];
  selectedWorkflowNames: string[];
  draftWorkflow: DraftWorkflow | null;
  qaSetup: QASetup | null;
  createdWorkflows: ProjectCreatedWorkflow[];
  setupStatus: SetupStatus;
  setupNotes: string;
  history: SetupHistoryItem[];
}

export const SETUP_MODE_LABELS: Record<SetupMode, string> = {
  SELECT_EXISTING_WORKFLOW: 'Use Existing Workflow', CREATE_NEW_WORKFLOW: 'Build New Workflow',
  QA_ADHOC_ANALYSIS: 'Ask Questions / Ad-hoc Analysis', UPLOAD_DATA_FIRST_DECIDE_LATER: 'Upload Data First, Decide Later',
};
export const SETUP_STATUS_CLS: Record<SetupStatus, string> = {
  NOT_CONFIGURED: 'bg-gray-100 text-gray-600', DRAFT: 'bg-blue-50 text-blue-700', NEEDS_INPUT: 'bg-amber-50 text-amber-700',
  NEEDS_WORKFLOW: 'bg-amber-50 text-amber-700', READY_FOR_RUN: 'bg-emerald-50 text-emerald-700',
};
export const STEP_TYPES: StepType[] = ['DATA_VALIDATION', 'RECONCILIATION', 'DOCUMENT_EXTRACTION', 'EXCEPTION_DETECTION', 'REPORT_GENERATION', 'CASE_CREATION', 'OTHER'];
export const STEP_TYPE_LABELS: Record<StepType, string> = {
  DATA_VALIDATION: 'Data Validation', RECONCILIATION: 'Reconciliation', DOCUMENT_EXTRACTION: 'Document Extraction',
  EXCEPTION_DETECTION: 'Exception Detection', REPORT_GENERATION: 'Report Generation', CASE_CREATION: 'Case Creation', OTHER: 'Other',
};

// ─── Mock Workflow Library ────────────────────────────────────────────────

export interface MockWorkflow { id: string; name: string; description: string; compatibleTypes: string[]; steps: string[]; status: 'Active' | 'Draft' }

export const MOCK_WORKFLOWS: MockWorkflow[] = [
  { id: 'mwf-1', name: 'Vendor Reconciliation Workflow', description: 'Match vendor ledger to payments, detect unmatched records, generate exceptions.', compatibleTypes: ['EXCEL_CSV', 'SQL', 'HYBRID'], steps: ['Match vendor ledger to payments', 'Detect unmatched records', 'Generate exception output'], status: 'Active' },
  { id: 'mwf-2', name: 'Expense Validation Workflow', description: 'Validate expenses against policy, detect duplicates, classify exceptions.', compatibleTypes: ['EXCEL_CSV', 'PDF'], steps: ['Validate against policy', 'Detect duplicates', 'Classify exceptions'], status: 'Active' },
  { id: 'mwf-3', name: 'FOP Reconciliation Workflow', description: 'Reconcile FOP data from multiple sources.', compatibleTypes: ['EXCEL_CSV', 'SQL'], steps: ['Import FOP data', 'Match records', 'Generate reconciliation report'], status: 'Active' },
  { id: 'mwf-4', name: 'Image Analytics Review Workflow', description: 'Analyze asset images for verification.', compatibleTypes: ['IMAGE'], steps: ['Extract image metadata', 'Run image analysis', 'Flag anomalies'], status: 'Draft' },
  { id: 'mwf-5', name: 'MIS Report Builder', description: 'Build management information reports from structured data.', compatibleTypes: ['SQL', 'EXCEL_CSV'], steps: ['Aggregate data', 'Apply report template', 'Generate output'], status: 'Active' },
];

export const SUGGESTED_STEPS: Omit<DraftWorkflowStep, 'id'>[] = [
  { order: 1, stepType: 'DATA_VALIDATION', name: 'Validate input schema', description: 'Check data format and required fields.', inputSourceIds: [], outputName: 'validation_report' },
  { order: 2, stepType: 'RECONCILIATION', name: 'Match vendor ledger with payment extract', description: 'Key-based matching on vendor ID + invoice number.', inputSourceIds: [], outputName: 'matched_records' },
  { order: 3, stepType: 'EXCEPTION_DETECTION', name: 'Identify unmatched records', description: 'Flag records without a match.', inputSourceIds: [], outputName: 'unmatched_exceptions' },
  { order: 4, stepType: 'REPORT_GENERATION', name: 'Create exception output', description: 'Generate exception report with details.', inputSourceIds: [], outputName: 'exception_report' },
  { order: 5, stepType: 'REPORT_GENERATION', name: 'Generate reconciliation report', description: 'Final summary report.', inputSourceIds: [], outputName: 'reconciliation_report' },
];

export const SUGGESTED_QUESTIONS = [
  'Find unmatched vendor payments.',
  'Identify duplicate invoices.',
  'Find claims without supporting documents.',
  'Summarize exceptions by vendor and amount.',
  'Identify policy violations.',
];

export const EXPECTED_OUTPUTS = ['Summary Report', 'Exception List', 'Reconciliation Output', 'Case Candidates', 'Dashboard Metrics'];

// ─── Readiness ────────────────────────────────────────────────────────────

import type { AutomationInputDataState } from './automationInputData';
import type { AutomationProjectConfig } from '../../configurableEngagementTypes';

export function deriveSetupReadiness(inputData: AutomationInputDataState, setup: AutomationSetupState, config: AutomationProjectConfig): { status: SetupStatus; checks: { label: string; ok: boolean }[] } {
  const hasInput = inputData.dataSources.some(d => inputData.selectedSourceIds.includes(d.id) && (d.status === 'READY' || d.status === 'CONNECTED')) || inputData.proceedWithoutData;
  const isRecurring = config.runType === 'RECURRING';

  const checks = [
    { label: 'Automation approach selected', ok: setup.setupMode !== 'UPLOAD_DATA_FIRST_DECIDE_LATER' },
    { label: 'Input data selected or intentionally skipped', ok: hasInput },
  ];

  if (setup.setupMode === 'SELECT_EXISTING_WORKFLOW') {
    const wfIds = setup.selectedWorkflowIds?.length > 0 ? setup.selectedWorkflowIds : (setup.selectedWorkflowId ? [setup.selectedWorkflowId] : []);
    checks.push({ label: `${wfIds.length} workflow${wfIds.length !== 1 ? 's' : ''} selected`, ok: wfIds.length > 0 });
  } else if (setup.setupMode === 'CREATE_NEW_WORKFLOW') {
    const savedCreated = (setup.createdWorkflows || []).filter(w => w.status === 'SAVED');
    const selectedCreated = savedCreated.filter(w => (setup.selectedWorkflowIds || []).includes(w.id));
    checks.push({ label: `${savedCreated.length} workflow${savedCreated.length !== 1 ? 's' : ''} built and saved`, ok: savedCreated.length > 0 });
    checks.push({ label: `${selectedCreated.length} built workflow${selectedCreated.length !== 1 ? 's' : ''} selected for run`, ok: selectedCreated.length > 0 });
  } else if (setup.setupMode === 'QA_ADHOC_ANALYSIS') {
    checks.push({ label: 'Q&A setup ready', ok: setup.qaSetup?.status === 'READY' });
  }

  if (isRecurring) {
    const hasExistingWf = setup.selectedWorkflowIds?.length > 0 || !!setup.selectedWorkflowId;
    const hasSavedCreatedWf = (setup.createdWorkflows || []).some(w => w.status === 'SAVED' && (setup.selectedWorkflowIds || []).includes(w.id));
    const hasDraftReady = setup.draftWorkflow?.status === 'READY';
    const hasWorkflow = setup.setupMode === 'SELECT_EXISTING_WORKFLOW' ? hasExistingWf : setup.setupMode === 'CREATE_NEW_WORKFLOW' ? hasSavedCreatedWf : hasDraftReady;
    checks.push({ label: 'Recurring automation has at least one saved workflow', ok: !!hasWorkflow });
  }

  checks.push({ label: 'Output types selected', ok: config.outputTypes.length > 0 });

  const allOk = checks.every(c => c.ok);
  let status: SetupStatus;
  if (setup.setupMode === 'UPLOAD_DATA_FIRST_DECIDE_LATER') status = 'NOT_CONFIGURED';
  else if (!hasInput && !inputData.proceedWithoutData) status = 'NEEDS_INPUT';
  else if (allOk) status = 'READY_FOR_RUN';
  else if (setup.setupMode === 'CREATE_NEW_WORKFLOW' && (setup.createdWorkflows || []).filter(w => w.status === 'SAVED').length === 0) status = 'NEEDS_WORKFLOW';
  else status = 'DRAFT';

  return { status, checks };
}
