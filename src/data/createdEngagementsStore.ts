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

function getSnapshot(): Engagement[] {
  return cache;
}

/** All created engagements (newest first). Non-reactive read. */
export function getCreatedEngagements(): Engagement[] {
  return cache;
}

/** Persist a batch of newly-created engagements and notify subscribers. */
export function addCreatedEngagements(engs: Engagement[]): void {
  if (engs.length === 0) return;
  engs.forEach(registerEngagement);
  cache = [...engs, ...cache.filter(e => !engs.some(n => n.id === e.id))];
  persist();
  emit();
}

/** Reactive hook — re-renders the caller whenever engagements are created. */
export function useCreatedEngagements(): Engagement[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
