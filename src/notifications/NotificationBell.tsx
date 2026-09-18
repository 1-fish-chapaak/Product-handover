import { forwardRef, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion, useAnimate } from 'motion/react';
import { Bell } from 'lucide-react';
import { BELL_ANCHOR_ATTR } from './NotificationPopover';

/** Compact count. Caps at 99+. */
export function NotificationBadge({ count, className = '' }: { count: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.span
          key="badge"
          initial={reduce ? false : { scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={reduce ? { opacity: 0 } : { scale: 0.6, opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.18, ease: [0.2, 0, 0, 1] }}
          className={`absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[0.625rem] font-semibold leading-none tabular-nums flex items-center justify-center ${className}`}
          aria-hidden="true"
        >
          {count > 99 ? '99+' : count}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

export interface NotificationBellProps {
  unreadCount: number;
  open: boolean;
  onClick: () => void;
  /** Sidebar chrome classes for the button and the badge (the bell lives on the dark rail). */
  className?: string;
  badgeClassName?: string;
  onMouseEnter?: () => void;
  onMouseDown?: (e: React.MouseEvent) => void;
}

/**
 * The bell. Announces "Notifications, 3 unread"; the count animates in once,
 * and the bell gives a single small tilt only when the count goes UP — a new
 * notification actually arrived. It never animates at rest.
 */
const NotificationBell = forwardRef<HTMLButtonElement, NotificationBellProps>(function NotificationBell({ unreadCount, open, onClick, className = '', badgeClassName = '', onMouseEnter, onMouseDown }, ref) {
  const reduce = useReducedMotion();
  const prev = useRef(unreadCount);
  const [scope, animate] = useAnimate();
  useEffect(() => {
    if (unreadCount > prev.current && !reduce && scope.current) {
      animate(scope.current, { rotate: [0, -12, 10, -6, 0] }, { duration: 0.5, ease: 'easeOut' });
    }
    prev.current = unreadCount;
  }, [unreadCount, reduce, animate, scope]);
  const label = unreadCount === 0 ? 'Notifications' : `Notifications, ${unreadCount} unread`;
  return (
    <button
      ref={ref}
      type="button"
      {...{ [BELL_ANCHOR_ATTR]: '' }}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseDown={onMouseDown}
      title={label}
      aria-label={label}
      aria-haspopup="dialog"
      aria-expanded={open}
      className={`relative shrink-0 w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-[background-color,color,transform] duration-150 active:scale-90 motion-reduce:active:scale-100 ${className}`}
    >
      <span ref={scope} style={{ transformOrigin: '50% 10%' }} className="inline-flex">
        <Bell size={17} strokeWidth={1.75} />
      </span>
      <NotificationBadge count={unreadCount} className={badgeClassName} />
    </button>
  );
});

export default NotificationBell;
