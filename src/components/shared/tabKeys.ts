import type { KeyboardEvent } from 'react';

/**
 * onKeyDown for a `role="tablist"` container: ← / → / Home / End move to the
 * neighbouring `role="tab"` and select it (automatic activation — the same as
 * clicking it). Attach it to the tablist; the tabs need no handler of their own.
 */
export function tabKeys(e: KeyboardEvent<HTMLElement>) {
  const tabs = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]:not([disabled])'));
  const at = tabs.indexOf(document.activeElement as HTMLElement);
  if (at < 0) return;
  const n = tabs.length;
  const to = e.key === 'ArrowRight' ? (at + 1) % n : e.key === 'ArrowLeft' ? (at - 1 + n) % n
    : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
  if (to < 0) return;
  e.preventDefault();
  tabs[to].focus();
  tabs[to].click();
}
