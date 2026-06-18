import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { LucideIcon } from 'lucide-react';
import { BellOff, X, CheckCheck, ChevronDown, ListFilter, Inbox, Zap, Mail, Check } from 'lucide-react';
import type {
  PlatformNotification,
  NotificationCategory,
  NotificationAction,
  NotificationActionState,
} from '../../data/notifications';
import { dayBucket, type DayBucket } from '../../utils/timeAgo';
import NotificationRow from './NotificationRow';
import { useToast } from '../shared/Toast';

type PrimaryFilter = 'all' | 'action' | 'unread';
type CategoryFilter = 'all' | NotificationCategory;

// Filter selection persists per-tab via sessionStorage. Reopening the
// drawer (or doing a soft reload) keeps the user on the filter they were
// using; closing the tab clears the choice (sessionStorage scope).
const PRIMARY_KEY  = 'irame.notif.primary';
const CATEGORY_KEY = 'irame.notif.category';

function readSession<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const v = window.sessionStorage.getItem(key);
    return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
  } catch { return fallback; }
}

function writeSession(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try { window.sessionStorage.setItem(key, value); } catch { /* ignore */ }
}

const PRIMARY_VALUES:  readonly PrimaryFilter[]  = ['all', 'action', 'unread'];
const CATEGORY_VALUES: readonly CategoryFilter[] = ['all', 'exception', 'workflow', 'engagement', 'report'];

// Order: Unread first (most common entry point), Action in the middle
// (the actionable subset users drill into), All last (full view as a
// fallback). Unread is also the default selection when the drawer opens
// fresh.
const PRIMARY_FILTERS: { id: PrimaryFilter; label: string; icon: LucideIcon }[] = [
  { id: 'unread', label: 'Unread',  icon: Mail },
  { id: 'action', label: 'Action',  icon: Zap },
  { id: 'all',    label: 'All',     icon: Inbox },
];

const CATEGORY_FILTERS: { id: CategoryFilter; label: string }[] = [
  { id: 'all',        label: 'All' },
  { id: 'exception',  label: 'Exceptions' },
  { id: 'workflow',   label: 'Workflows' },
  { id: 'engagement', label: 'Engagement' },
  { id: 'report',     label: 'Reports' },
];

const BUCKET_ORDER: DayBucket[] = ['Today', 'Yesterday', 'Earlier'];

interface NotificationDrawerProps {
  notifications: PlatformNotification[];
  onClose: () => void;
  onSelect: (n: PlatformNotification) => void;
  onMarkAllRead: () => void;
  onSetActionState: (id: string, state: NotificationActionState | undefined) => void;
  onRestore: (snapshot: PlatformNotification) => void;
}

export default function NotificationDrawer({
  notifications,
  onClose,
  onSelect,
  onMarkAllRead,
  onSetActionState,
  onRestore,
}: NotificationDrawerProps) {
  const [primaryFilter, setPrimaryFilterState] = useState<PrimaryFilter>(
    () => readSession(PRIMARY_KEY, PRIMARY_VALUES, 'unread'),
  );
  const [categoryFilter, setCategoryFilterState] = useState<CategoryFilter>(
    () => readSession(CATEGORY_KEY, CATEGORY_VALUES, 'all'),
  );
  const setPrimaryFilter = (v: PrimaryFilter) => {
    setPrimaryFilterState(v);
    writeSession(PRIMARY_KEY, v);
  };
  const setCategoryFilter = (v: CategoryFilter) => {
    setCategoryFilterState(v);
    writeSession(CATEGORY_KEY, v);
  };

  const [categoryOpen, setCategoryOpen] = useState(false);
  const filterDropdownRef = useRef<HTMLDivElement>(null);

  const { addToast } = useToast();

  // Esc closes the dropdown if open, otherwise the drawer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (categoryOpen) { setCategoryOpen(false); return; }
      onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, categoryOpen]);

  // Click-outside closes the filter dropdown
  useEffect(() => {
    if (!categoryOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target as Node)) {
        setCategoryOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [categoryOpen]);

  // Apply primary filter first; category counts are computed against the
  // primary-filtered slice so the numbers reflect "how many in this category
  // match my current status filter."
  const primaryFiltered = useMemo(() => {
    if (primaryFilter === 'unread') return notifications.filter(n => !n.read);
    if (primaryFilter === 'action') return notifications.filter(n => n.requiresAction && !n.actionState);
    return notifications;
  }, [notifications, primaryFilter]);

  const counts = useMemo(() => {
    const primary = {
      all:    notifications.length,
      action: notifications.filter(n => n.requiresAction && !n.actionState).length,
      unread: notifications.filter(n => !n.read).length,
    };
    const byCat: Record<NotificationCategory, number> = {
      exception: 0, workflow: 0, engagement: 0, report: 0,
    };
    for (const n of primaryFiltered) byCat[n.category]++;
    const category = { all: primaryFiltered.length, ...byCat };
    return { primary, category };
  }, [notifications, primaryFiltered]);

  const visible = useMemo(() => {
    const filtered = categoryFilter === 'all'
      ? primaryFiltered
      : primaryFiltered.filter(n => n.category === categoryFilter);
    return [...filtered].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [primaryFiltered, categoryFilter]);

  const grouped = useMemo(() => {
    const buckets: Record<DayBucket, PlatformNotification[]> = {
      Today: [], Yesterday: [], Earlier: [],
    };
    for (const n of visible) buckets[dayBucket(n.createdAt)].push(n);
    return BUCKET_ORDER
      .map(label => ({ label, items: buckets[label] }))
      .filter(g => g.items.length > 0);
  }, [visible]);

  // Action handler — fires on Accept / Decline / Comment. Sets the
  // notification's actionState so the row swaps to a confirmation pill,
  // then surfaces a toast with Undo that restores the prior snapshot.
  const handleRowAction = (notif: PlatformNotification, action: NotificationAction, text?: string) => {
    const snapshot = notif;
    const newState: NotificationActionState = {
      type: action,
      takenAt: new Date().toISOString(),
      ...(text ? { comment: text } : {}),
    };
    onSetActionState(notif.id, newState);
    addToast({
      type: action === 'accept' ? 'success' : 'info',
      message:
        action === 'accept'  ? `Accepted: ${notif.title}` :
        action === 'decline' ? `Declined: ${notif.title}` :
        `Comment added on “${notif.title}”`,
      action: { label: 'Undo', onClick: () => onRestore(snapshot) },
    });
  };

  const handleClearActionState = (notif: PlatformNotification) => {
    onSetActionState(notif.id, undefined);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] z-40"
        onClick={onClose}
      />
      <motion.aside
        initial={{ x: 24, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 24, opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
        className="fixed top-0 right-0 bottom-0 w-full max-w-[440px] bg-canvas-elevated shadow-xl border-l border-canvas-border flex flex-col z-50"
        role="dialog"
        aria-label="Notifications"
      >
        {/* Header */}
        <header className="shrink-0 px-6 h-14 flex items-center justify-between gap-4 border-b border-canvas-border">
          <h2 className="font-display text-[1.125rem] font-semibold text-ink-900 tracking-tight">Notifications</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={onMarkAllRead}
              disabled={counts.primary.unread === 0}
              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[0.75rem] font-medium text-ink-600 hover:text-brand-700 hover:bg-[#F4F2F7] disabled:text-ink-300 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Mark all as read"
            >
              <CheckCheck size={14} />
              Mark all read
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        {/* Primary filter row — All / Action / Unread, plus the Filters
            dropdown for category sub-filtering on the right. */}
        <div className="shrink-0 px-4 border-b border-canvas-border flex items-center justify-between gap-3">
          <div className="flex items-center">
            {PRIMARY_FILTERS.map(tab => {
              const Icon = tab.icon;
              const active = primaryFilter === tab.id;
              const count = counts.primary[tab.id];
              return (
                <button
                  key={tab.id}
                  onClick={() => { setPrimaryFilter(tab.id); setCategoryFilter('all'); }}
                  className={`relative inline-flex items-center gap-1.5 px-3 h-11 text-[0.8125rem] font-medium transition-colors cursor-pointer whitespace-nowrap
                    ${active ? 'text-brand-700' : 'text-ink-500 hover:text-ink-700'}
                  `}
                >
                  <Icon size={14} />
                  {tab.label}
                  <span className={`tabular-nums text-[0.6875rem] font-semibold ${
                    active ? 'text-brand-600' : 'text-ink-400'
                  }`}>
                    {count}
                  </span>
                  {active && (
                    <motion.div
                      layoutId="notif-primary-tab-bar"
                      className="absolute left-0 right-0 -bottom-px h-[2px] bg-brand-600"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div className="relative" ref={filterDropdownRef}>
            <button
              onClick={() => setCategoryOpen(o => !o)}
              className={`relative inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[0.75rem] font-medium border transition-colors cursor-pointer shrink-0
                ${categoryOpen
                  ? 'bg-brand-50 text-brand-700 border-brand-200'
                  : categoryFilter !== 'all'
                    ? 'bg-brand-50 text-brand-700 border-brand-100 hover:bg-brand-100'
                    : 'bg-canvas-elevated text-ink-600 border-canvas-border hover:border-brand-200'}
              `}
              aria-expanded={categoryOpen}
              aria-haspopup="menu"
            >
              <ListFilter size={13.5} />
              Filters
              {categoryFilter !== 'all' && (
                <span className="text-[0.625rem] font-semibold tabular-nums min-w-[16px] h-[16px] px-[4px] rounded-full bg-brand-600 text-white flex items-center justify-center leading-none">
                  1
                </span>
              )}
              <ChevronDown
                size={13}
                className={`transition-transform duration-150 ${categoryOpen ? 'rotate-180' : ''} -ml-0.5`}
              />
            </button>

            <AnimatePresence>
              {categoryOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={{ duration: 0.12, ease: [0.22, 0.68, 0, 1] }}
                  className="absolute top-full right-0 mt-1.5 w-[220px] z-50 origin-top-right rounded-lg bg-canvas-elevated border border-canvas-border overflow-hidden"
                  style={{ boxShadow: '0 12px 32px rgb(15 8 30 / 0.14), 0 2px 6px rgb(15 8 30 / 0.06)' }}
                  role="menu"
                  aria-label="Filter by category"
                >
                  <div className="px-2 pt-2 pb-1">
                    <span className="text-[0.75rem] font-semibold uppercase tracking-wider text-ink-500 px-1">Category</span>
                  </div>
                  <div className="py-1">
                    {CATEGORY_FILTERS.map(tab => {
                      const count = counts.category[tab.id];
                      const active = categoryFilter === tab.id;
                      const disabled = tab.id !== 'all' && count === 0;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => { setCategoryFilter(tab.id); setCategoryOpen(false); }}
                          disabled={disabled}
                          role="menuitemradio"
                          aria-checked={active}
                          className={`w-full flex items-center justify-between gap-2 pl-2 pr-3 h-8 text-[0.75rem] font-medium text-left transition-colors cursor-pointer
                            ${active
                              ? 'bg-brand-50 text-brand-700'
                              : disabled
                                ? 'text-ink-300 cursor-not-allowed'
                                : 'text-ink-700 hover:bg-[#F4F2F7]'}
                          `}
                        >
                          <span className="flex items-center gap-1.5 min-w-0">
                            {active
                              ? <Check size={13} className="text-brand-700 shrink-0" />
                              : <span className="w-[13px] shrink-0" />}
                            <span className="truncate">{tab.label}</span>
                          </span>
                          <span className={`tabular-nums text-[0.6875rem] font-semibold shrink-0 ${
                            active ? 'text-brand-600' : disabled ? 'text-ink-300' : 'text-ink-400'
                          }`}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {grouped.length === 0 ? (
            <EmptyState primary={primaryFilter} category={categoryFilter} />
          ) : (
            grouped.map(group => (
              <section key={group.label}>
                <div className="sticky top-0 z-10 bg-canvas-elevated/95 backdrop-blur-sm px-6 pt-4 pb-2 flex items-center justify-between">
                  <span className="text-[0.75rem] font-semibold tracking-tight text-ink-700">{group.label}</span>
                  <span className="text-[0.6875rem] text-ink-400 tabular-nums">
                    {group.items.length} {group.items.length === 1 ? 'event' : 'events'}
                  </span>
                </div>
                <AnimatePresence initial={false} mode="popLayout">
                  {group.items.map(n => (
                    <motion.div
                      key={n.id}
                      layout
                      initial={false}
                      exit={{
                        opacity: 0,
                        height: 0,
                        transition: { duration: 0.18, ease: [0.22, 0.68, 0, 1] },
                      }}
                      className="overflow-hidden"
                    >
                      <NotificationRow
                        notification={n}
                        onClick={onSelect}
                        showActions={primaryFilter === 'action'}
                        onAction={handleRowAction}
                        onClearActionState={handleClearActionState}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </section>
            ))
          )}
        </div>

        <footer className="shrink-0 px-6 py-3 border-t border-canvas-border text-right text-[0.75rem] text-ink-500 tabular-nums">
          {counts.primary.unread > 0
            ? `${counts.primary.unread} unread · ${counts.primary.all} total`
            : `${counts.primary.all} total`}
        </footer>
      </motion.aside>
    </>
  );
}

function EmptyState({ primary, category }: { primary: PrimaryFilter; category: CategoryFilter }) {
  const primaryLabel =
    primary === 'action' ? 'items needing action'
  : primary === 'unread' ? 'unread notifications'
  : 'notifications yet';
  const categoryLabel = category === 'all' ? '' : ` in ${category}s`;
  const subtitle =
    primary === 'action'   ? "You're all caught up — nothing needs your attention right now." :
    primary === 'unread'   ? 'No unread events match this filter.' :
    'New events from across the platform will appear here.';
  return (
    <div className="text-center py-20 px-6">
      <BellOff size={28} className="mx-auto text-ink-400 mb-3" />
      <p className="text-[0.875rem] text-ink-700 font-medium">No {primaryLabel}{categoryLabel}.</p>
      <p className="text-[0.75rem] text-ink-500 mt-1">{subtitle}</p>
    </div>
  );
}
