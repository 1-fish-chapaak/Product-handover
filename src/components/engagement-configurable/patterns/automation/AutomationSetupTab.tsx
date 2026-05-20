// ─── Automation Project — Automation Setup Tab ───────────────────────────
// Configure workflow/Q&A/ad-hoc approach for automation runs.

import React, { useState } from 'react';
import {
  Workflow, MessageSquare, Database, Clock, Plus, CheckCircle2, AlertCircle, ChevronRight, X, Info, Trash2, Settings,
} from 'lucide-react';
import type { ConfigurableEngagement, AutomationProjectConfig } from '../../configurableEngagementTypes';
import type { AutomationInputDataState, AutomationDataSource, DataSourceType } from './automationInputData';
import { SOURCE_TYPE_LABELS } from './automationInputData';
import {
  deriveSetupReadiness, SETUP_MODE_LABELS, SETUP_STATUS_CLS, MOCK_WORKFLOWS,
  SUGGESTED_STEPS, SUGGESTED_QUESTIONS, EXPECTED_OUTPUTS, STEP_TYPE_LABELS,
  type AutomationSetupState, type SetupMode, type DraftWorkflowStep, type QASetup, type ProjectCreatedWorkflow,
} from './automationSetupData';

const inputCls = 'w-full px-3 py-2 border border-border rounded-lg text-[12px] text-text bg-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all';
const selectCls = inputCls + ' cursor-pointer appearance-none';
const labelCls = 'text-[11px] font-semibold text-text-muted block mb-1';

function now(): string { return new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }

interface Props {
  engagement: ConfigurableEngagement;
  inputData: AutomationInputDataState;
  setupState: AutomationSetupState;
  onUpdateSetup: (state: AutomationSetupState) => void;
  onUpdateInputData?: (state: AutomationInputDataState) => void;
  onNavigateTab?: (tabId: string) => void;
}

export default function AutomationSetupTab({ engagement, inputData, setupState, onUpdateSetup, onUpdateInputData, onNavigateTab }: Props) {
  const cfg = engagement.config as AutomationProjectConfig;
  const { status, checks } = deriveSetupReadiness(inputData, setupState, cfg);
  const hasInput = inputData.dataSources.some(d => inputData.selectedSourceIds.includes(d.id)) || inputData.proceedWithoutData;
  const isRecurring = cfg.runType === 'RECURRING';

  const setMode = (mode: SetupMode) => {
    onUpdateSetup({ ...setupState, setupMode: mode, history: [...setupState.history, { id: `sh-${Date.now()}`, action: 'MODE_SELECTED', actor: engagement.owner, timestamp: now(), comments: SETUP_MODE_LABELS[mode] }] });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[15px] font-bold text-text mb-0.5">Automation Setup</h3>
          <p className="text-[12px] text-text-muted">Choose whether this project will use saved workflows, newly built workflows, or ad-hoc Q&A analysis.</p>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 ${SETUP_STATUS_CLS[status]}`}>{status.replace(/_/g, ' ')}</span>
      </div>

      {/* Context */}
      <div className="rounded-lg border border-border-light p-3">
        <div className="grid grid-cols-4 gap-3 text-[11px]">
          <div><span className="text-gray-400 block text-[10px]">Automation Approach</span><span className="text-text font-medium">{SETUP_MODE_LABELS[setupState.setupMode]}</span></div>
          <div><span className="text-gray-400 block text-[10px]">Input Sources</span><span className={`font-medium ${hasInput ? 'text-emerald-600' : 'text-amber-600'}`}>{hasInput ? `${inputData.selectedSourceIds.length} selected` : 'None'}</span></div>
          <div><span className="text-gray-400 block text-[10px]">Run Type</span><span className="text-text font-medium">{cfg.runType.replace(/_/g, ' ')}{cfg.frequency ? ` (${cfg.frequency})` : ''}</span></div>
          <div><span className="text-gray-400 block text-[10px]">Outputs</span><span className="text-text font-medium">{cfg.outputTypes.map(o => o.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())).join(', ')}</span></div>
        </div>
      </div>

      {!hasInput && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[10px] text-amber-700">
          <AlertCircle size={11} className="shrink-0 mt-0.5" /><span>Select input data or choose to proceed without data for now.</span>
        </div>
      )}

      {/* Mode selector */}
      <div className="grid grid-cols-2 gap-3">
        {([
          { mode: 'SELECT_EXISTING_WORKFLOW' as SetupMode, icon: Workflow, title: 'Use Existing Workflow', desc: 'Select one or more saved workflows from the workflow library. Supports bulk workflow runs.' },
          { mode: 'CREATE_NEW_WORKFLOW' as SetupMode, icon: Plus, title: 'Build New Workflow', desc: 'Create a new workflow using builder/Q&A and link it to project data sources.' },
          { mode: 'QA_ADHOC_ANALYSIS' as SetupMode, icon: MessageSquare, title: 'Ask Questions / Ad-hoc Analysis', desc: 'Ask questions or run one-time analysis without saving a repeatable workflow yet.' },
          { mode: 'UPLOAD_DATA_FIRST_DECIDE_LATER' as SetupMode, icon: Clock, title: 'Upload Data First, Decide Later', desc: 'Keep automation setup open until input data and requirements are clearer.' },
        ]).map(m => {
          const Icon = m.icon;
          const isSelected = setupState.setupMode === m.mode;
          return (
            <button key={m.mode} onClick={() => setMode(m.mode)}
              className={`text-left rounded-xl border-2 p-3 transition-all cursor-pointer ${isSelected ? 'border-primary bg-primary/5' : 'border-border-light hover:border-primary/30'}`}>
              <div className="flex items-center gap-2 mb-1">
                <Icon size={14} className={isSelected ? 'text-primary' : 'text-gray-400'} />
                <span className={`text-[12px] font-semibold ${isSelected ? 'text-primary' : 'text-text'}`}>{m.title}</span>
                {isSelected && <CheckCircle2 size={12} className="text-primary ml-auto" />}
              </div>
              <p className="text-[10px] text-gray-500">{m.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Mode content */}
      {setupState.setupMode === 'SELECT_EXISTING_WORKFLOW' && (
        <ExistingWorkflowPanel inputType={cfg.inputType} setupState={setupState} onUpdateSetup={onUpdateSetup} engagement={engagement} />
      )}
      {setupState.setupMode === 'CREATE_NEW_WORKFLOW' && (
        <CreateWorkflowPanel setupState={setupState} onUpdateSetup={onUpdateSetup} engagement={engagement} inputData={inputData} onUpdateInputData={onUpdateInputData} />
      )}
      {setupState.setupMode === 'QA_ADHOC_ANALYSIS' && (
        <QASetupPanel setupState={setupState} onUpdateSetup={onUpdateSetup} engagement={engagement} inputSourceIds={inputData.selectedSourceIds} isRecurring={isRecurring} />
      )}
      {setupState.setupMode === 'UPLOAD_DATA_FIRST_DECIDE_LATER' && (
        <div className="rounded-lg border border-border-light p-4 text-center space-y-2">
          <Clock size={24} className="text-gray-300 mx-auto" />
          <h4 className="text-[13px] font-semibold text-text">Decide Later</h4>
          <p className="text-[11px] text-gray-500">Automation setup is not configured yet. You can review input data first, then choose a workflow or Q&A approach later.</p>
        </div>
      )}

      {/* Setup notes */}
      <div className="rounded-lg border border-border-light p-4 space-y-2">
        <h4 className="text-[11px] font-bold text-text">Setup Notes</h4>
        <textarea value={setupState.setupNotes} onChange={e => onUpdateSetup({ ...setupState, setupNotes: e.target.value })}
          rows={2} placeholder="Assumptions, workflow design notes, unresolved questions..." className={inputCls + ' resize-none'} />
      </div>

      {/* History */}
      {setupState.history.length > 0 && (
        <div className="rounded-lg border border-border-light p-4">
          <h4 className="text-[11px] font-bold text-text mb-1">History</h4>
          <div className="space-y-1">{setupState.history.slice(-5).map(h => (
            <div key={h.id} className="text-[9px] text-gray-500"><span className="font-semibold text-text">{h.action.replace(/_/g, ' ')}</span> by {h.actor} · {h.timestamp}{h.comments ? ` — ${h.comments}` : ''}</div>
          ))}</div>
        </div>
      )}

      {/* Readiness */}
      <div className="rounded-lg border border-border-light p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-[11px] font-bold text-text">Automation Readiness</h4>
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${SETUP_STATUS_CLS[status]}`}>{status.replace(/_/g, ' ')}</span>
        </div>
        <div className="space-y-1">{checks.map(c => (
          <div key={c.label} className="flex items-center gap-2 text-[10px]">
            {c.ok ? <CheckCircle2 size={10} className="text-emerald-500" /> : <AlertCircle size={10} className="text-amber-400" />}
            <span className={c.ok ? 'text-gray-500' : 'text-text'}>{c.label}</span>
          </div>
        ))}</div>
        {isRecurring && setupState.setupMode === 'QA_ADHOC_ANALYSIS' && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[10px] text-amber-700">
            <AlertCircle size={11} className="shrink-0 mt-0.5" /><span>Recurring automation requires at least one saved or built workflow. Q&A setup is valid for ad-hoc runs only.</span>
          </div>
        )}
        <button onClick={() => onNavigateTab?.('runs')} disabled={status !== 'READY_FOR_RUN'}
          className="mt-2 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[11px] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          Continue to Runs <ChevronRight size={11} />
        </button>
      </div>
    </div>
  );
}

// ─── Existing Workflow Panel ──────────────────────────────────────────────

function ExistingWorkflowPanel({ inputType, setupState, onUpdateSetup, engagement }: { inputType: string; setupState: AutomationSetupState; onUpdateSetup: (s: AutomationSetupState) => void; engagement: ConfigurableEngagement }) {
  const ids = setupState.selectedWorkflowIds || (setupState.selectedWorkflowId ? [setupState.selectedWorkflowId] : []);
  const createdWorkflows = setupState.createdWorkflows || [];

  // Merge mock library + project-created workflows
  const allWorkflows: { id: string; name: string; description: string; steps: string[]; status: string; compatibleTypes: string[]; isCreated: boolean; linkedSources?: string[] }[] = [
    ...MOCK_WORKFLOWS.map(wf => ({ ...wf, isCreated: false })),
    ...createdWorkflows.filter(w => w.status === 'SAVED').map(w => ({
      id: w.id, name: w.name, description: w.description || w.objective, steps: w.steps.map(s => s.name || s.stepType),
      status: 'Active', compatibleTypes: ['EXCEL_CSV', 'PDF', 'SQL', 'IMAGE', 'HYBRID'] as string[], isCreated: true, linkedSources: w.linkedDataSourceNames,
    })),
  ];

  const toggleWorkflow = (wf: typeof allWorkflows[0]) => {
    const isSelected = ids.includes(wf.id);
    const newIds = isSelected ? ids.filter(id => id !== wf.id) : [...ids, wf.id];
    const newNames = newIds.map(id => allWorkflows.find(w => w.id === id)?.name || '').filter(Boolean);
    onUpdateSetup({
      ...setupState,
      selectedWorkflowIds: newIds,
      selectedWorkflowNames: newNames,
      selectedWorkflowId: newIds[0] || '',
      selectedWorkflowName: newNames[0] || '',
      history: [...setupState.history, { id: `sh-${Date.now()}`, action: 'WORKFLOW_SELECTED', actor: engagement.owner, timestamp: now(), comments: `${isSelected ? 'Removed' : 'Added'}: ${wf.name} (${newIds.length} selected)` }],
    });
  };

  const selectRecommended = () => {
    const recommended = allWorkflows.filter(w => w.compatibleTypes.includes(inputType) || inputType === 'HYBRID' || w.isCreated);
    const newIds = recommended.map(w => w.id);
    const newNames = recommended.map(w => w.name);
    onUpdateSetup({ ...setupState, selectedWorkflowIds: newIds, selectedWorkflowNames: newNames, selectedWorkflowId: newIds[0] || '', selectedWorkflowName: newNames[0] || '' });
  };

  return (
    <div className="rounded-lg border border-border-light p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-[11px] font-bold text-text">Select Existing Workflows <span className="font-normal text-gray-400 ml-1">(Selected: {ids.length})</span></h4>
        <div className="flex items-center gap-2">
          <button onClick={selectRecommended} className="text-[9px] font-semibold text-primary hover:underline cursor-pointer">Select Recommended</button>
          {ids.length > 0 && <button onClick={() => onUpdateSetup({ ...setupState, selectedWorkflowIds: [], selectedWorkflowNames: [], selectedWorkflowId: '', selectedWorkflowName: '' })} className="text-[9px] font-semibold text-gray-500 hover:underline cursor-pointer">Clear</button>}
        </div>
      </div>
      <p className="text-[10px] text-gray-500">Choose one or more workflows to run against the selected input data.</p>
      <div className="space-y-2">
        {allWorkflows.map(wf => {
          const isSelected = ids.includes(wf.id);
          const compatible = wf.compatibleTypes.includes(inputType) || inputType === 'HYBRID';
          return (
            <button key={wf.id} onClick={() => toggleWorkflow(wf)}
              className={`w-full text-left rounded-lg border-2 p-3 transition-all cursor-pointer ${isSelected ? 'border-primary bg-primary/5' : 'border-border-light hover:border-primary/30'}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <input type="checkbox" checked={isSelected} readOnly className="w-3.5 h-3.5 rounded border-border accent-[#6a12cd] cursor-pointer shrink-0" />
                <span className="text-[12px] font-semibold text-text">{wf.name}</span>
                <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${wf.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{wf.status}</span>
                {wf.isCreated && <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-purple-50 text-purple-700">Created in this Project</span>}
                {!wf.isCreated && <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${compatible ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{compatible ? 'Compatible' : 'Needs Review'}</span>}
              </div>
              <p className="text-[10px] text-gray-500 mb-1">{wf.description}</p>
              <div className="flex flex-wrap gap-1">
                {wf.steps.map((s, i) => <span key={i} className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-[8px]">{i + 1}. {s}</span>)}
                {wf.isCreated && wf.linkedSources && wf.linkedSources.map((ds, i) => <span key={`ds-${i}`} className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 text-[8px]">{ds}</span>)}
              </div>
            </button>
          );
        })}
      </div>
      {ids.length > 1 && (
        <p className="text-[9px] text-gray-400 italic">Selected workflows can be run individually or together as a bulk run from the Runs tab.</p>
      )}
    </div>
  );
}

// ─── Create Workflow Panel ────────────────────────────────────────────────

function CreateWorkflowPanel({ setupState, onUpdateSetup, engagement, inputData, onUpdateInputData }: {
  setupState: AutomationSetupState; onUpdateSetup: (s: AutomationSetupState) => void; engagement: ConfigurableEngagement;
  inputData: AutomationInputDataState; onUpdateInputData?: (s: AutomationInputDataState) => void;
}) {
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingWorkflowId, setEditingWorkflowId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const createdWorkflows = setupState.createdWorkflows || [];
  const selectedIds = setupState.selectedWorkflowIds || [];

  const toggleSelectCreated = (wf: ProjectCreatedWorkflow) => {
    const isSelected = selectedIds.includes(wf.id);
    const newIds = isSelected ? selectedIds.filter(id => id !== wf.id) : [...selectedIds, wf.id];
    const newNames = newIds.map(id => createdWorkflows.find(w => w.id === id)?.name || MOCK_WORKFLOWS.find(w => w.id === id)?.name || '').filter(Boolean);
    onUpdateSetup({ ...setupState, selectedWorkflowIds: newIds, selectedWorkflowNames: newNames, selectedWorkflowId: newIds[0] || '', selectedWorkflowName: newNames[0] || '' });
  };

  const removeWorkflow = (wfId: string) => {
    const updated = createdWorkflows.filter(w => w.id !== wfId);
    const newIds = selectedIds.filter(id => id !== wfId);
    const newNames = newIds.map(id => updated.find(w => w.id === id)?.name || MOCK_WORKFLOWS.find(w => w.id === id)?.name || '').filter(Boolean);
    onUpdateSetup({
      ...setupState, createdWorkflows: updated, selectedWorkflowIds: newIds, selectedWorkflowNames: newNames,
      selectedWorkflowId: newIds[0] || '', selectedWorkflowName: newNames[0] || '',
      history: [...setupState.history, { id: `sh-${Date.now()}`, action: 'WORKFLOW_REMOVED', actor: engagement.owner, timestamp: now(), comments: '' }],
    });
  };

  const handleSaveWorkflow = (wf: ProjectCreatedWorkflow, newSources: AutomationDataSource[]) => {
    // Add workflow to createdWorkflows
    const existingIdx = createdWorkflows.findIndex(w => w.id === wf.id);
    const updatedList = existingIdx >= 0
      ? createdWorkflows.map(w => w.id === wf.id ? wf : w)
      : [...createdWorkflows, wf];

    // Auto-select for run
    const newIds = selectedIds.includes(wf.id) ? selectedIds : [...selectedIds, wf.id];
    const newNames = newIds.map(id => updatedList.find(w => w.id === id)?.name || MOCK_WORKFLOWS.find(w => w.id === id)?.name || '').filter(Boolean);

    onUpdateSetup({
      ...setupState,
      createdWorkflows: updatedList,
      selectedWorkflowIds: newIds,
      selectedWorkflowNames: newNames,
      selectedWorkflowId: newIds[0] || '',
      selectedWorkflowName: newNames[0] || '',
      history: [...setupState.history, { id: `sh-${Date.now()}`, action: existingIdx >= 0 ? 'WORKFLOW_UPDATED' : 'WORKFLOW_CREATED', actor: engagement.owner, timestamp: now(), comments: wf.name }],
    });

    // Add new data sources to project input data
    if (newSources.length > 0 && onUpdateInputData) {
      const existingIds = new Set(inputData.dataSources.map(d => d.id));
      const toAdd = newSources.filter(s => !existingIds.has(s.id));
      if (toAdd.length > 0) {
        onUpdateInputData({
          ...inputData,
          dataSources: [...inputData.dataSources, ...toAdd],
          selectedSourceIds: [...inputData.selectedSourceIds, ...toAdd.map(s => s.id)],
        });
      }
    }

    setBuilderOpen(false);
    setEditingWorkflowId(null);
    setSuccessMsg('Workflow saved and selected for run.');
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const openBuilder = (wfId?: string) => {
    setEditingWorkflowId(wfId || null);
    setBuilderOpen(true);
    setSuccessMsg('');
  };

  return (
    <div className="space-y-3">
      {/* CTA */}
      <div className="rounded-lg border border-border-light p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-[12px] font-bold text-text">Build New Workflow</h4>
            <p className="text-[10px] text-gray-500">Use the workflow builder to create one or more workflows for this project. Saved workflows will appear in the existing workflow list and can be selected for runs.</p>
          </div>
          <button onClick={() => openBuilder()} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-[12px] font-semibold cursor-pointer transition-colors shrink-0">
            <Plus size={13} />Build Workflow
          </button>
        </div>
      </div>

      {/* Success message */}
      {successMsg && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-700">
          <CheckCircle2 size={12} /><span>{successMsg}</span>
        </div>
      )}

      {/* Builder panel */}
      {builderOpen && (
        <WorkflowBuilderPanel
          key={editingWorkflowId || 'new'}
          engagement={engagement}
          inputData={inputData}
          existingWorkflow={editingWorkflowId ? createdWorkflows.find(w => w.id === editingWorkflowId) : undefined}
          onSave={handleSaveWorkflow}
          onCancel={() => { setBuilderOpen(false); setEditingWorkflowId(null); }}
        />
      )}

      {/* Created workflows */}
      <div className="rounded-lg border border-border-light p-4 space-y-3">
        <h4 className="text-[11px] font-bold text-text">Created Workflows <span className="font-normal text-gray-400 ml-1">({createdWorkflows.length})</span></h4>
        {createdWorkflows.length === 0 ? (
          <div className="text-center py-4 space-y-1">
            <Workflow size={20} className="text-gray-300 mx-auto" />
            <p className="text-[11px] text-gray-400">No workflows created yet. Build a workflow to use it in this automation project.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {createdWorkflows.map(wf => {
              const isSelected = selectedIds.includes(wf.id);
              return (
                <div key={wf.id} className={`rounded-lg border-2 p-3 transition-all ${isSelected ? 'border-primary bg-primary/5' : 'border-border-light'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-semibold text-text">{wf.name}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${wf.status === 'SAVED' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{wf.status === 'SAVED' ? 'Saved' : 'Draft'}</span>
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-purple-50 text-purple-700">Created in this Project</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => toggleSelectCreated(wf)}
                        className={`px-2 py-1 rounded text-[9px] font-semibold cursor-pointer transition-colors ${isSelected ? 'text-amber-600 bg-amber-50 hover:bg-amber-100' : 'text-primary bg-primary/10 hover:bg-primary/20'}`}>
                        {isSelected ? 'Unselect' : 'Select for Run'}
                      </button>
                      <button onClick={() => openBuilder(wf.id)} className="px-2 py-1 rounded text-[9px] font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 cursor-pointer transition-colors"><Settings size={9} /></button>
                      <button onClick={() => removeWorkflow(wf.id)} className="px-2 py-1 rounded text-[9px] font-semibold text-red-500 bg-red-50 hover:bg-red-100 cursor-pointer transition-colors"><Trash2 size={9} /></button>
                    </div>
                  </div>
                  {wf.objective && <p className="text-[10px] text-gray-500 mb-1">{wf.objective}</p>}
                  <div className="flex flex-wrap gap-1">
                    {wf.steps.map((s, i) => <span key={i} className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-[8px]">{i + 1}. {s.name || s.stepType}</span>)}
                    {wf.linkedDataSourceNames.map((ds, i) => <span key={`ds-${i}`} className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 text-[8px]">{ds}</span>)}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[9px] text-gray-400">
                    <span>{wf.steps.length} step{wf.steps.length !== 1 ? 's' : ''}</span>
                    <span>{wf.linkedDataSourceIds.length} data source{wf.linkedDataSourceIds.length !== 1 ? 's' : ''}</span>
                    <span>Created {wf.createdAt}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Workflow Builder Panel ──────────────────────────────────────────────

const BUILDER_SOURCE_TYPES: { value: DataSourceType; label: string }[] = [
  { value: 'EXCEL_CSV', label: 'Excel / CSV' }, { value: 'PDF', label: 'PDF' }, { value: 'SQL', label: 'SQL' },
  { value: 'IMAGE', label: 'Image' }, { value: 'OTHER', label: 'Other' },
];

function WorkflowBuilderPanel({ engagement, inputData, existingWorkflow, onSave, onCancel }: {
  engagement: ConfigurableEngagement; inputData: AutomationInputDataState;
  existingWorkflow?: ProjectCreatedWorkflow; onSave: (wf: ProjectCreatedWorkflow, newSources: AutomationDataSource[]) => void; onCancel: () => void;
}) {
  const [name, setName] = useState(existingWorkflow?.name || '');
  const [objective, setObjective] = useState(existingWorkflow?.objective || '');
  const [description, setDescription] = useState(existingWorkflow?.description || '');
  const [builderPrompt, setBuilderPrompt] = useState(existingWorkflow?.builderPrompt || '');
  const [linkedSourceIds, setLinkedSourceIds] = useState<string[]>(existingWorkflow?.linkedDataSourceIds || []);
  const [steps, setSteps] = useState<DraftWorkflowStep[]>(existingWorkflow?.steps || []);
  const [newSources, setNewSources] = useState<AutomationDataSource[]>([]);
  const [showAddSource, setShowAddSource] = useState(false);
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceType, setNewSourceType] = useState<DataSourceType>('EXCEL_CSV');
  const [validationMsg, setValidationMsg] = useState('');

  // All available sources = project sources + newly added in this builder session
  const allSources = [...inputData.dataSources, ...newSources];

  const toggleSource = (id: string) => {
    setLinkedSourceIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const addNewSource = () => {
    if (!newSourceName.trim()) return;
    const source: AutomationDataSource = {
      id: `ds-builder-${Date.now()}`, name: newSourceName.trim(), sourceType: newSourceType,
      fileName: `${newSourceName.trim().toLowerCase().replace(/\s+/g, '_')}_builder_upload.${newSourceType === 'EXCEL_CSV' ? 'xlsx' : newSourceType === 'PDF' ? 'pdf' : newSourceType === 'IMAGE' ? 'zip' : 'dat'}`,
      connectionName: newSourceType === 'SQL' ? `${newSourceName.trim().toLowerCase().replace(/\s+/g, '_')}_connection` : '',
      recordCount: newSourceType === 'EXCEL_CSV' || newSourceType === 'SQL' ? 1000 : null,
      pageCount: newSourceType === 'PDF' ? 25 : null,
      imageCount: newSourceType === 'IMAGE' ? 50 : null,
      uploadedAt: new Date().toISOString().slice(0, 10), uploadedBy: engagement.owner,
      status: 'READY', linkedScope: '', description: `Created from Workflow Builder`,
      columns: newSourceType === 'EXCEL_CSV' ? ['id', 'name', 'amount', 'status'] : newSourceType === 'SQL' ? ['id', 'ref', 'value', 'date'] : [],
      samplePreviewRows: newSourceType === 'EXCEL_CSV' ? [['1', 'Item A', '10000', 'Active'], ['2', 'Item B', '25000', 'Pending']] : newSourceType === 'SQL' ? [['1', 'REF-001', '15000', '2026-01-01']] : [],
      validationIssues: [], tags: ['Created from Workflow Builder'],
    };
    setNewSources(prev => [...prev, source]);
    setLinkedSourceIds(prev => [...prev, source.id]);
    setNewSourceName('');
    setShowAddSource(false);
  };

  const addSuggestedSteps = () => {
    const suggested: DraftWorkflowStep[] = SUGGESTED_STEPS.map((s, i) => ({ ...s, id: `step-${Date.now()}-${i}`, inputSourceIds: linkedSourceIds }));
    setSteps(suggested);
  };

  const addCustomStep = () => {
    setSteps(prev => [...prev, { id: `step-${Date.now()}`, order: prev.length + 1, stepType: 'OTHER', name: '', description: '', inputSourceIds: [], outputName: '' }]);
  };

  const updateStep = (idx: number, updates: Partial<DraftWorkflowStep>) => {
    setSteps(prev => prev.map((s, i) => i === idx ? { ...s, ...updates } : s));
  };

  const removeStep = (idx: number) => {
    setSteps(prev => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i + 1 })));
  };

  const handleSave = () => {
    const hasName = name.trim().length > 0;
    const hasObjectiveOrPrompt = objective.trim().length > 0 || builderPrompt.trim().length > 0;
    const hasData = linkedSourceIds.length > 0;
    const hasStepsOrPrompt = steps.length > 0 || builderPrompt.trim().length > 0;

    if (!hasName) { setValidationMsg('Workflow name is required.'); return; }
    if (!hasObjectiveOrPrompt) { setValidationMsg('Objective or builder prompt is required.'); return; }
    if (!hasData) { setValidationMsg('At least one data source must be linked.'); return; }
    if (!hasStepsOrPrompt) { setValidationMsg('At least one step or a builder prompt is required.'); return; }

    const linkedNames = linkedSourceIds.map(id => allSources.find(s => s.id === id)?.name || '').filter(Boolean);

    const wf: ProjectCreatedWorkflow = {
      id: existingWorkflow?.id || `cwf-${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      objective: objective.trim(),
      status: 'SAVED',
      createdAt: existingWorkflow?.createdAt || now(),
      createdBy: engagement.owner,
      source: 'PROJECT_BUILDER',
      linkedDataSourceIds: linkedSourceIds,
      linkedDataSourceNames: linkedNames,
      builderPrompt: builderPrompt.trim(),
      steps,
    };

    onSave(wf, newSources);
    setValidationMsg('');
  };

  return (
    <div className="rounded-xl border-2 border-primary/30 bg-white p-5 space-y-4 shadow-lg">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-[14px] font-bold text-text">{existingWorkflow ? 'Edit Workflow' : 'Workflow Builder'}</h4>
          <p className="text-[10px] text-gray-500">In production, this will open the full Workflow Builder / Q&A workflow creation experience.</p>
        </div>
        <button onClick={onCancel} className="p-1.5 rounded text-gray-400 hover:text-text cursor-pointer"><X size={16} /></button>
      </div>

      {/* Core fields */}
      <div className="grid grid-cols-2 gap-3">
        <div><label className={labelCls}>Workflow Name <span className="text-red-400">*</span></label><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Vendor Reconciliation Workflow" className={inputCls} /></div>
        <div><label className={labelCls}>Objective <span className="text-red-400">*</span></label><input value={objective} onChange={e => setObjective(e.target.value)} placeholder="What should this workflow accomplish?" className={inputCls} /></div>
        <div className="col-span-2"><label className={labelCls}>Description</label><input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description" className={inputCls} /></div>
        <div className="col-span-2"><label className={labelCls}>Builder Prompt / Q&A Instruction</label><textarea value={builderPrompt} onChange={e => setBuilderPrompt(e.target.value)} rows={2} placeholder="e.g. Match vendor ledger to payment records, find unmatched transactions, flag duplicates..." className={inputCls + ' resize-none'} /></div>
      </div>

      {/* Data sources */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className={labelCls}>Data Sources <span className="text-red-400">*</span> <span className="font-normal text-gray-400">({linkedSourceIds.length} linked)</span></label>
          <button onClick={() => setShowAddSource(true)} className="px-2 py-1 rounded text-[9px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 cursor-pointer transition-colors"><Plus size={9} /> Add New Source</button>
        </div>
        <p className="text-[9px] text-gray-400 mb-1">Select data from the project input pool or add a new data source for this workflow.</p>
        {allSources.length === 0 ? (
          <div className="text-[10px] text-gray-400 italic py-2">No project data sources available. Add a new data source below.</div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            {allSources.map(ds => {
              const linked = linkedSourceIds.includes(ds.id);
              const isNew = newSources.some(s => s.id === ds.id);
              return (
                <label key={ds.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${linked ? 'border-primary bg-primary/5' : 'border-border-light hover:border-primary/30'}`}>
                  <input type="checkbox" checked={linked} onChange={() => toggleSource(ds.id)} className="w-3.5 h-3.5 rounded border-border accent-[#6a12cd] cursor-pointer shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-medium text-text truncate">{ds.name}</div>
                    <div className="text-[9px] text-gray-400">{SOURCE_TYPE_LABELS[ds.sourceType]} · {ds.recordCount || ds.pageCount || ds.imageCount || 0} items</div>
                  </div>
                  {isNew && <span className="px-1 py-0.5 rounded text-[7px] font-bold bg-amber-50 text-amber-700 shrink-0">New</span>}
                </label>
              );
            })}
          </div>
        )}

        {/* Add new source inline */}
        {showAddSource && (
          <div className="mt-2 rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h5 className="text-[11px] font-bold text-text">Add New Data Source</h5>
              <button onClick={() => setShowAddSource(false)} className="p-0.5 rounded text-gray-400 hover:text-text cursor-pointer"><X size={12} /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className={labelCls}>Source Name</label><input value={newSourceName} onChange={e => setNewSourceName(e.target.value)} placeholder="e.g. Invoice Register" className={inputCls} /></div>
              <div><label className={labelCls}>Source Type</label><select value={newSourceType} onChange={e => setNewSourceType(e.target.value as DataSourceType)} className={selectCls}>{BUILDER_SOURCE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
            </div>
            <button onClick={addNewSource} disabled={!newSourceName.trim()} className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[10px] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Add Source</button>
          </div>
        )}
      </div>

      {/* Steps */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className={labelCls}>Workflow Steps ({steps.length})</label>
          <div className="flex items-center gap-1">
            <button onClick={addSuggestedSteps} className="px-2 py-1 rounded text-[9px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 cursor-pointer transition-colors">Add Suggested Steps</button>
            <button onClick={addCustomStep} className="px-2 py-1 rounded text-[9px] font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 cursor-pointer transition-colors">+ Custom Step</button>
          </div>
        </div>
        {steps.length === 0 ? (
          <div className="text-[10px] text-gray-400 italic py-2">No steps defined yet. Add suggested steps or create custom ones. Steps are optional if a builder prompt is provided.</div>
        ) : (
          <div className="space-y-1.5">{steps.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border-light text-[10px]">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[8px] font-bold inline-flex items-center justify-center shrink-0">{i + 1}</span>
              <input value={s.name} onChange={e => updateStep(i, { name: e.target.value })} placeholder="Step name..." className="flex-1 px-2 py-1 border border-border-light rounded text-[10px] text-text bg-white outline-none focus:border-primary/40" />
              <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-[8px] shrink-0">{STEP_TYPE_LABELS[s.stepType]}</span>
              <button onClick={() => removeStep(i)} className="p-0.5 rounded text-gray-400 hover:text-red-500 cursor-pointer"><X size={10} /></button>
            </div>
          ))}</div>
        )}
      </div>

      {/* Validation */}
      {validationMsg && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-[10px] text-red-600">
          <AlertCircle size={11} /><span>{validationMsg}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-1 border-t border-border-light">
        <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-semibold cursor-pointer transition-colors flex items-center gap-1.5">
          <CheckCircle2 size={12} />Save Workflow
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg border border-border-light text-[11px] font-medium text-text-muted hover:bg-surface-2/30 cursor-pointer transition-colors">Cancel</button>
        <span className="text-[9px] text-gray-400 ml-auto">Saved workflows appear under Use Existing Workflow and can be selected for runs.</span>
      </div>
    </div>
  );
}

// ─── Q&A Setup Panel ──────────────────────────────────────────────────────

function QASetupPanel({ setupState, onUpdateSetup, engagement, inputSourceIds, isRecurring }: { setupState: AutomationSetupState; onUpdateSetup: (s: AutomationSetupState) => void; engagement: ConfigurableEngagement; inputSourceIds: string[]; isRecurring: boolean }) {
  const qa = setupState.qaSetup || { id: `qa-${Date.now()}`, objective: '', questions: [], selectedSourceIds: inputSourceIds, expectedOutputs: [], status: 'DRAFT' as const };
  const [newQ, setNewQ] = useState('');

  const saveQA = (updates: Partial<QASetup>) => {
    onUpdateSetup({ ...setupState, qaSetup: { ...qa, ...updates }, history: [...setupState.history, { id: `sh-${Date.now()}`, action: 'QA_CONFIGURED', actor: engagement.owner, timestamp: now(), comments: '' }] });
  };

  // Save objective directly to parent state so it persists across mode switches
  const updateObjective = (v: string) => onUpdateSetup({ ...setupState, qaSetup: { ...qa, objective: v } });

  const addQuestion = () => { if (newQ.trim()) { saveQA({ questions: [...qa.questions, newQ.trim()] }); setNewQ(''); } };
  const addSuggested = () => { saveQA({ questions: [...qa.questions, ...SUGGESTED_QUESTIONS.filter(q => !qa.questions.includes(q))] }); };
  const toggleOutput = (o: string) => {
    const current = new Set(qa.expectedOutputs);
    current.has(o) ? current.delete(o) : current.add(o);
    saveQA({ expectedOutputs: Array.from(current) });
  };

  const markReady = () => {
    if (!qa.objective.trim() || qa.questions.length === 0) return;
    saveQA({ status: 'READY' });
  };

  return (
    <div className="rounded-lg border border-border-light p-4 space-y-3">
      <h4 className="text-[11px] font-bold text-text">Ask Questions / Ad-hoc Analysis</h4>
      <p className="text-[9px] text-gray-400">Use this when you want to explore data or documents without creating a repeatable workflow yet.</p>

      <div><label className={labelCls}>Analysis Objective</label><textarea value={qa.objective} onChange={e => updateObjective(e.target.value)} rows={2} placeholder="What should this analysis accomplish?" className={inputCls + ' resize-none'} /></div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className={labelCls}>Questions / Instructions ({qa.questions.length})</label>
          <button onClick={addSuggested} className="px-2 py-1 rounded text-[9px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 cursor-pointer transition-colors">Use Suggested</button>
        </div>
        {qa.questions.length > 0 && (
          <div className="space-y-1 mb-2">{qa.questions.map((q, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border-light text-[10px]">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[8px] font-bold inline-flex items-center justify-center shrink-0">{i + 1}</span>
              <span className="text-text flex-1">{q}</span>
            </div>
          ))}</div>
        )}
        <div className="flex items-center gap-2">
          <input value={newQ} onChange={e => setNewQ(e.target.value)} placeholder="Add custom question..." className="flex-1 px-3 py-1.5 border border-border rounded-lg text-[11px] text-text bg-white outline-none focus:border-primary/40" onKeyDown={e => { if (e.key === 'Enter') addQuestion(); }} />
          <button onClick={addQuestion} disabled={!newQ.trim()} className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[10px] font-semibold hover:bg-primary/20 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Add</button>
        </div>
      </div>

      <div>
        <label className={labelCls}>Expected Outputs</label>
        <div className="flex flex-wrap gap-2">{EXPECTED_OUTPUTS.map(o => (
          <label key={o} className="flex items-center gap-1.5 text-[10px] text-text cursor-pointer">
            <input type="checkbox" checked={qa.expectedOutputs.includes(o)} onChange={() => toggleOutput(o)} className="w-3 h-3 rounded border-border accent-[#6a12cd] cursor-pointer" />{o}
          </label>
        ))}</div>
      </div>

      {isRecurring && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[10px] text-amber-700">
          <AlertCircle size={11} className="shrink-0 mt-0.5" /><span>Recurring automation requires a saved workflow. Convert this Q&A setup into a workflow before scheduling.</span>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button onClick={markReady} disabled={!qa.objective.trim() || qa.questions.length === 0}
          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1">
          <CheckCircle2 size={11} />Mark Q&A Setup Ready
        </button>
        {qa.status === 'READY' && <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1"><CheckCircle2 size={10} />Ready</span>}
      </div>
    </div>
  );
}
