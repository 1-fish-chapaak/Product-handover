/**
 * The shared furniture of Platform Usage.
 *
 * Four of the build spec's rules are held here rather than in each block, so no
 * block can quietly break one:
 *
 * · **Every block leads with a sentence, not a number.** `lede` is a required
 *   prop. A reader who reads only the ledes should understand the whole page.
 * · **Every chart has a table one click away.** `Block` owns the toggle, so a
 *   block that draws a chart cannot forget to offer the numbers behind it.
 * · **Every count opens its list.** `Drill` and `MadeRow` are how a number names
 *   the things it counted. A number with no list behind it does not ship.
 * · **"Nothing happened" never looks like "we don't measure this."** They are
 *   different facts and `Empty` will not let them share a rendering.
 *
 * The visual language is type and hairlines: no side stripes, no filled tiles,
 * no grid of identical boxes. This page is read, not admired.
 */

import { useState, type ReactNode } from 'react';
import { ArrowRight, BarChart3, ChevronDown, ChevronRight, Table2, TrendingDown, TrendingUp } from 'lucide-react';
import { formatDate } from '../../data/platform-usage';
import {
  SETTING_LABEL, SOURCE_FIELD, SOURCE_LABEL, fmtInt, fmtMoneyExact, fmtOneDp,
  type Accuracy, type AttentionCard, type ChangeHistory, type NumericSetting, type UsageSettings,
} from '../../data/platform-usage-metrics';

/* ── The strip that opens every view ─────────────────────────────────────── */

/**
 * Needs your attention.
 *
 * At most three cards, each a sentence with one thing to do. It is not a
 * notifier: nothing is sent anywhere and nothing has a threshold to configure.
 * It is the page answering before it asks, and when there is nothing to say it
 * says that once and gets out of the way rather than sitting there as an empty
 * box.
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
 * `chart` and `table` are two renderings of the same numbers, and passing a
 * chart without a table is not possible, which is the point. `lede` is the
 * sentence the block opens on; pass null only when the block is empty and its
 * empty state is doing that job instead.
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
  /** Anchor, so an attention card can send the reader straight to the block. */
  id?: string;
  title: string;
  lede: ReactNode;
  hint?: string;
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
      {footer && <div className="px-5 py-2.5 border-t border-canvas-border text-[0.75rem] text-ink-500">{footer}</div>}
    </section>
  );
}

/** A row of blocks that belong together, so the page reads in groups. */
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
 * `quiet` means the platform looked and found no work in this window. `unmeasured`
 * means the product writes no record of this at all, so the block will stay empty
 * however busy the workspace gets. Reading one as the other is how a page like
 * this loses a reader, so they never share a rendering.
 */
export function Empty({
  kind,
  title,
  detail,
  action,
}: {
  kind: 'quiet' | 'unmeasured';
  title: string;
  detail?: string;
  action?: { label: string; onClick: () => void };
}) {
  const unmeasured = kind === 'unmeasured';
  return (
    <div className={`rounded-lg px-4 py-5 ${unmeasured ? 'bg-canvas border border-dashed border-canvas-border' : ''}`}>
      <p className={`text-[0.875rem] ${unmeasured ? 'text-ink-500 italic' : 'text-ink-700 font-medium'}`}>{title}</p>
      {detail && <p className="mt-1 text-[0.75rem] text-ink-500 max-w-[66ch]">{detail}</p>}
      {action && (
        <button type="button" onClick={action.onClick} className="mt-2.5 text-[0.75rem] font-medium text-brand-700 hover:underline">
          {action.label}
        </button>
      )}
    </div>
  );
}

/* ── Numbers ─────────────────────────────────────────────────────────────── */

/** A figure inside a sentence. Bold enough to find, quiet enough to read. */
export function Fig({ children }: { children: ReactNode }) {
  return <span className="font-semibold text-ink-900 tabular-nums">{children}</span>;
}

/**
 * One stat.
 *
 * The change is the same calculation over the window immediately before this
 * one, and it is labelled by that window's real length. When there is no
 * comparable window it renders nothing at all, because a made-up baseline is
 * worse than none.
 */
export function Stat({
  value,
  label,
  sub,
  delta,
  deltaLabel,
  size = 'md',
}: {
  value: ReactNode;
  label: string;
  sub?: ReactNode;
  delta?: number | null;
  deltaLabel?: string | null;
  size?: 'sm' | 'md' | 'lg';
}) {
  const cls = size === 'lg' ? 'text-[2.5rem]' : size === 'md' ? 'text-[1.5rem]' : 'text-[1.25rem]';
  return (
    <div className="min-w-0">
      <div className={`${cls} font-semibold text-ink-900 leading-none tabular-nums`}>{value}</div>
      <div className="mt-1.5 text-[0.75rem] text-ink-500">{label}</div>
      {sub && <div className="mt-1 text-[0.75rem] text-ink-600">{sub}</div>}
      {delta !== null && delta !== undefined && (
        <div className="mt-1.5 inline-flex items-center gap-1 text-[0.75rem] text-ink-600 tabular-nums">
          {delta >= 0
            ? <TrendingUp size={13} className="text-compliant-700" />
            : <TrendingDown size={13} className="text-risk-700" />}
          {Math.abs(delta) < 0.5 ? 'level' : `${delta > 0 ? 'up' : 'down'} ${fmtOneDp(Math.abs(delta))}%`}
          {deltaLabel && <span className="text-ink-400">on {deltaLabel}</span>}
        </div>
      )}
    </div>
  );
}

/** A row of stats on one hairline, so they read as one fact in parts. */
export function StatRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5 py-1">{children}</div>;
}

/* ── Charts drawn as type ────────────────────────────────────────────────── */

/**
 * A labelled bar list.
 *
 * Every bar carries its own name and figure, so nothing here relies on colour to
 * be read, and the table version says the same thing in the same order.
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
   * What a full bar means. Counts scale to the largest row, but a percentage
   * scales to 100: drawing a 13% failure rate as a full red bar would be the
   * chart shouting something the number does not say.
   */
  scaleTo?: number;
}) {
  const max = scaleTo ?? Math.max(1, ...rows.map(r => r.value));
  const fill = tone === 'risk' ? 'bg-risk-600' : 'bg-brand-600';
  return (
    <ul className="space-y-2.5">
      {/* Two rows can honestly share a label — one control tested under two
          engagements — so the position is part of the key. */}
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
 * A number nobody can open is a number nobody can check, so every count on this
 * page names the things it counted: what they were, who made them, and when.
 * The list is in date order. Attribution is a fact on an item, never a league
 * table, which is why nothing here can be sorted by person.
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
 * person behind it was written by the scheduled worker, and that is a fact.
 */
export function MadeRow({
  name,
  madeBy,
  when,
  note,
}: {
  name: string;
  madeBy: string | null;
  when: string;
  note?: string;
}) {
  return (
    <li className="py-2">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-[0.875rem] text-ink-800 truncate">{name}</span>
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

/* ── Labels that stop a number being read as more than it is ─────────────── */

const ACCURACY_CLASS: Record<Accuracy, string> = {
  exact: 'text-compliant-700 border-compliant-200',
  estimated: 'text-high-700 border-high-200',
  'not measured': 'text-ink-500 border-canvas-border',
  'no record': 'text-ink-400 border-canvas-border',
};

/** How well a figure is known, said next to the figure. */
export function AccuracyTag({ value }: { value: Accuracy }) {
  return (
    <span className={`inline-flex items-center h-6 px-2 rounded-full border text-[0.75rem] font-medium whitespace-nowrap ${ACCURACY_CLASS[value]}`}>
      {value}
    </span>
  );
}

/** Said next to any figure built from the assumptions rather than measured. */
export function EstimatedTag() {
  return <span className="text-[0.75rem] text-ink-400 font-normal">estimated</span>;
}

/** The change list behind an entered or calibrated number. */
export function ChangeList({ rows }: { rows: ChangeHistory['rows'] }) {
  return (
    <ul className="divide-y divide-canvas-border border-t border-canvas-border">
      {rows.map((row, i) => (
        <li key={`${row.field}-${row.at}-${i}`} className="py-2">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-[0.875rem] text-ink-800">
              {row.field}
              {row.from !== null && row.to !== null && <span className="tabular-nums text-ink-600"> · {row.from} to {row.to}</span>}
              {row.from === null && row.to !== null && <span className="tabular-nums text-ink-600"> · {row.to}</span>}
            </span>
            <span className="text-[0.75rem] text-ink-400 shrink-0 tabular-nums">{formatDate(row.at)}</span>
          </div>
          <p className="text-[0.75rem] text-ink-500">
            {row.by}
            {row.source && <> · {row.source}</>}
          </p>
        </li>
      ))}
    </ul>
  );
}

/**
 * The assumptions strip.
 *
 * Any figure resting on a setting shows that setting on the same screen, with
 * where the number came from next to it: a rate measured from the team's own pace
 * reads differently from a shipped starting value, and it should. A savings
 * figure whose assumption lives two clicks away is a figure nobody can argue
 * with, which is the problem.
 *
 * The assumptions are themselves counted, and the count opens its own list,
 * under the same rule as every other number on the page.
 */
export function RestsOn({
  settings,
  keys,
  history,
  periodLabel,
}: {
  settings: UsageSettings;
  keys: NumericSetting[];
  history?: ChangeHistory;
  periodLabel?: string;
}) {
  const value = (k: NumericSetting) =>
    k === 'hourlyRate' ? fmtMoneyExact(settings[k])
      : k === 'manualControlTestHours' ? fmtOneDp(settings[k])
        : fmtInt(settings[k]);

  const source = (k: NumericSetting) => SOURCE_LABEL[settings[SOURCE_FIELD[k]] as keyof typeof SOURCE_LABEL];

  return (
    <div>
      <p className="text-[0.75rem] text-ink-500 leading-relaxed">
        Based on{' '}
        {keys.map((k, i) => (
          <span key={k}>
            {i > 0 && (i === keys.length - 1 ? ' and ' : ', ')}
            <span className="text-ink-700 font-medium tabular-nums">{value(k)}</span>{' '}
            {SETTING_LABEL[k]}
            <span className="text-ink-400"> ({source(k)})</span>
          </span>
        ))}
        .
      </p>
      {history && history.rows.length > 0 && (
        <div className="mt-1.5">
          <Drill
            label={`Assumptions changed ${periodLabel ?? 'in this window'}: ${fmtInt(history.inPeriod)}`}
            hideLabel="Hide the changes"
          >
            <ChangeList rows={history.rows} />
          </Drill>
        </div>
      )}
    </div>
  );
}
