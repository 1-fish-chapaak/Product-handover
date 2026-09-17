// "Manage Exceptions First" hand-off. Reuses the platform's existing
// from=<queryId> deep-link path in ManageExceptionsView (which derives cases
// from QUERY_TABLES[id]) by injecting a synthetic query table built from the
// confirmed annexure rows. In-place object mutation mirrors how the app already
// mutates shared mock stores (e.g. GRC_CASE_DETAILS); because navigation is
// SPA-internal (no reload) the injected entry persists for the session.

import { QUERY_TABLES } from '../../../data/queryGraphs';
import { REPORT_QUERIES_ATR, type ReportQueryAtr } from '../../../data/reportQueries';
import type { ExtractionSession } from './types';
import type { CaseAtrLink } from '../atrTimeline';

export const ATR_HANDOFF_ID = 'ATR-UPLOAD';

// The hand-off opens Manage Exceptions in a NEW tab, which starts with fresh
// module state — so the in-memory injection above never reaches it. The query
// summary is also persisted here, and ManageExceptionsView falls back to it
// when the `from` id isn't in REPORT_QUERIES_ATR.
const HANDOFF_STORE_KEY = 'irame.atr.handoffs.v1';

function persistHandoff(id: string, q: ReportQueryAtr) {
  try {
    const raw = localStorage.getItem(HANDOFF_STORE_KEY);
    const store = raw ? (JSON.parse(raw) as Record<string, ReportQueryAtr>) : {};
    store[id] = q;
    localStorage.setItem(HANDOFF_STORE_KEY, JSON.stringify(store));
  } catch { /* ignore */ }
}

// Which saved ATR + observation a hand-off belongs to, so actions taken on its
// cases in Manage Exceptions can be written to that report's Report Snapshot
// timeline (atrTimeline.ts). Persisted for the same new-tab reason as above.
const LINK_STORE_KEY = 'irame.atr.handoff-links.v1';

function persistLink(id: string, link: CaseAtrLink) {
  try {
    const raw = localStorage.getItem(LINK_STORE_KEY);
    const store = raw ? (JSON.parse(raw) as Record<string, CaseAtrLink>) : {};
    store[id] = link;
    localStorage.setItem(LINK_STORE_KEY, JSON.stringify(store));
  } catch { /* ignore */ }
}

/** The ATR observation a hand-off id points at, or null. */
export function loadHandoffLink(id: string): CaseAtrLink | null {
  if (!id.startsWith(ATR_HANDOFF_ID)) return null;
  try {
    const raw = localStorage.getItem(LINK_STORE_KEY);
    const store = raw ? (JSON.parse(raw) as Record<string, CaseAtrLink>) : {};
    return store[id] ?? null;
  } catch { return null; }
}

/** A persisted hand-off's query summary (for the Manage Exceptions context
 *  card), or null if this id was never handed off from this browser. */
export function loadPersistedHandoff(id: string): ReportQueryAtr | null {
  if (!id.startsWith(ATR_HANDOFF_ID)) return null;
  try {
    const raw = localStorage.getItem(HANDOFF_STORE_KEY);
    const store = raw ? (JSON.parse(raw) as Record<string, ReportQueryAtr>) : {};
    return store[id] ?? null;
  } catch { return null; }
}

/** Build + register the exception cases from the linked annexures, set the URL
 *  so ManageExceptionsView resolves them, and return the row count.
 *
 *  Pass `observationId` to hand off ONLY the annexures linked to that one
 *  observation — this powers the per-observation "Manage Exceptions" CTA on the
 *  generated ATR, so each observation's cases stay segregated. Omit it to hand
 *  off every linked annexure at once. */
export function handoffToManageExceptions(session: ExtractionSession, observationId?: string, opts?: { newTab?: boolean; link?: CaseAtrLink }): number {
  const linked = session.annexures.filter(a =>
    a.observationId && (observationId ? a.observationId === observationId : true),
  );
  const obsTitle = (id: string | null) => {
    const o = session.observations.find(x => x.id === id);
    return o ? (o.title?.trim() || `Observation #${o.number}`) : '—';
  };

  const columns = ['Exception Reference', 'Annexure', 'Observation', 'Details'];
  const rows: string[][] = [];
  linked.forEach(a => a.rows.forEach(r => {
    const entries = Object.entries(r.data);
    const ref = entries[0]?.[1] ?? r.id;
    const details = entries.slice(1).map(([k, v]) => `${k}: ${v}`).join(' · ');
    rows.push([ref, a.filename, obsTitle(a.observationId), details]);
  }));

  // Distinct deep-link id per observation so each observation's hand-off keeps
  // its own injected query table (no cross-contamination between observations).
  const handoffId = observationId ? `${ATR_HANDOFF_ID}-${observationId}` : ATR_HANDOFF_ID;
  QUERY_TABLES[handoffId] = { columns, rows };
  const query: ReportQueryAtr = {
    title: observationId
      ? `Exception cases for ${obsTitle(observationId)}`
      : `Exception cases from ${session.file?.filename ?? 'the uploaded report'}`,
    summary: `${rows.length} exception row${rows.length === 1 ? '' : 's'} across ${linked.length} linked annexure${linked.length === 1 ? '' : 's'}, handed off from the uploaded Action Taken Report.`,
    findings: [],
    observations: [],
    answer: '',
  };
  REPORT_QUERIES_ATR[handoffId] = query;
  persistHandoff(handoffId, query);
  if (opts?.link) persistLink(handoffId, opts.link);

  try {
    const url = new URL(window.location.href);
    url.searchParams.set('view', 'manage-exceptions');
    url.searchParams.set('from', handoffId);
    // Pin the reports tab so the Manage Exceptions "Back" CTA returns the user
    // to My Reports → ATR with the upload wizard re-opened — it resumes its
    // persisted ATR Preview stage, so they land back exactly where they left.
    url.searchParams.set('tab', 'atr-upload');
    if (opts?.newTab) {
      // Open Manage Exceptions in a new tab, leaving the ATR preview in place.
      window.open(url.toString(), '_blank');
    } else {
      window.history.replaceState({}, '', url);
    }
  } catch { /* ignore */ }

  return rows.length;
}
