// ─── V3 AutomationRunException ↔ GrcException Adapter ────────────────────
// Maps between V3 automation exception format and existing GRC exception format
// so ManageExceptionsView can be embedded in V3 Automation Project.

import type { AutomationRunException, ExceptionSeverity, ExceptionStatus } from './automationRunsData';
import type { GrcException, GrcExceptionSeverity, GrcExceptionStatus, GrcExceptionClassification, GrcReviewStatus } from '../../../../data/mockData';

// ── V3 → GRC ─────────────────────────────────────────────────────────────

const SEVERITY_TO_GRC: Record<ExceptionSeverity, GrcExceptionSeverity> = {
  CRITICAL: 'High', HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low',
};

const STATUS_TO_GRC: Record<ExceptionStatus, GrcExceptionStatus> = {
  OPEN: 'Open', REVIEWED: 'Under Review', DISMISSED: 'Closed', CASE_CANDIDATE: 'Under Review',
};

function classificationFromV3(ex: AutomationRunException): GrcExceptionClassification {
  if (ex.status === 'DISMISSED') return 'False Positive';
  if (!ex.deficiencyType) return 'Unclassified';
  const map: Record<string, GrcExceptionClassification> = {
    SYSTEM_DEFICIENCY: 'System Deficiency',
    DESIGN_DEFICIENCY: 'Design Deficiency',
    OPERATING_DEFICIENCY: 'Procedural Non-Compliance',
    PROCESS_DEFICIENCY: 'Procedural Non-Compliance',
    DATA_DEFICIENCY: 'Business as Usual',
    DOCUMENTATION_DEFICIENCY: 'Business as Usual',
    CONTROL_DEFICIENCY: 'Design Deficiency',
    OTHER: 'Unclassified',
  };
  return map[ex.deficiencyType] || 'Unclassified';
}

function reviewStatusFromV3(ex: AutomationRunException): GrcReviewStatus {
  if (ex.status === 'CASE_CANDIDATE') return 'Approved';
  if (ex.status === 'REVIEWED') return 'Pending';
  if (ex.status === 'DISMISSED') return 'Approved';
  return 'Pending';
}

export function mapV3ExceptionToGrc(ex: AutomationRunException, runId: string): GrcException {
  const ownerName = ex.assignedOwner || 'Unassigned';
  const initials = ownerName.split(' ').map(w => w[0] || '').join('').slice(0, 2).toUpperCase() || 'U';
  return {
    id: ex.id,
    riskCategory: ex.category.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()),
    severity: SEVERITY_TO_GRC[ex.severity],
    status: STATUS_TO_GRC[ex.status],
    classification: classificationFromV3(ex),
    classificationReview: reviewStatusFromV3(ex),
    actionReview: ex.status === 'CASE_CANDIDATE' ? 'Pending' : 'Pending',
    lastUpdated: ex.caseCandidateMarkedAt || new Date().toISOString().slice(0, 10),
    title: ex.title,
    assignedTo: { name: ownerName, initials },
  };
}

export function mapV3ExceptionsToGrc(runs: { id: string; exceptions: AutomationRunException[] }[]): GrcException[] {
  return runs.flatMap(r => r.exceptions.map(ex => mapV3ExceptionToGrc(ex, r.id)));
}

// ── GRC → V3 (reverse sync) ──────────────────────────────────────────────

const GRC_SEVERITY_TO_V3: Record<GrcExceptionSeverity, ExceptionSeverity> = {
  High: 'HIGH', Medium: 'MEDIUM', Low: 'LOW',
};

const GRC_STATUS_TO_V3: Record<GrcExceptionStatus, ExceptionStatus> = {
  Open: 'OPEN', 'Under Review': 'REVIEWED', Closed: 'DISMISSED',
};

export function syncGrcToV3Exception(grc: GrcException, original: AutomationRunException): Partial<AutomationRunException> {
  const updates: Partial<AutomationRunException> = {};

  // Status
  const newStatus = GRC_STATUS_TO_V3[grc.status];
  if (newStatus && newStatus !== original.status) {
    // If classified and under review, treat as CASE_CANDIDATE if classification is not Unclassified/False Positive
    if (grc.status === 'Under Review' && grc.classification !== 'Unclassified' && grc.classification !== 'False Positive') {
      updates.status = 'CASE_CANDIDATE';
    } else if (grc.status === 'Closed' && grc.classification === 'False Positive') {
      updates.status = 'DISMISSED';
    } else {
      updates.status = newStatus;
    }
  }

  // Severity — preserve CRITICAL if GRC maps it to High (GRC has no Critical level)
  const newSeverity = GRC_SEVERITY_TO_V3[grc.severity];
  if (newSeverity && newSeverity !== original.severity) {
    // Don't downgrade CRITICAL to HIGH just because GRC lacks a Critical level
    if (!(original.severity === 'CRITICAL' && newSeverity === 'HIGH')) {
      updates.severity = newSeverity;
    }
  }

  // Owner
  if (grc.assignedTo?.name && grc.assignedTo.name !== 'Unassigned' && grc.assignedTo.name !== original.assignedOwner) {
    updates.assignedOwner = grc.assignedTo.name;
  }

  // Classification → deficiencyType
  if (grc.classification !== 'Unclassified') {
    const classToDeficiency: Record<string, string> = {
      'System Deficiency': 'SYSTEM_DEFICIENCY',
      'Design Deficiency': 'DESIGN_DEFICIENCY',
      'Procedural Non-Compliance': 'OPERATING_DEFICIENCY',
      'Business as Usual': 'DATA_DEFICIENCY',
      'False Positive': '',
    };
    const defType = classToDeficiency[grc.classification];
    if (defType && defType !== original.deficiencyType) {
      updates.deficiencyType = defType;
    }
  }

  return updates;
}
