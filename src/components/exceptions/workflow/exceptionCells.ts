import type { GrcException } from '../../../data/mockData';

const STATUS_LABEL: Record<string, string> = { Open: 'Open', 'Under Review': 'In-Progress', Closed: 'Closed' };

/** Read-only display value for an exception field, keyed by column. Mirrors the
 *  ExceptionsTable accessors so the assignee/approver panels stay consistent. */
export function cellDisplay(ex: GrcException, key: string): string {
  switch (key) {
    case 'id': return ex.id;
    case 'title': return ex.title;
    case 'riskCategory': return ex.riskCategory;
    case 'severity': return ex.severity;
    case 'status': return STATUS_LABEL[ex.status] ?? ex.status;
    case 'classification': return ex.classification;
    case 'actionReview': return ex.actionReview;
    case 'dueDate': return ex.dueDate ?? '—';
    case 'actionableId': return ex.bulkId ?? '—';
    case 'lastUpdated': return ex.lastUpdated;
    case 'assignedTo': return (ex.assignees ?? (ex.assignedTo ? [ex.assignedTo] : [])).map(a => a.name).join(', ') || '—';
    default: return '—';
  }
}

export const CLASSIFICATION_OPTIONS = [
  'Business as Usual',
  'False Positive',
  'Design Deficiency',
  'System Deficiency',
  'Procedural Non-Compliance',
];

export const ACTIONABLE_CLASSIFICATIONS = new Set(['Design Deficiency', 'System Deficiency', 'Procedural Non-Compliance']);
