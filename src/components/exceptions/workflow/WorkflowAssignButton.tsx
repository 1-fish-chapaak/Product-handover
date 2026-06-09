import { GitBranch } from 'lucide-react';
import { useWorkflow } from './WorkflowContext';

/** Additive bulk-header action — opens the Assignment modal for the selected
 *  exceptions. Lives inside the WorkflowProvider so it can call openAssignment. */
export default function WorkflowAssignButton({ selectedIds }: { selectedIds: string[] }) {
  const { openAssignment } = useWorkflow();
  if (selectedIds.length === 0) return null;
  return (
    <button
      onClick={() => openAssignment(selectedIds)}
      title={`Assign ${selectedIds.length} selected to an approval route`}
      className="flex items-center gap-1.5 h-8 px-2.5 text-[12px] font-medium rounded-[8px] border text-brand-700 bg-canvas-elevated border-canvas-border hover:border-brand-200 cursor-pointer transition-colors"
    >
      <GitBranch size={13} />
      Assign to Route
      <span className="inline-flex items-center h-5 min-w-5 px-1 text-[10.5px] font-semibold bg-brand-50 rounded-full tabular-nums">{selectedIds.length}</span>
    </button>
  );
}
