import { GitBranch } from 'lucide-react';
import { useWorkflow } from './WorkflowContext';

/** Additive bulk-header action — opens the Assignment modal for the selected
 *  exceptions. Lives inside the WorkflowProvider so it can call openAssignment. */
export default function WorkflowAssignButton({ selectedIds }: { selectedIds: string[] }) {
  const { openAssignment } = useWorkflow();
  // Always visible. Inactive until cases are selected, with a relatable hover
  // message that tells the user how to enable it — mirrors the Bulk Actions CTA.
  const active = selectedIds.length > 0;
  return (
    <button
      type="button"
      disabled={!active}
      onClick={() => active && openAssignment(selectedIds)}
      title={active
        ? `Assign ${selectedIds.length} selected case${selectedIds.length === 1 ? '' : 's'} to an approval route`
        : 'Select one or more cases to assign them to an approval route.'}
      className={`flex items-center gap-1.5 h-8 px-2.5 text-[12px] font-medium rounded-[8px] border transition-colors ${
        active
          ? 'text-brand-700 bg-canvas-elevated border-canvas-border hover:border-brand-200 cursor-pointer'
          : 'text-ink-400 bg-canvas-elevated border-canvas-border cursor-not-allowed'
      }`}
    >
      <GitBranch size={13} />
      Assign to Route
      {active && (
        <span className="inline-flex items-center h-5 min-w-5 px-1 text-[10.5px] font-semibold bg-brand-50 rounded-full tabular-nums">{selectedIds.length}</span>
      )}
    </button>
  );
}
