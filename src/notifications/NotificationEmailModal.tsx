import { ArrowUpRight, Check, Clock3, Mail, Paperclip, Quote } from 'lucide-react';
import Modal from '../components/shared/Modal';
import { eventById, PRIORITY_LABEL } from './catalogue';
import { fmtIstDate } from './service';
import type { EmailMessage } from './types';

const FROM = 'IRAME Notifications <notifications@irame.ai>';

/** The email as the recipient sees it: client-style envelope on top, then the
 *  rendered message — brand header, event badge, the facts the map requires,
 *  any verbatim decision comment, the folded items, one CTA, and a footer that
 *  says why they got it. */
export default function NotificationEmailModal({ email, onClose, onOpenLink }: {
  email: EmailMessage;
  onClose: () => void;
  onOpenLink?: (email: EmailMessage) => void;
}) {
  const def = eventById(email.eventId);
  const addr = (p: { name: string; email?: string }) => `${p.name}${p.email ? ` <${p.email}>` : ''}`;
  return (
    <Modal
      title={email.subject}
      subtitle={<span className="inline-flex items-center gap-1.5"><Mail size={12} aria-hidden="true" /> Email · {email.eventId} · {def?.module}</span>}
      width="max-w-[760px]"
      onClose={onClose}
      ariaLabel="Email preview"
      footer={
        <>
          <span className={`mr-auto inline-flex items-center gap-1.5 text-[0.75rem] font-semibold ${email.status === 'sent' ? 'text-compliant-700' : 'text-mitigated-700'}`}>
            {email.status === 'sent' ? <><Check size={13} aria-hidden="true" /> Sent {fmtIstDate(email.sentAt ?? email.createdAt)}</> : <><Clock3 size={13} aria-hidden="true" /> Queued for quiet hours · sends {fmtIstDate(email.scheduledFor!)}</>}
          </span>
          <button onClick={onClose} className="h-9 px-4 rounded-md text-[0.8125rem] font-semibold text-ink-700 border border-canvas-border hover:bg-canvas cursor-pointer">Close</button>
        </>
      }
    >
      {/* Envelope */}
      <dl className="grid grid-cols-[64px_1fr] gap-x-3 gap-y-1.5 text-[0.75rem] mb-5">
        <dt className="text-ink-400">From</dt><dd className="text-ink-700">{FROM}</dd>
        <dt className="text-ink-400">To</dt><dd className="text-ink-700">{email.to.map(addr).join(', ')}</dd>
        {email.cc.length > 0 && <><dt className="text-ink-400">CC</dt><dd className="text-ink-700">{email.cc.map(addr).join(', ')}</dd></>}
        <dt className="text-ink-400">Subject</dt><dd className="text-ink-900 font-semibold">{email.subject}</dd>
      </dl>

      {/* The message — a paper-warm document inside the canvas modal. */}
      <div className="rounded-xl border border-paper-300 bg-paper-50 overflow-hidden shadow-sm">
        <div className="h-1.5 bg-brand-600" aria-hidden="true" />
        <div className="px-8 pt-6 pb-7">
          <div className="flex items-center justify-between gap-3 mb-6">
            <span className="text-[0.9375rem] font-bold tracking-tight text-brand-900">IRAME<span className="text-brand-600">.</span></span>
            <span className="text-[0.6875rem] text-ink-400">Governance · Risk · Compliance</span>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-brand-50 text-brand-700 text-[0.6875rem] font-semibold">{def?.module ?? 'Notification'}</span>
            <span className={`inline-flex items-center h-6 px-2.5 rounded-full text-[0.6875rem] font-semibold ${email.priority === 'P0' ? 'bg-risk-50 text-risk-700' : email.priority === 'P1' ? 'bg-mitigated-50 text-mitigated-700' : 'bg-draft-50 text-ink-600'}`}>{email.priority} · {PRIORITY_LABEL[email.priority]}</span>
          </div>
          <h1 className="text-[1.25rem] font-semibold text-ink-900 tracking-tight leading-snug">{def?.event ?? email.subject}</h1>
          <p className="mt-3 text-[0.875rem] text-ink-700 leading-relaxed">{email.lead}</p>

          {email.quoted && (
            <blockquote className="mt-4 flex gap-3 rounded-md border-l-[3px] border-brand-400 bg-canvas-elevated px-4 py-3">
              <Quote size={14} className="text-brand-400 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="text-[0.875rem] text-ink-800 leading-relaxed italic">“{email.quoted.text}”</p>
                <p className="mt-1 text-[0.75rem] text-ink-500">— {email.quoted.by}</p>
              </div>
            </blockquote>
          )}

          {email.facts.length > 0 && (
            <table className="mt-5 w-full text-[0.8125rem] border-collapse">
              <tbody>
                {email.facts.map(f => (
                  <tr key={f.label} className="border-t border-paper-300 last:border-b">
                    <th scope="row" className="py-2 pr-4 text-left align-top text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-400 w-[38%]">{f.label}</th>
                    <td className="py-2 text-ink-800">{f.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {email.items && email.items.length > 1 && (
            <div className="mt-5">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-400 mb-2 inline-flex items-center gap-1"><Paperclip size={11} aria-hidden="true" /> {email.items.length} items in this message</p>
              <ul className="rounded-md border border-paper-300 bg-canvas-elevated divide-y divide-paper-300">
                {email.items.map((i, idx) => <li key={idx} className="flex items-center justify-between gap-3 px-3 py-2 text-[0.8125rem]"><span className="text-ink-800 truncate">{i.label}</span><span className="text-ink-400 text-[0.6875rem] tabular-nums shrink-0">{fmtIstDate(i.at)}</span></li>)}
              </ul>
            </div>
          )}

          <div className="mt-6">
            <button type="button" onClick={() => onOpenLink?.(email)} className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-brand-600 hover:bg-brand-500 text-white text-[0.875rem] font-semibold cursor-pointer transition-colors">
              {email.ctaLabel} <ArrowUpRight size={15} aria-hidden="true" />
            </button>
            <p className="mt-2 text-[0.6875rem] text-ink-400">Or open IRAME and find it under Notifications.</p>
          </div>
        </div>
        <div className="px-8 py-4 border-t border-paper-300 bg-paper-100/60 text-[0.6875rem] text-ink-500 leading-relaxed">
          <p>{email.reason}</p>
          <p className="mt-1.5">IRAME GRC · Cadence: {def?.cadence ?? 'Immediate'} · <span className="underline">Notification preferences</span></p>
        </div>
      </div>
    </Modal>
  );
}
