import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Pencil, Download, Save, SlidersHorizontal,
  ChevronUp, ChevronDown, Eye, EyeOff, ListTodo, RotateCcw,
} from 'lucide-react';
import Modal from '../../../shared/Modal';
import { Button } from '../../../shared/Button';
import { useToast } from '../../../shared/Toast';
import { useCurrentUser } from '../../../../context/CurrentUserContext';
import AtrDocument from '../../AtrDocument';
import { ATR_SECTION_ORDER, ATR_SECTION_LABEL, type AtrSectionKey } from '../../atrSections';
import { toAtrReportData } from '../toAtrReportData';
import { useAtrUpload } from '../AtrUploadContext';
import ObservationExceptionsModal from '../components/ObservationExceptionsModal';
import type { AtrReportData } from '../../atrTypes';
import type { AtrVersion } from '../types';

function parseVersion(s?: string): { maj: number; min: number } {
  const m = s?.match(/v(\d+)\.(\d+)/);
  return m ? { maj: +m[1], min: +m[2] } : { maj: 1, min: 0 };
}

/** Screen 7 — ATR preview. Reuses the existing AtrDocument renderer (brand
 *  fidelity), adds the floating toolbar, inline editing, section skip/reorder,
 *  version save and finalize-with-RBAC. */
export default function Step7AtrPreview({ onManageExceptions, onSaveAtr }: {
  /** Hand the linked exception cases for a single observation to case management. */
  onManageExceptions?: (observationId: string) => void;
  /** Persist the generated ATR into My Reports → ATR tab (upsert by session id). */
  onSaveAtr?: (sessionId: string, label: string | undefined, data: AtrReportData) => void;
}) {
  const { state, updateSession, addVersion } = useAtrUpload();
  const { addToast } = useToast();
  const { currentUser } = useCurrentUser();
  const session = state.session;

  const [editMode, setEditMode] = useState(false);
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveLabel, setSaveLabel] = useState('');
  const [order, setOrder] = useState<AtrSectionKey[]>(ATR_SECTION_ORDER);
  const [hidden, setHidden] = useState<AtrSectionKey[]>([]);
  // Observation whose linked exceptions are open in the per-observation modal.
  const [exceptionsObsId, setExceptionsObsId] = useState<string | null>(null);

  // Snapshot the session into an editable ATR draft on first entry.
  useEffect(() => {
    if (session && !session.atrDraft) updateSession(s => ({ ...s, atrDraft: toAtrReportData(s) }));
  }, [session, updateSession]);

  if (!session) return null;
  const data: AtrReportData = session.atrDraft ?? toAtrReportData(session);

  // Selected observations in the SAME order the renderer draws them (toAtrReportData
  // filters by `selected`), so the per-observation action slot's index maps back here.
  const selectedObs = session.observations.filter(o => o.selected);
  const annexFor = (obsId: string) => session.annexures.filter(a => a.observationId === obsId);
  const exceptionObs = exceptionsObsId ? session.observations.find(o => o.id === exceptionsObsId) ?? null : null;

  const isEditing = editMode;

  const patch = (partial: Partial<AtrReportData>) =>
    updateSession(s => ({ ...s, atrDraft: { ...(s.atrDraft ?? toAtrReportData(s)), ...partial } }));

  const newVersion = (label?: string): AtrVersion => {
    const latest = parseVersion(state.versions[0]?.versionNumber);
    const num = `v${latest.maj}.${latest.min + 1}`;
    return { id: `atrv-${Date.now()}`, versionNumber: num, status: 'draft', data, generatedAt: new Date().toISOString(), generatedBy: currentUser?.name ?? 'You', label };
  };

  const handleDownload = () => {
    // PDF download via the browser's print engine: the global print stylesheet
    // (index.css @media print) hides all chrome and emits only the
    // `.report-printable` ATR document. Setting document.title gives the saved
    // PDF a meaningful filename; we restore it once the dialog closes.
    const filename = `${data.meta.reportId || 'ATR'} — Action Taken Report`;
    const prevTitle = document.title;
    addToast({ type: 'info', message: 'Generating the PDF — pick “Save as PDF” as the destination.' });
    window.setTimeout(() => {
      document.title = filename;
      window.print();
      document.title = prevTitle;
    }, 250);
  };

  const handleSave = () => {
    const label = saveLabel.trim() || undefined;
    const v = newVersion(label);
    addVersion(v);
    // Persist into My Reports → ATR tab so the generated ATR lives alongside
    // every other report (upsert by session id — re-saving updates the card).
    onSaveAtr?.(session.id, label, data);
    addToast({ type: 'success', message: `Saved ${v.versionNumber} to My Reports → ATR${label ? ` — "${label}"` : ''}.` });
    setSaveOpen(false); setSaveLabel('');
  };

  // Section reorder / visibility
  const move = (key: AtrSectionKey, dir: -1 | 1) => setOrder(prev => {
    const i = prev.indexOf(key); const j = i + dir;
    if (j < 0 || j >= prev.length) return prev;
    const next = [...prev]; [next[i], next[j]] = [next[j], next[i]]; return next;
  });
  const toggleHidden = (key: AtrSectionKey) => setHidden(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]));
  const resetSections = () => { setOrder(ATR_SECTION_ORDER); setHidden([]); };
  const visibleCount = order.length - hidden.length;

  return (
    <div>
      {/* Floating toolbar — sticks to the top of the modal's scroll area. */}
      <div className="sticky top-0 z-20 -mx-1 mb-4 print:hidden">
        <div className="flex items-center justify-between gap-3 rounded-[12px] border border-canvas-border bg-canvas-elevated/95 backdrop-blur px-4 py-2.5 shadow-sm flex-wrap">
          <div className="flex items-center gap-3">
            <span className="text-[13px] font-semibold text-ink-800">ATR Preview</span>
            {state.versions[0] && <span className="text-[11px] font-semibold tabular-nums text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full">{state.versions[0].versionNumber}</span>}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button variant={isEditing ? 'secondary' : 'outline'} size="sm" pressed={isEditing} leftIcon={<Pencil size={14} />} onClick={() => setEditMode(e => !e)} title="Toggle inline editing">
              {isEditing ? 'Editing' : 'Edit'}
            </Button>

            <div className="relative">
              <Button variant="outline" size="sm" leftIcon={<SlidersHorizontal size={14} />} onClick={() => setSectionsOpen(o => !o)}>Sections</Button>
              <AnimatePresence>
                {sectionsOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setSectionsOpen(false)} />
                    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="absolute right-0 mt-1.5 w-[306px] z-20 rounded-[12px] border border-canvas-border bg-canvas-elevated shadow-xl overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2.5 border-b border-canvas-border">
                        <span className="text-[12px] font-semibold text-ink-800">Reorder &amp; skip sections</span>
                        <span className="text-[11px] tabular-nums text-ink-400">{visibleCount} of {order.length} shown</span>
                      </div>
                      <div className="p-1.5 max-h-[320px] overflow-y-auto">
                        {order.map((key, i) => {
                          const isHidden = hidden.includes(key);
                          return (
                            <div key={key} className="flex items-center gap-1 pl-1.5 pr-1 py-1 rounded-[8px] hover:bg-canvas transition-colors">
                              <span className="w-5 shrink-0 text-center text-[11px] font-semibold tabular-nums text-ink-300">{i + 1}</span>
                              <span className={`flex-1 min-w-0 truncate text-[12px] ${isHidden ? 'text-ink-400 line-through' : 'text-ink-700'}`}>{ATR_SECTION_LABEL[key]}</span>
                              <div className="flex items-center rounded-[7px] border border-canvas-border overflow-hidden mr-0.5">
                                <button onClick={() => move(key, -1)} disabled={i === 0} aria-label="Move up" className="w-6 h-6 inline-flex items-center justify-center text-ink-400 hover:text-ink-800 hover:bg-canvas disabled:opacity-25 cursor-pointer disabled:cursor-not-allowed transition-colors"><ChevronUp size={13} /></button>
                                <span className="w-px h-4 bg-canvas-border" aria-hidden="true" />
                                <button onClick={() => move(key, 1)} disabled={i === order.length - 1} aria-label="Move down" className="w-6 h-6 inline-flex items-center justify-center text-ink-400 hover:text-ink-800 hover:bg-canvas disabled:opacity-25 cursor-pointer disabled:cursor-not-allowed transition-colors"><ChevronDown size={13} /></button>
                              </div>
                              <button onClick={() => toggleHidden(key)} aria-label={isHidden ? 'Show section' : 'Skip section'} title={isHidden ? 'Show in report' : 'Skip in report'} className={`w-7 h-7 inline-flex items-center justify-center rounded-[7px] cursor-pointer transition-colors ${isHidden ? 'text-ink-400 hover:text-ink-700 hover:bg-canvas' : 'text-brand-700 bg-brand-50 hover:bg-brand-100'}`}>{isHidden ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-canvas-border">
                        <span className="text-[10.5px] text-ink-400 leading-tight">Hidden sections are skipped in the PDF.</span>
                        <button onClick={resetSections} className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:underline cursor-pointer"><RotateCcw size={11} aria-hidden="true" /> Reset</button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            <Button variant="outline" size="sm" leftIcon={<Download size={14} />} onClick={handleDownload}>Download</Button>
            <span className="w-px h-5 bg-canvas-border mx-0.5 hidden sm:block" aria-hidden="true" />
            <Button variant="primary" size="sm" leftIcon={<Save size={14} />} onClick={() => setSaveOpen(true)}>Save Version</Button>
          </div>
        </div>
      </div>

      {/* The document — reuses the existing renderer for exact brand fidelity */}
      <AtrDocument
        meta={data.meta}
        observations={data.observations}
        insights={data.insights}
        maxWidthClass="max-w-[880px]"
        editable={isEditing}
        sectionOrder={order}
        hiddenSections={hidden}
        onMetaChange={meta => patch({ meta })}
        onObservationsChange={observations => patch({ observations })}
        onInsightsChange={insights => patch({ insights })}
        renderObservationActions={i => {
          const eo = selectedObs[i];
          if (!eo) return null;
          const linked = annexFor(eo.id);
          if (linked.length === 0) return null;
          const rowCount = linked.reduce((n, a) => n + a.rows.length, 0);
          return (
            <button
              type="button"
              onClick={() => setExceptionsObsId(eo.id)}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[7px] text-[11.5px] font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 cursor-pointer transition-colors"
            >
              <ListTodo size={13} aria-hidden="true" /> Manage Exceptions
              <span className="tabular-nums text-brand-500">({rowCount})</span>
            </button>
          );
        }}
      />

      {isEditing && (
        <p className="text-center text-[11.5px] text-ink-400 mt-4 print:hidden">Click any text in the report to edit it. Changes save automatically.</p>
      )}

      {/* Per-observation linked-exceptions modal */}
      <AnimatePresence>
        {exceptionObs && (
          <ObservationExceptionsModal
            obs={exceptionObs}
            annexures={annexFor(exceptionObs.id)}
            onClose={() => setExceptionsObsId(null)}
            onGoToCaseManagement={() => {
              const id = exceptionObs.id;
              setExceptionsObsId(null);
              onManageExceptions?.(id);
            }}
          />
        )}
      </AnimatePresence>

      {/* Save Version modal */}
      <AnimatePresence>
        {saveOpen && (
          <Modal
            title="Save version"
            subtitle="Snapshot the current report as a labelled version."
            width="max-w-[460px]"
            onClose={() => setSaveOpen(false)}
            footer={<><Button variant="outline" onClick={() => setSaveOpen(false)}>Cancel</Button><Button variant="primary" leftIcon={<Save size={14} />} onClick={handleSave}>Save version</Button></>}
          >
            <label className="block text-[12px] font-semibold text-ink-700 mb-1.5">Version label (optional)</label>
            <input
              autoFocus value={saveLabel} onChange={e => setSaveLabel(e.target.value)}
              placeholder="e.g. Draft for partner review"
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
              className="w-full text-[13px] text-ink-800 bg-canvas-elevated border border-canvas-border rounded-[8px] px-3 py-2 focus:outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/15"
            />
            <p className="text-[11.5px] text-ink-400 mt-2">Saved versions are listed with a version number; the next save will be <span className="font-semibold tabular-nums">{`v${parseVersion(state.versions[0]?.versionNumber).maj}.${parseVersion(state.versions[0]?.versionNumber).min + 1}`}</span>.</p>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}
