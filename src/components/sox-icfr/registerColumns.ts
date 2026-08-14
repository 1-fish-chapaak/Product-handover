import { useEffect, useRef, useState } from 'react';

/**
 * Shared column machinery for the two control registers — the audit-level one
 * (ControlRegister) and the engagement-level library (ControlLibrary).
 *
 * They show different columns for different reasons: the audit register is about
 * how testing is going, the library about what the control is made of and where
 * it has been used. What they share is the mechanics — a fixed-layout table
 * whose widths are the reader's to drag and keep, and a header cell with a grip
 * on its right edge. That lives here so the two can never drift apart on
 * behaviour while staying free to differ on content.
 */

// ─── Grouping ────────────────────────────────────────────────────────────────────

export type GroupBy = 'none' | 'process' | 'entity';
export const GROUP_OPTIONS = [
  { value: 'process', label: 'Process' },
  { value: 'entity', label: 'Entity' },
  { value: 'none', label: 'No grouping' },
];

/** What a row is stacked under. An engagement that was never scoped by entity has
 *  no company to file a control under, and saying so is better than a blank. */
export const groupKeyOf = (c: { process: string; entity?: string }, by: GroupBy): string =>
  by === 'entity' ? (c.entity ?? 'No entity recorded') : c.process;

/** Every company a row belongs under when the list is stacked by entity.
 *
 *  A control answering for several companies is ONE row, but stacking by entity
 *  asks "is Solar done?" — and a control whose conclusion covers Solar has to
 *  appear under Solar or the answer is wrong. So a shared row files under each
 *  company it covers; an ordinary row files under its one. */
export const groupKeysOf = (c: { process: string; entity?: string; entities?: string[] }, by: GroupBy): string[] => {
  if (by !== 'entity') return [c.process];
  const covers = c.entities ?? [];
  return covers.length > 1 ? covers : [c.entity ?? 'No entity recorded'];
};

/** Does this row answer for the named company — performed there, or covered? */
export const rowCovers = (c: { entity?: string; entities?: string[] }, name: string): boolean =>
  c.entity === name || (c.entities?.includes(name) ?? false);

/** Every company a row names, for a filter facet or a search index. */
export const rowEntities = (c: { entity?: string; entities?: string[] }): string[] =>
  Array.from(new Set([...(c.entities ?? []), ...(c.entity ? [c.entity] : [])]));

// ─── Widths ──────────────────────────────────────────────────────────────────────

/** Narrow enough to be a deliberate choice, wide enough to still show something. */
export const COL_MIN = 64;

export interface ColumnDef<K extends string> { key: K; w: number }

/**
 * Column widths the reader owns.
 *
 * Returns `widthOf` for the colgroup, `totalWidth` for the table's own width (so
 * it scrolls rather than squeezing), and `th(key)` — the width-and-grip props one
 * header cell needs, which keeps the header reading as a plain list of columns.
 */
export function useColumnWidths<K extends string>(storageKey: string, cols: readonly ColumnDef<K>[]) {
  const [colw, setColw] = useState<Partial<Record<K, number>>>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch { return {}; }
  });
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(colw)); } catch { /* private mode — the widths just don't persist */ }
  }, [colw, storageKey]);

  const widthOf = (k: K): number => colw[k] ?? cols.find(c => c.key === k)!.w;
  const totalWidth = cols.reduce((sum, c) => sum + widthOf(c.key), 0);

  // Cleanup for a drag still in flight, so an unmount mid-drag can't leave
  // listeners on the window and the body stuck in a col-resize cursor.
  const dragCleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => dragCleanup.current?.(), []);

  const startResize = (e: React.MouseEvent, key: K) => {
    e.preventDefault();
    e.stopPropagation();                       // never let the grip trip the header's filter
    const startX = e.clientX;
    const startW = widthOf(key);
    const onMove = (ev: MouseEvent) =>
      setColw(prev => ({ ...prev, [key]: Math.max(COL_MIN, Math.round(startW + (ev.clientX - startX))) }));
    const done = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', done);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      dragCleanup.current = null;
    };
    dragCleanup.current = done;
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', done);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const th = (key: K) => ({ width: widthOf(key), onResize: (e: React.MouseEvent) => startResize(e, key) });

  return { widthOf, totalWidth, th };
}
