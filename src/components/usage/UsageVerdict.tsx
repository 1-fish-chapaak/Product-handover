/**
 * Platform Usage — the hero.
 *
 * Four redesigns of this page failed for the same reason, and it was never the
 * chart type: the Overview carried something like 120 discrete elements. Four
 * sparklines with date labels under them, five legend keys, thirty-one hour-bars
 * each with its own number, eight ranked rows, three finding rows, four tooltip
 * triggers, a footnote beneath a footnote. Every "clarifying" caption I added
 * made it worse, because the failure was never a missing explanation — it was
 * that nothing on the page was louder than anything else, so the eye had nowhere
 * to land and the reader had to consume all of it to learn any of it.
 *
 * So this is the one thing that dominates. An admin comes here to ask "is the
 * licence worth it", and that question has a single number for an answer: the
 * share of paid seats that did real work.
 *
 * The number now sits inside the gauge rather than beside it. That is not
 * decoration — it is what lets the benchmark stop being a footnote. "Healthy is
 * 60%" printed next to a percentage is a fact the reader has to apply
 * themselves; drawn as a tick on the arc, it becomes a place the fill either
 * reaches or falls short of, and the answer is pre-attentive. The arc, the
 * sentence and the trend are three readings of one number, in ascending detail:
 * where we are, what that means in people, and where it is heading.
 *
 * One finding rides underneath, and only if it fires. Not three. Three findings
 * plus a headline is a KPI band, and there is already a KPI band below.
 */

import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, ReferenceLine, Tooltip } from 'recharts';
import { CARD_BASE, HOVER_FILL, KH_EASE, SERIES } from './usageTokens';

export interface VerdictInput {
  /** The verdict's own window, fixed at a week. NOT the page's date filter. */
  rangeDays: number;
  seats: number;
  activeUsers: number;
  priorActiveUsers: number;
  /** Licence use week by week, oldest first. The hero plots it behind the number. */
  trend?: { pct: number; active: number; weeksAgo: number }[];
  neverSignedIn: number;
  dormant: number;
  pendingInvites: number;
  topArea: string | null;
  secondArea: string | null;
  topTwoShare: number;
  aiSharePct: number;
}

/**
 * A healthy share of licensed seats in active use.
 *
 * GitHub publishes 60% for Copilot, and the exact definition matters: it is a
 * WEEKLY-active-to-licence ratio. So the number judged against it must be
 * measured on a week, which is why this card ignores the page's date filter and
 * always reads the last seven days. Compared against an arbitrary window the
 * benchmark is meaningless: over ninety days almost every seat signs in at least
 * once, so the verdict reads "healthy" whatever the truth is.
 */
export const HEALTHY_SEAT_USE = 60;

export default function UsageVerdict({ v, onSeeWho }: {
  v: VerdictInput;
  onSeeWho: () => void;
}) {
  const prefersReduced = useReducedMotion();
  const pct = v.seats > 0 ? Math.round((v.activeUsers / v.seats) * 100) : 0;
  const healthy = pct >= HEALTHY_SEAT_USE;
  const diff = v.activeUsers - v.priorActiveUsers;
  const idle = v.neverSignedIn + v.dormant;

  const trend = v.trend ?? [];
  const line = healthy ? SERIES.primary : SERIES.attention;

  /** The chart's reading, said out loud. A line nobody interprets is decoration. */
  const trendWord = (() => {
    if (trend.length < 2) return 'measured this week';
    const first = trend[0].pct;
    const last = trend[trend.length - 1].pct;
    if (last > first + 4) return 'and climbing';
    if (last < first - 4) return 'but falling';
    return 'and holding steady';
  })();

  /* The trend is a line, not columns, and this is why.
     A licence share lives in a narrow band — here 62 to 68 — so on the 0-100
     axis a bar demands, every column is the same near-full height and the one
     thing this chart exists to show, the direction, is invisible. The old
     version literally said "but falling" over eight identical bars.
     A line reads position, not length, so it can honestly sit on a focused
     axis: the window is padded around the data and always contains the 60%
     mark, so the reader still sees the series above or below healthy — the fall
     is now a slope you see, not a word you take on trust. */
  const pcts = trend.map(t => t.pct);
  const lo = Math.max(0, Math.min(HEALTHY_SEAT_USE, ...pcts) - 6);
  const hi = Math.min(100, Math.max(HEALTHY_SEAT_USE, ...pcts) + 5);
  const last = trend[trend.length - 1];

  return (
    <motion.section
      initial={prefersReduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={prefersReduced ? { duration: 0 } : { duration: 0.35, ease: KH_EASE }}
      aria-label="Licence use"
      className={`${CARD_BASE} overflow-hidden`}
    >
      {/* Three columns only where three columns fit.
          The gauge is 148px and the sentence needs ~22rem to stay on two lines;
          at 1280 that leaves the trend about 190px of plot, most of it eaten by
          the "Healthy 60%" label — a chart squeezed to a squiggle, which is
          worse than no chart. Below 2xl the trend drops to a full-width row of
          its own, where it has more space than it ever had beside the number. */}
      <div className="flex flex-col xl:flex-row xl:items-center gap-6 xl:gap-8 p-6 lg:p-7">
        <div className="flex flex-col sm:flex-row sm:items-center gap-6 lg:gap-8 shrink-0">
          {/* A linear gauge, not a radial one. The reader reads a fill against a
              benchmark tick the way they read a progress bar — left to right,
              over the mark or under it — which needs no interpreting. A donut
              asks them to judge an arc's sweep against a notch on a circle, and
              that is exactly the "confusing chart type" this page was told to
              drop. Same number, same 60% benchmark, read at a glance. */}
          <div className="shrink-0 w-full sm:w-[13.5rem]">
            <div
              className={`text-[2.75rem] font-semibold leading-none tracking-[-0.03em] ${
                healthy ? 'text-ink-900' : 'text-mitigated-700'
              }`}
            >
              {pct}%
            </div>
            <div className="mt-2 text-[0.75rem] font-medium text-ink-500">of {v.seats} seats used this week</div>
            <div className="mt-4">
              <div className="relative h-3">
                <div className="absolute inset-0 rounded-full bg-ink-900/[0.06] overflow-hidden">
                  {/* The stretch past the benchmark — the cushion the seat share is
                      meant to sit in. A hair of the fill's own hue so an empty
                      track still says which side is "healthy", never a second
                      colour competing with the fill. */}
                  <div
                    className="absolute inset-y-0 right-0 bg-brand-500/[0.07]"
                    style={{ left: `${HEALTHY_SEAT_USE}%` }}
                    aria-hidden
                  />
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{
                      background: healthy
                        ? 'linear-gradient(90deg,#8B4FD8,#6A12CD)'
                        : 'linear-gradient(90deg,#D97A1E,#B45309)',
                    }}
                    initial={prefersReduced ? false : { width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={prefersReduced ? { duration: 0 } : { duration: 0.7, ease: KH_EASE }}
                  />
                </div>
                {/* The benchmark, drawn ON TOP and taller than the track so it
                    survives the fill crossing it — when the share clears 60% the
                    old 1px line was painted over by its own bar, so the one mark
                    the number is judged against vanished exactly when it mattered.
                    A white keyline carries it across both the purple fill and the
                    grey track. */}
                <div
                  className="absolute -top-1 -bottom-1 w-[3px] -translate-x-1/2 rounded-full bg-canvas-elevated"
                  style={{ left: `${HEALTHY_SEAT_USE}%` }}
                  aria-hidden
                />
                <div
                  className="absolute -top-1 -bottom-1 w-[1.5px] -translate-x-1/2 rounded-full bg-ink-900/55"
                  style={{ left: `${HEALTHY_SEAT_USE}%` }}
                  aria-hidden
                />
              </div>
              <div className="relative mt-2 h-4 text-[0.625rem] font-medium text-ink-400">
                <span
                  className="absolute -translate-x-1/2 whitespace-nowrap"
                  style={{ left: `${HEALTHY_SEAT_USE}%` }}
                >
                  Healthy {HEALTHY_SEAT_USE}%
                </span>
              </div>
            </div>
          </div>

          {/* What the arc means, in people. The window IS named here, and it has
              to be: this card deliberately does not follow the date filter above
              it. The header can say "Showing 90 days" while this says "this week",
              and without the words that looks like a bug rather than the point.
              The chip makes it impossible to miss. */}
          <div className="min-w-0 sm:w-[22rem]">
          <span className="inline-flex items-center h-[1.125rem] px-1.5 mb-2 rounded border border-canvas-border bg-canvas text-[0.5625rem] font-semibold uppercase tracking-wide text-ink-500">
            Always the last 7 days
          </span>
          <p className="text-[1.0625rem] text-ink-700 leading-snug">
            <strong className="font-semibold text-ink-900">
              {v.activeUsers} of your {v.seats} paid seats
            </strong>{' '}
            did real work this week
          </p>

          <p className="mt-2.5 text-[0.875rem] text-ink-600">
            <span className={`font-semibold ${healthy ? 'text-compliant-700' : 'text-mitigated-700'}`}>
              {healthy ? 'Above' : 'Below'} the {HEALTHY_SEAT_USE}% that counts as healthy
            </span>{' '}
            for a paid licence, {trendWord}.
          </p>

          {/* The delta names what it counts and what it counts against. A bare
              "−2" beside the headline could be seats, points or percent, measured
              against anything — which is the vanity metric this page's own delta
              spec exists to forbid. */}
          {diff !== 0 && (
            <p className="mt-2 flex items-center gap-1.5 text-[0.8125rem] text-ink-500">
              <ArrowUpRight
                size={13}
                strokeWidth={2.5}
                className={`shrink-0 ${diff > 0 ? 'text-compliant-700' : 'text-risk-700 rotate-90'}`}
                aria-hidden
              />
              <span>
                <strong className={`font-semibold tabular-nums ${diff > 0 ? 'text-compliant-700' : 'text-risk-700'}`}>
                  {Math.abs(diff)} {Math.abs(diff) === 1 ? 'seat' : 'seats'} {diff > 0 ? 'more' : 'fewer'}
                </strong>{' '}
                than the week before
              </span>
            </p>
          )}
          </div>
        </div>

        {/* An arc says where you are. It cannot say where you are heading, and
            for a licence that is the whole question: 71% on the way down is a
            different business from 71% on the way up.

            Stacked, it is separated by a rule above it; beside the number, by a
            rule to its left. Either way there is a hairline between the answer
            and its history — they are two readings, not one block. */}
        {trend.length > 1 && (
          <div className="flex-1 min-w-0 border-t border-canvas-border pt-4 xl:border-t-0 xl:pt-0 xl:border-l xl:pl-8">
            <div className="flex items-baseline justify-between gap-3 mb-2">
              <span className="text-[0.6875rem] font-semibold text-ink-500 uppercase tracking-wide">
                Last {trend.length} weeks
              </span>
              <span className="text-[0.6875rem] text-ink-400">Share of seats, week by week</span>
            </div>
            {/* The fill IS the reading, not decoration.
                A licence share barely moves week to week, so on a 0-100 axis
                every column is the same near-full height and the direction — the
                one thing this chart is for — disappears. So: a line on a focused
                axis, and the band filled only DOWN TO the 60% mark, not to the
                floor. That shaded wedge is the cushion above healthy; you watch
                it thin as the line slides toward the line it is read against. An
                earlier version filled to the plot floor, which is the "tinted
                slab" the old note rightly warned off — a wash that encodes
                nothing. This one encodes the margin. */}
            <div className="h-[72px] -ml-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 10, right: 44, bottom: 4, left: 4 }}>
                  <defs>
                    <linearGradient id="verdict-trend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={line} stopOpacity={0.26} />
                      <stop offset="100%" stopColor={line} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  {/* Focused, not zero-based — legitimate for a line, whose points
                      read by position. The window always spans the 60% mark, so
                      the benchmark stays on-screen with room beneath it. */}
                  <YAxis domain={[lo, hi]} hide />
                  <XAxis dataKey="weeksAgo" hide />
                  <Tooltip
                    isAnimationActive={false}
                    cursor={{ stroke: HOVER_FILL, strokeWidth: 1 }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    content={({ active, payload }: any) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0].payload as { pct: number; active: number; weeksAgo: number };
                      return (
                        <div className="rounded-lg border border-canvas-border bg-canvas-elevated px-3 py-2 shadow-[0_8px_24px_-6px_rgba(15,7,32,0.12)]">
                          <div className="text-[0.6875rem] font-semibold text-ink-900">
                            {p.weeksAgo === 0 ? 'This week' : p.weeksAgo === 1 ? 'Last week' : `${p.weeksAgo} weeks ago`}
                          </div>
                          <div className="mt-0.5 text-[0.6875rem] text-ink-500 tabular-nums">
                            {p.pct}% · {p.active} of {v.seats} seats
                          </div>
                        </div>
                      );
                    }}
                  />
                  {/* The 60% mark, labelled at the LEFT so the right end is left
                      clear for this week's value — the two used to collide in the
                      corner. It is the floor the band fills down to. */}
                  <ReferenceLine
                    y={HEALTHY_SEAT_USE}
                    stroke="rgba(15,7,32,0.28)"
                    strokeDasharray="3 3"
                    strokeWidth={1}
                    label={{
                      value: `Healthy ${HEALTHY_SEAT_USE}%`,
                      position: 'insideBottomLeft',
                      fill: '#8B7BA3',
                      fontSize: 10.5,
                      fontWeight: 500,
                      offset: 6,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="pct"
                    stroke={line}
                    strokeWidth={2.25}
                    fill="url(#verdict-trend)"
                    baseValue={HEALTHY_SEAT_USE}
                    isAnimationActive={!prefersReduced}
                    animationDuration={700}
                    /* Only this week gets a marked point — the number printed in
                       the gauge — with its value beside it, so the end of the line
                       and the hero read as one fact. The weeks behind are the path
                       it travelled, not eight competing claims. */
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    dot={({ cx, cy, payload }: any) =>
                      payload.weeksAgo === 0 ? (
                        <g key="now">
                          <circle cx={cx} cy={cy} r={5} fill={line} stroke="#fff" strokeWidth={2} />
                          <text x={cx + 10} y={cy} dy={4.5} fontSize={12.5} fontWeight={700} fill={line}>
                            {last.pct}%
                          </text>
                        </g>
                      ) : (
                        <circle key={payload.weeksAgo} cx={cx} cy={cy} r={0} fill="none" />
                      )
                    }
                    activeDot={{ r: 4, fill: line, stroke: '#fff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* One finding, and only if it fires. It is a footer of the hero card, not
          a card of its own: DESIGN.md's alert spelling is a 3px left-edge stripe
          with no background tint, and the amber wash this used to carry is what
          made a finding read as a warning banner. */}
      {idle > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-canvas-border border-l-[3px] border-l-mitigated-700 bg-canvas/60 py-3 pl-5 pr-4">
          <p className="text-[0.875rem] text-ink-700 flex-1 min-w-0">
            <strong className="font-semibold text-ink-900">{idle} {idle === 1 ? 'seat is' : 'seats are'} idle</strong>
            <span className="text-ink-500">
              {': '}
              {[
                v.neverSignedIn > 0 ? `${v.neverSignedIn} never signed in` : null,
                v.dormant > 0 ? `${v.dormant} quiet for 30+ days` : null,
              ].filter(Boolean).join(', ')}
            </span>
          </p>
          {/* A quiet affordance, not a filled CTA. A solid brand button was the
              loudest thing in the block, which put a secondary nudge above the
              number the page is built around. */}
          <button
            type="button"
            onClick={onSeeWho}
            className="group shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-brand-700 hover:bg-brand-50 text-[0.8125rem] font-semibold transition-colors cursor-pointer"
          >
            See who
            <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      )}
    </motion.section>
  );
}
