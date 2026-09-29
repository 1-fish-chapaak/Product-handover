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
import { Plus, SlidersHorizontal, Table2 } from 'lucide-react';
import FloatingLines from '../shared/FloatingLines';
import RacmLibraryView from './RacmLibraryView';
import RacmConfigView from './RacmConfigView';

type RacmTab = 'library' | 'config';

export default function RacmPage({ canManage }: {
  /** Create, publish and delete — the same permission that creates engagements. */
  canManage: boolean;
}) {
  const [tab, setTab] = useState<RacmTab>('library');
  /**
   * Create RACM sits on the tab row (user ask, 29 Sep), so the flag it opens
   * lives up here with it. The wizard itself stays down in the library view:
   * finishing one clears that view's search and filter so the new matrix is
   * actually on screen when the toast names it, and that is the library's
   * state to clear, not this page's.
   */
  const [creating, setCreating] = useState(false);

  const tabs: { id: RacmTab; label: string; Icon: typeof Table2 }[] = [
    { id: 'library', label: 'Library', Icon: Table2 },
    { id: 'config', label: 'Config', Icon: SlidersHorizontal },
  ];

  return (
    /* THE HEADER IS PINNED (user ask, 29 Sep) — Knowledge Hub's layout, not
       just its look. The page is a column that does not scroll; the header
       block is `shrink-0` and the list below it owns the only scrollbar, so
       the title, the tabs and Create RACM stay put however far down the
       library you are. Before this the whole page scrolled as one and the
       header was the first thing to go.
       The shell's <main> is overflow-hidden, so something here must own a
       scroll or everything past the fold is simply lost.
       `bg-canvas` under a `bg-canvas-elevated` strip is what makes the header
       read as its own surface — the same pairing Knowledge Hub uses. Without
       it the strip is white on white and the border-b carries the whole job. */
    <div className="h-full flex flex-col overflow-hidden bg-canvas">
      <div className="px-9 pt-8 shrink-0">
        {/* KNOWLEDGE HUB'S HEADER, TO THE LETTER (user ask, 29 Sep: "the header
            format of knowledge hub ko copy karo for racm library").
            Title and tabs share ONE full-bleed elevated strip whose border-b is
            also the track the active tab's indicator sits on — the reason the
            tabs carry no border of their own. The strip reaches past this page's
            px-9 / pt-8 inset with matching negative margins.
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
            className="mb-6"
          >
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
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="-mb-px"
          >
            {/* Tabs left, the page's one primary action right (user ask, 29
                Sep). `items-end` sits the button on the tabs' own baseline, and
                the -mb keeps it clear of the strip's border without the pb-3
                that gives each tab room for its indicator. */}
            <div className="flex items-end justify-between gap-4">
              <div className="flex gap-6" role="tablist" aria-label="RACM view">
                {tabs.map(({ id, label, Icon }) => {
                  const active = tab === id;
                  return (
                    <button
                      key={id}
                      role="tab"
                      aria-selected={active}
                      onClick={() => setTab(id)}
                      className={`pb-3 text-[0.8125rem] font-semibold relative transition-colors cursor-pointer whitespace-nowrap ${
                        active ? 'text-brand-700' : 'text-ink-500 hover:text-ink-700'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <Icon size={14} /> {label}
                      </span>
                      {active && (
                        <motion.div
                          layoutId="racm-main-tab-underline"
                          className="absolute bottom-0 left-0 right-0 h-[3px] bg-brand-600 rounded-full"
                          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
              {/* Config has nothing to create, so the button belongs to Library
                  alone rather than sitting greyed on the other tab. */}
              {tab === 'library' && canManage && (
                <button onClick={() => setCreating(true)}
                  title="Create a RACM — import a matrix, or extract one from an SOP"
                  className="mb-2 flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[0.8125rem] font-semibold transition-colors cursor-pointer">
                  <Plus size={14} />Create RACM
                </button>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* The one scroll region on the page. Its own top padding replaces the
          margin the strip used to carry, so the gap under the tabs is the same
          whichever tab is open. */}
      <div className="flex-1 min-h-0 overflow-y-auto px-9 pt-6 pb-8">
        {tab === 'library' && <RacmLibraryView canManage={canManage} creating={creating} setCreating={setCreating} />}
        {tab === 'config' && <RacmConfigView canManage={canManage} />}
      </div>
    </div>
  );
}
