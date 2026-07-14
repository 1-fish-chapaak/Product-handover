/**
 * Platform Usage — the chrome layer.
 *
 * Every card, tooltip, meter, delta chip and ranked row on this page is built
 * from exactly one of these. The page used to hand-roll each of them at the
 * call site (six different progress-bar spellings, five delta chips, Recharts'
 * default tooltip), which is why it read as an admin panel rather than a
 * product surface.
 *
 * Tokens (colours, axis props, the card outline) live in `usageTokens.ts`.
 */

import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowUpRight, type LucideIcon } from 'lucide-react';
import { CARD_BASE, ICON_TILE, ICON_TILE_BRAND, KH_EASE, fmt } from './usageTokens';

/* ── Card ──────────────────────────────────────────────────────────────────
   One shell, three ranks. Padding scales with rank — uniform p-4 everywhere is
   the flattest possible page, and flat is what "generic admin" looks like.

   The header wears the Knowledge Hub's icon tile: a 40px brand-50 square with a
   brand-700 glyph. A bare 14px grey glyph beside the title was the single
   biggest tell that this page came from a different kit than the Hub. */

type Rank = 'hero' | 'primary' | 'compact';

const RANK_PAD: Record<Rank, string> = {
  hero: 'p-6 lg:p-7',
  primary: 'p-5 lg:p-6',
  compact: 'p-5',
};

const RANK_TITLE: Record<Rank, string> = {
  hero: 'text-[0.9375rem] font-semibold text-ink-900',
  primary: 'text-[0.875rem] font-semibold text-ink-900',
  compact: 'text-[0.8125rem] font-semibold text-ink-900',
};

/**
 * A panel. The header is part of the padded body, not a bordered strip — the
 * strip was a second hairline stacked on the card's own, which is why the old
 * page read as boxes inside boxes.
 *
 * Flat at rest, and it stays flat on hover: the Hub's lift is an affordance for
 * a tile you can click, and a chart panel is not one. Lifting it would promise
 * a click that never happens.
 */
export function Card({
  icon: Icon, title, subtitle, right, rank = 'primary', className = '', bodyClassName = '', children,
}: {
  icon?: LucideIcon;
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  rank?: Rank;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <section className={`${CARD_BASE} ${RANK_PAD[rank]} flex flex-col ${className}`}>
      {title && (
        <header className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-start gap-3 min-w-0">
            {Icon && (
              <div className={`${ICON_TILE} ${ICON_TILE_BRAND}`}>
                <Icon size={18} strokeWidth={1.75} />
              </div>
            )}
            <div className="min-w-0">
              {/* Titles are takeaway sentences, not nouns — they wrap. */}
              <h3 className={`${RANK_TITLE[rank]} leading-snug`}>{title}</h3>
              {subtitle && <p className="mt-1 text-[0.75rem] text-ink-500 leading-snug">{subtitle}</p>}
            </div>
          </div>
          {right && <div className="shrink-0">{right}</div>}
        </header>
      )}
      <div className={`flex-1 min-w-0 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

/**
 * The micro-heading used *inside* a card. The Hub's column-label spelling —
 * ink-500 on `tracking-wide`, not ink-400 on `tracking-[0.1em]`.
 *
 * This is deliberately NOT what a section header looks like: those are
 * sentence-case now (see `Band`), so the two ranks can no longer be confused.
 */
export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`text-[0.6875rem] font-semibold text-ink-500 uppercase tracking-wide ${className}`}>
      {children}
    </div>
  );
}

/* ── Tile ──────────────────────────────────────────────────────────────────
   The Hub's clickable card, exactly: hairline at rest, brand-300 border and a
   spring lift on hover, icon in a brand-50 tile. Anything on this page you can
   click through to a detail wears this; anything you can't wears `Card`. */

export function Tile({ onClick, index = 0, className = '', ariaLabel, children }: {
  onClick: () => void;
  index?: number;
  className?: string;
  ariaLabel?: string;
  children: ReactNode;
}) {
  const prefersReduced = useReducedMotion();
  return (
    // Two elements, as in the Hub: the wrapper owns the entry (a delayed fade-up
    // that must not re-run on hover), the button owns the lift (a spring that
    // must not inherit the entry's easing). One element cannot do both — a
    // single `transition` prop would govern whichever animation ran last.
    <motion.div
      initial={prefersReduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        prefersReduced
          ? { duration: 0 }
          : { duration: 0.3, delay: Math.min(index, 8) * 0.04, ease: KH_EASE }
      }
      className="min-w-0"
    >
      <motion.button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        whileHover={prefersReduced ? undefined : { y: -3, boxShadow: '0 8px 24px -10px rgb(15 8 30 / 0.16)' }}
        whileTap={prefersReduced ? undefined : { scale: 0.99 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        // Colours only in CSS. The shadow is Motion's to spring — a CSS
        // transition on box-shadow would fight it for the same property.
        className={`group w-full h-full rounded-lg border border-canvas-border bg-canvas-elevated transition-colors duration-200 text-left cursor-pointer hover:border-brand-300 ${className}`}
      >
        {children}
      </motion.button>
    </motion.div>
  );
}

/* ── Delta ─────────────────────────────────────────────────────────────────
   A number with no baseline is a vanity metric. Every headline on this page
   carries one, and the baseline is always named out loud. */

export function DeltaPill({ pct, compareLabel, size = 'md' }: {
  pct: number | null | undefined;
  /** What it is being compared to, e.g. "previous 30 days". Named, never implied. */
  compareLabel: string;
  size?: 'sm' | 'md';
}) {
  if (typeof pct !== 'number') return null;
  const h = size === 'sm' ? 'h-[1.125rem] px-1.5 text-[0.625rem]' : 'h-[1.375rem] px-2 text-[0.75rem]';
  const flat = pct === 0;
  const up = pct > 0;
  const tone = flat
    ? 'text-ink-500 bg-ink-900/[0.05]'
    : up
      ? 'text-compliant-700 bg-compliant-700/[0.08]'
      : 'text-risk-700 bg-risk-700/[0.08]';
  return (
    <span
      title={`vs the ${compareLabel}`}
      className={`inline-flex items-center gap-0.5 rounded-full font-semibold tabular-nums shrink-0 ${h} ${tone}`}
    >
      {/* The arrow, not the hue, is what carries direction for the 8% of men who
          cannot rely on red vs green. */}
      {!flat && (
        <ArrowUpRight
          size={size === 'sm' ? 10 : 12}
          strokeWidth={2.5}
          className={up ? '' : 'rotate-90'}
          aria-hidden
        />
      )}
      {up ? '+' : ''}{pct}%
    </span>
  );
}

/* ── Meter ─────────────────────────────────────────────────────────────────
   The bullet bar. Replaces every hand-rolled `h-1 rounded-full bg-brand-50` on
   the page — there were six spellings of it, at four different heights. */

export function Meter({
  label, value, note, pct, tone = 'brand', delta, compareLabel, index = 0,
}: {
  label: ReactNode;
  /** The number that gets read. */
  value?: ReactNode;
  /** Anything trailing the value — a share, a unit. */
  note?: ReactNode;
  /** Fill, 0–100. */
  pct: number;
  tone?: 'brand' | 'muted' | 'attention';
  delta?: number | null;
  compareLabel?: string;
  index?: number;
}) {
  const prefersReduced = useReducedMotion();
  const fill =
    tone === 'attention' ? 'bg-mitigated-700' : tone === 'muted' ? 'bg-brand-300' : 'bg-brand-600';
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <span className="text-[0.75rem] font-medium text-ink-600 truncate min-w-0">{label}</span>
        <span className="shrink-0 inline-flex items-baseline gap-1.5 text-[0.75rem] text-ink-400 tabular-nums">
          {value !== undefined && <span className="font-semibold text-ink-900">{value}</span>}
          {note}
          {typeof delta === 'number' && compareLabel && (
            <DeltaPill pct={delta} compareLabel={compareLabel} size="sm" />
          )}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-ink-900/[0.06] overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${fill}`}
          initial={prefersReduced ? false : { width: 0 }}
          animate={{ width: `${Math.max(1.5, Math.min(100, pct))}%` }}
          transition={
            prefersReduced
              ? { duration: 0 }
              : { type: 'spring', stiffness: 260, damping: 30, delay: 0.04 * index }
          }
        />
      </div>
    </div>
  );
}

/* ── Tooltip ───────────────────────────────────────────────────────────────
   The one surface on this page allowed to cast a shadow, because it is the one
   surface that genuinely lifts off it. Values lead, series names follow — the
   reader already knows which series they hovered; they came for the number. */

interface TooltipRow {
  color: string;
  name: string;
  value: number;
}

export function TooltipCard({ title, rows, footer }: {
  title: string;
  rows: TooltipRow[];
  footer?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-canvas-border bg-canvas-elevated px-3 py-2.5 shadow-[0_8px_24px_-6px_rgba(15,7,32,0.12),0_2px_6px_-2px_rgba(15,7,32,0.08)]">
      <div className="text-[0.6875rem] text-ink-400 mb-1.5">{title}</div>
      <div className="space-y-1">
        {rows.map(r => (
          <div key={r.name} className="flex items-center gap-2.5">
            {/* A line key, not a filled box: at tooltip density a box is
                data-weight ink doing a label's job. */}
            <span className="h-[3px] w-3.5 rounded-full shrink-0" style={{ background: r.color }} />
            <span className="text-[0.75rem] text-ink-500 mr-3">{r.name}</span>
            <span className="ml-auto text-[0.8125rem] font-semibold text-ink-900 tabular-nums">
              {fmt(r.value)}
            </span>
          </div>
        ))}
      </div>
      {footer && (
        <div className="mt-2 pt-2 border-t border-canvas-border text-[0.6875rem] text-ink-400">{footer}</div>
      )}
    </div>
  );
}

/* ── Ranked row ────────────────────────────────────────────────────────────
   The "most-used areas" shape: name, meter, value, share. Used wherever the
   page ranks a handful of things against each other. */

export function RankedRow({ label, count, share, pct, onClick, index = 0, active }: {
  label: string;
  count: number;
  share?: number;
  pct: number;
  onClick?: () => void;
  index?: number;
  active?: boolean;
}) {
  const prefersReduced = useReducedMotion();
  const inner = (
    <>
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <span className={`text-[0.75rem] font-medium truncate min-w-0 transition-colors ${
          onClick ? 'text-ink-700 group-hover:text-brand-700' : 'text-ink-700'
        }`}>
          {label}
        </span>
        <span className="shrink-0 text-[0.75rem] text-ink-400 tabular-nums">
          <span className="font-semibold text-ink-900">{fmt(count)}</span>
          {typeof share === 'number' && <span className="ml-1.5">{share}%</span>}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-ink-900/[0.06] overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-brand-600 group-hover:bg-brand-500 transition-colors"
          initial={prefersReduced ? false : { width: 0 }}
          animate={{ width: `${Math.max(1.5, pct)}%` }}
          transition={
            prefersReduced ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 30, delay: 0.03 * index }
          }
        />
      </div>
    </>
  );

  const shell = `group w-full text-left -mx-2 px-2 py-2 rounded-lg transition-colors ${
    onClick ? 'cursor-pointer hover:bg-canvas' : ''
  } ${active ? 'bg-canvas' : ''}`;

  return onClick
    ? <button type="button" onClick={onClick} className={shell}>{inner}</button>
    : <div className={shell}>{inner}</div>;
}

/* ── Section band ──────────────────────────────────────────────────────────
   The page is long. These are the only things that make it navigable, so they
   get real air above them. */

export function Band({ title, note, children }: {
  title?: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    // 40px between sections against 16px within them. The whole page used to run
    // on one gap, so it read as a single undifferentiated column of boxes with
    // nothing telling the eye where one idea ended and the next began. Rhythm is
    // the cheapest hierarchy there is: separation between groups has to be
    // clearly bigger than separation inside them, or there are no groups.
    <section className="pt-10 first:pt-0">
      {/* The Knowledge Hub's bucket header: sentence case, 14px, ink-800.
          It used to be an 11px uppercase eyebrow in ink-400 — which is the
          Hub's *in-card* label rank, so the page was announcing its section
          headings in the voice of a column header: two steps quieter than the
          thing they introduce, and shouting while they did it.

          The Hub tails its heading with a "· N" item count. There is no honest
          count to put here — a band holds cards, not a list of things — so the
          right slot stays the `note`, which says what the section is for.

          A band on a single-band tab has no heading at all: the tab name and
          its subhead have already said it twice, and a third restatement is
          noise. */}
      {(title || note) && (
        <div className="flex items-center justify-between gap-4 mb-4">
          {title
            ? <div className="text-[0.875rem] font-medium text-ink-800">{title}</div>
            : <span />}
          {note && <span className="text-[0.75rem] text-ink-400">{note}</span>}
        </div>
      )}
      {children}
    </section>
  );
}
