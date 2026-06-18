import type { WorkspaceTab } from '../engagementPatterns';
import { EngagementTabBar } from '../../audit/EngagementTabBar';

interface Props {
  tabs: WorkspaceTab[];
  activeTabId: string;
  onTabChange: (tabId: string) => void;
  hiddenTabIds?: string[];
  /** Per-engagement key so tab order / user-hidden state persists distinctly. */
  storageKey?: string;
}

/**
 * Configurable-engagement workspace tabs. Delegates to the shared EngagementTabBar
 * so the Config page gets the same colorful icons, drag-to-reorder, and show/hide
 * menu as the Engagements and Engagement Final pages. `hiddenTabIds` (scope-driven)
 * are filtered out up-front; the bar's menu controls user-level show/hide on top.
 */
export default function WorkspaceTabs({ tabs, activeTabId, onTabChange, hiddenTabIds = [], storageKey = 'config' }: Props) {
  const visibleTabs = tabs
    .filter(t => !hiddenTabIds.includes(t.id))
    .map(t => ({ id: t.id, label: t.label }));

  return (
    <EngagementTabBar
      tabs={visibleTabs}
      activeTab={activeTabId}
      onSelect={onTabChange}
      storageKey={storageKey}
    />
  );
}
