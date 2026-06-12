import { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Share2, Download, FileText, ShieldAlert } from 'lucide-react';
import AtrDocument from './AtrDocument';
import GenerateATRModal from '../exceptions/GenerateATRModal';
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

/** Saved-ATR report page. Renders the generated Action Taken Report (the same
 *  content shown in the preview); the document's own banner is the single header
 *  and carries the Manage Exceptions + Generate ATR CTAs. */
export default function AtrReportView({ report, onBack, onShare }: {
  report: AtrReport;
  onBack: () => void;
  onShare?: () => void;
}) {
  const { addToast } = useToast();
  const [atrModalOpen, setAtrModalOpen] = useState(false);
  const { meta, observations, insights } = report.atrData;

  const openManageExceptions = () => {
    const url = `${window.location.pathname}?view=manage-exceptions&from=Q01`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // CTAs live inside the document banner (white pills on the purple header).
  const headerActions = (
    <>
      <button
        onClick={openManageExceptions}
        title="Review & classify exceptions · opens in a new tab"
        className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[12px] font-semibold text-brand-700 bg-white rounded-[8px] hover:bg-white/90 transition-colors cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.18)]"
      >
        <ShieldAlert size={14} /> Manage Exceptions
      </button>
      <button
        onClick={() => setAtrModalOpen(true)}
        title="Generate Action Taken Report"
        className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[12px] font-semibold text-brand-700 bg-white rounded-[8px] hover:bg-white/90 transition-colors cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.18)]"
      >
        <FileText size={14} /> Generate ATR
      </button>
    </>
  );

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
      className="report-printable h-full overflow-y-auto bg-surface-2"
    >
      <div className="px-[124px] py-8">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-5 flex-wrap gap-2 print:hidden">
          <button onClick={onBack} className="flex items-center gap-1.5 text-[13px] text-text-secondary hover:text-primary transition-colors cursor-pointer">
            <ArrowLeft size={14} /> Back to Reports
          </button>
          <div className="flex items-center gap-2">
            {onShare && (
              <button onClick={onShare} className="flex items-center gap-1.5 px-3 py-2 border border-border text-[12px] font-medium text-text-secondary hover:bg-white hover:border-primary/30 transition-colors cursor-pointer bg-white rounded-[8px]">
                <Share2 size={14} /> Share
              </button>
            )}
            <button
              onClick={() => { addToast({ type: 'info', message: 'Opening print dialog — choose “Save as PDF”.' }); window.setTimeout(() => window.print(), 250); }}
              className="flex items-center gap-1.5 px-3 py-2 border border-border text-[12px] font-medium text-text-secondary hover:bg-white hover:border-primary/30 transition-colors cursor-pointer bg-white rounded-[8px]"
            >
              <Download size={14} /> Download
            </button>
          </div>
        </div>

        {/* The report document — its banner is the sole header. */}
        <div className="pb-10">
          <AtrDocument meta={meta} observations={observations} insights={insights} headerActions={headerActions} maxWidthClass="max-w-none" />
        </div>
      </div>

      {atrModalOpen && <GenerateATRModal onClose={() => setAtrModalOpen(false)} />}
    </motion.div>
  );
}
