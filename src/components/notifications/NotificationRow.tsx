import { useState } from 'react';
import { Check, X, MessageSquare } from 'lucide-react';
import type {
  PlatformNotification,
  NotificationCategory,
  NotificationAction,
  NotificationActionState,
} from '../../data/notifications';
import { timeAgo } from '../../utils/timeAgo';

// Each category gets its own dedicated color on the unread stripe — so the
// user can scan the panel and tell at a glance: red bars = exceptions,
// blue bars = workflow runs, amber bars = engagement, purple bars = reports.
const CATEGORY_BAR: Record<NotificationCategory, string> = {
  exception:  'bg-risk',        // red — issues / failures
  workflow:   'bg-evidence',    // blue — automation / runs
  engagement: 'bg-mitigated',   // amber — audit / engagements
  report:     'bg-brand-500',   // purple — reporting / dashboards
};

// Action pills use color-tones that are NOT in the category palette above
// (no red, blue, amber, or purple). That way: row stripe never visually
// collides with the action confirmation pill.
const PILL_TONE: Record<NotificationAction, { bg: string; fg: string; label: string }> = {
  accept:  { bg: 'bg-compliant-50', fg: 'text-compliant-700', label: 'Accepted' },   // green
  decline: { bg: 'bg-high-50',      fg: 'text-high-700',      label: 'Declined' },   // orange
  comment: { bg: 'bg-draft-50',     fg: 'text-draft-700',     label: 'Commented' },  // muted gray
};

interface NotificationRowProps {
  notification: PlatformNotification;
  onClick: (n: PlatformNotification) => void;
  /** When true, render Accept / Decline / Comment buttons inline. Used by
   *  the Action filter so the user can act without leaving the drawer. */
  showActions?: boolean;
  onAction?: (n: PlatformNotification, action: NotificationAction, text?: string) => void;
  onClearActionState?: (n: PlatformNotification) => void;
}

export default function NotificationRow({
  notification,
  onClick,
  showActions = false,
  onAction,
  onClearActionState,
}: NotificationRowProps) {
  const unread = !notification.read;
  const acted = !!notification.actionState;
  const [commenting, setCommenting] = useState(false);
  const [commentText, setCommentText] = useState('');

  const handleAction = (e: React.MouseEvent, action: NotificationAction) => {
    e.stopPropagation();
    if (action === 'comment') {
      setCommenting(true);
      return;
    }
    onAction?.(notification, action);
  };

  const submitComment = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    const text = commentText.trim();
    if (!text) return;
    onAction?.(notification, 'comment', text);
    setCommentText('');
    setCommenting(false);
  };

  const cancelComment = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    setCommentText('');
    setCommenting(false);
  };

  const actions = notification.actions ?? [];
  const renderActions = showActions && notification.requiresAction && actions.length > 0 && !acted;
  const renderPill    = !!notification.actionState;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(notification)}
      onKeyDown={(e) => {
        if (commenting) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(notification);
        }
      }}
      className={`group relative w-full text-left border-b border-canvas-border transition-all cursor-pointer
        ${unread
          ? 'bg-brand-50/40 hover:bg-brand-50/60 hover:shadow-[inset_0_-1px_0_rgb(15_8_30_/_0.04),0_2px_8px_-2px_rgb(15_8_30_/_0.08)]'
          : 'bg-canvas-elevated hover:bg-[#FAFAFD] hover:shadow-[inset_0_-1px_0_rgb(15_8_30_/_0.04),0_2px_8px_-2px_rgb(15_8_30_/_0.06)]'}
      `}
    >
      {/* Category-coded unread accent — red (exceptions) / blue (workflows)
          / amber (engagement) / purple (reports). Inset rounded stripe,
          only on unread rows. */}
      {unread && (
        <span
          className={`absolute left-0 top-3 bottom-3 w-1 rounded-r-full ${CATEGORY_BAR[notification.category]}`}
          aria-hidden="true"
        />
      )}

      <div className="pl-6 pr-5 py-3.5">
        <div className="flex items-start justify-between gap-3">
          <h3 className={`text-[0.75rem] leading-snug font-medium truncate ${unread ? 'text-ink-900' : 'text-ink-600'}`}>
            {notification.title}
          </h3>
          <span className="shrink-0 text-[0.6875rem] text-ink-400 tabular-nums whitespace-nowrap mt-[3px]">
            {timeAgo(notification.createdAt)}
          </span>
        </div>
        <p className={`mt-0.5 text-[0.75rem] leading-snug font-normal ${unread ? 'text-ink-600' : 'text-ink-500'}`}>
          {notification.message}
        </p>
        {notification.actor && (
          <div className="mt-1.5 text-[0.75rem] font-normal text-ink-400 truncate">
            {notification.actor}
          </div>
        )}

        {/* Inline review actions — Action filter only, not yet acted */}
        {renderActions && !commenting && (
          <div className="mt-2.5 flex items-center gap-1.5">
            {actions.includes('accept') && (
              <button
                onClick={(e) => handleAction(e, 'accept')}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[0.75rem] font-medium bg-brand-50 text-brand-700 hover:bg-brand-100 transition-colors cursor-pointer"
              >
                <Check size={12} />
                Accept
              </button>
            )}
            {actions.includes('decline') && (
              <button
                onClick={(e) => handleAction(e, 'decline')}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[0.75rem] font-medium text-ink-600 bg-canvas-elevated border border-canvas-border hover:border-risk hover:text-risk transition-colors cursor-pointer"
              >
                <X size={12} />
                Decline
              </button>
            )}
            {actions.includes('comment') && (
              <button
                onClick={(e) => handleAction(e, 'comment')}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[0.75rem] font-medium text-ink-600 hover:bg-[#F4F2F7] hover:text-brand-700 transition-colors cursor-pointer"
              >
                <MessageSquare size={12} />
                Comment
              </button>
            )}
          </div>
        )}

        {/* Persistent action pill — replaces buttons after the user acts */}
        {renderPill && notification.actionState && !commenting && (
          <ActionPill
            state={notification.actionState}
            onClear={() => onClearActionState?.(notification)}
          />
        )}

        {/* Inline comment composer */}
        {commenting && (
          <div className="mt-2.5" onClick={(e) => e.stopPropagation()}>
            <textarea
              autoFocus
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Escape') cancelComment(e);
                else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitComment(e);
              }}
              placeholder="Add a comment…"
              rows={2}
              className="w-full text-[0.75rem] leading-relaxed text-ink-800 bg-canvas-elevated border border-canvas-border rounded-md px-2.5 py-1.5 resize-none placeholder:text-ink-400 focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-200/60"
            />
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <span className="text-[0.75rem] text-ink-400">⌘↵ to send · Esc to cancel</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={cancelComment}
                  className="inline-flex items-center h-7 px-2.5 rounded-md text-[0.75rem] font-medium text-ink-600 hover:bg-[#F4F2F7] hover:text-ink-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={submitComment}
                  disabled={!commentText.trim()}
                  className="inline-flex items-center h-7 px-3 rounded-md text-[0.75rem] font-semibold text-white bg-brand-600 hover:bg-brand-500 disabled:bg-ink-200 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ActionPill({ state, onClear }: { state: NotificationActionState; onClear?: () => void }) {
  const tone = PILL_TONE[state.type];
  const Icon = state.type === 'accept' ? Check : state.type === 'decline' ? X : MessageSquare;
  return (
    <div className="mt-2.5 inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      <span className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[0.75rem] font-medium ${tone.bg} ${tone.fg}`}>
        <Icon size={12} />
        {tone.label} {timeAgo(state.takenAt)}
      </span>
      {state.type === 'comment' && state.comment && (
        <span
          className="text-[0.75rem] text-ink-500 italic max-w-[180px] truncate"
          title={state.comment}
        >
          “{state.comment}”
        </span>
      )}
      {onClear && (
        <button
          onClick={(e) => { e.stopPropagation(); onClear(); }}
          className="text-[0.6875rem] text-ink-500 hover:text-brand-700 px-2 h-7 rounded-md hover:bg-[#F4F2F7] transition-colors cursor-pointer"
        >
          Undo
        </button>
      )}
    </div>
  );
}
