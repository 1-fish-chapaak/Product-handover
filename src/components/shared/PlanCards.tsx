// Shared Plan-tab cards — used by BOTH the chat/QnA canvas (ArtifactPanel)
// and the workflow-builder canvas (DataSourcePanel) so the "Query Execution
// Plan" and "Assumptions" sections render identically in both modes.
//
// Self-contained: owns its own badge map, source-type icon/colour helpers and
// the expandable file/column rows, so neither host has to thread internals in.

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ListChecks, ChevronDown, AlertTriangle, RefreshCw, Pencil,
  FileText,
} from 'lucide-react';

// ─── Data contracts ──────────────────────────────────────────────────────

export type PlanStepType =
  | 'extract' | 'analyze' | 'compare' | 'flag' | 'summarize' | 'calculate' | 'validate';

export interface PlanCardSource {
  id: string;
  name: string;
  /** Source format — drives the icon, colour and uppercase tag ('csv'|'pdf'|'sql'…). */
  type: string;
  columns?: string[];
}

export interface PlanCardStep {
  id: string;
  name: string;
  type: PlanStepType;
  description: string;
  /** Data files this step reads — rendered as expandable source chips. */
  sources?: PlanCardSource[];
}

export interface PlanAssumption {
  key: string;
  value: string;
}

// ─── Internal helpers ────────────────────────────────────────────────────

const STEP_BADGE: Record<PlanStepType, { label: string; bg: string; text: string }> = {
  extract:   { label: 'INGESTION',   bg: 'bg-brand-50',      text: 'text-brand-700' },
  analyze:   { label: 'ANALYSIS',    bg: 'bg-brand-600',     text: 'text-white' },
  compare:   { label: 'COMPARISON',  bg: 'bg-compliant-50',  text: 'text-compliant-700' },
  flag:      { label: 'FLAGGING',    bg: 'bg-mitigated-50',  text: 'text-mitigated-700' },
  validate:  { label: 'VALIDATION',  bg: 'bg-evidence-50',   text: 'text-evidence-700' },
  summarize: { label: 'SUMMARY',     bg: 'bg-compliant-50',  text: 'text-compliant-700' },
  calculate: { label: 'CALCULATION', bg: 'bg-mitigated-50',  text: 'text-mitigated-700' },
};

function typeColor(type: string): string {
  if (type === 'csv' || type === 'excel') return 'text-compliant-700 bg-compliant-50';
  if (type === 'pdf') return 'text-high-700 bg-high-50';
  if (type === 'sql') return 'text-evidence-700 bg-evidence-50';
  return 'text-ink-500 bg-canvas';
}

function StepFilesAndColumns({ sources }: { sources: PlanCardSource[] }) {
  // One file open at a time — clicking a pill reveals that file's columns in a
  // full-width strip below the pill row; clicking it again (or another pill)
  // collapses / switches.
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const COLLAPSED_COLUMN_CAP = 6;

  const selectFile = (id: string) => {
    setActiveId(prev => (prev === id ? null : id));
    setShowAll(false);
  };

  const activeSource = sources.find(s => s.id === activeId) ?? null;
  const activeCols = activeSource?.columns ?? [];
  const visibleCols = showAll ? activeCols : activeCols.slice(0, COLLAPSED_COLUMN_CAP);
  const hiddenCount = activeCols.length - visibleCols.length;

  return (
    <div className="flex flex-col gap-1.5">
      {/* File pills — name · column count · file-type tag. */}
      <div className="flex flex-wrap gap-1.5">
        {sources.map((input) => {
          const cols = input.columns ?? [];
          const isActive = input.id === activeId;
          return (
            <button
              key={input.id}
              type="button"
              onClick={() => selectFile(input.id)}
              aria-expanded={isActive}
              title={`${input.name} — ${cols.length} column${cols.length === 1 ? '' : 's'}`}
              className={`inline-flex items-center gap-1.5 rounded-lg border border-canvas-border px-2.5 py-1.5 text-[0.8125rem] font-semibold text-brand-700 transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                isActive
                  ? 'bg-paper-100'
                  : 'bg-white hover:bg-paper-50/60'
              }`}
            >
              <FileText size={14} strokeWidth={2} className="shrink-0" />
              <span className="truncate max-w-[12rem]">{input.name}</span>
              <span className={`text-[0.625rem] font-bold uppercase tracking-wider rounded px-1 py-0.5 ${typeColor(input.type)}`}>
                {input.type}
              </span>
            </button>
          );
        })}
      </div>

      {/* Columns for the open file. */}
      {activeSource && activeCols.length > 0 && (
        <div className="rounded-lg border border-canvas-border/70 bg-canvas/30 px-3 py-2.5">
          <div className="text-[11px] font-semibold text-ink-600 mb-1.5">
            Columns in {activeSource.name}
          </div>
          <div className="flex flex-wrap gap-1">
            {visibleCols.map(col => (
              <span
                key={col}
                className="inline-flex items-center rounded-md bg-brand-50 border border-brand-100 px-1.5 py-0.5 text-[11.5px] font-mono text-brand-700"
              >
                {col}
              </span>
            ))}
            {hiddenCount > 0 && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="inline-flex items-center rounded-md bg-canvas-elevated border border-canvas-border hover:border-brand-200 hover:bg-brand-50/40 px-1.5 py-0.5 text-[11.5px] font-mono text-ink-600 hover:text-brand-700 transition-colors cursor-pointer"
              >
                +{hiddenCount} more
              </button>
            )}
            {showAll && activeCols.length > COLLAPSED_COLUMN_CAP && (
              <button
                type="button"
                onClick={() => setShowAll(false)}
                className="inline-flex items-center rounded-md bg-canvas-elevated border border-canvas-border hover:border-brand-200 hover:bg-brand-50/40 px-1.5 py-0.5 text-[11.5px] font-mono text-ink-600 hover:text-brand-700 transition-colors cursor-pointer"
              >
                Show less
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Query Execution Plan card ───────────────────────────────────────────
// Numbered steps + type badge + description + expandable source chips.

export function QueryExecutionPlanCard({ steps, onEdit, onRegenerate, onStepEdit }: {
  steps: PlanCardStep[];
  onEdit?: () => void;
  onRegenerate?: () => void;
  onStepEdit?: (step: PlanCardStep) => void;
}) {
  return (
    <div className="group relative rounded-xl border border-canvas-border bg-canvas-elevated overflow-hidden transition-[border-color,box-shadow] duration-300 hover:border-brand-200 hover:shadow-[0_10px_28px_-14px_rgba(15,8,30,0.18)]">
      <div className="flex items-center px-4 py-3">
        <div className="flex-1 flex items-center gap-2 text-[14px] font-semibold tracking-tight text-ink-900">
          <ListChecks size={14} className="text-primary shrink-0" />
          <span className="flex-1 text-left">Query Execution Plan</span>
        </div>
        {onRegenerate && (
          <button
            type="button"
            onClick={onRegenerate}
            title="Regenerate plan"
            className="ml-1 inline-flex items-center gap-1 text-[12px] font-semibold text-brand-700 hover:text-brand-800 hover:bg-brand-50 px-2 py-1 rounded-md cursor-pointer transition-colors"
          >
            <RefreshCw size={12} />
            Regenerate
          </button>
        )}
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="ml-1 text-[12px] font-semibold text-brand-700 hover:text-brand-800 hover:bg-brand-50 px-2 py-1 rounded-md cursor-pointer transition-colors"
          >
            Edit
          </button>
        )}
      </div>
      <ul className="flex flex-col border-t border-canvas-border">
        {steps.map((step, idx) => {
          const badge = STEP_BADGE[step.type];
          const sources = step.sources ?? [];
          return (
            <li
              key={step.id}
              className={`group/step px-4 py-3 hover:bg-brand-50/30 transition-colors ${idx > 0 ? 'border-t border-canvas-border/70' : ''}`}
            >
              <div className="flex items-start gap-3">
                <span className="shrink-0 mt-0.5 size-5 rounded-full bg-brand-600 text-white text-[0.6875rem] font-bold flex items-center justify-center tabular-nums" aria-hidden>
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-[13px] font-semibold text-ink-900">{step.name}</h3>
                    {badge && (
                      <span className={`text-[11px] font-bold tracking-wider rounded px-1.5 py-0.5 ${badge.bg} ${badge.text}`}>
                        {badge.label}
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-ink-500 leading-relaxed mt-0.5">{step.description}</p>
                  {sources.length > 0 && (
                    <div className="mt-2">
                      <StepFilesAndColumns sources={sources} />
                    </div>
                  )}
                </div>
                {onStepEdit && (
                  <button
                    type="button"
                    onClick={() => onStepEdit(step)}
                    title={`Edit step — ${step.name}`}
                    aria-label={`Edit step — ${step.name}`}
                    className="shrink-0 -mt-0.5 inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand-700 hover:text-brand-800 hover:bg-brand-50 px-1.5 py-0.5 rounded-md cursor-pointer transition-[color,background-color,opacity] opacity-0 group-hover/step:opacity-100 focus-visible:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  >
                    <Pencil size={11} />
                    Edit
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ─── Assumptions card ────────────────────────────────────────────────────
// Collapsible key/value list; "Edit" hands the assumptions to the composer.

export function AssumptionsCard({ assumptions, onEdit, context = 'query' }: {
  assumptions: PlanAssumption[];
  onEdit?: () => void;
  context?: 'query' | 'workflow';
}) {
  const [open, setOpen] = useState(true);
  if (assumptions.length === 0) return null;
  return (
    <section
      aria-label="Assumptions"
      className="group relative rounded-xl border border-canvas-border bg-canvas-elevated overflow-hidden transition-[border-color,box-shadow] duration-300 hover:border-brand-200 hover:shadow-[0_10px_28px_-14px_rgba(15,8,30,0.18)]"
    >
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          aria-controls="assumptions-list"
          className="flex-1 flex items-center gap-3 px-4 py-3 hover:bg-paper-50/40 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-inset"
        >
          <div className="size-7 rounded-lg bg-brand-50 ring-1 ring-inset ring-brand-100 flex items-center justify-center shrink-0">
            <AlertTriangle size={13} className="text-brand-600" />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <h3 className="text-[0.75rem] font-semibold text-ink-900 leading-tight tracking-tight">Assumptions</h3>
            <p className="text-[0.75rem] text-ink-500 mt-px leading-tight">
              {assumptions.length} defaults applied to this {context}
            </p>
          </div>
        </button>
        <div className="flex items-center pr-3">
          {onEdit && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              title="Edit assumptions in chat"
              className="text-[0.75rem] font-semibold text-brand-700 hover:text-brand-800 hover:bg-brand-50 px-2 py-1 rounded-md cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              Edit
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            aria-expanded={open}
            aria-label={open ? 'Collapse assumptions' : 'Expand assumptions'}
            className="inline-flex items-center justify-center size-6 text-ink-400 hover:text-ink-700 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded"
          >
            <motion.span
              animate={{ rotate: open ? 0 : -90 }}
              transition={{ type: 'spring', stiffness: 360, damping: 26 }}
              className="inline-flex"
              aria-hidden
            >
              <ChevronDown size={14} />
            </motion.span>
          </button>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="assumptions-body"
            id="assumptions-list"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <dl className="px-3 pb-3 border-t border-canvas-border/70 pt-2">
              {assumptions.map((a) => (
                <div
                  key={a.key}
                  className="grid grid-cols-[130px_minmax(0,1fr)] gap-4 px-2 py-2 rounded-md hover:bg-paper-50/70 transition-colors"
                >
                  <dt className="text-[0.75rem] font-medium text-ink-500 leading-[1.45] self-start">{a.key}</dt>
                  <dd className="text-[0.8125rem] text-ink-900 leading-[1.5]">{a.value}</dd>
                </div>
              ))}
            </dl>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
