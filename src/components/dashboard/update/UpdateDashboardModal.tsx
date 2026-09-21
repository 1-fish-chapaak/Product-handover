import { AnimatePresence } from 'motion/react';
import { Loader2, Save } from 'lucide-react';
import Modal from '../../shared/Modal';
import type { SyncSchedule } from '../sync/syncSchedule';
import LiveDataTab from './LiveDataTab';
import PreviousRunsTab from './PreviousRunsTab';
import RunWorkflowsTab from './RunWorkflowsTab';
import UpdateDashboardStepper from './UpdateDashboardStepper';
import UploadDataTab from './UploadDataTab';
import type { DashboardUpdateState } from './useDashboardUpdateState';
import type { UpdateDashboardDialog } from './useUpdateDashboardDialog';
import { primaryBtnCls } from './theme';

/** "Update Dashboard Data" — one flat segmented control over four independent
 *  modes: Upload Data / Run Workflows / Sync Live Data / Previous Runs, each
 *  offered only when the dashboard has that kind of source. Header, stepper
 *  and footer are pinned; the content scrolls; every segment stays mounted
 *  (hidden, not unmounted) so prepared state survives switching. */
export default function UpdateDashboardModal({ dialog: d, state, dashboardSchedule, lastSyncedLabel }: {
  dialog: UpdateDashboardDialog;
  state: DashboardUpdateState;
  dashboardSchedule: SyncSchedule;
  lastSyncedLabel?: string;
}) {
  const fileWorkflows = state.workflows.filter(w => w.kind === 'file');
  const liveWorkflows = state.workflows.filter(w => w.kind === 'live');
  const runById = new Map(state.runs.map(r => [r.id, r]));
  const currentRunFor = (workflowId: string) => {
    const id = state.currentRunByWorkflow[workflowId];
    return id ? runById.get(id) : undefined;
  };
  const historyBusy = d.applyingPick !== null;
  const showUpload = state.hasFiles;
  const showRuns = state.hasFileWorkflows || state.hasLive;

  return (
    <AnimatePresence>
      {d.isOpen && (
        <Modal
          title="Update Dashboard Data"
          ariaLabel="Update Dashboard Data"
          width="max-w-[800px]"
          height={d.showStepper ? 'h-[85vh]' : undefined}
          onClose={d.close}
          headerExtra={d.showStepper || d.description ? (
            <>
              {d.showStepper && <UpdateDashboardStepper step={d.step} segments={d.segments} onStepChange={d.setStep} />}
              {d.description && <p className="text-xs text-ink-500 mt-2.5" data-testid="update-segment-description">{d.description}</p>}
            </>
          ) : undefined}
          // Save is the Upload segment's action — runs apply themselves.
          footer={d.step === 'upload' && showUpload ? (
            <>
              <p className="flex-1 text-xs text-ink-500" data-testid="upload-save-status">{d.saveStatus}</p>
              <button type="button" onClick={d.save} disabled={!d.canSave} className={primaryBtnCls} data-testid="upload-save">
                {d.replacements.applying ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save
              </button>
            </>
          ) : undefined}
        >
          {showUpload && (
            <div className={d.step === 'upload' ? '' : 'hidden'} data-testid="pane-upload">
              <UploadDataTab
                sources={state.files}
                pool={d.uploadPool}
                replacements={d.replacements}
                onRemovePoolFile={d.removeUploadPoolFile}
              />
            </div>
          )}
          {state.hasFileWorkflows && (
            <div className={d.step === 'bulk' ? '' : 'hidden'} data-testid="pane-bulk">
              <RunWorkflowsTab
                workflows={fileWorkflows}
                pool={d.bulkPool}
                slots={d.slots}
                selection={d.bulkSelection}
                batch={d.bulkBatch}
                onRemovePoolFile={d.removeBulkPoolFile}
                onBulkRun={d.startBulkRun}
                disabled={historyBusy}
              />
            </div>
          )}
          {state.hasLive && (
            <div className={d.step === 'live' ? '' : 'hidden'} data-testid="pane-live">
              <LiveDataTab
                workflows={liveWorkflows}
                currentRunFor={currentRunFor}
                selection={d.liveSelection}
                batch={d.liveBatch}
                dashboardSchedule={dashboardSchedule}
                workflowSchedules={state.workflowSchedules}
                lastSyncedLabel={lastSyncedLabel}
                editor={d.scheduleEditor}
                onOpenEditor={d.openScheduleEditor}
                onCloseEditor={d.closeScheduleEditor}
                onSaveSchedule={d.saveSchedule}
                onSyncNow={d.startLiveSync}
                disabled={historyBusy}
              />
            </div>
          )}
          {showRuns && (
            <div className={d.step === 'history' ? '' : 'hidden'} data-testid="pane-history">
              <PreviousRunsTab
                workflows={state.workflows}
                runs={state.runs}
                currentRunByWorkflow={state.currentRunByWorkflow}
                pending={d.pendingPick}
                applying={d.applyingPick}
                disabled={historyBusy || d.bulkBatch.isBusy || d.liveBatch.isBusy}
                onPick={d.pickRun}
                onConfirm={d.confirmPick}
                onCancel={d.cancelPick}
                onOpen={d.openRun}
              />
            </div>
          )}
        </Modal>
      )}
    </AnimatePresence>
  );
}
