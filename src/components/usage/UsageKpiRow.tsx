/**
 * Platform Usage — KPI tiles in the Home health-tile language.
 *
 * Each tile: quiet icon + uppercase micro-label header, a big count-up value
 * with a period-over-period delta chip, and an animated mini bar-trend of that
 * metric across the selected range (last bar = most recent, brand-600; prior
 * bars brand-200 — same as Home's 8-quarter trend). Local to the usage view;
 * the shared AdminKpiCard stays untouched.
 */

import { motion, useReducedMotion } from 'motion/react';
import { TrendingUp } from 'lucide-react';
import { KpiCountUp } from '../shared/KpiTile';
import type { Stat } from '../admin/adminTokens';

export interface UsageStat extends Stat {
  /** Percent change vs the prior window; null/undefined hides the chip. */
  deltaPct?: number | null;
  /** Bucketed metric values across the range, oldest → newest. */
  trend?: number[];
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

/** Home's mini bar-trend: min-floored heights so differences read, last bar
 *  emphasized, staggered rise. */
function TrendBars({ values, index }: { values: number[]; index: number }) {
  const prefersReduced = useReducedMotion();
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = (max - min) || 1;
  return (
    <div className="h-8 flex items-end justify-between gap-[3px]" aria-hidden="true">
      {values.map((v, j) => {
        const isCurrent = j === values.length - 1;
        const heightPct = 25 + ((v - min) / span) * 75;
        return (
          <motion.div
            key={j}
            initial={prefersReduced ? false : { height: 0 }}
            animate={{ height: `${heightPct}%` }}
            transition={prefersReduced ? { duration: 0 } : { delay: 0.3 + index * 0.08 + j * 0.03, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className={`flex-1 rounded-t-sm ${isCurrent ? 'bg-brand-600' : 'bg-brand-200'}`}
            style={{ minHeight: 3 }}
          />
        );
      })}
    </div>
  );
}

function UsageKpiTile({ stat, index, rangeDays }: { stat: UsageStat; index: number; rangeDays: number }) {
  const prefersReducedMotion = useReducedMotion();
  const Icon = stat.icon;
  return (
    <motion.div
      role="listitem"
      aria-label={`${stat.label}: ${stat.value}`}
      title={stat.hint}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 18, mass: 0.7, delay: 0.06 + index * 0.07 }}
      className="rounded-2xl p-4 border border-canvas-border/60 bg-canvas-elevated flex flex-col gap-2.5 transition-[box-shadow,border-color] duration-300 ease-out hover:border-brand-300 hover:shadow-[0_0_0_1px_rgb(15_8_30_/_0.06),_0_12px_28px_rgb(15_8_30_/_0.08)]"
    >
      {/* Header — quiet icon + uppercase micro-label */}
      <div className="flex items-center gap-2">
        {Icon && <Icon size={13} className="text-ink-400 shrink-0" strokeWidth={1.75} />}
        <span className="text-[0.6875rem] font-semibold text-ink-500 uppercase tracking-wider truncate">{stat.label}</span>
      </div>

      {/* Value + delta */}
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[1.5rem] font-semibold leading-none tabular-nums text-ink-900">
          <KpiCountUp value={String(stat.value)} delay={120 + index * 80} />
        </span>
        {typeof stat.deltaPct === 'number' && <DeltaChip deltaPct={stat.deltaPct} rangeDays={rangeDays} />}
      </div>

      {/* Mini trend across the range */}
      {stat.trend && stat.trend.length > 1 && <TrendBars values={stat.trend} index={index} />}
    </motion.div>
  );
}

export default function UsageKpiRow({ stats, rangeDays }: { stats: UsageStat[]; rangeDays: number }) {
  return (
    <div className="mb-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s, i) => (
          <UsageKpiTile key={s.key} stat={s} index={i} rangeDays={rangeDays} />
        ))}
      </div>
      <p className="mt-1.5 text-[0.6875rem] text-ink-400">
        Change compared with the previous {rangeDays} days.
      </p>
    </div>
  );
}
