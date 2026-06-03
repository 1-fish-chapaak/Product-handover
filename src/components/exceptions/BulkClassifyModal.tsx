import DatePicker from '../shared/DatePicker';
import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { X, Tag, ChevronDown, Calendar, Link as LinkIcon, Paperclip, User, ChevronDown as CaretDown, Pencil, Trash2 } from 'lucide-react';
import {
  ACTION_HUB_TIMELINE,
  type GrcException,
  type GrcExceptionClassification,
  type GrcExceptionSeverity,
  type ActionHubEvent,
  type ActionHubActorRole,
} from '../../data/mockData';

const SEVERITY_TONE: Record<GrcExceptionSeverity, { base: string; active: string }> = {
  High:   { base: 'text-ink-700', active: 'bg-high-50 border-high text-high-700' },
  Medium: { base: 'text-ink-700', active: 'bg-mitigated-50 border-mitigated text-mitigated-700' },
  Low:    { base: 'text-ink-700', active: 'bg-compliant-50 border-compliant text-compliant-700' },
};

const ROLE_AVATAR: Record<ActionHubActorRole, { initials: string; bg: string; fg: string }> = {
  'Risk Owner': { initials: 'RO', bg: 'bg-brand-100',    fg: 'text-brand-700' },
  'Auditor':    { initials: 'AU', bg: 'bg-[#EDE4FA]',   fg: 'text-brand-700' },
  'Ira (AI)':   { initials: 'AI', bg: 'bg-compliant-50', fg: 'text-compliant-700' },
  'System':     { initials: 'SY', bg: 'bg-[#EEEEF1]',   fg: 'text-ink-600' },
};

const CLASSIFICATION_OPTIONS: GrcExceptionClassification[] = [
  'Design Deficiency',
  'System Deficiency',
  'Procedural Non-Compliance',
  'Business as Usual',
  'False Positive',
];

const ACTIONABLE_CLASSIFICATIONS: GrcExceptionClassification[] = [
  'Design Deficiency',
  'System Deficiency',
  'Procedural Non-Compliance',
];

const CLASSIFICATION_PILL: Record<GrcExceptionClassification, string> = {
  Unclassified:                'bg-[#F4F2F7] text-ink-600',
  'Design Deficiency':         'bg-high-50 text-high-700',
  'System Deficiency':         'bg-risk-50 text-risk-700',
  'Procedural Non-Compliance': 'bg-brand-50 text-brand-700',
  'Business as Usual':         'bg-compliant-50 text-compliant-700',
  'False Positive':            'bg-[#EEEEF1] text-ink-600',
};

export interface BulkClassifyPayload {
  actionableId: string;
  severity: GrcExceptionSeverity;
  classification: GrcExceptionClassification;
  caseIds: string[];
  actionName?: string;
  actionTaken?: string;
  dueDate?: string;
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-[0.75rem] font-medium text-ink-800 mb-1.5">
      {children}
      {required && <span className="text-risk ml-0.5">*</span>}
    </label>
  );
}

export default function BulkClassifyModal({
  selectedCases,
  actionableId,
  onClose,
  onApply,
}: {
  selectedCases: GrcException[];
  actionableId: string;
  onClose: () => void;
  onApply: (payload: BulkClassifyPayload) => void;
}) {
  // Default severity = the most common severity across the selected cases.
  const initialSeverity = useMemo<GrcExceptionSeverity>(() => {
    const counts: Record<GrcExceptionSeverity, number> = { High: 0, Medium: 0, Low: 0 };
    selectedCases.forEach(c => { counts[c.severity] += 1; });
    return (['High', 'Medium', 'Low'] as const).reduce((a, b) => counts[a] >= counts[b] ? a : b);
  }, [selectedCases]);

  const [severity, setSeverity] = useState<GrcExceptionSeverity>(initialSeverity);
  const [classification, setClassification] = useState<GrcExceptionClassification | ''>('');
  const [actionName, setActionName] = useState('');
  const [actionTaken, setActionTaken] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [comment, setComment] = useState('');
  const [showAllActivity, setShowAllActivity] = useState(false);

  const selectedIds = useMemo(() => new Set(selectedCases.map(c => c.id)), [selectedCases]);
  const activity = useMemo<ActionHubEvent[]>(
    () => ACTION_HUB_TIMELINE.filter(ev => selectedIds.has(ev.exceptionId)),
    [selectedIds],
  );
  const visibleActivity = showAllActivity ? activity : activity.slice(0, 3);

  const requiresActionPlan = classification !== '' && ACTIONABLE_CLASSIFICATIONS.includes(classification);

  const canApply = useMemo(() => {
    if (!classification) return false;
    if (requiresActionPlan) {
      if (!actionName.trim() || !actionTaken.trim() || !dueDate) return false;
    }
    return true;
  }, [classification, requiresActionPlan, actionName, actionTaken, dueDate]);

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
        className="fixed top-0 right-0 bottom-0 w-full max-w-[640px] bg-canvas-elevated shadow-xl border-l border-canvas-border z-[60] flex flex-col"
        role="dialog"
        aria-label="Bulk Classify"
      >
        {/* Header */}
        <header className="shrink-0 px-6 py-5 flex items-start justify-between gap-4 border-b border-canvas-border">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-[10px] bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
              <Tag size={18} />
            </div>
            <div>
              <h2 className="text-[1.0625rem] font-semibold text-ink-900 leading-tight">Bulk Classify</h2>
              <p className="text-[0.75rem] text-ink-500 mt-1 leading-snug">
                Apply the same classification and action plan to{' '}
                <span className="font-semibold text-ink-800 tabular-nums">{selectedCases.length}</span>{' '}
                selected case{selectedCases.length === 1 ? '' : 's'}.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Actionable ID + Selected cases pill row */}
          <section className="bg-brand-50/60 border border-brand-100 rounded-[12px] p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2 text-[0.75rem] text-ink-700">
                <LinkIcon size={13} className="text-brand-700" />
                <span>Actionable ID</span>
              </div>
              <span className="font-mono text-[0.8125rem] font-semibold text-brand-700">{actionableId}</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {selectedCases.map(c => (
                <span
                  key={c.id}
                  className="inline-flex items-center h-6 px-2 text-[0.6875rem] font-mono font-medium bg-canvas-elevated border border-canvas-border text-ink-700 rounded-full"
                >
                  {c.id}
                </span>
              ))}
            </div>
          </section>

          {/* Severity */}
          <div>
            <FieldLabel required>Severity</FieldLabel>
            <div className="grid grid-cols-3 gap-2">
              {(['High', 'Medium', 'Low'] as const).map((s) => {
                const selected = severity === s;
                const tone = SEVERITY_TONE[s];
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSeverity(s)}
                    className={`h-10 text-[0.8125rem] font-medium rounded-[8px] border transition-colors cursor-pointer ${
                      selected ? tone.active : `bg-canvas-elevated border-canvas-border ${tone.base} hover:border-brand-200`
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Classification */}
          <div>
            <FieldLabel required>Select Classification</FieldLabel>
            <div className="relative">
              <select
                value={classification}
                onChange={(e) => setClassification(e.target.value as GrcExceptionClassification | '')}
                className="w-full h-10 pl-3 pr-9 bg-canvas-elevated border border-canvas-border rounded-[8px] text-[0.8125rem] text-ink-800 appearance-none focus:outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/20 cursor-pointer"
              >
                <option value="">Select classification…</option>
                {CLASSIFICATION_OPTIONS.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
            </div>
            {classification && (
              <div className="mt-2">
                <span className={`inline-flex items-center h-6 px-2.5 text-[0.6875rem] font-medium rounded-full ${CLASSIFICATION_PILL[classification]}`}>
                  {classification}
                </span>
                {!requiresActionPlan && (
                  <span className="ml-2 text-[0.75rem] text-ink-500">No action plan required.</span>
                )}
              </div>
            )}
          </div>

          {/* Conditional action-plan fields */}
          {requiresActionPlan && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
              className="space-y-4 border-t border-canvas-border pt-5"
            >
              {/* Grouped Action Plan card with shared edit/delete toolbar */}
              <div className="border border-canvas-border rounded-[10px] p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[0.75rem] uppercase tracking-wider font-semibold text-ink-500">
                    Action Plan
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const el = document.querySelector<HTMLInputElement>('input[data-field="bulk-action-name"]');
                        el?.focus();
                      }}
                      title="Edit action plan"
                      aria-label="Edit action plan"
                      className="w-6 h-6 flex items-center justify-center rounded text-ink-400 hover:text-brand-700 hover:bg-[#F4F2F7] cursor-pointer"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => { setActionName(''); setActionTaken(''); }}
                      title="Clear action plan"
                      aria-label="Clear action plan"
                      className="w-6 h-6 flex items-center justify-center rounded text-ink-400 hover:text-risk-700 hover:bg-risk-50 cursor-pointer"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                <div>
                  <FieldLabel required>Action Name</FieldLabel>
                  <input
                    data-field="bulk-action-name"
                    value={actionName}
                    onChange={(e) => setActionName(e.target.value)}
                    placeholder="e.g. MFA enforcement for executive accounts"
                    className="w-full h-10 px-3 bg-canvas-elevated border border-canvas-border rounded-[8px] text-[0.8125rem] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/20"
                  />
                </div>

                <div>
                  <FieldLabel required>Action Details</FieldLabel>
                  <div className="relative">
                    <textarea
                      value={actionTaken}
                      onChange={(e) => setActionTaken(e.target.value)}
                      rows={4}
                      placeholder="Describe the remediation steps, evidence, and rollout plan…"
                      className="w-full resize-none p-3 pr-10 bg-canvas-elevated border border-canvas-border rounded-[8px] text-[0.8125rem] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/20"
                    />
                    <button
                      type="button"
                      title="Attach file"
                      aria-label="Attach file to action details"
                      className="absolute bottom-2 right-2 w-7 h-7 flex items-center justify-center text-ink-400 hover:text-brand-700 cursor-pointer"
                    >
                      <Paperclip size={14} />
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <FieldLabel required>Due Date</FieldLabel>
                <div className="relative w-[220px]">
                  <DatePicker value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full h-10 pl-3 pr-9 bg-canvas-elevated border border-canvas-border rounded-[8px] text-[0.8125rem] text-ink-800 focus:outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/20"
                  />
                  <Calendar size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
                </div>
              </div>
            </motion.div>
          )}

          {/* Comment box with attachment */}
          <div>
            <FieldLabel>Comment</FieldLabel>
            <div className="relative">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a comment for this bulk classification..."
                rows={4}
                className="w-full resize-none p-3 pr-10 bg-canvas-elevated border border-canvas-border rounded-[8px] text-[0.8125rem] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/20"
              />
              <button
                type="button"
                className="absolute bottom-2 right-2 w-7 h-7 flex items-center justify-center text-ink-400 hover:text-brand-700 cursor-pointer"
                aria-label="Attach file"
              >
                <Paperclip size={14} />
              </button>
            </div>
          </div>

          {/* Activity Log */}
          <section className="border border-canvas-border rounded-[12px] p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[0.75rem] font-semibold uppercase tracking-wider text-ink-500">
                Activity Log
              </div>
              <span className="text-[0.6875rem] text-ink-500 tabular-nums">
                {activity.length} event{activity.length === 1 ? '' : 's'} across {selectedCases.length} case{selectedCases.length === 1 ? '' : 's'}
              </span>
            </div>
            {activity.length === 0 ? (
              <p className="text-[0.75rem] text-ink-500">No prior activity for the selected cases.</p>
            ) : (
              <>
                <ol className="space-y-3">
                  {visibleActivity.map(ev => {
                    const avatar = ROLE_AVATAR[ev.role];
                    return (
                      <li key={ev.id} className="flex gap-3">
                        <div className={`shrink-0 w-7 h-7 rounded-full ${avatar.bg} ${avatar.fg} flex items-center justify-center`}>
                          {ev.role === 'Ira (AI)' ? (
                            <span className="text-[0.75rem] font-semibold tracking-wider">AI</span>
                          ) : (
                            <User size={13} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3 mb-0.5">
                            <div className="text-[0.75rem] text-ink-800">
                              <span className="font-semibold">{ev.actor}</span>{' '}
                              <span className="text-ink-500">[{ev.role}]</span>
                              <span className="ml-2 inline-flex items-center h-4 px-1.5 text-[0.625rem] font-mono font-medium bg-brand-50 text-brand-700 rounded">
                                {ev.exceptionId}
                              </span>
                            </div>
                            <span className="text-[0.6875rem] text-ink-500 tabular-nums whitespace-nowrap">{ev.date} · {ev.time}</span>
                          </div>
                          <p className="text-[0.75rem] text-ink-700 leading-snug">{ev.message}</p>
                          {ev.comment && (
                            <div className="mt-1.5 px-3 py-2 bg-[#FAFAFB] border border-canvas-border rounded-[8px] text-[0.75rem] text-ink-700 leading-relaxed">
                              {ev.comment}
                            </div>
                          )}
                          {ev.attachment && (
                            <button className="mt-1.5 inline-flex items-center gap-1.5 h-6 px-2 bg-brand-50 text-brand-700 text-[0.75rem] font-medium rounded-full hover:bg-brand-100 cursor-pointer">
                              <Paperclip size={11} />
                              {ev.attachment.name}
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
                {activity.length > 3 && (
                  <button
                    onClick={() => setShowAllActivity(v => !v)}
                    className="mt-3 inline-flex items-center gap-1 text-[0.75rem] font-medium text-brand-700 hover:text-brand-600 cursor-pointer"
                  >
                    <CaretDown size={12} className={showAllActivity ? 'rotate-180' : ''} />
                    {showAllActivity ? 'Show less' : `Show ${activity.length - 3} more`}
                  </button>
                )}
              </>
            )}
          </section>
        </div>

        {/* Footer */}
        <footer className="shrink-0 px-6 py-4 border-t border-canvas-border flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="h-10 px-5 text-[0.8125rem] font-medium text-ink-700 bg-canvas-elevated border border-canvas-border rounded-[8px] hover:border-brand-200 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (!canApply) return;
              onApply({
                actionableId,
                severity,
                classification: classification as GrcExceptionClassification,
                caseIds: selectedCases.map(c => c.id),
                actionName: requiresActionPlan ? actionName.trim() : undefined,
                actionTaken: requiresActionPlan ? actionTaken.trim() : undefined,
                dueDate: requiresActionPlan ? dueDate : undefined,
              });
            }}
            disabled={!canApply}
            className={`h-10 px-5 text-[0.8125rem] font-semibold rounded-[8px] transition-colors ${
              canApply
                ? 'bg-brand-600 text-white hover:bg-brand-500 cursor-pointer'
                : 'bg-brand-600/50 text-white/80 cursor-not-allowed'
            }`}
          >
            Apply to {selectedCases.length} case{selectedCases.length === 1 ? '' : 's'}
          </button>
        </footer>
      </motion.aside>
    </>
  );
}
