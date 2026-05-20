// ─── Internal Audit — Action Plan Tab ─────────────────────────────────────
// Track agreed remediation actions after Final Report is issued.

import React, { useState, useEffect } from 'react';
import {
  Plus, CheckCircle2, AlertCircle, ChevronRight, X, Lock, Play, FileText, Info,
} from 'lucide-react';
import type { ConfigurableEngagement } from '../../configurableEngagementTypes';
import type { InternalAuditWorkspaceState } from './internalAuditScopeData';
import {
  initializeActionItems, deriveActionPlanSummary, ACTION_STATUS_CLS, PRIORITY_CLS, PRIORITIES_LIST,
  type InternalAuditActionPlanState, type InternalAuditActionItem, type ActionItemStatus, type ActionPriority,
} from './internalAuditActionPlanData';

const inputCls = 'w-full px-3 py-2 border border-border rounded-lg text-[12px] text-text bg-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all';
const selectCls = inputCls + ' cursor-pointer appearance-none';
const labelCls = 'text-[11px] font-semibold text-text-muted block mb-1';

function now(): string { return new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }

interface Props {
  engagement: ConfigurableEngagement;
  iaState: InternalAuditWorkspaceState;
  actionPlan: InternalAuditActionPlanState;
  onUpdateActionPlan: (state: InternalAuditActionPlanState) => void;
  onNavigateTab?: (tabId: string) => void;
}

export default function InternalAuditActionPlanTab({ engagement, iaState, actionPlan, onUpdateActionPlan, onNavigateTab }: Props) {
  const isIssued = iaState.finalReport.status === 'ISSUED';
  const noObsConfirmed = iaState.observations.noObservationsConfirmed;
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Initialize / sync action items from agreed discussion actions
  // Runs whenever agreed discussion items change, not just once
  const agreedDiscItemIds = iaState.discussion.items
    .filter(d => (d.status === 'AGREED' || d.status === 'READY_FOR_REPORT') && d.agreedAction.trim())
    .map(d => d.observationId).join(',');

  useEffect(() => {
    if (!isIssued) return;
    const initialized = initializeActionItems(actionPlan.actionItems, iaState, engagement.owner);
    if (initialized.length !== actionPlan.actionItems.length) {
      onUpdateActionPlan({ ...actionPlan, actionItems: initialized, initializedFromReport: true });
    }
  }, [isIssued, agreedDiscItemIds]);

  const summary = deriveActionPlanSummary(actionPlan);

  const updateItem = (id: string, updates: Partial<InternalAuditActionItem>) => {
    onUpdateActionPlan({
      ...actionPlan,
      actionItems: actionPlan.actionItems.map(a => a.id === id ? { ...a, ...updates, updatedAt: new Date().toISOString().slice(0, 10) } : a),
    });
  };

  const transitionStatus = (id: string, status: ActionItemStatus, comments: string = '') => {
    const item = actionPlan.actionItems.find(a => a.id === id);
    if (!item) return;
    updateItem(id, {
      status,
      completedAt: status === 'COMPLETED' ? now() : item.completedAt,
      history: [...item.history, { id: `aph-${Date.now()}`, action: 'STATUS_CHANGED', actor: engagement.owner, timestamp: now(), comments: comments || `Status → ${status}` }],
    });
  };

  const addEvidence = (id: string, fileName: string) => {
    const item = actionPlan.actionItems.find(a => a.id === id);
    if (!item) return;
    updateItem(id, {
      remediationEvidence: [...item.remediationEvidence, fileName],
      history: [...item.history, { id: `aph-${Date.now()}`, action: 'EVIDENCE_ADDED', actor: engagement.owner, timestamp: now(), comments: fileName }],
    });
  };

  const addManualItem = (item: InternalAuditActionItem) => {
    onUpdateActionPlan({ ...actionPlan, actionItems: [...actionPlan.actionItems, item] });
    setShowCreateForm(false);
  };

  const allComplete = actionPlan.actionItems.length > 0 && actionPlan.actionItems.every(a => ['COMPLETED', 'CANCELLED'].includes(a.status));
  const noActionsNeeded = noObsConfirmed && actionPlan.actionItems.length === 0;

  // Locked state
  if (!isIssued) {
    return (
      <div className="space-y-4">
        <div><h3 className="text-[15px] font-bold text-text mb-0.5">Action Plan</h3><p className="text-[12px] text-text-muted">Track agreed remediation actions from the final internal audit report.</p></div>
        <div className="rounded-xl border-2 border-gray-200 bg-gray-50/30 p-6 text-center space-y-3">
          <Lock size={28} className="text-gray-300 mx-auto" />
          <h4 className="text-[14px] font-semibold text-text">Action Plan Locked</h4>
          <p className="text-[12px] text-text-muted max-w-md mx-auto">Action Plan will be available after the Final Report is issued.</p>
          <div className="text-[11px] text-gray-500">Final Report status: <span className="font-semibold">{iaState.finalReport.status.replace(/_/g, ' ')}</span></div>
          <button onClick={() => onNavigateTab?.('final-report')} className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-[12px] font-semibold cursor-pointer transition-colors inline-flex items-center gap-1">Go to Final Report <ChevronRight size={12} /></button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[15px] font-bold text-text mb-0.5">Action Plan</h3>
          <p className="text-[12px] text-text-muted">Track agreed remediation actions from the final internal audit report.</p>
        </div>
        <button onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[11px] font-semibold cursor-pointer transition-colors shrink-0">
          <Plus size={12} />Create Manual Action
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-7 gap-2">
        {[
          { label: 'Total', value: summary.total },
          { label: 'Not Started', value: summary.notStarted },
          { label: 'In Progress', value: summary.inProgress, cls: summary.inProgress > 0 ? 'text-blue-600' : '' },
          { label: 'Completed', value: summary.completed, cls: 'text-emerald-600' },
          { label: 'Overdue', value: summary.overdue, cls: summary.overdue > 0 ? 'text-red-600' : '' },
          { label: 'Critical/High', value: summary.criticalHigh, cls: summary.criticalHigh > 0 ? 'text-amber-600' : '' },
          { label: 'Follow-up', value: actionPlan.followUpRequired ? 'Yes' : 'No', cls: actionPlan.followUpRequired ? 'text-primary' : '' },
        ].map(s => (
          <div key={s.label} className="rounded-lg border border-border-light p-2 text-center">
            <div className={`text-[15px] font-bold tabular-nums ${s.cls || 'text-text'}`}>{s.value}</div>
            <div className="text-[8px] text-gray-400 font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* No observations / no actions */}
      {noActionsNeeded && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-700">
          <CheckCircle2 size={13} className="shrink-0" /><span>No observations were noted. No remediation action plan is required.</span>
        </div>
      )}
      {!noActionsNeeded && actionPlan.actionItems.length === 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-border-light text-[11px] text-gray-500">
          <Info size={13} className="shrink-0" /><span>No agreed remediation actions were identified. You can create manual actions if needed.</span>
        </div>
      )}

      {/* Create form */}
      {showCreateForm && <CreateActionForm engagement={engagement} onSave={addManualItem} onCancel={() => setShowCreateForm(false)} />}

      {/* Action items table */}
      {actionPlan.actionItems.length > 0 && (
        <div className="rounded-lg border border-border-light overflow-hidden">
          <div className="px-4 py-2 bg-surface-2/20 border-b border-border-light"><h4 className="text-[11px] font-bold text-text">Action Items ({actionPlan.actionItems.length})</h4></div>
          <table className="w-full text-[11px]">
            <thead><tr className="border-b border-border-light bg-surface-2/30 text-[9px] font-semibold text-gray-400 uppercase">
              <th className="px-3 py-1.5 text-left">Action</th>
              <th className="px-3 py-1.5 text-left">Source</th>
              <th className="px-3 py-1.5 text-left">Owner</th>
              <th className="px-3 py-1.5 text-center">Priority</th>
              <th className="px-3 py-1.5 text-center">Due</th>
              <th className="px-3 py-1.5 text-center">Status</th>
              <th className="px-3 py-1.5 text-center">Evidence</th>
              <th className="px-3 py-1.5 text-center">Action</th>
            </tr></thead>
            <tbody>{actionPlan.actionItems.map(item => (
              <tr key={item.id} className="border-b border-border-light/50">
                <td className="px-3 py-2">
                  <div className="font-medium text-text">{item.title}</div>
                  <div className="text-[9px] text-gray-400 truncate max-w-[180px]">{item.description}</div>
                </td>
                <td className="px-3 py-2 text-[10px] text-gray-500">{item.sourceObservationId ? item.sourceObservationTitle || 'Observation' : 'Manual'}</td>
                <td className="px-3 py-2 text-gray-500">{item.owner || '—'}</td>
                <td className="px-3 py-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${PRIORITY_CLS[item.priority]}`}>{item.priority}</span></td>
                <td className="px-3 py-2 text-center text-[10px] font-mono text-gray-500">{item.dueDate || '—'}</td>
                <td className="px-3 py-2 text-center"><span className={`px-2 py-0.5 rounded-full text-[8px] font-bold ${ACTION_STATUS_CLS[item.status]}`}>{item.status.replace(/_/g, ' ')}</span></td>
                <td className="px-3 py-2 text-center text-[10px] text-gray-500">{item.remediationEvidence.length || '—'}</td>
                <td className="px-3 py-2 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => setEditingId(item.id)} className="px-2 py-1 rounded text-[8px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 cursor-pointer transition-colors">Edit</button>
                    {item.status === 'NOT_STARTED' && <button onClick={() => transitionStatus(item.id, 'IN_PROGRESS')} className="px-2 py-1 rounded text-[8px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 cursor-pointer transition-colors">Start</button>}
                    {item.status === 'IN_PROGRESS' && <button onClick={() => transitionStatus(item.id, 'COMPLETED')} className="px-2 py-1 rounded text-[8px] font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 cursor-pointer transition-colors">Done</button>}
                  </div>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {/* Edit panel */}
      {editingId && (() => {
        const item = actionPlan.actionItems.find(a => a.id === editingId);
        return item ? <ActionDetailPanel key={editingId} item={item} onUpdate={(u) => updateItem(item.id, u)} onTransition={(s) => transitionStatus(item.id, s)} onAddEvidence={(f) => addEvidence(item.id, f)} onClose={() => setEditingId(null)} /> : null;
      })()}

      {/* Follow-up */}
      <div className="rounded-lg border border-border-light p-4 space-y-2">
        <h4 className="text-[11px] font-bold text-text">Follow-up</h4>
        <label className="flex items-center gap-2 text-[11px] text-text cursor-pointer">
          <input type="checkbox" checked={actionPlan.followUpRequired} onChange={e => onUpdateActionPlan({ ...actionPlan, followUpRequired: e.target.checked })}
            className="w-3.5 h-3.5 rounded border-border accent-[#6a12cd] cursor-pointer" />
          Follow-up audit required
        </label>
        {actionPlan.followUpRequired && (
          <>
            <textarea value={actionPlan.followUpNotes} onChange={e => onUpdateActionPlan({ ...actionPlan, followUpNotes: e.target.value })}
              rows={2} placeholder="Follow-up notes, suggested date, scope..." className={inputCls + ' resize-none'} />
            <button onClick={() => alert('Linked follow-up assignment creation will be connected later.')}
              className="text-[10px] font-semibold text-primary hover:underline cursor-pointer">Create Linked Follow-up Assignment</button>
          </>
        )}
      </div>

      {/* Readiness */}
      <div className="rounded-lg border border-border-light p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-[11px] font-bold text-text">Action Plan Status</h4>
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${allComplete || noActionsNeeded ? 'bg-emerald-50 text-emerald-700' : summary.inProgress > 0 ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
            {allComplete || noActionsNeeded ? 'Complete' : summary.inProgress > 0 ? 'Tracking In Progress' : 'Not Started'}
          </span>
        </div>
        <div className="space-y-1">
          {[
            { label: 'Final Report issued', ok: isIssued },
            { label: 'Action items generated', ok: actionPlan.initializedFromReport || noActionsNeeded },
            { label: 'Owners assigned', ok: actionPlan.actionItems.every(a => a.owner.trim().length > 0) || actionPlan.actionItems.length === 0 },
            { label: 'Due dates assigned', ok: actionPlan.actionItems.every(a => a.dueDate.length > 0) || actionPlan.actionItems.length === 0 },
            { label: 'All actions tracked or complete', ok: allComplete || noActionsNeeded },
          ].map(c => (
            <div key={c.label} className="flex items-center gap-2 text-[10px]">
              {c.ok ? <CheckCircle2 size={10} className="text-emerald-500" /> : <AlertCircle size={10} className="text-amber-400" />}
              <span className={c.ok ? 'text-gray-500' : 'text-text'}>{c.label}</span>
            </div>
          ))}
        </div>
        <div className="flex items-start gap-2 mt-2 px-3 py-2 rounded-lg bg-gray-50 border border-border-light text-[10px] text-gray-500">
          <Info size={11} className="shrink-0 mt-0.5" /><span>Engagement closure workflow will be connected later.</span>
        </div>
      </div>
    </div>
  );
}

// ─── Create Action Form ───────────────────────────────────────────────────

function CreateActionForm({ engagement, onSave, onCancel }: { engagement: ConfigurableEngagement; onSave: (item: InternalAuditActionItem) => void; onCancel: () => void }) {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [owner, setOwner] = useState('');
  const [priority, setPriority] = useState<ActionPriority>('MEDIUM');
  const [dueDate, setDueDate] = useState('');

  return (
    <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center justify-between"><h4 className="text-[13px] font-bold text-text">Create Manual Action</h4><button onClick={onCancel} className="p-1 rounded text-gray-400 hover:text-text cursor-pointer"><X size={14} /></button></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><label className={labelCls}>Title <span className="text-red-400">*</span></label><input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Update approval matrix" className={inputCls} /></div>
        <div className="col-span-2"><label className={labelCls}>Description</label><textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} placeholder="What needs to be done?" className={inputCls + ' resize-none'} /></div>
        <div><label className={labelCls}>Owner</label><input value={owner} onChange={e => setOwner(e.target.value)} placeholder="Action owner" className={inputCls} /></div>
        <div><label className={labelCls}>Priority</label><select value={priority} onChange={e => setPriority(e.target.value as ActionPriority)} className={selectCls}>{PRIORITIES_LIST.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
        <div><label className={labelCls}>Due Date</label><input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={inputCls} /></div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg border border-border-light text-[11px] font-medium text-text-muted hover:bg-surface-2/30 cursor-pointer transition-colors">Cancel</button>
        <button onClick={() => { if (!title.trim()) return; onSave({ id: `ap-${Date.now()}`, sourceObservationId: '', sourceObservationTitle: '', title: title.trim(), description: desc.trim(), owner: owner.trim(), priority, dueDate, status: 'NOT_STARTED', remediationEvidence: [], comments: '', createdAt: new Date().toISOString().slice(0, 10), updatedAt: new Date().toISOString().slice(0, 10), completedAt: null, history: [{ id: `aph-${Date.now()}`, action: 'CREATED', actor: engagement.owner, timestamp: now(), comments: 'Manual action.' }] }); }}
          disabled={!title.trim()} className="px-4 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[11px] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Create</button>
      </div>
    </div>
  );
}

// ─── Action Detail Panel ──────────────────────────────────────────────────

function ActionDetailPanel({ item, onUpdate, onTransition, onAddEvidence, onClose }: {
  item: InternalAuditActionItem;
  onUpdate: (u: Partial<InternalAuditActionItem>) => void;
  onTransition: (s: ActionItemStatus) => void;
  onAddEvidence: (f: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState({ ...item });
  const [newEvidence, setNewEvidence] = useState('');
  const upd = <K extends keyof InternalAuditActionItem>(f: K, v: InternalAuditActionItem[K]) => setDraft(prev => ({ ...prev, [f]: v }));

  return (
    <div className="rounded-xl border-2 border-primary/20 bg-white p-4 space-y-3 shadow-lg">
      <div className="flex items-center justify-between">
        <h4 className="text-[13px] font-bold text-text">{item.title}</h4>
        <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-text cursor-pointer"><X size={14} /></button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><label className={labelCls}>Title</label><input value={draft.title} onChange={e => upd('title', e.target.value)} className={inputCls} /></div>
        <div className="col-span-2"><label className={labelCls}>Description</label><textarea value={draft.description} onChange={e => upd('description', e.target.value)} rows={2} className={inputCls + ' resize-none'} /></div>
        <div><label className={labelCls}>Owner</label><input value={draft.owner} onChange={e => upd('owner', e.target.value)} className={inputCls} /></div>
        <div><label className={labelCls}>Priority</label><select value={draft.priority} onChange={e => upd('priority', e.target.value as ActionPriority)} className={selectCls}>{PRIORITIES_LIST.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
        <div><label className={labelCls}>Due Date</label><input type="date" value={draft.dueDate} onChange={e => upd('dueDate', e.target.value)} className={inputCls} /></div>
        <div><label className={labelCls}>Comments</label><input value={draft.comments} onChange={e => upd('comments', e.target.value)} placeholder="Notes..." className={inputCls} /></div>
      </div>

      {/* Evidence */}
      <div>
        <label className={labelCls}>Remediation Evidence ({item.remediationEvidence.length})</label>
        {item.remediationEvidence.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">{item.remediationEvidence.map((f, i) => (
            <span key={i} className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[9px] text-emerald-700"><FileText size={8} />{f}</span>
          ))}</div>
        )}
        <div className="flex items-center gap-2">
          <input value={newEvidence} onChange={e => setNewEvidence(e.target.value)} placeholder="Evidence file name..." className="flex-1 px-3 py-1.5 border border-border rounded-lg text-[11px] text-text bg-white outline-none focus:border-primary/40" />
          <button onClick={() => { if (newEvidence.trim()) { onAddEvidence(newEvidence.trim()); setNewEvidence(''); } }} disabled={!newEvidence.trim()}
            className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[10px] font-semibold hover:bg-primary/20 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Add</button>
        </div>
      </div>

      {/* Source */}
      {item.sourceObservationId && <div className="text-[10px] text-gray-500">Source: {item.sourceObservationTitle || item.sourceObservationId}</div>}

      {/* History */}
      {item.history.length > 0 && (
        <div><h6 className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">History</h6>
          <div className="space-y-1">{item.history.map(h => (
            <div key={h.id} className="text-[9px] text-gray-500"><span className="font-semibold text-text">{h.action}</span> by {h.actor} · {h.timestamp}{h.comments ? ` — ${h.comments}` : ''}</div>
          ))}</div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button onClick={() => { onUpdate({ title: draft.title, description: draft.description, owner: draft.owner, priority: draft.priority, dueDate: draft.dueDate, comments: draft.comments, history: [...draft.history, { id: `aph-${Date.now()}`, action: 'UPDATED', actor: 'Auditor', timestamp: now(), comments: '' }] }); onClose(); }}
          className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[11px] font-semibold cursor-pointer transition-colors">Save</button>
        {item.status === 'NOT_STARTED' && <button onClick={() => onTransition('IN_PROGRESS')} className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold cursor-pointer transition-colors flex items-center gap-1"><Play size={10} />Start</button>}
        {item.status === 'IN_PROGRESS' && <button onClick={() => onTransition('COMPLETED')} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold cursor-pointer transition-colors flex items-center gap-1"><CheckCircle2 size={10} />Complete</button>}
        {item.status === 'IN_PROGRESS' && <button onClick={() => onTransition('DEFERRED')} className="px-3 py-1.5 rounded-lg border border-amber-200 text-amber-700 bg-amber-50 text-[11px] font-semibold cursor-pointer transition-colors">Defer</button>}
        {item.status === 'DEFERRED' && <button onClick={() => onTransition('IN_PROGRESS')} className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold cursor-pointer transition-colors">Resume</button>}
        <button onClick={onClose} className="px-3 py-1.5 rounded-lg border border-border-light text-[11px] font-medium text-text-muted hover:bg-surface-2/30 cursor-pointer transition-colors">Cancel</button>
      </div>
    </div>
  );
}
