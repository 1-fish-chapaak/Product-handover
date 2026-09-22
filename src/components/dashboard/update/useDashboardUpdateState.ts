import { useEffect, useState } from 'react';
import type { DashboardFileSource, DashboardUpdateSeed, LinkedWorkflow, WorkflowRun } from '../../../data/dashboardUpdate';
import type { SyncSchedule } from '../sync/syncSchedule';
import type { AppliedReplacement } from './useFileReplacements';

/** What the prototype persists per dashboard, on top of the seed: the runs
 *  produced here, which run each workflow is pinned to, replaced file names,
 *  the files each workflow last ran with, and per-workflow schedules. */
interface UpdateDelta {
  runs: WorkflowRun[];
  current: Record<string, string>;
  fileNames: Record<string, string>;
  inputFiles: Record<string, Record<string, string>>;
  workflowSchedules: Record<string, SyncSchedule>;
}

const EMPTY: UpdateDelta = { runs: [], current: {}, fileNames: {}, inputFiles: {}, workflowSchedules: {} };

const load = (key: string): UpdateDelta => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY;
  } catch {
    return EMPTY;
  }
};

export interface DashboardUpdateState {
  files: DashboardFileSource[];
  workflows: LinkedWorkflow[];
  /** Newest first. */
  runs: WorkflowRun[];
  currentRunByWorkflow: Record<string, string>;
  workflowSchedules: Record<string, SyncSchedule>;
  hasFiles: boolean;
  hasFileWorkflows: boolean;
  hasLive: boolean;
  replaceFiles: (applied: AppliedReplacement[]) => void;
  /** A run landed — it becomes the workflow's current run. */
  addRun: (run: WorkflowRun, inputFiles?: Record<string, string>) => void;
  pinRun: (workflowId: string, runId: string) => void;
  setWorkflowSchedule: (workflowId: string, schedule: SyncSchedule) => void;
}

/** The dashboard's update-related data: seed + what this browser has done
 *  since. Persisted per dashboard so a run you launched is still in Previous
 *  Runs after navigating away. */
export function useDashboardUpdateState(dashboardId: string, seed: DashboardUpdateSeed): DashboardUpdateState {
  const storageKey = `irame.dashboard.update.${dashboardId}`;
  const [delta, setDelta] = useState<UpdateDelta>(() => load(storageKey));
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(delta)); } catch { /* ignore */ }
  }, [storageKey, delta]);

  const files = seed.files.map(f => (delta.fileNames[f.datasetId] ? { ...f, displayName: delta.fileNames[f.datasetId] } : f));
  const workflows = seed.workflows.map(w => {
    const lastFiles = delta.inputFiles[w.id];
    return lastFiles ? { ...w, inputs: w.inputs.map(i => ({ ...i, fileName: lastFiles[i.inputName] ?? i.fileName })) } : w;
  });
  const seen = new Set<string>();
  const runs = [...delta.runs, ...seed.runs]
    .filter(r => (seen.has(r.id) ? false : (seen.add(r.id), true)))
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt));

  return {
    files,
    workflows,
    runs,
    currentRunByWorkflow: { ...seed.currentRunByWorkflow, ...delta.current },
    workflowSchedules: delta.workflowSchedules,
    hasFiles: files.length > 0,
    hasFileWorkflows: workflows.some(w => w.kind === 'file'),
    hasLive: workflows.some(w => w.kind === 'live'),
    replaceFiles: applied => setDelta(prev => ({
      ...prev,
      fileNames: { ...prev.fileNames, ...Object.fromEntries(applied.map(a => [a.datasetId, a.newName])) },
    })),
    addRun: (run, inputFiles) => setDelta(prev => ({
      ...prev,
      runs: [run, ...prev.runs],
      current: { ...prev.current, [run.workflowId]: run.id },
      inputFiles: inputFiles ? { ...prev.inputFiles, [run.workflowId]: inputFiles } : prev.inputFiles,
    })),
    pinRun: (workflowId, runId) => setDelta(prev => ({ ...prev, current: { ...prev.current, [workflowId]: runId } })),
    setWorkflowSchedule: (workflowId, schedule) => setDelta(prev => ({
      ...prev,
      workflowSchedules: { ...prev.workflowSchedules, [workflowId]: schedule },
    })),
  };
}
