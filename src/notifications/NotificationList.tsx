import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import NotificationItem from './NotificationItem';
import NotificationEmptyState from './NotificationEmptyState';
import type { AppNotification } from './types';

/**
 * The scrolling list. Owns roving keyboard focus (↑/↓ between rows, Home/End)
 * so the popover stays one tab stop wide; rows animate in on arrival and
 * collapse out when they leave the current filter.
 */
export default function NotificationList({ items, variant, filtered = false, onOpen, autoFocus = false }: {
  items: AppNotification[];
  variant: 'all' | 'unread';
  /** A module filter is narrowing the list. */
  filtered?: boolean;
  onOpen: (n: AppNotification) => void;
  /** Focus the first row when the list mounts (popover just opened via keyboard). */
  autoFocus?: boolean;
}) {
  // The list mounts with the popover (and remounts on a tab / module change):
  // rows stack in one by one for the opening beat, then the choreography is
  // switched off so later arrivals simply fade in.
  const [stacking, setStacking] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setStacking(false), 700);
    return () => window.clearTimeout(t);
  }, []);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const [focusIdx, setFocusIdx] = useState(0);
  // The tabbable row — clamped so a shrinking list never strands it.
  const tabbable = Math.max(0, Math.min(focusIdx, items.length - 1));

  const focusAt = useCallback((i: number) => {
    const max = items.length - 1;
    if (max < 0) return;
    const next = Math.max(0, Math.min(max, i));
    setFocusIdx(next);
    refs.current[next]?.focus();
  }, [items.length]);

  useEffect(() => { if (autoFocus) refs.current[0]?.focus(); }, [autoFocus]);

  if (items.length === 0) return <NotificationEmptyState variant={filtered ? 'filtered' : variant} />;

  return (
    <ul
      role="list"
      aria-label={variant === 'unread' ? 'Unread notifications' : 'All notifications'}
      className="py-1"
      onKeyDown={e => {
        if (e.key === 'Home') { e.preventDefault(); focusAt(0); }
        else if (e.key === 'End') { e.preventDefault(); focusAt(items.length - 1); }
      }}
    >
      <AnimatePresence initial={stacking} mode="popLayout">
        {items.map((n, i) => (
          <NotificationItem
            key={n.id}
            ref={el => { refs.current[i] = el; }}
            n={n}
            onOpen={onOpen}
            tabIndex={i === tabbable ? 0 : -1}
            stackIndex={stacking ? i : undefined}
            onKeyNav={dir => focusAt(i + dir)}
          />
        ))}
      </AnimatePresence>
    </ul>
  );
}
