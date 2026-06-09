import { useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { X, Calendar, ArrowRight } from 'lucide-react';
import type {
  GrcException,
  GrcExceptionSeverity,
  GrcExceptionStatus,
  GrcExceptionClassification,
} from '../../data/mockData';

// ─── Chip styling tokens — mirrors the table chips so the drawer reads
//     consistently with the row it was opened from. ─────────────────────
const SEVERITY_STYLE: Record<GrcExceptionSeverity, string> = {
  High:   'bg-high-50 text-high-700',
  Medium: 'bg-mitigated-50 text-mitigated-700',
  Low:    'bg-compliant-50 text-compliant-700',
};
const STATUS_STYLE: Record<GrcExceptionStatus, string> = {
  Open:           'bg-evidence-50 text-evidence-700',
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
const REVIEW_STYLE: Record<string, string> = {
  Pending:  'bg-mitigated-50 text-mitigated-700',
  Approved: 'bg-compliant-50 text-compliant-700',
  Rejected: 'bg-risk-50 text-risk-700',
};

const fmtDate = (iso?: string) => {
  if (!iso) return 'Not set';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

interface Props {
  exception: GrcException;
  /** Source query's output table — when present, its non-first columns
   *  flesh out the ALL DATA FIELDS section using the row joined on ex.id. */
  extraColumns?: { columns: string[]; rows: string[][] };
  onClose: () => void;
}

export default function ExceptionDetailDrawer({ exception: ex, extraColumns, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  // Lookup the joined row. Prefer Case-ID match; fall back to a deterministic
  // index derived from the exception's numeric ID so mock data without a real
  // ID link still renders.
  const dataRow = useMemo(() => {
    if (!extraColumns || extraColumns.rows.length === 0) return undefined;
    const exact = extraColumns.rows.find(r => r[0] === ex.id);
    if (exact) return exact;
    const n = parseInt(ex.id.replace(/\D/g, ''), 10);
    const idx = Number.isFinite(n) ? n % extraColumns.rows.length : 0;
    return extraColumns.rows[idx];
  }, [extraColumns, ex.id]);

  // The field rows shown under ALL DATA FIELDS — skip the join-key column.
  const dataFields = useMemo(() => {
    if (!extraColumns) return [];
    return extraColumns.columns.slice(1).map((name, i) => ({
      name,
      value: dataRow?.[i + 1] ?? '',
    }));
  }, [extraColumns, dataRow]);

  const reviewStatus = ex.actionReview ?? 'Pending';

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] z-50"
        onClick={onClose}
      />
      <motion.aside
        initial={{ x: 24, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 24, opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
        className="fixed top-0 right-0 bottom-0 w-full max-w-[580px] bg-canvas-elevated shadow-xl border-l border-canvas-border z-[60] flex flex-col"
        role="dialog"
        aria-label={`Exception ${ex.id}`}
      >
        {/* Header */}
        <header className="shrink-0 px-7 pt-7 pb-5 flex items-start justify-between gap-4 border-b border-canvas-border">
          <div className="min-w-0">
            <h2 className="font-display text-[28px] leading-[1.15] font-semibold text-ink-900 tracking-tight">
              {ex.id}
            </h2>
            <p className="text-[13px] text-ink-500 mt-1 leading-snug">
              Case <span className="font-mono">{ex.id.toLowerCase()}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-md text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-7 py-6 space-y-7">
          {/* Status / Severity / Classification / Action Review — 2-col grid */}
          <section className="grid grid-cols-2 gap-x-8 gap-y-5">
            <DetailField label="Status">
              <Pill className={STATUS_STYLE[ex.status]}>{STATUS_LABEL[ex.status]}</Pill>
            </DetailField>
            <DetailField label="Severity">
              <Pill className={SEVERITY_STYLE[ex.severity]}>{ex.severity}</Pill>
            </DetailField>
            <DetailField label="Classification">
              <Pill className={CLASSIFICATION_STYLE[ex.classification]}>{ex.classification}</Pill>
            </DetailField>
            <DetailField label="Action Review">
              <Pill className={REVIEW_STYLE[reviewStatus] ?? 'bg-[#F4F2F7] text-ink-600'}>
                {reviewStatus}
              </Pill>
            </DetailField>
          </section>

          {/* Action-plan due date — with the revised-date request when present */}
          {(ex.dueDate || ex.dueDateRevision) && (
            <section>
              <h3 className="text-[11px] font-semibold text-ink-500 uppercase tracking-[0.14em] mb-3">Action Plan Due Date</h3>
              {ex.dueDateRevision ? (
                <div className="border border-canvas-border rounded-[10px] p-4">
                  <div className="flex items-stretch gap-2.5">
                    <div className="flex-1 rounded-[8px] border border-canvas-border bg-[#FAFAFB] p-3">
                      <div className="text-[10.5px] font-semibold uppercase tracking-wider text-ink-500 mb-1">Previous</div>
                      <div className={`text-[13.5px] font-semibold ${ex.dueDateRevision.status === 'Approved' ? 'text-ink-500 line-through decoration-ink-300' : 'text-ink-800'}`}>
                        {fmtDate(ex.dueDateRevision.previousDueDate)}
                      </div>
                    </div>
                    <div className="flex items-center shrink-0"><ArrowRight size={15} className="text-ink-400" /></div>
                    <div className="flex-1 rounded-[8px] border border-brand-200 bg-brand-50/60 p-3">
                      <div className="text-[10.5px] font-semibold uppercase tracking-wider text-brand-700 mb-1">Revised</div>
                      <div className="text-[13.5px] font-bold text-brand-700">{fmtDate(ex.dueDateRevision.revisedDueDate)}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-[11.5px] text-ink-500">Requested by {ex.dueDateRevision.requestedBy}</span>
                    <Pill className={REVIEW_STYLE[ex.dueDateRevision.status] ?? 'bg-[#F4F2F7] text-ink-600'}>
                      {ex.dueDateRevision.status === 'Pending' ? 'Awaiting approval' : ex.dueDateRevision.status}
                    </Pill>
                  </div>
                  {ex.dueDateRevision.reason && (
                    <p className="text-[12.5px] text-ink-700 leading-relaxed mt-3 pt-3 border-t border-canvas-border">{ex.dueDateRevision.reason}</p>
                  )}
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 h-9 px-3 rounded-[8px] border border-canvas-border bg-[#FAFAFB] text-[13px] font-semibold text-ink-800">
                  <Calendar size={14} className="text-ink-500" />
                  {fmtDate(ex.dueDate)}
                </div>
              )}
            </section>
          )}

          {/* All data fields — joined row from the source query's output table */}
          <section>
            <h3 className="text-[11px] font-semibold text-ink-500 uppercase tracking-[0.14em] mb-3">All Data Fields</h3>
            {dataFields.length === 0 ? (
              <div className="border border-canvas-border rounded-[10px] px-4 py-6 text-center text-[12.5px] text-ink-500">
                No data fields available for this exception.
              </div>
            ) : (
              <div className="border border-canvas-border rounded-[10px] overflow-hidden bg-[#FAFAFB]">
                <table className="w-full text-[12.5px]">
                  <tbody>
                    {dataFields.map((f, i) => (
                      <tr key={f.name} className={i < dataFields.length - 1 ? 'border-b border-canvas-border/70' : ''}>
                        <td className="px-4 py-3 align-top w-[42%] text-ink-500">{f.name}</td>
                        <td className="px-4 py-3 align-top text-ink-800">
                          {f.value || <span className="text-ink-400">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Audit */}
          <section>
            <h3 className="text-[11px] font-semibold text-ink-500 uppercase tracking-[0.14em] mb-3">Audit</h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <DetailField label="Created">
                <span className="text-[13px] text-ink-800">{ex.lastUpdated}</span>
              </DetailField>
              <DetailField label="Updated">
                <span className="text-[13px] text-ink-800">{ex.lastUpdated}</span>
              </DetailField>
            </div>
            <div className="mt-3 text-[12.5px] text-ink-500">
              Reference ID: <span className="font-mono text-ink-700">{ex.id.toLowerCase()}</span>
            </div>
          </section>
        </div>

        {/* Footer */}
        <footer className="shrink-0 px-7 py-4 border-t border-canvas-border flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-5 text-[13px] font-medium text-ink-700 bg-canvas-elevated border border-canvas-border rounded-[8px] hover:bg-[#F4F2F7] cursor-pointer transition-colors"
          >
            Close
          </button>
        </footer>
      </motion.aside>
    </>
  );
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-ink-500 uppercase tracking-[0.14em] mb-2">{label}</div>
      {children}
    </div>
  );
}

function Pill({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center h-7 px-3 rounded-full text-[12px] font-medium ${className}`}>
      {children}
    </span>
  );
}
