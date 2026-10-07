import { useEffect, useRef } from 'react';

/**
 * Keyboard behaviour for an inline dialog: drop `<DialogFocus />` as a child of
 * the element that carries `role="dialog"` and it
 *   · moves focus into the dialog on open (unless something inside already has it),
 *   · keeps Tab / Shift+Tab inside it,
 *   · calls `onEscape` on Escape — pass the same handler the backdrop click uses;
 *     leave it out when the dialog already decides what Escape means,
 *   · hands focus back to whatever had it before, on close.
 *
 * Renders a hidden span, so it never takes part in layout. Dialogs stack: only
 * the most recently opened one answers the keyboard, so a confirm opened over a
 * modal closes on its own and leaves the modal underneath alone.
 */
const FOCUSABLE = [
  'a[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const open: object[] = [];

export default function DialogFocus({ onEscape }: { onEscape?: () => void }) {
  const anchor = useRef<HTMLSpanElement>(null);
  const escRef = useRef(onEscape);
  useEffect(() => { escRef.current = onEscape; });

  useEffect(() => {
    const dialog = anchor.current?.parentElement;
    if (!dialog) return;
    const token = {};
    open.push(token);
    const before = document.activeElement as HTMLElement | null;
    const focusables = () => Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE))
      .filter(el => el.offsetParent !== null || el === document.activeElement);

    if (!dialog.contains(document.activeElement)) {
      const first = focusables()[0];
      if (first) first.focus({ preventScroll: true });
      else { if (!dialog.hasAttribute('tabindex')) dialog.setAttribute('tabindex', '-1'); dialog.focus({ preventScroll: true }); }
    }

    const onKey = (e: KeyboardEvent) => {
      if (open[open.length - 1] !== token) return;
      if (e.key === 'Escape' && escRef.current) { escRef.current(); return; }
      if (e.key !== 'Tab') return;
      const list = focusables();
      if (list.length === 0) { e.preventDefault(); return; }
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement;
      if (!dialog.contains(active)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      const i = open.indexOf(token);
      if (i >= 0) open.splice(i, 1);
      // only when focus is still ours — a dialog that handed off to another has already moved it on
      const active = document.activeElement;
      const ours = !active || active === document.body || dialog.contains(active);
      if (ours && before && before.isConnected) before.focus({ preventScroll: true });
    };
  }, []);

  return <span ref={anchor} hidden aria-hidden="true" />;
}
