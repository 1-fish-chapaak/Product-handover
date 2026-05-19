// ─── Automation Project — Schedule Tab ────────────────────────────────────
// Configure recurring automation runs. Final Automation Project tab.

import React from 'react';
import {
  CheckCircle2, AlertCircle, ChevronRight, Lock, Info, Play, Pause, Power, Clock,
} from 'lucide-react';
import type { ConfigurableEngagement, AutomationProjectConfig } from '../../configurableEngagementTypes';
import type { AutomationProjectWorkspaceState } from './automationInputData';
import { SETUP_MODE_LABELS } from './automationSetupData';
import {
  deriveScheduleRequirement, calculateNextRun, SCHEDULE_STATUS_CLS,
  type AutomationScheduleState, type ScheduleStatus,
} from './automationScheduleData';

const inputCls = 'w-full px-3 py-2 border border-border rounded-lg text-[12px] text-text bg-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all';
const labelCls = 'text-[11px] font-semibold text-text-muted block mb-1';
const FREQ_OPTIONS = [{ v: 'DAILY', l: 'Daily' }, { v: 'WEEKLY', l: 'Weekly' }, { v: 'MONTHLY', l: 'Monthly' }, { v: 'QUARTERLY', l: 'Quarterly' }, { v: 'CUSTOM', l: 'Custom' }];

function now(): string { return new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }

interface Props {
  engagement: ConfigurableEngagement;
  automationState: AutomationProjectWorkspaceState;
  schedule: AutomationScheduleState;
  onUpdateSchedule: (state: AutomationScheduleState) => void;
  onNavigateTab?: (tabId: string) => void;
}

export default function AutomationScheduleTab({ engagement, automationState, schedule, onUpdateSchedule, onNavigateTab }: Props) {
  const cfg = engagement.config as AutomationProjectConfig;
  const { required, canSchedule, blockingReasons, warnings } = deriveScheduleRequirement(cfg, automationState);
  const completedRuns = automationState.runs.runs.filter(r => r.status === 'COMPLETED');
  const wfNames = automationState.setup.selectedWorkflowNames?.length ? automationState.setup.selectedWorkflowNames : (automationState.setup.selectedWorkflowName ? [automationState.setup.selectedWorkflowName] : []);
  const wfName = wfNames.length > 1 ? `${wfNames.length} Workflows` : (wfNames[0] || automationState.setup.draftWorkflow?.name || 'Not selected');
  const isActive = schedule.status === 'ACTIVE';
  const isPaused = schedule.status === 'PAUSED';
  const isDisabled = schedule.status === 'DISABLED';
  const nextRun = calculateNextRun(schedule.startDate, schedule.frequency, schedule.runTime);

  const update = <K extends keyof AutomationScheduleState>(f: K, v: AutomationScheduleState[K]) => onUpdateSchedule({ ...schedule, [f]: v });

  const addHistory = (action: string, comments: string = '') => ({ id: `sh-${Date.now()}`, action, actor: engagement.owner, timestamp: now(), comments });

  const activate = () => {
    if (!canSchedule) return;
    onUpdateSchedule({ ...schedule, status: 'ACTIVE', nextRunAt: nextRun, history: [...schedule.history, addHistory('ACTIVATED')] });
  };
  const pause = () => onUpdateSchedule({ ...schedule, status: 'PAUSED', history: [...schedule.history, addHistory('PAUSED')] });
  const resume = () => onUpdateSchedule({ ...schedule, status: 'ACTIVE', nextRunAt: nextRun, history: [...schedule.history, addHistory('RESUMED')] });
  const disable = () => onUpdateSchedule({ ...schedule, status: 'DISABLED', nextRunAt: null, history: [...schedule.history, addHistory('DISABLED')] });
  const saveDraft = () => {
    const hist = schedule.history.length === 0 ? addHistory('CREATED') : addHistory('UPDATED');
    onUpdateSchedule({ ...schedule, status: 'DRAFT', history: [...schedule.history, hist] });
  };

  // Not required
  if (!required) {
    return (
      <div className="space-y-4">
        <div><h3 className="text-[15px] font-bold text-text mb-0.5">Schedule</h3><p className="text-[12px] text-text-muted">Configure recurring automation execution.</p></div>
        <div className="rounded-xl border-2 border-gray-200 bg-gray-50/30 p-6 text-center space-y-3">
          <Clock size={28} className="text-gray-300 mx-auto" />
          <h4 className="text-[14px] font-semibold text-text">Schedule Not Required</h4>
          <p className="text-[12px] text-text-muted">This project is configured as {cfg.runType.replace(/_/g, ' ').toLowerCase()}. No recurring schedule is needed.</p>
          <div className="text-[11px] text-gray-500">Completed runs: {completedRuns.length} · Reports: {automationState.reports.reports.filter(r => r.status === 'FINAL').length} final</div>
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-border-light text-[10px] text-gray-500 text-left max-w-md mx-auto">
            <Info size={11} className="shrink-0 mt-0.5" /><span>Project closure/operational handoff will be connected later.</span>
          </div>
        </div>
        <ProjectReadinessPanel automationState={automationState} cfg={cfg} required={false} isActive={false} />
      </div>
    );
  }

  // Blocked
  if (!canSchedule) {
    return (
      <div className="space-y-4">
        <div><h3 className="text-[15px] font-bold text-text mb-0.5">Schedule</h3><p className="text-[12px] text-text-muted">Configure recurring automation execution.</p></div>
        <div className="rounded-xl border-2 border-gray-200 bg-gray-50/30 p-6 text-center space-y-3">
          <Lock size={28} className="text-gray-300 mx-auto" />
          <h4 className="text-[14px] font-semibold text-text">Schedule Setup Blocked</h4>
          <div className="space-y-1 text-left max-w-md mx-auto">{blockingReasons.map((r, i) => (
            <div key={i} className="flex items-start gap-2 text-[11px] text-red-600"><AlertCircle size={12} className="shrink-0 mt-0.5" /><span>{r}</span></div>
          ))}</div>
          {warnings.map((w, i) => <div key={i} className="flex items-start gap-2 text-[10px] text-amber-600 max-w-md mx-auto"><AlertCircle size={11} className="shrink-0 mt-0.5" /><span>{w}</span></div>)}
          <button onClick={() => onNavigateTab?.('automation-setup')} className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-[12px] font-semibold cursor-pointer transition-colors inline-flex items-center gap-1">Go to Automation Setup <ChevronRight size={12} /></button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[15px] font-bold text-text mb-0.5">Schedule</h3>
          <p className="text-[12px] text-text-muted">Configure recurring automation execution and monitoring.</p>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 ${SCHEDULE_STATUS_CLS[schedule.status]}`}>{schedule.status.replace(/_/g, ' ')}</span>
      </div>

      {/* Warnings */}
      {warnings.map((w, i) => (
        <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[10px] text-amber-700">
          <AlertCircle size={11} className="shrink-0 mt-0.5" /><span>{w}</span>
        </div>
      ))}

      {/* Summary */}
      <div className="grid grid-cols-7 gap-2">
        {[
          { label: 'Status', value: schedule.status === 'NOT_CONFIGURED' ? 'Not Set' : schedule.status.replace(/_/g, ' ') },
          { label: 'Frequency', value: schedule.frequency || cfg.frequency || '—' },
          { label: 'Next Run', value: isActive && nextRun ? nextRun.split(',')[0] : '—' },
          { label: 'Last Run', value: schedule.lastRunAt || '—' },
          { label: 'Workflow', value: wfName.length > 12 ? wfName.slice(0, 11) + '…' : wfName },
          { label: 'Notify', value: schedule.notificationRecipients ? 'Yes' : '—' },
          { label: 'Auto', value: [schedule.autoCreateCases && 'Cases', schedule.autoGenerateReport && 'Report'].filter(Boolean).join('+') || '—' },
        ].map(s => (
          <div key={s.label} className="rounded-lg border border-border-light p-2 text-center">
            <div className="text-[13px] font-bold tabular-nums text-text">{s.value}</div>
            <div className="text-[8px] text-gray-400 font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Schedule form */}
      <div className="rounded-lg border border-border-light p-4 space-y-3">
        <h4 className="text-[11px] font-bold text-text">Schedule Configuration</h4>
        <div className="grid grid-cols-3 gap-3">
          <div><label className={labelCls}>Frequency</label><select value={schedule.frequency || cfg.frequency || ''} onChange={e => update('frequency', e.target.value)} className={inputCls + ' cursor-pointer appearance-none'} disabled={isActive}>{FREQ_OPTIONS.map(f => <option key={f.v} value={f.v}>{f.l}</option>)}</select></div>
          <div><label className={labelCls}>Start Date</label><input type="date" value={schedule.startDate} onChange={e => update('startDate', e.target.value)} className={inputCls} disabled={isActive} /></div>
          <div><label className={labelCls}>End Date (optional)</label><input type="date" value={schedule.endDate} onChange={e => update('endDate', e.target.value)} className={inputCls} disabled={isActive} /></div>
          <div><label className={labelCls}>Run Time</label><input type="time" value={schedule.runTime} onChange={e => update('runTime', e.target.value)} className={inputCls} disabled={isActive} /></div>
          <div><label className={labelCls}>Timezone</label><input value={schedule.timezone} onChange={e => update('timezone', e.target.value)} className={inputCls} disabled={isActive} /></div>
          <div><label className={labelCls}>Workflow{wfNames.length > 1 ? 's' : ''}</label><input value={wfName} disabled className={inputCls + ' bg-gray-50'} />{wfNames.length > 1 && <div className="flex flex-wrap gap-1 mt-1">{wfNames.map((n, i) => <span key={i} className="px-1.5 py-0.5 rounded bg-purple-50 text-[8px] text-purple-700">{n}</span>)}</div>}</div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={labelCls}>Notification Recipients</label><input value={schedule.notificationRecipients} onChange={e => update('notificationRecipients', e.target.value)} placeholder="e.g. owner@company.com" className={inputCls} disabled={isActive} /></div>
          <div><label className={labelCls}>Failure Notifications</label><input value={schedule.failureNotificationRecipients} onChange={e => update('failureNotificationRecipients', e.target.value)} placeholder="e.g. ops-team@company.com" className={inputCls} disabled={isActive} /></div>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-[11px] text-text cursor-pointer">
            <input type="checkbox" checked={schedule.autoCreateCases} onChange={e => update('autoCreateCases', e.target.checked)} className="w-3.5 h-3.5 rounded border-border accent-[#6a12cd] cursor-pointer" disabled={isActive} />Auto-create cases from exceptions
          </label>
          <label className="flex items-center gap-2 text-[11px] text-text cursor-pointer">
            <input type="checkbox" checked={schedule.autoGenerateReport} onChange={e => update('autoGenerateReport', e.target.checked)} className="w-3.5 h-3.5 rounded border-border accent-[#6a12cd] cursor-pointer" disabled={isActive} />Auto-generate report after run
          </label>
        </div>
      </div>

      {/* Next run preview */}
      {(schedule.startDate && schedule.runTime) && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
          <h4 className="text-[11px] font-bold text-text flex items-center gap-1.5"><Clock size={12} className="text-primary" />Next Run Preview</h4>
          <div className="grid grid-cols-4 gap-3 text-[11px]">
            <div><span className="text-gray-400 block text-[10px]">Next Run</span><span className="text-text font-medium">{nextRun || 'Not calculated'}</span></div>
            <div><span className="text-gray-400 block text-[10px]">Workflow{wfNames.length > 1 ? 's' : ''}</span><span className="text-text font-medium">{wfName}</span></div>
            <div><span className="text-gray-400 block text-[10px]">Input Sources</span><span className="text-text font-medium">{automationState.inputData.selectedSourceIds.length} selected</span></div>
            <div><span className="text-gray-400 block text-[10px]">Auto Actions</span><span className="text-text font-medium">{[schedule.autoCreateCases && 'Cases', schedule.autoGenerateReport && 'Report'].filter(Boolean).join(', ') || 'None'}</span></div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        {!isActive && !isPaused && <button onClick={saveDraft} className="px-3 py-1.5 rounded-lg border border-border-light text-[11px] font-medium text-text-muted hover:bg-surface-2/30 cursor-pointer transition-colors">Save Draft</button>}
        {!isActive && !isPaused && (
          <button onClick={activate} disabled={!canSchedule || !schedule.startDate || !schedule.runTime}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5">
            <Play size={12} />Activate Schedule
          </button>
        )}
        {isActive && <button onClick={pause} className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-semibold cursor-pointer transition-colors flex items-center gap-1.5"><Pause size={11} />Pause</button>}
        {isPaused && <button onClick={resume} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold cursor-pointer transition-colors flex items-center gap-1.5"><Play size={11} />Resume</button>}
        {(isActive || isPaused) && <button onClick={disable} className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 bg-red-50 text-[11px] font-semibold cursor-pointer transition-colors flex items-center gap-1.5"><Power size={11} />Disable</button>}
        {isActive && <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-[10px] text-emerald-700 flex-1"><CheckCircle2 size={11} className="shrink-0 mt-0.5" /><span>Schedule is active. Next run: {nextRun || '—'}. Real execution will be connected later.</span></div>}
      </div>

      {/* Notes */}
      <div className="rounded-lg border border-border-light p-4 space-y-2">
        <h4 className="text-[11px] font-bold text-text">Schedule Notes</h4>
        <textarea value={schedule.scheduleNotes} onChange={e => update('scheduleNotes', e.target.value)} rows={2} placeholder="Schedule assumptions, monitoring notes..." className={inputCls + ' resize-none'} />
      </div>

      {/* Monitoring */}
      <div className="rounded-lg border border-border-light p-4 space-y-2">
        <h4 className="text-[11px] font-bold text-text">Run Monitoring</h4>
        <div className="space-y-1 text-[10px] text-gray-500">
          <div className="flex items-center gap-2"><Info size={10} className="text-gray-400" />Scheduled runs will appear in the Runs tab.</div>
          <div className="flex items-center gap-2"><Info size={10} className="text-gray-400" />Failures will notify configured recipients (integration pending).</div>
          <div className="flex items-center gap-2"><Info size={10} className="text-gray-400" />Exceptions from scheduled runs can become case candidates.</div>
          <div className="flex items-center gap-2"><Info size={10} className="text-gray-400" />Approved outputs can feed automated reports.</div>
        </div>
      </div>

      {/* History */}
      {schedule.history.length > 0 && (
        <div className="rounded-lg border border-border-light p-4">
          <h4 className="text-[11px] font-bold text-text mb-1">Schedule History</h4>
          <div className="space-y-1">{schedule.history.map(h => (
            <div key={h.id} className="text-[9px] text-gray-500"><span className="font-semibold text-text">{h.action}</span> by {h.actor} · {h.timestamp}{h.comments ? ` — ${h.comments}` : ''}</div>
          ))}</div>
        </div>
      )}

      {/* Project readiness */}
      <ProjectReadinessPanel automationState={automationState} cfg={cfg} required={required} isActive={isActive} />
    </div>
  );
}

// ─── Project Readiness Panel ──────────────────────────────────────────────

function ProjectReadinessPanel({ automationState, cfg, required, isActive }: { automationState: AutomationProjectWorkspaceState; cfg: AutomationProjectConfig; required: boolean; isActive: boolean }) {
  const completedRuns = automationState.runs.runs.filter(r => r.status === 'COMPLETED');
  const hasReport = cfg.outputTypes.includes('REPORT');
  const hasCaseMgmt = cfg.outputTypes.includes('CASE_MANAGEMENT');

  const checks = [
    { label: 'Input data configured', ok: automationState.inputData.dataSources.length > 0 || automationState.inputData.proceedWithoutData },
    { label: 'Automation setup ready', ok: automationState.setup.setupStatus === 'READY_FOR_RUN' || (automationState.setup.selectedWorkflowIds?.length > 0) || !!automationState.setup.selectedWorkflowId || automationState.setup.draftWorkflow?.status === 'READY' || automationState.setup.qaSetup?.status === 'READY' },
    { label: 'At least one run completed', ok: completedRuns.length > 0 },
    { label: 'Output review completed', ok: automationState.outputReview.approvedOutputIds.length > 0 || !hasReport },
    ...(hasCaseMgmt ? [{ label: 'Cases reviewed', ok: automationState.cases.cases.length > 0 || automationState.runs.runs.flatMap(r => r.exceptions).filter(e => e.status === 'CASE_CANDIDATE').length === 0 }] : []),
    ...(hasReport ? [{ label: 'Report finalized', ok: automationState.reports.reports.some(r => r.status === 'FINAL') }] : []),
    ...(required ? [{ label: 'Schedule active', ok: isActive }] : []),
  ];
  const allOk = checks.every(c => c.ok);

  return (
    <div className="rounded-lg border border-border-light p-4 space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-[11px] font-bold text-text">Automation Project Readiness</h4>
        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${allOk ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{allOk ? 'Ready to Operate' : 'In Progress'}</span>
      </div>
      <div className="space-y-1">{checks.map(c => (
        <div key={c.label} className="flex items-center gap-2 text-[10px]">
          {c.ok ? <CheckCircle2 size={10} className="text-emerald-500" /> : <AlertCircle size={10} className="text-amber-400" />}
          <span className={c.ok ? 'text-gray-500' : 'text-text'}>{c.label}</span>
        </div>
      ))}</div>
      <div className="flex items-start gap-2 mt-2 px-3 py-2 rounded-lg bg-gray-50 border border-border-light text-[10px] text-gray-500">
        <Info size={11} className="shrink-0 mt-0.5" /><span>Project closure/operational handoff will be connected later.</span>
      </div>
    </div>
  );
}
