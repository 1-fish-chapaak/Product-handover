import { useEffect, useRef, useState } from 'react';

// Smoothing buffer for streamed text.
//
// Token deltas arrive bursty (a chunk every ~20-30ms, sometimes several at
// once). Rendering each delta raw makes the text jump. This hook reveals a
// GROWING target string toward its current length at a steady display rate,
// catching up gently when a burst lands — so the prose flows instead of
// stuttering. Unlike useTypewriter (fixed string), the target keeps changing as
// `text.delta` events accumulate.
//
// Returns the same { shown, done } shape as useTypewriter so callers swap easily.
export function useSmoothText(
  target: string,
  { reduced = false }: { reduced?: boolean } = {},
): { shown: string; done: boolean } {
  const [count, setCount] = useState(reduced ? target.length : 0);
  const countRef = useRef(count);

  useEffect(() => {
    if (reduced) {
      countRef.current = target.length;
      setCount(target.length);
      return;
    }
    let raf = 0;
    const tick = () => {
      const t = target.length;
      if (countRef.current >= t) return; // caught up — pause until the target grows
      const remaining = t - countRef.current;
      // Steady minimum pace + gentle proportional catch-up so a big burst
      // resolves quickly without snapping.
      const step = Math.max(2, Math.ceil(remaining / 10));
      countRef.current = Math.min(t, countRef.current + step);
      setCount(countRef.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, reduced]);

  return { shown: target.slice(0, count), done: count >= target.length };
}
