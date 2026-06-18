// ─── Internal Audit — Discussion Tab ──────────────────────────────────────
// Capture process owner responses and agreement on observations.

import DatePicker from '../../../shared/DatePicker';
import React, { useState, useEffect } from 'react';
import {
  Send, CheckCircle2, AlertCircle, XCircle, ChevronRight, X, Info, Plus, Clock, RotateCcw,
} from 'lucide-react';
import type { ConfigurableEngagement } from '../../configurableEngagementTypes';
import type { InternalAuditObservationsState } from './internalAuditObservationsData';
import { SEVERITY_CLS } from './internalAuditObservationsData';
import {
  initializeDiscussionItems, deriveDiscussionSummary, DISC_STATUS_CLS,
  type InternalAuditDiscussionState, type ObservationDiscussionItem, type DiscussionItemStatus, type DiscussionNote,
} from './internalAuditDiscussionData';

const inputCls = 'w-full px-3 py-2 border border-border rounded-lg text-[0.75rem] text-text bg-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all';
const labelCls = 'text-[0.6875rem] font-semibold text-text-muted block mb-1';

function now(): string { return new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }

interface Props {
  engagement: ConfigurableEngagement;
  observationsState: InternalAuditObservationsState;
  discussionState: InternalAuditDiscussionState;
  onUpdateDiscussion: (state: InternalAuditDiscussionState) => void;
  onNavigateTab?: (tabId: string) => void;
}

export default function InternalAuditDiscussionTab({ engagement, observationsState, discussionState, onUpdateDiscussion, onNavigateTab }: Props) {
  const [detailId, setDetailId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  // Initialize discussion items from ready observations
  // Dependency: IDs of ready observations (not just count, to catch status changes)
  const readyObsIds = observationsState.observations
    .filter(o => o.status === 'READY_FOR_DISCUSSION' || o.status === 'IN_DISCUSSION' || o.status === 'AGREED')
    .map(o => o.id).join(',');

  useEffect(() => {
    const readyObs = observationsState.observations.filter(o => o.status === 'READY_FOR_DISCUSSION' || o.status === 'IN_DISCUSSION' || o.status === 'AGREED');
    const initialized = initializeDiscussionItems(discussionState.items, readyObs);
    if (initialized.length !== discussionState.items.length) {
      onUpdateDiscussion({ ...discussionState, items: initialized });
    }
  }, [readyObsIds]);

  const summary = deriveDiscussionSummary(discussionState);
  const activeObs = observationsState.observations.filter(o => o.status !== 'DROPPED');
  const noObsConfirmed = observationsState.noObservationsConfirmed && activeObs.length === 0;
  const allReadyForReport = discussionState.items.length > 0 && discussionState.items.every(i => i.status === 'READY_FOR_REPORT');
  const canProceed = (allReadyForReport || discussionState.noObsDiscussionConfirmed || (noObsConfirmed && discussionState.items.length === 0));

  const updateItem = (id: string, updates: Partial<ObservationDiscussionItem>) => {
    onUpdateDiscussion({
      ...discussionState,
      items: discussionState.items.map(i => i.id === id ? { ...i, ...updates, lastUpdatedAt: new Date().toISOString().slice(0, 10) } : i),
    });
  };

  const transitionStatus = (id: string, status: DiscussionItemStatus, comments: string = '') => {
    const item = discussionState.items.find(i => i.id === id);
    if (!item) return;
    updateItem(id, {
      status,
      history: [...item.history, { id: `dh-${Date.now()}`, action: status.replace(/_/g, ' '), actor: engagement.owner, timestamp: now(), comments }],
    });
  };

  const addNote = () => {
    if (!noteText.trim()) return;
    onUpdateDiscussion({
      ...discussionState,
      notes: [...discussionState.notes, { id: `dn-${Date.now()}`, observationId: '', note: noteText.trim(), author: engagement.owner, createdAt: now() }],
    });
    setNoteText('');
  };

  // No observations path
  if (noObsConfirmed && discussionState.items.length === 0) {
    return (
      <div className="space-y-4">
        <div><h3 className="text-[0.9375rem] font-bold text-text mb-0.5">Discussion</h3><p className="text-[0.75rem] text-text-muted">Capture process owner responses and agreement on audit observations before final reporting.</p></div>
        <div className="rounded-xl border-2 border-emerald-200/50 bg-emerald-50/20 p-6 text-center space-y-3">
          <CheckCircle2 size={28} className="text-emerald-600 mx-auto" />
          <h4 className="text-[0.875rem] font-semibold text-emerald-800">No Observations Noted</h4>
          <p className="text-[0.75rem] text-emerald-600">No formal observations were noted for this assignment. Discussion can be closed.</p>
          {!discussionState.noObsDiscussionConfirmed ? (
            <button onClick={() => onUpdateDiscussion({ ...discussionState, noObsDiscussionConfirmed: true })}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[0.75rem] font-semibold cursor-pointer transition-colors inline-flex items-center gap-1.5">
              <CheckCircle2 size={13} />Confirm Discussion Closed
            </button>
          ) : (
            <div className="space-y-2">
              <span className="text-[0.6875rem] text-emerald-700 font-medium">Discussion confirmed closed.</span>
              <button onClick={() => onNavigateTab?.('working-paper')} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.6875rem] font-semibold cursor-pointer transition-colors mx-auto">Continue to Working Paper <ChevronRight size={11} /></button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // No ready observations
  if (discussionState.items.length === 0) {
    return (
      <div className="space-y-4">
        <div><h3 className="text-[0.9375rem] font-bold text-text mb-0.5">Discussion</h3><p className="text-[0.75rem] text-text-muted">Capture process owner responses and agreement on audit observations before final reporting.</p></div>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle size={24} className="text-gray-300 mb-3" />
          <p className="text-[0.75rem] text-text-muted mb-4">No observations are ready for discussion yet. Mark observations as "Ready for Discussion" first.</p>
          <button onClick={() => onNavigateTab?.('observations')} className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.75rem] font-semibold cursor-pointer transition-colors flex items-center gap-1">Go to Observations <ChevronRight size={12} /></button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div><h3 className="text-[0.9375rem] font-bold text-text mb-0.5">Discussion</h3><p className="text-[0.75rem] text-text-muted">Capture process owner responses and agreement on audit observations before final reporting.</p></div>

      {/* Summary */}
      <div className="grid grid-cols-7 gap-2">
        {[
          { label: 'Total', value: summary.total },
          { label: 'Not Started', value: summary.notStarted },
          { label: 'Sent', value: summary.sentToMgmt, cls: summary.sentToMgmt > 0 ? 'text-blue-600' : '' },
          { label: 'Response', value: summary.responseReceived, cls: summary.responseReceived > 0 ? 'text-purple-600' : '' },
          { label: 'Agreed', value: summary.agreed, cls: 'text-emerald-600' },
          { label: 'Disagreed', value: summary.disagreed, cls: summary.disagreed > 0 ? 'text-red-600' : '' },
          { label: 'Report Ready', value: summary.readyForReport, cls: summary.readyForReport > 0 ? 'text-primary' : '' },
        ].map(s => (
          <div key={s.label} className="rounded-lg border border-border-light p-2 text-center">
            <div className={`text-[0.9375rem] font-bold tabular-nums ${s.cls || 'text-text'}`}>{s.value}</div>
            <div className="text-[0.5rem] text-gray-400 font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Discussion table */}
      <div className="rounded-lg border border-border-light overflow-hidden">
        <div className="px-4 py-2 bg-surface-2/20 border-b border-border-light"><h4 className="text-[0.6875rem] font-bold text-text">Observation Discussions</h4></div>
        <table className="w-full text-[0.6875rem]">
          <thead><tr className="border-b border-border-light bg-surface-2/30 text-[0.5625rem] font-semibold text-gray-400 uppercase">
            <th className="px-3 py-1.5 text-left">Observation</th>
            <th className="px-3 py-1.5 text-center">Severity</th>
            <th className="px-3 py-1.5 text-center">Status</th>
            <th className="px-3 py-1.5 text-left">Response</th>
            <th className="px-3 py-1.5 text-left">Owner</th>
            <th className="px-3 py-1.5 text-center">Target</th>
            <th className="px-3 py-1.5 text-center">Action</th>
          </tr></thead>
          <tbody>
            {discussionState.items.map(item => (
              <tr key={item.id} className="border-b border-border-light/50">
                <td className="px-3 py-2">
                  <div className="font-medium text-text">{item.observationTitle}</div>
                  <div className="text-[0.5625rem] text-gray-400">{item.linkedScopeLabel}</div>
                </td>
                <td className="px-3 py-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[0.5rem] font-bold ${SEVERITY_CLS[item.observationSeverity as keyof typeof SEVERITY_CLS] || 'bg-gray-100 text-gray-600'}`}>{item.observationSeverity}</span></td>
                <td className="px-3 py-2 text-center"><span className={`px-2 py-0.5 rounded-full text-[0.5rem] font-bold ${DISC_STATUS_CLS[item.status]}`}>{item.status.replace(/_/g, ' ')}</span></td>
                <td className="px-3 py-2 text-[0.625rem] text-gray-500 truncate max-w-[150px]">{item.managementResponse || '—'}</td>
                <td className="px-3 py-2 text-gray-500">{item.actionOwner || '—'}</td>
                <td className="px-3 py-2 text-center text-[0.625rem] font-mono text-gray-500">{item.targetDate || '—'}</td>
                <td className="px-3 py-2 text-center">
                  <button onClick={() => setDetailId(item.id)} className="px-2 py-1 rounded text-[0.5625rem] font-semibold text-primary bg-primary/10 hover:bg-primary/20 cursor-pointer transition-colors">Discuss</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail panel */}
      {detailId && (() => {
        const item = discussionState.items.find(i => i.id === detailId);
        return item ? <DiscussionDetailPanel key={detailId} item={item} engagement={engagement} onUpdate={(u) => updateItem(item.id, u)} onTransition={(s, c) => transitionStatus(item.id, s, c)} onClose={() => setDetailId(null)} /> : null;
      })()}

      {/* General notes */}
      <div className="rounded-lg border border-border-light p-4 space-y-2">
        <h4 className="text-[0.6875rem] font-bold text-text">General Discussion Notes</h4>
        {discussionState.notes.length > 0 && (
          <div className="space-y-1 mb-2">
            {discussionState.notes.map(n => (
              <div key={n.id} className="text-[0.625rem] text-gray-500 pl-2 border-l-2 border-gray-200">
                <span className="text-text">{n.note}</span>
                <span className="text-gray-400 ml-2">— {n.author}, {n.createdAt}</span>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add discussion note..." className="flex-1 px-3 py-1.5 border border-border rounded-lg text-[0.6875rem] text-text bg-white outline-none focus:border-primary/40" />
          <button onClick={addNote} disabled={!noteText.trim()} className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[0.625rem] font-semibold hover:bg-primary/20 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Add Note</button>
        </div>
      </div>

      {/* Readiness */}
      <div className="rounded-lg border border-border-light p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-[0.6875rem] font-bold text-text">Working Paper Readiness</h4>
          <span className={`px-2 py-0.5 rounded-full text-[0.5625rem] font-bold ${canProceed ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{canProceed ? 'Ready' : 'Not Ready'}</span>
        </div>
        <div className="space-y-1">
          {[
            { label: 'All observations sent to process owner', ok: discussionState.items.every(i => i.status !== 'NOT_STARTED') },
            { label: 'Responses received', ok: discussionState.items.every(i => !['NOT_STARTED', 'SENT_TO_MANAGEMENT'].includes(i.status)) },
            { label: 'Agreement/disagreement captured', ok: discussionState.items.every(i => ['AGREED', 'DISAGREED', 'READY_FOR_REPORT'].includes(i.status)) },
            { label: 'All items marked ready for report', ok: allReadyForReport },
          ].map(c => (
            <div key={c.label} className="flex items-center gap-2 text-[0.625rem]">
              {c.ok ? <CheckCircle2 size={10} className="text-emerald-500" /> : <AlertCircle size={10} className="text-amber-400" />}
              <span className={c.ok ? 'text-gray-500' : 'text-text'}>{c.label}</span>
            </div>
          ))}
        </div>
        <button onClick={() => onNavigateTab?.('working-paper')} disabled={!canProceed}
          className="mt-2 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.6875rem] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          Continue to Working Paper <ChevronRight size={11} />
        </button>
      </div>
    </div>
  );
}

// ─── Discussion Detail Panel ──────────────────────────────────────────────

function DiscussionDetailPanel({ item, engagement, onUpdate, onTransition, onClose }: {
  item: ObservationDiscussionItem; engagement: ConfigurableEngagement;
  onUpdate: (u: Partial<ObservationDiscussionItem>) => void;
  onTransition: (s: DiscussionItemStatus, c?: string) => void;
  onClose: () => void;
}) {
  const [response, setResponse] = useState(item.managementResponse);
  const [rationale, setRationale] = useState(item.managementRationale);
  const [action, setAction] = useState(item.agreedAction);
  const [owner, setOwner] = useState(item.actionOwner);
  const [target, setTarget] = useState(item.targetDate);
  const [remediation, setRemediation] = useState(item.remediationRequired);

  const canAgree = response.trim().length > 0 && (!remediation || (action.trim().length > 0 && owner.trim().length > 0 && target.length > 0));
  const canDisagree = rationale.trim().length > 0;

  const handleSaveResponse = () => {
    onUpdate({ managementResponse: response, managementRationale: rationale, agreedAction: action, actionOwner: owner, targetDate: target, remediationRequired: remediation });
    if (item.status === 'SENT_TO_MANAGEMENT' && response.trim()) {
      onTransition('RESPONSE_RECEIVED', 'Process owner response received.');
    }
  };

  return (
    <div className="rounded-xl border-2 border-primary/20 bg-white p-4 space-y-3 shadow-lg">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-[0.8125rem] font-bold text-text">{item.observationTitle}</h4>
          <p className="text-[0.625rem] text-gray-400">{item.linkedScopeLabel} · {DISC_STATUS_CLS[item.status] ? item.status.replace(/_/g, ' ') : item.status}</p>
        </div>
        <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-text cursor-pointer"><X size={14} /></button>
      </div>

      {/* NOT_STARTED: show send CTA only, no response form */}
      {item.status === 'NOT_STARTED' && (
        <div className="flex items-center gap-2">
          <button onClick={() => onTransition('SENT_TO_MANAGEMENT', 'Observation sent to process owner for response.')} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[0.6875rem] font-semibold cursor-pointer transition-colors"><Send size={11} />Send Observation to Process Owner</button>
        </div>
      )}

      {/* SENT or later: show response form */}
      {item.status !== 'NOT_STARTED' && (
        <>
          <div>
            <label className={labelCls}>Process Owner Response</label>
            <textarea value={response} onChange={e => setResponse(e.target.value)} rows={3} placeholder="Enter process owner's response to this observation..." className={inputCls + ' resize-none'} />
          </div>
          <div>
            <label className={labelCls}>Process Owner Rationale (required for disagreement)</label>
            <textarea value={rationale} onChange={e => setRationale(e.target.value)} rows={2} placeholder="Process owner's rationale or counterpoint..." className={inputCls + ' resize-none'} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={labelCls}>Agreed Action</label>
              <input value={action} onChange={e => setAction(e.target.value)} placeholder="What will be done to remediate?" className={inputCls} />
            </div>
            <div><label className={labelCls}>Action Owner</label><input value={owner} onChange={e => setOwner(e.target.value)} placeholder="Who is responsible?" className={inputCls} /></div>
            <div><label className={labelCls}>Target Date</label><DatePicker value={target} onChange={e => setTarget(e.target.value)} className={inputCls} /></div>
            <div className="col-span-2">
              <label className="flex items-center gap-2 text-[0.6875rem] text-text cursor-pointer">
                <input type="checkbox" checked={remediation} onChange={e => setRemediation(e.target.checked)} className="w-3.5 h-3.5 rounded border-border accent-[#6a12cd] cursor-pointer" />
                Remediation required
              </label>
            </div>
          </div>
        </>
      )}

      {/* History */}
      {item.history.length > 0 && (
        <div>
          <h6 className="text-[0.5625rem] font-bold text-gray-400 uppercase tracking-wider mb-1">History</h6>
          <div className="space-y-1">{item.history.map(h => (
            <div key={h.id} className="text-[0.5625rem] text-gray-500"><span className="font-semibold text-text">{h.action}</span> by {h.actor} · {h.timestamp}{h.comments ? ` — ${h.comments}` : ''}</div>
          ))}</div>
        </div>
      )}

      {/* Actions — separated by role/state */}
      <div className="flex items-center gap-2 flex-wrap">
        {item.status === 'SENT_TO_MANAGEMENT' && (
          <>
            <button onClick={handleSaveResponse} className="px-3 py-1.5 rounded-lg border border-border-light text-[0.6875rem] font-semibold text-text-muted hover:bg-surface-2/30 cursor-pointer transition-colors">Save Draft</button>
            <button onClick={() => { handleSaveResponse(); onTransition('RESPONSE_RECEIVED', 'Process owner response submitted to auditor.'); }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.6875rem] font-semibold cursor-pointer transition-colors"><Send size={11} />Submit Response to Auditor</button>
          </>
        )}
        {item.status === 'RESPONSE_RECEIVED' && (
          <>
            <button onClick={() => { handleSaveResponse(); if (canAgree) onTransition('AGREED', 'Auditor accepted process owner response.'); }}
              disabled={!canAgree} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[0.6875rem] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"><CheckCircle2 size={11} />Accept Response</button>
            <button onClick={() => { handleSaveResponse(); onTransition('SENT_TO_MANAGEMENT', 'Response sent back to process owner for revision.'); }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 text-[0.6875rem] font-semibold cursor-pointer transition-colors"><RotateCcw size={11} />Send Back</button>
            <button onClick={() => { handleSaveResponse(); if (canDisagree) onTransition('DISAGREED', rationale); }}
              disabled={!canDisagree} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 text-[0.6875rem] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"><XCircle size={11} />Mark Disagreed</button>
          </>
        )}
        {(item.status === 'AGREED' || item.status === 'DISAGREED') && (
          <button onClick={() => onTransition('READY_FOR_REPORT', 'Marked ready for final report.')}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.6875rem] font-semibold cursor-pointer transition-colors">Ready for Report</button>
        )}
      </div>
    </div>
  );
}
