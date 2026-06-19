import { useEffect, useState } from 'react';
import { useReducedMotion } from 'motion/react';

interface TypewriterOptions {
  /** When false the hook holds at 0 chars (lets a parent gate the onset). */
  enabled?: boolean;
  /** Base per-character delay in ms. Auto-speeds up for long bodies. */
  baseDelay?: number;
}

// Reveals `text` one character at a time with light human-feel jitter and a
// longer pause after sentence/clause punctuation, so prose reads like it's
// being thought rather than spat out. Honours prefers-reduced-motion (and a
// disabled state) by resolving instantly to the full string.
//
// Returns the currently-visible prefix plus a `done` flag the caller uses to
// drop the blinking caret. The reveal is purely presentational — the full
// `text` is always known up front (this is a mocked stream, not a network one).
export function useTypewriter(text: string, { enabled = true, baseDelay = 9 }: TypewriterOptions = {}) {
  const prefersReducedMotion = useReducedMotion();
  const animate = enabled && !prefersReducedMotion && text.length > 0;
  const target = text.length;

  // Seeded so the non-animated path (reduced motion / disabled) is correct on
  // first paint with no effect needed. The animated path starts at 0 and is
  // advanced only from timer callbacks below — never synchronously in render or
  // an effect body. (Within the app a given message's text is set once, so no
  // mid-life reset is required.)
  const [count, setCount] = useState(animate ? 0 : target);

  useEffect(() => {
    if (!animate) return;

    // Longer answers reveal a touch faster so a 600-char paragraph doesn't
    // crawl — feels token-like, not like a 1980s teletype.
    const step = target > 360 ? 2 : 1;
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      i = Math.min(target, i + step);
      setCount(i);
      if (i >= target) return;

      const justTyped = text[i - 1];
      let delay: number;
      if (/[.!?]/.test(justTyped)) delay = baseDelay * 16;        // end of sentence — beat
      else if (/[,;:]/.test(justTyped)) delay = baseDelay * 7;    // clause — half beat
      else if (justTyped === '\n') delay = baseDelay * 10;        // new line
      else delay = baseDelay + Math.random() * baseDelay * 1.2;   // jitter
      timer = setTimeout(tick, delay);
    };
    timer = setTimeout(tick, baseDelay);

    return () => clearTimeout(timer);
  }, [text, animate, baseDelay, target]);

  return { shown: text.slice(0, count), done: count >= target };
}
