// ─── Engagement Execution V2 — AI insight roll-up ─────────────────────────
// The engagement-level (portfolio) altitude of the Insight Memory Engine: what
// the engine has surfaced across this engagement's processes, rolled up for the
// engagement lead. Reads the token-agnostic insightMemory data layer but renders
// in THIS module's palette (primary / text / surface / border-light + tailwind
// semantics) so it sits native beside the KPI cards.
//
// Honesty by design: no invented dollar totals — counts, confidence, and an
// explicit "early signal" note when a finding is backed by only a run or two.

import { useMemo } from 'react';
import { motion } from 'motion/react';
import { Brain, Sparkles, AlertTriangle, ArrowRight, Info } from 'lucide-react';
import {
  PROCESS_INSIGHTS, ENTERPRISE_CONTEXT, PATTERN_META, SEVERITY_LABEL,
  displayConfidencePct, type MemoryInsight, type InsightSeverity,
} from '../../data/insightMemory';
import InsightGenerator from '../shared/InsightGenerator';

const SEV_STYLE: Record<InsightSeverity, { pill: string; dot: string; rank: number }> = {
  high: { pill: 'bg-red-50 text-red-700', dot: 'bg-red-500', rank: 0 },
  med:  { pill: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500', rank: 1 },
  low:  { pill: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400', rank: 2 },
};

// Thin evidence = only a run or two, or a narrow set of sources. Surfaced as an
// explicit note rather than hidden — the honesty principle at the roll-up level.
function isLimited(i: MemoryInsight): boolean {
  return i.evidence.runsAnalysed <= 2 || i.factors.sourceDiversity < 0.55;
}

export default function EngagementInsightsRollup({ engagementName }: { engagementName?: string }) {
  const ranked = useMemo(
    () => [...PROCESS_INSIGHTS].sort(
      (a, b) =>
        SEV_STYLE[a.severity].rank - SEV_STYLE[b.severity].rank ||
        displayConfidencePct(b) - displayConfidencePct(a),
    ),
    [],
  );
  const top = ranked[0];
  const highCount = PROCESS_INSIGHTS.filter(i => i.severity === 'high').length;
  const pending = PROCESS_INSIGHTS.filter(i => i.approvalStatus === 'pending').length;

  const stats = [
    { label: 'Open insights', value: PROCESS_INSIGHTS.length, color: 'text-text' },
    { label: 'High severity', value: highCount, color: highCount > 0 ? 'text-red-700' : 'text-text' },
    { label: 'Awaiting review', value: pending, color: 'text-purple-700' },
    { label: 'In shared memory', value: ENTERPRISE_CONTEXT.length, color: 'text-emerald-700' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white rounded-2xl border border-border-light p-5 mb-5"
    >
      <div className="mb-5">
        <InsightGenerator
          layer="engagement"
          subjectId={engagementName ?? 'engagement'}
          subjectLabel={engagementName ?? 'this engagement'}
          flagship
        />
      </div>

      {/* Header */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className="p-2 rounded-lg bg-primary/10 shrink-0"><Brain size={16} className="text-primary" /></div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-[0.9375rem] font-bold text-text leading-tight">AI insights across this engagement</h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[0.5625rem] font-bold">
              <Sparkles size={9} /> Insight Memory Engine
            </span>
          </div>
          <p className="text-[0.6875rem] text-text-muted mt-0.5">
            Patterns the engine surfaced across {engagementName ?? 'this engagement'}’s processes — sorted by severity.
          </p>
        </div>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-4 gap-2.5 mb-4">
        {stats.map(s => (
          <div key={s.label} className="rounded-xl border border-border-light px-3.5 py-2.5">
            <span className={`text-[1.25rem] font-bold ${s.color} block tabular-nums`}>{s.value}</span>
            <span className="text-[0.5625rem] text-gray-400 font-medium">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Escalation — the one thing an engagement lead should act on */}
      {top && (
        <div className="rounded-xl border border-red-200 bg-red-50/50 p-4 mb-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-red-100 text-red-700 shrink-0"><AlertTriangle size={15} /></div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-[0.5625rem] font-bold uppercase tracking-wider text-red-700">Needs your decision</span>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.5625rem] font-bold ${SEV_STYLE[top.severity].pill}`}>
                  {SEVERITY_LABEL[top.severity]}
                </span>
              </div>
              <h3 className="text-[0.8125rem] font-semibold text-text leading-snug">{top.title}</h3>
              <p className="text-[0.6875rem] text-text-muted mt-1 tabular-nums">
                {top.scope} · {PATTERN_META[top.type].label} · {displayConfidencePct(top)}% confidence · {top.evidence.runsAnalysed} run{top.evidence.runsAnalysed === 1 ? '' : 's'}
                {isLimited(top) && <span className="text-amber-700 font-medium"> · early signal, treat as directional</span>}
              </p>
            </div>
            <button
              type="button"
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 text-[0.6875rem] font-semibold text-primary hover:bg-primary/5 cursor-pointer transition-colors"
            >
              Review <ArrowRight size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Next findings, compact */}
      <div className="flex flex-col">
        {ranked.slice(1, 4).map(i => (
          <div key={i.id} className="flex items-center gap-3 py-2.5 border-b border-border-light last:border-b-0">
            <span className={`size-1.5 rounded-full shrink-0 ${SEV_STYLE[i.severity].dot}`} />
            <div className="min-w-0 flex-1">
              <p className="text-[0.75rem] font-medium text-text truncate">{i.title}</p>
              <p className="text-[0.625rem] text-text-muted">{i.scope} · {PATTERN_META[i.type].label}</p>
            </div>
            <span className="shrink-0 text-[0.625rem] text-gray-400 tabular-nums">
              {displayConfidencePct(i)}% · {i.evidence.runsAnalysed} run{i.evidence.runsAnalysed === 1 ? '' : 's'}
            </span>
            <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[0.5625rem] font-bold ${SEV_STYLE[i.severity].pill}`}>
              {SEVERITY_LABEL[i.severity]}
            </span>
          </div>
        ))}
      </div>

      {ranked.length > 4 && (
        <p className="text-[0.6875rem] text-text-muted mt-3 flex items-center gap-1.5">
          <Info size={11} className="shrink-0" />
          {ranked.length - 4} more insight{ranked.length - 4 === 1 ? '' : 's'} · full detail and the approval gate live in each process’s AI Insights tab.
        </p>
      )}
    </motion.div>
  );
}
