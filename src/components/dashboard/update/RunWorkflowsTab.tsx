import { AlertTriangle, ListChecks, PlayCircle } from 'lucide-react';
import type { LinkedWorkflow } from '../../../data/dashboardUpdate';
import FilePoolSection from './FilePoolSection';
import RunStatusPanel from './RunStatusPanel';
import WorkflowRunCard from './WorkflowRunCard';
import type { FilePool } from './useFilePool';
import type { InputSlots } from './useInputSlots';
import type { WorkflowBatch } from './useWorkflowBatch';
import type { WorkflowSelection } from './useWorkflowSelection';
import { linkBtnCls, primaryBtnCls } from './theme';

/** Run Workflows: Step 1 adds files to the pool, assigns them from dropdowns
 *  and ticks which workflows to include (all by default). Step 2 runs those,
 *  once every ticked workflow's inputs carry a file. */
export default function RunWorkflowsTab({ workflows, pool, slots, selection, batch, onRemovePoolFile, onBulkRun, disabled }: {
  workflows: LinkedWorkflow[];
  pool: FilePool;
  slots: InputSlots;
  selection: WorkflowSelection;
  batch: WorkflowBatch;
  onRemovePoolFile: (sourceId: string) => void;
  onBulkRun: (selected: LinkedWorkflow[]) => void;
  /** Another surface of the dialog has work in flight (a run-pin apply). */
  disabled: boolean;
}) {
  const runnable = workflows.filter(w => !w.neverRan);
  const selectedRunnable = runnable.filter(w => selection.isSelected(w.id));
  const selectedIds = selectedRunnable.map(w => w.id);
  const batchBusy = batch.isBusy;
  // Every input of every TICKED workflow — this set IS the run gate.
  const requiredSlots = selectedRunnable.reduce((n, w) => n + w.inputs.length, 0);
  const requiredReady = slots.readyCountFor(selectedIds);
  const allMapped = requiredReady === requiredSlots;
  // Pool files this run won't consume: the pool clears at start, so a silent
  // discard would betray the upload. Split: never assigned vs parked on a
  // workflow that isn't ticked.
  const usedByAll = slots.readySourceIdsFor(workflows.map(w => w.id));
  const usedBySelected = slots.readySourceIdsFor(selectedIds);
  const unassigned = pool.readyPool.filter(p => !usedByAll.has(p.sourceId));
  const parked = pool.readyPool.filter(p => usedByAll.has(p.sourceId) && !usedBySelected.has(p.sourceId));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-brand-700 uppercase tracking-wide">Step 1 · Check inputs</p>
          <p className="text-xs text-ink-500">Add files to the pool, then give every input of the workflows you tick a file.</p>
        </div>
        {selection.deselectedCount > 0 && (
          <button type="button" onClick={() => selection.selectAll()} disabled={batchBusy} className={linkBtnCls} data-testid="bulk-select-all">
            <ListChecks size={13} /> Select all
          </button>
        )}
      </div>
      <FilePoolSection pool={pool} disabled={batchBusy} onRemove={onRemovePoolFile} />
      {workflows.map(w => (
        <WorkflowRunCard
          key={w.id}
          workflow={w}
          slots={slots}
          disabled={batchBusy}
          selected={selection.isSelected(w.id)}
          onToggleSelected={() => selection.toggle(w.id)}
          pool={pool.readyPool}
        />
      ))}
      {requiredSlots > 0 && (
        <p className="text-xs text-ink-500" data-testid="bulk-inputs-assigned">{requiredReady} of {requiredSlots} inputs assigned.</p>
      )}
      <div className="flex flex-col gap-3 pt-1 border-t border-canvas-border">
        <p className="text-xs font-semibold text-brand-700 uppercase tracking-wide pt-2">Step 2 · Run</p>
        {/* Leftover-pool warnings wait until the mapping is DONE: while an
            input is empty the spare file may well be what fills it. */}
        {allMapped && unassigned.length > 0 && (
          <p className="flex items-start gap-1.5 text-xs text-mitigated-700" data-testid="bulk-unassigned-warning">
            <AlertTriangle size={13} className="shrink-0 mt-0.5" />
            {unassigned.length === 1
              ? `“${unassigned[0].name}” isn’t assigned to an input, so this run won’t use it and it will be cleared when the run starts.`
              : `${unassigned.length} files aren’t assigned to an input, so this run won’t use them and they will be cleared when the run starts.`}
          </p>
        )}
        {allMapped && parked.length > 0 && (
          <p className="flex items-start gap-1.5 text-xs text-mitigated-700" data-testid="bulk-deselected-warning">
            <AlertTriangle size={13} className="shrink-0 mt-0.5" />
            {parked.length === 1
              ? `“${parked[0].name}” is assigned to a workflow that isn’t ticked, so this run won’t use it. Tick that workflow to include it.`
              : `${parked.length} files are assigned to workflows that aren’t ticked, so this run won’t use them. Tick those workflows to include them.`}
          </p>
        )}
        <button
          type="button"
          onClick={() => onBulkRun(selectedRunnable)}
          disabled={
            disabled || batch.isStarting || batch.pendingCount > 0 || slots.busyCount > 0 || pool.isUploading ||
            selectedRunnable.length === 0 || requiredSlots === 0 || requiredReady < requiredSlots
          }
          className={`${primaryBtnCls} self-start`}
          title="Run every ticked workflow with the inputs above"
          data-testid="bulk-run-button"
        >
          <PlayCircle size={14} />
          {batch.isStarting ? 'Starting…' : `Bulk run (${selectedRunnable.length} workflow${selectedRunnable.length === 1 ? '' : 's'})`}
        </button>
        <RunStatusPanel batch={batch} />
      </div>
    </div>
  );
}
