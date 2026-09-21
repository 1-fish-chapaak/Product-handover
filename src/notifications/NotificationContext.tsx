import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useCurrentUser } from '../context/CurrentUserContext';
import { useToast } from '../components/shared/Toast';
import type { NotificationActionState, PlatformNotification } from '../data/notifications';
import { decide } from './service';
import { eventById } from './catalogue';
import { DEFAULT_PREFERENCES, type AppNotification, type EmailMessage, type NotificationPreferences, type NotifyInput } from './types';
import { seedNotifications } from './seeds';

// ─── Persistence ───
// One store for everything the centre shows, so a delivery from another tab
// (Manage Exceptions opens in its own tab) is one `storage` event away.
const STORE_KEY = 'irame.notifications.v2';

interface Store {
  notifications: AppNotification[];
  emails: EmailMessage[];
  prefs: NotificationPreferences;
}

function load(): Store {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Store>;
      // Action Hub / Approval chains were folded into Exceptions Management.
      const fold = <T extends { module?: string }>(x: T): T => (x.module === 'Action Hub' || x.module === 'Approval chains' ? { ...x, module: 'Exceptions Management' } : x);
      return {
        notifications: Array.isArray(parsed.notifications) ? parsed.notifications.map(fold) : [],
        emails: Array.isArray(parsed.emails) ? parsed.emails.map(fold) : [],
        prefs: { ...DEFAULT_PREFERENCES, ...(parsed.prefs ?? {}), quietHours: { ...DEFAULT_PREFERENCES.quietHours, ...(parsed.prefs?.quietHours ?? {}) }, events: parsed.prefs?.events ?? {} },
      };
    }
  } catch { /* fall through to a fresh store */ }
  // First run: a realistic sample of the catalogue, so the centre reads as a
  // live system rather than an empty shell.
  const seeded = seedNotifications();
  return { notifications: seeded.notifications, emails: seeded.emails, prefs: DEFAULT_PREFERENCES };
}
function save(s: Store) { try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch { /* quota */ } }

// ─── Context ───

export interface NotificationContextValue {
  notifications: AppNotification[];
  emails: EmailMessage[];
  prefs: NotificationPreferences;
  unreadCount: number;
  /** Deliver an event. Returns the resulting notification id (or null if skipped). */
  notify: (input: NotifyInput) => string | null;
  markRead: (id: string) => void;
  markAllRead: () => void;
  setActionState: (id: string, state: NotificationActionState | undefined) => void;
  restore: (snapshot: PlatformNotification) => void;
  /** Release a quiet-hours-held notification now. */
  releaseNow: (id: string) => void;
  setPrefs: (updater: (p: NotificationPreferences) => NotificationPreferences) => void;
  resetPrefs: () => void;
  /** Popover + preferences visibility, shared so any surface can open them. */
  drawerOpen: boolean;
  openDrawer: (tab?: NotificationTab) => void;
  closeDrawer: () => void;
  drawerTab: NotificationTab;
  setDrawerTab: (t: NotificationTab) => void;
  prefsOpen: boolean;
  setPrefsOpen: (open: boolean) => void;
  /** The email open in the preview modal. */
  viewingEmail: EmailMessage | null;
  viewEmail: (e: EmailMessage | null) => void;
}

export type NotificationTab = 'all' | 'unread';

const Ctx = createContext<NotificationContextValue | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useNotifications(): NotificationContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useNotifications must be used within NotificationProvider');
  return v;
}
/** Trigger sites only need `notify`; this keeps them decoupled from the UI state.
 *  Returns a no-op outside the provider so isolated renders don't crash. */
// eslint-disable-next-line react-refresh/only-export-components
export function useNotify(): (input: NotifyInput) => string | null {
  const v = useContext(Ctx);
  return v ? v.notify : () => null;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<Store>(load);
  const storeRef = useRef(store);
  useEffect(() => { storeRef.current = store; save(store); }, [store]);
  const { currentUser } = useCurrentUser();
  const { addToast } = useToast();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<NotificationTab>('all');
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [viewingEmail, viewEmail] = useState<EmailMessage | null>(null);

  // Other tabs write the same store — take their version.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORE_KEY || !e.newValue) return;
      try { setStore(JSON.parse(e.newValue) as Store); } catch { /* half-written */ }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Release tick, once a minute: a notification whose quiet-hours hold has
  // passed becomes a normal delivery, and any queued email whose send time has
  // passed (quiet hours, or the hourly comment batch) is sent.
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      setStore(s => {
        const due = s.notifications.filter(n => n.scheduledFor && Date.parse(n.scheduledFor) <= now);
        const ids = new Set(due.map(n => n.id));
        const dueEmails = s.emails.filter(e => e.status === 'queued' && (ids.has(e.notificationId) || (e.scheduledFor && Date.parse(e.scheduledFor) <= now)));
        if (due.length === 0 && dueEmails.length === 0) return s;
        const emailIds = new Set(dueEmails.map(e => e.id));
        return {
          ...s,
          notifications: s.notifications.map(n => (ids.has(n.id) ? { ...n, scheduledFor: undefined, createdAt: new Date().toISOString() } : n)),
          emails: s.emails.map(e => (emailIds.has(e.id) ? { ...e, status: 'sent', sentAt: new Date().toISOString(), scheduledFor: undefined } : e)),
        };
      });
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const notify = useCallback((input: NotifyInput): string | null => {
    const def = eventById(input.eventId);
    if (!def) return null;
    const s = storeRef.current;
    const decision = decide(input, { prefs: s.prefs, existing: s.notifications, currentUserName: currentUser?.name ?? 'You' });
    if (decision.kind === 'skip') return null;
    if (decision.kind === 'suppress') {
      setStore(prev => ({ ...prev, notifications: prev.notifications.map(n => (n.id === decision.targetId ? { ...n, suppressed: (n.suppressed ?? 0) + 1 } : n)) }));
      return decision.targetId;
    }
    const next = decision.email ? { ...decision.next, emailId: decision.email.id } : decision.next;
    setStore(prev => {
      const replacedId = decision.kind === 'merge' ? decision.targetId : null;
      const notifications = replacedId
        ? [next, ...prev.notifications.filter(n => n.id !== replacedId)]
        : [next, ...prev.notifications];
      // A merge replaces the earlier email for the same rollup with the fuller one.
      const emails = decision.email
        ? [decision.email, ...prev.emails.filter(e => !replacedId || e.notificationId !== replacedId)]
        : prev.emails;
      return { ...prev, notifications, emails };
    });
    // Critical deliveries also surface as a transient toast while the app is
    // open — a heads-up only; the bell is where you go to act on it.
    if (!next.scheduledFor && def.priority === 'P0' && s.prefs.toastCritical) {
      addToast({ type: def.requiresAction ? 'warning' : 'info', title: next.title, message: next.message });
    }
    return next.id;
  }, [currentUser, addToast]);

  const markRead = useCallback((id: string) => setStore(s => ({ ...s, notifications: s.notifications.map(n => (n.id === id ? { ...n, read: true } : n)) })), []);
  const markAllRead = useCallback(() => setStore(s => ({ ...s, notifications: s.notifications.map(n => (n.read || n.scheduledFor ? n : { ...n, read: true })) })), []);
  const setActionState = useCallback((id: string, state: NotificationActionState | undefined) =>
    setStore(s => ({ ...s, notifications: s.notifications.map(n => (n.id === id ? { ...n, actionState: state, read: true } : n)) })), []);
  const restore = useCallback((snapshot: PlatformNotification) =>
    setStore(s => ({ ...s, notifications: s.notifications.map(n => (n.id === snapshot.id ? { ...n, ...snapshot } : n)) })), []);
  const releaseNow = useCallback((id: string) => setStore(s => ({
    ...s,
    notifications: s.notifications.map(n => (n.id === id ? { ...n, scheduledFor: undefined, createdAt: new Date().toISOString() } : n)),
    emails: s.emails.map(e => (e.notificationId === id ? { ...e, status: 'sent', sentAt: new Date().toISOString(), scheduledFor: undefined } : e)),
  })), []);
  const setPrefs = useCallback((updater: (p: NotificationPreferences) => NotificationPreferences) => setStore(s => ({ ...s, prefs: updater(s.prefs) })), []);
  const resetPrefs = useCallback(() => setStore(s => ({ ...s, prefs: DEFAULT_PREFERENCES })), []);
  const openDrawer = useCallback((tab?: NotificationTab) => { if (tab) setDrawerTab(tab); setDrawerOpen(true); }, []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const unreadCount = useMemo(() => store.notifications.filter(n => !n.read && !n.scheduledFor).length, [store.notifications]);

  const value = useMemo<NotificationContextValue>(() => ({
    notifications: store.notifications, emails: store.emails, prefs: store.prefs, unreadCount,
    notify, markRead, markAllRead, setActionState, restore, releaseNow, setPrefs, resetPrefs,
    drawerOpen, openDrawer, closeDrawer, drawerTab, setDrawerTab, prefsOpen, setPrefsOpen, viewingEmail, viewEmail,
  }), [store, unreadCount, notify, markRead, markAllRead, setActionState, restore, releaseNow, setPrefs, resetPrefs, drawerOpen, openDrawer, closeDrawer, drawerTab, prefsOpen, viewingEmail]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
