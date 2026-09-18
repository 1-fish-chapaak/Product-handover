import { forwardRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import NotificationIcon from './NotificationIcon';
import NotificationTimestamp from './NotificationTimestamp';
import type { AppNotification } from './types';

export interface NotificationItemProps {
  n: AppNotification;
  /** Mark read + go there. The row is the only control. */
  onOpen?: (n: AppNotification) => void;
  /** Roving focus: the list owns which row is tabbable. */
  tabIndex?: number;
  onKeyNav?: (dir: 1 | -1) => void;
  /** Preferences preview — rendered as a static sample. */
  preview?: boolean;
  /** Stacking on open: this row's place in the queue (undefined = no stagger). */
  stackIndex?: number;
}

/**
 * One notification: what happened, why it matters, when — and the whole row
 * takes you there. Unread is a dot and a heavier title on the faintest tint;
 * read is the same row at rest. Nothing else competes for attention.
 */
const NotificationItem = forwardRef<HTMLButtonElement, NotificationItemProps>(function NotificationItem({ n, onOpen, tabIndex = -1, onKeyNav, preview = false, stackIndex }, ref) {
  const reduce = useReducedMotion();
  const unread = !n.read && !preview;
  const stacking = stackIndex !== undefined && !reduce && !preview;
  return (
    <motion.li
      // On open the rows stack in one after another — each rises 10px into
      // place, a fixed 40ms behind the one above, capped so a long list never
      // keeps the user waiting. No layout animation while that runs (it is
      // what made the earlier version jitter). A notification landing later
      // simply fades in at the top.
      initial={preview || reduce ? false : stacking ? { opacity: 0, y: 10 } : { opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, transition: { duration: reduce ? 0 : 0.18 } }}
      transition={stacking
        ? { duration: 0.26, delay: 0.05 + Math.min(stackIndex, 8) * 0.04, ease: [0.22, 1, 0.36, 1] }
        : { duration: reduce ? 0 : 0.2, ease: [0.2, 0, 0, 1] }}
      className="overflow-hidden border-b border-canvas-border/60 last:border-b-0"
    >
      <button
        ref={ref}
        type="button"
        tabIndex={tabIndex}
        disabled={preview}
        aria-label={`${unread ? 'Unread: ' : ''}${n.title}. ${n.message}`}
        onClick={() => !preview && onOpen?.(n)}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); onKeyNav?.(1); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); onKeyNav?.(-1); }
        }}
        className={`group relative w-full text-left flex items-start gap-3 px-[var(--notification-item-padding-x)] py-[var(--notification-item-padding-y)] transition-[background-color,transform,box-shadow] duration-150 ease-out focus-visible:outline-none focus-visible:bg-[var(--notification-hover-background)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600/30
          ${preview ? 'cursor-default' : 'cursor-pointer hover:bg-[var(--notification-hover-background)] hover:scale-[1.012] hover:z-10 hover:shadow-[0_4px_14px_rgba(15,8,30,0.06)] active:scale-[0.995] active:shadow-none motion-reduce:hover:scale-100 motion-reduce:active:scale-100'}
          ${unread ? 'bg-[var(--notification-unread-background)]' : 'bg-transparent'}`}
      >
        {/* Unread dot — colour plus the aria-label above, never colour alone. */}
        <span className="absolute left-1.5 top-[calc(var(--notification-item-padding-y)+7px)] w-1.5 h-1.5 rounded-full bg-[var(--notification-unread-dot)] transition-opacity duration-200" style={{ opacity: unread ? 1 : 0 }} aria-hidden="true" />
        <NotificationIcon n={n} />
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-3">
            <span title={n.title} className={`text-[0.8125rem] leading-snug line-clamp-2 ${unread ? 'font-semibold text-ink-900' : 'font-medium text-ink-800'}`}>{n.title}</span>
            <NotificationTimestamp iso={n.createdAt} className="mt-px" />
          </span>
          {n.message && (
            <span title={n.message} className={`mt-0.5 text-[0.75rem] leading-snug line-clamp-2 ${unread ? 'text-ink-600' : 'text-[var(--notification-muted-text)]'}`}>{n.message}</span>
          )}
        </span>
      </button>
    </motion.li>
  );
});

export default NotificationItem;
