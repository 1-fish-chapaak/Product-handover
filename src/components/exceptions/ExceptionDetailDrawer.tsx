import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar, ArrowRight, FileText, Paperclip, CheckCircle2, User, Tag, RotateCcw, ClipboardCheck, CornerUpLeft, ExternalLink, Link as LinkIcon, MessageSquare, Send } from 'lucide-react';
import { GRC_CASE_DETAILS } from '../../data/mockData';
import type {
  GrcException,
  GrcExceptionClassification,
} from '../../data/mockData';
import { exceptionActionsFor, type ExceptionActionKind } from './statusModel';
import { useWorkflow } from './workflow/WorkflowContext';
import WorkflowPipelineView from './workflow/WorkflowPipelineView';

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
  'Others':                    'bg-mitigated-50 text-mitigated-700',
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
  /** Other exceptions sharing this Actionable ID — when more than one, the detail
   *  reframes as an Actionable-ID-wise action-plan view with a linked-cases list. */
  linkedExceptions?: GrcException[];
  /** Deep-dive into a specific linked exception (re-opens the detail). */
  onSelectLinked?: (ex: GrcException) => void;
  /** Post a free-form comment (with an optional attachment) to this case's
   *  thread. Always available to both personas — the comment channel is never
   *  disabled by case status or phase. When omitted (read-only hosts), the
   *  composer is hidden. */
  onComment?: (text: string, attachment?: { name: string }) => void;
  onClose: () => void;
}

export default function ExceptionDetailDrawer({ exception: ex, extraColumns, role, onAction, linkedExceptions, onSelectLinked, onComment, onClose }: Props) {
  // Always-on comment composer — never gated by case status, phase, or review.
  const [commentText, setCommentText] = useState('');
  const [commentAttachment, setCommentAttachment] = useState<{ name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const personaLabel = role === 'auditor' ? 'Auditor' : 'Risk Owner';
  const personaInitials = role === 'auditor' ? 'AU' : 'RO';
  const otherPersonaLabel = role === 'auditor' ? 'Risk Owner' : 'Auditor';
  // Anything typed or attached counts as an unsent comment — the case actions
  // are then held until it's posted (or cleared).
  const hasUnsentComment = !!commentText.trim() || !!commentAttachment;
  const submitComment = () => {
    if (!hasUnsentComment || !onComment) return;
    onComment(commentText.trim(), commentAttachment ?? undefined);
    setCommentText('');
    setCommentAttachment(null);
  };
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

  // Approval route, when this case is delegated through one. Read-only here —
  // the actual work / review actions are performed from the Classify and Action
  // columns (and their modals), never from a second surface.
  const { assignments } = useWorkflow();
  const assignment = assignments.find(a => a.exceptionId === ex.id && a.status !== 'pulled-back');

  // When this exception's management action plan is shared across a bulk group
  // (same Actionable ID), present the detail Actionable-ID-wise — led by the
  // plan/ID, with the linked exceptions listed so the user can drill into any one.
  const linked = linkedExceptions ?? [];
  const isPlanView = !!ex.actionableId && linked.length > 1;
  const [showLinked, setShowLinked] = useState(false);

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
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 8 }}
        transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-32px)] max-w-[900px] max-h-[88vh] bg-canvas-elevated shadow-xl border border-canvas-border rounded-xl z-[60] flex flex-col"
        role="dialog"
        aria-label={isPlanView ? `Action plan ${ex.actionableId}` : `Exception ${ex.id}`}
      >
        {/* Header */}
        <header className="shrink-0 px-7 pt-7 pb-5 flex items-start justify-between gap-4 border-b border-canvas-border">
          <div className="min-w-0">
            {isPlanView ? (
              <>
                <div className="inline-flex items-center gap-1.5 text-[0.6875rem] font-semibold text-brand-700 uppercase tracking-[0.14em] mb-1">
                  <LinkIcon size={12} /> Management Action Plan
                </div>
                <h2 className="text-[1.75rem] leading-[1.15] font-semibold text-ink-900 tracking-tight font-mono">
                  {ex.actionableId}
                </h2>
                <p className="text-[0.8125rem] text-ink-500 mt-1 leading-snug">
                  {ex.classification} · {linked.length} linked exceptions
                </p>
              </>
            ) : (
              <>
                <h2 className="text-[1.75rem] leading-[1.15] font-semibold text-ink-900 tracking-tight">
                  {ex.id}
                </h2>
                <p className="text-[0.8125rem] text-ink-500 mt-1 leading-snug">
                  {ex.actionableId
                    ? <>Action plan <span className="font-mono text-brand-700">{ex.actionableId}</span> · Case <span className="font-mono">{ex.id.toLowerCase()}</span></>
                    : <>Case <span className="font-mono">{ex.id.toLowerCase()}</span></>}
                </p>
              </>
            )}
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

          {/* Approval route — live chain (read-only). Actions happen from the
              Classify / Action columns, never here. */}
          {assignment && (
            <section>
              <h3 className="text-[0.6875rem] font-semibold text-ink-500 uppercase tracking-[0.14em] mb-3">Approval Route</h3>
              <div className="border border-canvas-border rounded-lg bg-[#FAFAFB] p-5">
                <WorkflowPipelineView assignment={assignment} />
              </div>
            </section>
          )}

          {/* Part of Bulk Action — one action plan shared across the linked cases. */}
          {isPlanView && (
            <section>
              <div className="rounded-lg border border-brand-100 bg-brand-50/40 p-4">
                <div className="flex items-center gap-2 text-[0.78125rem] font-semibold text-brand-700 mb-2">
                  <LinkIcon size={13} /> Part of Bulk Action
                </div>
                <div className="flex items-center gap-2 text-[0.78125rem] text-ink-700 mb-3">
                  <span>ID: <span className="font-mono font-bold text-brand-700">{ex.actionableId}</span></span>
                  <span className="text-ink-300">|</span>
                  <span className="tabular-nums">{linked.length} cases grouped</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLinked(true)}
                  className="inline-flex items-center gap-1 text-[0.78125rem] font-medium text-brand-700 hover:text-brand-600 cursor-pointer"
                >
                  View all cases in this bulk action <ExternalLink size={12} />
                </button>
              </div>
            </section>
          )}

          {/* Action-plan due date — with the revised-date request when present */}
          {(ex.dueDate || ex.dueDateRevision) && (
            <section>
              <h3 className="text-[0.6875rem] font-semibold text-ink-500 uppercase tracking-[0.14em] mb-3">Action Plan Due Date</h3>
              {ex.dueDateRevision ? (
                <div className="border border-canvas-border rounded-lg p-4">
                  <div className="flex items-stretch gap-2.5">
                    <div className="flex-1 rounded-md border border-canvas-border bg-[#FAFAFB] p-3">
                      <div className="text-[0.65625rem] font-semibold uppercase tracking-wider text-ink-500 mb-1">Previous</div>
                      <div className={`text-[0.84375rem] font-semibold ${ex.dueDateRevision.status === 'Approved' ? 'text-ink-500 line-through decoration-ink-300' : 'text-ink-800'}`}>
                        {fmtDate(ex.dueDateRevision.previousDueDate)}
                      </div>
                    </div>
                    <div className="flex items-center shrink-0"><ArrowRight size={15} className="text-ink-400" /></div>
                    <div className="flex-1 rounded-md border border-brand-200 bg-brand-50/60 p-3">
                      <div className="text-[0.65625rem] font-semibold uppercase tracking-wider text-brand-700 mb-1">Revised</div>
                      <div className="text-[0.84375rem] font-bold text-brand-700">{fmtDate(ex.dueDateRevision.revisedDueDate)}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-[0.71875rem] text-ink-500">Requested by {ex.dueDateRevision.requestedBy}</span>
                    <Pill className={REVIEW_STYLE[ex.dueDateRevision.status] ?? 'bg-[#F4F2F7] text-ink-600'}>
                      {ex.dueDateRevision.status === 'Pending' ? 'Awaiting approval' : ex.dueDateRevision.status}
                    </Pill>
                  </div>
                  {ex.dueDateRevision.reason && (
                    <p className="text-[0.78125rem] text-ink-700 leading-relaxed mt-3 pt-3 border-t border-canvas-border">{ex.dueDateRevision.reason}</p>
                  )}
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 h-9 px-3 rounded-md border border-canvas-border bg-[#FAFAFB] text-[0.8125rem] font-semibold text-ink-800">
                  <Calendar size={14} className="text-ink-500" />
                  {fmtDate(ex.dueDate)}
                </div>
              )}
            </section>
          )}

          {/* Management Action Plan(s) */}
          {plans.length > 0 && (
            <section>
              <h3 className="text-[0.6875rem] font-semibold text-ink-500 uppercase tracking-[0.14em] mb-3">
                {plans.length > 1 ? `Management Action Plans · ${plans.length}` : 'Management Action Plan'}
              </h3>
              <div className="border border-canvas-border rounded-lg divide-y divide-canvas-border overflow-hidden">
                {plans.map((p, i) => (
                  <div key={i} className="p-4">
                    <div className="flex items-center gap-1.5 text-[0.84375rem] font-semibold text-ink-900 leading-snug mb-1">
                      <FileText size={13} className="text-ink-500 shrink-0" />
                      {p.name || `Management Action Plan ${i + 1}`}
                    </div>
                    {p.dueDate && (
                      <span className="inline-flex items-center gap-1.5 text-[0.71875rem] text-brand-700 bg-brand-50 rounded-full px-2.5 h-6 mb-2">
                        <Calendar size={11} /> Due {fmtDate(p.dueDate)}
                      </span>
                    )}
                    {p.details && <p className="text-[0.78125rem] text-ink-700 leading-relaxed mt-1">{p.details}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Action completed by the Risk Owner — note + evidence */}
          {completion && (
            <section>
              <h3 className="text-[0.6875rem] font-semibold text-ink-500 uppercase tracking-[0.14em] mb-3">Action Taken</h3>
              <div className="border border-compliant/40 bg-compliant-50/40 rounded-lg p-4">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 text-[0.75rem] font-semibold text-compliant-700">
                    <CheckCircle2 size={13} /> Completed by the Risk Owner
                  </div>
                  {completion.selfAssessment && (
                    <span className={`inline-flex items-center h-6 px-2.5 rounded-full text-[0.6875rem] font-semibold ${completion.selfAssessment === 'Implemented' ? 'bg-compliant-50 text-compliant-700' : 'bg-mitigated-50 text-mitigated-700'}`}>
                      Reported: {completion.selfAssessment}
                    </span>
                  )}
                </div>
                <p className="text-[0.78125rem] text-ink-700 leading-relaxed">{completion.note}</p>
                {completion.evidence.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {completion.evidence.map((ev, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 h-7 px-2.5 bg-white border border-canvas-border rounded-full text-[0.71875rem] text-ink-700">
                        <Paperclip size={11} className="text-brand-600" /> {ev.name}
                      </span>
                    ))}
                  </div>
                )}
                {completion.completedAt && <p className="text-[0.6875rem] text-ink-400 mt-2">Marked complete on {completion.completedAt}</p>}
              </div>
            </section>
          )}

          {/* Activity & comments — the always-on channel between the Risk Owner
              and the Auditor. The composer is never disabled by case status,
              phase, or review outcome: the two personas can always talk here. */}
          <section>
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="text-[0.6875rem] font-semibold text-ink-500 uppercase tracking-[0.14em]">Activity &amp; Comments</h3>
              <span className="inline-flex items-center gap-1.5 text-[0.6875rem] text-ink-500">
                <MessageSquare size={12} className="text-brand-600" />
                Risk Owner and Auditor can comment anytime
              </span>
            </div>

            {/* Composer — always available to whichever persona is active. */}
            {onComment && (
              <div className="flex gap-3 mb-5">
                <div className="shrink-0 w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[0.625rem] font-semibold tracking-wider" aria-hidden="true">
                  {personaInitials}
                </div>
                <div className="flex-1 min-w-0">
                  <label htmlFor="case-comment" className="sr-only">Add a comment as the {personaLabel}</label>
                  <textarea
                    id="case-comment"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); submitComment(); } }}
                    rows={2}
                    placeholder={`Comment as the ${personaLabel} — the ${otherPersonaLabel} will be notified and can reply.`}
                    className="w-full resize-y rounded-md border border-canvas-border bg-canvas-elevated px-3 py-2 text-[0.78125rem] text-ink-900 leading-relaxed placeholder:text-ink-400 focus:outline-none focus:border-brand-600 focus:ring-[3px] focus:ring-brand-600/20 transition-colors"
                  />
                  {commentAttachment && (
                    <div className="mt-2 inline-flex items-center gap-1.5 h-7 pl-2.5 pr-1.5 bg-brand-50 border border-brand-100 rounded-full text-[0.71875rem] text-ink-700">
                      <Paperclip size={11} className="text-brand-600" /> {commentAttachment.name}
                      <button type="button" onClick={() => setCommentAttachment(null)} aria-label="Remove attachment" className="w-4 h-4 inline-flex items-center justify-center rounded-full text-ink-500 hover:text-ink-800 hover:bg-white cursor-pointer"><X size={11} /></button>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) setCommentAttachment({ name: f.name }); e.target.value = ''; }}
                  />
                  <div className="flex items-center justify-between gap-3 mt-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        title="Attach a file"
                        className="inline-flex items-center gap-1.5 h-8 px-2.5 text-[0.75rem] font-medium text-ink-600 bg-canvas-elevated border border-canvas-border rounded-md hover:border-brand-200 hover:text-brand-700 cursor-pointer transition-colors"
                      >
                        <Paperclip size={13} /> Attach
                      </button>
                      <span className="text-[0.6875rem] text-ink-400 truncate"><kbd className="font-mono text-[0.625rem] text-ink-500">⌘↵</kbd> to post · visible to both personas.</span>
                    </div>
                    <button
                      type="button"
                      onClick={submitComment}
                      disabled={!hasUnsentComment}
                      className="inline-flex items-center gap-1.5 h-8 px-3.5 text-[0.78125rem] font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-md cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send size={13} /> Post Comment
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Thread — newest first (comments and actions interleaved). */}
            {activity.length > 0 ? (
              <ol className="space-y-3.5">
                {activity.map((entry) => {
                  const isComment = entry.kind === 'comment';
                  return (
                    <li key={entry.id} className="flex gap-3">
                      <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${isComment ? 'bg-brand-50 text-brand-600' : 'bg-[#F4F2F7] text-ink-500'}`}>
                        {isComment ? <MessageSquare size={13} /> : <User size={13} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="text-[0.78125rem] text-ink-800"><span className="font-semibold">{entry.author}</span> <span className="text-ink-500">[{entry.role}]</span></div>
                          <span className="text-[0.6875rem] text-ink-500 tabular-nums whitespace-nowrap">{entry.timestamp}</span>
                        </div>
                        <p className="text-[0.78125rem] text-ink-700 leading-snug mt-0.5">{entry.message}</p>
                        {entry.comment && (
                          <div className="mt-2 px-3 py-2 bg-brand-50/50 border-l-2 border-brand-300 rounded-r-md text-[0.75rem] text-ink-800 leading-relaxed">{entry.comment}</div>
                        )}
                        {entry.attachment && (
                          <span className="mt-2 inline-flex items-center gap-1.5 h-7 px-2.5 bg-white border border-canvas-border rounded-full text-[0.71875rem] text-ink-700">
                            <Paperclip size={11} className="text-brand-600" /> {entry.attachment.name}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="text-[0.75rem] text-ink-400 py-2">No activity yet. Start the conversation with a comment above.</p>
            )}
          </section>

          {/* All data fields — joined row from the source query's output table */}
          <section>
            <h3 className="text-[0.6875rem] font-semibold text-ink-500 uppercase tracking-[0.14em] mb-3">All Data Fields</h3>
            {dataFields.length === 0 ? (
              <div className="border border-canvas-border rounded-lg px-4 py-6 text-center text-[0.78125rem] text-ink-500">
                No data fields available for this exception.
              </div>
            ) : (
              <div className="border border-canvas-border rounded-lg overflow-hidden bg-[#FAFAFB]">
                <table className="w-full text-[0.78125rem]">
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
            <h3 className="text-[0.6875rem] font-semibold text-ink-500 uppercase tracking-[0.14em] mb-3">Audit</h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <DetailField label="Created">
                <span className="text-[0.8125rem] text-ink-800">{ex.lastUpdated}</span>
              </DetailField>
              <DetailField label="Updated">
                <span className="text-[0.8125rem] text-ink-800">{ex.lastUpdated}</span>
              </DetailField>
            </div>
            <div className="mt-3 text-[0.78125rem] text-ink-500">
              Reference ID: <span className="font-mono text-ink-700">{ex.id.toLowerCase()}</span>
            </div>
          </section>
        </div>

        {/* Footer — persona-aware actions (same as the Exceptions tab) + Close */}
        <footer className="shrink-0 px-7 py-4 border-t border-canvas-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {hasUnsentComment && actions.length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-[0.71875rem] font-medium text-mitigated-700 mr-1">
                <MessageSquare size={12} /> Post your comment to continue.
              </span>
            )}
            {actions.length > 0 ? (
              actions.map(a => {
                const Icon = ACTION_ICON[a.kind];
                return (
                  <button
                    key={a.kind}
                    type="button"
                    disabled={hasUnsentComment}
                    onClick={() => onAction?.(a.kind, ex)}
                    title={hasUnsentComment ? 'Post your comment first, then continue with this action.' : `${a.label} · ${role === 'risk-owner' ? 'Risk Owner' : 'Auditor'} action`}
                    className="inline-flex items-center gap-1.5 h-9 px-4 text-[0.8125rem] font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-md cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Icon size={14} /> {a.label}
                  </button>
                );
              })
            ) : role ? (
              <span className="text-[0.75rem] text-ink-400">No actions available for the {role === 'risk-owner' ? 'Risk Owner' : 'Auditor'} right now.</span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-5 text-[0.8125rem] font-medium text-ink-700 bg-canvas-elevated border border-canvas-border rounded-md hover:bg-[#F4F2F7] cursor-pointer transition-colors shrink-0"
          >
            Close
          </button>
        </footer>
      </motion.aside>

      {/* Linked cases in this bulk action — opened from "View all cases". */}
      <AnimatePresence>
        {showLinked && (
          <>
            <div className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] z-[70]" onClick={() => setShowLinked(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 8 }}
              transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-32px)] max-w-[560px] max-h-[80vh] bg-canvas-elevated rounded-xl shadow-xl border border-canvas-border z-[71] flex flex-col"
              role="dialog"
              aria-label="Linked cases"
            >
              <header className="shrink-0 px-6 py-5 flex items-start justify-between gap-4 border-b border-canvas-border">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center gap-1.5 h-5 px-2 text-[0.65625rem] font-semibold bg-brand-50 text-brand-700 rounded-full"><LinkIcon size={11} /> Bulk</span>
                    <h2 className="font-display text-[1.125rem] font-semibold text-ink-900 tracking-tight">Cases in this bulk action</h2>
                  </div>
                  <p className="text-[0.78125rem] text-ink-500 leading-snug">
                    ID: <span className="font-mono">{ex.actionableId}</span> · {linked.length} cases · one action plan applies to all
                  </p>
                </div>
                <button onClick={() => setShowLinked(false)} className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer shrink-0" aria-label="Close">
                  <X size={16} />
                </button>
              </header>
              <div className="flex-1 overflow-y-auto px-6 py-5">
                <div className="border border-canvas-border rounded-lg divide-y divide-canvas-border overflow-hidden">
                  {linked.map(le => {
                    const current = le.id === ex.id;
                    return (
                      <button
                        key={le.id}
                        type="button"
                        disabled={!onSelectLinked}
                        onClick={() => { if (onSelectLinked) { setShowLinked(false); onSelectLinked(le); } }}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${onSelectLinked ? 'cursor-pointer hover:bg-paper-50/70' : ''} ${current ? 'bg-brand-50/40' : ''}`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-medium text-brand-700 text-[0.78125rem]">{le.id}</span>
                            {current && <span className="text-[0.625rem] font-semibold text-ink-500 bg-[#F4F2F7] rounded-full px-1.5 h-4 inline-flex items-center">Current</span>}
                          </div>
                          <div className="text-[0.75rem] text-ink-600 truncate mt-0.5">{le.title}</div>
                        </div>
                        <Pill className={CLASSIFICATION_STYLE[le.classification]}>{le.classification}</Pill>
                        {onSelectLinked && !current && <ExternalLink size={13} className="text-ink-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[0.6875rem] font-semibold text-ink-500 uppercase tracking-[0.14em] mb-2">{label}</div>
      {children}
    </div>
  );
}

function Pill({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center h-7 px-3 rounded-full text-[0.75rem] font-medium ${className}`}>
      {children}
    </span>
  );
}
