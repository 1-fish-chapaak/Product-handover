import { Pencil, Sparkles } from 'lucide-react';
import { cn } from '../../lib/cn';
import type { DesignPoint, OperatingStep } from './types';
import { pointResult, stepResult } from './helpers';

// Ira's work carries ONE quiet marker: a sparkle in the brand purple and a
// one-word state. It is text, not a pill — the pill column is how a register is
// scanned for RESULTS, and Ira's state is a note about who did the work, not a
// verdict. Confirmed work carries no marker at all: once the auditor has
// concluded, the work is theirs and the sparkle would only be noise.
export type IraStateKind = 'review' | 'couldnt' | 'overridden';

const LABEL: Record<IraStateKind, string> = {
  review: 'Ira · review',
  couldnt: 'Ira · couldn’t test',
  overridden: 'overridden',
};

export function IraState({ state, title, className }: { state: IraStateKind; title?: string; className?: string }) {
  // An override is the HUMAN's act, so it drops the sparkle (which marks Ira's
  // own work only) for a pencil, and reads in the high-700 the override tag
  // already uses — the same colour, minus the chip.
  const human = state === 'overridden';
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap text-[0.6875rem]',
        human ? 'text-high-700' : 'text-ink-500',
        className,
      )}
    >
      {human
        ? <Pencil size={9} className="text-ink-400 shrink-0" aria-hidden />
        : <Sparkles size={10} className="text-brand-500 shrink-0" aria-hidden />}
      {LABEL[state]}
      {title && <span className="sr-only">: {title}</span>}
    </span>
  );
}

/** Where Ira pre-wrote or read a value the auditor has not yet confirmed — the
 *  one mark for that on every SOX screen (user ask, 1 Oct). Why Ira put it
 *  there goes on hover (`title`), not in a sentence beside the field. */
export function IraDrafted({ className, title, label = 'draft' }: { className?: string; title?: string; label?: string }) {
  return (
    <span title={title} className={cn('inline-flex items-center gap-1 whitespace-nowrap text-[0.6875rem] text-ink-500', title && 'cursor-help', className)}>
      <Sparkles size={10} className="text-brand-500 shrink-0" aria-hidden />
      Ira · {label}
      {title && <span className="sr-only">: {title}</span>}
    </span>
  );
}

// One rule for both tracks. Order matters: an override outranks anything Ira
// said; a blocked check that is still untested is Ira saying "couldn't"; a
// finished check is Ira's until the control is concluded, after which it is
// confirmed and unmarked.
function stateOf(
  row: { override?: unknown; validation?: { blocked?: string }; confirmed?: unknown },
  result: string,
  concluded: boolean,
): IraStateKind | null {
  if (row.override) return 'overridden';
  if (row.validation?.blocked && result === 'Not tested') return 'couldnt';
  // Confirmed (UX #1, 1 Oct) or concluded: a person owns it now — no mark.
  if (row.validation && !row.validation.blocked && !row.confirmed && !concluded) return 'review';
  return null;
}

export function iraStateOfPoint(p: DesignPoint, concluded: boolean): IraStateKind | null {
  return stateOf(p, pointResult(p), concluded);
}

export function iraStateOfStep(s: OperatingStep, concluded: boolean): IraStateKind | null {
  return stateOf(s, stepResult(s), concluded);
}
