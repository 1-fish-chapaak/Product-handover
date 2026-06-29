import { useRef, useState } from 'react';
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
  // Native OS file picker for uploading annexures (no intermediate modal).
  const annexInputRef = useRef<HTMLInputElement>(null);
  // Upload-and-link straight onto one observation (from its "+ Link" picker).
  const linkUploadInputRef = useRef<HTMLInputElement>(null);
  const [linkTargetObs, setLinkTargetObs] = useState<string | null>(null);

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

  // Upload an annexure already linked to a specific observation (from its "+ Link"
  // picker) — lands as Needs Review so the user can confirm the auto-link.
  const onUploadAnnexureLinked = (filename: string, obsId: string) => {
    const id = `ax-upload-${Date.now()}`;
    const newAnnex: ExtractedAnnexure = {
      id,
      filename,
      observationId: obsId,
      status: 'Needs Review',
      columns: ['Reference', 'Detail', 'Amount ₹'],
      rows: [{ id: `${id}-r1`, annexureId: id, data: { 'Reference': '—', 'Detail': 'Uploaded annexure', 'Amount ₹': '—' } }],
    };
    updateSession(s => ({ ...s, annexures: [...s.annexures, newAnnex] }));
    addToast({ type: 'success', message: `"${filename}" uploaded and linked to this observation.` });
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

  // Shared grid template so the column header and every row line up.
  const COLS = 'grid grid-cols-[minmax(0,1.7fr)_minmax(0,2.3fr)_150px] gap-4 items-center';

  return (
    <div className="w-full">
      {/* Heading */}
      <div className="mb-1 flex items-baseline justify-between gap-4">
        <h2 className="text-[1.0625rem] font-semibold text-ink-900 leading-tight">Confirm annexure mapping</h2>
        <span className="shrink-0 text-[12px] font-medium text-ink-500 tabular-nums">{confirmedCount} of {shownObs.length} confirmed</span>
      </div>
      <p className="text-[12.5px] text-ink-500 leading-snug mb-4">
        Each observation is linked to its annexure. Confirm the suggestions, or adjust any that need a second look.
      </p>

      {/* Mapping table — toolbar strip + column header + hairline-divided rows,
          all in one card so it reads as a single component. */}
      <div className="rounded-[12px] border border-canvas-border overflow-visible bg-canvas-elevated">
        {/* Toolbar — a status breakdown (what still needs attention) on the left,
            table-level actions as real buttons on the right. */}
        <div className="flex items-center justify-between gap-4 px-4 py-2.5 border-b border-canvas-border">
          <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-[12px] text-ink-600">
            {needsReview > 0 ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-mitigated-500" aria-hidden="true" />
                <span className="font-medium text-ink-800">{needsReview}</span> need{needsReview === 1 ? 's' : ''} review
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-compliant-500" aria-hidden="true" />
                All mappings confirmed
              </span>
            )}
            {orphanAnnex.length > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-ink-300" aria-hidden="true" />
                <span className="font-medium text-ink-800">{orphanAnnex.length}</span> unlinked annexure{orphanAnnex.length === 1 ? '' : 's'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {needsReview > 0 && (
              <Button variant="outline" size="sm" shape="md" leftIcon={<CheckCheck size={14} />} onClick={confirmAll}>Confirm all</Button>
            )}
            <Button variant="outline" size="sm" shape="md" leftIcon={<Upload size={14} />} onClick={() => annexInputRef.current?.click()}>Upload annexure</Button>
          </div>
        </div>

        {/* Column header */}
        <div className={`${COLS} px-4 py-2 border-b border-canvas-border bg-canvas/60 text-[10.5px] font-semibold uppercase tracking-wide text-ink-400`}>
          <span>Observation</span>
          <span>Annexure</span>
          <span className="text-right">Status</span>
        </div>

        <div className="divide-y divide-canvas-border">
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
            const linkState = linkStateOf(linked);
            const meta = STATE_META[linkState];
            // Orphan annexures available to link onto this observation.
            const available = orphanAnnex;
            return (
              <div key={o.id} className={`relative ${COLS} px-4 py-3 hover:bg-canvas/50 transition-colors`}>
                {ACCENT[linkState] && <span className={`absolute inset-y-0 left-0 w-[3px] ${ACCENT[linkState]}`} aria-hidden="true" />}

                {/* Observation */}
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-ink-900 truncate" title={obsTitle}>{obsTitle}</div>
                  {o.process && <div className="text-[11.5px] text-ink-500 truncate">{o.process}</div>}
                </div>

                {/* Linked annexures */}
                <div className="min-w-0 relative">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {linked.map(a => (
                      <span key={a.id} className="inline-flex items-center gap-1 h-6 pl-1.5 pr-0.5 rounded-[6px] bg-canvas border border-canvas-border text-[11.5px] text-ink-700 max-w-full">
                        <FileSpreadsheet size={11} className="text-compliant-700 shrink-0" aria-hidden="true" />
                        <button onClick={() => setViewId(a.id)} title={`View ${a.filename}`} className="truncate max-w-[200px] hover:text-brand-700 hover:underline underline-offset-2 cursor-pointer">{a.filename}</button>
                        <button onClick={() => unlink(a.id)} className="w-4 h-4 rounded-full hover:bg-risk-50 text-ink-400 hover:text-risk-700 flex items-center justify-center cursor-pointer shrink-0" aria-label={`Unlink ${a.filename}`}><X size={10} aria-hidden="true" /></button>
                      </span>
                    ))}
                    <button onClick={() => setPicker(picker === o.id ? null : o.id)} className="inline-flex items-center gap-1 h-6 px-1.5 rounded-[6px] text-[11.5px] font-semibold text-brand-700 hover:bg-brand-50 cursor-pointer transition-colors">
                      <Plus size={12} aria-hidden="true" /> Link
                    </button>
                    {linked.length === 0 && <span className="text-[11.5px] text-ink-400">No annexure linked yet</span>}
                  </div>
                  {picker === o.id && (
                    <>
                      <div className="fixed inset-0 z-[65]" onClick={() => setPicker(null)} />
                      <div className="absolute left-0 top-full mt-1 z-[70] w-72 max-h-64 overflow-y-auto bg-canvas-elevated border border-canvas-border shadow-xl rounded-[10px] p-1">
                        {available.length === 0 ? (
                          <div className="px-3 py-2.5 text-[11px] text-ink-500 text-center">No unlinked annexures to pick.</div>
                        ) : available.map(a => (
                          <button key={a.id} onClick={() => { link(a.id, o.id); setPicker(null); }} title={a.filename} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-[7px] hover:bg-brand-50 text-left cursor-pointer">
                            <FileSpreadsheet size={13} className="text-compliant-700 shrink-0" aria-hidden="true" />
                            <span className="min-w-0 flex-1"><span className="block text-[11.5px] font-medium text-ink-800 truncate">{a.filename}</span><span className="block text-[10px] text-ink-400">{a.rows.length} exception row{a.rows.length === 1 ? '' : 's'}</span></span>
                          </button>
                        ))}
                        {/* Upload a new annexure → linked straight to this observation. */}
                        <button
                          onClick={() => { setLinkTargetObs(o.id); setPicker(null); linkUploadInputRef.current?.click(); }}
                          className="w-full flex items-center gap-2 px-2.5 py-2 mt-1 rounded-[7px] border-t border-canvas-border text-brand-700 hover:bg-brand-50 text-left cursor-pointer"
                        >
                          <Upload size={13} className="shrink-0" aria-hidden="true" />
                          <span className="text-[11.5px] font-semibold">Upload annexure &amp; link</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Status / action — surfaces only the decision that matters per row */}
                <div className="flex items-center justify-end">
                  {linkState === 'confirmed' && (
                    <span title={meta.hint} className="inline-flex items-center gap-1 text-[11.5px] font-medium text-compliant-700">
                      <CheckCircle2 size={13} aria-hidden="true" /> Confirmed
                    </span>
                  )}
                  {linkState === 'review' && (
                    <button onClick={() => confirmObs(o.id)} title={meta.hint} className="inline-flex items-center gap-1 h-7 px-3 rounded-[7px] border border-mitigated/40 bg-mitigated-50 text-[11.5px] font-semibold text-mitigated-700 hover:bg-mitigated-100 transition-colors cursor-pointer">
                      <Check size={13} aria-hidden="true" /> Confirm
                    </button>
                  )}
                  {linkState === 'unlinked' && (
                    <span title={meta.hint} className="text-[11.5px] text-ink-400">Not linked</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {orphanAnnex.length > 0 && (
        <p className="mt-2.5 text-[11.5px] text-ink-500">
          <span className="font-medium text-ink-600">{orphanAnnex.length} unlinked annexure{orphanAnnex.length === 1 ? '' : 's'}</span> — use <span className="font-medium text-brand-700">Link</span> on an observation to attach {orphanAnnex.length === 1 ? 'it' : 'them'}.
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

      {/* Upload annexure — native OS file picker, opened by the toolbar button. */}
      <input
        ref={annexInputRef}
        type="file"
        multiple
        hidden
        accept=".xlsx,.xls,.csv"
        onChange={e => { Array.from(e.target.files ?? []).forEach(f => onUploadAnnexure(f.name)); e.currentTarget.value = ''; }}
      />
      {/* Upload-and-link — links the uploaded annexure straight to the observation
          whose "+ Link" picker opened it. */}
      <input
        ref={linkUploadInputRef}
        type="file"
        hidden
        accept=".xlsx,.xls,.csv"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f && linkTargetObs) onUploadAnnexureLinked(f.name, linkTargetObs);
          e.currentTarget.value = '';
          setLinkTargetObs(null);
        }}
      />
    </div>
  );
}
