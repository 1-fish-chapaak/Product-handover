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
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, ReferenceLine, Tooltip } from 'recharts';
import { RadialGauge } from './usageChrome';
import { BAR_RADIUS, BAR_SIZE, CARD_BASE, HOVER_FILL, KH_EASE, MUTED, SERIES } from './usageTokens';

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
      <div className="flex flex-col 2xl:flex-row 2xl:items-center gap-6 2xl:gap-8 p-6 lg:p-7">
        <div className="flex flex-col sm:flex-row sm:items-center gap-6 lg:gap-8 shrink-0">
          {/* The gauge IS the headline. The percentage lives in the middle of it,
              so the number and the benchmark it is judged against are one mark
              instead of two facts a reader has to combine. */}
          <RadialGauge pct={pct} benchmark={HEALTHY_SEAT_USE} healthy={healthy} size={148}>
            <span
              className={`text-[2.5rem] font-semibold leading-none tracking-[-0.03em] ${
                healthy ? 'text-ink-900' : 'text-mitigated-700'
              }`}
            >
              {pct}%
            </span>
            <span className="mt-1.5 text-[0.6875rem] font-medium text-ink-400">of {v.seats} seats</span>
          </RadialGauge>

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
          <div className="flex-1 min-w-0 border-t border-canvas-border pt-5 2xl:border-t-0 2xl:pt-0 2xl:border-l 2xl:pl-8">
            <div className="flex items-baseline justify-between gap-3 mb-1">
              <span className="text-[0.6875rem] font-semibold text-ink-500 uppercase tracking-wide">
                Last {trend.length} weeks
              </span>
              <span className="text-[0.6875rem] text-ink-400">Share of seats, week by week</span>
            </div>
            {/* Columns, not a line.
                On a zero-based percentage axis a line that lives around 65% is a
                thread across the top of the plot with two thirds of the box empty
                under it — and filling that space with a wash just turns it into a
                tinted slab. Eight weeks is exactly the density a column chart
                wants, columns grow from the zero the axis is anchored on, and the
                benchmark drawn across them turns "were we ever below the mark"
                into something you see rather than something you compute. */}
            <div className="h-[110px] -ml-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend} margin={{ top: 10, right: 74, bottom: 2, left: 4 }} barCategoryGap="28%">
                  <defs>
                    <linearGradient id="verdict-col" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={healthy ? '#7B2BDB' : '#C2690C'} />
                      <stop offset="100%" stopColor={line} />
                    </linearGradient>
                  </defs>
                  {/* Zero-based, so a column cannot exaggerate a wobble. A licence
                      share is a percentage of a whole and gets the whole axis. */}
                  <YAxis domain={[0, 100]} hide />
                  {/* Data is oldest-first, so plain array order already reads
                      left-to-right as past-to-present. `reversed` mirrored it and
                      put this week on the left, which inverted the whole story. */}
                  <XAxis dataKey="weeksAgo" hide />
                  <Tooltip
                    isAnimationActive={false}
                    cursor={{ fill: HOVER_FILL }}
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
                  {/* The benchmark is the line the series is read against, so it
                      is drawn IN the chart, over the columns, and labelled at its
                      own height — the same threshold the gauge's tick marks, said
                      twice in two registers because the two answer different
                      questions (are we over it / were we ever). */}
                  <ReferenceLine
                    y={HEALTHY_SEAT_USE}
                    stroke="rgba(15,7,32,0.35)"
                    strokeDasharray="4 4"
                    strokeWidth={1}
                    ifOverflow="extendDomain"
                    label={{
                      value: `Healthy ${HEALTHY_SEAT_USE}%`,
                      position: 'right',
                      fill: '#6B5D82',
                      fontSize: 11,
                      fontWeight: 500,
                    }}
                  />
                  <Bar
                    dataKey="pct"
                    radius={BAR_RADIUS}
                    maxBarSize={BAR_SIZE}
                    isAnimationActive={!prefersReduced}
                    animationDuration={700}
                  >
                    {/* Only this week is at full strength — it is the number
                        printed inside the gauge. The seven behind it are the
                        history it came out of, and they read as the lighter step
                        of the same hue rather than as eight equal claims. */}
                    {trend.map(t => (
                      <Cell
                        key={t.weeksAgo}
                        fill={t.weeksAgo === 0 ? 'url(#verdict-col)' : healthy ? MUTED.primary : 'rgba(180,83,9,0.28)'}
                      />
                    ))}
                  </Bar>
                </BarChart>
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
