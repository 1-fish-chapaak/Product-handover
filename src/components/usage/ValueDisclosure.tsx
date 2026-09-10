/**
 * A named, foldable block inside a Platform Value section.
 *
 * "Where the time came from" carried two tables stacked straight on top of each
 * other. The second one's header row sat directly under the first one's last
 * data row and read as one more row of the same table, so the reader met a
 * header called "How big the activity was" where they expected another kind of
 * work. Nothing on the page said the two were different cuts of the same hours.
 *
 * So each cut gets a name of its own, and the name is the control that folds it
 * away. That does two jobs at once: the break between the tables becomes
 * obvious, and a reader who only wants one of the cuts can shut the other. The
 * count on the right says what is inside a block before it is opened, so
 * folding one away does not hide how much was in it.
 *
 * The tables open by default because the figures are the section. Long prose
 * that qualifies them starts closed, since a caveat is something a reader goes
 * looking for rather than something they should have to scroll past.
 */

import { useId, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ChevronDown } from 'lucide-react';

export default function ValueDisclosure({
  title,
  meta,
  defaultOpen = true,
  children,
}: {
  title: string;
  /** What is inside, said before it is opened. */
  meta?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const reduced = useReducedMotion();
  const id = useId();

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls={id}
        className="flex w-full items-center gap-2 px-5 py-2.5 text-left transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
      >
        <ChevronDown
          size={14}
          aria-hidden
          className={`shrink-0 text-ink-400 transition-transform duration-150 ${open ? '' : '-rotate-90'}`}
        />
        <span className="text-[0.75rem] font-semibold text-ink-700">{title}</span>
        {meta ? <span className="ml-auto text-[0.75rem] text-ink-400">{meta}</span> : null}
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={id}
            key="body"
            initial={reduced ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={reduced ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
