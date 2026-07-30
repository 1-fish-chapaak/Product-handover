import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  /** Headline — set in display serif. Keep it short and confident. */
  title: string;
  /** Optional supporting body copy below the headline. */
  body?: string;
  /** Optional CTA / actions slot rendered below the body. */
  action?: ReactNode;
  /** Tighter padding for inline/embedded empty states (cards, drawers). */
  size?: 'default' | 'compact';
  className?: string;
}

export default function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  size = 'default',
  className = '',
}: EmptyStateProps) {
  const compact = size === 'compact';
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center text-center ${compact ? 'py-6' : 'py-12'} ${className}`}
    >
      <div
        className={`${compact ? 'w-10 h-10 mb-3' : 'w-12 h-12 mb-4'} rounded-full bg-brand-50 flex items-center justify-center`}
      >
        <Icon size={compact ? 18 : 20} className="text-brand-700" strokeWidth={1.75} />
      </div>
      <h3
        className={`font-semibold ${compact ? 'text-[1rem]' : 'text-[1.25rem]'} leading-tight text-ink-900 tracking-tight mb-2`}
      >
        {title}
      </h3>
      {body && (
        <p className="text-[0.84375rem] text-ink-500 leading-relaxed max-w-[420px]">
          {body}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
