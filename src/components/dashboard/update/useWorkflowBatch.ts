import { useEffect, useRef, useState } from 'react';
import type { LinkedWorkflow, WorkflowRun } from '../../../data/dashboardUpdate';

export type BatchTone = 'started' | 'updating' | 'done' | 'failed' | 'skipped';

/** One status row under the batch button. */
export interface BatchRow {
  workflowId: string;
  name: string;
  tone: BatchTone;
  /** Reason/context line under the row; null when the pill says it all. */
  detail: string | null;
  runId: string | null;
}

export interface WorkflowBatch {
  rows: BatchRow[];
  start: (workflows: LinkedWorkflow[], filesByWorkflow: Record<string, string[]>) => void;
  isStarting: boolean;
  /** Started runs not yet landed on the dashboard. */
  pendingCount: number;
  /** Non-null once every started run settled and at least one updated. */
  successText: string | null;
  /** Every started run settled and none failed — the only state that earns
   *  the segment's green check. */
  allSucceeded: boolean;
  isBusy: boolean;
  stopRun: (workflowId: string) => void;
  retryRun: (workflowId: string) => void;
}

interface Options {
  /** Fired as each run lands — appends to the run history and re-pins. */
  onRunCompleted: (workflowId: string, run: WorkflowRun, files: string[]) => void;
}

let runSeq = 0;
const RUN_START_MS = 600;
const RUN_BASE_MS = 2200;
const RUN_STAGGER_MS = 1400;
const PIN_MS = 900;

/** The lifecycle of one batch (Run Workflows or Sync now): fire the runs, walk
 *  each row Running → Updating dashboard… → Dashboard updated on a timer, and
 *  collapse to a success line once everything settled. Lives in an
 *  always-mounted owner so closing the dialog never loses an in-flight batch. */
export function useWorkflowBatch({ onRunCompleted }: Options): WorkflowBatch {
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const timers = useRef<Map<string, number[]>>(new Map());
  const params = useRef<Map<string, { workflow: LinkedWorkflow; files: string[] }>>(new Map());
  const failedOnce = useRef<Set<string>>(new Set());
  const onRunCompletedRef = useRef(onRunCompleted);
  useEffect(() => { onRunCompletedRef.current = onRunCompleted; }, [onRunCompleted]);

  useEffect(() => {
    const all = timers.current;
    return () => { all.forEach(list => list.forEach(clearTimeout)); };
  }, []);

  const patchRow = (workflowId: string, patch: Partial<BatchRow>) =>
    setRows(prev => prev.map(r => (r.workflowId === workflowId ? { ...r, ...patch } : r)));

  const clearTimers = (workflowId: string) => {
    (timers.current.get(workflowId) ?? []).forEach(clearTimeout);
    timers.current.delete(workflowId);
  };

  const schedule = (workflow: LinkedWorkflow, files: string[], index: number) => {
    clearTimers(workflow.id);
    const runId = `run-${Date.now()}-${++runSeq}`;
    const list: number[] = [];
    list.push(window.setTimeout(() => {
      if (workflow.failsFirstRun && !failedOnce.current.has(workflow.id)) {
        failedOnce.current.add(workflow.id);
        patchRow(workflow.id, { tone: 'failed', detail: 'Run didn’t finish. The dashboard kept its previous data.' });
        return;
      }
      patchRow(workflow.id, { tone: 'updating', runId });
      list.push(window.setTimeout(() => {
        patchRow(workflow.id, { tone: 'done', runId });
        onRunCompletedRef.current(workflow.id, {
          id: runId,
          workflowId: workflow.id,
          completedAt: new Date().toISOString(),
          durationSecs: 38 + index * 47 + Math.floor(Math.random() * 30),
          files,
        }, files);
      }, PIN_MS));
    }, RUN_BASE_MS + index * RUN_STAGGER_MS));
    timers.current.set(workflow.id, list);
  };

  const start = (workflows: LinkedWorkflow[], filesByWorkflow: Record<string, string[]>) => {
    if (isStarting || workflows.length === 0) return;
    setIsStarting(true);
    window.setTimeout(() => {
      setRows(workflows.map(w => w.neverRan
        ? { workflowId: w.id, name: w.name, tone: 'skipped', detail: 'never run yet, start it once from the executor', runId: null }
        : { workflowId: w.id, name: w.name, tone: 'started', detail: null, runId: null }));
      setIsStarting(false);
      workflows.filter(w => !w.neverRan).forEach((w, i) => {
        const files = filesByWorkflow[w.id] ?? [];
        params.current.set(w.id, { workflow: w, files });
        schedule(w, files, i);
      });
    }, RUN_START_MS);
  };

  const stopRun = (workflowId: string) => {
    clearTimers(workflowId);
    patchRow(workflowId, { tone: 'failed', detail: 'Stopped. The dashboard kept its previous data.' });
  };

  const retryRun = (workflowId: string) => {
    const p = params.current.get(workflowId);
    if (!p) return;
    patchRow(workflowId, { tone: 'started', detail: null, runId: null });
    schedule(p.workflow, p.files, 0);
  };

  const pendingCount = rows.filter(r => r.tone === 'started' || r.tone === 'updating').length;
  const doneCount = rows.filter(r => r.tone === 'done').length;
  const startedCount = rows.filter(r => r.tone !== 'skipped').length;
  const allDone = startedCount > 0 && pendingCount === 0;
  const anyFailed = rows.some(r => r.tone === 'failed');

  return {
    // Once everything settled, finished rows fold into the success line;
    // skipped/failed rows stay because their reasons are still actionable.
    rows: allDone ? rows.filter(r => r.tone !== 'done') : rows,
    start,
    isStarting,
    pendingCount,
    successText: allDone && doneCount > 0 ? `${doneCount} run${doneCount > 1 ? 's' : ''} finished, dashboard updated` : null,
    allSucceeded: allDone && !anyFailed && doneCount > 0,
    isBusy: isStarting || pendingCount > 0,
    stopRun,
    retryRun,
  };
}
