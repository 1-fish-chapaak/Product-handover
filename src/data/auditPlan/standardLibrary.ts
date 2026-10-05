/**
 * The standard library — preloaded into every account.
 *
 * Each catalog entry is a standard control with a standard workflow, and
 * moves through:
 *
 *   needs-data       → not yet adapted to this client's data
 *   awaiting-review  → built on the client's data, nobody has approved it
 *   live             → approved (or already running in the account)
 *   manual           → judgement control, no workflow at all
 *
 * Only live workflows count towards coverage and hours returned — a built
 * workflow nobody has looked at isn't evidence yet. Adapting keeps the
 * control Standard; editing its logic would fork a Custom copy.
 *
 * Persisted in localStorage and synced across tabs (a workflow approved in
 * its review-session tab goes live here too).
 */
import { useSyncExternalStore } from 'react';
import type { ControlRow } from '../../components/governance/controlTypes';
import { CHECK_CATALOG, type CatalogEntry } from './catalog';

export type StdReadiness = 'live' | 'awaiting-review' | 'needs-data' | 'manual';

export interface StdState {
  built: string[];
  live: string[];
}

const KEY = 'irame.stdLibrary.state';

function readState(): StdState {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? JSON.parse(raw) : null;
    return v && Array.isArray(v.built) && Array.isArray(v.live) ? v : { built: [], live: [] };
  } catch { return { built: [], live: [] }; }
}

let state: StdState = readState();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(fn => fn());
// Listen for other tabs at module level, not per subscriber — an approval in
// a review tab must land here even while no mounted component reads the store.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', e => { if (e.key === KEY) { state = readState(); emit(); } });
}
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};
function persist(next: StdState) {
  state = next;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* quota */ }
  emit();
}

export function readinessOf(entry: CatalogEntry, s: StdState = state): StdReadiness {
  if (!entry.automatable) return 'manual';
  if (entry.existingWorkflowId || s.live.includes(entry.key)) return 'live';
  if (s.built.includes(entry.key)) return 'awaiting-review';
  return 'needs-data';
}

const entryOf = (key: string) => CHECK_CATALOG.find(x => x.key === key);

/** Live — approved and running on this client's data. Counts for coverage. */
export function isStdLive(key: string): boolean {
  const e = entryOf(key);
  return !!e && readinessOf(e) === 'live';
}

/** Built or live — a workflow exists, so plans reuse it rather than build. */
export function isStdBuilt(key: string): boolean {
  const e = entryOf(key);
  const r = e ? readinessOf(e) : 'needs-data';
  return r === 'live' || r === 'awaiting-review';
}

/** A batch finished building these on the client's data. */
export function markStdAdapted(keys: string[]): void {
  const built = Array.from(new Set([...state.built, ...keys]));
  if (built.length === state.built.length) return;
  persist({ ...state, built });
}

/** A reviewer approved these — they go live. */
export function markStdLive(keys: string[]): void {
  const live = Array.from(new Set([...state.live, ...keys]));
  if (live.length === state.live.length) return;
  persist({ built: Array.from(new Set([...state.built, ...keys])), live });
}

export function useStdState(): StdState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

/** The standard workflow's name for an entry — the library workflow it
 *  already maps to, else the standard check name. */
export const stdWorkflowName = (e: CatalogEntry) => e.existingWorkflowName ?? e.checkName;

/** Standard controls as Control Library rows. */
export function standardControlRows(s: StdState): ControlRow[] {
  return CHECK_CATALOG.map(e => {
    const readiness = readinessOf(e, s);
    const exists = readiness === 'live' || readiness === 'awaiting-review';
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
      linkedWorkflowIds: exists ? [e.existingWorkflowId ?? `std-${e.key}`] : [],
      usedInRACMs: 0,
      status: 'Active',
      createdAt: 'Preloaded',
      updatedAt: readiness === 'live' ? 'Live' : readiness === 'awaiting-review' ? 'Built' : 'Preloaded',
      library: 'standard',
      stdKey: e.key,
    } satisfies ControlRow;
  });
}
