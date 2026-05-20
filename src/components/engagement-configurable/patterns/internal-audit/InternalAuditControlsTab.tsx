// ─── Internal Audit — Controls Tab ────────────────────────────────────────
// Expandable controls with linked workflows. User can select workflows and
// run them via the same BulkExecuteModal used by Automation Project / Workflow Library.
// Run results feed IA Analysis as potential findings.

import React, { useMemo, useState, useCallback } from 'react';
import {
  ClipboardCheck, Shield, FileText, ChevronRight, ChevronDown, CheckCircle2,
  Play, Workflow, AlertTriangle, Info,
} from 'lucide-react';
import type { ConfigurableEngagement } from '../../configurableEngagementTypes';
import { RACMS, SOPS, CHECKLISTS, type InternalAuditScopeState } from './internalAuditScopeData';
import { simulateAnalysisRun, type InternalAuditAnalysisState, type AnalysisRun } from './internalAuditAnalysisData';
import { BulkExecuteModal } from '../../../workflow/BulkExecuteModal';
import type { LibraryWorkflow } from '../../../workflow/WorkflowLibraryView';

// ─── Derive controls with linked workflows ──────────────────────────────

interface LinkedWorkflow {
  id: string;
  name: string;
  version: string;
  status: 'Draft' | 'Ready' | 'Active';
  description: string;
}

interface ControlItem {
  id: string;
  name: string;
  source: 'Checklist' | 'RACM' | 'SOP';
  sourceName: string;
  process: string;
  type: 'Manual' | 'Automated' | 'Key' | '—';
  status: 'Draft' | 'Ready' | 'Needs Review';
  workflows: LinkedWorkflow[];
}

function deriveControls(scope: InternalAuditScopeState): ControlItem[] {
  const controls: ControlItem[] = [];
  let counter = 0;

  // From RACMs — controls with real workflow links
  for (const racmId of scope.racmVersionIds) {
    const racm = RACMS.find(r => r.id === racmId);
    if (!racm) continue;

    const racmControls: { name: string; workflows: LinkedWorkflow[] }[] = racmId === 'racm-p2p' ? [
      { name: 'Three-Way PO/GRN/Invoice Matching', workflows: [
        { id: 'wf-pv', name: 'PO Validation Workflow', version: 'v2.0', status: 'Active', description: 'Validates PO existence and payment approval' },
        { id: 'wf-grn', name: 'GRN Matching Workflow', version: 'v1.6', status: 'Active', description: 'Matches GRN quantity against PO' },
        { id: 'wf-inv', name: 'Invoice Match Workflow', version: 'v2.3', status: 'Active', description: 'Validates invoice amount and tolerance' },
      ]},
      { name: 'Vendor Master Change Approval', workflows: [
        { id: 'wf-vcm', name: 'Vendor Change Monitor', version: 'v1.1', status: 'Active', description: 'Monitors vendor master changes and approvals' },
      ]},
      { name: 'Duplicate Invoice Detection', workflows: [
        { id: 'wf-dd', name: 'Duplicate Detector', version: 'v1.4', status: 'Active', description: 'Scans invoices for duplicates and flags matches' },
      ]},
      { name: 'High-Value Payment Review', workflows: [
        { id: 'wf-pf', name: 'Payment Flagging', version: 'v2.0', status: 'Active', description: 'Flags high-value payments for additional approval' },
      ]},
      { name: 'PO Dual Sign-Off Authorization', workflows: [] },
    ] : racmId === 'racm-ap' ? [
      { name: 'Invoice Posting Authorization', workflows: [
        { id: 'wf-ipa', name: 'Invoice Auth Workflow', version: 'v1.2', status: 'Active', description: 'Validates invoice posting authorization levels' },
      ]},
      { name: 'Duplicate Invoice Prevention', workflows: [
        { id: 'wf-dip', name: 'AP Duplicate Scanner', version: 'v1.0', status: 'Ready', description: 'Scans AP invoices for duplicate entries' },
      ]},
      { name: 'AP Aging Threshold Alert', workflows: [] },
      { name: 'Credit Memo Approval', workflows: [] },
    ] : [
      { name: 'Revenue Recognition Cutoff', workflows: [
        { id: 'wf-rc', name: 'Revenue Checker', version: 'v2.3', status: 'Active', description: 'Validates revenue recognition per ASC 606' },
      ]},
      { name: 'Sales Order Approval', workflows: [] },
    ];

    for (const rc of racmControls) {
      controls.push({
        id: `ctrl-racm-${++counter}`,
        name: rc.name,
        source: 'RACM',
        sourceName: racm.name,
        process: racmId === 'racm-p2p' || racmId === 'racm-ap' ? 'Procure to Pay' : 'Order to Cash',
        type: rc.workflows.length > 0 ? 'Automated' : 'Manual',
        status: rc.workflows.length > 0 ? 'Ready' : 'Needs Review',
        workflows: rc.workflows,
      });
    }
  }

  // From checklists — check items (typically no workflows)
  for (const clId of scope.checklistIds) {
    const cl = CHECKLISTS.find(c => c.id === clId);
    if (!cl) continue;
    const names = cl.id === 'cl-001' ? ['Vendor master data completeness', 'PO approval workflow check', 'Three-way match verification', 'Invoice duplicate check', 'Payment authorization limits', 'Vendor bank change review'] :
                  cl.id === 'cl-002' ? ['AP aging review', 'Invoice approval threshold', 'Expense policy compliance', 'Duplicate payment detection'] :
                  cl.id === 'cl-003' ? ['Vendor onboarding process', 'Vendor classification review', 'Duplicate vendor check'] :
                  ['Revenue cycle check 1', 'Revenue cycle check 2'];
    for (const name of names) {
      controls.push({
        id: `ctrl-cl-${++counter}`,
        name, source: 'Checklist', sourceName: cl.name,
        process: cl.id.includes('001') || cl.id.includes('002') || cl.id.includes('003') ? 'Procure to Pay' : 'Revenue',
        type: 'Manual', status: 'Ready', workflows: [],
      });
    }
  }

  // From SOPs — derived controls (multiple per SOP, matching RACM control names)
  const SOP_DERIVED_CONTROLS: Record<string, { name: string; type: ControlItem['type']; workflows: LinkedWorkflow[] }[]> = {
    'P2P': [
      { name: 'Three-Way PO/GRN/Invoice Matching', type: 'Automated', workflows: [
        { id: 'wf-sop-pv', name: 'PO Validation Workflow', version: 'v2.0', status: 'Active', description: 'Validates PO existence and payment approval' },
        { id: 'wf-sop-grn', name: 'GRN Matching Workflow', version: 'v1.6', status: 'Active', description: 'Matches GRN quantity against PO' },
      ]},
      { name: 'Vendor Master Change Approval', type: 'Manual', workflows: [
        { id: 'wf-sop-vcm', name: 'Vendor Change Monitor', version: 'v1.1', status: 'Active', description: 'Monitors vendor master changes and approvals' },
      ]},
      { name: 'Duplicate Invoice Detection', type: 'Automated', workflows: [
        { id: 'wf-sop-dd', name: 'Duplicate Invoice Detector', version: 'v1.4', status: 'Active', description: 'Scans invoices for duplicates and flags matches' },
      ]},
      { name: 'High-Value Payment Review', type: 'Automated', workflows: [
        { id: 'wf-sop-pf', name: 'Payment Flagging', version: 'v2.0', status: 'Active', description: 'Flags high-value payments for additional approval' },
      ]},
      { name: 'PO Dual Sign-Off Authorization', type: 'Manual', workflows: [] },
    ],
    'O2C': [
      { name: 'Revenue Recognition Compliance Check', type: 'Automated', workflows: [
        { id: 'wf-sop-rc', name: 'Revenue Checker', version: 'v2.3', status: 'Active', description: 'Validates revenue recognition per ASC 606' },
      ]},
      { name: 'Sales Order Approval', type: 'Manual', workflows: [] },
    ],
    'R2R': [
      { name: 'Journal Entry Anomaly Review', type: 'Automated', workflows: [
        { id: 'wf-sop-je', name: 'JE Anomaly Review', version: 'v3.0', status: 'Active', description: 'AI anomaly detection on journal entries' },
      ]},
      { name: 'Period-End Close Reconciliation', type: 'Manual', workflows: [] },
    ],
  };
  for (const sopId of scope.sopIds) {
    const sop = SOPS.find(s => s.id === sopId);
    if (!sop) continue;
    const processLabel = sop.process === 'P2P' ? 'Procure to Pay' : sop.process === 'O2C' ? 'Order to Cash' : 'Record to Report';
    const hasRacm = controls.some(c => c.source === 'RACM' && c.process === processLabel);
    if (hasRacm) continue;
    const derived = SOP_DERIVED_CONTROLS[sop.process] || [];
    for (const dc of derived) {
      controls.push({
        id: `ctrl-sop-${++counter}`,
        name: dc.name,
        source: 'SOP', sourceName: sop.name,
        process: processLabel,
        type: dc.type,
        status: dc.workflows.length > 0 ? 'Ready' : 'Needs Review',
        workflows: dc.workflows,
      });
    }
  }

  return controls;
}

const SOURCE_CLS: Record<string, string> = {
  'Checklist': 'bg-blue-50 text-blue-700',
  'RACM': 'bg-purple-50 text-purple-700',
  'SOP': 'bg-amber-50 text-amber-700',
};
const STATUS_CLS: Record<string, string> = {
  'Draft': 'bg-gray-100 text-gray-600',
  'Ready': 'bg-emerald-50 text-emerald-700',
  'Needs Review': 'bg-amber-50 text-amber-700',
};
const WF_STATUS_CLS: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-500',
  Ready: 'bg-blue-50 text-blue-700',
  Active: 'bg-emerald-50 text-emerald-700',
};

function now(): string { return new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }

// ─── Component ──────────────────────────────────────────────────────────

interface Props {
  engagement: ConfigurableEngagement;
  scope: InternalAuditScopeState;
  analysisState: InternalAuditAnalysisState;
  onUpdateAnalysis: (state: InternalAuditAnalysisState) => void;
  onNavigateTab?: (tabId: string) => void;
}

export default function InternalAuditControlsTab({ engagement, scope, analysisState, onUpdateAnalysis, onNavigateTab }: Props) {
  const controls = useMemo(() => deriveControls(scope), [scope]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedWfIds, setSelectedWfIds] = useState<Set<string>>(new Set());
  const [selectedControlIds, setSelectedControlIds] = useState<Set<string>>(new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkMode, setBulkMode] = useState<'control' | 'workflow'>('workflow');

  const checklistCount = controls.filter(c => c.source === 'Checklist').length;
  const racmCount = controls.filter(c => c.source === 'RACM').length;
  const sopCount = controls.filter(c => c.source === 'SOP').length;
  const totalWfs = controls.reduce((s, c) => s + c.workflows.length, 0);
  const executableControls = controls.filter(c => c.workflows.length > 0);
  const hasAnalysisRuns = analysisState.runs.length > 0;

  // Control-level selection
  const toggleControlSelect = (id: string) => {
    setSelectedControlIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const selectAllControls = () => setSelectedControlIds(new Set(executableControls.map(c => c.id)));
  const clearControlSelection = () => setSelectedControlIds(new Set());

  // Workflow-level selection (within expanded control)
  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
    setSelectedWfIds(new Set());
  };
  const toggleWf = (id: string) => {
    setSelectedWfIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const selectAllWfs = (ctrl: ControlItem) => setSelectedWfIds(new Set(ctrl.workflows.map(w => w.id)));
  const clearWfSelection = () => setSelectedWfIds(new Set());

  const expandedControl = controls.find(c => c.id === expandedId);

  // Build LibraryWorkflow list — works for both control-level and workflow-level selection
  const selectedLibraryWorkflows = useMemo((): LibraryWorkflow[] => {
    if (bulkMode === 'control') {
      // All workflows from all selected controls
      return controls
        .filter(c => selectedControlIds.has(c.id))
        .flatMap(ctrl => ctrl.workflows.map(w => ({
          id: `${ctrl.id}::${w.id}`,
          name: w.name,
          description: w.description || ctrl.name,
          tags: [ctrl.source, ctrl.process],
          businessProcess: engagement.businessProcess || ctrl.process,
          controlId: ctrl.id,
          live: w.status === 'Active',
        })));
    }
    // Workflow-level: from expanded control
    if (!expandedControl) return [];
    return expandedControl.workflows
      .filter(w => selectedWfIds.has(w.id))
      .map(w => ({
        id: w.id,
        name: w.name,
        description: w.description || expandedControl.name,
        tags: [expandedControl.source, expandedControl.process],
        businessProcess: engagement.businessProcess || expandedControl.process,
        controlId: expandedControl.id,
        live: w.status === 'Active',
      }));
  }, [bulkMode, controls, selectedControlIds, expandedControl, selectedWfIds, engagement.businessProcess]);

  // Handle modal complete — create IA Analysis runs for all selected workflows
  const handleBulkRunComplete = useCallback(() => {
    const newRuns: AnalysisRun[] = [];
    if (bulkMode === 'control') {
      for (const ctrl of controls.filter(c => selectedControlIds.has(c.id))) {
        for (const wf of ctrl.workflows) {
          const run: AnalysisRun = {
            id: `ia-run-${Date.now()}-${ctrl.id}-${wf.id}`,
            runType: 'WORKFLOW', title: `${wf.name} — ${ctrl.name}`,
            linkedScopeType: ctrl.source, linkedScopeLabel: ctrl.name,
            inputFiles: [], workflowName: wf.name, question: '',
            status: 'READY', startedAt: null, completedAt: null,
            runBy: engagement.owner, summary: '', exceptions: [], createdAt: now(),
          };
          newRuns.push(simulateAnalysisRun(run, engagement.owner));
        }
      }
    } else if (expandedControl) {
      for (const wf of expandedControl.workflows.filter(w => selectedWfIds.has(w.id))) {
        const run: AnalysisRun = {
          id: `ia-run-${Date.now()}-${wf.id}`,
          runType: 'WORKFLOW', title: `${wf.name} — ${expandedControl.name}`,
          linkedScopeType: expandedControl.source, linkedScopeLabel: expandedControl.name,
          inputFiles: [], workflowName: wf.name, question: '',
          status: 'READY', startedAt: null, completedAt: null,
          runBy: engagement.owner, summary: '', exceptions: [], createdAt: now(),
        };
        newRuns.push(simulateAnalysisRun(run, engagement.owner));
      }
    }
    onUpdateAnalysis({ ...analysisState, runs: [...analysisState.runs, ...newRuns] });
    setShowBulkModal(false);
    setSelectedWfIds(new Set());
    setSelectedControlIds(new Set());
  }, [bulkMode, controls, selectedControlIds, expandedControl, selectedWfIds, engagement.owner, analysisState, onUpdateAnalysis]);

  const bulkControlWfCount = controls.filter(c => selectedControlIds.has(c.id)).reduce((s, c) => s + c.workflows.length, 0);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-[15px] font-bold text-text mb-0.5">Controls</h3>
        <p className="text-[12px] text-text-muted">Review controls, select linked workflows, and run them to generate analysis findings.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Total Controls', value: controls.length, color: 'text-text' },
          { label: 'From Checklist', value: checklistCount, color: checklistCount > 0 ? 'text-blue-600' : 'text-gray-400' },
          { label: 'From RACM', value: racmCount, color: racmCount > 0 ? 'text-purple-600' : 'text-gray-400' },
          { label: 'From SOP', value: sopCount, color: sopCount > 0 ? 'text-amber-600' : 'text-gray-400' },
          { label: 'Linked Workflows', value: totalWfs, color: totalWfs > 0 ? 'text-primary' : 'text-gray-400' },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-border-light bg-white p-4">
            <div className={`text-[18px] font-bold tabular-nums ${s.color}`}>{s.value}</div>
            <div className="text-[10px] text-gray-400 font-medium mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Workflow run success banner */}
      {hasAnalysisRuns && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-700">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={13} />
            <span><span className="font-semibold">{analysisState.runs.length} workflow run{analysisState.runs.length !== 1 ? 's' : ''}</span> completed. {analysisState.runs.flatMap(r => r.exceptions).length} potential finding{analysisState.runs.flatMap(r => r.exceptions).length !== 1 ? 's' : ''} generated.</span>
          </div>
          <button onClick={() => onNavigateTab?.('analysis')} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 cursor-pointer transition-colors">
            View in Analysis <ChevronRight size={10} />
          </button>
        </div>
      )}

      {/* Bulk control selection bar */}
      {executableControls.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => selectedControlIds.size === executableControls.length ? clearControlSelection() : selectAllControls()}
              className="text-[11px] font-semibold text-primary hover:underline cursor-pointer">
              {selectedControlIds.size === executableControls.length ? 'Deselect All' : `Select All Controls (${executableControls.length})`}
            </button>
            {selectedControlIds.size > 0 && (
              <>
                <button onClick={clearControlSelection} className="text-[11px] font-semibold text-gray-400 hover:text-gray-600 cursor-pointer">Clear</button>
                <span className="text-[11px] text-primary font-semibold">{selectedControlIds.size} control{selectedControlIds.size !== 1 ? 's' : ''} · {bulkControlWfCount} workflow{bulkControlWfCount !== 1 ? 's' : ''}</span>
              </>
            )}
          </div>
          {selectedControlIds.size > 0 && (
            <button
              onClick={() => { setBulkMode('control'); setShowBulkModal(true); }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-[12px] font-semibold cursor-pointer transition-colors"
            >
              <Play size={12} />Execute {selectedControlIds.size} Control{selectedControlIds.size !== 1 ? 's' : ''} ({bulkControlWfCount} workflows)
            </button>
          )}
        </div>
      )}

      {/* Controls list */}
      {controls.length > 0 ? (
        <div className="rounded-xl border border-border-light bg-white overflow-hidden">
          {controls.map((ctrl, i) => {
            const isExpanded = expandedId === ctrl.id;
            const wfCount = ctrl.workflows.length;
            const selectedCount = isExpanded ? ctrl.workflows.filter(w => selectedWfIds.has(w.id)).length : 0;
            const isControlSelected = selectedControlIds.has(ctrl.id);
            return (
              <div key={ctrl.id} className={i > 0 ? 'border-t border-border-light' : ''}>
                {/* Control row */}
                <div
                  onClick={() => toggleExpand(ctrl.id)}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${isExpanded ? 'bg-primary/5' : isControlSelected ? 'bg-primary/[0.03]' : 'hover:bg-surface-2/30'}`}
                >
                  {wfCount > 0 && (
                    <input type="checkbox" checked={isControlSelected} onChange={(e) => { e.stopPropagation(); toggleControlSelect(ctrl.id); }}
                      onClick={e => e.stopPropagation()}
                      className="w-3.5 h-3.5 rounded border-gray-300 accent-[#6a12cd] cursor-pointer shrink-0" />
                  )}
                  {wfCount === 0 && <div className="w-3.5 shrink-0" />}
                  {isExpanded ? <ChevronDown size={14} className="text-primary shrink-0" /> : <ChevronRight size={14} className="text-gray-400 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-semibold text-text">{ctrl.name}</span>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold ${SOURCE_CLS[ctrl.source]}`}>{ctrl.source}</span>
                    </div>
                    <div className="text-[10px] text-gray-400 mt-0.5">{ctrl.sourceName} · {ctrl.process}</div>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-gray-400 shrink-0">
                    {wfCount > 0 ? (
                      <span className="flex items-center gap-1 font-medium text-primary"><Workflow size={10} />{wfCount} workflow{wfCount !== 1 ? 's' : ''}</span>
                    ) : (
                      <span className="text-gray-300">No workflows</span>
                    )}
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold ${STATUS_CLS[ctrl.status]}`}>{ctrl.status}</span>
                  </div>
                </div>

                {/* Expanded: linked workflows with selection */}
                {isExpanded && (
                  <div className="border-t border-border-light bg-surface-2/10 px-5 py-4 space-y-3">
                    {wfCount === 0 ? (
                      <div className="flex items-start gap-2 px-3 py-3 rounded-lg bg-amber-50/30 border border-amber-100 text-[11px] text-amber-700">
                        <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                        <span>No workflows linked to this control. Link or create workflows from the RACM tab before running analysis.</span>
                      </div>
                    ) : (
                      <>
                        {/* Selection toolbar */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <button onClick={() => selectAllWfs(ctrl)}
                              className="text-[10px] font-semibold text-primary hover:underline cursor-pointer">Select All ({wfCount})</button>
                            {selectedCount > 0 && (
                              <button onClick={clearSelection}
                                className="text-[10px] font-semibold text-gray-400 hover:text-gray-600 cursor-pointer">Clear</button>
                            )}
                            {selectedCount > 0 && (
                              <span className="text-[10px] text-primary font-semibold">{selectedCount} selected</span>
                            )}
                          </div>
                          <button
                            onClick={() => { setBulkMode('workflow'); setShowBulkModal(true); }}
                            disabled={selectedCount === 0}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[11px] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Play size={11} />
                            {selectedCount <= 1 ? 'Execute Workflow' : `Execute ${selectedCount} Workflows`}
                          </button>
                        </div>

                        {/* Workflow cards */}
                        <div className="space-y-2">
                          {ctrl.workflows.map(wf => {
                            const isSelected = selectedWfIds.has(wf.id);
                            return (
                              <div key={wf.id}
                                className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border transition-colors cursor-pointer ${
                                  isSelected ? 'border-primary/30 bg-primary/5' : 'border-border-light/50 bg-white hover:border-primary/20'
                                }`}
                                onClick={() => toggleWf(wf.id)}
                              >
                                <input type="checkbox" checked={isSelected} onChange={() => toggleWf(wf.id)}
                                  className="w-3.5 h-3.5 rounded border-gray-300 accent-[#6a12cd] cursor-pointer mt-0.5 shrink-0" onClick={e => e.stopPropagation()} />
                                <Workflow size={13} className="text-brand-600 shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <span className="text-[12px] font-medium text-text">{wf.name}</span>
                                    <span className="text-[9px] font-mono text-gray-400">{wf.version}</span>
                                    <span className={`px-1.5 h-4 rounded text-[8px] font-bold inline-flex items-center ${WF_STATUS_CLS[wf.status]}`}>{wf.status}</span>
                                  </div>
                                  {wf.description && (
                                    <p className="text-[10px] text-gray-400 mt-0.5">{wf.description}</p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-border-light bg-white p-8 text-center">
          <ClipboardCheck size={28} className="text-gray-300 mx-auto mb-2" />
          <p className="text-[13px] font-semibold text-text mb-1">No Controls Yet</p>
          <p className="text-[11px] text-text-muted">Select SOPs, RACMs, or Checklists in the Scope tab to populate controls.</p>
        </div>
      )}

      {/* Continue to Analysis */}
      <div className="flex items-center gap-3">
        <button onClick={() => onNavigateTab?.('analysis')}
          className="flex items-center gap-1 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-[12px] font-semibold cursor-pointer transition-colors">
          Continue to Analysis <ChevronRight size={12} />
        </button>
        {hasAnalysisRuns && (
          <span className="text-[11px] text-text-muted">Workflow results will be available in Analysis.</span>
        )}
      </div>

      {/* BulkExecuteModal */}
      {showBulkModal && selectedLibraryWorkflows.length > 0 && (
        <BulkExecuteModal
          selectedWorkflows={selectedLibraryWorkflows}
          onClose={() => { setShowBulkModal(false); setRunControlId(null); }}
          onContinue={() => handleBulkRunComplete()}
        />
      )}
    </div>
  );
}
