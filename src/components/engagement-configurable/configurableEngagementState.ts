// ─── Configurable Engagement V3 — State Helpers ──────────────────────────
// Lightweight pure functions for display, tabs, validation.
// See docs/CONFIGURABLE_ENGAGEMENT_V3_MEMORY.md for product rules.

import type { ConfigurableEngagement, ValidationResult, ValidationError } from './configurableEngagementTypes';
import { EngagementPatternType, PATTERN_DISPLAY_LABELS, ComplianceFramework, RunType } from './configurableEngagementTypes';
import { ENGAGEMENT_PATTERNS, type WorkspaceTab } from './engagementPatterns';

// ─── Display Helpers ──────────────────────────────────────────────────────

export function getDisplayLabelForPattern(patternType: EngagementPatternType): string {
  return PATTERN_DISPLAY_LABELS[patternType] || patternType;
}

export function getWorkspaceTabsForPattern(patternType: EngagementPatternType): WorkspaceTab[] {
  return ENGAGEMENT_PATTERNS[patternType]?.workspaceTabs || [];
}

export function getRequiredOutputsForPattern(patternType: EngagementPatternType): string[] {
  return ENGAGEMENT_PATTERNS[patternType]?.requiredOutputs || [];
}

export function isReviewerRequired(engagement: ConfigurableEngagement): boolean {
  const cfg = engagement.config;
  if (cfg.patternType === EngagementPatternType.COMPLIANCE_CONTROL_TESTING) {
    return cfg.reviewerRequired;
  }
  if (cfg.patternType === EngagementPatternType.WORKFLOW_AUTOMATION_PROJECT) {
    return cfg.reviewRequired;
  }
  // Internal audit: reviewer is always recommended but technically the config doesn't have a flag
  return true;
}

// ─── Draft Validation ─────────────────────────────────────────────────────

export function validateConfigurableEngagementDraft(engagement: ConfigurableEngagement): ValidationResult {
  const errors: ValidationError[] = [];

  // Common validations
  if (!engagement.name.trim()) {
    errors.push({ field: 'name', message: 'Name is required.', severity: 'error' });
  }
  if (!engagement.patternType) {
    errors.push({ field: 'patternType', message: 'Pattern type is required.', severity: 'error' });
  }
  if (!engagement.owner.trim()) {
    errors.push({ field: 'owner', message: 'Owner is required.', severity: 'error' });
  }
  if (!engagement.description.trim()) {
    errors.push({ field: 'description', message: 'Description / objective is required.', severity: 'error' });
  }

  const cfg = engagement.config;

  // Pattern-specific validations
  if (cfg.patternType === EngagementPatternType.COMPLIANCE_CONTROL_TESTING) {
    if (!cfg.framework) {
      errors.push({ field: 'config.framework', message: 'Framework is required.', severity: 'error' });
    }
    if (!cfg.controlScopeSource) {
      errors.push({ field: 'config.controlScopeSource', message: 'Control scope source is required.', severity: 'error' });
    }
    // SOX / IFC / ICOFR require RACM
    const RACM_REQUIRED_FRAMEWORKS: ComplianceFramework[] = [ComplianceFramework.SOX_ICFR, ComplianceFramework.IFC, ComplianceFramework.ICOFR];
    const racmRequired = RACM_REQUIRED_FRAMEWORKS.includes(cfg.framework);
    if (racmRequired && !cfg.racmVersionId) {
      errors.push({ field: 'config.racmVersionId', message: 'RACM version is required for SOX/IFC/ICOFR frameworks.', severity: 'error' });
    }
    if (cfg.reviewerRequired && !engagement.reviewer?.trim()) {
      errors.push({ field: 'reviewer', message: 'Reviewer is required for compliance engagements.', severity: 'error' });
    }
  }

  if (cfg.patternType === EngagementPatternType.INTERNAL_AUDIT_ASSIGNMENT) {
    if (!cfg.finalReportRequired) {
      errors.push({ field: 'config.finalReportRequired', message: 'Final report should be required for audit assignments.', severity: 'warning' });
    }
  }

  if (cfg.patternType === EngagementPatternType.WORKFLOW_AUTOMATION_PROJECT) {
    if (!cfg.inputType) {
      errors.push({ field: 'config.inputType', message: 'Input data type is required.', severity: 'error' });
    }
    if (!cfg.automationSetupMode) {
      errors.push({ field: 'config.automationSetupMode', message: 'Automation setup mode is required.', severity: 'error' });
    }
    if (!cfg.reportRequired) {
      errors.push({ field: 'config.reportRequired', message: 'Output report is recommended.', severity: 'warning' });
    }
    if (cfg.runType === RunType.RECURRING && !cfg.frequency) {
      errors.push({ field: 'config.frequency', message: 'Frequency is required for recurring runs.', severity: 'error' });
    }
  }

  return {
    isValid: errors.filter(e => e.severity === 'error').length === 0,
    errors,
  };
}
