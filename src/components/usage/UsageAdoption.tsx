/**
 * How often each seat is used — one bar per seat you pay for.
 *
 * THE HISTOGRAM IS GONE, and the reason is the whole design.
 *
 * This card drew Amplitude's power-user curve: seats bucketed by day count
 * ("Not once", "1 to 5 days", "6 to 14 days", "15 or more days"), four bars, a
 * name list under each. That is a real chart with a real pedigree, and it was
 * the wrong import. You bucket because you CANNOT draw a bar per user —
 * Amplitude's readers have a million of them. This tenant has seventeen. At
 * seventeen the histogram is not a summary, it is a shredder: it took 25, 24,
 * 24, 24, 24, 24, 23, 23 and 21 and printed them as one bar reading "15 or more
 * days", which is the least interesting true statement available about those
 * nine seats.
 *
 * What the buckets destroyed is the actual finding. Sorted, the real numbers are
 *
 *     25 24 24 24 24 24 23 23 21 · 14 · 8 · 5 · 0 0 0 0 0
 *
 * a cliff. Nine seats are in the product nearly every working day (30 calendar
 * days hold about 22 of them, so 21 and up means weekends too). Five have never
 * opened it. Three sit anywhere in between. There is no middle here, and "no
 * middle" is a licence decision: the nine are not negotiable, the five are pure
 * waste, and the three are the only conversation worth having. Four bars cannot
 * say that. Seventeen bars say it without a word of commentary.
 *
 * So: no buckets, no thresholds, no invented bands, and no leftover height to
 * pad out with rules and air. Every seat is its own bar, ranked, at its own real
 * day count. The shape is the data, not a model of it.
 *
 * It also deleted three mechanisms that existed only to hide data: a "+N more"
 * popover, a shown-names cap, and first-name disambiguation (two seats are
 * called Ajay, and bucketing put them in bands that contradicted each other).
 * Nothing is folded away now, so nothing needs unfolding.
 *
 * The bar is the funnel's bar (h-7, rounded-md, a lighter step of its own hue
 * behind the fill) so the two cards on this tab read as one language. It is
 * drawn here rather than through `Meter` because Meter stacks its label ABOVE
 * the track, which is right for four rows and impossible at seventeen: this
 * needs the name beside the bar.
 */

import { useMemo } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Gauge } from 'lucide-react';
import type { AdminUser } from '../../context/AdminDataContext';
import { powerCurve, licenceUse, type UsageDay } from '../../data/platform-usage';
import { Card, InfoPopover } from './usageChrome';
import { FIGURE } from './usageTokens';

/* The track is a lighter step of the fill's own ramp rather than a grey wash, so
   an empty bar still says which hue it belongs to. These are `Meter`'s two tracks
   to the character: this card draws its own bar (see the note at the top) and
   must not drift from the one beside it. */
const TRACK = 'bg-brand-100/70';
const TRACK_IDLE = 'bg-mitigated-700/[0.14]';

/* One grid, declared once, so the ruler's ticks land on the same x as the bars
   they measure. Three columns: name, track, count. If these drift apart the
   scale starts lying, which is the exact failure this ruler exists to fix.
   Alignment is left to each caller: `items-*` are one Tailwind property, so a
   shared `items-center` here could not be overridden per row by class order. */
const SEAT_GRID = 'grid grid-cols-[7.5rem_1fr_1.75rem] gap-3';

/**
 * Where to put the ruler's ticks: zero, a round step, and always the window's
 * own end.
 *
 * The end tick is the whole point — it is the only mark that says how long the
 * track IS — so it is never dropped. An inner tick that would crowd it is
 * dropped instead: the range picker offers 1 day (Today), 7, 30, 90 and custom,
 * and at 7 a plain step of 2 would otherwise print "6" and "7 days" a fourteenth
 * of the track apart, on top of each other.
 */
function scaleTicks(windowDays: number): number[] {
  const step = [1, 2, 5, 7, 10, 15, 30].find(s => windowDays / s <= 4) ?? windowDays;
  const ticks: number[] = [];
  for (let d = 0; d < windowDays; d += step) ticks.push(d);
  if (ticks.length > 1 && windowDays - ticks[ticks.length - 1] <= step * 0.5) ticks.pop();
  ticks.push(windowDays);
  return ticks;
}

/**
 * The scale, drawn.
 *
 * Every bar here is a count of days against the full window, but the window was
 * only ever stated in the card's subtitle: the chart itself printed a bare "25"
 * beside a track that stopped at some unexplained width. So a reader had to read
 * a sentence, hold "30" in their head, and apply it to seventeen rows — and
 * nobody reads a chart that way. 25 could have been anything.
 *
 * Now the track is labelled at the point where it ends, in the unit it is
 * counting: the bar reaches 25, the track runs out at "30 days", and the gap
 * between them is the days that seat did not work. Nothing to hold in your head.
 */
function SeatScale({ windowDays }: { windowDays: number }) {
  // A zero-day window divides to NaN and would place every tick at "NaN%".
  // There is no scale to draw for a window with no days in it.
  if (windowDays <= 0) return null;
  const ticks = scaleTicks(windowDays);
  return (
    <div className={`${SEAT_GRID} items-end pb-1.5`} aria-hidden>
      <span />
      <div className="relative h-4">
        {ticks.map((d, i) => {
          const first = i === 0;
          const last = i === ticks.length - 1;
          return (
            <span
              key={d}
              className="absolute bottom-0 flex flex-col items-start"
              style={{
                left: `${(d / windowDays) * 100}%`,
                transform: last ? 'translateX(-100%)' : first ? 'none' : 'translateX(-50%)',
                alignItems: last ? 'flex-end' : first ? 'flex-start' : 'center',
              }}
            >
              {/* The unit rides the last tick, where the track stops, rather than
                  sitting in a legend: it names the scale at the one x a reader is
                  already looking at to see how much room is left. */}
              <span className="whitespace-nowrap text-[0.625rem] leading-none text-ink-400 tabular-nums">
                {last ? `${d} days` : d}
              </span>
              <span className="mt-1 h-1 w-px bg-canvas-border" />
            </span>
          );
        })}
      </div>
      <span />
    </div>
  );
}

/**
 * One seat, one bar.
 *
 * A seat at zero has no fill to colour, which is exactly the point, so the TRACK
 * carries the amber instead. Five empty amber tracks stacked at the foot of the
 * card is the waste, drawn: you pay for those and get back a bar with nothing in
 * it. No badge, no icon, no callout box required.
 */
function SeatBar({ name, days, windowDays, index }: {
  name: string;
  days: number;
  windowDays: number;
  index: number;
}) {
  const prefersReduced = useReducedMotion();
  const idle = days === 0;
  return (
    <div className={`${SEAT_GRID} items-center`} title={`${name}: ${days} of ${windowDays} days`}>
      <span className={`truncate text-[0.75rem] leading-none ${idle ? 'font-medium text-ink-800' : 'text-ink-600'}`}>
        {name}
      </span>
      <div className={`h-7 overflow-hidden rounded-md ${idle ? TRACK_IDLE : TRACK}`}>
        {!idle && (
          <motion.div
            className="h-full rounded-md bg-brand-600"
            initial={prefersReduced ? false : { width: 0 }}
            animate={{ width: `${(days / windowDays) * 100}%` }}
            transition={
              prefersReduced
                ? { duration: 0 }
                : { type: 'spring', stiffness: 260, damping: 30, delay: 0.02 * index }
            }
          />
        )}
      </div>
      <span className={`text-right text-[0.75rem] leading-none tabular-nums ${
        idle ? 'font-semibold text-mitigated-700' : 'font-medium text-ink-900'
      }`}>
        {days}
      </span>
    </div>
  );
}

function SeatUsagePanel({ days, users, className }: { days: UsageDay[]; users: AdminUser[]; className?: string }) {
  const curve = useMemo(() => powerCurve(days, users), [days, users]);
  const licence = useMemo(() => licenceUse(days, users), [days, users]);

  /* Ranked, busiest first, so the cliff lands where the eye already is and the
     seats worth taking back collect at the bottom. Ties break on name, so the
     order is stable rather than an accident of the seed list. */
  const seats = useMemo(
    () => users
      .map(u => ({ name: u.name, email: u.email, days: curve.daysActive.get(u.name) ?? 0 }))
      .sort((a, b) => b.days - a.days || a.name.localeCompare(b.name)),
    [users, curve.daysActive],
  );

  return (
    <Card
      icon={Gauge}
      title="How often each seat is used"
      subtitle={`Days of real work in the last ${curve.windowDays} days`}
      right={
        <InfoPopover
          label="how often seats are used"
          counts={`For each paid seat, the number of days it did real work in the last ${curve.windowDays} days.`}
          excludes="Days with a sign-in but no work. A sign-in is not use."
          note={`Every seat you pay for is listed, busiest first. The bar is that seat's days against the full ${curve.windowDays}.`}
        />
      }
      className={className}
      bodyClassName="flex flex-col"
    >
      {/* The licence number, stated rather than drawn: the verdict at the top of
          this tab already owns the one ring the tab is allowed, and a second
          gauge reading a different window makes the page look like it disagrees
          with itself.

          Not a fifth fact either. It is the rows, counted: twelve bars have
          something in them, five do not. */}
      <div className="flex items-baseline gap-2.5 pb-4">
        <span className={FIGURE}>{licence.pct}%</span>
        <span className="text-[0.8125rem] text-ink-500">of seats did real work</span>
        <span className="ml-auto shrink-0 text-[0.75rem] tabular-nums text-ink-400">
          {licence.used} of {licence.total} seats
        </span>
      </div>

      <SeatScale windowDays={curve.windowDays} />

      {/* Seventeen seats, seventeen bars, nothing aggregating between the reader
          and the number. The rows are the card's height: it fills because it is
          full, not because the gaps were stretched to reach the bottom. */}
      <div className="relative">
        {/* The ruler's ticks, carried down the stack. A ruler at the top alone
            measures the top row and abandons the sixteen below it, which is where
            the reader actually is by the time they are comparing seats. The lines
            sit UNDER the tracks — the tracks are opaque where a bar is filled, so
            a line never crosses a fill and never gets mistaken for a threshold;
            it shows only in the empty remainder, which is the part being read. */}
        <div className={`${SEAT_GRID} items-stretch pointer-events-none absolute inset-0`} aria-hidden>
          <span />
          <div className="relative h-full">
            {scaleTicks(curve.windowDays).slice(1, -1).map(d => (
              <span
                key={d}
                className="absolute inset-y-0 w-px bg-canvas-border/70"
                style={{ left: `${(d / curve.windowDays) * 100}%` }}
              />
            ))}
          </div>
          <span />
        </div>

        <div className="relative flex flex-col gap-1">
          {seats.map((s, i) => (
            <SeatBar key={s.email} name={s.name} days={s.days} windowDays={curve.windowDays} index={i} />
          ))}
        </div>
      </div>
    </Card>
  );
}

/**
 * The engagement matrix used to sit here, beside the seat curve.
 *
 * It has moved to the AREAS tab, and the move is the point: a scatter of the
 * twelve areas is a question about the PRODUCT (what do we fix, drop, or invest
 * in), not about the LICENCE (who keeps their seat). Those are two different
 * decisions taken by the same person on different days, and the areas were being
 * rendered three times across three tabs — ranked bars on Overview, this scatter
 * on Adoption, twelve cards on Sections — with no way to see any two at once.
 *
 * On Areas the scatter is the map: click a dot and you land in that area's
 * detail. Here it was a chart you could look at and not act on.
 */
export default function UsageAdoption({ days, users, className }: {
  days: UsageDay[];
  users: AdminUser[];
  className?: string;
}) {
  return <SeatUsagePanel days={days} users={users} className={className} />;
}
