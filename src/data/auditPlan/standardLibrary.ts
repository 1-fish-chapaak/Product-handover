/**
 * The standard library — preloaded into every account.
 *
 * Each catalog entry is a standard control with a standard workflow. A
 * workflow is 'ready' once it runs on this client's data (seeded ready where
 * the account already has a matching Workflow Library workflow), 'needs-data'
 * until it's adapted, and 'manual' for judgement controls that have no
 * workflow at all. Adapting keeps the control Standard — only its readiness
 * changes; editing its logic would fork a Custom copy.
 *
 * Readiness persists in localStorage and syncs across tabs (a workflow
 * reviewed in its own session tab flips here too).
 */
import { useSyncExternalStore } from 'react';
import type { ControlRow } from '../../components/governance/controlTypes';
import { CHECK_CATALOG, type CatalogEntry } from './catalog';

export type StdReadiness = 'ready' | 'needs-data' | 'manual';

const KEY = 'irame.stdLibrary.adapted';

function readAdapted(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}

let adapted: string[] = readAdapted();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(fn => fn());
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) { adapted = readAdapted(); fn(); } };
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(fn); window.removeEventListener('storage', onStorage); };
};

export function readinessOf(entry: CatalogEntry, adaptedKeys: string[] = adapted): StdReadiness {
  if (!entry.automatable) return 'manual';
  return entry.existingWorkflowId || adaptedKeys.includes(entry.key) ? 'ready' : 'needs-data';
}

/** True when the entry's workflow already runs on this client's data. */
export function isStdLive(key: string): boolean {
  const e = CHECK_CATALOG.find(x => x.key === key);
  return !!e && readinessOf(e) === 'ready';
}

export function markStdAdapted(keys: string[]): void {
  const next = Array.from(new Set([...adapted, ...keys]));
  if (next.length === adapted.length) return;
  adapted = next;
  try { localStorage.setItem(KEY, JSON.stringify(adapted)); } catch { /* quota */ }
  emit();
}

export function useAdaptedKeys(): string[] {
  return useSyncExternalStore(subscribe, () => adapted, () => adapted);
}

/** The standard workflow's name for an entry — the library workflow it
 *  already maps to, else the standard check name. */
export const stdWorkflowName = (e: CatalogEntry) => e.existingWorkflowName ?? e.checkName;

/** Standard controls as Control Library rows. */
export function standardControlRows(adaptedKeys: string[]): ControlRow[] {
  return CHECK_CATALOG.map(e => {
    const readiness = readinessOf(e, adaptedKeys);
    return {
      id: `STD-${e.controlId}`,
      controlId: e.controlId,
      name: e.controlTitle,
      description: e.controlDescription,
      objective: `Mitigates: ${e.riskTitle.toLowerCase()}.`,
      businessProcess: e.process,
      subProcess: e.subProcess,
      classification: e.riskRating === 'Low' ? 'Non-Key' : 'Key',
      nature: e.controlType,
      automation: e.automatable ? 'Automated' : 'Manual',
      frequency: e.frequency,
      owner: 'Standard library',
      assertions: [],
      mappedRisks: [],
      linkedWorkflows: e.automatable ? [stdWorkflowName(e)] : [],
      linkedWorkflowIds: readiness === 'ready' ? [e.existingWorkflowId ?? `std-${e.key}`] : [],
      usedInRACMs: 0,
      status: 'Active',
      createdAt: 'Preloaded',
      updatedAt: readiness === 'ready' ? 'Adapted' : 'Preloaded',
      library: 'standard',
      stdKey: e.key,
    } satisfies ControlRow;
  });
}
