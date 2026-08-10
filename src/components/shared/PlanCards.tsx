// Shared Plan-tab cards — used by BOTH the chat/QnA canvas (ArtifactPanel)
// and the workflow-builder canvas (DataSourcePanel) so the "Query Execution
// Plan" and "Assumptions" sections render identically in both modes.
//
// Self-contained: owns its own badge map, source-type icon/colour helpers and
// the expandable file/column rows, so neither host has to thread internals in.

import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ListChecks, ChevronDown, AlertTriangle, RefreshCw, Pencil,
  FileText, Brain, Check, ShieldCheck,
} from 'lucide-react';
import type { AssumptionMemory } from '../../data/insightMemory';

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
  /** One-line technical detail of the actual operation — SQL join, filter,
   *  transform. Rendered as a mono artifact in the flow view. */
  operation?: string;
  /** Records read in / emitted out. When both are set the flow view draws a
   *  row-count funnel (e.g. 1,200,000 → 9) inside the node. */
  rowsIn?: number;
  rowsOut?: number;
  /** Short label for what this step hands to the next — the flow-edge tag. */
  output?: string;
}

export interface PlanAssumption {
  key: string;
  value: string;
  /** When present, this value was recalled from prior input rather than asked
   *  again — the AssumptionsCard renders a memory-provenance row beneath it. */
  memory?: AssumptionMemory;
}

// ─── Internal helpers ────────────────────────────────────────────────────

export const STEP_BADGE: Record<PlanStepType, { label: string; bg: string; text: string }> = {
  extract:   { label: 'INGESTION',   bg: 'bg-brand-50',      text: 'text-brand-700' },
  analyze:   { label: 'ANALYSIS',    bg: 'bg-brand-600',     text: 'text-white' },
  compare:   { label: 'COMPARISON',  bg: 'bg-compliant-50',  text: 'text-compliant-700' },
  flag:      { label: 'FLAGGING',    bg: 'bg-mitigated-50',  text: 'text-mitigated-700' },
  validate:  { label: 'VALIDATION',  bg: 'bg-evidence-50',   text: 'text-evidence-700' },
  summarize: { label: 'SUMMARY',     bg: 'bg-compliant-50',  text: 'text-compliant-700' },
  calculate: { label: 'CALCULATION', bg: 'bg-mitigated-50',  text: 'text-mitigated-700' },
};

export function typeColor(type: string): string {
  if (type === 'csv' || type === 'excel') return 'text-compliant-700 bg-compliant-50';
  if (type === 'pdf') return 'text-high-700 bg-high-50';
  if (type === 'sql') return 'text-evidence-700 bg-evidence-50';
  return 'text-ink-500 bg-canvas';
}

export function StepFilesAndColumns({ sources }: { sources: PlanCardSource[] }) {
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
          <div className="text-[0.6875rem] font-semibold text-ink-600 mb-1.5">
            Columns in {activeSource.name}
          </div>
          <div className="flex flex-wrap gap-1">
            {visibleCols.map(col => (
              <span
                key={col}
                className="inline-flex items-center rounded-md bg-brand-50 border border-brand-100 px-1.5 py-0.5 text-[0.71875rem] font-mono text-brand-700"
              >
                {col}
              </span>
            ))}
            {hiddenCount > 0 && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="inline-flex items-center rounded-md bg-canvas-elevated border border-canvas-border hover:border-brand-200 hover:bg-brand-50/40 px-1.5 py-0.5 text-[0.71875rem] font-mono text-ink-600 hover:text-brand-700 transition-colors cursor-pointer"
              >
                +{hiddenCount} more
              </button>
            )}
            {showAll && activeCols.length > COLLAPSED_COLUMN_CAP && (
              <button
                type="button"
                onClick={() => setShowAll(false)}
                className="inline-flex items-center rounded-md bg-canvas-elevated border border-canvas-border hover:border-brand-200 hover:bg-brand-50/40 px-1.5 py-0.5 text-[0.71875rem] font-mono text-ink-600 hover:text-brand-700 transition-colors cursor-pointer"
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

export function QueryExecutionPlanCard({ steps, onRegenerate, onStepEdit, headerAccessory }: {
  steps: PlanCardStep[];
  onRegenerate?: () => void;
  onStepEdit?: (step: PlanCardStep) => void;
  /** Optional control rendered in the header (e.g. a Flow/Steps view toggle). */
  headerAccessory?: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="group relative rounded-xl border border-canvas-border bg-canvas-elevated overflow-hidden transition-[border-color,box-shadow] duration-300 hover:border-brand-200 hover:shadow-[0_10px_28px_-14px_rgba(15,8,30,0.18)]">
      <div className="flex items-center px-4 py-3">
        <div className="flex-1 flex items-center gap-2 text-[0.875rem] font-semibold tracking-tight text-ink-900">
          <ListChecks size={14} className="text-primary shrink-0" />
          <span className="flex-1 text-left">Query Execution Plan</span>
        </div>
        {headerAccessory}
        {onRegenerate && (
          <button
            type="button"
            onClick={onRegenerate}
            title="Regenerate plan"
            className="ml-1 inline-flex items-center gap-1 text-[0.75rem] font-semibold text-brand-700 hover:text-brand-800 hover:bg-brand-50 px-2 py-1 rounded-md cursor-pointer transition-colors"
          >
            <RefreshCw size={12} />
            Regenerate
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          aria-label={open ? 'Collapse plan' : 'Expand plan'}
          className="ml-1 inline-flex items-center justify-center size-6 text-ink-400 hover:text-ink-700 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded"
        >
          <motion.span
            animate={{ rotate: open ? 0 : -90 }}
            transition={{ type: 'spring', stiffness: 360, damping: 26 }}
            className="inline-flex"
            aria-hidden
          >
            <ChevronDown size={15} />
          </motion.span>
        </button>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            key="plan-steps"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col border-t border-canvas-border overflow-hidden"
          >
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
                    <h3 className="text-[0.8125rem] font-semibold text-ink-900">{step.name}</h3>
                    {badge && (
                      <span className={`text-[0.6875rem] font-bold tracking-wider rounded px-1.5 py-0.5 ${badge.bg} ${badge.text}`}>
                        {badge.label}
                      </span>
                    )}
                  </div>
                  <p className="text-[0.75rem] text-ink-500 leading-relaxed mt-0.5">{step.description}</p>
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
                    className="shrink-0 -mt-0.5 inline-flex items-center gap-1 text-[0.71875rem] font-semibold text-brand-700 hover:text-brand-800 hover:bg-brand-50 px-1.5 py-0.5 rounded-md cursor-pointer transition-[color,background-color,opacity] opacity-0 group-hover/step:opacity-100 focus-visible:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  >
                    <Pencil size={11} />
                    Edit
                  </button>
                )}
              </div>
            </li>
          );
        })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Assumptions card ────────────────────────────────────────────────────
// Collapsible key/value list; "Edit" hands the assumptions to the composer.

// Memory-provenance row shown beneath an assumption recalled from prior input.
// This is the "fewer clarifications" payoff — instead of re-asking, IRA shows
// what it assumed, where it learned it, and a one-tap way to correct it.
function AssumptionMemoryRow({ memory }: {
  memory: AssumptionMemory;
}) {
  const pct = Math.round(memory.confidence * 100);
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.6875rem]">
      <span className="text-ink-500">
        You set this in <span className="font-medium text-ink-700">{memory.source}</span> · {memory.learnedOn}
      </span>
      <span
        title="Memory's confidence that your earlier answer still applies"
        className="inline-flex items-center gap-1 rounded-md bg-compliant-50 px-1.5 py-0.5 font-semibold text-compliant-700 tabular-nums"
      >
        <Check size={10} strokeWidth={3} /> {pct}% still applies
      </span>
    </div>
  );
}

export function AssumptionsCard({ assumptions, onEdit, onCorrectAssumption, context = 'query', caption }: {
  assumptions: PlanAssumption[];
  onEdit?: () => void;
  /** Called when the user taps "Correct it" on a memory-backed assumption. */
  onCorrectAssumption?: (assumption: PlanAssumption) => void;
  context?: 'query' | 'workflow';
  /** Replaces the "N defaults applied to this query" line. A run started from a
   *  recommended action applied no defaults — it was handed its context. */
  caption?: string;
}) {
  const [open, setOpen] = useState(true);
  if (assumptions.length === 0) return null;
  const recalledCount = assumptions.filter(a => a.memory).length;
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
              {caption ?? `${assumptions.length} defaults applied to this ${context}`}
              {recalledCount > 0 && (
                <span className="text-evidence-700 font-medium">
                  {' · '}saved you {recalledCount} clarification{recalledCount === 1 ? '' : 's'}
                </span>
              )}
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
                  className={`grid grid-cols-[130px_minmax(0,1fr)] gap-4 px-2 py-2 rounded-md transition-colors ${a.memory ? 'bg-evidence-50/40 hover:bg-evidence-50/60' : 'hover:bg-paper-50/70'}`}
                >
                  <dt className="flex flex-col items-start gap-1.5 text-[0.75rem] font-medium text-ink-500 leading-[1.45] self-start">
                    <span>{a.key}</span>
                    {a.memory && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-evidence-50 ring-1 ring-inset ring-evidence-100 px-1.5 py-0.5 text-[0.6875rem] font-semibold text-evidence-700">
                        {a.memory.enterprise ? <ShieldCheck size={11} /> : <Brain size={11} />}
                        {a.memory.enterprise ? 'Enterprise memory' : 'From memory'}
                      </span>
                    )}
                  </dt>
                  <dd className="text-[0.8125rem] text-ink-900 leading-[1.5]">
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0">{a.value}</span>
                      {a.memory && onCorrectAssumption && (
                        <button
                          type="button"
                          onClick={() => onCorrectAssumption(a)}
                          title="Not right? Correct it"
                          aria-label="Not right? Correct it"
                          className="shrink-0 -mt-0.5 -mr-0.5 inline-flex size-6 items-center justify-center rounded-md text-ink-400 hover:text-brand-700 hover:bg-brand-50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                        >
                          <Pencil size={12} />
                        </button>
                      )}
                    </div>
                    {a.memory && <AssumptionMemoryRow memory={a.memory} />}
                  </dd>
                </div>
              ))}
            </dl>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
