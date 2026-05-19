// ─── Automation Project — Workflows Tab ───────────────────────────────────
// Workflow Library-style list + detail + BulkExecuteModal execution.

import React, { useState, useMemo } from 'react';
import {
  Search, Sparkles, Play, ArrowLeft, ChevronRight, ChevronDown, ExternalLink,
  CheckCircle2, AlertCircle, Info, Clock, Plus,
} from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import type { ConfigurableEngagement, AutomationProjectConfig } from '../../configurableEngagementTypes';
import type { AutomationInputDataState } from './automationInputData';
import type { AutomationSetupState, SetupMode, MockWorkflow } from './automationSetupData';
import { MOCK_WORKFLOWS } from './automationSetupData';
import type { AutomationRunsState, AutomationRun, AutoRunType } from './automationRunsData';
import { simulateRun, deriveRunsSummary, RUN_STATUS_CLS } from './automationRunsData';
import { BulkExecuteModal, Checkbox } from '../../../workflow/BulkExecuteModal';
import type { LibraryWorkflow } from '../../../workflow/WorkflowLibraryView';

function now(): string { return new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }

// Unified workflow shape for this tab
type ProjectWorkflow = {
  id: string; name: string; description: string; status: string;
  businessProcess: string; tags: string[]; controlId: string;
  isCreated: boolean; live: boolean; steps?: string[];
};

interface Props {
  engagement: ConfigurableEngagement;
  inputData: AutomationInputDataState;
  setup: AutomationSetupState;
  runsState: AutomationRunsState;
  onUpdateSetup: (state: AutomationSetupState) => void;
  onUpdateRuns: (state: AutomationRunsState) => void;
  onUpdateInputData?: (state: AutomationInputDataState) => void;
  onNavigateTab?: (tabId: string) => void;
}

export default function AutomationWorkflowsTab({ engagement, inputData, setup, runsState, onUpdateSetup, onUpdateRuns, onNavigateTab }: Props) {
  const cfg = engagement.config as AutomationProjectConfig;
  const summary = deriveRunsSummary(runsState);
  const [search, setSearch] = useState('');
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const bp = engagement.businessProcess || 'P2P';
  const createdWorkflows = setup.createdWorkflows || [];

  // Workflow IDs/names from setup
  const wfIds = setup.selectedWorkflowIds?.length ? setup.selectedWorkflowIds : (setup.selectedWorkflowId ? [setup.selectedWorkflowId] : []);

  // Build unified list
  const allWorkflows = useMemo((): ProjectWorkflow[] => [
    ...MOCK_WORKFLOWS.map(wf => ({
      id: wf.id, name: wf.name, description: wf.description,
      status: wf.status, businessProcess: bp,
      tags: wf.compatibleTypes, controlId: wf.id,
      isCreated: false, live: wf.status === 'Active',
      steps: wf.steps,
    })),
    ...createdWorkflows.filter(w => w.status === 'SAVED').map(w => ({
      id: w.id, name: w.name, description: w.description || w.objective,
      status: 'Active', businessProcess: bp,
      tags: ['Project'], controlId: w.id.slice(-6),
      isCreated: true, live: false,
      steps: w.steps.map(s => s.name || s.stepType),
    })),
  ], [createdWorkflows, bp]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allWorkflows;
    return allWorkflows.filter(w => w.name.toLowerCase().includes(q) || w.description.toLowerCase().includes(q));
  }, [allWorkflows, search]);

  // Toggle
  const toggleWorkflow = (id: string) => {
    const isSelected = wfIds.includes(id);
    const newIds = isSelected ? wfIds.filter(x => x !== id) : [...wfIds, id];
    const newNames = newIds.map(wid => allWorkflows.find(w => w.id === wid)?.name || '').filter(Boolean);
    onUpdateSetup({
      ...setup,
      setupMode: 'SELECT_EXISTING_WORKFLOW' as SetupMode,
      selectedWorkflowIds: newIds, selectedWorkflowNames: newNames,
      selectedWorkflowId: newIds[0] || '', selectedWorkflowName: newNames[0] || '',
      history: [...setup.history, { id: `sh-${Date.now()}`, action: 'WORKFLOW_TOGGLED', actor: engagement.owner, timestamp: now(), comments: `${newIds.length} selected` }],
    });
  };

  const allVisibleSelected = filtered.length > 0 && filtered.every(w => wfIds.includes(w.id));
  const someVisibleSelected = filtered.some(w => wfIds.includes(w.id));
  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      const removeIds = new Set(filtered.map(w => w.id));
      const newIds = wfIds.filter(id => !removeIds.has(id));
      const newNames = newIds.map(wid => allWorkflows.find(w => w.id === wid)?.name || '').filter(Boolean);
      onUpdateSetup({ ...setup, selectedWorkflowIds: newIds, selectedWorkflowNames: newNames, selectedWorkflowId: newIds[0] || '', selectedWorkflowName: newNames[0] || '' });
    } else {
      const addIds = new Set([...wfIds, ...filtered.map(w => w.id)]);
      const newIds = Array.from(addIds);
      const newNames = newIds.map(wid => allWorkflows.find(w => w.id === wid)?.name || '').filter(Boolean);
      onUpdateSetup({ ...setup, selectedWorkflowIds: newIds, selectedWorkflowNames: newNames, selectedWorkflowId: newIds[0] || '', selectedWorkflowName: newNames[0] || '' });
    }
  };

  // LibraryWorkflow map for modal
  const libraryWorkflows = useMemo((): LibraryWorkflow[] =>
    wfIds.map((id, i) => {
      const wf = allWorkflows.find(w => w.id === id);
      return { id, name: wf?.name || '', description: wf?.description || '', tags: wf?.tags || [], businessProcess: bp, controlId: wf?.controlId || '', live: wf?.live };
    }),
  [wfIds, allWorkflows, bp]);

  const wfNames = setup.selectedWorkflowNames?.length ? setup.selectedWorkflowNames : [];
  const isBulk = wfIds.length > 1;
  const wfLabel = wfIds.length > 1 ? `${wfIds.length} Workflows` : (wfNames[0] || 'Automation');
  const defaultRunName = `${wfLabel} Run — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  const handleBulkModalComplete = () => {
    const runType: AutoRunType = 'WORKFLOW';
    const run: AutomationRun = {
      id: `run-${Date.now()}`, runName: defaultRunName, runType, sourceSetupMode: setup.setupMode,
      workflowName: wfNames[0] || '', inputSourceIds: inputData.selectedSourceIds,
      workflowIds: wfIds, workflowNames: wfNames, bulkRun: isBulk,
      status: 'READY', startedAt: null, completedAt: null, runBy: '', summary: '', processedRecords: 0,
      exceptionCount: 0, outputCount: 0, outputs: [], exceptions: [], logs: [],
    };
    const completed = simulateRun(run, setup, inputData, engagement.owner);
    onUpdateRuns({ runs: [...runsState.runs, completed] });
    setShowBulkModal(false);
  };

  // ── Detail view ──
  if (detailId) {
    const wf = allWorkflows.find(w => w.id === detailId);
    if (!wf) { setDetailId(null); return null; }
    const wfRuns = runsState.runs.filter(r => r.workflowNames?.includes(wf.name) || r.workflowName === wf.name);
    return (
      <>
        <WorkflowDetailView wf={wf} runs={wfRuns} onBack={() => setDetailId(null)} onRun={() => { if (!wfIds.includes(wf.id)) toggleWorkflow(wf.id); setShowBulkModal(true); }} />
        <AnimatePresence>
          {showBulkModal && (
            <BulkExecuteModal selectedWorkflows={libraryWorkflows} onClose={() => setShowBulkModal(false)} onContinue={() => handleBulkModalComplete()} />
          )}
        </AnimatePresence>
      </>
    );
  }

  // ── List view ──
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="pb-4">
        <div className="font-mono text-[11px] text-text-muted mb-1 tracking-tight">Workflow Library</div>
        <h2 className="text-[22px] font-semibold text-text tracking-tight leading-tight">Workflows</h2>
        <p className="text-[13px] text-text-muted mt-1">Browse the workflow catalog and add the ones relevant to your project.</p>
      </div>

      {/* Search + Actions */}
      <div className="pb-4 flex items-center gap-3">
        {wfIds.length > 0 && <span className="text-[13px] text-text-muted"><span className="font-semibold text-text">{wfIds.length}</span> selected</span>}
        <div className="relative w-[320px]">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search workflow.."
            className="w-full pl-10 pr-4 h-10 rounded-md border border-border bg-white text-[13px] outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all" />
        </div>
        <div className="ml-auto flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 h-10 rounded-md bg-primary-xlight text-primary border border-primary/15 text-[13px] font-semibold hover:bg-primary/10 transition-colors cursor-pointer">
            <Sparkles size={14} />Create Workflow
          </button>
          <button onClick={() => { if (wfIds.length > 0) setShowBulkModal(true); }} disabled={wfIds.length === 0}
            className="flex items-center gap-2 px-4 h-10 rounded-md bg-primary text-white text-[13px] font-semibold hover:bg-primary-hover transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
            <Play size={14} />Run Selected
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto border-t border-border-light">
        <table className="w-full border-collapse">
          <thead className="bg-white sticky top-0 z-10 border-b border-border-light">
            <tr>
              <th className="pl-4 pr-2 py-3 w-[40px]">
                <Checkbox checked={allVisibleSelected} indeterminate={!allVisibleSelected && someVisibleSelected} onChange={toggleSelectAll} ariaLabel="Select all" />
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted w-[320px]">Workflow Name</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">Description</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted w-[120px]">Business Process</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted w-[140px]">Tags</th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-text-muted w-[80px]"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-16 text-center text-[13px] text-text-muted">No workflows match "{search}"</td></tr>
            ) : filtered.map(wf => {
              const isSelected = wfIds.includes(wf.id);
              return (
                <tr key={wf.id} onClick={() => toggleWorkflow(wf.id)}
                  className={`border-t border-border-light transition-colors cursor-pointer ${isSelected ? 'bg-primary-xlight/50 hover:bg-primary-xlight/70' : 'hover:bg-surface-2/40'}`}>
                  <td className="pl-4 pr-2 py-4 align-top">
                    <Checkbox checked={isSelected} onChange={() => toggleWorkflow(wf.id)} ariaLabel={`Select ${wf.name}`} />
                  </td>
                  <td className="px-4 py-4 align-top w-[320px]">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-start gap-2">
                        <span className="group inline cursor-pointer text-[13px] text-text font-medium hover:text-primary hover:underline line-clamp-2"
                          onClick={e => { e.stopPropagation(); setDetailId(wf.id); }}>
                          {wf.name}
                          <ExternalLink size={12} className="inline ml-1 opacity-0 group-hover:opacity-100 align-middle text-primary" />
                        </span>
                        {wf.live && (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 mt-0.5" style={{ backgroundColor: '#ECFEF3', color: '#047A48' }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#047A48' }} />Live
                          </span>
                        )}
                        {wf.isCreated && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-50 text-purple-700 shrink-0 mt-0.5">Project</span>}
                      </div>
                      <span className="text-[11px] font-mono text-text-muted/70 tracking-tight">{wf.controlId}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 align-top text-[13px] text-text-muted max-w-[400px]"><span className="line-clamp-2">{wf.description}</span></td>
                  <td className="px-4 py-4 align-top text-[13px] text-text-muted">{wf.businessProcess}</td>
                  <td className="px-4 py-4 align-top">
                    <div className="flex flex-wrap gap-1.5">
                      {wf.tags.map(t => <span key={t} className="inline-flex items-center px-2 py-0.5 rounded-md bg-surface-2 border border-border-light text-text-muted text-[11px] font-medium">{t}</span>)}
                    </div>
                  </td>
                  <td className="px-4 py-4 align-top text-right">
                    <button onClick={e => { e.stopPropagation(); setDetailId(wf.id); }}
                      className="px-2 py-1 rounded text-[11px] font-medium text-primary hover:bg-primary/10 cursor-pointer transition-colors">View</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Run history strip */}
      {summary.total > 0 && (
        <div className="flex items-center justify-between py-3 px-4 border-t border-border-light bg-white">
          <div className="flex items-center gap-4 text-[12px] text-text-muted">
            <span><span className="font-semibold text-text">{summary.total}</span> run{summary.total !== 1 ? 's' : ''}</span>
            <span><span className="font-semibold text-emerald-600">{summary.completed}</span> completed</span>
            {summary.openExceptions > 0 && <span><span className="font-semibold text-amber-600">{summary.openExceptions}</span> open exceptions</span>}
          </div>
          <button onClick={() => onNavigateTab?.('output-review')}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary hover:bg-primary-hover text-white text-[12px] font-semibold cursor-pointer transition-colors">
            Output Review <ChevronRight size={12} />
          </button>
        </div>
      )}

      {/* BulkExecuteModal */}
      <AnimatePresence>
        {showBulkModal && (
          <BulkExecuteModal selectedWorkflows={libraryWorkflows} onClose={() => setShowBulkModal(false)} onContinue={() => handleBulkModalComplete()} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Workflow Detail View ────────────────────────────────────────────────

const pillCls = (active: boolean) => `px-3.5 h-9 rounded-xl text-[13px] font-semibold transition-all cursor-pointer ${active ? 'bg-primary text-white shadow-sm' : 'bg-surface-2 text-text-muted hover:bg-surface-2/80 border border-border-light'}`;

function WorkflowDetailView({ wf, runs, onBack, onRun }: { wf: ProjectWorkflow; runs: AutomationRun[]; onBack: () => void; onRun: () => void }) {
  const [tab, setTab] = useState<'overview' | 'runs' | 'configuration'>('overview');
  const [frequency, setFrequency] = useState<'Hourly' | 'Daily' | 'Weekly' | 'Monthly'>('Daily');
  const [runTime, setRunTime] = useState('06:00');
  const [triggerOn, setTriggerOn] = useState<'Schedule' | 'Data Change' | 'Manual'>('Schedule');
  const [retry, setRetry] = useState<'Off' | '1x' | '3x' | '5x'>('3x');
  const lastRun = runs.length > 0 ? runs[runs.length - 1] : null;

  return (
    <div className="flex flex-col h-full">
      {/* Top */}
      <div className="pb-4">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[12px] text-text-muted hover:text-primary transition-colors cursor-pointer mb-3">
          <ArrowLeft size={14} />Back to Workflows
        </button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ backgroundColor: '#ECFEF3', color: '#047A48' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#047A48' }} />ACTIVE
              </span>
              <span className="text-[11px] font-mono text-text-muted">{wf.controlId}</span>
              {wf.isCreated && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-50 text-purple-700">Created in Project</span>}
            </div>
            <h2 className="text-[22px] font-semibold text-text tracking-tight leading-tight mb-1">{wf.name}</h2>
            {lastRun && <div className="flex items-center gap-1.5 text-[12px] text-text-muted"><Clock size={12} />Last run: {lastRun.completedAt || 'Pending'}</div>}
          </div>
          <button onClick={onRun}
            className="flex items-center gap-2 px-4 h-10 rounded-md bg-primary text-white text-[13px] font-semibold hover:bg-primary-hover transition-colors cursor-pointer shrink-0">
            <Sparkles size={14} />Open Executor
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 border-b border-border-light mb-4">
        {(['overview', 'runs', 'configuration'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 h-10 text-[13px] font-medium cursor-pointer transition-colors relative ${tab === t ? 'text-primary' : 'text-text-muted hover:text-text'}`}>
            {t === 'overview' ? 'Overview' : t === 'runs' ? `Runs ${runs.length}` : 'Configuration'}
            {tab === t && <div className="absolute left-0 right-0 -bottom-px h-[2px] bg-primary" />}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto">
        {tab === 'overview' && (
          <div className="space-y-5 max-w-[800px]">
            <div>
              <h3 className="text-[13px] font-semibold text-text mb-2">Description</h3>
              <p className="text-[13px] text-text-muted leading-relaxed">{wf.description}</p>
            </div>
            {wf.steps && wf.steps.length > 0 && (
              <div>
                <h3 className="text-[13px] font-semibold text-text mb-3">Steps</h3>
                <div className="space-y-3">
                  {wf.steps.map((step, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full bg-primary/10 text-primary text-[12px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</div>
                      <div>
                        <div className="text-[13px] font-medium text-text">{step}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div>
              <h3 className="text-[13px] font-semibold text-text mb-2">Tags</h3>
              <div className="flex flex-wrap gap-1.5">
                {wf.tags.map(t => <span key={t} className="inline-flex items-center px-2.5 py-1 rounded-md bg-surface-2 border border-border-light text-text-muted text-[12px] font-medium">{t}</span>)}
              </div>
            </div>
          </div>
        )}
        {tab === 'runs' && (
          <div>
            {runs.length === 0 ? (
              <div className="text-center py-12 text-[13px] text-text-muted">No runs for this workflow yet.</div>
            ) : (
              <table className="w-full text-[12px] border-collapse">
                <thead><tr className="border-b border-border-light text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  <th className="px-4 py-2.5 text-left">Run Name</th>
                  <th className="px-4 py-2.5 text-center">Status</th>
                  <th className="px-4 py-2.5 text-center">Records</th>
                  <th className="px-4 py-2.5 text-center">Exceptions</th>
                  <th className="px-4 py-2.5 text-center">Outputs</th>
                  <th className="px-4 py-2.5 text-left">Completed</th>
                </tr></thead>
                <tbody>{runs.map(r => (
                  <tr key={r.id} className="border-b border-border-light/60 hover:bg-surface-2/40">
                    <td className="px-4 py-3 font-medium text-text">{r.runName}</td>
                    <td className="px-4 py-3 text-center"><span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${RUN_STATUS_CLS[r.status]}`}>{r.status}</span></td>
                    <td className="px-4 py-3 text-center tabular-nums text-text-muted">{r.processedRecords || '—'}</td>
                    <td className="px-4 py-3 text-center"><span className={r.exceptionCount > 0 ? 'text-amber-600 font-medium' : 'text-text-muted'}>{r.exceptionCount}</span></td>
                    <td className="px-4 py-3 text-center tabular-nums text-text-muted">{r.outputCount}</td>
                    <td className="px-4 py-3 text-text-muted">{r.completedAt || '—'}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
        )}
        {tab === 'configuration' && (
          <div className="space-y-5 max-w-[700px]">
            {/* Audit Run Frequency */}
            <div className="rounded-2xl border border-border-light bg-white p-5">
              <h4 className="text-[11px] font-mono uppercase tracking-tight text-text-muted mb-4 flex items-center gap-2">
                <Clock size={13} className="text-primary" />Audit run frequency
              </h4>
              <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                <div>
                  <label className="text-[13px] font-semibold text-text block mb-2">Frequency</label>
                  <div className="flex flex-wrap gap-2">
                    {(['Hourly', 'Daily', 'Weekly', 'Monthly'] as const).map(f => (
                      <button key={f} onClick={() => setFrequency(f)} className={pillCls(frequency === f)}>{f}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[13px] font-semibold text-text block mb-2">Run Time</label>
                  <input type="time" value={runTime} onChange={e => setRunTime(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-border-light text-[14px] bg-white text-text focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition-all" />
                </div>
                <div>
                  <label className="text-[13px] font-semibold text-text block mb-2">Trigger On</label>
                  <div className="flex flex-wrap gap-2">
                    {(['Schedule', 'Data Change', 'Manual'] as const).map(t => (
                      <button key={t} onClick={() => setTriggerOn(t)} className={pillCls(triggerOn === t)}>{t}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[13px] font-semibold text-text block mb-2">Retry on Failure</label>
                  <div className="flex flex-wrap gap-2">
                    {(['Off', '1x', '3x', '5x'] as const).map(r => (
                      <button key={r} onClick={() => setRetry(r)} className={pillCls(retry === r)}>{r}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Tolerance Rules placeholder */}
            <div className="rounded-2xl border border-border-light bg-white p-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-[14px] font-semibold text-text flex items-center gap-2">
                  <AlertCircle size={14} className="text-primary" />Tolerance rules
                </h4>
                <span className="text-[12px] text-text-muted">3 active</span>
              </div>
              <div className="space-y-2">
                {[
                  { label: 'Amount', type: 'MONETARY', value: '±$500', active: true },
                  { label: 'Date', type: 'DATE', value: '±3 calendar days', active: true },
                  { label: 'Quantity', type: 'NUMERIC', value: '±5%', active: true },
                ].map(rule => (
                  <div key={rule.label} className="flex items-center justify-between px-4 py-3 rounded-xl border border-border-light bg-surface-2/30">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary"><AlertCircle size={14} /></div>
                      <div>
                        <div className="text-[13px] font-semibold text-text">{rule.label}</div>
                        <div className="text-[11px] text-text-muted">{rule.type} · {rule.value}</div>
                      </div>
                    </div>
                    <div className={`w-10 h-6 rounded-full relative cursor-pointer transition-colors ${rule.active ? 'bg-primary' : 'bg-gray-200'}`}>
                      <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${rule.active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Workflow metadata */}
            <div className="rounded-2xl border border-border-light bg-white p-5 space-y-3">
              <h4 className="text-[11px] font-mono uppercase tracking-tight text-text-muted mb-2">Workflow Metadata</h4>
              {[
                { label: 'Business Process', value: wf.businessProcess },
                { label: 'Control ID', value: wf.controlId },
                { label: 'Status', value: wf.status },
                { label: 'Source', value: wf.isCreated ? 'Created in this Project' : 'Workflow Library' },
                { label: 'Tags', value: wf.tags.join(', ') || '—' },
              ].map(item => (
                <div key={item.label} className="flex items-start gap-4 py-1.5 border-b border-border-light/40 last:border-b-0">
                  <span className="text-[12px] text-text-muted w-[140px] shrink-0">{item.label}</span>
                  <span className="text-[13px] text-text font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
