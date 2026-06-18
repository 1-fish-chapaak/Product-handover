import { useMemo } from 'react';
import { motion } from 'motion/react';
import { X, Paperclip } from 'lucide-react';
import {
  ACTION_HUB_TIMELINE,
  type ActionHubEvent,
  type ActionHubActorRole,
} from '../../data/mockData';

const ROLE_AVATAR: Record<ActionHubActorRole, { initials: string; bg: string; fg: string }> = {
  'Risk Owner': { initials: 'RO', bg: 'bg-brand-100',    fg: 'text-brand-700' },
  'Auditor':    { initials: 'AU', bg: 'bg-[#EDE4FA]',    fg: 'text-brand-700' },
  'Ira (AI)':   { initials: 'AI', bg: 'bg-compliant-50', fg: 'text-compliant-700' },
  'System':     { initials: 'SY', bg: 'bg-[#EEEEF1]',    fg: 'text-ink-600' },
};

const ROLE_DOT: Record<ActionHubActorRole, string> = {
  'Risk Owner': 'bg-brand-600',
  'Auditor':    'bg-brand-400',
  'Ira (AI)':   'bg-compliant',
  'System':     'bg-ink-300',
};

function TimelineEntry({ event }: { event: ActionHubEvent }) {
  const avatar = ROLE_AVATAR[event.role];
  const dot = ROLE_DOT[event.role];
  return (
    <li className="relative flex gap-3 py-3">
      <div className={`shrink-0 w-8 h-8 rounded-full ${avatar.bg} ${avatar.fg} flex items-center justify-center text-[0.625rem] font-semibold tracking-wider`}>
        {avatar.initials}
      </div>
      <div className="flex-1 min-w-0 pr-6">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className="text-[0.8125rem] text-ink-900 font-medium leading-snug">{event.message}</span>
          {event.exceptionId && event.exceptionId !== '—' && (
            <span className="inline-flex items-center h-5 px-2 text-[0.75rem] font-medium bg-brand-50 text-brand-700 rounded-full font-mono">
              {event.exceptionId}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[0.75rem] text-ink-500">
          <span>{event.actor} <span className="text-ink-400">[{event.role}]</span></span>
          <span className="text-ink-300">·</span>
          <span className="tabular-nums">{event.time}</span>
          <span className="text-ink-300">·</span>
          <em className="not-italic">{event.relative}</em>
        </div>
        {event.comment && (
          <p className="mt-1.5 text-[0.75rem] italic text-ink-500 leading-relaxed">{event.comment}</p>
        )}
        {event.attachment && (
          <button className="mt-2 inline-flex items-center gap-1.5 text-[0.75rem] text-ink-600 hover:text-brand-700 cursor-pointer">
            <Paperclip size={11} />
            {event.attachment.name}
          </button>
        )}
      </div>
      <span className={`absolute top-4 right-0 w-2 h-2 rounded-full ${dot}`} aria-hidden="true" />
    </li>
  );
}

export default function ActivityTimelineDrawer({ onClose }: { onClose: () => void }) {
  const timeline = ACTION_HUB_TIMELINE;
  const grouped = useMemo(() => {
    const groups: { date: string; events: ActionHubEvent[] }[] = [];
    timeline.forEach(ev => {
      const last = groups[groups.length - 1];
      if (last && last.date === ev.date) last.events.push(ev);
      else groups.push({ date: ev.date, events: [ev] });
    });
    return groups;
  }, [timeline]);

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
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 8 }}
        transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-32px)] max-w-[760px] max-h-[88vh] bg-canvas-elevated shadow-xl border border-canvas-border rounded-[16px] flex flex-col z-50"
        role="dialog"
        aria-label="Activity timeline"
      >
        <header className="shrink-0 px-6 pt-5 pb-4 flex items-start justify-between gap-4 border-b border-canvas-border">
          <div>
            <h2 className="text-[1.25rem] font-semibold text-ink-900 tracking-tight">Activity Timeline</h2>
            <p className="text-[0.75rem] text-ink-500 mt-0.5">Chronological log of every action across all exceptions.</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-2">
          {grouped.map(group => (
            <div key={group.date} className="relative">
              <div className="sticky top-0 z-10 bg-canvas-elevated flex items-center justify-between py-2 border-b border-canvas-border">
                <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-500">{group.date}</span>
                <span className="text-[0.6875rem] text-ink-400 tabular-nums">
                  {group.events.length} {group.events.length === 1 ? 'event' : 'events'}
                </span>
              </div>
              <ol className="divide-y divide-canvas-border">
                {group.events.map(ev => (
                  <TimelineEntry key={ev.id} event={ev} />
                ))}
              </ol>
            </div>
          ))}
        </div>
        <footer className="shrink-0 px-6 py-3 border-t border-canvas-border text-right text-[0.75rem] text-ink-500 tabular-nums">
          {timeline.length} events
        </footer>
      </motion.aside>
    </>
  );
}
