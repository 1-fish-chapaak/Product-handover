/**
 * Platform Usage. The few pieces of chrome the page is built from.
 *
 * The old page was one card with one tile in it, twenty five times over, and it
 * read as generic because nothing on it signalled which number mattered. So
 * there is no card and no tile here. Type and hairlines carry the hierarchy:
 *
 * - The sentence that answers a block is the widest thing in it. The figure
 *   sits inside that sentence rather than towering over it.
 * - Related figures live in one bordered container with hairline separated
 *   rows, never one container each.
 * - A column head is stated once at the top of a group and never per row.
 * - An assumption's derivation is plain text under the figure. A pill would
 *   make an estimate look like a status.
 * - A drill down is named in the sentence, so a reader knows where they are
 *   going before they go.
 *
 * On grid type only: 12, 14, 16, 18 and 20. Every figure is tabular.
 */

import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * One foldable group of the page.
 *
 * Each view builds its own list of these and the page orders them, so a view
 * changes which group comes first and never the layout, the wording or the
 * names of things.
 */
export interface GroupSpec {
  id: string;
  title: string;
  /** The group's own answer, read on the fold without opening it. */
  answer: string;
  node: ReactNode;
}

/* ── The sentence, and the figures inside it ─────────────────────────────── */

/** The answer, in a sentence. The widest thing in its block. */
export function Lede({ children }: { children: ReactNode }) {
  return <p className="text-[1rem] leading-[1.6] text-ink-900 max-w-[70ch]">{children}</p>;
}

/** A figure, said inside the sentence that explains it. */
export function Num({ children }: { children: ReactNode }) {
  return <span className="font-semibold tabular-nums text-ink-900">{children}</span>;
}

/** Where a figure came from, or what it rests on. Plain text, never a pill. */
export function Note({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-[0.75rem] leading-[1.7] text-ink-500 max-w-[76ch]">{children}</p>;
}

/** A drill down, named in the sentence rather than hidden behind a chevron. */
export function Drill({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-ink-700 underline decoration-ink-300 underline-offset-[3px] hover:text-brand-700 hover:decoration-brand-300"
    >
      {label}
    </button>
  );
}

/* ── One bordered container, hairline separated rows ─────────────────────── */

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mt-4 rounded-xl border border-canvas-border bg-canvas-elevated ${className}`}>
      {children}
    </div>
  );
}

/**
 * One figure on its own line, with what it rests on under it.
 *
 * The label carries the weight of a sentence and the figure sits to the right
 * of it, so a column of these reads down the labels rather than down a wall of
 * numerals.
 */
export function Line({
  label, value, sub, strong = false,
}: { label: ReactNode; value: ReactNode; sub?: ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-6 px-4 py-3 border-t border-canvas-border first:border-t-0">
      <div className="min-w-0">
        <p className={`text-[0.875rem] leading-snug ${strong ? 'text-ink-900 font-medium' : 'text-ink-700'}`}>{label}</p>
        {sub ? <p className="mt-1 text-[0.75rem] leading-[1.6] text-ink-500 max-w-[64ch]">{sub}</p> : null}
      </div>
      <p className={`shrink-0 tabular-nums ${strong ? 'text-[1.125rem] font-semibold text-ink-900' : 'text-[0.875rem] text-ink-900'}`}>
        {value}
      </p>
    </div>
  );
}

/**
 * A table whose column heads are stated once, at the top.
 *
 * Everything after the first column is a figure, so it is right aligned and
 * tabular. `align` overrides that where a column carries words.
 */
export function Grid({
  head, rows, align, caption,
}: {
  head: string[];
  rows: ReactNode[][];
  align?: ('left' | 'right')[];
  caption?: ReactNode;
}) {
  const at = (i: number) => align?.[i] ?? (i === 0 ? 'left' : 'right');
  return (
    <div className="mt-4 rounded-xl border border-canvas-border bg-canvas-elevated overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th
                key={h}
                scope="col"
                className={`px-4 pt-3 pb-2 text-[0.75rem] font-medium text-ink-400 ${at(i) === 'right' ? 'text-right' : 'text-left'}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="border-t border-canvas-border">
              {row.map((cell, i) => (
                <td
                  key={i}
                  className={`px-4 py-3 text-[0.875rem] leading-snug ${
                    at(i) === 'right' ? 'text-right tabular-nums text-ink-900' : 'text-ink-700'
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {caption ? <p className="px-4 py-3 border-t border-canvas-border text-[0.75rem] leading-[1.7] text-ink-500">{caption}</p> : null}
    </div>
  );
}

/* ── Nothing happened, and we do not measure this ────────────────────────── */

/** Nothing happened, and that is a fact. A designed zero, not a blank. */
export function Quiet({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 rounded-xl border border-canvas-border bg-canvas-elevated px-4 py-4">
      <p className="text-[0.875rem] leading-relaxed text-ink-600">{children}</p>
    </div>
  );
}

/** We do not measure this. Dashed, so it can never read as a nought. */
export function Unmeasured({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 rounded-xl border border-dashed border-canvas-border px-4 py-4">
      <p className="text-[0.875rem] leading-relaxed text-ink-600">{children}</p>
    </div>
  );
}

/* ── A chart, with its table one click away ──────────────────────────────── */

export function ChartOrTable({ chart, table, label }: { chart: ReactNode; table: ReactNode; label: string }) {
  const [showTable, setShowTable] = useState(false);
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-[0.75rem] text-ink-400">{label}</p>
        <button
          type="button"
          onClick={() => setShowTable(v => !v)}
          className="text-[0.75rem] text-ink-600 underline decoration-ink-300 underline-offset-[3px] hover:text-brand-700"
        >
          {showTable ? 'Show the chart' : 'Show the numbers'}
        </button>
      </div>
      {showTable ? table : <div className="mt-2 rounded-xl border border-canvas-border bg-canvas-elevated p-3">{chart}</div>}
    </div>
  );
}

/* ── A block, and the group it sits in ───────────────────────────────────── */

export function Block({ id, heading, children }: { id?: string; heading?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 pt-6 first:pt-0">
      {heading ? <h3 className="mb-2 text-[0.75rem] font-medium text-ink-400">{heading}</h3> : null}
      {children}
    </section>
  );
}

/**
 * A group of blocks, folded shut unless it is one of the first three.
 *
 * Twenty five blocks is more than the four people who open this page can read,
 * so each view keeps its own first three groups open and folds the rest. The
 * fold is a heading with the group's own answer beside it, so a reader can
 * decide whether to open it without opening it.
 */
export function Group({
  id, title, answer, open, onToggle, children,
}: {
  id: string;
  title: string;
  answer: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-4 border-t border-canvas-border first:border-t-0">
      <h2>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="w-full flex items-baseline gap-3 py-5 text-left group"
        >
          <ChevronDown
            size={14}
            className={`shrink-0 mt-1 text-ink-400 transition-transform ${open ? '' : '-rotate-90'}`}
          />
          <span className="text-[1.125rem] font-semibold tracking-tight text-ink-900 group-hover:text-brand-700">{title}</span>
          <span className="text-[0.875rem] text-ink-500 truncate">{answer}</span>
        </button>
      </h2>
      {open ? <div className="pb-8 pl-[26px]">{children}</div> : null}
    </section>
  );
}
