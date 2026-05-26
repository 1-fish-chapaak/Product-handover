import { motion } from 'motion/react';
import {
  AlertTriangle,
  BarChart3,
  Search,
  Sparkles,
  Loader2,
  Save,
  Check,
} from 'lucide-react';
import type { WorkflowDraft, RunResult } from './types';

interface Props {
  workflow: WorkflowDraft;
  result: RunResult | null;
  running: boolean;
  onSave?: () => void;
  saved?: boolean;
  saveLabel?: string;
  savedLabel?: string;
}

export default function StepOutputView({
  workflow,
  result,
  running,
  onSave,
  saved,
  saveLabel = 'Save Workflow',
  savedLabel = 'Workflow saved',
}: Props) {
  if (running && !result) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-canvas-border bg-canvas-elevated px-3 py-2.5">
        <Loader2 size={14} className="animate-spin text-brand-600 shrink-0" />
        <div className="text-[0.75rem] text-ink-700">
          Running <b className="text-brand-700">{workflow.name}</b>…
        </div>
      </div>
    );
  }

  if (!result) return null;

  const insights = [
    {
      id: 'duplicate',
      title: 'Duplicate Detection',
      icon: Sparkles,
      iconBg: 'bg-brand-50',
      iconColor: 'text-brand-600',
      body: (
        <>
          <b className="text-brand-700">8 potential duplicates</b> identified across 3 vendors.
          Highest confidence pair: INV-4521 vs INV-3102 (Acme Corp) with 96% field similarity.
        </>
      ),
      priority: 'High Priority',
      priorityColor: 'bg-risk-50 text-risk-700',
    },
    {
      id: 'mtow',
      title: 'MTOW Weight Discrepancies',
      icon: AlertTriangle,
      iconBg: 'bg-mitigated-50',
      iconColor: 'text-mitigated',
      body: (
        <>
          <b className="text-brand-700">12 invoices</b> show MTOW values exceeding the certified
          maximum by &gt;5%. Average overcharge per invoice:{' '}
          <b className="text-brand-700">$3,847</b>.
        </>
      ),
      priority: 'Medium Priority',
      priorityColor: 'bg-mitigated-50 text-mitigated',
    },
    {
      id: 'rate',
      title: 'Rate Compliance',
      icon: BarChart3,
      iconBg: 'bg-compliant-50',
      iconColor: 'text-compliant',
      body: (
        <>
          <b className="text-brand-700">97.3%</b> of terminal charges align with the YYZ Rate Master.
          Remaining 2.7% used outdated rate tiers from Q2 2024.
        </>
      ),
      priority: 'On Track',
      priorityColor: 'bg-compliant-50 text-compliant-700',
    },
    {
      id: 'vendor',
      title: 'Vendor Concentration Risk',
      icon: Search,
      iconBg: 'bg-brand-50',
      iconColor: 'text-brand-600',
      body: (
        <>
          <b className="text-brand-700">68%</b> of flagged invoices originate from 2 vendors (Acme
          Corp, GlobalFlight). Targeted vendor auditing may yield higher returns.
        </>
      ),
      priority: 'Insight',
      priorityColor: 'bg-brand-50 text-brand-700',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col gap-4"
    >
      {/* AI Summary */}
      <section className="rounded-xl bg-brand-50/50 border border-brand-100 p-4">
        <div className="inline-flex items-center gap-1.5 text-[0.6875rem] font-bold text-brand-700 bg-white/80 border border-brand-100 rounded-full px-2 py-1 mb-2">
          <Sparkles size={11} />
          AI SUMMARY
        </div>
        <p className="text-[0.8125rem] text-ink-700 leading-relaxed">
          Scanned <b className="text-brand-700">12,450 invoices</b> against 6-month history.
          Identified <b className="text-brand-700">8 potential duplicates</b> totalling{' '}
          <b className="text-brand-700">₹6.10L at risk</b>. Highest confidence match: INV-4521 vs
          INV-3102 (Acme Corp, 96% match).{' '}
          <b className="text-brand-700">3 invoices</b> from the same vendor within 48 hours flagged
          as suspicious. False positive rate: 4.2% (down from 6.5% last run). Recommend immediate
          review of the 3 critical-severity flags before next payment batch.
        </p>
      </section>

      {/* Key Observations */}
      <div>
        <h2 className="text-[0.875rem] font-semibold text-ink-900 mb-2">
          Key Observations &amp; Insights
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {insights.map((o) => {
            const Icon = o.icon;
            return (
              <div
                key={o.id}
                className="rounded-xl border border-canvas-border bg-canvas-elevated p-3"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <div
                    className={`w-7 h-7 rounded-lg ${o.iconBg} ${o.iconColor} flex items-center justify-center shrink-0`}
                  >
                    <Icon size={13} />
                  </div>
                  <div className="text-[0.8125rem] font-semibold text-ink-800">{o.title}</div>
                </div>
                <p className="text-[0.75rem] text-ink-600 leading-relaxed mb-2">{o.body}</p>
                <span
                  className={`inline-flex items-center text-[0.6875rem] font-semibold rounded-md px-2 py-0.5 ${o.priorityColor}`}
                >
                  {o.priority}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {onSave && (
        <div className="flex items-center justify-start">
          <button
            type="button"
            onClick={onSave}
            disabled={saved}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[0.75rem] font-semibold text-white bg-gradient-to-br from-brand-600 to-fuchsia-600 hover:from-brand-500 hover:to-fuchsia-500 shadow-[0_8px_16px_-10px_rgba(106,18,205,0.5)] disabled:opacity-60 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            {saved ? <Check size={13} /> : <Save size={13} />}
            {saved ? savedLabel : saveLabel}
          </button>
        </div>
      )}
    </motion.div>
  );
}
