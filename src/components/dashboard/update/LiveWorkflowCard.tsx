import { CalendarClock, Database } from 'lucide-react';
import Checkbox from '../../shared/Checkbox';
import { describeLastSync, type LinkedWorkflow, type WorkflowRun } from '../../../data/dashboardUpdate';
import { outlineBtnCls, sectionCls } from './theme';

/** One database-connected workflow in the Sync Live Data list: include/exclude
 *  checkbox, its name, when this dashboard last took data from it, and its
 *  own schedule (or that it follows the dashboard's) with a button to change it. */
export default function LiveWorkflowCard({ workflow, currentRun, selected, onToggleSelected, disabled, scheduleLine, onSchedule }: {
  workflow: LinkedWorkflow;
  currentRun: WorkflowRun | undefined;
  selected: boolean;
  onToggleSelected: () => void;
  disabled: boolean;
  scheduleLine: string;
  onSchedule: () => void;
}) {
  const neverRan = workflow.neverRan === true;
  return (
    <section className={`${sectionCls} px-4 py-3 transition-opacity ${selected || neverRan ? '' : 'opacity-60'}`} data-testid="live-workflow-card">
      <div className="flex items-center gap-2.5">
        {!neverRan && (
          <Checkbox
            checked={selected}
            onChange={onToggleSelected}
            disabled={disabled}
            ariaLabel={selected ? `Exclude ${workflow.name} from the sync` : `Include ${workflow.name} in the sync`}
          />
        )}
        <Database size={14} className="text-ink-500 shrink-0" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-ink-900 truncate">{workflow.name}</h3>
          {neverRan ? (
            <p className="text-xs text-ink-500">Never run yet, so it can’t be synced. Run it once from the workflow executor first.</p>
          ) : (
            <>
              <p className="text-xs text-ink-500">{describeLastSync(currentRun)}{workflow.sourceName ? ` · ${workflow.sourceName}` : ''}</p>
              <p className="flex items-center gap-1 text-xs text-ink-500 mt-0.5" data-testid="live-workflow-schedule-line">
                <CalendarClock size={12} className="shrink-0" />
                {scheduleLine}
              </p>
            </>
          )}
        </div>
        {!neverRan && (
          <button type="button" onClick={onSchedule} className={outlineBtnCls} title="Give this workflow its own schedule" data-testid="live-workflow-schedule">
            <CalendarClock size={13} /> Schedule
          </button>
        )}
      </div>
    </section>
  );
}
