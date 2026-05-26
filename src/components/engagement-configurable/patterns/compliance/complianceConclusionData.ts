// ─── Compliance Conclusion — Types & Helpers ──────────────────────────────

import { MOCK_COMPLIANCE_CONTROLS } from './complianceControlScopeData';
import { deriveComplianceSampleResult, type AttributeTestResult } from './complianceAttributeTestingData';
import { type ControlReviewState } from './complianceReviewData';
import type { TestItem } from './complianceSamplesEvidenceData';

export type ConclusionValue = 'EFFECTIVE' | 'PARTIALLY_EFFECTIVE' | 'INEFFECTIVE' | 'NOT_APPLICABLE';
export type ConclusionStatus = 'LOCKED' | 'READY' | 'FINALIZED';
export type ConclusionAction = 'FINALIZED' | 'UPDATED';

export interface ConclusionHistoryItem {
  id: string;
  action: ConclusionAction;
  actor: string;
  timestamp: string;
  comments: string;
  value: ConclusionValue;
}

export interface ControlConclusionState {
  controlId: string;
  status: ConclusionStatus;
  recommendedConclusion: ConclusionValue | null;
  finalConclusion: ConclusionValue | null;
  reason: string;
  remarks: string;
  generatedAt: string | null;
  finalizedAt: string | null;
  finalizedBy: string;
  history: ConclusionHistoryItem[];
}

export interface ComplianceConclusionState {
  conclusions: ControlConclusionState[];
}

export function getOrCreateControlConclusion(state: ComplianceConclusionState, controlId: string): ControlConclusionState {
  return state.conclusions.find(c => c.controlId === controlId) || {
    controlId, status: 'LOCKED', recommendedConclusion: null, finalConclusion: null,
    reason: '', remarks: '', generatedAt: null, finalizedAt: null, finalizedBy: '', history: [],
  };
}

// ─── Derivation ───────────────────────────────────────────────────────────

export interface ConclusionDerivation {
  recommendedConclusion: ConclusionValue | null;
  reason: string;
  totalSamples: number;
  passedSamples: number;
  failedSamples: number;
  pendingSamples: number;
  failedAttributes: { testItemRef: string; attrCode: string; attrName: string; assertion: string; notes: string }[];
}

export function deriveComplianceControlConclusion(
  controlId: string,
  results: AttributeTestResult[],
  testItems: TestItem[],
  reviewState: ControlReviewState | undefined,
): ConclusionDerivation {
  const empty: ConclusionDerivation = { recommendedConclusion: null, reason: '', totalSamples: 0, passedSamples: 0, failedSamples: 0, pendingSamples: 0, failedAttributes: [] };

  if (!reviewState || reviewState.status !== 'APPROVED') {
    return { ...empty, reason: 'Review has not been approved yet.' };
  }

  const ctrl = MOCK_COMPLIANCE_CONTROLS.find(c => c.id === controlId);
  if (!ctrl) return { ...empty, reason: 'Control not found.' };

  const ctrlItems = testItems.filter(ti => ti.linkedControlId === controlId);
  if (ctrlItems.length === 0) {
    return { ...empty, recommendedConclusion: 'NOT_APPLICABLE', reason: 'No applicable test items were available for this control.' };
  }

  const ctrlResults = results.filter(r => r.controlId === controlId);
  const totalSamples = ctrlItems.length;
  let passedSamples = 0;
  let failedSamples = 0;
  let pendingSamples = 0;
  const failedAttributes: ConclusionDerivation['failedAttributes'] = [];

  for (const ti of ctrlItems) {
    const sr = deriveComplianceSampleResult(ti.id, ctrlResults);
    if (sr === 'PASS') passedSamples++;
    else if (sr === 'FAIL') failedSamples++;
    else pendingSamples++;

    // Collect failed attributes
    for (const ar of ctrlResults.filter(r => r.testItemId === ti.id && r.result === 'FAIL')) {
      const attr = ctrl.attributes.find(a => a.id === ar.attributeId);
      if (attr) {
        failedAttributes.push({ testItemRef: ti.referenceId, attrCode: attr.code, attrName: attr.name, assertion: attr.assertion, notes: ar.notes });
      }
    }
  }

  if (failedSamples === 0 && pendingSamples === 0) {
    return { recommendedConclusion: 'EFFECTIVE', reason: 'All required samples and attributes passed.', totalSamples, passedSamples, failedSamples, pendingSamples, failedAttributes };
  }

  if (pendingSamples > 0) {
    return { recommendedConclusion: null, reason: 'Testing is not fully complete. Some samples are still pending.', totalSamples, passedSamples, failedSamples, pendingSamples, failedAttributes };
  }

  // Partial threshold: ≤ 20% failed
  const failRate = failedSamples / totalSamples;
  if (failRate <= 0.2) {
    return {
      recommendedConclusion: 'PARTIALLY_EFFECTIVE',
      reason: `Exceptions were identified (${failedSamples} of ${totalSamples} samples failed), but they appear limited in scope and may support a partially effective conclusion subject to reviewer judgment.`,
      totalSamples, passedSamples, failedSamples, pendingSamples, failedAttributes,
    };
  }

  return {
    recommendedConclusion: 'INEFFECTIVE',
    reason: `${failedSamples} of ${totalSamples} samples failed required attribute checks.`,
    totalSamples, passedSamples, failedSamples, pendingSamples, failedAttributes,
  };
}

// ─── Actions ──────────────────────────────────────────────────────────────

function now(): string {
  return new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function finalizeConclusion(
  state: ComplianceConclusionState,
  controlId: string,
  value: ConclusionValue,
  remarks: string,
  recommended: ConclusionValue | null,
  reason: string,
  actor: string,
): ComplianceConclusionState {
  const existing = getOrCreateControlConclusion(state, controlId);
  const isUpdate = existing.status === 'FINALIZED';
  const updated: ControlConclusionState = {
    ...existing,
    status: 'FINALIZED',
    recommendedConclusion: recommended,
    finalConclusion: value,
    reason,
    remarks,
    generatedAt: existing.generatedAt || now(),
    finalizedAt: now(),
    finalizedBy: actor,
    history: [...existing.history, { id: `ch-${Date.now()}`, action: isUpdate ? 'UPDATED' : 'FINALIZED', actor, timestamp: now(), comments: remarks, value }],
  };
  const exists = state.conclusions.some(c => c.controlId === controlId);
  return { conclusions: exists ? state.conclusions.map(c => c.controlId === controlId ? updated : c) : [...state.conclusions, updated] };
}

export const CONCLUSION_DISPLAY: Record<ConclusionValue, { label: string; cls: string; icon: 'check' | 'partial' | 'x' | 'minus' }> = {
  EFFECTIVE: { label: 'Effective', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'check' },
  PARTIALLY_EFFECTIVE: { label: 'Partially Effective', cls: 'bg-amber-50 text-amber-700 border-amber-200', icon: 'partial' },
  INEFFECTIVE: { label: 'Ineffective', cls: 'bg-red-50 text-red-700 border-red-200', icon: 'x' },
  NOT_APPLICABLE: { label: 'Not Applicable', cls: 'bg-gray-50 text-gray-600 border-gray-200', icon: 'minus' },
};
