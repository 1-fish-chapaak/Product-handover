import { ListTodo } from 'lucide-react';
import { handoffToManageExceptions } from '../handoff';
import { UPLOAD_REPORT_ID_PREFIX } from '../uploadedReport';
import { useAuditLog } from '../../../../context/AdminDataContext';
import type { ExtractionSession } from '../types';
import type { AtrObservation } from '../../atrTypes';

/** Per-observation "Manage Exceptions" CTA on a saved uploaded ATR — the same
 *  one the in-wizard preview carried. Hands ONLY the exception rows linked to
 *  this observation's annexures to Manage Exceptions, in a new tab so the
 *  report stays put. Renders nothing when the observation has no linked rows. */
export default function ObservationExceptionsAction({ session, index, obs }: {
  session: ExtractionSession;
  /** 0-based position in the rendered report — the fallback link for ATRs
   *  saved before observations carried `sourceObservationId`. */
  index: number;
  obs: AtrObservation;
}) {
  const logEvent = useAuditLog();
  // The rendered observation → the extracted one it came from: by source id
  // when present, else by position among the selected observations (the order
  // toAtrReportData draws them in).
  const source = obs.sourceObservationId
    ? session.observations.find(o => o.id === obs.sourceObservationId)
    : session.observations.filter(o => o.selected)[index];
  if (!source) return null;
  const linked = session.annexures.filter(a => a.observationId === source.id);
  if (linked.length === 0) return null;
  const rowCount = linked.reduce((n, a) => n + a.rows.length, 0);

  const handoff = () => {
    // Link the hand-off to this saved report + observation so case actions
    // taken over there land on the report's Report Snapshot timeline.
    const n = handoffToManageExceptions(session, source.id, {
      newTab: true,
      link: { reportId: `${UPLOAD_REPORT_ID_PREFIX}${session.id}`, observationIndex: index, observationTitle: obs.title },
    });
    const label = source.title?.trim() || `Observation #${source.number}`;
    logEvent({ action: 'Export', description: `Handed off ${n} exception row${n === 1 ? '' : 's'} from "${label}" to Manage Exceptions (new tab)`, module: 'Reports', entity: 'Exception Case' });
  };

  return (
    <button
      type="button"
      onClick={handoff}
      title="Open these cases in Manage Exceptions (new tab)"
      className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-sm text-[0.71875rem] font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 cursor-pointer transition-colors"
    >
      <ListTodo size={13} aria-hidden="true" /> Manage Exceptions
      <span className="tabular-nums text-brand-500">({rowCount})</span>
    </button>
  );
}
