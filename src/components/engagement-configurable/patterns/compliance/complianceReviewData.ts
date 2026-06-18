// ─── Compliance Review — Types & Helpers ──────────────────────────────────

export type ReviewStatus = 'NOT_SUBMITTED' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
export type ReviewAction = 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'RESUBMITTED';

export interface ReviewHistoryItem {
  id: string;
  action: ReviewAction;
  actor: string;
  timestamp: string;
  comments: string;
}

export interface ControlReviewState {
  controlId: string;
  status: ReviewStatus;
  submittedBy: string;
  submittedAt: string | null;
  reviewedBy: string;
  reviewedAt: string | null;
  reviewerComments: string;
  rejectionReason: string;
  history: ReviewHistoryItem[];
}

export interface ComplianceReviewState {
  reviews: ControlReviewState[];
}

export function getOrCreateControlReview(state: ComplianceReviewState, controlId: string): ControlReviewState {
  const existing = state.reviews.find(r => r.controlId === controlId);
  if (existing) return existing;
  return {
    controlId,
    status: 'NOT_SUBMITTED',
    submittedBy: '',
    submittedAt: null,
    reviewedBy: '',
    reviewedAt: null,
    reviewerComments: '',
    rejectionReason: '',
    history: [],
  };
}

function now(): string {
  return new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function submitForReview(state: ComplianceReviewState, controlId: string, submittedBy: string): ComplianceReviewState {
  const review = getOrCreateControlReview(state, controlId);
  const updated: ControlReviewState = {
    ...review,
    status: 'PENDING_REVIEW',
    submittedBy,
    submittedAt: now(),
    history: [...review.history, { id: `rh-${Date.now()}`, action: review.history.some(h => h.action === 'REJECTED') ? 'RESUBMITTED' : 'SUBMITTED', actor: submittedBy, timestamp: now(), comments: '' }],
  };
  return { reviews: state.reviews.some(r => r.controlId === controlId) ? state.reviews.map(r => r.controlId === controlId ? updated : r) : [...state.reviews, updated] };
}

export function approveReview(state: ComplianceReviewState, controlId: string, reviewer: string, comments: string): ComplianceReviewState {
  const review = getOrCreateControlReview(state, controlId);
  const updated: ControlReviewState = {
    ...review,
    status: 'APPROVED',
    reviewedBy: reviewer,
    reviewedAt: now(),
    reviewerComments: comments,
    history: [...review.history, { id: `rh-${Date.now()}`, action: 'APPROVED', actor: reviewer, timestamp: now(), comments }],
  };
  return { reviews: state.reviews.map(r => r.controlId === controlId ? updated : r) };
}

export function rejectReview(state: ComplianceReviewState, controlId: string, reviewer: string, reason: string): ComplianceReviewState {
  const review = getOrCreateControlReview(state, controlId);
  const updated: ControlReviewState = {
    ...review,
    status: 'REJECTED',
    reviewedBy: reviewer,
    reviewedAt: now(),
    rejectionReason: reason,
    reviewerComments: reason,
    history: [...review.history, { id: `rh-${Date.now()}`, action: 'REJECTED', actor: reviewer, timestamp: now(), comments: reason }],
  };
  return { reviews: state.reviews.map(r => r.controlId === controlId ? updated : r) };
}
