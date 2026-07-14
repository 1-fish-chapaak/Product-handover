/**
 * Platform Usage — the hero.
 *
 * Four redesigns of this page failed for the same reason, and it was never the
 * chart type: the Overview carried something like 120 discrete elements. Four
 * sparklines with date labels under them, five legend keys, thirty-one hour-bars
 * each with its own number, eight ranked rows, three finding rows, four tooltip
 * triggers, a footnote beneath a footnote. Every "clarifying" caption I added
 * made it worse, because the failure was never a missing explanation — it was
 * that nothing on the page was louder than anything else, so the eye had nowhere
 * to land and the reader had to consume all of it to learn any of it.
 *
 * So this is the one thing that dominates. An admin comes here to ask "is the
 * licence worth it", and that question has a single number for an answer: the
 * share of paid seats that did real work. It gets 72px, a track to sit in, and
 * the benchmark that makes it mean something. Everything else on the page is
 * subordinate to it — literally, in type size.
 *
 * One finding rides alongside, and only if it fires. Not three. Three findings
 * plus a headline is a KPI band, and there is already a KPI band underneath.
 */

import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { KH_EASE } from './usageTokens';

export interface VerdictInput {
  rangeDays: number;
  seats: number;
  activeUsers: number;
  priorActiveUsers: number;
  neverSignedIn: number;
  dormant: number;
  pendingInvites: number;
  topArea: string | null;
  secondArea: string | null;
  topTwoShare: number;
  aiSharePct: number;
}

/** A healthy share of licensed seats in active use. GitHub publishes 60% for
 *  Copilot; it is the only public benchmark for exactly this question, and it
 *  gives "71%" something to mean. */
export const HEALTHY_SEAT_USE = 60;

export default function UsageVerdict({ v, onSeeWho }: {
  v: VerdictInput;
  onSeeWho: () => void;
}) {
  const prefersReduced = useReducedMotion();
  const pct = v.seats > 0 ? Math.round((v.activeUsers / v.seats) * 100) : 0;
  const healthy = pct >= HEALTHY_SEAT_USE;
  const diff = v.activeUsers - v.priorActiveUsers;
  const idle = v.neverSignedIn + v.dormant;

  return (
    <motion.section
      initial={prefersReduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={prefersReduced ? { duration: 0 } : { duration: 0.35, ease: KH_EASE }}
      aria-label="Licence use"
      className="flex flex-col lg:flex-row lg:items-end gap-8 lg:gap-14"
    >
      {/* The number. Everything else on this page is smaller than this on
          purpose — that is what makes it the answer rather than a statistic. */}
      <div className="shrink-0">
        <div className="flex items-baseline gap-3">
          <span
            className={`text-[4.5rem] font-semibold leading-none tracking-[-0.04em] tabular-nums ${
              healthy ? 'text-ink-900' : 'text-mitigated-700'
            }`}
          >
            {pct}%
          </span>
          {diff !== 0 && (
            <span className={`text-[0.9375rem] font-semibold tabular-nums ${
              diff > 0 ? 'text-compliant-700' : 'text-risk-700'
            }`}>
              {diff > 0 ? '+' : '−'}{Math.abs(diff)}
            </span>
          )}
        </div>
        <p className="mt-3 text-[0.9375rem] text-ink-700">
          of your <strong className="font-semibold text-ink-900">{v.seats} paid seats</strong> did real work
        </p>
      </div>

      <div className="flex-1 min-w-0 pb-1">
        {/* The track. The tick is the benchmark, and the caption says what the
            benchmark IS — a bar with no reference point is decoration. */}
        <div className="relative">
          <div className="h-2.5 rounded-full bg-ink-900/[0.07] overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${healthy ? 'bg-brand-600' : 'bg-mitigated-700'}`}
              initial={prefersReduced ? false : { width: 0 }}
              animate={{ width: `${Math.max(2, pct)}%` }}
              transition={prefersReduced ? { duration: 0 } : { type: 'spring', stiffness: 220, damping: 30, delay: 0.15 }}
            />
          </div>
          <span
            className="absolute -top-1 w-px h-[1.125rem] bg-ink-400"
            style={{ left: `${HEALTHY_SEAT_USE}%` }}
            aria-hidden
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <p className="text-[0.875rem] text-ink-600">
            <strong className="font-semibold text-ink-900">{v.activeUsers} of {v.seats} people</strong>{' '}
            used it in the last {v.rangeDays} days.{' '}
            <span className={healthy ? 'text-compliant-700 font-medium' : 'text-mitigated-700 font-medium'}>
              {healthy ? `Above` : `Below`} the {HEALTHY_SEAT_USE}% mark
            </span>{' '}
            <span className="text-ink-400">— the level a healthy licence sits at.</span>
          </p>
        </div>

        {/* One finding, and only if it fires. */}
        {idle > 0 && (
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border-l-2 border-mitigated-700 bg-mitigated-700/[0.05] py-3 pl-4 pr-3">
            <p className="text-[0.875rem] text-ink-700 flex-1 min-w-0">
              <strong className="font-semibold text-ink-900">{idle} {idle === 1 ? 'seat is' : 'seats are'} idle</strong>
              <span className="text-ink-500">
                {' — '}
                {[
                  v.neverSignedIn > 0 ? `${v.neverSignedIn} never signed in` : null,
                  v.dormant > 0 ? `${v.dormant} quiet for 30+ days` : null,
                ].filter(Boolean).join(', ')}
              </span>
            </p>
            <button
              type="button"
              onClick={onSeeWho}
              className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3.5 rounded-md bg-brand-600 hover:bg-brand-500 active:bg-brand-800 text-white text-[0.8125rem] font-semibold transition-colors cursor-pointer"
            >
              See who
              <ArrowRight size={14} />
            </button>
          </div>
        )}
      </div>
    </motion.section>
  );
}
