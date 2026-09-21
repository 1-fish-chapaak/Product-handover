import { BellOff, Check, ListFilter } from 'lucide-react';

/** Calm, not apologetic: nothing is wrong when there is nothing to read. */
export default function NotificationEmptyState({ variant }: { variant: 'all' | 'unread' | 'filtered' }) {
  const Icon = variant === 'unread' ? Check : variant === 'filtered' ? ListFilter : BellOff;
  return (
    <div className="flex flex-col items-center justify-center text-center px-8 py-14">
      <span className="w-9 h-9 rounded-full bg-paper-100 text-ink-500 flex items-center justify-center mb-3" aria-hidden="true"><Icon size={16} strokeWidth={1.75} /></span>
      <p className="text-[0.8125rem] font-semibold text-ink-800">{variant === 'unread' ? 'You’re all caught up' : variant === 'filtered' ? 'Nothing from this module' : 'Nothing here yet'}</p>
      <p className="mt-1 text-[0.75rem] text-[var(--notification-muted-text)]">{variant === 'filtered' ? 'Try another module, or All modules.' : 'New notifications will appear here.'}</p>
    </div>
  );
}
