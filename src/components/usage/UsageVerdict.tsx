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
 *
 * The card is TWO zones, and the count is the point. It was three — figure on the
 * far left, the question that figure answers stranded 450px away in the middle,
 * trend on the right — so the eye started over three times and the number's own
 * label was the furthest thing from it. Now the question, the figure and the count
 * are one reading, and the history is the other, behind a hairline.
 *
 * What each zone may say once, and only once:
 *   · The share, as a figure. Not also as a bar's length, and not also as a label
 *     on the trend's last point — that was one fact drawn three ways, and the bar
 *     was the copy carrying the least. The bar is now a dot per seat, which says
 *     the thing the figure cannot: the seats nobody used are a countable number of
 *     individual things you are paying for, not a grey remainder.
 *   · The direction, as a line. Both ends carry their real value, because the axis
 *     is focused (a share lives in a narrow band) and a focused axis with no
 *     anchors cannot tell a 4-point wiggle from a 40-point cliff. Type doing an
 *     axis's job is the whole axis this needs.
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
  /* Padded tight, not loose. This card is a wide strip, so the line gets ~3x the
     horizontal room it gets vertical, and every extra point of padding here flattens
     the slope further. A ±6/+5 band spread 8 points of real movement across a third
     of the plot's height and the fall came out as a ripple. */
  const pcts = trend.map(t => t.pct);
  const lo = pcts.length ? Math.max(0, Math.min(...pcts) - 3) : 0;
  const hi = pcts.length ? Math.min(100, Math.max(...pcts) + 3) : 100;
  /* The two ends of the line. Both are labelled with their real value, because a
     focused axis without them cannot tell a 4-point wiggle from a 40-point cliff. */
  const first = trend[0];
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
      {/* p-4/lg:p-5 is the Card primitive's `primary` rank (usageChrome). This card
          hand-rolls its shell rather than using Card, so it had drifted a rank
          heavier than every panel beside it — 20/24px of padding on a strip whose
          content is one figure, a row of dots and a line. Back on the grid. */}
      <div className="p-4 lg:p-5">
        {/* TWO zones, not three. The question, the number and the count are one
            reading and they sit together; the history is the other, behind a
            hairline. The old layout put the number on the far left and the
            question that number answers 450px away in the middle, so the eye
            started three times over: figure, then title, then chart. */}
        {/* THREE columns from `wide` (1340px). Three bands, and they do not overlap:
              <xl        stacked
              xl..wide   two rows — answer + trend, Worth checking wrapped below
              >=wide     one row — answer | trend | Worth checking   (182px)

            The gate was `2xl` (1536) for one pass, and that was a bug rather than a
            judgement: a 14" MacBook is 1512pt, so every laptop sat just under it and
            saw only the two-row fallback. The compact layout existed and nobody could
            see it. 1340 is the lowest the 3-up row goes before the findings column
            costs more height than the row it saves (measured: 182px at 1440+, 219 at
            1366, 320 on the fallback).

            EVERY PROPERTY BELOW IS SET BY EXACTLY ONE RULE, via `max-*` bands. That
            is deliberate and it is the only reason this works. Tailwind v4 emits BOTH
            arbitrary media variants (`min-[1400px]:`) and custom breakpoints (`wide:`)
            ahead of the named ones no matter their value, so `xl:w-full` silently beat
            `wide:w-auto` and the 3-up row applied at NO width. Non-overlapping
            conditions make cascade order irrelevant. Do not "simplify" these back into
            competing `xl:` / `wide:` pairs on one property — it fails silently. */}
        <div className="flex flex-col xl:flex-row xl:max-wide:flex-wrap gap-4 xl:gap-x-6 xl:gap-y-3">
          {/* Zone A — the answer. Title first, because it is the question the
              reader arrived with; then the figure that answers it, directly
              underneath, where a label belongs. */}
          <div className="min-w-0 shrink-0 xl:w-[26rem]">
            <h2 className="text-base font-semibold leading-snug text-ink-900">
              How many paid seats are being used
              {/* The shared InfoPopover, inline after the title rather than in a
                  header's right slot: this column is narrow and the card's true
                  top-right corner belongs to the trend, so right-of-the-text would
                  float it mid-card, attached to nothing. */}
              <span className="ml-1.5 inline-block align-middle">
                <InfoPopover
                  label="a used seat"
                  counts="at least one real action this week, like opening a report, running a workflow, or exporting a file"
                  excludes="signing in on its own"
                />
              </span>
            </h2>
            {/* Was a bordered uppercase pill, which is a lot of chrome for what is
                a caption. It still has to be unmissable, because this number
                ignores the date range set above it — so it earns its place by
                saying that out loud, in plain words, directly under the title. */}
            <p className="mt-1 text-[0.75rem] text-ink-400">
              Always the last 7 days, whatever range is set above.
            </p>

            {/* Number and count on one baseline row. No target, so no colour
                verdict on the figure — it is the neutral ink of a plain stat. */}
            <div className="mt-3 flex items-baseline gap-2.5">
              <span className="text-[2.25rem] font-semibold leading-none tracking-[-0.03em] text-ink-900">
                {pct}%
              </span>
              <span className="text-[0.875rem] text-ink-500">
                {v.activeUsers} of {v.seats} seats used
              </span>
            </div>

            {/* One dot per seat, filled if it did real work this week.
                This replaces a purple gradient progress bar, which drew 65% as a
                length — a third copy of a number already printed beside it and
                already plotted as the end of the trend line. The dots say the one
                thing the figure cannot: the unused seats are a countable number of
                individual things you are paying for, not a grey remainder. Above a
                countable number of seats that stops being true, so it falls back to
                a plain track. */}
            {v.seats <= 40 ? (
              <div className="mt-3 flex flex-wrap gap-1.5" aria-hidden>
                {Array.from({ length: v.seats }, (_, i) => (
                  <motion.span
                    key={i}
                    className={`h-2.5 w-2.5 rounded-full ${i < v.activeUsers ? 'bg-brand-700' : 'bg-ink-900/[0.13]'}`}
                    initial={prefersReduced ? false : { opacity: 0, scale: 0.4 }}
                    animate={{ opacity: 1, scale: 1 }}
                    /* Absolute delays, not variants — the page's cascade pattern. */
                    transition={prefersReduced ? { duration: 0 } : { duration: 0.3, delay: i * 0.02, ease: KH_EASE }}
                  />
                ))}
              </div>
            ) : (
              <div className="mt-3 relative h-2 rounded-full bg-ink-900/[0.06] overflow-hidden">
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full bg-brand-700"
                  initial={prefersReduced ? false : { width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={prefersReduced ? { duration: 0 } : { duration: 0.7, ease: KH_EASE }}
                />
              </div>
            )}

            {/* The delta names what it counts and what it counts against, so a bare
                "2 fewer" cannot be read as points or percent. It is the one plain
                read of direction now that the verdict line is gone, and it renders
                on every value — a flat week is a real answer, and hiding it left a
                hole in the tallest zone of the card. */}
            <p className="mt-2.5 flex items-center gap-1.5 text-[0.75rem] text-ink-500">
              {diff === 0 ? (
                <span className="text-ink-400">No change from the week before.</span>
              ) : (
                <>
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
                </>
              )}
            </p>
          </div>

          {/* Zone B — the history. A number says where you are. It cannot say where
              you are heading, and for a licence that is the whole question: 65% on
              the way down is a different business from 65% on the way up.

              Stacked, it is separated by a rule above it; beside the answer, by a
              rule to its left. Either way there is a hairline between the answer
              and its history — they are two readings, not one block.

              WIDTH IS CAPPED, and that is the point of this pass. As `flex-1` this
              zone took every pixel the card had spare — about 1100 of them — to
              plot eight weekly points. The line came out stretched past 14:1, which
              banks the slope flat: the same failure a 0-100 axis causes, arrived at
              from the other direction. A trend of eight points does not read better
              at 1100px than at 380; it reads worse. So the zone takes what it needs
              and the space it was hoarding goes to Zone C, which used to be a
              full-width row of its own underneath. */}
          {trend.length > 1 && (
            <div className="min-w-0 border-canvas-border max-xl:border-t max-xl:pt-3.5 xl:border-l xl:pl-6 xl:max-wide:flex-1 wide:w-[17rem] wide:shrink-0">
              {/* One label, not two. "Last 8 weeks" said the same thing the axis
                  row under the line now says, and says better, by naming both ends
                  of it instead of floating above the middle. */}
              <p className="text-[0.75rem] font-medium text-ink-500">Share of seats, week by week</p>
              {/* A line on a focused axis: the share barely moves week to week, so a
                  0-100 axis would flatten the direction this chart exists to show.
                  The cost of a focused axis is that the reader cannot tell a 4-point
                  wiggle from a 40-point cliff, so both ends of the line are labelled
                  with their real value. Type doing an axis's job, which is the whole
                  axis this chart needs. */}
              {/* Taller than a sparkline on purpose. At 48px in a strip this wide the
                  plot was ~18:1, which banks any real movement down to a flat line —
                  the one thing the chart exists to show. 96 → 76 on the compaction
                  pass: the margins came in with it, so the PLOT only loses ~8px and
                  the slope survives. This is the floor; below it the line banks flat
                  again and the chart stops earning its space. */}
              <div className="mt-2 h-[76px]">
                <ChartAutoSizer>
                  {({ width, height }) => (
                  <AreaChart width={width} height={height} data={trend} margin={{ top: 12, right: 42, bottom: 6, left: 36 }}>
                    <defs>
                      <linearGradient id="verdict-trend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={line} stopOpacity={0.16} />
                        <stop offset="100%" stopColor={line} stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    {/* Focused, not zero-based — legitimate for a line, whose points
                        read by position, and calibrated by the two end labels. */}
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
                      /* Two marked points, and only two: where the line starts and
                         where it has got to. Each carries its value, so the slope
                         between them is a real distance rather than a shape you have
                         to take on trust. The weeks between are the path it
                         travelled, not eight competing claims. */
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      dot={({ cx, cy, payload }: any) => {
                        if (payload.weeksAgo === 0) {
                          return (
                            <g key="now">
                              <circle cx={cx} cy={cy} r={4.5} fill={line} stroke="#fff" strokeWidth={2} />
                              <text x={cx + 9} y={cy} dy={4} fontSize={12} fontWeight={600} fill={line}>
                                {last.pct}%
                              </text>
                            </g>
                          );
                        }
                        if (payload.weeksAgo === first.weeksAgo) {
                          return (
                            <g key="start">
                              <circle cx={cx} cy={cy} r={3} fill="#fff" stroke={line} strokeWidth={1.75} />
                              <text x={cx - 9} y={cy} dy={4} fontSize={12} textAnchor="end" fill="#9A8FAE">
                                {first.pct}%
                              </text>
                            </g>
                          );
                        }
                        return <circle key={payload.weeksAgo} cx={cx} cy={cy} r={0} fill="none" />;
                      }}
                      activeDot={{ r: 4, fill: line, stroke: '#fff', strokeWidth: 2 }}
                    />
                  </AreaChart>
                  )}
                </ChartAutoSizer>
              </div>
              {/* The axis, as two words. It anchors both ends of the line, which
                  the old floating "LAST 8 WEEKS" eyebrow never did. */}
              <div className="mt-1 flex items-baseline justify-between text-[0.6875rem] text-ink-400">
                <span>{first.weeksAgo} weeks ago</span>
                <span>This week</span>
              </div>
            </div>
          )}

      {/* Zone C — worth checking. This was a full-width row of its own across the
          foot of the card, and it was the emptiest thing on the page: two findings
          whose text ran out around 700px, then nothing at all until "See who" on the
          far right edge. Meanwhile the trend beside it was hoarding 1100px to draw
          eight points. Two sparse rows became one dense one — the findings now stand
          in the width the chart gave back, and the card loses a whole row of its own
          height without losing a word.

          Still the old one-line idle strip AND the separate "Worth checking" section
          below the seat cards, folded into one: the same licence questions, said
          once, beside the number they qualify. Type carries it — a hairline to its
          left, an amber figure, no box or side rule (the anti-pattern the audit
          flagged). */}
      <div className="min-w-0 border-canvas-border max-wide:border-t max-wide:pt-3 xl:max-wide:w-full wide:flex-1 wide:border-l wide:pl-6">
        <div className="flex items-baseline justify-between gap-4">
          {/* The same rank as the trend's label beside it, not the 14px heading it
              wore as a footer. These two are the supporting columns; Zone A's h2 is
              the one heading that leads. The amber figures carry the weight here. */}
          <p className="text-[0.75rem] font-medium text-ink-500">Worth checking</p>
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
            <ul className="mt-1 divide-y divide-canvas-border">
              {findings.map(f => (
                /* The detail has no `flex-1` and the label no fixed width, which is
                   what lets this row reflow instead of squeeze. As a full-width
                   footer the label was locked to 8.5rem and the detail stretched to
                   fill, so in a column narrower than ~340px the text had nowhere to
                   go. Now the row runs on one line where there is room and folds the
                   detail under the label where there is not. */
                <li key={f.key} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-1.5">
                  <span className="w-5 shrink-0 tabular-nums text-[0.875rem] font-semibold text-mitigated-700">
                    {f.figure}
                  </span>
                  <span className="shrink-0 text-[0.875rem] font-medium text-ink-900">
                    {f.eyebrow}
                  </span>
                  <span className="min-w-0 text-[0.875rem] text-ink-500">
                    {f.detail}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-[0.75rem] text-ink-400">Resolve in Administration, under Users &amp; Teams.</p>
          </>
        ) : (
          <p className="mt-1 text-[0.875rem] text-ink-500">Every seat is being used. Nothing to check.</p>
        )}
      </div>
        </div>
      </div>
    </motion.section>
  );
}
