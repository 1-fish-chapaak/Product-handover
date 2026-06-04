// ─── Internal Audit — Requests / IDR Tab ──────────────────────────────────
// Track initial data and document requests for audit analysis.

import DatePicker from '../../../shared/DatePicker';
import React, { useState } from 'react';
import {
  Plus, Search, ChevronDown, ChevronRight, CheckCircle2, AlertCircle, AlertTriangle,
  Clock, Send, X, Info, FileText,
} from 'lucide-react';
import type { ConfigurableEngagement, InternalAuditConfig } from '../../configurableEngagementTypes';
import {
  deriveIARequestSummary, REQUEST_TYPE_LABELS, REQUEST_TYPES_LIST, PRIORITIES_LIST, SCOPE_TYPE_LABELS,
  MOCK_IA_REQUESTS,
  type IARequest, type IARequestStatus, type IARequestType, type IAPriority, type IALinkedScopeType,
  type InternalAuditRequestState,
} from './internalAuditRequestsData';
import type { InternalAuditScopeState } from './internalAuditScopeData';

const STATUS_CLS: Record<IARequestStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-600', SENT: 'bg-blue-50 text-blue-700', PENDING: 'bg-amber-50 text-amber-700',
  PARTIALLY_RECEIVED: 'bg-purple-50 text-purple-700', RECEIVED: 'bg-emerald-50 text-emerald-700',
  OVERDUE: 'bg-red-50 text-red-700', CANCELLED: 'bg-gray-50 text-gray-400',
};
const PRIORITY_CLS: Record<IAPriority, string> = { LOW: 'bg-gray-100 text-gray-500', MEDIUM: 'bg-blue-50 text-blue-600', HIGH: 'bg-amber-50 text-amber-700', CRITICAL: 'bg-red-50 text-red-700' };
type StatusFilter = 'All' | IARequestStatus;

const inputCls = 'w-full px-3 py-2 border border-border rounded-lg text-[0.75rem] text-text bg-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all';
const selectCls = inputCls + ' cursor-pointer appearance-none';
const labelCls = 'text-[0.6875rem] font-semibold text-text-muted block mb-1';

interface Props {
  engagement: ConfigurableEngagement;
  scope: InternalAuditScopeState;
  requestState: InternalAuditRequestState;
  onUpdateRequestState: (state: InternalAuditRequestState) => void;
  onNavigateTab?: (tabId: string) => void;
}

export default function InternalAuditRequestsIDRTab({ engagement, scope, requestState, onUpdateRequestState, onNavigateTab }: Props) {
  const cfg = engagement.config as InternalAuditConfig;
  const { requests, proceedWithoutIDR } = requestState;
  const summary = deriveIARequestSummary(requests);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [typeFilter, setTypeFilter] = useState('All Types');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const q = search.toLowerCase();
  const filtered = requests.filter(r => {
    if (statusFilter !== 'All' && r.status !== statusFilter) return false;
    if (typeFilter !== 'All Types' && REQUEST_TYPE_LABELS[r.requestType] !== typeFilter) return false;
    if (q && !r.title.toLowerCase().includes(q) && !r.id.toLowerCase().includes(q) && !r.linkedScopeLabel.toLowerCase().includes(q) && !r.requestedFrom.toLowerCase().includes(q)) return false;
    return true;
  });

  const updateStatus = (id: string, newStatus: IARequestStatus) => {
    onUpdateRequestState({
      ...requestState,
      requests: requests.map(r => r.id === id ? { ...r, status: newStatus, updatedAt: new Date().toISOString().slice(0, 10) } : r),
    });
  };

  const addRequest = (req: IARequest) => {
    onUpdateRequestState({ ...requestState, requests: [req, ...requests] });
    setShowCreateForm(false);
  };

  const addFile = (id: string, fileName: string) => {
    onUpdateRequestState({
      ...requestState,
      requests: requests.map(r => {
        if (r.id !== id) return r;
        const files = [...r.filesReceived, fileName];
        const newStatus: IARequestStatus = r.status === 'PENDING' || r.status === 'SENT' ? 'PARTIALLY_RECEIVED' : r.status;
        return { ...r, filesReceived: files, status: newStatus, updatedAt: new Date().toISOString().slice(0, 10) };
      }),
    });
  };

  const hasReceived = requests.some(r => r.status === 'RECEIVED' || r.status === 'PARTIALLY_RECEIVED');
  const canProceed = hasReceived || proceedWithoutIDR;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[0.9375rem] font-bold text-text mb-0.5">Requests / IDR</h3>
          <p className="text-[0.75rem] text-text-muted">Track initial data and document requests needed for internal audit analysis.</p>
        </div>
        <button onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.6875rem] font-semibold cursor-pointer transition-colors shrink-0">
          <Plus size={12} />Create IDR Request
        </button>
      </div>

      {/* Info */}
      <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-blue-50/50 border border-blue-200/50 text-[0.625rem] text-blue-600">
        <Info size={12} className="shrink-0 mt-0.5" />
        <span>Received IDR files will be available later in the Analysis workspace for workflow runs, Q&A, document review, and observation discovery.</span>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-6 gap-2">
        {[
          { label: 'Total', value: summary.total },
          { label: 'Draft', value: summary.draft },
          { label: 'Pending', value: summary.pending, cls: summary.pending > 0 ? 'text-amber-600' : '' },
          { label: 'Partial', value: summary.partial, cls: summary.partial > 0 ? 'text-purple-600' : '' },
          { label: 'Received', value: summary.received, cls: 'text-emerald-600' },
          { label: 'Overdue', value: summary.overdue, cls: summary.overdue > 0 ? 'text-red-600' : '' },
        ].map(s => (
          <div key={s.label} className="rounded-lg border border-border-light p-2.5 text-center">
            <div className={`text-[1rem] font-bold tabular-nums ${s.cls || 'text-text'}`}>{s.value}</div>
            <div className="text-[0.5625rem] text-gray-400 font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-[220px]">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search IDR requests, scope, owner..."
            className="w-full pl-7 pr-3 py-1.5 border border-border rounded-lg text-[0.6875rem] text-text bg-white outline-none focus:border-primary/40" />
        </div>
        <div className="flex items-center gap-1">
          {(['All', 'DRAFT', 'PENDING', 'PARTIALLY_RECEIVED', 'RECEIVED', 'OVERDUE'] as StatusFilter[]).map(f => (
            <button key={f} onClick={() => setStatusFilter(f)}
              className={`px-2 py-1 rounded-full text-[0.5625rem] font-semibold cursor-pointer transition-colors ${statusFilter === f ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
              {f === 'All' ? 'All' : f === 'PARTIALLY_RECEIVED' ? 'Partial' : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="px-2 py-1 border border-border rounded-lg text-[0.625rem] text-text bg-white cursor-pointer outline-none">
          <option>All Types</option>
          {['SOP / Policy', 'Transaction Data', 'Master Data', 'Approval Matrix', 'Exception Log', 'System Extract', 'Other'].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Create form */}
      {showCreateForm && <CreateIDRForm onSave={addRequest} onCancel={() => setShowCreateForm(false)} />}

      {/* Request table */}
      <div className="rounded-lg border border-border-light overflow-hidden">
        <table className="w-full text-[0.6875rem]">
          <thead>
            <tr className="border-b border-border-light bg-surface-2/30 text-[0.5625rem] font-semibold text-gray-400 uppercase">
              <th className="px-3 py-2 text-left w-5"></th>
              <th className="px-3 py-2 text-left">Request</th>
              <th className="px-3 py-2 text-left">Linked Scope</th>
              <th className="px-3 py-2 text-left">From</th>
              <th className="px-3 py-2 text-center">Due</th>
              <th className="px-3 py-2 text-center">Status</th>
              <th className="px-3 py-2 text-center">Files</th>
              <th className="px-3 py-2 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-[0.6875rem] text-gray-400">No IDR requests match the current filter.</td></tr>
            ) : filtered.map(req => {
              const isExpanded = expandedId === req.id;
              return (
                <React.Fragment key={req.id}>
                  <tr className={`border-b border-border-light/50 cursor-pointer hover:bg-surface-2/20 transition-colors ${isExpanded ? 'bg-surface-2/20' : ''}`}
                    onClick={() => setExpandedId(isExpanded ? null : req.id)}>
                    <td className="px-3 py-2.5 text-gray-400">{isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="font-mono text-gray-400 text-[0.625rem]">{req.id}</span>
                        <span className="font-medium text-text">{req.title}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[0.5rem] font-bold">{REQUEST_TYPE_LABELS[req.requestType]}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[0.5rem] font-bold ${PRIORITY_CLS[req.priority]}`}>{req.priority}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="text-[0.625rem] text-gray-500">{SCOPE_TYPE_LABELS[req.linkedScopeType]}</div>
                      <div className="text-[0.625rem] text-text font-medium">{req.linkedScopeLabel}</div>
                    </td>
                    <td className="px-3 py-2.5 text-text">{req.requestedFrom}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`text-[0.625rem] font-mono ${req.status === 'OVERDUE' ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>{req.dueDate}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[0.5rem] font-bold ${STATUS_CLS[req.status]}`}>{req.status === 'PARTIALLY_RECEIVED' ? 'Partial' : req.status.replace(/_/g, ' ')}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center text-[0.625rem] text-gray-500">
                      {req.progressText || (req.filesReceived.length > 0 ? `${req.filesReceived.length} file${req.filesReceived.length !== 1 ? 's' : ''}` : '—')}
                    </td>
                    <td className="px-3 py-2.5 text-center" onClick={e => e.stopPropagation()}>
                      <RequestAction req={req} onUpdateStatus={updateStatus} />
                    </td>
                  </tr>
                  {isExpanded && <tr><td colSpan={8} className="p-0"><RequestDetail req={req} onAddFile={addFile} /></td></tr>}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Proceed / CTA */}
      <div className="rounded-lg border border-border-light p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-[0.6875rem] font-bold text-text">Next Step</h4>
          {!cfg.idrEnabled && <span className="text-[0.5625rem] text-gray-400">IDR is disabled for this assignment</span>}
        </div>
        {!canProceed && (
          <div className="flex items-center gap-3">
            <span className="text-[0.625rem] text-gray-500">Receive at least one IDR item or proceed without IDR.</span>
            <button onClick={() => onUpdateRequestState({ ...requestState, proceedWithoutIDR: true })}
              className="text-[0.625rem] font-semibold text-primary hover:underline cursor-pointer">Proceed without IDR</button>
          </div>
        )}
        <button onClick={() => {
          const showRacm = scope.sopIds.length > 0 || scope.racmVersionIds.length > 0;
          const showControls = showRacm || scope.checklistIds.length > 0;
          onNavigateTab?.(showRacm ? 'ia-racm' : showControls ? 'ia-controls' : 'analysis');
        }} disabled={!canProceed}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.6875rem] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          {(() => {
            const showRacm = scope.sopIds.length > 0 || scope.racmVersionIds.length > 0;
            const showControls = showRacm || scope.checklistIds.length > 0;
            return showRacm ? 'Continue to RACM' : showControls ? 'Continue to Controls' : 'Continue to Analysis';
          })()}
          <ChevronRight size={11} />
        </button>
      </div>
    </div>
  );
}

// ─── Request Action Button ────────────────────────────────────────────────

function RequestAction({ req, onUpdateStatus }: { req: IARequest; onUpdateStatus: (id: string, s: IARequestStatus) => void }) {
  if (req.status === 'DRAFT') return <button onClick={() => onUpdateStatus(req.id, 'SENT')} className="flex items-center gap-1 px-2 py-1 rounded text-[0.5625rem] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 cursor-pointer transition-colors"><Send size={9} />Send</button>;
  if (req.status === 'SENT' || req.status === 'PENDING') return <button onClick={() => onUpdateStatus(req.id, 'RECEIVED')} className="flex items-center gap-1 px-2 py-1 rounded text-[0.5625rem] font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 cursor-pointer transition-colors"><CheckCircle2 size={9} />Received</button>;
  if (req.status === 'PARTIALLY_RECEIVED') return <button onClick={() => onUpdateStatus(req.id, 'RECEIVED')} className="flex items-center gap-1 px-2 py-1 rounded text-[0.5625rem] font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 cursor-pointer transition-colors"><CheckCircle2 size={9} />Complete</button>;
  if (req.status === 'OVERDUE') return <button className="flex items-center gap-1 px-2 py-1 rounded text-[0.5625rem] font-semibold text-amber-600 bg-amber-50 hover:bg-amber-100 cursor-pointer transition-colors"><Clock size={9} />Remind</button>;
  if (req.status === 'RECEIVED') return <span className="text-[0.5625rem] text-emerald-600 font-medium">Complete</span>;
  return null;
}

// ─── Request Detail ───────────────────────────────────────────────────────

function RequestDetail({ req, onAddFile }: { req: IARequest; onAddFile: (id: string, fileName: string) => void }) {
  const [newFile, setNewFile] = useState('');
  return (
    <div className="bg-surface-2/15 border-b border-border-light px-6 py-4 space-y-3">
      <div><h6 className="text-[0.5625rem] font-bold text-gray-400 uppercase tracking-wider mb-1">Description</h6><p className="text-[0.6875rem] text-text leading-relaxed">{req.description}</p></div>
      <div className="grid grid-cols-3 gap-4 text-[0.625rem]">
        <div><span className="text-gray-400 block text-[0.5625rem]">Linked Scope</span><span className="text-text font-medium">{SCOPE_TYPE_LABELS[req.linkedScopeType]} — {req.linkedScopeLabel}</span></div>
        <div><span className="text-gray-400 block text-[0.5625rem]">Requested From</span><span className="text-text font-medium">{req.requestedFrom}</span></div>
        <div><span className="text-gray-400 block text-[0.5625rem]">Due Date</span><span className={`font-medium ${req.status === 'OVERDUE' ? 'text-red-600' : 'text-text'}`}>{req.dueDate}</span></div>
      </div>
      {req.status === 'OVERDUE' && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-[0.625rem] text-red-700">
          <AlertTriangle size={12} className="shrink-0 mt-0.5" /><span>This IDR item is overdue and may delay audit analysis.</span>
        </div>
      )}
      {req.filesReceived.length > 0 && (
        <div>
          <h6 className="text-[0.5625rem] font-bold text-gray-400 uppercase tracking-wider mb-1">Files Received</h6>
          <div className="flex flex-wrap gap-1.5">
            {req.filesReceived.map(f => (
              <span key={f} className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[0.5625rem] text-emerald-700"><FileText size={9} />{f}</span>
            ))}
          </div>
        </div>
      )}
      {/* Add file */}
      {req.status !== 'RECEIVED' && req.status !== 'CANCELLED' && (
        <div className="flex items-center gap-2">
          <input value={newFile} onChange={e => setNewFile(e.target.value)} placeholder="Add received file name..." className="flex-1 px-3 py-1.5 border border-border rounded-lg text-[0.6875rem] text-text bg-white outline-none focus:border-primary/40" />
          <button onClick={() => { if (newFile.trim()) { onAddFile(req.id, newFile.trim()); setNewFile(''); } }} disabled={!newFile.trim()}
            className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[0.625rem] font-semibold hover:bg-primary/20 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Add File</button>
        </div>
      )}
      {req.comments.length > 0 && (
        <div>
          <h6 className="text-[0.5625rem] font-bold text-gray-400 uppercase tracking-wider mb-1">Comments</h6>
          <div className="space-y-1">{req.comments.map((c, i) => <div key={i} className="text-[0.625rem] text-gray-500 pl-2 border-l-2 border-gray-200">{c}</div>)}</div>
        </div>
      )}
    </div>
  );
}

// ─── Create IDR Form ──────────────────────────────────────────────────────

function CreateIDRForm({ onSave, onCancel }: { onSave: (r: IARequest) => void; onCancel: () => void }) {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [requestType, setRequestType] = useState<IARequestType>('TRANSACTION_DATA');
  const [scopeType, setScopeType] = useState<IALinkedScopeType>('PROCESS');
  const [scopeLabel, setScopeLabel] = useState('');
  const [requestedFrom, setRequestedFrom] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<IAPriority>('MEDIUM');

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({
      id: `REQ-IA-${String(Date.now()).slice(-3)}`, title: title.trim(), description: desc.trim(),
      requestType, linkedScopeType: scopeType, linkedScopeLabel: scopeLabel.trim() || 'General',
      requestedFrom: requestedFrom.trim() || 'Unassigned', dueDate: dueDate || '—',
      status: 'DRAFT', priority, filesReceived: [], comments: [],
      createdAt: new Date().toISOString().slice(0, 10), updatedAt: new Date().toISOString().slice(0, 10),
    });
  };

  return (
    <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center justify-between"><h4 className="text-[0.8125rem] font-bold text-text">Create IDR Request</h4><button onClick={onCancel} className="p-1 rounded text-gray-400 hover:text-text cursor-pointer"><X size={14} /></button></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><label className={labelCls}>Title <span className="text-red-400">*</span></label><input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Provide invoice register" className={inputCls} /></div>
        <div className="col-span-2"><label className={labelCls}>Description</label><textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} placeholder="Describe what is needed..." className={inputCls + ' resize-none'} /></div>
        <div><label className={labelCls}>Request Type</label><select value={requestType} onChange={e => setRequestType(e.target.value as IARequestType)} className={selectCls}>{REQUEST_TYPES_LIST.map(t => <option key={t} value={t}>{REQUEST_TYPE_LABELS[t]}</option>)}</select></div>
        <div><label className={labelCls}>Priority</label><select value={priority} onChange={e => setPriority(e.target.value as IAPriority)} className={selectCls}>{PRIORITIES_LIST.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
        <div><label className={labelCls}>Linked Scope Type</label><select value={scopeType} onChange={e => setScopeType(e.target.value as IALinkedScopeType)} className={selectCls}>{Object.entries(SCOPE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div><label className={labelCls}>Scope Label</label><input value={scopeLabel} onChange={e => setScopeLabel(e.target.value)} placeholder="e.g. Invoice Processing" className={inputCls} /></div>
        <div><label className={labelCls}>Requested From</label><input value={requestedFrom} onChange={e => setRequestedFrom(e.target.value)} placeholder="e.g. AP Manager" className={inputCls} /></div>
        <div><label className={labelCls}>Due Date</label><DatePicker value={dueDate} onChange={e => setDueDate(e.target.value)} className={inputCls} /></div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg border border-border-light text-[0.6875rem] font-medium text-text-muted hover:bg-surface-2/30 cursor-pointer transition-colors">Cancel</button>
        <button onClick={handleSave} disabled={!title.trim()} className="px-4 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.6875rem] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Create Request</button>
      </div>
    </div>
  );
}
