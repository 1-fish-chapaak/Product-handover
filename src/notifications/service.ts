// ─── Notification service — the rules engine ───
// Pure functions: given the catalogue, the user's preferences and the current
// store, decide what one `notify()` call produces. The provider (context) owns
// state and persistence; this file owns the decisions so they are testable and
// identical for every trigger site.

import type { NotificationCategory } from '../data/notifications';
import { DEMO_USERS } from '../context/CurrentUserContext';
import { defaultChannels, eventById, PRIORITY_LABEL, type NotificationChannel, type NotificationEventDef, type NotificationModule } from './catalogue';
import type { AppNotification, EmailMessage, NotificationPreferences, NotifyInput, Person, QuietHours } from './types';

export const IST_OFFSET_MIN = 330;

const newId = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// ─── People ───

export function withEmail(p: Person): Person {
  if (p.email) return p;
  const known = DEMO_USERS.find(u => u.name.toLowerCase() === p.name.toLowerCase());
  const email = known?.email ?? `${p.name.trim().toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '')}@irame.ai`;
  const initials = p.initials ?? p.name.split(/\s+/).map(s => s[0]).join('').slice(0, 2).toUpperCase();
  return { ...p, email, initials };
}

// ─── Quiet hours (IST) ───

function istMinutes(d: Date): number {
  const utc = d.getTime() + d.getTimezoneOffset() * 60_000;
  const ist = new Date(utc + IST_OFFSET_MIN * 60_000);
  return ist.getHours() * 60 + ist.getMinutes();
}
const hm = (s: string) => { const [h, m] = s.split(':').map(Number); return (h || 0) * 60 + (m || 0); };

export function inQuietHours(q: QuietHours, now = new Date()): boolean {
  if (!q.enabled) return false;
  const cur = istMinutes(now), start = hm(q.start), end = hm(q.end);
  return start <= end ? cur >= start && cur < end : cur >= start || cur < end;
}

/** The next moment quiet hours end (ISO), from `now`. */
/** Batch cadences the user can pick, in hours. */
export const EMAIL_BATCH_HOURS = [1, 2, 3, 4, 6, 8, 12, 24] as const;

/** The next batch boundary after `now` — batches go out on the clock, every
 *  `hours` hours from midnight (hourly → top of the next hour; 6-hourly →
 *  00:00 / 06:00 / 12:00 / 18:00). */
export function nextBatchTime(now = new Date(), hours = 1): string {
  const h = Math.max(1, Math.min(24, Math.round(hours)));
  const d = new Date(now.getTime());
  d.setMinutes(0, 0, 0);
  const nextHour = d.getHours() + 1;
  d.setHours(Math.ceil(nextHour / h) * h);
  return d.toISOString();
}
/** @deprecated use nextBatchTime */
export const topOfNextHour = (now = new Date()) => nextBatchTime(now, 1);
const laterIso = (a: string | undefined, b: string): string => (a && Date.parse(a) > Date.parse(b) ? a : b);

export function quietHoursRelease(q: QuietHours, now = new Date()): string {
  const cur = istMinutes(now), end = hm(q.end);
  let delta = end - cur;
  if (delta <= 0) delta += 24 * 60;
  return new Date(now.getTime() + delta * 60_000).toISOString();
}

// ─── Preferences → channels ───

/** Whether the event emails by default (before the user says otherwise). */
export function emailByDefault(def: NotificationEventDef): boolean {
  return defaultChannels(def).includes('email');
}

/** Whether the user wants an email for this event. */
export function wantsEmail(def: NotificationEventDef, prefs: NotificationPreferences): boolean {
  const pref = prefs.events[def.id];
  if (typeof pref?.email === 'boolean') return pref.email;
  if (pref?.channels) return pref.channels.includes('email');
  return emailByDefault(def);
}

/** Channels this delivery goes out on. In-app is always on — every event
 *  reaches the bell. Email is the user's choice per event (the map's default
 *  to start with); an @mention always emails as well. */
export function resolveChannels(def: NotificationEventDef, prefs: NotificationPreferences, mention = false): NotificationChannel[] {
  return mention || wantsEmail(def, prefs) ? ['in-app', 'email'] : ['in-app'];
}

// ─── Mapping to the platform notification ───

const MODULE_CATEGORY: Record<NotificationModule, NotificationCategory> = {
  'Exceptions Management': 'exception',
  'ATR & Reports': 'report', 'Engagements': 'engagement', 'Workflows & Data': 'workflow', 'Dashboards': 'report',
};
const PRIORITY_SEVERITY = { P0: 'critical', P1: 'warning', P2: 'info' } as const;

export interface DecisionContext {
  prefs: NotificationPreferences;
  existing: AppNotification[];
  currentUserName: string;
  now?: Date;
}

export type Decision =
  | { kind: 'skip'; reason: string }
  | { kind: 'suppress'; targetId: string }
  | { kind: 'merge'; targetId: string; next: AppNotification; email?: EmailMessage }
  | { kind: 'create'; next: AppNotification; email?: EmailMessage };

const minutesBetween = (a: string, b: Date) => (b.getTime() - Date.parse(a)) / 60_000;

/** Decide what `input` becomes, applying preferences, quiet hours and the
 *  event's de-duplication rule against what's already in the store. */
export function decide(input: NotifyInput, ctx: DecisionContext): Decision {
  const def = eventById(input.eventId);
  if (!def) return { kind: 'skip', reason: `Unknown event ${input.eventId}` };
  const now = ctx.now ?? (input.at ? new Date(input.at) : new Date());
  const channels = resolveChannels(def, ctx.prefs, input.mention);
  if (channels.length === 0) return { kind: 'skip', reason: 'Opted out' };

  const recipients = input.recipients.map(withEmail);
  const watchers = (input.watchers ?? []).map(withEmail);
  const forMe = recipients.some(r => r.name === ctx.currentUserName) || watchers.some(w => w.name === ctx.currentUserName);

  // Quiet hours — held until 08:00 IST unless the event overrides them.
  const quiet = !input.mention && !def.overridesQuietHours && inQuietHours(ctx.prefs.quietHours, now);
  const scheduledFor = quiet ? quietHoursRelease(ctx.prefs.quietHours, now) : undefined;
  // "Batch comment emails" (preferences): the in-app notification is still
  // immediate, but the comment email waits for the top of the next hour and
  // every comment that lands before then rolls into that one email — instead
  // of one email per comment. Mentions are never batched. Quiet hours still
  // apply on top.
  const batchEmail = def.id === 'EXC-15' && !input.mention && ctx.prefs.emailBatching && channels.includes('email');
  const batchHours = ctx.prefs.emailBatchHours || 1;
  const emailScheduledFor = batchEmail ? laterIso(scheduledFor, nextBatchTime(now, batchHours)) : scheduledFor;

  const base: AppNotification = {
    id: newId('n'),
    category: MODULE_CATEGORY[def.module],
    severity: PRIORITY_SEVERITY[def.priority],
    title: input.title,
    message: input.message,
    actor: input.actor,
    createdAt: now.toISOString(),
    read: false,
    requiresAction: def.requiresAction,
    actions: def.requiresAction && def.deeplink === 'approval' ? ['accept', 'decline', 'comment'] : undefined,
    link: input.link,
    linkLabel: input.linkLabel,
    eventId: def.id,
    module: def.module,
    priority: def.priority,
    channels,
    recipients,
    watchers,
    facts: input.facts,
    quoted: input.quoted,
    scheduledFor,
    forMe,
    mention: input.mention,
    count: 1,
    items: input.itemLabel ? [{ id: newId('i'), label: input.itemLabel, at: now.toISOString() }] : undefined,
  };

  // ── De-duplication ──
  const rule = def.dedup;
  const sameEvent = ctx.existing.filter(n => n.eventId === def.id);
  const opKey = input.operationKey;
  const dKey = input.dedupKey;
  const findWithin = (minutes: number, key: (n: AppNotification) => boolean) =>
    sameEvent.find(n => key(n) && minutesBetween(n.createdAt, now) <= minutes);

  const merged = (target: AppNotification): Decision => {
    const count = (target.count ?? 1) + 1;
    const items = [...(target.items ?? []), ...(base.items ?? [])];
    const next: AppNotification = {
      ...target,
      count,
      items,
      // Rollup wording: "N items" — the caller's message stays as the lead.
      title: rollupTitle(def, count, input.title),
      message: input.message,
      facts: mergeFacts(target.facts, input.facts, count),
      recipients: dedupePeople([...(target.recipients ?? []), ...recipients]),
      read: false,
      createdAt: now.toISOString(),
    };
    return { kind: 'merge', targetId: target.id, next, email: channels.includes('email') ? composeEmail(def, next, emailScheduledFor) : undefined };
  };

  switch (rule.kind) {
    case 'collapse-by-operation':
      if (opKey) {
        const t = findWithin(30, n => n.items != null && sameOperation(n, opKey, recipients));
        if (t) return merged(t);
        base.items = base.items ?? [{ id: newId('i'), label: input.title, at: now.toISOString() }];
        markOperation(base, opKey);
      }
      break;
    case 'window':
    case 'batch': {
      const key = dKey ?? opKey;
      if (key) {
        // With comment batching on, the whole hour folds into one notification.
        const t = findWithin(batchEmail ? batchHours * 60 : rule.minutes, n => n.dedupKey === key);
        if (t) return merged(t);
        base.dedupKey = key;
        base.items = base.items ?? [{ id: newId('i'), label: input.title, at: now.toISOString() }];
      }
      break;
    }
    case 'cap-then-rollup':
      if (opKey) {
        const rollup = findWithin(30, n => n.dedupKey === `rollup:${opKey}`);
        if (rollup) return merged(rollup);
        const individual = sameEvent.filter(n => n.dedupKey === `op:${opKey}` && minutesBetween(n.createdAt, now) <= 30);
        if (individual.length >= rule.cap) {
          // Past the cap: this and every later one fold into a single rollup.
          base.dedupKey = `rollup:${opKey}`;
          base.count = individual.length + 1;
          base.title = rollupTitle(def, base.count, input.title);
          base.items = [...individual.map(n => ({ id: n.id, label: n.title, at: n.createdAt })), ...(base.items ?? [])];
        } else {
          base.dedupKey = `op:${opKey}`;
        }
      }
      break;
    case 'suppress-repeat': {
      const key = dKey ?? opKey;
      if (key) {
        const t = findWithin(rule.hours * 60, n => n.dedupKey === key);
        if (t) return { kind: 'suppress', targetId: t.id };
        base.dedupKey = key;
      }
      break;
    }
    case 'none':
      break;
  }

  return { kind: 'create', next: base, email: channels.includes('email') ? composeEmail(def, base, emailScheduledFor) : undefined };
}

// Operation membership is tracked on `dedupKey` so a rollup can be found again.
function markOperation(n: AppNotification, opKey: string) { n.dedupKey = `op:${opKey}`; }
function sameOperation(n: AppNotification, opKey: string, recipients: Person[]) {
  if (n.dedupKey !== `op:${opKey}`) return false;
  // One rollup per recipient set — a bulk assign to two people is two messages.
  const a = (n.recipients ?? []).map(r => r.name).sort().join('|');
  const b = recipients.map(r => r.name).sort().join('|');
  return a === b;
}

function rollupTitle(def: NotificationEventDef, count: number, single: string): string {
  if (count <= 1) return single;
  switch (def.id) {
    case 'EXC-02': return `${count} critical exceptions raised`;
    case 'EXC-03': case 'EXC-05': return `${count} exceptions assigned to you`;
    case 'EXC-04': return `Assignment changes on ${count} exceptions`;
    case 'EXC-15': return `${count} new comments`;
    case 'ACT-01': return `${count} management action plans created for you`;
    case 'ACT-07': return `${count} submissions accepted`;
    case 'ACT-12': return `Bulk operation touched ${count} exceptions`;
    case 'APR-01': case 'APR-02': return `${count} approvals waiting for you`;
    case 'APR-03': return `${count} approvals progressed`;
    case 'APR-05': return `${count} chains completed`;
    case 'ATR-07': return `${count} changes to an issued report`;
    default: return `${count} × ${def.event}`;
  }
}

function mergeFacts(prev: { label: string; value: string }[] | undefined, next: { label: string; value: string }[] | undefined, count: number) {
  const out = [...(next ?? prev ?? [])].filter(f => f.label !== 'Items');
  out.unshift({ label: 'Items', value: String(count) });
  return out;
}
function dedupePeople(list: Person[]): Person[] {
  const seen = new Set<string>();
  return list.filter(p => (seen.has(p.name) ? false : (seen.add(p.name), true)));
}

// ─── Email composition ───

export function composeEmail(def: NotificationEventDef, n: AppNotification, scheduledFor?: string): EmailMessage {
  const first = n.recipients?.[0];
  const reason = first?.role
    ? `You’re receiving this because you’re the ${first.role}${n.facts?.find(f => f.label === 'Engagement') ? ` on ${n.facts.find(f => f.label === 'Engagement')!.value}` : ''}.`
    : 'You’re receiving this because you’re a recipient of this event.';
  return {
    id: newId('em'),
    notificationId: n.id,
    eventId: def.id,
    module: def.module,
    priority: def.priority,
    to: n.recipients ?? [],
    cc: (n.watchers ?? []).filter(w => !def.watchers.find(x => x.label === w.role)?.digestOnly),
    subject: `[${PRIORITY_LABEL[def.priority]}] ${n.title}`,
    preheader: n.message.length > 120 ? `${n.message.slice(0, 117)}…` : n.message,
    lead: n.message,
    facts: n.facts ?? [],
    quoted: n.quoted,
    items: n.items?.map(i => ({ label: i.label, at: i.at })),
    ctaLabel: n.linkLabel ?? 'Open in IRAME',
    reason: `${reason}${def.configurability.mandatory ? ' Delivery of this event is mandatory; you can choose the channel in Notification preferences.' : ' Manage this in Notification preferences.'}`,
    status: scheduledFor ? 'queued' : 'sent',
    createdAt: n.createdAt,
    sentAt: scheduledFor ? undefined : n.createdAt,
    scheduledFor,
  };
}

// ─── Display helpers ───

export const fmtIst = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })} IST`;
};
export const fmtIstDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}, ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })} IST`;
};
