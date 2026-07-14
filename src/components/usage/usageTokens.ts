/**
 * Platform Usage — design tokens (constants only).
 *
 * The visual contract for every chart, card and number on the page. Components
 * live in the sibling `usageChrome.tsx` (kept separate so Fast Refresh stays
 * happy: a module may export components OR constants, not both).
 *
 * The rules encoded here, and why:
 *   · One accent hue. Brand carries "the metric you are looking at"; anything
 *     else is neutral. Green/red exist only where direction has meaning (a
 *     delta), never as decoration.
 *   · A second series gets a different hue, not a lighter step of the first — a
 *     lightness step reads as "less of the same thing", not "a different thing".
 *     The pair is validated for colour-vision deficiency (ΔE 34.7 deutan), and
 *     the three real series pass the full six-check palette validator.
 *   · Grid is a solid hairline, horizontal only, lighter than the card border.
 *     Dashed grids read as thresholds; they are not.
 *   · Borders before shadows (DESIGN.md §4). Cards are flat at rest, so the
 *     page's polish has to come from the marks themselves: capped bar ends,
 *     surface gaps between touching fills, gradient washes under lines, and a
 *     hover layer on every plot. Not from drop shadows.
 */

/* ── Series palette ───────────────────────────────────────────────────────── */
export const SERIES = {
  /** The metric. */
  primary: '#6A12CD',
  /** The second, genuinely-different measure (AI). Evidence blue, from the system ramp. */
  secondary: '#0284C7',
  /**
   * The previous period. A comparison is chrome, not a series — it stays
   * achromatic, and it is always drawn DASHED, which is the secondary encoding
   * that lets it be grey. It was #9A8FAE, which sits at 2.96:1 on white: under
   * the 3:1 floor a mark needs to be seen at all. This step clears it.
   */
  compare: '#6B5D82',
  /** The one colour that carries an action. */
  attention: '#B45309',
  positive: '#15803D',
  negative: '#B42318',
} as const;

/** Sequential ramp — one hue, light → dark. For ordered buckets and heat cells. */
export const RAMP = ['#EDE4FA', '#DCC9F5', '#C4A2EE', '#A87BE4', '#8B4FD8', '#7628CF', '#6A12CD'];

/**
 * The donut's slices: the same ramp, run dark → light, because a donut's slices
 * are ordered by size and the eye should read the biggest one first.
 *
 * Steps of ONE hue, never four unrelated ones. A rainbow donut reads as four
 * different KINDS of thing and drags the eye to whichever slice landed on red —
 * these are shares of a single whole, and the colour should say so.
 */
export const DONUT_SHADES = ['#6A12CD', '#8B4FD8', '#A87BE4', '#C4A2EE', '#DCC9F5', '#EDE4FA'];

/**
 * The recessive step of a series — an off-hours bar, a weekend column, the
 * unfilled remainder of a meter. One hue, one step: "less of the same thing",
 * which is exactly what it means here.
 */
export const MUTED = {
  primary: '#DCC9F5',
  track: 'rgba(15, 7, 32, 0.055)',
} as const;

/* ── Chart chrome ─────────────────────────────────────────────────────────── */

/** Gridlines sit one step lighter than the card border, on purpose. */
export const GRID = 'rgba(15, 7, 32, 0.06)';
export const AXIS_TICK = { fontSize: 11, fill: '#9A8FAE' } as const;

/** The crosshair. A reader aims at a date, not at a 2px line. */
export const CROSSHAIR = {
  stroke: 'rgba(15,7,32,0.16)',
  strokeWidth: 1,
  strokeDasharray: '4 4',
} as const;

/** The hover wash behind a hovered column. Wider than the bar, so it reads as
 *  "this slot", not as a second series stacked behind the first. */
export const HOVER_FILL = 'rgba(106, 18, 205, 0.05)';

/** The surface gap that separates touching marks — a stacked segment from the
 *  one under it, an adjacent bar from its neighbour. White doing the work a
 *  stroke would otherwise do badly (a stroke is data-weight ink that is not
 *  data). Recharts draws this as a stroke in the surface colour. */
export const SURFACE_GAP = { stroke: '#FFFFFF', strokeWidth: 2 } as const;

/** Bars are capped, never full-slot: the leftover band is air. */
export const BAR_SIZE = 22;
/** 4px rounded data-end, square at the baseline. */
export const BAR_RADIUS: [number, number, number, number] = [4, 4, 0, 0];

export const fmt = (n: number) => n.toLocaleString('en-US');

/** Humanised axis values — 1.5k, not 1500. Max three numeric characters. */
export const compact = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}m`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
};

/** Axis props, spread onto every XAxis/YAxis so no two charts drift apart. */
export const xAxisProps = {
  tick: AXIS_TICK,
  tickLine: false,
  axisLine: false,
  tickMargin: 10,
  minTickGap: 28,
} as const;

export const yAxisProps = {
  tick: AXIS_TICK,
  tickLine: false,
  axisLine: false,
  tickMargin: 8,
  width: 44,
  tickFormatter: compact,
} as const;

/* ── Surfaces ─────────────────────────────────────────────────────────────── */

/** The card outline. Flat at rest; the border does the separating (DESIGN.md §4).
 *  rounded-lg (12px) is the default card radius — rounded-xl is reserved for the
 *  AI response surface (§5), so this stays on the platform's card system. */
export const CARD_BASE =
  'rounded-lg border border-canvas-border bg-canvas-elevated transition-[border-color,box-shadow] duration-200 ease-out';

/** Alias kept for the section files that spread the outline onto a <button>. */
export const CARD = CARD_BASE;

/** The Knowledge Hub's icon tile — a 40px square holding the card's glyph. The
 *  Hub puts one on every card it draws, and it is the page's strongest single
 *  signature; a bare grey glyph is what "some other kit" looks like.
 *
 *  Shape only: the tone is a separate class so a caller can swap it. Two `bg-*`
 *  utilities in one class string do NOT resolve by string order — Tailwind
 *  emits both and the stylesheet's own order decides, which is not something a
 *  call site should be betting on. */
export const ICON_TILE = 'w-10 h-10 rounded-lg flex items-center justify-center shrink-0';

/** The default tone. Attention surfaces swap in `bg-mitigated-50 text-mitigated-700`. */
export const ICON_TILE_BRAND = 'bg-brand-50 text-brand-700';

/** The Hub's entry curve. Every fade-up on that page uses it; so does this one
 *  now, so the two surfaces settle at the same rate. */
export const KH_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/**
 * The one number a card leads with. Proportional figures, not tabular: at
 * display size `tabular-nums` gives every digit the width of a zero, and "121"
 * comes out visibly loose. Tabular is for COLUMNS of numbers that have to align
 * down the page (table cells, axis ticks) — not for a headline.
 */
export const FIGURE = 'text-[1.75rem] font-semibold tracking-[-0.02em] text-ink-900 leading-none';
export const FIGURE_SM = 'text-[1.375rem] font-semibold tracking-[-0.02em] text-ink-900 leading-none';
