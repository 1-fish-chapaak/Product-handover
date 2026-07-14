/**
 * Platform Usage — the KPI strip (PRD §6.2).
 *
 * Four cells: the value, a plain caption, the change against a named baseline,
 * and a small trend.
 *
 *   ACTIONS                    ⓘ
 *   525                              ← the thing you came for
 *   Up 8% from 487                   ← what it did, against a named baseline
 *   ▁▃▂▅▃▇▄▂▅▃▆▄                     ← the days it was made of
 *
 * WHY THE TREND IS BARS, NOT A SPARKLINE. This row carried a sparkline once and
 * it was removed for a good reason: a 34px curve, normalised per-tile to its own
 * maximum, makes a 2-person change and a 200-action change look identical. It
 * was decoration pretending to be data.
 *
 * The fix is not to leave the trend out — REQ-2.1–2.6 ask for it, and a headline
 * with no shape behind it hides the difference between a steady 525 and a 525
 * that was one enormous Tuesday. The fix is to draw a mark that is honest at this
 * size: BARS FROM A ZERO BASELINE. A bar's length is a quantity, so the bars for
 * Actions, AI and Reports literally add up to the number above them (REQ-2.5) —
 * they are the number, drawn. That is a thing a reader can check, and it is why
 * the curve failed: an area under a normalised curve adds up to nothing.
 *
 * Active users is the exception, and it says so on its own face (REQ-2.6): one
 * person working three days is 1 active user but 3 bars. The tile that cannot
 * honour the sum rule is the one tile that admits it.
 *
 * The ⓘ stays, because "what counts and what doesn't" is the one piece of
 * supporting text that turns a number from a mystery into a fact.
 */

import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowUpRight, Info } from 'lucide-react';
import { KpiCountUp } from '../shared/KpiTile';
import type { Stat } from '../admin/adminTokens';
import { TrendBars } from './usageChrome';
import { CARD_BASE, KH_EASE, fmt } from './usageTokens';

/** Below this, a percentage change is noise — say it in whole units instead. */
const SMALL_BASE = 30;

export interface UsageStat extends Stat {
  /** What the metric counts — "actions", "reports". Used in the change sentence. */
  unit?: string;
  /** The raw current value, for the change sentence. */
  current: number;
  /** The same metric in the previous window, for the change sentence. */
  prior: number;
  /** The denominator, printed under the value: "of 17 licensed". */
  of?: string;
  /** What counts toward this metric. Required — it is the ⓘ's whole job. */
  counts: string;
  /** What does NOT count. The line that stops the number being a mystery. */
  excludes?: string;
  /** One value per day in the window, oldest first. Drawn as bars under the number. */
  series?: number[];
  /**
   * Whether the bars sum to the headline (REQ-2.5). True for Actions, AI and
   * Reports. FALSE for Active users, where a person active on three days is one
   * user and three bars — and the tile prints that caveat rather than quietly
   * showing a mark that does not reconcile (REQ-2.6).
   */
  additive?: boolean;
}

/**
 * The trend, drawn as bars from a zero baseline.
 *
 * Scaled to the series' own maximum, which is the same normalisation the old
 * sparkline used — but a bar carries its own baseline, so a reader is never
 * invited to compare the HEIGHT across tiles the way a curve's slope invites.
 * The bars answer one question, the one they can answer honestly: how was this
 * number distributed across the days that made it.
 */
/* The mark itself lives in `usageChrome` as `TrendBars`, because the twelve area
   cards draw it too — and the whole point of the argument above is that the page
   should not hold two opinions about how to draw a distribution. */

/**
 * The change, said the way a person would say it — and split in two, because it
 * is two facts: the movement (which wants to be seen) and the baseline it moved
 * from (which only wants to be available).
 *
 * `chip` is the movement: "Up 8%", "Down 2 reports". `from` is the baseline:
 * "from 487". They used to be one flat grey sentence, so the one number on the
 * card that says whether things are getting better or worse was set in the same
 * weight as the footnote naming what it was measured against.
 */
function changeSentence(stat: UsageStat, compareLabel: string) {
  const { current, prior } = stat;
  if (prior === 0 && current === 0) {
    return { chip: 'None in either period', from: '', tone: 'flat' as const };
  }
  if (prior === 0) return { chip: 'New', from: `none in the ${compareLabel}`, tone: 'up' as const };

  const diff = current - prior;
  const tone = diff > 0 ? ('up' as const) : diff < 0 ? ('down' as const) : ('flat' as const);
  if (diff === 0) return { chip: 'No change', from: `same as the ${compareLabel}`, tone };

  const noun = stat.unit ?? '';
  const n = Math.abs(diff);
  const from = `from ${prior.toLocaleString('en-US')}`;
  // Small base → say it in whole units. A percentage of twelve people is a lie.
  if (Math.max(current, prior) < SMALL_BASE) {
    return {
      chip: `${diff > 0 ? 'Up' : 'Down'} ${n} ${n === 1 ? noun.replace(/s$/, '') : noun}`,
      from,
      tone,
    };
  }
  const pct = Math.round((diff / prior) * 100);
  return { chip: `${pct > 0 ? 'Up' : 'Down'} ${Math.abs(pct)}%`, from, tone };
}

function UsageKpiCell({ stat, index, compareLabel }: {
  stat: UsageStat; index: number; compareLabel: string;
}) {
  const prefersReduced = useReducedMotion();
  const [defOpen, setDefOpen] = useState(false);
  const change = changeSentence(stat, compareLabel);
  /* The chip is the only place on this card that carries a hue, so the hue has
     to mean one thing: direction. It is backed by a tint of its own tone rather
     than left as coloured text on white — a bare green word beside a black
     number reads as a typo; a chip reads as a measurement. The arrow carries the
     direction too, for the readers who cannot rely on red against green. */
  const chipTone =
    change.tone === 'up'
      ? 'text-compliant-700 bg-compliant-700/[0.08]'
      : change.tone === 'down'
        ? 'text-risk-700 bg-risk-700/[0.08]'
        : 'text-ink-500 bg-ink-900/[0.05]';

  return (
    <motion.div
      aria-label={`${stat.label}: ${stat.value}${stat.of ? ` ${stat.of}` : ''}. ${change.chip} ${change.from} in the ${compareLabel}.`}
      initial={prefersReduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={prefersReduced ? { duration: 0 } : { duration: 0.3, delay: Math.min(index, 8) * 0.04, ease: KH_EASE }}
      className={`${CARD_BASE} relative p-4 min-w-0 hover:border-brand-200`}
    >
      <div className="flex items-center gap-2">
        {/* 11px — DESIGN.md's "Uppercase eyebrow / KPI label" rank. */}
        <h3 className="text-[0.6875rem] font-semibold text-ink-500 uppercase tracking-wide truncate flex-1">
          {stat.label}
        </h3>
        <button
          type="button"
          onMouseEnter={() => setDefOpen(true)}
          onMouseLeave={() => setDefOpen(false)}
          onFocus={() => setDefOpen(true)}
          onBlur={() => setDefOpen(false)}
          onClick={() => setDefOpen(o => !o)}
          aria-label={`What counts as ${stat.label}`}
          className="shrink-0 text-ink-300 hover:text-brand-600 transition-colors cursor-help"
        >
          <Info size={14} />
        </button>
        {defOpen && (
          <div className="absolute right-4 top-10 z-30 w-64 rounded-lg border border-canvas-border bg-canvas-elevated p-3 shadow-[0_8px_24px_-6px_rgba(15,7,32,0.14)]">
            <p className="text-[0.75rem] text-ink-700 leading-relaxed">
              <span className="font-semibold text-ink-900">Counts:</span> {stat.counts}
            </p>
            {stat.excludes && (
              <p className="mt-1.5 text-[0.75rem] text-ink-500 leading-relaxed">
                <span className="font-semibold text-ink-700">Doesn't count:</span> {stat.excludes}
              </p>
            )}
          </div>
        )}
      </div>

      {/* 28px — DESIGN.md's KPI value rank, not the 36px display rank the spec
          reserves for a page's one hero. This band has three of them, and three
          heroes is no hero; the hero is the gauge above.

          Proportional figures, not tabular: at this size `tabular-nums` gives
          every digit the width of a zero and a number like "525" comes out
          visibly loose. Tabular is for columns that have to align down a table,
          which this is not. */}
      <div className="mt-3 text-[1.75rem] font-semibold leading-none tracking-[-0.025em] text-ink-900">
        <KpiCountUp value={String(stat.value)} delay={120 + index * 70} />
      </div>
      {/* Reserved, so the change line lands on the same baseline in all cells
          whether or not the metric has a denominator to print. */}
      <p className="mt-2 h-5 text-[0.8125rem] text-ink-500 truncate">{stat.of ?? ''}</p>

      {/* Wraps, never truncates. Four tiles in a 1,280px window are ~200px wide,
          and "Down 2 people from 14" does not fit on one line there — it came out
          as "Down 2 people f…", which cuts off the baseline and leaves the chip
          asserting a change against nothing. The baseline is the half of this
          line that makes the other half mean anything; it drops to a second row
          rather than be clipped. */}
      <p className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
        <span className={`shrink-0 inline-flex items-center gap-1 h-[1.375rem] px-2 rounded-full text-[0.75rem] font-semibold ${chipTone}`}>
          {change.tone !== 'flat' && (
            <ArrowUpRight
              size={12}
              strokeWidth={2.5}
              className={change.tone === 'up' ? '' : 'rotate-90'}
              aria-hidden
            />
          )}
          {change.chip}
        </span>
        {change.from && <span className="text-[0.75rem] text-ink-400">{change.from}</span>}
      </p>

      {stat.series && stat.series.length > 1 && (
        <>
          {/* The shared mark, in a wrapper that owns the spacing — the component
              itself must stay layout-neutral, because the twelve area cards drop
              it into a 64px slot with no top margin at all. */}
          <div className="mt-3">
            <TrendBars
              series={stat.series}
              additive={stat.additive ?? true}
              total={stat.current}
              delay={0.2 + index * 0.05}
            />
          </div>
          {/* REQ-2.6. The one tile whose bars do not reconcile with its headline
              is the one tile that has to say so, on its face, not in a tooltip
              nobody opens. Every other tile stays silent, and its silence is the
              claim: these bars ARE the number.

              The wording matters. It used to read "Days don't add up", which
              sounds like the page apologising for a broken chart. The bars are
              correct. What they count is people-per-day, and a person who works
              on three days is counted on all three. Say that instead. */}
          <p className="mt-1.5 text-[0.625rem] text-ink-400 leading-snug">
            {stat.additive === false
              ? 'One bar per day. Somebody active on three days appears on all three'
              : `The ${stat.series.length} days behind the number, adding up to ${fmt(stat.current)}`}
          </p>
        </>
      )}
    </motion.div>
  );
}

export default function UsageKpiRow({ stats, rangeDays, asOf, endsAtAnchor = true }: {
  stats: UsageStat[];
  rangeDays: number;
  asOf?: string;
  endsAtAnchor?: boolean;
}) {
  const compareLabel = `previous ${rangeDays} ${rangeDays === 1 ? 'day' : 'days'}`;
  return (
    <div>
      {/* Separate cards, not one card with hairlines through it. Every KPI band
          on the platform — Admin, Dashboards, Engagement Library — is a gap grid
          of separate bordered cards; a single divided slab is this page's own
          invention and reads as a table, which is the one thing a headline band
          must not do.

          The column count follows the tile count, so dropping a tile closes the
          row instead of leaving a hole in it. */}
      <div className={`grid grid-cols-2 gap-4 ${stats.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4'}`}>
        {stats.map((s, i) => (
          <UsageKpiCell key={s.key} stat={s} index={i} compareLabel={compareLabel} />
        ))}
      </div>
      <p className="mt-3 text-[0.75rem] text-ink-400">
        {asOf
          ? endsAtAnchor
            ? `The ${rangeDays} days up to ${asOf}. Each change is against the ${rangeDays} days before that.`
            : `The ${rangeDays} days ending ${asOf}. Each change is against the ${rangeDays} days before that.`
          : `Each change is against the previous ${rangeDays} days.`}
      </p>
    </div>
  );
}
