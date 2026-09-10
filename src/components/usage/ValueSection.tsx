/**
 * One section of Platform Value.
 *
 * The title used to sit outside the card, at 14px, above a slab of hairline
 * rows. Ten of those down a page and nothing said which words belonged to
 * which slab: the heading floated between the card above it and the card
 * below, and every section on the page weighed exactly the same.
 *
 * So the header moved inside, which is how a titled section is built
 * everywhere else on the platform (`audit/SectionCard`, the report reader's
 * sections): one hairline card, a header bar with the title and the line that
 * qualifies it, then the body under a divider. The card is now one object.
 *
 * The blurb is capped at a measure. Left to run the full width of the page it
 * was a 12px line 190 characters long, which is not a line anybody reads.
 *
 * Padding is `px-5` throughout, matching `SmartTable`'s `modern` cells, so the
 * first column of a table lines up with the heading above it.
 */

import { motion, useReducedMotion } from 'motion/react';

export default function ValueSection({
  title,
  blurb,
  note,
  children,
}: {
  title: string;
  blurb: string;
  /** An information panel for the section as a whole, beside the title. Used
   *  where the section's figures live in prose rather than in a table with
   *  its own header cell to hang one off. */
  note?: React.ReactNode;
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.section
      initial={reduced ? false : { opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={reduced ? { duration: 0 } : { duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden rounded-lg border border-canvas-border bg-canvas-elevated"
    >
      <div className="border-b border-canvas-border px-5 py-3.5">
        <div className="flex items-center gap-1.5">
          <h2 className="text-[0.875rem] font-semibold text-ink-900">{title}</h2>
          {note}
        </div>
        <p className="mt-1 max-w-[78ch] text-[0.75rem] leading-relaxed text-ink-500">{blurb}</p>
      </div>
      <div className="divide-y divide-canvas-border">{children}</div>
    </motion.section>
  );
}
