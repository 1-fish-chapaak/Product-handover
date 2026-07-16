/**
 * Platform Usage — Overview's "what people worked on": the window's actions
 * grouped into the KINDS of work they were, as a donut.
 *
 * A pie is only honest as a PART-TO-WHOLE, and this is one: every action lands in
 * exactly one area, every area in exactly one kind, and the kinds sum to Work
 * done. So the whole is real and the segments are real shares of it. That is the
 * question this card asks — what was the period MADE OF — and it is why the card
 * keeps a ring rather than becoming a third ranked bar list on a page that already
 * has two.
 *
 * WHAT WAS WRONG, AND IT WAS NOT THE SHAPE. The version before this was a filled
 * disc: 2px white strokes between the wedges, the share stamped inside each one
 * in bold, a colour key beside it, and hover exploding a wedge out of the disc.
 * That is the default every charting library has shipped since Excel 97, and it
 * fails four ways at once:
 *
 *   · The white strokes are ink that is not data. They score the disc with cracks
 *     so it reads as one object that has been cut, not as a set of parts. A gap of
 *     the SURFACE colour separates just as well and adds no ink.
 *   · The shares stamped inside the wedges put six bold labels on the one mark
 *     whose whole job is to be read as a shape. The list beside it already prints
 *     every one of those numbers, so each was said twice and the disc lost.
 *   · A filled disc has no middle, so the total had nowhere to live and floated
 *     underneath as a caption. The hole in a donut is not decoration: it is where
 *     the whole goes, which is the number every segment is a share OF.
 *   · Exploding a wedge on hover breaks the ring apart. The moment a part leaves
 *     the middle, the middle stops meaning "the whole".
 *
 * THE SEGMENT THAT NAMED NOTHING — the real bug, and it was in the data, not the
 * paint. This tenant runs thirteen areas and the busiest is 15%, so folding the
 * tail made "7 more areas" a 37% wedge: the LARGEST thing on the chart was the one
 * thing a reader cannot act on. Drawing it achromatic and last was a good patch,
 * but only a patch. No rollup setting fixed it either — you need ten named arcs
 * before the remainder stops dominating, and ten arcs is the pinwheel the rollup
 * exists to prevent.
 *
 * SO THE FIX WAS UPSTREAM. The ring now plots the KINDS of work (USAGE_FAMILIES in
 * data/platform-usage.ts), not the thirteen areas. Same 528 actions, grouped one
 * level: 50 / 21 / 12 / 9 / 8. One clear lead, a real descent, every arc named, no
 * remainder, nothing folded. A part-to-whole chart was never wrong here; it was
 * being handed a thirteen-way split with no dominant part, which is a shape no
 * ring can draw. Give it five parts and it draws them.
 *
 * WHAT THE RING IS FOR. It carries the SHAPE: is this period mostly the audit, or
 * mostly overhead? The list beside it carries the order and the numbers, and names
 * the areas inside each kind so the grouping is arguable rather than a black box.
 * Ring for the shape, list for the detail; neither repeats the other. Per-area
 * counts are the Areas tab's job, and it already does it.
 *
 * The ramp is steps of ONE hue, dark → light, because segments are ordered by size
 * and the eye should read the biggest first. Never a rainbow: these are shares of
 * a single whole, and unrelated hues would read as different KINDS of thing.
 */

import { useState } from 'react';
import { PieChart, Pie, Cell, Sector, type PieSectorDataItem, type PieSectorShapeProps } from 'recharts';
import ChartAutoSizer from './ChartAutoSizer';
import { fmt } from './usageTokens';

export interface AreaMixItem {
  /** The kind of work, e.g. "Audit work". */
  name: string;
  value: number;
  /** The areas that make this kind up, busiest first. Named under the row so the
   *  grouping is never a black box: a reader can see that "Audit work" means
   *  Risk & Controls, Engagements, Exceptions and the rest, and disagree with it
   *  if they want to. Per-area counts live on the Areas tab. */
  members?: string[];
}

/* ── The ramp ──────────────────────────────────────────────────────────────
   Generated for the number of segments in hand, so it can never wrap onto itself
   the way a fixed six-item list did (that bug put the tail in the same purple as
   the top area). Dark (the brand) → light, stopping short of near-white so the
   smallest segment is still a mark.

   There is no longer an achromatic REST_FILL beside it. That colour existed to
   stop the folded tail competing with the real areas; grouping removed the fold,
   so every segment is now a named kind of work and every one gets the hue. */
const RAMP_DARK = '#6A12CD';
const RAMP_LIGHT = '#C4A2EE';

const channels = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));

function shadeAt(t: number) {
  const a = channels(RAMP_DARK);
  const b = channels(RAMP_LIGHT);
  return `#${a.map((c, i) => Math.round(c + (b[i] - c) * t).toString(16).padStart(2, '0')).join('')}`;
}

/** How far the hovered segment grows outward. It grows within its own ring — a
 *  segment that translates away from the centre is the exploding pie. */
const GROW = 4;

/** The hole, as a fraction of the outer radius. Wide enough to hold the total at
 *  display size; not so wide that the ring thins into a hairline. */
const HOLE = 0.62;

export default function UsageAreaMix({
  items, total, areaCount, note, footer, size = 232, className = '',
}: {
  /** Each kind of work, with the areas that make it up. Ranked here. */
  items: AreaMixItem[];
  /** The whole the segments are a part of — the period's action total. */
  total: number;
  /** How many AREAS saw work, for the hole's caption. Not derivable from `items`,
   *  which holds the kinds those areas were grouped into. */
  areaCount?: number;
  /** One short line above the donut (e.g. the vs-last-period delta). Optional. */
  note?: React.ReactNode;
  /** Pinned to the foot of the card, below the donut (e.g. the AI split). */
  footer?: React.ReactNode;
  size?: number;
  className?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const sorted = [...items].filter(i => i.value > 0).sort((a, b) => b.value - a.value);

  if (sorted.length === 0) {
    return <p className="text-[0.875rem] text-ink-400">No activity in this period to break down.</p>;
  }

  /* No rollup any more, so no remainder. Grouping the areas into kinds of work is
     what removed the need: five or six arcs arrive already, every one of them
     named, so there is nothing left to fold. */
  const shaded = sorted.map((s, i) => ({
    ...s,
    color: shadeAt(sorted.length <= 1 ? 0 : i / (sorted.length - 1)),
    share: total > 0 ? Math.round((s.value / total) * 100) : 0,
  }));

  const active = hover !== null ? shaded[hover] : null;
  const radius = size / 2 - GROW;

  return (
    <div className={`flex h-full flex-col ${className}`}>
      {note && <div className="mb-4 text-[0.875rem]">{note}</div>}

      <div className="flex flex-1 items-center gap-5">
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
                  /* Clockwise from twelve, in the same order as the list beside
                     it, so the ring and the rows are one reading. */
                  startAngle={90}
                  endAngle={-270}
                  innerRadius={radius * HOLE}
                  outerRadius={radius}
                  /* The separator is a gap of surface, not a stroke of white ink
                     laid on top of the data. */
                  paddingAngle={2}
                  cornerRadius={0}
                  stroke="none"
                  isAnimationActive={false}
                  /* `shape` is how recharts 3 lets a caller draw each sector.
                     The pair this used before — activeIndex + activeShape — is
                     gone and deprecated respectively in 3.8, and activeIndex was
                     silently doing nothing: it is not a Pie prop any more, so the
                     hovered segment never actually grew. Driving `shape` from our
                     own hover state is also the more honest wiring, because the
                     legend rows set that state too, and recharts' own idea of
                     "active" knows nothing about them. */
                  shape={(p: PieSectorShapeProps, i: number) => (
                    <Sector {...p} outerRadius={(p.outerRadius ?? 0) + (hover === i ? GROW : 0)} />
                  )}
                  labelLine={false}
                  onMouseEnter={(_: PieSectorDataItem, i: number) => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                >
                  {shaded.map((s, i) => (
                    <Cell
                      key={s.name}
                      fill={s.color}
                      /* The hovered segment keeps full colour; the rest step
                         back, so the eye lands on the one being read. Nothing
                         disappears. */
                      fillOpacity={hover === null || hover === i ? 1 : 0.28}
                      style={{ transition: 'fill-opacity 150ms ease', cursor: 'pointer' }}
                    />
                  ))}
                </Pie>
              </PieChart>
            )}
          </ChartAutoSizer>

          {/* The hole holds the whole. At rest that is the period's total, the
              number every segment is a share of; on hover it is the area being
              read, so the answer arrives where the reader is already looking
              instead of in a caption somewhere else. Never a hit target — the
              ring underneath owns the pointer. */}
          <div className="pointer-events-none absolute inset-0 grid place-items-center" aria-hidden>
            <div className="text-center" style={{ maxWidth: size * HOLE - 12 }}>
              {active ? (
                <>
                  <p className="truncate text-[0.75rem] text-ink-500" title={active.name}>{active.name}</p>
                  <p className="mt-1 text-[1.375rem] font-semibold leading-none tracking-[-0.02em] text-ink-900 tabular-nums">
                    {active.share}%
                  </p>
                  <p className="mt-1 text-[0.75rem] text-ink-400 tabular-nums">{fmt(active.value)} actions</p>
                </>
              ) : (
                <>
                  <p className="text-[1.375rem] font-semibold leading-none tracking-[-0.02em] text-ink-900 tabular-nums">
                    {fmt(total)}
                  </p>
                  <p className="mt-1 text-[0.75rem] text-ink-400">actions</p>
                  {/* The segments are KINDS, so this cannot count segments and
                      call them areas: it read "across 5 areas" when there are
                      thirteen, grouped into five. The area count is passed in
                      from the ungrouped ranking that actually knows it. */}
                  {areaCount !== undefined && (
                    <p className="text-[0.75rem] text-ink-400">across {areaCount} areas</p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* The list carries the order and the numbers, and doubles as the hover
            target, so a segment and its row light up together whichever one the
            cursor is on. This is what lets the ring stay clean. */}
        <div className="min-w-0 flex-1">
          {shaded.map((s, i) => {
            const on = hover === i;
            const dim = hover !== null && !on;
            return (
              <div
                key={s.name}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                className={`cursor-pointer rounded-md px-2 py-[7px] transition-colors ${on ? 'bg-ink-900/[0.04]' : ''}`}
                style={{ opacity: dim ? 0.5 : 1 }}
              >
                <div className="flex items-center gap-2.5 text-[0.75rem]">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                  <span className="truncate text-ink-600" title={s.name}>{s.name}</span>
                  <span className="ml-auto shrink-0 tabular-nums">
                    <span className="font-semibold text-ink-900">{fmt(s.value)}</span>
                    <span className="ml-2 inline-block w-7 text-right text-ink-400">{s.share}%</span>
                  </span>
                </div>
                {/* What the kind is made of, indented under it. This is the price
                    of grouping: the reader must be able to see the grouping and
                    argue with it, so no arc is a word they have to trust. */}
                {s.members && s.members.length > 1 && (
                  <p className="mt-0.5 truncate pl-[1.25rem] text-[0.625rem] text-ink-400" title={s.members.join(', ')}>
                    {s.members.join(', ')}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {footer && <div className="mt-5 pt-4 border-t border-canvas-border">{footer}</div>}
    </div>
  );
}
