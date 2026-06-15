import { motion } from 'motion/react';
import { AlertTriangle, Check, Play } from 'lucide-react';

interface AssumptionsPanelProps {
  answers: Record<number, string>;
  assumptions: string[];
  onConfirm: () => void;
}

export default function AssumptionsPanel({
  answers,
  assumptions,
  onConfirm,
}: AssumptionsPanelProps) {
  const answerEntries = Object.entries(answers);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
      className="rounded-xl border border-mitigated bg-mitigated-50 overflow-hidden"
    >
      <div className="p-5">
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-4">
          <AlertTriangle size={15} className="text-mitigated-700" />
          <span className="text-[0.875rem] font-semibold text-ink-800">
            Assumptions
          </span>
          <span className="inline-flex items-center px-2 h-5 rounded-full bg-mitigated-50 text-mitigated-700 text-[0.75rem] font-medium tabular-nums">
            {assumptions.length}
          </span>
        </div>

        {/* Confirmed answers */}
        {answerEntries.length > 0 && (
          <div className="mb-4">
            <p className="text-[0.75rem] font-semibold text-ink-500 mb-2">
              Confirmed
            </p>
            <div className="space-y-2">
              {answerEntries.map(([key, value]) => (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.15, delay: Number(key) * 0.04 }}
                  className="flex items-start gap-2.5 px-3 py-2 rounded-md bg-compliant-50"
                >
                  <div className="flex items-center justify-center w-4 h-4 rounded-full bg-compliant mt-0.5 shrink-0">
                    <Check size={10} className="text-white" strokeWidth={3} />
                  </div>
                  <span className="text-[0.8125rem] text-ink-800 leading-snug">
                    {value}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Assumptions list */}
        <div className="mb-4">
          <p className="text-[0.75rem] font-semibold text-ink-500 mb-2">
            Ira will assume
          </p>
          <div className="space-y-2">
            {assumptions.map((assumption, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.15, delay: 0.08 + idx * 0.04 }}
                className="flex items-start gap-2.5 px-3 py-2 rounded-md bg-canvas-elevated border border-mitigated/30"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-mitigated-700 mt-1.5 shrink-0" />
                <span className="text-[0.8125rem] text-ink-800 leading-snug">
                  {assumption}
                </span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Confirm button */}
        <button
          onClick={onConfirm}
          className="flex items-center justify-center gap-2 w-full h-10 rounded-md bg-brand-600 hover:bg-brand-500 active:bg-brand-800 text-white text-[0.8125rem] font-semibold transition-colors cursor-pointer"
        >
          <Play size={14} />
          Confirm and execute
        </button>
      </div>
    </motion.div>
  );
}
