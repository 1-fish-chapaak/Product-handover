// ─── Automation Project — Cases Tab ───────────────────────────────────────
// Embeds existing ManageExceptionsView for exception/case management,
// fed with V3 automation run exceptions.
// Supports bulk "Mark as Case & Assign" from selected exceptions.

import DatePicker from '../../../shared/DatePicker';
import React, { useState, useMemo, useCallback } from 'react';
import { Lock, ChevronRight, Info, Workflow, X, AlertCircle } from 'lucide-react';
import type { ConfigurableEngagement, AutomationProjectConfig } from '../../configurableEngagementTypes';
import type { AutomationRunsState, AutomationRunException, ExceptionStatus } from './automationRunsData';
import { EX_SEVERITY_CLS } from './automationRunsData';
import type { AutomationCasesState } from './automationCasesData';
import type { ExceptionRole } from '../../../../hooks/useAppState';
import ManageExceptionsView from '../../../exceptions/ManageExceptionsView';
import type { GrcException } from '../../../../data/mockData';
import { mapV3ExceptionsToGrc, syncGrcToV3Exception } from './exceptionAdapter';

function now(): string { return new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function futureDate(days: number): string { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); }
const inputCls = 'w-full px-3 py-2 border border-border rounded-lg text-[0.75rem] text-text bg-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all';
const labelCls = 'text-[0.6875rem] font-semibold text-text-muted block mb-1';

interface Props {
  engagement: ConfigurableEngagement;
  runsState: AutomationRunsState;
  casesState: AutomationCasesState;
  onUpdateCases: (state: AutomationCasesState) => void;
  onUpdateRunException?: (runId: string, exId: string, status: ExceptionStatus, triageData?: Record<string, unknown>) => void;
  onNavigateTab?: (tabId: string) => void;
  /** Skip the CASE_MANAGEMENT output-type check (for IA engagements that always have case management). */
  skipOutputCheck?: boolean;
}

export default function AutomationCasesTab({ engagement, runsState, casesState, onUpdateCases, onUpdateRunException, onNavigateTab, skipOutputCheck }: Props) {
  const cfg = engagement.config as AutomationProjectConfig;
  const hasCaseMgmt = skipOutputCheck || cfg.outputTypes?.includes('CASE_MANAGEMENT');
  const completedRuns = runsState.runs.filter(r => r.status === 'COMPLETED');
  const allExceptions = completedRuns.flatMap(r => r.exceptions);
  const [role, setRole] = useState<ExceptionRole>('auditor');
  const [selectedWorkflow, setSelectedWorkflow] = useState('');

  // Bulk assign state
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignExceptionIds, setAssignExceptionIds] = useState<string[]>([]);

  const workflowNames = useMemo(() => {
    const names = new Set<string>();
    for (const ex of allExceptions) {
      if (ex.sourceWorkflowName) names.add(ex.sourceWorkflowName);
    }
    return Array.from(names).sort();
  }, [allExceptions]);

  const filteredRuns = useMemo(() => {
    if (!selectedWorkflow) return completedRuns.map(r => ({ id: r.id, exceptions: r.exceptions }));
    return completedRuns.map(r => ({
      id: r.id,
      exceptions: r.exceptions.filter(e => e.sourceWorkflowName === selectedWorkflow),
    })).filter(r => r.exceptions.length > 0);
  }, [completedRuns, selectedWorkflow]);

  // Locked states
  if (!hasCaseMgmt) {
    return (
      <div className="space-y-4">
        <div><h3 className="text-[0.9375rem] font-bold text-text mb-0.5">Exceptions & Cases</h3><p className="text-[0.75rem] text-text-muted">Review workflow exceptions and manage follow-up cases.</p></div>
        <div className="rounded-lg border border-border-light p-6 text-center space-y-2">
          <Info size={24} className="text-gray-300 mx-auto" />
          <p className="text-[0.75rem] text-text-muted">Case Management was not selected as an output for this project.</p>
        </div>
      </div>
    );
  }

  if (completedRuns.length === 0) {
    return (
      <div className="space-y-4">
        <div><h3 className="text-[0.9375rem] font-bold text-text mb-0.5">Exceptions & Cases</h3><p className="text-[0.75rem] text-text-muted">Review workflow exceptions and manage follow-up cases.</p></div>
        <div className="rounded-xl border-2 border-gray-200 bg-gray-50/30 p-6 text-center space-y-3">
          <Lock size={28} className="text-gray-300 mx-auto" />
          <h4 className="text-[0.875rem] font-semibold text-text">No Completed Runs</h4>
          <p className="text-[0.75rem] text-text-muted">Complete an automation run before managing exceptions.</p>
          <button onClick={() => onNavigateTab?.('workflows')} className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.75rem] font-semibold cursor-pointer transition-colors inline-flex items-center gap-1">Go to Workflows <ChevronRight size={12} /></button>
        </div>
      </div>
    );
  }

  if (allExceptions.length === 0) {
    return (
      <div className="space-y-4">
        <div><h3 className="text-[0.9375rem] font-bold text-text mb-0.5">Exceptions & Cases</h3><p className="text-[0.75rem] text-text-muted">Review workflow exceptions and manage follow-up cases.</p></div>
        <div className="rounded-lg border border-border-light p-6 text-center space-y-2">
          <Info size={24} className="text-gray-300 mx-auto" />
          <p className="text-[0.75rem] text-text-muted">No exceptions were generated from completed runs. All clear.</p>
          <button onClick={() => onNavigateTab?.('reports')} className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.6875rem] font-semibold cursor-pointer transition-colors inline-flex items-center gap-1">Continue to Reports <ChevronRight size={11} /></button>
        </div>
      </div>
    );
  }

  // Map V3 exceptions to GRC format
  const grcExceptions = useMemo(() =>
    mapV3ExceptionsToGrc(filteredRuns),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredRuns.map(r => `${r.id}:${r.exceptions.map(e => `${e.id}:${e.status}:${e.deficiencyType}:${e.assignedOwner}`).join(',')}`).join('|')]
  );

  // Sync changes from ManageExceptionsView back to V3 runs state
  const handleExceptionsChange = useCallback((updatedGrcExceptions: GrcException[]) => {
    if (!onUpdateRunException) return;
    for (const grcEx of updatedGrcExceptions) {
      for (const run of completedRuns) {
        const original = run.exceptions.find(e => e.id === grcEx.id);
        if (original) {
          const updates = syncGrcToV3Exception(grcEx, original);
          if (Object.keys(updates).length > 0) {
            onUpdateRunException(run.id, grcEx.id, updates.status || original.status, updates);
          }
          break;
        }
      }
    }
  }, [completedRuns, onUpdateRunException]);

  // Handle bulk assign trigger from ManageExceptionsView
  const handleBulkAssign = useCallback((selectedIds: string[]) => {
    setAssignExceptionIds(selectedIds);
    setAssignModalOpen(true);
  }, []);

  // Save assignment
  const handleAssignSave = useCallback((triage: { owner: string; reviewer: string; dueDate: string; notes: string }) => {
    if (!onUpdateRunException) return;
    const ts = now();
    assignExceptionIds.forEach(exId => {
      const parentRun = completedRuns.find(r => r.exceptions.some(e => e.id === exId));
      if (parentRun) {
        onUpdateRunException(parentRun.id, exId, 'CASE_CANDIDATE', {
          assignedOwner: triage.owner,
          reviewer: triage.reviewer,
          dueDate: triage.dueDate,
          triageNotes: triage.notes,
          caseCandidateMarkedAt: ts,
          caseCandidateMarkedBy: engagement.owner,
        });
      }
    });
    setAssignModalOpen(false);
    setAssignExceptionIds([]);
  }, [assignExceptionIds, completedRuns, engagement.owner, onUpdateRunException]);

  // Resolve selected exceptions for the assign modal
  const selectedExceptions = useMemo(() =>
    allExceptions.filter(e => assignExceptionIds.includes(e.id)),
    [allExceptions, assignExceptionIds]
  );

  return (
    <div className="space-y-0 relative">
      {/* Context banner + workflow filter */}
      <div className="rounded-t-lg border border-blue-200/50 overflow-hidden mb-0">
        <div className="flex items-start gap-2 px-4 py-2 bg-blue-50/50 text-[0.625rem] text-blue-600">
          <Info size={11} className="shrink-0 mt-0.5" />
          <span>Select exceptions, classify deficiencies, and use <strong>Mark as Case & Assign</strong> to assign owners for remediation.</span>
        </div>
        {workflowNames.length > 1 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-white border-t border-border-light/50">
            <Workflow size={13} className="text-primary shrink-0" />
            <span className="text-[0.6875rem] font-semibold text-text-muted">Filter by Workflow:</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setSelectedWorkflow('')}
                className={`px-2.5 py-1 rounded-full text-[0.625rem] font-semibold cursor-pointer transition-colors ${!selectedWorkflow ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
              >
                All Workflows ({allExceptions.length})
              </button>
              {workflowNames.map(name => {
                const count = allExceptions.filter(e => e.sourceWorkflowName === name).length;
                return (
                  <button
                    key={name}
                    onClick={() => setSelectedWorkflow(name)}
                    className={`px-2.5 py-1 rounded-full text-[0.625rem] font-semibold cursor-pointer transition-colors ${selectedWorkflow === name ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                  >
                    {name.length > 25 ? name.slice(0, 24) + '…' : name} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Embedded ManageExceptionsView — no fixed height so header scrolls away */}
      <div className="rounded-b-lg border border-t-0 border-border-light overflow-hidden" style={{ minHeight: 'calc(100vh - 120px)' }}>
        <ManageExceptionsView
          role={role}
          setRole={setRole}
          onBack={() => onNavigateTab?.('output-review')}
          embedded={true}
          exceptions={grcExceptions}
          onExceptionsChange={handleExceptionsChange}
          contextLabel={engagement.name}
          onBulkAssign={handleBulkAssign}
          showApprovalFlowAssign
        />
      </div>

      {/* Bulk Assign Modal */}
      {assignModalOpen && (
        <BulkAssignModal
          selectedExceptions={selectedExceptions}
          defaultOwner={engagement.owner}
          onSave={handleAssignSave}
          onCancel={() => { setAssignModalOpen(false); setAssignExceptionIds([]); }}
        />
      )}
    </div>
  );
}

// ─── Bulk Assign Modal ──────────────────────────────────────────────────

function BulkAssignModal({ selectedExceptions, defaultOwner, onSave, onCancel }: {
  selectedExceptions: AutomationRunException[];
  defaultOwner: string;
  onSave: (triage: { owner: string; reviewer: string; dueDate: string; notes: string }) => void;
  onCancel: () => void;
}) {
  const [owner, setOwner] = useState('');
  const [reviewer, setReviewer] = useState('');
  const [dueDate, setDueDate] = useState(futureDate(14));
  const [notes, setNotes] = useState('');
  const [validationMsg, setValidationMsg] = useState('');

  const handleSave = () => {
    if (!owner.trim()) { setValidationMsg('Owner is required.'); return; }
    if (!dueDate) { setValidationMsg('Due date is required.'); return; }
    onSave({ owner: owner.trim(), reviewer: reviewer.trim(), dueDate, notes: notes.trim() });
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-50" onClick={onCancel} />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] w-full max-w-[520px]">
        <div className="bg-white rounded-2xl shadow-2xl border border-border-light overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-border-light bg-gradient-to-r from-purple-50 to-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[0.9375rem] font-bold text-text">Mark as Case & Assign</h3>
                <p className="text-[0.6875rem] text-text-muted mt-0.5">{selectedExceptions.length} exception{selectedExceptions.length !== 1 ? 's' : ''} selected — assign to a risk owner for remediation.</p>
              </div>
              <button onClick={onCancel} className="p-1.5 rounded-lg text-gray-400 hover:text-text hover:bg-gray-100 cursor-pointer transition-colors"><X size={16} /></button>
            </div>
          </div>

          {/* Selected exceptions preview */}
          <div className="px-6 py-3 bg-surface-2/20 border-b border-border-light/50">
            <div className="text-[0.625rem] text-gray-500 font-medium mb-1.5">SELECTED EXCEPTIONS</div>
            <div className="space-y-1 max-h-28 overflow-y-auto">
              {selectedExceptions.map(ex => (
                <div key={ex.id} className="flex items-center gap-2 text-[0.6875rem]">
                  <span className={`px-1.5 py-0.5 rounded text-[0.5rem] font-bold ${EX_SEVERITY_CLS[ex.severity]}`}>{ex.severity}</span>
                  <span className="text-text font-medium flex-1 truncate">{ex.title}</span>
                  {ex.sourceWorkflowName && <span className="text-gray-400 text-[0.625rem] truncate max-w-[140px]">{ex.sourceWorkflowName}</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Form */}
          <div className="px-6 py-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Assign Owner <span className="text-red-400">*</span></label>
                <input value={owner} onChange={e => { setOwner(e.target.value); setValidationMsg(''); }} placeholder="Owner name" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Reviewer</label>
                <input value={reviewer} onChange={e => setReviewer(e.target.value)} placeholder="Optional reviewer" className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Due Date <span className="text-red-400">*</span></label>
              <DatePicker value={dueDate} onChange={e => { setDueDate(e.target.value); setValidationMsg(''); }} className={inputCls + ' max-w-[200px]'} />
            </div>
            <div>
              <label className={labelCls}>Notes for Owner</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Instructions, context, or details for the risk/process owner..." className={inputCls + ' resize-none'} />
            </div>

            {validationMsg && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-[0.625rem] text-red-600">
                <AlertCircle size={10} /><span>{validationMsg}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-border-light bg-gray-50/50 flex items-center justify-end gap-2">
            <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-border-light text-[0.75rem] font-medium text-text-muted hover:bg-white cursor-pointer transition-colors">Cancel</button>
            <button onClick={handleSave} className="px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[0.75rem] font-semibold cursor-pointer transition-colors">
              Assign {selectedExceptions.length} Case{selectedExceptions.length !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
