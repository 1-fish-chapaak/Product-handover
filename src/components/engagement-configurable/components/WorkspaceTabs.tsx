import React from 'react';
import type { WorkspaceTab } from '../engagementPatterns';

interface Props {
  tabs: WorkspaceTab[];
  activeTabId: string;
  onTabChange: (tabId: string) => void;
  hiddenTabIds?: string[];
}

export default function WorkspaceTabs({ tabs, activeTabId, onTabChange, hiddenTabIds = [] }: Props) {
  const visibleTabs = tabs.filter(t => !hiddenTabIds.includes(t.id));

  return (
    <div className="border-b border-border-light mb-4">
      <div className="flex items-center gap-0.5 overflow-x-auto pb-px">
        {visibleTabs.map(tab => {
          const isActive = tab.id === activeTabId;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`px-3 py-2 text-[11px] font-semibold whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-400 hover:text-text hover:border-gray-200'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
