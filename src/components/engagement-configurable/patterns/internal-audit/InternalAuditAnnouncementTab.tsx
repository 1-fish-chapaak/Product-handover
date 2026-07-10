// ─── Internal Audit — Announcement Tab ────────────────────────────────────
// Prepare and track audit kickoff communication to stakeholders.

import DatePicker from '../../../shared/DatePicker';
import React, { useEffect } from 'react';
import {
  Send, CheckCircle2, AlertCircle, ChevronRight, Clock, RefreshCw, Info, Save,
} from 'lucide-react';
import type { ConfigurableEngagement, InternalAuditConfig } from '../../configurableEngagementTypes';
import { BUSINESS_PROCESSES, deriveIAScopeReadiness, type InternalAuditScopeState } from './internalAuditScopeData';
import { useAuditLog } from '../../../../context/AdminDataContext';
import {
  generateAnnouncementDraft, deriveAnnouncementReadiness,
  type InternalAuditAnnouncementState, type AnnouncementStatus,
} from './internalAuditAnnouncementData';

const inputCls = 'w-full px-3 py-2 border border-border rounded-lg text-[0.75rem] text-text bg-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all';
const labelCls = 'text-[0.6875rem] font-semibold text-text-muted block mb-1';
const STATUS_CLS: Record<AnnouncementStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  READY_TO_SEND: 'bg-blue-50 text-blue-700',
  SENT: 'bg-emerald-50 text-emerald-700',
  ACKNOWLEDGED: 'bg-primary/10 text-primary',
};
const ACTION_CLS: Record<string, string> = { DRAFT_CREATED: 'text-gray-500', UPDATED: 'text-blue-600', SENT: 'text-emerald-600', ACKNOWLEDGED: 'text-primary', SAVED_DRAFT: 'text-gray-500' };

interface Props {
  engagement: ConfigurableEngagement;
  scope: InternalAuditScopeState;
  announcement: InternalAuditAnnouncementState;
  onUpdateAnnouncement: (ann: InternalAuditAnnouncementState) => void;
  onNavigateTab?: (tabId: string) => void;
  hideTimeline?: boolean;
}

function now(): string {
  return new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function InternalAuditAnnouncementTab({ engagement, scope, announcement, onUpdateAnnouncement, onNavigateTab, hideTimeline }: Props) {
  const logEvent = useAuditLog();
  const cfg = engagement.config as InternalAuditConfig;
  const scopeReadiness = deriveIAScopeReadiness(scope, engagement, cfg);
  const { canSend, missing } = deriveAnnouncementReadiness(announcement);
  const selectedBP = BUSINESS_PROCESSES.find(bp => bp.id === scope.businessProcessId);
  const isSent = announcement.status === 'SENT' || announcement.status === 'ACKNOWLEDGED';

  // Initialize draft once
  useEffect(() => {
    if (announcement.initialized) return;
    const draft = generateAnnouncementDraft({
      assignmentName: engagement.name,
      objective: scope.scopeObjective || engagement.description,
      businessProcess: selectedBP ? `${selectedBP.code} — ${selectedBP.name}` : '',
      entityOrLocation: engagement.entityOrLocation || '',
      auditPeriodStart: cfg.auditPeriodStart,
      auditPeriodEnd: cfg.auditPeriodEnd,
      processOwner: cfg.processOwner,
      owner: engagement.owner,
      reviewer: engagement.reviewer || '',
      plannedStartDate: engagement.plannedStartDate || '',
      plannedEndDate: engagement.plannedEndDate || '',
      scopeSummary: scope.inScopeItems || '',
    });
    onUpdateAnnouncement({ ...announcement, ...draft });
  }, [announcement.initialized]);

  const update = <K extends keyof InternalAuditAnnouncementState>(field: K, value: InternalAuditAnnouncementState[K]) =>
    onUpdateAnnouncement({ ...announcement, [field]: value });

  const handleRefreshFromScope = () => {
    const draft = generateAnnouncementDraft({
      assignmentName: engagement.name,
      objective: scope.scopeObjective || engagement.description,
      businessProcess: selectedBP ? `${selectedBP.code} — ${selectedBP.name}` : '',
      entityOrLocation: engagement.entityOrLocation || '',
      auditPeriodStart: cfg.auditPeriodStart,
      auditPeriodEnd: cfg.auditPeriodEnd,
      processOwner: cfg.processOwner,
      owner: engagement.owner,
      reviewer: engagement.reviewer || '',
      plannedStartDate: engagement.plannedStartDate || '',
      plannedEndDate: engagement.plannedEndDate || '',
      scopeSummary: scope.inScopeItems || '',
    });
    onUpdateAnnouncement({
      ...announcement,
      subject: draft.subject || announcement.subject,
      body: draft.body || announcement.body,
      recipients: draft.recipients || announcement.recipients,
      ccRecipients: draft.ccRecipients || announcement.ccRecipients,
      expectedStartDate: draft.expectedStartDate || announcement.expectedStartDate,
      expectedEndDate: draft.expectedEndDate || announcement.expectedEndDate,
      history: [...announcement.history, { id: `ah-${Date.now()}`, action: 'UPDATED', actor: engagement.owner, timestamp: now(), comments: 'Refreshed from scope.' }],
    });
  };

  const handleMarkSent = () => {
    if (!canSend) return;
    onUpdateAnnouncement({
      ...announcement,
      status: 'SENT',
      sentAt: now(),
      sentBy: engagement.owner,
      history: [...announcement.history, { id: `ah-${Date.now()}`, action: 'SENT', actor: engagement.owner, timestamp: now(), comments: '' }],
    });
    logEvent({ action: 'Update', description: `Sent audit announcement "${announcement.subject}" for "${engagement.name}"`, module: 'Engagements', entity: 'Announcement' });
  };

  const handleAcknowledge = () => {
    onUpdateAnnouncement({
      ...announcement,
      status: 'ACKNOWLEDGED',
      acknowledgedAt: now(),
      acknowledgedBy: cfg.processOwner || 'Process Owner',
      history: [...announcement.history, { id: `ah-${Date.now()}`, action: 'ACKNOWLEDGED', actor: cfg.processOwner || 'Process Owner', timestamp: now(), comments: '' }],
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[0.9375rem] font-bold text-text mb-0.5">Audit Announcement</h3>
          <p className="text-[0.75rem] text-text-muted">Prepare the kickoff communication for process owners and stakeholders.</p>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-[0.625rem] font-bold shrink-0 ${STATUS_CLS[announcement.status]}`}>
          {announcement.status === 'READY_TO_SEND' ? 'Ready to Send' : announcement.status.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-6 gap-2">
        {[
          { label: 'Status', value: announcement.status === 'READY_TO_SEND' ? 'Ready' : announcement.status.charAt(0) + announcement.status.slice(1).toLowerCase().replace(/_/g, ' ') },
          { label: 'Recipients', value: announcement.recipients ? announcement.recipients.split(',').length : 0 },
          { label: 'Start', value: announcement.expectedStartDate || '—' },
          { label: 'End', value: announcement.expectedEndDate || '—' },
          { label: 'Response Due', value: announcement.responseDueDate || '—' },
          { label: 'Scope', value: scopeReadiness.status, cls: scopeReadiness.status === 'Scope Ready' ? 'text-emerald-600' : 'text-amber-600' },
        ].map(s => (
          <div key={s.label} className="rounded-lg border border-border-light p-2 text-center">
            <div className={`text-[0.8125rem] font-bold tabular-nums ${(s as any).cls || 'text-text'}`}>{s.value}</div>
            <div className="text-[0.5rem] text-gray-400 font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Scope warning */}
      {scopeReadiness.status !== 'Scope Ready' ? (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[0.625rem] text-amber-700">
          <AlertCircle size={12} className="shrink-0 mt-0.5" />
          <span>Scope is not fully ready. You can draft the announcement, but confirm scope before sending.</span>
        </div>
      ) : (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-emerald-50/50 border border-emerald-200/50 text-[0.625rem] text-emerald-600">
          <CheckCircle2 size={12} className="shrink-0 mt-0.5" />
          <span>Scope is ready. Announcement can be prepared for stakeholders.</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* Left — Form */}
        <div className="space-y-3">
          {/* Recipients */}
          <div className="rounded-lg border border-border-light p-4 space-y-3">
            <h4 className="text-[0.6875rem] font-bold text-text">Recipients</h4>
            <div>
              <label className={labelCls}>To <span className="text-red-400">*</span></label>
              <input value={announcement.recipients} onChange={e => update('recipients', e.target.value)} placeholder="e.g. Process Owner, Finance Head" className={inputCls} disabled={isSent} />
            </div>
            <div>
              <label className={labelCls}>CC</label>
              <input value={announcement.ccRecipients} onChange={e => update('ccRecipients', e.target.value)} placeholder="e.g. Audit Manager, Compliance Head" className={inputCls} disabled={isSent} />
            </div>
          </div>

          {/* Timeline */}
          {!hideTimeline && (
            <div className="rounded-lg border border-border-light p-4 space-y-3">
              <h4 className="text-[0.6875rem] font-bold text-text">Timeline</h4>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Announcement Date</label><DatePicker value={announcement.announcementDate} onChange={e => update('announcementDate', e.target.value)} className={inputCls} disabled={isSent} /></div>
                <div><label className={labelCls}>Response Due</label><DatePicker value={announcement.responseDueDate} onChange={e => update('responseDueDate', e.target.value)} className={inputCls} disabled={isSent} /></div>
                <div><label className={labelCls}>Expected Start</label><DatePicker value={announcement.expectedStartDate} onChange={e => update('expectedStartDate', e.target.value)} className={inputCls} disabled={isSent} /></div>
                <div><label className={labelCls}>Expected End</label><DatePicker value={announcement.expectedEndDate} onChange={e => update('expectedEndDate', e.target.value)} className={inputCls} disabled={isSent} /></div>
              </div>
            </div>
          )}

          {/* Subject + Body */}
          <div className="rounded-lg border border-border-light p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-[0.6875rem] font-bold text-text">Message</h4>
              {!isSent && (
                <button onClick={handleRefreshFromScope} className="flex items-center gap-1 text-[0.5625rem] font-semibold text-primary hover:underline cursor-pointer">
                  <RefreshCw size={9} />Refresh from Scope
                </button>
              )}
            </div>
            <div>
              <label className={labelCls}>Subject <span className="text-red-400">*</span></label>
              <input value={announcement.subject} onChange={e => update('subject', e.target.value)} className={inputCls} disabled={isSent} />
            </div>
            <div>
              <label className={labelCls}>Body <span className="text-red-400">*</span></label>
              <textarea value={announcement.body} onChange={e => update('body', e.target.value)} rows={12}
                className={inputCls + ' resize-none font-mono text-[0.6875rem]'} disabled={isSent} />
            </div>
          </div>

          {/* Actions */}
          {!isSent && (
            <div className="flex items-center gap-3">
              <button onClick={() => onUpdateAnnouncement({ ...announcement, status: 'DRAFT', history: [...announcement.history, { id: `ah-${Date.now()}`, action: 'SAVED_DRAFT', actor: engagement.owner, timestamp: new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }), comments: '' }] })}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border-light bg-white hover:bg-surface-2/30 text-text text-[0.75rem] font-semibold cursor-pointer transition-colors">
                <Save size={12} />Save as Draft
              </button>
              <button onClick={handleMarkSent} disabled={!canSend || scopeReadiness.status === 'Draft Scope'}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.75rem] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                <Send size={12} />Mark as Sent
              </button>
              {!canSend && missing.length > 0 && (
                <span className="text-[0.625rem] text-amber-600">Missing: {missing.join(', ')}</span>
              )}
            </div>
          )}
          {announcement.status === 'SENT' && (
            <div className="space-y-2">
              <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-[0.625rem] text-emerald-700">
                <CheckCircle2 size={12} className="shrink-0 mt-0.5" />
                <span>Announcement marked as sent on {announcement.sentAt} by {announcement.sentBy}.</span>
              </div>
              <button onClick={handleAcknowledge}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[0.6875rem] font-semibold hover:bg-primary/20 cursor-pointer transition-colors">
                <CheckCircle2 size={11} />Mark Acknowledged
              </button>
            </div>
          )}
          {announcement.status === 'ACKNOWLEDGED' && (
            <div className="space-y-2">
              <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/15 text-[0.625rem] text-primary">
                <CheckCircle2 size={12} className="shrink-0 mt-0.5" />
                <span>Acknowledged by {announcement.acknowledgedBy} on {announcement.acknowledgedAt}.</span>
              </div>
              {!hideTimeline && (
                <button onClick={() => onNavigateTab?.('requests-idr')}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.6875rem] font-semibold cursor-pointer transition-colors">
                  Continue to Requests / IDR <ChevronRight size={11} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right — Preview */}
        <div className="space-y-4">
          <div className="rounded-lg border border-border-light p-4 space-y-3 sticky top-4">
            <h4 className="text-[0.6875rem] font-bold text-text">Announcement Preview</h4>
            <div className="rounded-lg border border-border-light bg-white p-4 space-y-2">
              <div className="text-[0.625rem] text-gray-400">Subject</div>
              <div className="text-[0.75rem] font-semibold text-text">{announcement.subject || 'No subject'}</div>
              <div className="border-t border-border-light pt-2 space-y-1 text-[0.625rem]">
                <div><span className="text-gray-400">To:</span> <span className="text-text">{announcement.recipients || '—'}</span></div>
                {announcement.ccRecipients && <div><span className="text-gray-400">CC:</span> <span className="text-text">{announcement.ccRecipients}</span></div>}
                {announcement.announcementDate && <div><span className="text-gray-400">Date:</span> <span className="text-text">{announcement.announcementDate}</span></div>}
              </div>
              <div className="border-t border-border-light pt-2">
                <pre className="text-[0.625rem] text-text whitespace-pre-wrap font-sans leading-relaxed">{announcement.body || 'No body content.'}</pre>
              </div>
              <div className="border-t border-border-light pt-2 text-[0.5625rem] text-gray-400">
                <div className="font-semibold mb-0.5">Attachments (placeholder)</div>
                <div>- Scope Summary</div>
                <div>- Audit Plan</div>
                <div>- IDR to follow</div>
              </div>
            </div>
          </div>

          {/* History */}
          {announcement.history.length > 0 && (
            <div className="rounded-lg border border-border-light p-4">
              <h4 className="text-[0.6875rem] font-bold text-text mb-2">History</h4>
              <div className="space-y-2">
                {announcement.history.map(h => (
                  <div key={h.id} className="flex items-start gap-2 text-[0.625rem]">
                    {h.action === 'SENT' ? <Send size={10} className="text-emerald-500 shrink-0 mt-0.5" /> :
                     h.action === 'ACKNOWLEDGED' ? <CheckCircle2 size={10} className="text-primary shrink-0 mt-0.5" /> :
                     <Clock size={10} className="text-gray-400 shrink-0 mt-0.5" />}
                    <div>
                      <span className={`font-semibold ${ACTION_CLS[h.action]}`}>{h.action.replace(/_/g, ' ')}</span>
                      <span className="text-gray-400 ml-2">by {h.actor} · {h.timestamp}</span>
                      {h.comments && <p className="text-gray-500 mt-0.5 italic">"{h.comments}"</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
