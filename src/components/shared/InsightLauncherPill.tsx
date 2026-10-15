// ─── Insight launcher pill — the compact cost gate in header chrome ─────────
//
// A scope whose insights span the whole surface (an engagement, the portfolio)
// gates generation from its header chrome, not from inside any one tab. The
// pill walks the run's phases honestly in ~300px: named pipeline pass while
// generating, count + severity mix when done (never a bare count), compliant
// receipt on a clean scan, retry with "unanalyzed" framing on failure.
//
// Extracted from EngagementOverviewView so the Engagement Library's portfolio
// scan is the same gesture — one launcher grammar at every altitude.

import { motion, AnimatePresence } from 'motion/react';
import { Loader2, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import type { InsightStackRun } from './useInsightStackRun';

export default function InsightLauncherPill({ run, onOpen, idleTitle, compact }: {
  run: InsightStackRun;
  /** Open the results surface (the insight stack drawer). */
  onOpen: () => void;
  /** The idle pill's cost-gate tooltip — worded for this launcher's scope. */
  idleTitle: string;
  /** Idle as an icon button that widens to its full label on hover / focus
   *  (Engagement Library header, user ask 8 Oct). */
  compact?: boolean;
}) {
  const { phase, step, steps, outcome, stack } = run;

  if (phase === 'generating') {
    const shown = outcome === 'empty' ? [...steps.slice(0, -1), 'Deciding what needs to be raised'] : steps;
    const label = shown[Math.min(step, shown.length - 1)]!;
    return (
      <div className="w-[300px] rounded-xl border border-brand-200/70 bg-brand-50/50 px-3 py-2" role="status" aria-live="polite">
        <div className="flex items-center gap-1.5">
          <Loader2 size={12} className="animate-spin text-brand-700 shrink-0" aria-hidden="true" />
          <span className="text-[0.6875rem] font-bold text-brand-700">Generating AI insights</span>
          <span className="ml-auto text-[0.625rem] text-ink-400 tabular-nums">{Math.min(step + 1, shown.length)}/{shown.length}</span>
        </div>
        <AnimatePresence mode="wait">
          <motion.p
            key={label}
            initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.15 }}
            className="mt-0.5 text-[0.65625rem] text-ink-500 truncate"
          >
            {label}…
          </motion.p>
        </AnimatePresence>
      </div>
    );
  }

  if (phase === 'generated' && stack) {
    const high = stack.filter(i => i.severity === 'high').length;
    const med = stack.filter(i => i.severity === 'med').length;
    const low = stack.filter(i => i.severity === 'low').length;
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          type="button" onClick={onOpen}
          className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50/60 px-3 h-9 text-[0.78125rem] font-semibold text-brand-700 hover:bg-brand-50 hover:border-brand-300 transition-colors cursor-pointer"
        >
          <Sparkles size={13} aria-hidden="true" /> AI insights
          <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-brand-600 text-white text-[0.625rem] font-bold tabular-nums">{stack.length}</span>
        </button>
        <span className="text-[0.625rem] text-ink-400 tabular-nums">{high} High · {med} Medium · {low} Low</span>
      </div>
    );
  }

  if (phase === 'empty') {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          type="button" onClick={onOpen}
          className="inline-flex items-center gap-1.5 rounded-lg border border-compliant-200 bg-compliant-50/60 px-3 h-9 text-[0.78125rem] font-semibold text-compliant-700 hover:bg-compliant-50 transition-colors cursor-pointer"
        >
          <ShieldCheck size={13} aria-hidden="true" /> Scan clean
        </button>
        <span className="text-[0.625rem] text-ink-400">Nothing to raise · cached for this session</span>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          type="button" onClick={run.run}
          className="inline-flex items-center gap-1.5 rounded-lg border border-risk/25 bg-risk-50 px-3 h-9 text-[0.75rem] font-semibold text-risk hover:bg-risk-50/70 transition-colors cursor-pointer"
        >
          <RefreshCw size={12} aria-hidden="true" /> Retry generation
        </button>
        <span className="text-[0.625rem] text-risk-700">Engine stopped — scope unanalyzed · not billed</span>
      </div>
    );
  }

  // Idle — the cost gate, compressed. The full explainer rides the tooltip.
  if (compact) {
    // A fixed 36px slot; the button grows leftward over it, so widening never
    // moves the header (a moving target loses the hover and flickers).
    return (
      <span className="relative block w-9 h-9 shrink-0">
      <button
        type="button" onClick={run.run}
        title={idleTitle}
        aria-label="Generate AI insights"
        className="group absolute right-0 top-0 z-10 inline-flex items-center rounded-lg bg-brand-600 text-white h-9 px-[11px] text-[0.78125rem] font-semibold hover:bg-brand-500 focus-visible:bg-brand-500 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      >
        <Sparkles size={14} aria-hidden="true" className="shrink-0" />
        <span aria-hidden="true"
          className="overflow-hidden whitespace-nowrap max-w-0 opacity-0 group-hover:max-w-[11rem] group-hover:opacity-100 group-hover:ml-1.5 group-focus-visible:max-w-[11rem] group-focus-visible:opacity-100 group-focus-visible:ml-1.5 transition-[max-width,opacity,margin] duration-200 ease-out motion-reduce:transition-none">
          Generate AI insights
        </span>
      </button>
      </span>
    );
  }
  return (
    <button
      type="button" onClick={run.run}
      title={idleTitle}
      className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white px-3.5 h-9 text-[0.78125rem] font-semibold hover:bg-brand-500 transition-colors cursor-pointer"
    >
      <Sparkles size={13} aria-hidden="true" /> Generate AI insights
    </button>
  );
}
