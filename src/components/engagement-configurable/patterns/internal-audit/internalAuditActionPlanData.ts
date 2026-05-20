// ─── Internal Audit Action Plan — Types & Helpers ─────────────────────────

export type ActionItemStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE' | 'DEFERRED' | 'CANCELLED';
export type ActionPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ActionPlanHistoryItem { id: string; action: string; actor: string; timestamp: string; comments: string }

export interface InternalAuditActionItem {
  id: string;
  sourceObservationId: string;
  sourceObservationTitle: string;
  title: string;
  description: string;
  owner: string;
  priority: ActionPriority;
  dueDate: string;
  status: ActionItemStatus;
  remediationEvidence: string[];
  comments: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  history: ActionPlanHistoryItem[];
}

export interface InternalAuditActionPlanState {
  actionItems: InternalAuditActionItem[];
  initializedFromReport: boolean;
  followUpRequired: boolean;
  followUpNotes: string;
}

export const ACTION_STATUS_CLS: Record<ActionItemStatus, string> = {
  NOT_STARTED: 'bg-gray-100 text-gray-600', IN_PROGRESS: 'bg-blue-50 text-blue-700',
  COMPLETED: 'bg-emerald-50 text-emerald-700', OVERDUE: 'bg-red-50 text-red-700',
  DEFERRED: 'bg-amber-50 text-amber-700', CANCELLED: 'bg-gray-50 text-gray-400',
};
export const PRIORITY_CLS: Record<ActionPriority, string> = {
  LOW: 'bg-gray-100 text-gray-600', MEDIUM: 'bg-blue-50 text-blue-700', HIGH: 'bg-amber-50 text-amber-700', CRITICAL: 'bg-red-50 text-red-700',
};
export const PRIORITIES_LIST: ActionPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

function now(): string { return new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }

// ─── Initialize from Discussion ───────────────────────────────────────────

import type { InternalAuditWorkspaceState } from './internalAuditScopeData';

export function initializeActionItems(existing: InternalAuditActionItem[], iaState: InternalAuditWorkspaceState, actor: string): InternalAuditActionItem[] {
  const existingObsIds = new Set(existing.filter(a => a.sourceObservationId).map(a => a.sourceObservationId));
  const agreedItems = iaState.discussion.items.filter(d =>
    (d.status === 'AGREED' || d.status === 'READY_FOR_REPORT') && d.agreedAction.trim() && !existingObsIds.has(d.observationId)
  );

  const newItems: InternalAuditActionItem[] = agreedItems.map(d => {
    const obs = iaState.observations.observations.find(o => o.id === d.observationId);
    const priority: ActionPriority = obs?.severity === 'CRITICAL' ? 'CRITICAL' : obs?.severity === 'HIGH' ? 'HIGH' : obs?.severity === 'MEDIUM' ? 'MEDIUM' : 'LOW';
    return {
      id: `ap-${Date.now()}-${d.observationId}`,
      sourceObservationId: d.observationId,
      sourceObservationTitle: d.observationTitle,
      title: `Remediate: ${d.observationTitle}`,
      description: d.agreedAction,
      owner: d.actionOwner || obs?.processOwner || '',
      priority,
      dueDate: d.targetDate || obs?.targetRemediationDate || '',
      status: 'NOT_STARTED',
      remediationEvidence: [],
      comments: '',
      createdAt: new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toISOString().slice(0, 10),
      completedAt: null,
      history: [{ id: `aph-${Date.now()}`, action: 'CREATED', actor, timestamp: now(), comments: 'Generated from agreed observation action.' }],
    };
  });

  return [...existing, ...newItems];
}

export function deriveActionPlanSummary(state: InternalAuditActionPlanState) {
  const items = state.actionItems;
  return {
    total: items.length,
    notStarted: items.filter(i => i.status === 'NOT_STARTED').length,
    inProgress: items.filter(i => i.status === 'IN_PROGRESS').length,
    completed: items.filter(i => i.status === 'COMPLETED').length,
    overdue: items.filter(i => i.status === 'OVERDUE' || (i.dueDate && new Date(i.dueDate) < new Date() && !['COMPLETED', 'CANCELLED', 'DEFERRED'].includes(i.status))).length,
    criticalHigh: items.filter(i => (i.priority === 'CRITICAL' || i.priority === 'HIGH') && !['COMPLETED', 'CANCELLED'].includes(i.status)).length,
    followUp: state.followUpRequired,
  };
}
