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
import { TODAY, type DataSource } from '../components/data-sources/sources';

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

/** Versioned key so future schema changes can ignore old data without crashing.
 *  v3 adds `health` (integration override) and ships a much wider seed
 *  catalogue covering every source type + edge cases (0 B, GB, very-long
 *  names, degraded integration). */
const STORAGE_KEY = 'kh:sources:v3';

// First-run seed — the catalog the user sees before they've added anything.
// Mirrors the reference design's example surface: a handful of recent files,
// a folder, and a connected database. Dates are computed at module load so
// the items always land in the "Today" bucket on first run.
//
// IMPORTANT: only used when localStorage has NEVER been written. Once the
// user adds/removes anything, their stored list wins — clearing the catalog
// to empty stays empty.
function makeSeedSources(): DataSource[] {
  // Anchor seed timestamps to TODAY noon (the app's reference "now") so the
  // top six items land cleanly in the Today bucket. Older entries fan out
  // across "Last 7 days" and "Earlier" so the bucket breakdown looks real.
  // When the production wiring lands, swap this for Date.now().
  const ref = TODAY.getTime() + 12 * 60 * 60 * 1000;
  const MIN = 60 * 1000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;
  return [
    // ── TODAY (6) — exact reference match ────────────────────────────────
    { id: 'seed-csv',     name: 'Department_Audit.csv',       type: 'file',                  subtype: 'CSV · 815 B',         createdAt: new Date(ref -  10 * MIN).toISOString() },
    { id: 'seed-pdf-1',   name: 'Employee_Audit_Details.pdf', type: 'file',                  subtype: 'PDF · 4.2 KB',        createdAt: new Date(ref -  20 * MIN).toISOString() },
    { id: 'seed-xlsx',    name: 'drill-test (1).xlsx',        type: 'file',                  subtype: 'XLSX · 77.1 KB',      createdAt: new Date(ref -  30 * MIN).toISOString() },
    { id: 'seed-pdf-2',   name: '1900035291 (1).pdf',         type: 'file',                  subtype: 'PDF · 305.7 KB',      createdAt: new Date(ref -  40 * MIN).toISOString() },
    { id: 'seed-folder',  name: 'Internal_Audit_Archive',     type: 'file', isFolder: true,  subtype: 'Folder · 12 Files',   createdAt: new Date(ref -  50 * MIN).toISOString() },
    { id: 'seed-db',      name: 'Enterprise_Main_DB',         type: 'database',              subtype: 'SQL · production',    createdAt: new Date(ref -  60 * MIN).toISOString(), health: 'healthy' },

    // ── LAST 7 DAYS (10) — mixed formats, sizes, and source types ────────
    { id: 'seed-l-1',     name: 'SOX_Q1_Controls.xlsx',       type: 'file',                  subtype: 'XLSX · 1.2 MB',       createdAt: new Date(ref -  1 * DAY -  2 * HOUR).toISOString() },
    { id: 'seed-l-2',     name: 'Vendor_Risk_Assessment.pdf', type: 'file',                  subtype: 'PDF · 884 KB',        createdAt: new Date(ref -  2 * DAY).toISOString() },
    { id: 'seed-l-3',     name: 'Snowflake_Finance',          type: 'database',              subtype: 'Snowflake · finance', createdAt: new Date(ref -  2 * DAY -  4 * HOUR).toISOString(), health: 'degraded' },
    { id: 'seed-l-4',     name: 'Compliance_Report_Apr.pdf',  type: 'file',                  subtype: 'PDF · 1.4 MB',        createdAt: new Date(ref -  3 * DAY).toISOString() },
    { id: 'seed-l-5',     name: 'Risk_Register.xlsx',         type: 'file',                  subtype: 'XLSX · 612 KB',       createdAt: new Date(ref -  3 * DAY -  5 * HOUR).toISOString() },
    { id: 'seed-l-6',     name: 'Q1_Policies',                type: 'file', isFolder: true,  subtype: 'Folder · 8 Files',    createdAt: new Date(ref -  4 * DAY).toISOString() },
    { id: 'seed-l-7',     name: 'Workday_HRIS',               type: 'api',                   subtype: 'Workday · v2 REST',   createdAt: new Date(ref -  4 * DAY -  6 * HOUR).toISOString(), health: 'healthy' },
    { id: 'seed-l-8',     name: 'chat_db59abca.xlsx',         type: 'file',                  subtype: 'XLSX · 948.9 KB',     createdAt: new Date(ref -  5 * DAY).toISOString() },
    { id: 'seed-l-9',     name: '1. 21 to 30 Jan (5).xlsx',   type: 'file',                  subtype: 'XLSX · 18.1 MB',      createdAt: new Date(ref -  5 * DAY -  3 * HOUR).toISOString() },
    { id: 'seed-l-10',    name: 'Additonal Flying Allowances.csv', type: 'file',             subtype: 'CSV · 537 B',         createdAt: new Date(ref -  6 * DAY).toISOString() },

    // ── EARLIER (8) — older, plus the edge-case rows ──────────────────────
    { id: 'seed-e-1',     name: 'SOC2_Type_II_Report.pdf',    type: 'file',                  subtype: 'PDF · 3.2 MB',        createdAt: new Date(ref - 10 * DAY).toISOString() },
    { id: 'seed-e-2',     name: 'Postgres_AuditLogs',         type: 'database',              subtype: 'PostgreSQL · audit',  createdAt: new Date(ref - 14 * DAY).toISOString(), health: 'healthy' },
    { id: 'seed-e-3',     name: 'Annual_Audit_Plan_FY26.docx', type: 'file',                 subtype: 'DOC · 245 KB',        createdAt: new Date(ref - 18 * DAY).toISOString() },
    { id: 'seed-e-4',     name: 'SharePoint_Compliance',      type: 'cloud',                 subtype: 'SharePoint · /compliance', createdAt: new Date(ref - 22 * DAY).toISOString(), health: 'healthy' },
    { id: 'seed-e-5',     name: 'Test_Workpapers',            type: 'file', isFolder: true,  subtype: 'Folder · 24 Files',   createdAt: new Date(ref - 28 * DAY).toISOString() },
    // ── Edge cases ───────────────────────────────────────────────────────
    { id: 'seed-edge-empty', name: 'corrupted_data.csv',      type: 'file',                  subtype: 'CSV · 0 B',           createdAt: new Date(ref - 35 * DAY).toISOString() },
    { id: 'seed-edge-long',  name: 'very_long_file_name_that_should_truncate_gracefully_in_the_card_layout.pdf', type: 'file', subtype: 'PDF · 12.4 MB', createdAt: new Date(ref - 42 * DAY).toISOString() },
    { id: 'seed-edge-gb',    name: 'quarterly_data_dump.xlsx', type: 'file',                 subtype: 'XLSX · 1.5 GB',       createdAt: new Date(ref - 60 * DAY).toISOString() },
  ];
}

function loadFromLocal(): DataSource[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    // Distinct from "[]": a missing key means the user has never interacted
    // with the catalog. Seed in that case so the surface isn't blank-and-
    // confusing on first load. Empty-but-present means the user cleared it.
    if (raw === null) return makeSeedSources();
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
