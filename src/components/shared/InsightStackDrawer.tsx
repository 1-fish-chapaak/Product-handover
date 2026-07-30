// ─── Insight stack drawer — the engagement's insight report, one slide-over away
//
// The header launcher gates generation; this drawer is where the results live.
// Same anatomy as the AI Insights tab it replaces (an anchor-grouped directory
// of LayeredInsightCards) housed in the same slide-over gesture as the Controls
// tab's "Insight detail" — so "insights appear on the right" is one consistent
// motion across the app, whatever altitude they anchor at.
//
// The drawer renders every phase of the run except idle (it only opens once a
// run exists): the honest pipeline while generating, the stack when generated,
// the compliant clean-scan receipt when empty, the frozen pipeline on error.

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, X, Check, RefreshCw, ShieldCheck, AlertTriangle, Loader2 } from 'lucide-react';
import InsightStack from './InsightStack';
import { PipelineChecklist } from './InsightGenerator';
import type { InsightStackRun } from './useInsightStackRun';

export default function InsightStackDrawer({ open, onClose, subjectLabel, scopeLabel, run }: {
  open: boolean;
  onClose: () => void;
  /** The engagement name — drawer header + clean-scan copy. */
  subjectLabel: string;
  /** Trailing phrase for the stack header, e.g. "across this engagement". */
  scopeLabel?: string;
  run: InsightStackRun;
}) {
  const { phase, step, steps, outcome, failedStep, stack } = run;

  // Escape closes (additive over the sibling InsightDrawer, which lacks it).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // A clean-bound run can't honestly end on "Writing N insights".
  const shownSteps = outcome === 'empty' ? [...steps.slice(0, -1), 'Deciding what needs to be raised'] : steps;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100]">
          <motion.div
            className="absolute inset-0 bg-ink-900/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: '105%' }} animate={{ x: 0 }} exit={{ x: '105%' }}
            transition={{ duration: 0.24, ease: [0.2, 0, 0, 1] }}
            className="absolute right-0 top-0 h-full w-full sm:w-[min(760px,94vw)] bg-canvas border-l border-canvas-border shadow-2xl flex flex-col"
            role="dialog" aria-label="Engagement AI insights"
          >
            <div className="shrink-0 flex items-center gap-2 px-5 py-3.5 border-b border-canvas-border bg-canvas-elevated">
              <Sparkles size={14} aria-hidden="true" className="text-brand-600" />
              <span className="text-[0.8125rem] font-bold text-ink-900">AI insights</span>
              <span className="text-[0.71875rem] text-ink-400 truncate">· {subjectLabel}</span>
              <button
                type="button" onClick={onClose} aria-label="Close"
                className="ml-auto p-1.5 rounded-lg text-ink-500 hover:text-ink-800 hover:bg-canvas transition-colors cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              {/* ── Generating — the same honest pipeline, at reading size ── */}
              {phase === 'generating' && (
                <div className="rounded-2xl border border-brand-200/70 bg-gradient-to-b from-brand-50/45 to-canvas-elevated p-4 sm:p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="size-6 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center">
                      <Loader2 size={13} className="animate-spin" />
                    </span>
                    <span className="text-[0.625rem] font-bold uppercase tracking-wider text-brand-700">Generating insights · {subjectLabel}</span>
                  </div>
                  <PipelineChecklist steps={shownSteps} current={step} />
                </div>
              )}

              {/* ── Generated — the full anchor-grouped directory ── */}
              {phase === 'generated' && stack && (
                <div className="space-y-2">
                  <InsightStack
                    insights={stack}
                    scopeLabel={scopeLabel ?? ''}
                    foldLedger={false}
                    groupByAnchor
                  />
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-[0.65625rem] text-ink-400 flex items-center gap-1"><Check size={11} className="text-compliant" /> Generated just now · cached for this session</span>
                    <button type="button" onClick={run.run} className="ml-auto inline-flex items-center gap-1 text-[0.6875rem] font-medium text-brand-700 hover:text-brand-600 cursor-pointer">
                      <RefreshCw size={11} /> Regenerate
                    </button>
                  </div>
                </div>
              )}

              {/* ── Empty — a clean scan is a result, so it gets the drawer too ── */}
              {phase === 'empty' && (
                <div className="rounded-2xl border border-compliant-200 bg-gradient-to-b from-compliant-50/40 to-canvas-elevated p-4 sm:p-5">
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="size-6 rounded-lg bg-compliant-50 text-compliant-700 flex items-center justify-center">
                      <ShieldCheck size={13} aria-hidden="true" />
                    </span>
                    <span className="text-[0.625rem] font-bold uppercase tracking-wider text-compliant-700">Scan complete · nothing to raise</span>
                    <span className="ml-auto text-[0.65625rem] text-ink-400 tabular-nums">{steps.length} checks · just now</span>
                  </div>
                  <p className="text-[0.8125rem] font-bold text-ink-900 leading-snug">
                    No insights for {subjectLabel} right now — and that is the finding.
                  </p>
                  <p className="text-[0.75rem] text-ink-600 leading-relaxed mt-1">
                    I ran the full scan and every correlation pass completed: no shared driver, no repeating exception, no consequence worth pricing. A clean scan is a point-in-time result — new runs, findings, or scope changes can surface insights later.
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <span className="text-[0.65625rem] text-ink-400 flex items-center gap-1">
                      <Check size={11} className="text-compliant" /> Cached for this session
                    </span>
                    <button type="button" onClick={run.run} className="ml-auto inline-flex items-center gap-1 text-[0.6875rem] font-medium text-brand-700 hover:text-brand-600 cursor-pointer">
                      <RefreshCw size={11} /> Check again
                    </button>
                  </div>
                </div>
              )}

              {/* ── Error — frozen pipeline; can only appear on a mid-drawer
                    regenerate, but a failure must never read as "no findings" ── */}
              {phase === 'error' && (
                <div className="rounded-2xl border border-risk/25 bg-gradient-to-b from-risk-50/50 to-canvas-elevated p-4 sm:p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="size-6 rounded-lg bg-risk-50 text-risk flex items-center justify-center">
                      <AlertTriangle size={13} aria-hidden="true" />
                    </span>
                    <span className="text-[0.625rem] font-bold uppercase tracking-wider text-risk-700">Generation failed · {subjectLabel}</span>
                  </div>
                  <div className="mb-3">
                    <PipelineChecklist steps={steps} current={failedStep} failedAt={failedStep} />
                  </div>
                  <p className="text-[0.75rem] text-ink-700 leading-relaxed">
                    The engine stopped before reaching a conclusion, so this is not a clean result — treat {subjectLabel} as unanalyzed, not insight-free. This attempt wasn’t billed.
                  </p>
                  <div className="flex items-center gap-3 mt-3">
                    <button type="button" onClick={run.run} className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 text-white px-3 h-8 text-[0.75rem] font-semibold hover:bg-brand-500 transition-colors cursor-pointer">
                      <RefreshCw size={12} /> Retry generation
                    </button>
                    <span className="text-[0.65625rem] text-ink-400">Retrying is safe — your scope data is unchanged.</span>
                  </div>
                </div>
              )}
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
