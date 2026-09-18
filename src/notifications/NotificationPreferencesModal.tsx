import { useMemo, useState } from 'react';
import { Bell, Mail, Lock, Eye, RotateCcw, Moon, Zap, Info, ChevronDown, ChevronRight, AtSign, ArrowLeft } from 'lucide-react';
import EmailDocument from './EmailDocument';
import type { EmailMessage } from './types';
import Modal from '../components/shared/Modal';
import Toggle from '../components/shared/Toggle';
import { useCurrentUser } from '../context/CurrentUserContext';
import { NOTIFICATION_EVENTS, NOTIFICATION_MODULES, eventArea, type NotificationEventDef, type NotificationModule } from './catalogue';
import { useNotifications } from './NotificationContext';
import NotificationItem from './NotificationItem';
import { MODULE_ICON, MODULE_TINT } from './tokens';
import { sampleInput } from './samples';
import { decide, wantsEmail, EMAIL_BATCH_HOURS } from './service';
import { DEFAULT_PREFERENCES, type AppNotification } from './types';

const MODULE_BLURB: Record<NotificationModule, string> = {
  'Exceptions Management': 'Exceptions raised, assignment, classification and its approval chain, management action plans and their verification, reopening, comments.',
  'ATR & Reports': 'Reports created, generated, issued, shared, changed after issue and snapshotted.',
  'Engagements': 'Engagement lifecycle: creation, kick-off, ownership, closure, standing instructions.',
  'Workflows & Data': 'Run failures, publishes, bulk runs, ingestion and connection failures, uploads, moves.',
  'Dashboards': 'Dashboards shared with you and sources changing underneath them.',
};

// "every hour" / "every 6 hours" / "once a day".
const batchLabel = (h: number) => (h === 1 ? 'every hour' : h === 24 ? 'once a day' : `every ${h} hours`);
// The first few send times for a cadence, so the choice reads concretely.
const clockExamples = (h: number) => Array.from({ length: Math.min(3, 24 / h) }, (_, i) => `${String(i * h).padStart(2, '0')}:00`).join(', ') + (24 / h > 3 ? '…' : '');

export default function NotificationPreferencesModal() {
  const { prefs, setPrefs, resetPrefs, setPrefsOpen } = useNotifications();
  // An email being previewed swaps in over the event list — no modal on a modal.
  const [emailPreview, setEmailPreview] = useState<{ email: EmailMessage; eventId: string } | null>(null);
  const { currentUser } = useCurrentUser();
  const me = currentUser?.name ?? 'You';
  const [module, setModule] = useState<NotificationModule>('Exceptions Management');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [whyId, setWhyId] = useState<string | null>(null);

  const events = useMemo(() => NOTIFICATION_EVENTS.filter(e => e.module === module), [module]);
  const counts = useMemo(() => Object.fromEntries(NOTIFICATION_MODULES.map(m => [m, NOTIFICATION_EVENTS.filter(e => e.module === m).length])), []);

  // In-app is always on; the one choice per event is whether to email too.
  const setEmail = (def: NotificationEventDef, on: boolean) => setPrefs(p => ({ ...p, events: { ...p.events, [def.id]: { email: on } } }));

  // Preview: run the sample through the same rules as a live delivery.
  const preview = useMemo(() => {
    if (!previewId) return null;
    const input = sampleInput(previewId);
    if (!input) return null;
    const d = decide({ ...input, at: new Date().toISOString() }, { prefs: { ...prefs, quietHours: { ...prefs.quietHours, enabled: false } }, existing: [], currentUserName: me, now: new Date() });
    if (d.kind !== 'create') return null;
    const n: AppNotification = { ...d.next, read: true };
    return { n, email: d.email };
  }, [previewId, prefs, me]);

  const changed = Object.keys(prefs.events).length > 0 || JSON.stringify(prefs.quietHours) !== JSON.stringify(DEFAULT_PREFERENCES.quietHours) || prefs.emailBatching !== DEFAULT_PREFERENCES.emailBatching || prefs.emailBatchHours !== DEFAULT_PREFERENCES.emailBatchHours;

  return (
    <Modal
      title="Notification preferences"
      subtitle="Every event reaches you in the app. For each one, choose whether you also want an email."
      width="max-w-[1080px]"
      height="h-[760px]"
      onClose={() => setPrefsOpen(false)}
      footer={
        <>
          <button onClick={resetPrefs} disabled={!changed} className="mr-auto inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-[0.8125rem] font-medium text-ink-600 hover:text-ink-900 hover:bg-canvas disabled:text-ink-300 disabled:cursor-not-allowed cursor-pointer"><RotateCcw size={14} aria-hidden="true" /> Reset to defaults</button>
          <button onClick={() => setPrefsOpen(false)} className="h-9 px-4 rounded-md text-[0.8125rem] font-semibold text-white bg-brand-600 hover:bg-brand-500 cursor-pointer">Done</button>
        </>
      }
    >
      <div className="-mx-7 -my-5 h-full flex min-h-0">
        {/* Rail — delivery settings + modules */}
        <aside className="w-[300px] shrink-0 border-r border-canvas-border overflow-y-auto p-4 space-y-4">
          <section className="rounded-lg border border-canvas-border bg-canvas-elevated p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <span className="w-8 h-8 rounded-md bg-brand-50 text-brand-700 flex items-center justify-center shrink-0"><Moon size={15} aria-hidden="true" /></span>
                <div className="min-w-0">
                  <h4 className="text-[0.8125rem] font-semibold text-ink-900">Quiet hours</h4>
                  <p className="text-[0.6875rem] text-ink-500 leading-snug mt-0.5">Non-critical deliveries are held and released at the end of quiet hours.</p>
                </div>
              </div>
              <Toggle checked={prefs.quietHours.enabled} onChange={v => setPrefs(p => ({ ...p, quietHours: { ...p.quietHours, enabled: v } }))} ariaLabel="Quiet hours" />
            </div>
            <div className={`mt-3 flex items-center gap-2 ${prefs.quietHours.enabled ? '' : 'opacity-50'}`}>
              <label className="text-[0.6875rem] text-ink-500">From</label>
              <input type="time" value={prefs.quietHours.start} disabled={!prefs.quietHours.enabled} onChange={e => setPrefs(p => ({ ...p, quietHours: { ...p.quietHours, start: e.target.value } }))} className="h-8 px-2 rounded-md border border-canvas-border bg-canvas-elevated text-[0.75rem] text-ink-800 tabular-nums outline-none focus:border-brand-400" aria-label="Quiet hours start" />
              <label className="text-[0.6875rem] text-ink-500">to</label>
              <input type="time" value={prefs.quietHours.end} disabled={!prefs.quietHours.enabled} onChange={e => setPrefs(p => ({ ...p, quietHours: { ...p.quietHours, end: e.target.value } }))} className="h-8 px-2 rounded-md border border-canvas-border bg-canvas-elevated text-[0.75rem] text-ink-800 tabular-nums outline-none focus:border-brand-400" aria-label="Quiet hours end" />
              <span className="text-[0.6875rem] text-ink-400">IST</span>
            </div>
            <div className="mt-2.5 flex items-start gap-1.5 text-[0.6875rem] text-ink-500 leading-snug"><Info size={11} className="mt-0.5 shrink-0" aria-hidden="true" /><p>Events marked <span className="font-semibold text-ink-700">overrides quiet hours</span> (rejections, critical exceptions, failed runs) and @mentions always deliver immediately.</p></div>
          </section>

          <section className="rounded-lg border border-canvas-border bg-canvas-elevated p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0"><span className="w-8 h-8 rounded-md bg-evidence-50 text-evidence-700 flex items-center justify-center shrink-0"><Mail size={15} aria-hidden="true" /></span><div className="min-w-0"><h4 className="text-[0.8125rem] font-semibold text-ink-900">One comment email {batchLabel(prefs.emailBatchHours)}</h4><p className="text-[0.6875rem] text-ink-500 leading-snug mt-0.5">Instead of a separate email for every comment, get one email {batchLabel(prefs.emailBatchHours)} listing all the new comments. You still see every comment in the app straight away, and @mentions email you immediately.</p></div></div>
              <Toggle checked={prefs.emailBatching} onChange={v => setPrefs(p => ({ ...p, emailBatching: v }))} ariaLabel="Batch comment emails" />
            </div>
            <div className={`mt-3 flex items-center gap-2 ${prefs.emailBatching ? '' : 'opacity-50'}`}>
              <label htmlFor="batch-hours" className="text-[0.6875rem] text-ink-500">Send every</label>
              <div className="relative">
                <select
                  id="batch-hours"
                  value={prefs.emailBatchHours}
                  disabled={!prefs.emailBatching}
                  onChange={e => setPrefs(p => ({ ...p, emailBatchHours: Number(e.target.value) }))}
                  className="h-8 pl-2 pr-7 rounded-md border border-canvas-border bg-canvas-elevated text-[0.75rem] text-ink-800 tabular-nums outline-none focus:border-brand-400 appearance-none cursor-pointer disabled:cursor-not-allowed"
                  aria-label="Comment email frequency"
                >
                  {EMAIL_BATCH_HOURS.map(h => <option key={h} value={h}>{h === 1 ? '1 hour' : h === 24 ? '24 hours (once a day)' : `${h} hours`}</option>)}
                </select>
                <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-ink-400" aria-hidden="true" />
              </div>
            </div>
            <p className={`mt-1.5 text-[0.6875rem] text-ink-400 leading-snug ${prefs.emailBatching ? '' : 'opacity-50'}`}>
              {prefs.emailBatchHours === 1 ? 'Sent at the top of every hour.' : `Sent on the clock — ${clockExamples(prefs.emailBatchHours)}`}
            </p>
          </section>

          <nav aria-label="Modules">
            <p className="px-1 mb-1.5 text-[0.625rem] font-semibold uppercase tracking-wide text-ink-400">Events by module</p>
            <ul className="space-y-0.5">
              {NOTIFICATION_MODULES.map(m => {
                const Icon = MODULE_ICON[m]; const on = module === m;
                return (
                  <li key={m}>
                    <button onClick={() => { setModule(m); setPreviewId(null); setWhyId(null); setEmailPreview(null); }} aria-current={on ? 'true' : undefined} className={`w-full flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left cursor-pointer transition-colors ${on ? 'bg-brand-50 text-brand-800' : 'text-ink-700 hover:bg-canvas'}`}>
                      <span className={`w-6 h-6 rounded-sm flex items-center justify-center shrink-0 ${MODULE_TINT[m]}`}><Icon size={13} aria-hidden="true" /></span>
                      <span className="flex-1 text-[0.8125rem] font-medium truncate">{m}</span>
                      <span className="text-[0.6875rem] tabular-nums text-ink-400">{counts[m]}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>

        {/* Events — or the email being previewed, swapped in place */}
        {emailPreview ? (
          <div className="flex-1 min-w-0 overflow-y-auto">
            <div className="sticky top-0 z-10 bg-canvas-elevated/95 backdrop-blur-sm px-6 pt-4 pb-3 border-b border-canvas-border flex items-center gap-3">
              <button type="button" onClick={() => setEmailPreview(null)} className="inline-flex items-center gap-1.5 h-8 px-2.5 -ml-2 rounded-md text-[0.75rem] font-medium text-ink-600 hover:text-ink-900 hover:bg-canvas cursor-pointer transition-colors">
                <ArrowLeft size={14} aria-hidden="true" /> Back to events
              </button>
              <div className="min-w-0">
                <h3 className="text-[0.875rem] font-semibold text-ink-900 tracking-tight truncate">Email preview</h3>
                <p className="text-[0.6875rem] text-ink-500 inline-flex items-center gap-1.5"><Mail size={11} aria-hidden="true" /> {emailPreview.eventId} · exactly what would leave the platform</p>
              </div>
            </div>
            <div className="px-6 py-5">
              <EmailDocument email={emailPreview.email} />
            </div>
          </div>
        ) : (
        <div className="flex-1 min-w-0 overflow-y-auto">
          <div className="px-6 pt-5 pb-3 border-b border-canvas-border">
            <h3 className="text-[1rem] font-semibold text-ink-900 tracking-tight">{module}</h3>
            <p className="text-[0.8125rem] text-ink-500 mt-0.5">{MODULE_BLURB[module]}</p>
            <div className="mt-3 flex items-center gap-4 text-[0.6875rem] text-ink-500">
              <span className="inline-flex items-center gap-1"><Bell size={11} aria-hidden="true" /> In-app — always on</span>
              <span className="inline-flex items-center gap-1"><Mail size={11} aria-hidden="true" /> Email — your choice</span>
              <span className="inline-flex items-center gap-1"><Eye size={11} aria-hidden="true" /> Preview shows the exact message</span>
            </div>
          </div>
          <ul className="divide-y divide-canvas-border">
            {events.map((def, idx) => {
              // Sub-area header (Exceptions · Action Hub · Approval chains) inside the one module.
              const area = eventArea(def.id);
              const showArea = !!area && (idx === 0 || eventArea(events[idx - 1].id) !== area);
              const areaHeader = showArea ? (
                <li key={`area-${area}`} className="px-6 pt-4 pb-1.5 bg-canvas/40">
                  <span className="text-[0.625rem] font-semibold uppercase tracking-wide text-ink-400">{area}</span>
                </li>
              ) : null;
              const emailOn = wantsEmail(def, prefs);
              const isPreview = previewId === def.id;
              const isWhy = whyId === def.id;
              return (<>
                {areaHeader}
                <li key={def.id} className={`px-6 py-3.5 ${isPreview ? 'bg-brand-50/30' : ''}`}>
                  <div className="flex items-start gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center h-[18px] px-1.5 rounded-sm bg-paper-100 text-ink-600 font-mono text-[0.625rem] font-semibold tracking-wide">{def.id}</span>
                        <h4 className="text-[0.8125rem] font-semibold text-ink-900">{def.event}</h4>
                        {def.overridesQuietHours && <span className="inline-flex items-center gap-1 h-[18px] px-1.5 rounded-full bg-risk-50 text-risk-700 text-[0.625rem] font-semibold"><Zap size={9} aria-hidden="true" /> overrides quiet hours</span>}
                        {def.channel === 'in-app+email-opt-in' && <span className="inline-flex items-center gap-1 h-[18px] px-1.5 rounded-full bg-brand-50 text-brand-700 text-[0.625rem] font-semibold"><AtSign size={9} aria-hidden="true" /> @mentions always</span>}
                      </div>
                      <p className="mt-1 text-[0.75rem] text-ink-500 leading-snug">{def.trigger}{def.realtimeNote ? ` ${def.realtimeNote}` : ''}</p>
                      <div className="mt-1.5 flex items-center gap-3 text-[0.6875rem]">
                        <button type="button" onClick={() => setWhyId(isWhy ? null : def.id)} className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline cursor-pointer">{isWhy ? <ChevronDown size={11} aria-hidden="true" /> : <ChevronRight size={11} aria-hidden="true" />} Why this channel &amp; who gets it</button>
                        <button type="button" onClick={() => setPreviewId(isPreview ? null : def.id)} className="inline-flex items-center gap-1 font-semibold text-ink-600 hover:text-brand-700 cursor-pointer"><Eye size={11} aria-hidden="true" /> {isPreview ? 'Hide preview' : 'Preview'}</button>
                      </div>
                      {isWhy && (
                        <dl className="mt-2.5 grid grid-cols-[110px_1fr] gap-x-3 gap-y-1.5 rounded-md bg-canvas px-3 py-2.5 text-[0.71875rem]">
                          <dt className="text-ink-400">Why</dt><dd className="text-ink-700 leading-snug">{def.whyThisChannel}</dd>
                          <dt className="text-ink-400">Recipients</dt><dd className="text-ink-700">{def.recipients.map(r => r.label).join(' · ')}</dd>
                          {def.watchers.length > 0 && <><dt className="text-ink-400">Watchers / CC</dt><dd className="text-ink-700">{def.watchers.map(w => `${w.label}${w.digestOnly ? ' (digest)' : ''}`).join(' · ')}</dd></>}
                          <dt className="text-ink-400">Cadence</dt><dd className="text-ink-700">{def.cadence}</dd>
                          <dt className="text-ink-400">De-duplication</dt><dd className="text-ink-700">{def.dedup.kind === 'none' ? 'None — every one is delivered.' : def.dedup.note}</dd>
                          <dt className="text-ink-400">Always includes</dt><dd className="text-ink-700">{def.content.map(c => <code key={c} className="inline-block mr-1 mb-0.5 px-1 rounded-sm bg-paper-100 text-ink-600 font-mono text-[0.625rem]">{`{{${c}}}`}</code>)}</dd>
                        </dl>
                      )}
                    </div>

                    {/* Channel controls — in-app is locked on; email is the user's call. */}
                    <div className="shrink-0 flex items-center gap-3 pt-0.5">
                      <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-paper-100 text-ink-600 text-[0.6875rem] font-semibold" title="Every event reaches you in the app">
                        <Bell size={12} aria-hidden="true" /> In-app <Lock size={10} className="text-ink-400" aria-hidden="true" />
                      </span>
                      <label className="inline-flex items-center gap-2 h-7 px-2.5 rounded-md border border-canvas-border text-[0.6875rem] font-semibold text-ink-600 cursor-pointer">
                        <Mail size={12} aria-hidden="true" /> Email
                        <Toggle checked={emailOn} onChange={v => setEmail(def, v)} ariaLabel={`Email me for ${def.id}`} />
                      </label>
                    </div>
                  </div>

                  {isPreview && preview && (
                    <div className="mt-3 rounded-lg border border-canvas-border overflow-hidden">
                      <div className="px-3 py-1.5 bg-canvas text-[0.625rem] font-semibold uppercase tracking-wide text-ink-400 flex items-center justify-between">
                        <span>In-app · exactly as it would appear</span>
                        {preview.email
                          ? <button type="button" onClick={() => setEmailPreview({ email: preview.email!, eventId: def.id })} className="inline-flex items-center gap-1 normal-case tracking-normal text-[0.6875rem] font-semibold text-brand-700 hover:underline cursor-pointer"><Mail size={11} aria-hidden="true" /> Preview the email</button>
                          : <span className="normal-case tracking-normal text-ink-400">No email on the current channel choice</span>}
                      </div>
                      <ul className="py-1"><NotificationItem n={preview.n} preview /></ul>
                    </div>
                  )}
                </li>
              </>);
            })}
          </ul>
        </div>
        )}
      </div>
    </Modal>
  );
}
