import { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';

/**
 * Inline rename editor — input + save/cancel. Single source of truth for the
 * "click to rename in place" affordance across the data-source surfaces (grid
 * tile, list row, file row). Auto-selects on mount; Enter/blur commits, Escape
 * cancels. The save and cancel buttons use onMouseDown-preventDefault so
 * clicking them doesn't blur the input first (which would fire a commit before
 * the click registers).
 *
 * `size` controls input density only: `md` (default) for cards, `sm` for the
 * denser file rows.
 */

const INPUT_SIZE: Record<'sm' | 'md', string> = {
  sm: 'h-7 px-2 rounded-md',
  md: 'h-8 px-2.5 rounded-lg',
};

export default function InlineRename({
  initial,
  onCommit,
  onCancel,
  size = 'md',
}: {
  initial: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
  size?: 'sm' | 'md';
}) {
  const [draft, setDraft] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.select(); }, []);
  const commit = () => {
    const n = draft.trim();
    if (n && n !== initial) onCommit(n);
    else onCancel();
  };
  return (
    <div className="flex items-center gap-1.5 flex-1 min-w-0" onClick={e => e.stopPropagation()}>
      <input
        ref={ref}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') commit(); else if (e.key === 'Escape') onCancel(); }}
        onBlur={commit}
        className={`flex-1 min-w-0 text-[0.875rem] font-semibold text-ink-900 bg-canvas-elevated border border-brand-600 focus:outline-none ${INPUT_SIZE[size]}`}
      />
      <button onMouseDown={e => e.preventDefault()} onClick={commit} className="p-1.5 text-brand-700 hover:bg-brand-50 rounded-md cursor-pointer shrink-0 transition-colors" aria-label="Save name">
        <Check size={15} />
      </button>
      <button onMouseDown={e => e.preventDefault()} onClick={onCancel} className="p-1.5 text-ink-500 hover:bg-brand-50 rounded-md cursor-pointer shrink-0 transition-colors" aria-label="Cancel rename">
        <X size={15} />
      </button>
    </div>
  );
}
