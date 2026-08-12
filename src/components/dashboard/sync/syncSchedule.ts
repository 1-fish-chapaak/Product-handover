// ─── Dashboard scheduled data sync — model + helpers ───
// When a dashboard is bound to a live source (a SQL database), the user can turn
// on an automatic sync so the dashboard re-queries and refreshes on a cadence.
// This module is the pure layer: the schedule shape, a human summary, the next
// run time, and the (demo-compressed) interval the prototype uses to actually
// tick refreshes within a session. No backend, no real cron.

export type SyncFrequency = 'custom' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'semiannual' | 'annual';
export type CustomUnit = 'minutes' | 'hours';

export interface SyncSchedule {
  /** Master switch — off = manual refresh only. */
  enabled: boolean;
  frequency: SyncFrequency;
  /** Time of day the sync runs, "HH:MM" 24h (daily / weekly / monthly). */
  time: string;
  /** Days of week for weekly (0=Sun … 6=Sat). */
  days: number[];
  /** Day of month for monthly (1–31; 31 shown as "Last day"). */
  dayOfMonth: number;
  /** Custom cadence — every N minutes/hours. */
  everyN: number;
  everyUnit: CustomUnit;
  /** Send a notification if a sync fails. */
  notifyOnFailure: boolean;
}

export const DEFAULT_SYNC_SCHEDULE: SyncSchedule = {
  enabled: false,
  frequency: 'daily',
  time: '06:00',
  days: [1, 2, 3, 4, 5],
  dayOfMonth: 1,
  everyN: 30,
  everyUnit: 'minutes',
  notifyOnFailure: true,
};

export const cloneSchedule = (s: SyncSchedule): SyncSchedule => JSON.parse(JSON.stringify(s));

// ─── formatting ───

const DAY_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_INITIAL = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export { DAY_LABEL, DAY_INITIAL };

/** "6:00 AM" from "06:00". */
export function fmtTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

const ordinal = (n: number) => {
  if (n === 31) return 'last day';
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

/** A one-line human summary of the schedule (for the pill + save confirmation). */
export function summarizeSchedule(s: SyncSchedule): string {
  if (!s.enabled) return 'Off';
  switch (s.frequency) {
    case 'custom':
      return `Every ${s.everyN} ${s.everyUnit === 'minutes' ? (s.everyN === 1 ? 'minute' : 'minutes') : (s.everyN === 1 ? 'hour' : 'hours')}`;
    case 'hourly':
      return 'Every hour';
    case 'daily':
      return `Daily at ${fmtTime(s.time)}`;
    case 'weekly': {
      const d = [...s.days].sort((a, b) => a - b);
      let when: string;
      if (d.length === 7) when = 'Every day';
      else if (d.length === 5 && [1, 2, 3, 4, 5].every(x => d.includes(x))) when = 'Every weekday';
      else if (d.length === 2 && d.includes(0) && d.includes(6)) when = 'Weekends';
      else if (d.length === 0) when = 'Weekly';
      else when = d.map(x => DAY_LABEL[x]).join(', ');
      return `${when} at ${fmtTime(s.time)}`;
    }
    case 'monthly':
      return `Monthly on the ${ordinal(s.dayOfMonth)} at ${fmtTime(s.time)}`;
    case 'quarterly':
      return `Quarterly on the ${ordinal(s.dayOfMonth)} at ${fmtTime(s.time)}`;
    case 'semiannual':
      return `Half-yearly on the ${ordinal(s.dayOfMonth)} at ${fmtTime(s.time)}`;
    case 'annual':
      return `Yearly on the ${ordinal(s.dayOfMonth)} at ${fmtTime(s.time)}`;
  }
}

// ─── next run ───

function atTime(base: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d;
}

/** The next moment this schedule would fire, relative to `now`. */
export function nextRun(s: SyncSchedule, now: Date): Date | null {
  if (!s.enabled) return null;
  switch (s.frequency) {
    case 'custom': {
      const ms = s.everyN * (s.everyUnit === 'minutes' ? 60_000 : 3_600_000);
      return new Date(now.getTime() + ms);
    }
    case 'hourly': {
      const d = new Date(now);
      d.setMinutes(0, 0, 0);
      d.setHours(d.getHours() + 1);
      return d;
    }
    case 'daily': {
      let d = atTime(now, s.time);
      if (d <= now) d = atTime(new Date(now.getTime() + 86_400_000), s.time);
      return d;
    }
    case 'weekly': {
      if (!s.days.length) return null;
      for (let i = 0; i < 8; i++) {
        const cand = atTime(new Date(now.getTime() + i * 86_400_000), s.time);
        if (s.days.includes(cand.getDay()) && cand > now) return cand;
      }
      return null;
    }
    case 'monthly': return nextMonthlyLike(s, now, () => true);
    // Quarterly / half-yearly / yearly are anchored to the calendar: they fire
    // on `dayOfMonth` in the quarter starts (Jan/Apr/Jul/Oct), the half-year
    // starts (Jan/Jul), or the year start (Jan) respectively.
    case 'quarterly': return nextMonthlyLike(s, now, m => m % 3 === 0);
    case 'semiannual': return nextMonthlyLike(s, now, m => m % 6 === 0);
    case 'annual': return nextMonthlyLike(s, now, m => m === 0);
  }
}

/** Next `dayOfMonth`@time occurrence in a month the predicate allows. */
function nextMonthlyLike(s: SyncSchedule, now: Date, allowedMonth: (monthIndex: number) => boolean): Date | null {
  for (let i = 0; i < 14; i++) {
    const abs = now.getMonth() + i;
    const year = now.getFullYear() + Math.floor(abs / 12);
    const month = ((abs % 12) + 12) % 12;
    if (!allowedMonth(month)) continue;
    const last = new Date(year, month + 1, 0).getDate();
    const day = Math.min(s.dayOfMonth, last);
    const cand = atTime(new Date(year, month, day), s.time);
    if (cand > now) return cand;
  }
  return null;
}

/** "Today, 6:00 AM" / "Tomorrow, 6:00 AM" / "Mon, 12 Aug · 6:00 AM". */
export function fmtNextRun(d: Date, now: Date): string {
  const time = fmtTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(d) - startOfDay(now)) / 86_400_000);
  if (dayDiff === 0) return `Today, ${time}`;
  if (dayDiff === 1) return `Tomorrow, ${time}`;
  const label = d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
  return `${label} · ${time}`;
}

/** Demo-compressed interval so a sync visibly ticks within a session. Real
 *  cadences (hourly/daily/…) are impractical to wait for in a prototype, so we
 *  map them to short intervals — the behaviour (auto refresh on a cadence) is
 *  what's being demonstrated, not the wall-clock spacing. */
export function toDemoIntervalMs(s: SyncSchedule): number | null {
  if (!s.enabled) return null;
  switch (s.frequency) {
    case 'custom': {
      const realMin = s.everyUnit === 'minutes' ? s.everyN : s.everyN * 60;
      return Math.max(20_000, Math.min(120_000, realMin * 1000)); // ~1s per real-minute, clamped
    }
    case 'hourly': return 45_000;
    case 'daily': return 60_000;
    case 'weekly': return 90_000;
    case 'monthly': return 120_000;
    case 'quarterly': return 150_000;
    case 'semiannual': return 180_000;
    case 'annual': return 240_000;
  }
}
