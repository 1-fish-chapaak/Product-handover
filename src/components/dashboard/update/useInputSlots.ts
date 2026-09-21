import { useEffect, useRef, useState } from 'react';
import { mockSchemaDiff, type LinkedWorkflow, type SchemaDiff, type WorkflowInput } from '../../../data/dashboardUpdate';
import type { PoolFile } from './useFilePool';

export type SlotStatus = 'idle' | 'validating' | 'ready' | 'incompatible';

export interface InputSlot {
  status: SlotStatus;
  newSourceId: string | null;
  newFileName: string | null;
  diff: SchemaDiff | null;
}

const IDLE: InputSlot = { status: 'idle', newSourceId: null, newFileName: null, diff: null };

const key = (workflowId: string, inputName: string) => `${workflowId}|${inputName}`;
// Split at the FIRST separator only — input names may contain '|'.
const workflowOf = (k: string) => k.slice(0, k.indexOf('|'));

export interface InputSlots {
  slotFor: (workflowId: string, inputName: string) => InputSlot;
  assign: (workflowId: string, input: WorkflowInput, poolFile: PoolFile) => void;
  clear: (workflowId: string, inputName: string) => void;
  clearBySource: (sourceId: string) => void;
  resetAll: () => void;
  /** Ready slots of the given workflows, for the run gate. */
  readyCountFor: (workflowIds: readonly string[]) => number;
  /** Pool sources actually bound to a ready slot of the given workflows. */
  readySourceIdsFor: (workflowIds: readonly string[]) => Set<string>;
  /** The files a run of this workflow would use: new where assigned, else last-used. */
  filesFor: (workflow: LinkedWorkflow) => Record<string, string>;
  busyCount: number;
}

/** The "Inputs for the next run" slots of Run Workflows: assign a pool file to
 *  a (workflow, input) pair and check its columns against the file that input
 *  used last. Session-ephemeral — an assignment is bound to the run it starts. */
export function useInputSlots(): InputSlots {
  const [slots, setSlots] = useState<Record<string, InputSlot>>({});
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => { pending.forEach(clearTimeout); };
  }, []);

  const assign = (workflowId: string, input: WorkflowInput, poolFile: PoolFile) => {
    const k = key(workflowId, input.inputName);
    setSlots(prev => ({ ...prev, [k]: { status: 'validating', newSourceId: poolFile.sourceId, newFileName: poolFile.name, diff: null } }));
    const t = window.setTimeout(() => {
      const diff = mockSchemaDiff([], poolFile.name);
      setSlots(prev => {
        const cur = prev[k];
        if (!cur || cur.newSourceId !== poolFile.sourceId) return prev;
        return { ...prev, [k]: { ...cur, status: diff.compatible ? 'ready' : 'incompatible', diff: diff.compatible ? null : diff } };
      });
    }, 800);
    timers.current.push(t);
  };

  const clear = (workflowId: string, inputName: string) => setSlots(prev => {
    const next = { ...prev };
    delete next[key(workflowId, inputName)];
    return next;
  });

  const clearBySource = (sourceId: string) => setSlots(prev =>
    Object.fromEntries(Object.entries(prev).filter(([, s]) => s.newSourceId !== sourceId)));

  const slotFor = (workflowId: string, inputName: string) => slots[key(workflowId, inputName)] ?? IDLE;

  const readyCountFor = (ids: readonly string[]) => {
    const wanted = new Set(ids);
    return Object.entries(slots).filter(([k, s]) => wanted.has(workflowOf(k)) && s.status === 'ready').length;
  };

  const readySourceIdsFor = (ids: readonly string[]) => {
    const wanted = new Set(ids);
    const used = new Set<string>();
    for (const [k, s] of Object.entries(slots)) {
      if (wanted.has(workflowOf(k)) && s.status === 'ready' && s.newSourceId) used.add(s.newSourceId);
    }
    return used;
  };

  const filesFor = (workflow: LinkedWorkflow) => Object.fromEntries(workflow.inputs.map(input => {
    const s = slotFor(workflow.id, input.inputName);
    return [input.inputName, s.status === 'ready' && s.newFileName ? s.newFileName : input.fileName];
  }));

  return {
    slotFor,
    assign,
    clear,
    clearBySource,
    resetAll: () => setSlots({}),
    readyCountFor,
    readySourceIdsFor,
    filesFor,
    busyCount: Object.values(slots).filter(s => s.status === 'validating').length,
  };
}
