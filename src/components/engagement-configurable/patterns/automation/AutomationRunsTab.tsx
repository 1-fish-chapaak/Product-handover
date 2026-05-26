// ─── Automation Project — Runs Tab ────────────────────────────────────────
// Execute automation runs and view history, outputs, exceptions.

import React, { useState, useMemo } from 'react';
import {
  Play, CheckCircle2, AlertCircle, ChevronDown, ChevronRight, Lock, X, Info,
} from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import type { ConfigurableEngagement, AutomationProjectConfig } from '../../configurableEngagementTypes';
import type { AutomationInputDataState } from './automationInputData';
import type { AutomationSetupState } from './automationSetupData';
import { deriveSetupReadiness, SETUP_MODE_LABELS, MOCK_WORKFLOWS } from './automationSetupData';
import {
  simulateRun, deriveRunsSummary, RUN_STATUS_CLS, EX_SEVERITY_CLS, EX_STATUS_CLS, EX_CAT_LABELS,
  type AutomationRunsState, type AutomationRun, type AutoRunType, type ExceptionStatus,
} from './automationRunsData';
import { BulkExecuteModal } from '../../../workflow/BulkExecuteModal';
import type { LibraryWorkflow } from '../../../workflow/WorkflowLibraryView';

const inputCls = 'w-full px-3 py-2 border border-border rounded-lg text-[12px] text-text bg-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all';
const labelCls = 'text-[11px] font-semibold text-text-muted block mb-1';

interface Props {
  engagement: ConfigurableEngagement;
  inputData: AutomationInputDataState;
  setup: AutomationSetupState;
  runsState: AutomationRunsState;
  onUpdateRuns: (state: AutomationRunsState) => void;
  onNavigateTab?: (tabId: string) => void;
}

export default function AutomationRunsTab({ engagement, inputData, setup, runsState, onUpdateRuns, onNavigateTab }: Props) {
  const cfg = engagement.config as AutomationProjectConfig;
  const { status: setupStatus } = deriveSetupReadiness(inputData, setup, cfg);
  const isReady = setupStatus === 'READY_FOR_RUN';
  const summary = deriveRunsSummary(runsState);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [runName, setRunName] = useState('');
  const [showBulkModal, setShowBulkModal] = useState(false);

  // Locked state
  if (!isReady) {
    return (
      <div className="space-y-4">
        <div><h3 className="text-[15px] font-bold text-text mb-0.5">Runs</h3><p className="text-[12px] text-text-muted">Execute configured automation and review run history.</p></div>
        <div className="rounded-xl border-2 border-gray-200 bg-gray-50/30 p-6 text-center space-y-3">
          <Lock size={28} className="text-gray-300 mx-auto" />
          <h4 className="text-[14px] font-semibold text-text">Runs Locked</h4>
          <p className="text-[12px] text-text-muted">Configure automation setup before creating runs.</p>
          <div className="text-[11px] text-gray-500">Setup status: <span className="font-semibold">{setupStatus.replace(/_/g, ' ')}</span></div>
          <button onClick={() => onNavigateTab?.('automation-setup')} className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-[12px] font-semibold cursor-pointer transition-colors inline-flex items-center gap-1">Go to Automation Setup <ChevronRight size={12} /></button>
        </div>
      </div>
    );
  }

  const runType: AutoRunType = setup.setupMode === 'SELECT_EXISTING_WORKFLOW' ? 'WORKFLOW' : setup.setupMode === 'CREATE_NEW_WORKFLOW' ? 'DRAFT_WORKFLOW' : 'QA_ADHOC';
  const wfNames = setup.selectedWorkflowNames?.length ? setup.selectedWorkflowNames : (setup.selectedWorkflowName ? [setup.selectedWorkflowName] : []);
  const wfIds = setup.selectedWorkflowIds?.length ? setup.selectedWorkflowIds : (setup.selectedWorkflowId ? [setup.selectedWorkflowId] : []);
  const wfLabel = wfNames.length > 1 ? `${wfNames.length} Workflows` : (wfNames[0] || setup.draftWorkflow?.name || setup.qaSetup?.objective || 'Automation');
  const defaultRunName = `${wfLabel} Run — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  const isBulk = wfNames.length > 1;
  const isWorkflowMode = setup.setupMode === 'SELECT_EXISTING_WORKFLOW' || setup.setupMode === 'CREATE_NEW_WORKFLOW';

  // Map V3 selected workflows to LibraryWorkflow format for BulkExecuteModal
  const libraryWorkflows = useMemo((): LibraryWorkflow[] => {
    return wfIds.map((id, i) => {
      const mockWf = MOCK_WORKFLOWS.find(w => w.id === id);
      const createdWf = (setup.createdWorkflows || []).find(w => w.id === id);
      const name = wfNames[i] || mockWf?.name || createdWf?.name || 'Workflow';
      return {
        id,
        name,
        description: mockWf?.description || createdWf?.description || createdWf?.objective || name,
        tags: mockWf ? mockWf.compatibleTypes : ['Automation'],
        businessProcess: engagement.businessProcess || 'P2P',
        controlId: mockWf?.id ? `CTRL-${mockWf.id.replace('mwf-', '')}` : `PRJ-${id.slice(-3)}`,
        live: !!mockWf,
      };
    });
  }, [wfIds, wfNames, setup.createdWorkflows, engagement.businessProcess]);

  // Q&A direct run (no modal needed)
  const handleCreateQARun = () => {
    const run: AutomationRun = {
      id: `run-${Date.now()}`, runName: runName.trim() || defaultRunName, runType, sourceSetupMode: setup.setupMode,
      workflowName: setup.qaSetup?.objective || '', inputSourceIds: inputData.selectedSourceIds,
      workflowIds: [], workflowNames: [], bulkRun: false,
      status: 'READY', startedAt: null, completedAt: null, runBy: '', summary: '', processedRecords: 0,
      exceptionCount: 0, outputCount: 0, outputs: [], exceptions: [], logs: [],
    };
    const completed = simulateRun(run, setup, inputData, engagement.owner);
    onUpdateRuns({ runs: [...runsState.runs, completed] });
    setRunName('');
  };

  // BulkExecuteModal completion — create + simulate V3 run
  const handleBulkModalComplete = () => {
    const run: AutomationRun = {
      id: `run-${Date.now()}`, runName: runName.trim() || defaultRunName, runType, sourceSetupMode: setup.setupMode,
      workflowName: wfNames[0] || '', inputSourceIds: inputData.selectedSourceIds,
      workflowIds: wfIds, workflowNames: wfNames, bulkRun: isBulk,
      status: 'READY', startedAt: null, completedAt: null, runBy: '', summary: '', processedRecords: 0,
      exceptionCount: 0, outputCount: 0, outputs: [], exceptions: [], logs: [],
    };
    const completed = simulateRun(run, setup, inputData, engagement.owner);
    onUpdateRuns({ runs: [...runsState.runs, completed] });
    setRunName('');
    setShowBulkModal(false);
  };

  const handleExecuteRun = (runId: string) => {
    const run = runsState.runs.find(r => r.id === runId);
    if (!run || run.status !== 'READY') return;
    const completed = simulateRun(run, setup, inputData, engagement.owner);
    onUpdateRuns({ runs: runsState.runs.map(r => r.id === runId ? completed : r) });
  };

  const updateExceptionStatus = (runId: string, exId: string, status: ExceptionStatus) => {
    onUpdateRuns({
      runs: runsState.runs.map(r => r.id === runId ? { ...r, exceptions: r.exceptions.map(e => e.id === exId ? { ...e, status } : e) } : r),
    });
  };

  const hasCompleted = runsState.runs.some(r => r.status === 'COMPLETED');
  const hasOutputs = runsState.runs.some(r => r.outputs.length > 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div><h3 className="text-[15px] font-bold text-text mb-0.5">Runs</h3><p className="text-[12px] text-text-muted">Execute selected workflows using the bulk run flow and review generated outputs and exceptions.</p></div>

      {/* Context */}
      <div className="rounded-lg border border-border-light p-3">
        <div className="grid grid-cols-4 gap-3 text-[11px]">
          <div><span className="text-gray-400 block text-[10px]">Automation Approach</span><span className="text-text font-medium">{SETUP_MODE_LABELS[setup.setupMode]}</span></div>
          <div><span className="text-gray-400 block text-[10px]">Workflows</span><span className="text-text font-medium truncate">{isBulk ? `Bulk run available · ${wfNames.length} workflows selected` : wfNames.length === 1 ? '1 workflow selected' : setup.setupMode === 'QA_ADHOC_ANALYSIS' ? 'Q&A / ad-hoc analysis setup' : 'No workflow selected'}</span></div>
          <div><span className="text-gray-400 block text-[10px]">Input Sources</span><span className="text-text font-medium">{inputData.selectedSourceIds.length} selected</span></div>
          <div><span className="text-gray-400 block text-[10px]">Run Type</span><span className="text-text font-medium">{cfg.runType.replace(/_/g, ' ')}{cfg.frequency ? ` (${cfg.frequency})` : ''}</span></div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-6 gap-2">
        {[
          { label: 'Total Runs', value: summary.total },
          { label: 'Completed', value: summary.completed, cls: 'text-emerald-600' },
          { label: 'Failed', value: summary.failed, cls: summary.failed > 0 ? 'text-red-600' : '' },
          { label: 'Open Exc.', value: summary.openExceptions, cls: summary.openExceptions > 0 ? 'text-amber-600' : '' },
          { label: 'Outputs', value: summary.outputs },
          { label: 'Last Status', value: summary.total > 0 ? summary.lastStatus : '—', cls: summary.lastStatus === 'COMPLETED' ? 'text-emerald-600' : '' },
        ].map(s => (
          <div key={s.label} className="rounded-lg border border-border-light p-2.5 text-center">
            <div className={`text-[16px] font-bold tabular-nums ${s.cls || 'text-text'}`}>{s.value}</div>
            <div className="text-[9px] text-gray-400 font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Run CTA */}
      <div className="rounded-lg border-2 border-dashed border-primary/20 bg-primary/5 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-[12px] font-bold text-text">{isWorkflowMode ? 'Execute Workflows' : 'Run Analysis'}</h4>
          {isBulk && <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[9px] font-bold">{wfNames.length} workflows selected</span>}
        </div>
        {isBulk && (
          <div className="flex flex-wrap gap-1">
            {wfNames.map((n, i) => <span key={i} className="px-1.5 py-0.5 rounded bg-gray-100 text-[9px] text-gray-600">{n}</span>)}
          </div>
        )}
        {isWorkflowMode && <p className="text-[10px] text-gray-500">Opens the Workflow Library bulk execution flow scoped to this automation project.</p>}

        {isWorkflowMode ? (
          <div className="flex items-center gap-3">
            <input value={runName} onChange={e => setRunName(e.target.value)} placeholder={defaultRunName} className="flex-1 px-3 py-2 border border-border rounded-lg text-[12px] text-text bg-white outline-none focus:border-primary/40" />
            <button onClick={() => setShowBulkModal(true)}
              className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-[12px] font-semibold cursor-pointer transition-colors shrink-0 flex items-center gap-1.5">
              <Play size={12} />{isBulk ? 'Run Selected Workflows' : 'Run Workflow'}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <input value={runName} onChange={e => setRunName(e.target.value)} placeholder={defaultRunName} className="flex-1 px-3 py-2 border border-border rounded-lg text-[12px] text-text bg-white outline-none focus:border-primary/40" />
            <button onClick={handleCreateQARun}
              className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-[12px] font-semibold cursor-pointer transition-colors shrink-0">Run Q&A Analysis</button>
          </div>
        )}
      </div>

      {/* Runs table */}
      {runsState.runs.length > 0 && (
        <div className="rounded-lg border border-border-light overflow-hidden">
          <div className="px-4 py-2 bg-surface-2/20 border-b border-border-light"><h4 className="text-[11px] font-bold text-text">Run History ({runsState.runs.length})</h4></div>
          <table className="w-full text-[11px]">
            <thead><tr className="border-b border-border-light bg-surface-2/30 text-[9px] font-semibold text-gray-400 uppercase">
              <th className="px-3 py-1.5 text-left w-5"></th><th className="px-3 py-1.5 text-left">Run</th><th className="px-3 py-1.5 text-center">Type</th><th className="px-3 py-1.5 text-center">Processed</th><th className="px-3 py-1.5 text-center">Status</th><th className="px-3 py-1.5 text-center">Exceptions</th><th className="px-3 py-1.5 text-center">Outputs</th><th className="px-3 py-1.5 text-center">Action</th>
            </tr></thead>
            <tbody>{runsState.runs.map(run => {
              const isExp = expandedRunId === run.id;
              return (
                <React.Fragment key={run.id}>
                  <tr className={`border-b border-border-light/50 cursor-pointer hover:bg-surface-2/20 ${isExp ? 'bg-surface-2/20' : ''}`} onClick={() => setExpandedRunId(isExp ? null : run.id)}>
                    <td className="px-3 py-2 text-gray-400">{isExp ? <ChevronDown size={11} /> : <ChevronRight size={11} />}</td>
                    <td className="px-3 py-2"><div className="font-medium text-text">{run.runName}</div><div className="text-[9px] text-gray-400">{run.completedAt || 'Pending'}</div></td>
                    <td className="px-3 py-2 text-center text-[10px] text-gray-500">{run.bulkRun ? `Bulk (${run.workflowNames?.length || 0})` : run.runType === 'QA_ADHOC' ? 'Q&A' : run.runType === 'DRAFT_WORKFLOW' ? 'Draft WF' : 'Workflow'}</td>
                    <td className="px-3 py-2 text-center tabular-nums text-gray-500">{run.processedRecords || '—'}</td>
                    <td className="px-3 py-2 text-center"><span className={`px-2 py-0.5 rounded-full text-[8px] font-bold ${RUN_STATUS_CLS[run.status]}`}>{run.status}</span></td>
                    <td className="px-3 py-2 text-center"><span className={`tabular-nums ${run.exceptionCount > 0 ? 'text-amber-600 font-medium' : 'text-gray-400'}`}>{run.exceptionCount}</span></td>
                    <td className="px-3 py-2 text-center tabular-nums text-gray-500">{run.outputCount}</td>
                    <td className="px-3 py-2 text-center" onClick={e => e.stopPropagation()}>
                      {run.status === 'READY' && <button onClick={() => handleExecuteRun(run.id)} className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 cursor-pointer transition-colors mx-auto"><Play size={9} />Run Now</button>}
                      {run.status === 'COMPLETED' && <span className="text-[9px] text-emerald-600">Done</span>}
                    </td>
                  </tr>
                  {isExp && run.status === 'COMPLETED' && (
                    <tr><td colSpan={8} className="p-0">
                      <RunDetail run={run} onUpdateException={(exId, status) => updateExceptionStatus(run.id, exId, status)} />
                    </td></tr>
                  )}
                </React.Fragment>
              );
            })}</tbody>
          </table>
        </div>
      )}

      {/* Output readiness */}
      <div className="rounded-lg border border-border-light p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-[11px] font-bold text-text">Output Readiness</h4>
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${hasCompleted && hasOutputs ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{hasCompleted && hasOutputs ? 'Ready' : 'Pending'}</span>
        </div>
        <div className="space-y-1">
          {[
            { label: 'At least one run completed', ok: hasCompleted },
            { label: 'Outputs generated', ok: hasOutputs },
            { label: 'Exceptions reviewed or marked', ok: summary.openExceptions === 0 || hasCompleted },
          ].map(c => (
            <div key={c.label} className="flex items-center gap-2 text-[10px]">
              {c.ok ? <CheckCircle2 size={10} className="text-emerald-500" /> : <AlertCircle size={10} className="text-amber-400" />}
              <span className={c.ok ? 'text-gray-500' : 'text-text'}>{c.label}</span>
            </div>
          ))}
        </div>
        <button onClick={() => onNavigateTab?.('output-review')} disabled={!hasCompleted}
          className="mt-2 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[11px] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          Continue to Output Review <ChevronRight size={11} />
        </button>
      </div>

      {/* BulkExecuteModal */}
      <AnimatePresence>
        {showBulkModal && (
          <BulkExecuteModal
            selectedWorkflows={libraryWorkflows}
            onClose={() => setShowBulkModal(false)}
            onContinue={() => handleBulkModalComplete()}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Run Detail ───────────────────────────────────────────────────────────

function RunDetail({ run, onUpdateException }: { run: AutomationRun; onUpdateException: (exId: string, status: ExceptionStatus) => void }) {
  return (
    <div className="bg-surface-2/15 border-b border-border-light px-6 py-4 space-y-3">
      <div><h6 className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Summary</h6><p className="text-[11px] text-text">{run.summary}</p></div>
      <div className="grid grid-cols-4 gap-3 text-[10px]">
        <div><span className="text-gray-400 block text-[9px]">Processed</span><span className="text-text font-medium tabular-nums">{run.processedRecords}</span></div>
        <div><span className="text-gray-400 block text-[9px]">Workflow{run.bulkRun ? 's' : ''}</span><span className="text-text">{run.bulkRun && run.workflowNames?.length ? `${run.workflowNames.length} workflows` : (run.workflowName || 'Q&A Analysis')}</span></div>
        <div><span className="text-gray-400 block text-[9px]">Completed</span><span className="text-text">{run.completedAt} by {run.runBy}</span></div>
        <div><span className="text-gray-400 block text-[9px]">Inputs</span><span className="text-text">{run.inputSourceIds.length} source(s)</span></div>
      </div>
      {run.bulkRun && run.workflowNames && run.workflowNames.length > 1 && (
        <div><h6 className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Workflows ({run.workflowNames.length})</h6><div className="flex flex-wrap gap-1">{run.workflowNames.map((n, i) => <span key={i} className="px-1.5 py-0.5 rounded bg-purple-50 text-[9px] text-purple-700">{n}</span>)}</div></div>
      )}

      {/* Outputs */}
      {run.outputs.length > 0 && (
        <div>
          <h6 className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Outputs ({run.outputs.length})</h6>
          <div className="rounded-lg border border-border-light overflow-hidden">
            <table className="w-full text-[10px]">
              <thead><tr className="border-b border-border-light bg-surface-2/30 text-[8px] font-semibold text-gray-400 uppercase">
                <th className="px-2 py-1 text-left">Output</th><th className="px-2 py-1 text-left">Type</th>{run.bulkRun && <th className="px-2 py-1 text-left">Workflow</th>}<th className="px-2 py-1 text-center">Records</th><th className="px-2 py-1 text-center">Status</th>
              </tr></thead>
              <tbody>{run.outputs.map(o => (
                <tr key={o.id} className="border-b border-border-light/50">
                  <td className="px-2 py-1.5 text-text font-medium">{o.name}</td>
                  <td className="px-2 py-1.5 text-gray-500">{o.outputType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}</td>
                  {run.bulkRun && <td className="px-2 py-1.5 text-gray-500 text-[9px]">{o.sourceWorkflowName || '—'}</td>}
                  <td className="px-2 py-1.5 text-center tabular-nums text-gray-500">{o.recordCount || '—'}</td>
                  <td className="px-2 py-1.5 text-center"><span className={`px-1.5 py-0.5 rounded text-[7px] font-bold ${o.status === 'GENERATED' ? 'bg-emerald-50 text-emerald-700' : o.status === 'NEEDS_REVIEW' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>{o.status.replace(/_/g, ' ')}</span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}

      {/* Exceptions */}
      {run.exceptions.length > 0 && (
        <div>
          <h6 className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Exceptions ({run.exceptions.length})</h6>
          <p className="text-[9px] text-gray-400 mb-1.5">Exceptions are not cases yet. Review and classify valid exceptions in Output Review.</p>
          <div className="space-y-1.5">{run.exceptions.map(ex => (
            <div key={ex.id} className="rounded-lg border border-border-light p-3 flex items-start gap-3">
              <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold shrink-0 mt-0.5 ${EX_SEVERITY_CLS[ex.severity]}`}>{ex.severity}</span>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-medium text-text mb-0.5">{ex.title}</div>
                <div className="text-[10px] text-gray-500 mb-1">{ex.description}</div>
                <div className="flex items-center gap-2 text-[9px] text-gray-400">
                  <span>{EX_CAT_LABELS[ex.category]}</span>
                  {ex.sourceWorkflowName && <span>· WF: {ex.sourceWorkflowName}</span>}
                  {ex.sourceRecord && <span>· Record: {ex.sourceRecord}</span>}
                  {ex.sourceFile && <span>· File: {ex.sourceFile}</span>}
                  <span className={`px-1.5 py-0.5 rounded text-[7px] font-bold ${EX_STATUS_CLS[ex.status]}`}>{ex.status.replace(/_/g, ' ')}</span>
                </div>
              </div>
              {ex.status === 'OPEN' && (
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => onUpdateException(ex.id, 'REVIEWED')} className="px-2 py-1 rounded text-[8px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 cursor-pointer transition-colors">Review</button>
                  <button onClick={() => onUpdateException(ex.id, 'DISMISSED')} className="px-2 py-1 rounded text-[8px] font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 cursor-pointer transition-colors">Dismiss</button>
                </div>
              )}
            </div>
          ))}</div>
        </div>
      )}

      {/* Logs */}
      {run.logs.length > 0 && (
        <div>
          <h6 className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Logs</h6>
          <div className="space-y-0.5">{run.logs.map(l => (
            <div key={l.id} className={`text-[9px] ${l.level === 'ERROR' ? 'text-red-600' : l.level === 'WARNING' ? 'text-amber-600' : 'text-gray-500'}`}>
              <span className="font-mono text-gray-400">{l.timestamp}</span> <span className="font-semibold">[{l.level}]</span> {l.message}
            </div>
          ))}</div>
        </div>
      )}
    </div>
  );
}
