// ─── Compliance — Attribute Testing Tab ───────────────────────────────────
// Sample × attribute pass/fail testing matrix. No conclusion here.

import React, { useState, useMemo, useEffect } from 'react';
import {
  Play, CheckCircle2, AlertCircle, XCircle, ChevronRight, X, FileText, Info,
} from 'lucide-react';
import type { ConfigurableEngagement } from '../../configurableEngagementTypes';
import { MOCK_COMPLIANCE_CONTROLS } from './complianceControlScopeData';
import type { SamplesEvidenceState, EvidenceItem } from './complianceSamplesEvidenceData';
import {
  initializeAttributeResults, deriveComplianceSampleResult, deriveComplianceTestingSummary,
  runAutomatedChecks,
  type AttributeTestResult, type AttrTestResult, type AttributeTestingState,
} from './complianceAttributeTestingData';

const RESULT_CLS: Record<AttrTestResult, string> = {
  NOT_TESTED: 'bg-gray-100 text-gray-500',
  PASS: 'bg-emerald-50 text-emerald-700',
  FAIL: 'bg-red-50 text-red-700',
  NA: 'bg-blue-50 text-blue-600',
};
const RESULT_LABEL: Record<AttrTestResult, string> = { NOT_TESTED: '—', PASS: 'P', FAIL: 'F', NA: 'N/A' };
const SAMPLE_CLS = { PASS: 'bg-emerald-50 text-emerald-700', FAIL: 'bg-red-50 text-red-700', PENDING: 'bg-gray-100 text-gray-500' };

interface Props {
  engagement: ConfigurableEngagement;
  samplesEvidence: SamplesEvidenceState;
  attributeTesting: AttributeTestingState;
  onUpdateAttributeTesting: (state: AttributeTestingState) => void;
  onNavigateTab?: (tabId: string) => void;
}

export default function ComplianceAttributeTestingTab({ engagement, samplesEvidence, attributeTesting, onUpdateAttributeTesting, onNavigateTab }: Props) {
  const testItems = samplesEvidence.batches.flatMap(b => b.testItems);
  const [controlFilter, setControlFilter] = useState('all');
  const [detailTarget, setDetailTarget] = useState<{ testItemId: string; attributeId: string } | null>(null);

  // Initialize results for new test items
  useEffect(() => {
    if (testItems.length === 0) return;
    const initialized = initializeAttributeResults(testItems, attributeTesting.results);
    if (initialized.length !== attributeTesting.results.length) {
      onUpdateAttributeTesting({ ...attributeTesting, results: initialized, testingStarted: true });
    }
  }, [testItems.length]); // only on test item count change

  const results = attributeTesting.results;
  const summary = deriveComplianceTestingSummary(results);

  // Controls present in test items
  const activeControlIds = [...new Set(testItems.map(ti => ti.linkedControlId))];
  const activeControls = MOCK_COMPLIANCE_CONTROLS.filter(c => activeControlIds.includes(c.id));

  // Filtered items
  const filteredItems = controlFilter === 'all' ? testItems : testItems.filter(ti => ti.linkedControlId === controlFilter);
  // Current control for attribute columns (if single filter, use that; otherwise show per-row)
  const singleControl = controlFilter !== 'all' ? MOCK_COMPLIANCE_CONTROLS.find(c => c.id === controlFilter) : null;
  // For "all", group by control
  const controlGroups = controlFilter === 'all'
    ? activeControls.map(c => ({ control: c, items: filteredItems.filter(ti => ti.linkedControlId === c.id) }))
    : singleControl ? [{ control: singleControl, items: filteredItems }] : [];

  // No test items state
  if (testItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertCircle size={24} className="text-gray-300 mb-3" />
        <h4 className="text-[14px] font-semibold text-text mb-1">Attribute Testing</h4>
        <p className="text-[12px] text-text-muted mb-4">Prepare samples/test items and evidence before attribute testing.</p>
        <button onClick={() => onNavigateTab?.('samples-evidence')}
          className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-[12px] font-semibold cursor-pointer transition-colors flex items-center gap-1">
          Go to Samples & Evidence <ChevronRight size={12} />
        </button>
      </div>
    );
  }

  const handleUpdateResult = (testItemId: string, attributeId: string, result: AttrTestResult, notes?: string) => {
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    onUpdateAttributeTesting({
      ...attributeTesting,
      results: attributeTesting.results.map(r =>
        r.testItemId === testItemId && r.attributeId === attributeId
          ? { ...r, result, notes: notes ?? r.notes, source: 'MANUAL' as const, testedBy: 'Auditor', testedAt: now }
          : r
      ),
    });
  };

  const handleRunAutomated = () => {
    const updated = runAutomatedChecks(testItems, attributeTesting.results);
    onUpdateAttributeTesting({ ...attributeTesting, results: updated, testingStarted: true });
  };

  const handleBulkPassPending = () => {
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const filteredTiIds = new Set(filteredItems.map(ti => ti.id));
    onUpdateAttributeTesting({
      ...attributeTesting,
      results: attributeTesting.results.map(r => {
        if (!filteredTiIds.has(r.testItemId)) return r;
        if (r.result !== 'NOT_TESTED') return r;
        // Only manual attributes
        const ctrl = MOCK_COMPLIANCE_CONTROLS.find(c => c.id === r.controlId);
        const attr = ctrl?.attributes.find(a => a.id === r.attributeId);
        const wf = attr?.workflowId ? ctrl?.workflows.find(w => w.id === attr.workflowId) : null;
        if (wf && wf.type !== 'Manual') return r;
        return { ...r, result: 'PASS' as const, source: 'MANUAL' as const, testedBy: 'Auditor', testedAt: now, notes: 'Bulk marked as Pass' };
      }),
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[15px] font-bold text-text mb-0.5">Attribute Testing</h3>
          <p className="text-[12px] text-text-muted">Record pass/fail results for each sample attribute using mapped evidence.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={handleBulkPassPending}
            className="px-3 py-1.5 rounded-lg border border-border-light text-[10px] font-semibold text-text-muted hover:bg-surface-2/30 cursor-pointer transition-colors">
            Mark Pending Manual → Pass
          </button>
          <button onClick={handleRunAutomated}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[11px] font-semibold cursor-pointer transition-colors">
            <Play size={11} />Run Automated Checks
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-7 gap-2">
        {[
          { label: 'Test Items', value: testItems.length },
          { label: 'Total Checks', value: summary.totalChecks },
          { label: 'Completed', value: summary.completedChecks, cls: summary.completedChecks > 0 ? 'text-primary' : '' },
          { label: 'Passed', value: summary.passedChecks, cls: 'text-emerald-600' },
          { label: 'Failed', value: summary.failedChecks, cls: summary.failedChecks > 0 ? 'text-red-600' : '' },
          { label: 'Pending', value: summary.pendingChecks, cls: summary.pendingChecks > 0 ? 'text-amber-600' : '' },
          { label: 'Progress', value: `${summary.completionPercent}%`, cls: summary.completionPercent === 100 ? 'text-emerald-600' : '' },
        ].map(s => (
          <div key={s.label} className="rounded-lg border border-border-light p-2 text-center">
            <div className={`text-[15px] font-bold tabular-nums ${s.cls || 'text-text'}`}>{s.value}</div>
            <div className="text-[8px] text-gray-400 font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Control filter */}
      <div className="flex items-center gap-1">
        <button onClick={() => setControlFilter('all')}
          className={`px-2 py-1 rounded-full text-[9px] font-semibold cursor-pointer transition-colors ${controlFilter === 'all' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
          All Controls
        </button>
        {activeControls.map(c => (
          <button key={c.id} onClick={() => setControlFilter(c.id)}
            className={`px-2 py-1 rounded-full text-[9px] font-semibold cursor-pointer transition-colors ${controlFilter === c.id ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            {c.id} {c.name.length > 25 ? c.name.slice(0, 24) + '…' : c.name}
          </button>
        ))}
      </div>

      {/* Testing matrices per control group */}
      {controlGroups.map(({ control, items }) => (
        <div key={control.id} className="space-y-2">
          {/* Attribute legend */}
          <div className="rounded-lg border border-border-light p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] font-bold text-text">{control.id} — {control.name}</span>
              <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${control.nature === 'Preventive' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>{control.nature}</span>
              <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${control.automation === 'Automated' ? 'bg-purple-50 text-purple-700' : control.automation === 'Hybrid' ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}>{control.automation}</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[9px]">
              {control.attributes.map(a => {
                const wf = a.workflowId ? control.workflows.find(w => w.id === a.workflowId) : null;
                return (
                  <span key={a.id} className="text-gray-500">
                    <span className="font-bold text-primary">{a.code}</span> {a.name}
                    {wf && <span className="text-gray-300 ml-1">({wf.type})</span>}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Matrix table */}
          <div className="rounded-lg border border-border-light overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="border-b border-border-light bg-surface-2/30 text-[8px] font-semibold text-gray-400 uppercase">
                    <th className="px-2 py-1.5 text-left">Sample</th>
                    <th className="px-2 py-1.5 text-left">Reference</th>
                    {control.attributes.map(a => (
                      <th key={a.id} className="px-2 py-1.5 text-center" title={a.name}>
                        <span className="text-primary font-bold text-[9px]">{a.code}</span>
                      </th>
                    ))}
                    <th className="px-2 py-1.5 text-center">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(ti => {
                    const sampleResult = deriveComplianceSampleResult(ti.id, results);
                    return (
                      <tr key={ti.id} className="border-b border-border-light/50">
                        <td className="px-2 py-1.5 font-mono text-gray-500">{ti.referenceId}</td>
                        <td className="px-2 py-1.5 text-text text-[9px] truncate max-w-[120px]">{ti.description}</td>
                        {control.attributes.map(a => {
                          const ar = results.find(r => r.testItemId === ti.id && r.attributeId === a.id);
                          const r = ar?.result || 'NOT_TESTED';
                          return (
                            <td key={a.id} className="px-2 py-1.5 text-center">
                              <button
                                onClick={() => setDetailTarget({ testItemId: ti.id, attributeId: a.id })}
                                className={`px-1.5 py-0.5 rounded text-[8px] font-bold cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all ${RESULT_CLS[r]}`}>
                                {RESULT_LABEL[r]}
                              </button>
                            </td>
                          );
                        })}
                        <td className="px-2 py-1.5 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${SAMPLE_CLS[sampleResult]}`}>
                            {sampleResult === 'PASS' ? 'Pass' : sampleResult === 'FAIL' ? 'Fail' : 'Pending'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div className="text-[8px] text-gray-400">P = Pass · F = Fail · — = Not Tested · N/A = Not Applicable · Click cell to test</div>
        </div>
      ))}

      {/* Detail panel — key forces remount when target changes so useState re-initializes */}
      {detailTarget && (
        <AttributeDetailPanel
          key={`${detailTarget.testItemId}::${detailTarget.attributeId}`}
          target={detailTarget}
          results={results}
          evidence={samplesEvidence.evidence}
          testItems={testItems}
          onUpdate={handleUpdateResult}
          onClose={() => setDetailTarget(null)}
        />
      )}

      {/* Readiness */}
      <div className="rounded-lg border border-border-light p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-[12px] font-bold text-text">Testing Status</h4>
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
            summary.completionPercent === 100 ? 'bg-emerald-50 text-emerald-700' :
            summary.completedChecks > 0 ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-500'
          }`}>
            {summary.completionPercent === 100 ? 'Testing Complete' : summary.completedChecks > 0 ? 'In Progress' : 'Not Started'}
          </span>
        </div>
        <div className="space-y-1">
          {[
            { label: 'Samples prepared', ok: testItems.length > 0 },
            { label: 'Automated checks run', ok: results.some(r => r.source === 'AUTOMATED') },
            { label: 'Manual attributes completed', ok: results.filter(r => { const c = MOCK_COMPLIANCE_CONTROLS.find(cc => cc.id === r.controlId); const a = c?.attributes.find(aa => aa.id === r.attributeId); const w = a?.workflowId ? c?.workflows.find(ww => ww.id === a.workflowId) : null; return !w || w.type === 'Manual'; }).every(r => r.result !== 'NOT_TESTED') },
            { label: 'All attribute checks completed', ok: summary.completionPercent === 100 },
            { label: 'Failed attributes documented', ok: results.filter(r => r.result === 'FAIL').every(r => r.notes.trim().length > 0) },
          ].map(c => (
            <div key={c.label} className="flex items-center gap-2 text-[10px]">
              {c.ok ? <CheckCircle2 size={10} className="text-emerald-500" /> : <AlertCircle size={10} className="text-amber-400" />}
              <span className={c.ok ? 'text-gray-500' : 'text-text'}>{c.label}</span>
            </div>
          ))}
        </div>
        {summary.completionPercent === 100 && (
          <button onClick={() => onNavigateTab?.('working-paper')}
            className="mt-2 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[11px] font-semibold cursor-pointer transition-colors">
            Go to Working Paper <ChevronRight size={11} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Attribute Detail Panel ───────────────────────────────────────────────

function AttributeDetailPanel({ target, results, evidence, testItems, onUpdate, onClose }: {
  target: { testItemId: string; attributeId: string };
  results: AttributeTestResult[];
  evidence: EvidenceItem[];
  testItems: { id: string; referenceId: string; description: string; linkedControlId: string }[];
  onUpdate: (testItemId: string, attributeId: string, result: AttrTestResult, notes?: string) => void;
  onClose: () => void;
}) {
  const ar = results.find(r => r.testItemId === target.testItemId && r.attributeId === target.attributeId);
  const ti = testItems.find(t => t.id === target.testItemId);
  const ctrl = MOCK_COMPLIANCE_CONTROLS.find(c => c.id === ti?.linkedControlId);
  const attr = ctrl?.attributes.find(a => a.id === target.attributeId);
  const wf = attr?.workflowId ? ctrl?.workflows.find(w => w.id === attr.workflowId) : null;
  const mappedEvidence = evidence.filter(e => e.linkedTestItemIds.includes(target.testItemId) && e.linkedAttributeIds.includes(target.attributeId));
  const [notes, setNotes] = useState(ar?.notes || '');

  if (!ar || !ti || !ctrl || !attr) return null;

  const handleMark = (result: AttrTestResult) => {
    if (result === 'FAIL' && !notes.trim()) {
      // Don't block, but keep warning visible
    }
    onUpdate(target.testItemId, target.attributeId, result, notes);
  };

  return (
    <div className="rounded-xl border-2 border-primary/20 bg-white p-4 space-y-3 shadow-lg">
      <div className="flex items-center justify-between">
        <div>
          <h5 className="text-[12px] font-bold text-text">{ti.referenceId} — Attribute {attr.code}</h5>
          <p className="text-[10px] text-gray-500">{attr.name} · {attr.assertion} · {ctrl.name}</p>
        </div>
        <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-text cursor-pointer"><X size={14} /></button>
      </div>

      <div className="grid grid-cols-3 gap-3 text-[10px]">
        <div><span className="text-gray-400 block text-[9px]">Workflow</span><span className="text-text">{wf?.name || 'None'}</span></div>
        <div><span className="text-gray-400 block text-[9px]">Type</span><span className="text-text">{wf?.type || 'Manual'}</span></div>
        <div><span className="text-gray-400 block text-[9px]">Current Result</span><span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${RESULT_CLS[ar.result]}`}>{ar.result === 'NOT_TESTED' ? 'Not Tested' : ar.result}</span></div>
      </div>

      {/* Evidence */}
      <div>
        <h6 className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Evidence ({mappedEvidence.length})</h6>
        {mappedEvidence.length === 0 ? (
          <div className="flex items-start gap-1.5 text-[10px] text-amber-600">
            <AlertCircle size={10} className="shrink-0 mt-0.5" />
            <span>No evidence mapped for this attribute.</span>
          </div>
        ) : (
          <div className="space-y-0.5">
            {mappedEvidence.map(e => (
              <div key={e.id} className="flex items-center gap-1.5 text-[9px] text-text">
                <FileText size={9} className="text-gray-400 shrink-0" />{e.fileName}
                <span className={`px-1 py-0.5 rounded text-[7px] font-bold ${e.source === 'USER_UPLOADED' ? 'bg-gray-100 text-gray-600' : 'bg-blue-50 text-blue-600'}`}>
                  {e.source === 'USER_UPLOADED' ? 'User' : 'PBC'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notes */}
      <div>
        <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Notes / Remarks</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          placeholder={ar.result === 'FAIL' ? 'Failure reason is required...' : 'Add testing notes...'}
          className="w-full px-3 py-2 border border-border rounded-lg text-[11px] text-text bg-white outline-none focus:border-primary/40 resize-none" />
        {ar.result === 'FAIL' && !notes.trim() && (
          <p className="text-[9px] text-red-500 mt-0.5 flex items-center gap-1"><Info size={9} />Failure reason / remark is required for failed attributes.</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button onClick={() => handleMark('PASS')}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-semibold cursor-pointer transition-colors">
          <CheckCircle2 size={10} />Pass
        </button>
        <button onClick={() => handleMark('FAIL')}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[10px] font-semibold cursor-pointer transition-colors">
          <XCircle size={10} />Fail
        </button>
        <button onClick={() => handleMark('NA')}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-700 text-[10px] font-semibold cursor-pointer transition-colors">
          N/A
        </button>
        <button onClick={() => handleMark('NOT_TESTED')}
          className="px-3 py-1.5 rounded-lg border border-border-light text-[10px] font-medium text-text-muted hover:bg-surface-2/30 cursor-pointer transition-colors">
          Reset
        </button>
      </div>
      {ar.testedAt && (
        <p className="text-[9px] text-gray-400">Last tested: {ar.testedAt} by {ar.testedBy} ({ar.source})</p>
      )}
    </div>
  );
}
