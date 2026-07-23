import SoxTestingTab from './SoxTestingTab';

/**
 * SOX Testing as its own sidebar section (below Engagements) — the
 * scoping-first flow gets the standard page chrome; the programme list,
 * wizards and summary modal underneath are unchanged.
 */
export default function SoxTestingView({ onOpenEngagement }: {
  /** Routes into the classic SOX workspace (tabs + control testing). */
  onOpenEngagement: (engagementId: string) => void;
}) {
  return (
    <div className="h-full overflow-y-auto bg-white bg-mesh-gradient relative">
      <div className="p-8 relative">
        {/* Header — same chrome as the Engagement Library */}
        <div className="mb-6">
          <div className="text-[0.6875rem] font-semibold text-text-muted tracking-wider uppercase mb-1">Engagements</div>
          <h1 className="text-[2rem] font-bold text-text leading-tight">SOX Testing</h1>
          <p className="text-[0.8125rem] text-text-secondary mt-1.5 max-w-xl">
            The scoping-first SOX flow — materiality and trial balances decide what's in scope,
            and every in-scope process becomes a RACM.
          </p>
        </div>
        <SoxTestingTab onOpenEngagement={onOpenEngagement} />
      </div>
    </div>
  );
}
