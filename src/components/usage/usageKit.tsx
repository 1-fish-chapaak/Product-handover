/**
 * The shared furniture of Platform Usage.
 *
 * Five of the guide's rules are held here rather than in each block, so no
 * block can quietly break one:
 *
 * · **Every block leads with a sentence, not a number.** `lede` is a required
 *   prop. A reader who reads only the ledes understands the whole page.
 * · **Every chart has a table one click away.** `Block` owns the toggle, so a
 *   block that draws a chart cannot forget to offer the numbers behind it.
 * · **Every count opens its list.** `Drill` and `MadeRow` are how a number
 *   names the things it counted, with a maker and a date on each one. Do not
 *   ship a count that cannot be opened.
 * · **"Nothing happened" never looks like "we don't measure this."** They are
 *   different facts and `Empty` will not let them share a rendering.
 * · **An assumed figure says so.** `Estimated` sits next to anything derived,
 *   and `RestsOn` puts the assumption on the same screen as the number it
 *   produced.
 *
 * The visual language is type and hairlines rather than filled tiles, coloured
 * side stripes and grids of matching boxes. People read this page.
 */

import { useState, type ReactNode } from 'react';
import { ArrowRight, BarChart3, ChevronDown, ChevronRight, Table2, TrendingDown, TrendingUp } from 'lucide-react';
import { formatDate } from '../../data/platform-usage';
import {
  SETTING_LABEL, SOURCE_LABEL, fmtInt, fmtMoneyExact, fmtOneDp,
  type AttentionCard, type NumericSetting, type UsageSettings,
} from '../../data/platform-usage-metrics';

/* ── The strip that opens every view ─────────────────────────────────────── */

/**
 * Needs your attention.
 *
 * At most three cards, each a plain sentence with one thing to do. Nothing here
 * is sent anywhere and there is no threshold to configure. When there is nothing
 * to say the strip says so once, quietly, and disappears.
 */
export function AttentionStrip({ cards, onAct }: { cards: AttentionCard[]; onAct: (card: AttentionCard) => void }) {
  if (cards.length === 0) {
    return <p className="text-[0.875rem] text-ink-500">Nothing needs you.</p>;
  }
  return (
    <ul className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {cards.map(card => (
        <li key={card.id} className="rounded-xl border border-canvas-border bg-canvas-elevated px-4 py-3.5">
          <p className="text-[0.875rem] text-ink-800 leading-relaxed">{card.text}</p>
          <button
            type="button"
            onClick={() => onAct(card)}
            className="mt-2 inline-flex items-center gap-1 text-[0.75rem] font-medium text-brand-700 hover:underline"
          >
            {card.actionLabel} <ArrowRight size={13} />
          </button>
        </li>
      ))}
    </ul>
  );
}

/* ── The spine ───────────────────────────────────────────────────────────── */

/**
 * One block.
 *
 * `chart` and `table` are two renderings of the same numbers. You cannot pass a
 * chart without also passing the table behind it.
 */
export function Block({
  id,
  title,
  lede,
  hint,
  action,
  chart,
  table,
  children,
  footer,
}: {
  /** Anchor, so an attention card can send the reader straight here. */
  id?: string;
  title: string;
  lede: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  chart?: ReactNode;
  table?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  const [asTable, setAsTable] = useState(false);
  const toggleable = Boolean(chart && table);

  return (
    <section id={id} data-usage-block className="rounded-xl border border-canvas-border bg-canvas-elevated scroll-mt-6">
      <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-3">
        <div className="min-w-0">
          <h3 className="text-[0.875rem] font-semibold text-ink-900">{title}</h3>
          {hint && <p className="mt-0.5 text-[0.75rem] text-ink-500 max-w-[70ch]">{hint}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {action}
          {toggleable && (
            <button
              type="button"
              onClick={() => setAsTable(v => !v)}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-canvas-border text-[0.75rem] text-ink-600 hover:text-brand-700 hover:border-brand-200"
            >
              {asTable ? <BarChart3 size={13} /> : <Table2 size={13} />}
              {asTable ? 'Chart' : 'Table'}
            </button>
          )}
        </div>
      </div>
      <div className="px-5 pb-4">
        {lede && <p className="mb-4 text-[1rem] text-ink-800 max-w-[76ch] leading-relaxed">{lede}</p>}
        {children}
        {toggleable ? (asTable ? table : chart) : (chart ?? table)}
      </div>
      {footer && <div className="px-5 py-2.5 border-t border-canvas-border text-[0.75rem] text-ink-500 leading-relaxed">{footer}</div>}
    </section>
  );
}

/** Blocks that belong together, so the page reads in groups. */
export function BlockGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-ink-400 mb-3">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

/* ── The two empty states ────────────────────────────────────────────────── */

/**
 * Nothing happened, or nothing is measured.
 *
 * `quiet` means the platform looked and found no work in this window.
 * `unmeasured` means the product writes no record of this at all, so the block
 * stays empty however busy the workspace gets. A reader who mistakes one for the
 * other stops trusting the page, so the two never share a rendering.
 */
export function Empty({
  kind,
  title,
  detail,
}: {
  kind: 'quiet' | 'unmeasured';
  title: string;
  detail?: string;
}) {
  const unmeasured = kind === 'unmeasured';
  return (
    <div className={`rounded-lg px-4 py-5 ${unmeasured ? 'bg-canvas border border-dashed border-canvas-border' : ''}`}>
      <p className={`text-[0.875rem] ${unmeasured ? 'text-ink-500 italic' : 'text-ink-700 font-medium'}`}>{title}</p>
      {detail && <p className="mt-1 text-[0.75rem] text-ink-500 max-w-[66ch] leading-relaxed">{detail}</p>}
    </div>
  );
}

/* ── Numbers ─────────────────────────────────────────────────────────────── */

/** A figure inside a sentence. Bold enough to find, quiet enough to read. */
export function Fig({ children }: { children: ReactNode }) {
  return <span className="font-semibold text-ink-900 tabular-nums">{children}</span>;
}

/** Said next to any figure built from the assumptions rather than measured. */
export function Estimated() {
  return <span className="ml-1.5 text-[0.75rem] text-ink-400 font-normal align-middle">estimated</span>;
}

/**
 * One stat.
 *
 * The change is the same calculation over the window immediately before this
 * one, labelled by that window's real length. With no comparable window it
 * renders nothing, because an invented baseline would be worse than no baseline.
 */
export function Stat({
  value,
  label,
  sub,
  delta,
  deltaLabel,
  size = 'md',
  long = false,
}: {
  value: ReactNode;
  label: string;
  sub?: ReactNode;
  delta?: number | null;
  deltaLabel?: string | null;
  size?: 'sm' | 'md' | 'lg';
  /**
   * A rupee figure in lakh or crore is long enough to wrap mid-word at 40px,
   * and "₹85.7" over "lakh" reads as two numbers rather than one. Long values
   * step down a size and never wrap.
   */
  long?: boolean;
}) {
  const cls = size === 'lg' ? (long ? 'text-[1.75rem]' : 'text-[2.5rem]') : size === 'md' ? 'text-[1.5rem]' : 'text-[1.25rem]';
  return (
    <div className="min-w-0">
      <div className={`${cls} font-semibold text-ink-900 leading-none tabular-nums whitespace-nowrap`}>{value}</div>
      <div className="mt-1.5 text-[0.75rem] text-ink-500">{label}</div>
      {sub && <div className="mt-1 text-[0.75rem] text-ink-600">{sub}</div>}
      {delta !== null && delta !== undefined && (
        /*
         * A change, said as a sentence.
         *
         * Under half a per cent there is no arrow at all. An arrow pointing down
         * beside the word "level" is two claims that contradict each other, and
         * a reader who has to work out which one to believe stops believing
         * either. Either something moved and the arrow says which way, or
         * nothing moved and the line says so in words.
         */
        <div className="mt-1.5 inline-flex items-center gap-1 text-[0.75rem] text-ink-600 tabular-nums">
          {Math.abs(delta) < 0.5
            ? <span>About the same as {deltaLabel ?? 'the window before'}</span>
            : (
              <>
                {delta > 0
                  ? <TrendingUp size={13} className="text-compliant-700" />
                  : <TrendingDown size={13} className="text-risk-700" />}
                <span>
                  {delta > 0 ? 'Up' : 'Down'} {fmtOneDp(Math.abs(delta))}% on {deltaLabel ?? 'the window before'}
                </span>
              </>
            )}
        </div>
      )}
    </div>
  );
}

/**
 * The arithmetic behind a row of stats, written out.
 *
 * Every figure on this page is somebody's renewal argument, so a reader has to
 * be able to check it with a calculator rather than take it on trust. Each line
 * is one step: the sum on the left, what the step means in the middle, and how
 * well that input is known on the right.
 */
export function Working({
  title = 'How these are worked out',
  rows,
}: {
  title?: string;
  rows: { expr: string; means: string; source?: string }[];
}) {
  return (
    <div className="mt-5 pt-4 border-t border-canvas-border">
      <h4 className="text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-ink-400 mb-2.5">{title}</h4>
      <ul className="space-y-1.5">
        {rows.map((row, i) => (
          <li key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <span className="text-[0.875rem] font-medium text-ink-900 tabular-nums shrink-0 min-w-[14rem]">
              {row.expr}
            </span>
            <span className="text-[0.875rem] text-ink-600">{row.means}</span>
            {row.source && <span className="text-[0.75rem] text-ink-400">{row.source}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A row of stats, so they read as one fact in parts. */
export function StatRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5 py-1">{children}</div>;
}

/* ── Charts drawn as type ────────────────────────────────────────────────── */

/**
 * A labelled bar list.
 *
 * Every bar carries its own name and figure, so a reader never has to rely on
 * colour, and the table version says the same thing in the same order.
 */
export function Bars({
  rows,
  format = fmtInt,
  tone = 'brand',
  scaleTo,
}: {
  rows: { label: string; value: number; note?: string }[];
  format?: (v: number) => string;
  tone?: 'brand' | 'risk';
  /**
   * What a full bar means. Counts scale to the largest row and a percentage
   * scales to 100. Drawing a 13% failure rate as a full red bar would make the
   * chart say something louder than the number does.
   */
  scaleTo?: number;
}) {
  const max = scaleTo ?? Math.max(1, ...rows.map(r => r.value));
  const fill = tone === 'risk' ? 'bg-risk-600' : 'bg-brand-600';
  return (
    <ul className="space-y-2.5">
      {/* Two rows can honestly share a label, so the position is part of the key. */}
      {rows.map((row, i) => (
        <li key={`${row.label}-${i}`}>
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-[0.875rem] text-ink-800 truncate">{row.label}</span>
            <span className="text-[0.875rem] text-ink-900 font-medium tabular-nums shrink-0">{format(row.value)}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-canvas overflow-hidden">
            <div className={`h-full rounded-full ${fill}`} style={{ width: `${(row.value / max) * 100}%` }} />
          </div>
          {row.note && <p className="mt-1 text-[0.75rem] text-ink-500">{row.note}</p>}
        </li>
      ))}
    </ul>
  );
}

/** One proportion, said as a percentage and drawn once. */
export function Meter({ pct, label, tone = 'brand' }: { pct: number; label?: ReactNode; tone?: 'brand' | 'risk' }) {
  return (
    <div>
      <div className="h-2 rounded-full bg-canvas overflow-hidden">
        <div
          className={`h-full rounded-full ${tone === 'risk' ? 'bg-risk-600' : 'bg-brand-600'}`}
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
      {label && <div className="mt-1.5 text-[0.75rem] text-ink-500">{label}</div>}
    </div>
  );
}

/** The plain table under any chart. */
export function DataTable({
  head,
  rows,
  numericFrom = 1,
}: {
  head: string[];
  rows: (string | number)[][];
  /** The column index from which cells are numbers, so they line up. */
  numericFrom?: number;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[0.875rem]">
        <thead>
          <tr className="border-b border-canvas-border">
            {head.map((h, i) => (
              <th
                key={h}
                scope="col"
                className={`py-2 text-[0.75rem] font-semibold uppercase tracking-wide text-ink-400 ${i >= numericFrom ? 'text-right' : 'text-left'}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-canvas-border last:border-0">
              {row.map((cell, j) => (
                <td key={j} className={`py-2 text-ink-800 ${j >= numericFrom ? 'text-right tabular-nums' : ''}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The list behind a count.
 *
 * A reader cannot check a number they cannot open, so every count on this page
 * names the things it counted. The list is in date order. Attribution is a fact
 * on an item, so nothing here can be sorted by person.
 */
export function Drill({
  label,
  hideLabel = 'Hide the list',
  children,
}: {
  label: string;
  hideLabel?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 text-[0.75rem] font-medium text-brand-700 hover:underline"
      >
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        {open ? hideLabel : label}
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

/**
 * One made thing in a drill list: what it is, who made it, when.
 *
 * A missing maker is not left blank. It says automatic, because a row with no
 * person behind it was written by the scheduled worker.
 */
export function MadeRow({
  name,
  madeBy,
  when,
  note,
  onOpen,
}: {
  name: string;
  madeBy: string | null;
  when: string;
  note?: string;
  onOpen?: () => void;
}) {
  return (
    <li className="py-2">
      <div className="flex items-baseline justify-between gap-4">
        {onOpen
          ? (
            <button type="button" onClick={onOpen} className="text-[0.875rem] text-ink-800 truncate text-left hover:text-brand-700 hover:underline">
              {name}
            </button>
          )
          : <span className="text-[0.875rem] text-ink-800 truncate">{name}</span>}
        <span className="text-[0.75rem] text-ink-400 shrink-0 tabular-nums">{when}</span>
      </div>
      <p className="text-[0.75rem] text-ink-500">
        {madeBy ?? 'automatic, no person involved'}
        {note && <> · {note}</>}
      </p>
    </li>
  );
}

/** The list wrapper for MadeRow, hairline-separated. */
export function MadeList({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-canvas-border border-t border-canvas-border max-h-80 overflow-y-auto">{children}</ul>;
}

/** A count that opens its own list. Every count on the page uses this. */
export function CountWithList({
  label,
  items,
  emptyTitle,
  emptyDetail,
  onOpen,
}: {
  label: string;
  items: { name: string; by: string | null; at: number; note?: string }[];
  emptyTitle: string;
  emptyDetail?: string;
  onOpen?: (item: { name: string; by: string | null; at: number }) => void;
}) {
  if (items.length === 0) return <Empty kind="quiet" title={emptyTitle} detail={emptyDetail} />;
  return (
    <Drill label={label}>
      <MadeList>
        {items
          .slice()
          .sort((a, b) => b.at - a.at)
          .map((item, i) => (
            <MadeRow
              key={`${item.name}-${item.at}-${i}`}
              name={item.name}
              madeBy={item.by}
              when={formatDate(item.at)}
              note={item.note}
              onOpen={onOpen ? () => onOpen(item) : undefined}
            />
          ))}
      </MadeList>
    </Drill>
  );
}

/* ── The assumptions, said next to the numbers they produce ──────────────── */

const settingValue = (settings: UsageSettings, key: NumericSetting): string =>
  key === 'hourlyRate' ? fmtMoneyExact(settings[key])
    : key === 'manualControlTestHours' ? fmtOneDp(settings[key])
      : fmtInt(settings[key]);

/**
 * What a figure rests on, on the same screen as the figure.
 *
 * Nobody can argue with a saving whose assumption lives two clicks away, and
 * they should be able to. So the numbers and their labels sit together. A rate
 * measured from the team's own pace reads differently from a shipped starting
 * value, and it should.
 */
export function RestsOn({ settings, keys }: { settings: UsageSettings; keys: NumericSetting[] }) {
  return (
    <p className="text-[0.75rem] text-ink-500 leading-relaxed">
      Based on{' '}
      {keys.map((key, i) => (
        <span key={key}>
          {i > 0 && (i === keys.length - 1 ? ' and ' : ', ')}
          <span className="text-ink-700 font-medium tabular-nums">{settingValue(settings, key)}</span>{' '}
          {SETTING_LABEL[key]}
          <span className="text-ink-400"> ({SOURCE_LABEL[settings.source[key]]})</span>
        </span>
      ))}
      .
    </p>
  );
}
