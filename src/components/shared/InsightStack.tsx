// ─── Insight Stack — the many-insights experience ──────────────────────────
//
// One AI insight card is a full page of reasoning; fifteen of them, all equal,
// is the anti-pattern the PRD forbids ("the rollup lists 12 findings, the lead
// runs out of time, the sign-off-changing finding is never seen"). The stack
// spends its attention budget deliberately, in three tiers:
//
//   HERO    — the top-ranked insight, expanded. The one thing the lead can't miss.
//   TAIL    — the next few, calm collapsed rows the eye can scan.
//   LEDGER  — everything below the fold, behind an HONEST count row that always
//             states how many High-severity items it hides (usually "0 High" —
//             which is assurance, not noise). Expands to the same calm rows.
//
// Recency never outranks materiality: freshness sorts WITHIN a severity band,
// not above it.
//
// PREVIEW mode (`previewCount` + `onSeeAll`): a surface like the engagement
// Overview shows only the hero and a single honest "See all N insights" CTA —
// every other interaction (chips included) routes to the full AI Insights tab
// instead of filtering a list the user can't see.
//
// Presentational only — the caller supplies the built insights (from
// buildLayeredInsight); the stack owns open/filter state and nothing else.

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowUpRight, Brain, Sparkles, ChevronDown } from 'lucide-react';
import type { LayeredInsight, CheckMoreOption, InsightLayer, VerdictTone, InsightFreshness } from '../../data/layeredInsights';
import LayeredInsightCard from './LayeredInsightCard';

// The attention budget: 1 expanded hero + this many scannable rows before the
// ledger fold. Everything past it still renders — one click away, never hidden.
const TAIL_COUNT = 3;

// Severity → sort rank + summary-chip styling.
const SEV: Record<LayeredInsight['severity'], { rank: number; label: string; pill: string; dot: string }> = {
  high: { rank: 0, label: 'High', pill: 'bg-risk-50 text-risk border-risk/25', dot: 'bg-risk' },
  med:  { rank: 1, label: 'Medium', pill: 'bg-mitigated-50 text-mitigated-700 border-mitigated-200', dot: 'bg-mitigated-500' },
  low:  { rank: 2, label: 'Low', pill: 'bg-compliant-50 text-compliant-700 border-compliant-200', dot: 'bg-compliant' },
};
const TONE_RANK: Record<VerdictTone, number> = { negative: 0, caution: 1, positive: 2 };
// A rollup reads top-down: the engagement escalation, then the SOPs and risks
// under it, then the controls under those.
const LAYER_RANK: Record<InsightLayer, number> = { engagement: 0, sop: 1, risk: 2, control: 3 };
const LAYER_GROUP_LABEL: Record<InsightLayer, string> = {
  engagement: 'Anchored at engagement', sop: 'Anchored at SOP', risk: 'Anchored at risk', control: 'Anchored at control',
};
// Freshness is a tiebreaker INSIDE a severity+layer band — a new Low must never
// displace a known High. Escalated outranks new: worse beats first-seen.
const FRESH_RANK: Record<InsightFreshness, number> = { escalated: 0, new: 1, recurring: 2, resolved: 3 };
const freshRank = (i: LayeredInsight) => (i.freshness ? FRESH_RANK[i.freshness] : 2.5);

function confOf(i: LayeredInsight): number {
  if (i.confidenceOverride != null) return i.confidenceOverride;
  const f = i.factors;
  return f.frequency * f.sourceDiversity * f.recency * f.businessImpact;
}

export default function InsightStack({
  insights, scopeLabel = '', onCheckMore, initialOpen = 1,
  previewCount, onSeeAll, foldLedger = true, groupByAnchor = false,
}: {
  insights: LayeredInsight[];
  /** Trailing phrase for the header, e.g. "across this engagement". */
  scopeLabel?: string;
  onCheckMore?: (opt: CheckMoreOption) => void;
  /** How many top rows to open on first render (default 1 — the hero). */
  initialOpen?: number;
  /** Preview mode: render only the top N cards + a "See all" CTA (needs `onSeeAll`). */
  previewCount?: number;
  /** Navigate to the surface that shows the full stack (the AI Insights tab). */
  onSeeAll?: () => void;
  /** Fold everything past hero+tail into the ledger (default). The dedicated
   *  AI Insights tab turns this off — you asked for all of them, you get all. */
  foldLedger?: boolean;
  /** Read the stack as a directory of anchors: grouped engagement → SOP →
   *  risk → control with group labels (the AI Insights tab's B+C reading),
   *  severity-ranked within each group. Disables the ledger fold. */
  groupByAnchor?: boolean;
}) {
  // Most-severe first; within a severity, escalation altitude, then what
  // changed, then finding tone, then confidence. Stable across renders.
  // Anchor-grouped surfaces flip the first two keys: level, then severity.
  const sorted = useMemo(
    () => [...insights].sort(
      (a, b) =>
        (groupByAnchor
          ? LAYER_RANK[a.layer] - LAYER_RANK[b.layer] || SEV[a.severity].rank - SEV[b.severity].rank
          : SEV[a.severity].rank - SEV[b.severity].rank || LAYER_RANK[a.layer] - LAYER_RANK[b.layer]) ||
        freshRank(a) - freshRank(b) ||
        TONE_RANK[a.verdict.tone] - TONE_RANK[b.verdict.tone] ||
        confOf(b) - confOf(a),
    ),
    [insights, groupByAnchor],
  );

  const [openIds, setOpenIds] = useState<Set<string>>(
    () => new Set(sorted.slice(0, Math.max(0, initialOpen)).map(i => i.id)),
  );
  const [ledgerOpen, setLedgerOpen] = useState(false);

  const toggle = (id: string) =>
    setOpenIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  // Preview only when there is actually more than the preview shows.
  const preview = !!onSeeAll && previewCount != null && previewCount < sorted.length;

  const counts = {
    high: sorted.filter(i => i.severity === 'high').length,
    med: sorted.filter(i => i.severity === 'med').length,
    low: sorted.filter(i => i.severity === 'low').length,
  };

  // Split into the visible tier and the ledger.
  const foldAt = 1 + TAIL_COUNT;
  // A ledger of one is sillier than one extra row — fold only when it earns it.
  // Anchor-grouped surfaces never fold: a directory hides nothing.
  const folds = !preview && !groupByAnchor && foldLedger && sorted.length > foldAt + 1;
  const visible = preview ? sorted.slice(0, previewCount) : folds ? sorted.slice(0, foldAt) : sorted;
  const ledger = folds ? sorted.slice(foldAt) : [];
  const ledgerHigh = ledger.filter(i => i.severity === 'high').length;
  const ledgerMed = ledger.filter(i => i.severity === 'med').length;
  const ledgerLow = ledger.filter(i => i.severity === 'low').length;

  if (sorted.length === 0) return null;

  return (
    <section aria-label="AI insights">
      {/* Rollup header — title · engine badge */}
      <div className="flex items-start gap-3 flex-wrap">
        <span className="size-8 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
          <Brain size={16} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[14px] font-bold text-ink-900 leading-tight">AI insights {scopeLabel}</h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 text-brand-700 px-2 py-0.5 text-[9px] font-bold border border-brand-100">
              <Sparkles size={9} aria-hidden="true" /> Insight Memory Engine
            </span>
          </div>
        </div>
      </div>

      {/* Hero + tail — the attention budget, spent. Anchor-grouped surfaces
          read as a directory: a group label opens each anchor level. */}
      <motion.ul
        initial={false}
        className="mt-3 flex flex-col gap-1.5"
      >
        {visible.map((insight, i) => {
          const newGroup = groupByAnchor && (i === 0 || visible[i - 1]!.layer !== insight.layer);
          const groupCount = groupByAnchor ? sorted.filter(s => s.layer === insight.layer).length : 0;
          return (
            <li key={insight.id}>
              {newGroup && (
                <div className={`flex items-center gap-2 px-0.5 ${i === 0 ? 'mb-1.5' : 'mt-3 mb-1.5'}`}>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">
                    {LAYER_GROUP_LABEL[insight.layer]}
                  </span>
                  <span className="text-[10px] font-bold text-brand-700 tabular-nums">· {groupCount}</span>
                  <span className="flex-1 h-px bg-canvas-border" aria-hidden="true" />
                </div>
              )}
              <LayeredInsightCard
                insight={insight}
                onCheckMore={onCheckMore}
                collapsible
                open={openIds.has(insight.id)}
                onToggleOpen={() => toggle(insight.id)}
              />
            </li>
          );
        })}
      </motion.ul>

      {/* Preview CTA — the one row that replaces tail + ledger on the Overview.
          Carries the honest severity mix of what it leads to, never a bare count. */}
      {preview && (
        <button
          type="button" onClick={onSeeAll}
          className="mt-1.5 group flex w-full items-center gap-2.5 rounded-xl border border-brand-200 bg-brand-50/40 px-3.5 py-2.5 text-left hover:bg-brand-50 hover:border-brand-300 transition-colors cursor-pointer"
        >
          <Sparkles size={14} className="shrink-0 text-brand-600" aria-hidden="true" />
          <span className="text-[0.78125rem] font-semibold text-brand-700">See all {sorted.length} insights</span>
          <span className="text-[0.6875rem] text-ink-400 tabular-nums">
            {counts.high} High · {counts.med} Medium · {counts.low} Low
          </span>
          <ArrowUpRight size={14} className="ml-auto shrink-0 text-brand-400 group-hover:text-brand-600 transition-colors" aria-hidden="true" />
        </button>
      )}

      {/* The ledger — everything below the fold behind an honest count. Always
          states its High count, because "10 more · 0 High" is assurance while
          a bare "10 more" is a place findings go to die. */}
      {ledger.length > 0 && (
        <div className="mt-1.5">
          <button
            type="button" onClick={() => setLedgerOpen(o => !o)} aria-expanded={ledgerOpen}
            className="group flex w-full items-center gap-2.5 rounded-xl border border-dashed border-canvas-border bg-canvas px-3.5 py-2.5 text-left hover:border-brand-300 transition-colors cursor-pointer"
          >
            <ChevronDown size={15} className={`shrink-0 text-ink-300 group-hover:text-ink-500 transition-transform ${ledgerOpen ? '' : '-rotate-90'}`} aria-hidden="true" />
            <span className="text-[12.5px] font-semibold text-ink-600 group-hover:text-brand-700 transition-colors">
              {ledger.length} more insight{ledger.length === 1 ? '' : 's'}
            </span>
            <span className="text-[11px] text-ink-400 tabular-nums">
              {ledgerHigh} High · {ledgerMed} Medium · {ledgerLow} Low
            </span>
            {ledgerHigh === 0 && (
              <span className="hidden sm:inline text-[10px] text-compliant-700 font-semibold ml-auto shrink-0">Nothing severe below the fold.</span>
            )}
          </button>
          <AnimatePresence initial={false}>
            {ledgerOpen && (
              <motion.ul
                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden flex flex-col gap-1.5 mt-1.5"
              >
                {ledger.map((insight) => (
                  <li key={insight.id}>
                    <LayeredInsightCard
                      insight={insight}
                      onCheckMore={onCheckMore}
                      collapsible
                      open={openIds.has(insight.id)}
                      onToggleOpen={() => toggle(insight.id)}
                    />
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}
