/**
 * A segmented tab control.
 *
 * One pill per tab on a single track: the selected one lifts onto a white pill
 * in brand ink, the rest sit flat and grey. It reads as a switch between views
 * of the same thing, which is what a tab is, rather than as navigation to
 * somewhere else.
 *
 * A tab that is announced but not built is rendered rather than hidden, and it
 * is disabled and carries its own word for why. A missing tab reads as a
 * feature nobody thought of; a disabled one reads as a feature that is coming.
 */

import type { LucideIcon } from 'lucide-react';

export interface TabPill<T extends string> {
  id: T;
  label: string;
  icon?: LucideIcon;
  /** Announced, not built. Rendered disabled with a badge, never hidden. */
  pending?: boolean;
  /** The word on the badge of a pending tab. */
  pendingLabel?: string;
}

export function TabPills<T extends string>({
  tabs, current, onSelect, className = '',
}: {
  tabs: TabPill<T>[];
  current: T;
  onSelect: (id: T) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={`inline-flex items-center gap-1 rounded-2xl border border-canvas-border bg-canvas p-1 ${className}`}
    >
      {tabs.map(tab => {
        const Icon = tab.icon;
        const pending = tab.pending === true;
        const on = !pending && tab.id === current;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={on}
            disabled={pending}
            aria-disabled={pending}
            title={pending ? `${tab.label} are not built yet` : undefined}
            onClick={() => { if (!pending) onSelect(tab.id); }}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-[0.875rem] transition-colors ${
              pending
                ? 'cursor-not-allowed text-ink-400'
                : on
                  ? 'cursor-pointer bg-canvas-elevated font-semibold text-brand-700 shadow-sm'
                  : 'cursor-pointer font-medium text-ink-400 hover:text-ink-700'
            }`}
          >
            {Icon ? <Icon size={16} className={on ? 'text-brand-600' : undefined} /> : null}
            {tab.label}
            {pending ? (
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-brand-700">
                {tab.pendingLabel ?? 'Soon'}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export default TabPills;
