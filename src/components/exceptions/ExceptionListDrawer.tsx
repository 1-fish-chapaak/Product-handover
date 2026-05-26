import { motion } from 'motion/react';
import { X } from 'lucide-react';
import {
  type GrcException,
  type GrcExceptionSeverity,
  type GrcExceptionStatus,
  type GrcExceptionClassification,
} from '../../data/mockData';

const SEVERITY_STYLE: Record<GrcExceptionSeverity, string> = {
  High:   'bg-high-50 text-high-700',
  Medium: 'bg-mitigated-50 text-mitigated-700',
  Low:    'bg-compliant-50 text-compliant-700',
};

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
    <span className={`inline-flex items-center h-6 px-2.5 text-[0.6875rem] font-medium rounded-full whitespace-nowrap ${className}`}>
      {children}
    </span>
  );
}

function ExceptionCard({ ex }: { ex: GrcException }) {
  const isBulk = Boolean(ex.bulkId);
  return (
    <article className="border border-canvas-border rounded-[12px] p-4 hover:border-brand-200 transition-colors cursor-pointer">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-[0.75rem] font-semibold text-brand-700 whitespace-nowrap">{ex.id}</span>
          {isBulk && (
            <span className="inline-flex items-center h-5 px-2 text-[0.75rem] font-medium bg-brand-50 text-brand-700 rounded-full">
              Bulk
            </span>
          )}
        </div>
        <Pill className={SEVERITY_STYLE[ex.severity]}>{ex.severity}</Pill>
      </div>
      <h4 className="text-[0.875rem] font-semibold text-ink-900 leading-snug mb-2.5">{ex.title}</h4>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Pill className={STATUS_STYLE[ex.status]}>{STATUS_LABEL[ex.status]}</Pill>
          <Pill className={CLASSIFICATION_STYLE[ex.classification]}>{ex.classification}</Pill>
        </div>
        <span className="text-[0.75rem] text-ink-700 shrink-0">{ex.assignedTo?.name ?? '—'}</span>
      </div>
    </article>
  );
}

export default function ExceptionListDrawer({
  title,
  subtitle,
  exceptions,
  onClose,
}: {
  title: string;
  subtitle: string;
  exceptions: GrcException[];
  onClose: () => void;
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
            <h2 className="font-display text-[1.25rem] font-semibold text-ink-900 tracking-tight">{title}</h2>
            <p className="text-[0.75rem] text-ink-500 mt-0.5">{subtitle}</p>
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
            <div className="text-[0.8125rem] text-ink-500 text-center py-12">No exceptions match this filter.</div>
          ) : (
            exceptions.map(ex => <ExceptionCard key={ex.id} ex={ex} />)
          )}
        </div>
        <footer className="shrink-0 px-6 py-3 border-t border-canvas-border text-right text-[0.75rem] text-ink-500 tabular-nums">
          {exceptions.length} {exceptions.length === 1 ? 'exception' : 'exceptions'} shown
        </footer>
      </motion.aside>
    </>
  );
}
