// ─── Configurable Engagement V3 — Mock Placeholder Data ───────────────────
// Three example engagements, one per pattern. Not consumed by UI yet.
// See docs/CONFIGURABLE_ENGAGEMENT_V3_MEMORY.md for product rules.

import type { ConfigurableEngagement } from './configurableEngagementTypes';
import {
  EngagementPatternType, EngagementStatus, ComplianceFramework,
  ControlScopeSource, TestingInputMethod, AuditScopeLevel,
  AutomationInputType, AutomationSetupMode, AutomationOutputType, RunType, RunFrequency,
} from './configurableEngagementTypes';

// ─── Mock Engagements ─────────────────────────────────────────────────────

export const MOCK_CONFIGURABLE_ENGAGEMENTS: ConfigurableEngagement[] = [
  // 1. Compliance Control Testing
  {
    id: 'ceng-001',
    name: 'FY26 SOX ICFR Control Testing',
    patternType: EngagementPatternType.COMPLIANCE_CONTROL_TESTING,
    displayLabel: 'Engagement',
    description: 'Annual SOX ICFR compliance testing for FY26 across all key financial controls.',
    owner: 'Rajiv Sharma',
    reviewer: 'Audit Lead',
    businessProcess: 'Procure to Pay',
    entityOrLocation: 'Corporate HQ',
    status: EngagementStatus.IN_PROGRESS,
    stage: 'Testing In Progress',
    plannedStartDate: '2026-04-01',
    plannedEndDate: '2026-06-30',
    actualStartDate: '2026-04-05',
    config: {
      patternType: EngagementPatternType.COMPLIANCE_CONTROL_TESTING,
      framework: ComplianceFramework.SOX_ICFR,
      auditType: 'Annual ICFR Testing',
      auditPeriodStart: '2025-04-01',
      auditPeriodEnd: '2026-03-31',
      controlScopeSource: ControlScopeSource.RACM_VERSION,
      racmVersionId: 'racm-fy26-v1',
      defaultTestingInputMethod: TestingInputMethod.UPLOAD_SELECTED_SAMPLES,
      allowControlLevelOverride: true,
      reviewerRequired: true,
      requestPbcEnabled: true,
    },
    outputs: [
      { id: 'out-001', type: 'Working Paper', label: 'Working Paper', status: 'IN_PROGRESS' },
      { id: 'out-002', type: 'Reviewer Approval', label: 'Reviewer Approval', status: 'PENDING' },
      { id: 'out-003', type: 'Control Conclusion', label: 'Control Conclusion', status: 'PENDING' },
      { id: 'out-004', type: 'Engagement Summary', label: 'Engagement Summary', status: 'PENDING' },
    ],
    createdAt: '2026-03-15T10:00:00Z',
    updatedAt: '2026-05-10T14:30:00Z',
  },

  // 2. Internal Audit Assignment
  {
    id: 'ceng-002',
    name: 'P2P Audit — Maruti Plant',
    patternType: EngagementPatternType.INTERNAL_AUDIT_ASSIGNMENT,
    displayLabel: 'Audit Assignment',
    description: 'Process audit of the Procure to Pay cycle at Maruti manufacturing plant.',
    owner: 'Neha Joshi',
    reviewer: 'Audit Manager',
    businessProcess: 'Procure to Pay',
    entityOrLocation: 'Maruti Plant — Gurgaon',
    status: EngagementStatus.IN_PROGRESS,
    stage: 'Analysis In Progress',
    plannedStartDate: '2026-05-01',
    plannedEndDate: '2026-06-15',
    actualStartDate: '2026-05-03',
    config: {
      patternType: EngagementPatternType.INTERNAL_AUDIT_ASSIGNMENT,
      auditPeriodStart: '2025-04-01',
      auditPeriodEnd: '2026-03-31',
      scopeLevel: AuditScopeLevel.PROCESS,
      businessProcessId: 'bp-p2p',
      processOwner: 'Karan Mehta',
      idrEnabled: true,
      announcementRequired: true,
      finalReportRequired: true,
      actionTrackingEnabled: true,
    },
    outputs: [
      { id: 'out-005', type: 'Working Paper', label: 'Working Paper', status: 'PENDING' },
      { id: 'out-006', type: 'Final Report', label: 'Final Report', status: 'PENDING' },
      { id: 'out-007', type: 'Observation Review', label: 'Observation Review', status: 'PENDING' },
      { id: 'out-008', type: 'Action Plan', label: 'Action Plan', status: 'PENDING' },
    ],
    createdAt: '2026-04-20T09:00:00Z',
    updatedAt: '2026-05-10T11:00:00Z',
  },

  // 3. Workflow Automation Project
  {
    id: 'ceng-003',
    name: 'Air India Vendor Reconciliation',
    patternType: EngagementPatternType.WORKFLOW_AUTOMATION_PROJECT,
    displayLabel: 'Project',
    description: 'Automated vendor reconciliation using hybrid data inputs, Q&A analysis, monthly scheduled runs, and exception case creation.',
    owner: 'Rohan Patel',
    businessProcess: 'Procure to Pay',
    entityOrLocation: 'Air India — Finance',
    status: EngagementStatus.ACTIVE,
    stage: 'Ready to Run',
    plannedStartDate: '2026-04-15',
    config: {
      patternType: EngagementPatternType.WORKFLOW_AUTOMATION_PROJECT,
      inputType: AutomationInputType.HYBRID,
      automationSetupMode: AutomationSetupMode.QA_ADHOC_ANALYSIS,
      outputTypes: [AutomationOutputType.REPORT, AutomationOutputType.CASE_MANAGEMENT],
      reportRequired: true,
      reviewRequired: false,
      caseCreationEnabled: true,
      runType: RunType.RECURRING,
      frequency: RunFrequency.MONTHLY,
    },
    outputs: [
      { id: 'out-009', type: 'Output Report', label: 'Output Report', status: 'PENDING' },
      { id: 'out-010', type: 'Run Summary', label: 'Run Summary', status: 'PENDING' },
      { id: 'out-011', type: 'Cases', label: 'Cases', status: 'PENDING' },
    ],
    createdAt: '2026-04-10T08:00:00Z',
    updatedAt: '2026-05-08T16:00:00Z',
  },
];
