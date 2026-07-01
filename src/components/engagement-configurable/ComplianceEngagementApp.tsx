// ─── Compliance Engagement App — Orchestrator Entry Point ─────────────────
// Contract: the orchestrator routes "Compliance"-type engagements here.
//   <ComplianceEngagementApp engagementId="ef-comp-001" onBack={...} />
// Looks up the engagement via findEngagement (falls back to the first mock
// Compliance engagement), seeds the workspace header (name / code / framework /
// owner) from it, seeds complianceState with the deterministic flagship demo
// state (partially-done PBC + testing incl. failures), and renders the full
// workspace page with a back button.

import { useMemo } from 'react';
import { findEngagement, ENGAGEMENTS, type Engagement } from '../../data/engagements';
import ConfigurableEngagementWorkspace from './ConfigurableEngagementWorkspace';
import type { ConfigurableEngagement, ComplianceConfig } from './configurableEngagementTypes';
import {
  EngagementPatternType, EngagementStatus,
  ComplianceFramework, ControlScopeSource, TestingInputMethod,
} from './configurableEngagementTypes';
import { seedComplianceWorkspaceState } from './patterns/compliance/complianceSeedState';

function mapFramework(framework: string): ComplianceFramework {
  const f = framework.toUpperCase();
  if (f.includes('ICOFR')) return ComplianceFramework.ICOFR;
  if (f.includes('IFC')) return ComplianceFramework.IFC;
  return ComplianceFramework.SOX_ICFR;
}

function mapStatus(status: Engagement['status']): EngagementStatus {
  switch (status) {
    case 'Active':
    case 'In Progress': return EngagementStatus.IN_PROGRESS;
    case 'Review': return EngagementStatus.PENDING_REVIEW;
    case 'Closed': return EngagementStatus.COMPLETED;
    case 'Planned': return EngagementStatus.PLANNED;
    default: return EngagementStatus.DRAFT;
  }
}

function stageFor(status: Engagement['status']): string {
  switch (status) {
    case 'Active':
    case 'In Progress': return 'Testing In Progress';
    case 'Review': return 'Pending Review';
    case 'Closed': return 'Concluded';
    default: return 'Planned';
  }
}

/** Build the workspace engagement header from a portfolio engagement record. */
function buildWorkspaceEngagement(src: Engagement): ConfigurableEngagement {
  const config: ComplianceConfig = {
    patternType: EngagementPatternType.COMPLIANCE_CONTROL_TESTING,
    framework: mapFramework(src.framework),
    auditType: src.type === 'Compliance' ? 'Financial Internal Control' : src.type,
    auditPeriodStart: src.periodStart,
    auditPeriodEnd: src.periodEnd,
    controlScopeSource: ControlScopeSource.RACM_VERSION,
    racmVersionId: `RACM-${src.process}-v3`,
    defaultTestingInputMethod: TestingInputMethod.UPLOAD_SELECTED_SAMPLES,
    allowControlLevelOverride: true,
    reviewerRequired: true,
    requestPbcEnabled: true,
  };
  // Reviewer must differ from the owner for the maker-checker demo.
  const reviewer = src.owner === 'Karan Mehta' ? 'Vijay Reddy' : 'Karan Mehta';
  return {
    id: src.id,
    name: `${src.name} (${src.code})`,
    patternType: EngagementPatternType.COMPLIANCE_CONTROL_TESTING,
    displayLabel: 'Engagement',
    description: src.description,
    owner: src.owner,
    reviewer,
    businessProcess: src.process,
    status: mapStatus(src.status),
    stage: stageFor(src.status),
    plannedStartDate: src.periodStart,
    plannedEndDate: src.periodEnd,
    config,
    outputs: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

interface Props {
  engagementId?: string;
  onBack?: () => void;
}

export default function ComplianceEngagementApp({ engagementId, onBack }: Props) {
  const engagement = useMemo(() => {
    const src = (engagementId ? findEngagement(engagementId) : undefined)
      ?? ENGAGEMENTS.find(e => e.type === 'Compliance')
      ?? ENGAGEMENTS[0];
    return buildWorkspaceEngagement(src);
  }, [engagementId]);

  const initialComplianceState = useMemo(() => seedComplianceWorkspaceState(), []);

  return (
    <ConfigurableEngagementWorkspace
      engagement={engagement}
      onBack={onBack}
      backLabel="Back to Engagements"
      initialComplianceState={initialComplianceState}
    />
  );
}
