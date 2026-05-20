// ─── Automation Reports — Types & Helpers ──────────────────────────────────

export type ReportStatus = 'NOT_STARTED' | 'DRAFT' | 'READY' | 'FINAL';

export interface ReportHistoryItem { id: string; action: string; actor: string; timestamp: string; comments: string }

export interface AutomationReport {
  id: string; title: string; status: ReportStatus;
  generatedFromRunIds: string[]; includedOutputIds: string[]; includedCaseIds: string[];
  executiveSummary: string; projectObjective: string; inputSummary: string;
  automationSummary: string; runSummary: string; exceptionSummary: string;
  caseSummary: string; keyMetrics: string; recommendations: string; distributionList: string;
  generatedAt: string; finalizedAt: string | null; finalizedBy: string;
  history: ReportHistoryItem[];
}

export interface AutomationReportsState {
  reports: AutomationReport[];
  reportNotes: string;
}

export const REPORT_STATUS_CLS: Record<ReportStatus, string> = {
  NOT_STARTED: 'bg-gray-100 text-gray-600', DRAFT: 'bg-blue-50 text-blue-700', READY: 'bg-purple-50 text-purple-700', FINAL: 'bg-emerald-50 text-emerald-700',
};

// ─── Report Generation ────────────────────────────────────────────────────

import type { AutomationProjectWorkspaceState } from './automationInputData';
import type { ConfigurableEngagement, AutomationProjectConfig } from '../../configurableEngagementTypes';
import { SOURCE_TYPE_LABELS } from './automationInputData';
import { SETUP_MODE_LABELS } from './automationSetupData';
import { EX_CAT_LABELS } from './automationRunsData';

function now(): string { return new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }

export function generateDraftReport(engagement: ConfigurableEngagement, state: AutomationProjectWorkspaceState): Partial<AutomationReport> {
  const cfg = engagement.config as AutomationProjectConfig;
  const { inputData, setup, runs, outputReview, cases } = state;
  const completedRuns = runs.runs.filter(r => r.status === 'COMPLETED');
  const allOutputs = completedRuns.flatMap(r => r.outputs);
  const allExceptions = completedRuns.flatMap(r => r.exceptions);
  const approvedIds = outputReview.approvedOutputIds;
  const totalRecords = completedRuns.reduce((s, r) => s + r.processedRecords, 0);

  const title = `${engagement.name} — Automation Output Report`;
  const projectObjective = engagement.description;

  const selectedSources = inputData.dataSources.filter(d => inputData.selectedSourceIds.includes(d.id));
  const inputSummaryText = selectedSources.length > 0
    ? selectedSources.map(d => `${d.name} (${SOURCE_TYPE_LABELS[d.sourceType]}, ${d.recordCount || d.pageCount || d.imageCount || 0} items)`).join('\n')
    : 'No input data sources selected.';

  const wfNames = setup.selectedWorkflowNames?.length ? setup.selectedWorkflowNames : (setup.selectedWorkflowName ? [setup.selectedWorkflowName] : []);
  const createdNames = (setup.createdWorkflows || []).filter(w => w.status === 'SAVED' && wfNames.includes(w.name)).map(w => `${w.name} (Created in Project)`);
  const wfSummary = wfNames.length > 1 ? `Workflows (${wfNames.length}): ${wfNames.join(', ')}.` : wfNames.length === 1 ? `Workflow: ${wfNames[0]}.` : setup.draftWorkflow?.name ? `Draft workflow: ${setup.draftWorkflow.name}.` : setup.qaSetup?.objective ? `Q&A objective: ${setup.qaSetup.objective}.` : '';
  const createdNote = createdNames.length > 0 ? `\nProject-created: ${createdNames.join(', ')}.` : '';
  const automationSummaryText = `Setup mode: ${SETUP_MODE_LABELS[setup.setupMode]}.\n${wfSummary}${createdNote}`;

  const runSummaryText = completedRuns.length > 0
    ? completedRuns.map(r => `${r.runName}: ${r.processedRecords} records, ${r.exceptionCount} exceptions, ${r.outputCount} outputs. Completed ${r.completedAt}.`).join('\n')
    : 'No completed runs.';

  const openEx = allExceptions.filter(e => e.status === 'OPEN').length;
  const reviewedEx = allExceptions.filter(e => e.status === 'REVIEWED').length;
  const dismissedEx = allExceptions.filter(e => e.status === 'DISMISSED').length;
  const caseEx = allExceptions.filter(e => e.status === 'CASE_CANDIDATE').length;
  // Deficiency breakdown from case candidates
  const candidateExceptions = allExceptions.filter(e => e.status === 'CASE_CANDIDATE');
  const defBreakdown = candidateExceptions.reduce<Record<string, number>>((acc, e) => { const t = e.deficiencyType || 'Unclassified'; acc[t] = (acc[t] || 0) + 1; return acc; }, {});
  const defBreakdownText = Object.entries(defBreakdown).map(([k, v]) => `${v} ${k.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}`).join(', ');
  const exceptionSummaryText = `Total: ${allExceptions.length}. Open: ${openEx}. Reviewed: ${reviewedEx}. Dismissed: ${dismissedEx}. Case candidates: ${caseEx}.${defBreakdownText ? `\nDeficiency breakdown: ${defBreakdownText}.` : ''}`;

  // Case and remediation summary
  const remNotStarted = cases.cases.filter(c => !c.remediationStatus || c.remediationStatus === 'NOT_STARTED').length;
  const remInProgress = cases.cases.filter(c => c.remediationStatus === 'IN_PROGRESS').length;
  const remSubmitted = cases.cases.filter(c => c.remediationStatus === 'SUBMITTED').length;
  const remAccepted = cases.cases.filter(c => c.remediationStatus === 'ACCEPTED').length;
  const remRejected = cases.cases.filter(c => c.remediationStatus === 'REJECTED').length;
  const sentToOwner = cases.cases.filter(c => c.status === 'OPEN').length;
  const withOwner = cases.cases.filter(c => c.status === 'IN_PROGRESS').length;
  const submittedForReview = cases.cases.filter(c => c.status === 'RESOLVED').length;
  const acceptedClosed = cases.cases.filter(c => c.status === 'CLOSED').length;
  const rejectedBack = cases.cases.filter(c => c.remediationStatus === 'REJECTED').length;
  const caseSummaryText = cases.cases.length > 0
    ? cases.cases.map(c => `${c.title} — ${c.priority} priority, ${c.deficiencyType ? c.deficiencyType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, ch => ch.toUpperCase()) + ', ' : ''}owner: ${c.owner || '—'}, due: ${c.dueDate || '—'}.`).join('\n') + `\n\nCase status: ${sentToOwner} sent to owner, ${withOwner} with owner, ${submittedForReview} submitted for review, ${acceptedClosed} accepted & closed, ${rejectedBack} rejected/sent back.`
    : 'No cases assigned.';

  const keyMetricsText = `Records processed: ${totalRecords}\nOutputs generated: ${allOutputs.length}\nOutputs approved: ${approvedIds.length}\nExceptions: ${allExceptions.length}\nHigh/Critical exceptions: ${allExceptions.filter(e => e.severity === 'HIGH' || e.severity === 'CRITICAL').length}\nCase candidates: ${caseEx}\nCases assigned: ${cases.cases.length}\nOwner responses submitted: ${submittedForReview + acceptedClosed}\nAccepted & closed: ${acceptedClosed}`;

  const recs: string[] = [];
  if (allExceptions.filter(e => e.severity === 'HIGH' || e.severity === 'CRITICAL').length > 0) recs.push('Review and resolve high/critical cases promptly.');
  if (cfg.runType === 'RECURRING') recs.push('Finalize schedule configuration for recurring runs.');
  recs.push('Integrate with Case Management for long-term tracking.');
  if (openEx > 0) recs.push(`${openEx} open exception(s) require attention.`);
  const recommendationsText = recs.join('\n');

  const rejectedIds = outputReview.rejectedOutputIds;
  const pendingOutputs = allOutputs.length - approvedIds.length - rejectedIds.length;
  const executiveSummary = `${completedRuns.length} automation run(s) completed processing ${totalRecords} records. ${allOutputs.length} output(s) generated — ${approvedIds.length} approved for report${rejectedIds.length > 0 ? `, ${rejectedIds.length} excluded` : ''}${pendingOutputs > 0 ? `, ${pendingOutputs} pending review` : ''}. ${allExceptions.length} exception(s) identified, ${cases.cases.length} case(s) created.`;

  return {
    title, status: 'DRAFT',
    generatedFromRunIds: completedRuns.map(r => r.id),
    includedOutputIds: approvedIds,
    includedCaseIds: cases.cases.map(c => c.id),
    executiveSummary, projectObjective, inputSummary: inputSummaryText,
    automationSummary: automationSummaryText, runSummary: runSummaryText,
    exceptionSummary: exceptionSummaryText, caseSummary: caseSummaryText,
    keyMetrics: keyMetricsText, recommendations: recommendationsText,
    distributionList: `${engagement.owner}${engagement.reviewer ? `, ${engagement.reviewer}` : ''}`,
    generatedAt: now(), finalizedAt: null, finalizedBy: '',
    history: [{ id: `rrh-${Date.now()}`, action: 'GENERATED', actor: engagement.owner, timestamp: now(), comments: 'Draft report generated.' }],
  };
}

export function deriveReportReadiness(state: AutomationProjectWorkspaceState, cfg: AutomationProjectConfig) {
  const completedRuns = state.runs.runs.filter(r => r.status === 'COMPLETED');
  const hasReport = cfg.outputTypes.includes('REPORT');
  const hasCaseMgmt = cfg.outputTypes.includes('CASE_MANAGEMENT');
  const allEx = completedRuns.flatMap(r => r.exceptions);
  const checks = [
    { label: 'At least one completed run', ok: completedRuns.length > 0 },
    ...(hasReport ? [{ label: 'At least one approved output', ok: state.outputReview.approvedOutputIds.length > 0 }] : []),
    { label: 'Critical/high exceptions reviewed', ok: allEx.filter(e => (e.severity === 'HIGH' || e.severity === 'CRITICAL') && e.status === 'OPEN').length === 0 },
    ...(hasCaseMgmt ? [{ label: 'Case candidates have cases', ok: allEx.filter(e => e.status === 'CASE_CANDIDATE').length === 0 || state.cases.cases.length > 0 }] : []),
  ];
  const ready = checks.every(c => c.ok);
  return { ready, checks };
}
