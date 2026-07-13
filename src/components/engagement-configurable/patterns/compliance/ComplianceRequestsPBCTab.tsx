// ─── Compliance Control Testing — Requests / PBC Tab ──────────────────────
// Dual-persona: the auditor creates, sends, and reminds; a signed-in risk
// owner (roleId 'role-risk') sees their requests and uploads evidence /
// marks them provided. All transitions persist in the lifted complianceState.

import DatePicker from '../../../shared/DatePicker';
import React, { useState, useEffect } from 'react';
import {
  Plus, ChevronDown, ChevronRight, Clock, CheckCircle2,
  AlertTriangle, Send, FileText, Info, Search, X, Upload, UserCheck, Bell,
} from 'lucide-react';
import type { ConfigurableEngagement } from '../../configurableEngagementTypes';
import { useCurrentUser } from '../../../../context/CurrentUserContext';
import {
  derivePBCSummary, REQUEST_TYPES, PRIORITIES,
  type PBCRequest, type PBCRequestStatus, type PBCRequestType, type PBCPriority,
} from './complianceRequestsData';
import { useAuditLog } from '../../../../context/AdminDataContext';

const STATUS_CLS: Record<PBCRequestStatus, string> = {
  Draft: 'bg-canvas text-ink-600',
  Sent: 'bg-blue-50 text-blue-700',
  Pending: 'bg-amber-50 text-amber-700',
  'Partially Received': 'bg-purple-50 text-purple-700',
  Received: 'bg-emerald-50 text-emerald-700',
  Overdue: 'bg-red-50 text-red-700',
  Cancelled: 'bg-canvas text-ink-400',
};
const PRIORITY_CLS: Record<PBCPriority, string> = {
  Low: 'bg-canvas text-ink-500',
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
  onUpdateRequest: (id: string, patch: Partial<PBCRequest>) => void;
}

const nowStamp = () => new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const today = () => new Date().toISOString().slice(0, 10);

export default function ComplianceRequestsPBCTab({ engagement, requests, onCreateRequest, onUpdateRequest }: Props) {
  const logEvent = useAuditLog();
  const { currentUser } = useCurrentUser();
  const isRiskOwner = currentUser?.roleId === 'role-risk';

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [typeFilter, setTypeFilter] = useState<string>('All Types');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const summary = derivePBCSummary(requests);

  const q = search.toLowerCase();
  const filtered = requests.filter(r => {
    if (isRiskOwner && r.status === 'Draft') return false; // drafts aren't visible to the risk owner yet
    if (statusFilter !== 'All' && r.status !== statusFilter) return false;
    if (typeFilter !== 'All Types' && r.requestType !== typeFilter) return false;
    if (q && !r.title.toLowerCase().includes(q) && !r.id.toLowerCase().includes(q) && !r.linkedControlName.toLowerCase().includes(q) && !r.requestedFrom.toLowerCase().includes(q)) return false;
    return true;
  });

  const addRequest = (req: PBCRequest) => {
    onCreateRequest(req);
    setShowCreateForm(false);
    setToast(`Request ${req.id} created as Draft`);
    logEvent({ action: 'Create', description: `Created PBC request "${req.title}" for ${req.requestedFrom}`, module: 'Engagements', entity: 'PBC Request' });
  };

  const handleRemind = (req: PBCRequest) => {
    const stamp = nowStamp();
    onUpdateRequest(req.id, {
      lastReminded: stamp,
      comments: [...req.comments, `Reminder sent to ${req.requestedFrom} on ${stamp}.`],
    });
    setToast(`Reminder sent to ${req.requestedFrom}`);
  };

  const handleProvide = (req: PBCRequest) => {
    const providerName = currentUser?.name || 'Risk Owner';
    const mockFile = `${req.id.toLowerCase()}_evidence_pack.zip`;
    onUpdateRequest(req.id, {
      status: 'Received',
      receivedAt: today(),
      providedBy: providerName,
      filesReceived: [...req.filesReceived, mockFile],
      progressText: undefined,
      comments: [...req.comments, `Evidence uploaded by ${providerName} on ${nowStamp()}.`],
    });
    setToast(`Marked provided — ${mockFile} attached`);
    logEvent({ action: 'Upload', description: `Provided evidence for PBC request "${req.title}" (${mockFile})`, module: 'Engagements', entity: 'PBC Request' });
  };

  return (
    <div className="space-y-4 relative">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[0.9375rem] font-bold text-text mb-0.5">
            {isRiskOwner ? 'Your Evidence Requests' : 'PBC / Evidence Requests'}
          </h3>
          <p className="text-[0.75rem] text-text-muted">
            {isRiskOwner
              ? 'Requests from the audit team assigned to you. Upload evidence to fulfil each request.'
              : 'Track sample, data, and evidence requests needed for compliance testing.'}
          </p>
        </div>
        {!isRiskOwner && (
          <button onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.75rem] font-semibold cursor-pointer transition-colors shrink-0">
            <Plus size={13} />Create PBC Request
          </button>
        )}
      </div>

      {/* Persona banner */}
      {isRiskOwner ? (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/15 text-[0.75rem] text-primary">
          <UserCheck size={13} className="shrink-0 mt-0.5" />
          <span>Signed in as <span className="font-semibold">{currentUser?.name}</span> (Risk Owner). Use "Upload Evidence" to fulfil a request — the audit team is notified automatically.</span>
        </div>
      ) : (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-blue-50/50 border border-blue-200/50 text-[0.75rem] text-blue-600">
          <Info size={13} className="shrink-0 mt-0.5" />
          <span>Requests collect sample files, source data, and evidence before testing. The risk owner fulfils requests from their side; received files flow into Samples & Evidence.</span>
        </div>
      )}

      {/* Summary cards — 5 tiles */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Total', value: summary.total },
          { label: 'Awaiting', value: summary.pending + summary.partial, cls: summary.pending + summary.partial > 0 ? 'text-amber-600' : '' },
          { label: 'Received', value: summary.received, cls: 'text-emerald-600' },
          { label: 'Overdue', value: summary.overdue, cls: summary.overdue > 0 ? 'text-red-600' : '' },
          { label: 'Draft', value: summary.draft },
        ].map(s => (
          <div key={s.label} className="rounded-lg border border-border-light p-3 text-center">
            <div className={`text-[1.0625rem] font-bold tabular-nums ${s.cls || 'text-text'}`}>{s.value}</div>
            <div className="text-[0.6875rem] text-text-muted font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-[240px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search requests, controls, owner..."
            className="w-full pl-7 pr-3 py-1.5 border border-border rounded-lg text-[0.75rem] text-text bg-white outline-none focus:border-primary/40" />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {(['All', 'Draft', 'Pending', 'Partially Received', 'Received', 'Overdue'] as StatusFilter[])
            .filter(f => !(isRiskOwner && f === 'Draft'))
            .map(f => (
              <button key={f} onClick={() => setStatusFilter(f)}
                className={`px-2.5 py-1 rounded-full text-[0.6875rem] font-semibold cursor-pointer transition-colors ${statusFilter === f ? 'bg-primary text-white' : 'bg-canvas text-ink-500 hover:bg-canvas-border'}`}>
                {f}
              </button>
            ))}
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="px-2 py-1.5 border border-border rounded-lg text-[0.6875rem] text-text bg-white cursor-pointer outline-none">
          <option>All Types</option>
          {REQUEST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Create form (auditor only) */}
      {!isRiskOwner && showCreateForm && (
        <CreateRequestForm
          onSave={addRequest}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      {/* Request table */}
      <div className="rounded-lg border border-border-light overflow-hidden">
        <table className="w-full text-[0.75rem]">
          <thead>
            <tr className="border-b border-border-light bg-surface-2/30 text-[0.6875rem] font-semibold text-text-muted uppercase">
              <th className="px-3 py-2 text-left w-5"></th>
              <th className="px-3 py-2 text-left">Request</th>
              <th className="px-3 py-2 text-left">Linked To</th>
              <th className="px-3 py-2 text-left">{isRiskOwner ? 'Requested By' : 'Requested From'}</th>
              <th className="px-3 py-2 text-center">Due</th>
              <th className="px-3 py-2 text-center">Status</th>
              <th className="px-3 py-2 text-center">Files</th>
              <th className="px-3 py-2 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-[0.75rem] text-ink-400">No requests match the current filter.</td></tr>
            ) : filtered.map(req => {
              const isExpanded = expandedId === req.id;
              const isOverdue = req.status === 'Overdue';
              return (
                <React.Fragment key={req.id}>
                  <tr className={`border-b border-border-light/50 cursor-pointer hover:bg-surface-2/20 transition-colors ${isExpanded ? 'bg-surface-2/20' : ''}`}
                    onClick={() => setExpandedId(isExpanded ? null : req.id)}>
                    <td className="px-3 py-2.5 text-ink-400">
                      {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="font-mono text-text-muted text-[0.6875rem]">{req.id}</span>
                        <span className="font-medium text-text">{req.title}</span>
                      </div>
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className={`px-1.5 py-0.5 rounded text-[0.6875rem] font-bold ${TYPE_CLS}`}>{req.requestType}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[0.6875rem] font-bold ${PRIORITY_CLS[req.priority]}`}>{req.priority}</span>
                        {req.lastReminded && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[0.6875rem] font-semibold">
                            <Bell size={9} />Reminded {req.lastReminded}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="text-[0.75rem] text-text font-medium">{req.linkedControlId} — {req.linkedControlName}</div>
                      <div className="text-[0.6875rem] text-text-muted">{req.linkedAttributes}</div>
                    </td>
                    <td className="px-3 py-2.5 text-text">{isRiskOwner ? engagement.owner : req.requestedFrom}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`text-[0.6875rem] font-mono ${isOverdue ? 'text-red-600 font-semibold' : 'text-ink-500'}`}>{req.dueDate}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[0.6875rem] font-bold whitespace-nowrap ${STATUS_CLS[req.status]}`}>{req.status}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center text-[0.6875rem] text-ink-500">
                      {req.progressText || (req.filesReceived.length > 0 ? `${req.filesReceived.length} file${req.filesReceived.length !== 1 ? 's' : ''}` : '—')}
                    </td>
                    <td className="px-3 py-2.5 text-center" onClick={e => e.stopPropagation()}>
                      {isRiskOwner
                        ? <RiskOwnerActions req={req} onProvide={handleProvide} />
                        : <AuditorActions req={req} onUpdateRequest={onUpdateRequest} onRemind={handleRemind} />}
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

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-ink-900 text-white text-[0.75rem] font-medium shadow-lg">
          <CheckCircle2 size={14} className="text-emerald-400" />{toast}
        </div>
      )}
    </div>
  );
}

// ─── Auditor Actions ──────────────────────────────────────────────────────

function AuditorActions({ req, onUpdateRequest, onRemind }: {
  req: PBCRequest;
  onUpdateRequest: (id: string, patch: Partial<PBCRequest>) => void;
  onRemind: (req: PBCRequest) => void;
}) {
  const logEvent = useAuditLog();
  if (req.status === 'Draft') {
    return (
      <button onClick={() => { onUpdateRequest(req.id, { status: 'Sent', sentAt: new Date().toISOString().slice(0, 10) }); logEvent({ action: 'Update', description: `Sent PBC request "${req.title}" to ${req.requestedFrom}`, module: 'Engagements', entity: 'PBC Request' }); }}
        className="inline-flex items-center gap-1 px-2 py-1 rounded text-[0.6875rem] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 cursor-pointer transition-colors">
        <Send size={10} />Mark Sent
      </button>
    );
  }
  if (req.status === 'Received') {
    return <span className="text-[0.6875rem] text-emerald-600 font-medium">Complete</span>;
  }
  // Sent / Pending / Partially Received / Overdue → the risk owner fulfils; auditor can remind
  return (
    <button onClick={() => onRemind(req)}
      className="inline-flex items-center gap-1 px-2 py-1 rounded text-[0.6875rem] font-semibold text-amber-600 bg-amber-50 hover:bg-amber-100 cursor-pointer transition-colors">
      <Clock size={10} />Remind
    </button>
  );
}

// ─── Risk Owner Actions ───────────────────────────────────────────────────

function RiskOwnerActions({ req, onProvide }: { req: PBCRequest; onProvide: (req: PBCRequest) => void }) {
  if (req.status === 'Received') {
    return <span className="text-[0.6875rem] text-emerald-600 font-medium">Provided{req.providedBy ? ` by ${req.providedBy}` : ''}</span>;
  }
  return (
    <button onClick={() => onProvide(req)}
      className="inline-flex items-center gap-1 px-2 py-1 rounded text-[0.6875rem] font-semibold text-white bg-primary hover:bg-primary/90 cursor-pointer transition-colors whitespace-nowrap">
      <Upload size={10} />{req.status === 'Partially Received' ? 'Upload Remaining' : 'Upload Evidence'}
    </button>
  );
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
        <h6 className="text-[0.6875rem] font-bold text-text-muted uppercase tracking-wider mb-1">Description</h6>
        <p className="text-[0.75rem] text-text leading-relaxed">{req.description}</p>
      </div>

      <div className="grid grid-cols-3 gap-4 text-[0.75rem]">
        <div><span className="text-text-muted block text-[0.6875rem]">Linked Control</span><span className="text-text font-medium">{req.linkedControlId} — {req.linkedControlName}</span></div>
        <div><span className="text-text-muted block text-[0.6875rem]">Linked Attributes</span><span className="text-text font-medium">{req.linkedAttributes}</span></div>
        <div><span className="text-text-muted block text-[0.6875rem]">Requested From</span><span className="text-text font-medium">{req.requestedFrom}</span></div>
      </div>

      {/* Timeline */}
      <div>
        <h6 className="text-[0.6875rem] font-bold text-text-muted uppercase tracking-wider mb-1.5">Progress</h6>
        <div className="flex items-center gap-1">
          {stages.map((s, i) => (
            <React.Fragment key={s.label}>
              {i > 0 && <div className={`flex-1 h-px ${s.done ? 'bg-emerald-400' : 'bg-canvas-border'}`} />}
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.6875rem] font-semibold ${s.done ? 'bg-emerald-50 text-emerald-700' : 'bg-canvas text-ink-400'}`}>
                {s.done ? <CheckCircle2 size={9} /> : <Clock size={9} />}
                {s.label}
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Overdue warning */}
      {req.status === 'Overdue' && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-[0.75rem] text-red-700">
          <AlertTriangle size={13} className="shrink-0 mt-0.5" />
          <span>This request is overdue. Evidence collection may block testing.{req.lastReminded ? ` Last reminder: ${req.lastReminded}.` : ''}</span>
        </div>
      )}

      {/* Files received */}
      {req.filesReceived.length > 0 && (
        <div>
          <h6 className="text-[0.6875rem] font-bold text-text-muted uppercase tracking-wider mb-1">Files Received</h6>
          <div className="flex flex-wrap gap-1.5">
            {req.filesReceived.map(f => (
              <span key={f} className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[0.6875rem] text-emerald-700">
                <FileText size={10} />{f}
              </span>
            ))}
          </div>
          {req.providedBy && (
            <p className="text-[0.6875rem] text-text-muted mt-1">Provided by <span className="font-semibold text-text">{req.providedBy}</span>{req.receivedAt ? ` on ${req.receivedAt}` : ''}</p>
          )}
        </div>
      )}

      {/* Comments */}
      {req.comments.length > 0 && (
        <div>
          <h6 className="text-[0.6875rem] font-bold text-text-muted uppercase tracking-wider mb-1">Comments</h6>
          <div className="space-y-1">
            {req.comments.map((c, i) => (
              <div key={i} className="text-[0.75rem] text-ink-500 pl-2 border-l-2 border-canvas-border">{c}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Create Request Form ──────────────────────────────────────────────────

const inputCls = 'w-full px-3 py-2 border border-border rounded-lg text-[0.8125rem] text-text bg-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all';
const selectCls = inputCls + ' cursor-pointer appearance-none';
const labelCls = 'text-[0.75rem] font-semibold text-text-muted block mb-1';

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
        <h4 className="text-[0.8125rem] font-bold text-text">Create PBC Request</h4>
        <button onClick={onCancel} className="p-1 rounded text-ink-400 hover:text-text cursor-pointer"><X size={14} /></button>
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
          <DatePicker value={dueDate} onChange={e => setDueDate(e.target.value)} className={inputCls} />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg border border-border-light text-[0.75rem] font-medium text-text-muted hover:bg-surface-2/30 cursor-pointer transition-colors">Cancel</button>
        <button onClick={handleSave} disabled={!title.trim()}
          className="px-4 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.75rem] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          Create Request
        </button>
      </div>
    </div>
  );
}
