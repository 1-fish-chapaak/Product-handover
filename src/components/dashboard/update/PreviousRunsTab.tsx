import { emptyRunListMessage, type LinkedWorkflow, type WorkflowRun } from '../../../data/dashboardUpdate';
import WorkflowRunItem from './WorkflowRunItem';
import { sectionCls } from './theme';

export interface RunPick { workflowId: string; runId: string }

const RUNS_LIMIT = 20;

/** Previous Runs: each workflow's completed runs from this dashboard. Picking
 *  one mirrors its outputs onto the dashboard (no re-run) — fresh runs live on
 *  Run Workflows / Sync Live Data instead. */
export default function PreviousRunsTab({ workflows, runs, currentRunByWorkflow, pending, applying, disabled, onPick, onConfirm, onCancel, onOpen }: {
  workflows: LinkedWorkflow[];
  runs: WorkflowRun[];
  currentRunByWorkflow: Record<string, string>;
  pending: RunPick | null;
  applying: RunPick | null;
  disabled: boolean;
  onPick: (pick: RunPick) => void;
  onConfirm: () => void;
  onCancel: () => void;
  onOpen: (run: WorkflowRun) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {workflows.map(w => {
        const own = runs.filter(r => r.workflowId === w.id).slice(0, RUNS_LIMIT);
        const current = currentRunByWorkflow[w.id];
        return (
          <section key={w.id} className={sectionCls} data-testid="run-list">
            <h3 className="text-sm font-semibold text-ink-900 mb-3">{w.name}</h3>
            {own.length === 0 && <p className="text-xs text-ink-500">{emptyRunListMessage(w)}</p>}
            {/* ~4 rows visible; the rest scroll inside this list. */}
            {own.length > 0 && (
              <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
                {own.map(run => (
                  <WorkflowRunItem
                    key={run.id}
                    run={run}
                    isCurrent={run.id === current}
                    isPending={pending?.runId === run.id}
                    isApplying={applying?.runId === run.id}
                    disabled={disabled}
                    onPick={() => onPick({ workflowId: w.id, runId: run.id })}
                    onConfirm={onConfirm}
                    onCancel={onCancel}
                    onOpen={() => onOpen(run)}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
