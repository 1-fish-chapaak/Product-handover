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

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, Info } from 'lucide-react';

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

/**
 * The answer, in a sentence. The widest thing in its block.
 *
 * Two of these in a row are two paragraphs and have to read as two, so it
 * carries its own leading gap and drops it when it opens a block.
 */
export function Lede({ children }: { children: ReactNode }) {
  return <p className="mt-4 first:mt-0 text-[1rem] leading-[1.65] text-ink-900 max-w-[70ch]">{children}</p>;
}

/** A figure, said inside the sentence that explains it. */
export function Num({ children }: { children: ReactNode }) {
  return <span className="font-semibold tabular-nums text-ink-900">{children}</span>;
}

/** Where a figure came from, or what it rests on. Plain text, never a pill. */
export function Note({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-[0.75rem] leading-[1.7] text-ink-500 max-w-[76ch]">{children}</p>;
}

/**
 * The working, at the figure it produced.
 *
 * A derivation printed underneath a block is a derivation nobody reads. The
 * question a reader has is "where did *that* number come from", and they have
 * it while looking at that number, so the answer belongs there.
 *
 * Three things this has to get right.
 *
 * **It opens on hover and on click.** Hover alone gives a touch reader and a
 * keyboard reader nothing at all, which would defeat the point for anybody
 * reading this on a tablet in a meeting.
 *
 * **An estimate says so before anybody hovers.** A recorded figure and a
 * guessed one must not look identical at rest, so an estimate carries a dotted
 * underline and its panel opens by saying it is an estimate.
 *
 * **It cannot be clipped.** The panel is positioned against the viewport rather
 * than its parent, because these figures sit inside folds and scrolling tables
 * that would otherwise cut the answer in half.
 */
export function Working({
  children, sum, estimated = false,
}: { children: ReactNode; sum: ReactNode; estimated?: boolean }) {
  /*
   * Hovering and clicking are two different intentions and they must not fight.
   * A hover is a glance, so it opens while the pointer is there and closes when
   * it leaves. A click is "hold still, I am reading this", so it pins the panel
   * open until the reader dismisses it. Treating a click as a plain toggle made
   * the panel close the moment a mouse reader clicked the thing they had just
   * hovered, because the hover had already opened it.
   */
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const anchor = useRef<HTMLSpanElement>(null);

  const place = () => {
    const r = anchor.current?.getBoundingClientRect();
    if (!r) return;
    const width = 320;
    const left = Math.max(12, Math.min(r.left, window.innerWidth - width - 12));
    setAt({ top: r.bottom + 6, left });
  };

  const show = () => { place(); setOpen(true); };
  const glanceAway = () => { if (!pinned) setOpen(false); };
  const dismiss = () => { setPinned(false); setOpen(false); };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss(); };
    const onAway = (e: MouseEvent) => {
      if (!anchor.current?.contains(e.target as Node)) dismiss();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onAway);
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onAway);
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss);
    };
  }, [open, pinned]);

  return (
    <span
      ref={anchor}
      className="whitespace-nowrap"
      onMouseEnter={show}
      onMouseLeave={glanceAway}
    >
      <span className={estimated ? 'border-b border-dotted border-ink-300' : undefined}>{children}</span>
      <button
        type="button"
        aria-expanded={open}
        aria-label={estimated ? 'How this estimate was worked out' : 'How this figure was worked out'}
        data-working={estimated ? 'estimated' : 'recorded'}
        onClick={e => {
          e.stopPropagation();
          if (pinned) { dismiss(); return; }
          setPinned(true);
          show();
        }}
        onFocus={show}
        onBlur={glanceAway}
        style={{ display: 'inline' }}
        className="ml-0.5 text-ink-300 transition-colors hover:text-ink-500 focus-visible:text-ink-500"
      >
        <Info className="inline h-3.5 w-3.5 align-[-0.1em]" strokeWidth={2} aria-hidden />
      </button>
      {open && at ? (
        <span
          role="tooltip"
          style={{ position: 'fixed', top: at.top, left: at.left, width: 320, zIndex: 60 }}
          className="rounded-lg border border-canvas-border bg-canvas-elevated p-3 text-left"
        >
          {estimated ? (
            <span className="mb-1 block text-[0.75rem] font-semibold text-ink-700">This is an estimate</span>
          ) : null}
          <span className="block text-[0.75rem] leading-[1.7] text-ink-600">{sum}</span>
        </span>
      ) : null}
    </span>
  );
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
    <section id={id} className="scroll-mt-6 pt-8 first:pt-0">
      {heading ? <h3 className="mb-3 text-[0.875rem] font-semibold text-ink-800">{heading}</h3> : null}
      {children}
    </section>
  );
}

/**
 * A group of blocks, folded shut unless it is one of the first three.
 *
 * Twenty five blocks is more than the four people who open this page can read,
 * so each view keeps its own first three groups open and folds the rest. The
 * fold is a heading with the group's own answer under it, so a reader can
 * decide whether to open it without opening it. The answer used to sit on the
 * same line and was cut off by an ellipsis at exactly the width where it
 * started to be worth reading, which made the fold useless on the screens most
 * likely to be reading it.
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
    <section id={id} className="scroll-mt-6 border-t border-canvas-border first:border-t-0">
      <h2>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="w-full flex items-start gap-3 py-5 text-left group"
        >
          <ChevronDown
            size={16}
            className={`shrink-0 mt-1 text-ink-400 transition-transform duration-200 ease-out group-hover:text-brand-600 ${open ? '' : '-rotate-90'}`}
          />
          <span className="min-w-0">
            <span className="block text-[1.25rem] font-semibold tracking-tight text-ink-900 transition-colors group-hover:text-brand-700">
              {title}
            </span>
            <span className="mt-1 block text-[0.875rem] leading-[1.6] text-ink-500 max-w-[64ch]">{answer}</span>
          </span>
        </button>
      </h2>
      {open ? <div className="pb-10 pl-7">{children}</div> : null}
    </section>
  );
}
