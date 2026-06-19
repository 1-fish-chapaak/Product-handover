import { PencilLine, Ban } from 'lucide-react';

/** The two inline CTAs shown for an unresolved missing field (Screen 4). */
export default function MissingFieldResolver({ onFill, onSkip }: { onFill: () => void; onSkip: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onFill}
        className="inline-flex items-center gap-1.5 h-7 px-2.5 text-[11.5px] font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-[6px] cursor-pointer transition-colors"
      >
        <PencilLine size={12} aria-hidden="true" /> Fill manually
      </button>
      <button
        onClick={onSkip}
        className="inline-flex items-center gap-1.5 h-7 px-2.5 text-[11.5px] font-semibold text-ink-600 bg-canvas hover:bg-canvas-border/60 border border-canvas-border rounded-[6px] cursor-pointer transition-colors"
      >
        <Ban size={12} aria-hidden="true" /> Skip from ATR
      </button>
    </div>
  );
}
