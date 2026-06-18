// ─── Internal Audit — Final Report Tab ────────────────────────────────────
// Full management-facing internal audit report with structured sections.

import React from 'react';
import {
  Download, CheckCircle2, AlertCircle, ChevronRight, FileText, RefreshCw,
  Shield, BarChart3, AlertTriangle, Users, Calendar, Sparkles,
} from 'lucide-react';
import type { ConfigurableEngagement, InternalAuditConfig } from '../../configurableEngagementTypes';
import type { InternalAuditWorkspaceState } from './internalAuditScopeData';
import { BUSINESS_PROCESSES, SOPS, RACMS, CHECKLISTS, SCOPE_LEVEL_LABELS } from './internalAuditScopeData';
import { CATEGORY_LABELS, SEVERITY_CLS as OBS_SEV_CLS } from './internalAuditObservationsData';
import {
  generateReportDraft, deriveFinalReportReadiness, RATING_LABELS, RATING_CLS, REPORT_STATUS_CLS,
  type InternalAuditFinalReportState, type OverallRating,
} from './internalAuditFinalReportData';
import FloatingLines from '../../../shared/FloatingLines';

function now(): string { return new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }

interface Props {
  engagement: ConfigurableEngagement;
  iaState: InternalAuditWorkspaceState;
  finalReport: InternalAuditFinalReportState;
  onUpdateFinalReport: (state: InternalAuditFinalReportState) => void;
  onNavigateTab?: (tabId: string) => void;
}

export default function InternalAuditFinalReportTab({ engagement, iaState, finalReport, onUpdateFinalReport, onNavigateTab }: Props) {
  const cfg = engagement.config as InternalAuditConfig;
  const { ready, checks } = deriveFinalReportReadiness(iaState, engagement);
  const activeObs = iaState.observations.observations.filter(o => o.status !== 'DROPPED');
  const reportReadyObs = activeObs.filter(o => o.status === 'READY_FOR_DISCUSSION' || o.status === 'AGREED' || o.status === 'IN_DISCUSSION');
  const agreedActions = iaState.discussion.items.filter(i => (i.status === 'AGREED' || i.status === 'READY_FOR_REPORT') && i.agreedAction.trim());
  const completedRuns = iaState.analysis.runs.filter(r => r.status === 'COMPLETED');
  const totalFindings = completedRuns.flatMap(r => r.exceptions).length;
  const receivedFiles = iaState.requests.requests.filter(r => r.filesReceived.length > 0).flatMap(r => r.filesReceived);
  const bp = BUSINESS_PROCESSES.find(b => b.id === iaState.scope.businessProcessId);
  const isIssued = finalReport.status === 'ISSUED';
  const isDraft = finalReport.status === 'DRAFT';
  const isReadyForReview = finalReport.status === 'READY_FOR_REVIEW';
  const hasDraft = finalReport.initialized;

  const handleGenerate = () => {
    const draft = generateReportDraft(engagement, iaState);
    onUpdateFinalReport({ ...finalReport, ...draft, status: 'DRAFT' });
  };

  const handleMarkReady = () => {
    onUpdateFinalReport({ ...finalReport, status: 'READY_FOR_REVIEW', history: [...finalReport.history, { id: `rh-${Date.now()}`, action: 'MARKED_READY', actor: engagement.owner, timestamp: now(), comments: '' }] });
  };

  const handleIssue = () => {
    onUpdateFinalReport({ ...finalReport, status: 'ISSUED', issuedAt: now(), issuedBy: engagement.reviewer || engagement.owner, history: [...finalReport.history, { id: `rh-${Date.now()}`, action: 'ISSUED', actor: engagement.reviewer || engagement.owner, timestamp: now(), comments: 'Final report issued.' }] });
  };

  // ── Not Started ──
  if (!hasDraft) {
    return (
      <div className="space-y-4">
        <div><h3 className="text-[0.9375rem] font-bold text-text mb-0.5">Final Report</h3><p className="text-[0.75rem] text-text-muted">Generate the formal internal audit report for process owner review and closure.</p></div>
        <div className="rounded-xl border-2 border-dashed border-primary/20 bg-gradient-to-br from-primary/5 to-purple-50/30 p-8 text-center space-y-4">
          <FileText size={32} className="text-primary/40 mx-auto" />
          <h4 className="text-[1rem] font-bold text-text">Generate Internal Audit Report</h4>
          <p className="text-[0.75rem] text-text-muted max-w-lg mx-auto">
            Create a formal management-facing audit report from scope, observations, process owner responses, and agreed actions.
          </p>
          {activeObs.length === 0 && !iaState.observations.noObservationsConfirmed && (
            <div className="flex items-center justify-center gap-2 text-[0.6875rem] text-amber-600"><AlertCircle size={12} />No observations ready. Complete observations and discussion first.</div>
          )}
          <button onClick={handleGenerate} className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-primary to-primary-medium text-white text-[0.8125rem] font-semibold hover:from-primary-hover hover:to-primary cursor-pointer transition-all">
            <Sparkles size={14} className="inline mr-1.5 -mt-0.5" />Generate Report
          </button>
        </div>
        <div className="rounded-lg border border-border-light p-4 space-y-1">
          <h4 className="text-[0.6875rem] font-bold text-text mb-1">Report Readiness</h4>
          {checks.map(c => (
            <div key={c.label} className="flex items-center gap-2 text-[0.625rem]">
              {c.ok ? <CheckCircle2 size={10} className="text-emerald-500" /> : <AlertCircle size={10} className="text-amber-400" />}
              <span className={c.ok ? 'text-gray-500' : 'text-text'}>{c.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Report Preview ──
  const criticalCount = activeObs.filter(o => o.severity === 'CRITICAL').length;
  const highCount = activeObs.filter(o => o.severity === 'HIGH').length;
  const mediumCount = activeObs.filter(o => o.severity === 'MEDIUM').length;
  const lowCount = activeObs.filter(o => o.severity === 'LOW').length;

  return (
    <div className="space-y-5">
      {/* ══ Report Header Banner ══ */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#3b0b72] to-[#6a12cd]" style={{ boxShadow: '0 4px 24px rgba(106,18,205,0.35)' }}>
        <div className="absolute inset-0 z-0" style={{ maskImage: 'linear-gradient(to right, transparent 35%, white 70%)', WebkitMaskImage: 'linear-gradient(to right, transparent 35%, white 70%)' }}>
          <FloatingLines enabledWaves={['top', 'middle']} lineCount={6} lineDistance={6} bendRadius={4} bendStrength={-0.3} interactive={true} parallax={false} color="#e879f9" opacity={0.3} />
        </div>
        <div className="relative z-10 px-8 py-7">
          <p className="text-white/50 text-[0.6875rem] font-semibold uppercase tracking-wider mb-1">Internal Audit Report</p>
          <h1 className="text-2xl font-bold text-white tracking-tight mb-1">{finalReport.reportTitle || `Internal Audit Report — ${engagement.name}`}</h1>
          <p className="text-white/60 text-[0.8125rem] mb-3">{engagement.description || `${bp?.name || ''} process audit — ${engagement.entityOrLocation || ''}`}</p>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[0.8125rem] flex-wrap">
              <span className="font-semibold text-white">{engagement.owner}</span>
              <span className="text-white/30">|</span>
              <span className="text-white/70">{finalReport.reportDate || 'Pending'}</span>
              <span className="text-white/30">|</span>
              <span className="text-white/70">{bp?.name || engagement.businessProcess || '—'}</span>
              <span className="text-white/30">|</span>
              <span className="text-white/70">{engagement.entityOrLocation || '—'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-[10px] text-[0.6875rem] font-bold ${isIssued ? 'bg-white/20 text-white' : 'bg-white/10 text-white/80'}`}>{finalReport.status.replace(/_/g, ' ')}</span>
              {!isIssued && (
                <button onClick={handleGenerate} className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[0.75rem] font-semibold text-primary bg-white rounded-[10px] hover:bg-white/90 transition-colors cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.15)]">
                  <RefreshCw size={12} />Regenerate
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ══ Report Metadata ══ */}
      <div className="bg-white rounded-xl border border-border-light p-5">
        <div className="grid grid-cols-3 gap-x-8 gap-y-3 text-[0.75rem]">
          <div><span className="text-text-muted block text-[0.625rem] font-medium mb-0.5">Assignment</span><span className="text-text font-semibold">{engagement.name}</span></div>
          <div><span className="text-text-muted block text-[0.625rem] font-medium mb-0.5">Business Process</span><span className="text-text font-semibold">{bp?.name || engagement.businessProcess || '—'}</span></div>
          <div><span className="text-text-muted block text-[0.625rem] font-medium mb-0.5">Entity / Location</span><span className="text-text font-semibold">{engagement.entityOrLocation || '—'}</span></div>
          <div><span className="text-text-muted block text-[0.625rem] font-medium mb-0.5">Audit Period</span><span className="text-text font-semibold">{engagement.dataPeriodStart || '—'} to {engagement.dataPeriodEnd || '—'}</span></div>
          <div><span className="text-text-muted block text-[0.625rem] font-medium mb-0.5">Prepared By</span><span className="text-text font-semibold">{finalReport.preparedBy || engagement.owner}</span></div>
          <div><span className="text-text-muted block text-[0.625rem] font-medium mb-0.5">Reviewed By</span><span className="text-text font-semibold">{finalReport.reviewedBy || engagement.reviewer || '—'}</span></div>
        </div>
      </div>

      {/* ══ Executive Summary ══ */}
      <div className="bg-white rounded-xl border border-border-light p-5">
        <h3 className="text-[0.8125rem] font-bold text-text mb-3 flex items-center gap-2"><FileText size={14} className="text-primary" /> Executive Summary</h3>
        <div className="grid grid-cols-4 gap-3 mb-4">
          {[
            { icon: BarChart3, label: 'Observations', value: activeObs.length, color: 'text-primary bg-primary/10' },
            { icon: AlertTriangle, label: 'Critical / High', value: criticalCount + highCount, color: criticalCount + highCount > 0 ? 'text-red-700 bg-red-50' : 'text-gray-500 bg-gray-100' },
            { icon: Shield, label: 'Agreed Actions', value: agreedActions.length, color: 'text-brand-700 bg-brand-50' },
            { icon: CheckCircle2, label: 'Rating', value: RATING_LABELS[finalReport.overallRating], color: finalReport.overallRating === 'SATISFACTORY' ? 'text-emerald-700 bg-emerald-50' : finalReport.overallRating === 'UNSATISFACTORY' ? 'text-red-700 bg-red-50' : 'text-amber-700 bg-amber-50' },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-xl border border-border-light p-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stat.color}`}><stat.icon size={16} /></div>
              <div><div className="text-xl font-bold text-text">{stat.value}</div><div className="text-[0.625rem] text-text-muted">{stat.label}</div></div>
            </div>
          ))}
        </div>
        <p className="text-[0.75rem] text-text-secondary leading-relaxed">{finalReport.executiveSummary}</p>
      </div>

      {/* ══ Scope and Objective ══ */}
      <div className="bg-white rounded-xl border border-border-light p-5">
        <h3 className="text-[0.8125rem] font-bold text-text mb-2 flex items-center gap-2"><Shield size={14} className="text-primary" /> Scope and Objective</h3>
        <p className="text-[0.75rem] text-text-secondary leading-relaxed mb-3">{finalReport.scopeAndObjective}</p>
        {(iaState.scope.sopIds.length > 0 || iaState.scope.racmVersionIds.length > 0 || iaState.scope.checklistIds.length > 0) && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {iaState.scope.sopIds.map(id => { const s = SOPS.find(x => x.id === id); return s ? <span key={id} className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-[0.5625rem] font-medium">SOP: {s.name}</span> : null; })}
            {iaState.scope.racmVersionIds.map(id => { const r = RACMS.find(x => x.id === id); return r ? <span key={id} className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 text-[0.5625rem] font-medium">RACM: {r.name}</span> : null; })}
            {iaState.scope.checklistIds.map(id => { const c = CHECKLISTS.find(x => x.id === id); return c ? <span key={id} className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[0.5625rem] font-medium">Checklist: {c.name}</span> : null; })}
          </div>
        )}
      </div>

      {/* ══ Audit Approach ══ */}
      <div className="bg-white rounded-xl border border-border-light p-5">
        <h3 className="text-[0.8125rem] font-bold text-text mb-2 flex items-center gap-2"><BarChart3 size={14} className="text-primary" /> Audit Approach</h3>
        <p className="text-[0.75rem] text-text-secondary leading-relaxed mb-2">{finalReport.proceduresPerformed}</p>
        {receivedFiles.length > 0 && <p className="text-[0.6875rem] text-gray-400">{finalReport.dataReviewed}</p>}
      </div>

      {/* ══ Key Metrics ══ */}
      <div className="bg-white rounded-xl border border-border-light p-5">
        <h3 className="text-[0.8125rem] font-bold text-text mb-3 flex items-center gap-2"><BarChart3 size={14} className="text-primary" /> Audit Snapshot</h3>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-[0.75rem]">
          {[
            { label: 'IDR Requests Raised', value: iaState.requests.requests.length },
            { label: 'Documents Received', value: receivedFiles.length },
            { label: 'Workflows Executed', value: completedRuns.length },
            { label: 'Potential Findings from Analysis', value: totalFindings },
            { label: 'Formal Observations', value: activeObs.length },
            { label: 'Critical Observations', value: criticalCount },
            { label: 'High Observations', value: highCount },
            { label: 'Medium / Low', value: `${mediumCount} / ${lowCount}` },
            { label: 'Agreed Action Plans', value: agreedActions.length },
            { label: 'Process Owner Responses', value: iaState.discussion.items.filter(i => i.managementResponse.trim()).length },
          ].map(m => (
            <div key={m.label} className="flex items-center justify-between py-1.5 border-b border-border-light/40">
              <span className="text-text-muted">{m.label}</span>
              <span className="text-text font-semibold tabular-nums">{m.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ══ Detailed Observations ══ */}
      <div className="bg-white rounded-xl border border-border-light p-5">
        <h3 className="text-[0.8125rem] font-bold text-text mb-3 flex items-center gap-2"><AlertTriangle size={14} className="text-amber-500" /> Detailed Observations ({activeObs.length})</h3>
        {iaState.observations.noObservationsConfirmed ? (
          <div className="text-[0.75rem] text-emerald-600 flex items-center gap-2 py-3"><CheckCircle2 size={13} />No audit observations were noted during this assignment.</div>
        ) : activeObs.length === 0 ? (
          <div className="text-[0.75rem] text-gray-400 italic py-3">Observations pending formalization.</div>
        ) : (
          <div className="space-y-3">
            {activeObs.map((obs, idx) => {
              const disc = iaState.discussion.items.find(d => d.observationId === obs.id);
              const wfRun = obs.sourceRunId ? iaState.analysis.runs.find(r => r.id === obs.sourceRunId) : null;
              return (
                <div key={obs.id} className="rounded-lg border border-border-light overflow-hidden">
                  <div className="px-4 py-3 bg-surface-2/20 border-b border-border-light">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[0.625rem] font-bold text-gray-400">#{idx + 1}</span>
                        <span className="text-[0.8125rem] font-semibold text-text">{obs.title}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[0.5rem] font-bold ${OBS_SEV_CLS[obs.severity]}`}>{obs.severity}</span>
                      </div>
                      <span className="text-[0.625rem] text-gray-400">{CATEGORY_LABELS[obs.observationCategory]}</span>
                    </div>
                  </div>
                  <div className="px-4 py-3 space-y-2 text-[0.6875rem]">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                      <div><span className="text-gray-400 block text-[0.5625rem] font-medium">Control / Check</span><span className="text-text">{obs.linkedControlName || obs.linkedScopeLabel || '—'}</span></div>
                      <div><span className="text-gray-400 block text-[0.5625rem] font-medium">Source</span><span className="text-text">{obs.sourceType === 'ANALYSIS_EXCEPTION' ? `Analysis — ${wfRun?.workflowName || 'Workflow'}` : 'Manual'}</span></div>
                      {obs.description && <div className="col-span-2"><span className="text-gray-400 block text-[0.5625rem] font-medium">Condition (What was found)</span><span className="text-text">{obs.description}</span></div>}
                      {obs.rootCause && <div><span className="text-gray-400 block text-[0.5625rem] font-medium">Root Cause</span><span className="text-text">{obs.rootCause}</span></div>}
                      {obs.impact && <div><span className="text-gray-400 block text-[0.5625rem] font-medium">Impact / Risk</span><span className="text-text">{obs.impact}</span></div>}
                      {obs.recommendation && <div className="col-span-2"><span className="text-gray-400 block text-[0.5625rem] font-medium">Recommendation</span><span className="text-text">{obs.recommendation}</span></div>}
                    </div>
                    {disc && (
                      <div className="border-t border-border-light/50 pt-2 mt-2 grid grid-cols-2 gap-x-6 gap-y-2">
                        <div className="col-span-2"><span className="text-gray-400 block text-[0.5625rem] font-medium">Process Owner Response</span><span className="text-text">{disc.managementResponse || '—'}</span></div>
                        {disc.agreedAction && <div><span className="text-gray-400 block text-[0.5625rem] font-medium">Agreed Action</span><span className="text-text">{disc.agreedAction}</span></div>}
                        <div><span className="text-gray-400 block text-[0.5625rem] font-medium">Action Owner</span><span className="text-text">{disc.actionOwner || obs.processOwner || '—'}</span></div>
                        <div><span className="text-gray-400 block text-[0.5625rem] font-medium">Target Date</span><span className="text-text font-mono">{disc.targetDate || obs.targetRemediationDate || '—'}</span></div>
                        <div><span className="text-gray-400 block text-[0.5625rem] font-medium">Discussion Status</span><span className={`px-1.5 py-0.5 rounded text-[0.5rem] font-bold ${disc.status === 'AGREED' || disc.status === 'READY_FOR_REPORT' ? 'bg-emerald-50 text-emerald-700' : disc.status === 'DISAGREED' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{disc.status.replace(/_/g, ' ')}</span></div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ══ Process Owner Response Summary ══ */}
      {iaState.discussion.items.length > 0 && (
        <div className="bg-white rounded-xl border border-border-light p-5">
          <h3 className="text-[0.8125rem] font-bold text-text mb-3 flex items-center gap-2"><Users size={14} className="text-primary" /> Process Owner Response Summary</h3>
          <div className="rounded-lg border border-border-light overflow-hidden">
            <table className="w-full text-[0.6875rem]">
              <thead><tr className="border-b border-border-light bg-surface-2/30 text-[0.5625rem] font-semibold text-gray-400 uppercase">
                <th className="px-3 py-1.5 text-left">Observation</th><th className="px-3 py-1.5 text-center">Response</th><th className="px-3 py-1.5 text-center">Status</th><th className="px-3 py-1.5 text-left">Owner</th><th className="px-3 py-1.5 text-center">Target</th><th className="px-3 py-1.5 text-center">Remediation</th>
              </tr></thead>
              <tbody>{iaState.discussion.items.map(d => (
                <tr key={d.id} className="border-b border-border-light/50">
                  <td className="px-3 py-2 text-text font-medium">{d.observationTitle}</td>
                  <td className="px-3 py-2 text-center">{d.managementResponse ? <CheckCircle2 size={12} className="text-emerald-500 mx-auto" /> : <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[0.5rem] font-bold ${d.status === 'AGREED' || d.status === 'READY_FOR_REPORT' ? 'bg-emerald-50 text-emerald-700' : d.status === 'DISAGREED' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{d.status.replace(/_/g, ' ')}</span></td>
                  <td className="px-3 py-2 text-gray-500">{d.actionOwner || '—'}</td>
                  <td className="px-3 py-2 text-center font-mono text-gray-500">{d.targetDate || '—'}</td>
                  <td className="px-3 py-2 text-center">{d.remediationRequired ? <span className="text-[0.5625rem] font-semibold text-amber-700">Yes</span> : <span className="text-[0.5625rem] text-gray-400">No</span>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ Overall Conclusion ══ */}
      <div className={`rounded-xl border-2 p-5 ${RATING_CLS[finalReport.overallRating]}`}>
        <h3 className="text-[0.875rem] font-bold mb-2">Overall Audit Conclusion: {RATING_LABELS[finalReport.overallRating]}</h3>
        <p className="text-[0.75rem] leading-relaxed opacity-80">{finalReport.conclusionRemarks}</p>
      </div>

      {/* ══ Sign-off / Distribution ══ */}
      <div className="bg-white rounded-xl border border-border-light p-5">
        <h3 className="text-[0.8125rem] font-bold text-text mb-3 flex items-center gap-2"><Users size={14} className="text-primary" /> Sign-off & Distribution</h3>
        <div className="grid grid-cols-3 gap-4 text-[0.75rem]">
          <div><span className="text-text-muted block text-[0.625rem] font-medium mb-0.5">Prepared By</span><span className="text-text font-semibold">{finalReport.preparedBy || engagement.owner}</span></div>
          <div><span className="text-text-muted block text-[0.625rem] font-medium mb-0.5">Reviewed By</span><span className="text-text font-semibold">{finalReport.reviewedBy || engagement.reviewer || '—'}</span></div>
          <div><span className="text-text-muted block text-[0.625rem] font-medium mb-0.5">Report Date</span><span className="text-text font-semibold">{finalReport.reportDate || '—'}</span></div>
          <div><span className="text-text-muted block text-[0.625rem] font-medium mb-0.5">Status</span><span className={`px-2 py-0.5 rounded-full text-[0.5625rem] font-bold ${REPORT_STATUS_CLS[finalReport.status]}`}>{finalReport.status.replace(/_/g, ' ')}</span></div>
          <div className="col-span-2"><span className="text-text-muted block text-[0.625rem] font-medium mb-0.5">Distribution</span><span className="text-text font-semibold">{finalReport.distributionList || '—'}</span></div>
        </div>
        {isIssued && finalReport.issuedAt && (
          <div className="mt-3 flex items-start gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-[0.6875rem] text-emerald-700">
            <CheckCircle2 size={13} className="shrink-0 mt-0.5" />
            <span>Report issued on {finalReport.issuedAt} by {finalReport.issuedBy}.</span>
          </div>
        )}
      </div>

      {/* ══ Appendix ══ */}
      <div className="bg-white rounded-xl border border-border-light p-5">
        <h3 className="text-[0.8125rem] font-bold text-text mb-2 flex items-center gap-2"><FileText size={14} className="text-primary" /> Appendix</h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[0.6875rem]">
          <div className="flex justify-between border-b border-border-light/40 py-1"><span className="text-text-muted">Working Paper</span><span className="text-text font-medium">Available</span></div>
          <div className="flex justify-between border-b border-border-light/40 py-1"><span className="text-text-muted">IDR Requests</span><span className="text-text font-medium">{iaState.requests.requests.length}</span></div>
          <div className="flex justify-between border-b border-border-light/40 py-1"><span className="text-text-muted">Analysis Runs</span><span className="text-text font-medium">{completedRuns.length}</span></div>
          <div className="flex justify-between border-b border-border-light/40 py-1"><span className="text-text-muted">Scope Sources</span><span className="text-text font-medium">{iaState.scope.sopIds.length + iaState.scope.racmVersionIds.length + iaState.scope.checklistIds.length}</span></div>
        </div>
      </div>

      {/* ══ Report History ══ */}
      {finalReport.history.length > 0 && (
        <div className="rounded-lg border border-border-light p-4">
          <h4 className="text-[0.6875rem] font-bold text-text mb-2">Report History</h4>
          <div className="space-y-1">{finalReport.history.map(h => (
            <div key={h.id} className="text-[0.5625rem] text-gray-500"><span className="font-semibold text-text">{h.action.replace(/_/g, ' ')}</span> by {h.actor} · {h.timestamp}{h.comments ? ` — ${h.comments}` : ''}</div>
          ))}</div>
        </div>
      )}

      {/* ══ Actions ══ */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => alert('Report download will be connected later.')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-light text-[0.6875rem] font-medium text-text-muted hover:bg-surface-2/30 cursor-pointer transition-colors">
          <Download size={12} />Download Draft
        </button>
        {isDraft && (
          <button onClick={handleMarkReady}
            className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[0.6875rem] font-semibold cursor-pointer transition-colors">Mark Ready for Review</button>
        )}
        {isReadyForReview && (
          <button onClick={handleIssue}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[0.75rem] font-semibold cursor-pointer transition-colors flex items-center gap-1.5">
            <CheckCircle2 size={13} />Issue Final Report
          </button>
        )}
        <button onClick={() => onNavigateTab?.('action-plan')} disabled={!isIssued}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.6875rem] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          Continue to Action Plan <ChevronRight size={11} />
        </button>
      </div>
    </div>
  );
}
