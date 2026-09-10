/**
 * The information icon, and what has to be behind it.
 *
 * Every figure on Platform Value is an argument somebody is going to attack, so
 * the face of a tile carries a number and a label and nothing else, and the
 * whole defence sits one click away. Four things, without exception:
 *
 * · **What it counts** — the population, in a sentence.
 * · **How it is worked out** — the arithmetic with THIS scope's real numbers
 *   substituted, not a formula with letters in it.
 * · **The inputs** — each one with who set it and when, because a rate whose
 *   author cannot be named is a rate a CFO is right to throw out.
 * · **What it leaves out** — named. A floor that does not say what is missing
 *   is just a total that happens to be wrong.
 *
 * A tile without all four is not shippable, so the note type makes all four
 * required fields rather than optional ones.
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Info } from 'lucide-react';

export interface NoteInput {
  label: string;
  value: string;
  /** Who set it, and the day they set it, CAPTURED from the session and the
   *  clock rather than typed. `null` means nobody set it: the value is a
   *  seeded example, and the panel says so instead of quietly dropping the
   *  line. A provenance line that goes missing reads as a figure with nothing
   *  behind it; one naming a person who set nothing is worse. */
  setBy?: string | null;
  setOn?: string | null;
  source?: string;
}

/** A line of working. `{ heading }` groups the lines under it, for a note whose
 *  working is a rule stated once per kind of work rather than one sum. */
export type WorkingLine = string | { heading: string };

export interface Note {
  counts: string;
  /** One line per step, in the order the arithmetic runs. */
  working: WorkingLine[];
  inputs: NoteInput[];
  /** Everything the figure does not include. Never empty: if a figure truly
   *  leaves nothing out, say that in a line. */
  omits: string[];
}

/** Kept in step with the `w-[23rem]` on the panel below. */
const PANEL_WIDTH = 368;
/** Breathing room between the panel and the edge that would clip it. */
const GUTTER = 12;

const SECTION = 'text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-400';

interface Placement {
  /** Viewport coordinates. The panel is FIXED, not absolute. */
  top: number;
  left: number;
  /** The tallest it may be and still sit inside the viewport. */
  maxHeight: number;
}

/** How tall the panel is allowed to get before it starts scrolling inside
 *  itself. Taller than a comfortable read, deliberately: the inputs list and
 *  the leaves-out list are the half of the note that survives a challenge, and
 *  they were the half nobody could reach. */
const TALLEST = 640;

export default function ValueNote({ title, note }: { title: string; note: Note }) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<Placement>({ top: 0, left: 0, maxHeight: TALLEST });
  const ref = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  /* Where the panel goes.
   *
   * It is FIXED and rendered in a portal rather than absolutely positioned
   * inside the tile, for two reasons that were both real on a laptop. Inside
   * the tile it could only ever be as tall as the gap between the icon and the
   * bottom of the scrolling column, which was 586px against 978px of content.
   * And because it sat inside the scrolling content, any wheel that chained
   * through to the page dragged the panel up out of view with it, which reads
   * as the panel dismissing itself.
   *
   * Fixed to the viewport it gets the full height of the window to work with,
   * and it is pulled upwards rather than clipped when it will not fit below
   * the icon. */
  const toggle = () => {
    if (!open && ref.current) {
      const t = ref.current.getBoundingClientRect();
      const height = Math.min(TALLEST, window.innerHeight - GUTTER * 2);

      // Sideways it is clamped to the reading column, not the window, so it
      // never floats out over the nav rail. Up and down it is clamped to the
      // window, because the extra height is the whole point of it being fixed.
      const column = ref.current.closest('.overflow-y-auto')?.getBoundingClientRect();
      const leftEdge = (column?.left ?? 0) + GUTTER;
      const rightEdge = (column?.right ?? window.innerWidth) - GUTTER;

      // Hang leftwards from the icon, which sits at the right edge of whatever
      // it annotates. Flip first, then clamp.
      let left = t.right - PANEL_WIDTH;
      if (left < leftEdge) left = t.left;
      left = Math.min(Math.max(leftEdge, left), rightEdge - PANEL_WIDTH);

      let top = t.bottom + 8;
      if (top + height > window.innerHeight - GUTTER) {
        top = Math.max(GUTTER, window.innerHeight - GUTTER - height);
      }
      setPlace({ top, left, maxHeight: height });
    }
    setOpen(v => !v);
  };

  /* A wheel inside the panel scrolls the panel and nothing else.
   *
   * `overscroll-behavior: contain` stops the chain in the middle of a scroll
   * but not the overshoot at either end, and one overshoot scrolls the page
   * under a panel the reader is halfway through. The listener has to be
   * non-passive to cancel that, which React's onWheel cannot be. */
  useEffect(() => {
    const el = panel.current;
    if (!open || !el) return;
    const onWheel = (e: WheelEvent) => {
      const atTop = el.scrollTop <= 0;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
      if ((e.deltaY < 0 && atTop) || (e.deltaY > 0 && atBottom)) e.preventDefault();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [open]);

  /* Scrolling the page BEHIND the panel closes it. A fixed panel would
   *  otherwise hang over an anchor that has moved out from under it. Scrolling
   *  inside the panel never reaches here, because of the guard above. */
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const column = ref.current?.closest('.overflow-y-auto');
    column?.addEventListener('scroll', close, { passive: true });
    window.addEventListener('resize', close);
    return () => {
      column?.removeEventListener('scroll', close);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  // Click anywhere else, or press Escape, and it closes. A panel that only
  // closes by clicking the icon again is one a reader leaves open over the
  // figure they were trying to read.
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || panel.current?.contains(t)) return;
      setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', down);
      document.removeEventListener('keydown', key);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={`How ${title} is worked out`}
        aria-expanded={open}
        onClick={toggle}
        className={`flex h-5 w-5 cursor-pointer items-center justify-center rounded-full transition-colors ${
          open ? 'bg-brand-50 text-brand-700' : 'text-ink-300 hover:bg-paper-50 hover:text-ink-600'
        }`}
      >
        <Info size={13} strokeWidth={2} />
      </button>

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={panel}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.14, ease: [0.2, 0, 0, 1] }}
              style={{ top: place.top, left: place.left, maxHeight: place.maxHeight }}
              className="fixed z-50 w-[23rem] overflow-y-auto overscroll-contain rounded-lg border border-canvas-border bg-canvas-elevated p-4 text-left shadow-[0_18px_44px_-20px_rgba(15,8,30,0.35)]"
            >
              <p className="text-[0.875rem] font-semibold text-ink-900">{title}</p>

              <p className="mt-2 text-[0.75rem] leading-relaxed text-ink-600">{note.counts}</p>

              <p className={`${SECTION} mt-4`}>How it is worked out</p>
              <div className="mt-1.5 space-y-1">
                {/* Keyed by position, not by text: a rule that reads the same
                    for three kinds of work ("Small: anything under that.")
                    repeats on purpose. */}
                {note.working.map((line, i) =>
                  typeof line === 'string' ? (
                    <p
                      key={`${i}-${line}`}
                      className="text-[0.75rem] leading-relaxed text-ink-700 tabular-nums"
                    >
                      {line}
                    </p>
                  ) : (
                    <p
                      key={`${i}-${line.heading}`}
                      className="pt-1.5 text-[0.75rem] font-semibold leading-relaxed text-ink-900"
                    >
                      {line.heading}
                    </p>
                  ),
                )}
              </div>

              <p className={`${SECTION} mt-4`}>Inputs</p>
              <dl className="mt-1.5 space-y-2">
                {note.inputs.map(i => (
                  <div key={i.label}>
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-[0.75rem] text-ink-600">{i.label}</dt>
                      <dd className="text-[0.75rem] font-medium text-ink-900 tabular-nums">
                        {i.value}
                      </dd>
                    </div>
                    {(i.setBy || i.source || i.setBy === null) && (
                      <p className="text-[0.6875rem] leading-relaxed text-ink-400">
                        {i.setBy
                          ? `Set by ${i.setBy}`
                          : i.setBy === null
                            ? 'An example. Nobody has entered this one'
                            : ''}
                        {i.setBy && i.setOn ? ` on ${i.setOn}` : ''}
                        {(i.setBy || i.setBy === null) && i.source ? '. ' : ''}
                        {i.source ?? ''}
                      </p>
                    )}
                  </div>
                ))}
              </dl>

              <p className={`${SECTION} mt-4`}>What it leaves out</p>
              <ul className="mt-1.5 space-y-1">
                {note.omits.map((o, i) => (
                  <li key={`${i}-${o}`} className="text-[0.75rem] leading-relaxed text-ink-600">
                    {o}
                  </li>
                ))}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}
