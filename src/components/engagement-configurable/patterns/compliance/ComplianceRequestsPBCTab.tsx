// ─── Compliance Control Testing — Requests / PBC Tab ──────────────────────
// Tracks sample, data, and evidence requests from process owners.
// Setup/governance only — no testing execution.

import React, { useState } from 'react';
import {
  Plus, ChevronDown, ChevronRight, Clock, CheckCircle2, AlertCircle,
  AlertTriangle, Send, FileText, Info, Search, X,
} from 'lucide-react';
import type { ConfigurableEngagement } from '../../configurableEngagementTypes';
import {
  derivePBCSummary, REQUEST_TYPES, PRIORITIES,
  type PBCRequest, type PBCRequestStatus, type PBCRequestType, type PBCPriority,
} from './complianceRequestsData';

const STATUS_CLS: Record<PBCRequestStatus, string> = {
  Draft: 'bg-gray-100 text-gray-600',
  Sent: 'bg-blue-50 text-blue-700',
  Pending: 'bg-amber-50 text-amber-700',
  'Partially Received': 'bg-purple-50 text-purple-700',
  Received: 'bg-emerald-50 text-emerald-700',
  Overdue: 'bg-red-50 text-red-700',
  Cancelled: 'bg-gray-50 text-gray-400',
};
const PRIORITY_CLS: Record<PBCPriority, string> = {
  Low: 'bg-gray-100 text-gray-500',
  Medium: 'bg-blue-50 text-blue-600',
  High: 'bg-amber-50 text-amber-700',
  Critical: 'bg-red-50 text-red-700',
};
const TYPE_CLS = 'bg-primary/10 text-primary';

type StatusFilter = 'All' | PBCRequestStatus;

interface Props {
  engagement: ConfigurableEngagement;
  requests: PBCRequest[];
  onCreateRequest: (req: PBCRequest) => void;
  onUpdateRequestStatus: (id: string, status: PBCRequestStatus) => void;
}

export default function ComplianceRequestsPBCTab({ engagement, requests, onCreateRequest, onUpdateRequestStatus }: Props) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [typeFilter, setTypeFilter] = useState<string>('All Types');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const summary = derivePBCSummary(requests);

  const q = search.toLowerCase();
  const filtered = requests.filter(r => {
    if (statusFilter !== 'All' && r.status !== statusFilter) return false;
    if (typeFilter !== 'All Types' && r.requestType !== typeFilter) return false;
    if (q && !r.title.toLowerCase().includes(q) && !r.id.toLowerCase().includes(q) && !r.linkedControlName.toLowerCase().includes(q) && !r.requestedFrom.toLowerCase().includes(q)) return false;
    return true;
  });

  const addRequest = (req: PBCRequest) => {
    onCreateRequest(req);
    setShowCreateForm(false);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[15px] font-bold text-text mb-0.5">PBC / Evidence Requests</h3>
          <p className="text-[12px] text-text-muted">Track sample, data, and evidence requests needed for compliance testing.</p>
        </div>
        <button onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[11px] font-semibold cursor-pointer transition-colors shrink-0">
          <Plus size={12} />Create PBC Request
        </button>
      </div>

      {/* Info box */}
      <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-blue-50/50 border border-blue-200/50 text-[10px] text-blue-600">
        <Info size={12} className="shrink-0 mt-0.5" />
        <span>Requests help collect sample files, source data, and evidence before testing. Received files will later be available in Samples & Evidence and Attribute Testing.</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-6 gap-3">
        {[
          { label: 'Total', value: summary.total },
          { label: 'Pending', value: summary.pending, cls: summary.pending > 0 ? 'text-amber-600' : '' },
          { label: 'Partial', value: summary.partial, cls: summary.partial > 0 ? 'text-purple-600' : '' },
          { label: 'Received', value: summary.received, cls: 'text-emerald-600' },
          { label: 'Overdue', value: summary.overdue, cls: summary.overdue > 0 ? 'text-red-600' : '' },
          { label: 'Draft', value: summary.draft },
        ].map(s => (
          <div key={s.label} className="rounded-lg border border-border-light p-2.5 text-center">
            <div className={`text-[16px] font-bold tabular-nums ${s.cls || 'text-text'}`}>{s.value}</div>
            <div className="text-[9px] text-gray-400 font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-[220px]">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search requests, controls, owner..."
            className="w-full pl-7 pr-3 py-1.5 border border-border rounded-lg text-[11px] text-text bg-white outline-none focus:border-primary/40" />
        </div>
        <div className="flex items-center gap-1">
          {(['All', 'Draft', 'Pending', 'Partially Received', 'Received', 'Overdue'] as StatusFilter[]).map(f => (
            <button key={f} onClick={() => setStatusFilter(f)}
              className={`px-2 py-1 rounded-full text-[9px] font-semibold cursor-pointer transition-colors ${statusFilter === f ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
              {f}
            </button>
          ))}
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="px-2 py-1 border border-border rounded-lg text-[10px] text-text bg-white cursor-pointer outline-none">
          <option>All Types</option>
          {REQUEST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <CreateRequestForm
          onSave={addRequest}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      {/* Request table */}
      <div className="rounded-lg border border-border-light overflow-hidden">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-border-light bg-surface-2/30 text-[9px] font-semibold text-gray-400 uppercase">
              <th className="px-3 py-2 text-left w-5"></th>
              <th className="px-3 py-2 text-left">Request</th>
              <th className="px-3 py-2 text-left">Linked To</th>
              <th className="px-3 py-2 text-left">Requested From</th>
              <th className="px-3 py-2 text-center">Due Date</th>
              <th className="px-3 py-2 text-center">Status</th>
              <th className="px-3 py-2 text-center">Files</th>
              <th className="px-3 py-2 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-[11px] text-gray-400">No requests match the current filter.</td></tr>
            ) : filtered.map(req => {
              const isExpanded = expandedId === req.id;
              const isOverdue = req.status === 'Overdue';
              return (
                <React.Fragment key={req.id}>
                  <tr className={`border-b border-border-light/50 cursor-pointer hover:bg-surface-2/20 transition-colors ${isExpanded ? 'bg-surface-2/20' : ''}`}
                    onClick={() => setExpandedId(isExpanded ? null : req.id)}>
                    <td className="px-3 py-2.5 text-gray-400">
                      {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="font-mono text-gray-400 text-[10px]">{req.id}</span>
                        <span className="font-medium text-text">{req.title}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${TYPE_CLS}`}>{req.requestType}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${PRIORITY_CLS[req.priority]}`}>{req.priority}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="text-[10px] text-text font-medium">{req.linkedControlId} — {req.linkedControlName}</div>
                      <div className="text-[9px] text-gray-400">{req.linkedAttributes}</div>
                    </td>
                    <td className="px-3 py-2.5 text-text">{req.requestedFrom}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`text-[10px] font-mono ${isOverdue ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>{req.dueDate}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold ${STATUS_CLS[req.status]}`}>{req.status}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center text-[10px] text-gray-500">
                      {req.progressText || (req.filesReceived.length > 0 ? `${req.filesReceived.length} file${req.filesReceived.length !== 1 ? 's' : ''}` : '—')}
                    </td>
                    <td className="px-3 py-2.5 text-center" onClick={e => e.stopPropagation()}>
                      <RequestActions req={req} onUpdateStatus={onUpdateRequestStatus} />
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr><td colSpan={8} className="p-0">
                      <RequestDetail req={req} />
                    </td></tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Request Actions ──────────────────────────────────────────────────────

function RequestActions({ req, onUpdateStatus }: { req: PBCRequest; onUpdateStatus: (id: string, s: PBCRequestStatus) => void }) {
  if (req.status === 'Draft') {
    return (
      <button onClick={() => onUpdateStatus(req.id, 'Sent')}
        className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 cursor-pointer transition-colors">
        <Send size={9} />Mark Sent
      </button>
    );
  }
  if (req.status === 'Sent' || req.status === 'Pending') {
    return (
      <button onClick={() => onUpdateStatus(req.id, 'Received')}
        className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 cursor-pointer transition-colors">
        <CheckCircle2 size={9} />Received
      </button>
    );
  }
  if (req.status === 'Partially Received') {
    return (
      <button onClick={() => onUpdateStatus(req.id, 'Received')}
        className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 cursor-pointer transition-colors">
        <CheckCircle2 size={9} />Complete
      </button>
    );
  }
  if (req.status === 'Overdue') {
    return (
      <button className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-semibold text-amber-600 bg-amber-50 hover:bg-amber-100 cursor-pointer transition-colors">
        <Clock size={9} />Remind
      </button>
    );
  }
  if (req.status === 'Received') {
    return <span className="text-[9px] text-emerald-600 font-medium">Complete</span>;
  }
  return null;
}

// ─── Request Expanded Detail ──────────────────────────────────────────────

function RequestDetail({ req }: { req: PBCRequest }) {
  const stages: { label: string; done: boolean }[] = [
    { label: 'Drafted', done: true },
    { label: 'Sent', done: !!req.sentAt || ['Pending', 'Partially Received', 'Received', 'Overdue'].includes(req.status) },
    { label: 'Pending', done: ['Partially Received', 'Received'].includes(req.status) },
    { label: 'Received', done: req.status === 'Received' },
  ];

  return (
    <div className="bg-surface-2/15 border-b border-border-light px-6 py-4 space-y-3">
      <div>
        <h6 className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Description</h6>
        <p className="text-[11px] text-text leading-relaxed">{req.description}</p>
      </div>

      <div className="grid grid-cols-3 gap-4 text-[10px]">
        <div><span className="text-gray-400 block text-[9px]">Linked Control</span><span className="text-text font-medium">{req.linkedControlId} — {req.linkedControlName}</span></div>
        <div><span className="text-gray-400 block text-[9px]">Linked Attributes</span><span className="text-text font-medium">{req.linkedAttributes}</span></div>
        <div><span className="text-gray-400 block text-[9px]">Requested From</span><span className="text-text font-medium">{req.requestedFrom}</span></div>
      </div>

      {/* Timeline */}
      <div>
        <h6 className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Progress</h6>
        <div className="flex items-center gap-1">
          {stages.map((s, i) => (
            <React.Fragment key={s.label}>
              {i > 0 && <div className={`flex-1 h-px ${s.done ? 'bg-emerald-400' : 'bg-gray-200'}`} />}
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-semibold ${s.done ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
                {s.done ? <CheckCircle2 size={8} /> : <Clock size={8} />}
                {s.label}
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Overdue warning */}
      {req.status === 'Overdue' && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-[10px] text-red-700">
          <AlertTriangle size={12} className="shrink-0 mt-0.5" />
          <span>This request is overdue. Evidence collection may block testing.</span>
        </div>
      )}

      {/* Files received */}
      {req.filesReceived.length > 0 && (
        <div>
          <h6 className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Files Received</h6>
          <div className="flex flex-wrap gap-1.5">
            {req.filesReceived.map(f => (
              <span key={f} className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[9px] text-emerald-700">
                <FileText size={9} />{f}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Comments */}
      {req.comments.length > 0 && (
        <div>
          <h6 className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Comments</h6>
          <div className="space-y-1">
            {req.comments.map((c, i) => (
              <div key={i} className="text-[10px] text-gray-500 pl-2 border-l-2 border-gray-200">{c}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Create Request Form ──────────────────────────────────────────────────

const inputCls = 'w-full px-3 py-2 border border-border rounded-lg text-[12px] text-text bg-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all';
const selectCls = inputCls + ' cursor-pointer appearance-none';
const labelCls = 'text-[11px] font-semibold text-text-muted block mb-1';

function CreateRequestForm({ onSave, onCancel }: { onSave: (r: PBCRequest) => void; onCancel: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [requestType, setRequestType] = useState<PBCRequestType>('Evidence Documents');
  const [controlId, setControlId] = useState('C001');
  const [attrs, setAttrs] = useState('All attributes');
  const [requestedFrom, setRequestedFrom] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<PBCPriority>('Medium');

  const controlOptions = [
    { id: 'C001', name: 'Three-way PO/GRN/Invoice Matching' },
    { id: 'C002', name: 'Duplicate Invoice Detection' },
    { id: 'C003', name: 'Vendor Master Change Review' },
    { id: 'C004', name: 'Manual Journal Entry Review' },
  ];
  const selectedControl = controlOptions.find(c => c.id === controlId);

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({
      id: `REQ-${String(Date.now()).slice(-3)}`,
      title: title.trim(),
      description: description.trim(),
      requestType,
      linkedControlId: controlId,
      linkedControlName: selectedControl?.name || controlId,
      linkedAttributes: attrs,
      requestedFrom: requestedFrom.trim() || 'Unassigned',
      dueDate: dueDate || '—',
      status: 'Draft',
      priority,
      filesReceived: [],
      comments: [],
      createdAt: new Date().toISOString().slice(0, 10),
    });
  };

  return (
    <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <h4 className="text-[13px] font-bold text-text">Create PBC Request</h4>
        <button onClick={onCancel} className="p-1 rounded text-gray-400 hover:text-text cursor-pointer"><X size={14} /></button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className={labelCls}>Title <span className="text-red-400">*</span></label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Provide invoice sample data" className={inputCls} />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Describe what is needed and why" className={inputCls + ' resize-none'} />
        </div>
        <div>
          <label className={labelCls}>Request Type</label>
          <select value={requestType} onChange={e => setRequestType(e.target.value as PBCRequestType)} className={selectCls}>
            {REQUEST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Priority</label>
          <select value={priority} onChange={e => setPriority(e.target.value as PBCPriority)} className={selectCls}>
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Linked Control</label>
          <select value={controlId} onChange={e => setControlId(e.target.value)} className={selectCls}>
            {controlOptions.map(c => <option key={c.id} value={c.id}>{c.id} — {c.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Linked Attributes</label>
          <input value={attrs} onChange={e => setAttrs(e.target.value)} placeholder="A, B, C or All attributes" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Requested From</label>
          <input value={requestedFrom} onChange={e => setRequestedFrom(e.target.value)} placeholder="e.g. AP Manager" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Due Date</label>
          <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={inputCls} />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg border border-border-light text-[11px] font-medium text-text-muted hover:bg-surface-2/30 cursor-pointer transition-colors">Cancel</button>
        <button onClick={handleSave} disabled={!title.trim()}
          className="px-4 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[11px] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          Create Request
        </button>
      </div>
    </div>
  );
}
