// Shared Plan-tab cards — used by BOTH the chat/QnA canvas (ArtifactPanel)
// and the workflow-builder canvas (DataSourcePanel) so the "Query Execution
// Plan" and "Assumptions" sections render identically in both modes.
//
// Self-contained: owns its own badge map, source-type icon/colour helpers and
// the expandable file/column rows, so neither host has to thread internals in.

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ListChecks, ChevronDown, AlertTriangle,
  FileSpreadsheet, FileText, Database, File as FileIcon,
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

function typeIcon(type: string) {
  if (type === 'csv' || type === 'excel') return FileSpreadsheet;
  if (type === 'pdf') return FileText;
  if (type === 'sql') return Database;
  return FileIcon;
}

function typeColor(type: string): string {
  if (type === 'csv' || type === 'excel') return 'text-compliant-700 bg-compliant-50';
  if (type === 'pdf') return 'text-high-700 bg-high-50';
  if (type === 'sql') return 'text-evidence-700 bg-evidence-50';
  return 'text-ink-500 bg-canvas';
}

function StepFilesAndColumns({ sources }: { sources: PlanCardSource[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showAllExpanded, setShowAllExpanded] = useState<Set<string>>(new Set());
  const COLLAPSED_COLUMN_CAP = 6;
  const toggle = (id: string) => setExpanded(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleShowAll = (id: string) => setShowAllExpanded(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  return (
    <div className="rounded-lg border border-canvas-border bg-canvas/40 overflow-hidden">
      <ul className="flex flex-col">
        {sources.map((input, i) => {
          const cols = input.columns ?? [];
          const isExpanded = expanded.has(input.id);
          const isShowAll = showAllExpanded.has(input.id);
          const Icon = typeIcon(input.type);
          const visibleCols = isShowAll ? cols : cols.slice(0, COLLAPSED_COLUMN_CAP);
          const hiddenCount = cols.length - visibleCols.length;
          return (
            <li key={input.id} className={i > 0 ? 'border-t border-canvas-border/60' : ''}>
              <button
                type="button"
                onClick={() => toggle(input.id)}
                aria-expanded={isExpanded}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-canvas-elevated transition-colors cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30"
              >
                <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${typeColor(input.type)}`}>
                  <Icon size={11} />
                </div>
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <span className="text-[12.5px] font-semibold text-ink-800 truncate">{input.name}</span>
                  <span className="text-[11px] font-mono text-ink-500 tabular-nums shrink-0">
                    {cols.length} col{cols.length === 1 ? '' : 's'}
                  </span>
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-ink-400 shrink-0">
                  {input.type}
                </span>
                <ChevronDown
                  size={12}
                  className={`text-ink-400 shrink-0 transition-transform duration-150 ${isExpanded ? '' : '-rotate-90'}`}
                />
              </button>
              {isExpanded && cols.length > 0 && (
                <div className="px-3 pb-2.5 pt-0.5">
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
                        onClick={() => toggleShowAll(input.id)}
                        className="inline-flex items-center rounded-md bg-canvas-elevated border border-canvas-border hover:border-brand-200 hover:bg-brand-50/40 px-1.5 py-0.5 text-[11.5px] font-mono text-ink-600 hover:text-brand-700 transition-colors cursor-pointer"
                      >
                        +{hiddenCount} more
                      </button>
                    )}
                    {isShowAll && cols.length > COLLAPSED_COLUMN_CAP && (
                      <button
                        type="button"
                        onClick={() => toggleShowAll(input.id)}
                        className="inline-flex items-center rounded-md bg-canvas-elevated border border-canvas-border hover:border-brand-200 hover:bg-brand-50/40 px-1.5 py-0.5 text-[11.5px] font-mono text-ink-600 hover:text-brand-700 transition-colors cursor-pointer"
                      >
                        Show less
                      </button>
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ─── Query Execution Plan card ───────────────────────────────────────────
// Numbered steps + type badge + description + expandable source chips.

export function QueryExecutionPlanCard({ steps, onEdit }: {
  steps: PlanCardStep[];
  onEdit?: () => void;
}) {
  return (
    <div className="group relative rounded-xl border border-canvas-border bg-canvas-elevated overflow-hidden transition-[border-color,box-shadow] duration-300 hover:border-brand-200 hover:shadow-[0_10px_28px_-14px_rgba(15,8,30,0.18)]">
      <div className="flex items-center px-4 py-3">
        <div className="flex-1 flex items-center gap-2 text-[14px] font-semibold tracking-tight text-ink-900">
          <ListChecks size={14} className="text-primary shrink-0" />
          <span className="flex-1 text-left">Query Execution Plan</span>
          <span className="text-[12px] font-normal text-ink-500">{steps.length} total</span>
        </div>
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
              className={`px-4 py-3 hover:bg-brand-50/30 transition-colors ${idx > 0 ? 'border-t border-canvas-border/70' : ''}`}
            >
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-ink-900 text-white flex items-center justify-center text-[12px] font-bold shrink-0 mt-0.5 tabular-nums">
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
