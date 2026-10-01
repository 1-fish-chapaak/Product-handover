/**
 * RACM — the team's matrices, and the shape they are expected to arrive in.
 *
 * Moved out of the Engagements page (18 Sep). It lived there as a tab because
 * that is where it was built, but a RACM is not an engagement: it outlives
 * every engagement scoped from it, it is written and published before any
 * engagement exists, and people come here to maintain the library rather than
 * to look at a portfolio. So it sits beside Risk Register and Control Library
 * in the sidebar, with the other two things an auditor keeps rather than runs.
 *
 * Config travels with it. It decides what shape a RACM is — which columns a row
 * cannot arrive without, which of the client's own columns to keep — and a
 * setting is only findable next to the thing it governs.
 */
import { useState } from 'react';
// `motion/react`, not `framer-motion` — the latter is only in node_modules as a
// transitive dep of `motion` and is not declared in package.json, so an import
// of it works today by luck. Every other file in the repo imports from here.
import { motion } from 'motion/react';
import { Plus } from 'lucide-react';
import FloatingLines from '../shared/FloatingLines';
import RacmLibraryView from './RacmLibraryView';
// PARKED (1 Oct, user ask) — the Config tab. `RacmConfigView` is untouched and
// still holds the per-client-group column set-up; nothing else opens it, so that
// screen is unreachable while this is off. Restore by un-commenting the import,
// the tab row entry and the render below:
// import RacmConfigView from './RacmConfigView';

// PARKED with the row — type RacmTab = 'library' | 'config';

export default function RacmPage({ canManage }: {
  /** Create, publish and delete — the same permission that creates engagements. */
  canManage: boolean;
}) {
  /**
   * Create RACM sits in the header (user ask, 1 Oct), so the flag it opens
   * lives up here with it. The wizard itself stays down in the library view:
   * finishing one clears that view's search and filter so the new matrix is
   * actually on screen when the toast names it, and that is the library's
   * state to clear, not this page's.
   */
  const [creating, setCreating] = useState(false);

  /* PARKED (1 Oct, user ask) — the whole tab row. With Config gone there was
     one screen left, and a tablist of one is a control that cannot do anything:
     it names where you already are. The page now renders the library directly.
     Restore this, the `RacmTab` type, the `tab`/`setTab` state, the `Table2`
     and `SlidersHorizontal` imports and the row's own motion block in the
     header the day a second screen earns its place here.

  const [tab, setTab] = useState<RacmTab>('library');
  const tabs: { id: RacmTab; label: string; Icon: typeof Table2 }[] = [
    { id: 'library', label: 'Library', Icon: Table2 },
    { id: 'config', label: 'Config', Icon: SlidersHorizontal },
  ];
  */

  return (
    /* THE HEADER IS PINNED (user ask, 29 Sep) — Knowledge Hub's layout, not
       just its look. The page is a column that does not scroll; the header
       block is `shrink-0` and the list below it owns the only scrollbar, so
       the title and Create RACM stay put however far down the library you
       are. Before this the whole page scrolled as one and the header was the
       first thing to go.
       The shell's <main> is overflow-hidden, so something here must own a
       scroll or everything past the fold is simply lost.
       `bg-canvas` under a `bg-canvas-elevated` strip is what makes the header
       read as its own surface — the same pairing Knowledge Hub uses. Without
       it the strip is white on white and the border-b carries the whole job. */
    <div className="h-full flex flex-col overflow-hidden bg-canvas">
      <div className="px-9 pt-8 shrink-0">
        {/* KNOWLEDGE HUB'S HEADER, TO THE LETTER (user ask, 29 Sep: "the header
            format of knowledge hub ko copy karo for racm library").
            The title sits in ONE full-bleed elevated strip that reaches past
            this page's px-9 / pt-8 inset with matching negative margins. Its
            border-b used to be the track the active tab's indicator sat on;
            with the row parked it simply closes the strip.
            The eyebrow is gone with it: Knowledge Hub has none, and "Risk and
            controls" only ever repeated the sidebar section the reader clicked. */}
        <div className="bg-canvas-elevated -mx-9 px-9 -mt-8 pt-8 border-b border-canvas-border relative overflow-hidden">
          {/* Top and bottom waves only — nothing behind the H1, and low enough
              to read as texture rather than a second thing to look at. */}
          <FloatingLines
            enabledWaves={['top', 'bottom']}
            lineCount={3}
            lineDistance={10}
            bendRadius={5}
            bendStrength={-0.3}
            interactive
            parallax
            color="#6a12cd"
            opacity={0.05}
          />
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="mb-8"
          >
            {/* Create RACM sits up here now that the tab row is gone (user ask,
                1 Oct). It was on the tabs' baseline because that row existed;
                with one screen left, the page's one primary action belongs
                against the title it acts on. `items-start` keeps it off the
                subhead's baseline, which moves as the line wraps. */}
            <div className="flex items-start justify-between gap-6">
              <div className="min-w-0">
                <h1 className="text-[2.125rem] font-semibold tracking-tight text-ink-900 leading-[1.15]">
                  RACM Library
                </h1>
                {/* No max-width (user ask, 29 Sep) — Knowledge Hub's subhead is
                    short enough that `max-w-2xl` never bites; this one wrapped
                    mid-sentence at every window width, which the strip is wide
                    enough not to need. */}
                <p className="mt-2 text-[0.9375rem] text-ink-500 leading-relaxed">
                  Every risk-and-control matrix this team keeps. Engagements scope from what is published here.
                </p>
              </div>
              {canManage && (
                <button onClick={() => setCreating(true)}
                  title="Create a RACM — import a matrix, or extract one from an SOP"
                  className="shrink-0 mt-1.5 flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[0.8125rem] font-semibold transition-colors cursor-pointer">
                  <Plus size={14} />Create RACM
                </button>
              )}
            </div>
          </motion.div>

        </div>
      </div>

      {/* The one scroll region on the page. Its own top padding replaces the
          margin the strip used to carry. */}
      <div className="flex-1 min-h-0 overflow-y-auto px-9 pt-6 pb-8">
        <RacmLibraryView canManage={canManage} creating={creating} setCreating={setCreating} />
        {/* PARKED — <RacmConfigView canManage={canManage} /> */}
      </div>
    </div>
  );
}
