import { fmtIst } from './service';
import { relativeTime } from './relativeTime';

export default function NotificationTimestamp({ iso, className = '' }: { iso: string; className?: string }) {
  return (
    <time dateTime={iso} title={fmtIst(iso)} className={`shrink-0 text-[0.6875rem] tabular-nums whitespace-nowrap text-[var(--notification-muted-text)] ${className}`}>
      {relativeTime(iso)}
    </time>
  );
}
