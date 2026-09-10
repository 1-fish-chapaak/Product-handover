/**
 * A person against the platform, as a chart.
 *
 * This is the comparison a renewal conversation actually turns on: what this
 * work gave back in auditor time, and what it cost the platform to do it
 * instead. Two figures, one unit, one division.
 *
 * **The bill is a single number here, deliberately.** An earlier draft split
 * the platform's side into registry lookups against AI, and that split became
 * the longest thing on the section. A reader deciding whether the platform is
 * worth paying for is weighing a person against the platform, not one part of
 * the bill against another. Where the money went is behind the information
 * icon.
 *
 * **Two bars on one scale, not one bar of two parts.** An earlier form drew
 * the pair as a single 100% bar, which reads as a share of a total. The two
 * figures do not add up to anything: auditor time given back plus the
 * platform's bill is not a quantity anybody spends. On a shared scale the
 * widths answer the question the section asks, which is how the two sizes
 * compare, and the shortfall on the cost bar is the money left over. A floor
 * keeps a small cost from vanishing, and each figure sits on the row above its
 * bar rather than inside it, where a short bar would clip it.
 *
 * **The picture carries it, not prose.** Three paragraphs of definition used to
 * sit under the bars, saying in words what the bars already say. They are the
 * information panel's job and that is where they live now. What is left on the
 * face is the ratio, two named bars, and the gap.
 *
 * Colour is the platform's brand / evidence pair, validated as a categorical
 * set (ΔE 12.8 deutan, 19.1 tritan, 23.2 normal; both above 3:1 on this card),
 * and each bar carries its own name, so identity never rests on colour alone.
 */

import { motion, useReducedMotion } from 'motion/react';

const AUDITOR_COLOR = 'var(--color-brand-600)';
const PLATFORM_COLOR = 'var(--color-evidence-600)';

/** Below this a bar reads as absent rather than small. */
const MIN_PCT = 2.5;

function Bar({
  name,
  amount,
  pct,
  color,
  format,
  delay,
  trail,
}: {
  name: string;
  amount: number;
  pct: number;
  color: string;
  format: (n: number) => string;
  delay: number;
  /** A note hung off the empty end of the bar, which is where the gap is. */
  trail?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <div role="listitem">
      <div className="flex items-baseline justify-between gap-4">
        <p className="flex min-w-0 items-center gap-2 text-[0.75rem] text-ink-500">
          <span
            aria-hidden
            className="h-2 w-2 shrink-0 rounded-xs"
            style={{ backgroundColor: color }}
          />
          <span className="truncate">{name}</span>
        </p>
        <p className="shrink-0 text-[0.875rem] font-semibold tabular-nums text-ink-900">
          {format(amount)}
        </p>
      </div>
      <div className="mt-1.5 h-3.5 w-full overflow-hidden rounded-xs bg-canvas-border/40">
        <motion.span
          className="block h-full rounded-xs"
          style={{ backgroundColor: color }}
          initial={reduced ? false : { width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={reduced ? { duration: 0 } : { duration: 0.5, ease: [0.22, 1, 0.36, 1], delay }}
        />
      </div>
      {trail ? (
        <div className="flex">
          <span aria-hidden style={{ width: `${pct}%` }} />
          <span className="flex-1 pt-1 text-right text-[0.75rem] text-ink-500">{trail}</span>
        </div>
      ) : null}
    </div>
  );
}

export default function CostSplitBar({
  gaveBack,
  total,
  perRupee,
  leftOver,
  ratioNote,
  format,
}: {
  /** Auditor time given back, priced. The person's side. */
  gaveBack: number;
  /** What the platform cost to do the same work. One number, never split. */
  total: number;
  /** What each rupee spent gave back. */
  perRupee: number | null;
  /** What was left after the bill. Passed in rather than subtracted here, so
   *  the gap named on the chart is the same rupee as the tile above. */
  leftOver: number | null;
  /** The information panel for the ratio, which is the headline here rather
   *  than a row of its own under the chart. */
  ratioNote?: React.ReactNode;
  format: (n: number) => string;
}) {
  /* One scale for both bars: the larger figure fills the width, the other is
     drawn against it. That is the only reading that makes the widths mean
     anything. */
  const scale = Math.max(gaveBack, total);
  const width = (n: number) => (scale > 0 ? Math.max(MIN_PCT, (n / scale) * 100) : MIN_PCT);
  const costPct = width(total);
  /* The gap is only a gap when the cost bar is the shorter one, and it is only
     labelled where there is room at its end for the words. */
  const gap =
    leftOver != null && leftOver > 0 && costPct < 70
      ? `${format(Math.floor(leftOver))} left after running costs`
      : undefined;

  return (
    <div className="px-5 py-4">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <p className="text-[1.25rem] font-bold leading-none tracking-tight tabular-nums text-ink-900">
          {perRupee != null ? `₹${perRupee.toFixed(2)}` : 'Nothing priced'}
        </p>
        <p className="text-[0.75rem] text-ink-500">
          {perRupee != null
            ? 'of auditor time back for every ₹1 spent running this work'
            : 'nothing in view has both a timing and a bill'}
        </p>
        {ratioNote}
      </div>

      <div
        className="mt-4 space-y-3.5"
        role="list"
        aria-label={`Auditor time it gave back ${format(gaveBack)}. What the platform cost to do it ${format(total)}. Both on the same scale.`}
      >
        <Bar
          name="Auditor time it gave back"
          amount={gaveBack}
          pct={width(gaveBack)}
          color={AUDITOR_COLOR}
          format={format}
          delay={0.05}
        />
        <Bar
          name="What the platform cost to do it"
          amount={total}
          pct={costPct}
          color={PLATFORM_COLOR}
          format={format}
          delay={0.13}
          trail={gap}
        />
      </div>
    </div>
  );
}
