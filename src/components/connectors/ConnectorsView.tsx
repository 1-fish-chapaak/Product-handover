/**
 * Connectors.
 *
 * What this build can look up outside the workspace's own data, and what each
 * lookup costs.
 *
 * One page with a tab strip rather than a nav entry per family. The families
 * answer the same question, "what can we ask for and what does it cost", and
 * differ only in who is being asked, so splitting them across the sidebar would
 * put one screen's worth of catalogue behind several clicks. A new provider
 * family arrives as a tab here.
 *
 * Read-only, deliberately. Nothing on this page authorises spend or holds a
 * credential: the operation list, its prices and its gates are build constants
 * that come with a release rather than with a setting.
 */

import { useState } from 'react';
import { Boxes, Landmark } from 'lucide-react';
import GovtApisTab from './GovtApisTab';
import TabPills from '../ui/TabPills';

/** Tabs that have a panel behind them. `currentTab` is typed to these alone, so
 *  an unbuilt family cannot become the selected tab by accident. */
type TabId = 'govt-apis';

interface Tab {
  id: TabId | 'erp';
  label: string;
  icon: typeof Landmark;
  /** Announced but not built. Rendered as a disabled control rather than a
   *  clickable tab over an empty panel: a tab that selects and then shows
   *  nothing reads as a broken page, while a dimmed control with a label says
   *  the same thing and is honest about it. */
  comingSoon?: boolean;
}

const TABS: Tab[] = [
  { id: 'govt-apis', label: 'Govt APIs', icon: Landmark },
  { id: 'erp', label: 'ERP connectors', icon: Boxes, comingSoon: true },
];

export default function ConnectorsView() {
  const [currentTab, setCurrentTab] = useState<TabId>('govt-apis');

  return (
    // The shell hands a view a fixed height and clips it, so every view owns
    // its own scroll. Without this the page is cut off at the fold.
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-8 py-10">
        <h1 className="text-[1.25rem] font-semibold text-ink-900">Connectors</h1>
        <p className="mt-2 max-w-2xl text-[0.9375rem] leading-relaxed text-ink-500">
          External lookups a chat turn or a workflow run can make. Every one is listed, including
          the lookups this environment has not switched on yet, so a catalogue you have not bought
          reads as a price rather than as a missing feature.
        </p>

        <TabPills
          className="mt-6"
          tabs={TABS.map(tab => ({
            id: tab.id,
            label: tab.label,
            icon: tab.icon,
            pending: tab.comingSoon === true,
          }))}
          current={currentTab}
          onSelect={id => setCurrentTab(id as TabId)}
        />

        <div className="pt-6">
          {currentTab === 'govt-apis' ? <GovtApisTab /> : null}
        </div>
      </div>
    </div>
  );
}
