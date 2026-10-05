import { useEffect, useRef } from 'react';

/**
 * Keyboard behaviour for a popover menu: drop `<MenuFocus onClose={…} />` as a
 * child of the element carrying `role="menu"`. On open it focuses the first
 * menu item; ↑ / ↓ / Home / End move between items, Escape closes and hands
 * focus back to the trigger, Tab closes and lets focus move on.
 *
 * Renders a hidden span, so it never takes part in layout.
 */
const ITEM = '[role^="menuitem"]:not([disabled])';

export default function MenuFocus({ onClose }: { onClose: () => void }) {
  const anchor = useRef<HTMLSpanElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });

  useEffect(() => {
    const menu = anchor.current?.parentElement;
    if (!menu) return;
    const trigger = document.activeElement as HTMLElement | null;
    let restore = true;
    const items = () => Array.from(menu.querySelectorAll<HTMLElement>(ITEM));
    items()[0]?.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      const list = items();
      const at = list.indexOf(document.activeElement as HTMLElement);
      const go = (i: number) => { e.preventDefault(); list[(i + list.length) % list.length]?.focus(); };
      if (e.key === 'ArrowDown') go(at + 1);
      else if (e.key === 'ArrowUp') go(at <= 0 ? list.length - 1 : at - 1);
      else if (e.key === 'Home') go(0);
      else if (e.key === 'End') go(list.length - 1);
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeRef.current(); }
      else if (e.key === 'Tab') { restore = false; closeRef.current(); }
    };
    menu.addEventListener('keydown', onKey);
    return () => {
      menu.removeEventListener('keydown', onKey);
      // only when focus is still ours — an item that opened a dialog has already moved it on
      const active = document.activeElement;
      const ours = !active || active === document.body || menu.contains(active);
      if (restore && ours && trigger && trigger.isConnected && trigger !== document.body) trigger.focus({ preventScroll: true });
    };
  }, []);

  return <span ref={anchor} hidden aria-hidden="true" />;
}
