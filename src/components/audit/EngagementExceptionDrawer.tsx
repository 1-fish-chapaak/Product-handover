import { useMemo, useState, type JSX } from 'react';
import { motion } from 'motion/react';
import {
  X,
  ExternalLink,
  User,
  Clock,
  Workflow as WorkflowIcon,
  AlertTriangle,
  Send,
  MessageSquare,
  ShieldCheck,
  ListChecks,
  Sparkles,
  Tag,
  Check,
} from 'lucide-react';
import { useToast } from '../shared/Toast';
import type {
  EngagementException,
  Classification,
  Severity,
} from '../../data/engagement-exceptions';

interface Props {
  exception: EngagementException;
  onClose: () => void;
  /** Called when user clicks the "Originating Workflow" deep-link in the drawer. */
  onOpenWorkflowRun?: (workflowId: string) => void;
}

const SEV_CHIP: Record<Severity, string> = {
  Critical: 'bg-risk-50 text-risk-700 border-risk-50',
  High: 'bg-high-50 text-high-700 border-high-50',
  Medium: 'bg-mitigated-50 text-mitigated-700 border-mitigated-50',
  Low: 'bg-compliant-50 text-compliant-700 border-compliant-50',
};

const SEV_DOT: Record<Severity, string> = {
  Critical: 'bg-risk',
  High: 'bg-high',
  Medium: 'bg-mitigated',
  Low: 'bg-compliant',
};

const STATUS_PILL: Record<EngagementException['status'], string> = {
  Open: 'bg-risk-50 text-risk-700',
  Triaging: 'bg-mitigated-50 text-mitigated-700',
  Resolved: 'bg-compliant-50 text-compliant-700',
};

const CLASSIFICATIONS: { id: Classification; label: string; description: string }[] = [
  { id: 'Control Deficiency', label: 'Control Deficiency', description: 'Control missing or ineffective.' },
  { id: 'Process Gap', label: 'Process Gap', description: 'Operating procedure breakdown.' },
  { id: 'False Positive', label: 'False Positive', description: 'Triggered but no real issue.' },
  { id: 'Other', label: 'Other', description: 'Doesn’t fit above categories.' },
];

const OWNERS = [
  'Tushar Goel',
  'Neha Joshi',
  'Karan Mehta',
  'Sneha Desai',
  'Rohan Patel',
  'Priya Singh',
  'Deepak Bansal',
];

type Priority = 'Low' | 'Medium' | 'High' | 'Critical';
const PRIORITIES: Priority[] = ['Low', 'Medium', 'High', 'Critical'];

interface DrawerComment {
  id: string;
  author: string;
  initials: string;
  time: string;
  body: string;
}

interface TrailEvent {
  id: string;
  icon: typeof Sparkles;
  iconTone: string;
  title: string;
  actor: string;
  time: string;
}

const SECTION_LABEL = 'text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-500';
const INPUT_CLS =
  'w-full px-3 py-2 border border-canvas-border rounded-lg text-[0.8125rem] text-ink-900 bg-white outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/15 transition-all placeholder:text-ink-400';
const LABEL_CLS = 'text-[0.75rem] font-semibold text-ink-600 block mb-1.5';

function initialsFor(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('');
}

export default function EngagementExceptionDrawer({
  exception,
  onClose,
  onOpenWorkflowRun,
}: Props): JSX.Element {
  const { addToast } = useToast();

  const [classification, setClassification] = useState<Classification | undefined>(
    exception.classification,
  );
  const [justification, setJustification] = useState('');

  const [planTitle, setPlanTitle] = useState('');
  const [planOwner, setPlanOwner] = useState<string>(exception.assignee);
  const [planDue, setPlanDue] = useState<string>('');
  const [planPriority, setPlanPriority] = useState<Priority>(
    exception.severity === 'Critical' ? 'Critical'
      : exception.severity === 'High' ? 'High'
      : 'Medium',
  );

  const [comments, setComments] = useState<DrawerComment[]>(() => [
    {
      id: 'c1',
      author: 'Priya Singh',
      initials: 'PS',
      time: '2h ago',
      body: 'Pulled the source extract — duplicate posting confirmed. Awaiting AP head to confirm reversal path.',
    },
    {
      id: 'c2',
      author: 'Tushar Goel',
      initials: 'TG',
      time: '1h ago',
      body: 'Vendor was onboarded last quarter; will check whether the duplicate-check tolerance was relaxed.',
    },
    {
      id: 'c3',
      author: 'Ira (AI)',
      initials: 'AI',
      time: '40m ago',
      body: 'Pattern matches three similar exceptions in the last 30 days — recommend classifying as Control Deficiency.',
    },
  ]);
  const [newComment, setNewComment] = useState('');

  const trail: TrailEvent[] = useMemo(() => [
    { id: 't1', icon: Sparkles,     iconTone: 'bg-evidence-50 text-evidence-700',   title: 'Exception created',                          actor: 'System',         time: '4h ago' },
    { id: 't2', icon: User,         iconTone: 'bg-brand-50 text-brand-700',         title: `Assigned to ${exception.assignee}`,          actor: 'Tushar Goel',    time: '3h ago' },
    { id: 't3', icon: MessageSquare,iconTone: 'bg-[#EEEEF1] text-ink-600',          title: 'Comment added',                              actor: 'Priya Singh',    time: '2h ago' },
    { id: 't4', icon: AlertTriangle,iconTone: 'bg-mitigated-50 text-mitigated-700', title: `Severity changed to ${exception.severity}`,  actor: 'System',         time: '1h ago' },
    { id: 't5', icon: ListChecks,   iconTone: 'bg-brand-50 text-brand-700',         title: 'Classified as Control Deficiency',           actor: 'Priya Singh',    time: '30m ago' },
    { id: 't6', icon: ShieldCheck,  iconTone: 'bg-compliant-50 text-compliant-700', title: 'Linked to control P2P-C-04',                 actor: 'Ira (AI)',       time: '12m ago' },
  ], [exception.assignee, exception.severity]);

  const closeWith = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    addToast({ message, type });
    onClose();
  };

  const handlePostComment = () => {
    const trimmed = newComment.trim();
    if (!trimmed) return;
    setComments((prev) => [
      ...prev,
      { id: `c-${Date.now()}`, author: 'You', initials: 'YO', time: 'just now', body: trimmed },
    ]);
    setNewComment('');
  };

  const canClose = Boolean(classification);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] z-50"
        onClick={onClose}
        aria-hidden="true"
      />
      <motion.aside
        initial={{ x: 24, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 24, opacity: 0 }}
        transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
        className="fixed top-0 right-0 bottom-0 w-full max-w-[560px] bg-canvas-elevated shadow-xl border-l border-canvas-border flex flex-col z-50"
        role="dialog"
        aria-label={`Exception ${exception.ref}`}
      >
        {/* ─── Header ─── */}
        <header className="shrink-0 px-6 pt-5 pb-4 border-b border-canvas-border bg-canvas-elevated">
          <div className="flex items-start gap-3">
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer -ml-1 mt-0.5 shrink-0"
              aria-label="Close drawer"
            >
              <X size={16} />
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`w-2 h-2 rounded-full ${SEV_DOT[exception.severity]}`} aria-hidden="true" />
                <span className="font-mono text-[0.75rem] tracking-tight text-ink-500">{exception.ref}</span>
                <span className={`ml-auto px-2 h-5 rounded-full text-[0.75rem] font-semibold inline-flex items-center ${STATUS_PILL[exception.status]}`}>
                  {exception.status}
                </span>
              </div>
              <h2 className="font-display text-[1.125rem] font-semibold text-ink-900 tracking-tight leading-snug">
                {exception.title}
              </h2>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1 px-2 h-5 rounded-full text-[0.75rem] font-bold uppercase border ${SEV_CHIP[exception.severity]}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${SEV_DOT[exception.severity]}`} aria-hidden="true" />
                  {exception.severity}
                </span>
                {exception.amount && (
                  <span className="inline-flex items-center px-2 h-5 rounded-full text-[0.75rem] font-semibold bg-[#F4F2F7] text-ink-700 font-mono">
                    {exception.amount}
                  </span>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* ─── Body (scrollable) ─── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Meta strip */}
          <section aria-label="Exception metadata" className="flex items-center gap-2 flex-wrap text-[0.75rem]">
            <span className="inline-flex items-center gap-1 px-2 h-6 rounded-full bg-[#F4F2F7] text-ink-700">
              <Tag size={11} className="text-ink-500" />
              {exception.severity}
            </span>
            <span className="inline-flex items-center gap-1 px-2 h-6 rounded-full bg-[#F4F2F7] text-ink-700">
              <User size={11} className="text-ink-500" />
              {exception.assignee}
            </span>
            <span className="inline-flex items-center gap-1 px-2 h-6 rounded-full bg-[#F4F2F7] text-ink-700">
              <Clock size={11} className="text-ink-500" />
              Opened {exception.opened}
            </span>
            {onOpenWorkflowRun && exception.workflowId ? (
              <button
                type="button"
                onClick={() => onOpenWorkflowRun(exception.workflowId)}
                className="inline-flex items-center gap-1.5 px-2 h-6 rounded-full bg-brand-50 text-brand-700 hover:bg-brand-100 transition-colors cursor-pointer font-medium"
                title="Open originating workflow run"
              >
                <WorkflowIcon size={11} />
                {exception.workflowName}
                <ExternalLink size={10} className="opacity-70" />
              </button>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 h-6 rounded-full bg-[#F4F2F7] text-ink-700">
                <WorkflowIcon size={11} className="text-ink-500" />
                {exception.workflowName}
              </span>
            )}
          </section>

          {/* Description (only if present) */}
          {exception.detail && (
            <section aria-label="Description" className="space-y-2">
              <h3 className={SECTION_LABEL}>Description</h3>
              <p className="text-[0.8125rem] leading-relaxed text-ink-700 bg-canvas border border-canvas-border rounded-xl px-4 py-3">
                {exception.detail}
              </p>
            </section>
          )}

          {/* Classification */}
          <section aria-label="Classification" className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className={SECTION_LABEL}>Classification · Risk Owner</h3>
              {classification && (
                <button
                  onClick={() => setClassification(undefined)}
                  className="text-[0.6875rem] font-medium text-ink-500 hover:text-ink-800 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {CLASSIFICATIONS.map((c) => {
                const active = classification === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setClassification(c.id)}
                    className={`text-left px-3 py-2.5 rounded-xl border transition-all cursor-pointer ${
                      active
                        ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/15'
                        : 'border-canvas-border bg-white hover:border-brand-300 hover:bg-brand-50/30'
                    }`}
                  >
                    <div className={`text-[0.75rem] font-semibold ${active ? 'text-brand-700' : 'text-ink-900'}`}>
                      {c.label}
                    </div>
                    <div className="text-[0.6875rem] text-ink-500 mt-0.5 leading-snug">{c.description}</div>
                  </button>
                );
              })}
            </div>
            <div>
              <label className={LABEL_CLS} htmlFor="justification">Justification (optional)</label>
              <textarea
                id="justification"
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                rows={2}
                placeholder="Explain the reasoning behind this classification…"
                className={INPUT_CLS + ' resize-none'}
              />
            </div>
          </section>

          {/* Action Plan */}
          <section aria-label="Action plan" className="space-y-3">
            <h3 className={SECTION_LABEL}>Action Plan</h3>
            <div>
              <label className={LABEL_CLS} htmlFor="plan-title">Title</label>
              <input
                id="plan-title"
                type="text"
                value={planTitle}
                onChange={(e) => setPlanTitle(e.target.value)}
                placeholder="e.g. Reverse posting & enforce duplicate-check"
                className={INPUT_CLS}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL_CLS} htmlFor="plan-owner">Owner</label>
                <select
                  id="plan-owner"
                  value={planOwner}
                  onChange={(e) => setPlanOwner(e.target.value)}
                  className={INPUT_CLS + ' cursor-pointer appearance-none'}
                >
                  {OWNERS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL_CLS} htmlFor="plan-due">Due date</label>
                <input
                  id="plan-due"
                  type="date"
                  value={planDue}
                  onChange={(e) => setPlanDue(e.target.value)}
                  className={INPUT_CLS + ' cursor-pointer'}
                />
              </div>
            </div>
            <div>
              <label className={LABEL_CLS} htmlFor="plan-priority">Priority</label>
              <select
                id="plan-priority"
                value={planPriority}
                onChange={(e) => setPlanPriority(e.target.value as Priority)}
                className={INPUT_CLS + ' cursor-pointer appearance-none'}
              >
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </section>

          {/* Comments */}
          <section aria-label="Comments" className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className={SECTION_LABEL}>Comments</h3>
              <span className="text-[0.6875rem] text-ink-400 tabular-nums">{comments.length}</span>
            </div>
            <ul className="space-y-2.5">
              {comments.map((c) => (
                <li key={c.id} className="flex gap-3">
                  <div className="shrink-0 w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[0.625rem] font-semibold tracking-wider">
                    {c.initials}
                  </div>
                  <div className="flex-1 min-w-0 rounded-xl bg-canvas border border-canvas-border px-3 py-2.5">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[0.75rem] font-semibold text-ink-900">{c.author}</span>
                      <span className="text-[0.75rem] text-ink-400 tabular-nums">{c.time}</span>
                    </div>
                    <p className="text-[0.75rem] leading-relaxed text-ink-700">{c.body}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex items-end gap-2 pt-1">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                rows={2}
                placeholder="Add a comment…"
                className={INPUT_CLS + ' resize-none'}
                aria-label="Add a comment"
              />
              <button
                onClick={handlePostComment}
                disabled={!newComment.trim()}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[0.75rem] font-semibold transition-colors cursor-pointer"
              >
                <Send size={12} />
                Post
              </button>
            </div>
          </section>

          {/* Action Trail */}
          <section aria-label="Action trail" className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className={SECTION_LABEL}>Action Trail · ATR</h3>
              <span className="text-[0.6875rem] text-ink-400 tabular-nums">{trail.length}</span>
            </div>
            <ol className="relative border-l-2 border-canvas-border pl-5 ml-3 space-y-3">
              {trail.map((ev) => {
                const Icon = ev.icon;
                return (
                  <li key={ev.id} className="relative">
                    {/* Dot marker — sits on the timeline rail */}
                    <span
                      className={`absolute -left-[31px] top-1 w-6 h-6 rounded-full ring-4 ring-canvas-elevated flex items-center justify-center ${ev.iconTone}`}
                    >
                      <Icon size={11} />
                    </span>
                    <div className="text-[0.75rem] font-medium text-ink-900 leading-snug">{ev.title}</div>
                    <div className="text-[0.6875rem] text-ink-500 mt-0.5">
                      {ev.actor} · <span className="tabular-nums">{ev.time}</span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>

        {/* ─── Footer (sticky) ─── */}
        <footer className="shrink-0 border-t border-canvas-border bg-canvas-elevated px-6 py-3.5 flex items-center gap-2">
          <button
            type="button"
            onClick={() => closeWith(`${exception.ref} approved`, 'success')}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-[0.75rem] font-semibold transition-colors cursor-pointer"
          >
            <Check size={13} />
            Approve
          </button>
          <button
            type="button"
            onClick={() => closeWith(`${exception.ref} rejected`, 'error')}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-risk-50 text-risk-700 hover:bg-risk-50 text-[0.75rem] font-semibold transition-colors cursor-pointer"
          >
            Reject
          </button>
          <button
            type="button"
            onClick={() => closeWith(`${exception.ref} reassigned`, 'info')}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-canvas-border text-ink-700 hover:bg-canvas text-[0.75rem] font-semibold transition-colors cursor-pointer"
          >
            Reassign
          </button>
          <button
            type="button"
            onClick={() => closeWith(`${exception.ref} closed`, 'success')}
            disabled={!canClose}
            title={canClose ? 'Close this exception case' : 'Select a classification before closing'}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-compliant-50 text-compliant-700 hover:bg-compliant-50 text-[0.75rem] font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          >
            Close case
          </button>
        </footer>
      </motion.aside>
    </>
  );
}
