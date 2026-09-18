import type { PlatformNotification } from '../data/notifications';
import type { NotificationChannel, NotificationModule, NotificationPriority } from './catalogue';

/** Someone a notification is addressed to. */
export interface Person {
  name: string;
  /** Role in the context of this event ("Risk Owner", "Engagement owner"). */
  role?: string;
  email?: string;
  initials?: string;
}

/** A labelled fact the message must carry (the content-requirements column). */
export interface Fact { label: string; value: string }

/** Everything the drawer, the row and the email need for one delivery. Extends
 *  the platform's notification so the existing drawer machinery (read state,
 *  action state, day buckets, deep links) keeps working unchanged. */
export interface AppNotification extends PlatformNotification {
  /** Catalogue event id, e.g. EXC-03. Absent on legacy seeds. */
  eventId?: string;
  module?: NotificationModule;
  priority?: NotificationPriority;
  /** Channels actually used for this delivery. */
  channels?: NotificationChannel[];
  recipients?: Person[];
  watchers?: Person[];
  facts?: Fact[];
  /** A decision comment reproduced verbatim (EXC-07, ACT-08, APR-04…). */
  quoted?: { by: string; text: string };
  /** Linked email in the outbox. */
  emailId?: string;
  /** > 1 when repeats were collapsed into this one. */
  count?: number;
  /** The individual items folded into a rollup, newest last. */
  items?: { id: string; label: string; at: string }[];
  /** Held for quiet hours: releases at this ISO time. */
  scheduledFor?: string;
  /** Repeats suppressed by a suppress-repeat rule since this was sent. */
  suppressed?: number;
  /** Which recipient is the signed-in user, if any ("To you" vs "To Priya"). */
  forMe?: boolean;
  /** Label for the deep link button ("Open exception", "Review plan"). */
  linkLabel?: string;
  /** Mentions always deliver regardless of settings / quiet hours. */
  mention?: boolean;
  /** Internal: the de-duplication key this delivery is grouped under. */
  dedupKey?: string;
}

export type EmailStatus = 'sent' | 'queued' | 'suppressed';

export interface EmailMessage {
  id: string;
  notificationId: string;
  eventId: string;
  module: NotificationModule;
  priority: NotificationPriority;
  to: Person[];
  cc: Person[];
  subject: string;
  preheader: string;
  /** Lead paragraph under the title. */
  lead: string;
  facts: Fact[];
  quoted?: { by: string; text: string };
  items?: { label: string; at: string }[];
  ctaLabel: string;
  /** Why the recipient got it (footer). */
  reason: string;
  status: EmailStatus;
  createdAt: string;
  sentAt?: string;
  scheduledFor?: string;
}

export interface QuietHours {
  enabled: boolean;
  /** "HH:MM" in IST. */
  start: string;
  end: string;
}

/** Per-event user preference. Absent → the catalogue default applies.
 *  In-app delivery is always on; the only choice is whether an email goes too. */
export interface EventPreference {
  /** Whether this event also emails the user. */
  email?: boolean;
  /** @deprecated earlier shape — read for compatibility, no longer written. */
  enabled?: boolean;
  /** @deprecated earlier shape — read for compatibility, no longer written. */
  channels?: NotificationChannel[];
}

export interface NotificationPreferences {
  quietHours: QuietHours;
  /** Show a toast for P0 deliveries while the app is open. */
  toastCritical: boolean;
  /** Comment emails (EXC-15) are batched into one roll-up email… */
  emailBatching: boolean;
  /** …sent every this many hours (1 = hourly). The user's choice. */
  emailBatchHours: number;
  events: Record<string, EventPreference>;
}

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  quietHours: { enabled: true, start: '22:00', end: '08:00' },
  toastCritical: true,
  emailBatching: true,
  emailBatchHours: 1,
  events: {},
};

/** What a trigger site hands to `notify()`. */
export interface NotifyInput {
  eventId: string;
  title: string;
  message: string;
  actor?: string;
  facts?: Fact[];
  quoted?: { by: string; text: string };
  recipients: Person[];
  watchers?: Person[];
  /** Where "Open" goes. */
  link?: PlatformNotification['link'];
  linkLabel?: string;
  /** Groups repeats of one operation (bulk assign, share, publish…). */
  operationKey?: string;
  /** Groups repeats of one subject (exception id + actor, workflow + error…). */
  dedupKey?: string;
  /** Label for this item inside a rollup ("EXC003 · Vendor invoice…"). */
  itemLabel?: string;
  /** An @mention — always delivered, bypasses quiet hours. */
  mention?: boolean;
  /** Force the delivery time (seeds / tests). */
  at?: string;
}
