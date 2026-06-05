import { motion } from 'motion/react';
import { BookOpen, X, Sparkles, Download } from 'lucide-react';

// Default document outline used when a SOP doesn't carry its own section list.
export const DEFAULT_SOP_SECTIONS = [
  'Purpose & scope',
  'Roles & responsibilities',
  'Process steps & approvals',
  'Key controls & checkpoints',
  'Exceptions & escalation',
  'Records & retention',
];

export interface SopDetailDrawerProps {
  /** Eyebrow label rendered after "SOP · " — usually the sub-process / business process. */
  subProcess: string;
  /** Drawer title — the SOP document / file name. */
  title: string;
  version?: string;
  /** e.g. "5d ago" or a date — rendered as "uploaded {uploadedAgo}". */
  uploadedAgo?: string;
  /** "Extracted from this SOP" summary — omit when the SOP isn't mapped into a RACM yet. */
  summary?: { controls: number; risks: number; attributes: number; racmName: string };
  /** Document outline section names. Falls back to DEFAULT_SOP_SECTIONS when empty. */
  sections?: string[];
  /** Extracted control rows. */
  controls: { id: string; description: string }[];
  onDownload: () => void;
  onClose: () => void;
}

// Shared SOP preview drawer — used by the Process Hub SOP tab and the RACM list
// (for RACMs extracted from a SOP). Matches the engagement RACM-tab design.
export default function SopDetailDrawer({
  subProcess, title, version, uploadedAgo, summary, sections, controls, onDownload, onClose,
}: SopDetailDrawerProps) {
  const outline = sections && sections.length > 0 ? sections : DEFAULT_SOP_SECTIONS;
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
        className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] z-40" onClick={onClose} />
      <motion.aside
        initial={{ x: 24, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 24, opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
        className="fixed top-0 right-0 bottom-0 w-full max-w-[560px] bg-canvas-elevated shadow-xl border-l border-canvas-border flex flex-col z-50"
        role="dialog" aria-label="SOP preview"
      >
        <header className="shrink-0 px-6 pt-5 pb-4 border-b border-canvas-border flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="p-1.5 rounded-lg bg-brand-50"><BookOpen size={14} className="text-brand-600" /></div>
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted">SOP · {subProcess}</span>
            </div>
            <h2 className="font-display text-[17px] font-semibold text-ink-900 leading-snug truncate">{title}</h2>
            {(version || uploadedAgo) && (
              <div className="text-[11px] text-text-muted mt-0.5">
                {version}{version && uploadedAgo ? ' · ' : ''}{uploadedAgo ? `uploaded ${uploadedAgo}` : ''}
              </div>
            )}
          </div>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full text-ink-500 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer shrink-0"><X size={16} /></button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Extracted summary */}
          {summary && (
            <div className="rounded-xl border border-brand-100/70 bg-brand-50/30 p-4">
              <div className="flex items-center gap-1.5 mb-2"><Sparkles size={12} className="text-brand-600" /><span className="text-[10.5px] uppercase tracking-wider font-bold text-brand-700">Extracted from this SOP</span></div>
              <p className="text-[12.5px] text-text leading-relaxed">
                <span className="font-semibold tabular-nums">{summary.controls}</span> controls · <span className="font-semibold tabular-nums">{summary.risks}</span> risks · <span className="font-semibold tabular-nums">{summary.attributes}</span> attributes were mapped into the <span className="font-semibold">{summary.racmName}</span>.
              </p>
            </div>
          )}

          {/* Section outline */}
          <section>
            <h3 className="text-[12px] font-bold uppercase tracking-wider text-text-muted mb-2">Document outline</h3>
            <ol className="space-y-1.5">
              {outline.map((sec, i) => (
                <li key={sec} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border-light bg-white">
                  <span className="w-5 h-5 rounded-md bg-surface-2 text-text-secondary text-[11px] font-bold inline-flex items-center justify-center tabular-nums shrink-0">{i + 1}</span>
                  <span className="text-[12.5px] text-text">{sec}</span>
                </li>
              ))}
            </ol>
          </section>

          {/* Extracted controls */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[12px] font-bold uppercase tracking-wider text-text-muted">Extracted controls</h3>
              <span className="text-[11px] text-text-muted">{controls.length} rows</span>
            </div>
            {controls.length === 0 ? (
              <p className="text-[12px] text-ink-400 italic">No controls extracted from this SOP yet.</p>
            ) : (
              <div className="space-y-1.5">
                {controls.map(c => (
                  <div key={c.id} className="flex items-start gap-3 px-3 py-2 rounded-lg border border-border-light bg-white">
                    <span className="text-[10.5px] font-mono font-semibold text-brand-600 bg-brand-50 border border-brand-100/70 rounded px-1.5 py-0.5 shrink-0 mt-0.5">{c.id}</span>
                    <p className="text-[12px] text-text leading-snug">{c.description}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <footer className="shrink-0 px-6 py-3 border-t border-canvas-border bg-canvas flex items-center justify-between gap-2">
          <button onClick={onDownload} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-canvas-border text-[12.5px] font-medium text-ink-600 hover:bg-canvas transition-colors cursor-pointer">
            <Download size={12} /> Download SOP
          </button>
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-[12.5px] font-semibold transition-colors cursor-pointer">Close</button>
        </footer>
      </motion.aside>
    </>
  );
}
