/**
 * A headline figure.
 *
 * One number, one label, one information icon, and nothing else on the face. No
 * sparkline, no delta chip, no colour that means anything: a tile that argues
 * on its face is a tile a reader stops trusting the moment one of the arguments
 * is wrong. The argument lives behind the icon, where it can be read in full or
 * ignored.
 *
 * The chrome is the platform's own KPI card (DESIGN §7.10.2 / §7.11.2, the
 * `AdminKpiCard` this page's neighbour Usage and cost already wears): a
 * `brand-50` icon chip at 28px, the figure at 18px bold in tabular numerals,
 * the label under it at 12px, on a `rounded-lg` hairline card, arriving on the
 * admin spring cascade at an absolute delay. It was a bespoke tile before, a
 * step larger and with no glyph, so the same band read as two different
 * components one tab apart.
 *
 * Value over label rather than the admin card's baseline pair, because these
 * figures are sentences ("Minimum 223.6 hours") and not counts, and four of
 * them beside each other have no room to sit on one line.
 *
 * The qualifier ("Minimum") is set small and quiet in front of the figure
 * rather than bolded into it. Three tiles in a row opened with the same bold
 * words, so the words a reader was meant to scan were the ones every tile
 * shared, and the numbers had to fight them. It stays welded to the number
 * rather than moving onto the label, because it qualifies the figure and a
 * figure that quietly drops its floor is a figure that is being overstated.
 */

import { motion, useReducedMotion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';
import ValueNote, { type Note } from './ValueNote';

export interface ValueTileProps {
  label: string;
  value: string;
  /** A word or two in front of the figure that says what kind of figure it is,
   *  such as a floor. Quiet, so the number reads first. */
  qualifier?: string;
  note: Note;
  icon?: LucideIcon;
  index?: number;
}

export default function ValueTile({
  label,
  value,
  qualifier,
  note,
  icon: Icon,
  index = 0,
}: ValueTileProps) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={
        reduced
          ? { duration: 0 }
          : { type: 'spring', stiffness: 320, damping: 18, mass: 0.7, delay: 0.08 + index * 0.08 }
      }
      className="flex h-full items-start gap-2.5 rounded-lg border border-canvas-border bg-canvas-elevated px-3.5 py-3"
    >
      {Icon ? (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
          <Icon size={14} strokeWidth={2} />
        </div>
      ) : null}
      {/* The label is pushed to the bottom of the card rather than sitting a
          fixed gap under the figure. A figure is a sentence here, and at a
          narrow window one of the four wraps to two lines: on a fixed gap the
          four labels then sit at four different heights across one band. */}
      <div className="flex h-full min-w-0 flex-1 flex-col">
        <p className="text-[1.125rem] font-bold leading-[1.2] tracking-tight text-ink-900 tabular-nums">
          {qualifier ? (
            <span className="mr-1 text-[0.75rem] font-normal tracking-normal text-ink-400">
              {qualifier}
            </span>
          ) : null}
          {value}
        </p>
        <p className="mt-auto pt-1.5 text-[0.75rem] leading-tight text-ink-500">{label}</p>
      </div>
      <ValueNote title={label} note={note} />
    </motion.div>
  );
}
