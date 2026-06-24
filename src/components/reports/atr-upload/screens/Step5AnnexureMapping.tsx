import { useState, useRef } from 'react';
import { AnimatePresence } from 'motion/react';
import { ArrowRight, CheckCheck, AlertTriangle, Upload } from 'lucide-react';
import Modal from '../../../shared/Modal';
import { Button } from '../../../shared/Button';
import { useToast } from '../../../shared/Toast';
import { useAtrUpload } from '../AtrUploadContext';
import { WizardFooter } from '../footerSlot';
import AnnexureMappingRow from '../components/AnnexureMappingRow';
import type { ExtractedAnnexure, ExtractionSession } from '../types';

/** Screen 5 — confirm / adjust how annexures link to observations. */
export default function Step5AnnexureMapping({ onContinue }: { onContinue: () => void }) {
  const { state, updateSession } = useAtrUpload();
  const { addToast } = useToast();
  const session = state.session;
  const [editId, setEditId] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Upload a new annexure → adds it unlinked, then opens the link modal so the
  // user can attach it to an observation. (Mocked: a starter row is seeded; real
  // exception rows would come from parsing the workbook.)
  const onUploadAnnexure = (file: File) => {
    const id = `ax-upload-${Date.now()}`;
    const newAnnex: ExtractedAnnexure = {
      id,
      filename: file.name,
      observationId: null,
      status: 'Unlinked',
      columns: ['Reference', 'Detail', 'Amount ₹'],
      rows: [{ id: `${id}-r1`, annexureId: id, data: { 'Reference': '—', 'Detail': 'Uploaded annexure — link to an observation', 'Amount ₹': '—' } }],
    };
    updateSession(s => ({ ...s, annexures: [...s.annexures, newAnnex] }));
    addToast({ type: 'success', message: `"${file.name}" added — link it to an observation below.` });
    setEditId(id);
  };

  if (!session) return null;
  const { annexures, observations } = session;

  const obsLabel = (obsId: string | null) => {
    if (!obsId) return null;
    const o = observations.find(x => x.id === obsId);
    return o ? (o.title?.trim() || `Observation #${o.number}`) : null;
  };

  const updateAnnex = (id: string, fn: (a: ExtractedAnnexure) => ExtractedAnnexure) =>
    updateSession(s => ({ ...s, annexures: s.annexures.map(a => (a.id === id ? fn(a) : a)) }));

  const relink = (id: string, obsId: string | null) =>
    updateAnnex(id, a => ({ ...a, observationId: obsId, status: obsId ? 'Confirmed' : 'Unlinked' }));
  const confirm = (id: string) => updateAnnex(id, a => ({ ...a, status: 'Confirmed' }));
  const unlink = (id: string) => updateAnnex(id, a => ({ ...a, observationId: null, status: 'Unlinked' }));

  const confirmAll = () => {
    updateSession(s => ({ ...s, annexures: s.annexures.map(a => ({ ...a, status: a.observationId ? 'Confirmed' : 'Unlinked' })) }));
    addToast({ type: 'success', message: 'All suggested annexure links confirmed.' });
  };

  const proceed = (skipped: boolean) => {
    updateSession(s => ({ ...s, annexuresSkipped: skipped } as ExtractionSession));
    onContinue();
  };

  const needsReview = annexures.filter(a => a.status === 'Needs Review').length;
  // Free navigation — the "Needs Review" banner is advisory, never a hard block.
  const canContinue = true;
  const editing = annexures.find(a => a.id === editId) ?? null;
  const viewing = annexures.find(a => a.id === viewId) ?? null;

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
        <div>
          <h2 className="text-[1.0625rem] font-semibold text-ink-900 mb-0.5">Confirm annexure mapping</h2>
          <p className="text-[12.5px] text-ink-500 max-w-[560px] leading-snug">Each annexure was matched to an observation automatically. Review the links, adjust any that need attention, or upload a new annexure and link it yourself. Exception rows power the linked cases in Manage Exceptions.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="sr-only"
            onChange={e => { const f = e.target.files?.[0]; if (f) onUploadAnnexure(f); e.currentTarget.value = ''; }}
          />
          <Button variant="outline" size="md" leftIcon={<Upload size={15} />} onClick={() => fileInputRef.current?.click()}>Upload annexure</Button>
          <Button variant="outline" size="md" leftIcon={<CheckCheck size={15} />} onClick={confirmAll}>Confirm all suggested</Button>
        </div>
      </div>

      {needsReview > 0 && (
        <div className="mb-3 flex items-start gap-2.5 rounded-[8px] border border-mitigated/30 bg-mitigated-50 px-4 py-2.5 text-[12.5px] text-mitigated-700">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" aria-hidden="true" />
          <span><span className="font-semibold">{needsReview} annexure{needsReview === 1 ? '' : 's'} need{needsReview === 1 ? 's' : ''} review.</span> Confirm or unlink each one before continuing.</span>
        </div>
      )}

      <div className="rounded-[12px] border border-canvas-border overflow-hidden bg-canvas-elevated">
        <table className="w-full">
          <thead>
            <tr className="bg-brand-50/50 text-ink-600">
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide">Observation</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide">Linked annexure</th>
              <th className="px-4 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide">Exception rows</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide">Status</th>
              <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody>
            {annexures.map(a => (
              <AnnexureMappingRow
                key={a.id}
                annex={a}
                observationLabel={obsLabel(a.observationId)}
                onConfirm={() => confirm(a.id)}
                onEdit={() => setEditId(a.id)}
                onUnlink={() => unlink(a.id)}
                onView={() => setViewId(a.id)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer — pinned below the scroll area */}
      <WizardFooter>
        <div className="flex items-center justify-end gap-3 flex-wrap border-t border-canvas-border bg-canvas-elevated px-6 py-3">
          <Button variant="ghost" size="md" onClick={() => proceed(true)} title="Manage Exceptions will be unavailable without confirmed annexure links.">Skip annexures &amp; proceed</Button>
          <Button variant="primary" size="md" rightIcon={<ArrowRight size={15} />} disabled={!canContinue} onClick={() => proceed(false)} title={canContinue ? undefined : 'Resolve every "Needs Review" annexure first.'}>Confirm mapping &amp; continue</Button>
        </div>
      </WizardFooter>

      {/* Edit / relink modal */}
      <AnimatePresence>
        {editing && (
          <Modal
            title="Link annexure to an observation"
            subtitle={editing.filename}
            width="max-w-[520px]"
            onClose={() => setEditId(null)}
            footer={<Button variant="outline" onClick={() => setEditId(null)}>Done</Button>}
          >
            <div className="space-y-1.5">
              <label className="flex items-center gap-2.5 px-3 py-2.5 rounded-[8px] border border-canvas-border hover:border-brand-200 cursor-pointer">
                <input type="radio" name="link" checked={!editing.observationId} onChange={() => relink(editing.id, null)} className="accent-brand-600" />
                <span className="text-[12.5px] text-ink-600">Unlink — no observation (orphan)</span>
              </label>
              {observations.map(o => (
                <label key={o.id} className="flex items-center gap-2.5 px-3 py-2.5 rounded-[8px] border border-canvas-border hover:border-brand-200 cursor-pointer">
                  <input type="radio" name="link" checked={editing.observationId === o.id} onChange={() => relink(editing.id, o.id)} className="accent-brand-600" />
                  <span className="text-[11px] font-semibold tabular-nums text-ink-400">#{o.number}</span>
                  <span className="text-[12.5px] text-ink-800 truncate">{o.title?.trim() || 'Untitled observation'}</span>
                </label>
              ))}
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* View annexure modal (read-only table) */}
      <AnimatePresence>
        {viewing && (
          <Modal
            title={viewing.filename}
            subtitle={`${viewing.rows.length} exception row${viewing.rows.length === 1 ? '' : 's'}`}
            width="max-w-[760px]"
            onClose={() => setViewId(null)}
            footer={<Button variant="outline" onClick={() => setViewId(null)}>Close</Button>}
          >
            <div className="overflow-x-auto rounded-[8px] border border-canvas-border">
              <table className="w-full">
                <thead>
                  <tr className="bg-canvas">
                    {viewing.columns.map(c => (
                      <th key={c} className="px-3 py-2 text-left text-[10.5px] font-semibold uppercase tracking-wide text-ink-500 whitespace-nowrap">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {viewing.rows.map(r => (
                    <tr key={r.id} className="border-t border-canvas-border">
                      {viewing.columns.map(c => (
                        <td key={c} className="px-3 py-2 text-[12px] text-ink-700 whitespace-nowrap tabular-nums">{r.data[c] ?? '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}
