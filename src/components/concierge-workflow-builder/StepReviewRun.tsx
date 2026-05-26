import { motion, AnimatePresence } from 'motion/react';
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Check,
  Shapes,
  Play,
} from 'lucide-react';
import { type Dispatch, type SetStateAction } from 'react';
import type {
  WorkflowDraft,
  JourneyFiles,
  JourneyMappings,
  RunResult,
  StepSpec,
} from './types';

interface Props {
  workflow: WorkflowDraft;
  setWorkflow?: Dispatch<SetStateAction<WorkflowDraft | null>>;
  files?: JourneyFiles;
  mappings?: JourneyMappings;
  setMappings?: Dispatch<SetStateAction<JourneyMappings>>;
  running: boolean;
  result: RunResult | null;
  expandedSource?: string | null;
  setExpandedSource?: Dispatch<SetStateAction<string | null>>;
  onViewWorkspace?: () => void;
  onValidate?: () => void;
  validateDisabled?: boolean;
}

const STEP_BADGE: Record<
  StepSpec['type'],
  { label: string; bg: string; text: string }
> = {
  extract: { label: 'INGESTION', bg: 'bg-brand-50', text: 'text-brand-700' },
  analyze: { label: 'ANALYSIS', bg: 'bg-brand-600', text: 'text-white' },
  compare: { label: 'COMPARISON', bg: 'bg-brand-50', text: 'text-brand-700' },
  flag: { label: 'FLAGGING', bg: 'bg-risk-50', text: 'text-risk-700' },
  validate: { label: 'VALIDATION', bg: 'bg-evidence-50', text: 'text-evidence-700' },
  summarize: { label: 'SUMMARY', bg: 'bg-compliant-50', text: 'text-compliant-700' },
  calculate: { label: 'CALCULATION', bg: 'bg-mitigated-50', text: 'text-mitigated-700' },
};

const STAT_TONE: Record<NonNullable<RunResult['stats'][number]['tone']>, string> = {
  primary: 'text-brand-600',
  risk: 'text-risk',
  warning: 'text-mitigated',
  ok: 'text-compliant',
};

const ROW_TONE: Record<'flagged' | 'warning' | 'ok', string> = {
  flagged: 'bg-risk-50 border-l-2 border-risk',
  warning: 'bg-mitigated-50 border-l-2 border-mitigated',
  ok: 'bg-compliant-50 border-l-2 border-compliant',
};

const ROW_ICON = {
  flagged: AlertOctagon,
  warning: AlertTriangle,
  ok: CheckCircle2,
} as const;

const ROW_ICON_TONE: Record<'flagged' | 'warning' | 'ok', string> = {
  flagged: 'text-risk',
  warning: 'text-mitigated',
  ok: 'text-compliant',
};

export default function StepReviewRun({
  workflow,
  running,
  result,
  onViewWorkspace,
  onValidate,
  validateDisabled,
}: Props) {
  const stepCount = workflow.steps.length;
  const estimateSeconds = Math.max(8, stepCount * 3);
  const expectedRows = result?.rows.length ?? 5;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-3"
    >
      {/* Workflow plan — header + 1-line step summaries + output footer.
          Detailed step view lives in the right Plan tab. */}
      <section className="rounded-xl border border-canvas-border bg-canvas-elevated overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-canvas-border/60">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-[0.75rem] font-semibold text-ink-800">
              Workflow plan
            </span>
            <span className="text-[0.75rem] text-ink-400 truncate">
              {stepCount} step{stepCount === 1 ? '' : 's'} · ~{estimateSeconds}s
            </span>
          </div>
          <span className="text-[0.6875rem] text-ink-400 shrink-0">
            View full plan in the Plan tab
          </span>
        </div>

        <ol className="list-none p-0 m-0">
          {workflow.steps.map((step, idx) => {
            const badge = STEP_BADGE[step.type];
            return (
              <li
                key={step.id}
                className="flex items-center gap-2.5 px-4 py-2 border-t border-canvas-border first:border-t-0"
              >
                <span className="w-5 h-5 rounded-full bg-ink-900 text-white flex items-center justify-center text-[0.75rem] font-bold shrink-0 tabular-nums">
                  {idx + 1}
                </span>
                <span className="text-[0.8125rem] font-medium text-ink-800 truncate flex-1 min-w-0">
                  {step.name}
                </span>
                <span
                  className={`text-[0.75rem] font-bold tracking-wider rounded px-1.5 py-0.5 shrink-0 ${badge.bg} ${badge.text}`}
                >
                  {badge.label}
                </span>
              </li>
            );
          })}
        </ol>

        <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-compliant-50/60 border-t border-compliant/30">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-4 h-4 rounded-full bg-compliant text-white flex items-center justify-center shrink-0">
              <Check size={10} strokeWidth={3} />
            </span>
            <span className="text-[0.75rem] text-ink-500 shrink-0">Output</span>
            <span className="text-[0.75rem] font-semibold text-ink-800 truncate">
              {workflow.output.title}
            </span>
          </div>
          <span className="text-[0.75rem] text-ink-500 whitespace-nowrap shrink-0">
            ~{expectedRows} rows
          </span>
        </div>
      </section>

      <div className="flex items-center justify-between gap-2">
        {onValidate ? (
          <button
            type="button"
            onClick={onValidate}
            disabled={validateDisabled}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[0.75rem] font-semibold text-white bg-gradient-to-br from-brand-600 to-fuchsia-600 hover:from-brand-500 hover:to-fuchsia-500 shadow-[0_8px_16px_-10px_rgba(106,18,205,0.5)] disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            <Play size={13} />
            Validate workflow
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={() => onViewWorkspace?.()}
          className="inline-flex items-center gap-1.5 rounded-md border border-canvas-border bg-canvas-elevated hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50/40 px-3 py-1.5 text-[0.75rem] font-semibold text-ink-700 transition-colors cursor-pointer"
        >
          <Shapes size={13} />
          View Workspace
        </button>
      </div>

      {/* Running / Result */}
      {running && (
        <div className="rounded-xl border border-canvas-border bg-canvas-elevated p-5 flex items-center gap-3">
          <Loader2 size={18} className="animate-spin text-brand-600 shrink-0" />
          <div>
            <div className="text-[0.8125rem] font-semibold text-ink-800">Running workflow…</div>
            <div className="text-[0.75rem] text-ink-500">
              Ingesting, validating, and generating your output.
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {result && (
          <motion.section
            key={result.title}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="rounded-xl border border-canvas-border bg-canvas-elevated p-4"
          >
            <div className="flex items-baseline justify-between gap-4 mb-1">
              <h4 className="text-[0.875rem] font-semibold text-ink-800">
                {result.title}
              </h4>
              <span className="text-[0.75rem] text-ink-400 font-bold">
                {result.outputType}
              </span>
            </div>
            <p className="text-[0.75rem] text-ink-500 leading-relaxed mb-3">
              {result.description}
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
              {result.stats.map((s) => (
                <div
                  key={s.label}
                  className="rounded-lg border border-canvas-border bg-canvas p-3"
                >
                  <div className="text-[0.75rem] text-ink-400 font-bold">
                    {s.label}
                  </div>
                  <div className={`mt-0.5 text-[1.0625rem] font-bold ${STAT_TONE[s.tone]}`}>
                    {s.value}
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-canvas-border overflow-hidden">
              <table className="w-full text-[0.75rem]">
                <thead className="bg-canvas text-ink-500">
                  <tr>
                    <th className="w-7"></th>
                    {result.columns.map((c) => (
                      <th
                        key={c}
                        className="text-left font-semibold px-2.5 py-1.5 whitespace-nowrap"
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((r, i) => {
                    const Icon = ROW_ICON[r.status];
                    return (
                      <tr
                        key={i}
                        className={`${ROW_TONE[r.status]} ${i === 0 ? '' : 'border-t border-canvas-border'}`}
                      >
                        <td className="px-2 py-1.5 align-middle">
                          <Icon size={13} className={ROW_ICON_TONE[r.status]} />
                        </td>
                        {r.cells.map((cell, j) => (
                          <td
                            key={j}
                            className="px-2.5 py-1.5 text-ink-800 whitespace-nowrap"
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
