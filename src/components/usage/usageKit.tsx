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

import { createContext, useContext, useState, type ElementType, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, ArrowRight, BarChart3, ChevronDown, ChevronRight, Table2, TrendingDown, TrendingUp } from 'lucide-react';
import { formatDate } from '../../data/platform-usage';
import {
  SETTING_LABEL, SOURCE_LABEL, fmtInt, fmtMoneyExact, fmtOneDp,
  type AttentionCard, type NumericSetting, type UsageSettings,
} from '../../data/platform-usage-metrics';

/* ── Which of the two layouts the page is wearing ────────────────────────── */

/**
 * Two ways to set the same page, chosen once at the top and read by every
 * primitive below, so no block has to know which one it is in.
 *
 * **dense** is a registry: hairlines, no cards, tight rhythm, figures in
 * columns. It suits somebody working the page, scanning for the row that needs
 * them.
 *
 * **report** is a printed board paper: wide margins, big section headings, the
 * answer in reading size, figures set as display type. It suits somebody
 * reading the page through once and taking it into a meeting.
 */
export type UsageLayout = 'dense' | 'report';

const LayoutContext = createContext<UsageLayout>('dense');

export const UsageLayoutProvider = LayoutContext.Provider;

export const useUsageLayout = () => useContext(LayoutContext);

/**
 * The page's own figures, above everything.
 *
 * Every registry in this product opens the same way: the title, then a strip of
 * the numbers the screen is about, then the detail. On this page those numbers
 * used to sit inside the third block down, so a reader had to go looking for
 * what the tab was even about.
 */
export function PageKpis({ items }: { items: { label: string; value: string; sub?: string }[] }) {
  return (
    <div className="rounded-xl border border-canvas-border bg-canvas-elevated grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-canvas-border">
      {items.map(item => (
        <div key={item.label} className="px-5 py-4">
          <div className="text-[0.75rem] font-medium uppercase tracking-[0.06em] text-ink-500">{item.label}</div>
          <div className="mt-2 text-[1.75rem] font-semibold text-ink-900 leading-none tabular-nums">{item.value}</div>
          {item.sub && <div className="mt-1.5 text-[0.75rem] text-ink-500">{item.sub}</div>}
        </div>
      ))}
    </div>
  );
}

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
  /*
   * One card of rows rather than three cards of the same shape.
   *
   * Three identical boxes side by side make a reader compare them, and there is
   * nothing here to compare: they are three unrelated things that each need one
   * decision. As rows they read as a list of jobs, which is what they are, and
   * the action sits at the end of the sentence it belongs to.
   */
  const layout = useUsageLayout();
  if (layout === 'report') {
    return (
      <ul className="border-y border-ink-900/15 divide-y divide-canvas-border">
        {cards.map(card => (
          <li key={card.id} className="flex items-baseline justify-between gap-6 py-4">
            <p className="text-[1rem] text-ink-800 leading-relaxed max-w-[68ch]">{card.text}</p>
            <button
              type="button"
              onClick={() => onAct(card)}
              className="shrink-0 inline-flex items-center gap-1 text-[0.875rem] font-medium text-brand-700 hover:underline"
            >
              {card.actionLabel} <ArrowRight size={14} />
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="rounded-xl border border-canvas-border bg-canvas-elevated divide-y divide-canvas-border">
      {cards.map(card => (
        <li key={card.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
          <div className="flex items-start gap-3 min-w-0">
            <AlertTriangle size={15} className="text-risk-600 shrink-0 mt-0.5" />
            <p className="text-[0.875rem] text-ink-800 leading-relaxed">{card.text}</p>
          </div>
          <button
            type="button"
            onClick={() => onAct(card)}
            className="shrink-0 inline-flex items-center gap-1 text-[0.75rem] font-medium text-brand-700 hover:underline"
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
 * One block: a title, one sentence, the numbers.
 *
 * `chart` and `table` are two renderings of the same numbers. You cannot pass a
 * chart without also passing the table behind it.
 *
 * `hint` and `footer` are the caveats, and they sit folded under "How this is
 * counted" rather than on screen. Nothing is lost: a reader who wants to argue
 * with a figure is one click from every reason it is what it is, and a reader
 * who just wants the number is not reading three paragraphs to find it.
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
  code,
  figure,
  of,
  context,
  tone,
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
  /**
   * The block's own figure, in the shape the AI insight cards use elsewhere in
   * this product: a short code, a number, what it is out of, and one line of
   * context. A reader gets the answer from the head of the block and the
   * evidence underneath it, which is how every other data surface here reads.
   */
  code?: string;
  figure?: string;
  of?: string;
  context?: ReactNode;
  tone?: 'plain' | 'risk';
}) {
  const [asTable, setAsTable] = useState(false);
  const toggleable = Boolean(chart && table);
  const layout = useUsageLayout();
  const report = layout === 'report';

  /*
   * The sentence moves off the screen and into the fold.
   *
   * The build spec asked every block to lead with a sentence. Held next to the
   * rest of this product that rule is what made the page look nothing like it:
   * a registry screen here carries about 240 words and not one paragraph over
   * eight, while this page carried 900 words and said the same figure up to six
   * times, once in the sentence and again in the numbers under it.
   *
   * So the data leads and the sentence explains, one click down, where it can
   * be read by anybody who wants to argue with a figure. Nothing is lost and
   * nothing is said twice.
   *
   * The fold has one condition: something else on screen has to answer the
   * title. A figure and its context line do. A bare table behind a "Show the
   * numbers" fold does not, and a block in that state rendered as a heading
   * with nothing under it, which is how the team block read. So a block with no
   * figure of its own keeps its sentence on screen.
   */
  const hasData = Boolean(children || chart || table);
  const answered = Boolean(figure);

  return (
    <section id={id} data-usage-block className={`scroll-mt-6 ${report ? 'py-8 first:pt-2' : ''}`}>
      {/*
        * A block is a row of its group's card, not a card of its own.
        *
        * Ten white rounded cards stacked down a tab give a reader no way to
        * tell the headline from the footnote: everything is the same size and
        * the same shape, so nothing is emphasised. The group owns the card, the
        * blocks are hairline-separated rows inside it, and the page goes from
        * ten boxes to three.
        */}
      <div className={`flex items-center justify-between gap-4 ${report ? 'px-0 pb-2' : 'px-5 pt-5 pb-2'}`}>
        <div className="min-w-0">
          {code && (
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${tone === 'risk' ? 'bg-risk-600' : 'bg-brand-600'}`} />
              <span className="text-[0.75rem] font-mono uppercase tracking-[0.06em] text-ink-400">{code}</span>
            </div>
          )}
          <h3 className={`font-semibold text-ink-900 truncate ${report ? 'text-[1.25rem]' : 'text-[1rem]'}`}>{title}</h3>
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
      <div className={report ? 'px-0' : 'px-5 pb-5'}>
        {/* The lede answers the title, so it sits under it in the reading size
            rather than over it in a larger one. A report reads it as prose. */}
        {figure && (
          <div className="mb-4">
            <div className="flex items-baseline gap-2">
              <span className={`text-[2rem] font-semibold leading-none tabular-nums ${tone === 'risk' ? 'text-risk-700' : 'text-ink-900'}`}>
                {figure}
              </span>
              {of && <span className="text-[1rem] text-ink-400 tabular-nums">/ {of}</span>}
            </div>
            {context && <p className="mt-2 text-[0.875rem] text-ink-600">{context}</p>}
          </div>
        )}

        {lede && (!hasData || !answered) && (
          <p className={`mb-4 text-ink-700 leading-relaxed ${report ? 'text-[1rem] max-w-[68ch]' : 'text-[0.875rem] max-w-[76ch]'}`}>
            {lede}
          </p>
        )}
        {children}
        {/* A block with a chart shows it and keeps the numbers one click away.
            A block with only a table folds it: the sentence above is the answer,
            and the table is the evidence for a reader who wants to check it. */}
        {toggleable
          ? (asTable ? table : chart)
          : chart ?? (table && <Fold label="Show the numbers">{table}</Fold>)}
      </div>
      {(hint || footer || (lede && hasData && answered)) && (
        <details className={`group ${report ? 'pt-4' : 'px-5 pb-5 -mt-3'}`}>
          <summary className="inline-flex items-center gap-1 text-[0.75rem] text-ink-500 hover:text-brand-700 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
            <ChevronRight size={13} className="transition-transform group-open:rotate-90" />
            How this is counted
          </summary>
          <div className="mt-2 space-y-2 text-[0.75rem] text-ink-500 leading-relaxed max-w-[80ch]">
            {lede && hasData && answered && <p className="text-ink-600">{lede}</p>}
            {hint && <p>{hint}</p>}
            {footer && <div>{footer}</div>}
          </div>
        </details>
      )}
    </section>
  );
}

/** Blocks that belong together, so the page reads in groups. */
export function BlockGroup({ title, children }: { title: string; children: ReactNode }) {
  const layout = useUsageLayout();

  if (layout === 'report') {
    // No card at all. A heading, a rule under it, and the blocks as passages.
    return (
      <section className="pt-4">
        <h2 className="text-[1.5rem] font-semibold tracking-tight text-ink-900">{title}</h2>
        <div className="mt-3 border-t border-ink-900/15 divide-y divide-canvas-border">{children}</div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-canvas-border bg-canvas-elevated overflow-hidden">
      <header className="px-5 py-3 bg-canvas border-b border-canvas-border">
        <h2 className="text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-ink-500">{title}</h2>
      </header>
      <div className="divide-y divide-canvas-border">{children}</div>
    </section>
  );
}

/* ── The tabs ────────────────────────────────────────────────────────────── */

/**
 * Underlined tabs, the Knowledge Hub recipe.
 *
 * They sit at the foot of the header strip so the strip's own border is the
 * underline track, and the active brand bar springs between them on a shared
 * `layoutId`. The page grows one control rather than one more box.
 *
 * Labels are 14px rather than the Knowledge Hub's 13px, because this platform
 * has no 13px step.
 */
export function UsageTabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: T; label: string; icon: ElementType }[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div role="tablist" className="flex gap-6">
      {tabs.map(tab => {
        const Icon = tab.icon;
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`pb-3 text-[0.875rem] font-semibold relative transition-colors cursor-pointer whitespace-nowrap ${
              isActive ? 'text-brand-700' : 'text-ink-500 hover:text-ink-700'
            }`}
          >
            <span className="flex items-center gap-2">
              <Icon size={14} />
              {tab.label}
            </span>
            {isActive && (
              <motion.div
                layoutId="usage-main-tab-underline"
                className="absolute bottom-0 left-0 right-0 h-[3px] bg-brand-600 rounded-full"
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              />
            )}
          </button>
        );
      })}
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
  const layout = useUsageLayout();
  const report = layout === 'report';
  const cls = report
    ? (long ? 'text-[2rem]' : 'text-[2.5rem]')
    : size === 'lg' ? (long ? 'text-[1.5rem]' : 'text-[1.75rem]') : size === 'md' ? 'text-[1.5rem]' : 'text-[1.25rem]';

  // A report sets the figure first and captions it underneath, the way a
  // printed paper does. The dense layout labels it first, the way a strip does.
  if (report) {
    return (
      <div className="min-w-0 py-2">
        <div className={`${cls} font-semibold text-ink-900 leading-none tabular-nums whitespace-nowrap`}>{value}</div>
        <div className="mt-2 text-[0.875rem] text-ink-600">{label}</div>
        {sub && <div className="mt-1 text-[0.75rem] text-ink-500">{sub}</div>}
        {delta !== null && delta !== undefined && (
          <div className="mt-1.5 text-[0.75rem] text-ink-500 tabular-nums">
            {Math.abs(delta) < 0.5
              ? `About the same as ${deltaLabel ?? 'the window before'}`
              : `${delta > 0 ? 'Up' : 'Down'} ${fmtOneDp(Math.abs(delta))}% on ${deltaLabel ?? 'the window before'}`}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-w-0 px-5 py-4">
      {/* The label leads and the number answers it, which is the order every
          KPI strip in this product reads in. */}
      <div className="text-[0.75rem] font-medium uppercase tracking-[0.06em] text-ink-500">{label}</div>
      <div className={`mt-2 ${cls} font-semibold text-ink-900 leading-none tabular-nums whitespace-nowrap`}>{value}</div>
      {sub && <div className="mt-1.5 text-[0.75rem] text-ink-600">{sub}</div>}
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
/**
 * A sum, written as a sum.
 *
 * Left of the equals sign is the arithmetic with the real numbers in it, right
 * of it is the answer, under it is where each input came from. Nobody has to
 * take the answer on trust: they can do it on a calculator, and if they think
 * an input is wrong they can see which one to argue with.
 */
export function Maths({
  rows,
  showFrom = true,
}: {
  rows: { sum: ReactNode; answer: string; from?: ReactNode }[];
  /**
   * Where each input came from.
   *
   * On screen it repeated the rate three times over four rows and pushed the
   * arithmetic apart, so the sum was harder to follow than the sum itself. It
   * belongs one click down, with everything else somebody would argue with.
   */
  showFrom?: boolean;
}) {
  return (
    <ul className="mt-2 space-y-3">
      {rows.map((row, i) => (
        <li key={i} className="border-t border-canvas-border pt-3 first:border-0 first:pt-0">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <span className="text-[1rem] text-ink-800 tabular-nums">{row.sum}</span>
            <span className="text-[1.125rem] font-semibold text-ink-900 tabular-nums shrink-0">{row.answer}</span>
          </div>
          {showFrom && row.from && <p className="mt-1 text-[0.75rem] text-ink-400 leading-relaxed">{row.from}</p>}
        </li>
      ))}
    </ul>
  );
}

/** The same inputs, folded: one line each, under the block's own fold. */
export function MathsSources({ rows }: { rows: { sum: ReactNode; from?: ReactNode }[] }) {
  return (
    <ul className="space-y-1.5">
      {rows.filter(r => r.from).map((row, i) => (
        <li key={i}>{row.from}</li>
      ))}
    </ul>
  );
}

/**
 * Two bars, side by side: what it would have taken, what it took.
 *
 * The one thing a reader should understand without reading anything. The
 * platform's bar is a sliver next to the by-hand bar, which is the whole point
 * of the block, so both are labelled with their own number rather than left to
 * a legend.
 */
export function Compare({
  rows,
}: {
  rows: { label: string; value: string; amount: number; note?: ReactNode; tone?: 'brand' | 'muted' }[];
}) {
  const top = Math.max(...rows.map(r => r.amount), 1);
  /*
   * Label and figure on one line, the bar under them, the caveat under that.
   *
   * The label used to hold its own narrow column beside the bar, which gave a
   * one line caption six lines to wrap into and left the row looking broken.
   * Nothing here needs to be read across: the eye goes label, figure, bar.
   */
  return (
    <ul className="mt-4 space-y-4">
      {rows.map(row => (
        <li key={row.label}>
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-[0.875rem] text-ink-800">{row.label}</span>
            <span className="text-[1rem] font-semibold text-ink-900 tabular-nums shrink-0">{row.value}</span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-canvas overflow-hidden">
            <div
              className={`h-full rounded-full ${row.tone === 'muted' ? 'bg-ink-300' : 'bg-brand-600'}`}
              style={{ width: `${Math.max((row.amount / top) * 100, 0.5)}%` }}
            />
          </div>
          {/* Where the bar's number came from, on the bar itself. A figure this
              big cannot carry its own caveat in a fold. */}
          {row.note && <p className="mt-1.5 text-[0.75rem] text-ink-500 leading-relaxed">{row.note}</p>}
        </li>
      ))}
    </ul>
  );
}

/**
 * The sum, told as sentences rather than as a formula.
 *
 * A line at a time, in the order somebody would say it out loud: what it would
 * have taken, what it actually took, what is left, what it is worth. No
 * operators and no algebra, because the reader is an audit lead rather than a
 * spreadsheet. The rate behind a line sits under it in small type, so the line
 * can be argued with without being cluttered.
 */
export function Story({
  rows,
}: {
  rows: { text: ReactNode; value: string; note?: ReactNode; strong?: boolean }[];
}) {
  return (
    <ul className="mt-4 divide-y divide-canvas-border border-t border-canvas-border">
      {rows.map((row, i) => (
        <li key={i} className="py-3 flex items-baseline justify-between gap-6">
          <span className="min-w-0">
            <span className={`text-[0.875rem] ${row.strong ? 'font-semibold text-ink-900' : 'text-ink-700'}`}>
              {row.text}
            </span>
            {row.note && <span className="block mt-0.5 text-[0.75rem] text-ink-400 leading-relaxed">{row.note}</span>}
          </span>
          <span
            className={`shrink-0 tabular-nums text-ink-900 ${row.strong ? 'text-[1.25rem] font-semibold' : 'text-[1rem]'}`}
          >
            {row.value}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * A table or a note the block does not need to shout.
 *
 * Same fold as "How this is counted", used inside a block for evidence a reader
 * only wants when they are checking something. It stays in the page rather than
 * being loaded on open, so nothing here is hidden from a find on the page.
 */
export function Fold({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="group mt-4">
      <summary className="inline-flex items-center gap-1 text-[0.75rem] font-medium text-brand-700 hover:underline cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <ChevronRight size={13} className="transition-transform group-open:rotate-90" />
        {label}
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

/** A row of stats, so they read as one fact in parts. */
export function StatRow({ children, cols = 4 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  /*
   * Hairline-divided cells rather than floating columns, so a row of figures
   * reads as one instrument. This is the same strip Audit Coverage puts under
   * its title and Manage Exceptions puts under its tabs.
   *
   * The count is a prop because a block that has three figures to show should
   * not pad itself to four to fill the strip, and a four-column grid holding
   * three cells leaves an empty box that reads as a figure that failed to load.
   */
  const layout = useUsageLayout();
  const wide = cols === 2 ? 'lg:grid-cols-2' : cols === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4';
  if (layout === 'report') {
    // Figures with air around them, no rules between: the page is already ruled
    // by its sections and a second grid of lines would fight them.
    return <div className={`grid grid-cols-2 ${wide} gap-x-10 gap-y-6 py-2`}>{children}</div>;
  }
  return (
    <div className={`-mx-5 border-y border-canvas-border grid grid-cols-2 ${wide} divide-y lg:divide-y-0 lg:divide-x divide-canvas-border`}>
      {children}
    </div>
  );
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
  caption,
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
  /**
   * What the bars are counting.
   *
   * A block's head says one number and the bars under it say four, and nothing
   * on screen said whether those four add up to the head or to something wider.
   * A reader who assumes the wrong one reads the chart backwards, so any bar
   * list whose total is not the figure above it says so here, in one line.
   */
  caption?: ReactNode;
}) {
  const max = scaleTo ?? Math.max(1, ...rows.map(r => r.value));
  const fill = tone === 'risk' ? 'bg-risk-600' : 'bg-brand-600';
  return (
    <>
    {caption && <p className="mb-2 text-[0.75rem] text-ink-500">{caption}</p>}
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
    </>
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
