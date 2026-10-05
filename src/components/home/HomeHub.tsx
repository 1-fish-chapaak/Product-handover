/**
 * Home — two tabs. Today (setup, what needs you, next best actions,
 * coverage, leaderboard) is where people start; Insights is the configurable
 * dashboard Home used to be, unchanged.
 */
import { useState, type ReactNode } from 'react';

type HomeTab = 'today' | 'insights';
const TAB_KEY = 'irame.home.tab';

export default function HomeHub({ today, insights }: { today: ReactNode; insights: ReactNode }) {
  const [tab, setTab] = useState<HomeTab>(() => {
    try { return localStorage.getItem(TAB_KEY) === 'insights' ? 'insights' : 'today'; } catch { return 'today'; }
  });
  const pick = (t: HomeTab) => { setTab(t); try { localStorage.setItem(TAB_KEY, t); } catch { /* ignore */ } };
  return (
    <div className="h-full flex flex-col bg-white">
      <div role="tablist" aria-label="Home" className="shrink-0 flex items-center gap-6 px-6 md:px-8 border-b border-canvas-border">
        {([['today', 'Today'], ['insights', 'Insights']] as const).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => pick(id)}
            className={`relative h-11 text-[0.8125rem] font-medium cursor-pointer ${tab === id ? 'text-ink-900' : 'text-ink-500 hover:text-ink-800'}`}
          >
            {label}
            {tab === id && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-brand-600" />}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">{tab === 'today' ? today : insights}</div>
    </div>
  );
}
