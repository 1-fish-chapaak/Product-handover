/**
 * Workflow Builder — the agent chooser (mirrors production's
 * WorkflowAgentChooser) plus a third way in: Audit with AI, for when the
 * user doesn't have one workflow in mind but wants Ira to plan the audit.
 */
import { ArrowRight, ShieldCheck, Workflow } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import type { WorkflowAgent } from '../../hooks/useAppState';
import { IraMark } from '../audit-plan/PlanParts';

interface Props {
  onSelectAgent: (agent: WorkflowAgent) => void;
  onAuditWithAi: () => void;
}

const AGENTS = [
  {
    id: 'general' as const,
    label: 'General Workflow',
    icon: Workflow,
    description: 'Explore and analyse data with tables, charts, KPIs and summaries.',
  },
  {
    id: 'grc' as const,
    label: 'GRC Workflow',
    icon: ShieldCheck,
    description: 'Test controls and find violations. One exception table with a clear summary.',
  },
];

export default function WorkflowBuilderLanding({ onSelectAgent, onAuditWithAi }: Props) {
  const reduced = useReducedMotion();
  return (
    <div className="h-full overflow-y-auto bg-white">
      <motion.div
        initial={reduced ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
        className="mx-auto w-full max-w-3xl px-6 py-16 md:py-24"
      >
        <h1 className="text-center font-serif text-[2rem] tracking-tight text-ink-900 leading-tight">
          Choose your workflow agent
        </h1>
        <p className="mt-3 text-center text-[0.875rem] text-ink-500">
          Your agent stays with this workflow through revisions and future runs.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {AGENTS.map(({ id, label, icon: Icon, description }) => (
            <button
              key={id}
              type="button"
              onClick={() => onSelectAgent(id)}
              className="group rounded-xl border border-canvas-border bg-canvas-elevated p-6 text-left transition-colors hover:border-brand-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <Icon size={24} className="mb-5 text-brand-600" aria-hidden />
              <h2 className="text-[1.0625rem] font-semibold text-ink-900">{label}</h2>
              <p className="mt-2 min-h-16 text-[0.875rem] leading-relaxed text-ink-600">{description}</p>
              <span className="mt-5 flex items-center gap-2 text-[0.875rem] font-semibold text-brand-700">
                Start {label} <ArrowRight size={16} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </button>
          ))}
        </div>

        {/* Audit with AI — not a third agent: a planning surface that ends in
            GRC workflows, so it sits below the pair rather than beside them. */}
        <button
          type="button"
          onClick={onAuditWithAi}
          className="group mt-4 w-full rounded-xl border border-canvas-border bg-paper-50 p-5 text-left transition-colors hover:border-brand-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 flex flex-col sm:flex-row sm:items-center gap-4"
        >
          <IraMark size={36} />
          <span className="min-w-0 flex-1">
            <span className="block text-[1rem] font-semibold text-ink-900">Not sure where to start? Audit with AI</span>
            <span className="block mt-1 text-[0.8125rem] text-ink-600 leading-relaxed">
              Add your data, documentation and last reports. Ira recommends a full engagement — controls, a check for
              each, what already exists vs what's new, coverage gained and a timeline.
            </span>
          </span>
          <span className="flex items-center gap-2 text-[0.875rem] font-semibold text-brand-700 shrink-0">
            Plan my audit <ArrowRight size={16} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
          </span>
        </button>

        <p className="mt-5 text-center text-[0.75rem] text-ink-400">
          Both agents support audit periods and configurable inputs. Start a new chat to choose another agent.
        </p>
      </motion.div>
    </div>
  );
}
