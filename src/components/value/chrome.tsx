/**
 * The page's own small vocabulary, on top of the one Platform Usage already
 * has.
 *
 * The two pages are read side by side, so they are set the same way: type and
 * hairlines, no tinted panels, no grid of identical cards. What this page adds
 * is a way to carry evidence on a figure, and a way to say that a piece of
 * work has none. The second one matters more: a page that quietly shows a
 * nought where it means "we cannot prove this" is worse than no page.
 */

import { useState, type ReactNode } from 'react';
import { BASIS_LABEL, BASIS_MEANING, type Basis } from '../../data/value/model';

/* ──────────────────────────────────────────────────────────────────────────
 * Figures
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * A headline figure.
 *
 * `floor` puts "at least" in front of it, which is not decoration. Wherever
 * coverage is short of everything, the number underneath is a floor and saying
 * so is the difference between a figure that survives a question and one that
 * does not.
 */
export function Headline({
  label, value, sub, floor = false,
}: { label: string; value: string; sub?: ReactNode; floor?: boolean }) {
  return (
    <div className="min-w-0 flex-1 border-l border-canvas-border pl-4 first:border-l-0 first:pl-0">
      <p className="text-[0.75rem] uppercase tracking-wide text-ink-400">{label}</p>
      <p className="mt-1.5 text-[1.5rem] font-semibold leading-none tabular-nums text-ink-900">
        {floor ? <span className="mr-1.5 text-[0.875rem] font-normal text-ink-500">at least </span> : null}
        {value}
      </p>
      {sub ? <p className="mt-1.5 text-[0.75rem] leading-relaxed text-ink-500">{sub}</p> : null}
    </div>
  );
}

/** How a figure was arrived at, said in one word, next to the figure. */
export function BasisChip({ basis, small = false }: { basis: Basis; small?: boolean }) {
  const tone = basis === 'documented' ? 'border-ink-800 text-ink-800' : 'border-ink-500 text-ink-600';
  return (
    <span
      title={BASIS_MEANING[basis]}
      className={`inline-flex items-center rounded border ${tone} ${small ? 'px-1.5 py-0' : 'px-2 py-0.5'} text-[0.75rem] font-medium`}
    >
      {BASIS_LABEL[basis]}
    </span>
  );
}

/**
 * What a figure says when there is no evidence behind it.
 *
 * Never a nought and never a dash on its own. A nought is a claim that the
 * work saved nothing, and what is meant is that nobody has established what it
 * saved.
 */
export function NotValued({ small = false }: { small?: boolean }) {
  return (
    <span
      title="Counted, and not valued. Nothing documents or times what this replaced."
      className={`inline-flex items-center rounded border border-dashed border-ink-300 ${small ? 'px-1.5 py-0' : 'px-2 py-0.5'} text-[0.75rem] font-medium text-ink-500`}
    >
      Not valued
    </span>
  );
}

/**
 * How much of the activity has evidence behind it.
 *
 * A primary element rather than a footnote. It is what tells a reader whether
 * the headline is nearly complete or barely started, and it is the thing an
 * administrator is meant to go and improve.
 */
export function CoverageBar({
  documentedPct, measuredPct, unvaluedPct, onOpen,
}: { documentedPct: number; measuredPct: number; unvaluedPct: number; onOpen?: () => void }) {
  const segments = [
    { key: 'documented', label: 'Documented', pct: documentedPct, fill: 'bg-ink-800' },
    { key: 'measured', label: 'Measured', pct: measuredPct, fill: 'bg-ink-500' },
    { key: 'unvalued', label: 'Not yet valued', pct: unvaluedPct, fill: 'bg-canvas-border' },
  ];
  const total = documentedPct + measuredPct + unvaluedPct;
  return (
    <div>
      <div className="flex h-2 w-full overflow-hidden rounded-sm bg-canvas-border">
        {total === 0 ? null : segments.map(s => (
          <div key={s.key} className={s.fill} style={{ width: `${s.pct}%` }} title={`${s.label}: ${Math.round(s.pct)}%`} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[0.75rem] text-ink-500">
        {segments.map(s => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className={`inline-block h-2 w-2 rounded-sm border border-canvas-border ${s.fill}`} />
            {s.label} {Math.round(s.pct)}%
          </span>
        ))}
        {onOpen ? (
          <button type="button" onClick={onOpen} className="text-ink-600 underline decoration-dotted underline-offset-2 hover:text-ink-900">
            Close the gaps
          </button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * A figure with the document it came from attached.
 *
 * The most important trust feature on the page. A finance lead who does not
 * believe four hours can open the row in the matrix that says four hours, and
 * the argument is over.
 */
export function Cite({
  label, document, page, controlId, basis, description, procedure,
}: {
  label: string;
  document: string;
  page: number;
  controlId: string;
  basis: string;
  description: string;
  procedure: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="border-b border-dotted border-ink-400 text-left tabular-nums hover:border-ink-800"
      >
        {label}
      </button>
      {open ? (
        <span className="absolute right-0 top-full z-30 mt-1 block w-96 rounded border border-canvas-border bg-canvas-elevated p-3 text-left text-[0.875rem] font-normal leading-relaxed text-ink-800 shadow-lg">
          <span className="block text-[0.75rem] font-medium uppercase tracking-wide text-ink-400">
            {controlId}
          </span>
          <span className="mt-1 block">{description}</span>
          <span className="mt-2 block text-ink-500">{procedure}</span>
          <span className="mt-2 block border-t border-canvas-border pt-2 text-[0.75rem] text-ink-500">
            {basis}. Read from {document}, page {page}.
          </span>
        </span>
      ) : null}
    </span>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Tables
 * ────────────────────────────────────────────────────────────────────────── */

export interface Col {
  head: string;
  align?: 'left' | 'right';
}

/**
 * A table whose cells can carry something other than text.
 *
 * Platform Usage prints strings, because every figure on it is a count. Here a
 * cell often has to carry the evidence, or the absence of it, alongside the
 * number, so the cells are nodes.
 */
export function Table({
  columns, rows, caption,
}: { columns: Col[]; rows: ReactNode[][]; caption?: ReactNode }) {
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
                  className={`py-2 pr-4 align-top text-ink-800 ${columns[j]?.align === 'right' ? 'text-right tabular-nums' : 'text-left'}`}
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

/* ──────────────────────────────────────────────────────────────────────────
 * Pictures
 * ────────────────────────────────────────────────────────────────────────── */

export interface Stack {
  at: number;
  parts: { key: string; value: number; fill: string }[];
  total: number;
}

/**
 * Hours a week, stacked by what they came from.
 *
 * Drawn by hand rather than pulled from a chart library, because the shape
 * wanted here is four flat bands and a baseline, and every library in the
 * building brings a legend, a tooltip and a grid nobody asked for.
 */
export function StackedWeeks({
  stacks, labelFor, height = 132,
}: { stacks: Stack[]; labelFor: (at: number) => string; height?: number }) {
  if (stacks.length === 0) return null;
  const peak = Math.max(...stacks.map(s => s.total), 1);
  return (
    <div>
      <div className="flex items-end gap-[3px]" style={{ height }}>
        {stacks.map(s => (
          <div
            key={s.at}
            className="flex flex-1 flex-col justify-end"
            style={{ minWidth: 3 }}
            title={`${labelFor(s.at)}: ${s.total.toFixed(1)} hours`}
          >
            {s.parts.filter(p => p.value > 0).map(p => (
              <div key={p.key} className={p.fill} style={{ height: `${(p.value / peak) * (height - 2)}px` }} />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between border-t border-canvas-border pt-1 text-[0.75rem] text-ink-400">
        <span>{labelFor(stacks[0].at)}</span>
        <span>{labelFor(stacks[stacks.length - 1].at)}</span>
      </div>
    </div>
  );
}

/** A row of proportions, where the length is the point and the axis is not. */
export function Bars({
  rows,
}: { rows: { key: string; label: string; value: number; caption: string }[] }) {
  const peak = Math.max(...rows.map(r => r.value), 1);
  return (
    <div className="space-y-2.5">
      {rows.map(r => (
        <div key={r.key}>
          <div className="flex items-baseline justify-between gap-4 text-[0.875rem]">
            <span className="text-ink-800">{r.label}</span>
            <span className="tabular-nums text-ink-500">{r.caption}</span>
          </div>
          <div className="mt-1 h-1.5 w-full rounded-sm bg-canvas-border">
            <div className="h-1.5 rounded-sm bg-ink-700" style={{ width: `${(r.value / peak) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Two proportions side by side on one line.
 *
 * Used for the band split, where the whole question is whether the share of
 * the value matches the share of the work.
 */
export function PairBar({
  leftPct, rightPct, leftLabel, rightLabel, leftText, rightText,
}: {
  leftPct: number;
  rightPct: number;
  leftLabel: string;
  rightLabel: string;
  /** Overrides the printed figure, for a share that rounds to nought and is not one. */
  leftText?: string;
  rightText?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div>
        <div className="flex items-baseline justify-between text-[0.75rem] text-ink-500">
          <span>{leftLabel}</span>
          <span className="tabular-nums">{leftText ?? `${Math.round(leftPct)}%`}</span>
        </div>
        <div className="mt-0.5 h-1.5 w-full rounded-sm bg-canvas-border">
          <div className="h-1.5 rounded-sm bg-ink-400" style={{ width: `${leftPct}%` }} />
        </div>
      </div>
      <div>
        <div className="flex items-baseline justify-between text-[0.75rem] text-ink-500">
          <span>{rightLabel}</span>
          <span className="tabular-nums">{rightText ?? `${Math.round(rightPct)}%`}</span>
        </div>
        <div className="mt-0.5 h-1.5 w-full rounded-sm bg-canvas-border">
          <div className="h-1.5 rounded-sm bg-ink-800" style={{ width: `${rightPct}%` }} />
        </div>
      </div>
    </div>
  );
}

/** A single line over time, for a ratio that only reads as a shape. */
export function Spark({
  points, height = 44, format,
}: { points: { at: number; value: number }[]; height?: number; format: (v: number) => string }) {
  if (points.length < 2) return null;
  const values = points.map(p => p.value);
  const top = Math.max(...values);
  const bottom = Math.min(...values, 0);
  const span = top - bottom || 1;
  const step = 100 / (points.length - 1);
  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(2)},${(height - ((p.value - bottom) / span) * height).toFixed(2)}`)
    .join(' ');
  return (
    <div>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="h-11 w-full" role="img" aria-label="Trend over the range">
        <path d={path} fill="none" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" className="text-ink-700" />
      </svg>
      <div className="flex justify-between text-[0.75rem] tabular-nums text-ink-400">
        <span>{format(values[0])}</span>
        <span>{format(values[values.length - 1])}</span>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Frames
 * ────────────────────────────────────────────────────────────────────────── */

/** A block with a heading, which is how the page is divided below the tiles. */
export function Block({
  title, hint, children, right,
}: { title: string; hint?: ReactNode; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="border-t border-canvas-border pt-5">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-[1rem] font-semibold text-ink-900">{title}</h2>
        {right}
      </div>
      {hint ? <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-500">{hint}</p> : null}
      <div className="mt-3.5">{children}</div>
    </section>
  );
}

/** Something worth stopping on, said in a line rather than shouted in a colour. */
export function Flag({ children }: { children: ReactNode }) {
  return (
    <p className="border-l-2 border-ink-400 pl-3 text-[0.875rem] leading-relaxed text-ink-600">
      {children}
    </p>
  );
}

/** A labelled figure in a short list, where a sentence would be padding. */
export function Row({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border-b border-canvas-border/60 py-2">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-[0.875rem] text-ink-500">{label}</span>
        <span className="text-[1rem] font-semibold tabular-nums text-ink-900">{value}</span>
      </div>
      {sub ? <p className="mt-0.5 text-[0.75rem] leading-relaxed text-ink-400">{sub}</p> : null}
    </div>
  );
}
