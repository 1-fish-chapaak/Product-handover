/**
 * Platform Usage.
 *
 * Two surfaces behind one nav entry.
 *
 * · **Usage and cost** — one row per metered turn, and what it cost to run.
 * · **Connectors** — what can be looked up outside this workspace, and the
 *   price of each lookup.
 *
 * They answer the same question from two ends, what we spent and what we can
 * spend it on, so they sit together rather than a nav entry apart.
 *
 * The shell owns the tab strip and nothing else. Each tab is the page it
 * always was, with its own controls and its own scroll, so moving one in or
 * out of here changes nothing about how it reads.
 *
 * A tab the reader's role cannot see is not rendered, and the page opens on
 * the first tab they can see, so the entry never lands somebody on a refusal.
 */

import { useState } from 'react';
import { Coins, Plug } from 'lucide-react';
import UsageCostSection from '../admin/usage/UsageCostSection';
import ConnectorsView from '../connectors/ConnectorsView';
import { useCurrentUser } from '../../context/CurrentUserContext';
import TabPills from '../ui/TabPills';

type TabId = 'cost' | 'connectors';

interface Tab {
  id: TabId;
  label: string;
  icon: typeof Coins;
  /** False where the reader's role does not carry this surface. */
  visible: boolean;
  body: () => React.ReactElement;
}

export default function PlatformUsageTabs() {
  const { can } = useCurrentUser();

  // What a turn cost is a workspace figure, so it carries the usage gate.
  // Connectors is open to everybody, because nothing on it authorises a spend.
  const readsUsage = can('ad_usage') || can('ad_usage_people');

  const tabs: Tab[] = [
    {
      id: 'cost',
      label: 'Usage and cost',
      icon: Coins,
      visible: readsUsage,
      body: () => (
        // A section rather than a page, so the shell gives it the scroller, the
        // measured column and the heading that Connectors already carries.
        <div className="h-full overflow-y-auto">
          <div className="mx-auto max-w-6xl px-8 py-10">
            <h1 className="text-[1.25rem] font-semibold text-ink-900">Usage and cost</h1>
            <p className="mb-6 mt-1 text-[0.875rem] text-ink-500">
              One row for every metered turn, and what it cost to run.
            </p>
            <UsageCostSection />
          </div>
        </div>
      ),
    },
    { id: 'connectors', label: 'Connectors', icon: Plug, visible: true, body: () => <ConnectorsView /> },
  ];

  const offered = tabs.filter(t => t.visible);
  const [current, setCurrent] = useState<TabId>(offered[0]?.id ?? 'connectors');
  const active = offered.find(t => t.id === current) ?? offered[0];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b border-canvas-border bg-canvas-elevated px-8 py-3">
        <TabPills
          tabs={offered.map(t => ({ id: t.id, label: t.label, icon: t.icon }))}
          current={active.id}
          onSelect={setCurrent}
        />
      </div>

      {/* min-h-0 so the tab body scrolls inside this column rather than
          stretching it and taking the scroll off the page entirely. */}
      <div className="min-h-0 flex-1">{active.body()}</div>
    </div>
  );
}
