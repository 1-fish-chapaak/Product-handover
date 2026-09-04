// ─── Shared report-list cells ────────────────────────────────────────────────
//
// The Reports list (All · Shared · ATR) and the per-control report list inside
// an engagement are the same table, so their cells are the same components
// rather than two copies that drift. Anything a report row draws — the name
// cell, the type pill, the format chip, the hover action tooltip, the column
// widths — lives here.
import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { ReportPill } from './ReportPill';
import type { Tone } from '../shared/StatusBadge';
import { reportDisplayName } from './reportName';

// Which format the report is written in: one of the standard ones, or a format
// somebody here built. The column is headed "Format" rather than "Source" —
// "Source" reads as where the data came from, which is not what this says.
// Custom = user-made, so it carries the brand tint; System = generated, neutral.
export function SourceChip({ source }: { source: 'system' | 'custom' | string }) {
  const custom = source === 'custom';
  return (
    <span
      title={custom ? 'Written in a format built in this workspace' : 'Written in one of the standard formats'}
      className={`inline-flex items-center h-6 px-2.5 rounded-full border text-[0.6875rem] font-semibold whitespace-nowrap shrink-0 ${custom ? 'bg-brand-50 text-brand-700 border-brand-200' : 'bg-draft-50 text-ink-600 border-canvas-border'}`}
    >
      {custom ? 'Custom' : 'Standard'}
    </span>
  );
}

/** Hover label for the small icon-only row actions. */
export function ActionTooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="relative group/tt inline-flex">
      {children}
      <span className="pointer-events-none absolute bottom-[calc(100%+4px)] left-1/2 -translate-x-1/2 px-2 py-1 bg-ink-900 text-white text-[0.625rem] font-medium rounded-md whitespace-nowrap opacity-0 group-hover/tt:opacity-100 group-focus-within/tt:opacity-100 transition-opacity z-50">
        {label}
      </span>
    </span>
  );
}

// Canonical "Report" name cell shared by every list-view table (All · IA ·
// Shared · per-control) so the lists never drift: brand tile + type icon, 14px
// name with a quiet secondary subline. Hover affordances only when the row is
// openable.
export function ReportNameCell({
  icon: Icon, iconClass, name, subline, onClick, selectable, selected, isSelecting, onToggleSelect,
}: {
  icon: React.ElementType;
  iconClass?: string;
  name: string;
  subline?: ReactNode;
  onClick?: () => void;
  selectable?: boolean;
  selected?: boolean;
  isSelecting?: boolean;
  onToggleSelect?: () => void;
}) {
  const display = reportDisplayName(name);
  const truncated = display.length > 100 ? display.slice(0, 100) + '…' : display;
  const clickable = Boolean(onClick) || Boolean(selectable);
  // While selecting, a plain row click toggles selection instead of opening.
  const handleClick = () => { if (selectable && isSelecting) onToggleSelect?.(); else onClick?.(); };
  return (
    <div className={`flex items-center gap-3 min-w-0 ${clickable ? 'cursor-pointer' : ''}`} onClick={handleClick}>
      <span className="relative shrink-0 w-9 h-9 flex items-center justify-center">
        {/* Type tile — a soft tone-tinted square so each row carries the same
            type anchor the grid card uses (list↔grid parity). Fades out on
            hover/select so the checkbox sits cleanly on the row bg. */}
        <span aria-hidden="true" className={`absolute inset-0 flex items-center justify-center rounded-md transition-opacity duration-150 ${iconClass ?? 'text-ink-400'} ${selectable ? (selected || isSelecting ? 'opacity-0' : 'opacity-100 group-hover:opacity-0') : 'opacity-100'}`}>
          <Icon size={16} strokeWidth={1.75} />
        </span>
        {selectable && (
          <span
            role="checkbox"
            aria-checked={selected}
            aria-label={selected ? `Deselect ${display}` : `Select ${display}`}
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onToggleSelect?.(); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); onToggleSelect?.(); } }}
            className={`relative w-4 h-4 rounded-sm border flex items-center justify-center transition-opacity duration-150 cursor-pointer ${
              selected
                ? 'bg-brand-600 border-brand-600 text-white opacity-100'
                : isSelecting
                  ? 'bg-paper-0 border-ink-300 opacity-100 hover:border-brand-500'
                  : 'bg-paper-0 border-ink-300 opacity-0 group-hover:opacity-100 hover:border-brand-500'
            }`}
          >
            {selected && <Check size={11} strokeWidth={3} />}
          </span>
        )}
      </span>
      <div className="min-w-0">
        <div className="text-[0.875rem] font-semibold tracking-[-0.006em] text-ink-900 truncate" title={display.length > 100 ? display : undefined}>{truncated}</div>
        {subline && <div className="mt-0.5 text-[0.75rem] text-ink-400 truncate">{subline}</div>}
      </div>
    </div>
  );
}

/** Canonical bordered tone pill (StatusBadge §7.10.4) for every Type/category chip. */
export const TYPE_PILL = (label: string, tone: Tone) => <ReportPill tone={tone}>{label}</ReportPill>;
