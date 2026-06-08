import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface ListPlaceholderProps {
  /** Icon shown in the chip — section icon for empties, Search for no-results. */
  icon: LucideIcon;
  /** Headline — set in display serif. Keep it short and confident. */
  title: string;
  /** Optional supporting body copy below the headline. */
  body?: string;
  /** Optional CTA / actions slot (e.g. a primary Button or a "Clear all" link). */
  action?: ReactNode;
  className?: string;
}

// Shared empty / no-results placeholder for list surfaces across the Process Hub
// and the RACM/control screens. Deliberately the visual sibling of ListLoadError
// (same chip, heading and body recipe) so empty, no-results and error states all
// read as one family. Use the section icon for "nothing here yet" and Search for
// "nothing matched your filters".
export default function ListPlaceholder({
  icon: Icon,
  title,
  body,
  action,
  className = '',
}: ListPlaceholderProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}>
      <div className="w-12 h-12 rounded-lg bg-paper-100 flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-ink-500" />
      </div>
      <h3 className="text-[0.9375rem] font-display text-ink-800 mb-1">{title}</h3>
      {body && <p className="text-[0.8125rem] text-ink-600 mb-5 max-w-[320px]">{body}</p>}
      {action}
    </div>
  );
}
