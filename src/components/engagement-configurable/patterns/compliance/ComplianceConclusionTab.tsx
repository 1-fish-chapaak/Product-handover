// ─── Compliance — Conclusion Tab ──────────────────────────────────────────
// Derive and finalize control conclusion after reviewer approval.

import React, { useState } from 'react';
import {
  Lock, CheckCircle2, AlertCircle, XCircle, AlertTriangle, ChevronRight, Clock, Info,
} from 'lucide-react';
import type { ConfigurableEngagement } from '../../configurableEngagementTypes';
import { MOCK_COMPLIANCE_CONTROLS } from './complianceControlScopeData';
import type { ComplianceWorkspaceState } from './complianceRequestsData';
import { getOrCreateControlReview } from './complianceReviewData';
import {
  deriveComplianceControlConclusion, getOrCreateControlConclusion, finalizeConclusion,
  CONCLUSION_DISPLAY,
  type ComplianceConclusionState, type ConclusionValue, type ConclusionDerivation,
} from './complianceConclusionData';

interface Props {
  engagement: ConfigurableEngagement;
  complianceState: ComplianceWorkspaceState;
  onUpdateConclusion: (state: ComplianceConclusionState) => void;
  onNavigateTab?: (tabId: string) => void;
}

export default function ComplianceConclusionTab({ engagement, complianceState, onUpdateConclusion, onNavigateTab }: Props) {
  const testItems = complianceState.samplesEvidence.batches.flatMap(b => b.testItems);
  const results = complianceState.attributeTesting.results;
  const reviewState = complianceState.review;
  const conclusionState = complianceState.conclusion;

  const controlIdsWithItems = [...new Set(testItems.map(ti => ti.linkedControlId))];
  const controlsWithItems = MOCK_COMPLIANCE_CONTROLS.filter(c => controlIdsWithItems.includes(c.id));
  // Prefer first approved control
  const approvedControls = controlsWithItems.filter(c => getOrCreateControlReview(reviewState, c.id).status === 'APPROVED');
  const [selectedControlId, setSelectedControlId] = useState(approvedControls[0]?.id || controlsWithItems[0]?.id || '');

  const ctrlReview = getOrCreateControlReview(reviewState, selectedControlId);
  const ctrlConclusion = getOrCreateControlConclusion(conclusionState, selectedControlId);
  const ctrlItems = testItems.filter(ti => ti.linkedControlId === selectedControlId);
  const derivation = deriveComplianceControlConclusion(selectedControlId, results, testItems, ctrlReview);
  const isApproved = ctrlReview.status === 'APPROVED';
  const isFinalized = ctrlConclusion.status === 'FINALIZED';

  // Empty state
  if (testItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Lock size={24} className="text-gray-300 mb-3" />
        <h4 className="text-[14px] font-semibold text-text mb-1">Conclusion</h4>
        <p className="text-[12px] text-text-muted mb-4">Prepare samples, complete testing, and get reviewer approval before conclusion.</p>
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
        <h3 className="text-[15px] font-bold text-text mb-0.5">Conclusion</h3>
        <p className="text-[12px] text-text-muted">Derive and finalize the control conclusion after reviewer approval.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-7 gap-2">
        {[
          { label: 'Recommended', value: derivation.recommendedConclusion ? CONCLUSION_DISPLAY[derivation.recommendedConclusion].label : '—', cls: derivation.recommendedConclusion === 'EFFECTIVE' ? 'text-emerald-600' : derivation.recommendedConclusion === 'INEFFECTIVE' ? 'text-red-600' : derivation.recommendedConclusion === 'PARTIALLY_EFFECTIVE' ? 'text-amber-600' : '' },
          { label: 'Final', value: ctrlConclusion.finalConclusion ? CONCLUSION_DISPLAY[ctrlConclusion.finalConclusion].label : '—', cls: ctrlConclusion.finalConclusion === 'EFFECTIVE' ? 'text-emerald-600' : ctrlConclusion.finalConclusion === 'INEFFECTIVE' ? 'text-red-600' : ctrlConclusion.finalConclusion === 'PARTIALLY_EFFECTIVE' ? 'text-amber-600' : '' },
          { label: 'Samples', value: derivation.totalSamples },
          { label: 'Passed', value: derivation.passedSamples, cls: 'text-emerald-600' },
          { label: 'Failed', value: derivation.failedSamples, cls: derivation.failedSamples > 0 ? 'text-red-600' : '' },
          { label: 'Pending', value: derivation.pendingSamples, cls: derivation.pendingSamples > 0 ? 'text-amber-600' : '' },
          { label: 'Review', value: ctrlReview.status.replace(/_/g, ' '), cls: isApproved ? 'text-emerald-600' : 'text-gray-400' },
        ].map(s => (
          <div key={s.label} className="rounded-lg border border-border-light p-2 text-center">
            <div className={`text-[13px] font-bold tabular-nums ${s.cls || 'text-text'}`}>{s.value}</div>
            <div className="text-[8px] text-gray-400 font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Control selector */}
      <div className="flex items-center gap-1">
        {controlsWithItems.map(c => {
          const r = getOrCreateControlReview(reviewState, c.id);
          const cc = getOrCreateControlConclusion(conclusionState, c.id);
          return (
            <button key={c.id} onClick={() => setSelectedControlId(c.id)}
              className={`px-2.5 py-1 rounded-full text-[9px] font-semibold cursor-pointer transition-colors ${selectedControlId === c.id ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
              {c.id} {r.status === 'APPROVED' ? (cc.status === 'FINALIZED' ? '(finalized)' : '(approved)') : `(${r.status.replace(/_/g, ' ').toLowerCase()})`}
            </button>
          );
        })}
      </div>

      {/* Locked state */}
      {!isApproved && (
        <LockedView reviewStatus={ctrlReview.status} onNavigateTab={onNavigateTab} />
      )}

      {/* Approved — show derivation and finalization (key forces remount on control switch) */}
      {isApproved && !isFinalized && (
        <ReadyToFinalizeView
          key={selectedControlId}
          derivation={derivation}
          engagement={engagement}
          conclusionState={conclusionState}
          controlId={selectedControlId}
          onUpdateConclusion={onUpdateConclusion}
        />
      )}

      {/* Finalized */}
      {isApproved && isFinalized && (
        <FinalizedView
          key={selectedControlId}
          ctrlConclusion={ctrlConclusion}
          derivation={derivation}
          engagement={engagement}
          conclusionState={conclusionState}
          controlId={selectedControlId}
          onUpdateConclusion={onUpdateConclusion}
        />
      )}

      {/* Info */}
      <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-blue-50/50 border border-blue-200/50 text-[10px] text-blue-600">
        <Info size={11} className="shrink-0 mt-0.5" />
        <span>Finalized conclusion will be reflected in the final working paper and engagement summary.</span>
      </div>
    </div>
  );
}

// ─── Locked View ──────────────────────────────────────────────────────────

function LockedView({ reviewStatus, onNavigateTab }: { reviewStatus: string; onNavigateTab?: (tabId: string) => void }) {
  return (
    <div className="rounded-xl border-2 border-gray-200 bg-gray-50/30 p-6 text-center space-y-3">
      <Lock size={28} className="text-gray-300 mx-auto" />
      <h4 className="text-[14px] font-semibold text-text">Conclusion Locked</h4>
      <p className="text-[12px] text-text-muted max-w-md mx-auto">Control conclusion will be generated after reviewer approval.</p>
      <div className="text-[11px] text-gray-500">
        Current review status: <span className="font-semibold">{reviewStatus.replace(/_/g, ' ')}</span>
      </div>
      <button onClick={() => onNavigateTab?.('review')}
        className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-[12px] font-semibold cursor-pointer transition-colors inline-flex items-center gap-1">
        Go to Review <ChevronRight size={12} />
      </button>
    </div>
  );
}

// ─── Ready to Finalize View ───────────────────────────────────────────────

function ReadyToFinalizeView({ derivation, engagement, conclusionState, controlId, onUpdateConclusion }: {
  derivation: ConclusionDerivation; engagement: ConfigurableEngagement;
  conclusionState: ComplianceConclusionState; controlId: string;
  onUpdateConclusion: (state: ComplianceConclusionState) => void;
}) {
  const [selectedValue, setSelectedValue] = useState<ConclusionValue>(derivation.recommendedConclusion || 'EFFECTIVE');
  const [remarks, setRemarks] = useState('');
  const differsFromRecommendation = derivation.recommendedConclusion && selectedValue !== derivation.recommendedConclusion;
  const needsRemarks = differsFromRecommendation || selectedValue === 'PARTIALLY_EFFECTIVE' || selectedValue === 'NOT_APPLICABLE';
  const canFinalize = !!selectedValue && (!needsRemarks || remarks.trim().length > 0);

  const handleFinalize = () => {
    if (!canFinalize) return;
    onUpdateConclusion(finalizeConclusion(conclusionState, controlId, selectedValue, remarks, derivation.recommendedConclusion, derivation.reason, engagement.reviewer || engagement.owner));
  };

  return (
    <div className="space-y-4">
      {/* Rationale */}
      <div className="rounded-lg border border-border-light p-4 space-y-2">
        <h4 className="text-[11px] font-bold text-text">Conclusion Rationale</h4>
        <p className="text-[11px] text-text leading-relaxed">{derivation.reason}</p>
        <div className="grid grid-cols-3 gap-3 text-[11px]">
          <div><span className="text-gray-400 block text-[10px]">Samples Tested</span><span className="text-text font-medium tabular-nums">{derivation.totalSamples}</span></div>
          <div><span className="text-gray-400 block text-[10px]">Passed</span><span className="text-emerald-600 font-medium tabular-nums">{derivation.passedSamples}</span></div>
          <div><span className="text-gray-400 block text-[10px]">Failed</span><span className={`font-medium tabular-nums ${derivation.failedSamples > 0 ? 'text-red-600' : 'text-gray-400'}`}>{derivation.failedSamples}</span></div>
        </div>
        {derivation.recommendedConclusion && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-gray-400">System Recommendation:</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${CONCLUSION_DISPLAY[derivation.recommendedConclusion].cls}`}>
              {CONCLUSION_DISPLAY[derivation.recommendedConclusion].label}
            </span>
          </div>
        )}
      </div>

      {/* Failed attributes */}
      <FailedAttributesTable failedAttributes={derivation.failedAttributes} />

      {/* Finalize */}
      <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4 space-y-3">
        <h4 className="text-[12px] font-bold text-text">Finalize Conclusion</h4>
        <div>
          <label className="text-[10px] font-semibold text-gray-500 block mb-1.5">Final Conclusion</label>
          <div className="flex items-center gap-2">
            {(['EFFECTIVE', 'PARTIALLY_EFFECTIVE', 'INEFFECTIVE', 'NOT_APPLICABLE'] as ConclusionValue[]).map(v => {
              const d = CONCLUSION_DISPLAY[v];
              const isSelected = selectedValue === v;
              return (
                <button key={v} onClick={() => setSelectedValue(v)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-all border-2 ${isSelected ? d.cls + ' ring-2 ring-primary/20' : 'border-border-light text-gray-400 hover:border-gray-300'}`}>
                  {d.label}
                </button>
              );
            })}
          </div>
          {derivation.recommendedConclusion && selectedValue === derivation.recommendedConclusion && (
            <p className="text-[9px] text-gray-400 mt-1">Matches system recommendation.</p>
          )}
          {differsFromRecommendation && (
            <p className="text-[9px] text-amber-600 mt-1 flex items-center gap-1"><AlertTriangle size={9} />Differs from system recommendation. Remarks are required.</p>
          )}
        </div>
        <div>
          <label className="text-[10px] font-semibold text-gray-500 block mb-1">Remarks / Justification {needsRemarks && <span className="text-red-400">*</span>}</label>
          <textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={3}
            placeholder={needsRemarks ? 'Required — explain why final conclusion differs from recommendation...' : 'Optional remarks...'}
            className="w-full px-3 py-2 border border-border rounded-lg text-[11px] text-text bg-white outline-none focus:border-primary/40 resize-none" />
        </div>
        <button onClick={handleFinalize} disabled={!canFinalize}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-[12px] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          <CheckCircle2 size={13} />Finalize Conclusion
        </button>
      </div>
    </div>
  );
}

// ─── Finalized View ───────────────────────────────────────────────────────

function FinalizedView({ ctrlConclusion, derivation, engagement, conclusionState, controlId, onUpdateConclusion }: {
  ctrlConclusion: import('./complianceConclusionData').ControlConclusionState;
  derivation: ConclusionDerivation; engagement: ConfigurableEngagement;
  conclusionState: ComplianceConclusionState; controlId: string;
  onUpdateConclusion: (state: ComplianceConclusionState) => void;
}) {
  const d = ctrlConclusion.finalConclusion ? CONCLUSION_DISPLAY[ctrlConclusion.finalConclusion] : null;
  const [showUpdate, setShowUpdate] = useState(false);
  const [updateValue, setUpdateValue] = useState<ConclusionValue>(ctrlConclusion.finalConclusion || 'EFFECTIVE');
  const [updateRemarks, setUpdateRemarks] = useState('');

  return (
    <div className="space-y-4">
      {/* Final conclusion banner */}
      {d && (
        <div className={`rounded-xl border-2 p-5 ${d.cls}`}>
          <div className="flex items-center gap-3 mb-2">
            {d.icon === 'check' ? <CheckCircle2 size={22} /> : d.icon === 'x' ? <XCircle size={22} /> : d.icon === 'partial' ? <AlertTriangle size={22} /> : <AlertCircle size={22} />}
            <div>
              <h4 className="text-[16px] font-bold">{d.label}</h4>
              <p className="text-[11px] mt-0.5">Finalized by {ctrlConclusion.finalizedBy} on {ctrlConclusion.finalizedAt}</p>
            </div>
          </div>
          {ctrlConclusion.remarks && <p className="text-[11px] italic mt-2">"{ctrlConclusion.remarks}"</p>}
        </div>
      )}

      {/* Recommendation comparison */}
      {ctrlConclusion.recommendedConclusion && ctrlConclusion.finalConclusion !== ctrlConclusion.recommendedConclusion && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[10px] text-amber-700">
          <AlertTriangle size={11} className="shrink-0 mt-0.5" />
          <span>Final conclusion ({CONCLUSION_DISPLAY[ctrlConclusion.finalConclusion!].label}) differs from system recommendation ({CONCLUSION_DISPLAY[ctrlConclusion.recommendedConclusion].label}).</span>
        </div>
      )}

      {/* Rationale */}
      <div className="rounded-lg border border-border-light p-4">
        <h4 className="text-[11px] font-bold text-text mb-1">Conclusion Rationale</h4>
        <p className="text-[11px] text-text leading-relaxed">{ctrlConclusion.reason}</p>
        <div className="grid grid-cols-3 gap-3 text-[11px] mt-2">
          <div><span className="text-gray-400 block text-[10px]">Samples</span><span className="text-text font-medium tabular-nums">{derivation.totalSamples}</span></div>
          <div><span className="text-gray-400 block text-[10px]">Passed</span><span className="text-emerald-600 font-medium tabular-nums">{derivation.passedSamples}</span></div>
          <div><span className="text-gray-400 block text-[10px]">Failed</span><span className={`font-medium tabular-nums ${derivation.failedSamples > 0 ? 'text-red-600' : 'text-gray-400'}`}>{derivation.failedSamples}</span></div>
        </div>
      </div>

      {/* Failed attributes */}
      <FailedAttributesTable failedAttributes={derivation.failedAttributes} />

      {/* History */}
      {ctrlConclusion.history.length > 0 && (
        <div className="rounded-lg border border-border-light p-4">
          <h4 className="text-[11px] font-bold text-text mb-2">Conclusion History</h4>
          <div className="space-y-2">
            {ctrlConclusion.history.map(h => (
              <div key={h.id} className="flex items-start gap-2 text-[10px]">
                <CheckCircle2 size={11} className={`shrink-0 mt-0.5 ${h.action === 'FINALIZED' ? 'text-emerald-500' : 'text-purple-500'}`} />
                <div>
                  <span className="font-semibold text-text">{h.action}</span>
                  <span className="text-gray-400 ml-2">by {h.actor} · {h.timestamp}</span>
                  <span className="ml-2 px-1.5 py-0.5 rounded text-[8px] font-bold border">{CONCLUSION_DISPLAY[h.value].label}</span>
                  {h.comments && <p className="text-gray-500 mt-0.5 italic">"{h.comments}"</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Update placeholder */}
      {!showUpdate ? (
        <button onClick={() => setShowUpdate(true)}
          className="text-[10px] font-medium text-gray-400 hover:text-primary cursor-pointer transition-colors">
          Update Conclusion...
        </button>
      ) : (
        <div className="rounded-lg border border-border-light p-4 space-y-3">
          <h4 className="text-[11px] font-bold text-text">Update Conclusion</h4>
          <div className="flex items-center gap-2">
            {(['EFFECTIVE', 'PARTIALLY_EFFECTIVE', 'INEFFECTIVE', 'NOT_APPLICABLE'] as ConclusionValue[]).map(v => (
              <button key={v} onClick={() => setUpdateValue(v)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold cursor-pointer border-2 transition-all ${updateValue === v ? CONCLUSION_DISPLAY[v].cls + ' ring-2 ring-primary/20' : 'border-border-light text-gray-400'}`}>
                {CONCLUSION_DISPLAY[v].label}
              </button>
            ))}
          </div>
          <textarea value={updateRemarks} onChange={e => setUpdateRemarks(e.target.value)} rows={2} placeholder="Justification for update..."
            className="w-full px-3 py-2 border border-border rounded-lg text-[11px] text-text bg-white outline-none focus:border-primary/40 resize-none" />
          <div className="flex items-center gap-2">
            <button onClick={() => {
              if (!updateRemarks.trim()) return;
              onUpdateConclusion(finalizeConclusion(conclusionState, controlId, updateValue, updateRemarks, derivation.recommendedConclusion, derivation.reason, engagement.reviewer || engagement.owner));
              setShowUpdate(false);
            }} disabled={!updateRemarks.trim()}
              className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[10px] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              Update
            </button>
            <button onClick={() => setShowUpdate(false)} className="px-3 py-1.5 rounded-lg border border-border-light text-[10px] font-medium text-text-muted hover:bg-surface-2/30 cursor-pointer transition-colors">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Failed Attributes Table ──────────────────────────────────────────────

function FailedAttributesTable({ failedAttributes }: { failedAttributes: ConclusionDerivation['failedAttributes'] }) {
  if (failedAttributes.length === 0) {
    return (
      <div className="rounded-lg border border-border-light p-3 text-[11px] text-gray-400 italic flex items-center gap-2">
        <CheckCircle2 size={12} className="text-emerald-500" />No failed attributes identified.
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-border-light overflow-hidden">
      <div className="px-3 py-2 bg-red-50/30 border-b border-border-light">
        <h4 className="text-[10px] font-bold text-red-700">Failed Samples / Attributes ({failedAttributes.length})</h4>
      </div>
      <table className="w-full text-[10px]">
        <thead><tr className="border-b border-border-light bg-surface-2/30 text-[8px] font-semibold text-gray-400 uppercase">
          <th className="px-2 py-1.5 text-left">Sample</th>
          <th className="px-2 py-1.5 text-left">Code</th>
          <th className="px-2 py-1.5 text-left">Attribute</th>
          <th className="px-2 py-1.5 text-left">Assertion</th>
          <th className="px-2 py-1.5 text-left">Notes</th>
        </tr></thead>
        <tbody>
          {failedAttributes.map((fa, i) => (
            <tr key={i} className="border-b border-border-light/50">
              <td className="px-2 py-1.5 font-mono text-gray-500">{fa.testItemRef}</td>
              <td className="px-2 py-1.5 font-bold text-red-600">{fa.attrCode}</td>
              <td className="px-2 py-1.5 text-text">{fa.attrName}</td>
              <td className="px-2 py-1.5"><span className="px-1 py-0.5 rounded bg-primary/10 text-primary text-[7px] font-bold">{fa.assertion}</span></td>
              <td className="px-2 py-1.5 text-gray-500 truncate max-w-[200px]">{fa.notes || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
