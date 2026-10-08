// ─────────────────────────────────────────────────────────────────────────────
// Shared store for engagements created outside EngagementsView's own wizard —
// today that's the One-Click Audit modal, which can run from Knowledge Hub or
// Ask Ira while the engagement list isn't even mounted. EngagementsView merges
// this store into its session list on mount / on change, mirroring how the
// controls surfaces merge createdControlsStore.
//
// Backed by localStorage so AI-created engagements survive a reload, and
// re-registered into the runtime engagement registry at module load so detail
// views can resolve them by id in later sessions too.
// ─────────────────────────────────────────────────────────────────────────────
import { useSyncExternalStore } from 'react';
import { registerEngagement, type Engagement } from './engagements';
import { currentWorkspaceId, onWorkspaceChange } from './auditPlan/workspace';

const STORAGE_KEY = 'irame.createdEngagements';

function load(): Engagement[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Engagement[]) : [];
  } catch {
    return [];
  }
}

// Module-level cache so getSnapshot returns a stable reference between renders
// (required by useSyncExternalStore).
let cache: Engagement[] = load();
// Detail views resolve engagements through the runtime registry — hydrate it
// with persisted creations so deep links keep working after a reload.
cache.forEach(registerEngagement);

const listeners = new Set<() => void>();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    /* storage full / unavailable — keep the in-memory copy */
  }
}

function emit() {
  listeners.forEach(fn => fn());
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** This workspace's created engagements — cached so the snapshot stays the
 *  same array until the list or the workspace changes. */
let view: { src: Engagement[] | null; ws: string; out: Engagement[] } = { src: null, ws: '', out: [] };
function getSnapshot(): Engagement[] {
  const ws = currentWorkspaceId();
  if (view.src !== cache || view.ws !== ws) view = { src: cache, ws, out: cache.filter(e => (e.workspaceId ?? 'platform') === ws) };
  return view.out;
}
onWorkspaceChange(emit);

/** This workspace's created engagements (newest first). Non-reactive read. */
export function getCreatedEngagements(): Engagement[] {
  return getSnapshot();
}

/** Persist a batch of newly-created engagements and notify subscribers. */
export function addCreatedEngagements(incoming: Engagement[]): void {
  if (incoming.length === 0) return;
  // Stamp the workspace so each client's list holds only its own.
  const engs = incoming.map(e => (e.workspaceId ? e : { ...e, workspaceId: currentWorkspaceId() }));
  engs.forEach(registerEngagement);
  cache = [...engs, ...cache.filter(e => !engs.some(n => n.id === e.id))];
  persist();
  emit();
}

/** Reactive hook — re-renders the caller whenever engagements are created. */
export function useCreatedEngagements(): Engagement[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
