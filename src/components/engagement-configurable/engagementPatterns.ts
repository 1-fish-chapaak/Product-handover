// ─── Configurable Engagement V3 — Pattern Definitions ─────────────────────
// Metadata for each locked engagement pattern.
// See docs/CONFIGURABLE_ENGAGEMENT_V3_MEMORY.md for product rules.

import { EngagementPatternType } from './configurableEngagementTypes';

// ─── Pattern Definition Type ──────────────────────────────────────────────

export interface WorkspaceTab {
  id: string;
  label: string;
}

export interface EngagementPatternDefinition {
  id: EngagementPatternType;
  label: string;
  displayLabel: string;
  description: string;
  shortDescription: string;
  iconName?: string;
  requiredSetupSections: string[];
  workspaceTabs: WorkspaceTab[];
  requiredOutputs: string[];
  validationSummary: string;
}

// ─── Pattern Definitions ──────────────────────────────────────────────────

const COMPLIANCE_CONTROL_TESTING: EngagementPatternDefinition = {
  id: EngagementPatternType.COMPLIANCE_CONTROL_TESTING,
  label: 'Compliance Control Testing',
  displayLabel: 'Engagement',
  description: 'Framework-driven control testing with RACM/controls, samples/evidence, working paper, review, and conclusion.',
  shortDescription: 'SOX, IFC, SOC, GDPR — control testing with working paper and reviewer approval.',
  iconName: 'Shield',
  requiredSetupSections: [
    'Framework & Audit Type',
    'Control Scope Source',
    'Testing Input Method',
    'Reviewer Assignment',
  ],
  workspaceTabs: [
    { id: 'overview', label: 'Overview' },
    { id: 'control-scope', label: 'Control Scope' },
    { id: 'requests', label: 'Requests / PBC' },
    { id: 'samples-evidence', label: 'Samples & Evidence' },
    { id: 'attr-testing', label: 'Attribute Testing' },
    { id: 'working-paper', label: 'Working Paper' },
    { id: 'review', label: 'Review' },
    { id: 'conclusion', label: 'Conclusion' },
    { id: 'summary', label: 'Summary' },
  ],
  requiredOutputs: [
    'Working Paper',
    'Reviewer Approval',
    'Control Conclusion',
    'Engagement Summary',
  ],
  validationSummary: 'Framework, audit period, control scope source, and reviewer are required. SOX/IFC/ICOFR require RACM.',
};

const INTERNAL_AUDIT_ASSIGNMENT: EngagementPatternDefinition = {
  id: EngagementPatternType.INTERNAL_AUDIT_ASSIGNMENT,
  label: 'Internal Audit Assignment',
  displayLabel: 'Audit Assignment',
  description: 'Scope-driven audit assignment with announcement, IDR, analysis, observations, discussion, final report, and action tracking.',
  shortDescription: 'Process audits, SOP reviews, plant audits — with observations, final report, and action plans.',
  iconName: 'ClipboardCheck',
  requiredSetupSections: [
    'Scope Definition',
    'Announcement Settings',
    'IDR Configuration',
    'Process Owner Assignment',
  ],
  workspaceTabs: [
    { id: 'overview', label: 'Overview' },
    { id: 'scope', label: 'Scope' },
    { id: 'announcement', label: 'Announcement' },
    { id: 'requests-idr', label: 'Requests / IDR' },
    { id: 'ia-racm', label: 'RACM' },
    { id: 'ia-controls', label: 'Controls' },
    { id: 'analysis', label: 'Analysis & Findings' },
    { id: 'observations', label: 'Observations' },
    { id: 'discussion', label: 'Discussion' },
    { id: 'working-paper', label: 'Working Paper' },
    { id: 'final-report', label: 'Final Report' },
    { id: 'action-plan', label: 'Action Plan' },
  ],
  requiredOutputs: [
    'Working Paper',
    'Final Report',
    'Observation Review',
    'Action Plan (if observations exist)',
  ],
  validationSummary: 'Scope, process owner, announcement, and final report are required. IDR is optional.',
};

const WORKFLOW_AUTOMATION_PROJECT: EngagementPatternDefinition = {
  id: EngagementPatternType.WORKFLOW_AUTOMATION_PROJECT,
  label: 'Workflow Automation Project',
  displayLabel: 'Project',
  description: 'Automation-driven project using Excel/PDF/SQL/Image inputs, workflows or Q&A, output reports, cases, dashboards, and optional schedule.',
  shortDescription: 'Vendor reconciliation, expense validation, MIS reporting — workflow automation with cases and scheduling.',
  iconName: 'Workflow',
  requiredSetupSections: [
    'Input Data Type',
    'Automation Setup Mode',
    'Output Configuration',
    'Schedule (if recurring)',
  ],
  workspaceTabs: [
    { id: 'overview', label: 'Overview' },
    { id: 'workflows', label: 'Workflows' },
    { id: 'cases', label: 'Cases' },
    { id: 'reports', label: 'Reports' },
    { id: 'activity-trail', label: 'Activity Trail' },
  ],
  requiredOutputs: [
    'Output Report',
    'Run Summary',
    'Cases (if exceptions created)',
  ],
  validationSummary: 'Input type, automation setup mode, and output report are required. Workflow is not required at creation.',
};

// ─── Exports ──────────────────────────────────────────────────────────────

export const ENGAGEMENT_PATTERNS: Record<EngagementPatternType, EngagementPatternDefinition> = {
  [EngagementPatternType.COMPLIANCE_CONTROL_TESTING]: COMPLIANCE_CONTROL_TESTING,
  [EngagementPatternType.INTERNAL_AUDIT_ASSIGNMENT]: INTERNAL_AUDIT_ASSIGNMENT,
  [EngagementPatternType.WORKFLOW_AUTOMATION_PROJECT]: WORKFLOW_AUTOMATION_PROJECT,
};

export const ENGAGEMENT_PATTERNS_LIST: EngagementPatternDefinition[] = [
  COMPLIANCE_CONTROL_TESTING,
  INTERNAL_AUDIT_ASSIGNMENT,
  WORKFLOW_AUTOMATION_PROJECT,
];

export function getEngagementPatternDefinition(patternType: EngagementPatternType): EngagementPatternDefinition {
  return ENGAGEMENT_PATTERNS[patternType];
}
