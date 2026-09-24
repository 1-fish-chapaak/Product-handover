import { ArrowLeftRight, ChevronDown, GitCompareArrows, Pin, X } from 'lucide-react';
import type { CompareSide } from './compareTypes';

/** A = brand, B = a lighter brand with a ring — different in lightness and
 *  shape, never hue alone. */
export function SideSwatch({ side, className = '' }: { side: 'a' | 'b'; className?: string }) {
  return side === 'a'
    ? <span className={`inline-block size-2 rounded-full bg-brand-600 shrink-0 ${className}`} aria-hidden="true" />
    : <span className={`inline-block size-2 rounded-full bg-brand-300 ring-1 ring-inset ring-brand-500/40 shrink-0 ${className}`} aria-hidden="true" />;
}

/** The header control's "on" state: both sides, swap, exit. */
export function CompareChip({ a, b, onPick, onSwap, onExit }: {
  a: CompareSide; b: CompareSide;
  onPick: (side: 'a' | 'b') => void;
  onSwap: () => void;
  onExit: () => void;
}) {
  const sideBtn = (which: 'a' | 'b', s: CompareSide) => (
    <button
      type="button"
      onClick={() => onPick(which)}
      aria-label={`Change ${which.toUpperCase()}: ${s.label}`}
      className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-[0.75rem] font-semibold text-brand-800 hover:bg-brand-100 tabular-nums cursor-pointer transition-colors"
    >
      <SideSwatch side={which} />
      <span className="max-w-[9rem] truncate">{s.label}</span>
      <ChevronDown size={11} className="text-brand-600" aria-hidden="true" />
    </button>
  );
  return (
    <div role="group" aria-label={`Compare: ${a.label} vs ${b.label}`} className="inline-flex items-center h-9 rounded-lg border border-brand-200 bg-brand-50 pl-1 pr-0.5 gap-0.5">
      {sideBtn('a', a)}
      <span className="text-[0.6875rem] text-brand-600/70 px-0.5 select-none">vs</span>
      {sideBtn('b', b)}
      <button type="button" onClick={onSwap} aria-label="Swap A and B" title="Swap A and B" className="size-7 rounded-md text-brand-600 hover:bg-brand-100 inline-flex items-center justify-center cursor-pointer transition-colors">
        <ArrowLeftRight size={13} aria-hidden="true" />
      </button>
      <button type="button" onClick={onExit} aria-label="Exit compare" title="Exit compare" className="size-7 rounded-md text-brand-600 hover:bg-brand-100 inline-flex items-center justify-center cursor-pointer transition-colors">
        <X size={13} aria-hidden="true" />
      </button>
    </div>
  );
}

/** The "on" state when the comparison is a whole series: how many periods, in
 *  what view, and the span — one button back into the popover, plus exit. */
export function CompareSeriesChip({ count, grainLabel, first, last, onPick, onExit }: {
  count: number; grainLabel: string; first: string; last: string;
  onPick: () => void;
  onExit: () => void;
}) {
  return (
    <div role="group" aria-label={`Compare: ${count} periods, ${grainLabel}, ${first} to ${last}`} className="inline-flex items-center h-9 rounded-lg border border-brand-200 bg-brand-50 pl-1 pr-0.5 gap-0.5">
      <button
        type="button"
        onClick={onPick}
        aria-label={`Change comparison: ${count} ${grainLabel} periods, ${first} to ${last}`}
        className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-[0.75rem] font-semibold text-brand-800 hover:bg-brand-100 tabular-nums cursor-pointer transition-colors"
      >
        <GitCompareArrows size={12} className="text-brand-600 shrink-0" aria-hidden="true" />
        <span className="max-w-[13rem] truncate">{count} periods · {first} – {last}</span>
        <ChevronDown size={11} className="text-brand-600" aria-hidden="true" />
      </button>
      <button type="button" onClick={onExit} aria-label="Exit compare" title="Exit compare" className="size-7 rounded-md text-brand-600 hover:bg-brand-100 inline-flex items-center justify-center cursor-pointer transition-colors">
        <X size={13} aria-hidden="true" />
      </button>
    </div>
  );
}

/** A side as a strip chip (click → change it). */
export function CompareSideChip({ side, which, onClick }: { side: CompareSide; which: 'a' | 'b'; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={`${which.toUpperCase()}: ${side.label}`} className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-[0.6875rem] font-medium text-brand-700 tabular-nums hover:bg-brand-100 cursor-pointer transition-colors">
      <SideSwatch side={which} />{side.label}
    </button>
  );
}

export type CompareStatus = 'inherit' | 'pinned' | 'excluded' | 'not-comparable';

/** Widget subtitle badge. Text always, tone quiet. */
export function CompareStatusBadge({ status, pinnedLabel, reason }: { status: CompareStatus; pinnedLabel?: string; reason?: string }) {
  if (status === 'inherit') return null;
  if (status === 'pinned') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs bg-brand-50 text-brand-700 text-[0.5625rem] font-semibold whitespace-nowrap" title={pinnedLabel ? `Pinned comparison · ${pinnedLabel}` : 'Pinned comparison'}>
        <Pin size={8} aria-hidden="true" /> Pinned{pinnedLabel ? ` · ${pinnedLabel}` : ''}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs border border-dashed border-canvas-border text-ink-400 text-[0.5625rem] font-semibold whitespace-nowrap" title={reason}>
      <GitCompareArrows size={8} aria-hidden="true" /> {status === 'excluded' ? 'Not compared' : 'Not comparable'}
    </span>
  );
}
