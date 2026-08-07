import { useState } from 'react';
import { motion } from 'motion/react';
import { X, Printer, Save, FileText } from 'lucide-react';
import AtrDocument from '../reports/AtrDocument';
import { SAMPLE_OBSERVATIONS, SAMPLE_INSIGHTS } from '../reports/atrTemplate';
import { useAuditLog } from '../../context/AdminDataContext';
import type { AtrReportData, AtrMeta } from '../reports/atrTypes';

/** Pre-fillable metadata so the same preview can be reused from other flows. */
export interface AtrInitialMeta {
  auditTitle?: string;
  auditEntity?: string;
  auditPeriod?: string;
  preparedBy?: string;
  reportId?: string;
  generatedOn?: string;
}

// Print scope — when Download triggers window.print(), only the ATR document
// prints (the backdrop, header and footer are hidden).
const PRINT_CSS = `@media print {
  body * { visibility: hidden !important; }
  .atr-print-root, .atr-print-root * { visibility: visible !important; }
  .atr-print-root { position: absolute !important; left: 0; top: 0; width: 100%; height: auto !important; max-height: none !important; box-shadow: none !important; border: 0 !important; overflow: visible !important; }
  .atr-print-root .atr-scroll { overflow: visible !important; }
  .atr-no-print { display: none !important; }
}`;

/**
 * Live ATR — a read-only Action Taken Report preview in the canonical AtrDocument
 * format. Two bottom CTAs: Download (export to PDF) and Save Version (snapshot the
 * report as a new card in the ATR tab). No Cancel — dismiss via the header ✕.
 */
export default function GenerateATRModal({
  onClose,
  initial,
  atrData,
  onSaveVersion,
}: {
  onClose: () => void;
  initial?: AtrInitialMeta;
  atrData?: AtrReportData;
  /** Snapshot this ATR as a new ATR-tab card under the given version label. */
  onSaveVersion?: (label: string, data: AtrReportData) => void;
}) {
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [label, setLabel] = useState('');
  const logEvent = useAuditLog();

  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const meta: AtrMeta = atrData?.meta ?? {
    reportId: initial?.reportId ?? 'ATR-LIVE-2026',
    auditTitle: initial?.auditTitle ?? 'Internal Audit — Action Taken Report',
    auditPeriod: initial?.auditPeriod ?? 'FY 2025-26',
    preparedBy: initial?.preparedBy ?? 'Karan Mehta',
    generatedOn: initial?.generatedOn ?? today,
    auditEntity: initial?.auditEntity ?? 'Acme Corp — Internal Audit',
  };
  const observations = atrData?.observations ?? SAMPLE_OBSERVATIONS;
  const insights = atrData?.insights ?? SAMPLE_INSIGHTS;
  const data: AtrReportData = { meta, observations, insights };

  const handleDownload = () => {
    logEvent({ action: 'Export', description: `Exported Action Taken Report (PDF) — ${meta.reportId}`, module: 'Exceptions', entity: 'ATR' });
    window.print();
  };
  const handleSave = () => {
    const finalLabel = label.trim() || `Snapshot · ${today}`;
    onSaveVersion?.(finalLabel, data);
    logEvent({ action: 'Create', description: `Saved ATR version "${finalLabel}" — ${meta.reportId}`, module: 'Exceptions', entity: 'ATR' });
    setShowSavePrompt(false);
    setLabel('');
  };

  return (
    <>
      <style>{PRINT_CSS}</style>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="atr-no-print fixed inset-0 bg-ink-900/50 backdrop-blur-[2px] z-50"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 8 }}
        transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
        className="atr-print-root fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[960px] max-w-[94vw] h-[90vh] bg-canvas-elevated rounded-xl shadow-xl border border-canvas-border z-[60] flex flex-col"
        role="dialog"
        aria-label="Action Taken Report"
      >
        {/* Title bar — the document banner carries the report title, so this
            bar stays a thin context strip. */}
        <header className="atr-no-print shrink-0 px-6 py-2.5 flex items-center justify-between gap-4 border-b border-canvas-border">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-md bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
              <FileText size={14} />
            </div>
            {/* Says where the document came from and that it is not saved yet.
                "Live preview · read-only" sat above a Save button, which read
                as a contradiction and told nobody whether an ATR now exists. */}
            <p className="text-[0.8125rem] font-medium text-ink-600 truncate">
              <span className="text-ink-800 font-semibold">Draft, not saved yet</span>
              {meta.auditTitle ? <span> · built from “{meta.auditTitle}”</span> : null}
              <span> · {observations.length} observation{observations.length === 1 ? '' : 's'}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </header>

        {/* Document body — the canonical ATR format (same as saved ATRs) */}
        <div className="atr-scroll flex-1 min-h-0 overflow-y-auto bg-[#F4F2F7]">
          <div className="max-w-[860px] mx-auto my-6 px-4">
            <AtrDocument meta={meta} observations={observations} insights={insights} maxWidthClass="max-w-none" />
          </div>
        </div>

        {/* Footer — two distinct CTAs, no Cancel */}
        <footer className="atr-no-print shrink-0 px-6 py-3.5 border-t border-canvas-border flex items-center justify-end gap-2.5">
          {onSaveVersion && (
            <div className="relative">
              {showSavePrompt && (
                <>
                  <div className="fixed inset-0 z-[65]" onClick={() => setShowSavePrompt(false)} />
                  <div className="absolute right-0 bottom-full mb-2 z-[70] w-72 bg-white border border-canvas-border shadow-xl rounded-lg p-3">
                    <label className="block text-[0.75rem] font-semibold text-ink-700 mb-1.5">Version label</label>
                    <input
                      autoFocus
                      value={label}
                      onChange={e => setLabel(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
                      placeholder="e.g. Final · Audit Committee"
                      className="w-full h-9 px-3 mb-2.5 bg-canvas-elevated border border-canvas-border rounded-md text-[0.8125rem] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/20"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => setShowSavePrompt(false)} className="h-8 px-3 text-[0.75rem] font-medium text-ink-600 hover:text-ink-900 cursor-pointer">Discard</button>
                      <button onClick={handleSave} className="h-8 px-3.5 text-[0.75rem] font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-md cursor-pointer">Save to ATR tab</button>
                    </div>
                  </div>
                </>
              )}
              <button
                onClick={() => setShowSavePrompt(s => !s)}
                className="h-10 px-5 inline-flex items-center gap-2 text-[0.8125rem] font-semibold text-ink-700 bg-canvas-elevated border border-canvas-border rounded-md hover:border-brand-200 cursor-pointer transition-colors"
              >
                <Save size={14} />
                Save to ATR reports
              </button>
            </div>
          )}
          {/* Download hands off to the browser print view, so the button says
              so rather than promising a file that never lands. */}
          <button
            onClick={handleDownload}
            className="h-10 px-5 inline-flex items-center gap-2 text-[0.8125rem] font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-md cursor-pointer transition-colors"
          >
            <Printer size={14} />
            Print / Save as PDF
          </button>
        </footer>
      </motion.div>
    </>
  );
}
