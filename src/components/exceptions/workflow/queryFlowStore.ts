import { useEffect, useState } from 'react';
import type { WorkflowTemplate } from './workflowTypes';

// ── Query-level approval-flow assignment ───────────────────────────────────
// A flow can be chosen up-front on a report's QueryCard and applied to every
// exception in that query. A query can carry BOTH a Risk Owner flow AND an
// Auditor flow at once (they run on separate sides), so each query maps to up
// to two records — one per side.
//
// IN-MEMORY ONLY: nothing is written to disk, so a hard refresh clears every
// assignment and the user selects again (matching the rest of the demo's
// no-persistence behaviour). To still carry the choice into the "Manage
// exceptions" tab (opened via window.open from the report), a freshly-loaded
// tab seeds itself once from its OPENER's live store — same realm family,
// same origin, still entirely in memory.

export type QueryFlowKind = 'risk-owner' | 'auditor';

export interface QueryFlowRecord {
  queryId: string;
  kind: QueryFlowKind;
  /** Full snapshot of the chosen flow, so the consuming tab needs nothing else. */
  template: WorkflowTemplate;
  note?: string;
  assignedAt: string;
  assignedBy: string;
}

/** Both sides' assignments for a single query (either may be absent). */
export type QueryFlowSet = Partial<Record<QueryFlowKind, QueryFlowRecord>>;

const GLOBAL_KEY = '__GRC_QUERY_FLOWS__';

interface QueryFlowsApi {
  all(): Record<string, QueryFlowSet>;
}

/** Seed from the opener tab's live store, if this tab was opened from one.
 *  Pure in-memory hand-off — survives the new tab opening, but a hard refresh
 *  of the report tab (no opener) starts empty, so the user re-selects. */
function seedFromOpener(): Record<string, QueryFlowSet> {
  try {
    if (typeof window === 'undefined' || !window.opener) return {};
    const src = (window.opener as unknown as Record<string, QueryFlowsApi | undefined>)[GLOBAL_KEY];
    if (src && typeof src.all === 'function') return { ...src.all() };
  } catch { /* cross-origin or closed opener — ignore */ }
  return {};
}

let map: Record<string, QueryFlowSet> = seedFromOpener();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(l => l());

export const queryFlows = {
  all: (): Record<string, QueryFlowSet> => map,
  get: (queryId: string): QueryFlowSet => map[queryId] ?? {},
  getFor: (queryId: string, kind: QueryFlowKind): QueryFlowRecord | null => map[queryId]?.[kind] ?? null,
  set(record: QueryFlowRecord) {
    map = { ...map, [record.queryId]: { ...(map[record.queryId] ?? {}), [record.kind]: record } };
    notify();
  },
  clear(queryId: string, kind: QueryFlowKind) {
    const existing = map[queryId];
    if (!existing || !existing[kind]) return;
    const next = { ...existing };
    delete next[kind];
    if (Object.keys(next).length === 0) {
      const m = { ...map };
      delete m[queryId];
      map = m;
    } else {
      map = { ...map, [queryId]: next };
    }
    notify();
  },
};

// Expose this tab's store so a tab it opens can seed from it (see seedFromOpener).
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, QueryFlowsApi>)[GLOBAL_KEY] = queryFlows;
  // Older builds persisted assignments to localStorage — clear them so nothing
  // survives a hard refresh now that the store is in-memory only.
  try {
    localStorage.removeItem('grc.query-flow-assignments.v1');
    localStorage.removeItem('grc.query-flow-assignments.v2');
  } catch { /* ignore */ }
}

/** Subscribe to both sides' assignments for one query. */
export function useQueryFlows(queryId: string): QueryFlowSet {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force(n => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return map[queryId] ?? {};
}
