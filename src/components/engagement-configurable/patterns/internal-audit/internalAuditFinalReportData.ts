// ─── Internal Audit Final Report — Types & Helpers ────────────────────────

export type ReportStatus = 'NOT_STARTED' | 'DRAFT' | 'READY_FOR_REVIEW' | 'ISSUED';
export type OverallRating = 'SATISFACTORY' | 'NEEDS_IMPROVEMENT' | 'UNSATISFACTORY' | 'NOT_APPLICABLE';

export interface ReportHistoryItem { id: string; action: string; actor: string; timestamp: string; comments: string }

export interface InternalAuditFinalReportState {
  status: ReportStatus;
  reportTitle: string;
  executiveSummary: string;
  overallRating: OverallRating;
  scopeAndObjective: string;
  proceduresPerformed: string;
  dataReviewed: string;
  conclusionRemarks: string;
  distributionList: string;
  reportDate: string;
  preparedBy: string;
  reviewedBy: string;
  issuedAt: string | null;
  issuedBy: string;
  initialized: boolean;
  history: ReportHistoryItem[];
}

export const DEFAULT_FINAL_REPORT: InternalAuditFinalReportState = {
  status: 'NOT_STARTED', reportTitle: '', executiveSummary: '', overallRating: 'NOT_APPLICABLE',
  scopeAndObjective: '', proceduresPerformed: '', dataReviewed: '', conclusionRemarks: '', distributionList: '',
  reportDate: '', preparedBy: '', reviewedBy: '', issuedAt: null, issuedBy: '', initialized: false, history: [],
};

export const RATING_LABELS: Record<OverallRating, string> = {
  SATISFACTORY: 'Satisfactory', NEEDS_IMPROVEMENT: 'Needs Improvement', UNSATISFACTORY: 'Unsatisfactory', NOT_APPLICABLE: 'Not Applicable',
};
export const RATING_CLS: Record<OverallRating, string> = {
  SATISFACTORY: 'bg-emerald-50 text-emerald-700 border-emerald-200', NEEDS_IMPROVEMENT: 'bg-amber-50 text-amber-700 border-amber-200',
  UNSATISFACTORY: 'bg-red-50 text-red-700 border-red-200', NOT_APPLICABLE: 'bg-gray-50 text-gray-600 border-gray-200',
};
export const REPORT_STATUS_CLS: Record<ReportStatus, string> = {
  NOT_STARTED: 'bg-gray-100 text-gray-600', DRAFT: 'bg-blue-50 text-blue-700', READY_FOR_REVIEW: 'bg-purple-50 text-purple-700', ISSUED: 'bg-emerald-50 text-emerald-700',
};

function now(): string { return new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }

// ─── Draft Generation ─────────────────────────────────────────────────────

import type { InternalAuditWorkspaceState } from './internalAuditScopeData';
import { BUSINESS_PROCESSES, SOPS, SCOPE_LEVEL_LABELS } from './internalAuditScopeData';
import type { ConfigurableEngagement, InternalAuditConfig } from '../../configurableEngagementTypes';

export function generateReportDraft(engagement: ConfigurableEngagement, iaState: InternalAuditWorkspaceState): Partial<InternalAuditFinalReportState> {
  const cfg = engagement.config as InternalAuditConfig;
  const { scope, requests, analysis, observations, discussion } = iaState;
  const bp = BUSINESS_PROCESSES.find(b => b.id === scope.businessProcessId);
  const activeObs = observations.observations.filter(o => o.status !== 'DROPPED');
  const agreedItems = discussion.items.filter(i => i.status === 'AGREED' || i.status === 'READY_FOR_REPORT');

  const reportTitle = `Internal Audit Report — ${engagement.name}`;
  const scopeText = `This assignment covered the ${bp ? bp.name : 'selected'} process at ${engagement.entityOrLocation || 'the designated entity'} for the period ${cfg.auditPeriodStart || '—'} to ${cfg.auditPeriodEnd || '—'}. Scope level: ${SCOPE_LEVEL_LABELS[scope.scopeLevel]?.label || scope.scopeLevel}.${scope.scopeObjective ? ` Objective: ${scope.scopeObjective}` : ''}`;

  const completedRuns = analysis.runs.filter(r => r.status === 'COMPLETED');
  const receivedFiles = requests.requests.filter(r => r.filesReceived.length > 0).flatMap(r => r.filesReceived);
  const proceduresText = completedRuns.length > 0
    ? `${completedRuns.length} analysis procedure(s) were performed including ${completedRuns.map(r => r.title).join(', ')}.`
    : 'Analysis procedures are pending.';
  const dataText = receivedFiles.length > 0 ? `${receivedFiles.length} document(s)/file(s) were reviewed: ${receivedFiles.join(', ')}.` : 'No data/documents were formally reviewed.';

  let execSummary: string;
  let rating: OverallRating;
  if (observations.noObservationsConfirmed) {
    execSummary = 'No audit observations were noted during this assignment. The processes and controls reviewed were found to be operating satisfactorily.';
    rating = 'SATISFACTORY';
  } else if (activeObs.length === 0) {
    execSummary = 'Observation formalization is pending.';
    rating = 'NOT_APPLICABLE';
  } else {
    const critical = activeObs.filter(o => o.severity === 'CRITICAL').length;
    const high = activeObs.filter(o => o.severity === 'HIGH').length;
    if (critical > 0 || high > 1) { rating = 'UNSATISFACTORY'; }
    else if (high > 0 || activeObs.some(o => o.severity === 'MEDIUM')) { rating = 'NEEDS_IMPROVEMENT'; }
    else { rating = 'SATISFACTORY'; }
    execSummary = `${activeObs.length} observation(s) were identified (${critical} critical, ${high} high). ${agreedItems.length} have agreed management actions. Overall rating: ${RATING_LABELS[rating]}.`;
  }

  const conclusionText = observations.noObservationsConfirmed
    ? 'Based on the audit procedures performed, no significant issues were identified. The assignment is recommended for closure.'
    : `Based on ${activeObs.length} observation(s), the overall audit rating is ${RATING_LABELS[rating]}. Management has been consulted and ${agreedItems.length} action(s) have been agreed.`;

  return {
    reportTitle, executiveSummary: execSummary, overallRating: rating,
    scopeAndObjective: scopeText, proceduresPerformed: proceduresText, dataReviewed: dataText,
    conclusionRemarks: conclusionText, preparedBy: engagement.owner, reviewedBy: engagement.reviewer || '',
    reportDate: new Date().toISOString().slice(0, 10), distributionList: `${cfg.processOwner || ''}, ${engagement.reviewer || ''}`,
    initialized: true,
    history: [{ id: `rh-${Date.now()}`, action: 'DRAFT_GENERATED', actor: engagement.owner, timestamp: now(), comments: 'Auto-generated from working paper.' }],
  };
}

export function deriveFinalReportReadiness(iaState: InternalAuditWorkspaceState, engagement: ConfigurableEngagement): { ready: boolean; checks: { label: string; ok: boolean }[] } {
  const cfg = engagement.config as InternalAuditConfig;
  const scopeReady = !!iaState.scope.businessProcessId && !!iaState.scope.scopeObjective;
  const annDone = iaState.announcement.status === 'SENT' || iaState.announcement.status === 'ACKNOWLEDGED';
  const idrDone = iaState.requests.requests.some(r => r.status === 'RECEIVED' || r.status === 'PARTIALLY_RECEIVED') || iaState.requests.proceedWithoutIDR;
  const analysisDone = iaState.analysis.runs.some(r => r.status === 'COMPLETED');
  const obsDone = iaState.observations.observations.length > 0 || iaState.observations.noObservationsConfirmed;
  const discDone = iaState.discussion.items.every(i => i.status === 'READY_FOR_REPORT') || iaState.discussion.noObsDiscussionConfirmed || (iaState.observations.noObservationsConfirmed && iaState.discussion.items.length === 0);

  const checks = [
    { label: 'Scope ready', ok: scopeReady },
    { label: 'Announcement sent', ok: annDone },
    { label: 'IDR received or documented', ok: idrDone },
    { label: 'Analysis completed', ok: analysisDone },
    { label: 'Observations completed', ok: obsDone },
    { label: 'Discussion completed', ok: discDone },
  ];
  return { ready: checks.every(c => c.ok), checks };
}
