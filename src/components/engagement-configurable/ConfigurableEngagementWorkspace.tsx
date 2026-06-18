// ─── Configurable Engagement V3 — Workspace Shell ─────────────────────────
// Pattern-driven workspace with dynamic tabs. Dev-only, not persisted.
// See docs/CONFIGURABLE_ENGAGEMENT_V3_MEMORY.md for product rules.

import React, { useState, useMemo, useCallback } from 'react';
import type { ConfigurableEngagement } from './configurableEngagementTypes';
import { EngagementPatternType } from './configurableEngagementTypes';
import { getWorkspaceTabsForPattern } from './configurableEngagementState';
import { WorkspaceHeader, WorkspaceTabs } from './components';
import PatternWorkspaceRenderer from './PatternWorkspaceRenderer';
import { MOCK_PBC_REQUESTS, type PBCRequest, type PBCRequestStatus, type ComplianceWorkspaceState } from './patterns/compliance/complianceRequestsData';
import type { SampleBatch, EvidenceItem } from './patterns/compliance/complianceSamplesEvidenceData';
import type { AttributeTestingState } from './patterns/compliance/complianceAttributeTestingData';
import type { ComplianceReviewState } from './patterns/compliance/complianceReviewData';
import type { ComplianceConclusionState } from './patterns/compliance/complianceConclusionData';
import { DEFAULT_IA_SCOPE, type InternalAuditScopeState, type InternalAuditWorkspaceState } from './patterns/internal-audit/internalAuditScopeData';
import { DEFAULT_ANNOUNCEMENT, type InternalAuditAnnouncementState } from './patterns/internal-audit/internalAuditAnnouncementData';
import { MOCK_IA_REQUESTS, type InternalAuditRequestState } from './patterns/internal-audit/internalAuditRequestsData';
import type { InternalAuditAnalysisState } from './patterns/internal-audit/internalAuditAnalysisData';
import type { InternalAuditObservationsState } from './patterns/internal-audit/internalAuditObservationsData';
import type { InternalAuditDiscussionState } from './patterns/internal-audit/internalAuditDiscussionData';
import { DEFAULT_FINAL_REPORT, type InternalAuditFinalReportState } from './patterns/internal-audit/internalAuditFinalReportData';
import type { InternalAuditActionPlanState } from './patterns/internal-audit/internalAuditActionPlanData';
import type { AutomationInputDataState, AutomationProjectWorkspaceState } from './patterns/automation/automationInputData';
import type { AutomationSetupState } from './patterns/automation/automationSetupData';
import type { AutomationRunsState, ExceptionStatus as AutoExceptionStatus } from './patterns/automation/automationRunsData';
import type { AutomationOutputReviewState } from './patterns/automation/automationOutputReviewData';
import type { AutomationCasesState } from './patterns/automation/automationCasesData';
import type { AutomationReportsState } from './patterns/automation/automationReportsData';
import type { AutomationScheduleState } from './patterns/automation/automationScheduleData';

interface Props {
  engagement: ConfigurableEngagement;
  onBack?: () => void;
  onEditSetup?: () => void;
  backLabel?: string;
}

export default function ConfigurableEngagementWorkspace({ engagement, onBack, onEditSetup, backLabel }: Props) {
  const allTabs = getWorkspaceTabsForPattern(engagement.patternType);

  // Static hidden tabs (automation review)
  const staticHiddenTabIds = useMemo(() => {
    if (
      engagement.config.patternType === EngagementPatternType.WORKFLOW_AUTOMATION_PROJECT &&
      !engagement.config.reviewRequired
    ) {
      return ['review'];
    }
    return [];
  }, [engagement.config]);

  // Placeholder — will be replaced by dynamic computation after iaState is defined
  const [activeTabId, setActiveTabId] = useState(allTabs.filter(t => !staticHiddenTabIds.includes(t.id))[0]?.id || 'overview');

  // ── Compliance workspace state (lifted from tab components) ──
  const [complianceState, setComplianceState] = useState<ComplianceWorkspaceState>(() => ({
    requests: MOCK_PBC_REQUESTS,
    samplesEvidence: { batches: [], evidence: [] },
    attributeTesting: { results: [], testingStarted: false },
    review: { reviews: [] },
    conclusion: { conclusions: [] },
  }));

  const handleCreateRequest = useCallback((req: PBCRequest) => {
    setComplianceState(prev => ({ ...prev, requests: [req, ...prev.requests] }));
  }, []);

  const handleUpdateRequestStatus = useCallback((id: string, status: PBCRequestStatus) => {
    setComplianceState(prev => ({
      ...prev,
      requests: prev.requests.map(r => r.id === id ? { ...r, status } : r),
    }));
  }, []);

  const handleAddBatch = useCallback((batch: SampleBatch) => {
    setComplianceState(prev => ({
      ...prev,
      samplesEvidence: { ...prev.samplesEvidence, batches: [...prev.samplesEvidence.batches, batch] },
    }));
  }, []);

  const handleAddEvidence = useCallback((ev: EvidenceItem) => {
    setComplianceState(prev => ({
      ...prev,
      samplesEvidence: { ...prev.samplesEvidence, evidence: [...prev.samplesEvidence.evidence, ev] },
    }));
  }, []);

  const handleUpdateAttributeTesting = useCallback((state: AttributeTestingState) => {
    setComplianceState(prev => ({ ...prev, attributeTesting: state }));
  }, []);

  const handleUpdateReview = useCallback((reviewState: ComplianceReviewState) => {
    setComplianceState(prev => ({ ...prev, review: reviewState }));
  }, []);

  const handleUpdateConclusion = useCallback((conclusionState: ComplianceConclusionState) => {
    setComplianceState(prev => ({ ...prev, conclusion: conclusionState }));
  }, []);

  // ── Internal Audit workspace state ──
  const [iaState, setIAState] = useState<InternalAuditWorkspaceState>(() => ({
    scope: { ...DEFAULT_IA_SCOPE, scopeLevel: (engagement.config as any).scopeLevel || 'PROCESS' },
    announcement: { ...DEFAULT_ANNOUNCEMENT },
    requests: { requests: MOCK_IA_REQUESTS, proceedWithoutIDR: false },
    analysis: { runs: [], potentialObservations: [] },
    observations: { observations: [], noObservationsConfirmed: false, noObservationsConfirmedBy: '', noObservationsConfirmedAt: null, dismissedPotentialObsIds: [] },
    discussion: { items: [], notes: [], noObsDiscussionConfirmed: false },
    finalReport: { ...DEFAULT_FINAL_REPORT },
    actionPlan: { actionItems: [], initializedFromReport: false, followUpRequired: false, followUpNotes: '' },
  }));

  const handleUpdateIAScope = useCallback((scope: InternalAuditScopeState) => {
    setIAState(prev => ({ ...prev, scope }));
  }, []);

  const handleUpdateIAAnnouncement = useCallback((announcement: InternalAuditAnnouncementState) => {
    setIAState(prev => ({ ...prev, announcement }));
  }, []);

  const handleUpdateIARequests = useCallback((requestState: InternalAuditRequestState) => {
    setIAState(prev => ({ ...prev, requests: requestState }));
  }, []);

  const handleUpdateIAAnalysis = useCallback((analysisState: InternalAuditAnalysisState) => {
    setIAState(prev => ({ ...prev, analysis: analysisState }));
  }, []);

  const handleUpdateIAObservations = useCallback((obsState: InternalAuditObservationsState) => {
    setIAState(prev => ({ ...prev, observations: obsState }));
  }, []);

  const handleUpdateIADiscussion = useCallback((discState: InternalAuditDiscussionState) => {
    setIAState(prev => ({ ...prev, discussion: discState }));
  }, []);

  const handleUpdateIAFinalReport = useCallback((reportState: InternalAuditFinalReportState) => {
    setIAState(prev => ({ ...prev, finalReport: reportState }));
  }, []);

  const handleUpdateIAActionPlan = useCallback((apState: InternalAuditActionPlanState) => {
    setIAState(prev => ({ ...prev, actionPlan: apState }));
  }, []);

  // ── Automation Project workspace state ──
  const [automationState, setAutomationState] = useState<AutomationProjectWorkspaceState>(() => ({
    inputData: { dataSources: [], selectedSourceIds: [], inputNotes: '', proceedWithoutData: false },
    setup: { setupMode: (engagement.config as any).automationSetupMode || 'QA_ADHOC_ANALYSIS', selectedWorkflowId: '', selectedWorkflowName: '', selectedWorkflowIds: [], selectedWorkflowNames: [], draftWorkflow: null, qaSetup: null, createdWorkflows: [], setupStatus: 'NOT_CONFIGURED', setupNotes: '', history: [] },
    runs: { runs: [] },
    outputReview: { reviewedOutputIds: [], approvedOutputIds: [], rejectedOutputIds: [], outputComments: {}, reviewNotes: '', history: [] },
    cases: { cases: [], linkedExceptionIds: [], caseNotes: '' },
    reports: { reports: [], reportNotes: '' },
    schedule: { status: 'NOT_CONFIGURED', frequency: (engagement.config as any).frequency || '', startDate: '', endDate: '', runTime: '09:00', timezone: 'IST (UTC+5:30)', selectedWorkflowId: '', selectedInputSourceIds: [], notificationRecipients: '', failureNotificationRecipients: '', autoCreateCases: false, autoGenerateReport: false, lastRunAt: null, nextRunAt: null, scheduleNotes: '', history: [] },
  }));

  const handleUpdateAutomationInputData = useCallback((inputData: AutomationInputDataState) => {
    setAutomationState(prev => ({ ...prev, inputData }));
  }, []);

  const handleUpdateAutomationSetup = useCallback((setup: AutomationSetupState) => {
    setAutomationState(prev => ({ ...prev, setup }));
  }, []);

  const handleUpdateAutomationRuns = useCallback((runs: AutomationRunsState) => {
    setAutomationState(prev => ({ ...prev, runs }));
  }, []);

  const handleUpdateAutomationOutputReview = useCallback((outputReview: AutomationOutputReviewState) => {
    setAutomationState(prev => ({ ...prev, outputReview }));
  }, []);

  const handleUpdateAutomationCases = useCallback((cases: AutomationCasesState) => {
    setAutomationState(prev => ({ ...prev, cases }));
  }, []);

  const handleUpdateAutomationReports = useCallback((reports: AutomationReportsState) => {
    setAutomationState(prev => ({ ...prev, reports }));
  }, []);

  const handleUpdateAutomationSchedule = useCallback((schedule: AutomationScheduleState) => {
    setAutomationState(prev => ({ ...prev, schedule }));
  }, []);

  // Exception update that modifies runs state (shared between Runs and Output Review)
  const handleUpdateAutoRunException = useCallback((runId: string, exId: string, status: AutoExceptionStatus, triageData?: Record<string, unknown>) => {
    setAutomationState(prev => ({
      ...prev,
      runs: { runs: prev.runs.runs.map(r => r.id === runId ? { ...r, exceptions: r.exceptions.map(e => e.id === exId ? { ...e, status, ...triageData } : e) } : r) },
    }));
  }, []);

  // Dynamic IA tab visibility based on scope sources
  const hiddenTabIds = useMemo(() => {
    const hidden = [...staticHiddenTabIds];
    if (engagement.config.patternType === EngagementPatternType.INTERNAL_AUDIT_ASSIGNMENT) {
      const scope = iaState.scope;
      const showRacmTab = scope.sopIds.length > 0 || scope.racmVersionIds.length > 0;
      const showControlsTab = scope.sopIds.length > 0 || scope.racmVersionIds.length > 0 || scope.checklistIds.length > 0;
      if (!showRacmTab) hidden.push('ia-racm');
      if (!showControlsTab) hidden.push('ia-controls');
    }
    return hidden;
  }, [staticHiddenTabIds, engagement.config.patternType, iaState.scope]);

  const visibleTabs = allTabs.filter(t => !hiddenTabIds.includes(t.id));
  const activeTab = visibleTabs.find(t => t.id === activeTabId) || visibleTabs[0];

  return (
    <div>
      <WorkspaceHeader engagement={engagement} onBack={onBack} onEditSetup={onEditSetup} backLabel={backLabel} />
      <WorkspaceTabs tabs={allTabs} activeTabId={activeTabId} onTabChange={setActiveTabId} hiddenTabIds={hiddenTabIds} storageKey={`config:${engagement.id}`} />
      <PatternWorkspaceRenderer
        engagement={engagement}
        activeTabId={activeTab?.id || 'overview'}
        activeTabLabel={activeTab?.label || 'Overview'}
        complianceState={complianceState}
        onCreateRequest={handleCreateRequest}
        onUpdateRequestStatus={handleUpdateRequestStatus}
        onAddBatch={handleAddBatch}
        onAddEvidence={handleAddEvidence}
        onUpdateAttributeTesting={handleUpdateAttributeTesting}
        onUpdateReview={handleUpdateReview}
        onUpdateConclusion={handleUpdateConclusion}
        iaState={iaState}
        onUpdateIAScope={handleUpdateIAScope}
        onUpdateIAAnnouncement={handleUpdateIAAnnouncement}
        onUpdateIARequests={handleUpdateIARequests}
        onUpdateIAAnalysis={handleUpdateIAAnalysis}
        onUpdateIAObservations={handleUpdateIAObservations}
        onUpdateIADiscussion={handleUpdateIADiscussion}
        onUpdateIAFinalReport={handleUpdateIAFinalReport}
        onUpdateIAActionPlan={handleUpdateIAActionPlan}
        automationState={automationState}
        onUpdateAutomationInputData={handleUpdateAutomationInputData}
        onUpdateAutomationSetup={handleUpdateAutomationSetup}
        onUpdateAutomationRuns={handleUpdateAutomationRuns}
        onUpdateAutomationOutputReview={handleUpdateAutomationOutputReview}
        onUpdateAutoRunException={handleUpdateAutoRunException}
        onUpdateAutomationCases={handleUpdateAutomationCases}
        onUpdateAutomationReports={handleUpdateAutomationReports}
        onUpdateAutomationSchedule={handleUpdateAutomationSchedule}
        onNavigateTab={setActiveTabId}
      />
    </div>
  );
}
