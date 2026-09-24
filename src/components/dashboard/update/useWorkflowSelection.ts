import { useState } from 'react';

export interface WorkflowSelection {
  isSelected: (workflowId: string) => boolean;
  toggle: (workflowId: string) => void;
  /** Tick everything. Opt-in mode needs the ids; select-by-default mode just
   *  clears the exclusions. */
  selectAll: (workflowIds?: readonly string[]) => void;
  /** How many were un-ticked — meaningful in select-by-default mode only. */
  deselectedCount: number;
}

/** Which workflows a batch includes. Stored as the ids whose state differs
 *  from the default: Run Workflows starts with everything ticked ("run it
 *  all" is the common case); Sync Live Data starts with nothing ticked, since
 *  a sync re-runs real database workflows and should be a deliberate pick. */
export function useWorkflowSelection(defaultSelected = true): WorkflowSelection {
  const [flipped, setFlipped] = useState<ReadonlySet<string>>(new Set());
  return {
    isSelected: id => defaultSelected !== flipped.has(id),
    toggle: id => setFlipped(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    }),
    selectAll: ids => setFlipped(defaultSelected ? new Set() : new Set(ids ?? [])),
    deselectedCount: defaultSelected ? flipped.size : 0,
  };
}
