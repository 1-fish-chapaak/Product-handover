import { PencilLine, Ban } from 'lucide-react';

/** The two inline CTAs shown for an unresolved missing field (Screen 4). */
export default function MissingFieldResolver({ onFill, onSkip }: { onFill: () => void; onSkip: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        onClick={onFill}
        title="Fill in this field"
        className="inline-flex items-center gap-1.5 h-7 px-2.5 text-[11.5px] font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-[7px] cursor-pointer transition-colors whitespace-nowrap"
      >
        <PencilLine size={12} aria-hidden="true" /> Fill in
      </button>
      <button
        onClick={onSkip}
        title="Mark as not applicable — leave it out of the ATR"
        className="inline-flex items-center gap-1.5 h-7 px-2.5 text-[11.5px] font-medium text-ink-500 hover:text-ink-800 hover:bg-canvas border border-canvas-border rounded-[7px] cursor-pointer transition-colors whitespace-nowrap"
      >
        <Ban size={12} aria-hidden="true" /> Skip
      </button>
    </div>
  );
}
