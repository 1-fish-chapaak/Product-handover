import { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Share2, Download, List } from 'lucide-react';
import AtrDocument from './AtrDocument';
import type { AtrReportData } from './atrTypes';
import { useToast } from '../shared/Toast';

interface AtrReport {
  id: string;
  name: string;
  generatedBy?: string;
  generatedAt?: string;
  tag?: string;
  atrData: AtrReportData;
}

/** Saved-ATR report page. Renders the generated Action Taken Report inside the
 *  shared reader workspace: plain page-level actions (no header bar), a persistent
 *  scroll-spy outline rail, and a constrained document column. */
export default function AtrReportView({ report, onBack, onShare }: {
  report: AtrReport;
  onBack: () => void;
  onShare?: () => void;
}) {
  const { addToast } = useToast();
  const { meta, observations, insights } = report.atrData;

  // The ATR document's sections are fixed; the rail mirrors them in order.
  const outlineEntries = [
    { id: 'atr-exec', title: 'Executive Summary' },
    { id: 'atr-obs-summary', title: 'Observation Wise Summary' },
    { id: 'atr-obs-details', title: 'Observation Details' },
    ...(insights.length > 0 ? [{ id: 'atr-insights', title: 'Key Insights & Recommendations' }] : []),
    { id: 'atr-signoff', title: 'Approvals & Sign-Off' },
  ];

  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const els = Array.from(root.querySelectorAll<HTMLElement>('[id^="section-"]'));
    if (els.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const lead = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (lead) setActiveSectionId(lead.target.id.replace(/^section-/, ''));
      },
      { root, rootMargin: '-84px 0px -62% 0px', threshold: 0 },
    );
    els.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, [observations.length, insights.length]);

  const scrollToSection = (id: string) =>
    document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const download = () => {
    addToast({ type: 'info', message: 'Opening print dialog — choose “Save as PDF”.' });
    window.setTimeout(() => window.print(), 250);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
      className="report-printable h-full overflow-y-auto bg-canvas"
      ref={scrollRef}
    >
      {/* Report actions — pinned to the top of the scroll area (page-coloured,
          borderless — no header-bar chrome) so they stay reachable on scroll. */}
      <div className="sticky top-0 z-30 bg-canvas max-w-[1480px] mx-auto px-6 lg:px-10 h-16 flex items-center justify-between gap-4 print:hidden">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 h-9 px-3 text-[0.75rem] font-semibold text-ink-600 bg-canvas-elevated border border-canvas-border rounded-[8px] hover:bg-canvas hover:text-ink-900 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
        >
          <ArrowLeft size={14} /> Back to Reports
        </button>
        <div className="flex items-center gap-2">
          {onShare && (
            <button
              onClick={onShare}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[0.75rem] font-semibold text-ink-700 bg-canvas-elevated border border-canvas-border rounded-[8px] hover:bg-canvas hover:border-ink-300/70 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
            >
              <Share2 size={14} /> Share
            </button>
          )}
          <button
            onClick={download}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[0.75rem] font-semibold text-white bg-brand-600 rounded-[8px] hover:bg-brand-500 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40"
          >
            <Download size={14} /> Download
          </button>
        </div>
      </div>

      {/* Reader workspace — outline rail + constrained document column. */}
      <div className="max-w-[1480px] mx-auto px-6 lg:px-10 pt-3 pb-8 flex items-start gap-8 xl:gap-10">
        <aside className="hidden xl:block w-[252px] shrink-0 sticky top-[72px] self-start max-h-[calc(100vh-96px)] overflow-y-auto pr-1 -mr-1 print:hidden">
          <div className="rounded-[14px] border border-canvas-border bg-canvas-elevated p-3.5">
            <div className="flex items-center gap-2 mb-3 px-1">
              <List size={13} className="text-ink-400" />
              <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.13em] text-ink-400">On this page</span>
              <span className="ml-auto text-[0.6875rem] font-semibold tabular-nums text-ink-400">{outlineEntries.length}</span>
            </div>
            <ol className="list-none p-0 m-0 space-y-0.5">
              {outlineEntries.map((e, i) => {
                const isActive = activeSectionId === e.id;
                return (
                  <li key={e.id}>
                    <button
                      onClick={() => scrollToSection(e.id)}
                      aria-current={isActive ? 'true' : undefined}
                      className={`w-full flex items-center gap-1.5 py-2 pl-1 pr-1 rounded-[8px] text-left transition-colors cursor-pointer ${isActive ? 'bg-brand-50' : 'hover:bg-brand-50/30'}`}
                    >
                      <span className={`shrink-0 w-5 text-[0.6875rem] font-semibold font-mono tabular-nums text-right ${isActive ? 'text-brand-700' : 'text-brand-500'}`}>{String(i + 1).padStart(2, '0')}</span>
                      <span className={`flex-1 min-w-0 text-[0.8125rem] truncate ${isActive ? 'font-semibold text-brand-700' : 'font-medium text-ink-600'}`}>{e.title}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </aside>
        <div className="min-w-0 flex-1 max-w-[920px] pb-10">
          <AtrDocument
            meta={meta}
            observations={observations}
            insights={insights}
            maxWidthClass="max-w-none"
          />
        </div>
      </div>
    </motion.div>
  );
}
