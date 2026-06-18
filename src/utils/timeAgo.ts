const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** Compact relative timestamp for notification rows. */
export function timeAgo(iso: string, reference: Date = new Date()): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';

  const diff = reference.getTime() - then.getTime();
  if (diff < MIN) return 'Just now';
  if (diff < HOUR) return `${Math.floor(diff / MIN)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  if (diff < 2 * DAY) return 'Yesterday';
  if (diff < 7 * DAY) return then.toLocaleDateString('en-US', { weekday: 'short' });
  if (then.getFullYear() === reference.getFullYear()) {
    return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export type DayBucket = 'Today' | 'Yesterday' | 'Earlier';

/** Bucket an ISO timestamp into Today / Yesterday / Earlier for grouping. */
export function dayBucket(iso: string, reference: Date = new Date()): DayBucket {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return 'Earlier';
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(then, reference)) return 'Today';
  const yesterday = new Date(reference);
  yesterday.setDate(yesterday.getDate() - 1);
  if (sameDay(then, yesterday)) return 'Yesterday';
  return 'Earlier';
}
