import { useEffect, useRef, useState } from 'react';
import { Loader2, Check } from 'lucide-react';
import { PROCESSING_MESSAGES, PROCESSING_DURATION_MS } from '../mockExtraction';

/**
 * Screen 3 — mocked extraction. The wait is surfaced in-place: a live progress
 * header (spinner + cycling status + percent + bar + step checklist) sits above
 * a calm skeleton of the summary that's loading. Resolves to the summary when
 * extraction completes.
 */
export default function Step3Processing({ onDone }: { onDone: () => void }) {
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState(0);
  // onDone's identity can change between renders; pin it so the timer fires once.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      const elapsed = now - start;
      // Ease-out so the bar advances briskly early and settles near the end —
      // a longer (~30s) wait feels responsive rather than a slow linear crawl.
      const t = Math.min(1, elapsed / PROCESSING_DURATION_MS);
      const eased = 1 - Math.pow(1 - t, 2);
      setProgress(eased * 100);
      setStep(Math.min(PROCESSING_MESSAGES.length - 1, Math.floor(eased * PROCESSING_MESSAGES.length)));
      if (elapsed < PROCESSING_DURATION_MS) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const done = window.setTimeout(() => onDoneRef.current(), PROCESSING_DURATION_MS);
    return () => { cancelAnimationFrame(raf); window.clearTimeout(done); };
    // Run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="rounded-[12px] border border-canvas-border bg-canvas-elevated overflow-hidden"
      aria-busy="true"
      aria-live="polite"
    >
      {/* Live progress header */}
      <div className="px-6 pt-6 pb-5">
        <div className="flex items-center gap-3.5">
          <span className="w-11 h-11 rounded-[12px] bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
            <Loader2 size={20} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold text-ink-900 leading-tight">Extracting your report</div>
            <div className="text-[12.5px] text-ink-500 mt-0.5">{PROCESSING_MESSAGES[step]}</div>
          </div>
          <span className="text-[15px] font-bold tabular-nums text-brand-700">{Math.round(progress)}%</span>
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-1.5 rounded-full bg-brand-50 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-500" style={{ width: `${progress}%` }} />
        </div>

        {/* Step checklist — done / running / upcoming */}
        <ul className="mt-4 grid sm:grid-cols-2 gap-x-6 gap-y-2">
          {PROCESSING_MESSAGES.map((m, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <li key={m} className="flex items-center gap-2.5 text-[12.5px]">
                <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                  done ? 'bg-compliant text-white' : active ? 'bg-brand-600 text-white' : 'bg-canvas-border'
                }`}>
                  {done ? <Check size={11} aria-hidden="true" /> : active ? <Loader2 size={10} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
                </span>
                <span className={done || active ? 'text-ink-700' : 'text-ink-400'}>{m.replace(/…$/, '')}</span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Calm skeleton of the summary that's loading. */}
      <div className="border-t border-canvas-border px-6 py-5">
        <span className="sr-only">Loading extraction summary…</span>
        <div className="animate-pulse space-y-3 motion-reduce:animate-none">
          {Array.from({ length: 4 }).map((_, row) => (
            <div key={row} className="flex items-center gap-4">
              <div className="h-4 w-4 shrink-0 rounded-full bg-paper-100" />
              <div className="h-4 flex-1 rounded bg-paper-100" style={{ maxWidth: `${[88, 76, 82, 70][row]}%` }} />
              <div className="h-4 w-20 shrink-0 rounded bg-paper-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
