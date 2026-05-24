import { motion } from 'motion/react';
import { Sparkles, Plus, FileText, Clock, Workflow, Play, Settings2 } from 'lucide-react';
import { WORKFLOWS } from '../../data/mockData';
import { SAMPLE_WORKFLOWS } from './sampleWorkflows';

interface Props {
  prompt: string;
  setPrompt: (v: string) => void;
  onGenerate: () => void;
  onPickTemplate: (id: string) => void;
  onOpenAttach: () => void;
  attachmentCount?: number;
}

export default function StepWritePrompt({
  prompt,
  setPrompt,
  onGenerate,
  onPickTemplate,
  onOpenAttach,
  attachmentCount = 0,
}: Props) {
  const hasPrompt = prompt.trim().length > 0;
  const totalWorkflows = WORKFLOWS.length + SAMPLE_WORKFLOWS.length;

  return (
    <div className="flex flex-col items-stretch">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="text-center pt-12 pb-6"
      >
        <h1
          className="text-[56px] leading-[1.05] font-extrabold"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          <span className="text-ink-900">Audit smarter. </span>
          <span className="bg-gradient-to-r from-brand-600 to-evidence bg-clip-text text-transparent">
            Not harder.
          </span>
        </h1>
        <p className="mt-3 text-[14px] text-ink-500">
          Your AI copilot already knows what to look for. Just ask.
        </p>
      </motion.div>

      {/* Prompt box */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto w-full max-w-[820px] px-6"
      >
        <div className="rounded-2xl border border-canvas-border bg-canvas-elevated p-5 shadow-[0_1px_0_rgba(106,18,205,0.04),0_24px_48px_-32px_rgba(106,18,205,0.18)]">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder="Describe a workflow and let Auditify do the rest…"
            className="no-focus-ring w-full bg-transparent resize-none text-[14px] text-ink-800 placeholder:text-ink-400 focus:outline-none leading-relaxed"
          />
          <div className="flex items-center justify-between pt-3 border-t border-canvas-border">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onOpenAttach}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-ink-500 hover:bg-brand-50 hover:text-brand-600 transition-colors cursor-pointer"
                aria-label="Attach data"
              >
                <Plus size={16} />
                {attachmentCount > 0 && (
                  <span className="text-[11.5px] font-semibold text-brand-700">
                    {attachmentCount} attached
                  </span>
                )}
              </button>
            </div>
            <button
              type="button"
              disabled={!hasPrompt}
              onClick={onGenerate}
              className={[
                'inline-flex items-center gap-1.5 rounded-lg text-[13px] font-semibold px-4 py-2 transition-colors',
                hasPrompt
                  ? 'bg-brand-600 hover:bg-brand-500 text-white cursor-pointer'
                  : 'bg-brand-100 text-brand-300 cursor-not-allowed',
              ].join(' ')}
            >
              <Sparkles size={13} />
              Audit on Chat
            </button>
          </div>
        </div>
      </motion.div>

      {/* Recent Workflows */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.14, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto w-full max-w-[820px] px-6 pt-10 pb-16"
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-[14px] font-semibold text-ink-800">
              Recent Workflows
            </h2>
            <p className="text-[12px] text-ink-400 mt-0.5">Pick up where you left off</p>
          </div>
          <span className="text-[12px] text-ink-400 font-semibold">
            {totalWorkflows} workflows
          </span>
        </div>

        <ul className="flex flex-col gap-2">
          {SAMPLE_WORKFLOWS.map((w) => (
            <li key={w.id}>
              <button
                type="button"
                onClick={() => onPickTemplate(w.id)}
                className="w-full text-left group flex items-center gap-4 bg-canvas-elevated border border-canvas-border hover:border-brand-300 rounded-2xl px-4 py-3 transition-colors cursor-pointer"
              >
                <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                  <Workflow size={16} className="text-brand-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[13px] font-semibold text-ink-800 truncate">
                      {w.name}
                    </span>
                    <span className="text-[12px] font-semibold rounded-full px-1.5 py-0.5 bg-compliant-50 text-compliant-700">
                      Template
                    </span>
                  </div>
                  <p className="text-[12px] text-ink-500 truncate">{w.description}</p>
                  <div className="flex items-center gap-3 text-[12px] text-ink-400 mt-1">
                    <span className="inline-flex items-center gap-1">
                      <FileText size={11} />
                      {w.inputs.length} inputs
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Sparkles size={11} />
                      {w.steps.length} steps
                    </span>
                  </div>
                </div>
                <div
                  className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-canvas-border bg-white text-[12px] font-semibold text-ink-600 px-3 py-1.5">
                    <Settings2 size={12} />
                    Configure
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[12px] font-semibold px-3 py-1.5">
                    <Play size={12} />
                    Run
                  </span>
                </div>
              </button>
            </li>
          ))}

          {WORKFLOWS.map((w) => (
            <li key={w.id}>
              <div className="group flex items-center gap-4 bg-canvas-elevated border border-canvas-border hover:border-brand-300 rounded-2xl px-4 py-3 transition-colors">
                <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                  <FileText size={16} className="text-brand-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[13px] font-semibold text-ink-800 truncate">
                      {w.name}
                    </span>
                    <span className="text-[12px] font-semibold rounded-full px-1.5 py-0.5 bg-compliant-50 text-compliant-700">
                      {w.status === 'active' ? 'Active' : 'Draft'}
                    </span>
                    <span className="text-[12px] font-semibold rounded-full px-1.5 py-0.5 bg-brand-50 text-brand-700">
                      {w.type}
                    </span>
                  </div>
                  <p className="text-[12px] text-ink-500 truncate">{w.desc}</p>
                  <div className="flex items-center gap-3 text-[12px] text-ink-400 mt-1">
                    <span className="inline-flex items-center gap-1">
                      <Clock size={11} />
                      Last run {w.lastRun}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Sparkles size={11} />
                      {w.runs} runs
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <FileText size={11} />
                      {w.steps.length} steps
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-canvas-border bg-white hover:bg-canvas text-[12px] font-semibold text-ink-600 px-3 py-1.5 transition-colors cursor-pointer"
                  >
                    <Settings2 size={12} />
                    Configure
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-[12px] font-semibold px-3 py-1.5 transition-colors cursor-pointer"
                  >
                    <Play size={12} />
                    Run
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </motion.section>
    </div>
  );
}
