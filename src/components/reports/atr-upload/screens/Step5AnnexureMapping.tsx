import { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import {
  ArrowRight, CheckCheck, Upload, Plus, X, Check,
  CheckCircle2, AlertCircle, Unlink, FileSpreadsheet,
} from 'lucide-react';
import Modal from '../../../shared/Modal';
import { Button } from '../../../shared/Button';
import { useToast } from '../../../shared/Toast';
import { useAtrUpload } from '../AtrUploadContext';
import { WizardFooter } from '../footerSlot';
import UploadDataModal from '../../../concierge-workflow-builder/UploadDataModal';
import type { ExtractedAnnexure, ExtractionSession } from '../types';

type LinkState = 'confirmed' | 'review' | 'unlinked';

const STATE_META: Record<LinkState, { label: string; cls: string; icon: typeof CheckCircle2; hint: string }> = {
  confirmed: { label: 'Confirmed', cls: 'bg-compliant-50 text-compliant-700 border-compliant/30', icon: CheckCircle2, hint: 'Mapping confirmed.' },
  review: { label: 'Needs review', cls: 'bg-mitigated-50 text-mitigated-700 border-mitigated/30', icon: AlertCircle, hint: 'AI-suggested link — confirm it’s correct or adjust it before continuing.' },
  unlinked: { label: 'Unlinked', cls: 'bg-risk-50 text-risk-700 border-risk/30', icon: Unlink, hint: 'No annexure linked — this observation won’t create exception cases in Manage Exceptions.' },
};

/** Screen 5 — confirm / adjust how annexures link to observations.
 *  Observation-centric: each observation row shows its linked annexure chips,
 *  a picker to link more, and an inline status + Confirm action. */
export default function Step5AnnexureMapping({ onContinue }: { onContinue: () => void }) {
  const { state, updateSession } = useAtrUpload();
  const { addToast } = useToast();
  const session = state.session;
  const [picker, setPicker] = useState<string | null>(null); // observation id with open link-picker
  const [viewId, setViewId] = useState<string | null>(null);  // annexure id open in the view modal
  // Upload-annexure surface — the platform's shared "Add data" upload modal.
  const [uploadOpen, setUploadOpen] = useState(false);

  // Upload a new annexure → adds it unlinked (orphan), then surfaces a toast so the
  // user can link it to an observation via any row's picker. (Mocked: a starter row
  // is seeded; real exception rows would come from parsing the workbook.)
  const onUploadAnnexure = (filename: string) => {
    const id = `ax-upload-${Date.now()}`;
    const newAnnex: ExtractedAnnexure = {
      id,
      filename,
      observationId: null,
      status: 'Unlinked',
      columns: ['Reference', 'Detail', 'Amount ₹'],
      rows: [{ id: `${id}-r1`, annexureId: id, data: { 'Reference': '—', 'Detail': 'Uploaded annexure — link to an observation', 'Amount ₹': '—' } }],
    };
    updateSession(s => ({ ...s, annexures: [...s.annexures, newAnnex] }));
    addToast({ type: 'success', message: `"${filename}" added — use “Link annexure” on an observation to map it.` });
  };

  if (!session) return null;
  const { annexures, observations } = session;

  const updateAnnex = (id: string, fn: (a: ExtractedAnnexure) => ExtractedAnnexure) =>
    updateSession(s => ({ ...s, annexures: s.annexures.map(a => (a.id === id ? fn(a) : a)) }));

  // Link an orphan annexure to an observation — lands as Needs Review for the user to confirm.
  const link = (axId: string, obsId: string) =>
    updateAnnex(axId, a => ({ ...a, observationId: obsId, status: 'Needs Review' }));
  const unlink = (axId: string) =>
    updateAnnex(axId, a => ({ ...a, observationId: null, status: 'Unlinked' }));
  // Confirm every annexure linked to this observation.
  const confirmObs = (obsId: string) =>
    updateSession(s => ({ ...s, annexures: s.annexures.map(a => (a.observationId === obsId ? { ...a, status: 'Confirmed' } : a)) }));

  const confirmAll = () => {
    updateSession(s => ({ ...s, annexures: s.annexures.map(a => ({ ...a, status: a.observationId ? 'Confirmed' : 'Unlinked' })) }));
    addToast({ type: 'success', message: 'All suggested annexure links confirmed.' });
  };

  const proceed = (skipped: boolean) => {
    updateSession(s => ({ ...s, annexuresSkipped: skipped } as ExtractionSession));
    onContinue();
  };

  // Observation-centric rows. Show the selected observations (the ones flowing into
  // the ATR); fall back to all if the previous step left nothing selected.
  const rowsObs = observations.filter(o => o.selected);
  const shownObs = rowsObs.length ? rowsObs : observations;
  const orphanAnnex = annexures.filter(a => !a.observationId);

  const linkStateOf = (linked: ExtractedAnnexure[]): LinkState =>
    linked.length === 0 ? 'unlinked' : linked.every(a => a.status === 'Confirmed') ? 'confirmed' : 'review';

  const needsReview = shownObs.filter(o => linkStateOf(annexures.filter(a => a.observationId === o.id)) === 'review').length;
  const confirmedCount = shownObs.filter(o => linkStateOf(annexures.filter(a => a.observationId === o.id)) === 'confirmed').length;
  // Free navigation — the banner is advisory, never a hard block.
  const canContinue = true;
  const viewing = annexures.find(a => a.id === viewId) ?? null;

  // Left accent strip — lets the eye land on the rows that still need a decision.
  const ACCENT: Record<LinkState, string> = { confirmed: '', review: 'bg-mitigated-500', unlinked: 'bg-risk-400' };

  return (
    <div className="max-w-[760px] mx-auto">
      {/* Heading — plain title line, no card chrome */}
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="text-[1.0625rem] font-semibold text-ink-900 leading-tight">Confirm annexure mapping</h2>
        <span className="shrink-0 text-[12px] text-ink-400 tabular-nums">{confirmedCount} of {shownObs.length} confirmed</span>
      </div>
      <p className="text-[12.5px] text-ink-500 leading-snug mb-3">
        We linked each annexure to an observation. Confirm the suggestions, or adjust any that need attention — unlinked annexures won't create exception cases.
      </p>

      {/* Needs-review alert — the one blocker that needs action, kept loud. */}
      {needsReview > 0 && (
        <div className="mb-3 flex items-center gap-2.5 rounded-[10px] border border-mitigated/30 bg-mitigated-50 px-4 py-2.5 text-[12.5px] text-mitigated-700">
          <AlertCircle size={15} className="shrink-0" aria-hidden="true" />
          <span className="flex-1">
            <span className="font-semibold">{needsReview} mapping{needsReview === 1 ? '' : 's'} need{needsReview === 1 ? 's' : ''} your review.</span> Confirm the suggested link or adjust it before continuing.
          </span>
          <button onClick={confirmAll} className="shrink-0 inline-flex items-center gap-1 h-7 px-2.5 text-[11.5px] font-semibold text-mitigated-700 border border-mitigated/40 hover:bg-mitigated/10 rounded-[6px] cursor-pointer transition-colors">
            <CheckCheck size={13} aria-hidden="true" /> Confirm all
          </button>
        </div>
      )}

      {/* Toolbar — sticky so the live count + Upload stay in reach. */}
      <div className="sticky top-0 z-10 mb-3 flex items-center justify-between gap-4 rounded-[10px] border border-canvas-border bg-canvas-elevated/90 backdrop-blur px-4 py-2.5">
        <span className="text-[12.5px] text-ink-700">
          <span className="font-bold tabular-nums text-ink-900">{confirmedCount}</span> of {shownObs.length} confirmed
          {orphanAnnex.length > 0 && <span className="text-ink-400"> · {orphanAnnex.length} unlinked annexure{orphanAnnex.length === 1 ? '' : 's'}</span>}
        </span>
        <Button variant="ghost" size="sm" leftIcon={<Upload size={14} />} onClick={() => setUploadOpen(true)}>Upload annexure</Button>
      </div>

      {/* Mapping list — one bordered card, hairline-divided rows */}
      <div className="rounded-[12px] border border-canvas-border overflow-visible bg-canvas-elevated divide-y divide-canvas-border">
        {shownObs.length === 0 && (
          <div className="px-4 py-10 text-center">
            <Unlink size={20} className="mx-auto text-ink-300 mb-2" aria-hidden="true" />
            <div className="text-[13px] font-medium text-ink-700">No observations to link</div>
            <div className="text-[12px] text-ink-500 mt-0.5">Select observations on the previous step to map annexures here.</div>
          </div>
        )}
        {shownObs.map(o => {
          const obsTitle = o.title?.trim() || `Observation #${o.number}`;
          const linked = annexures.filter(a => a.observationId === o.id);
          const rowCount = linked.reduce((n, a) => n + a.rows.length, 0);
          const linkState = linkStateOf(linked);
          const meta = STATE_META[linkState];
          // Orphan annexures available to link onto this observation.
          const available = orphanAnnex;
          return (
            <div key={o.id} className="relative flex items-center gap-4 px-4 py-3 hover:bg-canvas/50 transition-colors">
              {ACCENT[linkState] && <span className={`absolute inset-y-0 left-0 w-[3px] ${ACCENT[linkState]}`} aria-hidden="true" />}

              {/* Observation */}
              <div className="min-w-0 w-[36%] shrink-0">
                <div className="text-[13px] font-semibold text-ink-900 truncate" title={obsTitle}>{obsTitle}</div>
                {o.process && <div className="text-[11.5px] text-ink-500 truncate">{o.process}</div>}
              </div>

              {/* Linked annexures */}
              <div className="min-w-0 flex-1 relative">
                <div className="flex flex-wrap items-center gap-1.5">
                  {linked.map(a => (
                    <span key={a.id} className="inline-flex items-center gap-1 h-6 pl-1.5 pr-0.5 rounded-[6px] bg-canvas border border-canvas-border text-[11.5px] text-ink-700 max-w-full">
                      <FileSpreadsheet size={11} className="text-compliant-700 shrink-0" aria-hidden="true" />
                      <button onClick={() => setViewId(a.id)} title={`View ${a.filename}`} className="truncate max-w-[170px] hover:text-brand-700 hover:underline underline-offset-2 cursor-pointer">{a.filename}</button>
                      <button onClick={() => unlink(a.id)} className="w-4 h-4 rounded-full hover:bg-risk-50 text-ink-400 hover:text-risk-700 flex items-center justify-center cursor-pointer shrink-0" aria-label={`Unlink ${a.filename}`}><X size={10} aria-hidden="true" /></button>
                    </span>
                  ))}
                  {available.length > 0 && (
                    <button onClick={() => setPicker(picker === o.id ? null : o.id)} className="inline-flex items-center gap-1 h-6 px-1.5 rounded-[6px] text-[11.5px] font-semibold text-brand-700 hover:bg-brand-50 cursor-pointer transition-colors">
                      <Plus size={12} aria-hidden="true" /> Link
                    </button>
                  )}
                  {linked.length === 0 && available.length === 0 && <span className="text-[11.5px] text-ink-400">No annexure linked</span>}
                </div>
                {picker === o.id && (
                  <>
                    <div className="fixed inset-0 z-[65]" onClick={() => setPicker(null)} />
                    <div className="absolute left-0 top-full mt-1 z-[70] w-72 max-h-56 overflow-y-auto bg-canvas-elevated border border-canvas-border shadow-xl rounded-[10px] p-1">
                      {available.length === 0 ? (
                        <div className="px-3 py-3 text-[11px] text-ink-500 text-center">No unlinked annexures. Upload one to link it here.</div>
                      ) : available.map(a => (
                        <button key={a.id} onClick={() => { link(a.id, o.id); setPicker(null); }} title={a.filename} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-[7px] hover:bg-brand-50 text-left cursor-pointer">
                          <FileSpreadsheet size={13} className="text-compliant-700 shrink-0" aria-hidden="true" />
                          <span className="min-w-0 flex-1"><span className="block text-[11.5px] font-medium text-ink-800 truncate">{a.filename}</span><span className="block text-[10px] text-ink-400">{a.rows.length} exception row{a.rows.length === 1 ? '' : 's'}</span></span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Rows */}
              <div className="shrink-0 w-12 text-right text-[11.5px] text-ink-500 tabular-nums">{rowCount ? `${rowCount} row${rowCount === 1 ? '' : 's'}` : '—'}</div>

              {/* Status + confirm */}
              <div className="shrink-0 w-[132px] flex flex-col items-end gap-1.5">
                <span title={meta.hint} className={`inline-flex items-center gap-1 h-5 px-2 rounded-full border text-[11px] font-semibold cursor-help ${meta.cls}`}>
                  <meta.icon size={11} aria-hidden="true" /> {meta.label}
                </span>
                {linkState === 'review' && (
                  <button onClick={() => confirmObs(o.id)} title="Mark this mapping as confirmed" className="inline-flex items-center gap-1 h-6 px-2 rounded-[6px] border border-brand-200 bg-brand-50 text-[11px] font-semibold text-brand-700 hover:bg-brand-100 hover:border-brand-300 transition-colors cursor-pointer"><Check size={12} aria-hidden="true" /> Confirm</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {orphanAnnex.length > 0 && (
        <p className="mt-2 text-[11.5px] text-ink-500">
          <span className="font-medium text-ink-600">{orphanAnnex.length} unlinked annexure{orphanAnnex.length === 1 ? '' : 's'}</span> not yet mapped — use “Link” on an observation to attach {orphanAnnex.length === 1 ? 'it' : 'them'}.
        </p>
      )}

      {/* Footer — pinned below the scroll area */}
      <WizardFooter>
        <div className="flex items-center justify-end gap-3 flex-wrap border-t border-canvas-border bg-canvas-elevated px-6 py-3">
          <Button variant="ghost" size="md" onClick={() => proceed(true)} title="Manage Exceptions will be unavailable without confirmed annexure links.">Skip annexures &amp; proceed</Button>
          <Button variant="primary" size="md" rightIcon={<ArrowRight size={15} />} disabled={!canContinue} onClick={() => proceed(false)}>Confirm mapping &amp; continue</Button>
        </div>
      </WizardFooter>

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

      {/* Upload annexure — the platform's shared "Add data" upload modal. */}
      <UploadDataModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title="Upload annexure"
        allowedTabs={['upload', 'all', 'files', 'folder']}
        hideSessionFiles
        footerHint="Add an annexure workbook, then link it to an observation."
        onAttachDraft={({ files }) => files.forEach(f => onUploadAnnexure(f.name))}
      />
    </div>
  );
}
