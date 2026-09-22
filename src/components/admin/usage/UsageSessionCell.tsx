/**
 * The row's reference, and a button that copies it.
 *
 * Which reference depends on the surface: a chat row carries its session, a
 * workflow row carries its execution. The id is shown truncated because a full
 * reference crowds every other column out of the row, and the truncation is why
 * the copy button exists at all: you cannot select what is not rendered. The
 * full reference stays in the title.
 *
 * It copies the reference itself rather than a deep link. A link that opened
 * nothing would be confidently wrong, which is worse than offering the id that
 * finds the run in the log.
 *
 * Failure is shown, not swallowed. `navigator.clipboard` rejects outside a
 * secure context, and a copy button that silently does nothing is worse than
 * one that says it did not work: the reader pastes stale clipboard content and
 * only finds out later.
 */

import { useEffect, useRef, useState } from 'react';
import { Check, Copy, X } from 'lucide-react';
import type { UsageTurn } from '../../../data/usage/metering';

type CopyState = 'idle' | 'copied' | 'failed';

const FEEDBACK_MS = 1500;

export default function UsageSessionCell({ turn }: { turn: UsageTurn }) {
  const reference = turn.execution_id ?? turn.session_id;
  const [state, setState] = useState<CopyState>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Rows unmount on every page change, and a pending timer that fires
  // afterwards would set state on a component that is gone.
  useEffect(() => () => clearTimeout(timer.current), []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(reference);
      setState('copied');
    } catch {
      setState('failed');
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), FEEDBACK_MS);
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span title={reference} className="font-mono text-[0.6875rem]">
        {reference.slice(0, 8)}&hellip;
      </span>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={`Copy reference ${reference}`}
        title="Copy reference"
        className="cursor-pointer rounded p-0.5 text-text-secondary hover:bg-canvas hover:text-ink-900"
      >
        {state === 'idle' ? <Copy className="h-3.5 w-3.5" /> : null}
        {state === 'copied' ? <Check className="h-3.5 w-3.5 text-compliant-600" /> : null}
        {state === 'failed' ? <X className="h-3.5 w-3.5 text-risk-600" /> : null}
      </button>
    </span>
  );
}
