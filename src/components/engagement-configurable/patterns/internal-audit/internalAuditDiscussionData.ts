// ─── Internal Audit Discussion — Types & Helpers ──────────────────────────

export type DiscussionItemStatus = 'NOT_STARTED' | 'SENT_TO_MANAGEMENT' | 'RESPONSE_RECEIVED' | 'AGREED' | 'DISAGREED' | 'READY_FOR_REPORT';

export interface DiscussionHistoryItem {
  id: string;
  action: string;
  actor: string;
  timestamp: string;
  comments: string;
}

export interface ObservationDiscussionItem {
  id: string;
  observationId: string;
  observationTitle: string;
  observationSeverity: string;
  linkedScopeLabel: string;
  status: DiscussionItemStatus;
  managementResponse: string;
  managementRationale: string;
  agreedAction: string;
  actionOwner: string;
  targetDate: string;
  remediationRequired: boolean;
  lastUpdatedAt: string;
  history: DiscussionHistoryItem[];
}

export interface DiscussionNote {
  id: string;
  observationId: string;
  note: string;
  author: string;
  createdAt: string;
}

export interface InternalAuditDiscussionState {
  items: ObservationDiscussionItem[];
  notes: DiscussionNote[];
  noObsDiscussionConfirmed: boolean;
}

function now(): string { return new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }

export function initializeDiscussionItems(
  existingItems: ObservationDiscussionItem[],
  observations: { id: string; title: string; severity: string; linkedScopeLabel: string; status: string; processOwner: string; targetRemediationDate: string }[],
): ObservationDiscussionItem[] {
  const existingIds = new Set(existingItems.map(i => i.observationId));
  const readyObs = observations.filter(o => o.status === 'READY_FOR_DISCUSSION' && !existingIds.has(o.id));
  const ts = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const newItems: ObservationDiscussionItem[] = readyObs.map(o => ({
    id: `di-${Date.now()}-${o.id}`,
    observationId: o.id,
    observationTitle: o.title,
    observationSeverity: o.severity,
    linkedScopeLabel: o.linkedScopeLabel,
    status: 'SENT_TO_MANAGEMENT' as DiscussionItemStatus,
    managementResponse: '',
    managementRationale: '',
    agreedAction: '',
    actionOwner: o.processOwner || '',
    targetDate: o.targetRemediationDate || '',
    remediationRequired: true,
    lastUpdatedAt: new Date().toISOString().slice(0, 10),
    history: [{ id: `dh-${Date.now()}-${o.id}`, action: 'SENT_TO_PROCESS_OWNER', actor: 'Auditor', timestamp: ts, comments: 'Observation sent to process owner from Observations tab.' }],
  }));
  return [...existingItems, ...newItems];
}

export function deriveDiscussionSummary(state: InternalAuditDiscussionState) {
  const items = state.items;
  return {
    total: items.length,
    notStarted: items.filter(i => i.status === 'NOT_STARTED').length,
    sentToMgmt: items.filter(i => i.status === 'SENT_TO_MANAGEMENT').length,
    responseReceived: items.filter(i => i.status === 'RESPONSE_RECEIVED').length,
    agreed: items.filter(i => i.status === 'AGREED').length,
    disagreed: items.filter(i => i.status === 'DISAGREED').length,
    readyForReport: items.filter(i => i.status === 'READY_FOR_REPORT').length,
    noObsConfirmed: state.noObsDiscussionConfirmed,
  };
}

export const DISC_STATUS_CLS: Record<DiscussionItemStatus, string> = {
  NOT_STARTED: 'bg-gray-100 text-gray-600',
  SENT_TO_MANAGEMENT: 'bg-blue-50 text-blue-700',
  RESPONSE_RECEIVED: 'bg-purple-50 text-purple-700',
  AGREED: 'bg-emerald-50 text-emerald-700',
  DISAGREED: 'bg-red-50 text-red-700',
  READY_FOR_REPORT: 'bg-primary/10 text-primary',
};
