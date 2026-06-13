import { motion } from 'motion/react';
import { X, ChevronRight } from 'lucide-react';
import {
  type GrcException,
  type GrcExceptionStatus,
  type GrcExceptionClassification,
} from '../../data/mockData';

const STATUS_STYLE: Record<GrcExceptionStatus, string> = {
  Open:           'bg-[#EEEEF1] text-ink-600',
  'Under Review': 'bg-mitigated-50 text-mitigated-700',
  Closed:         'bg-compliant-50 text-compliant-700',
};
const STATUS_LABEL: Record<GrcExceptionStatus, string> = {
  Open:           'Open',
  'Under Review': 'In-Progress',
  Closed:         'Closed',
};

const CLASSIFICATION_STYLE: Record<GrcExceptionClassification, string> = {
  Unclassified:                'bg-[#F4F2F7] text-ink-600',
  'Design Deficiency':         'bg-high-50 text-high-700',
  'System Deficiency':         'bg-risk-50 text-risk-700',
  'Procedural Non-Compliance': 'bg-brand-50 text-brand-700',
  'Business as Usual':         'bg-compliant-50 text-compliant-700',
  'False Positive':            'bg-[#EEEEF1] text-ink-600',
};

function Pill({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={`inline-flex items-center h-6 px-2.5 text-[11px] font-medium rounded-full whitespace-nowrap ${className}`}>
      {children}
    </span>
  );
}

function ExceptionCard({ ex, onClick }: { ex: GrcException; onClick?: () => void }) {
  const isBulk = Boolean(ex.bulkId);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="group w-full text-left border border-canvas-border rounded-[12px] p-4 transition-colors enabled:hover:border-brand-300 enabled:hover:bg-brand-50/20 enabled:cursor-pointer disabled:cursor-default"
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-[12.5px] font-semibold text-brand-700 whitespace-nowrap">{ex.id}</span>
          {isBulk && (
            <span className="inline-flex items-center h-5 px-2 text-[10.5px] font-medium bg-brand-50 text-brand-700 rounded-full">
              Bulk
            </span>
          )}
        </div>
        <Pill className={STATUS_STYLE[ex.status]}>{STATUS_LABEL[ex.status]}</Pill>
      </div>
      <h4 className="text-[14px] font-semibold text-ink-900 leading-snug mb-2.5">{ex.title}</h4>
      <div className="flex items-center justify-between gap-3">
        <Pill className={CLASSIFICATION_STYLE[ex.classification]}>{ex.classification}</Pill>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[12px] text-ink-700">{ex.assignedTo?.name ?? 'Unassigned'}</span>
          {onClick && (
            <span className="inline-flex items-center gap-0.5 text-[11.5px] font-medium text-brand-600 opacity-0 group-hover:opacity-100 transition-opacity">
              Details <ChevronRight size={13} />
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

export default function ExceptionListDrawer({
  title,
  subtitle,
  exceptions,
  onClose,
  onSelectException,
}: {
  title: string;
  subtitle: string;
  exceptions: GrcException[];
  onClose: () => void;
  onSelectException?: (ex: GrcException) => void;
}) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] z-40"
        onClick={onClose}
      />
      <motion.aside
        initial={{ x: 24, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 24, opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
        className="fixed top-0 right-0 bottom-0 w-full max-w-[560px] bg-canvas-elevated shadow-xl border-l border-canvas-border flex flex-col z-50"
        role="dialog"
        aria-label={title}
      >
        <header className="shrink-0 px-6 pt-5 pb-4 flex items-start justify-between gap-4 border-b border-canvas-border">
          <div>
            <h2 className="font-display text-[20px] font-semibold text-ink-900 tracking-tight">{title}</h2>
            <p className="text-[12.5px] text-ink-500 mt-0.5">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
          {exceptions.length === 0 ? (
            <div className="text-[13px] text-ink-500 text-center py-12">No exceptions match this filter.</div>
          ) : (
            exceptions.map(ex => <ExceptionCard key={ex.id} ex={ex} onClick={onSelectException ? () => onSelectException(ex) : undefined} />)
          )}
        </div>
        <footer className="shrink-0 px-6 py-3 border-t border-canvas-border text-right text-[11.5px] text-ink-500 tabular-nums">
          {exceptions.length} {exceptions.length === 1 ? 'exception' : 'exceptions'} shown
        </footer>
      </motion.aside>
    </>
  );
}
