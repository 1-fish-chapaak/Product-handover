export interface EditClarificationStep {
  id: string;
  question: string;
  options: string[];
  shortLabel: string;
}

export interface PlanStep {
  name: string;
  badge: 'INGESTION' | 'COMPARISON' | 'VALIDATION' | 'FLAGGING' | 'ANALYSIS' | 'SUMMARY' | 'CALCULATION';
}

export interface WorkflowPlanCard {
  totalSteps: number;
  durationLabel: string;
  steps: PlanStep[];
  outputLabel: string;
  outputRows: string;
}

export interface EditChatMessage {
  id: string;
  role: 'user' | 'ira';
  text?: string;
  // Optional rich blocks
  linkedSources?: { source: string; target: string }[];
  mappings?: { name: string; from: string; cols: string[]; ofTotal: number }[];
  workflowPlan?: WorkflowPlanCard;
  showConfirmProceed?: boolean;
  showViewWorkspace?: boolean;
  showValidateWorkflow?: boolean;
  showViewPreview?: boolean;
  // When true, render the AI Summary + Key Observations block (mirrors the
  // builder's StepOutputView) inline as part of this IRA bubble.
  outputSummary?: boolean;
}

export interface ValidateClarifyQuestion {
  id: string;
  title: string;
  options: string[];
}

export interface InlineClarifyState {
  questions: ValidateClarifyQuestion[];
  index: number;
  stepLabel: string;
}

export type EditWorkspaceTab = 'input' | 'plan' | 'output' | 'preview';
