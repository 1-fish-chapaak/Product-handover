import { useState } from 'react';
import { motion } from 'motion/react';
import { X, FileText, Download, ChevronDown, FilePlus2 } from 'lucide-react';
import { ManageExceptionsLaunchButton } from './ManageExceptionsLaunchButton';
import AtrDocument from './AtrDocument';
import { exportAtrExcel, exportAtrWord } from './atrTemplate';
import type { AtrMeta, AtrObservation, AtrInsight } from './atrTypes';
import { useToast } from '../shared/Toast';

export default function ComprehensiveAtrModal({
  meta,
  observations,
  insights = [],
  onClose,
  manageExceptionsQueryId,
  onAddToReport,
}: {
  meta: AtrMeta;
  observations: AtrObservation[];
  insights?: AtrInsight[];
  onClose: () => void;
  manageExceptionsQueryId?: string;
  /** When provided, the footer shows "Add to Report" instead of Download —
   *  the generated ATR is saved to My Reports and opened. */
  onAddToReport?: () => void;
}) {
  const { addToast } = useToast();
  const [showFormats, setShowFormats] = useState(false);

  const handleDownload = (kind: 'pdf' | 'word' | 'excel') => {
    setShowFormats(false);
    if (kind === 'excel') { exportAtrExcel(meta, observations); addToast({ type: 'success', message: 'ATR exported to Excel.' }); return; }
    if (kind === 'word') { exportAtrWord(meta, observations); addToast({ type: 'success', message: 'ATR exported to Word.' }); return; }
    // PDF — use the browser print dialog (Save as PDF).
    addToast({ type: 'info', message: 'Opening print dialog — choose “Save as PDF”.' });
    window.setTimeout(() => window.print(), 250);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] z-50"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: 8 }}
        transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[1040px] max-w-[95vw] h-[662px] max-h-[90vh] bg-canvas-elevated rounded-[16px] shadow-xl border border-canvas-border z-[60] flex flex-col"
        role="dialog"
        aria-label="Action Taken Report"
      >
        {/* Title bar */}
        {/* Title bar — the document banner carries the report title, so this
            bar stays a thin context strip. */}
        <header className="shrink-0 px-6 py-2.5 flex items-center justify-between gap-4 border-b border-canvas-border">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-[8px] bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
              <FileText size={14} />
            </div>
            <p className="text-[0.8125rem] font-medium text-ink-600 truncate">
              Generated from {observations.length} observation{observations.length === 1 ? '' : 's'} · <span className="font-mono">{meta.reportId}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-draft-50 flex items-center justify-center cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </header>

        {/* Document */}
        <div className="flex-1 min-h-0 overflow-y-auto bg-draft-50 py-6">
          <AtrDocument meta={meta} observations={observations} insights={insights} />
        </div>

        {/* Footer */}
        <footer className="shrink-0 px-6 py-3.5 border-t border-canvas-border flex items-center justify-end gap-2">
          {manageExceptionsQueryId && (
            <div className="mr-auto">
              <ManageExceptionsLaunchButton queryId={manageExceptionsQueryId} />
            </div>
          )}
          <button
            onClick={onClose}
            className="h-10 px-5 text-[0.8125rem] font-medium text-ink-700 bg-canvas-elevated border border-canvas-border rounded-[8px] hover:border-brand-200 transition-colors cursor-pointer"
          >
            {onAddToReport ? 'Cancel' : 'Close'}
          </button>
          {onAddToReport ? (
            <button
              onClick={onAddToReport}
              className="h-10 px-5 inline-flex items-center gap-2 text-[0.8125rem] font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-[8px] cursor-pointer transition-colors"
            >
              <FilePlus2 size={14} />
              Add to Report
            </button>
          ) : (
          <div className="relative">
            <button
              onClick={() => setShowFormats(p => !p)}
              className="h-10 px-5 inline-flex items-center gap-2 text-[0.8125rem] font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-[8px] cursor-pointer transition-colors"
            >
              <Download size={14} />
              Download
              <ChevronDown size={13} className={`transition-transform ${showFormats ? 'rotate-180' : ''}`} />
            </button>
            {showFormats && (
              <>
                <div className="fixed inset-0 z-[65]" onClick={() => setShowFormats(false)} />
                <div className="absolute right-0 bottom-full mb-1.5 z-[70] bg-white border border-canvas-border shadow-xl py-1 w-48 rounded-[8px] overflow-hidden">
                  {[
                    { kind: 'pdf' as const, label: 'Print / Save as PDF' },
                    { kind: 'word' as const, label: 'Download as Word' },
                    { kind: 'excel' as const, label: 'Download as Excel' },
                  ].map(f => (
                    <button
                      key={f.kind}
                      onClick={() => handleDownload(f.kind)}
                      className="w-full text-left px-3 py-2 text-[0.75rem] text-ink-700 hover:bg-brand-50 hover:text-brand-700 transition-colors cursor-pointer"
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          )}
        </footer>
      </motion.div>
    </>
  );
}
