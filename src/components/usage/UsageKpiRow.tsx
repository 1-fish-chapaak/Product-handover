/**
 * Platform Usage — KPI band with period-over-period delta chips.
 *
 * A local sibling of AdminKpiCard (admin/AdminPrimitives.tsx): same card
 * anatomy and aria-label contract, plus a right-aligned trend chip comparing
 * the selected window against the previous equal window. Kept local so the
 * shared admin card (used by every Admin tab) stays untouched.
 */

import { motion, useReducedMotion } from 'motion/react';
import { TrendingUp } from 'lucide-react';
import { KpiCountUp } from '../shared/KpiTile';
import type { Stat } from '../admin/adminTokens';

export interface UsageStat extends Stat {
  /** Percent change vs the prior window; null/undefined hides the chip. */
  deltaPct?: number | null;
}

function DeltaChip({ deltaPct, rangeDays }: { deltaPct: number; rangeDays: number }) {
  // A flat period is neither good nor bad — neutral chip, no arrow.
  if (deltaPct === 0) {
    return (
      <span title={`vs previous ${rangeDays} days`} className="inline-flex items-center text-[0.6875rem] font-semibold px-1.5 py-0.5 rounded-full tabular-nums shrink-0 text-ink-500 bg-ink-900/5">
        0%
      </span>
    );
  }
  const up = deltaPct > 0;
  return (
    <span
      title={`vs previous ${rangeDays} days`}
      className={`inline-flex items-center gap-1 text-[0.6875rem] font-semibold px-1.5 py-0.5 rounded-full tabular-nums shrink-0 ${
        up ? 'text-compliant-700 bg-compliant-50' : 'text-mitigated-700 bg-mitigated-50'
      }`}
    >
      <TrendingUp size={10} strokeWidth={2.5} className={up ? '' : 'rotate-180'} />
      {up ? '+' : ''}{deltaPct}%
    </span>
  );
}

function UsageKpiCard({ stat, index, rangeDays }: { stat: UsageStat; index: number; rangeDays: number }) {
  const prefersReducedMotion = useReducedMotion();
  const Icon = stat.icon;
  return (
    <motion.div
      role="listitem"
      aria-label={`${stat.label}: ${stat.value}`}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 18, mass: 0.7, delay: 0.08 + index * 0.08 }}
      className="flex items-center gap-2.5 rounded-lg border border-canvas-border bg-canvas-elevated px-3 py-2"
    >
      {Icon && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
          <Icon size={14} strokeWidth={2} />
        </div>
      )}
      <div className="min-w-0 flex-1 flex items-baseline gap-1.5">
        <span className="text-[1.125rem] font-bold leading-none tabular-nums text-ink-900">
          <KpiCountUp value={String(stat.value)} delay={120 + index * 80} />
        </span>
        <span className="text-[0.75rem] font-medium truncate text-ink-500">{stat.label}</span>
      </div>
      {typeof stat.deltaPct === 'number' && <DeltaChip deltaPct={stat.deltaPct} rangeDays={rangeDays} />}
    </motion.div>
  );
}

export default function UsageKpiRow({ stats, rangeDays }: { stats: UsageStat[]; rangeDays: number }) {
  return (
    <div className="mb-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s, i) => (
          <UsageKpiCard key={s.key} stat={s} index={i} rangeDays={rangeDays} />
        ))}
      </div>
      <p className="mt-1.5 text-[0.6875rem] text-ink-400">
        Change compared with the previous {rangeDays} days.
      </p>
    </div>
  );
}
