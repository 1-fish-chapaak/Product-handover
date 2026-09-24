import type { CompareSummary } from './compareTypes';

/**
 * IRA's reading of the comparison — headline, the movers, the caveats. A flat
 * bordered card with a mono meta line; identity through typography, not an
 * avatar. Every number is from the result; the words interpret polarity.
 */
export default function WhatChangedSummary({ summary, compact = false }: { summary: CompareSummary; compact?: boolean }) {
  const lines = [summary.headline, ...summary.bullets].slice(0, compact ? 3 : 5);
  return (
    <div className={`rounded-xl border border-canvas-border bg-canvas-elevated ${compact ? 'px-3.5 py-3' : 'px-4 py-3.5'}`}>
      <p className="font-mono text-[0.6875rem] uppercase tracking-wide text-ink-500 mb-2">IRA · What changed</p>
      <ul className="space-y-1.5">
        {lines.map((line, i) => (
          <li key={i} className="flex gap-2.5">
            <span className="size-1.5 rounded-full bg-brand-600 mt-[0.45rem] shrink-0" aria-hidden="true" />
            <span className={`${compact ? 'text-[0.75rem]' : 'text-[0.8125rem]'} text-ink-700 leading-[1.6] tabular-nums`}>{line}</span>
          </li>
        ))}
      </ul>
      {summary.caveats.length > 0 && (
        <p className="mt-2 text-[0.6875rem] text-ink-400 leading-snug">{summary.caveats.join(' ')}</p>
      )}
    </div>
  );
}
