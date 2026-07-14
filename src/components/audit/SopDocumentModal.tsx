import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, X, Download } from 'lucide-react';
import { DEFAULT_SOP_SECTIONS } from './SopDetailDrawer';
import { Button } from '../shared/Button';
import SopProcessFlow from './SopProcessFlow';
import SopRelationshipMap from './SopRelationshipMap';
import { SOP_FLOWS } from '../../data/mockData';

export interface SopDocumentModalProps {
  open: boolean;
  /** SOP id — keys the Process Flow / Relationship Map tab data. */
  sopId?: string;
  /** Modal header — the document's name. */
  sopName: string;
  /** Optional owning sub-process, shown in the meta line (e.g. RACM source view). */
  subProcess?: string;
  /** e.g. "v2.1". */
  version?: string;
  uploadedBy?: string;
  /** e.g. "Mar 10, 2026". */
  uploadedAgo?: string;
  /** Document outline section names. Falls back to DEFAULT_SOP_SECTIONS when empty. */
  sections?: string[];
  onDownload?: (kind?: string) => void;
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

// Per-view download label — the button text and the value passed to
// onDownload both follow the active tab (PDF · Process Flow · Relationship Map).
const DL_LABEL = { pdf: 'PDF', flow: 'Process Flow', map: 'Relationship Map' } as const;

export default function SopDocumentModal({
  open,
  sopId,
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

  // Tabbed preview: PDF (the document below) · Process Flow · Relationship Map.
  // Reopens on the document each time so the preview behaves predictably.
  const [tab, setTab] = useState<'pdf' | 'flow' | 'map'>('pdf');
  // Reset to the document view whenever the preview (re)opens — adjusted during
  // render per React guidance, not in an effect.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setTab('pdf');
  }

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
    subProcess,
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
              className="w-full max-w-[1000px] h-[900px] max-h-[85vh] flex flex-col rounded-xl bg-canvas-elevated shadow-xl border border-canvas-border overflow-hidden"
            >
              {/* Header */}
              <header className="shrink-0 px-6 pt-5 pb-3 flex items-start justify-between gap-3">
                <div className="min-w-0 flex items-center gap-3">
                  <div className="shrink-0 inline-flex p-1.5 rounded-lg bg-brand-50"><BookOpen size={14} className="text-brand-600" /></div>
                  <div className="min-w-0">
                    <h2 className="text-[1rem] font-bold text-ink-900 leading-snug truncate">{sopName}</h2>
                    {metaParts.length > 0 && (
                      <div className="text-[0.6875rem] text-text-muted mt-0.5">{metaParts.join(' · ')}</div>
                    )}
                  </div>
                </div>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  title="Close"
                  className="shrink-0 w-10 h-10 flex items-center justify-center rounded-lg text-ink-500 hover:text-ink-800 hover:bg-surface-2 transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </header>

              {/* Tabs — PDF (document) · Process Flow · Relationship Map */}
              <div className="shrink-0 px-6 border-b border-canvas-border">
                <nav className="flex items-center gap-5" role="tablist" aria-label="SOP views">
                  {([['pdf', 'PDF'], ['flow', 'Process Flow'], ['map', 'Relationship Map']] as const).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={tab === key}
                      onClick={() => setTab(key)}
                      className={`relative -mb-px h-10 text-[0.8125rem] font-semibold border-b-2 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                        tab === key ? 'border-brand-600 text-brand-700' : 'border-transparent text-ink-500 hover:text-ink-800'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </nav>
              </div>

              {/* Body — each tab is its own scroll container (it unmounts on
                  switch), so scroll position is per-tab, not shared. */}
              <div className="flex-1 min-h-0 flex flex-col">
                {/* Per-view download — label + action follow the active tab */}
                <div className="shrink-0 flex justify-end px-6 py-2">
                  <Button variant="outline" size="sm" onClick={() => onDownload?.(DL_LABEL[tab])} leftIcon={<Download size={12} />}>
                    Download {DL_LABEL[tab]}
                  </Button>
                </div>
                {tab === 'pdf' && (
                <div className="flex-1 overflow-y-auto bg-canvas/40 px-6">
                <article className="mx-auto my-6 max-w-[680px] bg-white border border-border-light rounded-xl shadow-sm px-10 py-9">
                  <h1 className="text-[1.375rem] font-bold text-ink-900 border-b border-border-light pb-3 mb-1">{sopName}</h1>
                  {subtitleParts.length > 0 && (
                    <p className="text-[0.71875rem] text-ink-400">{subtitleParts.join(' · ')}</p>
                  )}

                  {outline.map((section, i) => (
                    <section key={`${section}-${i}`}>
                      <h2 className="text-[0.875rem] font-bold text-ink-900 mt-6 mb-2">{i + 1}. {section}</h2>
                      <p className="text-[0.84375rem] leading-relaxed text-ink-700">{paraForSection(i)}</p>
                      {i % 3 === 1 && (
                        <p className="text-[0.84375rem] leading-relaxed text-ink-700 mt-2">{paraForSection(i + 2)}</p>
                      )}
                      {(i === 2 || i === 3) && (
                        <ul className="list-disc pl-5 text-[0.8125rem] text-ink-600 space-y-1 mt-2">
                          {STEP_BULLETS.map((b) => <li key={b}>{b}</li>)}
                        </ul>
                      )}
                    </section>
                  ))}
                </article>
                </div>
                )}
                {tab === 'flow' && (
                  <div className="flex-1 overflow-y-auto px-6 bg-paper-50">
                    <SopProcessFlow nodes={sopId ? (SOP_FLOWS[sopId] ?? []) : []} />
                  </div>
                )}
                {tab === 'map' && (
                  <div className="flex-1 overflow-y-auto px-6">
                    <SopRelationshipMap sopId={sopId} sopName={sopName} />
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
