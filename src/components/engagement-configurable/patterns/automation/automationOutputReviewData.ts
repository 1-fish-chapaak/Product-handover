// ─── Automation Output Review — Types & Helpers ───────────────────────────

export type OutputReviewStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'READY_FOR_CASES' | 'READY_FOR_REPORTS' | 'COMPLETED';

export interface OutputReviewHistoryItem { id: string; action: string; actor: string; timestamp: string; comments: string }

export interface AutomationOutputReviewState {
  reviewedOutputIds: string[];
  approvedOutputIds: string[];
  rejectedOutputIds: string[];
  outputComments: Record<string, string>;
  reviewNotes: string;
  history: OutputReviewHistoryItem[];
}

import type { AutomationRunsState } from './automationRunsData';
import type { AutomationProjectConfig } from '../../configurableEngagementTypes';

export function deriveOutputReviewStatus(runs: AutomationRunsState, review: AutomationOutputReviewState, config: AutomationProjectConfig): OutputReviewStatus {
  const completedRuns = runs.runs.filter(r => r.status === 'COMPLETED');
  if (completedRuns.length === 0) return 'NOT_STARTED';

  const allOutputs = completedRuns.flatMap(r => r.outputs);
  const allExceptions = completedRuns.flatMap(r => r.exceptions);
  const reviewed = review.reviewedOutputIds.length + review.approvedOutputIds.length + review.rejectedOutputIds.length;

  if (reviewed === 0) return 'NOT_STARTED';

  const hasCaseManagement = config.outputTypes.includes('CASE_MANAGEMENT');
  const hasReport = config.outputTypes.includes('REPORT');
  const caseCandidates = allExceptions.filter(e => e.status === 'CASE_CANDIDATE').length;
  const approvedOutputs = review.approvedOutputIds.length;
  const openExceptions = allExceptions.filter(e => e.status === 'OPEN').length;

  if (reviewed >= allOutputs.length && openExceptions === 0) return 'COMPLETED';
  if (hasCaseManagement && caseCandidates > 0) return 'READY_FOR_CASES';
  if (hasReport && approvedOutputs > 0) return 'READY_FOR_REPORTS';
  return 'IN_PROGRESS';
}

export function deriveOutputReviewSummary(runs: AutomationRunsState, review: AutomationOutputReviewState, config: AutomationProjectConfig) {
  const completedRuns = runs.runs.filter(r => r.status === 'COMPLETED');
  const allOutputs = completedRuns.flatMap(r => r.outputs);
  const allExceptions = completedRuns.flatMap(r => r.exceptions);
  return {
    completedRuns: completedRuns.length,
    totalOutputs: allOutputs.length,
    reviewed: review.reviewedOutputIds.length + review.approvedOutputIds.length + review.rejectedOutputIds.length,
    approved: review.approvedOutputIds.length,
    openExceptions: allExceptions.filter(e => e.status === 'OPEN').length,
    caseCandidates: allExceptions.filter(e => e.status === 'CASE_CANDIDATE').length,
    reportReady: config.outputTypes.includes('REPORT') && review.approvedOutputIds.length > 0,
  };
}

export const REVIEW_STATUS_CLS: Record<OutputReviewStatus, string> = {
  NOT_STARTED: 'bg-gray-100 text-gray-600', IN_PROGRESS: 'bg-blue-50 text-blue-700',
  READY_FOR_CASES: 'bg-purple-50 text-purple-700', READY_FOR_REPORTS: 'bg-emerald-50 text-emerald-700',
  COMPLETED: 'bg-emerald-50 text-emerald-700',
};
