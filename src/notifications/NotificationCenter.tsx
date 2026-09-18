import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, CheckCheck, Settings2, Inbox, Zap, Mail, Layers, Clock3, BellOff, ChevronDown, Check, ListFilter } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { dayBucket, type DayBucket } from '../utils/timeAgo';
import { useToast } from '../components/shared/Toast';
import { useCurrentUser } from '../context/CurrentUserContext';
import type { NotificationAction, NotificationActionState } from '../data/notifications';
import { NOTIFICATION_MODULES, type NotificationModule } from './catalogue';
import { useNotifications } from './NotificationContext';
import NotificationCard, { PriorityPill } from './NotificationCard';
import { MODULE_ICON } from './tokens';
import { fmtIst, fmtIstDate } from './service';
import type { AppNotification, EmailMessage } from './types';

type Tab = 'inbox' | 'action' | 'all' | 'emails';
const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'action', label: 'Action', icon: Zap },
  { id: 'all', label: 'All', icon: Layers },
  { id: 'emails', label: 'Emails', icon: Mail },
];
/** Compact labels for the selected-module chip — the tab row is only ~500px wide. */
const MODULE_SHORT: Record<NotificationModule, string> = { 'Exceptions Management': 'Exceptions', 'ATR & Reports': 'ATR & Reports', 'Engagements': 'Engagements', 'Workflows & Data': 'Workflows', 'Dashboards': 'Dashboards' };
const BUCKETS: DayBucket[] = ['Today', 'Yesterday', 'Earlier'];

export default function NotificationCenter({ onSelect }: { onSelect: (n: AppNotification) => void }) {
  const {
    notifications, emails, prefs, unreadCount, drawerTab, setDrawerTab, closeDrawer, markAllRead, markRead,
    setActionState, restore, releaseNow, setPrefsOpen, viewEmail, viewingEmail, prefsOpen,
  } = useNotifications();
  const { currentUser } = useCurrentUser();
  const me = currentUser?.name ?? 'You';
  const { addToast } = useToast();
  const [module, setModule] = useState<NotificationModule | 'all'>('all');
  const [moduleOpen, setModuleOpen] = useState(false);

  useEffect(() => {
    // A modal stacked above the drawer (email preview, preferences) owns Escape.
    const onKey = (e: KeyboardEvent) => { if (e.key !== 'Escape' || viewingEmail || prefsOpen) return; if (moduleOpen) setModuleOpen(false); else closeDrawer(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [closeDrawer, moduleOpen, viewingEmail, prefsOpen]);

  const held = useMemo(() => notifications.filter(n => n.scheduledFor).sort((a, b) => Date.parse(a.scheduledFor!) - Date.parse(b.scheduledFor!)), [notifications]);
  const live = useMemo(() => notifications.filter(n => !n.scheduledFor), [notifications]);

  const byTab = useMemo(() => ({
    inbox: live.filter(n => !n.read),
    action: live.filter(n => n.requiresAction && !n.actionState),
    all: live,
  }), [live]);
  const counts = { inbox: byTab.inbox.length, action: byTab.action.length, all: byTab.all.length, emails: emails.length };

  const filtered = useMemo(() => {
    const src = drawerTab === 'emails' ? [] : byTab[drawerTab];
    return src
      .filter(n => module === 'all' || n.module === module)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }, [byTab, drawerTab, module]);
  const grouped = useMemo(() => {
    const b: Record<DayBucket, AppNotification[]> = { Today: [], Yesterday: [], Earlier: [] };
    filtered.forEach(n => b[dayBucket(n.createdAt)].push(n));
    return BUCKETS.map(label => ({ label, items: b[label] })).filter(g => g.items.length > 0);
  }, [filtered]);
  const emailList = useMemo(() => emails
    .filter(e => module === 'all' || e.module === module)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)), [emails, module]);
  const moduleCounts = useMemo(() => {
    const src = drawerTab === 'emails' ? emails : byTab[drawerTab];
    const m = new Map<string, number>();
    src.forEach(x => { if (x.module) m.set(x.module, (m.get(x.module) ?? 0) + 1); });
    return m;
  }, [byTab, drawerTab, emails]);

  const open = (n: AppNotification) => { markRead(n.id); onSelect(n); };
  const openEmail = (n: AppNotification) => { const e = emails.find(x => x.id === n.emailId); if (e) viewEmail(e); };
  const act = (n: AppNotification, action: NotificationAction, text?: string) => {
    const snapshot = n;
    const state: NotificationActionState = { type: action, takenAt: new Date().toISOString(), ...(text ? { comment: text } : {}) };
    setActionState(n.id, state);
    addToast({ type: action === 'accept' ? 'success' : 'info', message: action === 'accept' ? `Approved: ${n.title}` : action === 'decline' ? `Rejected: ${n.title}` : `Comment posted on “${n.title}”`, action: { label: 'Undo', onClick: () => restore(snapshot) } });
  };

  const quiet = prefs.quietHours;

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] z-40" onClick={closeDrawer} />
      <motion.aside
        initial={{ x: 24, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 24, opacity: 0 }} transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
        className="fixed top-0 right-0 bottom-0 w-full max-w-[540px] bg-canvas-elevated shadow-xl border-l border-canvas-border flex flex-col z-50"
        role="dialog" aria-label="Notifications"
      >
        {/* Header */}
        <header className="shrink-0 px-5 pt-4 pb-3 border-b border-canvas-border">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <span className="relative w-9 h-9 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
                <Bell size={16} aria-hidden="true" />
                {unreadCount > 0 && <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-600 text-white text-[0.625rem] font-bold tabular-nums flex items-center justify-center ring-2 ring-canvas-elevated">{unreadCount > 99 ? '99+' : unreadCount}</span>}
              </span>
              <div className="min-w-0">
                <h2 className="text-[1.0625rem] font-semibold text-ink-900 tracking-tight leading-tight">Notifications</h2>
                <p className="text-[0.71875rem] text-ink-500 mt-0.5 leading-snug">
                  {unreadCount === 0 ? 'You’re all caught up.' : `${unreadCount} unread`}
                  {quiet.enabled && <> · quiet hours {quiet.start}–{quiet.end} IST{held.length ? ` · ${held.length} held` : ''}</>}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={markAllRead} disabled={counts.inbox === 0} title="Mark all as read" className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[0.75rem] font-medium text-ink-600 hover:text-brand-700 hover:bg-canvas disabled:text-ink-300 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors cursor-pointer"><CheckCheck size={14} /> Mark all read</button>
              <button onClick={() => setPrefsOpen(true)} title="Notification preferences" aria-label="Notification preferences" className="w-8 h-8 rounded-md text-ink-500 hover:text-brand-700 hover:bg-canvas flex items-center justify-center cursor-pointer"><Settings2 size={15} /></button>
              <button onClick={closeDrawer} aria-label="Close" className="w-8 h-8 rounded-md text-ink-500 hover:text-ink-800 hover:bg-canvas flex items-center justify-center cursor-pointer"><X size={16} /></button>
            </div>
          </div>

          {/* Tabs — module filter sits on the same row, right-aligned */}
          <div className="mt-3 -mb-3 flex items-center min-w-0">
            {TABS.map(t => {
              const Icon = t.icon; const active = drawerTab === t.id; const c = counts[t.id];
              return (
                <button key={t.id} onClick={() => setDrawerTab(t.id)} className={`relative shrink-0 inline-flex items-center gap-1.5 h-10 px-2 text-[0.8125rem] font-semibold whitespace-nowrap transition-colors cursor-pointer ${active ? 'text-brand-700' : 'text-ink-500 hover:text-ink-800'}`}>
                  <Icon size={14} aria-hidden="true" /> {t.label}
                  <span className={`tabular-nums text-[0.6875rem] font-semibold ${active ? 'text-brand-600' : 'text-ink-400'}`}>{c}</span>
                  {active && <motion.span layoutId="notif-center-tab" className="absolute left-2 right-2 -bottom-px h-[2px] rounded-full bg-brand-600" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />}
                </button>
              );
            })}
            <div className="ml-auto pl-2 min-w-0 self-center">
              <div className="relative">
                <button onClick={() => setModuleOpen(o => !o)} aria-haspopup="menu" aria-expanded={moduleOpen} className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[0.75rem] font-medium border whitespace-nowrap transition-colors cursor-pointer ${module !== 'all' || moduleOpen ? 'bg-brand-50 text-brand-700 border-brand-200' : 'bg-canvas-elevated text-ink-600 border-canvas-border hover:border-brand-200'}`}>
                  <ListFilter size={13} className="shrink-0" aria-hidden="true" /><span className="truncate max-w-[110px]">{module === 'all' ? 'All modules' : MODULE_SHORT[module]}</span>
                  <ChevronDown size={12} className={`shrink-0 transition-transform ${moduleOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                </button>
                <AnimatePresence>
                  {moduleOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setModuleOpen(false)} />
                      <motion.div role="menu" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.12 }} className="absolute right-0 top-full mt-1.5 w-[260px] z-20 rounded-lg bg-canvas-elevated border border-canvas-border shadow-xl overflow-hidden py-1">
                        {(['all', ...NOTIFICATION_MODULES] as const).map(m => {
                          const Icon = m === 'all' ? Layers : MODULE_ICON[m]; const active = module === m; const c = m === 'all' ? (drawerTab === 'emails' ? emails.length : byTab[drawerTab].length) : (moduleCounts.get(m) ?? 0);
                          return (
                            <button key={m} role="menuitemradio" aria-checked={active} onClick={() => { setModule(m); setModuleOpen(false); }} className={`w-full flex items-center gap-2 px-3 h-8 text-[0.75rem] text-left cursor-pointer ${active ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-ink-700 hover:bg-canvas'}`}>
                              <Icon size={13} className="shrink-0 text-ink-400" aria-hidden="true" /><span className="flex-1 truncate">{m === 'all' ? 'All modules' : m}</span>
                              <span className="tabular-nums text-[0.6875rem] text-ink-400">{c}</span>{active && <Check size={12} aria-hidden="true" />}
                            </button>
                          );
                        })}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {drawerTab === 'emails' ? (
            emailList.length === 0 ? <Empty icon={Mail} title="No emails yet" body="Emails sent by the notification service appear here, so you can see exactly what left the platform." />
            : <ul>{emailList.map(e => <EmailRow key={e.id} e={e} me={me} onOpen={() => viewEmail(e)} />)}</ul>
          ) : (
            <>
              {held.length > 0 && drawerTab !== 'action' && (
                <section>
                  <div className="sticky top-0 z-10 bg-canvas-elevated/95 backdrop-blur-sm px-5 pt-3 pb-1.5 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-[0.75rem] font-semibold text-mitigated-700"><Clock3 size={12} aria-hidden="true" /> Held for quiet hours</span>
                    <span className="text-[0.6875rem] text-ink-400 tabular-nums">{held.length}</span>
                  </div>
                  {held.map(n => <NotificationCard key={n.id} n={n} currentUserName={me} onOpen={open} onViewEmail={openEmail} onReleaseNow={x => releaseNow(x.id)} />)}
                </section>
              )}
              {grouped.length === 0 ? (
                <Empty icon={drawerTab === 'action' ? Zap : BellOff} title={drawerTab === 'inbox' ? 'Inbox zero' : drawerTab === 'action' ? 'Nothing needs your decision' : 'No notifications'} body={drawerTab === 'inbox' ? 'New events from across the platform land here the moment they happen.' : drawerTab === 'action' ? 'Approvals, assignments and rejections that need you will show up here.' : 'Adjust the filters or wait for the next event.'} />
              ) : grouped.map(g => (
                <section key={g.label}>
                  <div className="sticky top-0 z-10 bg-canvas-elevated/95 backdrop-blur-sm px-5 pt-3 pb-1.5 flex items-center justify-between">
                    <span className="text-[0.75rem] font-semibold text-ink-700">{g.label}</span>
                    <span className="text-[0.6875rem] text-ink-400 tabular-nums">{g.items.length} {g.items.length === 1 ? 'event' : 'events'}</span>
                  </div>
                  <AnimatePresence initial={false} mode="popLayout">
                    {g.items.map(n => (
                      <motion.div key={n.id} layout initial={false} exit={{ opacity: 0, height: 0, transition: { duration: 0.18 } }} className="overflow-hidden">
                        <NotificationCard n={n} currentUserName={me} onOpen={open} onViewEmail={openEmail} onAction={act} onClearActionState={x => setActionState(x.id, undefined)} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </section>
              ))}
            </>
          )}
        </div>

        <footer className="shrink-0 px-5 py-2.5 border-t border-canvas-border flex items-center justify-between text-[0.6875rem] text-ink-500">
          <span className="tabular-nums">{counts.all} notifications · {emails.length} emails</span>
          <button onClick={() => setPrefsOpen(true)} className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline cursor-pointer"><Settings2 size={11} aria-hidden="true" /> Preferences</button>
        </footer>
      </motion.aside>
    </>
  );
}

function EmailRow({ e, me, onOpen }: { e: EmailMessage; me: string; onOpen: () => void }) {
  const Icon = MODULE_ICON[e.module] ?? Mail;
  const toMe = e.to.some(p => p.name === me);
  return (
    <li className="border-b border-canvas-border">
      <button type="button" onClick={onOpen} className="w-full text-left px-5 py-3.5 hover:bg-canvas transition-colors cursor-pointer">
        <div className="flex items-start gap-3">
          <span className="w-8 h-8 rounded-md bg-paper-100 text-ink-600 flex items-center justify-center shrink-0 mt-0.5"><Icon size={15} aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[0.8125rem] font-semibold text-ink-900 leading-snug truncate">{e.subject}</p>
              <span className="shrink-0 text-[0.6875rem] text-ink-400 tabular-nums whitespace-nowrap">{fmtIstDate(e.sentAt ?? e.scheduledFor ?? e.createdAt)}</span>
            </div>
            <p className="mt-0.5 text-[0.75rem] text-ink-500 truncate">{e.preheader}</p>
            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap text-[0.6875rem] text-ink-500">
              <span className="font-mono text-[0.625rem] font-semibold text-ink-600 bg-paper-100 rounded-sm px-1.5 h-[18px] inline-flex items-center">{e.eventId}</span>
              <PriorityPill p={e.priority} compact />
              <span>To {toMe ? 'you' : e.to.map(p => p.name.split(' ')[0]).join(', ')}{e.cc.length ? ` · CC ${e.cc.length}` : ''}</span>
              <span className={`ml-auto inline-flex items-center gap-1 font-semibold ${e.status === 'sent' ? 'text-compliant-700' : 'text-mitigated-700'}`}>
                {e.status === 'sent' ? <><Check size={11} aria-hidden="true" /> Sent</> : <><Clock3 size={11} aria-hidden="true" /> Queued · {fmtIst(e.scheduledFor!)}</>}
              </span>
            </div>
          </div>
        </div>
      </button>
    </li>
  );
}

function Empty({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <div className="text-center py-20 px-8">
      <span className="mx-auto w-11 h-11 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center mb-3"><Icon size={20} aria-hidden="true" /></span>
      <p className="text-[0.875rem] font-semibold text-ink-800">{title}</p>
      <p className="text-[0.75rem] text-ink-500 mt-1 leading-relaxed">{body}</p>
    </div>
  );
}
