const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR;

/** "Just now" · "2 min ago" · "3 hr ago" · "Yesterday" · "Sep 17" — the
 *  shortest label that still answers "when did this happen?". */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';
  const diff = now.getTime() - then.getTime();
  if (diff < MIN) return 'Just now';
  if (diff < HOUR) return `${Math.floor(diff / MIN)} min ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} hr ago`;
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  if (then.getTime() >= startOfToday.getTime() - DAY) return 'Yesterday';
  return then.toLocaleDateString('en-US', then.getFullYear() === now.getFullYear() ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
}
