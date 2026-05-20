// ─── Compliance — Review Tab ──────────────────────────────────────────────
// Submit/approve/reject flow for control working paper. No conclusion here.

import React, { useState } from 'react';
import {
  Send, CheckCircle2, AlertCircle, XCircle, RotateCcw, ChevronRight, Clock, FileText, Info, Eye,
} from 'lucide-react';
import type { ConfigurableEngagement } from '../../configurableEngagementTypes';
import { MOCK_COMPLIANCE_CONTROLS } from './complianceControlScopeData';
import type { ComplianceWorkspaceState } from './complianceRequestsData';
import { deriveComplianceTestingSummary, deriveComplianceSampleResult } from './complianceAttributeTestingData';
import {
  getOrCreateControlReview, submitForReview, approveReview, rejectReview,
  type ComplianceReviewState, type ControlReviewState,
} from './complianceReviewData';

const STATUS_CLS = {
  NOT_SUBMITTED: 'bg-gray-100 text-gray-600',
  PENDING_REVIEW: 'bg-purple-50 text-purple-700',
  APPROVED: 'bg-emerald-50 text-emerald-700',
  REJECTED: 'bg-red-50 text-red-700',
};
const ACTION_CLS = { SUBMITTED: 'text-blue-600', APPROVED: 'text-emerald-600', REJECTED: 'text-red-600', RESUBMITTED: 'text-purple-600' };
const ACTION_ICON = { SUBMITTED: Send, APPROVED: CheckCircle2, REJECTED: XCircle, RESUBMITTED: RotateCcw };

interface Props {
  engagement: ConfigurableEngagement;
  complianceState: ComplianceWorkspaceState;
  onUpdateReview: (state: ComplianceReviewState) => void;
  onNavigateTab?: (tabId: string) => void;
}

export default function ComplianceReviewTab({ engagement, complianceState, onUpdateReview, onNavigateTab }: Props) {
  const testItems = complianceState.samplesEvidence.batches.flatMap(b => b.testItems);
  const results = complianceState.attributeTesting.results;
  const reviewState = complianceState.review;

  const controlIdsWithItems = [...new Set(testItems.map(ti => ti.linkedControlId))];
  const controlsWithItems = MOCK_COMPLIANCE_CONTROLS.filter(c => controlIdsWithItems.includes(c.id));
  const [selectedControlId, setSelectedControlId] = useState(controlsWithItems[0]?.id || '');

  const ctrlReview = getOrCreateControlReview(reviewState, selectedControlId);
  const ctrlResults = results.filter(r => r.controlId === selectedControlId);
  const ctrlTestItems = testItems.filter(ti => ti.linkedControlId === selectedControlId);
  const ctrlEvidence = complianceState.samplesEvidence.evidence.filter(e => e.linkedControlId === selectedControlId);
  const summary = deriveComplianceTestingSummary(ctrlResults);
  const passedSamples = ctrlTestItems.filter(ti => deriveComplianceSampleResult(ti.id, results) === 'PASS').length;
  const failedSamples = ctrlTestItems.filter(ti => deriveComplianceSampleResult(ti.id, results) === 'FAIL').length;

  const [reviewComments, setReviewComments] = useState('');

  const testingComplete = summary.completionPercent === 100;
  const hasItems = ctrlTestItems.length > 0;
  const hasReviewer = !!engagement.reviewer;
  const canSubmit = hasItems && testingComplete && hasReviewer && (ctrlReview.status === 'NOT_SUBMITTED' || ctrlReview.status === 'REJECTED');

  // Empty state
  if (testItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertCircle size={24} className="text-gray-300 mb-3" />
        <h4 className="text-[14px] font-semibold text-text mb-1">Review</h4>
        <p className="text-[12px] text-text-muted mb-4">Prepare samples and complete attribute testing before review.</p>
        <button onClick={() => onNavigateTab?.('samples-evidence')}
          className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-[12px] font-semibold cursor-pointer transition-colors flex items-center gap-1">
          Go to Samples & Evidence <ChevronRight size={12} />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-[15px] font-bold text-text mb-0.5">Review</h3>
        <p className="text-[12px] text-text-muted">Submit working paper and testing results for reviewer approval.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-6 gap-2">
        {[
          { label: 'Review Status', value: ctrlReview.status.replace(/_/g, ' '), cls: ctrlReview.status === 'APPROVED' ? 'text-emerald-600' : ctrlReview.status === 'REJECTED' ? 'text-red-600' : ctrlReview.status === 'PENDING_REVIEW' ? 'text-purple-600' : '' },
          { label: 'Testing', value: `${summary.completionPercent}%`, cls: testingComplete ? 'text-emerald-600' : 'text-amber-600' },
          { label: 'Failed Checks', value: summary.failedChecks, cls: summary.failedChecks > 0 ? 'text-red-600' : '' },
          { label: 'Evidence', value: ctrlEvidence.length },
          { label: 'Working Paper', value: 'Draft' },
          { label: 'Reviewer', value: engagement.reviewer || '—' },
        ].map(s => (
          <div key={s.label} className="rounded-lg border border-border-light p-2 text-center">
            <div className={`text-[14px] font-bold tabular-nums ${s.cls || 'text-text'}`}>{s.value}</div>
            <div className="text-[8px] text-gray-400 font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Control selector */}
      <div className="flex items-center gap-1">
        {controlsWithItems.map(c => {
          const r = getOrCreateControlReview(reviewState, c.id);
          return (
            <button key={c.id} onClick={() => { setSelectedControlId(c.id); setReviewComments(''); }}
              className={`px-2.5 py-1 rounded-full text-[9px] font-semibold cursor-pointer transition-colors ${selectedControlId === c.id ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
              {c.id} {r.status !== 'NOT_SUBMITTED' && <span className="ml-1">({r.status.replace(/_/g, ' ').toLowerCase()})</span>}
            </button>
          );
        })}
      </div>

      {/* Status-specific content */}
      {ctrlReview.status === 'NOT_SUBMITTED' && (
        <NotSubmittedView
          review={ctrlReview} engagement={engagement} summary={summary}
          ctrlTestItems={ctrlTestItems} ctrlEvidence={ctrlEvidence}
          passedSamples={passedSamples} failedSamples={failedSamples}
          testingComplete={testingComplete} hasReviewer={hasReviewer} canSubmit={canSubmit}
          onSubmit={() => onUpdateReview(submitForReview(reviewState, selectedControlId, engagement.owner))}
          onNavigateTab={onNavigateTab}
        />
      )}
      {ctrlReview.status === 'PENDING_REVIEW' && (
        <PendingReviewView
          review={ctrlReview} engagement={engagement}
          reviewComments={reviewComments} setReviewComments={setReviewComments}
          onApprove={() => onUpdateReview(approveReview(reviewState, selectedControlId, engagement.reviewer || 'Audit Lead', reviewComments))}
          onReject={() => { if (reviewComments.trim()) onUpdateReview(rejectReview(reviewState, selectedControlId, engagement.reviewer || 'Audit Lead', reviewComments)); }}
          onNavigateTab={onNavigateTab}
        />
      )}
      {ctrlReview.status === 'APPROVED' && (
        <ApprovedView review={ctrlReview} onNavigateTab={onNavigateTab} />
      )}
      {ctrlReview.status === 'REJECTED' && (
        <RejectedView
          review={ctrlReview}
          onResubmit={() => onUpdateReview(submitForReview(reviewState, selectedControlId, engagement.owner))}
          onNavigateTab={onNavigateTab}
        />
      )}

      {/* Review History */}
      {ctrlReview.history.length > 0 && (
        <div className="rounded-lg border border-border-light p-4">
          <h4 className="text-[11px] font-bold text-text mb-2">Review History</h4>
          <div className="space-y-2">
            {ctrlReview.history.map(h => {
              const Icon = ACTION_ICON[h.action];
              return (
                <div key={h.id} className="flex items-start gap-2 text-[10px]">
                  <Icon size={12} className={`shrink-0 mt-0.5 ${ACTION_CLS[h.action]}`} />
                  <div>
                    <span className={`font-semibold ${ACTION_CLS[h.action]}`}>{h.action.replace(/_/g, ' ')}</span>
                    <span className="text-gray-400 ml-2">by {h.actor} · {h.timestamp}</span>
                    {h.comments && <p className="text-gray-500 mt-0.5 italic">"{h.comments}"</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Not Submitted View ───────────────────────────────────────────────────

function NotSubmittedView({ review, engagement, summary, ctrlTestItems, ctrlEvidence, passedSamples, failedSamples, testingComplete, hasReviewer, canSubmit, onSubmit, onNavigateTab }: {
  review: ControlReviewState; engagement: ConfigurableEngagement; summary: ReturnType<typeof deriveComplianceTestingSummary>;
  ctrlTestItems: { id: string }[]; ctrlEvidence: { id: string }[];
  passedSamples: number; failedSamples: number;
  testingComplete: boolean; hasReviewer: boolean; canSubmit: boolean;
  onSubmit: () => void; onNavigateTab?: (tabId: string) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Readiness checklist */}
      <div className="rounded-lg border border-border-light p-4 space-y-2">
        <h4 className="text-[11px] font-bold text-text mb-1">Review Readiness</h4>
        <div className="space-y-1">
          {[
            { label: 'Samples/test items prepared', ok: ctrlTestItems.length > 0 },
            { label: 'Evidence mapped', ok: ctrlEvidence.length > 0 },
            { label: 'Attribute testing complete', ok: testingComplete },
            { label: 'Working paper draft available', ok: ctrlTestItems.length > 0 },
            { label: 'Reviewer assigned', ok: hasReviewer },
          ].map(c => (
            <div key={c.label} className="flex items-center gap-2 text-[10px]">
              {c.ok ? <CheckCircle2 size={10} className="text-emerald-500" /> : <AlertCircle size={10} className="text-amber-400" />}
              <span className={c.ok ? 'text-gray-500' : 'text-text'}>{c.label}</span>
            </div>
          ))}
        </div>
        {!testingComplete && (
          <div className="flex items-start gap-2 mt-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[10px] text-amber-700">
            <AlertCircle size={12} className="shrink-0 mt-0.5" />
            <span>Complete all required attribute checks before submitting for review.</span>
          </div>
        )}
      </div>

      {/* Testing summary */}
      <div className="rounded-lg border border-border-light p-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-[11px] font-bold text-text">Testing Package Summary</h4>
          <button onClick={() => onNavigateTab?.('working-paper')} className="flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline cursor-pointer">
            <Eye size={10} />View Working Paper
          </button>
        </div>
        <div className="grid grid-cols-4 gap-3 text-[11px]">
          <div><span className="text-gray-400 block text-[10px]">Test Items</span><span className="text-text font-medium tabular-nums">{ctrlTestItems.length}</span></div>
          <div><span className="text-gray-400 block text-[10px]">Evidence Files</span><span className="text-text font-medium tabular-nums">{ctrlEvidence.length}</span></div>
          <div><span className="text-gray-400 block text-[10px]">Passed Samples</span><span className="text-emerald-600 font-medium tabular-nums">{passedSamples}</span></div>
          <div><span className="text-gray-400 block text-[10px]">Failed Samples</span><span className={`font-medium tabular-nums ${failedSamples > 0 ? 'text-red-600' : 'text-gray-400'}`}>{failedSamples}</span></div>
        </div>
      </div>

      {/* Submit */}
      <button onClick={onSubmit} disabled={!canSubmit}
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-[12px] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
        <Send size={13} />Submit for Review
      </button>
    </div>
  );
}

// ─── Pending Review View ──────────────────────────────────────────────────

function PendingReviewView({ review, engagement, reviewComments, setReviewComments, onApprove, onReject, onNavigateTab }: {
  review: ControlReviewState; engagement: ConfigurableEngagement;
  reviewComments: string; setReviewComments: (v: string) => void;
  onApprove: () => void; onReject: () => void;
  onNavigateTab?: (tabId: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border-2 border-purple-200/40 bg-purple-50/10 p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
          <span className="text-[12px] font-bold text-text">Pending Review</span>
          <span className="text-[10px] text-gray-400">Submitted {review.submittedAt} by {review.submittedBy}</span>
        </div>
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-blue-50/50 border border-blue-200/50 text-[10px] text-blue-600">
          <Info size={11} className="shrink-0 mt-0.5" />
          <span>Testing changes after submission should require resubmission.</span>
        </div>
      </div>

      <div className="rounded-lg border border-border-light p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-[11px] font-bold text-text">Reviewer Actions</h4>
          <button onClick={() => onNavigateTab?.('working-paper')} className="flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline cursor-pointer">
            <Eye size={10} />View Working Paper
          </button>
        </div>
        <div className="text-[10px] text-gray-500 mb-3">
          Reviewer: <span className="text-text font-medium">{engagement.reviewer || 'Audit Lead'}</span>
        </div>
        <div className="mb-3">
          <label className="text-[10px] font-semibold text-gray-500 block mb-1">Review Comments</label>
          <textarea value={reviewComments} onChange={e => setReviewComments(e.target.value)} rows={3}
            placeholder="Add review comments..."
            className="w-full px-3 py-2 border border-border rounded-lg text-[11px] text-text bg-white outline-none focus:border-primary/40 resize-none" />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onApprove}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-semibold cursor-pointer transition-colors">
            <CheckCircle2 size={13} />Approve
          </button>
          <button onClick={onReject} disabled={!reviewComments.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 text-[12px] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            <RotateCcw size={13} />Reject
          </button>
          {!reviewComments.trim() && (
            <span className="text-[10px] text-gray-400 italic">Comments required to reject</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Approved View ────────────────────────────────────────────────────────

function ApprovedView({ review, onNavigateTab }: { review: ControlReviewState; onNavigateTab?: (tabId: string) => void }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border-2 border-emerald-200/50 bg-emerald-50/20 p-5">
        <div className="flex items-center gap-3 mb-2">
          <CheckCircle2 size={20} className="text-emerald-600" />
          <div>
            <h4 className="text-[14px] font-bold text-emerald-800">Review Approved</h4>
            <p className="text-[11px] text-emerald-600 mt-0.5">Reviewed by {review.reviewedBy} on {review.reviewedAt}</p>
          </div>
        </div>
        {review.reviewerComments && <p className="text-[11px] text-emerald-700 italic mt-2">"{review.reviewerComments}"</p>}
      </div>
      <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/15 text-[11px] text-primary">
        <Info size={12} className="shrink-0 mt-0.5" />
        <span>Conclusion is now available. Go to the Conclusion tab to view the derived control conclusion.</span>
      </div>
      <button onClick={() => onNavigateTab?.('conclusion')}
        className="flex items-center gap-1 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-[12px] font-semibold cursor-pointer transition-colors">
        Go to Conclusion <ChevronRight size={12} />
      </button>
    </div>
  );
}

// ─── Rejected View ────────────────────────────────────────────────────────

function RejectedView({ review, onResubmit, onNavigateTab }: { review: ControlReviewState; onResubmit: () => void; onNavigateTab?: (tabId: string) => void }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border-2 border-red-200/50 bg-red-50/20 p-5">
        <div className="flex items-center gap-3 mb-2">
          <XCircle size={20} className="text-red-600" />
          <div>
            <h4 className="text-[14px] font-bold text-red-800">Review Rejected</h4>
            <p className="text-[11px] text-red-600 mt-0.5">Reviewed by {review.reviewedBy} on {review.reviewedAt}</p>
          </div>
        </div>
        {review.rejectionReason && <p className="text-[11px] text-red-700 italic mt-2">"{review.rejectionReason}"</p>}
      </div>
      <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-700">
        <AlertCircle size={12} className="shrink-0 mt-0.5" />
        <span>Tester must address reviewer comments and resubmit. Go to Attribute Testing to fix issues, then resubmit.</span>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={() => onNavigateTab?.('attr-testing')}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border-light text-[11px] font-medium text-text-muted hover:bg-surface-2/30 cursor-pointer transition-colors">
          Go to Attribute Testing <ChevronRight size={11} />
        </button>
        <button onClick={onResubmit}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-[12px] font-semibold cursor-pointer transition-colors">
          <RotateCcw size={13} />Resubmit for Review
        </button>
      </div>
    </div>
  );
}
