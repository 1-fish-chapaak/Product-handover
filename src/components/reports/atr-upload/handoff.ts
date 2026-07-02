// "Manage Exceptions First" hand-off. Reuses the platform's existing
// from=<queryId> deep-link path in ManageExceptionsView (which derives cases
// from QUERY_TABLES[id]) by injecting a synthetic query table built from the
// confirmed annexure rows. In-place object mutation mirrors how the app already
// mutates shared mock stores (e.g. GRC_CASE_DETAILS); because navigation is
// SPA-internal (no reload) the injected entry persists for the session.

import { QUERY_TABLES } from '../../../data/queryGraphs';
import { REPORT_QUERIES_ATR } from '../../../data/reportQueries';
import type { ExtractionSession } from './types';

export const ATR_HANDOFF_ID = 'ATR-UPLOAD';

/** Build + register the exception cases from the linked annexures, set the URL
 *  so ManageExceptionsView resolves them, and return the row count.
 *
 *  Pass `observationId` to hand off ONLY the annexures linked to that one
 *  observation — this powers the per-observation "Manage Exceptions" CTA on the
 *  generated ATR, so each observation's cases stay segregated. Omit it to hand
 *  off every linked annexure at once. */
export function handoffToManageExceptions(session: ExtractionSession, observationId?: string, opts?: { newTab?: boolean }): number {
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
  REPORT_QUERIES_ATR[handoffId] = {
    title: observationId
      ? `Exception cases for ${obsTitle(observationId)}`
      : `Exception cases from ${session.file?.filename ?? 'the uploaded report'}`,
    summary: `${rows.length} exception row${rows.length === 1 ? '' : 's'} across ${linked.length} linked annexure${linked.length === 1 ? '' : 's'}, handed off from the uploaded Action Taken Report.`,
    findings: [],
    observations: [],
    answer: '',
  };

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
