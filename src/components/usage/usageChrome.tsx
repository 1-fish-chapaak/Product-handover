/**
 * Platform Usage — the chrome layer.
 *
 * Every card, tooltip, meter, delta chip, legend key, sparkline and ranked row
 * on this page is built from exactly one of these. The page used to hand-roll
 * each of them at the call site (six different progress-bar spellings, five
 * delta chips, Recharts' default tooltip), which is why it read as an admin
 * panel rather than a product surface.
 *
 * Tokens (colours, axis props, the card outline) live in `usageTokens.ts`.
 *
 * The page is flat by rule — DESIGN.md §4 puts borders before shadows and keeps
 * cards flat at rest — so the polish has to be carried by the marks themselves:
 * capped bar ends, a lighter step of the fill's own ramp behind every meter, a
 * gap in the surface colour between touching fills, and a hover layer on every
 * plot. That is what these primitives encode.
 */

import { useMemo, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowUpRight, Info, type LucideIcon } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip } from 'recharts';
import ChartAutoSizer from './ChartAutoSizer';
import { CARD_BASE, DONUT_SHADES, HOVER_FILL, ICON_TILE, ICON_TILE_BRAND, KH_EASE, fmt } from './usageTokens';

/* ── Card ──────────────────────────────────────────────────────────────────
   One shell, three ranks. Padding scales with rank — uniform p-4 everywhere is
   the flattest possible page, and flat is what "generic admin" looks like.

   The header wears the Knowledge Hub's icon tile: a 40px brand-50 square with a
   brand-700 glyph. A bare 14px grey glyph beside the title was the single
   biggest tell that this page came from a different kit than the Hub. */

type Rank = 'hero' | 'primary' | 'compact';

/* DESIGN.md §5 puts a card's internal padding at 16px, with 24/28px reserved for
   AI response prose. This page had drifted to 20/24/28, which is the AI prose
   rank applied to an analytics grid: it cost roughly a card's worth of height per
   band and pushed the fifth thing on every tab below the fold. Back on spec, and
   the rank now scales 16 → 20 → 24 rather than 20 → 24 → 28. */
const RANK_PAD: Record<Rank, string> = {
  hero: 'p-5 lg:p-6',
  primary: 'p-4 lg:p-5',
  compact: 'p-4',
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
        <header className="flex items-start justify-between gap-4 mb-4">
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

/* ── Info popover ────────────────────────────────────────────────────────────
   The ⓘ that opens a "what this counts / what it doesn't" note. Same spelling as
   the KPI tiles' definition popover — one transparency affordance across the page,
   so a reader who learned it on the KPI band already knows it on a chart card.

   Drop it in a card's `right` header slot: `right={<InfoPopover .../>}`. The
   button anchors the popover, which drops down from the top-right of the card. */
export function InfoPopover({ label, counts, excludes, note }: {
  /** What is being explained — used only for the button's accessible name. */
  label: string;
  /** What the number is built from. */
  counts?: ReactNode;
  /** What is deliberately left out. */
  excludes?: ReactNode;
  /** A trailing plain-language note (e.g. how a threshold is defined). */
  note?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(o => !o)}
        aria-label={`How ${label} is worked out`}
        className="shrink-0 text-ink-300 hover:text-brand-600 transition-colors cursor-help"
      >
        <Info size={15} />
      </button>
      {open && (
        <div className="absolute right-0 top-7 z-30 w-64 rounded-lg border border-canvas-border bg-canvas-elevated p-3 text-left shadow-[0_8px_24px_-6px_rgba(15,7,32,0.14)]">
          {counts && (
            <p className="text-[0.75rem] text-ink-700 leading-relaxed">
              <span className="font-semibold text-ink-900">Counts:</span> {counts}
            </p>
          )}
          {excludes && (
            <p className="mt-1.5 text-[0.75rem] text-ink-500 leading-relaxed">
              <span className="font-semibold text-ink-700">Doesn't count:</span> {excludes}
            </p>
          )}
          {note && <p className="mt-1.5 text-[0.75rem] text-ink-500 leading-relaxed">{note}</p>}
        </div>
      )}
    </div>
  );
}

/* ── Lede ──────────────────────────────────────────────────────────────────
   The answer, before the evidence. Every tab asks one question in its subhead;
   this is that question answered in a sentence, at the top, in a size that wins.

   The page used to bury its verdict: the plain-English reading was set as faint
   grey helper text, smaller than the charts it summarised, so the one thing the
   reader actually needed to leave with was the quietest mark on the tab. This
   inverts that. The headline clause is dark and heavy; the qualifier that
   follows stays light, because it is context, not the point. A single accent
   dot carries a health read (good / watch / neutral) without a loud badge. */

export function UsageLede({ lead, tone = 'neutral', children }: {
  /** The headline clause — the answer itself. Dark, semibold, read first. */
  lead: ReactNode;
  /** The health read the dot carries. Neutral is the default; it is not a status. */
  tone?: 'good' | 'watch' | 'neutral';
  /** The supporting clause — the numbers behind the answer. Light, read second. */
  children?: ReactNode;
}) {
  const dot =
    tone === 'good' ? 'bg-compliant-600'
      : tone === 'watch' ? 'bg-mitigated-600'
        : 'bg-brand-500';
  return (
    <div className="flex items-baseline gap-2.5">
      <span className={`translate-y-[-0.1rem] h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden />
      <p className="text-[1.0625rem] leading-snug text-ink-400 max-w-[70ch]">
        <span className="font-semibold text-ink-900">{lead}</span>
        {children ? <> {children}</> : null}
      </p>
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

/* ── Legend ────────────────────────────────────────────────────────────────
   Two or more series always carry one. Identity comes from the mark beside the
   text, never from the text's own colour: a light hue is illegible as type, and
   colour-coded labels are the first thing to fail under CVD. */

export type LegendKey = {
  color: string;
  label: string;
  /** A dashed key for a chrome series (the previous period) — not a solid one. */
  dashed?: boolean;
};

export function Legend({ keys, className = '' }: { keys: LegendKey[]; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 ${className}`}>
      {keys.map(k => (
        <span key={k.label} className="inline-flex items-center gap-1.5 text-[0.75rem] text-ink-600">
          {k.dashed ? (
            <svg width="14" height="3" aria-hidden className="shrink-0">
              <line
                x1="0" y1="1.5" x2="14" y2="1.5"
                stroke={k.color} strokeWidth="2" strokeDasharray="3 2" strokeLinecap="round"
              />
            </svg>
          ) : (
            <span className="h-[3px] w-3.5 rounded-full shrink-0" style={{ background: k.color }} />
          )}
          {k.label}
        </span>
      ))}
    </div>
  );
}

/* ── Meter ─────────────────────────────────────────────────────────────────
   The bullet bar. Replaces every hand-rolled `h-1 rounded-full bg-brand-50` on
   the page — there were six spellings of it, at four different heights.

   The track is a LIGHTER STEP OF THE FILL'S OWN RAMP, not a grey wash: state
   then reads across the whole bar rather than only across the part that is
   filled, and an empty meter still says which hue it belongs to. */

const METER_FILL = {
  brand: 'bg-brand-600',
  muted: 'bg-brand-300',
  attention: 'bg-mitigated-700',
} as const;

const METER_TRACK = {
  brand: 'bg-brand-100/70',
  muted: 'bg-brand-100/70',
  attention: 'bg-mitigated-700/[0.14]',
} as const;

export type MeterTone = keyof typeof METER_FILL;

export function Meter({
  label, value, note, pct, tone = 'brand', delta, compareLabel, index = 0, title, size = 'sm',
}: {
  label: ReactNode;
  /** The number that gets read. */
  value?: ReactNode;
  /** Anything trailing the value — a share, a unit. */
  note?: ReactNode;
  /** Fill, 0–100. */
  pct: number;
  tone?: MeterTone;
  delta?: number | null;
  compareLabel?: string;
  index?: number;
  title?: string;
  /**
   * The bar's weight. `sm` is the hairline bullet used inline in dense lists
   * (RankedRow, the KPI drawers). `lg` is a substantial 28px block for a card
   * whose bars ARE the content — the seat bands, so they carry the same weight
   * as the funnel beside them rather than reading two steps quieter. */
  size?: 'sm' | 'lg';
}) {
  const prefersReduced = useReducedMotion();
  const lg = size === 'lg';
  const radius = lg ? 'rounded-md' : 'rounded-full';
  return (
    <div title={title}>
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
      <div className={`${lg ? 'h-7' : 'h-1.5'} ${radius} overflow-hidden ${METER_TRACK[tone]}`}>
        <motion.div
          className={`h-full ${radius} ${METER_FILL[tone]}`}
          initial={prefersReduced ? false : { width: 0 }}
          animate={{ width: `${Math.max(lg ? 2 : 1.5, Math.min(100, pct))}%` }}
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

/* ── Trend bars ────────────────────────────────────────────────────────────
   The page's one small-multiple mark: a distribution, drawn as bars from a zero
   baseline, beside the number those bars add up to.

   THIS REPLACED THE SPARKLINE, and it is the same argument in both places it is
   used (the KPI band, and the twelve area cards). A sparkline is normalised to
   its own maximum and has no baseline, so it cannot be checked against anything:
   a 2-action change and a 200-action change draw the identical curve, and the
   area under it adds up to nothing. It is a shape that LOOKS like data.

   A bar's length is a quantity. So these bars literally are the number printed
   beside them, split by day — which is a claim a reader can verify, and the
   reason the KPI band can say "the 30 days, adding up to 525" and mean it.

   Hand-drawn divs rather than a Recharts instance: the area grid renders twelve
   of these, and twelve ResponsiveContainers with their own resize observers is a
   lot of layout work to say "it went up a bit". */

/** Singular/plural the tooltip unit against the value a bar actually holds —
 *  "1 report", "42 reports", "1 person". Kept tiny; only the handful of units
 *  this page uses need to resolve. */
function unitLabel(n: number, unit?: string): string {
  if (!unit) return '';
  if (n === 1) return unit === 'people' ? 'person' : unit.replace(/s$/, '');
  return unit;
}

export function TrendBars({
  series, total, additive = true, height = 'h-8', delay = 0, ariaLabel, maxBars = 40,
  baseline = false, rounded = false, emphasizePeak = false, labels, unit,
}: {
  /** One value per bucket, oldest first. */
  series: number[];
  /** What the bars add up to — printed by the caller, verified by the reader. */
  total: number;
  /** False only where the bars genuinely cannot sum to the headline (active
   *  users: one person over three days is 1 user and 3 bars). The caller then
   *  has to say so on the card. */
  additive?: boolean;
  height?: string;
  delay?: number;
  ariaLabel?: string;
  /** One date label per RAW series entry, oldest first (e.g. "Mon, Apr 14").
   *  Shown in the hover tooltip. When bars are bucketed, adjacent labels are
   *  joined into a range. Omitted → the tooltip shows the value with no date. */
  labels?: string[];
  /** What one bar counts, for the tooltip — "actions", "reports". Pluralised
   *  against the hovered value. Omitted → the tooltip shows the bare number. */
  unit?: string;
  /** Draw a hairline the columns stand on, and render empty days as a visible
   *  tick on it. Off by default so the 64px area-card strips stay as they were;
   *  the KPI band opts in, because at its width a floating column with no axis
   *  reads as a broken chart and an empty day reads as missing data. */
  baseline?: boolean;
  /** Round the data-end. Only safe where a column is more than a few pixels
   *  wide — the KPI band is; the two-pixel area strips are not. */
  rounded?: boolean;
  /** Mark the busiest bucket in full-strength brand and step the rest back one
   *  shade, so the eye finds the peak day before it reads a number. */
  emphasizePeak?: boolean;
  /**
   * The most bars this mark is allowed to draw. Above it, adjacent days are
   * SUMMED into buckets.
   *
   * A bar needs a width to be a bar. Thirty days inside the 64px strip at the
   * foot of an area card gives each day about two pixels, and two pixels with a
   * gap either side is not a column — it is a speck, and twelve cards of specks
   * is visual noise that no reader can take a value off. Bucketing is the honest
   * fix rather than dropping days: SUMS still add up to the total, so the mark
   * keeps the one property that made bars the right choice over a sparkline.
   */
  maxBars?: number;
}) {
  const prefersReduced = useReducedMotion();
  const [hover, setHover] = useState<number | null>(null);

  // Bucket the values AND their labels together, so a bucketed bar's tooltip
  // names the span of days it summed ("Apr 1 – Apr 3") rather than one of them.
  const { bars, barLabels } = useMemo(() => {
    if (series.length <= maxBars) return { bars: series, barLabels: labels };
    const size = Math.ceil(series.length / maxBars);
    const outVals: number[] = [];
    const outLabels: string[] = [];
    for (let i = 0; i < series.length; i += size) {
      outVals.push(series.slice(i, i + size).reduce((s, v) => s + v, 0));
      if (labels) {
        const a = labels[i];
        const b = labels[Math.min(i + size - 1, labels.length - 1)];
        outLabels.push(a === b ? a : `${a} to ${b}`);
      }
    }
    return { bars: outVals, barLabels: labels ? outLabels : undefined };
  }, [series, labels, maxBars]);

  if (bars.length < 2) return null;
  const max = Math.max(...bars, 1);

  return (
    <div
      className={`relative flex items-end ${baseline ? 'gap-[2px] border-b border-canvas-border pb-px' : 'gap-px'} ${height}`}
      role="img"
      aria-label={
        ariaLabel ??
        (additive
          ? `Day by day, adding up to ${fmt(total)}.`
          : `Day by day. These do not add up to ${fmt(total)}.`)
      }
    >
      {bars.map((v, i) => {
        const isZero = v <= 0;
        const hovered = hover === i;
        // The peak column keeps full brand; the rest step back one shade of the
        // same hue, so the emphasis reads as "less of the same thing", never as a
        // second series. Zero days become a faint tick on the axis rather than a
        // grey stub floating in space. A hovered bar snaps to full brand, so the
        // one you are reading a value off is unmistakable.
        const fill = isZero
          ? 'rgba(15, 7, 32, 0.08)'
          : hovered || !(emphasizePeak && v < max)
            ? '#6A12CD'
            : '#A87BE4';
        // Each column is a full-height hit area so the whole slot answers the
        // hover, not just the few pixels the bar happens to reach — the reader
        // aims at a day, not at a 12px stub (the same reason the area charts wash
        // the whole slot on hover, HOVER_FILL).
        return (
          <div
            key={i}
            className="relative flex-1 min-w-0 h-full flex items-end"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(h => (h === i ? null : h))}
          >
            {hovered && (
              <span
                className="absolute inset-x-0 bottom-0 top-[-2px] rounded-sm pointer-events-none"
                style={{ background: HOVER_FILL }}
                aria-hidden
              />
            )}
            <motion.div
              className={`relative w-full ${rounded && !isZero ? 'rounded-t-xs' : ''}`}
              style={{ background: fill }}
              initial={prefersReduced ? false : { height: 0 }}
              animate={{ height: `${isZero ? (baseline ? 5 : 4) : Math.max(baseline ? 12 : 8, (v / max) * 100)}%` }}
              transition={
                prefersReduced
                  ? { duration: 0 }
                  : { duration: 0.45, delay: delay + Math.min(i, 40) * 0.008, ease: KH_EASE }
              }
            />
          </div>
        );
      })}

      {/* The tooltip: the real value for the hovered bar, and the day it belongs
          to. Anchored to the hovered column's centre and floated above the row,
          pointer-events-none so it never eats the hover that summoned it. */}
      {hover !== null && (() => {
        // Anchor the tooltip over the hovered column, but pull it in at the two
        // ends so an edge bar's card does not clip half the label: left-align the
        // first bars, right-align the last, centre the rest.
        const frac = (hover + 0.5) / bars.length;
        const tx = frac < 0.15 ? '0%' : frac > 0.85 ? '-100%' : '-50%';
        return (
          <div
            className="absolute bottom-full z-40 mb-1.5 pointer-events-none"
            style={{ left: `${frac * 100}%`, transform: `translateX(${tx})` }}
          >
            <div className="rounded-md border border-canvas-border bg-canvas-elevated px-2 py-1 shadow-[0_6px_18px_-6px_rgba(15,7,32,0.16)] whitespace-nowrap text-center">
              {barLabels?.[hover] && (
                <div className="text-[0.625rem] text-ink-400 leading-tight">{barLabels[hover]}</div>
              )}
              <div className="text-[0.75rem] font-semibold text-ink-900 tabular-nums leading-tight">
                {bars[hover] <= 0 ? 'No activity' : `${fmt(bars[hover])}${unit ? ` ${unitLabel(bars[hover], unit)}` : ''}`}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

/* ── Sparkline ─────────────────────────────────────────────────────────────
   Kept for surfaces outside this page that still import it. Nothing on Platform
   Usage draws one any more — see `TrendBars` above for why. */

export function Sparkline({
  points, color = '#6A12CD', width = 72, height = 24, className = '', ariaLabel,
}: {
  points: number[];
  color?: string;
  width?: number;
  height?: number;
  className?: string;
  ariaLabel?: string;
}) {
  const prefersReduced = useReducedMotion();
  if (points.length < 2) return null;

  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;
  const pad = 2;
  const w = width - pad * 2;
  const h = height - pad * 2;

  const xy = points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * w;
    const y = pad + h - ((p - min) / span) * h;
    return [x, y] as const;
  });

  /* A smoothed path, not a polyline. Fourteen daily counts joined by straight
     segments across 64px is a saw — the eye reads the zig-zag as the signal and
     the direction, which is the only thing this mark is allowed to say, gets
     lost in it. A Catmull-Rom spline converted to cubic béziers keeps every
     point exactly where it is (it interpolates, it does not approximate) and
     just rounds the corners between them. */
  const line = xy
    .map(([x, y], i) => {
      if (i === 0) return `M${x.toFixed(1)},${y.toFixed(1)}`;
      const [x0, y0] = xy[i - 1];
      const [xPrev, yPrev] = xy[i - 2] ?? xy[i - 1];
      const [xNext, yNext] = xy[i + 1] ?? xy[i];
      const c1x = x0 + (x - xPrev) / 6;
      const c1y = y0 + (y - yPrev) / 6;
      const c2x = x - (xNext - x0) / 6;
      const c2y = y - (yNext - y0) / 6;
      return `C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const area = `${line} L${xy[xy.length - 1][0].toFixed(1)},${height} L${xy[0][0].toFixed(1)},${height} Z`;
  const gid = `spark-${color.replace('#', '')}-${points.length}-${Math.round(max)}`;
  const [lastX, lastY] = xy[xy.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={`shrink-0 overflow-visible ${className}`}
      role="img"
      aria-label={ariaLabel ?? 'Trend'}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.16} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <motion.path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={prefersReduced ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={prefersReduced ? { duration: 0 } : { duration: 0.6, ease: KH_EASE }}
      />
      {/* The end-dot carries a ring in the surface colour, so it stays legible
          where it lands on the line it terminates. */}
      <circle cx={lastX} cy={lastY} r={2.5} fill={color} stroke="#FFFFFF" strokeWidth={1.5} />
    </svg>
  );
}

/* ── Radial gauge ──────────────────────────────────────────────────────────
   A share of a whole, against the level that counts as healthy. The benchmark
   is drawn ON the arc as a tick, because a benchmark printed beside a number is
   a fact the reader has to apply themselves — on the arc it is a place the fill
   either reaches or does not. */

export function RadialGauge({
  pct, benchmark, size = 132, healthy, children,
}: {
  pct: number;
  /** 0–100. Drawn as a tick on the track. */
  benchmark?: number;
  size?: number;
  /** Whether `pct` clears the mark — decides the fill hue. */
  healthy: boolean;
  /** What sits in the middle of the ring. */
  children?: ReactNode;
}) {
  const prefersReduced = useReducedMotion();
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const fill = healthy ? '#6A12CD' : '#B45309';

  // The tick, in the same rotated frame as the arc (12 o'clock = 0%).
  const tickAngle = typeof benchmark === 'number' ? (benchmark / 100) * 2 * Math.PI - Math.PI / 2 : null;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={healthy ? '#EDDEFE' : 'rgba(180,83,9,0.16)'}
          strokeWidth={stroke}
        />
        <motion.circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={fill}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={prefersReduced ? false : { strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (clamped / 100) * c }}
          transition={prefersReduced ? { duration: 0 } : { duration: 0.9, ease: KH_EASE }}
        />
      </svg>
      {tickAngle !== null && (
        <svg width={size} height={size} className="absolute inset-0" aria-hidden>
          <line
            x1={cx + Math.cos(tickAngle) * (r - stroke / 2 - 1)}
            y1={cy + Math.sin(tickAngle) * (r - stroke / 2 - 1)}
            x2={cx + Math.cos(tickAngle) * (r + stroke / 2 + 1)}
            y2={cy + Math.sin(tickAngle) * (r + stroke / 2 + 1)}
            stroke="#0F0720"
            strokeOpacity={0.45}
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        </svg>
      )}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  );
}

/* ── Donut ─────────────────────────────────────────────────────────────────
   Part-to-whole, and ONLY part-to-whole: the slices have to be shares of one
   number, and that number goes in the hole. Anything else — a ranking, a
   comparison across periods — is a bar, because an angle is the hardest thing
   on a chart for a person to compare and the only thing a donut is good at is
   "this slice is about a third".

   The slices are steps of ONE hue, light to dark (DONUT_SHADES, in usageTokens),
   not four unrelated colours. Four hues would read as four different KINDS of
   thing and pull the eye to whichever slice happened to land on red. */

export function Donut({ items, total, totalLabel, size = 128 }: {
  items: { name: string; value: number }[];
  /** The number in the hole. Passed in, not summed here — a card may want to put
   *  a different whole in the middle than the slices happen to add up to. */
  total: number;
  totalLabel: string;
  size?: number;
}) {
  const prefersReduced = useReducedMotion();
  const shaded = items.map((d, i) => ({ ...d, color: DONUT_SHADES[i % DONUT_SHADES.length] }));
  const ring = Math.round(size * 0.13);

  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <ChartAutoSizer>
          {({ width, height }) => (
          <PieChart width={width} height={height}>
            <Pie
              data={shaded}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={size / 2 - ring}
              outerRadius={size / 2 - 2}
              // The 2° pad and the 4px corner are the surface gap, in polar form:
              // white separating touching marks, so neighbouring steps of one hue
              // stay distinct without a stroke drawn round them.
              paddingAngle={2}
              cornerRadius={4}
              strokeWidth={0}
              isAnimationActive={!prefersReduced}
              animationDuration={700}
            >
              {shaded.map(s => <Cell key={s.name} fill={s.color} />)}
            </Pie>
            <Tooltip
              isAnimationActive={false}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              content={({ active, payload }: any) => {
                if (!active || !payload?.length) return null;
                const p = payload[0];
                const value = Number(p.value);
                const share = total > 0 ? Math.round((value / total) * 100) : 0;
                return (
                  <TooltipCard
                    title={String(p.name)}
                    rows={[{ color: p.payload.color, name: totalLabel, value }]}
                    footer={<>{share}% of {fmt(total)}</>}
                  />
                );
              }}
            />
          </PieChart>
          )}
        </ChartAutoSizer>
        {/* The centre of a donut is the one place the total belongs. */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[1.125rem] font-semibold tracking-[-0.02em] text-ink-900 leading-none">
            {fmt(total)}
          </span>
          <span className="mt-1 text-[0.5625rem] font-medium text-ink-400 uppercase tracking-[0.1em]">
            {totalLabel}
          </span>
        </div>
      </div>

      {/* The legend carries the values, so no slice needs a label on it — a
          number printed on a 30° wedge is a number that gets clipped. */}
      <div className="space-y-1.5 min-w-0 flex-1">
        {shaded.map(s => (
          <div key={s.name} className="flex items-center gap-2 text-[0.6875rem]">
            <span className="h-[3px] w-3.5 rounded-full shrink-0" style={{ background: s.color }} />
            <span className="text-ink-500 truncate">{s.name}</span>
            <span className="ml-auto shrink-0 tabular-nums">
              <span className="font-semibold text-ink-900">{fmt(s.value)}</span>
              <span className="ml-1.5 text-ink-400">
                {total > 0 ? Math.round((s.value / total) * 100) : 0}%
              </span>
            </span>
          </div>
        ))}
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
  dashed?: boolean;
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
            {r.dashed ? (
              <svg width="14" height="3" aria-hidden className="shrink-0">
                <line x1="0" y1="1.5" x2="14" y2="1.5" stroke={r.color} strokeWidth="2" strokeDasharray="3 2" />
              </svg>
            ) : (
              <span className="h-[3px] w-3.5 rounded-full shrink-0" style={{ background: r.color }} />
            )}
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

export function RankedRow({ label, count, share, pct, onClick, index = 0, active, size = 'sm' }: {
  label: string;
  count: number;
  share?: number;
  pct: number;
  onClick?: () => void;
  index?: number;
  active?: boolean;
  /** Bar weight, matching `Meter`: `sm` is the hairline bullet; `lg` is the
   *  substantial 28px block used on the Seats tab, so a ranking whose bars ARE
   *  the content reads at the same weight everywhere on the page. */
  size?: 'sm' | 'lg';
}) {
  const prefersReduced = useReducedMotion();
  const lg = size === 'lg';
  const radius = lg ? 'rounded-md' : 'rounded-full';
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
      <div className={`${lg ? 'h-7' : 'h-1.5'} ${radius} bg-brand-100/70 overflow-hidden`}>
        <motion.div
          className={`h-full ${radius} bg-brand-600 group-hover:bg-brand-500 transition-colors`}
          initial={prefersReduced ? false : { width: 0 }}
          animate={{ width: `${Math.max(lg ? 2 : 1.5, pct)}%` }}
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
    // 32px between sections against 16px within them. Rhythm is the cheapest
    // hierarchy there is: separation between groups has to be clearly bigger than
    // separation inside them, or there are no groups. 2:1 does that and still
    // fits more on a screen than the 40px this used to run on.
    <section className="pt-8 first:pt-0">
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
        <div className="flex items-center justify-between gap-4 mb-3">
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
