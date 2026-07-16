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
 * So this is the one thing that dominates: the share of paid seats that did real
 * work this week, as a plain stat. It reports the number, not a verdict — there
 * is no target line, no "healthy" threshold, no judgement drawn on the figure.
 * The reader gets the share, the count in people, and the week-to-week direction,
 * and draws their own conclusion.
 *
 * One finding rides underneath, and only if it fires: the idle-seat count, which
 * is a separate fact about seats nobody is in, not a verdict on the share.
 */

import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import ChartAutoSizer from './ChartAutoSizer';
import { InfoPopover } from './usageChrome';
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

export default function UsageVerdict({ v, findings, onSeeWho }: {
  v: VerdictInput;
  /** The "worth checking" licence questions, merged into this card's footer:
   *  pending invites, quiet seats, and (when they fire) concentration / AI. */
  findings: { key: string; eyebrow: string; figure: string; detail: string }[];
  onSeeWho: () => void;
}) {
  const prefersReduced = useReducedMotion();
  const pct = v.seats > 0 ? Math.round((v.activeUsers / v.seats) * 100) : 0;
  const diff = v.activeUsers - v.priorActiveUsers;

  const trend = v.trend ?? [];
  // No target any more: the card reports the usage share and its direction, it
  // does not judge it against a line. So one neutral series colour throughout.
  const line = SERIES.primary;

  /* The trend is a line, not columns, and this is why.
     A licence share lives in a narrow band, so on the 0-100 axis a bar demands,
     every column is the same near-full height and the one thing this chart exists
     to show, the direction, is invisible. A line reads position, not length, so it
     can sit on a focused axis padded around the data, and the rise or fall becomes
     a slope you see rather than a word you take on trust. */
  const pcts = trend.map(t => t.pct);
  const lo = pcts.length ? Math.max(0, Math.min(...pcts) - 6) : 0;
  const hi = pcts.length ? Math.min(100, Math.max(...pcts) + 5) : 100;
  const last = trend[trend.length - 1];

  return (
    <motion.section
      initial={prefersReduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={prefersReduced ? { duration: 0 } : { duration: 0.35, ease: KH_EASE }}
      aria-label="Licence use"
      // No overflow-hidden: it existed only to clip the full-bleed footer to the
      // rounded corners, but it also clipped any tooltip that grew past the card.
      // The footer now rounds its own bottom corners (rounded-b-lg), so hover cards
      // can extend beyond the card edge without being cut off.
      className={CARD_BASE}
    >
      <div className="p-4 lg:p-5">
        {/* One row, not a header band stacked over a data row. The chip, the plain
            takeaway and the 60% definition used to sit in a full-width strip above
            the number; folding them beside the gauge deletes that whole vertical
            zone, and the card is wide enough that the definition still fits on one
            line. Reading order left to right: the number, the words, the trend. */}
        <div className="flex flex-col xl:flex-row xl:items-center gap-4 xl:gap-6">
          {/* A linear gauge, read left to right against the 60% tick. The
              "confusing chart type" this page was told to drop was the donut, not
              this progress bar. */}
          <div className="shrink-0 w-full sm:w-[16rem]">
            {/* Number and count on one baseline row. No target, so no colour
                verdict on the figure — it is the neutral ink of a plain stat. */}
            <div className="flex items-baseline gap-2.5">
              <span className="text-[2rem] font-semibold leading-none tracking-[-0.03em] text-ink-900">
                {pct}%
              </span>
              <span className="text-[0.75rem] font-medium text-ink-500">
                {v.activeUsers} of {v.seats} seats used
              </span>
            </div>
            {/* A plain progress bar: the share of paid seats used. No tick, because
                there is no target to read it against. */}
            <div className="mt-2 relative h-3 rounded-full bg-ink-900/[0.06] overflow-hidden">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ background: 'linear-gradient(90deg,#8B4FD8,#6A12CD)' }}
                initial={prefersReduced ? false : { width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={prefersReduced ? { duration: 0 } : { duration: 0.7, ease: KH_EASE }}
              />
            </div>
          </div>

          {/* Zone B: the plain words, now beside the number instead of in a
              full-width band above it. Chip, takeaway, definition, then the one
              live line the visuals cannot say in words — which side of the mark and
              which way it is heading. */}
          <div className="min-w-0 xl:flex-1">
            <span className="inline-flex items-center h-[1.125rem] px-1.5 mb-1 rounded border border-canvas-border bg-canvas text-[0.5625rem] font-semibold uppercase tracking-wide text-ink-500">
              Always the last 7 days
            </span>
            {/* The widget's ⓘ is the shared InfoPopover every other card on this
                page uses in its header's right slot (see UsageAdoption / the KPI
                band). This card's true top-right corner is taken by the trend, so
                the faithful equivalent is the right of the header text: title left,
                ⓘ pushed to the right edge of the words zone. */}
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold leading-snug text-ink-900">
                How many paid seats are being used
              </h2>
              <span className="mt-0.5 shrink-0">
                <InfoPopover
                  label="a used seat"
                  counts="at least one real action this week, like opening a report, running a workflow, or exporting a file"
                  excludes="signing in on its own"
                />
              </span>
            </div>

            {/* The delta names what it counts and what it counts against, so a bare
                "2 fewer" cannot be read as points or percent. It is the one plain
                read of direction now that the verdict line is gone. */}
            {diff !== 0 && (
              <p className="mt-2 flex items-center gap-1.5 text-[0.75rem] text-ink-500">
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

        {/* An arc says where you are. It cannot say where you are heading, and
            for a licence that is the whole question: 71% on the way down is a
            different business from 71% on the way up.

            Stacked, it is separated by a rule above it; beside the number, by a
            rule to its left. Either way there is a hairline between the answer
            and its history — they are two readings, not one block. */}
        {trend.length > 1 && (
          <div className="flex-1 min-w-0 border-t border-canvas-border pt-3 xl:border-t-0 xl:pt-0 xl:border-l xl:pl-6">
            <div className="flex items-baseline justify-between gap-3 mb-1.5">
              <span className="text-[0.6875rem] font-semibold text-ink-500 uppercase tracking-wide">
                Last {trend.length} weeks
              </span>
              <span className="text-[0.6875rem] text-ink-400">Share of seats, week by week</span>
            </div>
            {/* A line on a focused axis: the share barely moves week to week, so a
                0-100 axis would flatten the direction this chart exists to show. The
                fill falls to the axis floor under the line. */}
            <div className="h-[48px] -ml-1">
              <ChartAutoSizer>
                {({ width, height }) => (
                <AreaChart width={width} height={height} data={trend} margin={{ top: 10, right: 44, bottom: 4, left: 4 }}>
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
                  {/* No 60% reference line: there is no target to draw. The line
                      just reports the share week to week; the fill falls to the
                      focused axis floor. */}
                  <Area
                    type="monotone"
                    dataKey="pct"
                    stroke={line}
                    strokeWidth={2.25}
                    fill="url(#verdict-trend)"
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
                )}
              </ChartAutoSizer>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Worth checking — merged into the card footer. This is the old one-line
          idle strip AND the separate "Worth checking" section below the seat cards,
          folded into one: the same licence questions, said once, in the footer of
          the card whose number they qualify. Type carries it — a hairline above, an
          amber figure, no box or side rule (the anti-pattern the audit flagged). */}
      <div className="rounded-b-lg border-t border-canvas-border px-4 lg:px-5 py-3.5">
        <div className="mb-1 flex items-baseline justify-between gap-4">
          <h3 className="text-[0.875rem] font-semibold text-ink-900">Worth checking</h3>
          {findings.length > 0 && (
            <button
              type="button"
              onClick={onSeeWho}
              className="group shrink-0 inline-flex items-center gap-1 text-[0.75rem] font-semibold text-brand-700 hover:text-brand-600 transition-colors cursor-pointer"
            >
              See who
              <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
            </button>
          )}
        </div>

        {findings.length > 0 ? (
          <>
            <ul className="divide-y divide-canvas-border">
              {findings.map(f => (
                <li key={f.key} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2.5">
                  <span className="w-5 shrink-0 tabular-nums text-[0.875rem] font-semibold text-mitigated-700">
                    {f.figure}
                  </span>
                  <span className="w-36 shrink-0 text-[0.875rem] font-medium text-ink-900">
                    {f.eyebrow}
                  </span>
                  <span className="min-w-0 flex-1 text-[0.875rem] text-ink-500">
                    {f.detail}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[0.75rem] text-ink-400">Resolve in Administration, under Users &amp; Teams.</p>
          </>
        ) : (
          <p className="text-[0.875rem] text-ink-500">Every seat is being used. Nothing to check.</p>
        )}
      </div>
    </motion.section>
  );
}
