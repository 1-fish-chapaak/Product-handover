// ─── Compliance — Attribute Testing Tab ───────────────────────────────────
// Sample × attribute pass/fail testing matrix with AI verdicts.
// AI verdict: enabled when evidence is mapped; a ~2s simulated run returns
// Pass/Fail with a cited justification, marked "AI-suggested — confirm".
// The auditor Confirms (locks, attributed) or Overrides (note required).

import React, { useState, useEffect, useRef } from 'react';
import {
  Play, CheckCircle2, AlertCircle, XCircle, ChevronRight, X, FileText, Info,
  Sparkles, Loader2, Lock,
} from 'lucide-react';
import type { ConfigurableEngagement } from '../../configurableEngagementTypes';
import { MOCK_COMPLIANCE_CONTROLS } from './complianceControlScopeData';
import type { SamplesEvidenceState, EvidenceItem } from './complianceSamplesEvidenceData';
import { useCurrentUser } from '../../../../context/CurrentUserContext';
import {
  initializeAttributeResults, deriveComplianceSampleResult, deriveComplianceTestingSummary,
  runAutomatedChecks, deriveAiVerdict,
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

const nowStamp = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const pairKey = (tiId: string, attrId: string) => `${tiId}::${attrId}`;

export default function ComplianceAttributeTestingTab({ samplesEvidence, attributeTesting, onUpdateAttributeTesting, onNavigateTab }: Props) {
  const { currentUser } = useCurrentUser();
  const auditorName = currentUser?.name || 'Auditor';
  const testItems = samplesEvidence.batches.flatMap(b => b.testItems);
  const [controlFilter, setControlFilter] = useState('all');
  const [detailTarget, setDetailTarget] = useState<{ testItemId: string; attributeId: string } | null>(null);
  const [aiRunning, setAiRunning] = useState<Set<string>>(new Set());

  // Latest state ref so delayed AI runs never clobber newer edits
  const latestState = useRef(attributeTesting);
  useEffect(() => { latestState.current = attributeTesting; }, [attributeTesting]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

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
  const singleControl = controlFilter !== 'all' ? MOCK_COMPLIANCE_CONTROLS.find(c => c.id === controlFilter) : null;
  const controlGroups = controlFilter === 'all'
    ? activeControls.map(c => ({ control: c, items: filteredItems.filter(ti => ti.linkedControlId === c.id) }))
    : singleControl ? [{ control: singleControl, items: filteredItems }] : [];

  const evidenceFor = (tiId: string, attrId: string): EvidenceItem[] =>
    samplesEvidence.evidence.filter(e => e.linkedTestItemIds.includes(tiId) && e.linkedAttributeIds.includes(attrId));

  // No test items state
  if (testItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertCircle size={24} className="text-gray-300 mb-3" />
        <h4 className="text-[0.875rem] font-semibold text-text mb-1">Attribute Testing</h4>
        <p className="text-[0.75rem] text-text-muted mb-4">Prepare samples/test items and evidence before attribute testing.</p>
        <button onClick={() => onNavigateTab?.('samples-evidence')}
          className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.75rem] font-semibold cursor-pointer transition-colors flex items-center gap-1">
          Go to Samples & Evidence <ChevronRight size={12} />
        </button>
      </div>
    );
  }

  const handleUpdateResult = (testItemId: string, attributeId: string, result: AttrTestResult, notes?: string) => {
    onUpdateAttributeTesting({
      ...attributeTesting,
      results: attributeTesting.results.map(r =>
        r.testItemId === testItemId && r.attributeId === attributeId
          ? {
            ...r, result, notes: notes ?? r.notes, source: 'MANUAL' as const, testedBy: auditorName, testedAt: nowStamp(),
            aiJustification: result === 'NOT_TESTED' ? undefined : r.aiJustification,
            aiConfirmedBy: undefined, aiConfirmedAt: undefined,
          }
          : r
      ),
    });
  };

  const handleConfirmAi = (testItemId: string, attributeId: string) => {
    onUpdateAttributeTesting({
      ...attributeTesting,
      results: attributeTesting.results.map(r =>
        r.testItemId === testItemId && r.attributeId === attributeId
          ? { ...r, aiConfirmedBy: auditorName, aiConfirmedAt: nowStamp() }
          : r
      ),
    });
  };

  /** Kick off a simulated AI run for the given (testItem, attribute) pairs. */
  const runAiVerdicts = (pairs: { testItemId: string; attributeId: string }[]) => {
    const eligible = pairs.filter(p => evidenceFor(p.testItemId, p.attributeId).length > 0);
    if (eligible.length === 0) return;
    setAiRunning(prev => {
      const next = new Set(prev);
      eligible.forEach(p => next.add(pairKey(p.testItemId, p.attributeId)));
      return next;
    });
    const t = setTimeout(() => {
      const current = latestState.current;
      const eligibleKeys = new Set(eligible.map(p => pairKey(p.testItemId, p.attributeId)));
      onUpdateAttributeTesting({
        ...current,
        testingStarted: true,
        results: current.results.map(r => {
          if (!eligibleKeys.has(pairKey(r.testItemId, r.attributeId))) return r;
          const ti = testItems.find(x => x.id === r.testItemId);
          const ctrl = MOCK_COMPLIANCE_CONTROLS.find(c => c.id === r.controlId);
          const attr = ctrl?.attributes.find(a => a.id === r.attributeId);
          if (!ti || !attr) return r;
          const verdict = deriveAiVerdict(ti.referenceId, attr.code, attr.name, evidenceFor(ti.id, attr.id).map(e => e.fileName));
          return {
            ...r,
            result: verdict.result,
            source: 'AI_SUGGESTED' as const,
            testedBy: 'AI Verdict',
            testedAt: nowStamp(),
            notes: r.notes || (verdict.result === 'FAIL' ? verdict.justification : r.notes),
            aiJustification: verdict.justification,
            aiConfirmedBy: undefined,
            aiConfirmedAt: undefined,
          };
        }),
      });
      setAiRunning(prev => {
        const next = new Set(prev);
        eligibleKeys.forEach(k => next.delete(k));
        return next;
      });
    }, 2000);
    timers.current.push(t);
  };

  const handleRunAiOnAllMapped = () => {
    const pairs = results
      .filter(r => r.result === 'NOT_TESTED' && filteredItems.some(ti => ti.id === r.testItemId))
      .map(r => ({ testItemId: r.testItemId, attributeId: r.attributeId }));
    runAiVerdicts(pairs);
  };

  const mappedUntested = results.filter(r =>
    r.result === 'NOT_TESTED'
    && filteredItems.some(ti => ti.id === r.testItemId)
    && evidenceFor(r.testItemId, r.attributeId).length > 0
  ).length;
  const aiBusy = aiRunning.size > 0;

  const handleRunAutomated = () => {
    const updated = runAutomatedChecks(testItems, attributeTesting.results);
    onUpdateAttributeTesting({ ...attributeTesting, results: updated, testingStarted: true });
  };

  const handleBulkPassPending = () => {
    const now = nowStamp();
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
        return { ...r, result: 'PASS' as const, source: 'MANUAL' as const, testedBy: auditorName, testedAt: now, notes: 'Bulk marked as Pass' };
      }),
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[0.9375rem] font-bold text-text mb-0.5">Attribute Testing</h3>
          <p className="text-[0.75rem] text-text-muted">Record pass/fail results for each sample attribute using mapped evidence.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={handleBulkPassPending}
            className="px-3 py-1.5 rounded-lg border border-border-light text-[0.6875rem] font-semibold text-text-muted hover:bg-surface-2/30 cursor-pointer transition-colors">
            Mark Pending Manual → Pass
          </button>
          <button onClick={handleRunAutomated}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 text-primary bg-primary/5 hover:bg-primary/10 text-[0.6875rem] font-semibold cursor-pointer transition-colors">
            <Play size={11} />Run Automated Checks
          </button>
          <button onClick={handleRunAiOnAllMapped} disabled={mappedUntested === 0 || aiBusy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.6875rem] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {aiBusy ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
            {aiBusy ? 'AI reviewing evidence…' : `Run AI on all mapped${mappedUntested > 0 ? ` (${mappedUntested})` : ''}`}
          </button>
        </div>
      </div>

      {/* Summary — 5 tiles */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Test Items', value: testItems.length },
          { label: 'Checks Done', value: `${summary.completedChecks}/${summary.totalChecks}`, cls: summary.completedChecks > 0 ? 'text-primary' : '' },
          { label: 'Passed', value: summary.passedChecks, cls: 'text-emerald-600' },
          { label: 'Failed', value: summary.failedChecks, cls: summary.failedChecks > 0 ? 'text-red-600' : '' },
          { label: 'Progress', value: `${summary.completionPercent}%`, cls: summary.completionPercent === 100 ? 'text-emerald-600' : summary.completionPercent > 0 ? 'text-amber-600' : '' },
        ].map(s => (
          <div key={s.label} className="rounded-lg border border-border-light p-3 text-center">
            <div className={`text-[1.0625rem] font-bold tabular-nums ${s.cls || 'text-text'}`}>{s.value}</div>
            <div className="text-[0.6875rem] text-text-muted font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Control filter */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button onClick={() => setControlFilter('all')}
          className={`px-2.5 py-1 rounded-full text-[0.6875rem] font-semibold cursor-pointer transition-colors ${controlFilter === 'all' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
          All Controls
        </button>
        {activeControls.map(c => (
          <button key={c.id} onClick={() => setControlFilter(c.id)}
            className={`px-2.5 py-1 rounded-full text-[0.6875rem] font-semibold cursor-pointer transition-colors ${controlFilter === c.id ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            {c.id} {c.name.length > 25 ? c.name.slice(0, 24) + '…' : c.name}
          </button>
        ))}
      </div>

      {/* Testing matrices per control group */}
      {controlGroups.map(({ control, items }) => (
        <div key={control.id} className="space-y-2">
          {/* Attribute legend */}
          <div className="rounded-lg border border-border-light p-3">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-[0.75rem] font-bold text-text">{control.id} — {control.name}</span>
              <span className={`px-1.5 py-0.5 rounded text-[0.6875rem] font-bold ${control.nature === 'Preventive' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>{control.nature}</span>
              <span className={`px-1.5 py-0.5 rounded text-[0.6875rem] font-bold ${control.automation === 'Automated' ? 'bg-purple-50 text-purple-700' : control.automation === 'Hybrid' ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}>{control.automation}</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[0.6875rem]">
              {control.attributes.map(a => {
                const wf = a.workflowId ? control.workflows.find(w => w.id === a.workflowId) : null;
                return (
                  <span key={a.id} className="text-gray-500">
                    <span className="font-bold text-primary">{a.code}</span> {a.name}
                    {wf && <span className="text-gray-400 ml-1">({wf.type})</span>}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Matrix table */}
          <div className="rounded-lg border border-border-light overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[0.75rem]">
                <thead>
                  <tr className="border-b border-border-light bg-surface-2/30 text-[0.6875rem] font-semibold text-text-muted uppercase">
                    <th className="px-2 py-2 text-left">Sample</th>
                    <th className="px-2 py-2 text-left">Reference</th>
                    {control.attributes.map(a => (
                      <th key={a.id} className="px-2 py-2 text-center" title={a.name}>
                        <span className="text-primary font-bold text-[0.75rem]">{a.code}</span>
                      </th>
                    ))}
                    <th className="px-2 py-2 text-center">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(ti => {
                    const sampleResult = deriveComplianceSampleResult(ti.id, results);
                    return (
                      <tr key={ti.id} className="border-b border-border-light/50">
                        <td className="px-2 py-2 font-mono text-gray-500 text-[0.6875rem]">{ti.referenceId}</td>
                        <td className="px-2 py-2 text-text truncate max-w-[140px]" title={ti.description}>{ti.description}</td>
                        {control.attributes.map(a => {
                          const ar = results.find(r => r.testItemId === ti.id && r.attributeId === a.id);
                          const r = ar?.result || 'NOT_TESTED';
                          const running = aiRunning.has(pairKey(ti.id, a.id));
                          const aiPending = ar?.source === 'AI_SUGGESTED' && !ar.aiConfirmedBy && r !== 'NOT_TESTED';
                          return (
                            <td key={a.id} className="px-2 py-2 text-center">
                              {running ? (
                                <span className="inline-flex items-center justify-center px-1.5 py-0.5"><Loader2 size={12} className="animate-spin text-primary" /></span>
                              ) : (
                                <button
                                  onClick={() => setDetailTarget({ testItemId: ti.id, attributeId: a.id })}
                                  title={aiPending ? 'AI-suggested — open to confirm' : a.name}
                                  className={`relative px-2 py-0.5 rounded text-[0.6875rem] font-bold cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all ${RESULT_CLS[r]} ${aiPending ? 'ring-1 ring-amber-400' : ''}`}>
                                  {RESULT_LABEL[r]}
                                  {aiPending && <Sparkles size={8} className="absolute -top-1 -right-1 text-amber-500" />}
                                </button>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-2 py-2 text-center">
                          <span className={`px-2 py-0.5 rounded text-[0.6875rem] font-bold ${SAMPLE_CLS[sampleResult]}`}>
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
          <div className="text-[0.6875rem] text-text-muted">P = Pass · F = Fail · — = Not Tested · N/A = Not Applicable · ✦ = AI-suggested, awaiting confirmation · Click a cell to test</div>
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
          aiRunning={aiRunning.has(pairKey(detailTarget.testItemId, detailTarget.attributeId))}
          onRunAi={() => runAiVerdicts([detailTarget])}
          onConfirmAi={() => handleConfirmAi(detailTarget.testItemId, detailTarget.attributeId)}
          onUpdate={handleUpdateResult}
          onClose={() => setDetailTarget(null)}
        />
      )}

      {/* Readiness */}
      <div className="rounded-lg border border-border-light p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-[0.8125rem] font-bold text-text">Testing Status</h4>
          <span className={`px-2 py-0.5 rounded-full text-[0.6875rem] font-bold ${
            summary.completionPercent === 100 ? 'bg-emerald-50 text-emerald-700' :
            summary.completedChecks > 0 ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-500'
          }`}>
            {summary.completionPercent === 100 ? 'Testing Complete' : summary.completedChecks > 0 ? 'In Progress' : 'Not Started'}
          </span>
        </div>
        <div className="space-y-1">
          {[
            { label: 'Samples prepared', ok: testItems.length > 0 },
            { label: 'Automated / AI checks run', ok: results.some(r => r.source === 'AUTOMATED' || r.source === 'AI_SUGGESTED') },
            { label: 'AI-suggested verdicts confirmed', ok: results.filter(r => r.source === 'AI_SUGGESTED' && r.result !== 'NOT_TESTED').every(r => !!r.aiConfirmedBy) },
            { label: 'All attribute checks completed', ok: summary.completionPercent === 100 },
            { label: 'Failed attributes documented', ok: results.filter(r => r.result === 'FAIL').every(r => r.notes.trim().length > 0) },
          ].map(c => (
            <div key={c.label} className="flex items-center gap-2 text-[0.75rem]">
              {c.ok ? <CheckCircle2 size={11} className="text-emerald-500" /> : <AlertCircle size={11} className="text-amber-400" />}
              <span className={c.ok ? 'text-gray-500' : 'text-text'}>{c.label}</span>
            </div>
          ))}
        </div>
        {summary.completionPercent === 100 && (
          <button onClick={() => onNavigateTab?.('working-paper')}
            className="mt-2 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.75rem] font-semibold cursor-pointer transition-colors">
            Go to Working Paper <ChevronRight size={11} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Attribute Detail Panel ───────────────────────────────────────────────

function AttributeDetailPanel({ target, results, evidence, testItems, aiRunning, onRunAi, onConfirmAi, onUpdate, onClose }: {
  target: { testItemId: string; attributeId: string };
  results: AttributeTestResult[];
  evidence: EvidenceItem[];
  testItems: { id: string; referenceId: string; description: string; linkedControlId: string }[];
  aiRunning: boolean;
  onRunAi: () => void;
  onConfirmAi: () => void;
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

  const isAiSuggested = ar.source === 'AI_SUGGESTED' && ar.result !== 'NOT_TESTED';
  const isAiConfirmed = isAiSuggested && !!ar.aiConfirmedBy;
  const isAiPending = isAiSuggested && !ar.aiConfirmedBy;
  const locked = isAiConfirmed;

  const handleMark = (result: AttrTestResult) => {
    onUpdate(target.testItemId, target.attributeId, result, notes);
  };

  const handleOverride = () => {
    if (!notes.trim()) return;
    const flipped: AttrTestResult = ar.result === 'PASS' ? 'FAIL' : 'PASS';
    onUpdate(target.testItemId, target.attributeId, flipped, notes);
  };

  return (
    <div className="rounded-xl border-2 border-primary/20 bg-white p-4 space-y-3 shadow-lg">
      <div className="flex items-center justify-between">
        <div>
          <h5 className="text-[0.8125rem] font-bold text-text">{ti.referenceId} — Attribute {attr.code}</h5>
          <p className="text-[0.75rem] text-gray-500">{attr.name} · {attr.assertion} · {ctrl.name}</p>
        </div>
        <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-text cursor-pointer"><X size={14} /></button>
      </div>

      <div className="grid grid-cols-3 gap-3 text-[0.75rem]">
        <div><span className="text-text-muted block text-[0.6875rem]">Workflow</span><span className="text-text">{wf?.name || 'None'}</span></div>
        <div><span className="text-text-muted block text-[0.6875rem]">Type</span><span className="text-text">{wf?.type || 'Manual'}</span></div>
        <div><span className="text-text-muted block text-[0.6875rem]">Current Result</span><span className={`px-1.5 py-0.5 rounded text-[0.6875rem] font-bold ${RESULT_CLS[ar.result]}`}>{ar.result === 'NOT_TESTED' ? 'Not Tested' : ar.result}</span></div>
      </div>

      {/* Evidence */}
      <div>
        <h6 className="text-[0.6875rem] font-bold text-text-muted uppercase tracking-wider mb-1">Evidence ({mappedEvidence.length})</h6>
        {mappedEvidence.length === 0 ? (
          <div className="flex items-start gap-1.5 text-[0.75rem] text-amber-600">
            <AlertCircle size={11} className="shrink-0 mt-0.5" />
            <span>No evidence mapped for this attribute — map evidence in Samples & Evidence to enable the AI verdict.</span>
          </div>
        ) : (
          <div className="space-y-0.5">
            {mappedEvidence.map(e => (
              <div key={e.id} className="flex items-center gap-1.5 text-[0.6875rem] text-text">
                <FileText size={10} className="text-gray-400 shrink-0" />{e.fileName}
                <span className={`px-1 py-0.5 rounded text-[0.6875rem] font-bold ${e.source === 'USER_UPLOADED' ? 'bg-gray-100 text-gray-600' : 'bg-blue-50 text-blue-600'}`}>
                  {e.source === 'USER_UPLOADED' ? 'User' : 'PBC'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI verdict banner */}
      {isAiPending && ar.aiJustification && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-[0.75rem] font-bold text-amber-800">
            <Sparkles size={12} />AI-suggested — confirm
            <span className={`ml-1 px-1.5 py-0.5 rounded text-[0.6875rem] font-bold ${RESULT_CLS[ar.result]}`}>{ar.result}</span>
          </div>
          <p className="text-[0.75rem] text-amber-800 leading-relaxed">{ar.aiJustification}</p>
          <div className="flex items-center gap-2">
            <button onClick={onConfirmAi}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[0.6875rem] font-semibold cursor-pointer transition-colors">
              <CheckCircle2 size={11} />Confirm Verdict
            </button>
            <button onClick={handleOverride} disabled={!notes.trim()}
              title={!notes.trim() ? 'Add an override note below first' : `Override to ${ar.result === 'PASS' ? 'Fail' : 'Pass'}`}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-amber-300 text-amber-800 bg-white hover:bg-amber-50 text-[0.6875rem] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              <XCircle size={11} />Override to {ar.result === 'PASS' ? 'Fail' : 'Pass'}
            </button>
            {!notes.trim() && <span className="text-[0.6875rem] text-amber-700 italic">Override requires a note</span>}
          </div>
        </div>
      )}
      {isAiConfirmed && ar.aiJustification && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-[0.75rem] font-bold text-emerald-800">
            <Lock size={11} />AI verdict confirmed — result locked
          </div>
          <p className="text-[0.75rem] text-emerald-800 leading-relaxed">{ar.aiJustification}</p>
          <p className="text-[0.6875rem] text-emerald-700">Confirmed by {ar.aiConfirmedBy} · {ar.aiConfirmedAt}</p>
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="text-[0.6875rem] font-bold text-text-muted uppercase tracking-wider block mb-1">Notes / Remarks</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          placeholder={ar.result === 'FAIL' ? 'Failure reason is required...' : isAiPending ? 'Add a note to override the AI verdict...' : 'Add testing notes...'}
          className="w-full px-3 py-2 border border-border rounded-lg text-[0.75rem] text-text bg-white outline-none focus:border-primary/40 resize-none" />
        {ar.result === 'FAIL' && !notes.trim() && (
          <p className="text-[0.6875rem] text-red-500 mt-0.5 flex items-center gap-1"><Info size={10} />Failure reason / remark is required for failed attributes.</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={onRunAi} disabled={mappedEvidence.length === 0 || aiRunning || locked}
          title={mappedEvidence.length === 0 ? 'Map evidence first to enable the AI verdict' : 'Run AI verdict on the mapped evidence'}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.6875rem] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          {aiRunning ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
          {aiRunning ? 'AI reviewing…' : 'AI Verdict'}
        </button>
        <span className="w-px h-4 bg-border-light" />
        <button onClick={() => handleMark('PASS')} disabled={locked}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[0.6875rem] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          <CheckCircle2 size={11} />Pass
        </button>
        <button onClick={() => handleMark('FAIL')} disabled={locked}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[0.6875rem] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          <XCircle size={11} />Fail
        </button>
        <button onClick={() => handleMark('NA')} disabled={locked}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-700 text-[0.6875rem] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          N/A
        </button>
        <button onClick={() => handleMark('NOT_TESTED')}
          className="px-3 py-1.5 rounded-lg border border-border-light text-[0.6875rem] font-medium text-text-muted hover:bg-surface-2/30 cursor-pointer transition-colors">
          Reset
        </button>
        {locked && <span className="text-[0.6875rem] text-text-muted italic">Result locked by confirmation — Reset to unlock.</span>}
      </div>
      {ar.testedAt && (
        <p className="text-[0.6875rem] text-text-muted">Last tested: {ar.testedAt} by {ar.testedBy} ({ar.source === 'AI_SUGGESTED' ? (ar.aiConfirmedBy ? `AI, confirmed by ${ar.aiConfirmedBy}` : 'AI, unconfirmed') : ar.source})</p>
      )}
    </div>
  );
}
