// ─── Internal Audit Observations — Types & Helpers ────────────────────────

export type ObservationSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ObservationCategory = 'CONTROL_GAP' | 'PROCESS_GAP' | 'COMPLIANCE_GAP' | 'DATA_EXCEPTION' | 'DOCUMENTATION_GAP' | 'OTHER';
export type ObservationSourceType = 'ANALYSIS_EXCEPTION' | 'MANUAL' | 'CHECKLIST' | 'OTHER';
export type ObservationStatus = 'DRAFT' | 'READY_FOR_DISCUSSION' | 'IN_DISCUSSION' | 'AGREED' | 'DROPPED';

export interface ObservationHistoryItem {
  id: string;
  action: string;
  actor: string;
  timestamp: string;
  comments: string;
}

export interface InternalAuditObservation {
  id: string;
  title: string;
  description: string;
  sourceType: ObservationSourceType;
  sourceRunId: string;
  linkedExceptionIds: string[];
  linkedScopeLabel: string;
  severity: ObservationSeverity;
  riskRating: ObservationSeverity;
  observationCategory: ObservationCategory;
  rootCause: string;
  impact: string;
  recommendation: string;
  processOwner: string;
  targetRemediationDate: string;
  linkedControlName?: string;
  status: ObservationStatus;
  createdAt: string;
  updatedAt: string;
  history: ObservationHistoryItem[];
}

export interface InternalAuditObservationsState {
  observations: InternalAuditObservation[];
  noObservationsConfirmed: boolean;
  noObservationsConfirmedBy: string;
  noObservationsConfirmedAt: string | null;
  dismissedPotentialObsIds: string[];
}

export const CATEGORY_LABELS: Record<ObservationCategory, string> = {
  CONTROL_GAP: 'Control Gap', PROCESS_GAP: 'Process Gap', COMPLIANCE_GAP: 'Compliance Gap',
  DATA_EXCEPTION: 'Data Exception', DOCUMENTATION_GAP: 'Documentation Gap', OTHER: 'Other',
};
export const CATEGORIES_LIST: ObservationCategory[] = ['CONTROL_GAP', 'PROCESS_GAP', 'COMPLIANCE_GAP', 'DATA_EXCEPTION', 'DOCUMENTATION_GAP', 'OTHER'];
export const SEVERITIES_LIST: ObservationSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export const SEVERITY_CLS: Record<ObservationSeverity, string> = {
  LOW: 'bg-gray-100 text-gray-600', MEDIUM: 'bg-blue-50 text-blue-700', HIGH: 'bg-amber-50 text-amber-700', CRITICAL: 'bg-red-50 text-red-700',
};
export const STATUS_CLS: Record<ObservationStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-600', READY_FOR_DISCUSSION: 'bg-blue-50 text-blue-700',
  IN_DISCUSSION: 'bg-purple-50 text-purple-700', AGREED: 'bg-emerald-50 text-emerald-700', DROPPED: 'bg-gray-50 text-gray-400',
};

function now(): string { return new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }

export function validateObservationForDiscussion(obs: InternalAuditObservation): string[] {
  const missing: string[] = [];
  if (!obs.title.trim()) missing.push('Title');
  if (!obs.description.trim()) missing.push('Description');
  if (!obs.rootCause.trim()) missing.push('Root Cause');
  if (!obs.impact.trim()) missing.push('Impact');
  if (!obs.recommendation.trim()) missing.push('Recommendation');
  if (!obs.processOwner.trim()) missing.push('Process Owner');
  return missing;
}

export function deriveObservationsSummary(state: InternalAuditObservationsState) {
  const obs = state.observations;
  const active = obs.filter(o => o.status !== 'DROPPED');
  return {
    total: obs.length,
    draft: obs.filter(o => o.status === 'DRAFT').length,
    readyForDiscussion: obs.filter(o => o.status === 'READY_FOR_DISCUSSION').length,
    criticalHigh: active.filter(o => o.severity === 'CRITICAL' || o.severity === 'HIGH').length,
    fromAnalysis: obs.filter(o => o.sourceType === 'ANALYSIS_EXCEPTION').length,
    noObsConfirmed: state.noObservationsConfirmed,
  };
}
