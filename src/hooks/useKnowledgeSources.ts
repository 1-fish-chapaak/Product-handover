/**
 * Knowledge Hub data layer — the single seam that the backend will replace.
 *
 * ─── What this is ───────────────────────────────────────────────────────────
 * A React hook that owns the user's Knowledge Hub source list and exposes a
 * narrow, typed API (read + four mutations). Every consumer in the app reads
 * and writes through this hook — never through a module-level singleton, never
 * via direct localStorage access. That makes the seam between "frontend
 * prototype" and "production with a real backend" exactly one file: this one.
 *
 * ─── How it works today ─────────────────────────────────────────────────────
 * Today, with no backend wired:
 *   • Reads are served from localStorage (scoped to the browser).
 *   • Writes mutate React state immediately AND mirror to localStorage.
 *   • The `backend` field reads 'local' so the UI can show a "stored in this
 *     browser" cue and set correct expectations.
 *
 * Limitations of the localStorage stopgap:
 *   • Same user on phone + laptop = two separate lists.
 *   • Clear browser data = lost sources.
 *   • Two people sharing a device = they see each other's data.
 *
 * The UI surfaces this via the storage-scope cue on KnowledgeHubView. Do not
 * remove that cue until this hook reports `backend === 'cloud'`.
 *
 * ─── How to wire a real backend ─────────────────────────────────────────────
 * 1. Replace the body of `useKnowledgeSources()` below with your implementation
 *    (fetch / SWR / RTK Query / TanStack Query / whatever you prefer).
 * 2. Keep the public `KnowledgeSourcesAPI` shape identical. All four mutations
 *    are already async (Promise<void>), so awaiting a network call is a no-op
 *    contract change.
 * 3. Return `backend: 'cloud'` so the "stored in this browser" cue disappears.
 * 4. That is the entire migration. No other file in the app needs to change.
 *
 * The expected backend endpoints (suggested):
 *   GET    /api/knowledge/sources              → DataSource[]
 *   POST   /api/knowledge/sources              { sources: DataSource[] } → 201
 *   PATCH  /api/knowledge/sources/:id          { name: string }          → 200
 *   DELETE /api/knowledge/sources              { ids: string[] }         → 200
 *
 * ─── Why a hook, not a Context provider ─────────────────────────────────────
 * Today there's exactly one consumer (DataSourcesView). Adding a Provider
 * would be ceremony without a payoff. If/when a second consumer needs the
 * source list, lift this into a Context or Zustand store — but do it as a
 * follow-up, not pre-emptively. The public API stays the same either way.
 */

import { useCallback, useEffect, useState } from 'react';
import type { DataSource } from '../components/data-sources/sources';

// ─── Public API ─────────────────────────────────────────────────────────────

export type KnowledgeSourcesStatus = 'ready' | 'loading' | 'error';
export type KnowledgeSourcesBackend = 'local' | 'cloud';

export interface KnowledgeSourcesAPI {
  /** Current list of the user's sources, newest-first by `createdAt`. */
  sources: DataSource[];
  /** Snapshot status of the data layer. `'loading'` is reserved for a future
   *  network-backed impl; the localStorage impl is always synchronously ready. */
  status: KnowledgeSourcesStatus;
  /** Surface for the most recent non-fatal error (e.g. quota exceeded on a
   *  localStorage write, or a 5xx from a future backend). `null` when clean. */
  error: string | null;
  /** Where the data is currently stored. Used by the UI to decide whether to
   *  show a "stored in this browser" cue. */
  backend: KnowledgeSourcesBackend;

  /** Bulk-add sources. Prepends to the list; dedupes by id (so an Undo can
   *  re-use this method to restore previously-removed snapshots). */
  addMany: (sources: DataSource[]) => Promise<void>;
  /** Rename a source by id. No-op if the id doesn't exist. */
  rename: (id: string, newName: string) => Promise<void>;
  /** Remove sources by id. */
  removeMany: (ids: string[]) => Promise<void>;
  /** Replace the whole list (used by tests / dev tools / future bulk import). */
  replaceAll: (sources: DataSource[]) => Promise<void>;
}

// ─── localStorage impl (today) ──────────────────────────────────────────────

/** Versioned key so future schema changes can ignore old data without crashing. */
const STORAGE_KEY = 'kh:sources:v1';

function loadFromLocal(): DataSource[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Soft validation: require id + name + type fields. Drop anything malformed
    // so a partially-corrupted record doesn't take down the whole page.
    return parsed.filter((s): s is DataSource =>
      s && typeof s === 'object' &&
      typeof s.id === 'string' &&
      typeof s.name === 'string' &&
      typeof s.type === 'string'
    );
  } catch {
    return [];
  }
}

function saveToLocal(sources: DataSource[]): string | null {
  if (typeof window === 'undefined') return null;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sources));
    return null;
  } catch (e) {
    // Most common failure: QuotaExceededError when localStorage is full.
    return e instanceof Error ? e.message : 'Storage write failed';
  }
}

/** Sort newest-first so the grid's implicit order is stable across reloads. */
function byCreatedDesc(a: DataSource, b: DataSource): number {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

export function useKnowledgeSources(): KnowledgeSourcesAPI {
  const [sources, setSources] = useState<DataSource[]>(() => loadFromLocal().sort(byCreatedDesc));
  const [error, setError] = useState<string | null>(null);

  // Mirror to localStorage on every change. Keeping this in an effect (rather
  // than inside each mutator) means a single source of truth for persistence
  // and avoids drift if state ever updates from somewhere we forgot.
  useEffect(() => {
    const err = saveToLocal(sources);
    setError(err);
  }, [sources]);

  // Cross-tab sync — if the user opens the app in two tabs and adds a source
  // in one, the other tab updates automatically. Same-tab updates already flow
  // through React state so they don't need this listener.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      setSources(loadFromLocal().sort(byCreatedDesc));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const addMany = useCallback(async (incoming: DataSource[]) => {
    if (incoming.length === 0) return;
    setSources(prev => {
      const taken = new Set(prev.map(s => s.id));
      const fresh = incoming.filter(s => !taken.has(s.id));
      return [...fresh, ...prev].sort(byCreatedDesc);
    });
  }, []);

  const rename = useCallback(async (id: string, newName: string) => {
    setSources(prev => prev.map(s => s.id === id ? { ...s, name: newName } : s));
  }, []);

  const removeMany = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    setSources(prev => prev.filter(s => !idSet.has(s.id)));
  }, []);

  const replaceAll = useCallback(async (next: DataSource[]) => {
    setSources([...next].sort(byCreatedDesc));
  }, []);

  return {
    sources,
    status: 'ready',
    error,
    backend: 'local',
    addMany,
    rename,
    removeMany,
    replaceAll,
  };
}
