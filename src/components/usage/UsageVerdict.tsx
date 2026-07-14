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
 * share of paid seats that did real work. It gets 72px, a track to sit in, and
 * the benchmark that makes it mean something. Everything else on the page is
 * subordinate to it — literally, in type size.
 *
 * One finding rides alongside, and only if it fires. Not three. Three findings
 * plus a headline is a KPI band, and there is already a KPI band underneath.
 */

import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, ReferenceLine, Tooltip } from 'recharts';
import { KH_EASE, SERIES } from './usageTokens';

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
  const line = healthy ? SERIES.primary : '#B45309';

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
      // Two rows, not two columns. The finding used to live *inside* the right
      // column, which made that column three times the height of the number
      // beside it — and with `items-end` bottom-aligning the two, the track
      // floated up level with nothing while the number sat halfway down. The
      // gauge (number + its track) is one row; the finding is its own row under
      // both, full width, where a finding belongs.
      className="flex flex-col gap-5"
    >
      <div className="flex flex-col lg:flex-row lg:items-end gap-6 lg:gap-12">
      {/* The number. Everything else on this page is smaller than this on
          purpose — that is what makes it the answer rather than a statistic.

          It carries the count too. "59%" and "10 of 17 people used it" were two
          blocks of type saying one thing: 10 of 17 IS 59%. One sentence now
          states it in both forms, and the track beside it is free to say the only
          thing neither of them said, which is whether 59% is any good. */}
      <div className="shrink-0 lg:max-w-[22rem]">
        <span
          className={`block text-[4.5rem] font-semibold leading-none tracking-[-0.04em] tabular-nums ${
            healthy ? 'text-ink-900' : 'text-mitigated-700'
          }`}
        >
          {pct}%
        </span>
        {/* The window IS named here, and it has to be: this card deliberately
            does not follow the date filter above it. The header can say "Showing
            90 days" while this says "this week", and without the words that looks
            like a bug rather than the point. */}
        <p className="mt-3 text-[0.9375rem] text-ink-700">
          <strong className="font-semibold text-ink-900">{v.activeUsers} of your {v.seats} paid seats</strong>{' '}
          did real work this week
        </p>
        {/* The delta names what it counts and what it counts against. A bare
            "−2" beside the headline could be seats, points or percent, measured
            against anything — which is the vanity metric this page's own delta
            spec exists to forbid. */}
        {diff !== 0 && (
          <p className="mt-1.5 flex items-center gap-1.5 text-[0.8125rem] text-ink-500">
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

      {/* A bar says where you are. It cannot say where you are heading, and for a
          licence that is the whole question: 71% on the way down is a different
          business than 71% on the way up. Same footprint, one more dimension. */}
      <div className="flex-1 min-w-0">
        {trend.length > 1 ? (
          <div className="h-[92px] -ml-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 16, right: 78, bottom: 2, left: 4 }}>
                <defs>
                  {/* Barely there. Filled from the series down to zero, an 18%
                      wash covers two thirds of the plot and reads as a grey block
                      floating on the page rather than as a chart. The line is the
                      data; the wash is only there to give it a floor. */}
                  <linearGradient id="verdict-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={line} stopOpacity={0.10} />
                    <stop offset="70%" stopColor={line} stopOpacity={0} />
                  </linearGradient>
                </defs>
                {/* Zero-based, so the line cannot exaggerate a wobble. A licence
                    share is a percentage of a whole and gets the whole axis. */}
                <YAxis domain={[0, 100]} hide />
                {/* Data is oldest-first, so plain array order already reads
                    left-to-right as past-to-present. `reversed` mirrored it and
                    put this week on the left, which inverted the whole story. */}
                <XAxis dataKey="weeksAgo" hide />
                {/* The benchmark is the line the series is read against, so it is
                    drawn IN the chart and labelled at its own height. */}
                <ReferenceLine
                  y={HEALTHY_SEAT_USE}
                  stroke="rgba(15,7,32,0.28)"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                  label={{
                    value: `Healthy ${HEALTHY_SEAT_USE}%`,
                    position: 'right',
                    fill: '#6B6478',
                    fontSize: 11,
                    fontWeight: 500,
                  }}
                />
                <Tooltip
                  isAnimationActive={false}
                  cursor={{ stroke: 'rgba(15,7,32,0.16)', strokeWidth: 1, strokeDasharray: '4 4' }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  content={({ active, payload }: any) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0].payload as { pct: number; active: number; weeksAgo: number };
                    return (
                      <div className="rounded-lg border border-canvas-border bg-canvas-elevated px-3 py-2 shadow-lg">
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
                <Area
                  type="monotone"
                  dataKey="pct"
                  stroke={line}
                  strokeWidth={2}
                  fill="url(#verdict-fill)"
                  isAnimationActive={!prefersReduced}
                  animationDuration={600}
                  activeDot={{ r: 4, fill: line, stroke: '#fff', strokeWidth: 2 }}
                  // Only this week wears a dot. It is the number printed beside the
                  // chart; a dot on all eight weeks is eight marks competing with
                  // the one that is the answer.
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  dot={(props: any) => {
                    const { key, cx, cy, payload } = props;
                    if (payload.weeksAgo !== 0) return <g key={key} />;
                    return <circle key={key} cx={cx} cy={cy} r={4} fill={line} stroke="#fff" strokeWidth={2} />;
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="relative pt-5">
            <div className="relative h-2.5 rounded-full bg-ink-900/[0.07] overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${healthy ? 'bg-brand-600' : 'bg-mitigated-700'}`}
                initial={prefersReduced ? false : { width: 0 }}
                animate={{ width: `${Math.max(2, pct)}%` }}
                transition={prefersReduced ? { duration: 0 } : { type: 'spring', stiffness: 220, damping: 30, delay: 0.15 }}
              />
              <span
                className="absolute inset-y-0 w-[2px] -translate-x-1/2 bg-canvas"
                style={{ left: `${HEALTHY_SEAT_USE}%` }}
                aria-hidden
              />
            </div>
          </div>
        )}

        <p className="mt-1 text-[0.875rem] text-ink-600">
          <span className={healthy ? 'text-compliant-700 font-semibold' : 'text-mitigated-700 font-semibold'}>
            {healthy ? 'Above' : 'Below'} the healthy mark
          </span>{' '}
          for a paid licence, {trendWord}.
        </p>
      </div>
      </div>

      {/* One finding, and only if it fires. Full width, under the gauge. */}
      {idle > 0 && (
          // DESIGN.md, Alert Cards: "3px left-edge tinted border … No shadow,
          // no background tint." The amber wash was the tint the spec rules out,
          // and it is what made this read as a warning banner rather than a
          // finding. The stripe carries the semantic on its own.
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-canvas-border border-l-[3px] border-l-mitigated-700 bg-canvas-elevated py-3 pl-4 pr-3">
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
                72px number the page is built around. */}
            <button
              type="button"
              onClick={onSeeWho}
              className="group shrink-0 inline-flex items-center gap-1.5 h-8 px-3 -mr-1 rounded-md text-brand-700 hover:bg-brand-50 text-[0.8125rem] font-semibold transition-colors cursor-pointer"
            >
              See who
              <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
            </button>
        </div>
      )}
    </motion.section>
  );
}
