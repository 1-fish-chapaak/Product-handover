import { handoffToManageExceptions } from './handoff';
import { UPLOAD_REPORT_ID_PREFIX } from './uploadedReport';
import type { ExtractionSession } from './types';
import type { AtrObservation } from '../atrTypes';

/** The exception rows sitting behind one observation of a saved uploaded ATR —
 *  the data the old per-observation "Manage Exceptions" button stood on. It is
 *  a plain descriptor now rather than a button of its own, because the report
 *  offers a single "Manage" menu per observation and this is one entry in it. */
export interface ObservationExceptions {
  /** How many exception rows roll up into this observation. */
  count: number;
  /** Hand them to Manage Exceptions in a new tab, and return a line describing
   *  what happened for the caller to write to the audit log. */
  handoff: () => string;
}

/** Null when the observation has no linked annexure rows — there is then
 *  nothing to manage over in Manage Exceptions. */
export function observationExceptions(
  session: ExtractionSession,
  /** 0-based position in the rendered report — the fallback link for ATRs
   *  saved before observations carried `sourceObservationId`. */
  index: number,
  obs: AtrObservation,
): ObservationExceptions | null {
  // The rendered observation → the extracted one it came from: by source id
  // when present, else by position among the selected observations (the order
  // toAtrReportData draws them in).
  const source = obs.sourceObservationId
    ? session.observations.find(o => o.id === obs.sourceObservationId)
    : session.observations.filter(o => o.selected)[index];
  if (!source) return null;
  const linked = session.annexures.filter(a => a.observationId === source.id);
  if (linked.length === 0) return null;

  return {
    count: linked.reduce((n, a) => n + a.rows.length, 0),
    handoff: () => {
      // Link the hand-off to this saved report + observation so case actions
      // taken over there land on the report's Report Snapshot timeline.
      const n = handoffToManageExceptions(session, source.id, {
        newTab: true,
        link: { reportId: `${UPLOAD_REPORT_ID_PREFIX}${session.id}`, observationIndex: index, observationTitle: obs.title },
      });
      const label = source.title?.trim() || `Observation #${source.number}`;
      return `Handed off ${n} exception row${n === 1 ? '' : 's'} from "${label}" to Manage Exceptions (new tab)`;
    },
  };
}
