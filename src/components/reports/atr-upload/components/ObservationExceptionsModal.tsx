import { ArrowRight, Paperclip } from 'lucide-react';
import Modal from '../../../shared/Modal';
import { Button } from '../../../shared/Button';
import type { ExtractedObservation, ExtractedAnnexure } from '../types';

/**
 * Per-observation "Manage Exceptions" surface. Shows ONLY the annexures linked
 * to a single observation (segregated — never the whole report's annexures), so
 * the auditor can review that observation's exception rows and hand just those
 * cases to case management. Reached from the per-observation CTA on the ATR.
 */
export default function ObservationExceptionsModal({
  obs, annexures, onGoToCaseManagement, onClose,
}: {
  obs: ExtractedObservation;
  annexures: ExtractedAnnexure[];
  onGoToCaseManagement: () => void;
  onClose: () => void;
}) {
  const totalRows = annexures.reduce((n, a) => n + a.rows.length, 0);
  const title = obs.title?.trim() || `Observation #${obs.number}`;

  return (
    <Modal
      title="Linked exceptions"
      subtitle={`#${obs.number} · ${title} — ${annexures.length} annexure${annexures.length === 1 ? '' : 's'} · ${totalRows} exception row${totalRows === 1 ? '' : 's'}`}
      width="max-w-[820px]"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button variant="primary" rightIcon={<ArrowRight size={15} />} disabled={totalRows === 0} onClick={onGoToCaseManagement}>
            Go to case management
          </Button>
        </>
      }
    >
      <p className="text-[0.78125rem] text-ink-500 mb-4">
        These are the exception cases linked to this observation only. Review them here, then send just these cases to case management — the rest of the report's exceptions stay untouched.
      </p>

      <div className="space-y-5">
        {annexures.map(a => (
          <div key={a.id}>
            <div className="flex items-center gap-2 mb-2">
              <Paperclip size={13} className="text-ink-400" aria-hidden="true" />
              <span className="text-[0.78125rem] font-semibold text-ink-800">{a.filename}</span>
              <span className="text-[0.6875rem] text-ink-500">· {a.rows.length} row{a.rows.length === 1 ? '' : 's'}</span>
            </div>
            <div className="overflow-x-auto rounded-md border border-canvas-border">
              <table className="w-full">
                <thead>
                  <tr className="bg-canvas">
                    {a.columns.map(c => (
                      <th key={c} className="px-3 py-2 text-left text-[0.65625rem] font-semibold uppercase tracking-wide text-ink-500 whitespace-nowrap">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {a.rows.map(r => (
                    <tr key={r.id} className="border-t border-canvas-border">
                      {a.columns.map(c => (
                        <td key={c} className="px-3 py-2 text-[0.75rem] text-ink-700 whitespace-nowrap tabular-nums">{r.data[c] ?? '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {annexures.length === 0 && (
          <p className="text-[0.8125rem] text-ink-500">No annexures are linked to this observation yet.</p>
        )}
      </div>
    </Modal>
  );
}
