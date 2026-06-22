import { useEffect, useRef } from 'react';
import { useToast } from '../../../shared/Toast';
import { PROCESSING_MESSAGES, PROCESSING_DURATION_MS } from '../mockExtraction';

/**
 * Screen 3 — mocked extraction, surfaced as a corner toast rather than a
 * full-screen step. The "Processing" pill was removed from the stepper; while
 * extraction runs the rail sits on "Extraction" and this component fires a
 * bottom-right loading toast that cycles the status messages, resolves to a
 * success toast when extraction completes, then advances to the summary.
 */
export default function Step3Processing({ onDone }: { onDone: () => void }) {
  const { addToast, updateToast, removeToast } = useToast();
  // onDone's identity can change between renders; pin it so the timers fire once.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const id = addToast({
      type: 'loading',
      title: 'Extracting your report',
      message: PROCESSING_MESSAGES[0],
    });

    // Cycle the status line through the same messages the old screen showed.
    const stepMs = PROCESSING_DURATION_MS / PROCESSING_MESSAGES.length;
    let i = 0;
    const tick = window.setInterval(() => {
      i = Math.min(i + 1, PROCESSING_MESSAGES.length - 1);
      updateToast(id, { message: PROCESSING_MESSAGES[i] });
    }, stepMs);

    const done = window.setTimeout(() => {
      window.clearInterval(tick);
      // Extraction finished — close the toast automatically and reveal the
      // Extraction summary (which carries its own "We found N observations" banner).
      removeToast(id);
      onDoneRef.current();
    }, PROCESSING_DURATION_MS);

    // Remove the toast on cleanup too. Under React StrictMode the effect mounts
    // twice; without this the first toast is orphaned (the re-add is deduped, so
    // the timer's removeToast targets an id that was never shown) and lingers
    // forever. Tearing it down here means the second mount re-adds a live toast
    // whose timer can actually close it.
    return () => { window.clearInterval(tick); window.clearTimeout(done); removeToast(id); };
    // addToast/updateToast/removeToast are stable (useCallback in the provider); run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Calm skeleton standing in for the Extraction summary that's loading; the
  // live progress lives in the corner toast.
  return (
    <div
      className="rounded-[12px] border border-canvas-border bg-canvas-elevated p-6"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Extracting your report…</span>
      <div className="animate-pulse space-y-4 motion-reduce:animate-none">
        <div className="h-5 w-56 rounded bg-canvas-border" />
        <div className="h-3 w-80 max-w-full rounded bg-canvas-border" />
        <div className="mt-6 space-y-3">
          {Array.from({ length: 4 }).map((_, row) => (
            <div key={row} className="flex items-center gap-4">
              <div className="h-4 w-4 shrink-0 rounded-full bg-canvas-border" />
              <div className="h-4 flex-1 rounded bg-canvas-border" />
              <div className="h-4 w-20 shrink-0 rounded bg-canvas-border" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
