// ─── Insight Stack — the many-insights experience ──────────────────────────
//
// One AI insight card is a full page of reasoning; ten of them, all expanded,
// is a wall. This stack renders a set of LayeredInsights as an accordion: a
// rollup header that says how many there are and how they break down by
// severity, then one collapsible row per insight. The most-severe row opens by
// default; the rest sit calm and scannable until the auditor drills in. Brand
// chrome lives only on the open row (LayeredInsightCard handles that), so a long
// stack reads deliberate, not shouty.
//
// Presentational only — the caller supplies the built insights (from
// buildLayeredInsight) and the stack owns nothing but open/closed state.

import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Brain, Sparkles, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import type { LayeredInsight, CheckMoreOption, InsightLayer, VerdictTone } from '../../data/layeredInsights';
import LayeredInsightCard from './LayeredInsightCard';

// Severity → sort rank + summary-chip styling.
const SEV: Record<LayeredInsight['severity'], { rank: number; label: string; pill: string; dot: string }> = {
  high: { rank: 0, label: 'High', pill: 'bg-risk-50 text-risk border-risk/25', dot: 'bg-risk' },
  med:  { rank: 1, label: 'Medium', pill: 'bg-mitigated-50 text-mitigated-700 border-mitigated-200', dot: 'bg-mitigated-500' },
  low:  { rank: 2, label: 'Low', pill: 'bg-compliant-50 text-compliant-700 border-compliant-200', dot: 'bg-compliant' },
};
const TONE_RANK: Record<VerdictTone, number> = { negative: 0, caution: 1, positive: 2 };
// A rollup reads top-down: the engagement escalation, then the risks under it,
// then the controls under those.
const LAYER_RANK: Record<InsightLayer, number> = { engagement: 0, risk: 1, control: 2 };

function confOf(i: LayeredInsight): number {
  if (i.confidenceOverride != null) return i.confidenceOverride;
  const f = i.factors;
  return f.frequency * f.sourceDiversity * f.recency * f.businessImpact;
}

export default function InsightStack({
  insights, scopeLabel = '', onCheckMore, initialOpen = 1,
}: {
  insights: LayeredInsight[];
  /** Trailing phrase for the header, e.g. "across this engagement". */
  scopeLabel?: string;
  onCheckMore?: (opt: CheckMoreOption) => void;
  /** How many top rows to open on first render (default 1 — the lead). */
  initialOpen?: number;
}) {
  // Most-severe first; within a severity, escalation altitude then finding tone
  // then confidence. A stable order the auditor can trust across renders.
  const sorted = useMemo(
    () => [...insights].sort(
      (a, b) =>
        SEV[a.severity].rank - SEV[b.severity].rank ||
        LAYER_RANK[a.layer] - LAYER_RANK[b.layer] ||
        TONE_RANK[a.verdict.tone] - TONE_RANK[b.verdict.tone] ||
        confOf(b) - confOf(a),
    ),
    [insights],
  );

  const [openIds, setOpenIds] = useState<Set<string>>(
    () => new Set(sorted.slice(0, Math.max(0, initialOpen)).map(i => i.id)),
  );

  const toggle = (id: string) =>
    setOpenIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  const setAll = (open: boolean) => setOpenIds(open ? new Set(sorted.map(i => i.id)) : new Set());
  const allOpen = openIds.size === sorted.length && sorted.length > 0;

  const counts = {
    high: sorted.filter(i => i.severity === 'high').length,
    med: sorted.filter(i => i.severity === 'med').length,
    low: sorted.filter(i => i.severity === 'low').length,
  };
  const doNow = sorted.reduce((s, i) => s + (i.recommendations?.filter(r => r.priority === 'do-now').length ?? 0), 0);

  if (sorted.length === 0) return null;

  return (
    <section aria-label="AI insights">
      {/* Rollup header — count · severity mix · one expand/collapse control */}
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
          <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
            <span className="text-[11px] text-ink-500 tabular-nums font-medium">{sorted.length} insight{sorted.length === 1 ? '' : 's'}</span>
            <span className="text-ink-300" aria-hidden="true">·</span>
            {counts.high > 0 && <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${SEV.high.pill}`}><span className={`size-1 rounded-full ${SEV.high.dot}`} /> {counts.high} High</span>}
            {counts.med > 0 && <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${SEV.med.pill}`}><span className={`size-1 rounded-full ${SEV.med.dot}`} /> {counts.med} Medium</span>}
            {counts.low > 0 && <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${SEV.low.pill}`}><span className={`size-1 rounded-full ${SEV.low.dot}`} /> {counts.low} Low</span>}
            {doNow > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-risk-50 text-risk px-2 py-0.5 text-[9px] font-bold border border-risk/20">{doNow} do now</span>}
          </div>
        </div>
        {sorted.length > 1 && (
          <button
            type="button" onClick={() => setAll(!allOpen)}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-canvas-border bg-canvas-elevated px-2.5 h-8 text-[11.5px] font-semibold text-ink-600 hover:border-brand-300 hover:text-brand-700 transition-colors cursor-pointer"
          >
            {allOpen ? <ChevronsDownUp size={13} aria-hidden="true" /> : <ChevronsUpDown size={13} aria-hidden="true" />}
            {allOpen ? 'Collapse all' : 'Expand all'}
          </button>
        )}
      </div>

      {/* The rows */}
      <motion.ul
        initial={false}
        className="mt-3 flex flex-col gap-1.5"
      >
        {sorted.map((insight) => (
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
    </section>
  );
}
