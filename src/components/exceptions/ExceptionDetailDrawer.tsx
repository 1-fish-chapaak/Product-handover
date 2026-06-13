import { useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { X, Calendar, ArrowRight, FileText, Paperclip, CheckCircle2, User, Tag, RotateCcw, ClipboardCheck, CornerUpLeft } from 'lucide-react';
import { GRC_CASE_DETAILS } from '../../data/mockData';
import type {
  GrcException,
  GrcExceptionClassification,
} from '../../data/mockData';
import { exceptionActionsFor, type ExceptionActionKind } from './statusModel';

// Icon per action kind — mirrors the Exceptions-table CTA icons.
const ACTION_ICON: Record<ExceptionActionKind, React.ElementType> = {
  classify:             Tag,
  reclassify:           RotateCcw,
  markComplete:         CheckCircle2,
  reviewClassification: Tag,
  reviewPlan:           ClipboardCheck,
  reviewAction:         CornerUpLeft,
  review:               CornerUpLeft,
};

// ─── Chip styling tokens — mirrors the table chips so the drawer reads
//     consistently with the row it was opened from. ─────────────────────
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
  /** Active persona — drives which next actions are offered (mirrors Exceptions). */
  role?: 'risk-owner' | 'auditor';
  /** Fire the same action the Exceptions tab would — opens the shared drawer
   *  (which persists the change + logs activity). When omitted, the drawer is
   *  read-only. */
  onAction?: (kind: ExceptionActionKind, ex: GrcException) => void;
  onClose: () => void;
}

export default function ExceptionDetailDrawer({ exception: ex, extraColumns, role, onAction, onClose }: Props) {
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
  const detail = GRC_CASE_DETAILS[ex.id];
  const plans = detail?.actionPlans && detail.actionPlans.length > 0
    ? detail.actionPlans
    : (detail?.actionTitle ? [{ name: detail.actionTitle, details: detail.actionDescription, dueDate: '' }] : []);
  const completion = detail?.completion;
  const activity = detail?.activityLog ?? [];

  // Next actions for the active persona — same set the Exceptions table offers.
  const actions = role && onAction ? exceptionActionsFor(ex, role) : [];

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
          {/* Classification / Action Review — 2-col grid */}
          <section className="grid grid-cols-2 gap-x-8 gap-y-5">
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

          {/* Management Action Plan(s) */}
          {plans.length > 0 && (
            <section>
              <h3 className="text-[11px] font-semibold text-ink-500 uppercase tracking-[0.14em] mb-3">
                {plans.length > 1 ? `Management Action Plans · ${plans.length}` : 'Management Action Plan'}
              </h3>
              <div className="border border-canvas-border rounded-[10px] divide-y divide-canvas-border overflow-hidden">
                {plans.map((p, i) => (
                  <div key={i} className="p-4">
                    <div className="flex items-center gap-1.5 text-[13.5px] font-semibold text-ink-900 leading-snug mb-1">
                      <FileText size={13} className="text-ink-500 shrink-0" />
                      {p.name || `Management Action Plan ${i + 1}`}
                    </div>
                    {p.dueDate && (
                      <span className="inline-flex items-center gap-1.5 text-[11.5px] text-brand-700 bg-brand-50 rounded-full px-2.5 h-6 mb-2">
                        <Calendar size={11} /> Due {fmtDate(p.dueDate)}
                      </span>
                    )}
                    {p.details && <p className="text-[12.5px] text-ink-700 leading-relaxed mt-1">{p.details}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Action completed by the Risk Owner — note + evidence */}
          {completion && (
            <section>
              <h3 className="text-[11px] font-semibold text-ink-500 uppercase tracking-[0.14em] mb-3">Action Taken</h3>
              <div className="border border-compliant/40 bg-compliant-50/40 rounded-[10px] p-4">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 text-[12px] font-semibold text-compliant-700">
                    <CheckCircle2 size={13} /> Completed by the Risk Owner
                  </div>
                  {completion.selfAssessment && (
                    <span className={`inline-flex items-center h-6 px-2.5 rounded-full text-[11px] font-semibold ${completion.selfAssessment === 'Implemented' ? 'bg-compliant-50 text-compliant-700' : 'bg-mitigated-50 text-mitigated-700'}`}>
                      Reported: {completion.selfAssessment}
                    </span>
                  )}
                </div>
                <p className="text-[12.5px] text-ink-700 leading-relaxed">{completion.note}</p>
                {completion.evidence.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {completion.evidence.map((ev, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 h-7 px-2.5 bg-white border border-canvas-border rounded-full text-[11.5px] text-ink-700">
                        <Paperclip size={11} className="text-brand-600" /> {ev.name}
                      </span>
                    ))}
                  </div>
                )}
                {completion.completedAt && <p className="text-[11px] text-ink-400 mt-2">Marked complete on {completion.completedAt}</p>}
              </div>
            </section>
          )}

          {/* Activity journey — everything that happened to this case */}
          {activity.length > 0 && (
            <section>
              <h3 className="text-[11px] font-semibold text-ink-500 uppercase tracking-[0.14em] mb-3">Activity Journey</h3>
              <ol className="space-y-3.5">
                {activity.map((entry) => (
                  <li key={entry.id} className="flex gap-3">
                    <div className="shrink-0 w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center"><User size={13} /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-[12.5px] text-ink-800"><span className="font-semibold">{entry.author}</span> <span className="text-ink-500">[{entry.role}]</span></div>
                        <span className="text-[11px] text-ink-500 tabular-nums whitespace-nowrap">{entry.timestamp}</span>
                      </div>
                      <p className="text-[12.5px] text-ink-700 leading-snug mt-0.5">{entry.message}</p>
                      {entry.comment && (
                        <div className="mt-2 px-3 py-2 bg-[#FAFAFB] border border-canvas-border rounded-[8px] text-[12px] text-ink-700 leading-relaxed">{entry.comment}</div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
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

        {/* Footer — persona-aware actions (same as the Exceptions tab) + Close */}
        <footer className="shrink-0 px-7 py-4 border-t border-canvas-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {actions.length > 0 ? (
              actions.map(a => {
                const Icon = ACTION_ICON[a.kind];
                return (
                  <button
                    key={a.kind}
                    type="button"
                    onClick={() => onAction?.(a.kind, ex)}
                    title={`${a.label} · ${role === 'risk-owner' ? 'Risk Owner' : 'Auditor'} action`}
                    className="inline-flex items-center gap-1.5 h-9 px-4 text-[13px] font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-[8px] cursor-pointer transition-colors"
                  >
                    <Icon size={14} /> {a.label}
                  </button>
                );
              })
            ) : role ? (
              <span className="text-[12px] text-ink-400">No actions available for the {role === 'risk-owner' ? 'Risk Owner' : 'Auditor'} right now.</span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-5 text-[13px] font-medium text-ink-700 bg-canvas-elevated border border-canvas-border rounded-[8px] hover:bg-[#F4F2F7] cursor-pointer transition-colors shrink-0"
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
