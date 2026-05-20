// ─── Automation Schedule — Types & Helpers ─────────────────────────────────

export type ScheduleStatus = 'NOT_REQUIRED' | 'NOT_CONFIGURED' | 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'DISABLED';

export interface ScheduleHistoryItem { id: string; action: string; actor: string; timestamp: string; comments: string }

export interface AutomationScheduleState {
  status: ScheduleStatus;
  frequency: string;
  startDate: string;
  endDate: string;
  runTime: string;
  timezone: string;
  selectedWorkflowId: string;
  selectedInputSourceIds: string[];
  notificationRecipients: string;
  failureNotificationRecipients: string;
  autoCreateCases: boolean;
  autoGenerateReport: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  scheduleNotes: string;
  history: ScheduleHistoryItem[];
}

export const SCHEDULE_STATUS_CLS: Record<ScheduleStatus, string> = {
  NOT_REQUIRED: 'bg-gray-100 text-gray-600', NOT_CONFIGURED: 'bg-gray-100 text-gray-600',
  DRAFT: 'bg-blue-50 text-blue-700', ACTIVE: 'bg-emerald-50 text-emerald-700',
  PAUSED: 'bg-amber-50 text-amber-700', DISABLED: 'bg-gray-50 text-gray-400',
};

// ─── Helpers ──────────────────────────────────────────────────────────────

import type { AutomationProjectWorkspaceState } from './automationInputData';
import type { AutomationProjectConfig } from '../../configurableEngagementTypes';

export function deriveScheduleRequirement(cfg: AutomationProjectConfig, state: AutomationProjectWorkspaceState) {
  const isRecurring = cfg.runType === 'RECURRING';
  if (!isRecurring) return { required: false, canSchedule: false, blockingReasons: [] as string[], warnings: [] as string[] };

  const blockingReasons: string[] = [];
  const warnings: string[] = [];

  const hasExistingWf = (state.setup.selectedWorkflowIds?.length > 0) || !!state.setup.selectedWorkflowId;
  const hasCreatedWf = (state.setup.createdWorkflows || []).some(w => w.status === 'SAVED' && (state.setup.selectedWorkflowIds || []).includes(w.id));
  const hasDraftReady = state.setup.draftWorkflow?.status === 'READY';
  const hasWorkflow = state.setup.setupMode === 'SELECT_EXISTING_WORKFLOW' ? hasExistingWf : state.setup.setupMode === 'CREATE_NEW_WORKFLOW' ? hasCreatedWf : hasDraftReady;
  if (!hasWorkflow) blockingReasons.push('Saved or ready workflow is required for recurring automation.');
  if (state.setup.setupMode === 'QA_ADHOC_ANALYSIS' && !state.setup.draftWorkflow) blockingReasons.push('Q&A/ad-hoc setup alone cannot be scheduled. Convert to a saved workflow.');

  const hasInput = state.inputData.dataSources.some(d => state.inputData.selectedSourceIds.includes(d.id)) || state.inputData.proceedWithoutData;
  if (!hasInput) blockingReasons.push('Input data must be selected or proceed-without-data accepted.');

  const hasReport = cfg.outputTypes.includes('REPORT');
  if (hasReport && !state.reports.reports.some(r => r.status === 'FINAL')) warnings.push('Report output selected but no final report exists. Recommended before scheduling.');

  return { required: true, canSchedule: blockingReasons.length === 0, blockingReasons, warnings };
}

export function calculateNextRun(startDate: string, frequency: string, runTime: string): string | null {
  if (!startDate || !runTime) return null;
  const start = new Date(startDate + 'T' + runTime);
  const now = new Date();
  let next = new Date(start);
  if (next <= now) {
    const diffDays = Math.ceil((now.getTime() - next.getTime()) / (1000 * 60 * 60 * 24));
    if (frequency === 'DAILY') next.setDate(next.getDate() + diffDays + 1);
    else if (frequency === 'WEEKLY') next.setDate(next.getDate() + Math.ceil(diffDays / 7) * 7);
    else if (frequency === 'MONTHLY') next.setMonth(next.getMonth() + Math.ceil(diffDays / 30));
    else if (frequency === 'QUARTERLY') next.setMonth(next.getMonth() + Math.ceil(diffDays / 90) * 3);
    else next.setDate(next.getDate() + diffDays + 1);
  }
  return next.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
