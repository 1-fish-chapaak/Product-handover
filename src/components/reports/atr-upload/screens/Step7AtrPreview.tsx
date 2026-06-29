import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Pencil, Download, Save, SlidersHorizontal, ArrowLeft,
  ChevronUp, ChevronDown, Eye, EyeOff, ListTodo, RotateCcw,
} from 'lucide-react';
import { Button } from '../../../shared/Button';
import { useToast } from '../../../shared/Toast';
import AtrDocument from '../../AtrDocument';
import { exportAtrWord } from '../../atrTemplate';
import { ATR_SECTION_ORDER, ATR_SECTION_LABEL, type AtrSectionKey } from '../../atrSections';
import { toAtrReportData } from '../toAtrReportData';
import { useAtrUpload } from '../AtrUploadContext';
import { WizardFooter } from '../footerSlot';
import type { AtrReportData } from '../../atrTypes';

/** Screen 7 — ATR preview. Reuses the existing AtrDocument renderer (brand
 *  fidelity), adds the floating toolbar, inline editing, section skip/reorder,
 *  version save and finalize-with-RBAC. */
export default function Step7AtrPreview({ onManageExceptions, onSaveAtr }: {
  /** Hand the linked exception cases for a single observation to case management. */
  onManageExceptions?: (observationId: string) => void;
  /** Persist the generated ATR into My Reports → ATR tab (upsert by session id). */
  onSaveAtr?: (sessionId: string, label: string | undefined, data: AtrReportData) => string;
}) {
  const { state, updateSession, goTo } = useAtrUpload();
  const { addToast } = useToast();
  const session = state.session;

  const [editMode, setEditMode] = useState(false);
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const [order, setOrder] = useState<AtrSectionKey[]>(ATR_SECTION_ORDER);
  const [hidden, setHidden] = useState<AtrSectionKey[]>([]);

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

  const isEditing = editMode;

  const patch = (partial: Partial<AtrReportData>) =>
    updateSession(s => ({ ...s, atrDraft: { ...(s.atrDraft ?? toAtrReportData(s)), ...partial } }));

  const handleDownload = (kind: 'pdf' | 'word') => {
    if (kind === 'word') { exportAtrWord(data.meta, data.observations); addToast({ type: 'success', message: 'ATR exported to Word.' }); return; }
    // PDF via the browser's print engine: the global print stylesheet
    // (index.css @media print) hides all chrome and emits only the
    // `.report-printable` ATR document. Setting document.title gives the saved
    // PDF a meaningful filename; we restore it once the dialog closes.
    const filename = `${data.meta.reportId || 'ATR'} — Action Taken Report`;
    const prevTitle = document.title;
    addToast({ type: 'info', message: 'Opening the print dialog — pick “Save as PDF” as the destination.' });
    window.setTimeout(() => {
      document.title = filename;
      window.print();
      document.title = prevTitle;
    }, 250);
  };

  // Save directly — no dialog. The host upserts the ATR into My Reports and
  // returns the version label (v1, v2, …), incremented from the saved card so
  // it survives the wizard closing on save.
  const handleSave = () => {
    const versionNumber = onSaveAtr?.(session.id, undefined, data) ?? 'v1';
    addToast({ type: 'success', message: `Saved ${versionNumber} to My Reports → ATR.` });
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
      {/* Action bar — pinned to the modal's sticky footer (bottom), mirroring the
          rest of the wizard. Back on the left; the report actions on the right. */}
      <WizardFooter>
        <div className="flex items-center justify-between gap-3 flex-wrap border-t border-canvas-border bg-canvas-elevated px-6 py-3 print:hidden">
          <div className="flex items-center gap-2.5">
            <Button variant="ghost" size="md" leftIcon={<ArrowLeft size={15} />} onClick={() => goTo('annexures')}>Back</Button>
            {state.versions[0] && <span className="text-[11px] font-semibold tabular-nums text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full">{state.versions[0].versionNumber}</span>}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button variant={isEditing ? 'secondary' : 'outline'} size="md" pressed={isEditing} leftIcon={<Pencil size={15} />} onClick={() => setEditMode(e => !e)} title="Toggle inline editing">
              {isEditing ? 'Editing' : 'Edit items'}
            </Button>

            <div className="relative">
              <Button variant="outline" size="md" leftIcon={<SlidersHorizontal size={15} />} onClick={() => setSectionsOpen(o => !o)}>Sections</Button>
              <AnimatePresence>
                {sectionsOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setSectionsOpen(false)} />
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} className="absolute right-0 bottom-full mb-2 w-[306px] z-20 rounded-[12px] border border-canvas-border bg-canvas-elevated shadow-xl overflow-hidden">
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

            <Button variant="outline" size="md" leftIcon={<Download size={15} />} onClick={() => handleDownload('pdf')} title="Download the ATR as a PDF">Download</Button>
            <span className="w-px h-5 bg-canvas-border mx-0.5 hidden sm:block" aria-hidden="true" />
            <Button variant="primary" size="md" leftIcon={<Save size={15} />} onClick={handleSave}>Save Report</Button>
          </div>
        </div>
      </WizardFooter>

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
              onClick={() => onManageExceptions?.(eo.id)}
              title="Open these cases in Manage Exceptions (new tab)"
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
    </div>
  );
}
