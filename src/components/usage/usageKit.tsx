/**
 * The shared furniture of Platform Usage.
 *
 * Three of the build rules are held here rather than in the individual blocks,
 * so no block can quietly break one of them:
 *
 * · **Every chart has a table one click away.** `Block` owns the toggle, so a
 *   block that draws a chart cannot forget to offer the numbers behind it.
 * · **"Nothing happened" never looks like "we don't measure this."** They are
 *   different facts and `Empty` will not let them share a rendering.
 * · **Every number resting on a setting shows that setting.** `RestsOn` puts
 *   the assumptions on the same screen as the figure they produce.
 *
 * The visual language is type and hairlines. No side stripes, no filled tiles,
 * no card grid of identical boxes: this page is read, not admired.
 */

import { useState, type ReactNode } from 'react';
import { BarChart3, Table2, TrendingDown, TrendingUp } from 'lucide-react';
import type { Accuracy, UsageSettings } from '../../data/platform-usage-metrics';
import { SETTING_LABEL, SOURCE_FIELD, SOURCE_LABEL, fmtInt, fmtMoney } from '../../data/platform-usage-metrics';
import type { NumericSetting } from '../../data/platform-usage-metrics';

/* ── The spine ───────────────────────────────────────────────────────────── */

/**
 * A named group of blocks.
 *
 * Eight cards of equal weight is a wall: the eye has nowhere to start and no way
 * to skip. Three named groups give the reader a spine.
 */
export function PageSection({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="flex items-baseline gap-3">
        <h2 className="text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-ink-500">{title}</h2>
        {hint && <p className="text-[0.75rem] text-ink-400">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

/**
 * One block.
 *
 * `chart` and `table` are two renderings of the same numbers. Passing a chart
 * without a table is not possible, which is the point.
 */
export function Block({
  title,
  hint,
  action,
  chart,
  table,
  children,
  footer,
}: {
  title: string;
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
    <div data-usage-block className="rounded-xl border border-canvas-border bg-canvas-elevated">
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
        {children}
        {toggleable ? (asTable ? table : chart) : (chart ?? table)}
      </div>
      {footer && (
        <div className="px-5 py-2.5 border-t border-canvas-border text-[0.75rem] text-ink-500">{footer}</div>
      )}
    </div>
  );
}

/* ── The two empty states ────────────────────────────────────────────────── */

/**
 * Nothing happened, or nothing is measured.
 *
 * `quiet` means the platform looked and found no work in this window. `unmeasured`
 * means the product writes no record of this at all, so the block will stay
 * empty however busy the workspace gets. Reading one as the other is how a page
 * like this loses a reader's trust, so they never share a rendering.
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
        <button
          type="button"
          onClick={action.onClick}
          className="mt-2.5 text-[0.75rem] font-medium text-brand-700 hover:underline"
        >
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
 * The change arrow is the same calculation over the window immediately before
 * this one. When there is no comparable window it renders nothing rather than a
 * flat zero, because a made-up baseline is worse than none.
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
          {delta >= 0 ? <TrendingUp size={13} className="text-compliant-700" /> : <TrendingDown size={13} className="text-risk-700" />}
          {Math.abs(delta) < 0.05 ? 'level' : `${delta > 0 ? 'up' : 'down'} ${Math.abs(delta).toFixed(0)}%`}
          {deltaLabel && <span className="text-ink-400">vs {deltaLabel}</span>}
        </div>
      )}
    </div>
  );
}

/* ── Charts drawn as type ────────────────────────────────────────────────── */

/**
 * A labelled bar list.
 *
 * Every bar carries its own name and figure, so nothing on this page relies on
 * colour to be read, and the table version says the same thing in the same
 * order.
 */
export function Bars({
  rows,
  format = v => fmtInt(v),
  tone = 'brand',
}: {
  rows: { label: string; value: number; note?: string }[];
  format?: (v: number) => string;
  tone?: 'brand' | 'risk';
}) {
  const max = Math.max(1, ...rows.map(r => r.value));
  const fill = tone === 'risk' ? 'bg-risk-600' : 'bg-brand-600';
  return (
    <ul className="space-y-2.5">
      {rows.map(r => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-[0.875rem] text-ink-800 truncate">{r.label}</span>
            <span className="text-[0.875rem] text-ink-900 font-medium tabular-nums shrink-0">{format(r.value)}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-canvas overflow-hidden">
            <div className={`h-full rounded-full ${fill}`} style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
          {r.note && <p className="mt-1 text-[0.75rem] text-ink-500">{r.note}</p>}
        </li>
      ))}
    </ul>
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
  /** Column index from which cells are numbers, so they line up. */
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
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-canvas-border last:border-0">
              {r.map((c, j) => (
                <td key={j} className={`py-2 text-ink-800 ${j >= numericFrom ? 'text-right tabular-nums' : ''}`}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
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

/**
 * The assumptions strip.
 *
 * Any figure resting on a setting shows that setting on the same screen, with
 * the way to change it right there. A savings number whose assumption lives two
 * clicks away is a number nobody can argue with, which is the problem.
 */
export function RestsOn({
  settings,
  keys,
  onEdit,
}: {
  settings: UsageSettings;
  keys: NumericSetting[];
  onEdit?: () => void;
}) {
  const value = (k: NumericSetting) => (k === 'hourlyRate' ? fmtMoney(settings[k]) : fmtInt(settings[k]));
  // Where the number came from, said next to the number itself. A measured rate
  // reads differently from a starting value, and it should.
  const source = (k: NumericSetting) => {
    const field = SOURCE_FIELD[k];
    return field ? SOURCE_LABEL[settings[field]] : null;
  };

  return (
    <p className="text-[0.75rem] text-ink-500">
      Based on{' '}
      {keys.map((k, i) => (
        <span key={k}>
          {i > 0 && (i === keys.length - 1 ? ' and ' : ', ')}
          <span className="text-ink-700 font-medium tabular-nums">{value(k)}</span>
          {' '}
          <span className="lowercase">{SETTING_LABEL[k].replace(/^([A-Z])/, m => m.toLowerCase())}</span>
          {source(k) && <span className="text-ink-400"> ({source(k)})</span>}
        </span>
      ))}
      .
      {onEdit && (
        <>
          {' '}
          <button type="button" onClick={onEdit} className="font-medium text-brand-700 hover:underline">
            Change these
          </button>
        </>
      )}
    </p>
  );
}
