import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Settings2, X, ChevronDown, Check } from 'lucide-react';
import { NOTIFICATION_MODULES, type NotificationModule } from './catalogue';

export type NotificationTab = 'all' | 'unread';
export type ModuleFilter = NotificationModule | 'all';

/** Short names for the chip — the row is narrow. */
const MODULE_SHORT: Record<NotificationModule, string> = {
  'Exceptions Management': 'Exceptions', 'ATR & Reports': 'Reports', 'Engagements': 'Engagements', 'Workflows & Data': 'Workflows', 'Dashboards': 'Dashboards',
};

/** One quiet dropdown: which part of the platform to listen to. */
export function NotificationModuleFilter({ value, counts, onChange }: {
  value: ModuleFilter;
  counts: Partial<Record<ModuleFilter, number>>;
  onChange: (m: ModuleFilter) => void;
}) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', onDown);
    return () => { document.removeEventListener('keydown', onKey, true); document.removeEventListener('mousedown', onDown); };
  }, [open]);
  const active = value !== 'all';
  return (
    <div ref={ref} className="relative ml-auto">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Filter by module: ${value === 'all' ? 'All modules' : value}`}
        className={`inline-flex items-center gap-1 h-7 pl-2 pr-1.5 rounded-md text-[0.75rem] font-medium whitespace-nowrap transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600/30 ${active || open ? 'text-brand-700 bg-brand-50' : 'text-ink-500 hover:text-ink-800 hover:bg-[var(--notification-hover-background)]'}`}
      >
        {value === 'all' ? 'All modules' : MODULE_SHORT[value]}
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            aria-label="Module"
            initial={{ opacity: 0, y: reduce ? 0 : -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduce ? 0 : -4 }}
            transition={{ duration: reduce ? 0 : 0.12 }}
            className="absolute right-0 top-full mt-1 w-[220px] z-20 rounded-md bg-canvas-elevated border border-canvas-border shadow-[var(--notification-shadow)] py-1"
          >
            {(['all', ...NOTIFICATION_MODULES] as ModuleFilter[]).map(m => {
              const on = value === m; const c = counts[m] ?? 0;
              return (
                <li key={m}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={on}
                    onClick={() => { onChange(m); setOpen(false); }}
                    className={`w-full flex items-center gap-2 px-3 h-8 text-[0.75rem] text-left cursor-pointer transition-colors ${on ? 'text-brand-700 font-semibold bg-brand-50/60' : 'text-ink-700 hover:bg-[var(--notification-hover-background)]'}`}
                  >
                    <span className="flex-1 truncate">{m === 'all' ? 'All modules' : m}</span>
                    <span className="tabular-nums text-[0.6875rem] text-ink-400">{c}</span>
                    {on && <Check size={12} aria-hidden="true" />}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Title, the unread count as plain words, and two quiet icon buttons. */
export function NotificationHeader({ unreadCount, onPreferences, onClose, showClose }: {
  unreadCount: number;
  onPreferences: () => void;
  onClose: () => void;
  /** The bottom sheet needs an explicit close; the anchored popover closes on click-away. */
  showClose: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-1">
      <div className="flex items-baseline gap-2 min-w-0">
        <h2 className="text-[0.9375rem] font-semibold text-ink-900 tracking-tight">Notifications</h2>
        <span className="text-[0.75rem] tabular-nums text-[var(--notification-muted-text)]" aria-live="polite">
          {unreadCount === 0 ? 'All caught up' : `${unreadCount} unread`}
        </span>
      </div>
      <div className="flex items-center gap-0.5 -mr-1.5">
        <button type="button" onClick={onPreferences} aria-label="Notification preferences" title="Preferences" className="w-8 h-8 rounded-md text-ink-400 hover:text-ink-800 hover:bg-[var(--notification-hover-background)] flex items-center justify-center cursor-pointer transition-colors">
          <Settings2 size={15} strokeWidth={1.75} />
        </button>
        {showClose && (
          <button type="button" onClick={onClose} aria-label="Close notifications" className="w-8 h-8 rounded-md text-ink-400 hover:text-ink-800 hover:bg-[var(--notification-hover-background)] flex items-center justify-center cursor-pointer transition-colors">
            <X size={16} strokeWidth={1.75} />
          </button>
        )}
      </div>
    </div>
  );
}

/** All | Unread — the only filter the inbox needs. */
export function NotificationTabs({ tab, unreadCount, onChange, filter }: {
  tab: NotificationTab;
  unreadCount: number;
  onChange: (t: NotificationTab) => void;
  /** The module dropdown, right-aligned on the same row. */
  filter?: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const tabs: { id: NotificationTab; label: string; count?: number }[] = [
    { id: 'all', label: 'All' },
    { id: 'unread', label: 'Unread', count: unreadCount },
  ];
  return (
    <div className="flex items-center gap-1 px-4 border-b border-canvas-border">
      <div role="tablist" aria-label="Filter notifications" className="flex items-center gap-1">
      {tabs.map(t => {
        const active = tab === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            onKeyDown={e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); onChange(t.id === 'all' ? 'unread' : 'all'); } }}
            className={`relative inline-flex items-center gap-1.5 h-9 px-2 -mb-px text-[0.8125rem] font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600/30 rounded-t-sm ${active ? 'text-ink-900' : 'text-ink-500 hover:text-ink-800'}`}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[0.625rem] font-semibold tabular-nums ${active ? 'bg-brand-600 text-white' : 'bg-paper-100 text-ink-600'}`}>{t.count > 99 ? '99+' : t.count}</span>
            )}
            {active && <motion.span layoutId="notif-tab-ink" transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 40 }} className="absolute left-2 right-2 bottom-0 h-[2px] rounded-full bg-brand-600" aria-hidden="true" />}
          </button>
        );
      })}
      </div>
      {filter}
    </div>
  );
}
