import Checkbox from '../../shared/Checkbox';
import type { LinkedWorkflow } from '../../../data/dashboardUpdate';
import type { PoolFile } from './useFilePool';
import type { InputSlots } from './useInputSlots';
import WorkflowInputSlotRow from './WorkflowInputSlotRow';
import { innerPanelCls, sectionCls } from './theme';

/** Step 1 card for one linked workflow: include/exclude checkbox and its
 *  replaceable inputs, or why it has none (never ran). */
export default function WorkflowRunCard({ workflow, slots, disabled, selected, onToggleSelected, pool }: {
  workflow: LinkedWorkflow;
  slots: InputSlots;
  disabled: boolean;
  selected: boolean;
  onToggleSelected: () => void;
  pool: PoolFile[];
}) {
  const neverRan = workflow.neverRan === true;
  return (
    <section className={`${sectionCls} transition-opacity ${selected || neverRan ? '' : 'opacity-60'}`} data-testid="bulk-workflow-card">
      <div className="flex items-center gap-2.5 mb-2">
        {!neverRan && (
          <Checkbox
            checked={selected}
            onChange={onToggleSelected}
            disabled={disabled}
            ariaLabel={selected ? `Exclude ${workflow.name} from the bulk run` : `Include ${workflow.name} in the bulk run`}
          />
        )}
        <h3 className="text-sm font-semibold text-ink-900 truncate">{workflow.name}</h3>
      </div>
      {neverRan && (
        <p className="text-xs text-ink-500">Never run yet, so it can’t be part of the bulk run. Run it once from the workflow executor first.</p>
      )}
      {!neverRan && !selected && (
        <p className="text-xs text-ink-500">Excluded from this bulk run. Tick the box to include it.</p>
      )}
      {!neverRan && selected && workflow.inputs.length === 0 && (
        <p className="text-xs text-ink-500">No replaceable file inputs. It will run with its last-used inputs.</p>
      )}
      {!neverRan && selected && workflow.inputs.length > 0 && (
        <div className={`flex flex-col gap-1.5 px-3 py-2 ${innerPanelCls}`}>
          <p className="text-xs font-semibold text-brand-700 uppercase tracking-wide">Inputs for the next run</p>
          {workflow.inputs.map(input => (
            <WorkflowInputSlotRow
              key={input.inputName}
              input={input}
              slot={slots.slotFor(workflow.id, input.inputName)}
              disabled={disabled}
              pool={pool}
              onAssign={poolFile => slots.assign(workflow.id, input, poolFile)}
              onClear={() => slots.clear(workflow.id, input.inputName)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
