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
import { SlidersHorizontal, Table2 } from 'lucide-react';
import { cn } from '../../lib/cn';
import RacmLibraryView from './RacmLibraryView';
import RacmConfigView from './RacmConfigView';

type RacmTab = 'library' | 'config';

export default function RacmPage({ canManage }: {
  /** Create, publish and delete — the same permission that creates engagements. */
  canManage: boolean;
}) {
  const [tab, setTab] = useState<RacmTab>('library');

  const tabs: { id: RacmTab; label: string; Icon: typeof Table2 }[] = [
    { id: 'library', label: 'Library', Icon: Table2 },
    { id: 'config', label: 'Config', Icon: SlidersHorizontal },
  ];

  return (
    <div className="px-9">
      <div className="mb-5">
        <p className="text-[0.6875rem] font-semibold tracking-[0.08em] text-ink-400 uppercase">Risk and controls</p>
        <h1 className="mt-1 text-[1.75rem] leading-tight font-semibold text-ink-900">RACM</h1>
        <p className="mt-1.5 text-[0.8125rem] text-ink-500 max-w-[640px]">
          Every risk-and-control matrix this team keeps. Engagements scope from what is published here.
        </p>
      </div>

      <div className="flex items-center gap-1 mb-5" role="tablist" aria-label="RACM view">
        {tabs.map(({ id, label, Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(id)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-2 text-[0.8125rem] font-semibold rounded-t-lg border-b-2 transition-colors cursor-pointer',
                active
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-ink-500 hover:text-ink-800',
              )}
            >
              <Icon size={14} /> {label}
            </button>
          );
        })}
      </div>

      {tab === 'library' && <RacmLibraryView canManage={canManage} />}
      {tab === 'config' && <RacmConfigView canManage={canManage} />}
    </div>
  );
}
