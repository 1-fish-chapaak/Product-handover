// ─── Internal Audit — Analysis Tab ────────────────────────────────────────
// Run workflows, Q&A, document/data review. Discover exceptions and potential observations.

import React, { useState } from 'react';
import {
  Play, Plus, CheckCircle2, AlertCircle, AlertTriangle, ChevronDown, ChevronRight,
  X, FileText, Search as SearchIcon, Workflow, MessageSquare, Eye, Database, Info, Shield,
} from 'lucide-react';
import type { ConfigurableEngagement } from '../../configurableEngagementTypes';
import type { InternalAuditRequestState } from './internalAuditRequestsData';
import type { InternalAuditScopeState } from './internalAuditScopeData';
import { WORKFLOWS } from './internalAuditScopeData';
import {
  simulateAnalysisRun, deriveAnalysisSummary, RUN_TYPE_LABELS, SEVERITY_CLS, EX_STATUS_CLS,
  type InternalAuditAnalysisState, type AnalysisRun, type AnalysisRunType,
} from './internalAuditAnalysisData';
import type { InternalAuditObservationsState, InternalAuditObservation } from './internalAuditObservationsData';

function now(): string { return new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
const inputCls = 'w-full px-3 py-2 border border-border rounded-lg text-[12px] text-text bg-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all';
const selectCls = inputCls + ' cursor-pointer appearance-none';
const labelCls = 'text-[11px] font-semibold text-text-muted block mb-1';
const RUN_STATUS_CLS = { DRAFT: 'bg-gray-100 text-gray-600', READY: 'bg-blue-50 text-blue-700', RUNNING: 'bg-purple-50 text-purple-700', COMPLETED: 'bg-emerald-50 text-emerald-700', FAILED: 'bg-red-50 text-red-700' };
const MODE_ICONS: Record<AnalysisRunType, React.ElementType> = { WORKFLOW: Workflow, QA_ANALYSIS: MessageSquare, DOCUMENT_REVIEW: Eye, DATA_REVIEW: Database };

interface Props {
  engagement: ConfigurableEngagement;
  scope: InternalAuditScopeState;
  requestState: InternalAuditRequestState;
  analysisState: InternalAuditAnalysisState;
  onUpdateAnalysis: (state: InternalAuditAnalysisState) => void;
  observationsState: InternalAuditObservationsState;
  onUpdateObservations: (state: InternalAuditObservationsState) => void;
  onNavigateTab?: (tabId: string) => void;
}

export default function InternalAuditAnalysisTab({ engagement, scope, requestState, analysisState, onUpdateAnalysis, observationsState, onUpdateObservations, onNavigateTab }: Props) {
  const { requests, proceedWithoutIDR } = requestState;
  const receivedFiles = requests.filter(r => r.filesReceived.length > 0).flatMap(r => r.filesReceived.map(f => ({ file: f, requestId: r.id, requestTitle: r.title, requestType: r.requestType, scopeLabel: r.linkedScopeLabel })));
  const summary = deriveAnalysisSummary(analysisState);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const hasInputs = receivedFiles.length > 0 || proceedWithoutIDR;

  // No inputs state
  if (!hasInputs) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertCircle size={24} className="text-gray-300 mb-3" />
        <h4 className="text-[14px] font-semibold text-text mb-1">Analysis</h4>
        <p className="text-[12px] text-text-muted mb-4">No received IDR files available yet. Receive IDR files or proceed without IDR to start analysis.</p>
        <button onClick={() => onNavigateTab?.('requests-idr')}
          className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-[12px] font-semibold cursor-pointer transition-colors flex items-center gap-1">
          Go to Requests / IDR <ChevronRight size={12} />
        </button>
      </div>
    );
  }

  const handleRunAnalysis = (runId: string) => {
    const run = analysisState.runs.find(r => r.id === runId);
    if (!run || run.status !== 'READY') return;
    const completed = simulateAnalysisRun(run, engagement.owner);
    onUpdateAnalysis({ ...analysisState, runs: analysisState.runs.map(r => r.id === runId ? completed : r) });
  };

  const cfg = engagement.config as import('../../configurableEngagementTypes').InternalAuditConfig;
  const ts = new Date().toISOString().slice(0, 10);
  const tsNow = now();

  // Promote single finding → directly creates formal observation
  const handleCreatePotentialObs = (runId: string, exceptionId: string) => {
    const run = analysisState.runs.find(r => r.id === runId);
    const ex = run?.exceptions.find(e => e.id === exceptionId);
    if (!run || !ex) return;
    const formalObs: InternalAuditObservation = {
      id: `obs-${Date.now()}`, title: ex.title, description: ex.description,
      sourceType: 'ANALYSIS_EXCEPTION', sourceRunId: runId, linkedExceptionIds: [exceptionId],
      linkedScopeLabel: ex.linkedScopeLabel, severity: ex.severity, riskRating: ex.severity,
      observationCategory: 'CONTROL_GAP', rootCause: '', impact: '', recommendation: '',
      processOwner: cfg.processOwner || '', targetRemediationDate: '',
      status: 'DRAFT', createdAt: ts, updatedAt: ts,
      history: [{ id: `oh-${Date.now()}`, action: 'CREATED', actor: engagement.owner, timestamp: tsNow, comments: 'Promoted from analysis finding.' }],
    };
    onUpdateAnalysis({
      ...analysisState,
      runs: analysisState.runs.map(r => r.id === runId ? { ...r, exceptions: r.exceptions.map(e => e.id === exceptionId ? { ...e, status: 'CONVERTED_TO_OBSERVATION' as const } : e) } : r),
    });
    onUpdateObservations({
      ...observationsState,
      observations: [...observationsState.observations, formalObs],
      noObservationsConfirmed: false,
    });
  };

  // Batch promote — all open findings for a control → directly creates formal observations
  const handlePromoteAllForControl = (controlRuns: typeof analysisState.runs) => {
    const openExceptions = controlRuns.flatMap(r => r.exceptions.filter(e => e.status === 'OPEN').map(e => ({ run: r, ex: e })));
    if (openExceptions.length === 0) return;
    const newObs: InternalAuditObservation[] = openExceptions.map(({ run, ex }, i) => ({
      id: `obs-${Date.now()}-${i}`, title: ex.title, description: ex.description,
      sourceType: 'ANALYSIS_EXCEPTION' as const, sourceRunId: run.id, linkedExceptionIds: [ex.id],
      linkedScopeLabel: ex.linkedScopeLabel, severity: ex.severity, riskRating: ex.severity,
      observationCategory: 'CONTROL_GAP' as const, rootCause: '', impact: '', recommendation: '',
      processOwner: cfg.processOwner || '', targetRemediationDate: '',
      status: 'DRAFT' as const, createdAt: ts, updatedAt: ts,
      history: [{ id: `oh-${Date.now()}-${i}`, action: 'CREATED', actor: engagement.owner, timestamp: tsNow, comments: 'Promoted from analysis finding.' }],
    }));
    const promotedExIds = new Set(openExceptions.map(({ ex }) => ex.id));
    onUpdateAnalysis({
      ...analysisState,
      runs: analysisState.runs.map(r => ({
        ...r, exceptions: r.exceptions.map(e => promotedExIds.has(e.id) ? { ...e, status: 'CONVERTED_TO_OBSERVATION' as const } : e),
      })),
    });
    onUpdateObservations({
      ...observationsState,
      observations: [...observationsState.observations, ...newObs],
      noObservationsConfirmed: false,
    });
  };

  const handleUpdateExStatus = (runId: string, exId: string, status: 'REVIEWED' | 'DISMISSED') => {
    onUpdateAnalysis({
      ...analysisState,
      runs: analysisState.runs.map(r => r.id === runId ? { ...r, exceptions: r.exceptions.map(e => e.id === exId ? { ...e, status } : e) } : r),
    });
  };

  const addRun = (run: AnalysisRun) => {
    onUpdateAnalysis({ ...analysisState, runs: [...analysisState.runs, run] });
    setShowCreateForm(false);
  };

  const hasCompletedRuns = analysisState.runs.some(r => r.status === 'COMPLETED');
  const hasPotentialObs = analysisState.potentialObservations.length > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[15px] font-bold text-text mb-0.5">Analysis</h3>
          <p className="text-[12px] text-text-muted">Run workflow checks, Q&A, and document/data review to identify exceptions and potential observations.</p>
        </div>
        <button onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[11px] font-semibold cursor-pointer transition-colors shrink-0">
          <Plus size={12} />Create Analysis Run
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-6 gap-2">
        {[
          { label: 'Input Files', value: receivedFiles.length },
          { label: 'Analysis Runs', value: summary.totalRuns },
          { label: 'Completed', value: summary.completedRuns, cls: 'text-emerald-600' },
          { label: 'Open Exceptions', value: summary.openExceptions, cls: summary.openExceptions > 0 ? 'text-amber-600' : '' },
          { label: 'Potential Obs.', value: summary.potObs },
          { label: 'Ready for Obs.', value: summary.converted, cls: summary.converted > 0 ? 'text-primary' : '' },
        ].map(s => (
          <div key={s.label} className="rounded-lg border border-border-light p-2.5 text-center">
            <div className={`text-[16px] font-bold tabular-nums ${s.cls || 'text-text'}`}>{s.value}</div>
            <div className="text-[9px] text-gray-400 font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Available Inputs */}
      {receivedFiles.length > 0 && (
        <div className="rounded-lg border border-border-light p-3">
          <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Available Analysis Inputs ({receivedFiles.length} files)</h4>
          <div className="flex flex-wrap gap-1.5">
            {receivedFiles.map((f, i) => (
              <span key={i} className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[9px] text-emerald-700">
                <FileText size={9} />{f.file}
                <span className="text-emerald-500 text-[7px]">({f.scopeLabel})</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Control-wise Workflow Findings (from Controls tab execution) ── */}
      {(() => {
        const controlRuns = analysisState.runs.filter(r => r.status === 'COMPLETED' && r.runType === 'WORKFLOW' && r.linkedScopeLabel);
        if (controlRuns.length === 0) return null;
        // Group by control (linkedScopeLabel)
        const controlGroups = new Map<string, typeof controlRuns>();
        for (const r of controlRuns) {
          const key = r.linkedScopeLabel;
          if (!controlGroups.has(key)) controlGroups.set(key, []);
          controlGroups.get(key)!.push(r);
        }
        const totalFindings = controlRuns.flatMap(r => r.exceptions).length;
        const highCritical = controlRuns.flatMap(r => r.exceptions).filter(e => e.severity === 'HIGH' || e.severity === 'CRITICAL').length;
        const openFindings = controlRuns.flatMap(r => r.exceptions).filter(e => e.status === 'OPEN').length;
        return (
          <div className="space-y-3">
            {/* Executive summary */}
            <div className="rounded-xl border border-border-light bg-white p-4">
              <h4 className="text-[12px] font-bold text-text mb-3 flex items-center gap-2"><Shield size={13} className="text-primary" />Control Execution Summary</h4>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { label: 'Controls Executed', value: controlGroups.size, color: 'text-primary' },
                  { label: 'Workflows Executed', value: controlRuns.length, color: 'text-text' },
                  { label: 'Findings Generated', value: totalFindings, color: totalFindings > 0 ? 'text-amber-600' : 'text-text' },
                  { label: 'High / Critical', value: highCritical, color: highCritical > 0 ? 'text-red-600' : 'text-gray-400' },
                  { label: 'Pending Review', value: openFindings, color: openFindings > 0 ? 'text-amber-600' : 'text-emerald-600' },
                ].map(s => (
                  <div key={s.label} className="rounded-lg border border-border-light p-2.5 text-center">
                    <div className={`text-[16px] font-bold tabular-nums ${s.color}`}>{s.value}</div>
                    <div className="text-[9px] text-gray-400 font-medium">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Control-grouped findings */}
            {Array.from(controlGroups.entries()).map(([controlName, runs]) => {
              const allEx = runs.flatMap(r => r.exceptions);
              return (
                <div key={controlName} className="rounded-xl border border-border-light bg-white overflow-hidden">
                  <div className="px-4 py-3 border-b border-border-light bg-surface-2/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Shield size={12} className="text-primary shrink-0" />
                        <span className="text-[12px] font-semibold text-text">{controlName}</span>
                        <span className="text-[10px] text-gray-400">{runs.length} workflow{runs.length !== 1 ? 's' : ''} executed</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {allEx.filter(e => e.status === 'OPEN').length > 0 && (
                          <button onClick={() => handlePromoteAllForControl(runs)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 cursor-pointer transition-colors">
                            Promote All ({allEx.filter(e => e.status === 'OPEN').length})
                          </button>
                        )}
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold ${allEx.length > 0 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                          {allEx.length > 0 ? `${allEx.length} finding${allEx.length !== 1 ? 's' : ''}` : 'Clean'}
                        </span>
                      </div>
                    </div>
                  </div>
                  {allEx.length > 0 ? (
                    <div className="divide-y divide-border-light/50">
                      {allEx.map(ex => {
                        const parentRun = runs.find(r => r.exceptions.some(e => e.id === ex.id))!;
                        return (
                          <div key={ex.id} className="flex items-start gap-3 px-4 py-2.5">
                            <AlertTriangle size={12} className={`shrink-0 mt-0.5 ${ex.severity === 'HIGH' || ex.severity === 'CRITICAL' ? 'text-red-500' : 'text-amber-500'}`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-semibold text-text">{ex.title}</span>
                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${SEVERITY_CLS[ex.severity]}`}>{ex.severity}</span>
                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${EX_STATUS_CLS[ex.status]}`}>{ex.status === 'OPEN' ? 'Potential Finding' : ex.status === 'CONVERTED_TO_OBSERVATION' ? 'Promoted' : ex.status}</span>
                              </div>
                              <p className="text-[10px] text-gray-400 mt-0.5">{ex.description}</p>
                              <span className="text-[9px] text-gray-400 mt-0.5 inline-block">Source: {parentRun.workflowName}</span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                              {ex.status === 'OPEN' && (
                                <>
                                  <button onClick={() => handleUpdateExStatus(parentRun.id, ex.id, 'REVIEWED')}
                                    className="px-2 py-1 rounded text-[9px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 cursor-pointer transition-colors">Review</button>
                                  <button onClick={() => handleUpdateExStatus(parentRun.id, ex.id, 'DISMISSED')}
                                    className="px-2 py-1 rounded text-[9px] font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 cursor-pointer transition-colors">Dismiss</button>
                                  <button onClick={() => handleCreatePotentialObs(parentRun.id, ex.id)}
                                    className="px-2 py-1 rounded text-[9px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 cursor-pointer transition-colors">Promote to Observation</button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="px-4 py-3 text-[11px] text-emerald-600 flex items-center gap-1.5"><CheckCircle2 size={11} />No findings — clean execution.</div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Create form */}
      {showCreateForm && <CreateRunForm receivedFiles={receivedFiles.map(f => f.file)} workflows={WORKFLOWS} onSave={addRun} onCancel={() => setShowCreateForm(false)} />}

      {/* Runs table */}
      {analysisState.runs.length > 0 && (
        <div className="rounded-lg border border-border-light overflow-hidden">
          <div className="px-4 py-2 bg-surface-2/20 border-b border-border-light">
            <h4 className="text-[11px] font-bold text-text">Analysis Runs ({analysisState.runs.length})</h4>
          </div>
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-border-light bg-surface-2/30 text-[9px] font-semibold text-gray-400 uppercase">
                <th className="px-3 py-1.5 text-left w-5"></th>
                <th className="px-3 py-1.5 text-left">Run</th>
                <th className="px-3 py-1.5 text-center">Mode</th>
                <th className="px-3 py-1.5 text-center">Status</th>
                <th className="px-3 py-1.5 text-center">Exceptions</th>
                <th className="px-3 py-1.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {analysisState.runs.map(run => {
                const isExp = expandedRunId === run.id;
                const Icon = MODE_ICONS[run.runType];
                return (
                  <React.Fragment key={run.id}>
                    <tr className={`border-b border-border-light/50 cursor-pointer hover:bg-surface-2/20 ${isExp ? 'bg-surface-2/20' : ''}`}
                      onClick={() => setExpandedRunId(isExp ? null : run.id)}>
                      <td className="px-3 py-2 text-gray-400">{isExp ? <ChevronDown size={11} /> : <ChevronRight size={11} />}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-text">{run.title}</div>
                        <div className="text-[9px] text-gray-400">{run.linkedScopeLabel} · {run.createdAt}</div>
                      </td>
                      <td className="px-3 py-2 text-center"><span className="flex items-center justify-center gap-1 text-[9px] text-gray-500"><Icon size={10} />{RUN_TYPE_LABELS[run.runType]}</span></td>
                      <td className="px-3 py-2 text-center"><span className={`px-2 py-0.5 rounded-full text-[8px] font-bold ${RUN_STATUS_CLS[run.status]}`}>{run.status}</span></td>
                      <td className="px-3 py-2 text-center"><span className={`font-medium tabular-nums ${run.exceptions.filter(e => e.status === 'OPEN').length > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{run.exceptions.length > 0 ? `${run.exceptions.filter(e => e.status === 'OPEN').length} open` : '—'}</span></td>
                      <td className="px-3 py-2 text-center" onClick={e => e.stopPropagation()}>
                        {run.status === 'READY' && (
                          <button onClick={() => handleRunAnalysis(run.id)}
                            className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 cursor-pointer transition-colors mx-auto">
                            <Play size={9} />Run
                          </button>
                        )}
                        {run.status === 'COMPLETED' && <span className="text-[9px] text-emerald-600">Done</span>}
                      </td>
                    </tr>
                    {isExp && run.status === 'COMPLETED' && (
                      <tr><td colSpan={6} className="p-0">
                        <RunDetail run={run} onCreateObs={handleCreatePotentialObs} onUpdateExStatus={handleUpdateExStatus} />
                      </td></tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Potential Observations */}
      {hasPotentialObs && (
        <div className="rounded-lg border border-border-light overflow-hidden">
          <div className="px-4 py-2 bg-surface-2/20 border-b border-border-light">
            <h4 className="text-[11px] font-bold text-text">Potential Observations ({analysisState.potentialObservations.length})</h4>
          </div>
          <table className="w-full text-[10px]">
            <thead><tr className="border-b border-border-light bg-surface-2/30 text-[8px] font-semibold text-gray-400 uppercase">
              <th className="px-3 py-1.5 text-left">Observation</th>
              <th className="px-3 py-1.5 text-center">Severity</th>
              <th className="px-3 py-1.5 text-left">Scope</th>
              <th className="px-3 py-1.5 text-center">Status</th>
            </tr></thead>
            <tbody>
              {analysisState.potentialObservations.map(o => (
                <tr key={o.id} className="border-b border-border-light/50">
                  <td className="px-3 py-2"><span className="font-medium text-text">{o.title}</span><div className="text-[9px] text-gray-400 mt-0.5">{o.description.slice(0, 80)}...</div></td>
                  <td className="px-3 py-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${SEVERITY_CLS[o.severity]}`}>{o.severity}</span></td>
                  <td className="px-3 py-2 text-gray-500">{o.linkedScopeLabel}</td>
                  <td className="px-3 py-2 text-center"><span className="px-2 py-0.5 rounded-full text-[8px] font-bold bg-primary/10 text-primary">{o.status === 'READY_FOR_OBSERVATION' ? 'Ready' : o.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Next CTA */}
      <div className="rounded-lg border border-border-light p-4 space-y-2">
        <h4 className="text-[11px] font-bold text-text">Next Step</h4>
        {!hasCompletedRuns && !hasPotentialObs ? (
          <span className="text-[10px] text-gray-500">Complete at least one analysis run before moving to observations.</span>
        ) : (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-blue-50/50 border border-blue-200/50 text-[10px] text-blue-600">
            <Info size={11} className="shrink-0 mt-0.5" />
            <span>Potential observations will be converted to formal audit observations in the Observations tab.</span>
          </div>
        )}
        <button onClick={() => onNavigateTab?.('observations')} disabled={!hasCompletedRuns && !hasPotentialObs}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[11px] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          Continue to Observations <ChevronRight size={11} />
        </button>
      </div>
    </div>
  );
}

// ─── Run Detail ───────────────────────────────────────────────────────────

function RunDetail({ run, onCreateObs, onUpdateExStatus }: {
  run: AnalysisRun;
  onCreateObs: (runId: string, exId: string) => void;
  onUpdateExStatus: (runId: string, exId: string, status: 'REVIEWED' | 'DISMISSED') => void;
}) {
  return (
    <div className="bg-surface-2/15 border-b border-border-light px-6 py-4 space-y-3">
      <div><h6 className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Summary</h6><p className="text-[11px] text-text">{run.summary}</p></div>
      <div className="grid grid-cols-3 gap-3 text-[10px]">
        <div><span className="text-gray-400 block text-[9px]">Input Files</span><span className="text-text">{run.inputFiles.join(', ') || '—'}</span></div>
        <div><span className="text-gray-400 block text-[9px]">{run.runType === 'WORKFLOW' ? 'Workflow' : 'Question'}</span><span className="text-text">{run.workflowName || run.question || '—'}</span></div>
        <div><span className="text-gray-400 block text-[9px]">Completed</span><span className="text-text">{run.completedAt} by {run.runBy}</span></div>
      </div>
      {run.exceptions.length > 0 && (
        <div>
          <h6 className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Exceptions ({run.exceptions.length})</h6>
          <div className="space-y-1.5">
            {run.exceptions.map(ex => (
              <div key={ex.id} className="rounded-lg border border-border-light p-3 flex items-start gap-3">
                <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold shrink-0 mt-0.5 ${SEVERITY_CLS[ex.severity]}`}>{ex.severity}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-medium text-text mb-0.5">{ex.title}</div>
                  <div className="text-[10px] text-gray-500 mb-1">{ex.description}</div>
                  <div className="flex items-center gap-2 text-[9px] text-gray-400">
                    <span>Source: {ex.source}</span>
                    <span>· File: {ex.linkedFile}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[7px] font-bold ${EX_STATUS_CLS[ex.status]}`}>{ex.status.replace(/_/g, ' ')}</span>
                  </div>
                </div>
                {ex.status === 'OPEN' && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => onUpdateExStatus(run.id, ex.id, 'REVIEWED')} className="px-2 py-1 rounded text-[8px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 cursor-pointer transition-colors">Review</button>
                    <button onClick={() => onUpdateExStatus(run.id, ex.id, 'DISMISSED')} className="px-2 py-1 rounded text-[8px] font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 cursor-pointer transition-colors">Dismiss</button>
                    <button onClick={() => onCreateObs(run.id, ex.id)} className="px-2 py-1 rounded text-[8px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 cursor-pointer transition-colors">→ Observation</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Create Run Form ──────────────────────────────────────────────────────

function CreateRunForm({ receivedFiles, workflows, onSave, onCancel }: {
  receivedFiles: string[];
  workflows: { id: string; name: string; type: string }[];
  onSave: (run: AnalysisRun) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [runType, setRunType] = useState<AnalysisRunType>('WORKFLOW');
  const [scopeLabel, setScopeLabel] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [workflowName, setWorkflowName] = useState('');
  const [question, setQuestion] = useState('');

  const toggleFile = (f: string) => setSelectedFiles(prev => { const n = new Set(prev); n.has(f) ? n.delete(f) : n.add(f); return n; });

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({
      id: `ar-${Date.now()}`, runType, title: title.trim(), linkedScopeType: 'PROCESS', linkedScopeLabel: scopeLabel.trim() || 'General',
      inputFiles: Array.from(selectedFiles), workflowName, question,
      status: 'READY', startedAt: null, completedAt: null, runBy: '', summary: '', exceptions: [],
      createdAt: new Date().toISOString().slice(0, 10),
    });
  };

  return (
    <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center justify-between"><h4 className="text-[13px] font-bold text-text">Create Analysis Run</h4><button onClick={onCancel} className="p-1 rounded text-gray-400 hover:text-text cursor-pointer"><X size={14} /></button></div>

      {/* Mode selector */}
      <div>
        <label className={labelCls}>Analysis Mode</label>
        <div className="flex gap-2">
          {(['WORKFLOW', 'QA_ANALYSIS', 'DOCUMENT_REVIEW', 'DATA_REVIEW'] as AnalysisRunType[]).map(t => {
            const Icon = MODE_ICONS[t];
            return (
              <button key={t} onClick={() => setRunType(t)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold cursor-pointer border-2 transition-all ${runType === t ? 'border-primary bg-primary/10 text-primary' : 'border-border-light text-gray-500 hover:border-gray-300'}`}>
                <Icon size={11} />{RUN_TYPE_LABELS[t]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div><label className={labelCls}>Title <span className="text-red-400">*</span></label><input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Duplicate Invoice Check" className={inputCls} /></div>
        <div><label className={labelCls}>Scope Context</label><input value={scopeLabel} onChange={e => setScopeLabel(e.target.value)} placeholder="e.g. Invoice Processing" className={inputCls} /></div>
      </div>

      {runType === 'WORKFLOW' && (
        <div><label className={labelCls}>Workflow</label>
          <select value={workflowName} onChange={e => setWorkflowName(e.target.value)} className={selectCls}>
            <option value="">Select workflow...</option>
            {workflows.map(w => <option key={w.id} value={w.name}>{w.name} ({w.type})</option>)}
          </select>
        </div>
      )}
      {(runType === 'QA_ANALYSIS' || runType === 'DOCUMENT_REVIEW' || runType === 'DATA_REVIEW') && (
        <div><label className={labelCls}>{runType === 'QA_ANALYSIS' ? 'Question / Instruction' : 'Review Focus'}</label>
          <textarea value={question} onChange={e => setQuestion(e.target.value)} rows={2}
            placeholder={runType === 'QA_ANALYSIS' ? 'e.g. Find payments without proper approval' : 'e.g. Compare SOP against walkthrough evidence'}
            className={inputCls + ' resize-none'} />
        </div>
      )}

      {receivedFiles.length > 0 && (
        <div><label className={labelCls}>Input Files</label>
          <div className="flex flex-wrap gap-1.5">
            {receivedFiles.map(f => (
              <button key={f} onClick={() => toggleFile(f)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-medium cursor-pointer transition-colors ${selectedFiles.has(f) ? 'bg-primary/10 text-primary border border-primary/30' : 'bg-gray-100 text-gray-500 border border-transparent hover:bg-gray-200'}`}>
                <FileText size={8} />{f}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg border border-border-light text-[11px] font-medium text-text-muted hover:bg-surface-2/30 cursor-pointer transition-colors">Cancel</button>
        <button onClick={handleSave} disabled={!title.trim()}
          className="px-4 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[11px] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Create Run</button>
      </div>
    </div>
  );
}
