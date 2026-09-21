import { CalendarClock, ListChecks, RefreshCw } from 'lucide-react';
import type { LinkedWorkflow, WorkflowRun } from '../../../data/dashboardUpdate';
import { fmtNextRun, nextRun, summarizeSchedule, type SyncSchedule } from '../sync/syncSchedule';
import LiveScheduleView from './LiveScheduleView';
import LiveWorkflowCard from './LiveWorkflowCard';
import RunStatusPanel from './RunStatusPanel';
import type { WorkflowBatch } from './useWorkflowBatch';
import type { WorkflowSelection } from './useWorkflowSelection';
import { linkBtnCls, primaryBtnCls } from './theme';

/** The editor the tab shows in place of its list: the dashboard-wide cadence
 *  (target null) or one workflow's own. */
export interface ScheduleEditorTarget { workflow: LinkedWorkflow | null }

function scheduleLine(s: SyncSchedule | undefined, now: Date): string {
  if (!s || !s.enabled) return 'off';
  const next = nextRun(s, now);
  return next ? `next ${fmtNextRun(next, now)} (approx.)` : summarizeSchedule(s);
}

/** Sync Live Data: every database-connected workflow behind this dashboard,
 *  with one button that re-runs the ticked ones now. Scheduling those same
 *  runs sits behind "Bulk schedule runs" (dashboard-wide) or each card's own
 *  Schedule button, which swap this list for the cadence editor. */
export default function LiveDataTab({
  workflows, currentRunFor, selection, batch, dashboardSchedule, workflowSchedules, lastSyncedLabel,
  editor, onOpenEditor, onCloseEditor, onSaveSchedule, onSyncNow, disabled,
}: {
  workflows: LinkedWorkflow[];
  currentRunFor: (workflowId: string) => WorkflowRun | undefined;
  selection: WorkflowSelection;
  batch: WorkflowBatch;
  dashboardSchedule: SyncSchedule;
  workflowSchedules: Record<string, SyncSchedule>;
  lastSyncedLabel?: string;
  editor: ScheduleEditorTarget | null;
  onOpenEditor: (target: ScheduleEditorTarget) => void;
  onCloseEditor: () => void;
  onSaveSchedule: (target: ScheduleEditorTarget, next: SyncSchedule) => void;
  onSyncNow: (selected: LinkedWorkflow[]) => void;
  /** A run-pin apply is mid-flight on Previous Runs. */
  disabled: boolean;
}) {
  const now = new Date();
  const runnable = workflows.filter(w => !w.neverRan);
  const selected = runnable.filter(w => selection.isSelected(w.id));
  const batchBusy = batch.isBusy;
  const scheduleOn = dashboardSchedule.enabled;

  const lineFor = (w: LinkedWorkflow) => {
    const own = workflowSchedules[w.id];
    if (!own || !own.enabled) return 'Follows the dashboard schedule';
    const next = nextRun(own, now);
    return next ? `Next schedule · ${fmtNextRun(next, now)} (approx.)` : 'Own schedule';
  };

  if (editor) {
    const wf = editor.workflow;
    return (
      <LiveScheduleView
        key={wf?.id ?? 'dashboard'}
        title={wf ? `Scheduled runs · ${wf.name}` : 'Scheduled runs'}
        description={wf
          ? 'Runs this one workflow on its own schedule. While it is on, the workflow is left out of the dashboard-wide schedule so it never runs twice.'
          : 'Runs automatically on a repeating schedule.'}
        initial={wf ? (workflowSchedules[wf.id] ?? { ...dashboardSchedule, enabled: false }) : dashboardSchedule}
        lastSyncedLabel={lastSyncedLabel}
        onBack={onCloseEditor}
        onSave={next => onSaveSchedule(editor, next)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3 ${scheduleOn ? 'border-brand-200 bg-brand-50' : 'border-canvas-border bg-canvas'}`} data-testid="live-schedule-card">
        <p className="text-xs text-ink-700">
          <span className="font-semibold text-ink-900">Scheduled runs: </span>
          {scheduleLine(dashboardSchedule, now)}
        </p>
      </div>
      <div className="flex items-center justify-between gap-3 pt-1">
        <p className="text-xs text-ink-500" data-testid="live-selected-count">{selected.length} of {runnable.length} selected</p>
        {selected.length < runnable.length && (
          <button type="button" onClick={() => selection.selectAll(runnable.map(w => w.id))} disabled={batchBusy} className={linkBtnCls} data-testid="live-select-all">
            <ListChecks size={13} /> Select all
          </button>
        )}
      </div>
      {workflows.map(w => (
        <LiveWorkflowCard
          key={w.id}
          workflow={w}
          currentRun={currentRunFor(w.id)}
          selected={selection.isSelected(w.id)}
          onToggleSelected={() => selection.toggle(w.id)}
          disabled={batchBusy}
          scheduleLine={lineFor(w)}
          onSchedule={() => onOpenEditor({ workflow: w })}
        />
      ))}
      {/* Sticky footer: pinned to the bottom of the dialog's scrolling body so
          "Sync now" stays reachable while a long list scrolls under it.
          Negative margins stretch it across the body's padding. */}
      <div className="sticky -bottom-5 -mx-7 -mb-5 px-7 pb-5 flex flex-col gap-3 pt-1 border-t border-canvas-border bg-canvas-elevated rounded-b-2xl">
        <div className="pt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={() => onSyncNow(selected)}
            disabled={disabled || batchBusy || selected.length === 0}
            className={primaryBtnCls}
            title="Re-run the ticked workflows against their live sources and update this dashboard"
            data-testid="live-sync-now"
          >
            <RefreshCw size={14} />
            {batch.isStarting ? 'Starting…' : `Sync now (${selected.length} workflow${selected.length === 1 ? '' : 's'})`}
          </button>
          <button
            type="button"
            onClick={() => onOpenEditor({ workflow: null })}
            className={primaryBtnCls}
            title="Set one schedule for every live workflow on this dashboard"
            data-testid="live-bulk-schedule"
          >
            <CalendarClock size={14} /> Bulk schedule runs
          </button>
        </div>
        <RunStatusPanel batch={batch} controls />
      </div>
    </div>
  );
}
