// ─── Compliance — Engagement Summary Tab ──────────────────────────────────
// Engagement-level rollup of scope, testing, review, and conclusion.

import React from 'react';
import { Download, CheckCircle2, AlertCircle, XCircle, AlertTriangle, Clock, Shield } from 'lucide-react';
import type { ConfigurableEngagement, ComplianceConfig } from '../../configurableEngagementTypes';
import { MOCK_COMPLIANCE_CONTROLS, deriveComplianceControlReadiness } from './complianceControlScopeData';
import type { ComplianceWorkspaceState } from './complianceRequestsData';
import { deriveComplianceTestingSummary, deriveComplianceSampleResult } from './complianceAttributeTestingData';
import { getOrCreateControlReview } from './complianceReviewData';
import { getOrCreateControlConclusion, CONCLUSION_DISPLAY, type ConclusionValue } from './complianceConclusionData';

interface Props {
  engagement: ConfigurableEngagement;
  complianceState: ComplianceWorkspaceState;
  onNavigateTab?: (tabId: string) => void;
}

export default function ComplianceSummaryTab({ engagement, complianceState, onNavigateTab }: Props) {
  const cfg = engagement.config as ComplianceConfig;
  const testItems = complianceState.samplesEvidence.batches.flatMap(b => b.testItems);
  const results = complianceState.attributeTesting.results;
  const reviewState = complianceState.review;
  const conclusionState = complianceState.conclusion;
  const controls = MOCK_COMPLIANCE_CONTROLS;

  // Per-control rollup
  const controlRollup = controls.map(ctrl => {
    const readiness = deriveComplianceControlReadiness(ctrl);
    const ctrlItems = testItems.filter(ti => ti.linkedControlId === ctrl.id);
    const ctrlResults = results.filter(r => r.controlId === ctrl.id);
    const testing = deriveComplianceTestingSummary(ctrlResults);
    const review = getOrCreateControlReview(reviewState, ctrl.id);
    const conclusion = getOrCreateControlConclusion(conclusionState, ctrl.id);
    const failedChecks = ctrlResults.filter(r => r.result === 'FAIL').length;
    return { ctrl, readiness, ctrlItems, testing, review, conclusion, failedChecks };
  });

  // Aggregates
  const totalControls = controls.length;
  const readyControls = controlRollup.filter(r => r.readiness.status === 'Ready').length;
  const controlsTested = controlRollup.filter(r => r.testing.completedChecks > 0).length;
  const pendingReview = controlRollup.filter(r => r.review.status === 'PENDING_REVIEW').length;
  const approvedReviews = controlRollup.filter(r => r.review.status === 'APPROVED').length;
  const finalized = controlRollup.filter(r => r.conclusion.status === 'FINALIZED').length;
  const effective = controlRollup.filter(r => r.conclusion.finalConclusion === 'EFFECTIVE').length;
  const partial = controlRollup.filter(r => r.conclusion.finalConclusion === 'PARTIALLY_EFFECTIVE').length;
  const ineffective = controlRollup.filter(r => r.conclusion.finalConclusion === 'INEFFECTIVE').length;
  const notApplicable = controlRollup.filter(r => r.conclusion.finalConclusion === 'NOT_APPLICABLE').length;

  const totalTestingSummary = deriveComplianceTestingSummary(results);
  const allFailedAttrs = results.filter(r => r.result === 'FAIL').map(r => {
    const ctrl = MOCK_COMPLIANCE_CONTROLS.find(c => c.id === r.controlId);
    const attr = ctrl?.attributes.find(a => a.id === r.attributeId);
    const ti = testItems.find(t => t.id === r.testItemId);
    return { controlId: r.controlId, controlName: ctrl?.name || '—', testItemRef: ti?.referenceId || '—', attrCode: attr?.code || '?', attrName: attr?.name || '—', notes: r.notes };
  });

  // Engagement interpretation
  const allFinalized = finalized === totalControls;
  const hasIneffective = ineffective > 0;
  const hasPending = finalized < totalControls;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[15px] font-bold text-text mb-0.5">Engagement Summary</h3>
          <p className="text-[12px] text-text-muted">Roll-up view of compliance control testing status, review progress, and conclusions.</p>
        </div>
        <button onClick={() => alert('Summary report export will be connected later.')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[11px] font-semibold hover:bg-primary/20 cursor-pointer transition-colors shrink-0">
          <Download size={12} />Export Summary Report
        </button>
      </div>

      {/* Engagement context */}
      <div className="rounded-lg border border-border-light p-4">
        <div className="grid grid-cols-4 gap-3 text-[11px]">
          <div><span className="text-gray-400 block text-[10px]">Engagement</span><span className="text-text font-medium">{engagement.name}</span></div>
          <div><span className="text-gray-400 block text-[10px]">Framework</span><span className="text-text font-medium">{cfg.framework.replace(/_/g, ' ')}</span></div>
          <div><span className="text-gray-400 block text-[10px]">Audit Period</span><span className="text-text font-medium">{cfg.auditPeriodStart || '—'} to {cfg.auditPeriodEnd || '—'}</span></div>
          <div><span className="text-gray-400 block text-[10px]">Owner / Reviewer</span><span className="text-text font-medium">{engagement.owner} / {engagement.reviewer || '—'}</span></div>
        </div>
      </div>

      {/* KPIs — Scope & Testing */}
      <div>
        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Scope & Testing</h4>
        <div className="grid grid-cols-5 gap-2">
          {[
            { label: 'Total Controls', value: totalControls },
            { label: 'Ready Controls', value: readyControls, cls: readyControls === totalControls ? 'text-emerald-600' : '' },
            { label: 'Controls Tested', value: controlsTested },
            { label: 'Test Items', value: testItems.length },
            { label: 'Completion', value: `${totalTestingSummary.completionPercent}%`, cls: totalTestingSummary.completionPercent === 100 ? 'text-emerald-600' : totalTestingSummary.completionPercent > 0 ? 'text-amber-600' : '' },
          ].map(s => (
            <div key={s.label} className="rounded-lg border border-border-light p-2.5 text-center">
              <div className={`text-[16px] font-bold tabular-nums ${s.cls || 'text-text'}`}>{s.value}</div>
              <div className="text-[8px] text-gray-400 font-medium">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* KPIs — Review & Conclusion */}
      <div>
        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Review & Conclusion</h4>
        <div className="grid grid-cols-5 gap-2">
          {[
            { label: 'Approved', value: approvedReviews, cls: 'text-emerald-600' },
            { label: 'Pending Review', value: pendingReview, cls: pendingReview > 0 ? 'text-purple-600' : '' },
            { label: 'Effective', value: effective, cls: 'text-emerald-600' },
            { label: 'Partially Eff.', value: partial, cls: partial > 0 ? 'text-amber-600' : '' },
            { label: 'Ineffective', value: ineffective, cls: ineffective > 0 ? 'text-red-600' : '' },
          ].map(s => (
            <div key={s.label} className="rounded-lg border border-border-light p-2.5 text-center">
              <div className={`text-[16px] font-bold tabular-nums ${s.cls || 'text-text'}`}>{s.value}</div>
              <div className="text-[8px] text-gray-400 font-medium">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Testing Progress */}
      <div className="rounded-lg border border-border-light p-4">
        <h4 className="text-[11px] font-bold text-text mb-2">Testing Progress</h4>
        <div className="grid grid-cols-6 gap-3 text-[11px] mb-2">
          <div><span className="text-gray-400 block text-[10px]">Total Checks</span><span className="text-text font-medium tabular-nums">{totalTestingSummary.totalChecks}</span></div>
          <div><span className="text-gray-400 block text-[10px]">Completed</span><span className="text-text font-medium tabular-nums">{totalTestingSummary.completedChecks}</span></div>
          <div><span className="text-gray-400 block text-[10px]">Passed</span><span className="text-emerald-600 font-medium tabular-nums">{totalTestingSummary.passedChecks}</span></div>
          <div><span className="text-gray-400 block text-[10px]">Failed</span><span className={`font-medium tabular-nums ${totalTestingSummary.failedChecks > 0 ? 'text-red-600' : 'text-gray-400'}`}>{totalTestingSummary.failedChecks}</span></div>
          <div><span className="text-gray-400 block text-[10px]">Pending</span><span className={`font-medium tabular-nums ${totalTestingSummary.pendingChecks > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{totalTestingSummary.pendingChecks}</span></div>
          <div><span className="text-gray-400 block text-[10px]">Progress</span><span className={`font-medium ${totalTestingSummary.completionPercent === 100 ? 'text-emerald-600' : 'text-text'}`}>{totalTestingSummary.completionPercent}%</span></div>
        </div>
        {totalTestingSummary.totalChecks > 0 && (
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div className={`h-2 rounded-full transition-all ${totalTestingSummary.completionPercent === 100 ? 'bg-emerald-500' : 'bg-primary'}`}
              style={{ width: `${totalTestingSummary.completionPercent}%` }} />
          </div>
        )}
      </div>

      {/* Control Rollup Table */}
      <div className="rounded-lg border border-border-light overflow-hidden">
        <div className="px-4 py-2.5 bg-surface-2/20 border-b border-border-light">
          <h4 className="text-[11px] font-bold text-text">Control Rollup</h4>
        </div>
        <table className="w-full text-[10px]">
          <thead>
            <tr className="border-b border-border-light bg-surface-2/30 text-[8px] font-semibold text-gray-400 uppercase">
              <th className="px-3 py-1.5 text-left">Control</th>
              <th className="px-3 py-1.5 text-center">Readiness</th>
              <th className="px-3 py-1.5 text-center">Items</th>
              <th className="px-3 py-1.5 text-center">Testing</th>
              <th className="px-3 py-1.5 text-center">Failed</th>
              <th className="px-3 py-1.5 text-center">Review</th>
              <th className="px-3 py-1.5 text-center">Conclusion</th>
              <th className="px-3 py-1.5 text-center">Next</th>
            </tr>
          </thead>
          <tbody>
            {controlRollup.map(r => {
              const testingLabel = r.testing.totalChecks === 0 ? 'Not Started' : r.testing.completionPercent === 100 ? 'Complete' : 'In Progress';
              const testingCls = testingLabel === 'Complete' ? 'bg-emerald-50 text-emerald-700' : testingLabel === 'In Progress' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-500';
              const reviewCls = r.review.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700' : r.review.status === 'REJECTED' ? 'bg-red-50 text-red-700' : r.review.status === 'PENDING_REVIEW' ? 'bg-purple-50 text-purple-700' : 'bg-gray-100 text-gray-500';
              const conclusionLabel = r.conclusion.finalConclusion ? CONCLUSION_DISPLAY[r.conclusion.finalConclusion].label : r.review.status === 'APPROVED' ? 'Pending' : 'Locked';
              const conclusionCls = r.conclusion.finalConclusion ? CONCLUSION_DISPLAY[r.conclusion.finalConclusion].cls : 'bg-gray-100 text-gray-500';
              const nextAction = deriveNextAction(r);
              return (
                <tr key={r.ctrl.id} className="border-b border-border-light/50">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-gray-400">{r.ctrl.id}</span>
                      <span className="text-text font-medium truncate max-w-[150px]">{r.ctrl.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${r.readiness.severity === 'success' ? 'bg-emerald-50 text-emerald-700' : r.readiness.severity === 'error' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}>{r.readiness.label}</span></td>
                  <td className="px-3 py-2 text-center font-medium tabular-nums">{r.ctrlItems.length}</td>
                  <td className="px-3 py-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${testingCls}`}>{testingLabel}</span></td>
                  <td className="px-3 py-2 text-center"><span className={`font-medium tabular-nums ${r.failedChecks > 0 ? 'text-red-600' : 'text-gray-400'}`}>{r.failedChecks}</span></td>
                  <td className="px-3 py-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${reviewCls}`}>{r.review.status.replace(/_/g, ' ')}</span></td>
                  <td className="px-3 py-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[8px] font-bold border ${conclusionCls}`}>{conclusionLabel}</span></td>
                  <td className="px-3 py-2 text-center"><span className="text-[9px] text-primary font-medium">{nextAction}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Exceptions */}
      <div className="rounded-lg border border-border-light overflow-hidden">
        <div className="px-4 py-2.5 bg-surface-2/20 border-b border-border-light">
          <h4 className="text-[11px] font-bold text-text">Exceptions & Failed Attributes ({allFailedAttrs.length})</h4>
        </div>
        {allFailedAttrs.length === 0 ? (
          <div className="px-4 py-4 text-[11px] text-gray-400 italic flex items-center gap-2">
            <CheckCircle2 size={12} className="text-emerald-500" />No failed attributes identified.
          </div>
        ) : (
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-border-light bg-surface-2/30 text-[8px] font-semibold text-gray-400 uppercase">
                <th className="px-3 py-1.5 text-left">Control</th>
                <th className="px-3 py-1.5 text-left">Sample</th>
                <th className="px-3 py-1.5 text-left">Attr</th>
                <th className="px-3 py-1.5 text-left">Attribute</th>
                <th className="px-3 py-1.5 text-left">Notes</th>
              </tr>
            </thead>
            <tbody>
              {allFailedAttrs.slice(0, 20).map((fa, i) => (
                <tr key={i} className="border-b border-border-light/50">
                  <td className="px-3 py-1.5 text-gray-500">{fa.controlId}</td>
                  <td className="px-3 py-1.5 font-mono text-gray-500">{fa.testItemRef}</td>
                  <td className="px-3 py-1.5 font-bold text-red-600">{fa.attrCode}</td>
                  <td className="px-3 py-1.5 text-text">{fa.attrName}</td>
                  <td className="px-3 py-1.5 text-gray-500 truncate max-w-[200px]">{fa.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Conclusion Rollup */}
      <div className="rounded-lg border border-border-light p-4 space-y-3">
        <h4 className="text-[11px] font-bold text-text">Conclusion Rollup</h4>
        <div className="flex flex-wrap gap-2">
          {([['EFFECTIVE', effective], ['PARTIALLY_EFFECTIVE', partial], ['INEFFECTIVE', ineffective], ['NOT_APPLICABLE', notApplicable]] as [ConclusionValue, number][]).map(([val, count]) => {
            const d = CONCLUSION_DISPLAY[val];
            return (
              <div key={val} className={`px-3 py-2 rounded-lg border ${d.cls} flex items-center gap-2`}>
                <span className="text-[16px] font-bold tabular-nums">{count}</span>
                <span className="text-[10px] font-medium">{d.label}</span>
              </div>
            );
          })}
          <div className="px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-500 flex items-center gap-2">
            <span className="text-[16px] font-bold tabular-nums">{totalControls - finalized}</span>
            <span className="text-[10px] font-medium">Pending</span>
          </div>
        </div>

        {/* Interpretation */}
        <div className={`flex items-start gap-2 px-3 py-2 rounded-lg text-[11px] ${
          allFinalized && !hasIneffective ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' :
          hasIneffective ? 'bg-red-50 border border-red-200 text-red-700' :
          'bg-amber-50 border border-amber-200 text-amber-700'
        }`}>
          {allFinalized && !hasIneffective ? <CheckCircle2 size={13} className="shrink-0 mt-0.5" /> :
           hasIneffective ? <XCircle size={13} className="shrink-0 mt-0.5" /> :
           <Clock size={13} className="shrink-0 mt-0.5" />}
          <span>
            {allFinalized && !hasIneffective && 'Engagement control testing is ready for final report review.'}
            {hasIneffective && 'Engagement has ineffective controls requiring attention.'}
            {!allFinalized && !hasIneffective && 'Some control conclusions are still pending.'}
          </span>
        </div>
      </div>

      {/* Export placeholder */}
      <div className="rounded-lg border border-border-light p-4">
        <h4 className="text-[11px] font-bold text-text mb-1">Compliance Summary Report</h4>
        <p className="text-[10px] text-gray-500 mb-2">Includes control rollup, testing metrics, failed attributes, review status, and conclusion rollup.</p>
        <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-500 text-[9px] font-medium">Status: Draft</span>
      </div>
    </div>
  );
}

// ─── Next Action Helper ───────────────────────────────────────────────────

function deriveNextAction(r: { readiness: { status: string }; ctrlItems: { id: string }[]; testing: { completionPercent: number }; review: { status: string }; conclusion: { status: string; finalConclusion: string | null } }): string {
  if (r.readiness.status !== 'Ready') return 'Complete Setup';
  if (r.ctrlItems.length === 0) return 'Prepare Samples';
  if (r.testing.completionPercent < 100) return 'Continue Testing';
  if (r.review.status === 'NOT_SUBMITTED') return 'Submit for Review';
  if (r.review.status === 'PENDING_REVIEW') return 'Await Review';
  if (r.review.status === 'REJECTED') return 'Fix Rejection';
  if (r.review.status === 'APPROVED' && !r.conclusion.finalConclusion) return 'Finalize Conclusion';
  if (r.conclusion.finalConclusion) return 'View Final';
  return '—';
}
