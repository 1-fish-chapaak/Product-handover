/**
 * Platform Usage — KPI tiles in the Home health-tile language.
 *
 * Each tile: quiet icon + uppercase micro-label header, a big count-up value
 * with a period-over-period delta chip, and an animated area sparkline of that
 * metric across the selected range. Local to the usage view; the shared
 * AdminKpiCard stays untouched.
 */

import { motion, useReducedMotion } from 'motion/react';
import { TrendingUp } from 'lucide-react';
import { KpiCountUp } from '../shared/KpiTile';
import type { Stat } from '../admin/adminTokens';

/** One point on the trend: the value, and the dates it covers so it can say so on hover. */
export interface TrendPoint {
  /** The date range this bucket spans, e.g. "Mar 23 – Mar 25". */
  label: string;
  /** First and last day in the bucket — the axis reads its ends off these. */
  from: string;
  to: string;
  value: number;
}

export interface UsageStat extends Stat {
  /** Percent change vs the prior window; null/undefined hides the chip. */
  deltaPct?: number | null;
  /** Bucketed metric values across the range, oldest → newest. */
  trend?: TrendPoint[];
  /** What the trend counts — "actions", "reports". Used in the point tooltips. */
  unit?: string;
  /** What the BIG number is, in words — e.g. "people active in this period".
   *  Without this the headline is an unlabelled integer. */
  valueCaption?: string;
  /** What ONE POINT on the curve counts — e.g. "actions per 3 days". This is the
   *  line that answers "what does this graph represent", and it is not always a
   *  slice of the headline: Active users is a distinct count at both levels, so
   *  its points do NOT add up to its headline. Say so rather than imply it. */
  trendCaption?: string;
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

/**
 * The mini trend across the range — a plain sparkline.
 *
 * A sparkline shows one thing: the shape of the metric over time, up or down.
 * It is deliberately NOT a chart you read exact values off — the big number
 * above is the value; this is just its recent direction. The earlier version
 * piled a y-axis rail, an average line and a per-bucket caption onto it, which
 * turned a glanceable shape into a dense chart that read as neither. Detail on
 * demand (peak, average, dates) lives in the hover title and the aria-label;
 * the face of the card stays quiet.
 */
function TrendArea({ points, unit, label, index }: {
  points: TrendPoint[]; unit: string; label: string; index: number;
}) {
  const prefersReduced = useReducedMotion();
  const values = points.map(p => p.value);
  const max = Math.max(...values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const noun = (v: number) => (v === 1 && unit.endsWith('s') ? unit.slice(0, -1) : unit);
  const first = points[0];
  const last = points[points.length - 1];
  const fmtN = (v: number) => v.toLocaleString('en-US');

  const W = 100, H = 40;
  const den = Math.max(1, points.length - 1);
  const y = (v: number) => H - (max > 0 ? (v / max) * (H - 3) : 0) - 1;
  const pts = points.map((p, i) => [(i / den) * W, y(p.value)] as const);
  const line = pts.map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${px.toFixed(2)},${py.toFixed(2)}`).join(' ');
  const area = `${line} L${W},${H} L0,${H} Z`;
  const gid = `spark-${label.replace(/\W/g, '')}-${index}`;

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="relative h-10"
        role="img"
        aria-label={`${label} trend: peak ${fmtN(max)} ${noun(max)}, average ${fmtN(Math.round(avg))}, latest ${fmtN(last.value)}, from ${first.from} to ${last.to}.`}
        title={`Peak ${fmtN(max)} · avg ${fmtN(Math.round(avg))} · latest ${fmtN(last.value)}`}
      >
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6A12CD" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#6A12CD" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <motion.path
            d={area} fill={`url(#${gid})`}
            initial={prefersReduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={prefersReduced ? { duration: 0 } : { delay: 0.35 + index * 0.08, duration: 0.5 }}
          />
          <motion.path
            d={line} fill="none" stroke="#6A12CD" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
            initial={prefersReduced ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={prefersReduced ? { duration: 0 } : { delay: 0.25 + index * 0.08, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          />
        </svg>

        {/* "Now" dot — marks where the line ends. */}
        <span
          className="absolute w-[7px] h-[7px] rounded-full bg-brand-600 ring-2 ring-canvas-elevated"
          style={{ right: 0, top: `${(y(last.value) / H) * 100}%`, transform: 'translateY(-50%)' }}
        />
      </div>

      {/* Just the span of the window — grounds the shape in time, nothing more. */}
      <div className="flex items-baseline justify-between gap-2 text-[0.5625rem] text-ink-400 tabular-nums">
        <span className="truncate">{first.from}</span>
        <span className="shrink-0">{last.to}</span>
      </div>
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
      className="rounded-lg p-4 border border-canvas-border/60 bg-canvas-elevated flex flex-col gap-2.5 transition-[box-shadow,border-color] duration-300 ease-out hover:border-brand-300 hover:shadow-[0_0_0_1px_rgb(15_8_30_/_0.06),_0_12px_28px_rgb(15_8_30_/_0.08)]"
    >
      {/* Header — quiet icon + uppercase micro-label */}
      <div className="flex items-center gap-2">
        {Icon && <Icon size={13} className="text-ink-400 shrink-0" strokeWidth={1.75} />}
        <span className="text-[0.6875rem] font-semibold text-ink-500 uppercase tracking-wider truncate">{stat.label}</span>
      </div>

      {/* Value + delta, then what the value actually is in words. */}
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[1.625rem] font-semibold leading-none tabular-nums text-ink-900">
            <KpiCountUp value={String(stat.value)} delay={120 + index * 80} />
          </span>
          {typeof stat.deltaPct === 'number' && <DeltaChip deltaPct={stat.deltaPct} rangeDays={rangeDays} />}
        </div>
        {/* One reserved line, so the four cards keep a common baseline. */}
        {stat.valueCaption && (
          <div className="mt-1 h-[0.875rem] text-[0.625rem] leading-tight text-ink-500 truncate">{stat.valueCaption}</div>
        )}
      </div>

      {/* Mini trend across the range */}
      {stat.trend && stat.trend.length > 1 && (
        <TrendArea
          points={stat.trend}
          unit={stat.unit ?? ''}
          label={stat.label}
          index={index}
        />
      )}
    </motion.div>
  );
}

export default function UsageKpiRow({ stats, rangeDays, asOf, endsAtAnchor = true }: {
  stats: UsageStat[];
  rangeDays: number;
  /** The last day of the window. For presets that's the anchor; for a custom
   *  range it's wherever the range ends. */
  asOf?: string;
  /** False when a custom range ends before the anchor — the window is then not
   *  "the most recent activity on record" and the copy must not claim it is. */
  endsAtAnchor?: boolean;
}) {
  return (
    <div className="mb-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s, i) => (
          <UsageKpiTile key={s.key} stat={s} index={i} rangeDays={rangeDays} />
        ))}
      </div>
      <p className="mt-1.5 text-[0.6875rem] text-ink-400">
        {asOf
          ? endsAtAnchor
            ? `The ${rangeDays} days up to ${asOf}, the most recent activity on record. The % is the change vs the ${rangeDays} days before that.`
            : `The ${rangeDays} days ending ${asOf}. The % is the change vs the ${rangeDays} days before that.`
          : `The % is the change vs the previous ${rangeDays} days.`}
      </p>
    </div>
  );
}
