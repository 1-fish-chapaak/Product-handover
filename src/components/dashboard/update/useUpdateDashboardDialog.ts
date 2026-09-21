import { useRef, useState } from 'react';
import { useToast } from '../../shared/Toast';
import {
  buildUpdateSegments, firstUpdateSegment, formatRunTimestamp,
  type LinkedWorkflow, type UpdateSegment, type UpdateSegmentId, type WorkflowRun,
} from '../../../data/dashboardUpdate';
import { summarizeSchedule, type SyncSchedule } from '../sync/syncSchedule';
import type { ScheduleEditorTarget } from './LiveDataTab';
import type { RunPick } from './PreviousRunsTab';
import type { DashboardUpdateState } from './useDashboardUpdateState';
import { useFilePool, type FilePool } from './useFilePool';
import { useFileReplacements, type FileReplacements } from './useFileReplacements';
import { useInputSlots, type InputSlots } from './useInputSlots';
import { useWorkflowBatch, type WorkflowBatch } from './useWorkflowBatch';
import { useWorkflowSelection, type WorkflowSelection } from './useWorkflowSelection';

export interface UpdateDashboardDialogArgs {
  state: DashboardUpdateState;
  dashboardName: string;
  /** Writes the dashboard-wide cadence — shared with the header's Auto-sync chip. */
  onDashboardScheduleChange: (next: SyncSchedule) => void;
  /** Widgets moved onto new data — the view re-renders its tiles. */
  onSynced: () => void;
  /** old file name → new file name, so the dashboard's source list follows. */
  onFilesReplaced?: (renames: Record<string, string>) => void;
  /** Audit-log hook: (description, entity). */
  onEvent?: (description: string, entity: string) => void;
}

export interface UpdateDashboardDialog {
  isOpen: boolean;
  step: UpdateSegmentId;
  setStep: (step: UpdateSegmentId) => void;
  segments: UpdateSegment[];
  showStepper: boolean;
  /** The active segment's sub-line; empty while a segment shows a sub-view. */
  description: string;
  open: () => void;
  openAt: (step: UpdateSegmentId) => void;
  close: () => void;
  // Upload Data
  uploadPool: FilePool;
  replacements: FileReplacements;
  removeUploadPoolFile: (sourceId: string) => void;
  save: () => void;
  canSave: boolean;
  saveStatus: string;
  // Run Workflows
  bulkPool: FilePool;
  slots: InputSlots;
  bulkSelection: WorkflowSelection;
  bulkBatch: WorkflowBatch;
  removeBulkPoolFile: (sourceId: string) => void;
  startBulkRun: (selected: LinkedWorkflow[]) => void;
  // Sync Live Data
  liveSelection: WorkflowSelection;
  liveBatch: WorkflowBatch;
  startLiveSync: (selected: LinkedWorkflow[]) => void;
  scheduleEditor: ScheduleEditorTarget | null;
  openScheduleEditor: (target: ScheduleEditorTarget) => void;
  closeScheduleEditor: () => void;
  saveSchedule: (target: ScheduleEditorTarget, next: SyncSchedule) => void;
  // Previous Runs
  pendingPick: RunPick | null;
  applyingPick: RunPick | null;
  pickRun: (pick: RunPick) => void;
  confirmPick: () => void;
  cancelPick: () => void;
  openRun: (run: WorkflowRun) => void;
}

/** Everything the Update-dashboard dialog does, owned by the dashboard view
 *  (not the dialog) so an in-flight batch or a half-built pool survives
 *  closing and reopening — the way the real product keeps polling a batch
 *  after the dialog is dismissed. Green checks are per visit: reset on open. */
export function useUpdateDashboardDialog(args: UpdateDashboardDialogArgs): UpdateDashboardDialog {
  const { state, dashboardName, onDashboardScheduleChange, onSynced, onFilesReplaced, onEvent } = args;
  const { addToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<UpdateSegmentId>('upload');
  const [uploadSaved, setUploadSaved] = useState(false);
  const [runApplied, setRunApplied] = useState(false);
  const [scheduleEditor, setScheduleEditor] = useState<ScheduleEditorTarget | null>(null);
  const [pendingPick, setPendingPick] = useState<RunPick | null>(null);
  const [applyingPick, setApplyingPick] = useState<RunPick | null>(null);

  const uploadPool = useFilePool();
  const replacements = useFileReplacements();

  const bulkPool = useFilePool();
  const slots = useInputSlots();
  const bulkSelection = useWorkflowSelection(true);
  // The files each workflow was started with, so its "last used" inputs follow
  // the run once it lands.
  const startedInputs = useRef<Record<string, Record<string, string>>>({});
  const bulkBatch = useWorkflowBatch({
    onRunCompleted: (workflowId, run) => {
      state.addRun(run, startedInputs.current[workflowId]);
      onSynced();
    },
  });

  const liveSelection = useWorkflowSelection(false);
  const liveBatch = useWorkflowBatch({
    onRunCompleted: (_workflowId, run) => {
      state.addRun(run);
      onSynced();
    },
  });

  const uploadBusy = replacements.busy || replacements.applying || uploadPool.isUploading;
  const segments = buildUpdateSegments({
    hasFiles: state.hasFiles,
    hasWorkflows: state.hasFileWorkflows,
    hasLive: state.hasLive,
    uploadSaved,
    uploadBusy,
    bulkCompleted: bulkBatch.allSucceeded,
    bulkBusy: bulkBatch.isBusy,
    liveSynced: liveBatch.allSucceeded,
    liveBusy: liveBatch.isBusy,
    runApplied,
    historyBusy: applyingPick !== null,
  });
  const available = segments.map(s => s.id);
  const effectiveStep: UpdateSegmentId = available.includes(step) ? step : (available[0] ?? 'upload');
  const description = effectiveStep === 'live' && scheduleEditor
    ? ''
    : (segments.find(s => s.id === effectiveStep)?.description ?? '');

  const openAt = (next: UpdateSegmentId) => {
    setUploadSaved(false);
    setRunApplied(false);
    setPendingPick(null);
    setScheduleEditor(null);
    setStep(next);
    setIsOpen(true);
  };
  const open = () => openAt(firstUpdateSegment({ hasFiles: state.hasFiles, hasWorkflows: state.hasFileWorkflows, hasLive: state.hasLive }));
  const close = () => setIsOpen(false);

  // ── Upload Data ──
  const removeUploadPoolFile = (sourceId: string) => {
    // A dangling swap would apply a source the user removed.
    replacements.clearBySource(sourceId);
    uploadPool.removeFile(sourceId);
  };
  const save = () => {
    const oldNames = Object.fromEntries(state.files.map(f => [f.datasetId, f.displayName]));
    void replacements.apply().then(applied => {
      if (applied.length === 0) return;
      state.replaceFiles(applied);
      onFilesReplaced?.(Object.fromEntries(applied.map(a => [oldNames[a.datasetId], a.newName])));
      uploadPool.reset();
      setUploadSaved(true);
      onSynced();
      addToast({ message: 'Dashboard updated with the new data.', type: 'success' });
      onEvent?.(`Replaced ${applied.length} file${applied.length === 1 ? '' : 's'} behind dashboard "${dashboardName}"`, 'Dashboard data');
      // Stay on the segment (more files may follow) unless it is the only one.
      if (!state.hasFileWorkflows && !state.hasLive) close();
    });
  };
  const canSave = replacements.readyCount > 0 && !replacements.busy && !replacements.applying;
  const saveStatus = replacements.busy
    ? 'Waiting for file processing…'
    : replacements.readyCount === 0 && !replacements.applying
      ? 'Replace at least one file to save.'
      : replacements.readyCount > 1
        ? `${replacements.readyCount} files ready to save.`
        : '';

  // ── Run Workflows ──
  const removeBulkPoolFile = (sourceId: string) => {
    slots.clearBySource(sourceId);
    bulkPool.removeFile(sourceId);
  };
  const startBulkRun = (selected: LinkedWorkflow[]) => {
    if (selected.length === 0) return;
    const inputFiles = Object.fromEntries(selected.map(w => [w.id, slots.filesFor(w)]));
    startedInputs.current = { ...startedInputs.current, ...inputFiles };
    bulkBatch.start(selected, Object.fromEntries(selected.map(w => [w.id, Object.values(inputFiles[w.id])])));
    // Batch started → assignments are consumed and the pool clears, wizard-style.
    slots.resetAll();
    bulkPool.reset();
    onEvent?.(`Ran ${selected.length} workflow${selected.length === 1 ? '' : 's'} from dashboard "${dashboardName}"`, 'Workflow run');
  };

  // ── Sync Live Data ──
  const startLiveSync = (selected: LinkedWorkflow[]) => {
    if (selected.length === 0) return;
    liveBatch.start(selected, {});
    onEvent?.(`Synced ${selected.length} live workflow${selected.length === 1 ? '' : 's'} on dashboard "${dashboardName}"`, 'Live sync');
  };
  const saveSchedule = (target: ScheduleEditorTarget, next: SyncSchedule) => {
    const summary = summarizeSchedule(next).toLowerCase();
    if (target.workflow) {
      state.setWorkflowSchedule(target.workflow.id, next);
      addToast({
        message: next.enabled ? `${target.workflow.name} now runs ${summary}` : `${target.workflow.name} follows the dashboard schedule again`,
        type: next.enabled ? 'success' : 'info',
      });
      onEvent?.(`${next.enabled ? 'Scheduled' : 'Unscheduled'} workflow "${target.workflow.name}" on dashboard "${dashboardName}"`, 'Sync schedule');
    } else {
      onDashboardScheduleChange(next);
      addToast({ message: next.enabled ? `Auto-sync on — ${summary}` : 'Auto-sync turned off', type: next.enabled ? 'success' : 'info' });
      onEvent?.(next.enabled ? `Enabled auto-sync (${summarizeSchedule(next)}) on dashboard "${dashboardName}"` : `Disabled auto-sync on dashboard "${dashboardName}"`, 'Sync schedule');
    }
    setScheduleEditor(null);
  };

  // ── Previous Runs ──
  const confirmPick = () => {
    if (!pendingPick || applyingPick) return;
    const pick = pendingPick;
    setPendingPick(null);
    setApplyingPick(pick);
    window.setTimeout(() => {
      state.pinRun(pick.workflowId, pick.runId);
      setApplyingPick(null);
      setRunApplied(true);
      onSynced();
      addToast({ message: 'Dashboard updated with this run’s data.', type: 'success' });
      onEvent?.(`Put a previous run back on dashboard "${dashboardName}"`, 'Workflow run');
    }, 1200);
  };
  const openRun = (run: WorkflowRun) =>
    addToast({ message: `Opening the run from ${formatRunTimestamp(run.completedAt)} in the workflow executor`, type: 'info' });

  return {
    isOpen,
    step: effectiveStep,
    setStep,
    segments,
    showStepper: segments.length > 1,
    description,
    open,
    openAt,
    close,
    uploadPool,
    replacements,
    removeUploadPoolFile,
    save,
    canSave,
    saveStatus,
    bulkPool,
    slots,
    bulkSelection,
    bulkBatch,
    removeBulkPoolFile,
    startBulkRun,
    liveSelection,
    liveBatch,
    startLiveSync,
    scheduleEditor,
    openScheduleEditor: setScheduleEditor,
    closeScheduleEditor: () => setScheduleEditor(null),
    saveSchedule,
    pendingPick,
    applyingPick,
    pickRun: setPendingPick,
    confirmPick,
    cancelPick: () => setPendingPick(null),
    openRun,
  };
}
