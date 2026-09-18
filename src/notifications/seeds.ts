// First-run seed: a believable inbox built from the catalogue samples, spread
// over the last three days, run through the same rules as a live delivery so
// rollups, quiet-hour holds and emails come out exactly as they would for real.
import { DEFAULT_USER } from '../context/CurrentUserContext';
import { sampleInput } from './samples';
import { decide } from './service';
import { DEFAULT_PREFERENCES, type AppNotification, type EmailMessage } from './types';

// [eventId, hours ago, read?]
const PLAN: [string, number, boolean][] = [
  ['EXC-07', 0.4, false],
  ['ACT-06', 1.1, false],
  ['EXC-03', 2.3, false],
  ['APR-01', 3.0, false],
  ['ATR-07', 4.6, false],
  ['WFL-02', 6.2, false],
  ['EXC-15', 7.5, true],
  ['ACT-09', 20.5, false],
  ['EXC-05', 26, true],
  ['ATR-05', 29, true],
  ['ENG-02', 31, true],
  ['ACT-01', 47, true],
  ['DSH-01', 52, true],
  ['WFL-07', 60, true],
  ['ATR-02', 70, true],
];

export function seedNotifications(): { notifications: AppNotification[]; emails: EmailMessage[] } {
  const notifications: AppNotification[] = [];
  const emails: EmailMessage[] = [];
  const now = Date.now();
  // Quiet hours off while seeding so past events aren't "held".
  const prefs = { ...DEFAULT_PREFERENCES, quietHours: { ...DEFAULT_PREFERENCES.quietHours, enabled: false } };
  for (const [id, hoursAgo, read] of PLAN) {
    const input = sampleInput(id);
    if (!input) continue;
    const at = new Date(now - hoursAgo * 3_600_000);
    const d = decide({ ...input, at: at.toISOString() }, { prefs, existing: notifications, currentUserName: DEFAULT_USER.name, now: at });
    if (d.kind !== 'create') continue;
    const n = { ...d.next, read, emailId: d.email?.id };
    notifications.push(n);
    if (d.email) emails.push({ ...d.email, status: 'sent', sentAt: at.toISOString() });
  }
  return { notifications, emails };
}
