/**
 * The page's own small vocabulary.
 *
 * Type and hairlines, and nothing else. No tinted tiles, no side stripes, no
 * grid of identical cards: this page is read like a memo, and a memo does not
 * decorate its figures. A number carries its own weight and the sentence around
 * it does the explaining.
 */

import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

/** A figure inside a sentence. Tabular, so a column of them lines up. */
export function Num({ children }: { children: ReactNode }) {
  return <span className="font-semibold text-ink-900 tabular-nums">{children}</span>;
}

/** The sentence a group answers with, before any table. */
export function Lede({ children }: { children: ReactNode }) {
  return <p className="text-[1rem] leading-relaxed text-ink-800">{children}</p>;
}

/** A rule that decides whether the figures above can be believed. */
export function Note({ children }: { children: ReactNode }) {
  return <p className="text-[0.875rem] leading-relaxed text-ink-500">{children}</p>;
}

/** Something the page cannot say, said plainly rather than as a nought. */
export function Unmeasured({ children }: { children: ReactNode }) {
  return (
    <p className="border-l-2 border-canvas-border pl-3 text-[0.875rem] leading-relaxed text-ink-500">
      {children}
    </p>
  );
}

/**
 * A figure with its working attached.
 *
 * The arithmetic opens on click rather than only on hover, because a reader on
 * a touch screen cannot hover and a figure whose derivation is unreachable is
 * a figure nobody can check. Nothing on this page is estimated, so there is no
 * marker for one: the working says which columns the figure was summed from.
 */
export function Working({ sum, children }: { sum: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="border-b border-dotted border-ink-400 text-left hover:border-ink-800"
      >
        {children}
      </button>
      {open ? (
        <span className="absolute left-0 top-full z-20 mt-1 block w-80 rounded border border-canvas-border bg-canvas-elevated p-3 text-[0.875rem] font-normal leading-relaxed text-ink-800 shadow-lg">
          {sum}
        </span>
      ) : null}
    </span>
  );
}

export interface Column {
  head: string;
  align?: 'left' | 'right';
}

/**
 * A table, which is where a figure goes once there is more than one of it.
 *
 * The caption sits under the rows and carries what the rows cannot: what is
 * missing from them, and why.
 */
export function Grid({
  columns, rows, caption,
}: { columns: Column[]; rows: (string | number)[][]; caption?: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[0.875rem]">
        <thead>
          <tr className="border-b border-canvas-border">
            {columns.map(c => (
              <th
                key={c.head}
                className={`py-2 pr-4 font-medium text-ink-500 ${c.align === 'right' ? 'text-right' : 'text-left'}`}
              >
                {c.head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-canvas-border/60 last:border-0">
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={`py-2 pr-4 text-ink-800 ${columns[j]?.align === 'right' ? 'text-right tabular-nums' : 'text-left'}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {caption ? <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-500">{caption}</p> : null}
    </div>
  );
}

export interface GroupSpec {
  id: string;
  title: string;
  /** The one sentence this group answers with, readable while it is folded. */
  answer: string;
  body: ReactNode;
}

/**
 * A folding group.
 *
 * The answer stays visible while the group is shut, so the page can be read
 * top to bottom without opening anything. Opening a group is for checking the
 * working, not for finding out what it said.
 */
export function Group({ spec, open, onToggle }: { spec: GroupSpec; open: boolean; onToggle: () => void }) {
  return (
    <section id={spec.id} className="border-b border-canvas-border py-5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-baseline justify-between gap-4 text-left"
      >
        <span className="flex-1">
          <span className="block text-[0.875rem] font-medium text-ink-500">{spec.title}</span>
          <span className="mt-1 block text-[1.125rem] leading-snug text-ink-900">{spec.answer}</span>
        </span>
        <ChevronDown
          className={`mt-1 h-4 w-4 shrink-0 text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open ? <div className="mt-4 space-y-4">{spec.body}</div> : null}
    </section>
  );
}

/** A labelled figure in a short list, where a sentence would be padding. */
export function Line({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border-b border-canvas-border/60 py-2 last:border-0">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-[0.875rem] text-ink-500">{label}</span>
        <span className="text-[1rem] font-semibold tabular-nums text-ink-900">{value}</span>
      </div>
      {sub ? <p className="mt-0.5 text-[0.75rem] leading-relaxed text-ink-400">{sub}</p> : null}
    </div>
  );
}
