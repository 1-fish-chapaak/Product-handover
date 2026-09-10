/**
 * Platform Usage.
 *
 * Three surfaces behind one nav entry.
 *
 * · **Connectors** — what can be looked up outside this workspace, and the
 *   price of each lookup.
 * · **Usage and cost** — one row per activity, and what it cost to run.
 * · **Platform Value** — the same activities read backwards: what the work gave
 *   back, timed against how long it takes a person.
 *
 * A row is an ACTIVITY on all three, in those words. It used to be a metered
 * turn here, a piece of work in the value panels and an activity in the tables,
 * which is three names for one thing on a page whose argument depends on a
 * reader following one number from one tab to the next.
 *
 * They answer the same question from three ends, what we can spend on, what we
 * spent, and what came of it, so they sit together rather than a nav entry
 * apart. Cost and Value read the same rows through the same filters on purpose:
 * a page that could not be reconciled against the one beside it would not be
 * believed by anybody who tried.
 *
 * The chrome is Knowledge Hub's, to the pixel: one full-bleed elevated strip
 * carrying the display title, the subhead and the tabs, with the strip's own
 * bottom hairline serving as the underline track. A reader who has learned one
 * page of this platform should not have to learn another.
 *
 * A tab the reader's role cannot see is not rendered, and the page opens on
 * the first tab they can see, so the entry never lands somebody on a refusal.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Coins, Plug, TrendingUp } from 'lucide-react';
import UsageCostSection from '../admin/usage/UsageCostSection';
import PlatformValueSection from './PlatformValueSection';
import ConnectorsSection from '../connectors/ConnectorsView';
import FloatingLines from '../shared/FloatingLines';
import { useCurrentUser } from '../../context/CurrentUserContext';

type TabId = 'connectors' | 'cost' | 'value';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ElementType;
  /** False where the reader's role does not carry this surface. */
  visible: boolean;
  body: () => React.ReactElement;
}

// ─── Underlined tabs ────────────────────────────────────────────────────────

// Knowledge Hub's tab recipe, unchanged: pb-3 + font-semibold + a motion.div
// underline with layoutId so the active brand bar springs between tabs.
// Thicker (3px) and rounded-full so it reads as an intentional indicator, not
// a CSS border.
function UnderlinedTabs({
  tabs, active, onChange,
}: {
  tabs: Tab[];
  active: TabId;
  onChange: (id: TabId) => void;
}) {
  return (
    <div className="flex gap-6">
      {tabs.map(tab => {
        const Icon = tab.icon;
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`pb-3 text-[0.8125rem] font-semibold relative transition-colors cursor-pointer whitespace-nowrap ${
              isActive ? 'text-brand-700' : 'text-ink-500 hover:text-ink-700'
            }`}
          >
            <span className="flex items-center gap-2">
              <Icon size={14} />
              {tab.label}
            </span>
            {isActive && (
              <motion.div
                layoutId="platform-usage-tab-underline"
                className="absolute bottom-0 left-0 right-0 h-[3px] bg-brand-600 rounded-full"
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function PlatformUsageTabs() {
  const { can } = useCurrentUser();

  // What a turn cost is a workspace figure, so it carries the usage gate.
  // Connectors is open to everybody, because nothing on it authorises a spend.
  const readsUsage = can('ad_usage') || can('ad_usage_people');

  const tabs: Tab[] = [
    // Connectors leads, because it is the tab everybody can see and it reads
    // as the catalogue the spending is against. Cost follows it.
    {
      id: 'connectors',
      label: 'Connectors',
      icon: Plug,
      visible: true,
      body: () => <ConnectorsSection />,
    },
    {
      id: 'cost',
      label: 'Usage and cost',
      icon: Coins,
      visible: readsUsage,
      body: () => <UsageCostSection />,
    },
    // Value sits after Cost and reads the same rows. Same gate, because the
    // Cost lens on it prints the workspace's bill.
    //
    // The label is "Platform Value" and not "Usages". It sat as "Usages" for an
    // afternoon and read as a near-duplicate of "Usage and cost" beside it: two
    // tabs a letter apart, with the new one having dropped the word that says
    // it answers a different question. Value is the question this tab asks.
    {
      id: 'value',
      label: 'Platform Value',
      icon: TrendingUp,
      visible: readsUsage,
      body: () => <PlatformValueSection />,
    },
  ];

  const offered = tabs.filter(t => t.visible);
  const [current, setCurrent] = useState<TabId>(offered[0]?.id ?? 'connectors');
  const active = offered.find(t => t.id === current) ?? offered[0];

  // One line each, at the width the strip gives them: a subhead that wraps on
  // one tab and not the other moves the tab strip down when you switch, which
  // reads as the page jumping.
  const subhead =
    active.id === 'connectors'
      ? 'External lookups an activity can make, and what each one costs per call.'
      : active.id === 'cost'
        ? 'One row for every activity, and what it cost to run.'
        : 'What the same work gave back.';

  // The page insets step up with the window (px-6 → lg:px-12 → xl:px-[124px])
  // so narrow windows keep room for wide tables. The strip's negative margins
  // mirror the same scale so the full-bleed stays aligned.
  return (
    <div className="h-full flex flex-col overflow-hidden bg-canvas">
      <div className="px-6 lg:px-12 xl:px-[124px] pt-8 shrink-0">
        {/* Header + tabs share a single full-bleed white strip — bg-canvas-
            elevated extends past the outer insets via negative margins.
            Border-b separates strip from content. FloatingLines paints across
            the strip behind the type so the header reads as a brand surface,
            not a flat panel. */}
        <div className="bg-canvas-elevated -mx-6 lg:-mx-12 xl:-mx-[124px] px-6 lg:px-12 xl:px-[124px] -mt-8 pt-8 border-b border-canvas-border relative overflow-hidden">
          {/* Ambient FloatingLines — top and bottom waves only, never the
              middle one where the H1 sits. Low opacity keeps the lines as
              texture rather than a competing element. */}
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
                Platform Usage
              </h1>
              <p className="mt-2 text-[0.9375rem] text-ink-500 leading-relaxed max-w-2xl">
                {subhead}
              </p>
            </div>
          </motion.div>

          {/* Tabs at the bottom of the strip — the strip's border-b serves as
              the underline track for the active brand-600 indicator. */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="-mb-px"
          >
            <UnderlinedTabs tabs={offered} active={active.id} onChange={setCurrent} />
          </motion.div>
        </div>
      </div>

      {/* Content area — fills the remaining viewport height. Each tab is a
          section rather than a page: it brings its own controls and its own
          table, and this column is the single scroll region. */}
      <div className="px-6 lg:px-12 xl:px-[124px] pt-4 pb-8 flex-1 min-h-0 flex flex-col overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={active.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            className="flex-1 min-h-0 overflow-y-auto"
          >
            {active.body()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
