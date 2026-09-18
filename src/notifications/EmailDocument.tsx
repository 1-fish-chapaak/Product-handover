import { ArrowUpRight, Check, Clock3, Quote } from 'lucide-react';
import { eventById } from './catalogue';
import { fmtIstDate } from './service';
import type { EmailMessage } from './types';

const FROM = 'IRAME Notifications <notifications@irame.ai>';
const addr = (p: { name: string; email?: string }) => `${p.name}${p.email ? ` <${p.email}>` : ''}`;

/**
 * The email as the recipient sees it — envelope, then the message as a clean
 * white sheet on the canvas: wordmark, a one-line eyebrow (module · when), the
 * event as the headline, one paragraph, the facts that matter in a quiet
 * panel, one button, and a footer that says why it arrived. Same palette as
 * the platform, no extra colour.
 */
export default function EmailDocument({ email, onOpenLink }: { email: EmailMessage; onOpenLink?: (email: EmailMessage) => void }) {
  const def = eventById(email.eventId);
  const when = email.sentAt ?? email.scheduledFor ?? email.createdAt;
  return (
    <div className="space-y-4">
      {/* Envelope */}
      <div className="rounded-lg border border-canvas-border bg-canvas-elevated px-4 py-3">
        <dl className="grid grid-cols-[56px_1fr] gap-x-3 gap-y-1 text-[0.75rem]">
          <dt className="text-ink-400">From</dt><dd className="text-ink-700 truncate">{FROM}</dd>
          <dt className="text-ink-400">To</dt><dd className="text-ink-700">{email.to.map(addr).join(', ')}</dd>
          {email.cc.length > 0 && <><dt className="text-ink-400">CC</dt><dd className="text-ink-700">{email.cc.map(addr).join(', ')}</dd></>}
          <dt className="text-ink-400">Subject</dt><dd className="text-ink-900 font-semibold">{email.subject}</dd>
        </dl>
        <p className={`mt-2.5 pt-2.5 border-t border-canvas-border inline-flex items-center gap-1.5 text-[0.6875rem] font-medium ${email.status === 'sent' ? 'text-compliant-700' : 'text-mitigated-700'}`}>
          {email.status === 'sent'
            ? <><Check size={12} aria-hidden="true" /> Sent {fmtIstDate(when)}</>
            : <><Clock3 size={12} aria-hidden="true" /> Queued · sends {fmtIstDate(email.scheduledFor!)}</>}
        </p>
      </div>

      {/* The message */}
      <div className="rounded-lg bg-canvas px-6 py-6">
        <article className="mx-auto max-w-[560px] rounded-lg border border-canvas-border bg-canvas-elevated overflow-hidden">
          <header className="flex items-center justify-between px-7 py-4 border-b border-canvas-border">
            <span className="text-[0.9375rem] font-bold tracking-tight text-brand-900">IRAME<span className="text-brand-600">.</span></span>
            <span className="text-[0.6875rem] text-ink-400">{fmtIstDate(when)}</span>
          </header>

          <div className="px-7 pt-6 pb-7">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-brand-700">{def?.module ?? 'Notification'}</p>
            <h1 className="mt-2 text-[1.125rem] font-semibold text-ink-900 tracking-tight leading-snug">{def?.event ?? email.subject}</h1>
            <p className="mt-3 text-[0.875rem] text-ink-700 leading-relaxed">{email.lead}</p>

            {email.quoted && (
              <blockquote className="mt-4 flex gap-3 rounded-md border-l-2 border-brand-300 bg-brand-50/40 px-4 py-3">
                <Quote size={13} className="text-brand-400 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="text-[0.8125rem] text-ink-800 leading-relaxed italic">“{email.quoted.text}”</p>
                  <p className="mt-1 text-[0.6875rem] text-ink-500">— {email.quoted.by}</p>
                </div>
              </blockquote>
            )}

            {email.facts.length > 0 && (
              <dl className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 rounded-md bg-canvas px-4 py-3.5">
                {email.facts.map(f => (
                  <div key={f.label} className="min-w-0">
                    <dt className="text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-ink-400">{f.label}</dt>
                    <dd className="mt-0.5 text-[0.8125rem] font-medium text-ink-900 break-words">{f.value}</dd>
                  </div>
                ))}
              </dl>
            )}

            {email.items && email.items.length > 1 && (
              <div className="mt-5">
                <p className="text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-ink-400 mb-1.5">{email.items.length} items in this message</p>
                <ul className="rounded-md border border-canvas-border divide-y divide-canvas-border">
                  {email.items.map((i, idx) => (
                    <li key={idx} className="flex items-center justify-between gap-3 px-3 py-2 text-[0.8125rem]">
                      <span className="text-ink-800 truncate">{i.label}</span>
                      <span className="text-ink-400 text-[0.6875rem] tabular-nums shrink-0">{fmtIstDate(i.at)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-6 flex items-center gap-4">
              <button type="button" onClick={() => onOpenLink?.(email)} className="inline-flex items-center gap-1.5 h-10 px-5 rounded-md bg-brand-600 hover:bg-brand-500 text-white text-[0.8125rem] font-semibold cursor-pointer transition-colors">
                {email.ctaLabel} <ArrowUpRight size={14} aria-hidden="true" />
              </button>
              <span className="text-[0.6875rem] text-ink-400">or find it under Notifications in IRAME.</span>
            </div>
          </div>

          <footer className="px-7 py-4 border-t border-canvas-border bg-canvas/60 text-[0.6875rem] text-ink-500 leading-relaxed">
            <p>{email.reason}</p>
            <p className="mt-1">IRAME GRC · {def?.cadence ?? 'Immediate'} · <span className="underline decoration-ink-300 underline-offset-2">Notification preferences</span></p>
          </footer>
        </article>
      </div>
    </div>
  );
}
