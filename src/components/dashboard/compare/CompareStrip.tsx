import { motion, useReducedMotion } from 'motion/react';
import { AlertTriangle, GitCompareArrows } from 'lucide-react';
import { CompareSideChip } from './CompareChip';
import { grainMeta, periodSidesOf } from './comparePresets';
import type { CompareConfig } from './compareTypes';

export interface CompareCounts { total: number; pinned: number; excluded: number; notComparable: number }

/**
 * Sits above the KPI row while Compare is on — the one place the state is
 * announced (role=status). Twin of the page-filter strip.
 */
export default function CompareStrip({ config, counts, conflicts, onPick, onExit }: {
  config: CompareConfig;
  counts: CompareCounts;
  /** Human labels of page filters paused by the comparison. */
  conflicts: string[];
  onPick: (side: 'a' | 'b') => void;
  onExit: () => void;
}) {
  const reduce = useReducedMotion();
  // Three periods or more: one chip for the whole span instead of A vs B.
  const sides = config.periods ? periodSidesOf(config.periods) : [];
  const series = sides.length > 2 && config.periods
    ? { count: sides.length, grain: config.periods.grain, first: sides[0].label, last: sides[sides.length - 1].label }
    : null;
  const sep = <span className="text-ink-300" aria-hidden="true">·</span>;
  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={reduce ? false : { opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: reduce ? 0 : 0.12 } }}
      transition={{ duration: reduce ? 0 : 0.2, ease: [0.2, 0, 0, 1] }}
      className="flex flex-wrap items-center gap-2 px-4 py-2.5 mb-4 rounded-xl border border-brand-100 bg-brand-50/50"
    >
      <GitCompareArrows size={13} className="text-brand-600" aria-hidden="true" />
      <span className="text-[0.75rem] font-medium text-ink-700">Comparing</span>
      {series ? (
        <button
          type="button" onClick={() => onPick('a')}
          className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-[0.6875rem] font-medium text-brand-700 tabular-nums hover:bg-brand-100 cursor-pointer transition-colors"
        >
          {series.count} {grainMeta(series.grain).plural} · {series.first} – {series.last}
        </button>
      ) : (
        <>
          <CompareSideChip side={config.a} which="a" onClick={() => onPick('a')} />
          <span className="text-[0.6875rem] text-ink-500">vs</span>
          <CompareSideChip side={config.b} which="b" onClick={() => onPick('b')} />
        </>
      )}
      <span className="flex items-center gap-1.5 text-[0.6875rem] text-ink-500 tabular-nums">
        {!series && <>{sep}<span>{config.chartMode === 'overlay' ? 'Overlay' : 'Side by side'}</span></>}
        {sep}<span>{counts.total} widget{counts.total === 1 ? '' : 's'}</span>
        {counts.pinned > 0 && <>{sep}<span>{counts.pinned} pinned</span></>}
        {counts.excluded > 0 && <>{sep}<span>{counts.excluded} excluded</span></>}
        {counts.notComparable > 0 && <>{sep}<span>{counts.notComparable} not comparable</span></>}
      </span>
      {conflicts.length > 0 && (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-mitigated/30 bg-mitigated-50 text-mitigated-700 text-[0.6875rem] font-medium px-2.5 py-1">
          <AlertTriangle size={11} aria-hidden="true" /> {conflicts.join(', ')} filter{conflicts.length === 1 ? '' : 's'} paused while comparing
        </span>
      )}
      <button type="button" onClick={onExit} className="ml-auto h-7 px-2.5 rounded-md border border-brand-200 bg-canvas-elevated text-[0.6875rem] font-semibold text-brand-700 hover:border-brand-300 cursor-pointer transition-colors">Exit compare</button>
    </motion.div>
  );
}
