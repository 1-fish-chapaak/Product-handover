/**
 * Platform Usage — the KPI strip.
 *
 * One card, four cells, hairlines between them.
 *
 * Each cell is now THREE things: a label, a number, and what the number did.
 * That's it. The previous version also carried an icon tile, a denominator, a
 * sparkline, and two date labels under the sparkline — so the row alone was
 * about forty elements, and the four numbers a reader actually came for were
 * buried in their own supporting cast.
 *
 * The sparklines went first and they were the biggest win. A 34px curve with no
 * axis and no scale, drawn per-tile so each is normalised to its own maximum,
 * cannot be read: it makes a 2-person change and a 200-action change look
 * identical. It was decoration pretending to be data. The trend belongs in the
 * chart below, which has axes.
 *
 *   ACTIONS                    ⓘ
 *   525                              ← 36px. The thing you came for.
 *   Up 8% from 487                   ← what it did, against a named baseline
 *
 * The ⓘ stays, because "what counts and what doesn't" is the one piece of
 * supporting text that turns a number from a mystery into a fact.
 */

import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Info } from 'lucide-react';
import { KpiCountUp } from '../shared/KpiTile';
import type { Stat } from '../admin/adminTokens';
import { CARD_BASE, KH_EASE } from './usageTokens';

/** Below this, a percentage change is noise — say it in whole units instead. */
const SMALL_BASE = 30;

export interface UsageStat extends Stat {
  /** What the metric counts — "actions", "reports". Used in the change sentence. */
  unit?: string;
  /** The raw current value, for the change sentence. */
  current: number;
  /** The same metric in the previous window, for the change sentence. */
  prior: number;
  /** The denominator, printed under the value: "of 17 licensed". */
  of?: string;
  /** What counts toward this metric. Required — it is the ⓘ's whole job. */
  counts: string;
  /** What does NOT count. The line that stops the number being a mystery. */
  excludes?: string;
}

/** The change, said the way a person would say it. */
function changeSentence(stat: UsageStat, compareLabel: string) {
  const { current, prior } = stat;
  if (prior === 0 && current === 0) return { text: 'None in either period', tone: 'flat' as const };
  if (prior === 0) return { text: `New — none in the ${compareLabel}`, tone: 'up' as const };

  const diff = current - prior;
  const tone = diff > 0 ? ('up' as const) : diff < 0 ? ('down' as const) : ('flat' as const);
  if (diff === 0) return { text: `Same as the ${compareLabel}`, tone };

  const noun = stat.unit ?? '';
  const n = Math.abs(diff);
  // Small base → say it in whole units. A percentage of twelve people is a lie.
  if (Math.max(current, prior) < SMALL_BASE) {
    return {
      text: `${diff > 0 ? 'Up' : 'Down'} ${n} ${n === 1 ? noun.replace(/s$/, '') : noun} from ${prior.toLocaleString('en-US')}`,
      tone,
    };
  }
  const pct = Math.round((diff / prior) * 100);
  return { text: `${pct > 0 ? 'Up' : 'Down'} ${Math.abs(pct)}% from ${prior.toLocaleString('en-US')}`, tone };
}

function UsageKpiCell({ stat, index, compareLabel }: {
  stat: UsageStat; index: number; compareLabel: string;
}) {
  const prefersReduced = useReducedMotion();
  const [defOpen, setDefOpen] = useState(false);
  const change = changeSentence(stat, compareLabel);
  const changeTone =
    change.tone === 'up' ? 'text-compliant-700' : change.tone === 'down' ? 'text-risk-700' : 'text-ink-400';

  return (
    <motion.div
      aria-label={`${stat.label}: ${stat.value}${stat.of ? ` ${stat.of}` : ''}. ${change.text} in the ${compareLabel}.`}
      initial={prefersReduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={prefersReduced ? { duration: 0 } : { duration: 0.3, delay: Math.min(index, 8) * 0.04, ease: KH_EASE }}
      className="relative p-6 min-w-0"
    >
      <div className="flex items-center gap-2">
        <h3 className="text-[0.75rem] font-semibold text-ink-500 uppercase tracking-wide truncate flex-1">
          {stat.label}
        </h3>
        <button
          type="button"
          onMouseEnter={() => setDefOpen(true)}
          onMouseLeave={() => setDefOpen(false)}
          onFocus={() => setDefOpen(true)}
          onBlur={() => setDefOpen(false)}
          onClick={() => setDefOpen(o => !o)}
          aria-label={`What counts as ${stat.label}`}
          className="shrink-0 text-ink-300 hover:text-brand-600 transition-colors cursor-help"
        >
          <Info size={14} />
        </button>
        {defOpen && (
          <div className="absolute right-4 top-10 z-30 w-64 rounded-lg border border-canvas-border bg-canvas-elevated p-3 shadow-[0_8px_24px_-6px_rgba(15,7,32,0.14)]">
            <p className="text-[0.75rem] text-ink-700 leading-relaxed">
              <span className="font-semibold text-ink-900">Counts:</span> {stat.counts}
            </p>
            {stat.excludes && (
              <p className="mt-1.5 text-[0.75rem] text-ink-500 leading-relaxed">
                <span className="font-semibold text-ink-700">Doesn't count:</span> {stat.excludes}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 text-[2.25rem] font-semibold leading-none tracking-[-0.03em] tabular-nums text-ink-900">
        <KpiCountUp value={String(stat.value)} delay={120 + index * 70} />
      </div>
      {/* Reserved, so the change line lands on the same baseline in all four
          cells whether or not the metric has a denominator to print. */}
      <p className="mt-2 h-5 text-[0.8125rem] text-ink-500 truncate">{stat.of ?? ''}</p>

      <p className={`mt-2 text-[0.8125rem] font-medium ${changeTone} truncate`}>{change.text}</p>
    </motion.div>
  );
}

export default function UsageKpiRow({ stats, rangeDays, asOf, endsAtAnchor = true }: {
  stats: UsageStat[];
  rangeDays: number;
  asOf?: string;
  endsAtAnchor?: boolean;
}) {
  const compareLabel = `previous ${rangeDays} ${rangeDays === 1 ? 'day' : 'days'}`;
  return (
    <div>
      <div className={`${CARD_BASE} grid grid-cols-2 xl:grid-cols-4 divide-x divide-y xl:divide-y-0 divide-canvas-border`}>
        {stats.map((s, i) => (
          <UsageKpiCell key={s.key} stat={s} index={i} compareLabel={compareLabel} />
        ))}
      </div>
      <p className="mt-3 text-[0.75rem] text-ink-400">
        {asOf
          ? endsAtAnchor
            ? `The ${rangeDays} days up to ${asOf}. Each change is against the ${rangeDays} days before that.`
            : `The ${rangeDays} days ending ${asOf}. Each change is against the ${rangeDays} days before that.`
          : `Each change is against the previous ${rangeDays} days.`}
      </p>
    </div>
  );
}
