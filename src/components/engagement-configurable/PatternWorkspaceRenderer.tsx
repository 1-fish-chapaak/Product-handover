// ─── Configurable Engagement V3 — Pattern Workspace Renderer ──────────────

import type { ConfigurableEngagement } from './configurableEngagementTypes';
import { EngagementPatternType } from './configurableEngagementTypes';
import type { ComplianceWorkspaceState, PBCRequest } from './patterns/compliance/complianceRequestsData';
import type { ScopeControl } from './patterns/compliance/complianceControlScopeData';
import type { SampleBatch, EvidenceItem } from './patterns/compliance/complianceSamplesEvidenceData';
import type { AttributeTestingState } from './patterns/compliance/complianceAttributeTestingData';
import type { ComplianceReviewState } from './patterns/compliance/complianceReviewData';
import type { ComplianceConclusionState } from './patterns/compliance/complianceConclusionData';
import type { InternalAuditWorkspaceState, InternalAuditScopeState } from './patterns/internal-audit/internalAuditScopeData';
import type { InternalAuditAnnouncementState } from './patterns/internal-audit/internalAuditAnnouncementData';
import type { InternalAuditRequestState } from './patterns/internal-audit/internalAuditRequestsData';
import type { InternalAuditAnalysisState } from './patterns/internal-audit/internalAuditAnalysisData';
import type { InternalAuditObservationsState } from './patterns/internal-audit/internalAuditObservationsData';
import type { InternalAuditDiscussionState } from './patterns/internal-audit/internalAuditDiscussionData';
import type { InternalAuditFinalReportState } from './patterns/internal-audit/internalAuditFinalReportData';
import type { InternalAuditActionPlanState } from './patterns/internal-audit/internalAuditActionPlanData';
import type { AutomationInputDataState, AutomationProjectWorkspaceState } from './patterns/automation/automationInputData';
import type { AutomationSetupState } from './patterns/automation/automationSetupData';
import type { AutomationRunsState, ExceptionStatus as AutoExceptionStatus } from './patterns/automation/automationRunsData';
import type { AutomationOutputReviewState } from './patterns/automation/automationOutputReviewData';
import type { AutomationCasesState } from './patterns/automation/automationCasesData';
import type { AutomationReportsState } from './patterns/automation/automationReportsData';
import type { AutomationScheduleState } from './patterns/automation/automationScheduleData';
import AutomationWorkflowsTab from './patterns/automation/AutomationWorkflowsTab';
import AutomationOutputReviewTab from './patterns/automation/AutomationOutputReviewTab';
import AutomationCasesTab from './patterns/automation/AutomationCasesTab';
import AutomationReportsTab from './patterns/automation/AutomationReportsTab';
import AutomationActivityTrailTab from './patterns/automation/AutomationActivityTrailTab';
import { WorkspaceOverview, PatternPlaceholderTab } from './components';
import EngagementActivityTrailTab from './components/EngagementActivityTrailTab';
import ComplianceControlScopeTab from './patterns/compliance/ComplianceControlScopeTab';
import ComplianceRequestsPBCTab from './patterns/compliance/ComplianceRequestsPBCTab';
import ComplianceSamplesEvidenceTab from './patterns/compliance/ComplianceSamplesEvidenceTab';
import ComplianceAttributeTestingTab from './patterns/compliance/ComplianceAttributeTestingTab';
import ComplianceWorkingPaperTab from './patterns/compliance/ComplianceWorkingPaperTab';
import ComplianceReviewTab from './patterns/compliance/ComplianceReviewTab';
import ComplianceConclusionTab from './patterns/compliance/ComplianceConclusionTab';
import ComplianceSummaryTab from './patterns/compliance/ComplianceSummaryTab';
import InternalAuditScopeTab from './patterns/internal-audit/InternalAuditScopeTab';
import InternalAuditAnnouncementTab from './patterns/internal-audit/InternalAuditAnnouncementTab';
import InternalAuditRequestsIDRTab from './patterns/internal-audit/InternalAuditRequestsIDRTab';
import InternalAuditRacmTab from './patterns/internal-audit/InternalAuditRacmTab';
import InternalAuditControlsTab from './patterns/internal-audit/InternalAuditControlsTab';
import InternalAuditAnalysisTab from './patterns/internal-audit/InternalAuditAnalysisTab';
import InternalAuditObservationsTab from './patterns/internal-audit/InternalAuditObservationsTab';
import InternalAuditDiscussionTab from './patterns/internal-audit/InternalAuditDiscussionTab';
import InternalAuditWorkingPaperTab from './patterns/internal-audit/InternalAuditWorkingPaperTab';
import InternalAuditFinalReportTab from './patterns/internal-audit/InternalAuditFinalReportTab';
import InternalAuditActionPlanTab from './patterns/internal-audit/InternalAuditActionPlanTab';

interface Props {
  engagement: ConfigurableEngagement;
  activeTabId: string;
  activeTabLabel: string;
  complianceState?: ComplianceWorkspaceState;
  onCreateRequest?: (req: PBCRequest) => void;
  onUpdateRequest?: (id: string, patch: Partial<PBCRequest>) => void;
  onUpdateScopeControls?: (controls: ScopeControl[]) => void;
  onAddBatch?: (batch: SampleBatch) => void;
  onAddEvidence?: (ev: EvidenceItem) => void;
  onUpdateAttributeTesting?: (state: AttributeTestingState) => void;
  onUpdateReview?: (state: ComplianceReviewState) => void;
  onUpdateConclusion?: (state: ComplianceConclusionState) => void;
  iaState?: InternalAuditWorkspaceState;
  onUpdateIAScope?: (scope: InternalAuditScopeState) => void;
  onUpdateIAAnnouncement?: (ann: InternalAuditAnnouncementState) => void;
  onUpdateIARequests?: (state: InternalAuditRequestState) => void;
  onUpdateIAAnalysis?: (state: InternalAuditAnalysisState) => void;
  onUpdateIAObservations?: (state: InternalAuditObservationsState) => void;
  onUpdateIADiscussion?: (state: InternalAuditDiscussionState) => void;
  onUpdateIAFinalReport?: (state: InternalAuditFinalReportState) => void;
  onUpdateIAActionPlan?: (state: InternalAuditActionPlanState) => void;
  automationState?: AutomationProjectWorkspaceState;
  onUpdateAutomationInputData?: (state: AutomationInputDataState) => void;
  onUpdateAutomationSetup?: (state: AutomationSetupState) => void;
  onUpdateAutomationRuns?: (state: AutomationRunsState) => void;
  onUpdateAutomationOutputReview?: (state: AutomationOutputReviewState) => void;
  onUpdateAutoRunException?: (runId: string, exId: string, status: AutoExceptionStatus, triageData?: Record<string, unknown>) => void;
  onUpdateAutomationCases?: (state: AutomationCasesState) => void;
  onUpdateAutomationReports?: (state: AutomationReportsState) => void;
  onUpdateAutomationSchedule?: (state: AutomationScheduleState) => void;
  onNavigateTab?: (tabId: string) => void;
}

export default function PatternWorkspaceRenderer({ engagement, activeTabId, activeTabLabel, complianceState, onCreateRequest, onUpdateRequest, onUpdateScopeControls, onAddBatch, onAddEvidence, onUpdateAttributeTesting, onUpdateReview, onUpdateConclusion, iaState, onUpdateIAScope, onUpdateIAAnnouncement, onUpdateIARequests, onUpdateIAAnalysis, onUpdateIAObservations, onUpdateIADiscussion, onUpdateIAFinalReport, onUpdateIAActionPlan, automationState, onUpdateAutomationInputData, onUpdateAutomationSetup, onUpdateAutomationRuns, onUpdateAutomationOutputReview, onUpdateAutoRunException, onUpdateAutomationCases, onUpdateAutomationReports, onUpdateAutomationSchedule, onNavigateTab }: Props) {
  if (activeTabId === 'overview') {
    return <WorkspaceOverview engagement={engagement} automationState={automationState} onNavigateTab={onNavigateTab} />;
  }

  if (engagement.patternType === EngagementPatternType.COMPLIANCE_CONTROL_TESTING) {
    if (activeTabId === 'control-scope' && complianceState && onUpdateScopeControls) {
      return (
        <ComplianceControlScopeTab
          engagement={engagement}
          scopeControls={complianceState.scopeControls}
          onUpdateScopeControls={onUpdateScopeControls}
        />
      );
    }
    if (activeTabId === 'requests' && complianceState && onCreateRequest && onUpdateRequest) {
      return (
        <ComplianceRequestsPBCTab
          engagement={engagement}
          requests={complianceState.requests}
          onCreateRequest={onCreateRequest}
          onUpdateRequest={onUpdateRequest}
        />
      );
    }
    if (activeTabId === 'summary' && complianceState) {
      return (
        <ComplianceSummaryTab
          engagement={engagement}
          complianceState={complianceState}
          onNavigateTab={onNavigateTab}
        />
      );
    }
    if (activeTabId === 'conclusion' && complianceState && onUpdateConclusion) {
      return (
        <ComplianceConclusionTab
          engagement={engagement}
          complianceState={complianceState}
          onUpdateConclusion={onUpdateConclusion}
          onNavigateTab={onNavigateTab}
        />
      );
    }
    if (activeTabId === 'review' && complianceState && onUpdateReview) {
      return (
        <ComplianceReviewTab
          engagement={engagement}
          complianceState={complianceState}
          onUpdateReview={onUpdateReview}
          onNavigateTab={onNavigateTab}
        />
      );
    }
    if (activeTabId === 'working-paper' && complianceState) {
      return (
        <ComplianceWorkingPaperTab
          engagement={engagement}
          complianceState={complianceState}
          onNavigateTab={onNavigateTab}
        />
      );
    }
    if (activeTabId === 'attr-testing' && complianceState && onUpdateAttributeTesting) {
      return (
        <ComplianceAttributeTestingTab
          engagement={engagement}
          samplesEvidence={complianceState.samplesEvidence}
          attributeTesting={complianceState.attributeTesting}
          onUpdateAttributeTesting={onUpdateAttributeTesting}
          onNavigateTab={onNavigateTab}
        />
      );
    }
    if (activeTabId === 'samples-evidence' && complianceState && onAddBatch && onAddEvidence) {
      return (
        <ComplianceSamplesEvidenceTab
          engagement={engagement}
          samplesEvidence={complianceState.samplesEvidence}
          pbcRequests={complianceState.requests}
          onAddBatch={onAddBatch}
          onAddEvidence={onAddEvidence}
          onNavigateTab={onNavigateTab}
        />
      );
    }
  }

  // Internal Audit-specific tabs
  if (engagement.patternType === EngagementPatternType.INTERNAL_AUDIT_ASSIGNMENT) {
    if (activeTabId === 'scope' && iaState && onUpdateIAScope) {
      return (
        <InternalAuditScopeTab
          engagement={engagement}
          scope={iaState.scope}
          onUpdateScope={onUpdateIAScope}
          onNavigateTab={onNavigateTab}
        />
      );
    }
    if (activeTabId === 'announcement' && iaState && onUpdateIAAnnouncement) {
      return (
        <InternalAuditAnnouncementTab
          engagement={engagement}
          scope={iaState.scope}
          announcement={iaState.announcement}
          onUpdateAnnouncement={onUpdateIAAnnouncement}
          onNavigateTab={onNavigateTab}
        />
      );
    }
    if (activeTabId === 'requests-idr' && iaState && onUpdateIARequests) {
      return (
        <InternalAuditRequestsIDRTab
          engagement={engagement}
          scope={iaState.scope}
          requestState={iaState.requests}
          onUpdateRequestState={onUpdateIARequests}
          onNavigateTab={onNavigateTab}
        />
      );
    }
    if (activeTabId === 'ia-racm' && iaState) {
      return (
        <InternalAuditRacmTab
          engagement={engagement}
          scope={iaState.scope}
          onNavigateTab={onNavigateTab}
        />
      );
    }
    if (activeTabId === 'ia-controls' && iaState && onUpdateIAAnalysis) {
      return (
        <InternalAuditControlsTab
          engagement={engagement}
          scope={iaState.scope}
          analysisState={iaState.analysis}
          onUpdateAnalysis={onUpdateIAAnalysis}
          onNavigateTab={onNavigateTab}
        />
      );
    }
    if (activeTabId === 'analysis' && iaState && onUpdateIAAnalysis && onUpdateIAObservations) {
      return (
        <InternalAuditAnalysisTab
          engagement={engagement}
          scope={iaState.scope}
          requestState={iaState.requests}
          analysisState={iaState.analysis}
          onUpdateAnalysis={onUpdateIAAnalysis}
          observationsState={iaState.observations}
          onUpdateObservations={onUpdateIAObservations}
          onNavigateTab={onNavigateTab}
        />
      );
    }
    if (activeTabId === 'observations' && iaState && onUpdateIAObservations) {
      return (
        <InternalAuditObservationsTab
          engagement={engagement}
          analysisState={iaState.analysis}
          observationsState={iaState.observations}
          onUpdateObservations={onUpdateIAObservations}
          onNavigateTab={onNavigateTab}
        />
      );
    }
    if (activeTabId === 'discussion' && iaState && onUpdateIADiscussion) {
      return (
        <InternalAuditDiscussionTab
          engagement={engagement}
          observationsState={iaState.observations}
          discussionState={iaState.discussion}
          onUpdateDiscussion={onUpdateIADiscussion}
          onNavigateTab={onNavigateTab}
        />
      );
    }
    if (activeTabId === 'working-paper' && iaState) {
      return (
        <InternalAuditWorkingPaperTab
          engagement={engagement}
          iaState={iaState}
          onNavigateTab={onNavigateTab}
        />
      );
    }
    if (activeTabId === 'final-report' && iaState && onUpdateIAFinalReport) {
      return (
        <InternalAuditFinalReportTab
          engagement={engagement}
          iaState={iaState}
          finalReport={iaState.finalReport}
          onUpdateFinalReport={onUpdateIAFinalReport}
          onNavigateTab={onNavigateTab}
        />
      );
    }
    if (activeTabId === 'action-plan' && iaState && onUpdateIAActionPlan) {
      return (
        <InternalAuditActionPlanTab
          engagement={engagement}
          iaState={iaState}
          actionPlan={iaState.actionPlan}
          onUpdateActionPlan={onUpdateIAActionPlan}
          onNavigateTab={onNavigateTab}
        />
      );
    }
  }

  // Automation Project tabs
  if (engagement.patternType === EngagementPatternType.WORKFLOW_AUTOMATION_PROJECT) {
    if (activeTabId === 'workflows' && automationState && onUpdateAutomationSetup && onUpdateAutomationRuns) {
      return (
        <AutomationWorkflowsTab
          engagement={engagement}
          inputData={automationState.inputData}
          setup={automationState.setup}
          runsState={automationState.runs}
          onUpdateSetup={onUpdateAutomationSetup}
          onUpdateRuns={onUpdateAutomationRuns}
          onUpdateInputData={onUpdateAutomationInputData}
          onNavigateTab={onNavigateTab}
        />
      );
    }
    if (activeTabId === 'output-review' && automationState && onUpdateAutomationOutputReview) {
      return (
        <AutomationOutputReviewTab
          engagement={engagement}
          runsState={automationState.runs}
          outputReview={automationState.outputReview}
          onUpdateOutputReview={onUpdateAutomationOutputReview}
          onNavigateTab={onNavigateTab}
        />
      );
    }
    if (activeTabId === 'cases' && automationState && onUpdateAutomationCases) {
      return (
        <AutomationCasesTab
          engagement={engagement}
          runsState={automationState.runs}
          casesState={automationState.cases}
          onUpdateCases={onUpdateAutomationCases}
          onUpdateRunException={onUpdateAutoRunException}
          onNavigateTab={onNavigateTab}
        />
      );
    }
    if (activeTabId === 'reports' && automationState && onUpdateAutomationReports) {
      return (
        <AutomationReportsTab
          engagement={engagement}
          automationState={automationState}
          reportsState={automationState.reports}
          onUpdateReports={onUpdateAutomationReports}
          onNavigateTab={onNavigateTab}
        />
      );
    }
    if (activeTabId === 'activity-trail' && automationState) {
      return (
        <AutomationActivityTrailTab
          engagement={engagement}
          automationState={automationState}
        />
      );
    }
  }

  // Shared Activity Trail for Compliance and IA
  if (activeTabId === 'activity-trail' && (complianceState || iaState)) {
    return (
      <EngagementActivityTrailTab
        engagement={engagement}
        complianceState={complianceState}
        iaState={iaState}
      />
    );
  }

  return (
    <PatternPlaceholderTab
      tabId={activeTabId}
      tabLabel={activeTabLabel}
      patternType={engagement.patternType}
    />
  );
}
