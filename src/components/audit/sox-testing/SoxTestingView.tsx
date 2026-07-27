import { useState } from 'react';
import SoxTestingTab from './SoxTestingTab';
import V2Tab from './v2/V2Tab';

/** The "V2 · Call-aligned" tab is parked for now — flip to true to bring it back. */
const SHOW_V2_TAB = false;

/**
 * SOX Testing as its own sidebar section (below Engagements). Two tabs:
 *  - "Programmes" — the existing scoping-first flow, untouched and default
 *  - "V2" — a parity copy of the same experience on its own store; the
 *    call-aligned features get added here one decision at a time.
 *    Currently hidden behind SHOW_V2_TAB; while off, no tab strip renders.
 */
export default function SoxTestingView({ onOpenEngagement }: {
  /** Routes into the classic SOX workspace (tabs + control testing). */
  onOpenEngagement: (engagementId: string) => void;
}) {
  const [tab, setTab] = useState<'classic' | 'v2'>('classic');

  return (
    <div className="h-full overflow-y-auto bg-white bg-mesh-gradient relative">
      <div className="p-8 relative">
        {/* Header — same chrome as the Engagement Library */}
        <div className="mb-5">
          <div className="text-[0.6875rem] font-semibold text-text-muted tracking-wider uppercase mb-1">Engagements</div>
          <h1 className="text-[2rem] font-bold text-text leading-tight">SOX Testing</h1>
          <p className="text-[0.8125rem] text-text-secondary mt-1.5 max-w-xl">
            {tab === 'classic'
              ? "The scoping-first SOX flow — materiality and trial balances decide what's in scope, and every in-scope process becomes a RACM."
              : 'Same flow, separate sandbox — the partner-call features get added here as we decide them.'}
          </p>
        </div>

        {/* Tab strip — classic stays the default; a lone tab is dead chrome, so the strip only renders while V2 is live */}
        {SHOW_V2_TAB && (
          <div role="tablist" aria-label="SOX Testing flows" className="flex items-center gap-1 border-b border-border-light mb-6">
            {([
              { id: 'classic', label: 'Programmes' },
              { id: 'v2', label: 'V2 · Call-aligned' },
            ] as const).map(t => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`px-3.5 py-2 text-[13px] font-semibold border-b-2 -mb-px transition-colors cursor-pointer ${
                  tab === t.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-text-muted hover:text-text-secondary'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {tab === 'classic'
          ? <SoxTestingTab onOpenEngagement={onOpenEngagement} />
          : <V2Tab onOpenEngagement={onOpenEngagement} />}
      </div>
    </div>
  );
}
