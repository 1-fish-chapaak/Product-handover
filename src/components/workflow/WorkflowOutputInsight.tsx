// ─── Workflow Executor — single output insight ────────────────────────────
//
// One focused "what this run means" card, rendered between the results table
// and the run's action buttons. Distinct from the (removed) memory panel: this
// is the plain-language conclusion of THIS run's own output — the takeaway, the
// shape of the results, the one standout, the money at stake, the evidence and
// one next action. Presentational only; the caller derives `insight` from the
// run so the numbers always match the table above it.

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, TriangleAlert, DollarSign, ChevronDown } from 'lucide-react';

export type OutputInsightSeverity = 'High' | 'Medium' | 'Low';

export interface OutputInsightEvidenceRow {
  label: string;   // "DG-001 · Apex Industrial Supplies"
  detail: string;  // "$14,250.00 billed 2×"
  match: string;   // "97% match"
}

export interface OutputInsight {
  takeaway: string;        // one-line headline — the takeaway
  severity: OutputInsightSeverity;
  shape: string;           // reasoning — the shape of the results
  standout: string;        // the one thing worth noticing
  atStake: string;         // money / resource at stake + consequence
  evidence: OutputInsightEvidenceRow[];
}

const SEV: Record<OutputInsightSeverity, { pill: string; dot: string }> = {
  High:   { pill: 'bg-risk-50 text-risk border-risk/25', dot: 'bg-risk' },
  Medium: { pill: 'bg-mitigated-50 text-mitigated-700 border-mitigated-200', dot: 'bg-mitigated-500' },
  Low:    { pill: 'bg-canvas text-ink-500 border-canvas-border', dot: 'bg-ink-300' },
};

export default function WorkflowOutputInsight({ insight }: { insight: OutputInsight }) {
  const [showEvidence, setShowEvidence] = useState(false);
  const sev = SEV[insight.severity];

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-2xl border border-brand-200/70 bg-gradient-to-b from-brand-50/50 to-canvas-elevated overflow-hidden"
    >
      <div className="p-4">
        {/* Header — label + severity */}
        <div className="flex items-center gap-2">
          <span className="size-6 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
            <Sparkles size={13} />
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-700">AI insight · this run</span>
          <span className={`ml-auto inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${sev.pill}`}>
            <span className={`size-1.5 rounded-full ${sev.dot}`} /> {insight.severity}
          </span>
        </div>

        {/* Takeaway */}
        <h4 className="text-[15px] font-bold text-ink-900 leading-snug mt-2.5">{insight.takeaway}</h4>

        {/* Shape of the results */}
        <p className="text-[12.5px] text-ink-600 leading-relaxed mt-1.5">{insight.shape}</p>

        {/* Standout + at stake */}
        <div className="grid sm:grid-cols-2 gap-2.5 mt-3">
          <div className="rounded-xl border border-canvas-border bg-canvas-elevated p-3">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-1.5">
              <TriangleAlert size={12} className="text-mitigated-600" /> Worth noticing
            </div>
            <p className="text-[12px] text-ink-700 leading-snug">{insight.standout}</p>
          </div>
          <div className="rounded-xl border border-canvas-border bg-canvas-elevated p-3">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-1.5">
              <DollarSign size={12} className="text-risk" /> At stake
            </div>
            <p className="text-[12px] text-ink-700 leading-snug">{insight.atStake}</p>
          </div>
        </div>

        {/* Evidence — collapsible so the card stays scannable */}
        {insight.evidence.length > 0 && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setShowEvidence((v) => !v)}
              aria-expanded={showEvidence}
              className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-brand-700 hover:text-brand-600 cursor-pointer"
            >
              <motion.span animate={{ rotate: showEvidence ? 0 : -90 }} transition={{ type: 'spring', stiffness: 360, damping: 26 }} className="inline-flex">
                <ChevronDown size={14} />
              </motion.span>
              Evidence · {insight.evidence.length} {insight.evidence.length === 1 ? 'group' : 'groups'}
            </button>
            <AnimatePresence initial={false}>
              {showEvidence && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 rounded-lg border border-canvas-border divide-y divide-canvas-border overflow-hidden">
                    {insight.evidence.map((e, i) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-2 text-[11.5px] bg-canvas-elevated">
                        <span className="font-medium text-ink-800 min-w-0 truncate">{e.label}</span>
                        <span className="text-ink-500 ml-auto shrink-0 tabular-nums">{e.detail}</span>
                        <span className="text-ink-400 shrink-0 tabular-nums w-[76px] text-right">{e.match}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.section>
  );
}
