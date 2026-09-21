import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { CheckCheck, Clock3 } from 'lucide-react';
import { useNotifications } from './NotificationContext';
import { NotificationHeader, NotificationTabs, NotificationModuleFilter, type ModuleFilter } from './NotificationHeader';
import NotificationList from './NotificationList';
import { fmtIst } from './service';
import type { AppNotification } from './types';

/** The bell marks itself so the popover can sit beside it. */
export const BELL_ANCHOR_ATTR = 'data-notification-bell';

const MOBILE_MAX = 640;
const GAP = 10;
const VIEWPORT_PAD = 12;

function useIsMobile() {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < MOBILE_MAX);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_MAX - 1}px)`);
    const on = () => setMobile(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return mobile;
}

/** Where the panel goes: beside the bell, clamped to the viewport. Measured
 *  when the popover opens and again on resize (a DOM read, no stored state). */
function measureAnchor(): { top: number; left: number; maxHeight: number } {
  const bell = document.querySelector(`[${BELL_ANCHOR_ATTR}]`) as HTMLElement | null;
  const width = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--notification-width')) || 400;
  const vh = window.innerHeight, vw = window.innerWidth;
  const r = bell?.getBoundingClientRect();
  // Beside the sidebar bell (which lives on the left) — else top-right.
  let left = r ? r.right + GAP : vw - width - VIEWPORT_PAD;
  if (left + width > vw - VIEWPORT_PAD) left = Math.max(VIEWPORT_PAD, (r ? r.left : vw) - width - GAP);
  let top = r ? Math.max(VIEWPORT_PAD, r.top - 4) : VIEWPORT_PAD;
  const maxHeight = Math.min(640, vh - VIEWPORT_PAD * 2);
  if (top + maxHeight > vh - VIEWPORT_PAD) top = Math.max(VIEWPORT_PAD, vh - VIEWPORT_PAD - maxHeight);
  return { top, left, maxHeight };
}
function useAnchor(open: boolean, mobile: boolean) {
  const [pos, setPos] = useState<ReturnType<typeof measureAnchor> | null>(null);
  useEffect(() => {
    if (!open || mobile) return;
    // The bell moves: the sidebar hover-expands and collapses (a 280ms layout
    // animation), often in the same moment the popover opens. Follow it frame
    // by frame while open — one rect read per frame, a state write only when
    // it actually changed — so the panel is always beside the bell, never left
    // floating where the bell used to be.
    let raf = 0;
    let last = "";
    const tick = () => {
      const next = measureAnchor();
      const key = `${next.top}|${next.left}|${next.maxHeight}`;
      if (key !== last) { last = key; setPos(next); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open, mobile]);
  return pos;
}

/**
 * The notification centre — an anchored popover beside the bell on desktop,
 * a bottom sheet on small screens. Everything in it is for reading: what
 * happened, when, and one click to go there. Opening it marks nothing read;
 * opening a row does.
 */
export default function NotificationPopover({ onSelect }: { onSelect: (n: AppNotification) => void }) {
  const {
    notifications, unreadCount, drawerOpen, drawerTab, setDrawerTab, closeDrawer, markRead, markAllRead, releaseNow,
    setPrefsOpen, prefs, viewingEmail, prefsOpen,
  } = useNotifications();
  const reduce = useReducedMotion();
  const mobile = useIsMobile();
  const pos = useAnchor(drawerOpen, mobile);
  const panelRef = useRef<HTMLDivElement>(null);
  const [module, setModule] = useState<ModuleFilter>('all');

  // Delivered vs. still held for quiet hours (held ones are not in the list —
  // they have not happened for the user yet).
  const live = useMemo(() => notifications.filter(n => !n.scheduledFor).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)), [notifications]);
  const held = useMemo(() => notifications.filter(n => n.scheduledFor), [notifications]);
  const byTab = drawerTab === 'unread' ? live.filter(n => !n.read) : live;
  const items = module === 'all' ? byTab : byTab.filter(n => n.module === module);
  const moduleCounts = useMemo(() => {
    const c: Partial<Record<ModuleFilter, number>> = { all: byTab.length };
    byTab.forEach(n => { if (n.module) c[n.module] = (c[n.module] ?? 0) + 1; });
    return c;
  }, [byTab]);

  // Escape closes (unless a modal stacked above owns it); focus returns to the bell.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !viewingEmail && !prefsOpen) { e.stopPropagation(); closeDrawer(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen, viewingEmail, prefsOpen, closeDrawer]);
  useEffect(() => {
    if (drawerOpen) {
      // Move focus into the panel so screen readers announce it; the first row
      // is the next Tab stop.
      requestAnimationFrame(() => panelRef.current?.focus({ preventScroll: true }));
    } else {
      (document.querySelector(`[${BELL_ANCHOR_ATTR}]`) as HTMLElement | null)?.focus?.({ preventScroll: true });
    }
  }, [drawerOpen]);

  const open = (n: AppNotification) => { markRead(n.id); onSelect(n); };

  if (typeof document === 'undefined') return null;
  const dur = reduce ? 0 : 0.16;

  const body = (
    <>
      <motion.div initial={reduce ? false : { opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduce ? 0 : 0.18, delay: reduce ? 0 : 0.04, ease: [0.2, 0, 0, 1] }}>
      <NotificationHeader unreadCount={unreadCount} onPreferences={() => { closeDrawer(); setPrefsOpen(true); }} onClose={closeDrawer} showClose={mobile} />
      <NotificationTabs
        tab={drawerTab}
        unreadCount={unreadCount}
        onChange={setDrawerTab}
        filter={<NotificationModuleFilter value={module} counts={moduleCounts} onChange={setModule} />}
      />
      </motion.div>
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        {held.length > 0 && prefs.quietHours.enabled && (
          <div className="flex items-center gap-2 px-4 py-2 text-[0.6875rem] text-[var(--notification-muted-text)] border-b border-canvas-border">
            <Clock3 size={11} aria-hidden="true" />
            <span className="flex-1">{held.length} held for quiet hours · until {fmtIst(held[0].scheduledFor!)}</span>
            <button type="button" onClick={() => held.forEach(h => releaseNow(h.id))} className="font-medium text-ink-600 hover:text-ink-900 cursor-pointer">Show now</button>
          </div>
        )}
        {/* Keyed on the filter so All ↔ Unread (or a module change) stacks the
            rows in again, the same way the popover does on open. */}
        <NotificationList key={`${drawerTab}:${module}`} items={items} variant={drawerTab} filtered={module !== 'all'} onOpen={open} />
      </div>
      <div className="shrink-0 flex items-center justify-center border-t border-canvas-border px-4 py-2">
        <button
          type="button"
          onClick={markAllRead}
          disabled={unreadCount === 0}
          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[0.75rem] font-medium text-ink-600 hover:text-ink-900 hover:bg-[var(--notification-hover-background)] disabled:text-ink-300 disabled:hover:bg-transparent disabled:cursor-default cursor-pointer transition-colors"
        >
          <CheckCheck size={13} aria-hidden="true" /> Mark all as read
        </button>
      </div>
    </>
  );

  return createPortal(
    <AnimatePresence>
      {drawerOpen && (
        <div key="notification-popover" className="fixed inset-0 z-[var(--z-popover)]">
          {/* Click-away layer: dimmed only on the sheet, invisible under the popover. */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: dur }}
            className={`absolute inset-0 ${mobile ? 'bg-ink-900/30' : ''}`}
            onClick={closeDrawer}
            aria-hidden="true"
          />
          {mobile ? (
            <motion.div
              ref={panelRef}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-label="Notifications"
              initial={{ y: reduce ? 0 : 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: reduce ? 0 : 24, opacity: 0 }}
              transition={{ duration: reduce ? 0 : 0.2, ease: [0.2, 0, 0, 1] }}
              className="absolute inset-x-0 bottom-0 max-h-[88vh] flex flex-col bg-canvas-elevated border-t border-canvas-border rounded-t-xl shadow-[var(--notification-shadow)] outline-none pb-[env(safe-area-inset-bottom)]"
            >
              <span className="mx-auto mt-2 mb-1 h-1 w-9 rounded-full bg-canvas-border" aria-hidden="true" />
              {body}
            </motion.div>
          ) : pos && (
            <motion.div
              ref={panelRef}
              tabIndex={-1}
              role="dialog"
              aria-label="Notifications"
              // Unfolds from the bell: a soft spring on scale + a small slide out
              // of the corner it is anchored to, opacity leading so nothing
              // pops. Closing is a quick fade back into the corner.
              initial={{ opacity: 0, scale: reduce ? 1 : 0.94, x: reduce ? 0 : -8, y: reduce ? 0 : -6 }}
              animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, scale: reduce ? 1 : 0.97, x: reduce ? 0 : -4, y: reduce ? 0 : -3, transition: { duration: reduce ? 0 : 0.12, ease: [0.4, 0, 1, 1] } }}
              transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 560, damping: 40, mass: 0.7, opacity: { duration: 0.14 } }}
              style={{ top: pos.top, left: pos.left, maxHeight: pos.maxHeight, width: 'var(--notification-width)', transformOrigin: 'top left' }}
              className="absolute flex flex-col bg-canvas-elevated border border-canvas-border rounded-[var(--notification-radius)] shadow-[var(--notification-shadow)] outline-none overflow-hidden"
            >
              {body}
            </motion.div>
          )}
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
