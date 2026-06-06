import { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, X, Download } from 'lucide-react';
import { DEFAULT_SOP_SECTIONS } from './SopDetailDrawer';

export interface SopDocumentModalProps {
  open: boolean;
  /** Modal header — the document's name. */
  sopName: string;
  /** e.g. "Procure to Pay". */
  subProcess?: string;
  /** e.g. "v2.1". */
  version?: string;
  uploadedBy?: string;
  /** e.g. "Mar 10, 2026". */
  uploadedAgo?: string;
  /** Document outline section names. Falls back to DEFAULT_SOP_SECTIONS when empty. */
  sections?: string[];
  onDownload?: () => void;
  onClose: () => void;
}

// Generic, company-agnostic placeholder copy so the rendered page reads like a
// real internal-audit SOP body without inventing names, figures, or systems.
const LEAD_PARAS = [
  'This section establishes the requirements that process owners and control performers are expected to follow. It is maintained by the process owner and reviewed on a periodic basis to keep it aligned with current policy.',
  'Activities are performed in line with the organisation’s policies, the delegation of authority, and applicable regulatory expectations. Where judgement is required, the responsible owner documents the rationale and retains supporting evidence.',
  'Each step below should be completed in sequence. Hand-offs between teams are confirmed before work proceeds, and any deviation is logged so that it can be reviewed during subsequent monitoring.',
  'Roles, responsibilities, and approval thresholds are defined to provide clear accountability. Segregation of duties is maintained so that no single individual can initiate and approve the same transaction.',
];

const STEP_BULLETS = [
  'Confirm the relevant inputs are complete, authorised, and supported by source documentation.',
  'Perform the review or approval in line with the defined threshold, and record the outcome.',
  'Retain the resulting evidence in the system of record for the required retention period.',
];

function paraForSection(i: number): string {
  return LEAD_PARAS[i % LEAD_PARAS.length];
}

export default function SopDocumentModal({
  open,
  sopName,
  subProcess,
  version,
  uploadedBy,
  uploadedAgo,
  sections,
  onDownload,
  onClose,
}: SopDocumentModalProps) {
  const outline = sections && sections.length > 0 ? sections : DEFAULT_SOP_SECTIONS;

  // Escape-to-close while open (mirrors the centered-modal conventions).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Meta line: only the present parts, joined with " · ".
  const metaParts = [
    version,
    uploadedAgo ? `uploaded ${uploadedAgo}` : undefined,
    uploadedBy,
  ].filter(Boolean) as string[];

  // Page subtitle: omit missing parts.
  const subtitleParts = [
    version ? `Version ${version}` : undefined,
    uploadedAgo ? `Last updated ${uploadedAgo}` : undefined,
  ].filter(Boolean) as string[];

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] z-40"
            onClick={onClose}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
              role="dialog"
              aria-modal="true"
              aria-label={sopName}
              className="w-full max-w-[800px] max-h-[86vh] flex flex-col rounded-2xl bg-canvas-elevated shadow-xl border border-canvas-border overflow-hidden"
            >
              {/* Header */}
              <header className="shrink-0 px-6 pt-5 pb-4 border-b border-canvas-border flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="p-1.5 rounded-lg bg-brand-50"><BookOpen size={14} className="text-brand-600" /></div>
                    <span className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted">SOP · {subProcess}</span>
                  </div>
                  <h2 className="font-display text-[17px] font-semibold text-ink-900 leading-snug truncate">{sopName}</h2>
                  {metaParts.length > 0 && (
                    <div className="text-[11px] text-text-muted mt-0.5">{metaParts.join(' · ')}</div>
                  )}
                </div>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  title="Close"
                  className="w-8 h-8 rounded-full text-ink-500 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer shrink-0"
                >
                  <X size={16} />
                </button>
              </header>

              {/* Body — in-app document "page" */}
              <div className="flex-1 overflow-y-auto bg-canvas/40 px-6">
                <article className="mx-auto my-6 max-w-[680px] bg-white border border-border-light rounded-xl shadow-sm px-10 py-9">
                  <h1 className="font-display text-[22px] font-bold text-ink-900 border-b border-border-light pb-3 mb-1">{sopName}</h1>
                  {subtitleParts.length > 0 && (
                    <p className="text-[11.5px] text-ink-400">{subtitleParts.join(' · ')}</p>
                  )}

                  {outline.map((section, i) => (
                    <section key={`${section}-${i}`}>
                      <h2 className="text-[14px] font-bold text-ink-900 mt-6 mb-2">{i + 1}. {section}</h2>
                      <p className="text-[13.5px] leading-relaxed text-ink-700">{paraForSection(i)}</p>
                      {i % 3 === 1 && (
                        <p className="text-[13.5px] leading-relaxed text-ink-700 mt-2">{paraForSection(i + 2)}</p>
                      )}
                      {(i === 2 || i === 3) && (
                        <ul className="list-disc pl-5 text-[13px] text-ink-600 space-y-1 mt-2">
                          {STEP_BULLETS.map((b) => <li key={b}>{b}</li>)}
                        </ul>
                      )}
                    </section>
                  ))}
                </article>
              </div>

              {/* Footer */}
              <footer className="shrink-0 px-6 py-3 border-t border-canvas-border bg-canvas flex items-center justify-between gap-2">
                <button
                  onClick={() => onDownload?.()}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-canvas-border text-[12.5px] font-medium text-ink-600 hover:bg-canvas transition-colors cursor-pointer"
                >
                  <Download size={12} /> Download SOP
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-[12.5px] font-semibold transition-colors cursor-pointer"
                >
                  Close
                </button>
              </footer>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
