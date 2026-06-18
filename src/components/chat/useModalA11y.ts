/**
 * Modal a11y hooks + small helpers. Lives in its own file so the
 * primitives file can stay component-only (Fast Refresh requirement).
 *
 * Exports:
 *  - useDialogA11y      focus trap + Escape + autofocus + restore + scroll lock
 *  - useStableId        prefixed React useId
 *  - useOnlineStatus    boolean for window online/offline
 *  - useListKeyboardNav ArrowUp/Down/Home/End/Enter for a list of items
 *  - useLocalCollapse   localStorage-backed Record<string, boolean>
 *  - withTimeout        Promise.race wrapper that rejects after N ms
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react';

export function useDialogA11y(
  open: boolean,
  onClose: () => void,
  opts?: {
    initialFocusRef?: React.RefObject<HTMLElement | null>;
    onReturn?: () => void;
  },
) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  // Keep latest callbacks in refs so the effect can be open-only (no re-runs
  // from new closures every render — that would bounce focus out of inputs).
  const onCloseRef = useRef(onClose);
  const onReturnRef = useRef(opts?.onReturn);
  const initialFocusRefRef = useRef(opts?.initialFocusRef);
  useEffect(() => {
    onCloseRef.current = onClose;
    onReturnRef.current = opts?.onReturn;
    initialFocusRefRef.current = opts?.initialFocusRef;
  });

  useEffect(() => {
    if (!open) return;
    restoreRef.current = (document.activeElement as HTMLElement) ?? null;

    const autoFocus = () => {
      const target = initialFocusRefRef.current?.current ?? firstFocusable(dialogRef.current);
      target?.focus({ preventScroll: true });
    };
    const id = window.requestAnimationFrame(autoFocus);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        onReturnRef.current?.();
        return;
      }
      if (e.key === 'Tab') trapTab(e, dialogRef.current);
    };
    document.addEventListener('keydown', onKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const restore = restoreRef.current;

    return () => {
      window.cancelAnimationFrame(id);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      restore?.focus?.({ preventScroll: true });
    };
  }, [open]);

  return dialogRef;
}

function firstFocusable(root: HTMLElement | null): HTMLElement | null {
  if (!root) return null;
  const sel = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
  return root.querySelector<HTMLElement>(sel);
}

function trapTab(e: KeyboardEvent, root: HTMLElement | null) {
  if (!root) return;
  const sel = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const items = Array.from(root.querySelectorAll<HTMLElement>(sel)).filter(el => el.offsetParent !== null);
  if (items.length === 0) return;
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement as HTMLElement | null;
  if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
}

export function useStableId(prefix: string) {
  const id = useId();
  return `${prefix}-${id.replace(/:/g, '')}`;
}

// ─── useOnlineStatus ─────────────────────────────────────────────────────────

export function useOnlineStatus() {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

// ─── useListKeyboardNav ──────────────────────────────────────────────────────
//
// Tracks a "highlighted" index into a list of strings (typically item ids).
// Returns the index, a setter, and a key handler to attach to the search input.
// Pressing Enter calls onChoose with the highlighted item.

export function useListKeyboardNav(
  itemIds: string[],
  onChoose: (id: string) => void,
) {
  // Raw user-driven highlight; clamped at render time so we don't have to
  // reset it via an effect when the list changes (filter, load, etc).
  const [rawHighlight, setRawHighlight] = useState<number>(0);
  const highlight = itemIds.length === 0
    ? -1
    : Math.max(0, Math.min(rawHighlight, itemIds.length - 1));

  const setHighlight = useCallback((h: number) => setRawHighlight(h), []);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (itemIds.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setRawHighlight(h => (Math.max(0, h) + 1) % itemIds.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setRawHighlight(h => (Math.max(0, h) - 1 + itemIds.length) % itemIds.length);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setRawHighlight(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setRawHighlight(itemIds.length - 1);
    } else if (e.key === 'Enter') {
      const id = itemIds[highlight];
      if (id !== undefined) {
        e.preventDefault();
        onChoose(id);
      }
    }
  }, [itemIds, highlight, onChoose]);

  return { highlight, setHighlight, onKeyDown };
}

// ─── useLocalCollapse ────────────────────────────────────────────────────────

export function useLocalCollapse(storageKey: string) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = window.localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) as Record<string, boolean> : {};
    } catch { return {}; }
  });
  useEffect(() => {
    try { window.localStorage.setItem(storageKey, JSON.stringify(collapsed)); }
    catch { /* quota / disabled storage: silent */ }
  }, [storageKey, collapsed]);
  return [collapsed, setCollapsed] as const;
}

// ─── withTimeout ─────────────────────────────────────────────────────────────

export function withTimeout<T>(p: Promise<T>, ms: number, abortSignal?: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      reject(new Error(`Timed out after ${Math.round(ms / 1000)}s. Try again.`));
    }, ms);
    const onAbort = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      reject(new Error('Cancelled.'));
    };
    abortSignal?.addEventListener('abort', onAbort);
    p.then(v => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      abortSignal?.removeEventListener('abort', onAbort);
      resolve(v);
    }, e => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      abortSignal?.removeEventListener('abort', onAbort);
      reject(e);
    });
  });
}
