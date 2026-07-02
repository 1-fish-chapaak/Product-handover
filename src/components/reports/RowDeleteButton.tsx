// A row delete control that requires a second click to confirm (#4). The trash
// trigger "arms" into an inline Remove / cancel pair, so a single misclick can't
// destroy a section. The armed state auto-cancels after a few seconds. Pair with
// a persistent Undo toast (Toast `persist`) for full recoverability.
import { useEffect, useRef, useState } from 'react';
import { Trash2, Check, X } from 'lucide-react';

const ARM_MS = 3500;

export function RowDeleteButton({ onConfirm, ariaLabel, triggerClassName = '' }: {
  onConfirm: () => void;
  ariaLabel: string;
  /** Classes for the resting trash trigger (match the surrounding row's icons). */
  triggerClassName?: string;
}) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<number | null>(null);
  const clear = () => { if (timer.current) { window.clearTimeout(timer.current); timer.current = null; } };
  useEffect(() => clear, []);

  const arm = () => {
    setArmed(true);
    clear();
    timer.current = window.setTimeout(() => setArmed(false), ARM_MS);
  };
  const disarm = () => { setArmed(false); clear(); };

  if (armed) {
    return (
      <span className="inline-flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); disarm(); onConfirm(); }}
          aria-label={`Confirm — ${ariaLabel}`}
          className="inline-flex items-center gap-1 h-6 pl-1.5 pr-2 rounded-full bg-high-600 text-white text-[0.625rem] font-semibold hover:bg-high-700 transition-colors cursor-pointer whitespace-nowrap"
        >
          <Check size={11} strokeWidth={2.5} /> Remove
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); disarm(); }}
          aria-label="Cancel remove"
          className="w-6 h-6 inline-flex items-center justify-center rounded-full text-ink-400 hover:text-ink-700 hover:bg-canvas-border/60 transition-colors cursor-pointer"
        >
          <X size={12} />
        </button>
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); arm(); }}
      aria-label={ariaLabel}
      className={triggerClassName}
    >
      <Trash2 size={14} />
    </button>
  );
}
