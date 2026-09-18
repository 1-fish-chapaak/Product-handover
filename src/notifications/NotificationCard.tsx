import { useState } from 'react';
import {
  Bell, Mail, Check, X, MessageSquare, ChevronDown, ChevronRight, Clock3, ArrowUpRight, Quote, AtSign, Undo2,
} from 'lucide-react';
import { timeAgo } from '../utils/timeAgo';
import type { NotificationAction } from '../data/notifications';
import { PRIORITY_LABEL, type NotificationPriority } from './catalogue';
import { MODULE_ICON, MODULE_TINT, PRIORITY_DOT, PRIORITY_PILL } from './tokens';
import { fmtIst } from './service';
import type { AppNotification } from './types';

export function PriorityPill({ p, compact = false }: { p: NotificationPriority; compact?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full ring-1 ring-inset font-semibold ${compact ? 'h-[18px] px-1.5 text-[0.625rem]' : 'h-5 px-2 text-[0.6875rem]'} ${PRIORITY_PILL[p]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[p]}`} aria-hidden="true" />{p} · {PRIORITY_LABEL[p]}
    </span>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(/\s+/).map(s => s[0]).join('').slice(0, 2).toUpperCase();
  return <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-100 text-brand-800 text-[0.5625rem] font-bold shrink-0" title={name}>{initials}</span>;
}

export interface NotificationCardProps {
  n: AppNotification;
  currentUserName: string;
  onOpen?: (n: AppNotification) => void;
  onViewEmail?: (n: AppNotification) => void;
  onAction?: (n: AppNotification, action: NotificationAction, text?: string) => void;
  onClearActionState?: (n: AppNotification) => void;
  onReleaseNow?: (n: AppNotification) => void;
  /** Preview mode: no unread styling, no click-to-open. */
  preview?: boolean;
}

/** One delivery in the centre — priority, module, who it's for, the facts the
 *  map requires, any verbatim decision comment, the folded items, and actions. */
export default function NotificationCard({ n, currentUserName, onOpen, onViewEmail, onAction, onClearActionState, onReleaseNow, preview = false }: NotificationCardProps) {
  const unread = !n.read && !preview;
  const held = !!n.scheduledFor;
  const Icon = (n.module && MODULE_ICON[n.module]) || Bell;
  const tint = (n.module && MODULE_TINT[n.module]) || 'bg-paper-100 text-ink-600';
  const [expanded, setExpanded] = useState(false);
  const [commenting, setCommenting] = useState(false);
  const [commentText, setCommentText] = useState('');
  const acted = !!n.actionState;
  const actions = n.actions ?? [];
  const toMe = n.recipients?.some(r => r.name === currentUserName);
  const others = (n.recipients ?? []).filter(r => r.name !== currentUserName);
  const ccMe = !toMe && n.watchers?.some(w => w.name === currentUserName);

  return (
    <article
      className={`relative border-b border-canvas-border transition-colors ${preview ? 'bg-canvas-elevated' : unread ? 'bg-brand-50/30 hover:bg-brand-50/50' : 'bg-canvas-elevated hover:bg-canvas'}`}
      aria-label={n.title}
    >
      {unread && <span className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full ${n.priority ? PRIORITY_DOT[n.priority] : 'bg-brand-500'}`} aria-hidden="true" />}
      <div className="pl-5 pr-4 py-3.5">
        <div className="flex items-start gap-3">
          <span className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${tint}`}><Icon size={15} aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            {/* Title row */}
            <div className="flex items-start justify-between gap-3">
              <button
                type="button"
                onClick={() => !preview && onOpen?.(n)}
                className={`text-left text-[0.8125rem] leading-snug font-semibold ${unread ? 'text-ink-900' : 'text-ink-700'} ${preview ? 'cursor-default' : 'hover:text-brand-700 cursor-pointer'}`}
              >
                {n.title}
                {n.count && n.count > 1 && <span className="ml-1.5 inline-flex items-center h-[18px] px-1.5 rounded-full bg-brand-600 text-white text-[0.625rem] font-bold tabular-nums align-middle">×{n.count}</span>}
              </button>
              <span className="shrink-0 text-[0.6875rem] text-ink-400 tabular-nums whitespace-nowrap mt-[2px]" title={fmtIst(n.createdAt)}>
                {held ? <span className="inline-flex items-center gap-1 text-mitigated-700"><Clock3 size={11} aria-hidden="true" /> {fmtIst(n.scheduledFor!)}</span> : timeAgo(n.createdAt)}
              </span>
            </div>
            <p className={`mt-1 text-[0.75rem] leading-relaxed ${unread ? 'text-ink-700' : 'text-ink-500'}`}>{n.message}</p>

            {/* Verbatim decision comment */}
            {n.quoted && (
              <blockquote className="mt-2 flex gap-2 rounded-md border-l-2 border-brand-300 bg-canvas px-3 py-2">
                <Quote size={12} className="text-brand-400 shrink-0 mt-0.5" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-[0.75rem] text-ink-800 leading-relaxed italic">“{n.quoted.text}”</p>
                  <p className="text-[0.6875rem] text-ink-400 mt-0.5">— {n.quoted.by}</p>
                </div>
              </blockquote>
            )}

            {/* Meta strip */}
            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
              {n.eventId && <span className="inline-flex items-center h-[18px] px-1.5 rounded-sm bg-paper-100 text-ink-600 font-mono text-[0.625rem] font-semibold tracking-wide">{n.eventId}</span>}
              {n.priority && <PriorityPill p={n.priority} compact />}
              {n.mention && <span className="inline-flex items-center gap-0.5 h-[18px] px-1.5 rounded-full bg-brand-50 text-brand-700 text-[0.625rem] font-semibold"><AtSign size={10} aria-hidden="true" /> mention</span>}
              <span className="inline-flex items-center gap-1 text-[0.6875rem] text-ink-500">
                {toMe ? <><Avatar name={currentUserName} /> To you{others.length > 0 && ` +${others.length}`}</>
                  : ccMe ? <><Avatar name={currentUserName} /> CC you</>
                  : others.slice(0, 2).map(r => <span key={r.name} className="inline-flex items-center gap-1"><Avatar name={r.name} />{r.name.split(' ')[0]}</span>)}
                {!toMe && !ccMe && others.length > 2 && <span>+{others.length - 2}</span>}
              </span>
              <span className="ml-auto inline-flex items-center gap-1 text-ink-400" title={`Delivered via ${(n.channels ?? ['in-app']).join(' + ')}`}>
                {(n.channels ?? ['in-app']).includes('in-app') && <Bell size={11} aria-hidden="true" />}
                {(n.channels ?? []).includes('email') && <Mail size={11} aria-hidden="true" />}
              </span>
            </div>

            {/* Facts */}
            {n.facts && n.facts.length > 0 && (
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[0.6875rem]">
                {n.facts.slice(0, expanded ? undefined : 3).map(f => (
                  <div key={f.label} className="contents">
                    <dt className="text-ink-400 whitespace-nowrap">{f.label}</dt>
                    <dd className="text-ink-700 truncate" title={f.value}>{f.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {((n.facts?.length ?? 0) > 3 || (n.items && n.items.length > 1)) && (
              <button type="button" onClick={() => setExpanded(e => !e)} className="mt-1.5 inline-flex items-center gap-1 text-[0.6875rem] font-semibold text-brand-700 hover:underline cursor-pointer">
                {expanded ? <ChevronDown size={11} aria-hidden="true" /> : <ChevronRight size={11} aria-hidden="true" />}
                {expanded ? 'Less' : n.items && n.items.length > 1 ? `${n.items.length} items` : 'All details'}
              </button>
            )}
            {expanded && n.items && n.items.length > 1 && (
              <ul className="mt-1.5 space-y-1 border-l border-canvas-border pl-3">
                {n.items.map(i => (
                  <li key={i.id} className="flex items-center justify-between gap-2 text-[0.6875rem]"><span className="text-ink-700 truncate">{i.label}</span><span className="text-ink-400 tabular-nums shrink-0">{fmtIst(i.at)}</span></li>
                ))}
              </ul>
            )}
            {n.suppressed ? <p className="mt-1.5 text-[0.6875rem] text-ink-400">{n.suppressed} repeat{n.suppressed === 1 ? '' : 's'} suppressed since — you’ll get a summary if it keeps happening.</p> : null}

            {/* Held for quiet hours */}
            {held && !preview && (
              <div className="mt-2 flex items-center justify-between gap-2 rounded-md bg-mitigated-50 px-2.5 py-1.5 text-[0.6875rem] text-mitigated-700">
                <span className="inline-flex items-center gap-1.5"><Clock3 size={12} aria-hidden="true" /> Held for quiet hours · releases {fmtIst(n.scheduledFor!)}</span>
                {onReleaseNow && <button type="button" onClick={() => onReleaseNow(n)} className="font-semibold hover:underline cursor-pointer">Release now</button>}
              </div>
            )}

            {/* Actions */}
            {!preview && (
              <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                {n.link && onOpen && (
                  <button type="button" onClick={() => onOpen(n)} className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[0.75rem] font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 transition-colors cursor-pointer">
                    {n.linkLabel ?? 'Open'} <ArrowUpRight size={12} aria-hidden="true" />
                  </button>
                )}
                {n.emailId && onViewEmail && (
                  <button type="button" onClick={() => onViewEmail(n)} className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[0.75rem] font-medium text-ink-600 border border-canvas-border hover:border-brand-200 hover:text-brand-700 transition-colors cursor-pointer">
                    <Mail size={12} aria-hidden="true" /> View email
                  </button>
                )}
                {n.requiresAction && actions.length > 0 && !acted && !commenting && onAction && (
                  <span className="inline-flex items-center gap-1 ml-auto">
                    {actions.includes('accept') && <button type="button" onClick={() => onAction(n, 'accept')} className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[0.75rem] font-medium bg-compliant-50 text-compliant-700 hover:bg-compliant-100 transition-colors cursor-pointer"><Check size={12} aria-hidden="true" /> Approve</button>}
                    {actions.includes('decline') && <button type="button" onClick={() => onAction(n, 'decline')} className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[0.75rem] font-medium bg-risk-50 text-risk-700 hover:bg-risk-100 transition-colors cursor-pointer"><X size={12} aria-hidden="true" /> Reject</button>}
                    {actions.includes('comment') && <button type="button" onClick={() => setCommenting(true)} className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[0.75rem] font-medium text-ink-600 hover:bg-canvas transition-colors cursor-pointer"><MessageSquare size={12} aria-hidden="true" /> Comment</button>}
                  </span>
                )}
                {acted && n.actionState && (
                  <span className="ml-auto inline-flex items-center gap-1.5 text-[0.6875rem] text-ink-500">
                    <span className={`inline-flex items-center gap-1 h-6 px-2 rounded-full font-semibold ${n.actionState.type === 'accept' ? 'bg-compliant-50 text-compliant-700' : n.actionState.type === 'decline' ? 'bg-high-50 text-high-700' : 'bg-draft-50 text-ink-600'}`}>
                      <Check size={11} aria-hidden="true" /> {n.actionState.type === 'accept' ? 'Approved' : n.actionState.type === 'decline' ? 'Rejected' : 'Commented'} {timeAgo(n.actionState.takenAt)}
                    </span>
                    {onClearActionState && <button type="button" onClick={() => onClearActionState(n)} className="inline-flex items-center gap-1 text-ink-400 hover:text-ink-700 cursor-pointer" title="Undo"><Undo2 size={12} aria-hidden="true" /></button>}
                  </span>
                )}
              </div>
            )}
            {commenting && onAction && (
              <div className="mt-2 flex items-center gap-1.5">
                <input
                  autoFocus value={commentText} onChange={e => setCommentText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && commentText.trim()) { onAction(n, 'comment', commentText.trim()); setCommentText(''); setCommenting(false); } if (e.key === 'Escape') setCommenting(false); }}
                  placeholder="Add a comment for the submitter…"
                  className="flex-1 h-8 px-2.5 bg-canvas-elevated border border-canvas-border rounded-md text-[0.75rem] text-ink-800 placeholder:text-ink-400 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10"
                />
                <button type="button" disabled={!commentText.trim()} onClick={() => { onAction(n, 'comment', commentText.trim()); setCommentText(''); setCommenting(false); }} className="h-8 px-2.5 rounded-md text-[0.75rem] font-semibold text-white bg-brand-600 hover:bg-brand-500 disabled:opacity-50 cursor-pointer">Post</button>
                <button type="button" onClick={() => setCommenting(false)} className="h-8 w-8 rounded-md text-ink-500 hover:bg-canvas flex items-center justify-center cursor-pointer" aria-label="Cancel"><X size={13} /></button>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
