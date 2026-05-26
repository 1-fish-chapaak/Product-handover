import { useEffect, type RefObject } from 'react';

/**
 * Traps Tab / Shift+Tab focus inside the referenced container while `active`.
 * On mount it focuses the first focusable element; on unmount it restores
 * focus to whatever element had it before activation. Also wires Escape →
 * `onEscape` when provided so callers can centralise close behaviour.
 *
 * Pair with `role="dialog"` + `aria-modal="true"` on the container for
 * complete modal semantics.
 */
const FOCUSABLE = [
  'a[href]',
  'area[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  'iframe',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  onEscape?: () => void,
) {
  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Focus the first focusable element (or the container itself).
    const focusables = Array.from(
      container.querySelectorAll<HTMLElement>(FOCUSABLE),
    ).filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null);
    (focusables[0] ?? container).focus({ preventScroll: true });

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onEscape) {
        e.stopPropagation();
        onEscape();
        return;
      }
      if (e.key !== 'Tab') return;
      const list = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null);
      if (list.length === 0) {
        e.preventDefault();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;
      if (e.shiftKey && activeEl === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && activeEl === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [active, containerRef, onEscape]);
}
