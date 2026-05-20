// ─── Internal Audit — Working Paper Tab ───────────────────────────────────
// Read-only system-generated documentation of audit fieldwork trail.

import React, { useState } from 'react';
import {
  Download, CheckCircle2, AlertCircle, ChevronDown, ChevronRight, Info, Lock, FileText,
} from 'lucide-react';
import type { ConfigurableEngagement, InternalAuditConfig } from '../../configurableEngagementTypes';
import type { InternalAuditWorkspaceState } from './internalAuditScopeData';
import { BUSINESS_PROCESSES, SOPS, RACMS, CHECKLISTS, WORKFLOWS, SCOPE_LEVEL_LABELS, deriveIAScopeReadiness } from './internalAuditScopeData';
import { deriveIARequestSummary, REQUEST_TYPE_LABELS } from './internalAuditRequestsData';
import { RUN_TYPE_LABELS, SEVERITY_CLS as EX_SEVERITY_CLS, EX_STATUS_CLS } from './internalAuditAnalysisData';
import { CATEGORY_LABELS, SEVERITY_CLS as OBS_SEVERITY_CLS, STATUS_CLS as OBS_STATUS_CLS } from './internalAuditObservationsData';
import { DISC_STATUS_CLS, deriveDiscussionSummary } from './internalAuditDiscussionData';

interface Props {
  engagement: ConfigurableEngagement;
  iaState: InternalAuditWorkspaceState;
  onNavigateTab?: (tabId: string) => void;
}

export default function InternalAuditWorkingPaperTab({ engagement, iaState, onNavigateTab }: Props) {
  const cfg = engagement.config as InternalAuditConfig;
  const { scope, announcement, requests, analysis, observations, discussion } = iaState;
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  const selectedBP = BUSINESS_PROCESSES.find(bp => bp.id === scope.businessProcessId);
  const scopeReadiness = deriveIAScopeReadiness(scope, engagement, cfg);
  const reqSummary = deriveIARequestSummary(requests.requests);
  const discSummary = deriveDiscussionSummary(discussion);
  const allExceptions = analysis.runs.flatMap(r => r.exceptions);
  const activeObs = observations.observations.filter(o => o.status !== 'DROPPED');

  // Readiness
  const scopeReady = scopeReadiness.status === 'Scope Ready';
  const announcementDone = announcement.status === 'SENT' || announcement.status === 'ACKNOWLEDGED';
  const idrDone = requests.requests.some(r => r.status === 'RECEIVED' || r.status === 'PARTIALLY_RECEIVED') || requests.proceedWithoutIDR;
  const analysisHasRuns = analysis.runs.some(r => r.status === 'COMPLETED');
  const obsDone = observations.observations.length > 0 || observations.noObservationsConfirmed;
  const discDone = discussion.items.every(i => i.status === 'READY_FOR_REPORT') || discussion.noObsDiscussionConfirmed || (observations.noObservationsConfirmed && discussion.items.length === 0);
  const wpReady = scopeReady && announcementDone && idrDone && obsDone && discDone;

  // Source file index
  const sourceFiles: { file: string; sourceType: string; source: string; scope: string; usedInAnalysis: boolean }[] = [];
  requests.requests.forEach(r => r.filesReceived.forEach(f => {
    const used = analysis.runs.some(run => run.inputFiles.includes(f));
    sourceFiles.push({ file: f, sourceType: REQUEST_TYPE_LABELS[r.requestType] || 'Other', source: `IDR ${r.id}`, scope: r.linkedScopeLabel, usedInAnalysis: used });
  }));

  const Section = ({ num, title, children }: { num: number; title: string; children: React.ReactNode }) => (
    <div className="border-b border-border-light pb-4">
      <h5 className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2 flex items-center gap-2">
        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[9px] font-bold inline-flex items-center justify-center">{num}</span>
        {title}
      </h5>
      {children}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[15px] font-bold text-text mb-0.5">Working Paper</h3>
          <p className="text-[12px] text-text-muted">System-generated documentation of internal audit scope, fieldwork, observations, and management discussion.</p>
        </div>
        <button onClick={() => alert('Draft working paper export will be connected later.')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[11px] font-semibold hover:bg-primary/20 cursor-pointer transition-colors shrink-0">
          <Download size={12} />Download Draft
        </button>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: 'Scope', value: scopeReadiness.status },
          { label: 'Announcement', value: announcement.status === 'ACKNOWLEDGED' ? 'Acknowledged' : announcement.status === 'SENT' ? 'Sent' : 'Pending' },
          { label: 'IDR', value: `${reqSummary.received} received` },
          { label: 'Analysis', value: `${analysis.runs.filter(r => r.status === 'COMPLETED').length} runs` },
          { label: 'Observations', value: observations.noObservationsConfirmed ? 'None Noted' : `${activeObs.length}` },
          { label: 'Discussion', value: `${discSummary.readyForReport} ready` },
          { label: 'Status', value: 'Draft' },
        ].map(s => (
          <span key={s.label} className="px-2.5 py-1 rounded-lg bg-gray-50 border border-border-light text-[10px] text-text font-medium">
            {s.label}: <span className="font-bold">{s.value}</span>
          </span>
        ))}
      </div>

      {/* Paper content */}
      <div className="rounded-xl border border-border-light bg-white p-5 space-y-4">

        {/* 1. Header */}
        <Section num={1} title="Working Paper Header">
          <div className="grid grid-cols-3 gap-3 text-[11px]">
            <div><span className="text-gray-400 block text-[10px]">Assignment</span><span className="text-text font-medium">{engagement.name}</span></div>
            <div><span className="text-gray-400 block text-[10px]">Audit Period</span><span className="text-text font-medium">{cfg.auditPeriodStart || '—'} to {cfg.auditPeriodEnd || '—'}</span></div>
            <div><span className="text-gray-400 block text-[10px]">Entity</span><span className="text-text font-medium">{engagement.entityOrLocation || '—'}</span></div>
            <div><span className="text-gray-400 block text-[10px]">Owner</span><span className="text-text font-medium">{engagement.owner}</span></div>
            <div><span className="text-gray-400 block text-[10px]">Reviewer</span><span className="text-text font-medium">{engagement.reviewer || '—'}</span></div>
            <div><span className="text-gray-400 block text-[10px]">Process Owner</span><span className="text-text font-medium">{cfg.processOwner || '—'}</span></div>
          </div>
        </Section>

        {/* 2. Scope */}
        <Section num={2} title="Audit Scope Summary">
          <div className="grid grid-cols-3 gap-3 text-[11px] mb-2">
            <div><span className="text-gray-400 block text-[10px]">Scope Level</span><span className="text-text font-medium">{SCOPE_LEVEL_LABELS[scope.scopeLevel]?.label || scope.scopeLevel}</span></div>
            <div><span className="text-gray-400 block text-[10px]">Business Process</span><span className="text-text font-medium">{selectedBP ? `${selectedBP.code} — ${selectedBP.name}` : '—'}</span></div>
            <div><span className="text-gray-400 block text-[10px]">Readiness</span><span className={`font-medium ${scopeReady ? 'text-emerald-600' : 'text-amber-600'}`}>{scopeReadiness.status}</span></div>
          </div>
          {scope.scopeObjective && <div className="text-[11px] mb-1"><span className="text-gray-400">Objective: </span><span className="text-text">{scope.scopeObjective}</span></div>}
          {scope.inScopeItems && <div className="text-[11px] mb-1"><span className="text-gray-400">In Scope: </span><span className="text-text">{scope.inScopeItems}</span></div>}
          {scope.outOfScopeItems && <div className="text-[11px]"><span className="text-gray-400">Out of Scope: </span><span className="text-text">{scope.outOfScopeItems}</span></div>}
          {scope.sopIds.length > 0 && <div className="flex flex-wrap gap-1 mt-1">{scope.sopIds.map(id => { const s = SOPS.find(x => x.id === id); return s ? <span key={id} className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[8px] font-semibold">{s.name}</span> : null; })}</div>}
        </Section>

        {/* 3. Announcement */}
        <Section num={3} title="Announcement Summary">
          <div className="grid grid-cols-3 gap-3 text-[11px]">
            <div><span className="text-gray-400 block text-[10px]">Status</span><span className={`font-medium ${announcementDone ? 'text-emerald-600' : 'text-amber-600'}`}>{announcement.status}</span></div>
            <div><span className="text-gray-400 block text-[10px]">Subject</span><span className="text-text font-medium">{announcement.subject || '—'}</span></div>
            <div><span className="text-gray-400 block text-[10px]">Recipients</span><span className="text-text font-medium">{announcement.recipients || '—'}</span></div>
          </div>
          {announcement.sentAt && <div className="text-[10px] text-gray-500 mt-1">Sent: {announcement.sentAt}{announcement.acknowledgedAt ? ` · Acknowledged: ${announcement.acknowledgedAt}` : ''}</div>}
          {!announcementDone && <div className="flex items-start gap-2 mt-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[10px] text-amber-700"><AlertCircle size={11} className="shrink-0 mt-0.5" /><span>Announcement has not been marked as sent.</span></div>}
        </Section>

        {/* 4. IDR */}
        <Section num={4} title="IDR / Request Summary">
          <div className="grid grid-cols-4 gap-3 text-[11px] mb-2">
            <div><span className="text-gray-400 block text-[10px]">Total</span><span className="text-text font-medium">{reqSummary.total}</span></div>
            <div><span className="text-gray-400 block text-[10px]">Received</span><span className="text-emerald-600 font-medium">{reqSummary.received}</span></div>
            <div><span className="text-gray-400 block text-[10px]">Pending</span><span className={`font-medium ${reqSummary.pending > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{reqSummary.pending}</span></div>
            <div><span className="text-gray-400 block text-[10px]">Overdue</span><span className={`font-medium ${reqSummary.overdue > 0 ? 'text-red-600' : 'text-gray-400'}`}>{reqSummary.overdue}</span></div>
          </div>
          {requests.proceedWithoutIDR && <div className="text-[10px] text-blue-600 flex items-center gap-1"><Info size={10} />Analysis proceeded without IDR.</div>}
          {requests.requests.length > 0 && (
            <div className="rounded-lg border border-border-light overflow-hidden mt-2">
              <table className="w-full text-[10px]">
                <thead><tr className="border-b border-border-light bg-surface-2/30 text-[8px] font-semibold text-gray-400 uppercase">
                  <th className="px-2 py-1.5 text-left">Request</th><th className="px-2 py-1.5 text-left">Type</th><th className="px-2 py-1.5 text-left">From</th><th className="px-2 py-1.5 text-center">Status</th><th className="px-2 py-1.5 text-center">Files</th>
                </tr></thead>
                <tbody>{requests.requests.map(r => (
                  <tr key={r.id} className="border-b border-border-light/50">
                    <td className="px-2 py-1.5 text-text">{r.id} — {r.title}</td>
                    <td className="px-2 py-1.5 text-gray-500">{REQUEST_TYPE_LABELS[r.requestType]}</td>
                    <td className="px-2 py-1.5 text-gray-500">{r.requestedFrom}</td>
                    <td className="px-2 py-1.5 text-center"><span className={`px-1.5 py-0.5 rounded text-[7px] font-bold ${r.status === 'RECEIVED' ? 'bg-emerald-50 text-emerald-700' : r.status === 'OVERDUE' ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-500'}`}>{r.status.replace(/_/g, ' ')}</span></td>
                    <td className="px-2 py-1.5 text-center text-gray-500">{r.filesReceived.length || '—'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </Section>

        {/* 5. Analysis */}
        <Section num={5} title="Analysis Procedures and Outputs">
          {analysis.runs.length === 0 ? (
            <div className="text-[11px] text-gray-400 italic">No analysis runs completed yet.</div>
          ) : (
            <div className="rounded-lg border border-border-light overflow-hidden">
              <table className="w-full text-[10px]">
                <thead><tr className="border-b border-border-light bg-surface-2/30 text-[8px] font-semibold text-gray-400 uppercase">
                  <th className="px-2 py-1.5 text-left w-5"></th><th className="px-2 py-1.5 text-left">Run</th><th className="px-2 py-1.5 text-center">Mode</th><th className="px-2 py-1.5 text-center">Status</th><th className="px-2 py-1.5 text-center">Exceptions</th><th className="px-2 py-1.5 text-left">Summary</th>
                </tr></thead>
                <tbody>{analysis.runs.map(run => (
                  <React.Fragment key={run.id}>
                    <tr className={`border-b border-border-light/50 cursor-pointer hover:bg-surface-2/20 ${expandedRunId === run.id ? 'bg-surface-2/20' : ''}`} onClick={() => setExpandedRunId(expandedRunId === run.id ? null : run.id)}>
                      <td className="px-2 py-1.5 text-gray-400">{expandedRunId === run.id ? <ChevronDown size={9} /> : <ChevronRight size={9} />}</td>
                      <td className="px-2 py-1.5 text-text font-medium">{run.title}</td>
                      <td className="px-2 py-1.5 text-center text-gray-500">{RUN_TYPE_LABELS[run.runType]}</td>
                      <td className="px-2 py-1.5 text-center"><span className={`px-1.5 py-0.5 rounded text-[7px] font-bold ${run.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{run.status}</span></td>
                      <td className="px-2 py-1.5 text-center">{run.exceptions.length}</td>
                      <td className="px-2 py-1.5 text-gray-500 truncate max-w-[200px]">{run.summary || '—'}</td>
                    </tr>
                    {expandedRunId === run.id && run.status === 'COMPLETED' && (
                      <tr><td colSpan={6} className="p-0">
                        <div className="bg-surface-2/15 px-4 py-2 border-b border-border-light text-[9px] space-y-1">
                          <div><span className="text-gray-400">Input files:</span> <span className="text-text">{run.inputFiles.join(', ') || '—'}</span></div>
                          <div><span className="text-gray-400">{run.workflowName ? 'Workflow:' : 'Question:'}</span> <span className="text-text">{run.workflowName || run.question || '—'}</span></div>
                          <div><span className="text-gray-400">Completed:</span> <span className="text-text">{run.completedAt} by {run.runBy}</span></div>
                        </div>
                      </td></tr>
                    )}
                  </React.Fragment>
                ))}</tbody>
              </table>
            </div>
          )}
        </Section>

        {/* 6. Exceptions */}
        <Section num={6} title={`Exceptions Identified (${allExceptions.length})`}>
          {allExceptions.length === 0 ? (
            <div className="text-[11px] text-gray-400 italic flex items-center gap-2"><CheckCircle2 size={12} className="text-emerald-500" />No exceptions identified.</div>
          ) : (
            <div className="rounded-lg border border-border-light overflow-hidden">
              <table className="w-full text-[10px]">
                <thead><tr className="border-b border-border-light bg-surface-2/30 text-[8px] font-semibold text-gray-400 uppercase">
                  <th className="px-2 py-1.5 text-left">Exception</th><th className="px-2 py-1.5 text-center">Severity</th><th className="px-2 py-1.5 text-left">Source</th><th className="px-2 py-1.5 text-center">Status</th>
                </tr></thead>
                <tbody>{allExceptions.map(ex => (
                  <tr key={ex.id} className="border-b border-border-light/50">
                    <td className="px-2 py-1.5 text-text">{ex.title}</td>
                    <td className="px-2 py-1.5 text-center"><span className={`px-1.5 py-0.5 rounded text-[7px] font-bold ${EX_SEVERITY_CLS[ex.severity]}`}>{ex.severity}</span></td>
                    <td className="px-2 py-1.5 text-gray-500">{ex.source}</td>
                    <td className="px-2 py-1.5 text-center"><span className={`px-1.5 py-0.5 rounded text-[7px] font-bold ${EX_STATUS_CLS[ex.status]}`}>{ex.status.replace(/_/g, ' ')}</span></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </Section>

        {/* 7. Observations */}
        <Section num={7} title="Observations Summary">
          {observations.noObservationsConfirmed ? (
            <div className="flex items-center gap-2 text-[11px] text-emerald-600"><CheckCircle2 size={12} />No observations noted has been confirmed.</div>
          ) : activeObs.length === 0 ? (
            <div className="flex items-start gap-2 text-[11px] text-amber-600"><AlertCircle size={12} className="shrink-0 mt-0.5" />Observation section is not complete.</div>
          ) : (
            <div className="rounded-lg border border-border-light overflow-hidden">
              <table className="w-full text-[10px]">
                <thead><tr className="border-b border-border-light bg-surface-2/30 text-[8px] font-semibold text-gray-400 uppercase">
                  <th className="px-2 py-1.5 text-left">Observation</th><th className="px-2 py-1.5 text-center">Category</th><th className="px-2 py-1.5 text-center">Severity</th><th className="px-2 py-1.5 text-left">Owner</th><th className="px-2 py-1.5 text-center">Target</th><th className="px-2 py-1.5 text-center">Status</th>
                </tr></thead>
                <tbody>{activeObs.map(o => (
                  <tr key={o.id} className="border-b border-border-light/50">
                    <td className="px-2 py-1.5 text-text font-medium">{o.title}</td>
                    <td className="px-2 py-1.5 text-center text-gray-500">{CATEGORY_LABELS[o.observationCategory]}</td>
                    <td className="px-2 py-1.5 text-center"><span className={`px-1.5 py-0.5 rounded text-[7px] font-bold ${OBS_SEVERITY_CLS[o.severity]}`}>{o.severity}</span></td>
                    <td className="px-2 py-1.5 text-gray-500">{o.processOwner || '—'}</td>
                    <td className="px-2 py-1.5 text-center font-mono text-gray-500">{o.targetRemediationDate || '—'}</td>
                    <td className="px-2 py-1.5 text-center"><span className={`px-1.5 py-0.5 rounded text-[7px] font-bold ${OBS_STATUS_CLS[o.status]}`}>{o.status.replace(/_/g, ' ')}</span></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </Section>

        {/* 8. Discussion */}
        <Section num={8} title="Discussion / Management Response">
          {discussion.noObsDiscussionConfirmed ? (
            <div className="flex items-center gap-2 text-[11px] text-emerald-600"><CheckCircle2 size={12} />Discussion closed with no observations.</div>
          ) : discussion.items.length === 0 ? (
            <div className="text-[11px] text-amber-600 flex items-start gap-2"><AlertCircle size={12} className="shrink-0 mt-0.5" />Management discussion is not fully complete.</div>
          ) : (
            <div className="rounded-lg border border-border-light overflow-hidden">
              <table className="w-full text-[10px]">
                <thead><tr className="border-b border-border-light bg-surface-2/30 text-[8px] font-semibold text-gray-400 uppercase">
                  <th className="px-2 py-1.5 text-left">Observation</th><th className="px-2 py-1.5 text-center">Status</th><th className="px-2 py-1.5 text-left">Response</th><th className="px-2 py-1.5 text-left">Action</th><th className="px-2 py-1.5 text-left">Owner</th><th className="px-2 py-1.5 text-center">Target</th>
                </tr></thead>
                <tbody>{discussion.items.map(d => (
                  <tr key={d.id} className="border-b border-border-light/50">
                    <td className="px-2 py-1.5 text-text font-medium">{d.observationTitle}</td>
                    <td className="px-2 py-1.5 text-center"><span className={`px-1.5 py-0.5 rounded text-[7px] font-bold ${DISC_STATUS_CLS[d.status]}`}>{d.status.replace(/_/g, ' ')}</span></td>
                    <td className="px-2 py-1.5 text-gray-500 truncate max-w-[120px]">{d.managementResponse || '—'}</td>
                    <td className="px-2 py-1.5 text-gray-500 truncate max-w-[120px]">{d.agreedAction || '—'}</td>
                    <td className="px-2 py-1.5 text-gray-500">{d.actionOwner || '—'}</td>
                    <td className="px-2 py-1.5 text-center font-mono text-gray-500">{d.targetDate || '—'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          {discussion.notes.length > 0 && (
            <div className="mt-2"><h6 className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Discussion Notes</h6>
              <div className="space-y-1">{discussion.notes.map(n => <div key={n.id} className="text-[10px] text-gray-500 pl-2 border-l-2 border-gray-200">{n.note} — {n.author}, {n.createdAt}</div>)}</div>
            </div>
          )}
        </Section>

        {/* 9. Source File Index */}
        <Section num={9} title="Evidence / Source File Index">
          {sourceFiles.length === 0 ? (
            <div className="text-[11px] text-gray-400 italic">No source files received.</div>
          ) : (
            <div className="rounded-lg border border-border-light overflow-hidden">
              <table className="w-full text-[10px]">
                <thead><tr className="border-b border-border-light bg-surface-2/30 text-[8px] font-semibold text-gray-400 uppercase">
                  <th className="px-2 py-1.5 text-left">File</th><th className="px-2 py-1.5 text-left">Type</th><th className="px-2 py-1.5 text-left">Source</th><th className="px-2 py-1.5 text-left">Scope</th><th className="px-2 py-1.5 text-center">Used</th>
                </tr></thead>
                <tbody>{sourceFiles.map((sf, i) => (
                  <tr key={i} className="border-b border-border-light/50">
                    <td className="px-2 py-1.5 text-text flex items-center gap-1"><FileText size={9} className="text-gray-400 shrink-0" />{sf.file}</td>
                    <td className="px-2 py-1.5 text-gray-500">{sf.sourceType}</td>
                    <td className="px-2 py-1.5 text-gray-500">{sf.source}</td>
                    <td className="px-2 py-1.5 text-gray-500">{sf.scope}</td>
                    <td className="px-2 py-1.5 text-center">{sf.usedInAnalysis ? <CheckCircle2 size={10} className="text-emerald-500 mx-auto" /> : <span className="text-gray-300">—</span>}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </Section>

        {/* 10. Readiness */}
        <Section num={10} title="Working Paper Readiness">
          <div className="space-y-1">
            {[
              { label: 'Scope defined', ok: scopeReady },
              { label: 'Announcement sent/acknowledged', ok: announcementDone },
              { label: 'IDR received or proceed-without-IDR', ok: idrDone },
              { label: 'Analysis completed', ok: analysisHasRuns },
              { label: 'Observations completed or no-obs confirmed', ok: obsDone },
              { label: 'Discussion completed', ok: discDone },
            ].map(c => (
              <div key={c.label} className="flex items-center gap-2 text-[10px]">
                {c.ok ? <CheckCircle2 size={10} className="text-emerald-500" /> : <AlertCircle size={10} className="text-amber-400" />}
                <span className={c.ok ? 'text-gray-500' : 'text-text'}>{c.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${wpReady ? 'bg-emerald-50 text-emerald-700' : analysisHasRuns || obsDone ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
              {wpReady ? 'Ready for Final Report' : analysisHasRuns || obsDone ? 'In Progress' : 'Draft'}
            </span>
          </div>
        </Section>

        {/* 11. Final Report */}
        <div>
          <h5 className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[9px] font-bold inline-flex items-center justify-center">11</span>
            Final Report
          </h5>
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-gray-50 text-[11px] text-gray-500">
            <Lock size={13} className="shrink-0 mt-0.5" />
            <span>Final Report will be generated from this working paper, formal observations, and management responses.</span>
          </div>
          <button onClick={() => onNavigateTab?.('final-report')} disabled={!wpReady}
            className="mt-2 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[11px] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            Go to Final Report <ChevronRight size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}
