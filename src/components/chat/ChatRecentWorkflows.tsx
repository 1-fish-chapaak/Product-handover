import { motion } from 'motion/react';
import { FileText, Clock, Workflow, Play, Settings2, ListChecks } from 'lucide-react';
import { WORKFLOWS } from '../../data/mockData';
import { SAMPLE_WORKFLOWS } from '../concierge-workflow-builder/sampleWorkflows';

interface Props {
  /**
   * Activated when a row is clicked. The caller (chat empty state) drops the
   * workflow name into the composer — no auto-send — exactly how the starter
   * chips behave.
   */
  onPick: (seed: string) => void;
}

// Recent Workflows launcher for the chat (Ask IRA) empty state, shown when the
// composer is in Workflow mode. The markup mirrors the standalone builder's
// list (StepWritePrompt) so the surface reads the same; the only difference is
// behaviour — every row fills the composer via `onPick` instead of advancing a
// journey. The inner Configure / Run controls are decorative spans (a button
// can't nest buttons); a click anywhere on the row triggers `onPick`.
export default function ChatRecentWorkflows({ onPick }: Props) {
  const totalWorkflows = WORKFLOWS.length + SAMPLE_WORKFLOWS.length;

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
      className="w-full text-left pb-2"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h2 className="text-[0.875rem] font-semibold text-ink-800">
            Recent Workflows
          </h2>
          <p className="text-[0.75rem] text-ink-400 mt-0.5">Pick up where you left off</p>
        </div>
        <span className="text-[0.75rem] text-ink-400 font-semibold">
          {totalWorkflows} workflows
        </span>
      </div>

      <ul className="flex flex-col gap-2">
        {SAMPLE_WORKFLOWS.map((w) => (
          <li key={w.id}>
            <button
              type="button"
              onClick={() => onPick(w.name)}
              className="w-full text-left group flex items-center gap-4 bg-canvas-elevated border border-canvas-border hover:border-brand-300 rounded-lg px-4 py-3 shadow-[0_1px_2px_rgba(15,8,30,0.04)] hover:shadow-[0_8px_24px_rgba(15,8,30,0.06)] transition-[box-shadow,border-color] duration-200 cursor-pointer"
            >
              <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                <Workflow size={16} className="text-brand-700" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[0.8125rem] font-semibold text-ink-800 truncate">
                    {w.name}
                  </span>
                  <span className="text-[0.75rem] font-semibold rounded-full px-1.5 py-0.5 bg-compliant-50 text-compliant-700">
                    Template
                  </span>
                </div>
                <p className="text-[0.75rem] text-ink-500 truncate">{w.description}</p>
                <div className="flex items-center gap-3 text-[0.75rem] text-ink-400 mt-1">
                  <span className="inline-flex items-center gap-1">
                    <FileText size={11} />
                    {w.inputs.length} inputs
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <ListChecks size={11} />
                    {w.steps.length} steps
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.75rem] font-semibold text-ink-600 px-3 py-1.5">
                  <Settings2 size={12} />
                  Configure
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[0.75rem] font-semibold px-3 py-1.5">
                  <Play size={12} />
                  Run
                </span>
              </div>
            </button>
          </li>
        ))}

        {WORKFLOWS.map((w) => (
          <li key={w.id}>
            <button
              type="button"
              onClick={() => onPick(w.name)}
              className="w-full text-left group flex items-center gap-4 bg-canvas-elevated border border-canvas-border hover:border-brand-300 rounded-lg px-4 py-3 shadow-[0_1px_2px_rgba(15,8,30,0.04)] hover:shadow-[0_8px_24px_rgba(15,8,30,0.06)] transition-[box-shadow,border-color] duration-200 cursor-pointer"
            >
              <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                <FileText size={16} className="text-brand-700" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[0.8125rem] font-semibold text-ink-800 truncate">
                    {w.name}
                  </span>
                  <span className="text-[0.75rem] font-semibold rounded-full px-1.5 py-0.5 bg-compliant-50 text-compliant-700">
                    {w.status === 'active' ? 'Active' : 'Draft'}
                  </span>
                  <span className="text-[0.75rem] font-semibold rounded-full px-1.5 py-0.5 bg-brand-50 text-brand-700">
                    {w.type}
                  </span>
                </div>
                <p className="text-[0.75rem] text-ink-500 truncate">{w.desc}</p>
                <div className="flex items-center gap-3 text-[0.75rem] text-ink-400 mt-1">
                  <span className="inline-flex items-center gap-1">
                    <Clock size={11} />
                    Last run {w.lastRun}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Play size={11} />
                    {w.runs} runs
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <FileText size={11} />
                    {w.steps.length} steps
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.75rem] font-semibold text-ink-600 px-3 py-1.5">
                  <Settings2 size={12} />
                  Configure
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[0.75rem] font-semibold px-3 py-1.5">
                  <Play size={12} />
                  Run
                </span>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </motion.section>
  );
}
